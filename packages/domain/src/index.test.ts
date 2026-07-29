import { describe, expect, it } from "vitest";
import {
  assertAgentRunTransition,
  assertTaskTransition,
  calculateOpportunityScore,
  canTransitionAgentRun,
  canTransitionTask,
  dailyReportInputSchema,
  evaluateOpportunityResearchGate,
  isActiveRecurringTask,
  isRecurringTask,
  opportunityInputSchema,
  radarScheduleInputSchema,
  taskInputSchema
} from "./index.js";

describe("task transitions", () => {
  it("allows the review loop", () => {
    expect(canTransitionTask("ready", "in_progress")).toBe(true);
    expect(canTransitionTask("in_progress", "needs_review")).toBe(true);
    expect(canTransitionTask("needs_review", "done")).toBe(true);
  });

  it("rejects skipping review", () => {
    expect(() => assertTaskTransition("in_progress", "done")).toThrow(
      "Invalid task transition"
    );
  });
});

describe("agent run transitions", () => {
  it("supports claim, approval, review, and human acceptance", () => {
    expect(canTransitionAgentRun("queued", "claimed")).toBe(true);
    expect(canTransitionAgentRun("claimed", "running")).toBe(true);
    expect(canTransitionAgentRun("running", "awaiting_approval")).toBe(true);
    expect(canTransitionAgentRun("awaiting_approval", "running")).toBe(true);
    expect(canTransitionAgentRun("running", "needs_review")).toBe(true);
    expect(canTransitionAgentRun("needs_review", "done")).toBe(true);
  });

  it("does not let an agent skip human review", () => {
    expect(() => assertAgentRunTransition("running", "done")).toThrow(
      "Invalid agent run transition"
    );
  });
});

describe("task automation defaults", () => {
  it("preserves the manual human behavior for existing callers", () => {
    const task = taskInputSchema.parse({ title: "Legacy task" });
    expect(task).toMatchObject({
      taskType: "other",
      executor: "human",
      executionMode: "manual",
      triggerType: "manual",
      triggerConfig: null,
      triggerTimezone: "UTC",
      riskLevel: "medium",
      maxAttempts: 1,
      nextRunAt: null,
      lastScheduledAt: null,
      automationPaused: false
    });
  });

  it("distinguishes a recurring schedule from a completed automation", () => {
    const recurring = { executionMode: "automatic" as const, triggerType: "cron" as const };
    expect(isRecurringTask(recurring)).toBe(true);
    expect(isActiveRecurringTask({ ...recurring, automationCompletedAt: null })).toBe(true);
    expect(isActiveRecurringTask({ ...recurring, automationCompletedAt: "2026-07-28T12:00:00.000Z" })).toBe(false);
    expect(isRecurringTask({ executionMode: "automatic", triggerType: "event" })).toBe(false);
  });
});

describe("radar schedule defaults", () => {
  it("starts enabled every day at 08:00 in Tokyo", () => {
    expect(radarScheduleInputSchema.parse({})).toEqual({
      enabled: true,
      expression: "0 8 * * *",
      timezone: "Asia/Tokyo",
      catchUp: true,
      executor: "openworker",
      searchProfile: "操作者会开发软件、使用 Codex、承接客户项目，希望以低维护的产品化服务或数字资产建立经常性收入。",
      customInstructions: ""
    });
  });
});

describe("opportunity rules", () => {
  const opportunity = {
    title: "Automated client reporting",
    payer: "Small software agencies",
    pain: "Weekly reporting is assembled by hand.",
    summary: "Package a repeatable reporting workflow.",
    businessModel: "Setup fee plus monthly maintenance",
    offer: "A configured weekly client report plus monthly monitoring",
    pricingModel: "Setup fee plus a fixed monthly retainer",
    salesChannels: [{ name: "Upwork", accessMethod: "Reply to public reporting automation briefs.", sourceUrl: "https://www.upwork.com/freelance-jobs/" }],
    firstSalePlan: "Publish one sample, shortlist ten matching briefs, and submit one tailored proposal.",
    confidence: 72,
    personalFit: 88,
    validationEffortHours: 2,
    validationBudget: 0,
    timeToRevenue: "One week",
    recurringPotential: 74,
    maintenanceHoursMonthly: 2,
    hypothesis: "Two agencies will request a demo.",
    minimalExperiment: "Build one report sample and contact ten existing leads.",
    successCondition: "Two qualified calls within seven days.",
    stopCondition: "No replies after ten relevant contacts.",
    evidence: [
      {
        label: "Public request",
        sourceUrl: "https://example.com/request",
        type: "fact" as const,
        summary: "A buyer requested automated weekly reporting."
      }
    ],
    isDemo: true
  };
  const datedFact = (category: "demand" | "payment" | "channel" | "feasibility" | "counter", suffix: string, strength: "strong" | "medium" = "strong") => ({
    label: `${category} evidence ${suffix}`,
    sourceUrl: `https://example.com/${category}-${suffix}`,
    type: "fact" as const,
    category,
    strength,
    sourceDate: "2026-07-29",
    summary: "Direct evidence used by the deterministic gate test.",
    proves: "The required evidence class is represented.",
    limitations: "The source does not guarantee future revenue."
  });
  const assessment = {
    currentAlternative: "Spreadsheet work",
    currentAlternativeCost: "Four hours each week",
    competitiveLandscape: "One paid tool and one free substitute",
    automatedDeliveryFlow: "Upload, preview, pay, and automatically download",
    acquisitionPlan: "One exact-intent search page for the first 100 visitors",
    dependencies: [],
    failureReasons: ["Users keep the spreadsheet", "Traffic is too low", "Input formats drift"],
    unknowns: ["Paid conversion rate"],
    scores: { demand: 17, payment: 17, acquisition: 13, closure: 13, differentiation: 8, feasibility: 9, recurringValue: 8 }
  };
  const qualifiedOpportunity = opportunityInputSchema.parse({
    ...opportunity,
    isDemo: false,
    assessment,
    evidence: [
      datedFact("demand", "one"),
      datedFact("demand", "two", "medium"),
      datedFact("payment", "one"),
      datedFact("channel", "one"),
      datedFact("feasibility", "one"),
      datedFact("counter", "one")
    ]
  });

  it("requires traceable evidence", () => {
    expect(opportunityInputSchema.safeParse(opportunity).success).toBe(true);
    expect(
      opportunityInputSchema.safeParse({ ...opportunity, evidence: [] }).success
    ).toBe(false);
  });

  it("rejects ideas without a verifiable sales channel", () => {
    expect(opportunityInputSchema.safeParse({ ...opportunity, salesChannels: [] }).success).toBe(false);
  });

  it("rewards fit and low effort without claiming certainty", () => {
    expect(calculateOpportunityScore(opportunity)).toBeGreaterThan(70);
  });

  it("passes only a dated, independently sourced 85-point deep-research candidate", () => {
    expect(calculateOpportunityScore(qualifiedOpportunity)).toBe(85);
    expect(evaluateOpportunityResearchGate(qualifiedOpportunity)).toEqual({ passed: true, score: 85, reasons: [] });
  });

  it("rejects a high self-score when a required strong evidence class is missing", () => {
    const evidence = qualifiedOpportunity.evidence.filter((item) => item.category !== "payment");
    const result = evaluateOpportunityResearchGate({ ...qualifiedOpportunity, evidence });
    expect(result.passed).toBe(false);
    expect(result.reasons.join(" ")).toContain("payment");
  });

  it("rejects a structurally complete candidate below 85", () => {
    const assessmentAt84 = { ...assessment, scores: { ...assessment.scores, recurringValue: 7 } };
    expect(evaluateOpportunityResearchGate({ ...qualifiedOpportunity, assessment: assessmentAt84 }).passed).toBe(false);
  });

  it("limits daily reports to three opportunities", () => {
    expect(
      dailyReportInputSchema.safeParse({
        reportDate: "2026-07-28",
        title: "Daily radar",
        summary: "A short report.",
        generatedBy: "demo",
        opportunityIds: Array.from({ length: 4 }, (_, index) =>
          `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
        ),
        isDemo: true
      }).success
    ).toBe(false);
  });
});
