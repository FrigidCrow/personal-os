import { randomUUID } from "node:crypto";
import type { PersonalOsDatabase } from "@personal-os/database";
import type { AgentExecutor, AgentRun, Executor, Project, Task } from "@personal-os/domain";
import { CodexOrchestrator } from "./codex.js";
import {
  CodexExecutorAdapter,
  OpenWorkerPullAdapter,
  type ExecutorAdapter,
  type ExecutorHealth,
  type TaskExecutionContext
} from "./executors.js";

const codexTaskTypes = new Set(["coding", "testing", "code_review", "technical_docs"]);
const openWorkerTaskTypes = new Set(["email", "calendar", "slack", "notion", "business_report", "general_writing"]);

export function routeTask(task: Task, project: Project | null): Executor {
  if (task.executionMode === "automatic" && task.riskLevel === "high") return "human";
  if (task.executor !== "auto") return task.executor;
  if (project?.repositoryPath && codexTaskTypes.has(task.taskType)) return "codex";
  if (openWorkerTaskTypes.has(task.taskType)) return "openworker";
  return "human";
}

export interface DispatchOptions {
  mode?: "demo" | "live";
  newThread?: boolean;
  additionalInstructions?: string;
  automatic?: boolean;
  forceExecutor?: AgentExecutor;
  idempotencyKey?: string;
  attempt?: number;
}

export interface DispatchTickResult {
  dispatched: AgentRun[];
  skipped: Array<{ taskId: string; reason: string }>;
}

export class AgentDispatcher {
  private readonly adapters: Map<AgentExecutor, ExecutorAdapter>;

  constructor(
    private readonly database: PersonalOsDatabase,
    codex = new CodexOrchestrator(database),
    adapters?: ExecutorAdapter[],
    private readonly clock: () => Date = () => new Date(),
    private readonly automaticMode: "demo" | "live" = process.env.CODEX_MODE === "live" ? "live" : "demo"
  ) {
    const configured = adapters ?? [
      new CodexExecutorAdapter(database, codex),
      new OpenWorkerPullAdapter(database)
    ];
    this.adapters = new Map(configured.map((adapter) => [adapter.executor, adapter]));
  }

  health(): ExecutorHealth[] {
    return Array.from(this.adapters.values(), (adapter) => adapter.healthCheck());
  }

  dispatch(taskId: string, options: DispatchOptions = {}): AgentRun {
    const task = this.database.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== "ready") throw new Error(`Task must be ready before dispatch: ${task.status}`);
    if (task.automationPaused && options.automatic) throw new Error("Task automation is paused.");
    if (options.automatic && task.riskLevel !== "low") {
      throw new Error(`Automatic dispatch requires low risk: ${task.riskLevel}`);
    }
    const project = task.projectId ? this.database.getProject(task.projectId) : null;
    const executor = options.forceExecutor ?? routeTask(task, project);
    if (executor === "human" || executor === "auto") {
      throw new Error("Task routes to the human queue.");
    }
    if (options.automatic && executor === "codex") {
      if (!project?.repositoryPath) throw new Error("Automatic Codex requires a project repository path.");
      if (task.acceptanceCriteria.length === 0) throw new Error("Automatic Codex requires acceptance criteria.");
    }
    const adapter = this.adapters.get(executor);
    if (!adapter) throw new Error(`Executor adapter is unavailable: ${executor}`);
    const context: TaskExecutionContext = {
      task,
      project,
      mode: options.mode ?? "demo",
      newThread: options.newThread ?? false,
      additionalInstructions: options.additionalInstructions,
      idempotencyKey: options.idempotencyKey ?? `dispatch:${task.id}:${randomUUID()}`,
      attempt: options.attempt ?? 1
    };
    if (!adapter.canHandle(context)) throw new Error(`${executor} adapter cannot safely handle this task.`);
    return adapter.dispatch(context);
  }

  retry(runId: string): AgentRun {
    const run = this.database.getAgentRun(runId);
    if (!run) throw new Error(`Agent run not found: ${runId}`);
    if (!(["failed", "blocked", "cancelled"] as const).includes(run.status as "failed" | "blocked" | "cancelled")) {
      throw new Error(`Run is not retryable: ${run.status}`);
    }
    const task = this.database.getTask(run.taskId);
    if (!task) throw new Error(`Task not found: ${run.taskId}`);
    const attempt = run.attempt + 1;
    if (attempt > task.maxAttempts) throw new Error("Maximum attempts reached.");
    if (task.status === "blocked") this.database.transitionTask(task.id, "ready");
    if (task.status !== "blocked" && task.status !== "ready") throw new Error(`Task is not ready for retry: ${task.status}`);
    return this.dispatch(task.id, {
      mode: run.mode,
      forceExecutor: run.executor,
      idempotencyKey: `${run.idempotencyKey}:retry:${attempt}`,
      attempt
    });
  }

  setPaused(taskId: string, paused: boolean): Task {
    const task = this.database.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return this.database.updateTask(task.id, { ...task, automationPaused: paused });
  }

  cancel(runId: string): AgentRun {
    return this.database.cancelAgentRun(runId);
  }

  tick(): DispatchTickResult {
    const dispatched: AgentRun[] = [];
    const skipped: Array<{ taskId: string; reason: string }> = [];
    const currentTime = this.clock();

    this.database.recoverExpiredAgentRuns(currentTime.toISOString());

    for (const failed of this.database.listRetryableAgentRuns(currentTime.toISOString())) {
      try {
        dispatched.push(this.retry(failed.id));
      } catch (error) {
        skipped.push({ taskId: failed.taskId, reason: error instanceof Error ? error.message : "Retry failed" });
      }
    }

    for (const task of this.database.listTasks({ status: "ready" })) {
      if (task.executionMode !== "automatic" || task.automationPaused || task.triggerType === "manual") continue;
      if (!task.nextRunAt || new Date(task.nextRunAt).getTime() > currentTime.getTime()) continue;
      try {
        const scheduledTask = this.database.updateTask(task.id, {
          ...task,
          lastScheduledAt: currentTime.toISOString()
        });
        dispatched.push(this.dispatch(scheduledTask.id, {
          automatic: true,
          mode: this.automaticMode,
          idempotencyKey: `scheduled:${task.id}:${task.nextRunAt}`
        }));
      } catch (error) {
        skipped.push({ taskId: task.id, reason: error instanceof Error ? error.message : "Dispatch failed" });
      }
    }

    return { dispatched, skipped };
  }
}
