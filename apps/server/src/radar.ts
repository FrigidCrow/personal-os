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
          offer: { type: "string" },
          pricingModel: { type: "string" },
          salesChannels: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                accessMethod: { type: "string" },
                sourceUrl: { type: "string" }
              },
              required: ["name", "accessMethod", "sourceUrl"],
              additionalProperties: false
            }
          },
          firstSalePlan: { type: "string" },
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
        required: ["title", "payer", "pain", "summary", "businessModel", "offer", "pricingModel", "salesChannels", "firstSalePlan", "confidence", "personalFit", "validationEffortHours", "validationBudget", "timeToRevenue", "recurringPotential", "maintenanceHoursMonthly", "hypothesis", "minimalExperiment", "successCondition", "stopCondition", "evidence"],
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

function containsChinese(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

function assertChineseReport(parsed: { summary: string; opportunities: Array<Omit<OpportunityInput, "status" | "isDemo">> }): void {
  if (!containsChinese(parsed.summary)) throw new Error("Live radar returned a non-Chinese report summary.");
  const invalid = parsed.opportunities.find((opportunity) => [
    opportunity.title,
    opportunity.payer,
    opportunity.pain,
    opportunity.summary,
    opportunity.businessModel,
    opportunity.offer,
    opportunity.pricingModel,
    opportunity.firstSalePlan,
    opportunity.timeToRevenue,
    opportunity.hypothesis,
    opportunity.minimalExperiment,
    opportunity.successCondition,
    opportunity.stopCondition,
    ...opportunity.salesChannels.flatMap((channel) => [channel.name, channel.accessMethod]),
    ...opportunity.evidence.flatMap((evidence) => [evidence.label, evidence.summary])
  ].some((value) => !containsChinese(value)));
  if (invalid) throw new Error(`Live radar returned non-Chinese content for opportunity: ${invalid.title}`);
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
    const schedule = this.database.getRadarSchedule();
    const codex = new Codex();
    const thread = codex.startThread({
      workingDirectory: process.cwd(),
      sandboxMode: "read-only",
      approvalPolicy: "never",
      networkAccessEnabled: true,
      webSearchMode: "live"
    });
    const prompt = [
      "请调研当前有证据支持、适合个人技术从业者以最低投入测试的赚钱机会。",
      `操作者画像：${schedule.searchProfile}`,
      schedule.customInstructions ? `用户自定义搜索规则：${schedule.customInstructions}` : "用户没有添加额外搜索规则。",
      "最多返回五个机会。优先考虑明确的付费者痛点、近期公开需求、可重复交付能力，以及四小时以内可以完成的最小测试。",
      "销售渠道是硬门槛。每个候选必须说明具体卖什么、卖给谁、如何定价、从哪个真实渠道接触买家，以及获得第一单的分步路径。salesChannels 至少包含一个可直接访问的公开 URL 和具体进入方式。无法验证销售渠道的候选必须省略，不能为了凑数返回。",
      "所有面向用户的字符串值必须使用简体中文，包括报告摘要、标题、付费者、痛点、商业模式、假设、最小实验、继续与停止条件、证据标签和证据摘要。专有名词可以保留英文，来源 URL 必须保持原样。不要输出英文段落。",
      "每项事实都需要提供可直接访问的来源 URL。没有直接证据的商业判断必须标记为 inference，并在中文摘要中明确说明这是推断。",
      "不得声称收入有保证。不得执行外联、购买、发布或创建账户等操作。只做只读调研并返回结构化结果。报告摘要只总结机会、优先级和下一步，不要描述数据是否已保存；应用会在返回后自动持久化报告。"
    ].join("\n\n");
    const result = await thread.run(prompt, { outputSchema: opportunityOutputSchema });
    const parsed = JSON.parse(result.finalResponse) as { summary: string; opportunities: Array<Omit<OpportunityInput, "status" | "isDemo">> };
    assertChineseReport(parsed);
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
