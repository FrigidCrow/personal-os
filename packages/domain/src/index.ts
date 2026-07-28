import { z } from "zod";

export const projectLaneSchema = z.enum(["cash_now", "systemize", "assets", "life_ops"]);
export const projectStatusSchema = z.enum(["planned", "active", "paused", "blocked", "completed", "archived"]);
export const taskStatusSchema = z.enum(["inbox", "ready", "in_progress", "needs_review", "done", "blocked"]);
export const delegationModeSchema = z.enum(["human_only", "codex_ready", "mixed"]);
export const prioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const opportunityStatusSchema = z.enum(["candidate", "shortlisted", "dismissed", "experiment", "validated", "rejected"]);
export const evidenceTypeSchema = z.enum(["fact", "inference"]);
export const experimentStatusSchema = z.enum(["hypothesis", "preparing", "running", "measuring", "won", "lost", "pivoted"]);
export const assetStageSchema = z.enum(["idea", "evidence", "experiment", "building", "launched", "revenue", "systemized"]);
export const codexRunStatusSchema = z.enum(["queued", "running", "needs_review", "done", "blocked", "failed", "cancelled"]);
export const generatedBySchema = z.enum(["demo", "codex", "manual"]);

const optionalText = z.string().trim().max(2000).nullable().optional();
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const optionalMoney = z.number().finite().min(0).nullable().optional();

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
  acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(20).default([])
});

export const taskPatchSchema = taskInputSchema.partial().omit({ status: true });

export const evidenceInputSchema = z.object({
  label: z.string().trim().min(1).max(180),
  sourceUrl: z.string().url(),
  type: evidenceTypeSchema,
  summary: z.string().trim().min(1).max(1000)
});

export const opportunityInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  payer: z.string().trim().min(1).max(300),
  pain: z.string().trim().min(1).max(1000),
  summary: z.string().trim().min(1).max(1500),
  businessModel: z.string().trim().min(1).max(500),
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

export const dailyReportInputSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(2000),
  generatedBy: generatedBySchema,
  opportunityIds: z.array(z.string().uuid()).max(5),
  isDemo: z.boolean().default(false)
});

export type ProjectLane = z.infer<typeof projectLaneSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type DelegationMode = z.infer<typeof delegationModeSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type OpportunityStatus = z.infer<typeof opportunityStatusSchema>;
export type ExperimentStatus = z.infer<typeof experimentStatusSchema>;
export type AssetStage = z.infer<typeof assetStageSchema>;
export type CodexRunStatus = z.infer<typeof codexRunStatusSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;
export type ExperimentInput = z.infer<typeof experimentInputSchema>;
export type IncomeAssetInput = z.infer<typeof incomeAssetInputSchema>;
export type DailyReportInput = z.infer<typeof dailyReportInputSchema>;

export interface Project extends ProjectInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task extends TaskInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence extends z.infer<typeof evidenceInputSchema> {
  id: string;
  opportunityId: string;
}

export interface Opportunity extends Omit<OpportunityInput, "evidence"> {
  id: string;
  evidence: Evidence[];
  score: number;
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

export interface CodexRunEvent {
  id: string;
  runId: string;
  eventType: string;
  message: string;
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

export function calculateOpportunityScore(input: Pick<OpportunityInput, "confidence" | "personalFit" | "validationEffortHours" | "recurringPotential" | "maintenanceHoursMonthly">): number {
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
