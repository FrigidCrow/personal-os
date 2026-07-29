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
      expect.objectContaining({
        runId: queued.id,
        taskId: task.id,
        executor: "openworker",
        claimArguments: { taskId: task.id, executor: "openworker" },
        contextArguments: { runId: queued.id },
        task: expect.objectContaining({ id: task.id })
      })
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

  it("supports a longer deployment lease for slower local models", () => {
    const slowTools = createPersonalOsTools(database, { leaseMilliseconds: 600_000 });
    const task = database.createTask({
      title: "Slow local worker",
      status: "ready",
      executor: "openworker",
      executionMode: "automatic",
      triggerType: "manual",
      riskLevel: "low",
      maxAttempts: 1
    });
    database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "Use the longer lease.",
      idempotencyKey: "mcp:slow-worker"
    });

    const claimed = slowTools.claimTask(task.id);
    const leaseDuration = new Date(claimed.leaseExpiresAt!).getTime() - new Date(claimed.claimedAt!).getTime();

    expect(leaseDuration).toBe(600_000);
  });

  it("claims and completes channel-gated radar research", () => {
    database.configureRadarSchedule({
      enabled: true,
      expression: "0 8 * * *",
      timezone: "Asia/Tokyo",
      catchUp: true,
      executor: "openworker",
      searchProfile: "面向个人技术服务",
      customInstructions: "优先验证公开销售渠道。"
    }, "2020-01-01T00:00:00.000Z");

    const claim = tools.claimDueRadar("openworker");
    expect(claim).toEqual(expect.objectContaining({ claimed: true, reportDate: expect.any(String) }));
    if (!claim.claimed) throw new Error("Expected a radar claim");
    expect(tools.claimDueRadar("openworker")).toEqual(expect.objectContaining({ claimed: false }));

    const existing = database.listOpportunities()[0]!;
    const created = tools.saveRadarOpportunity(claim.claimStartedAt, {
      title: "带销售渠道的测试机会",
      payer: existing.payer,
      pain: existing.pain,
      summary: existing.summary,
      businessModel: existing.businessModel,
      offer: existing.offer,
      pricingModel: existing.pricingModel,
      salesChannels: existing.salesChannels,
      firstSalePlan: existing.firstSalePlan,
      confidence: existing.confidence,
      personalFit: existing.personalFit,
      validationEffortHours: existing.validationEffortHours,
      validationBudget: existing.validationBudget,
      timeToRevenue: existing.timeToRevenue,
      recurringPotential: existing.recurringPotential,
      maintenanceHoursMonthly: existing.maintenanceHoursMonthly,
      hypothesis: existing.hypothesis,
      minimalExperiment: existing.minimalExperiment,
      successCondition: existing.successCondition,
      stopCondition: existing.stopCondition,
      evidence: existing.evidence.map(({ label, sourceUrl, type, summary }) => ({ label, sourceUrl, type, summary })),
      status: "candidate",
      isDemo: false
    });
    tools.saveRadarReport(claim.claimStartedAt, {
      reportDate: claim.reportDate,
      title: "机会雷达日报",
      summary: "仅保存通过销售渠道门槛的候选。",
      generatedBy: "openworker",
      opportunityIds: [created.id],
      isDemo: false
    });
    const completed = tools.completeRadarRun(claim.claimStartedAt);

    expect(completed).toEqual(expect.objectContaining({ lastStatus: "succeeded", nextRunAt: expect.any(String) }));
    expect(database.getReportByDate(claim.reportDate)?.generatedBy).toBe("openworker");
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
