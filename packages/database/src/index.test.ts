import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, PersonalOsDatabase } from "./index.js";

describe("PersonalOsDatabase", () => {
  let database: PersonalOsDatabase;

  beforeEach(() => {
    database = new PersonalOsDatabase({ filePath: ":memory:", seed: true });
  });

  afterEach(() => database.close());

  it("persists projects and tasks", () => {
    const project = database.createProject({
      name: "Test project",
      lane: "systemize",
      status: "active",
      outcome: "Remove a repeated manual step.",
      nextAction: "Document the current workflow.",
      deadline: null,
      expectedRevenue: 1000,
      actualRevenue: 0,
      repositoryPath: null,
      obsidianPath: null
    });
    const task = database.createTask({
      projectId: project.id,
      title: "Map workflow",
      description: "Capture the current process.",
      status: "ready",
      delegationMode: "mixed",
      priority: "high",
      dueDate: null,
      acceptanceCriteria: ["Current steps are documented"]
    });

    expect(database.getProject(project.id)?.name).toBe("Test project");
    expect(database.getTask(task.id)?.projectId).toBe(project.id);
    expect(task).toMatchObject({
      taskType: "other",
      executor: "human",
      executionMode: "manual",
      triggerType: "manual",
      riskLevel: "medium",
      maxAttempts: 1,
      automationPaused: false,
      automationCompletedAt: null
    });
  });

  it("creates one auditable active agent run per task and enforces review", () => {
    const task = database.listTasks().find((item) => item.status === "ready")!;
    const run = database.createAgentRun({
      taskId: task.id,
      projectId: task.projectId,
      executor: "openworker",
      promptSnapshot: "Prepare a local draft.",
      idempotencyKey: "openworker:test:1"
    });

    expect(run).toMatchObject({ executor: "openworker", status: "queued", attempt: 1 });
    expect(database.listAgentRunEvents(run.id).map((event) => event.eventType)).toEqual(["queued"]);
    expect(() => database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "Duplicate key.",
      idempotencyKey: "openworker:test:1"
    })).toThrow("Duplicate idempotency key");
    expect(() => database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "Second active run.",
      idempotencyKey: "openworker:test:2"
    })).toThrow("Active run already exists");

    database.updateAgentRun(run.id, { status: "running", startedAt: new Date().toISOString() });
    expect(() => database.updateAgentRun(run.id, { status: "done" })).toThrow("Invalid agent run transition");
    const approval = database.createApprovalRequest({
      runId: run.id,
      actionType: "send_message",
      destination: "draft@example.com",
      summary: "Send the prepared draft",
      payloadPreview: "Draft only"
    });
    expect(approval.status).toBe("pending");
    expect(database.getAgentRun(run.id)?.status).toBe("awaiting_approval");
    expect(database.listAgentRunEvents(run.id).at(-1)?.eventType).toBe("approval_requested");
  });

  it("resolves consequential approvals before accepting or rejecting final results", () => {
    const approvedTask = database.createTask({
      title: "Approval lifecycle",
      status: "ready",
      executor: "openworker",
      riskLevel: "low",
      acceptanceCriteria: ["Human approval is recorded"]
    });
    const approvedRun = database.createAgentRun({
      taskId: approvedTask.id,
      executor: "openworker",
      promptSnapshot: "Prepare a draft, then request approval.",
      idempotencyKey: "approval:lifecycle:1"
    });
    database.claimAgentRun(approvedRun.id);
    database.updateAgentRun(approvedRun.id, { status: "running" });
    const approval = database.createApprovalRequest({
      runId: approvedRun.id,
      actionType: "external_write",
      destination: "local-test-target",
      summary: "Write the approved test result"
    });

    expect(database.resolveApprovalRequest(approval.id, "approved").status).toBe("approved");
    expect(database.getAgentRun(approvedRun.id)).toEqual(expect.objectContaining({ status: "running" }));
    expect(() => database.resolveApprovalRequest(approval.id, "approved")).toThrow("already resolved");

    database.submitAgentRunResult(approvedRun.id, {
      finalResponse: "The approved result is ready.",
      verificationSummary: "Approval and local result persistence verified."
    });
    expect(database.acceptAgentRun(approvedRun.id).status).toBe("done");
    expect(database.getTask(approvedTask.id)?.status).toBe("done");

    const rejectedTask = database.createTask({ title: "Reject result", status: "ready", executor: "openworker" });
    const rejectedRun = database.createAgentRun({
      taskId: rejectedTask.id,
      executor: "openworker",
      promptSnapshot: "Produce an unacceptable result.",
      idempotencyKey: "approval:lifecycle:2"
    });
    database.claimAgentRun(rejectedRun.id);
    database.submitAgentRunResult(rejectedRun.id, {
      finalResponse: "Incomplete result.",
      verificationSummary: "Acceptance criteria were not met."
    });
    expect(database.rejectAgentRun(rejectedRun.id, "Missing required evidence.").status).toBe("blocked");
    expect(database.getTask(rejectedTask.id)?.status).toBe("blocked");
  });

  it("keeps recurring tasks active after one accepted run and completes them only explicitly", () => {
    const task = database.createTask({
      title: "每日简报",
      status: "ready",
      executor: "openworker",
      executionMode: "automatic",
      triggerType: "cron",
      triggerConfig: { expression: "30 6 * * *", catchUp: true },
      triggerTimezone: "Asia/Tokyo",
      riskLevel: "low",
      nextRunAt: "2026-07-29T21:30:00.000Z"
    });
    const run = database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "生成今日简报",
      idempotencyKey: "recurring:lifecycle:1"
    });
    database.claimAgentRun(run.id);
    database.submitAgentRunResult(run.id, {
      finalResponse: "今日简报已生成。",
      verificationSummary: "内容结构已检查。"
    });

    expect(() => database.completeRecurringTask(task.id)).toThrow("Finish or review the current run");
    expect(database.acceptAgentRun(run.id).status).toBe("done");
    expect(database.getTask(task.id)).toMatchObject({ status: "ready", automationCompletedAt: null });

    const completed = database.completeRecurringTask(task.id);
    expect(completed).toMatchObject({ status: "done", automationPaused: true });
    expect(completed.automationCompletedAt).not.toBeNull();
    expect(() => database.prepareTaskForAutomation(task.id)).toThrow("Completed automation");
  });

  it("updates and deletes projects without deleting their tasks", () => {
    const project = database.listProjects()[0]!;
    const task = database.listTasks({ projectId: project.id })[0]!;
    const updated = database.updateProject(project.id, {
      ...project,
      nextAction: "Verify the edited next action."
    });
    expect(updated.nextAction).toBe("Verify the edited next action.");

    database.deleteProject(project.id);
    expect(database.getProject(project.id)).toBeNull();
    expect(database.getTask(task.id)?.projectId).toBeNull();
  });

  it("enforces task review transitions", () => {
    const task = database.listTasks().find((item) => item.status === "ready");
    expect(task).toBeDefined();
    expect(() => database.transitionTask(task!.id, "done")).toThrow("Invalid task transition");
    database.transitionTask(task!.id, "in_progress");
    database.transitionTask(task!.id, "needs_review");
    expect(database.transitionTask(task!.id, "done").status).toBe("done");
  });

  it("creates an experiment from an evidence-backed opportunity", () => {
    const opportunity = database.listOpportunities()[0];
    expect(opportunity?.evidence.length).toBeGreaterThan(0);
    const experiment = database.createExperimentFromOpportunity(opportunity!.id);
    expect(experiment.opportunityId).toBe(opportunity!.id);
    expect(database.getOpportunity(opportunity!.id)?.status).toBe("experiment");
  });

  it("keeps daily reports at five opportunities or fewer", () => {
    const report = database.getLatestDailyReport();
    expect(report).not.toBeNull();
    expect(report!.opportunities.length).toBeLessThanOrEqual(5);
  });

  it("lists daily reports newest first for radar history", () => {
    const opportunity = database.listOpportunities()[0]!;
    const newer = database.createDailyReport({
      reportDate: "2026-07-29",
      title: "新的机会雷达日报",
      summary: "用于验证日报历史排序。",
      generatedBy: "codex",
      opportunityIds: [opportunity.id],
      isDemo: false
    });

    expect(database.listDailyReports().map((report) => report.id)).toEqual([newer.id, database.getReportByDate("2026-07-28")!.id]);
    expect(database.listDailyReports(1)).toHaveLength(1);
  });

  it("persists the default editable radar schedule", () => {
    expect(database.getRadarSchedule()).toEqual(expect.objectContaining({
      enabled: true,
      expression: "0 8 * * *",
      timezone: "Asia/Tokyo",
      catchUp: true,
      nextRunAt: null,
      lastStatus: "idle"
    }));

    const updated = database.configureRadarSchedule({
      enabled: true,
      expression: "45 7 * * *",
      timezone: "Asia/Shanghai",
      catchUp: false
    }, "2026-07-29T23:45:00.000Z");
    expect(updated).toEqual(expect.objectContaining({
      expression: "45 7 * * *",
      timezone: "Asia/Shanghai",
      catchUp: false,
      nextRunAt: "2026-07-29T23:45:00.000Z"
    }));
  });
});

describe("MVP1 database migration", () => {
  it("keeps a new database empty unless demo seeding is explicitly requested", () => {
    const database = createDatabase(":memory:");

    expect(database.listProjects()).toEqual([]);
    expect(database.listTasks()).toEqual([]);
    expect(database.listOpportunities()).toEqual([]);

    database.close();
  });

  it("preserves legacy tasks, Codex runs, thread ids, and events", () => {
    const directory = mkdtempSync(join(tmpdir(), "personal-os-mvp1-"));
    const filePath = join(directory, "legacy.db");
    const taskId = "10000000-0000-4000-8000-000000000001";
    const runId = "20000000-0000-4000-8000-000000000001";
    const eventId = "30000000-0000-4000-8000-000000000001";
    const timestamp = "2026-07-28T00:00:00.000Z";

    try {
      const legacy = new Database(filePath);
      legacy.exec(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, lane TEXT NOT NULL,
          status TEXT NOT NULL, outcome TEXT NOT NULL, next_action TEXT NOT NULL,
          deadline TEXT, expected_revenue REAL, actual_revenue REAL,
          repository_path TEXT, obsidian_path TEXT, created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
          delegation_mode TEXT NOT NULL, priority TEXT NOT NULL, due_date TEXT,
          acceptance_criteria TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE codex_runs (
          id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, thread_id TEXT,
          status TEXT NOT NULL, mode TEXT NOT NULL, working_directory TEXT,
          prompt_snapshot TEXT NOT NULL, final_response TEXT,
          artifact_paths TEXT NOT NULL DEFAULT '[]', verification_summary TEXT,
          error_message TEXT, requires_human_review INTEGER NOT NULL DEFAULT 1,
          started_at TEXT, completed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE codex_run_events (
          id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES codex_runs(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL
        );
      `);
      legacy.prepare("INSERT INTO tasks VALUES (?, NULL, ?, '', 'needs_review', 'codex_ready', 'medium', NULL, '[]', ?, ?)")
        .run(taskId, "Legacy task", timestamp, timestamp);
      legacy.prepare("INSERT INTO codex_runs VALUES (?, NULL, ?, ?, 'needs_review', 'live', NULL, ?, ?, '[]', ?, NULL, 1, ?, ?, ?, ?)")
        .run(runId, taskId, "legacy-thread", "Legacy prompt", "Legacy result", "Passed", timestamp, timestamp, timestamp, timestamp);
      legacy.prepare("INSERT INTO codex_run_events VALUES (?, ?, 'needs_review', ?, ?)")
        .run(eventId, runId, "Legacy result ready", timestamp);
      legacy.close();

      const migrated = new PersonalOsDatabase({ filePath, seed: false });
      expect(migrated.getTask(taskId)).toMatchObject({ executor: "human", executionMode: "manual", riskLevel: "medium", automationCompletedAt: null });
      expect(migrated.getAgentRun(runId)).toMatchObject({
        executor: "codex",
        externalSessionId: "legacy-thread",
        finalResponse: "Legacy result",
        idempotencyKey: `legacy-codex:${runId}`
      });
      expect(migrated.getCodexRun(runId)?.threadId).toBe("legacy-thread");
      expect(migrated.listAgentRunEvents(runId)).toHaveLength(1);
      expect((migrated.connection.prepare("SELECT COUNT(*) AS count FROM codex_runs").get() as { count: number }).count).toBe(1);
      migrated.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("repairs historical OpenWorker runs that were mislabeled as demo", () => {
    const directory = mkdtempSync(join(tmpdir(), "personal-os-openworker-mode-"));
    const filePath = join(directory, "mode.db");
    try {
      const initial = new PersonalOsDatabase({ filePath, seed: false });
      const task = initial.createTask({
        title: "Historical pull run",
        status: "ready",
        executor: "openworker",
        executionMode: "manual",
        riskLevel: "low"
      });
      const run = initial.createAgentRun({
        taskId: task.id,
        executor: "openworker",
        mode: "demo",
        promptSnapshot: "Historical mislabeled run",
        idempotencyKey: "historical-openworker-demo"
      });
      initial.close();

      const migrated = new PersonalOsDatabase({ filePath, seed: false });
      expect(migrated.getAgentRun(run.id)?.mode).toBe("live");
      migrated.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rearms legacy recurring cron tasks that were left in Done", () => {
    const directory = mkdtempSync(join(tmpdir(), "personal-os-recurring-migration-"));
    const filePath = join(directory, "recurring.db");
    try {
      const initial = new PersonalOsDatabase({ filePath, seed: false });
      const task = initial.createTask({
        title: "Legacy recurring report",
        status: "ready",
        executionMode: "automatic",
        triggerType: "cron",
        triggerConfig: { expression: "0 8 * * *" },
        triggerTimezone: "Asia/Tokyo",
        riskLevel: "low"
      });
      initial.connection.prepare("UPDATE tasks SET status = 'done' WHERE id = ?").run(task.id);
      initial.close();

      const migrated = new PersonalOsDatabase({ filePath, seed: false });
      expect(migrated.getTask(task.id)).toMatchObject({ status: "ready", automationCompletedAt: null });
      migrated.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("agent run leases and retry limits", () => {
  it("extends an active lease and safely recovers an expired worker", () => {
    let currentTime = new Date("2026-07-28T00:00:00.000Z");
    const database = new PersonalOsDatabase({ filePath: ":memory:", seed: false, clock: () => currentTime });
    try {
      const task = database.createTask({
        title: "Lease test",
        status: "ready",
        description: "Verify lease recovery.",
        delegationMode: "mixed",
        priority: "medium",
        acceptanceCriteria: ["Expired lease is retryable"],
        executor: "openworker",
        executionMode: "automatic",
        riskLevel: "low",
        maxAttempts: 2
      });
      const run = database.createAgentRun({
        taskId: task.id,
        executor: "openworker",
        promptSnapshot: "Lease test",
        idempotencyKey: "lease:test:1"
      });
      const claimed = database.claimAgentRun(run.id);
      expect(claimed.status).toBe("claimed");
      expect(claimed.leaseExpiresAt).toBe("2026-07-28T00:02:00.000Z");
      expect(database.getTask(task.id)?.status).toBe("in_progress");
      expect(() => database.claimAgentRun(run.id)).toThrow("cannot be claimed");

      currentTime = new Date("2026-07-28T00:00:30.000Z");
      expect(database.heartbeatAgentRun(run.id).leaseExpiresAt).toBe("2026-07-28T00:02:30.000Z");
      currentTime = new Date("2026-07-28T00:02:30.000Z");
      const recovered = database.recoverExpiredAgentRuns();
      expect(recovered).toHaveLength(1);
      expect(recovered[0]).toMatchObject({ status: "failed", nextRetryAt: "2026-07-28T00:02:30.000Z" });
      expect(database.getTask(task.id)?.status).toBe("ready");
      expect(database.listRetryableAgentRuns()).toHaveLength(1);
      expect(database.markAgentRunRetried(run.id).nextRetryAt).toBeNull();
      expect(database.listRetryableAgentRuns()).toHaveLength(0);
    } finally {
      database.close();
    }
  });

  it("blocks the task when the final attempt fails", () => {
    const database = new PersonalOsDatabase({ filePath: ":memory:", seed: false });
    try {
      const task = database.createTask({
        title: "Final attempt",
        status: "ready",
        maxAttempts: 1
      });
      const run = database.createAgentRun({
        taskId: task.id,
        executor: "openworker",
        promptSnapshot: "Final attempt",
        idempotencyKey: "lease:final:1"
      });
      database.claimAgentRun(run.id);
      const failed = database.recordAgentRunFailure(run.id, "Worker stopped.");
      expect(failed.nextRetryAt).toBeNull();
      expect(database.getTask(task.id)?.status).toBe("blocked");
    } finally {
      database.close();
    }
  });

  it("expires a pending approval as a rejection and renews the worker lease", () => {
    let currentTime = new Date("2026-07-28T00:00:00.000Z");
    const database = new PersonalOsDatabase({ filePath: ":memory:", seed: false, clock: () => currentTime });
    try {
      const task = database.createTask({ title: "Expire approval", status: "ready", executor: "openworker" });
      const run = database.createAgentRun({
        taskId: task.id,
        executor: "openworker",
        promptSnapshot: "Request a time-limited approval.",
        idempotencyKey: "approval:expiry:1"
      });
      database.claimAgentRun(run.id);
      database.updateAgentRun(run.id, { status: "running" });
      const approval = database.createApprovalRequest({
        runId: run.id,
        actionType: "send_message",
        destination: "test-recipient",
        summary: "Send a local test message",
        expiresAt: "2026-07-28T00:01:00.000Z"
      });

      currentTime = new Date("2026-07-28T00:01:00.000Z");
      expect(database.expireApprovalRequests()).toEqual([expect.objectContaining({ id: approval.id, status: "expired" })]);
      expect(database.getAgentRun(run.id)).toEqual(expect.objectContaining({
        status: "running",
        leaseExpiresAt: "2026-07-28T00:03:00.000Z"
      }));
    } finally {
      database.close();
    }
  });
});
