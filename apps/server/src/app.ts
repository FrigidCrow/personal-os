import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import { ZodError, z } from "zod";
import {
  experimentInputSchema,
  experimentPatchSchema,
  experimentResultInputSchema,
  incomeAssetInputSchema,
  opportunityInputSchema,
  projectInputSchema,
  projectPatchSchema,
  taskInputSchema,
  taskPatchSchema,
  taskStatusSchema,
  type ProjectInput,
  type ExperimentInput,
  type TaskInput
} from "@personal-os/domain";
import type { PersonalOsDatabase } from "@personal-os/database";
import { CodexOrchestrator } from "./codex.js";
import { AgentDispatcher } from "./dispatcher.js";
import { RadarService } from "./radar.js";

export interface AppDependencies {
  database: PersonalOsDatabase;
  codex?: CodexOrchestrator;
  dispatcher?: AgentDispatcher;
  radar?: RadarService;
}

function projectToInput(project: ReturnType<PersonalOsDatabase["getProject"]>): ProjectInput {
  if (!project) throw new Error("Project not found");
  return {
    name: project.name,
    lane: project.lane,
    status: project.status,
    outcome: project.outcome,
    nextAction: project.nextAction,
    deadline: project.deadline,
    expectedRevenue: project.expectedRevenue,
    actualRevenue: project.actualRevenue,
    repositoryPath: project.repositoryPath,
    obsidianPath: project.obsidianPath
  };
}

function taskToInput(task: ReturnType<PersonalOsDatabase["getTask"]>): TaskInput {
  if (!task) throw new Error("Task not found");
  return {
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    delegationMode: task.delegationMode,
    priority: task.priority,
    dueDate: task.dueDate,
    acceptanceCriteria: task.acceptanceCriteria,
    taskType: task.taskType,
    executor: task.executor,
    executionMode: task.executionMode,
    triggerType: task.triggerType,
    triggerConfig: task.triggerConfig,
    triggerTimezone: task.triggerTimezone,
    riskLevel: task.riskLevel,
    maxAttempts: task.maxAttempts,
    nextRunAt: task.nextRunAt,
    lastScheduledAt: task.lastScheduledAt,
    automationPaused: task.automationPaused
  };
}

function experimentToInput(experiment: ReturnType<PersonalOsDatabase["getExperiment"]>): ExperimentInput {
  if (!experiment) throw new Error("Experiment not found");
  return {
    opportunityId: experiment.opportunityId,
    title: experiment.title,
    hypothesis: experiment.hypothesis,
    status: experiment.status,
    timeCapHours: experiment.timeCapHours,
    budgetCap: experiment.budgetCap,
    deadline: experiment.deadline,
    successCondition: experiment.successCondition,
    stopCondition: experiment.stopCondition,
    resultSummary: experiment.resultSummary
  };
}

export function createApp(dependencies: AppDependencies): Hono {
  const { database, radar = new RadarService(database) } = dependencies;
  const codex = dependencies.codex ?? new CodexOrchestrator(database);
  const dispatcher = dependencies.dispatcher ?? new AgentDispatcher(database, codex);
  const app = new Hono();

  app.use("*", logger());
  app.use("/api/*", cors({ origin: ["http://localhost:5273", "http://127.0.0.1:5273"] }));

  app.onError((error, context) => {
    if (error instanceof ZodError) {
      return context.json({ error: "VALIDATION_ERROR", message: "Request validation failed.", issues: error.issues }, 400);
    }
    if (error.message.includes("not found")) {
      return context.json({ error: "NOT_FOUND", message: error.message }, 404);
    }
    if (error.message.startsWith("Invalid task transition") || error.message.startsWith("Invalid agent run transition")) {
      return context.json({ error: "INVALID_TRANSITION", message: error.message }, 409);
    }
    if (
      error.message.includes("must be ready") ||
      error.message.includes("must be accepted") ||
      error.message.includes("Live Codex requires") ||
      error.message.includes("Human-only") ||
      error.message.includes("not ready for") ||
      error.message.includes("cannot safely handle") ||
      error.message.includes("routes to the human") ||
      error.message.includes("Automatic dispatch") ||
      error.message.includes("Automatic Codex") ||
      error.message.includes("automation is paused") ||
      error.message.includes("Maximum attempts") ||
      error.message.includes("not retryable") ||
      error.message.includes("already resolved") ||
      error.message.includes("not awaiting approval") ||
      error.message.includes("cannot be cancelled") ||
      error.message.includes("Active run already exists") ||
      error.message.includes("Duplicate idempotency")
    ) {
      return context.json({ error: "INVALID_STATE", message: error.message }, 409);
    }
    console.error(error);
    return context.json({ error: "INTERNAL_ERROR", message: "The request could not be completed." }, 500);
  });

  app.get("/api/health", (context) => context.json({ ok: true, service: "personal-os", codexMode: process.env.CODEX_MODE ?? "demo", executors: dispatcher.health() }));
  app.get("/api/dashboard", (context) => context.json(database.getDashboard()));

  app.get("/api/projects", (context) => context.json({ items: database.listProjects() }));
  app.get("/api/projects/:id", (context) => {
    const project = database.getProject(context.req.param("id"));
    if (!project) return context.json({ error: "NOT_FOUND", message: "Project not found." }, 404);
    return context.json({ ...project, tasks: database.listTasks({ projectId: project.id }) });
  });
  app.post("/api/projects", async (context) => {
    const input = projectInputSchema.parse(await context.req.json());
    return context.json(database.createProject(input), 201);
  });
  app.patch("/api/projects/:id", async (context) => {
    const id = context.req.param("id");
    const current = database.getProject(id);
    if (!current) return context.json({ error: "NOT_FOUND", message: "Project not found." }, 404);
    const patch = projectPatchSchema.parse(await context.req.json());
    const input = projectInputSchema.parse({ ...projectToInput(current), ...patch });
    return context.json(database.updateProject(id, input));
  });
  app.delete("/api/projects/:id", (context) => {
    return context.json(database.deleteProject(context.req.param("id")));
  });

  app.get("/api/tasks", (context) => {
    const parsedStatus = taskStatusSchema.safeParse(context.req.query("status"));
    const projectId = context.req.query("projectId");
    return context.json({
      items: database.listTasks({
        ...(parsedStatus.success ? { status: parsedStatus.data } : {}),
        ...(projectId ? { projectId } : {})
      })
    });
  });
  app.get("/api/tasks/:id", (context) => {
    const task = database.getTask(context.req.param("id"));
    if (!task) return context.json({ error: "NOT_FOUND", message: "Task not found." }, 404);
    return context.json(task);
  });
  app.post("/api/tasks", async (context) => {
    const input = taskInputSchema.parse(await context.req.json());
    return context.json(database.createTask(input), 201);
  });
  app.patch("/api/tasks/:id", async (context) => {
    const id = context.req.param("id");
    const current = database.getTask(id);
    if (!current) return context.json({ error: "NOT_FOUND", message: "Task not found." }, 404);
    const patch = taskPatchSchema.parse(await context.req.json());
    const input = taskInputSchema.parse({ ...taskToInput(current), ...patch });
    return context.json(database.updateTask(id, input));
  });
  app.delete("/api/tasks/:id", (context) => {
    return context.json(database.deleteTask(context.req.param("id")));
  });
  app.post("/api/tasks/:id/transition", async (context) => {
    const body = z.object({ status: taskStatusSchema }).parse(await context.req.json());
    const taskId = context.req.param("id");
    if (body.status === "done") {
      const pendingRun = database.listAgentRuns().find((run) => run.taskId === taskId && run.status === "needs_review");
      if (pendingRun) throw new Error("Agent run must be accepted from the review screen.");
    }
    return context.json(database.transitionTask(taskId, body.status));
  });
  app.post("/api/tasks/:id/assign", async (context) => {
    const body = z.object({
      mode: z.enum(["demo", "live"]).default("demo"),
      newThread: z.boolean().default(false),
      additionalInstructions: z.string().trim().max(2000).optional()
    }).parse(await context.req.json());
    return context.json(codex.assign(context.req.param("id"), body), 202);
  });
  app.post("/api/tasks/:id/dispatch", async (context) => {
    const body = z.object({
      mode: z.enum(["demo", "live"]).default("demo"),
      newThread: z.boolean().default(false),
      additionalInstructions: z.string().trim().max(2000).optional(),
      forceExecutor: z.enum(["codex", "openworker"]).optional()
    }).parse(await context.req.json().catch(() => ({})));
    return context.json(dispatcher.dispatch(context.req.param("id"), body), 202);
  });
  app.post("/api/tasks/:id/automation/pause", async (context) => {
    const body = z.object({ paused: z.boolean() }).parse(await context.req.json());
    return context.json(dispatcher.setPaused(context.req.param("id"), body.paused));
  });

  app.get("/api/opportunities", (context) => context.json({ items: database.listOpportunities() }));
  app.get("/api/opportunities/:id", (context) => {
    const opportunity = database.getOpportunity(context.req.param("id"));
    if (!opportunity) return context.json({ error: "NOT_FOUND", message: "Opportunity not found." }, 404);
    return context.json(opportunity);
  });
  app.post("/api/opportunities", async (context) => {
    const input = opportunityInputSchema.parse(await context.req.json());
    return context.json(database.createOpportunity(input), 201);
  });
  app.post("/api/opportunities/:id/experiment", async (context) => {
    const body = z.object({
      title: z.string().trim().min(1).max(180).optional(),
      timeCapHours: z.number().positive().max(1000).optional(),
      budgetCap: z.number().min(0).optional(),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
    }).parse(await context.req.json().catch(() => ({})));
    return context.json(database.createExperimentFromOpportunity(context.req.param("id"), body), 201);
  });

  app.get("/api/experiments", (context) => context.json({ items: database.listExperiments() }));
  app.get("/api/experiments/:id", (context) => {
    const experiment = database.getExperiment(context.req.param("id"));
    if (!experiment) return context.json({ error: "NOT_FOUND", message: "Experiment not found." }, 404);
    return context.json(experiment);
  });
  app.post("/api/experiments", async (context) => {
    const input = experimentInputSchema.parse(await context.req.json());
    return context.json(database.createExperiment(input), 201);
  });
  app.patch("/api/experiments/:id", async (context) => {
    const id = context.req.param("id");
    const current = database.getExperiment(id);
    if (!current) return context.json({ error: "NOT_FOUND", message: "Experiment not found." }, 404);
    const patch = experimentPatchSchema.parse(await context.req.json());
    const input = experimentInputSchema.parse({ ...experimentToInput(current), ...patch });
    return context.json(database.updateExperiment(id, input));
  });
  app.post("/api/experiments/:id/result", async (context) => {
    const input = experimentResultInputSchema.parse(await context.req.json());
    return context.json(database.recordExperimentResult(context.req.param("id"), input));
  });

  app.get("/api/assets", (context) => context.json({ items: database.listAssets() }));
  app.post("/api/assets", async (context) => {
    const input = incomeAssetInputSchema.parse(await context.req.json());
    return context.json(database.createAsset(input), 201);
  });

  app.get("/api/reports/latest", (context) => {
    const report = database.getLatestDailyReport();
    if (!report) return context.json({ error: "NOT_FOUND", message: "No daily report has been generated." }, 404);
    return context.json(report);
  });
  app.post("/api/reports/generate-demo", (context) => {
    return context.json(radar.generateDemo(), 201);
  });
  app.post("/api/reports/generate", async (context) => {
    const body = z.object({ mode: z.enum(["demo", "live"]).default("demo") }).parse(await context.req.json());
    const report = body.mode === "live" ? await radar.generateLive() : radar.generateDemo();
    return context.json(report, 201);
  });

  app.get("/api/agent-runs", (context) => {
    const executor = z.enum(["codex", "openworker"]).safeParse(context.req.query("executor"));
    const status = z.enum(["queued", "claimed", "running", "awaiting_approval", "needs_review", "done", "blocked", "failed", "cancelled"]).safeParse(context.req.query("status"));
    return context.json({ items: database.listAgentRuns({
      ...(executor.success ? { executor: executor.data } : {}),
      ...(status.success ? { status: status.data } : {})
    }) });
  });
  app.get("/api/agent-runs/:id", (context) => {
    const run = database.getAgentRun(context.req.param("id"));
    if (!run) return context.json({ error: "NOT_FOUND", message: "Agent run not found." }, 404);
    return context.json(run);
  });
  app.get("/api/agent-runs/:id/events", (context) => context.json({ items: database.listAgentRunEvents(context.req.param("id")) }));
  app.get("/api/agent-runs/:id/stream", (context) => {
    const runId = context.req.param("id");
    if (!database.getAgentRun(runId)) return context.json({ error: "NOT_FOUND", message: "Agent run not found." }, 404);
    return streamSSE(context, async (stream) => {
      let eventIndex = 0;
      while (!stream.aborted) {
        const run = database.getAgentRun(runId);
        if (!run) break;
        const events = database.listAgentRunEvents(runId);
        await stream.writeSSE({
          id: String(eventIndex++),
          event: "run",
          data: JSON.stringify({ run, events })
        });
        if (["needs_review", "done", "blocked", "failed", "cancelled"].includes(run.status)) break;
        await stream.sleep(750);
      }
    });
  });
  app.post("/api/agent-runs/:id/cancel", (context) => context.json(dispatcher.cancel(context.req.param("id"))));
  app.post("/api/agent-runs/:id/retry", (context) => context.json(dispatcher.retry(context.req.param("id")), 202));
  app.post("/api/agent-runs/:id/accept", (context) => context.json(database.acceptAgentRun(context.req.param("id"))));
  app.post("/api/agent-runs/:id/reject", async (context) => {
    const body = z.object({ reason: z.string().trim().min(1).max(1000) }).parse(await context.req.json());
    return context.json(database.rejectAgentRun(context.req.param("id"), body.reason));
  });
  app.post("/api/dispatcher/tick", (context) => context.json(dispatcher.tick()));

  app.get("/api/approvals", (context) => {
    const status = z.enum(["pending", "approved", "rejected", "expired"]).safeParse(context.req.query("status"));
    return context.json({ items: database.listApprovalRequests(status.success ? status.data : undefined) });
  });
  app.get("/api/approvals/:id", (context) => {
    const approval = database.getApprovalRequest(context.req.param("id"));
    if (!approval) return context.json({ error: "NOT_FOUND", message: "Approval request not found." }, 404);
    return context.json(approval);
  });
  app.post("/api/approvals/:id/resolve", async (context) => {
    const body = z.object({ decision: z.enum(["approved", "rejected"]) }).parse(await context.req.json());
    return context.json(database.resolveApprovalRequest(context.req.param("id"), body.decision));
  });

  app.get("/api/codex/runs", (context) => context.json({ items: database.listCodexRuns() }));
  app.get("/api/codex/runs/:id", (context) => {
    const run = database.getCodexRun(context.req.param("id"));
    if (!run) return context.json({ error: "NOT_FOUND", message: "Codex run not found." }, 404);
    return context.json(run);
  });
  app.get("/api/codex/runs/:id/events", (context) => context.json({ items: database.listCodexRunEvents(context.req.param("id")) }));
  app.get("/api/codex/runs/:id/stream", (context) => {
    const runId = context.req.param("id");
    if (!database.getCodexRun(runId)) return context.json({ error: "NOT_FOUND", message: "Codex run not found." }, 404);
    return streamSSE(context, async (stream) => {
      let eventIndex = 0;
      while (!stream.aborted) {
        const run = database.getCodexRun(runId);
        if (!run) break;
        const events = database.listCodexRunEvents(runId);
        await stream.writeSSE({
          id: String(eventIndex++),
          event: "run",
          data: JSON.stringify({ run, events })
        });
        if (["needs_review", "done", "blocked", "failed", "cancelled"].includes(run.status)) break;
        await stream.sleep(750);
      }
    });
  });
  app.post("/api/codex/runs/:id/accept", (context) => context.json(codex.accept(context.req.param("id"))));

  return app;
}
