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
