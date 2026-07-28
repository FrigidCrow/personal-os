import { describe, expect, it } from "vitest";
import {
  assertTaskTransition,
  calculateOpportunityScore,
  canTransitionTask,
  dailyReportInputSchema,
  opportunityInputSchema
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
