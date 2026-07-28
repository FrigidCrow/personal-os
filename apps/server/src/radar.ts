import { Codex } from "@openai/codex-sdk";
import type { PersonalOsDatabase } from "@personal-os/database";
import type { DailyReport, OpportunityInput } from "@personal-os/domain";

const opportunityOutputSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    opportunities: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          payer: { type: "string" },
          pain: { type: "string" },
          summary: { type: "string" },
          businessModel: { type: "string" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          personalFit: { type: "integer", minimum: 0, maximum: 100 },
          validationEffortHours: { type: "number", minimum: 0 },
          validationBudget: { type: "number", minimum: 0 },
          timeToRevenue: { type: "string" },
          recurringPotential: { type: "integer", minimum: 0, maximum: 100 },
          maintenanceHoursMonthly: { type: "number", minimum: 0 },
          hypothesis: { type: "string" },
          minimalExperiment: { type: "string" },
          successCondition: { type: "string" },
          stopCondition: { type: "string" },
          evidence: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                sourceUrl: { type: "string" },
                type: { type: "string", enum: ["fact", "inference"] },
                summary: { type: "string" }
              },
              required: ["label", "sourceUrl", "type", "summary"],
              additionalProperties: false
            }
          }
        },
        required: ["title", "payer", "pain", "summary", "businessModel", "confidence", "personalFit", "validationEffortHours", "validationBudget", "timeToRevenue", "recurringPotential", "maintenanceHoursMonthly", "hypothesis", "minimalExperiment", "successCondition", "stopCondition", "evidence"],
        additionalProperties: false
      }
    }
  },
  required: ["summary", "opportunities"],
  additionalProperties: false
} as const;

function today(timeZone = process.env.PERSONAL_OS_TIMEZONE ?? "Asia/Tokyo"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export class RadarService {
  constructor(private readonly database: PersonalOsDatabase) {}

  generateDemo(): DailyReport {
    const opportunities = this.database.listOpportunities().sort((a, b) => b.score - a.score).slice(0, 5);
    return this.database.createDailyReport({
      reportDate: today(),
      title: "机会雷达日报",
      summary: opportunities.length > 0
        ? `${opportunities.length} 个演示机会等待审查。采取行动前必须核验每一条来源。`
        : "当前没有演示机会。生成报告前先添加有证据支持的候选机会。",
      generatedBy: "demo",
      opportunityIds: opportunities.map((opportunity) => opportunity.id),
      isDemo: true
    });
  }

  async generateLive(): Promise<DailyReport> {
    const codex = new Codex();
    const thread = codex.startThread({
      workingDirectory: process.cwd(),
      sandboxMode: "read-only",
      approvalPolicy: "never",
      networkAccessEnabled: true,
      webSearchMode: "live"
    });
    const prompt = [
      "Research current, evidence-backed ways a solo technical operator could test a revenue opportunity with minimal investment.",
      "The operator builds software, uses Codex, handles client projects, and wants low-maintenance recurring revenue.",
      "Return at most five opportunities. Prefer explicit buyer pain, recent public demand, repeatability, and tests under four hours.",
      "Every factual claim needs a direct source URL. Label unsupported commercial interpretation as inference.",
      "Do not claim guaranteed income. Do not perform outreach, purchases, publishing, or account creation."
    ].join("\n\n");
    const result = await thread.run(prompt, { outputSchema: opportunityOutputSchema });
    const parsed = JSON.parse(result.finalResponse) as { summary: string; opportunities: Array<Omit<OpportunityInput, "status" | "isDemo">> };
    const created = parsed.opportunities.slice(0, 5).map((opportunity) => this.database.createOpportunity({
      ...opportunity,
      status: "candidate",
      isDemo: false
    }));
    return this.database.createDailyReport({
      reportDate: today(),
      title: "机会雷达日报",
      summary: parsed.summary,
      generatedBy: "codex",
      opportunityIds: created.map((opportunity) => opportunity.id),
      isDemo: false
    });
  }
}
