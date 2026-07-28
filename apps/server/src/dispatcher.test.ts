import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersonalOsDatabase } from "@personal-os/database";
import type { Project, Task } from "@personal-os/domain";
import { AgentDispatcher, routeTask } from "./dispatcher.js";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("deterministic executor routing", () => {
  const project = { repositoryPath: "/tmp/repository" } as Project;
  const baseTask = {
    executor: "auto",
    executionMode: "automatic",
    riskLevel: "low"
  } as Task;

  it("routes repository work to Codex and business work to OpenWorker", () => {
    expect(routeTask({ ...baseTask, taskType: "coding" }, project)).toBe("codex");
    expect(routeTask({ ...baseTask, taskType: "business_report" }, null)).toBe("openworker");
  });

  it("honors explicit choices but keeps automatic high risk work human", () => {
    expect(routeTask({ ...baseTask, executor: "openworker", taskType: "coding" }, project)).toBe("openworker");
    expect(routeTask({ ...baseTask, executor: "codex", taskType: "coding", riskLevel: "high" }, project)).toBe("human");
  });
});

describe("AgentDispatcher", () => {
  let database: PersonalOsDatabase;
  const currentTime = new Date("2026-07-28T08:00:00.000Z");

  beforeEach(() => {
    database = new PersonalOsDatabase({ filePath: ":memory:", seed: false, clock: () => currentTime });
  });

  afterEach(() => database.close());

  it("automatically runs a due low-risk Codex demo through Needs Review", async () => {
    const project = database.createProject({
      name: "Dispatcher repository",
      lane: "systemize",
      status: "active",
      outcome: "Verify automatic Codex dispatch.",
      nextAction: "Run the deterministic adapter.",
      repositoryPath: process.cwd(),
      obsidianPath: null,
      deadline: null,
      expectedRevenue: 0,
      actualRevenue: 0
    });
    const task = database.createTask({
      projectId: project.id,
      title: "Automatic code check",
      description: "Use the demo adapter.",
      status: "ready",
      delegationMode: "codex_ready",
      priority: "high",
      dueDate: null,
      acceptanceCriteria: ["The run reaches Needs Review"],
      taskType: "testing",
      executor: "auto",
      executionMode: "automatic",
      triggerType: "cron",
      triggerConfig: { expression: "0 8 * * *" },
      triggerTimezone: "UTC",
      riskLevel: "low",
      maxAttempts: 2,
      nextRunAt: "2026-07-28T07:59:00.000Z",
      lastScheduledAt: null,
      automationPaused: false
    });
    const dispatcher = new AgentDispatcher(database, undefined, undefined, () => currentTime);

    const tick = dispatcher.tick();
    expect(tick.skipped).toEqual([]);
    expect(tick.dispatched).toHaveLength(1);
    expect(tick.dispatched[0]).toMatchObject({ executor: "codex", status: "running" });
    expect(database.getTask(task.id)?.status).toBe("in_progress");

    await wait(450);
    expect(database.getAgentRun(tick.dispatched[0]!.id)?.status).toBe("needs_review");
    expect(database.getTask(task.id)?.status).toBe("needs_review");
  });

  it("does not automatically dispatch medium or high risk tasks", () => {
    const task = database.createTask({
      title: "High risk action",
      description: "Must stay human controlled.",
      status: "ready",
      delegationMode: "mixed",
      priority: "critical",
      acceptanceCriteria: ["No automatic run exists"],
      taskType: "email",
      executor: "openworker",
      executionMode: "automatic",
      triggerType: "cron",
      triggerConfig: { expression: "0 8 * * *" },
      triggerTimezone: "UTC",
      riskLevel: "high",
      maxAttempts: 1,
      nextRunAt: "2026-07-28T07:59:00.000Z"
    });
    const dispatcher = new AgentDispatcher(database, undefined, undefined, () => currentTime);
    const tick = dispatcher.tick();
    expect(tick.dispatched).toHaveLength(0);
    expect(tick.skipped).toEqual([{ taskId: task.id, reason: "Automatic dispatch requires low risk: high" }]);
    expect(database.getActiveRunForTask(task.id)).toBeNull();
  });
});

describe("dispatcher restart recovery", () => {
  it("does not duplicate a task that still has a valid worker lease", () => {
    const directory = mkdtempSync(join(tmpdir(), "personal-os-dispatcher-"));
    const filePath = join(directory, "restart.db");
    const currentTime = new Date("2026-07-28T08:00:00.000Z");
    try {
      const firstDatabase = new PersonalOsDatabase({ filePath, seed: false, clock: () => currentTime });
      const task = firstDatabase.createTask({
        title: "Restart-safe worker",
        status: "ready",
        acceptanceCriteria: ["Only one active run exists"],
        taskType: "business_report",
        executor: "openworker",
        executionMode: "automatic",
        triggerType: "cron",
        riskLevel: "low",
        maxAttempts: 2,
        nextRunAt: "2026-07-28T07:59:00.000Z"
      });
      const firstDispatcher = new AgentDispatcher(firstDatabase, undefined, undefined, () => currentTime);
      const queued = firstDispatcher.tick().dispatched[0]!;
      firstDatabase.claimAgentRun(queued.id);
      expect(firstDatabase.getTask(task.id)?.status).toBe("in_progress");
      firstDatabase.close();

      const restartedDatabase = new PersonalOsDatabase({ filePath, seed: false, clock: () => currentTime });
      const restartedDispatcher = new AgentDispatcher(restartedDatabase, undefined, undefined, () => currentTime);
      expect(restartedDispatcher.tick().dispatched).toHaveLength(0);
      expect(restartedDatabase.listAgentRuns().filter((run) => run.taskId === task.id)).toHaveLength(1);
      expect(restartedDatabase.getActiveRunForTask(task.id)?.id).toBe(queued.id);
      restartedDatabase.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
