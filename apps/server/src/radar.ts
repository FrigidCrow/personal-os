import { Codex } from "@openai/codex-sdk";
import type { PersonalOsDatabase } from "@personal-os/database";
import {
  evaluateOpportunityResearchGate,
  OPPORTUNITY_RESEARCH_SCORE_THRESHOLD,
  RADAR_QUALIFIED_TARGET,
  type DailyReport,
  type OpportunityInput
} from "@personal-os/domain";

const opportunityOutputSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    opportunities: {
      type: "array",
      maxItems: RADAR_QUALIFIED_TARGET,
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
          assessment: {
            type: "object",
            properties: {
              currentAlternative: { type: "string" },
              currentAlternativeCost: { type: "string" },
              competitiveLandscape: { type: "string" },
              automatedDeliveryFlow: { type: "string" },
              acquisitionPlan: { type: "string" },
              dependencies: {
                type: "array",
                maxItems: 12,
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string", enum: ["account", "qualification", "api", "data", "compliance", "platform", "other"] },
                    status: { type: "string", enum: ["verified", "unverified", "blocking"] },
                    details: { type: "string" },
                    sourceUrl: { type: ["string", "null"] }
                  },
                  required: ["name", "type", "status", "details", "sourceUrl"],
                  additionalProperties: false
                }
              },
              failureReasons: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
              unknowns: { type: "array", maxItems: 8, items: { type: "string" } },
              scores: {
                type: "object",
                properties: {
                  demand: { type: "integer", minimum: 0, maximum: 20 },
                  payment: { type: "integer", minimum: 0, maximum: 20 },
                  acquisition: { type: "integer", minimum: 0, maximum: 15 },
                  closure: { type: "integer", minimum: 0, maximum: 15 },
                  differentiation: { type: "integer", minimum: 0, maximum: 10 },
                  feasibility: { type: "integer", minimum: 0, maximum: 10 },
                  recurringValue: { type: "integer", minimum: 0, maximum: 10 }
                },
                required: ["demand", "payment", "acquisition", "closure", "differentiation", "feasibility", "recurringValue"],
                additionalProperties: false
              }
            },
            required: ["currentAlternative", "currentAlternativeCost", "competitiveLandscape", "automatedDeliveryFlow", "acquisitionPlan", "dependencies", "failureReasons", "unknowns", "scores"],
            additionalProperties: false
          },
          evidence: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                sourceUrl: { type: "string" },
                type: { type: "string", enum: ["fact", "inference"] },
                category: { type: "string", enum: ["demand", "payment", "channel", "feasibility", "counter"] },
                strength: { type: "string", enum: ["weak", "medium", "strong"] },
                sourceDate: { type: ["string", "null"] },
                summary: { type: "string" },
                proves: { type: "string" },
                limitations: { type: "string" }
              },
              required: ["label", "sourceUrl", "type", "category", "strength", "sourceDate", "summary", "proves", "limitations"],
              additionalProperties: false
            }
          }
        },
        required: ["title", "payer", "pain", "summary", "businessModel", "offer", "pricingModel", "salesChannels", "firstSalePlan", "confidence", "personalFit", "validationEffortHours", "validationBudget", "timeToRevenue", "recurringPotential", "maintenanceHoursMonthly", "hypothesis", "minimalExperiment", "successCondition", "stopCondition", "assessment", "evidence"],
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
    ...(opportunity.assessment ? [
      opportunity.assessment.currentAlternative,
      opportunity.assessment.currentAlternativeCost,
      opportunity.assessment.competitiveLandscape,
      opportunity.assessment.automatedDeliveryFlow,
      opportunity.assessment.acquisitionPlan,
      ...opportunity.assessment.dependencies.flatMap((dependency) => [dependency.name, dependency.details]),
      ...opportunity.assessment.failureReasons,
      ...opportunity.assessment.unknowns
    ] : []),
    ...opportunity.salesChannels.flatMap((channel) => [channel.name, channel.accessMethod]),
    ...opportunity.evidence.flatMap((evidence) => [evidence.label, evidence.summary, evidence.proves, evidence.limitations])
  ].some((value) => !containsChinese(value)));
  if (invalid) throw new Error(`Live radar returned non-Chinese content for opportunity: ${invalid.title}`);
}

export class RadarService {
  constructor(private readonly database: PersonalOsDatabase) {}

  generateDemo(): DailyReport {
    const opportunities = this.database.listOpportunities().sort((a, b) => b.score - a.score).slice(0, RADAR_QUALIFIED_TARGET);
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
      "你是保守的商业机会投资委员会，不是创业点子生成器。先跨多个垂直领域广泛扫描，再对最强候选做深度尽调。",
      `操作者画像：${schedule.searchProfile}`,
      schedule.customInstructions ? `用户自定义搜索规则：${schedule.customInstructions}` : "用户没有添加额外搜索规则。",
      `最多返回 ${RADAR_QUALIFIED_TARGET} 个深挖候选。每个候选必须独立达到 ${OPPORTUNITY_RESEARCH_SCORE_THRESHOLD} 分并通过全部门禁；不足三个时如实少返回，禁止降低标准凑数。`,
      "每个候选至少需要两条独立的真实需求事实，并且 demand、payment、channel、feasibility、counter 五类都必须有带日期的强事实证据，强证据至少来自五个不同 URL。竞品宣传页或价格页只能证明有人尝试销售，不能单独证明用户正在付费。",
      "必须主动调查免费替代品、平台原生能力、隐私顾虑和最可能失败的原因。逐条写清来源证明了什么、没有证明什么，并列出未解决问题。",
      "销售渠道是硬门槛。必须说明精确入口、准入资格、成本、限制以及前 100 个目标访问者从哪里来。泛泛写小红书、抖音、知乎或 SEO 不算渠道。",
      "商业闭环必须覆盖发现、首次价值、合规微信或支付宝收款、付款回调、自动交付、复购和维护。人工咨询、代做、逐单分析或不可获得的商业账号不能作为核心环节。任何 blocking 依赖都会淘汰候选。",
      "评分必须保守校准。没有直接用户证据时 demand 不得超过 10；只有价格页没有采用或购买证据时 payment 不得超过 10；只有泛渠道描述时 acquisition 不得超过 7；存在未验证的关键交付依赖时 closure 不得超过 7。",
      "所有面向用户的字符串值必须使用简体中文，包括报告摘要、标题、付费者、痛点、商业模式、假设、最小实验、继续与停止条件、证据标签和证据摘要。专有名词可以保留英文，来源 URL 必须保持原样。不要输出英文段落。",
      "每项事实都需要提供可直接访问的来源 URL。没有直接证据的商业判断必须标记为 inference，并在中文摘要中明确说明这是推断。",
      "不得声称收入有保证。不得执行外联、购买、发布或创建账户等操作。只做只读调研并返回结构化结果。报告摘要只总结机会、优先级和下一步，不要描述数据是否已保存；应用会在返回后自动持久化报告。"
    ].join("\n\n");
    const result = await thread.run(prompt, { outputSchema: opportunityOutputSchema });
    const parsed = JSON.parse(result.finalResponse) as { summary: string; opportunities: Array<Omit<OpportunityInput, "status" | "isDemo">> };
    assertChineseReport(parsed);
    const created = parsed.opportunities.slice(0, RADAR_QUALIFIED_TARGET).flatMap((opportunity) => {
      const candidate = { ...opportunity, status: "candidate" as const, isDemo: false };
      return evaluateOpportunityResearchGate(candidate).passed
        ? [this.database.createQualifiedRadarOpportunity(candidate)]
        : [];
    });
    return this.database.createDailyReport({
      reportDate: today(),
      title: "机会雷达日报",
      summary: created.length === RADAR_QUALIFIED_TARGET
        ? parsed.summary
        : `${parsed.summary}\n\n程序门禁最终保留 ${created.length}/${RADAR_QUALIFIED_TARGET} 个达到 ${OPPORTUNITY_RESEARCH_SCORE_THRESHOLD} 分的候选，本次调研未达到完全成功标准。`,
      generatedBy: "codex",
      opportunityIds: created.map((opportunity) => opportunity.id),
      isDemo: false
    });
  }
}
