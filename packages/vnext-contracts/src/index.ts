import { z } from "zod";

export const idSchema = z.string().min(1).max(200);
export const isoDateSchema = z.iso.datetime({ offset: true });
export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4_000).default(""),
  repositoryPath: z.string().trim().max(2_000).nullable().default(null),
  obsidianPath: z.string().trim().max(2_000).nullable().default(null),
  status: z.enum(["active", "paused", "archived"]).default("active")
});
export type ProjectInput = z.infer<typeof projectInputSchema>;
export interface Project extends ProjectInput { id: string; createdAt: string; updatedAt: string }

export const workSpecKindSchema = z.enum(["one_off", "workflow"]);
export const executorTypeSchema = z.enum(["internal", "process", "fake", "codex", "openworker"]);
export const workSpecStatusSchema = z.enum(["draft", "active", "paused", "retired"]);
export const skillSnapshotSchema = z.object({
  name: z.string().trim().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.string().trim().min(1).max(40),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  path: z.string().trim().min(1).max(2_000),
  content: z.string().min(1).max(200_000)
});
export type SkillSnapshot = z.infer<typeof skillSnapshotSchema>;
export const skillDraftInputSchema = z.object({
  name: z.string().trim().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.string().trim().regex(/^\d+\.\d+\.\d+$/),
  displayName: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500).refine((value) => !/[\r\n]/.test(value), "SKILL_DESCRIPTION_SINGLE_LINE"),
  instructions: z.string().trim().min(20).max(100_000),
  expectedCurrentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable().default(null)
});
export type SkillDraftInput = z.infer<typeof skillDraftInputSchema>;
export interface SkillDraftIssue { level: "error" | "warning"; code: string; message: string }
export interface SkillDraftValidation {
  valid: boolean;
  candidate: SkillSnapshot;
  current: SkillSnapshot | null;
  issues: SkillDraftIssue[];
}
export const skillPublishInputSchema = skillDraftInputSchema.extend({
  validatedContentHash: z.string().regex(/^[a-f0-9]{64}$/)
});
export type SkillPublishInput = z.infer<typeof skillPublishInputSchema>;
export const resultDepositionPolicySchema = z.object({
  vaultId: idSchema,
  directory: z.enum(["Generated", "Reports"]).default("Reports"),
  subdirectory: z.string().trim().max(500).default("").superRefine((value, context) => {
    if (!value) return;
    if (value.startsWith("/") || value.endsWith("/") || value.includes("\\") || value.includes("\0")) {
      context.addIssue({ code: "custom", message: "INVALID_KNOWLEDGE_SUBDIRECTORY" });
      return;
    }
    if (value.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))) {
      context.addIssue({ code: "custom", message: "INVALID_KNOWLEDGE_SUBDIRECTORY" });
    }
  }),
  titleTemplate: z.string().trim().min(1).max(200).default("{title} {date}"),
  trigger: z.enum(["on_acceptance", "on_success"]).default("on_acceptance"),
  period: z.enum(["run", "calendar_day"]).default("run"),
  timezone: z.string().trim().min(1).max(100).default("Asia/Tokyo")
});
export type ResultDepositionPolicy = z.infer<typeof resultDepositionPolicySchema>;
export const workSpecReviewPolicySchema = z.enum(["required", "not_required"]);
export type WorkSpecReviewPolicy = z.infer<typeof workSpecReviewPolicySchema>;
export const workSpecInputSchema = z.object({
  projectId: idSchema.nullable().default(null),
  kind: workSpecKindSchema.default("one_off"),
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().min(1).max(40_000),
  executorType: executorTypeSchema.default("internal"),
  input: z.unknown().default({}),
  timeoutSeconds: z.number().int().min(1).max(86_400).default(1_800),
  maxAttempts: z.number().int().min(1).max(10).default(2),
  lifecycleStatus: workSpecStatusSchema.default("active"),
  skill: skillSnapshotSchema.nullable().default(null),
  reviewPolicy: workSpecReviewPolicySchema.default("required"),
  resultDeposition: resultDepositionPolicySchema.nullable().default(null)
});
export type WorkSpecInput = z.input<typeof workSpecInputSchema>;
export interface WorkSpec extends z.output<typeof workSpecInputSchema> {
  id: string;
  revisionOfWorkSpecId: string | null;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
}
export const workSpecRevisionInputSchema = workSpecInputSchema.omit({ kind: true, lifecycleStatus: true }).extend({
  lifecycleStatus: z.literal("active").default("active")
});
export type WorkSpecRevisionInput = z.input<typeof workSpecRevisionInputSchema>;
export interface WorkSpecPreflightCheck {
  code: string;
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
}
export interface WorkSpecPreflight {
  workSpecId: string;
  ready: boolean;
  checkedAt: string;
  checks: WorkSpecPreflightCheck[];
}
export type WorkflowHealthStatus = "healthy" | "degraded" | "attention" | "never_run" | "paused";
export interface WorkflowOperationsSummary {
  workSpec: WorkSpec;
  health: WorkflowHealthStatus;
  scheduleCount: number;
  enabledScheduleCount: number;
  nextRunAt: string | null;
  latestRun: Run | null;
  consecutiveFailures: number;
}

export const controlPlaneEntityTypeSchema = z.enum(["project", "work_spec", "run", "artifact", "knowledge"]);
export type ControlPlaneEntityType = z.infer<typeof controlPlaneEntityTypeSchema>;
export interface ControlPlaneSearchResult {
  entityType: ControlPlaneEntityType;
  id: string;
  title: string;
  summary: string;
  updatedAt: string;
  projectId: string | null;
  workSpecId: string | null;
  runId: string | null;
}

export const runStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_input",
  "waiting_approval",
  "succeeded",
  "partially_succeeded",
  "failed",
  "cancelled"
]);
export type RunStatus = z.infer<typeof runStatusSchema>;
export const runReviewStatusSchema = z.enum(["not_required", "pending", "accepted", "rejected"]);
export type RunReviewStatus = z.infer<typeof runReviewStatusSchema>;
export const runModeSchema = z.enum(["production", "rehearsal", "failure_drill"]);
export type RunMode = z.infer<typeof runModeSchema>;
export interface Run {
  id: string;
  workSpecId: string;
  projectId: string | null;
  executorType: z.infer<typeof executorTypeSchema>;
  status: RunStatus;
  input: unknown;
  attempt: number;
  idempotencyKey: string | null;
  retryOfRunId: string | null;
  runMode: RunMode;
  rehearsalRootRunId: string | null;
  externalRunId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  result: unknown;
  usage: unknown;
  actualCostMinor: number | null;
  actualCostCurrency: string | null;
  costSource: "provider_bill" | "manual_receipt" | null;
  reviewStatus: RunReviewStatus;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunEvaluationCheck {
  code: string;
  passed: boolean;
  detail: string;
}
export interface RunEvaluation {
  id: string;
  runId: string;
  workSpecId: string;
  runMode: Exclude<RunMode, "production">;
  rehearsalRootRunId: string;
  evaluatorVersion: string;
  passed: boolean;
  checks: RunEvaluationCheck[];
  note: string;
  createdAt: string;
}

export const runEvaluationInputSchema = z.object({
  note: z.string().trim().max(4_000).default("")
});
export type RunEvaluationInput = z.infer<typeof runEvaluationInputSchema>;

export const skillCandidateStatusSchema = z.enum(["pending", "published"]);
export type SkillCandidateStatus = z.infer<typeof skillCandidateStatusSchema>;
export interface SkillCandidate {
  id: string;
  workSpecId: string;
  draft: SkillDraftInput;
  content: string;
  contentHash: string;
  evidenceRunIds: string[];
  status: SkillCandidateStatus;
  publishedSkill: SkillSnapshot | null;
  publishedWorkSpecId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
export interface RehearsalPromotionGate {
  workSpecId: string;
  ready: boolean;
  passedRehearsalRoots: string[];
  passedFailureDrillRunIds: string[];
  missing: string[];
  evaluations: RunEvaluation[];
  candidates: SkillCandidate[];
}

export const runCreateInputSchema = z.object({
  input: z.unknown().optional(),
  idempotencyKey: z.string().trim().min(1).max(300).optional(),
  start: z.boolean().default(true)
});
export type RunCreateInput = z.infer<typeof runCreateInputSchema>;

export const runRetryInputSchema = z.object({
  mode: z.enum(["resume", "restart"]).default("resume")
});
export type RunRetryInput = z.infer<typeof runRetryInputSchema>;

export const runInputResponseSchema = z.object({
  answer: z.string().trim().min(1).max(20_000)
});
export type RunInputResponse = z.infer<typeof runInputResponseSchema>;

export const runReviewInputSchema = z.object({
  comment: z.string().trim().max(4_000).default("")
});
export type RunReviewInput = z.infer<typeof runReviewInputSchema>;

export const actualRunCostInputSchema = z.object({
  amountMinor: z.number().int().safe().nonnegative(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  source: z.enum(["provider_bill", "manual_receipt"])
});
export type ActualRunCostInput = z.infer<typeof actualRunCostInputSchema>;

export const runEventLevelSchema = z.enum(["debug", "info", "warning", "error", "critical"]);
export interface RunEvent {
  id: string;
  runId: string;
  eventType: string;
  level: z.infer<typeof runEventLevelSchema>;
  source: string;
  message: string;
  structuredData: unknown;
  sequence: number;
  requestId: string | null;
  createdAt: string;
}

export const checkpointStatusSchema = z.enum(["running", "completed", "failed", "reused"]);
export type CheckpointStatus = z.infer<typeof checkpointStatusSchema>;
export const runtimeCheckpointInputSchema = z.object({
  stepKey: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
  label: z.string().trim().min(1).max(160),
  status: z.enum(["running", "completed", "failed"]),
  summary: z.string().trim().min(1).max(4_000),
  data: z.unknown().default({})
});
export type RuntimeCheckpointInput = z.infer<typeof runtimeCheckpointInputSchema>;
export interface RunCheckpoint {
  id: string;
  runId: string;
  stepKey: string;
  label: string;
  status: CheckpointStatus;
  summary: string;
  data: unknown;
  sourceCheckpointId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RunDepositionStatus = "pending" | "succeeded" | "failed";
export interface RunDeposition {
  id: string;
  runId: string;
  vaultId: string;
  directory: "Generated" | "Reports";
  subdirectory: string;
  deduplicationKey: string | null;
  title: string;
  status: RunDepositionStatus;
  documentId: string | null;
  artifactId: string | null;
  relativePath: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export const approvalRequestTypeSchema = z.enum(["permission_required", "directory_requested", "plan_proposed"]);
export const approvalStatusSchema = z.enum(["pending", "approved", "rejected", "expired"]);
export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export interface Approval {
  id: string;
  runId: string;
  requestType: z.infer<typeof approvalRequestTypeSchema>;
  riskLevel: z.infer<typeof riskLevelSchema>;
  summary: string;
  payload: unknown;
  status: z.infer<typeof approvalStatusSchema>;
  expiresAt: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  resolutionComment: string | null;
}
export const approvalDecisionInputSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(4_000).default("")
});
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionInputSchema>;

export const runtimeCapabilityScopeSchema = z.enum([
  "context:read",
  "event:append",
  "checkpoint:write",
  "knowledge:search",
  "artifact:create",
  "approval:request",
  "approval:read",
  "result:submit"
]);
export type RuntimeCapabilityScope = z.infer<typeof runtimeCapabilityScopeSchema>;
export const runtimeEventInputSchema = z.object({
  eventType: z.string().trim().min(1).max(100).regex(/^agent\.[a-z0-9_.-]+$/),
  level: runEventLevelSchema.default("info"),
  message: z.string().trim().min(1).max(4_000),
  structuredData: z.unknown().optional()
});
export const runtimeApprovalRequestSchema = z.object({
  requestType: approvalRequestTypeSchema,
  summary: z.string().trim().min(1).max(500),
  request: z.unknown().default({})
});
export const runtimeResultInputSchema = z.object({
  summary: z.string().trim().min(1).max(20_000),
  data: z.unknown().default({}),
  verification: z.array(z.string().trim().min(1).max(2_000)).max(50).default([])
});

export const internalExecutionInputSchema = z.object({
  operation: z.enum(["echo", "delay", "fail"]),
  message: z.string().max(20_000).default(""),
  delayMs: z.number().int().min(0).max(60_000).default(0)
});
export const processExecutionInputSchema = z.object({
  command: z.string().trim().min(1).max(100),
  args: z.array(z.string().max(4_000)).max(100).default([]),
  cwd: z.string().trim().min(1).max(2_000)
});

export const codexRuntimeOptionsSchema = z.object({
  additionalInstructions: z.string().trim().max(20_000).default(""),
  sandboxMode: z.enum(["read-only", "workspace-write"]).default("read-only"),
  additionalDirectories: z.array(z.string().trim().min(1).max(2_000)).max(20).default([]),
  managedResource: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  networkAccess: z.boolean().default(false),
  webSearch: z.boolean().default(false),
  model: z.string().trim().min(1).max(200).optional()
});
export type CodexRuntimeOptions = z.infer<typeof codexRuntimeOptionsSchema>;

export const openWorkerRuntimeOptionsSchema = z.object({
  additionalInstructions: z.string().trim().max(20_000).default(""),
  agent: z.string().trim().min(1).max(100).default("cowork"),
  model: z.string().trim().min(1).max(200).optional()
});
export type OpenWorkerRuntimeOptions = z.infer<typeof openWorkerRuntimeOptionsSchema>;

export const scheduleInputSchema = z.object({
  workSpecId: idSchema,
  name: z.string().trim().min(1).max(160),
  cronExpression: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(100).default("Asia/Tokyo"),
  enabled: z.boolean().default(true),
  catchUp: z.boolean().default(false)
});
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;
export const scheduleUpdateInputSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  cronExpression: z.string().trim().min(1).max(120).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  catchUp: z.boolean().optional()
}).refine(
  (value) => Object.keys(value).length > 0,
  "SCHEDULE_UPDATE_EMPTY"
);
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateInputSchema>;
export const scheduleRebindInputSchema = z.object({ workSpecId: idSchema });
export type ScheduleRebindInput = z.infer<typeof scheduleRebindInputSchema>;
export interface Schedule extends ScheduleInput {
  id: string;
  nextRunAt: string;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const vaultInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  rootPath: z.string().trim().min(1).max(2_000)
});
export type VaultInput = z.infer<typeof vaultInputSchema>;
export interface KnowledgeVault extends VaultInput { id: string; createdAt: string; updatedAt: string }
export interface KnowledgeDocument {
  id: string;
  vaultId: string;
  relativePath: string;
  title: string;
  contentHash: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  modifiedAt: string;
  indexedAt: string;
  deletedAt: string | null;
  snippet?: string;
}

export const knowledgeEntityTypeSchema = z.enum(["project", "work_spec", "run", "artifact"]);
export type KnowledgeEntityType = z.infer<typeof knowledgeEntityTypeSchema>;
export const knowledgeLinkSourceSchema = z.enum(["frontmatter", "generated", "manual"]);
export type KnowledgeLinkSource = z.infer<typeof knowledgeLinkSourceSchema>;
export const knowledgeLinkInputSchema = z.object({
  entityType: knowledgeEntityTypeSchema,
  entityId: idSchema,
  relation: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9_-]*$/).default("mentions")
});
export type KnowledgeLinkInput = z.infer<typeof knowledgeLinkInputSchema>;
export interface KnowledgeLink extends KnowledgeLinkInput {
  id: string;
  documentId: string;
  source: KnowledgeLinkSource;
  createdAt: string;
}
export interface KnowledgeDocumentDetail {
  document: KnowledgeDocument;
  vault: KnowledgeVault;
  links: KnowledgeLink[];
}
export const knowledgeDirectorySchema = z.enum(["Inbox", "Generated", "Reports"]);
export const knowledgeCreateInputSchema = z.object({
  vaultId: idSchema,
  directory: knowledgeDirectorySchema,
  subdirectory: z.string().trim().max(500).default("").superRefine((value, context) => {
    if (!value) return;
    if (value.startsWith("/") || value.endsWith("/") || value.includes("\\") || value.includes("\0") || value.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))) {
      context.addIssue({ code: "custom", message: "INVALID_KNOWLEDGE_SUBDIRECTORY" });
    }
  }),
  title: z.string().trim().min(1).max(200).refine((value) => !/[\\/:\0]/.test(value), "INVALID_KNOWLEDGE_TITLE"),
  body: z.string().max(100_000).default(""),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  links: z.array(knowledgeLinkInputSchema).max(50).default([])
});
export type KnowledgeCreateInput = z.input<typeof knowledgeCreateInputSchema>;
export interface KnowledgeIndexResult {
  indexed: number;
  unchanged: number;
  deleted: number;
  linked: number;
  invalidLinks: number;
}
export interface KnowledgeSearchFilters {
  tag?: string;
  entityType?: KnowledgeEntityType;
  entityId?: string;
}
export interface KnowledgeWatchHealth {
  watchedVaults: number;
  lastIndexedAt: string | null;
  lastError: string | null;
}

export const financeCurrencySchema = z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase());
export const financeMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const financeAmountMinorSchema = z.number().int().safe().positive();

export const financeAccountInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  accountType: z.enum(["cash", "bank", "credit_card", "receivable", "payable", "investment", "virtual"]),
  currency: financeCurrencySchema,
  initialBalanceMinor: z.number().int().safe().default(0),
  institution: z.string().trim().max(160).nullable().default(null)
});
export type FinanceAccountInput = z.infer<typeof financeAccountInputSchema>;
export interface FinanceAccount extends FinanceAccountInput {
  id: string;
  currentBalanceMinor: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const financeTransactionInputSchema = z.object({
  accountId: idSchema,
  transactionType: z.enum(["income", "expense"]),
  amountMinor: financeAmountMinorSchema,
  currency: financeCurrencySchema,
  occurredAt: isoDateSchema,
  categoryId: idSchema.nullable().default(null),
  category: z.string().trim().max(120).nullable().default(null),
  counterparty: z.string().trim().max(200).nullable().default(null),
  description: z.string().trim().max(2_000).default("")
});
export type FinanceTransactionInput = z.input<typeof financeTransactionInputSchema>;
export const financeTransactionTypeSchema = z.enum(["income", "expense", "refund", "transfer_out", "transfer_in", "adjustment"]);
export const financeReportingTypeSchema = z.enum(["income", "expense", "transfer", "adjustment"]);
export interface FinanceTransaction {
  id: string;
  accountId: string;
  transactionType: z.infer<typeof financeTransactionTypeSchema>;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  categoryId: string | null;
  category: string | null;
  counterparty: string | null;
  description: string;
  balanceEffectMinor: number;
  reportingType: z.infer<typeof financeReportingTypeSchema>;
  reportingEffectMinor: number;
  parentTransactionId: string | null;
  transferId: string | null;
  reversalOfTransactionId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const financeTransferInputSchema = z.object({
  fromAccountId: idSchema,
  toAccountId: idSchema,
  fromAmountMinor: financeAmountMinorSchema,
  toAmountMinor: financeAmountMinorSchema,
  occurredAt: isoDateSchema,
  rateNumerator: z.number().int().safe().positive().nullable().default(null),
  rateDenominator: z.number().int().safe().positive().nullable().default(null),
  description: z.string().trim().max(2_000).default("")
}).superRefine((value, context) => {
  if (value.fromAccountId === value.toAccountId) context.addIssue({ code: "custom", message: "TRANSFER_ACCOUNTS_MUST_DIFFER" });
  if ((value.rateNumerator === null) !== (value.rateDenominator === null)) context.addIssue({ code: "custom", message: "INCOMPLETE_EXCHANGE_RATE" });
});
export type FinanceTransferInput = z.infer<typeof financeTransferInputSchema>;
export interface FinanceTransferResult { transferId: string; outgoing: FinanceTransaction; incoming: FinanceTransaction }

export const financeRefundInputSchema = z.object({
  originalTransactionId: idSchema,
  amountMinor: financeAmountMinorSchema,
  occurredAt: isoDateSchema,
  description: z.string().trim().max(2_000).default("")
});
export type FinanceRefundInput = z.infer<typeof financeRefundInputSchema>;

export const financeCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["income", "expense", "both"]).default("both")
});
export type FinanceCategoryInput = z.infer<typeof financeCategoryInputSchema>;
export interface FinanceCategory extends FinanceCategoryInput { id: string; isActive: boolean; createdAt: string; updatedAt: string }

export const financeBudgetInputSchema = z.object({
  month: financeMonthSchema,
  currency: financeCurrencySchema,
  categoryId: idSchema,
  plannedMinor: z.number().int().safe().nonnegative()
});
export type FinanceBudgetInput = z.infer<typeof financeBudgetInputSchema>;
export interface FinanceBudget extends FinanceBudgetInput { id: string; createdAt: string; updatedAt: string }

export const financeChangeFieldsSchema = z.object({
  amountMinor: financeAmountMinorSchema.optional(),
  occurredAt: isoDateSchema.optional(),
  categoryId: idSchema.nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  counterparty: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2_000).optional()
}).strict();
export const financeChangeProposalInputSchema = z.object({
  targetTransactionId: idSchema,
  proposalType: z.enum(["update", "delete", "reverse"]),
  proposedChanges: financeChangeFieldsSchema.default({}),
  rationale: z.string().trim().min(1).max(4_000)
}).superRefine((value, context) => {
  if (value.proposalType === "update" && Object.keys(value.proposedChanges).length === 0) context.addIssue({ code: "custom", message: "UPDATE_REQUIRES_CHANGES" });
  if (value.proposalType !== "update" && Object.keys(value.proposedChanges).length > 0) context.addIssue({ code: "custom", message: "CHANGES_ONLY_ALLOWED_FOR_UPDATE" });
});
export type FinanceChangeProposalInput = z.infer<typeof financeChangeProposalInputSchema>;
export const financeChangeProposalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(4_000).default("")
});
export type FinanceChangeProposalDecision = z.infer<typeof financeChangeProposalDecisionSchema>;
export interface FinanceChangeProposal extends FinanceChangeProposalInput {
  id: string;
  requestedBy: "user" | "runtime";
  status: "pending" | "approved" | "rejected";
  resultTransactionIds: string[];
  resolvedAt: string | null;
  resolutionComment: string | null;
  createdAt: string;
}

export const operatingUnitInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  unitType: z.enum(["project", "radar", "product", "custom"]),
  referenceId: idSchema.nullable().default(null),
  currency: financeCurrencySchema
});
export type OperatingUnitInput = z.infer<typeof operatingUnitInputSchema>;
export interface OperatingUnit extends OperatingUnitInput { id: string; isActive: boolean; createdAt: string; updatedAt: string }

export const financeAllocationInputSchema = z.object({
  transactionId: idSchema,
  operatingUnitId: idSchema,
  amountMinor: financeAmountMinorSchema,
  idempotencyKey: z.string().trim().min(1).max(300)
});
export type FinanceAllocationInput = z.infer<typeof financeAllocationInputSchema>;
export interface FinanceAllocation extends FinanceAllocationInput { id: string; currency: string; createdAt: string; updatedAt: string }

export const operatingEntryInputSchema = z.discriminatedUnion("entryType", [
  z.object({ operatingUnitId: idSchema, entryType: z.literal("expected_income"), amountMinor: financeAmountMinorSchema, currency: financeCurrencySchema, minutes: z.null().default(null), description: z.string().trim().max(2_000).default(""), occurredAt: isoDateSchema }),
  z.object({ operatingUnitId: idSchema, entryType: z.literal("committed_cost"), amountMinor: financeAmountMinorSchema, currency: financeCurrencySchema, minutes: z.null().default(null), description: z.string().trim().max(2_000).default(""), occurredAt: isoDateSchema }),
  z.object({ operatingUnitId: idSchema, entryType: z.literal("time"), amountMinor: z.null().default(null), currency: z.null().default(null), minutes: z.number().int().safe().positive(), description: z.string().trim().max(2_000).default(""), occurredAt: isoDateSchema })
]);
export type OperatingEntryInput = z.infer<typeof operatingEntryInputSchema>;
export type OperatingEntry = OperatingEntryInput & { id: string; createdAt: string };
export interface OperatingUnitSummary {
  operatingUnitId: string;
  currency: string;
  actualIncomeMinor: number;
  actualExpenseMinor: number;
  expectedIncomeMinor: number;
  committedCostMinor: number;
  timeMinutes: number;
}

export const budgetVarianceInputSchema = z.object({ month: financeMonthSchema, currency: financeCurrencySchema });
export const cashflowForecastInputSchema = z.object({
  currency: financeCurrencySchema,
  openingBalanceMinor: z.number().int().safe(),
  months: z.array(z.object({ month: financeMonthSchema, expectedIncomeMinor: z.number().int().safe().nonnegative(), expectedExpenseMinor: z.number().int().safe().nonnegative() })).min(1).max(24)
});
export type CashflowForecastInput = z.infer<typeof cashflowForecastInputSchema>;
export const currencyConversionInputSchema = z.object({
  amountMinor: financeAmountMinorSchema,
  fromCurrency: financeCurrencySchema,
  toCurrency: financeCurrencySchema,
  rateNumerator: z.number().int().safe().positive(),
  rateDenominator: z.number().int().safe().positive()
});
export type CurrencyConversionInput = z.infer<typeof currencyConversionInputSchema>;
export interface FinanceCalculation {
  id: string;
  calculationType: "budget_variance" | "cashflow_forecast" | "currency_conversion";
  formulaVersion: string;
  inputSnapshot: unknown;
  assumptions: unknown;
  result: unknown;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  createdBy: "user" | "runtime" | "system";
  createdAt: string;
}
export interface MonthlyFinanceSummary {
  month: string;
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

export interface AuditLog {
  id: string;
  actorType: "user" | "runtime" | "scheduler" | "system" | "importer";
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  requestId: string | null;
  runId: string | null;
  createdAt: string;
}

export interface Artifact {
  id: string;
  runId: string | null;
  workSpecId: string | null;
  projectId: string | null;
  storageKind: "managed_file" | "git" | "obsidian" | "external" | "database";
  name: string;
  uri: string;
  mimeType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  createdAt: string;
}
export const artifactCandidateSchema = z.object({
  storageKind: z.enum(["managed_file", "git", "obsidian", "external", "database"]),
  name: z.string().trim().min(1).max(240),
  uri: z.string().trim().min(1).max(4_000),
  mimeType: z.string().trim().max(240).nullable().default(null)
});
export type ArtifactCandidate = z.infer<typeof artifactCandidateSchema>;

export const secretReferenceSchema = z.string().regex(/^secret:\/\/[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9_.-]*$/i);

export interface ApiEnvelope<T> { success: true; data: T; requestId: string }
export interface ApiErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
  requestId: string;
}
