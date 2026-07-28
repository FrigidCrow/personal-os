import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PersonalOsDatabase } from "@personal-os/database";
import type { AgentExecutor, AgentRun, Project, Task } from "@personal-os/domain";
import { buildTaskPrompt } from "./codex.js";
import type { CodexOrchestrator } from "./codex.js";

export interface ExecutorHealth {
  executor: AgentExecutor;
  available: boolean;
  detail: string;
}

export interface TaskExecutionContext {
  task: Task;
  project: Project | null;
  mode: "demo" | "live";
  newThread: boolean;
  additionalInstructions?: string;
  idempotencyKey: string;
  attempt: number;
}

export interface ExecutorAdapter {
  readonly executor: AgentExecutor;
  healthCheck(): ExecutorHealth;
  canHandle(context: TaskExecutionContext): boolean;
  dispatch(context: TaskExecutionContext): AgentRun;
}

export class CodexExecutorAdapter implements ExecutorAdapter {
  readonly executor = "codex" as const;

  constructor(
    private readonly database: PersonalOsDatabase,
    private readonly orchestrator: CodexOrchestrator
  ) {}

  healthCheck(): ExecutorHealth {
    return { executor: this.executor, available: true, detail: "Codex SDK adapter is loaded." };
  }

  canHandle(context: TaskExecutionContext): boolean {
    if (context.task.delegationMode === "human_only") return false;
    if (context.mode === "demo") return true;
    const repositoryPath = context.project?.repositoryPath;
    return context.task.acceptanceCriteria.length > 0 && Boolean(
      repositoryPath &&
      existsSync(repositoryPath) &&
      existsSync(join(repositoryPath, ".git"))
    );
  }

  dispatch(context: TaskExecutionContext): AgentRun {
    if (!this.canHandle(context)) throw new Error("Codex adapter cannot safely handle this task.");
    const run = this.orchestrator.assign(context.task.id, {
      mode: context.mode,
      newThread: context.newThread,
      additionalInstructions: context.additionalInstructions,
      idempotencyKey: context.idempotencyKey,
      attempt: context.attempt
    });
    return this.database.getAgentRun(run.id)!;
  }
}

export class OpenWorkerPullAdapter implements ExecutorAdapter {
  readonly executor = "openworker" as const;

  constructor(private readonly database: PersonalOsDatabase) {}

  healthCheck(): ExecutorHealth {
    return {
      executor: this.executor,
      available: true,
      detail: "Personal OS pull queue is available; worker health is confirmed by heartbeats."
    };
  }

  canHandle(context: TaskExecutionContext): boolean {
    return context.task.status === "ready";
  }

  dispatch(context: TaskExecutionContext): AgentRun {
    if (!this.canHandle(context)) throw new Error("OpenWorker adapter cannot queue this task.");
    return this.database.createAgentRun({
      taskId: context.task.id,
      projectId: context.project?.id ?? null,
      executor: this.executor,
      mode: context.mode,
      workingDirectory: context.project?.repositoryPath ?? process.cwd(),
      promptSnapshot: buildTaskPrompt(context.task, context.project, context.additionalInstructions),
      idempotencyKey: context.idempotencyKey,
      attempt: context.attempt
    });
  }
}
