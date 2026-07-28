import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersonalOsDatabase } from "./index.js";

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
      automationPaused: false
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
});

describe("MVP1 database migration", () => {
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
      expect(migrated.getTask(taskId)).toMatchObject({ executor: "human", executionMode: "manual", riskLevel: "medium" });
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
});
