import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersonalOsDatabase } from "@personal-os/database";
import { createApp } from "./app.js";

describe("Personal OS API", () => {
  let database: PersonalOsDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    database = new PersonalOsDatabase({ filePath: ":memory:", seed: true });
    app = createApp({ database });
  });

  afterEach(() => database.close());

  it("returns an actionable dashboard", async () => {
    const response = await app.request("/api/dashboard");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.metrics.activeProjects).toBeGreaterThan(0);
    expect(body.focusTasks.length).toBeGreaterThan(0);
    expect(body.latestReport.isDemo).toBe(true);
  });

  it("creates and persists a project", async () => {
    const response = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "API project",
        lane: "systemize",
        status: "active",
        outcome: "Turn a repeated task into a reusable workflow.",
        nextAction: "Capture the current manual steps.",
        deadline: null,
        expectedRevenue: 0,
        actualRevenue: 0,
        repositoryPath: null,
        obsidianPath: null
      })
    });

    expect(response.status).toBe(201);
    const project = await response.json();
    expect(database.getProject(project.id)?.name).toBe("API project");

    const update = await app.request(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nextAction: "Verify API update persistence." })
    });
    expect(update.status).toBe(200);
    expect((await update.json()).nextAction).toBe("Verify API update persistence.");

    const deletion = await app.request(`/api/projects/${project.id}`, { method: "DELETE" });
    expect(deletion.status).toBe(200);
    expect(database.getProject(project.id)).toBeNull();
  });

  it("rejects invalid task transitions", async () => {
    const task = database.listTasks().find((item) => item.status === "ready")!;
    const response = await app.request(`/api/tasks/${task.id}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" })
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("INVALID_TRANSITION");
  });

  it("creates, updates, and deletes a task", async () => {
    const created = await app.request("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: null,
        title: "API task",
        description: "Initial description",
        status: "inbox",
        delegationMode: "mixed",
        priority: "medium",
        dueDate: null,
        acceptanceCriteria: ["Persist the task"]
      })
    });
    expect(created.status).toBe(201);
    const task = await created.json();

    const updated = await app.request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "Updated description", priority: "high" })
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).priority).toBe("high");

    const deleted = await app.request(`/api/tasks/${task.id}`, { method: "DELETE" });
    expect(deleted.status).toBe(200);
    expect(database.getTask(task.id)).toBeNull();
  });

  it("converts an opportunity into an experiment", async () => {
    const opportunity = database.listOpportunities().find((item) => item.status === "candidate")!;
    const response = await app.request(`/api/opportunities/${opportunity.id}/experiment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timeCapHours: 2, budgetCap: 0 })
    });
    expect(response.status).toBe(201);
    const experiment = await response.json();
    expect(experiment.opportunityId).toBe(opportunity.id);
  });

  it("creates an income asset with visible stage and maintenance burden", async () => {
    const response = await app.request("/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: null,
        experimentId: null,
        name: "Reusable delivery checklist",
        stage: "revenue",
        revenueModel: "Fixed-price template",
        monthlyRevenue: 1500,
        maintenanceHoursMonthly: 1.5,
        nextAction: "Offer it to one existing client."
      })
    });

    expect(response.status).toBe(201);
    const asset = await response.json();
    expect(asset.stage).toBe("revenue");
    expect(asset.maintenanceHoursMonthly).toBe(1.5);

    const list = await app.request("/api/assets");
    expect(list.status).toBe(200);
    expect((await list.json()).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: asset.id, stage: "revenue", maintenanceHoursMonthly: 1.5 })
      ])
    );
  });

  it("generates at most five opportunities in a demo report", async () => {
    const response = await app.request("/api/reports/generate-demo", { method: "POST" });
    expect(response.status).toBe(201);
    const report = await response.json();
    expect(report.isDemo).toBe(true);
    expect(report.opportunities.length).toBeLessThanOrEqual(5);
  });

  it("rejects live Codex assignment when the project repository path is invalid", async () => {
    const task = database.listTasks().find((item) => item.status === "ready")!;
    const response = await app.request(`/api/tasks/${task.id}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "live", newThread: false })
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("INVALID_STATE");
    expect(database.getTask(task.id)?.status).toBe("ready");
    expect(database.listCodexRuns()).toHaveLength(0);
  });

  it("runs the demo Codex loop through human approval", async () => {
    const task = database.listTasks().find((item) => item.status === "ready")!;
    const assignment = await app.request(`/api/tasks/${task.id}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "demo", newThread: false })
    });
    expect(assignment.status).toBe(202);
    const queuedRun = await assignment.json();
    expect(queuedRun.mode).toBe("demo");

    await new Promise((resolve) => setTimeout(resolve, 450));
    const reviewRun = database.getCodexRun(queuedRun.id)!;
    expect(reviewRun.status).toBe("needs_review");
    expect(database.getTask(task.id)?.status).toBe("needs_review");

    const stream = await app.request(`/api/codex/runs/${reviewRun.id}/stream`);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    const streamBody = await stream.text();
    expect(streamBody).toContain("event: run");
    expect(streamBody).toContain("needs_review");

    const bypass = await app.request(`/api/tasks/${task.id}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" })
    });
    expect(bypass.status).toBe(409);
    expect(database.getTask(task.id)?.status).toBe("needs_review");

    const approval = await app.request(`/api/codex/runs/${reviewRun.id}/accept`, { method: "POST" });
    expect(approval.status).toBe(200);
    expect((await approval.json()).status).toBe("done");
    expect(database.getTask(task.id)?.status).toBe("done");
  });
});
