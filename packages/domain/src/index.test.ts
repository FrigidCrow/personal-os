import { describe, expect, it } from "vitest";
import {
  assertAgentRunTransition,
  assertTaskTransition,
  calculateOpportunityScore,
  canTransitionAgentRun,
  canTransitionTask,
  dailyReportInputSchema,
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
      catchUp: true
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

  it("requires traceable evidence", () => {
    expect(opportunityInputSchema.safeParse(opportunity).success).toBe(true);
    expect(
      opportunityInputSchema.safeParse({ ...opportunity, evidence: [] }).success
    ).toBe(false);
  });

  it("rewards fit and low effort without claiming certainty", () => {
    expect(calculateOpportunityScore(opportunity)).toBeGreaterThan(70);
  });

  it("limits daily reports to five opportunities", () => {
    expect(
      dailyReportInputSchema.safeParse({
        reportDate: "2026-07-28",
        title: "Daily radar",
        summary: "A short report.",
        generatedBy: "demo",
        opportunityIds: Array.from({ length: 6 }, (_, index) =>
          `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
        ),
        isDemo: true
      }).success
    ).toBe(false);
  });
});
