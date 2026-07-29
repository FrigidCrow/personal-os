import { z } from "zod";

export const projectLaneSchema = z.enum(["cash_now", "systemize", "assets", "life_ops"]);
export const projectStatusSchema = z.enum(["planned", "active", "paused", "blocked", "completed", "archived"]);
export const taskStatusSchema = z.enum(["inbox", "ready", "in_progress", "needs_review", "done", "blocked"]);
export const delegationModeSchema = z.enum(["human_only", "codex_ready", "mixed"]);
export const prioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const executorSchema = z.enum(["auto", "human", "codex", "openworker"]);
export const agentExecutorSchema = executorSchema.exclude(["auto", "human"]);
export const executionModeSchema = z.enum(["manual", "automatic"]);
export const triggerTypeSchema = z.enum(["manual", "cron", "event", "dependency"]);
export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export const taskTypeSchema = z.enum([
  "coding",
  "testing",
  "code_review",
  "technical_docs",
  "email",
  "calendar",
  "slack",
  "notion",
  "business_report",
  "general_writing",
  "other"
]);
export const opportunityStatusSchema = z.enum(["candidate", "shortlisted", "dismissed", "experiment", "validated", "rejected"]);
export const evidenceTypeSchema = z.enum(["fact", "inference"]);
export const evidenceCategorySchema = z.enum(["demand", "payment", "channel", "feasibility", "counter"]);
export const evidenceStrengthSchema = z.enum(["weak", "medium", "strong"]);
export const dependencyTypeSchema = z.enum(["account", "qualification", "api", "data", "compliance", "platform", "other"]);
export const dependencyStatusSchema = z.enum(["verified", "unverified", "blocking"]);
export const experimentStatusSchema = z.enum(["hypothesis", "preparing", "running", "measuring", "won", "lost", "pivoted"]);
export const assetStageSchema = z.enum(["idea", "evidence", "experiment", "building", "launched", "revenue", "systemized"]);
export const agentRunStatusSchema = z.enum([
  "queued",
  "claimed",
  "running",
  "awaiting_approval",
  "needs_review",
  "done",
  "blocked",
  "failed",
  "cancelled"
]);
export const codexRunStatusSchema = agentRunStatusSchema;
export const agentRunEventTypeSchema = z.enum([
  "queued",
  "claimed",
  "running",
  "heartbeat",
  "tool_request",
  "approval_requested",
  "approval_resolved",
  "artifact_saved",
  "verification",
  "needs_review",
  "failed",
  "cancelled"
]);
export const approvalActionTypeSchema = z.enum([
  "send_message",
  "calendar_write",
  "publish",
  "shell",
  "external_write",
  "other"
]);
export const approvalStatusSchema = z.enum(["pending", "approved", "rejected", "expired"]);
export const generatedBySchema = z.enum(["demo", "codex", "openworker", "manual"]);
export const radarScheduleStatusSchema = z.enum(["idle", "queued", "running", "succeeded", "partial", "failed", "skipped"]);

export const OPPORTUNITY_RESEARCH_SCORE_THRESHOLD = 85;
export const RADAR_QUALIFIED_TARGET = 3;

const optionalText = z.string().trim().max(2000).nullable().optional();
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const optionalMoney = z.number().finite().min(0).nullable().optional();
const optionalDateTime = z.string().datetime({ offset: true }).nullable().optional();

export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  lane: projectLaneSchema,
  status: projectStatusSchema.default("planned"),
  outcome: z.string().trim().min(1).max(1000),
  nextAction: z.string().trim().min(1).max(500),
  deadline: optionalDate,
  expectedRevenue: optionalMoney,
  actualRevenue: optionalMoney,
  repositoryPath: optionalText,
  obsidianPath: optionalText
});

export const projectPatchSchema = projectInputSchema.partial();

export const taskInputSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).default(""),
  status: taskStatusSchema.default("inbox"),
  delegationMode: delegationModeSchema.default("mixed"),
  priority: prioritySchema.default("medium"),
  dueDate: optionalDate,
  acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  taskType: taskTypeSchema.default("other"),
  executor: executorSchema.default("human"),
  executionMode: executionModeSchema.default("manual"),
  triggerType: triggerTypeSchema.default("manual"),
  triggerConfig: z.record(z.string(), z.unknown()).nullable().default(null),
  triggerTimezone: z.string().trim().min(1).max(100).default("UTC"),
  riskLevel: riskLevelSchema.default("medium"),
  maxAttempts: z.number().int().min(1).max(10).default(1),
  nextRunAt: optionalDateTime.default(null),
  lastScheduledAt: optionalDateTime.default(null),
  automationPaused: z.boolean().default(false)
});

export const taskPatchSchema = taskInputSchema.partial().omit({ status: true });

export const evidenceInputSchema = z.object({
  label: z.string().trim().min(1).max(180),
  sourceUrl: z.string().url(),
  type: evidenceTypeSchema,
  category: evidenceCategorySchema.default("demand"),
  strength: evidenceStrengthSchema.default("weak"),
  sourceDate: optionalDate.default(null),
  summary: z.string().trim().min(1).max(1000),
  proves: z.string().trim().min(1).max(1000).default("历史证据未单独记录证明范围。"),
  limitations: z.string().trim().min(1).max(1000).default("历史证据未单独记录局限。")
});

export const salesChannelInputSchema = z.object({
  name: z.string().trim().min(1).max(180),
  accessMethod: z.string().trim().min(1).max(1000),
  sourceUrl: z.string().url()
});

export const opportunityAssessmentScoresSchema = z.object({
  demand: z.number().int().min(0).max(20),
  payment: z.number().int().min(0).max(20),
  acquisition: z.number().int().min(0).max(15),
  closure: z.number().int().min(0).max(15),
  differentiation: z.number().int().min(0).max(10),
  feasibility: z.number().int().min(0).max(10),
  recurringValue: z.number().int().min(0).max(10)
});

export const opportunityDependencySchema = z.object({
  name: z.string().trim().min(1).max(180),
  type: dependencyTypeSchema,
  status: dependencyStatusSchema,
  details: z.string().trim().min(1).max(1000),
  sourceUrl: z.string().url().nullable().default(null)
});

export const opportunityAssessmentSchema = z.object({
  currentAlternative: z.string().trim().min(1).max(1500),
  currentAlternativeCost: z.string().trim().min(1).max(1000),
  competitiveLandscape: z.string().trim().min(1).max(2000),
  automatedDeliveryFlow: z.string().trim().min(1).max(2000),
  acquisitionPlan: z.string().trim().min(1).max(2000),
  dependencies: z.array(opportunityDependencySchema).max(12).default([]),
  failureReasons: z.array(z.string().trim().min(1).max(800)).min(3).max(5),
  unknowns: z.array(z.string().trim().min(1).max(800)).max(8).default([]),
  scores: opportunityAssessmentScoresSchema
});

export const opportunityInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  payer: z.string().trim().min(1).max(300),
  pain: z.string().trim().min(1).max(1000),
  summary: z.string().trim().min(1).max(1500),
  businessModel: z.string().trim().min(1).max(500),
  offer: z.string().trim().min(1).max(1000),
  pricingModel: z.string().trim().min(1).max(500),
  salesChannels: z.array(salesChannelInputSchema).min(1).max(8),
  firstSalePlan: z.string().trim().min(1).max(3000),
  confidence: z.number().int().min(0).max(100),
  personalFit: z.number().int().min(0).max(100),
  validationEffortHours: z.number().finite().min(0).max(1000),
  validationBudget: z.number().finite().min(0),
  timeToRevenue: z.string().trim().min(1).max(180),
  recurringPotential: z.number().int().min(0).max(100),
  maintenanceHoursMonthly: z.number().finite().min(0).max(744),
  hypothesis: z.string().trim().min(1).max(1500),
  minimalExperiment: z.string().trim().min(1).max(3000),
  successCondition: z.string().trim().min(1).max(1000),
  stopCondition: z.string().trim().min(1).max(1000),
  assessment: opportunityAssessmentSchema.nullable().default(null),
  status: opportunityStatusSchema.default("candidate"),
  evidence: z.array(evidenceInputSchema).min(1).max(20),
  isDemo: z.boolean().default(false)
});

export const experimentInputSchema = z.object({
  opportunityId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(180),
  hypothesis: z.string().trim().min(1).max(1500),
  status: experimentStatusSchema.default("hypothesis"),
  timeCapHours: z.number().finite().positive().max(1000),
  budgetCap: z.number().finite().min(0),
  deadline: optionalDate,
  successCondition: z.string().trim().min(1).max(1000),
  stopCondition: z.string().trim().min(1).max(1000),
  resultSummary: optionalText
});

export const experimentPatchSchema = experimentInputSchema.partial();

export const experimentResultInputSchema = z.object({
  status: experimentStatusSchema.extract(["measuring", "won", "lost", "pivoted"]),
  resultSummary: z.string().trim().min(1).max(2000)
});

export const incomeAssetInputSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  experimentId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(180),
  stage: assetStageSchema.default("idea"),
  revenueModel: z.string().trim().min(1).max(500),
  monthlyRevenue: z.number().finite().min(0).default(0),
  maintenanceHoursMonthly: z.number().finite().min(0).max(744).default(0),
  nextAction: z.string().trim().min(1).max(500)
});

export const codexAssignmentSchema = z.object({
  mode: z.enum(["demo", "live"]).default("demo"),
  newThread: z.boolean().default(false),
  additionalInstructions: z.string().trim().max(2000).optional()
});

export const approvalRequestInputSchema = z.object({
  runId: z.string().uuid(),
  actionType: approvalActionTypeSchema,
  destination: z.string().trim().min(1).max(500),
  summary: z.string().trim().min(1).max(1000),
  payloadPreview: z.string().trim().max(4000).nullable().default(null),
  expiresAt: optionalDateTime
});

export const dailyReportInputSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(2000),
  generatedBy: generatedBySchema,
  opportunityIds: z.array(z.string().uuid()).max(RADAR_QUALIFIED_TARGET),
  isDemo: z.boolean().default(false)
});

export const radarScheduleInputSchema = z.object({
  enabled: z.boolean().default(true),
  expression: z.string().trim().min(1).max(120).default("0 8 * * *"),
  timezone: z.string().trim().min(1).max(100).default("Asia/Tokyo"),
  catchUp: z.boolean().default(true),
  executor: agentExecutorSchema.default("openworker"),
  searchProfile: z.string().trim().min(1).max(3000).default("操作者会开发软件、使用 Codex、承接客户项目，希望以低维护的产品化服务或数字资产建立经常性收入。"),
  customInstructions: z.string().trim().max(5000).default("")
});

export type ProjectLane = z.infer<typeof projectLaneSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type DelegationMode = z.infer<typeof delegationModeSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type Executor = z.infer<typeof executorSchema>;
export type AgentExecutor = z.infer<typeof agentExecutorSchema>;
export type ExecutionMode = z.infer<typeof executionModeSchema>;
export type TriggerType = z.infer<typeof triggerTypeSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type TaskType = z.infer<typeof taskTypeSchema>;
export type OpportunityStatus = z.infer<typeof opportunityStatusSchema>;
export type EvidenceCategory = z.infer<typeof evidenceCategorySchema>;
export type EvidenceStrength = z.infer<typeof evidenceStrengthSchema>;
export type ExperimentStatus = z.infer<typeof experimentStatusSchema>;
export type AssetStage = z.infer<typeof assetStageSchema>;
export type CodexRunStatus = z.infer<typeof codexRunStatusSchema>;
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;
export type AgentRunEventType = z.infer<typeof agentRunEventTypeSchema>;
export type ApprovalActionType = z.infer<typeof approvalActionTypeSchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type TaskCreateInput = z.input<typeof taskInputSchema>;
export type TaskInput = z.output<typeof taskInputSchema>;
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;
export type OpportunityAssessment = z.infer<typeof opportunityAssessmentSchema>;
export type ExperimentInput = z.infer<typeof experimentInputSchema>;
export type IncomeAssetInput = z.infer<typeof incomeAssetInputSchema>;
export type DailyReportInput = z.infer<typeof dailyReportInputSchema>;
export type RadarScheduleInput = z.infer<typeof radarScheduleInputSchema>;
export type RadarScheduleStatus = z.infer<typeof radarScheduleStatusSchema>;

export interface Project extends ProjectInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task extends TaskInput {
  id: string;
  automationCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isRecurringTask(task: Pick<Task, "executionMode" | "triggerType">): boolean {
  return task.executionMode === "automatic" && task.triggerType === "cron";
}

export function isActiveRecurringTask(task: Pick<Task, "executionMode" | "triggerType" | "automationCompletedAt">): boolean {
  return isRecurringTask(task) && task.automationCompletedAt === null;
}

export interface Evidence extends z.infer<typeof evidenceInputSchema> {
  id: string;
  opportunityId: string;
}

export interface Opportunity extends Omit<OpportunityInput, "evidence"> {
  id: string;
  evidence: Evidence[];
  score: number;
  researchGatePassed: boolean;
  researchGateReasons: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Experiment extends ExperimentInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeAsset extends IncomeAssetInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReport extends DailyReportInput {
  id: string;
  opportunities: Opportunity[];
  createdAt: string;
}

export interface RadarSchedule extends RadarScheduleInput {
  nextRunAt: string | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastStatus: RadarScheduleStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CodexRun {
  id: string;
  projectId: string | null;
  taskId: string;
  threadId: string | null;
  status: CodexRunStatus;
  mode: "demo" | "live";
  workingDirectory: string | null;
  promptSnapshot: string;
  finalResponse: string | null;
  artifactPaths: string[];
  verificationSummary: string | null;
  errorMessage: string | null;
  requiresHumanReview: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  projectId: string | null;
  taskId: string;
  executor: AgentExecutor;
  externalSessionId: string | null;
  status: AgentRunStatus;
  mode: "demo" | "live";
  attempt: number;
  idempotencyKey: string;
  promptSnapshot: string;
  workingDirectory: string | null;
  finalResponse: string | null;
  artifactPaths: string[];
  verificationSummary: string | null;
  errorMessage: string | null;
  requiresHumanReview: boolean;
  claimedAt: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CodexRunEvent {
  id: string;
  runId: string;
  eventType: string;
  message: string;
  createdAt: string;
}

export interface AgentRunEvent {
  id: string;
  runId: string;
  eventType: AgentRunEventType;
  message: string;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  actionType: ApprovalActionType;
  destination: string;
  summary: string;
  payloadPreview: string | null;
  status: ApprovalStatus;
  expiresAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const allowedTaskTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  inbox: ["ready", "blocked"],
  ready: ["in_progress", "blocked", "inbox"],
  in_progress: ["needs_review", "blocked", "ready"],
  needs_review: ["done", "in_progress", "blocked"],
  done: [],
  blocked: ["ready", "in_progress", "inbox"]
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return allowedTaskTransitions[from].includes(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTask(from, to)) {
    throw new Error(`Invalid task transition: ${from} -> ${to}`);
  }
}

const allowedAgentRunTransitions: Record<AgentRunStatus, readonly AgentRunStatus[]> = {
  queued: ["claimed", "running", "failed", "cancelled"],
  claimed: ["running", "failed", "cancelled"],
  running: ["awaiting_approval", "needs_review", "blocked", "failed", "cancelled"],
  awaiting_approval: ["running", "needs_review", "blocked", "failed", "cancelled"],
  needs_review: ["done", "blocked"],
  done: [],
  blocked: [],
  failed: [],
  cancelled: []
};

export function canTransitionAgentRun(from: AgentRunStatus, to: AgentRunStatus): boolean {
  return allowedAgentRunTransitions[from].includes(to);
}

export function assertAgentRunTransition(from: AgentRunStatus, to: AgentRunStatus): void {
  if (!canTransitionAgentRun(from, to)) {
    throw new Error(`Invalid agent run transition: ${from} -> ${to}`);
  }
}

const requiredEvidenceCategories: EvidenceCategory[] = ["demand", "payment", "channel", "feasibility", "counter"];

export function calculateResearchScore(scores: z.infer<typeof opportunityAssessmentScoresSchema>): number {
  return scores.demand + scores.payment + scores.acquisition + scores.closure + scores.differentiation + scores.feasibility + scores.recurringValue;
}

export function evaluateOpportunityResearchGate(input: Pick<OpportunityInput, "assessment" | "evidence" | "salesChannels">): { passed: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.assessment) {
    return { passed: false, score: 0, reasons: ["缺少结构化深度尽调。"] };
  }

  const score = calculateResearchScore(input.assessment.scores);
  if (score < OPPORTUNITY_RESEARCH_SCORE_THRESHOLD) reasons.push(`综合评分 ${score}，低于 ${OPPORTUNITY_RESEARCH_SCORE_THRESHOLD} 分门槛。`);

  const floors = {
    demand: 12,
    payment: 12,
    acquisition: 9,
    closure: 9,
    feasibility: 6
  } as const;
  for (const [dimension, floor] of Object.entries(floors) as Array<[keyof typeof floors, number]>) {
    if (input.assessment.scores[dimension] < floor) reasons.push(`${dimension} 分项低于最低门槛 ${floor} 分。`);
  }

  const factualEvidence = input.evidence.filter((item) => item.type === "fact");
  const demandUrls = new Set(factualEvidence.filter((item) => item.category === "demand").map((item) => item.sourceUrl));
  if (demandUrls.size < 2) reasons.push("需求证据不足两条独立事实来源。");

  for (const category of requiredEvidenceCategories) {
    const strong = factualEvidence.find((item) => item.category === category && item.strength === "strong" && item.sourceDate);
    if (!strong) reasons.push(`${category} 类缺少带日期的强事实证据。`);
  }

  const strongSourceUrls = new Set(factualEvidence.filter((item) => item.strength === "strong" && item.sourceDate).map((item) => item.sourceUrl));
  if (strongSourceUrls.size < requiredEvidenceCategories.length) reasons.push("强证据来源不够独立，至少需要五个不同 URL。");
  if (input.salesChannels.length === 0) reasons.push("缺少可核验销售渠道。");
  if (input.assessment.dependencies.some((item) => item.status === "blocking")) reasons.push("仍存在阻断自动成交或交付的外部依赖。");

  return { passed: reasons.length === 0, score, reasons };
}

export function calculateOpportunityScore(input: Pick<OpportunityInput, "confidence" | "personalFit" | "validationEffortHours" | "recurringPotential" | "maintenanceHoursMonthly"> & Partial<Pick<OpportunityInput, "assessment">>): number {
  if (input.assessment) return calculateResearchScore(input.assessment.scores);
  const effortScore = Math.max(0, 100 - input.validationEffortHours * 8);
  const maintenanceScore = Math.max(0, 100 - input.maintenanceHoursMonthly * 10);
  const weighted =
    input.personalFit * 0.3 +
    input.confidence * 0.25 +
    effortScore * 0.2 +
    input.recurringPotential * 0.15 +
    maintenanceScore * 0.1;

  return Math.round(Math.min(100, Math.max(0, weighted)));
}

export const laneLabels: Record<ProjectLane, string> = {
  cash_now: "Cash Now",
  systemize: "Systemize",
  assets: "Assets",
  life_ops: "Life & Ops"
};
