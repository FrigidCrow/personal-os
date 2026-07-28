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

  it("completes the OpenWorker pull contract without bypassing review", () => {
    const task = database.createTask({
      title: "Prepare a local brief",
      status: "ready",
      acceptanceCriteria: ["A Markdown brief is attached"],
      taskType: "business_report",
      executor: "openworker",
      executionMode: "automatic",
      riskLevel: "low",
      maxAttempts: 2
    });
    const queued = database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "Prepare a local brief.",
      idempotencyKey: "mcp:pull:1"
    });

    expect(tools.listClaimableTasks()).toEqual([
      expect.objectContaining({ runId: queued.id, executor: "openworker", task: expect.objectContaining({ id: task.id }) })
    ]);
    const claimed = tools.claimTask(task.id);
    expect(claimed.status).toBe("claimed");
    expect(() => tools.claimTask(task.id)).toThrow("No queued run");
    expect(tools.getExecutionContext(claimed.id).safety.finalState).toBe("needs_review");
    expect(tools.heartbeatRun(claimed.id).heartbeatAt).not.toBeNull();
    tools.appendAgentRunEvent(claimed.id, "running", "OpenWorker started the local draft.");
    tools.saveArtifact(claimed.id, "/tmp/personal-os-brief.md");
    const result = tools.submitRunResult({
      runId: claimed.id,
      finalResponse: "The local brief is ready.",
      verificationSummary: "The Markdown file exists and contains the requested headings.",
      artifactPaths: ["/tmp/personal-os-brief.md"],
      externalSessionId: "openworker-test-session"
    });

    expect(result).toMatchObject({ status: "needs_review", executor: "openworker", externalSessionId: "openworker-test-session" });
    expect(database.getTask(task.id)?.status).toBe("needs_review");
    expect(database.listAgentRunEvents(claimed.id).map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["queued", "claimed", "heartbeat", "running", "artifact_saved", "verification", "needs_review"])
    );
  });

  it("creates an immutable approval request instead of performing an external write", () => {
    const task = database.createTask({
      title: "Draft external reply",
      status: "ready",
      executor: "openworker",
      riskLevel: "medium",
      maxAttempts: 1
    });
    const queued = database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "Draft only.",
      idempotencyKey: "mcp:approval:1"
    });
    tools.claimTask(task.id);
    const approval = tools.requestApproval({
      runId: queued.id,
      actionType: "send_message",
      destination: "Slack #client",
      summary: "Send the prepared reply",
      payloadPreview: "Draft reply"
    });
    expect(approval.status).toBe("pending");
    expect(tools.getApprovalStatus(approval.id)).toEqual(approval);
    expect(database.getAgentRun(queued.id)?.status).toBe("awaiting_approval");
    expect("resolveApproval" in tools).toBe(false);
    expect(() => tools.submitRunResult({
      runId: queued.id,
      finalResponse: "Should not submit while approval is pending.",
      verificationSummary: "Not executed."
    })).toThrow("cannot submit");
  });
});
