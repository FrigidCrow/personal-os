import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersonalOsDatabase } from "@personal-os/database";
import { createPersonalOsTools } from "./tools.js";

describe("Personal OS MCP tool contract", () => {
  let database: PersonalOsDatabase;
  let tools: ReturnType<typeof createPersonalOsTools>;

  beforeEach(() => {
    database = new PersonalOsDatabase({ filePath: ":memory:", seed: true });
    tools = createPersonalOsTools(database);
  });

  afterEach(() => database.close());

  it("reads task and project context", () => {
    const task = database.listTasks().find((item) => item.projectId)!;
    const context = tools.getTask(task.id);
    expect(context.task.id).toBe(task.id);
    expect(context.project?.id).toBe(task.projectId);
  });

  it("submits Codex completion for human review instead of marking done", () => {
    const task = database.listTasks().find((item) => item.status === "ready")!;
    const run = database.createCodexRun({
      taskId: task.id,
      projectId: task.projectId,
      mode: "demo",
      workingDirectory: null,
      promptSnapshot: task.title
    });
    database.transitionTask(task.id, "in_progress");
    const result = tools.completeTask({
      taskId: task.id,
      runId: run.id,
      finalResponse: "Completed the requested demonstration.",
      verificationSummary: "The MCP contract test passed.",
      artifactPaths: []
    });
    expect(result.task.status).toBe("needs_review");
    expect(result.run.status).toBe("needs_review");
    expect(result.run.requiresHumanReview).toBe(true);
  });

  it("does not expose a direct human approval tool", () => {
    expect("acceptRun" in tools).toBe(false);
  });
});
