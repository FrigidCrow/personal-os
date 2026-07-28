import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ZodError, z } from "zod";
import {
  experimentInputSchema,
  incomeAssetInputSchema,
  opportunityInputSchema,
  projectInputSchema,
  projectPatchSchema,
  taskInputSchema,
  taskPatchSchema,
  taskStatusSchema,
  type ProjectInput,
  type TaskInput
} from "@personal-os/domain";
import type { PersonalOsDatabase } from "@personal-os/database";

export interface AppDependencies {
  database: PersonalOsDatabase;
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
    acceptanceCriteria: task.acceptanceCriteria
  };
}

function todayInTimezone(timeZone = process.env.PERSONAL_OS_TIMEZONE ?? "Asia/Tokyo"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function createApp({ database }: AppDependencies): Hono {
  const app = new Hono();

  app.use("*", logger());
  app.use("/api/*", cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));

  app.onError((error, context) => {
    if (error instanceof ZodError) {
      return context.json({ error: "VALIDATION_ERROR", message: "Request validation failed.", issues: error.issues }, 400);
    }
    if (error.message.includes("not found")) {
      return context.json({ error: "NOT_FOUND", message: error.message }, 404);
    }
    if (error.message.startsWith("Invalid task transition")) {
      return context.json({ error: "INVALID_TRANSITION", message: error.message }, 409);
    }
    console.error(error);
    return context.json({ error: "INTERNAL_ERROR", message: "The request could not be completed." }, 500);
  });

  app.get("/api/health", (context) => context.json({ ok: true, service: "personal-os", codexMode: process.env.CODEX_MODE ?? "demo" }));
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
  app.post("/api/tasks/:id/transition", async (context) => {
    const body = z.object({ status: taskStatusSchema }).parse(await context.req.json());
    return context.json(database.transitionTask(context.req.param("id"), body.status));
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
  app.post("/api/experiments", async (context) => {
    const input = experimentInputSchema.parse(await context.req.json());
    return context.json(database.createExperiment(input), 201);
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
    const opportunities = database.listOpportunities().sort((a, b) => b.score - a.score).slice(0, 5);
    const reportDate = todayInTimezone();
    const report = database.createDailyReport({
      reportDate,
      title: "Opportunity radar",
      summary: opportunities.length > 0
        ? `${opportunities.length} demonstration opportunities are ready for review. Verify every source before acting.`
        : "No demonstration opportunities are available. Add evidence-backed candidates before generating a report.",
      generatedBy: "demo",
      opportunityIds: opportunities.map((opportunity) => opportunity.id),
      isDemo: true
    });
    return context.json(report, 201);
  });

  app.get("/api/codex/runs", (context) => context.json({ items: database.listCodexRuns() }));
  app.get("/api/codex/runs/:id", (context) => {
    const run = database.getCodexRun(context.req.param("id"));
    if (!run) return context.json({ error: "NOT_FOUND", message: "Codex run not found." }, 404);
    return context.json(run);
  });

  return app;
}
