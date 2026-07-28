import { Codex, type ThreadItem } from "@openai/codex-sdk";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { PersonalOsDatabase } from "@personal-os/database";
import type { CodexRun, Project, Task } from "@personal-os/domain";

export interface AssignmentOptions {
  mode: "demo" | "live";
  newThread: boolean;
  additionalInstructions?: string;
}

function buildTaskPrompt(task: Task, project: Project | null, additionalInstructions?: string): string {
  return [
    `Personal OS task id: ${task.id}`,
    `Project: ${project?.name ?? "Unassigned"}`,
    `Outcome: ${project?.outcome ?? "Complete the task safely."}`,
    `Task: ${task.title}`,
    `Description: ${task.description || "No additional description."}`,
    `Acceptance criteria:\n${task.acceptanceCriteria.length > 0 ? task.acceptanceCriteria.map((item) => `- ${item}`).join("\n") : "- Explain what was verified."}`,
    "Execution rules:",
    "- Follow repository AGENTS.md files.",
    "- Work only inside the assigned working directory.",
    "- Do not pay, purchase, publish, contact people, or deploy to production.",
    "- Run proportionate tests or checks.",
    "- Finish with a concise result and verification summary for human review.",
    additionalInstructions ? `Additional instructions: ${additionalInstructions}` : ""
  ].filter(Boolean).join("\n\n");
}

function extractArtifactPaths(items: ThreadItem[]): string[] {
  return Array.from(new Set(items.flatMap((item) => item.type === "file_change" ? item.changes.map((change) => change.path) : [])));
}

function summarizeVerification(items: ThreadItem[]): string {
  const commands = items.filter((item) => item.type === "command_execution");
  const completed = commands.filter((item) => item.type === "command_execution" && item.status === "completed").length;
  const failed = commands.filter((item) => item.type === "command_execution" && item.status === "failed").length;
  const files = extractArtifactPaths(items).length;
  return `Codex reported ${completed} completed command checks, ${failed} failed command checks, and ${files} changed file paths. Review the final response and repository diff before approval.`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class CodexOrchestrator {
  constructor(private readonly database: PersonalOsDatabase) {}

  assign(taskId: string, options: AssignmentOptions): CodexRun {
    const task = this.database.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== "ready") throw new Error(`Task must be ready before assignment: ${task.status}`);
    if (task.delegationMode === "human_only") throw new Error("Human-only tasks cannot be assigned to Codex.");
    const project = task.projectId ? this.database.getProject(task.projectId) : null;
    if (options.mode === "live") {
      const repositoryPath = project?.repositoryPath;
      if (!repositoryPath || !existsSync(repositoryPath) || !statSync(repositoryPath).isDirectory() || !existsSync(join(repositoryPath, ".git"))) {
        throw new Error("Live Codex requires an existing local Git repository path on the assigned project.");
      }
    }
    const workingDirectory = project?.repositoryPath ?? process.cwd();
    const promptSnapshot = buildTaskPrompt(task, project, options.additionalInstructions);
    const run = this.database.createCodexRun({
      taskId: task.id,
      projectId: project?.id ?? null,
      mode: options.mode,
      workingDirectory,
      promptSnapshot: task.title
    });
    this.database.appendCodexRunEvent(run.id, "queued", "Task entered the Codex queue.");
    this.database.transitionTask(task.id, "in_progress");

    if (options.mode === "demo") {
      void this.executeDemo(run.id, task, promptSnapshot);
    } else {
      void this.executeLive(run.id, task, project, promptSnapshot, options.newThread);
    }
    return run;
  }

  accept(runId: string): CodexRun {
    const run = this.database.getCodexRun(runId);
    if (!run) throw new Error(`Codex run not found: ${runId}`);
    if (run.status !== "needs_review") throw new Error(`Run is not ready for review: ${run.status}`);
    const task = this.database.getTask(run.taskId);
    if (!task) throw new Error(`Task not found: ${run.taskId}`);
    if (task.status !== "needs_review") throw new Error(`Task is not ready for approval: ${task.status}`);
    this.database.transitionTask(task.id, "done");
    this.database.appendCodexRunEvent(run.id, "accepted", "Human reviewer approved the result.");
    return this.database.updateCodexRun(run.id, {
      status: "done",
      requiresHumanReview: false,
      completedAt: run.completedAt ?? new Date().toISOString()
    });
  }

  private async executeDemo(runId: string, task: Task, prompt: string): Promise<void> {
    try {
      const startedAt = new Date().toISOString();
      this.database.updateCodexRun(runId, { status: "running", startedAt });
      this.database.appendCodexRunEvent(runId, "running", "Demo adapter started deterministic execution.");
      await delay(180);
      this.database.appendCodexRunEvent(runId, "verification", "Demo adapter evaluated the task acceptance shape.");
      await delay(180);
      const currentTask = this.database.getTask(task.id);
      if (currentTask?.status === "in_progress") this.database.transitionTask(task.id, "needs_review");
      this.database.updateCodexRun(runId, {
        status: "needs_review",
        threadId: `demo-${runId}`,
        finalResponse: `Demo 执行已完成：${task.title}。这不是实际 Codex 结果，没有修改文件。`,
        verificationSummary: `Demo 适配器验证了任务可以从 Ready 进入 In Progress，再进入 Needs Review。实际执行提示长度为 ${prompt.length} 个字符。`,
        artifactPaths: [],
        completedAt: new Date().toISOString(),
        requiresHumanReview: true
      });
      this.database.appendCodexRunEvent(runId, "needs_review", "Demo result is ready for human review.");
    } catch (error) {
      this.failRun(runId, task.id, error);
    }
  }

  private async executeLive(runId: string, task: Task, project: Project | null, prompt: string, newThread: boolean): Promise<void> {
    try {
      const startedAt = new Date().toISOString();
      this.database.updateCodexRun(runId, { status: "running", startedAt });
      this.database.appendCodexRunEvent(runId, "running", "Live Codex SDK execution started.");
      const codex = new Codex();
      const threadOptions = {
        workingDirectory: project?.repositoryPath ?? process.cwd(),
        skipGitRepoCheck: false,
        sandboxMode: "workspace-write" as const,
        approvalPolicy: "never" as const,
        networkAccessEnabled: false
      };
      const existingThreadId = !newThread && project ? this.database.findLatestThreadForProject(project.id) : null;
      const thread = existingThreadId ? codex.resumeThread(existingThreadId, threadOptions) : codex.startThread(threadOptions);
      const result = await thread.run(prompt);
      const currentTask = this.database.getTask(task.id);
      if (currentTask?.status === "in_progress") this.database.transitionTask(task.id, "needs_review");
      this.database.updateCodexRun(runId, {
        status: "needs_review",
        threadId: thread.id,
        finalResponse: result.finalResponse,
        artifactPaths: extractArtifactPaths(result.items),
        verificationSummary: summarizeVerification(result.items),
        completedAt: new Date().toISOString(),
        requiresHumanReview: true
      });
      this.database.appendCodexRunEvent(runId, "needs_review", "Live Codex result is ready for human review.");
    } catch (error) {
      this.failRun(runId, task.id, error);
    }
  }

  private failRun(runId: string, taskId: string, error: unknown): void {
    const message = error instanceof Error ? error.message : "Unknown Codex execution error";
    const task = this.database.getTask(taskId);
    if (task?.status === "in_progress") this.database.transitionTask(taskId, "blocked");
    this.database.updateCodexRun(runId, {
      status: "failed",
      errorMessage: message,
      completedAt: new Date().toISOString()
    });
    this.database.appendCodexRunEvent(runId, "failed", message);
  }
}
