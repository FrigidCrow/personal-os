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

  it("reports database and executor operational health", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      ok: true,
      operational: expect.objectContaining({ database: "ok", quickCheck: "ok", foreignKeyViolations: 0 }),
      executors: expect.arrayContaining([expect.objectContaining({ executor: "codex" }), expect.objectContaining({ executor: "openworker" })])
    }));
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

  it("rejects incomplete automation trigger configuration", async () => {
    const response = await app.request("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Invalid cron task",
        status: "ready",
        executor: "openworker",
        executionMode: "automatic",
        triggerType: "cron",
        triggerConfig: null,
        triggerTimezone: "UTC",
        riskLevel: "low"
      })
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expect.objectContaining({ error: "VALIDATION_ERROR", message: expect.stringContaining("triggerConfig.expression") }));
  });

  it("dispatches a matching internal event through the unified dispatcher", async () => {
    const task = database.createTask({
      title: "React to internal event",
      status: "ready",
      executor: "openworker",
      executionMode: "automatic",
      triggerType: "event",
      triggerConfig: { eventName: "project.completed" },
      riskLevel: "low"
    });
    const response = await app.request("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName: "project.completed", eventId: "api-event-1" })
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(expect.objectContaining({
      eventName: "project.completed",
      eventId: "api-event-1",
      dispatched: [expect.objectContaining({ taskId: task.id, executor: "openworker" })]
    }));
    expect(database.listAgentRuns({ executor: "openworker" })).toEqual(expect.arrayContaining([expect.objectContaining({ taskId: task.id })]));
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

  it("reads, edits, and records an experiment result", async () => {
    const experiment = database.listExperiments()[0]!;

    const detail = await app.request(`/api/experiments/${experiment.id}`);
    expect(detail.status).toBe(200);
    expect((await detail.json()).id).toBe(experiment.id);

    const update = await app.request(`/api/experiments/${experiment.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "running", budgetCap: 88, hypothesis: "Updated measurable hypothesis." })
    });
    expect(update.status).toBe(200);
    expect(await update.json()).toEqual(expect.objectContaining({ status: "running", budgetCap: 88, hypothesis: "Updated measurable hypothesis." }));

    const result = await app.request(`/api/experiments/${experiment.id}/result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "won", resultSummary: "One customer paid for the smallest useful version." })
    });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(expect.objectContaining({ status: "won", resultSummary: "One customer paid for the smallest useful version." }));
  });

  it("returns a project detail with associated tasks", async () => {
    const task = database.listTasks().find((item) => item.projectId)!;
    const response = await app.request(`/api/projects/${task.projectId}`);
    expect(response.status).toBe(200);
    const project = await response.json();
    expect(project.id).toBe(task.projectId);
    expect(project.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: task.id })]));
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
    expect(queuedRun.promptSnapshot).toContain(`Personal OS task id: ${task.id}`);
    expect(queuedRun.promptSnapshot).toContain(`Task: ${task.title}`);

    const stream = await app.request(`/api/codex/runs/${queuedRun.id}/stream`);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    const streamBody = await stream.text();
    expect(streamBody).toContain("event: run");
    expect(streamBody).toContain("running");
    expect(streamBody).toContain("needs_review");

    const reviewRun = database.getCodexRun(queuedRun.id)!;
    expect(reviewRun.status).toBe("needs_review");
    expect(database.getTask(task.id)?.status).toBe("needs_review");

    const events = await app.request(`/api/codex/runs/${reviewRun.id}/events`);
    expect(events.status).toBe(200);
    expect((await events.json()).items).toEqual(expect.arrayContaining([expect.objectContaining({ eventType: "needs_review" })]));

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

  it("dispatches, lists, pauses, and cancels an OpenWorker pull run", async () => {
    const task = database.createTask({
      title: "Prepare local report",
      description: "No external writes.",
      status: "ready",
      delegationMode: "mixed",
      priority: "medium",
      acceptanceCriteria: ["A local Markdown draft exists"],
      taskType: "business_report",
      executor: "openworker",
      executionMode: "manual",
      riskLevel: "low",
      maxAttempts: 2
    });
    const dispatch = await app.request(`/api/tasks/${task.id}/dispatch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "demo" })
    });
    expect(dispatch.status).toBe(202);
    const run = await dispatch.json();
    expect(run).toEqual(expect.objectContaining({ taskId: task.id, executor: "openworker", status: "queued" }));

    const list = await app.request("/api/agent-runs?executor=openworker");
    expect(list.status).toBe(200);
    expect((await list.json()).items).toEqual(expect.arrayContaining([expect.objectContaining({ id: run.id })]));

    const pause = await app.request(`/api/tasks/${task.id}/automation/pause`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused: true })
    });
    expect(pause.status).toBe(200);
    expect((await pause.json()).automationPaused).toBe(true);

    const cancel = await app.request(`/api/agent-runs/${run.id}/cancel`, { method: "POST" });
    expect(cancel.status).toBe(200);
    expect((await cancel.json()).status).toBe("cancelled");
    expect(database.getTask(task.id)?.status).toBe("ready");
  });

  it("retries a failed run once without duplicating the previous attempt", async () => {
    const task = database.createTask({
      title: "Retry local worker",
      status: "ready",
      acceptanceCriteria: ["Second attempt is visible"],
      taskType: "general_writing",
      executor: "openworker",
      executionMode: "manual",
      riskLevel: "low",
      maxAttempts: 2
    });
    const first = database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "First attempt",
      idempotencyKey: "api:retry:1"
    });
    database.claimAgentRun(first.id);
    database.recordAgentRunFailure(first.id, "Simulated failure", 0);

    const retry = await app.request(`/api/agent-runs/${first.id}/retry`, { method: "POST" });
    expect(retry.status).toBe(202);
    const second = await retry.json();
    expect(second).toEqual(expect.objectContaining({ taskId: task.id, attempt: 2, status: "queued" }));
    expect(second.id).not.toBe(first.id);
    expect(database.listAgentRuns().filter((run) => run.taskId === task.id)).toHaveLength(2);
  });

  it("lists and resolves approval requests through the human-only API", async () => {
    const task = database.createTask({ title: "Approve a write", status: "ready", executor: "openworker" });
    const run = database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "Request approval before writing.",
      idempotencyKey: "api:approval:1"
    });
    database.claimAgentRun(run.id);
    database.updateAgentRun(run.id, { status: "running" });
    const approval = database.createApprovalRequest({
      runId: run.id,
      actionType: "external_write",
      destination: "test-destination",
      summary: "Persist an approved local write"
    });

    const list = await app.request("/api/approvals?status=pending");
    expect(list.status).toBe(200);
    expect((await list.json()).items).toEqual([expect.objectContaining({ id: approval.id, status: "pending" })]);

    const resolve = await app.request(`/api/approvals/${approval.id}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "rejected" })
    });
    expect(resolve.status).toBe(200);
    expect(await resolve.json()).toEqual(expect.objectContaining({ status: "rejected", resolvedAt: expect.any(String) }));
    expect(database.getAgentRun(run.id)?.status).toBe("running");

    const duplicate = await app.request(`/api/approvals/${approval.id}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved" })
    });
    expect(duplicate.status).toBe(409);
  });

  it("streams and reviews a generic OpenWorker result", async () => {
    const task = database.createTask({ title: "Review worker result", status: "ready", executor: "openworker" });
    const run = database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "Return a reviewable result.",
      idempotencyKey: "api:generic-review:1"
    });
    database.claimAgentRun(run.id);
    database.submitAgentRunResult(run.id, {
      finalResponse: "Reviewable output.",
      verificationSummary: "The worker stored a complete result."
    });

    const stream = await app.request(`/api/agent-runs/${run.id}/stream`);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    expect(await stream.text()).toContain("needs_review");

    const accept = await app.request(`/api/agent-runs/${run.id}/accept`, { method: "POST" });
    expect(accept.status).toBe(200);
    expect(await accept.json()).toEqual(expect.objectContaining({ status: "done" }));
    expect(database.getTask(task.id)?.status).toBe("done");
  });

  it("rejects a generic result with a persisted reason", async () => {
    const task = database.createTask({ title: "Reject worker result", status: "ready", executor: "openworker" });
    const run = database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "Return an incomplete result.",
      idempotencyKey: "api:generic-review:2"
    });
    database.claimAgentRun(run.id);
    database.submitAgentRunResult(run.id, {
      finalResponse: "Incomplete output.",
      verificationSummary: "A required artifact is missing."
    });

    const reject = await app.request(`/api/agent-runs/${run.id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Required artifact was not attached." })
    });
    expect(reject.status).toBe(200);
    expect(await reject.json()).toEqual(expect.objectContaining({ status: "blocked", errorMessage: "Required artifact was not attached." }));
    expect(database.getTask(task.id)?.status).toBe("blocked");
  });
});
