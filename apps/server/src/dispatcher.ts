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
import { cronCatchUpEnabled, dependencyTaskId, eventNameForTask, nextCronOccurrence } from "./task-automation.js";

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
    private readonly automaticMode: "demo" | "live" = process.env.CODEX_MODE === "live" ? "live" : "demo",
    private readonly scheduleGraceMilliseconds = 60_000
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
      // OpenWorker is always an external pull worker. "demo" only describes
      // the deterministic Codex/report adapters and must never label real work.
      mode: executor === "openworker" ? "live" : options.mode ?? "demo",
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
    const retried = this.dispatch(task.id, {
      mode: run.mode,
      forceExecutor: run.executor,
      idempotencyKey: `${run.idempotencyKey}:retry:${attempt}`,
      attempt
    });
    this.database.markAgentRunRetried(run.id);
    return retried;
  }

  setPaused(taskId: string, paused: boolean): Task {
    const task = this.database.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return this.database.updateTask(task.id, { ...task, automationPaused: paused });
  }

  cancel(runId: string): AgentRun {
    return this.database.cancelAgentRun(runId);
  }

  handleEvent(eventName: string, eventId: string): DispatchTickResult {
    const dispatched: AgentRun[] = [];
    const skipped: Array<{ taskId: string; reason: string }> = [];
    const currentTime = this.clock();
    for (const original of this.database.listTasks()) {
      if (
        original.executionMode !== "automatic" ||
        original.triggerType !== "event" ||
        original.automationPaused ||
        eventNameForTask(original) !== eventName
      ) continue;
      try {
        const task = original.status === "done" ? this.database.prepareTaskForAutomation(original.id) : original;
        if (task.status !== "ready") throw new Error(`Task is not ready for event dispatch: ${task.status}`);
        this.database.updateTask(task.id, { ...task, lastScheduledAt: currentTime.toISOString() });
        dispatched.push(this.dispatch(task.id, {
          automatic: true,
          mode: this.automaticMode,
          idempotencyKey: `event:${task.id}:${eventId}`
        }));
      } catch (error) {
        skipped.push({ taskId: original.id, reason: error instanceof Error ? error.message : "Event dispatch failed" });
      }
    }
    return { dispatched, skipped };
  }

  tick(): DispatchTickResult {
    const dispatched: AgentRun[] = [];
    const skipped: Array<{ taskId: string; reason: string }> = [];
    const currentTime = this.clock();

    this.database.expireApprovalRequests(currentTime.toISOString());
    this.database.recoverExpiredAgentRuns(currentTime.toISOString());

    for (const failed of this.database.listRetryableAgentRuns(currentTime.toISOString())) {
      try {
        dispatched.push(this.retry(failed.id));
      } catch (error) {
        skipped.push({ taskId: failed.taskId, reason: error instanceof Error ? error.message : "Retry failed" });
      }
    }

    for (const original of this.database.listTasks()) {
      let task = original;
      if (task.executionMode !== "automatic" || task.automationPaused || task.triggerType === "manual") continue;

      if (task.triggerType === "event") continue;

      if (task.triggerType === "dependency") {
        const dependencyId = dependencyTaskId(task);
        const dependency = dependencyId ? this.database.getTask(dependencyId) : null;
        if (!dependency || dependency.status !== "done" || task.lastScheduledAt) continue;
        try {
          if (task.status !== "ready") throw new Error(`Task is not ready for dependency dispatch: ${task.status}`);
          task = this.database.updateTask(task.id, { ...task, lastScheduledAt: currentTime.toISOString() });
          dispatched.push(this.dispatch(task.id, {
            automatic: true,
            mode: this.automaticMode,
            idempotencyKey: `dependency:${task.id}:${dependency.id}`
          }));
        } catch (error) {
          skipped.push({ taskId: task.id, reason: error instanceof Error ? error.message : "Dependency dispatch failed" });
        }
        continue;
      }

      if (task.triggerType !== "cron") continue;
      if (!task.nextRunAt) {
        try {
          this.database.updateTask(task.id, { ...task, nextRunAt: nextCronOccurrence(task, currentTime).toISOString() });
        } catch (error) {
          skipped.push({ taskId: task.id, reason: error instanceof Error ? error.message : "Cron initialization failed" });
        }
        continue;
      }
      const scheduledFor = new Date(task.nextRunAt);
      if (scheduledFor.getTime() > currentTime.getTime()) continue;
      try {
        const nextRunAt = nextCronOccurrence(task, currentTime).toISOString();
        if (currentTime.getTime() - scheduledFor.getTime() > this.scheduleGraceMilliseconds && !cronCatchUpEnabled(task)) {
          this.database.updateTask(task.id, { ...task, lastScheduledAt: currentTime.toISOString(), nextRunAt });
          skipped.push({ taskId: task.id, reason: `Missed cron occurrence at ${task.nextRunAt}; catch-up is disabled.` });
          continue;
        }
        if (task.status === "done") task = this.database.prepareTaskForAutomation(task.id);
        if (task.status !== "ready") {
          this.database.updateTask(task.id, { ...task, lastScheduledAt: currentTime.toISOString(), nextRunAt });
          throw new Error(`Task is not ready for cron dispatch: ${task.status}`);
        }
        const scheduledTask = this.database.updateTask(task.id, {
          ...task,
          lastScheduledAt: currentTime.toISOString(),
          nextRunAt
        });
        dispatched.push(this.dispatch(scheduledTask.id, {
          automatic: true,
          mode: this.automaticMode,
          idempotencyKey: `scheduled:${task.id}:${scheduledFor.toISOString()}`
        }));
      } catch (error) {
        skipped.push({ taskId: task.id, reason: error instanceof Error ? error.message : "Dispatch failed" });
      }
    }

    return { dispatched, skipped };
  }
}
