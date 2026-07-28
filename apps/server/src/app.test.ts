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

  it("generates at most five opportunities in a demo report", async () => {
    const response = await app.request("/api/reports/generate-demo", { method: "POST" });
    expect(response.status).toBe(201);
    const report = await response.json();
    expect(report.isDemo).toBe(true);
    expect(report.opportunities.length).toBeLessThanOrEqual(5);
  });
});
