import { EventEmitter } from "node:events";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { accessSync, constants, existsSync, linkSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, watch, writeFileSync, type FSWatcher } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { CronExpressionParser } from "cron-parser";
import {
  actualRunCostInputSchema,
  approvalDecisionInputSchema,
  approvalRequestTypeSchema,
  artifactCandidateSchema,
  budgetVarianceInputSchema,
  cashflowForecastInputSchema,
  currencyConversionInputSchema,
  financeAccountInputSchema,
  financeAllocationInputSchema,
  financeBudgetInputSchema,
  financeCategoryInputSchema,
  financeChangeProposalDecisionSchema,
  financeChangeProposalInputSchema,
  financeRefundInputSchema,
  financeTransferInputSchema,
  financeTransactionInputSchema,
  knowledgeCreateInputSchema,
  operatingEntryInputSchema,
  operatingUnitInputSchema,
  projectInputSchema,
  runInputResponseSchema,
  runEvaluationInputSchema,
  runReviewInputSchema,
  runtimeResultInputSchema,
  runtimeCheckpointInputSchema,
  skillDraftInputSchema,
  skillPublishInputSchema,
  scheduleInputSchema,
  scheduleRebindInputSchema,
  scheduleUpdateInputSchema,
  vaultInputSchema,
  workSpecInputSchema,
  workSpecRevisionInputSchema,
  type ActualRunCostInput,
  type Approval,
  type ApprovalDecisionInput,
  type AuditLog,
  type Artifact,
  type ArtifactCandidate,
  type CashflowForecastInput,
  type ControlPlaneSearchResult,
  type FinanceAccount,
  type FinanceAccountInput,
  type FinanceAllocation,
  type FinanceAllocationInput,
  type FinanceBudget,
  type FinanceBudgetInput,
  type FinanceCalculation,
  type FinanceCategory,
  type FinanceCategoryInput,
  type FinanceChangeProposal,
  type FinanceChangeProposalDecision,
  type FinanceChangeProposalInput,
  type FinanceRefundInput,
  type FinanceTransferInput,
  type FinanceTransferResult,
  type FinanceTransaction,
  type FinanceTransactionInput,
  type KnowledgeDocument,
  type KnowledgeDocumentDetail,
  type KnowledgeCreateInput,
  type KnowledgeIndexResult,
  type KnowledgeLink,
  type KnowledgeLinkInput,
  type KnowledgeLinkSource,
  type KnowledgeSearchFilters,
  type KnowledgeWatchHealth,
  type KnowledgeVault,
  type MonthlyFinanceSummary,
  type OperatingEntry,
  type OperatingEntryInput,
  type OperatingUnit,
  type OperatingUnitInput,
  type OperatingUnitSummary,
  type Project,
  type ProjectInput,
  type Run,
  type RunCheckpoint,
  type RunDeposition,
  type RunEvaluation,
  type RunEvaluationCheck,
  type RunEvent,
  type RunMode,
  type RunStatus,
  type Schedule,
  type ScheduleInput,
  type ScheduleRebindInput,
  type ScheduleUpdateInput,
  type RuntimeCapabilityScope,
  type RuntimeCheckpointInput,
  type SkillDraftInput,
  type SkillDraftValidation,
  type SkillCandidate,
  type SkillPublishInput,
  type SkillSnapshot,
  type VaultInput,
  type WorkSpec,
  type WorkSpecInput,
  type WorkSpecPreflight,
  type WorkSpecPreflightCheck,
  type WorkSpecRevisionInput,
  type RehearsalPromotionGate,
  type WorkflowOperationsSummary
} from "@personal-os/vnext-contracts";
import { assertRunTransition, calculateBudgetVariance, calculateCashflowForecast, canRetryRun, convertMinorUnits, isTerminalRunStatus, redactSensitiveText, redactSensitiveValue, safeAdd, scheduleFiringKey, transactionFacts } from "@personal-os/vnext-domain";

export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };
const REHEARSAL_EVALUATOR_VERSION = "rehearsal-gate-v1";
const ALL_RUNTIME_SCOPES: RuntimeCapabilityScope[] = [
  "context:read",
  "event:append",
  "checkpoint:write",
  "knowledge:search",
  "artifact:create",
  "approval:request",
  "approval:read",
  "result:submit"
];

function capabilityKey(token: string): string { return createHash("sha256").update(token).digest("hex"); }

export interface AuditInput {
  actorType: AuditLog["actorType"];
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  requestId?: string | null;
  runId?: string | null;
}

export interface NewRunEvent {
  eventType: string;
  level: RunEvent["level"];
  source: string;
  message: string;
  structuredData?: unknown;
  requestId?: string | null;
}

export interface KnowledgeUpsert {
  id: string;
  vaultId: string;
  relativePath: string;
  title: string;
  body: string;
  contentHash: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  modifiedAt: string;
  indexedAt: string;
}

export interface FinanceWriteSet {
  transactions: FinanceTransaction[];
  accountDeltas: Array<{ accountId: string; deltaMinor: number }>;
  deleteTransactionId?: string | null;
  mutationAt?: string;
}

export interface VNextStore {
  close(): void;
  listProjects(): Project[];
  getProject(id: string): Project | null;
  insertProject(project: Project): Project;
  listWorkSpecs(filters?: { projectId?: string; kind?: WorkSpec["kind"] }): WorkSpec[];
  getWorkSpec(id: string): WorkSpec | null;
  insertWorkSpec(workSpec: WorkSpec): WorkSpec;
  updateWorkSpec(workSpec: WorkSpec): WorkSpec;
  searchControlPlane(query: string, limit?: number): ControlPlaneSearchResult[];
  listRuns(limit?: number): Run[];
  getRun(id: string): Run | null;
  findRunByIdempotencyKey(key: string): Run | null;
  insertRun(run: Run): Run;
  updateRun(run: Run): Run;
  appendRunEvent(runId: string, event: NewRunEvent, createdAt: string): RunEvent;
  listRunEvents(runId: string, afterSequence?: number): RunEvent[];
  listRunCheckpoints(runId: string): RunCheckpoint[];
  getRunCheckpoint(runId: string, stepKey: string): RunCheckpoint | null;
  insertRunCheckpoint(checkpoint: RunCheckpoint): RunCheckpoint;
  updateRunCheckpoint(checkpoint: RunCheckpoint): RunCheckpoint;
  listRunDepositions(status?: RunDeposition["status"]): RunDeposition[];
  getRunDeposition(runId: string): RunDeposition | null;
  findSucceededRunDepositionByDeduplicationKey(key: string): RunDeposition | null;
  insertRunDeposition(deposition: RunDeposition): RunDeposition;
  updateRunDeposition(deposition: RunDeposition): RunDeposition;
  listRunEvaluations(workSpecId?: string): RunEvaluation[];
  getRunEvaluation(runId: string): RunEvaluation | null;
  insertRunEvaluation(evaluation: RunEvaluation): RunEvaluation;
  listSkillCandidates(workSpecId?: string): SkillCandidate[];
  getSkillCandidate(id: string): SkillCandidate | null;
  insertSkillCandidate(candidate: SkillCandidate): SkillCandidate;
  updateSkillCandidate(candidate: SkillCandidate): SkillCandidate;
  listSchedules(): Schedule[];
  getSchedule(id: string): Schedule | null;
  insertSchedule(schedule: Schedule): Schedule;
  updateSchedule(schedule: Schedule): Schedule;
  claimScheduleFiring(scheduleId: string, scheduledFor: string, key: string, createdAt: string): boolean;
  insertAudit(input: AuditInput, createdAt: string): AuditLog;
  listAudit(limit?: number): AuditLog[];
  listApprovals(status?: Approval["status"]): Approval[];
  getApproval(id: string): Approval | null;
  getPendingApprovalForRun(runId: string): Approval | null;
  insertApproval(approval: Approval): Approval;
  updateApproval(approval: Approval): Approval;
  listArtifacts(limit?: number): Artifact[];
  listArtifactsForRun(runId: string): Artifact[];
  getArtifact(id: string): Artifact | null;
  insertArtifact(artifact: Artifact): Artifact;
  listVaults(): KnowledgeVault[];
  getVault(id: string): KnowledgeVault | null;
  insertVault(vault: KnowledgeVault): KnowledgeVault;
  getKnowledgeDocument(id: string): KnowledgeDocument | null;
  getKnowledgeDocumentByPath(vaultId: string, relativePath: string): KnowledgeDocument | null;
  upsertKnowledgeDocument(document: KnowledgeUpsert): KnowledgeDocument;
  markMissingKnowledgeDocumentsDeleted(vaultId: string, presentPaths: string[], deletedAt: string): number;
  replaceKnowledgeLinks(documentId: string, source: KnowledgeLinkSource, links: KnowledgeLinkInput[], createdAt: string): KnowledgeLink[];
  listKnowledgeLinksForDocument(documentId: string): KnowledgeLink[];
  listKnowledgeLinksForEntity(entityType: KnowledgeLink["entityType"], entityId: string): KnowledgeLink[];
  searchKnowledge(query: string, limit?: number, filters?: KnowledgeSearchFilters): KnowledgeDocument[];
  listFinanceAccounts(): FinanceAccount[];
  getFinanceAccount(id: string): FinanceAccount | null;
  insertFinanceAccount(account: FinanceAccount): FinanceAccount;
  listFinanceTransactions(): FinanceTransaction[];
  getFinanceTransaction(id: string): FinanceTransaction | null;
  postFinanceTransaction(transaction: FinanceTransaction, balanceDeltaMinor: number): FinanceTransaction;
  postFinanceTransactionsAtomically(writeSet: FinanceWriteSet): FinanceTransaction[];
  softDeleteFinanceTransactionAndAdjustBalance(id: string, deletedAt: string): FinanceTransaction | null;
  getMonthlyFinanceSummary(month: string, currency: string): MonthlyFinanceSummary;
  listFinanceCategories(): FinanceCategory[];
  getFinanceCategory(id: string): FinanceCategory | null;
  insertFinanceCategory(category: FinanceCategory): FinanceCategory;
  listFinanceBudgets(month?: string, currency?: string): FinanceBudget[];
  getFinanceBudget(month: string, currency: string, categoryId: string): FinanceBudget | null;
  upsertFinanceBudget(budget: FinanceBudget): FinanceBudget;
  listFinanceCalculations(limit?: number): FinanceCalculation[];
  getFinanceCalculation(id: string): FinanceCalculation | null;
  insertFinanceCalculation(calculation: FinanceCalculation): FinanceCalculation;
  listOperatingUnits(): OperatingUnit[];
  getOperatingUnit(id: string): OperatingUnit | null;
  insertOperatingUnit(unit: OperatingUnit): OperatingUnit;
  listFinanceAllocations(operatingUnitId?: string): FinanceAllocation[];
  getFinanceAllocationByIdempotencyKey(key: string): FinanceAllocation | null;
  getFinanceAllocation(transactionId: string, operatingUnitId: string): FinanceAllocation | null;
  insertFinanceAllocation(allocation: FinanceAllocation): FinanceAllocation;
  listOperatingEntries(operatingUnitId?: string): OperatingEntry[];
  insertOperatingEntry(entry: OperatingEntry): OperatingEntry;
  listFinanceChangeProposals(status?: FinanceChangeProposal["status"]): FinanceChangeProposal[];
  getFinanceChangeProposal(id: string): FinanceChangeProposal | null;
  insertFinanceChangeProposal(proposal: FinanceChangeProposal): FinanceChangeProposal;
  resolveFinanceChangeProposal(proposal: FinanceChangeProposal, writeSet: FinanceWriteSet): FinanceChangeProposal;
}

export interface SkillRegistry {
  list(): SkillSnapshot[];
  get(name: string): SkillSnapshot | null;
  validateDraft(input: SkillDraftInput): SkillDraftValidation;
  publish(input: SkillPublishInput): SkillSnapshot;
}

export class RepositorySkillRegistry implements SkillRegistry {
  constructor(private readonly root: string) {}

  list(): SkillSnapshot[] {
    if (!existsSync(this.root)) return [];
    return readdirSync(this.root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => this.read(entry.name))
      .filter((item): item is SkillSnapshot => item !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  get(name: string): SkillSnapshot | null {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return null;
    return this.read(name);
  }

  validateDraft(input: SkillDraftInput): SkillDraftValidation {
    const parsed = skillDraftInputSchema.parse(input);
    const content = skillMarkdown(parsed);
    const absolute = resolve(this.root, parsed.name, "SKILL.md");
    const candidate: SkillSnapshot = {
      name: parsed.name,
      version: parsed.version,
      contentHash: createHash("sha256").update(content).digest("hex"),
      path: relative(process.cwd(), absolute).split(sep).join("/"),
      content
    };
    const current = this.get(parsed.name);
    const issues: SkillDraftValidation["issues"] = [];
    if (current && parsed.expectedCurrentHash !== current.contentHash) issues.push({ level: "error", code: "SKILL_CONCURRENT_UPDATE", message: "这个 Skill 已被其他操作更新，请重新载入后再发布。" });
    if (!current && parsed.expectedCurrentHash !== null) issues.push({ level: "error", code: "SKILL_CURRENT_VERSION_MISSING", message: "仓库中还没有这个 Skill，不能按旧 Hash 更新。" });
    if (current && compareSemver(parsed.version, current.version) <= 0) issues.push({ level: "error", code: "SKILL_VERSION_MUST_INCREASE", message: `新版本必须高于当前 ${current.version}。` });
    if (containsLikelySecret(`${parsed.description}\n${parsed.instructions}`)) issues.push({ level: "error", code: "SKILL_SECRET_DETECTED", message: "内容中像是包含 Token、密码或私钥，请改成 Secret 引用或删除真实值。" });
    if (!/^#\s+.+/m.test(parsed.instructions)) issues.push({ level: "warning", code: "SKILL_HEADING_RECOMMENDED", message: "建议用一个一级标题说明 Skill 的用途。" });
    return { valid: !issues.some((issue) => issue.level === "error"), candidate, current, issues };
  }

  publish(input: SkillPublishInput): SkillSnapshot {
    const parsed = skillPublishInputSchema.parse(input);
    const validation = this.validateDraft(parsed);
    if (!validation.valid) throw new Error(validation.issues.find((issue) => issue.level === "error")?.code ?? "SKILL_DRAFT_INVALID");
    if (validation.candidate.contentHash !== parsed.validatedContentHash) throw new Error("SKILL_DRAFT_CHANGED_AFTER_VALIDATION");
    const root = resolve(this.root);
    const directory = resolve(root, parsed.name);
    const agentsDirectory = resolve(directory, "agents");
    if (!isPathInside(root, directory)) throw new Error("SKILL_PATH_NOT_ALLOWED");
    if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) throw new Error("SKILL_SYMLINK_NOT_ALLOWED");
    mkdirSync(agentsDirectory, { recursive: true });
    if (lstatSync(directory).isSymbolicLink() || lstatSync(agentsDirectory).isSymbolicLink()) throw new Error("SKILL_SYMLINK_NOT_ALLOWED");
    const marker = randomUUID();
    const skillTemp = resolve(directory, `.SKILL.md.${marker}.tmp`);
    const agentTemp = resolve(agentsDirectory, `.openai.yaml.${marker}.tmp`);
    const skillTarget = resolve(directory, "SKILL.md");
    const agentTarget = resolve(agentsDirectory, "openai.yaml");
    try {
      writeFileSync(skillTemp, validation.candidate.content, { encoding: "utf8", mode: 0o600, flag: "wx" });
      writeFileSync(agentTemp, skillAgentYaml(parsed), { encoding: "utf8", mode: 0o600, flag: "wx" });
      renameSync(agentTemp, agentTarget);
      renameSync(skillTemp, skillTarget);
    } finally {
      rmSync(skillTemp, { force: true });
      rmSync(agentTemp, { force: true });
    }
    const published = this.get(parsed.name);
    if (!published || published.contentHash !== validation.candidate.contentHash) throw new Error("SKILL_PUBLISH_VERIFY_FAILED");
    return published;
  }

  private read(name: string): SkillSnapshot | null {
    const root = resolve(this.root);
    const directory = resolve(root, name);
    const absolute = resolve(directory, "SKILL.md");
    if (!isPathInside(root, absolute) || !existsSync(directory) || lstatSync(directory).isSymbolicLink() || !existsSync(absolute) || lstatSync(absolute).isSymbolicLink() || !statSync(absolute).isFile()) return null;
    const content = readFileSync(absolute, "utf8");
    if (content.length > 200_000) throw new Error(`SKILL_CONTENT_TOO_LARGE:${name}`);
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(content)?.[1] ?? "";
    const declaredName = /^name:\s*["']?([^\n"']+)["']?\s*$/m.exec(frontmatter)?.[1]?.trim();
    if (declaredName !== name) throw new Error(`SKILL_NAME_MISMATCH:${name}`);
    const version = /^\s+version:\s*["']?([^\n"']+)["']?\s*$/m.exec(frontmatter)?.[1]?.trim() ?? "1.0.0";
    return {
      name,
      version,
      contentHash: createHash("sha256").update(content).digest("hex"),
      path: relative(process.cwd(), absolute).split(sep).join("/"),
      content
    };
  }
}

function skillMarkdown(input: SkillDraftInput): string {
  return `---\nname: ${input.name}\ndescription: ${JSON.stringify(input.description)}\nmetadata:\n  version: "${input.version}"\n---\n\n${input.instructions.trim()}\n`;
}

function skillAgentYaml(input: SkillDraftInput): string {
  const quote = (value: string) => JSON.stringify(value.replace(/[\r\n]+/g, " "));
  return `interface:\n  display_name: ${quote(input.displayName)}\n  short_description: ${quote(input.description.slice(0, 120))}\n  default_prompt: ${quote(`Use $${input.name} to complete this governed Personal OS run.`)}\n`;
}

function compareSemver(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function containsLikelySecret(value: string): boolean {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{16,}\b|\bBearer\s+[A-Za-z0-9._~-]{16,}|(?:api[_ -]?key|token|secret|password|密码|密钥)\s*[:=：]\s*["']?[A-Za-z0-9+/_=-]{12,}/iu.test(value);
}

export interface RuntimeCapabilityGrant {
  runId: string;
  executorType: WorkSpec["executorType"];
  scopes: RuntimeCapabilityScope[];
  issuedAt: string;
  expiresAt: string;
}

export interface RuntimeExecutionCapability extends RuntimeCapabilityGrant { token: string }

export class RuntimeCapabilityAuthority {
  private readonly grants = new Map<string, RuntimeCapabilityGrant>();
  private readonly runKeys = new Map<string, Set<string>>();

  constructor(private readonly clock: Clock = systemClock) {}

  issue(runId: string, executorType: WorkSpec["executorType"], scopes: RuntimeCapabilityScope[], ttlSeconds: number): RuntimeExecutionCapability {
    this.revokeRun(runId);
    const token = randomBytes(32).toString("base64url");
    const key = capabilityKey(token);
    const issued = this.clock.now();
    const grant: RuntimeCapabilityGrant = {
      runId,
      executorType,
      scopes: [...new Set(scopes)],
      issuedAt: issued.toISOString(),
      expiresAt: new Date(issued.getTime() + Math.max(1, Math.min(86_400, ttlSeconds)) * 1_000).toISOString()
    };
    this.grants.set(key, grant);
    this.runKeys.set(runId, new Set([key]));
    return { token, ...grant };
  }

  authorize(token: string, scope: RuntimeCapabilityScope): RuntimeCapabilityGrant {
    if (!token || token.length > 200) throw new Error("RUNTIME_CAPABILITY_REQUIRED");
    const key = capabilityKey(token);
    const grant = this.grants.get(key);
    if (!grant) throw new Error("RUNTIME_CAPABILITY_INVALID");
    if (new Date(grant.expiresAt).getTime() <= this.clock.now().getTime()) {
      this.revokeKey(key, grant.runId);
      throw new Error("RUNTIME_CAPABILITY_EXPIRED");
    }
    if (!grant.scopes.includes(scope)) throw new Error("RUNTIME_CAPABILITY_SCOPE_DENIED");
    return grant;
  }

  revokeRun(runId: string): void {
    for (const key of this.runKeys.get(runId) ?? []) this.grants.delete(key);
    this.runKeys.delete(runId);
  }

  activeCount(): number { return this.grants.size; }

  private revokeKey(key: string, runId: string): void {
    this.grants.delete(key);
    const keys = this.runKeys.get(runId);
    keys?.delete(key);
    if (keys?.size === 0) this.runKeys.delete(runId);
  }
}

export interface ExecutionContext {
  run: Run;
  workSpec: WorkSpec;
  project: Project | null;
  resume: ResumeDirective | null;
  signal: AbortSignal;
  emit(event: NewRunEvent): void;
  capability?: RuntimeExecutionCapability;
}
export interface ExecutionResult {
  status: "succeeded" | "partially_succeeded" | "waiting_input" | "waiting_approval";
  result: unknown;
  externalRunId?: string | null;
  usage?: unknown;
  artifacts?: ArtifactCandidate[];
}
export type ResumeDirective =
  | { kind: "input"; answer: string; request: unknown }
  | { kind: "approval"; decision: "approved" | "rejected" | "expired"; requestType: Approval["requestType"]; request: unknown; comment: string };
export interface ExecutorHealth { available: boolean; detail: string }
export interface ExecutorAdapter {
  readonly type: WorkSpec["executorType"];
  validate(context: ExecutionContext): void | Promise<void>;
  execute(context: ExecutionContext): Promise<ExecutionResult>;
  health(): ExecutorHealth | Promise<ExecutorHealth>;
}

export interface RunCompletionObserver {
  onRunCompleted(run: Run, requestId?: string): void;
}

export interface CreateRunOptions {
  input?: unknown;
  idempotencyKey?: string;
  retryOfRunId?: string;
  attempt?: number;
  runMode?: RunMode;
  rehearsalRootRunId?: string;
  requestId?: string;
}

export class PersonalOsService {
  private readonly emitter = new EventEmitter();
  private readonly controllers = new Map<string, AbortController>();
  private readonly executors = new Map<WorkSpec["executorType"], ExecutorAdapter>();
  private completionObserver: RunCompletionObserver | null = null;

  constructor(
    private readonly store: VNextStore,
    adapters: ExecutorAdapter[],
    private readonly clock: Clock = systemClock,
    private readonly capabilities = new RuntimeCapabilityAuthority(clock),
    private readonly skills?: SkillRegistry
  ) {
    for (const adapter of adapters) this.executors.set(adapter.type, adapter);
    this.emitter.setMaxListeners(100);
  }

  setRunCompletionObserver(observer: RunCompletionObserver | null): void {
    this.completionObserver = observer;
  }

  createProject(input: ProjectInput, requestId?: string): Project {
    const parsed = projectInputSchema.parse(input);
    const now = this.clock.now().toISOString();
    const project = this.store.insertProject({ id: randomUUID(), ...parsed, description: redactSensitiveText(parsed.description), createdAt: now, updatedAt: now });
    this.audit("project.created", "project", project.id, project, requestId);
    return project;
  }

  createWorkSpec(input: WorkSpecInput, requestId?: string): WorkSpec {
    const parsed = workSpecInputSchema.parse(input);
    return this.persistWorkSpec(parsed, null, 1, requestId);
  }

  createWorkSpecRevision(sourceId: string, input: WorkSpecRevisionInput, requestId?: string): WorkSpec {
    const source = this.requireWorkSpec(sourceId);
    if (source.kind !== "workflow") throw new Error("WORK_SPEC_REVISION_REQUIRES_WORKFLOW");
    if (source.lifecycleStatus === "retired") throw new Error("WORK_SPEC_RETIRED");
    const parsed = workSpecRevisionInputSchema.parse(input);
    const rootId = this.revisionRootId(source);
    const nextRevision = Math.max(...this.store.listWorkSpecs({ kind: "workflow" }).filter((item) => this.revisionRootId(item) === rootId).map((item) => item.revisionNumber), source.revisionNumber) + 1;
    const revision = this.persistWorkSpec({ ...parsed, kind: "workflow" }, source.id, nextRevision, requestId);
    this.audit("work_spec.revised", "work_spec", revision.id, { sourceWorkSpecId: source.id, revision }, requestId, undefined, source);
    return revision;
  }

  validateSkillDraft(input: SkillDraftInput): SkillDraftValidation {
    if (!this.skills) throw new Error("SKILL_REGISTRY_UNAVAILABLE");
    return this.skills.validateDraft(skillDraftInputSchema.parse(input));
  }

  publishSkill(input: SkillPublishInput, requestId?: string): SkillSnapshot {
    if (!this.skills) throw new Error("SKILL_REGISTRY_UNAVAILABLE");
    const parsed = skillPublishInputSchema.parse(input);
    const before = this.skills.get(parsed.name);
    const published = this.skills.publish(parsed);
    const safeSnapshot = (snapshot: SkillSnapshot | null) => snapshot ? { name: snapshot.name, version: snapshot.version, contentHash: snapshot.contentHash, path: snapshot.path } : null;
    this.audit("skill.published", "skill", published.name, safeSnapshot(published), requestId, undefined, safeSnapshot(before));
    return published;
  }

  async preflightWorkSpec(id: string): Promise<WorkSpecPreflight> {
    const workSpec = this.requireWorkSpec(id);
    const checks: WorkSpecPreflightCheck[] = [];
    checks.push({ code: "lifecycle", label: "启用状态", status: workSpec.lifecycleStatus === "active" ? "pass" : "fail", detail: workSpec.lifecycleStatus === "active" ? "工作流可以创建新运行。" : `当前状态是 ${workSpec.lifecycleStatus}。` });
    const adapter = this.executors.get(workSpec.executorType);
    if (!adapter) checks.push({ code: "executor", label: "Runtime", status: "fail", detail: `执行器 ${workSpec.executorType} 没有配置。` });
    else {
      const health = await adapter.health();
      checks.push({ code: "executor", label: "Runtime", status: health.available ? "pass" : "fail", detail: health.detail });
    }
    const project = workSpec.projectId ? this.store.getProject(workSpec.projectId) : null;
    if (workSpec.executorType === "codex") {
      const repository = project?.repositoryPath ? resolve(project.repositoryPath) : null;
      const validRepository = Boolean(repository && existsSync(repository) && statSync(repository).isDirectory() && existsSync(resolve(repository!, ".git")));
      checks.push({ code: "codex-repository", label: "Git 项目", status: validRepository ? "pass" : "fail", detail: validRepository ? repository! : "Codex 必须绑定一个存在的本地 Git 仓库。" });
    } else {
      checks.push({ code: "project", label: "所属项目", status: project ? "pass" : "warning", detail: project ? project.name : "未绑定项目；运行仍可执行，但成果不会进入项目聚合。" });
    }
    const agentRuntime = workSpec.executorType === "codex" || workSpec.executorType === "openworker";
    if (!workSpec.skill) checks.push({ code: "skill", label: "固定 Skill", status: agentRuntime ? "fail" : "warning", detail: agentRuntime ? "Agent 工作流必须绑定固定 Skill。" : "这个 Runtime 没有绑定 Skill。" });
    else {
      const validHash = createHash("sha256").update(workSpec.skill.content).digest("hex") === workSpec.skill.contentHash;
      checks.push({ code: "skill", label: "固定 Skill", status: validHash ? "pass" : "fail", detail: validHash ? `${workSpec.skill.name}@${workSpec.skill.version} 快照完整。` : "Skill 内容与保存的 Hash 不一致。" });
      const current = this.skills?.get(workSpec.skill.name) ?? null;
      if (current && current.contentHash !== workSpec.skill.contentHash) checks.push({ code: "skill-version", label: "Skill 新版本", status: "warning", detail: `仓库已有 ${current.version}；当前工作流仍固定使用 ${workSpec.skill.version}。` });
    }
    const bound = this.store.listSchedules().filter((schedule) => schedule.workSpecId === workSpec.id);
    checks.push({ code: "schedule", label: "定时规则", status: bound.some((schedule) => schedule.enabled) ? "pass" : "warning", detail: bound.length ? `${bound.filter((schedule) => schedule.enabled).length}/${bound.length} 条已启用。` : "尚未设置定时；仍可手动运行。" });
    checks.push({ code: "retry", label: "失败恢复", status: workSpec.maxAttempts > 1 ? "pass" : "warning", detail: `最多尝试 ${workSpec.maxAttempts} 次，单次超时 ${workSpec.timeoutSeconds} 秒。` });
    if (workSpec.resultDeposition) {
      const vault = this.store.getVault(workSpec.resultDeposition.vaultId);
      const targetDirectory = vault ? resolve(vault.rootPath, workSpec.resultDeposition.directory, workSpec.resultDeposition.subdirectory) : null;
      let targetSafe = false;
      try {
        if (vault && targetDirectory && isPathInside(resolve(vault.rootPath), targetDirectory)) {
          assertNoSymlinkSegments(resolve(vault.rootPath), targetDirectory);
          targetSafe = true;
        }
      } catch { targetSafe = false; }
      const available = Boolean(vault && isWritableRealDirectory(vault.rootPath) && targetSafe);
      const destination = [workSpec.resultDeposition.directory, workSpec.resultDeposition.subdirectory].filter(Boolean).join("/");
      const timing = workSpec.resultDeposition.trigger === "on_success" ? "成功后自动写入" : "验收后写入";
      checks.push({ code: "deposition", label: "Obsidian 沉淀", status: available ? "pass" : "fail", detail: available ? `${timing} ${vault!.name}/${destination}。` : "沉淀策略引用的 Vault 不存在或当前不可写。" });
    } else {
      checks.push({ code: "deposition", label: "Obsidian 沉淀", status: "warning", detail: "未配置自动沉淀；结果仍会保留在运行记录中。" });
    }
    return { workSpecId: workSpec.id, ready: !checks.some((check) => check.status === "fail"), checkedAt: this.clock.now().toISOString(), checks };
  }

  listWorkflowOperations(): WorkflowOperationsSummary[] {
    const schedules = this.store.listSchedules();
    const runs = this.store.listRuns(10_000);
    return this.store.listWorkSpecs({ kind: "workflow" }).filter((workSpec) => workSpec.lifecycleStatus !== "retired").map((workSpec) => {
      const ownSchedules = schedules.filter((schedule) => schedule.workSpecId === workSpec.id);
      const enabledSchedules = ownSchedules.filter((schedule) => schedule.enabled);
      const ownRuns = runs.filter((run) => run.workSpecId === workSpec.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const latestRun = ownRuns[0] ?? null;
      let consecutiveFailures = 0;
      for (const run of ownRuns) {
        if (run.status !== "failed") break;
        consecutiveFailures += 1;
      }
      let health: WorkflowOperationsSummary["health"] = "never_run";
      if (workSpec.lifecycleStatus === "paused" || (ownSchedules.length > 0 && enabledSchedules.length === 0)) health = "paused";
      else if (latestRun && ["running", "queued", "waiting_input", "waiting_approval"].includes(latestRun.status)) health = "attention";
      else if (consecutiveFailures > 0) health = "degraded";
      else if (latestRun?.status === "succeeded" || latestRun?.status === "partially_succeeded") health = "healthy";
      return {
        workSpec,
        health,
        scheduleCount: ownSchedules.length,
        enabledScheduleCount: enabledSchedules.length,
        nextRunAt: enabledSchedules.map((schedule) => schedule.nextRunAt).sort()[0] ?? null,
        latestRun,
        consecutiveFailures
      };
    });
  }

  private persistWorkSpec(parsed: ReturnType<typeof workSpecInputSchema.parse>, revisionOfWorkSpecId: string | null, revisionNumber: number, requestId?: string): WorkSpec {
    if (parsed.projectId && !this.store.getProject(parsed.projectId)) throw new Error("PROJECT_NOT_FOUND");
    if (parsed.resultDeposition && !this.store.getVault(parsed.resultDeposition.vaultId)) throw new Error("VAULT_NOT_FOUND");
    if (parsed.resultDeposition && redactSensitiveText(parsed.resultDeposition.titleTemplate) !== parsed.resultDeposition.titleTemplate) throw new Error("RESULT_DEPOSITION_SECRET_DETECTED");
    if (parsed.resultDeposition && !isValidTimezone(parsed.resultDeposition.timezone)) throw new Error("INVALID_DEPOSITION_TIMEZONE");
    if (parsed.reviewPolicy === "not_required") {
      if (parsed.kind !== "workflow") throw new Error("AUTO_DEPOSITION_REQUIRES_WORKFLOW");
      if (parsed.executorType !== "codex" && parsed.executorType !== "openworker") throw new Error("AUTO_DEPOSITION_REQUIRES_AGENT_RUNTIME");
      if (!parsed.skill) throw new Error("AUTO_DEPOSITION_REQUIRES_PINNED_SKILL");
      if (parsed.resultDeposition?.trigger !== "on_success") throw new Error("AUTO_DEPOSITION_POLICY_REQUIRED");
    }
    if (parsed.resultDeposition?.trigger === "on_success" && parsed.reviewPolicy !== "not_required") throw new Error("AUTO_DEPOSITION_REVIEW_POLICY_MISMATCH");
    if (parsed.resultDeposition?.trigger === "on_acceptance" && parsed.reviewPolicy !== "required") throw new Error("ACCEPTANCE_DEPOSITION_REVIEW_POLICY_MISMATCH");
    let skill = parsed.skill;
    if (skill) {
      if (!this.skills) throw new Error("SKILL_REGISTRY_UNAVAILABLE");
      const canonical = this.skills.get(skill.name);
      if (!canonical) throw new Error("SKILL_NOT_FOUND");
      if (canonical.version !== skill.version || canonical.contentHash !== skill.contentHash || canonical.path !== skill.path || canonical.content !== skill.content) throw new Error("SKILL_SNAPSHOT_MISMATCH");
      skill = canonical;
    }
    const now = this.clock.now().toISOString();
    const workSpec = this.store.insertWorkSpec({
      id: randomUUID(),
      ...parsed,
      instructions: redactSensitiveText(parsed.instructions),
      input: redactSensitiveValue(parsed.input),
      skill,
      revisionOfWorkSpecId,
      revisionNumber,
      createdAt: now,
      updatedAt: now
    });
    this.audit("work_spec.created", "work_spec", workSpec.id, workSpec, requestId);
    return workSpec;
  }

  private revisionRootId(workSpec: WorkSpec): string {
    let current = workSpec;
    const visited = new Set<string>();
    while (current.revisionOfWorkSpecId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = this.store.getWorkSpec(current.revisionOfWorkSpecId);
      if (!parent) break;
      current = parent;
    }
    return current.id;
  }

  retireWorkSpec(id: string, requestId?: string): WorkSpec {
    const current = this.requireWorkSpec(id);
    if (current.lifecycleStatus === "retired") return current;
    const hasEnabledSchedule = this.store.listSchedules().some((schedule) => schedule.workSpecId === id && schedule.enabled);
    if (hasEnabledSchedule) throw new Error("WORK_SPEC_HAS_ACTIVE_SCHEDULE");
    const updated = this.store.updateWorkSpec({ ...current, lifecycleStatus: "retired", updatedAt: this.clock.now().toISOString() });
    this.audit("work_spec.retired", "work_spec", id, updated, requestId, undefined, current);
    return updated;
  }

  searchControlPlane(query: string, limit = 30): ControlPlaneSearchResult[] {
    const normalized = query.trim();
    if (!normalized) return [];
    return this.store.searchControlPlane(normalized.slice(0, 200), Math.max(1, Math.min(100, Math.floor(limit))));
  }

  createRun(workSpecId: string, options: CreateRunOptions = {}): Run {
    const workSpec = this.requireWorkSpec(workSpecId);
    if (workSpec.lifecycleStatus !== "active") throw new Error("WORK_SPEC_NOT_ACTIVE");
    if (options.idempotencyKey) {
      const existing = this.store.findRunByIdempotencyKey(options.idempotencyKey);
      if (existing) return existing;
    }
    const id = randomUUID();
    const runMode = options.runMode ?? "production";
    const rehearsalRootRunId = runMode === "production" ? null : options.rehearsalRootRunId ?? id;
    if (options.rehearsalRootRunId) {
      const root = this.store.getRun(options.rehearsalRootRunId);
      if (!root || root.workSpecId !== workSpecId || root.runMode !== runMode) throw new Error("REHEARSAL_ROOT_MISMATCH");
    }
    const run: Run = {
      id,
      workSpecId,
      projectId: workSpec.projectId,
      executorType: workSpec.executorType,
      status: "queued",
      input: redactSensitiveValue(options.input ?? workSpec.input),
      attempt: options.attempt ?? 1,
      idempotencyKey: options.idempotencyKey ?? null,
      retryOfRunId: options.retryOfRunId ?? null,
      runMode,
      rehearsalRootRunId,
      externalRunId: null,
      errorCode: null,
      errorMessage: null,
      result: null,
      usage: null,
      actualCostMinor: null,
      actualCostCurrency: null,
      costSource: null,
      reviewStatus: "not_required",
      reviewedAt: null,
      reviewComment: null,
      createdAt: this.clock.now().toISOString(),
      startedAt: null,
      finishedAt: null
    };
    this.store.insertRun(run);
    this.publish(run.id, { eventType: "run.queued", level: "info", source: "application", message: "运行已进入队列。", structuredData: { workSpecId, runMode, rehearsalRootRunId }, requestId: options.requestId });
    this.audit("run.created", "run", run.id, run, options.requestId, run.id);
    return run;
  }

  async startRun(runId: string, requestId?: string): Promise<Run> {
    let run = this.requireRun(runId);
    if (run.status !== "queued") throw new Error(`RUN_NOT_QUEUED:${run.status}`);
    if (run.runMode === "failure_drill") throw new Error("FAILURE_DRILL_USES_DETERMINISTIC_RUNNER");
    if (!this.executors.has(run.executorType)) {
      const failed = this.failRun(run, "EXECUTOR_UNAVAILABLE", `执行器 ${run.executorType} 尚未配置。`, requestId);
      this.maybeAutoRetryScheduled(failed, "EXECUTOR_UNAVAILABLE", failed.errorMessage ?? "", requestId);
      return failed;
    }
    run = this.transition(run, "running", { startedAt: this.clock.now().toISOString() }, requestId);
    return await this.executeRunningRun(run, null, requestId);
  }

  runFailureDrill(workSpecId: string, requestId?: string): Run {
    const created = this.createRun(workSpecId, { runMode: "failure_drill", input: { phase12: { expectedInvalidResult: true } }, requestId });
    const running = this.transition(created, "running", { startedAt: this.clock.now().toISOString() }, requestId);
    const invalidFixture = { summary: "", data: {}, verification: [] };
    const rejected = !runtimeResultInputSchema.safeParse(invalidFixture).success;
    const withEvidence = this.store.updateRun({
      ...running,
      result: { failureDrill: { evaluatorVersion: REHEARSAL_EVALUATOR_VERSION, invalidFixture, rejected } }
    });
    if (!rejected) return this.transition(withEvidence, "succeeded", { finishedAt: this.clock.now().toISOString(), reviewStatus: "not_required" }, requestId);
    return this.failRun(withEvidence, "EXPECTED_VALIDATION_REJECTION", "故意构造的无效结果已被当前结构校验器拒绝。", requestId);
  }

  submitRunInput(runId: string, input: unknown, requestId?: string): Run {
    const parsed = runInputResponseSchema.parse(input);
    const run = this.requireRun(runId);
    if (run.status !== "waiting_input") throw new Error(`RUN_NOT_WAITING_INPUT:${run.status}`);
    this.assertResumableRuntime(run);
    return this.beginResume(run, {
      kind: "input",
      answer: redactSensitiveText(parsed.answer),
      request: redactSensitiveValue(requestFromResult(run.result))
    }, requestId);
  }

  resolveApproval(id: string, input: ApprovalDecisionInput, requestId?: string): Approval {
    const parsed = approvalDecisionInputSchema.parse(input);
    const current = this.store.getApproval(id);
    if (!current) throw new Error("APPROVAL_NOT_FOUND");
    if (current.status !== "pending") throw new Error("APPROVAL_ALREADY_RESOLVED");
    const now = this.clock.now();
    if (current.expiresAt && new Date(current.expiresAt).getTime() <= now.getTime()) {
      this.expireApproval(current, requestId);
      throw new Error("APPROVAL_EXPIRED");
    }
    const run = this.requireRun(current.runId);
    if (run.status !== "waiting_approval") throw new Error(`RUN_NOT_WAITING_APPROVAL:${run.status}`);
    this.assertResumableRuntime(run);
    const updated = this.store.updateApproval({
      ...current,
      status: parsed.decision,
      resolvedAt: now.toISOString(),
      resolutionComment: redactSensitiveText(parsed.comment)
    });
    this.audit(`approval.${updated.status}`, "approval", updated.id, updated, requestId, updated.runId, current);
    this.beginResume(run, {
      kind: "approval",
      decision: parsed.decision,
      requestType: updated.requestType,
      request: updated.payload,
      comment: updated.resolutionComment ?? ""
    }, requestId);
    return updated;
  }

  expireApprovals(): number {
    const now = this.clock.now();
    let count = 0;
    for (const approval of this.store.listApprovals("pending")) {
      if (!approval.expiresAt || new Date(approval.expiresAt).getTime() > now.getTime()) continue;
      this.expireApproval(approval);
      count += 1;
    }
    return count;
  }

  acceptRun(runId: string, input: unknown, requestId?: string): Run {
    return this.reviewRun(runId, "accepted", input, requestId);
  }

  rejectRun(runId: string, input: unknown, requestId?: string): Run {
    return this.reviewRun(runId, "rejected", input, requestId);
  }

  recordActualCost(runId: string, input: ActualRunCostInput, requestId?: string): Run {
    const parsed = actualRunCostInputSchema.parse(input);
    const current = this.requireRun(runId);
    if (!isTerminalRunStatus(current.status)) throw new Error("RUN_COST_REQUIRES_TERMINAL_RUN");
    if (current.actualCostMinor !== null) {
      if (current.actualCostMinor === parsed.amountMinor && current.actualCostCurrency === parsed.currency && current.costSource === parsed.source) return current;
      throw new Error("RUN_COST_ALREADY_RECORDED");
    }
    const updated = this.store.updateRun({ ...current, actualCostMinor: parsed.amountMinor, actualCostCurrency: parsed.currency, costSource: parsed.source });
    this.publish(runId, { eventType: "run.cost_recorded", level: "info", source: "application", message: "已记录可信来源的实际成本。", structuredData: parsed, requestId });
    this.audit("run.cost_recorded", "run", runId, updated, requestId, runId, current);
    return updated;
  }

  cancelRun(runId: string, requestId?: string): Run {
    const run = this.requireRun(runId);
    if (isTerminalRunStatus(run.status)) return run;
    const cancelled = this.transition(run, "cancelled", { finishedAt: this.clock.now().toISOString(), errorCode: "CANCELLED", errorMessage: "用户取消了运行。", reviewStatus: "not_required" }, requestId);
    const approval = this.store.getPendingApprovalForRun(runId);
    if (approval) {
      const rejected = this.store.updateApproval({ ...approval, status: "rejected", resolvedAt: this.clock.now().toISOString(), resolutionComment: "运行已取消。" });
      this.audit("approval.rejected", "approval", rejected.id, rejected, requestId, runId, approval);
    }
    this.controllers.get(runId)?.abort(new Error("CANCELLED"));
    this.capabilities.revokeRun(runId);
    return cancelled;
  }

  getCapabilityAuthority(): RuntimeCapabilityAuthority { return this.capabilities; }

  getRuntimeContext(grant: RuntimeCapabilityGrant): unknown {
    const run = this.requireActiveRuntimeRun(grant.runId);
    const workSpec = this.requireWorkSpec(run.workSpecId);
    const project = run.projectId ? this.store.getProject(run.projectId) : null;
    return {
      run: { id: run.id, status: run.status, attempt: run.attempt, runMode: run.runMode, rehearsalRootRunId: run.rehearsalRootRunId, executorType: run.executorType, input: run.input, createdAt: run.createdAt, startedAt: run.startedAt },
      workSpec: { id: workSpec.id, kind: workSpec.kind, title: workSpec.title, instructions: workSpec.instructions, skill: workSpec.skill ? { name: workSpec.skill.name, version: workSpec.skill.version, contentHash: workSpec.skill.contentHash, path: workSpec.skill.path } : null },
      project: project ? { id: project.id, name: project.name, repositoryPath: project.repositoryPath, obsidianPath: project.obsidianPath } : null,
      recentEvents: this.store.listRunEvents(run.id).slice(-20),
      checkpoints: this.store.listRunCheckpoints(run.id),
      artifacts: this.store.listArtifactsForRun(run.id),
      approval: this.store.getPendingApprovalForRun(run.id)
    };
  }

  appendRuntimeEvent(grant: RuntimeCapabilityGrant, input: NewRunEvent, requestId?: string): RunEvent {
    this.requireActiveRuntimeRun(grant.runId);
    const event = this.publish(grant.runId, { ...input, source: `runtime:${grant.executorType}`, requestId });
    this.auditRuntime("runtime.event_appended", "run_event", event.id, event, requestId, grant.runId);
    return event;
  }

  saveRuntimeCheckpoint(grant: RuntimeCapabilityGrant, input: RuntimeCheckpointInput, requestId?: string): RunCheckpoint {
    const run = this.requireActiveRuntimeRun(grant.runId);
    const parsed = runtimeCheckpointInputSchema.parse(input);
    const safe = {
      ...parsed,
      label: redactSensitiveText(parsed.label),
      summary: redactSensitiveText(parsed.summary),
      data: redactSensitiveValue(parsed.data)
    };
    const existing = this.store.getRunCheckpoint(run.id, parsed.stepKey);
    if (existing && (existing.status === "completed" || existing.status === "reused")) {
      const same = existing.status === safe.status && existing.label === safe.label && existing.summary === safe.summary && JSON.stringify(existing.data) === JSON.stringify(safe.data);
      if (same) return existing;
      throw new Error("RUN_CHECKPOINT_IMMUTABLE");
    }
    const now = this.clock.now().toISOString();
    const checkpoint = existing
      ? this.store.updateRunCheckpoint({ ...existing, ...safe, updatedAt: now })
      : this.store.insertRunCheckpoint({ id: randomUUID(), runId: run.id, ...safe, sourceCheckpointId: null, createdAt: now, updatedAt: now });
    this.publish(run.id, { eventType: `checkpoint.${checkpoint.status}`, level: checkpoint.status === "failed" ? "warning" : "info", source: `runtime:${grant.executorType}`, message: `${checkpoint.label}：${checkpoint.summary}`, structuredData: { checkpointId: checkpoint.id, stepKey: checkpoint.stepKey, status: checkpoint.status }, requestId });
    this.auditRuntime(`checkpoint.${checkpoint.status}`, "run_checkpoint", checkpoint.id, { runId: run.id, stepKey: checkpoint.stepKey, status: checkpoint.status }, requestId, run.id);
    return checkpoint;
  }

  createRuntimeArtifact(grant: RuntimeCapabilityGrant, candidate: ArtifactCandidate, requestId?: string): Artifact {
    const run = this.requireActiveRuntimeRun(grant.runId);
    const artifact = this.collectArtifacts(run, [candidate], requestId)[0];
    if (!artifact) throw new Error("ARTIFACT_NOT_CREATED");
    return artifact;
  }

  requestRuntimeApproval(grant: RuntimeCapabilityGrant, input: { requestType: Approval["requestType"]; summary: string; request: unknown }, requestId?: string): Approval {
    const run = this.requireActiveRuntimeRun(grant.runId);
    const existing = this.store.getPendingApprovalForRun(run.id);
    if (existing) return existing;
    const now = this.clock.now();
    const approval = this.store.insertApproval({
      id: randomUUID(), runId: run.id, requestType: input.requestType,
      riskLevel: riskForApproval(input.requestType, input.request),
      summary: redactSensitiveText(input.summary), payload: redactSensitiveValue(input.request), status: "pending",
      expiresAt: new Date(now.getTime() + 86_400_000).toISOString(), requestedAt: now.toISOString(), resolvedAt: null, resolutionComment: null
    });
    this.publish(run.id, { eventType: "approval.requested", level: "warning", source: `runtime:${grant.executorType}`, message: approval.summary, structuredData: { approvalId: approval.id, requestType: approval.requestType, riskLevel: approval.riskLevel }, requestId });
    this.auditRuntime("approval.requested", "approval", approval.id, approval, requestId, run.id);
    return approval;
  }

  getRuntimeApproval(grant: RuntimeCapabilityGrant): Approval | null {
    this.requireActiveRuntimeRun(grant.runId);
    return this.store.getPendingApprovalForRun(grant.runId);
  }

  submitRuntimeResult(grant: RuntimeCapabilityGrant, submission: unknown, requestId?: string): Run {
    const run = this.requireActiveRuntimeRun(grant.runId);
    const current = objectRecord(run.result);
    const updated = this.store.updateRun({ ...run, result: { ...current, runtimeSubmission: redactSensitiveValue(submission) } });
    this.publish(run.id, { eventType: "agent.result_submitted", level: "info", source: `runtime:${grant.executorType}`, message: "Agent 已提交结构化结果。", structuredData: { submitted: true }, requestId });
    this.auditRuntime("runtime.result_submitted", "run", run.id, { submitted: true }, requestId, run.id);
    return updated;
  }

  retryRun(runId: string, requestId?: string, mode: "resume" | "restart" = "resume"): Run {
    const previous = this.requireRun(runId);
    if (!canRetryRun(previous.status)) throw new Error(`RUN_NOT_RETRYABLE:${previous.status}`);
    const workSpec = this.requireWorkSpec(previous.workSpecId);
    if (previous.attempt >= workSpec.maxAttempts) throw new Error("MAX_ATTEMPTS_REACHED");
    const retry = this.createRun(previous.workSpecId, {
      input: previous.input,
      retryOfRunId: previous.id,
      attempt: previous.attempt + 1,
      runMode: previous.runMode,
      ...(previous.rehearsalRootRunId ? { rehearsalRootRunId: previous.rehearsalRootRunId } : {}),
      requestId
    });
    if (mode === "resume") this.copyCompletedCheckpoints(previous.id, retry.id, requestId);
    this.publish(retry.id, { eventType: "run.recovery_mode", level: "info", source: "application", message: mode === "resume" ? "已复用上一次完成的步骤。" : "本次将从头执行，不复用检查点。", structuredData: { mode, previousRunId: previous.id }, requestId });
    return retry;
  }

  subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
    const key = `run:${runId}`;
    this.emitter.on(key, listener);
    return () => this.emitter.off(key, listener);
  }

  recoverInterruptedRuns(): number {
    let recovered = 0;
    for (const run of this.store.listRuns(10_000)) {
      if (run.status === "running") {
        this.failRun(run, "PROCESS_RESTARTED", "服务重启中断了本次执行，请重试。", undefined);
        recovered += 1;
      }
    }
    return recovered;
  }

  async getExecutorHealth(): Promise<Array<{ type: WorkSpec["executorType"]; health: ExecutorHealth }>> {
    return await Promise.all([...this.executors].map(async ([type, adapter]) => ({ type, health: await adapter.health() })));
  }

  private beginResume(run: Run, resume: ResumeDirective, requestId?: string): Run {
    const running = this.transition(run, "running", { errorCode: null, errorMessage: null }, requestId);
    void this.executeRunningRun(running, resume, requestId);
    return running;
  }

  private async executeRunningRun(run: Run, resume: ResumeDirective | null, requestId?: string): Promise<Run> {
    const runId = run.id;
    const workSpec = this.requireWorkSpec(run.workSpecId);
    const adapter = this.executors.get(run.executorType);
    if (!adapter) return this.failRun(run, "EXECUTOR_UNAVAILABLE", `执行器 ${run.executorType} 尚未配置。`, requestId);
    const controller = new AbortController();
    this.controllers.set(runId, controller);
    const timeout = setTimeout(() => controller.abort(new Error("EXECUTION_TIMEOUT")), workSpec.timeoutSeconds * 1_000);
    timeout.unref();
    try {
      const capability = this.capabilities.issue(run.id, run.executorType, ALL_RUNTIME_SCOPES, workSpec.timeoutSeconds + 60);
      const context: ExecutionContext = {
        run,
        workSpec,
        project: run.projectId ? this.store.getProject(run.projectId) : null,
        resume,
        signal: controller.signal,
        emit: (event) => this.publish(runId, event),
        capability
      };
      await adapter.validate(context);
      const output = await adapter.execute(context);
      const latest = this.requireRun(runId);
      if (latest.status === "cancelled") return latest;
      const pendingApproval = this.store.getPendingApprovalForRun(runId);
      const effectiveStatus = pendingApproval && output.status !== "waiting_input" ? "waiting_approval" : output.status;
      const waiting = effectiveStatus === "waiting_input" || effectiveStatus === "waiting_approval";
      const externalRunId = output.externalRunId ?? latest.externalRunId;
      if (waiting && (latest.executorType === "codex" || latest.executorType === "openworker") && !externalRunId) throw new Error("RUNTIME_SESSION_ID_REQUIRED");
      const runtimeSubmission = objectRecord(latest.result).runtimeSubmission;
      if (effectiveStatus === "succeeded" && workSpec.skill && (latest.executorType === "codex" || latest.executorType === "openworker") && runtimeSubmission === undefined) {
        throw new Error("RUNTIME_RESULT_SUBMISSION_REQUIRED");
      }
      if (!waiting) this.collectArtifacts(latest, output.artifacts ?? [], requestId);
      const outputResult = objectRecord(redactSensitiveValue(output.result));
      const mergedResult = {
        ...outputResult,
        ...(runtimeSubmission === undefined ? {} : { runtimeSubmission }),
        ...(pendingApproval ? { requestType: pendingApproval.requestType, request: pendingApproval.payload, approvalId: pendingApproval.id } : {})
      };
      const reviewStatus = waiting || latest.runMode !== "production" ? "not_required" : effectiveStatus === "succeeded" && workSpec.reviewPolicy === "not_required" ? "not_required" : "pending";
      const updated = this.transition(latest, effectiveStatus, {
        result: mergedResult,
        usage: redactSensitiveValue(output.usage ?? latest.usage),
        externalRunId,
        reviewStatus,
        reviewedAt: null,
        reviewComment: null,
        finishedAt: waiting ? null : this.clock.now().toISOString()
      }, requestId);
      if (effectiveStatus === "waiting_approval" && !pendingApproval) this.createApproval(updated, requestId);
      if (latest.runMode === "production" && effectiveStatus === "succeeded" && workSpec.resultDeposition?.trigger === "on_success") {
        try { this.completionObserver?.onRunCompleted(updated, requestId); }
        catch (error) {
          this.publish(updated.id, { eventType: "deposition.failed", level: "error", source: "application", message: `自动沉淀未启动：${error instanceof Error ? error.message : "RESULT_DEPOSITION_FAILED"}`, requestId });
        }
      }
      return updated;
    } catch (error) {
      const latest = this.requireRun(runId);
      if (latest.status === "cancelled") return latest;
      const timedOut = controller.signal.aborted && controller.signal.reason instanceof Error && controller.signal.reason.message === "EXECUTION_TIMEOUT";
      const message = error instanceof Error ? error.message : "Execution failed";
      const code = timedOut ? "EXECUTION_TIMEOUT" : "EXECUTION_FAILED";
      const failed = this.failRun(latest, code, message, requestId);
      this.maybeAutoRetryScheduled(failed, code, message, requestId);
      return failed;
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(runId);
      this.capabilities.revokeRun(runId);
    }
  }

  private failRun(run: Run, code: string, message: string, requestId?: string): Run {
    return this.transition(run, "failed", { errorCode: code, errorMessage: redactSensitiveText(message), reviewStatus: "not_required", finishedAt: this.clock.now().toISOString() }, requestId);
  }

  private maybeAutoRetryScheduled(failed: Run, code: string, message: string, requestId?: string): void {
    if (!this.isScheduledRunChain(failed) || !isRetryableExecutionFailure(code, message)) return;
    const workSpec = this.requireWorkSpec(failed.workSpecId);
    if (failed.attempt >= workSpec.maxAttempts) {
      this.publish(failed.id, { eventType: "run.retry_exhausted", level: "error", source: "scheduler", message: `已达到最大尝试次数 ${workSpec.maxAttempts}，等待人工处理。`, structuredData: { attempt: failed.attempt, maxAttempts: workSpec.maxAttempts }, requestId });
      return;
    }
    const retry = this.retryRun(failed.id, requestId);
    this.publish(failed.id, { eventType: "run.retry_scheduled", level: "warning", source: "scheduler", message: `定时运行失败，已创建第 ${retry.attempt} 次尝试。`, structuredData: { retryRunId: retry.id, attempt: retry.attempt }, requestId });
    queueMicrotask(() => { void this.startRun(retry.id, requestId); });
  }

  private isScheduledRunChain(run: Run): boolean {
    let current = run;
    const visited = new Set<string>();
    while (current.retryOfRunId && !visited.has(current.id)) {
      visited.add(current.id);
      const previous = this.store.getRun(current.retryOfRunId);
      if (!previous) break;
      current = previous;
    }
    const key = current.idempotencyKey;
    return Boolean(key && this.store.listSchedules().some((schedule) => key.startsWith(`${schedule.id}:`)));
  }

  private copyCompletedCheckpoints(sourceRunId: string, targetRunId: string, requestId?: string): RunCheckpoint[] {
    const now = this.clock.now().toISOString();
    const copied: RunCheckpoint[] = [];
    for (const source of this.store.listRunCheckpoints(sourceRunId).filter((checkpoint) => checkpoint.status === "completed" || checkpoint.status === "reused")) {
      const checkpoint = this.store.insertRunCheckpoint({
        id: randomUUID(), runId: targetRunId, stepKey: source.stepKey, label: source.label, status: "reused",
        summary: source.summary, data: source.data, sourceCheckpointId: source.id, createdAt: now, updatedAt: now
      });
      copied.push(checkpoint);
      this.publish(targetRunId, { eventType: "checkpoint.reused", level: "info", source: "application", message: `已复用步骤：${checkpoint.label}`, structuredData: { checkpointId: checkpoint.id, sourceCheckpointId: source.id, stepKey: checkpoint.stepKey }, requestId });
    }
    return copied;
  }

  private transition(run: Run, status: RunStatus, patch: Partial<Run>, requestId?: string): Run {
    assertRunTransition(run.status, status);
    const updated = this.store.updateRun({ ...run, ...patch, status });
    const level = status === "failed" ? "error" : status === "cancelled" ? "warning" : "info";
    this.publish(run.id, { eventType: `run.${status}`, level, source: "application", message: `运行状态：${status}`, structuredData: patch, requestId });
    this.audit(`run.${status}`, "run", run.id, updated, requestId, run.id, run);
    return updated;
  }

  private publish(runId: string, input: NewRunEvent): RunEvent {
    const event = this.store.appendRunEvent(runId, { ...input, message: redactSensitiveText(input.message), structuredData: redactSensitiveValue(input.structuredData) }, this.clock.now().toISOString());
    this.emitter.emit(`run:${runId}`, event);
    return event;
  }

  private audit(action: string, resourceType: string, resourceId: string, afterSnapshot: unknown, requestId?: string, runId?: string, beforeSnapshot?: unknown): void {
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action, resourceType, resourceId, beforeSnapshot: redactSensitiveValue(beforeSnapshot), afterSnapshot: redactSensitiveValue(afterSnapshot), requestId, runId }, this.clock.now().toISOString());
  }

  private auditRuntime(action: string, resourceType: string, resourceId: string, afterSnapshot: unknown, requestId?: string, runId?: string): void {
    this.store.insertAudit({ actorType: "runtime", actorId: "agent-gateway", action, resourceType, resourceId, afterSnapshot: redactSensitiveValue(afterSnapshot), requestId, runId }, this.clock.now().toISOString());
  }

  private requireActiveRuntimeRun(id: string): Run {
    const run = this.requireRun(id);
    if (run.status !== "running") throw new Error(`RUNTIME_RUN_NOT_ACTIVE:${run.status}`);
    return run;
  }

  private reviewRun(runId: string, status: "accepted" | "rejected", input: unknown, requestId?: string): Run {
    const parsed = runReviewInputSchema.parse(input);
    const current = this.requireRun(runId);
    if (current.runMode !== "production") throw new Error("RUN_REVIEW_PRODUCTION_ONLY");
    if (current.status !== "succeeded" && current.status !== "partially_succeeded") throw new Error("RUN_REVIEW_REQUIRES_COMPLETED_RUN");
    if (current.reviewStatus !== "pending") throw new Error("RUN_ALREADY_REVIEWED");
    const updated = this.store.updateRun({ ...current, reviewStatus: status, reviewedAt: this.clock.now().toISOString(), reviewComment: redactSensitiveText(parsed.comment) });
    this.publish(runId, { eventType: `run.review_${status}`, level: status === "accepted" ? "info" : "warning", source: "application", message: status === "accepted" ? "运行结果已验收。" : "运行结果已驳回。", structuredData: { comment: parsed.comment }, requestId });
    this.audit(`run.review_${status}`, "run", runId, updated, requestId, runId, current);
    return updated;
  }

  private createApproval(run: Run, requestId?: string): Approval {
    const existing = this.store.getPendingApprovalForRun(run.id);
    if (existing) return existing;
    const result = objectRecord(run.result);
    const requestType = approvalRequestTypeSchema.parse(result.requestType);
    const request = redactSensitiveValue(result.request ?? {});
    const now = this.clock.now();
    const created = this.store.insertApproval({
      id: randomUUID(), runId: run.id, requestType,
      riskLevel: riskForApproval(requestType, request),
      summary: approvalSummary(requestType, request),
      payload: request, status: "pending",
      expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
      requestedAt: now.toISOString(), resolvedAt: null, resolutionComment: null
    });
    this.publish(run.id, { eventType: "approval.requested", level: "warning", source: "application", message: created.summary, structuredData: { approvalId: created.id, requestType: created.requestType, riskLevel: created.riskLevel }, requestId });
    this.audit("approval.requested", "approval", created.id, created, requestId, run.id);
    return created;
  }

  private expireApproval(approval: Approval, requestId?: string): Approval {
    const expired = this.store.updateApproval({ ...approval, status: "expired", resolvedAt: this.clock.now().toISOString(), resolutionComment: "审批已过期，按拒绝处理。" });
    this.audit("approval.expired", "approval", expired.id, expired, requestId, expired.runId, approval);
    const run = this.requireRun(expired.runId);
    if (run.status === "waiting_approval") {
      this.assertResumableRuntime(run);
      this.beginResume(run, { kind: "approval", decision: "expired", requestType: expired.requestType, request: expired.payload, comment: expired.resolutionComment ?? "" }, requestId);
    }
    return expired;
  }

  private assertResumableRuntime(run: Run): void {
    if ((run.executorType === "codex" || run.executorType === "openworker") && !run.externalRunId) throw new Error("RUNTIME_SESSION_ID_REQUIRED");
  }

  private collectArtifacts(run: Run, candidates: ArtifactCandidate[], requestId?: string): Artifact[] {
    if (candidates.length === 0) return [];
    const project = run.projectId ? this.store.getProject(run.projectId) : null;
    const repository = project?.repositoryPath ? resolve(project.repositoryPath) : null;
    if (!repository) throw new Error("ARTIFACT_PROJECT_REPOSITORY_REQUIRED");
    const created: Artifact[] = [];
    const known = new Map(this.store.listArtifactsForRun(run.id).map((item) => [`${item.storageKind}:${item.uri}`, item]));
    for (const raw of candidates) {
      const candidate = artifactCandidateSchema.parse(raw);
      if (candidate.storageKind !== "git") throw new Error(`ARTIFACT_STORAGE_KIND_NOT_ALLOWED:${candidate.storageKind}`);
      const absolute = resolve(repository, candidate.uri);
      if (!isPathInside(repository, absolute)) throw new Error("ARTIFACT_PATH_ESCAPE");
      if (!existsSync(absolute) || !statSync(absolute).isFile()) throw new Error(`ARTIFACT_FILE_NOT_FOUND:${candidate.uri}`);
      const uri = relative(repository, absolute).split(sep).join("/");
      const existing = known.get(`git:${uri}`);
      if (existing) { created.push(existing); continue; }
      const contents = readFileSync(absolute);
      const artifact = this.store.insertArtifact({
        id: randomUUID(), runId: run.id, workSpecId: run.workSpecId, projectId: run.projectId,
        storageKind: "git", name: candidate.name || basename(absolute),
        uri, mimeType: candidate.mimeType,
        sizeBytes: contents.byteLength, checksum: createHash("sha256").update(contents).digest("hex"),
        createdAt: this.clock.now().toISOString()
      });
      known.set(`git:${uri}`, artifact);
      created.push(artifact);
      this.publish(run.id, { eventType: "artifact.created", level: "info", source: "application", message: `已登记生成物：${artifact.name}`, structuredData: artifact, requestId });
      this.audit("artifact.created", "artifact", artifact.id, artifact, requestId, run.id);
    }
    return created;
  }

  private requireRun(id: string): Run {
    const run = this.store.getRun(id);
    if (!run) throw new Error("RUN_NOT_FOUND");
    return run;
  }

  private requireWorkSpec(id: string): WorkSpec {
    const workSpec = this.store.getWorkSpec(id);
    if (!workSpec) throw new Error("WORK_SPEC_NOT_FOUND");
    return workSpec;
  }
}

export class RehearsalPromotionService {
  constructor(
    private readonly store: VNextStore,
    private readonly execution: PersonalOsService,
    private readonly skills: SkillRegistry,
    private readonly clock: Clock = systemClock
  ) {}

  async createRehearsal(workSpecId: string, requestId?: string): Promise<Run> {
    const workSpec = this.requireEligibleWorkSpec(workSpecId);
    const preflight = await this.execution.preflightWorkSpec(workSpec.id);
    if (!preflight.ready) throw new Error("WORK_SPEC_PREFLIGHT_FAILED");
    const run = this.execution.createRun(workSpec.id, { runMode: "rehearsal", requestId });
    this.audit("rehearsal.created", "run", run.id, { workSpecId, runMode: run.runMode, rehearsalRootRunId: run.rehearsalRootRunId }, requestId, run.id);
    return run;
  }

  runFailureDrill(workSpecId: string, requestId?: string): { run: Run; evaluation: RunEvaluation } {
    this.requireEligibleWorkSpec(workSpecId);
    const run = this.execution.runFailureDrill(workSpecId, requestId);
    const evaluation = this.evaluateRun(run.id, { note: "系统执行了结构校验失败演练。" }, requestId);
    return { run, evaluation };
  }

  evaluateRun(runId: string, input: unknown = {}, requestId?: string): RunEvaluation {
    const parsed = runEvaluationInputSchema.parse(input);
    const existing = this.store.getRunEvaluation(runId);
    if (existing) return existing;
    const run = this.store.getRun(runId);
    if (!run) throw new Error("RUN_NOT_FOUND");
    if (run.runMode === "production") throw new Error("RUN_EVALUATION_REQUIRES_REHEARSAL");
    if (!isTerminalRunStatus(run.status)) throw new Error("RUN_EVALUATION_REQUIRES_TERMINAL_RUN");
    const rootId = run.rehearsalRootRunId ?? run.id;
    const checks = run.runMode === "failure_drill"
      ? failureDrillChecks(run)
      : rehearsalChecks(run, this.store.listRunCheckpoints(run.id));
    const now = this.clock.now().toISOString();
    const evaluation = this.store.insertRunEvaluation({
      id: randomUUID(), runId: run.id, workSpecId: run.workSpecId, runMode: run.runMode,
      rehearsalRootRunId: rootId, evaluatorVersion: REHEARSAL_EVALUATOR_VERSION,
      passed: checks.every((check) => check.passed), checks,
      note: redactSensitiveText(parsed.note), createdAt: now
    });
    this.audit("rehearsal.evaluated", "run_evaluation", evaluation.id, {
      runId: run.id, workSpecId: run.workSpecId, runMode: run.runMode, passed: evaluation.passed, checks: evaluation.checks
    }, requestId, run.id);
    return evaluation;
  }

  getGate(workSpecId: string): RehearsalPromotionGate {
    this.requireEligibleWorkSpec(workSpecId);
    const evaluations = this.store.listRunEvaluations(workSpecId);
    const gate = promotionEvidence(workSpecId, evaluations);
    return { ...gate, evaluations, candidates: this.store.listSkillCandidates(workSpecId) };
  }

  createCandidate(workSpecId: string, input: SkillDraftInput, requestId?: string): SkillCandidate {
    this.requireEligibleWorkSpec(workSpecId);
    const gate = this.getGate(workSpecId);
    if (!gate.ready) throw new Error("SKILL_PROMOTION_EVIDENCE_INCOMPLETE");
    const draft = skillDraftInputSchema.parse(input);
    if (redactSensitiveText(`${draft.description}\n${draft.instructions}`) !== `${draft.description}\n${draft.instructions}`) throw new Error("SKILL_CANDIDATE_SECRET_DETECTED");
    const validation = this.skills.validateDraft(draft);
    if (!validation.valid) throw new Error(validation.issues.find((issue) => issue.level === "error")?.code ?? "SKILL_DRAFT_INVALID");
    const evidenceRunIds = [...new Set([
      ...gate.evaluations.filter((item) => item.passed && item.runMode === "rehearsal").map((item) => item.runId),
      ...gate.evaluations.filter((item) => item.passed && item.runMode === "failure_drill").map((item) => item.runId)
    ])];
    const now = this.clock.now().toISOString();
    const candidate = this.store.insertSkillCandidate({
      id: randomUUID(), workSpecId, draft, content: validation.candidate.content,
      contentHash: validation.candidate.contentHash, evidenceRunIds, status: "pending",
      publishedSkill: null, publishedWorkSpecId: null, createdAt: now, updatedAt: now, publishedAt: null
    });
    this.audit("skill_candidate.created", "skill_candidate", candidate.id, {
      workSpecId, name: draft.name, version: draft.version, contentHash: candidate.contentHash, evidenceRunIds
    }, requestId);
    return candidate;
  }

  getCandidate(id: string): SkillCandidate {
    const candidate = this.store.getSkillCandidate(id);
    if (!candidate) throw new Error("SKILL_CANDIDATE_NOT_FOUND");
    return candidate;
  }

  publishCandidate(id: string, requestId?: string): SkillCandidate {
    const candidate = this.getCandidate(id);
    if (candidate.status !== "pending") throw new Error("SKILL_CANDIDATE_ALREADY_PUBLISHED");
    const source = this.requireEligibleWorkSpec(candidate.workSpecId);
    const evidence = this.store.listRunEvaluations(candidate.workSpecId).filter((item) => candidate.evidenceRunIds.includes(item.runId));
    if (!promotionEvidence(candidate.workSpecId, evidence).ready) throw new Error("SKILL_CANDIDATE_EVIDENCE_STALE");
    const validation = this.skills.validateDraft(candidate.draft);
    if (!validation.valid) throw new Error(validation.issues.find((issue) => issue.level === "error")?.code ?? "SKILL_DRAFT_INVALID");
    if (validation.candidate.contentHash !== candidate.contentHash || validation.candidate.content !== candidate.content) throw new Error("SKILL_CANDIDATE_CHANGED_AFTER_VALIDATION");
    const published = this.skills.publish({ ...candidate.draft, validatedContentHash: candidate.contentHash });
    const revision = this.execution.createWorkSpecRevision(source.id, {
      projectId: source.projectId,
      title: source.title,
      instructions: source.instructions,
      executorType: source.executorType,
      input: source.input,
      timeoutSeconds: source.timeoutSeconds,
      maxAttempts: source.maxAttempts,
      lifecycleStatus: "active",
      skill: published,
      reviewPolicy: source.reviewPolicy,
      resultDeposition: source.resultDeposition
    }, requestId);
    const now = this.clock.now().toISOString();
    const updated = this.store.updateSkillCandidate({
      ...candidate, status: "published", publishedSkill: published,
      publishedWorkSpecId: revision.id, updatedAt: now, publishedAt: now
    });
    this.audit("skill_candidate.published", "skill_candidate", updated.id, {
      workSpecId: source.id, publishedWorkSpecId: revision.id, name: published.name,
      version: published.version, contentHash: published.contentHash
    }, requestId);
    return updated;
  }

  private requireEligibleWorkSpec(id: string): WorkSpec {
    const workSpec = this.store.getWorkSpec(id);
    if (!workSpec) throw new Error("WORK_SPEC_NOT_FOUND");
    if (workSpec.kind !== "workflow" || workSpec.lifecycleStatus !== "active") throw new Error("REHEARSAL_REQUIRES_ACTIVE_WORKFLOW");
    if (workSpec.executorType !== "codex" && workSpec.executorType !== "openworker") throw new Error("REHEARSAL_REQUIRES_AGENT_RUNTIME");
    if (!workSpec.skill) throw new Error("REHEARSAL_REQUIRES_PINNED_BASE_SKILL");
    return workSpec;
  }

  private audit(action: string, resourceType: string, resourceId: string, afterSnapshot: unknown, requestId?: string, runId?: string): void {
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action, resourceType, resourceId, afterSnapshot: redactSensitiveValue(afterSnapshot), requestId, runId }, this.clock.now().toISOString());
  }
}

export class ScheduleService {
  private lastTickAt: string | null = null;
  private lastError: string | null = null;

  constructor(private readonly store: VNextStore, private readonly execution: PersonalOsService, private readonly clock: Clock = systemClock) {}

  health(): { status: "healthy" | "degraded"; lastTickAt: string | null; lastError: string | null; enabledSchedules: number } {
    return { status: this.lastError ? "degraded" : "healthy", lastTickAt: this.lastTickAt, lastError: this.lastError, enabledSchedules: this.store.listSchedules().filter((item) => item.enabled).length };
  }

  create(input: ScheduleInput, requestId?: string): Schedule {
    const parsed = scheduleInputSchema.parse(input);
    if (!this.store.getWorkSpec(parsed.workSpecId)) throw new Error("WORK_SPEC_NOT_FOUND");
    const now = this.clock.now();
    const nextRunAt = nextOccurrence(parsed.cronExpression, parsed.timezone, now).toISOString();
    const stamp = now.toISOString();
    const schedule = this.store.insertSchedule({ id: randomUUID(), ...parsed, nextRunAt, lastRunAt: null, createdAt: stamp, updatedAt: stamp });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "schedule.created", resourceType: "schedule", resourceId: schedule.id, afterSnapshot: schedule, requestId }, stamp);
    return schedule;
  }

  update(id: string, input: ScheduleUpdateInput, requestId?: string): Schedule {
    const changes = scheduleUpdateInputSchema.parse(input);
    const current = this.store.getSchedule(id);
    if (!current) throw new Error("SCHEDULE_NOT_FOUND");
    const now = this.clock.now();
    const merged = scheduleInputSchema.parse({ ...current, ...changes, workSpecId: current.workSpecId });
    const timingChanged = merged.cronExpression !== current.cronExpression || merged.timezone !== current.timezone;
    const enabledNow = !current.enabled && merged.enabled;
    const updated = this.store.updateSchedule({
      ...current,
      ...merged,
      workSpecId: current.workSpecId,
      nextRunAt: merged.enabled && (timingChanged || enabledNow)
        ? nextOccurrence(merged.cronExpression, merged.timezone, now).toISOString()
        : current.nextRunAt,
      updatedAt: now.toISOString()
    });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "schedule.updated", resourceType: "schedule", resourceId: id, beforeSnapshot: current, afterSnapshot: updated, requestId }, now.toISOString());
    return updated;
  }

  rebind(id: string, input: ScheduleRebindInput, requestId?: string): Schedule {
    const parsed = scheduleRebindInputSchema.parse(input);
    const current = this.store.getSchedule(id);
    if (!current) throw new Error("SCHEDULE_NOT_FOUND");
    const target = this.store.getWorkSpec(parsed.workSpecId);
    if (!target) throw new Error("WORK_SPEC_NOT_FOUND");
    if (target.kind !== "workflow" || target.lifecycleStatus !== "active") throw new Error("SCHEDULE_REBIND_TARGET_NOT_ACTIVE_WORKFLOW");
    if (target.id === current.workSpecId) return current;
    const now = this.clock.now().toISOString();
    const updated = this.store.updateSchedule({ ...current, workSpecId: target.id, updatedAt: now });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "schedule.rebound", resourceType: "schedule", resourceId: id, beforeSnapshot: current, afterSnapshot: updated, requestId }, now);
    return updated;
  }

  setEnabled(id: string, enabled: boolean, requestId?: string): Schedule {
    const current = this.store.getSchedule(id);
    if (!current) throw new Error("SCHEDULE_NOT_FOUND");
    const now = this.clock.now();
    const updated = this.store.updateSchedule({ ...current, enabled, nextRunAt: enabled ? nextOccurrence(current.cronExpression, current.timezone, now).toISOString() : current.nextRunAt, updatedAt: now.toISOString() });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: enabled ? "schedule.resumed" : "schedule.paused", resourceType: "schedule", resourceId: id, beforeSnapshot: current, afterSnapshot: updated, requestId }, now.toISOString());
    return updated;
  }

  runNow(id: string, requestId?: string): Run {
    const schedule = this.store.getSchedule(id);
    if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
    const run = this.execution.createRun(schedule.workSpecId, { idempotencyKey: `manual:${schedule.id}:${randomUUID()}`, requestId });
    void this.execution.startRun(run.id, requestId);
    return run;
  }

  async tick(): Promise<number> {
    const now = this.clock.now();
    let created = 0;
    try {
      for (const schedule of this.store.listSchedules()) {
        if (!schedule.enabled || new Date(schedule.nextRunAt).getTime() > now.getTime()) continue;
        const scheduledFor = schedule.nextRunAt;
        const key = scheduleFiringKey(schedule.id, scheduledFor);
        const next = nextOccurrence(schedule.cronExpression, schedule.timezone, now).toISOString();
        if (!schedule.catchUp && now.getTime() - new Date(scheduledFor).getTime() > 60_000) {
          this.store.updateSchedule({ ...schedule, nextRunAt: next, lastRunAt: scheduledFor, updatedAt: now.toISOString() });
          continue;
        }
        if (this.store.claimScheduleFiring(schedule.id, scheduledFor, key, now.toISOString())) {
          const run = this.execution.createRun(schedule.workSpecId, { idempotencyKey: key });
          this.store.updateSchedule({ ...schedule, nextRunAt: next, lastRunAt: scheduledFor, updatedAt: now.toISOString() });
          this.store.insertAudit({ actorType: "scheduler", actorId: schedule.id, action: "schedule.fired", resourceType: "run", resourceId: run.id, afterSnapshot: { scheduledFor }, runId: run.id }, now.toISOString());
          void this.execution.startRun(run.id);
          created += 1;
        }
      }
      this.lastError = null;
      return created;
    } catch (error) {
      this.lastError = error instanceof Error ? redactSensitiveText(error.message) : "unknown scheduler error";
      throw error;
    } finally {
      this.lastTickAt = this.clock.now().toISOString();
    }
  }
}

export function nextOccurrence(expression: string, timezone: string, after: Date): Date {
  return CronExpressionParser.parse(expression, { currentDate: after, tz: timezone }).next().toDate();
}

function isRetryableExecutionFailure(code: string, message: string): boolean {
  if (code === "EXECUTION_TIMEOUT" || code === "EXECUTOR_UNAVAILABLE") return true;
  if (code !== "EXECUTION_FAILED") return false;
  return !/^(?:PROJECT_NOT_FOUND|SKILL_|WORK_SPEC_|CODEX_PROJECT_REPOSITORY_REQUIRED|CODEX_GIT_REPOSITORY_REQUIRED|WORKING_DIRECTORY_NOT_ALLOWED|EXECUTABLE_NOT_ALLOWED|RUNTIME_CAPABILITY_|APPROVAL_)/.test(message);
}

export class KnowledgeService {
  private readonly watchers = new Map<string, FSWatcher>();
  private readonly watchTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private watchingActive = false;
  private lastIndexedAt: string | null = null;
  private lastError: string | null = null;

  constructor(private readonly store: VNextStore, private readonly clock: Clock = systemClock, private readonly debounceMs = 250) {}

  addVault(input: VaultInput, requestId?: string): KnowledgeVault {
    const parsed = vaultInputSchema.parse(input);
    const root = resolve(parsed.rootPath);
    if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error("VAULT_PATH_NOT_FOUND");
    if (lstatSync(root).isSymbolicLink()) throw new Error("VAULT_SYMLINK_NOT_ALLOWED");
    const now = this.clock.now().toISOString();
    const vault = this.store.insertVault({ id: randomUUID(), name: parsed.name, rootPath: root, createdAt: now, updatedAt: now });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "knowledge.vault_added", resourceType: "knowledge_vault", resourceId: vault.id, afterSnapshot: vault, requestId }, now);
    if (this.watchingActive) this.startWatching(vault.id);
    return vault;
  }

  indexVault(vaultId: string): KnowledgeIndexResult {
    const vault = this.store.getVault(vaultId);
    if (!vault) throw new Error("VAULT_NOT_FOUND");
    const root = resolve(vault.rootPath);
    const files = collectMarkdown(root);
    let indexed = 0;
    let unchanged = 0;
    let linked = 0;
    let invalidLinks = 0;
    const present: string[] = [];
    for (const file of files) {
      const absolute = resolve(file);
      const rel = relative(root, absolute).split(sep).join("/");
      if (rel.startsWith("../") || rel === "..") throw new Error("VAULT_PATH_ESCAPE");
      present.push(rel);
      const content = readFileSync(absolute, "utf8");
      const hash = createHash("sha256").update(content).digest("hex");
      const parsed = parseMarkdown(content, rel);
      const before = this.store.getKnowledgeDocumentByPath(vault.id, rel);
      let document = before;
      if (before?.contentHash === hash && before.deletedAt === null) {
        unchanged += 1;
      } else {
        document = this.store.upsertKnowledgeDocument({
          id: before?.id ?? randomUUID(), vaultId: vault.id, relativePath: rel, title: parsed.title,
          body: parsed.body, contentHash: hash, frontmatter: parsed.frontmatter, tags: parsed.tags,
          modifiedAt: statSync(absolute).mtime.toISOString(), indexedAt: this.clock.now().toISOString()
        });
        indexed += 1;
      }
      if (!document) continue;
      const extracted = extractKnowledgeLinks(parsed.frontmatter);
      const valid = extracted.filter((link) => {
        const exists = this.entityExists(link);
        if (!exists) invalidLinks += 1;
        return exists;
      });
      const source: KnowledgeLinkSource = parsed.frontmatter.source === "personal-os" ? "generated" : "frontmatter";
      linked += this.store.replaceKnowledgeLinks(document.id, source, valid, this.clock.now().toISOString()).length;
      this.store.replaceKnowledgeLinks(document.id, source === "generated" ? "frontmatter" : "generated", [], this.clock.now().toISOString());
    }
    const deleted = this.store.markMissingKnowledgeDocumentsDeleted(vault.id, present, this.clock.now().toISOString());
    const result = { indexed, unchanged, deleted, linked, invalidLinks };
    this.lastIndexedAt = this.clock.now().toISOString();
    this.lastError = null;
    this.store.insertAudit({ actorType: "system", actorId: "knowledge-indexer", action: "knowledge.indexed", resourceType: "knowledge_vault", resourceId: vault.id, afterSnapshot: result }, this.lastIndexedAt);
    return result;
  }

  getDocument(id: string): KnowledgeDocumentDetail {
    const document = this.store.getKnowledgeDocument(id);
    if (!document || document.deletedAt !== null) throw new Error("KNOWLEDGE_DOCUMENT_NOT_FOUND");
    const vault = this.store.getVault(document.vaultId);
    if (!vault) throw new Error("VAULT_NOT_FOUND");
    return { document, vault, links: this.store.listKnowledgeLinksForDocument(id) };
  }

  createDocument(input: KnowledgeCreateInput, requestId?: string, actor: { type: AuditLog["actorType"]; id: string } = { type: "user", id: "local-user" }): KnowledgeDocumentDetail {
    const parsed = knowledgeCreateInputSchema.parse(input);
    const vault = this.store.getVault(parsed.vaultId);
    if (!vault) throw new Error("VAULT_NOT_FOUND");
    for (const link of parsed.links) if (!this.entityExists(link)) throw new Error(`KNOWLEDGE_LINK_TARGET_NOT_FOUND:${link.entityType}:${link.entityId}`);
    const root = resolve(vault.rootPath);
    if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error("VAULT_PATH_NOT_FOUND");
    if (lstatSync(root).isSymbolicLink()) throw new Error("VAULT_SYMLINK_NOT_ALLOWED");
    const directory = resolve(root, parsed.directory, parsed.subdirectory);
    if (!isPathInside(root, directory)) throw new Error("KNOWLEDGE_PATH_NOT_ALLOWED");
    assertNoSymlinkSegments(root, directory);
    mkdirSync(directory, { recursive: true });
    assertNoSymlinkSegments(root, directory);
    const safeTitle = redactSensitiveText(parsed.title);
    const fileName = `${knowledgeFileStem(safeTitle)}.md`;
    const target = resolve(directory, fileName);
    if (!isPathInside(root, target)) throw new Error("KNOWLEDGE_PATH_NOT_ALLOWED");
    if (existsSync(target)) throw new Error("KNOWLEDGE_DOCUMENT_EXISTS");

    const now = this.clock.now().toISOString();
    const safeBody = redactSensitiveText(parsed.body);
    const safeTags = parsed.tags.map((tag) => redactSensitiveText(tag));
    const markdown = renderKnowledgeMarkdown({ title: safeTitle, body: safeBody, tags: safeTags, links: parsed.links, createdAt: now });
    const temporary = resolve(directory, `.${fileName}.${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, markdown, { encoding: "utf8", flag: "wx", mode: 0o600 });
      linkSync(temporary, target);
      unlinkSync(temporary);
      this.indexVault(vault.id);
      const relativePath = relative(root, target).split(sep).join("/");
      const document = this.store.getKnowledgeDocumentByPath(vault.id, relativePath);
      if (!document) throw new Error("KNOWLEDGE_INDEX_FAILED");
      const detail = this.getDocument(document.id);
      this.store.insertAudit({ actorType: actor.type, actorId: actor.id, action: "knowledge.document_created", resourceType: "knowledge_document", resourceId: document.id, afterSnapshot: { vaultId: vault.id, relativePath, links: detail.links }, requestId }, now);
      return detail;
    } catch (error) {
      if (existsSync(temporary)) unlinkSync(temporary);
      if (existsSync(target) && !this.store.getKnowledgeDocumentByPath(vault.id, relative(root, target).split(sep).join("/"))) unlinkSync(target);
      throw error;
    }
  }

  startWatchingAll(): KnowledgeWatchHealth {
    this.watchingActive = true;
    for (const vault of this.store.listVaults()) {
      try { this.startWatching(vault.id); }
      catch { /* health exposes the sanitized watcher error without stopping the API */ }
    }
    return this.health();
  }

  startWatching(vaultId: string): void {
    if (this.watchers.has(vaultId)) return;
    const vault = this.store.getVault(vaultId);
    if (!vault) throw new Error("VAULT_NOT_FOUND");
    try {
      const watcher = watch(vault.rootPath, { recursive: true }, (_event, fileName) => {
        if (fileName && !String(fileName).toLowerCase().endsWith(".md")) return;
        const pending = this.watchTimers.get(vaultId);
        if (pending) clearTimeout(pending);
        const timer = setTimeout(() => {
          this.watchTimers.delete(vaultId);
          try { this.indexVault(vaultId); }
          catch (error) { this.lastError = redactSensitiveText(error instanceof Error ? error.message : "unknown knowledge watcher error"); }
        }, this.debounceMs);
        timer.unref();
        this.watchTimers.set(vaultId, timer);
      });
      watcher.on("error", (error) => { this.lastError = redactSensitiveText(error.message); });
      this.watchers.set(vaultId, watcher);
    } catch (error) {
      this.lastError = redactSensitiveText(error instanceof Error ? error.message : "unknown knowledge watcher error");
      throw error;
    }
  }

  stopWatching(): void {
    this.watchingActive = false;
    for (const timer of this.watchTimers.values()) clearTimeout(timer);
    this.watchTimers.clear();
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
  }

  health(): KnowledgeWatchHealth {
    return { watchedVaults: this.watchers.size, lastIndexedAt: this.lastIndexedAt, lastError: this.lastError };
  }

  private entityExists(link: KnowledgeLinkInput): boolean {
    if (link.entityType === "project") return this.store.getProject(link.entityId) !== null;
    if (link.entityType === "work_spec") return this.store.getWorkSpec(link.entityId) !== null;
    if (link.entityType === "run") return this.store.getRun(link.entityId) !== null;
    return this.store.getArtifact(link.entityId) !== null;
  }
}

export class ResultDepositionService {
  constructor(private readonly store: VNextStore, private readonly knowledge: KnowledgeService, private readonly clock: Clock = systemClock) {}

  list(status?: RunDeposition["status"]): RunDeposition[] { return this.store.listRunDepositions(status); }
  get(runId: string): RunDeposition | null { return this.store.getRunDeposition(runId); }

  onRunCompleted(run: Run, requestId?: string): void {
    if (run.runMode !== "production" || run.status !== "succeeded") return;
    const workSpec = this.store.getWorkSpec(run.workSpecId);
    if (workSpec?.resultDeposition?.trigger !== "on_success") return;
    this.depositSuccessfulRun(run.id, requestId);
  }

  depositAcceptedRun(runId: string, requestId?: string): RunDeposition | null {
    const run = this.store.getRun(runId);
    if (!run) throw new Error("RUN_NOT_FOUND");
    if (run.runMode !== "production") throw new Error("RUN_DEPOSITION_PRODUCTION_ONLY");
    if (run.reviewStatus !== "accepted") throw new Error("RUN_DEPOSITION_REQUIRES_ACCEPTED_RUN");
    const workSpec = this.store.getWorkSpec(run.workSpecId);
    if (!workSpec) throw new Error("WORK_SPEC_NOT_FOUND");
    const policy = workSpec.resultDeposition;
    if (!policy) return null;
    if (policy.trigger !== "on_acceptance") throw new Error("RUN_DEPOSITION_TRIGGER_MISMATCH");
    return this.deposit(run, workSpec, requestId);
  }

  depositSuccessfulRun(runId: string, requestId?: string): RunDeposition | null {
    const run = this.store.getRun(runId);
    if (!run) throw new Error("RUN_NOT_FOUND");
    if (run.runMode !== "production") throw new Error("RUN_DEPOSITION_PRODUCTION_ONLY");
    if (run.status !== "succeeded") throw new Error("RUN_DEPOSITION_REQUIRES_SUCCESS");
    if (run.reviewStatus !== "not_required") throw new Error("RUN_DEPOSITION_REVIEW_POLICY_MISMATCH");
    const workSpec = this.store.getWorkSpec(run.workSpecId);
    if (!workSpec) throw new Error("WORK_SPEC_NOT_FOUND");
    const policy = workSpec.resultDeposition;
    if (!policy) return null;
    if (workSpec.reviewPolicy !== "not_required" || policy.trigger !== "on_success") throw new Error("RUN_DEPOSITION_TRIGGER_MISMATCH");
    return this.deposit(run, workSpec, requestId);
  }

  retryRunDeposition(runId: string, requestId?: string): RunDeposition | null {
    const workSpecId = this.store.getRun(runId)?.workSpecId;
    if (!workSpecId) throw new Error("RUN_NOT_FOUND");
    const workSpec = this.store.getWorkSpec(workSpecId);
    if (!workSpec) throw new Error("WORK_SPEC_NOT_FOUND");
    return workSpec.resultDeposition?.trigger === "on_success"
      ? this.depositSuccessfulRun(runId, requestId)
      : this.depositAcceptedRun(runId, requestId);
  }

  private deposit(run: Run, workSpec: WorkSpec, requestId?: string): RunDeposition {
    const policy = workSpec.resultDeposition;
    if (!policy) throw new Error("RESULT_DEPOSITION_POLICY_NOT_FOUND");
    const vault = this.store.getVault(policy.vaultId);
    if (!vault) throw new Error("VAULT_NOT_FOUND");
    const existing = this.store.getRunDeposition(run.id);
    if (existing?.status === "succeeded") return existing;
    const now = this.clock.now().toISOString();
    const completedAt = run.finishedAt ?? now;
    const dateKey = localDate(completedAt, policy.timezone);
    const deduplicationKey = policy.period === "calendar_day" ? `${workSpec.id}:${dateKey}` : null;
    const title = existing?.title ?? depositionTitle(policy, workSpec.title, run.id, completedAt);
    let deposition = existing
      ? this.store.updateRunDeposition({ ...existing, status: "pending", errorCode: null, errorMessage: null, attempts: existing.attempts + 1, updatedAt: now })
      : this.store.insertRunDeposition({ id: randomUUID(), runId: run.id, vaultId: vault.id, directory: policy.directory, subdirectory: policy.subdirectory, deduplicationKey, title, status: "pending", documentId: null, artifactId: null, relativePath: null, errorCode: null, errorMessage: null, attempts: 1, createdAt: now, updatedAt: now });
    try {
      const prior = deduplicationKey ? this.store.findSucceededRunDepositionByDeduplicationKey(deduplicationKey) : null;
      if (prior?.documentId && prior.relativePath && prior.runId !== run.id) {
        const document = this.knowledge.getDocument(prior.documentId).document;
        const uri = `${vault.name}/${prior.relativePath}`;
        const artifact = this.store.listArtifactsForRun(run.id).find((item) => item.storageKind === "obsidian" && item.uri === uri) ?? this.store.insertArtifact({
          id: randomUUID(), runId: run.id, workSpecId: run.workSpecId, projectId: run.projectId,
          storageKind: "obsidian", name: `${prior.title}.md`, uri, mimeType: "text/markdown", sizeBytes: null,
          checksum: document.contentHash, createdAt: now
        });
        deposition = this.store.updateRunDeposition({ ...deposition, title: prior.title, status: "succeeded", documentId: prior.documentId, artifactId: artifact.id, relativePath: prior.relativePath, errorCode: null, errorMessage: null, updatedAt: this.clock.now().toISOString() });
        this.store.appendRunEvent(run.id, { eventType: "deposition.reused", level: "info", source: "result-depositor", message: `同一周期的 Obsidian 笔记已存在，已复用：${prior.relativePath}`, structuredData: { depositionId: deposition.id, sourceRunId: prior.runId, documentId: prior.documentId, artifactId: artifact.id } }, deposition.updatedAt);
        this.store.insertAudit({ actorType: "system", actorId: "result-depositor", action: "run.deposition_reused", resourceType: "run_deposition", resourceId: deposition.id, afterSnapshot: deposition, requestId, runId: run.id }, deposition.updatedAt);
        return deposition;
      }
      const linked = this.store.listKnowledgeLinksForEntity("run", run.id).find((link) => link.relation === "result");
      const detail = linked ? this.knowledge.getDocument(linked.documentId) : this.knowledge.createDocument({
        vaultId: vault.id,
        directory: policy.directory,
        subdirectory: policy.subdirectory,
        title,
        body: depositionBody(run, workSpec),
        tags: ["personal-os", "run-result", ...(run.reviewStatus === "accepted" ? ["reviewed"] : ["ai-unreviewed"]), ...(workSpec.skill ? [workSpec.skill.name] : [])],
        links: [
          ...(run.projectId ? [{ entityType: "project" as const, entityId: run.projectId, relation: "result_of" }] : []),
          { entityType: "work_spec", entityId: workSpec.id, relation: "result_of" },
          { entityType: "run", entityId: run.id, relation: "result" }
        ]
      }, requestId, { type: "system", id: "result-depositor" });
      const uri = `${vault.name}/${detail.document.relativePath}`;
      const artifact = this.store.listArtifactsForRun(run.id).find((item) => item.storageKind === "obsidian" && item.uri === uri) ?? this.store.insertArtifact({
        id: randomUUID(), runId: run.id, workSpecId: run.workSpecId, projectId: run.projectId,
        storageKind: "obsidian", name: `${title}.md`, uri, mimeType: "text/markdown", sizeBytes: null,
        checksum: detail.document.contentHash, createdAt: now
      });
      deposition = this.store.updateRunDeposition({ ...deposition, status: "succeeded", documentId: detail.document.id, artifactId: artifact.id, relativePath: detail.document.relativePath, errorCode: null, errorMessage: null, updatedAt: this.clock.now().toISOString() });
      this.store.appendRunEvent(run.id, { eventType: "deposition.succeeded", level: "info", source: "result-depositor", message: `结果已沉淀到 Obsidian：${detail.document.relativePath}`, structuredData: { depositionId: deposition.id, documentId: detail.document.id, artifactId: artifact.id } }, deposition.updatedAt);
      this.store.insertAudit({ actorType: "system", actorId: "result-depositor", action: "run.deposition_succeeded", resourceType: "run_deposition", resourceId: deposition.id, afterSnapshot: deposition, requestId, runId: run.id }, deposition.updatedAt);
      return deposition;
    } catch (error) {
      const message = redactSensitiveText(error instanceof Error ? error.message : "RESULT_DEPOSITION_FAILED");
      const code = message.split(":")[0] || "RESULT_DEPOSITION_FAILED";
      deposition = this.store.updateRunDeposition({ ...deposition, status: "failed", errorCode: code, errorMessage: message, updatedAt: this.clock.now().toISOString() });
      this.store.appendRunEvent(run.id, { eventType: "deposition.failed", level: "error", source: "result-depositor", message: `Obsidian 沉淀失败：${message}`, structuredData: { depositionId: deposition.id, attempts: deposition.attempts } }, deposition.updatedAt);
      this.store.insertAudit({ actorType: "system", actorId: "result-depositor", action: "run.deposition_failed", resourceType: "run_deposition", resourceId: deposition.id, afterSnapshot: { status: deposition.status, errorCode: deposition.errorCode, attempts: deposition.attempts }, requestId, runId: run.id }, deposition.updatedAt);
      return deposition;
    }
  }
}

export class FinanceService {
  constructor(private readonly store: VNextStore, private readonly clock: Clock = systemClock) {}

  listAccounts(): FinanceAccount[] { return this.store.listFinanceAccounts(); }
  listTransactions(): FinanceTransaction[] { return this.store.listFinanceTransactions(); }
  listCategories(): FinanceCategory[] { return this.store.listFinanceCategories(); }
  listBudgets(month?: string, currency?: string): FinanceBudget[] { return this.store.listFinanceBudgets(month, currency); }
  listCalculations(): FinanceCalculation[] { return this.store.listFinanceCalculations(); }
  listOperatingUnits(): OperatingUnit[] { return this.store.listOperatingUnits(); }
  listAllocations(operatingUnitId?: string): FinanceAllocation[] { return this.store.listFinanceAllocations(operatingUnitId); }
  listOperatingEntries(operatingUnitId?: string): OperatingEntry[] { return this.store.listOperatingEntries(operatingUnitId); }
  listChangeProposals(status?: FinanceChangeProposal["status"]): FinanceChangeProposal[] { return this.store.listFinanceChangeProposals(status); }
  monthlySummary(month: string, currency: string): MonthlyFinanceSummary { return this.store.getMonthlyFinanceSummary(month, currency.toUpperCase()); }

  createAccount(input: FinanceAccountInput, requestId?: string): FinanceAccount {
    const parsed = financeAccountInputSchema.parse(input);
    const now = this.clock.now().toISOString();
    const account = this.store.insertFinanceAccount({ id: randomUUID(), ...parsed, currentBalanceMinor: parsed.initialBalanceMinor, isActive: true, createdAt: now, updatedAt: now });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "finance.account_created", resourceType: "finance_account", resourceId: account.id, afterSnapshot: account, requestId }, now);
    return account;
  }

  createTransaction(input: FinanceTransactionInput, requestId?: string): FinanceTransaction {
    const parsed = financeTransactionInputSchema.parse(input);
    const account = this.store.getFinanceAccount(parsed.accountId);
    if (!account) throw new Error("FINANCE_ACCOUNT_NOT_FOUND");
    if (account.currency !== parsed.currency) throw new Error("CURRENCY_MISMATCH");
    if (parsed.categoryId && !this.store.getFinanceCategory(parsed.categoryId)) throw new Error("FINANCE_CATEGORY_NOT_FOUND");
    const now = this.clock.now().toISOString();
    const pending = ordinaryTransaction(parsed, now);
    const transaction = this.store.postFinanceTransaction(pending, pending.balanceEffectMinor);
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "finance.transaction_created", resourceType: "finance_transaction", resourceId: transaction.id, afterSnapshot: transaction, requestId }, now);
    return transaction;
  }

  deleteTransaction(...arguments_: unknown[]): never {
    void arguments_;
    throw new Error("FINANCE_CHANGE_PROPOSAL_REQUIRED");
  }

  createTransfer(input: FinanceTransferInput, requestId?: string): FinanceTransferResult {
    const parsed = financeTransferInputSchema.parse(input);
    const from = this.store.getFinanceAccount(parsed.fromAccountId);
    const to = this.store.getFinanceAccount(parsed.toAccountId);
    if (!from || !to) throw new Error("FINANCE_ACCOUNT_NOT_FOUND");
    if (!from.isActive || !to.isActive) throw new Error("FINANCE_ACCOUNT_INACTIVE");
    if (from.currency === to.currency) {
      if (parsed.fromAmountMinor !== parsed.toAmountMinor) throw new Error("SAME_CURRENCY_TRANSFER_MUST_BALANCE");
      if (parsed.rateNumerator !== null || parsed.rateDenominator !== null) throw new Error("SAME_CURRENCY_TRANSFER_HAS_NO_RATE");
    } else {
      if (parsed.rateNumerator === null || parsed.rateDenominator === null) throw new Error("EXCHANGE_RATE_REQUIRED");
      if (convertMinorUnits(parsed.fromAmountMinor, parsed.rateNumerator, parsed.rateDenominator) !== parsed.toAmountMinor) throw new Error("TRANSFER_RATE_RESULT_MISMATCH");
    }
    const now = this.clock.now().toISOString();
    const transferId = randomUUID();
    const base = { categoryId: null, category: null, description: parsed.description, occurredAt: parsed.occurredAt, parentTransactionId: null, reversalOfTransactionId: null, deletedAt: null, createdAt: now, updatedAt: now };
    const outgoing: FinanceTransaction = { id: randomUUID(), ...base, accountId: from.id, transactionType: "transfer_out", amountMinor: parsed.fromAmountMinor, currency: from.currency, counterparty: to.name, balanceEffectMinor: -parsed.fromAmountMinor, reportingType: "transfer", reportingEffectMinor: 0, transferId };
    const incoming: FinanceTransaction = { id: randomUUID(), ...base, accountId: to.id, transactionType: "transfer_in", amountMinor: parsed.toAmountMinor, currency: to.currency, counterparty: from.name, balanceEffectMinor: parsed.toAmountMinor, reportingType: "transfer", reportingEffectMinor: 0, transferId };
    this.store.postFinanceTransactionsAtomically({ transactions: [outgoing, incoming], accountDeltas: [{ accountId: from.id, deltaMinor: outgoing.balanceEffectMinor }, { accountId: to.id, deltaMinor: incoming.balanceEffectMinor }], mutationAt: now });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "finance.transfer_created", resourceType: "finance_transfer", resourceId: transferId, afterSnapshot: { outgoing, incoming, rateNumerator: parsed.rateNumerator, rateDenominator: parsed.rateDenominator }, requestId }, now);
    return { transferId, outgoing, incoming };
  }

  createRefund(input: FinanceRefundInput, requestId?: string): FinanceTransaction {
    const parsed = financeRefundInputSchema.parse(input);
    const original = this.store.getFinanceTransaction(parsed.originalTransactionId);
    if (!original || original.deletedAt) throw new Error("FINANCE_TRANSACTION_NOT_FOUND");
    if (original.transactionType !== "income" && original.transactionType !== "expense") throw new Error("TRANSACTION_NOT_REFUNDABLE");
    const refunded = this.store.listFinanceTransactions().filter((item) => item.deletedAt === null && item.transactionType === "refund" && item.parentTransactionId === original.id).reduce((sum, item) => safeAdd(sum, item.amountMinor), 0);
    if (safeAdd(refunded, parsed.amountMinor) > original.amountMinor) throw new Error("REFUND_EXCEEDS_ORIGINAL");
    const now = this.clock.now().toISOString();
    const isExpenseRefund = original.reportingType === "expense";
    const refund: FinanceTransaction = {
      id: randomUUID(), accountId: original.accountId, transactionType: "refund", amountMinor: parsed.amountMinor,
      currency: original.currency, occurredAt: parsed.occurredAt, categoryId: original.categoryId, category: original.category,
      counterparty: original.counterparty, description: parsed.description, balanceEffectMinor: isExpenseRefund ? parsed.amountMinor : -parsed.amountMinor,
      reportingType: original.reportingType, reportingEffectMinor: -parsed.amountMinor, parentTransactionId: original.id,
      transferId: null, reversalOfTransactionId: null, deletedAt: null, createdAt: now, updatedAt: now
    };
    this.store.postFinanceTransaction(refund, refund.balanceEffectMinor);
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "finance.refund_created", resourceType: "finance_transaction", resourceId: refund.id, beforeSnapshot: original, afterSnapshot: refund, requestId }, now);
    return refund;
  }

  createCategory(input: FinanceCategoryInput, requestId?: string): FinanceCategory {
    const parsed = financeCategoryInputSchema.parse(input);
    const now = this.clock.now().toISOString();
    const category = this.store.insertFinanceCategory({ id: randomUUID(), ...parsed, isActive: true, createdAt: now, updatedAt: now });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "finance.category_created", resourceType: "finance_category", resourceId: category.id, afterSnapshot: category, requestId }, now);
    return category;
  }

  setBudget(input: FinanceBudgetInput, requestId?: string): FinanceBudget {
    const parsed = financeBudgetInputSchema.parse(input);
    if (!this.store.getFinanceCategory(parsed.categoryId)) throw new Error("FINANCE_CATEGORY_NOT_FOUND");
    const now = this.clock.now().toISOString();
    const before = this.store.getFinanceBudget(parsed.month, parsed.currency, parsed.categoryId);
    const budget = this.store.upsertFinanceBudget({ id: before?.id ?? randomUUID(), ...parsed, createdAt: before?.createdAt ?? now, updatedAt: now });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: before ? "finance.budget_updated" : "finance.budget_created", resourceType: "finance_budget", resourceId: budget.id, beforeSnapshot: before, afterSnapshot: budget, requestId }, now);
    return budget;
  }

  calculateBudgetVariance(input: unknown, requestId?: string): FinanceCalculation {
    const parsed = budgetVarianceInputSchema.parse(input);
    const budgets = this.store.listFinanceBudgets(parsed.month, parsed.currency);
    const transactions = this.store.listFinanceTransactions().filter((item) => item.deletedAt === null && item.currency === parsed.currency && item.occurredAt.slice(0, 7) === parsed.month);
    const items = budgets.map((budget) => {
      const actualMinor = transactions.filter((item) => item.categoryId === budget.categoryId && (item.reportingType === "income" || item.reportingType === "expense")).reduce((sum, item) => safeAdd(sum, item.reportingEffectMinor), 0);
      return { categoryId: budget.categoryId, plannedMinor: budget.plannedMinor, actualMinor, varianceMinor: calculateBudgetVariance(budget.plannedMinor, actualMinor) };
    });
    return this.saveCalculation("budget_variance", "budget-variance-v1", { month: parsed.month, currency: parsed.currency, items }, {}, { items, totalVarianceMinor: items.reduce((sum, item) => safeAdd(sum, item.varianceMinor), 0) }, parsed.currency, `${parsed.month}-01`, `${parsed.month}-31`, "user", requestId);
  }

  calculateCashflow(input: CashflowForecastInput, requestId?: string): FinanceCalculation {
    const parsed = cashflowForecastInputSchema.parse(input);
    const result = calculateCashflowForecast(parsed);
    return this.saveCalculation("cashflow_forecast", "cashflow-v1", parsed, { source: "explicit_user_assumptions" }, result, parsed.currency, `${parsed.months[0]!.month}-01`, `${parsed.months.at(-1)!.month}-31`, "user", requestId);
  }

  calculateConversion(input: unknown, requestId?: string): FinanceCalculation {
    const parsed = currencyConversionInputSchema.parse(input);
    const convertedMinor = convertMinorUnits(parsed.amountMinor, parsed.rateNumerator, parsed.rateDenominator);
    const result = { convertedMinor, unroundedNumerator: (BigInt(parsed.amountMinor) * BigInt(parsed.rateNumerator)).toString(), rateDenominator: parsed.rateDenominator };
    return this.saveCalculation("currency_conversion", "currency-rational-v1", parsed, { rounding: "half_up_integer" }, result, parsed.toCurrency, null, null, "user", requestId);
  }

  replayCalculation(id: string): { calculation: FinanceCalculation; result: unknown; matches: boolean } {
    const calculation = this.store.getFinanceCalculation(id);
    if (!calculation) throw new Error("FINANCE_CALCULATION_NOT_FOUND");
    let result: unknown;
    if (calculation.calculationType === "cashflow_forecast") result = calculateCashflowForecast(cashflowForecastInputSchema.parse(calculation.inputSnapshot));
    else if (calculation.calculationType === "currency_conversion") {
      const input = currencyConversionInputSchema.parse(calculation.inputSnapshot);
      result = { convertedMinor: convertMinorUnits(input.amountMinor, input.rateNumerator, input.rateDenominator), unroundedNumerator: (BigInt(input.amountMinor) * BigInt(input.rateNumerator)).toString(), rateDenominator: input.rateDenominator };
    } else {
      const snapshot = calculation.inputSnapshot as { items: Array<{ categoryId: string; plannedMinor: number; actualMinor: number }> };
      const items = snapshot.items.map((item) => ({ ...item, varianceMinor: calculateBudgetVariance(item.plannedMinor, item.actualMinor) }));
      result = { items, totalVarianceMinor: items.reduce((sum, item) => safeAdd(sum, item.varianceMinor), 0) };
    }
    return { calculation, result, matches: JSON.stringify(result) === JSON.stringify(calculation.result) };
  }

  createOperatingUnit(input: OperatingUnitInput, requestId?: string): OperatingUnit {
    const parsed = operatingUnitInputSchema.parse(input);
    const now = this.clock.now().toISOString();
    const unit = this.store.insertOperatingUnit({ id: randomUUID(), ...parsed, isActive: true, createdAt: now, updatedAt: now });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "finance.operating_unit_created", resourceType: "operating_unit", resourceId: unit.id, afterSnapshot: unit, requestId }, now);
    return unit;
  }

  allocate(input: FinanceAllocationInput, requestId?: string): FinanceAllocation {
    const parsed = financeAllocationInputSchema.parse(input);
    const idempotent = this.store.getFinanceAllocationByIdempotencyKey(parsed.idempotencyKey);
    if (idempotent) {
      if (idempotent.transactionId !== parsed.transactionId || idempotent.operatingUnitId !== parsed.operatingUnitId || idempotent.amountMinor !== parsed.amountMinor) throw new Error("ALLOCATION_IDEMPOTENCY_CONFLICT");
      return idempotent;
    }
    if (this.store.getFinanceAllocation(parsed.transactionId, parsed.operatingUnitId)) throw new Error("ALLOCATION_ALREADY_EXISTS");
    const transaction = this.store.getFinanceTransaction(parsed.transactionId);
    const unit = this.store.getOperatingUnit(parsed.operatingUnitId);
    if (!transaction || transaction.deletedAt) throw new Error("FINANCE_TRANSACTION_NOT_FOUND");
    if (!unit || !unit.isActive) throw new Error("OPERATING_UNIT_NOT_FOUND");
    if (transaction.currency !== unit.currency) throw new Error("CURRENCY_MISMATCH");
    const allocated = this.store.listFinanceAllocations().filter((item) => item.transactionId === transaction.id).reduce((sum, item) => safeAdd(sum, item.amountMinor), 0);
    if (safeAdd(allocated, parsed.amountMinor) > transaction.amountMinor) throw new Error("ALLOCATION_EXCEEDS_TRANSACTION");
    const now = this.clock.now().toISOString();
    const allocation = this.store.insertFinanceAllocation({ id: randomUUID(), ...parsed, currency: transaction.currency, createdAt: now, updatedAt: now });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "finance.allocation_created", resourceType: "finance_allocation", resourceId: allocation.id, afterSnapshot: allocation, requestId }, now);
    return allocation;
  }

  createOperatingEntry(input: OperatingEntryInput, requestId?: string): OperatingEntry {
    const parsed = operatingEntryInputSchema.parse(input);
    const unit = this.store.getOperatingUnit(parsed.operatingUnitId);
    if (!unit) throw new Error("OPERATING_UNIT_NOT_FOUND");
    if (parsed.entryType !== "time" && parsed.currency !== unit.currency) throw new Error("CURRENCY_MISMATCH");
    const now = this.clock.now().toISOString();
    const entry = this.store.insertOperatingEntry({ id: randomUUID(), ...parsed, createdAt: now });
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "finance.operating_entry_created", resourceType: "operating_entry", resourceId: entry.id, afterSnapshot: entry, requestId }, now);
    return entry;
  }

  operatingSummary(operatingUnitId: string): OperatingUnitSummary {
    const unit = this.store.getOperatingUnit(operatingUnitId);
    if (!unit) throw new Error("OPERATING_UNIT_NOT_FOUND");
    const transactions = new Map(this.store.listFinanceTransactions().map((item) => [item.id, item]));
    let actualIncomeMinor = 0;
    let actualExpenseMinor = 0;
    for (const allocation of this.store.listFinanceAllocations(operatingUnitId)) {
      const transaction = transactions.get(allocation.transactionId);
      if (!transaction || transaction.deletedAt || transaction.reportingEffectMinor === 0) continue;
      const signed = transaction.reportingEffectMinor < 0 ? -allocation.amountMinor : allocation.amountMinor;
      if (transaction.reportingType === "income") actualIncomeMinor = safeAdd(actualIncomeMinor, signed);
      if (transaction.reportingType === "expense") actualExpenseMinor = safeAdd(actualExpenseMinor, signed);
    }
    let expectedIncomeMinor = 0;
    let committedCostMinor = 0;
    let timeMinutes = 0;
    for (const entry of this.store.listOperatingEntries(operatingUnitId)) {
      if (entry.entryType === "expected_income") expectedIncomeMinor = safeAdd(expectedIncomeMinor, entry.amountMinor);
      else if (entry.entryType === "committed_cost") committedCostMinor = safeAdd(committedCostMinor, entry.amountMinor);
      else timeMinutes = safeAdd(timeMinutes, entry.minutes);
    }
    return { operatingUnitId, currency: unit.currency, actualIncomeMinor, actualExpenseMinor, expectedIncomeMinor, committedCostMinor, timeMinutes };
  }

  createChangeProposal(input: FinanceChangeProposalInput, actor: "user" | "runtime" = "user", requestId?: string): FinanceChangeProposal {
    const parsed = financeChangeProposalInputSchema.parse(input);
    const target = this.store.getFinanceTransaction(parsed.targetTransactionId);
    if (!target || target.deletedAt) throw new Error("FINANCE_TRANSACTION_NOT_FOUND");
    if (target.transactionType !== "income" && target.transactionType !== "expense") throw new Error("TRANSACTION_NOT_CHANGEABLE");
    if (this.store.listFinanceTransactions().some((item) => item.deletedAt === null && item.reversalOfTransactionId === target.id)) throw new Error("TRANSACTION_ALREADY_REVERSED");
    if (parsed.proposalType !== "update" && this.store.listFinanceTransactions().some((item) => item.deletedAt === null && item.transactionType === "refund" && item.parentTransactionId === target.id)) throw new Error("TRANSACTION_HAS_ACTIVE_REFUNDS");
    if (parsed.proposedChanges.categoryId && !this.store.getFinanceCategory(parsed.proposedChanges.categoryId)) throw new Error("FINANCE_CATEGORY_NOT_FOUND");
    const now = this.clock.now().toISOString();
    const redacted = redactSensitiveValue(parsed) as FinanceChangeProposalInput;
    const proposal = this.store.insertFinanceChangeProposal({ id: randomUUID(), ...redacted, requestedBy: actor, status: "pending", resultTransactionIds: [], resolvedAt: null, resolutionComment: null, createdAt: now });
    this.store.insertAudit({ actorType: actor, actorId: actor === "runtime" ? "agent-gateway" : "local-user", action: "finance.change_proposed", resourceType: "finance_change_proposal", resourceId: proposal.id, afterSnapshot: proposal, requestId }, now);
    return proposal;
  }

  decideChangeProposal(id: string, input: FinanceChangeProposalDecision, requestId?: string): FinanceChangeProposal {
    const decision = financeChangeProposalDecisionSchema.parse(input);
    const proposal = this.store.getFinanceChangeProposal(id);
    if (!proposal) throw new Error("FINANCE_PROPOSAL_NOT_FOUND");
    if (proposal.status !== "pending") throw new Error("FINANCE_PROPOSAL_ALREADY_RESOLVED");
    const target = this.store.getFinanceTransaction(proposal.targetTransactionId);
    if (!target || target.deletedAt) throw new Error("FINANCE_TRANSACTION_NOT_FOUND");
    const now = this.clock.now().toISOString();
    const writeSet: FinanceWriteSet = { transactions: [], accountDeltas: [], mutationAt: now };
    if (decision.decision === "approved") {
      if (proposal.proposalType === "delete") {
        writeSet.deleteTransactionId = target.id;
        writeSet.accountDeltas.push({ accountId: target.accountId, deltaMinor: -target.balanceEffectMinor });
      } else {
        const reversal = reversalTransaction(target, now);
        writeSet.transactions.push(reversal);
        writeSet.accountDeltas.push({ accountId: target.accountId, deltaMinor: reversal.balanceEffectMinor });
        if (proposal.proposalType === "update") {
          const replacementInput = financeTransactionInputSchema.parse({
            accountId: target.accountId, transactionType: target.transactionType, amountMinor: proposal.proposedChanges.amountMinor ?? target.amountMinor,
            currency: target.currency, occurredAt: proposal.proposedChanges.occurredAt ?? target.occurredAt,
            categoryId: proposal.proposedChanges.categoryId === undefined ? target.categoryId : proposal.proposedChanges.categoryId,
            category: proposal.proposedChanges.category === undefined ? target.category : proposal.proposedChanges.category,
            counterparty: proposal.proposedChanges.counterparty === undefined ? target.counterparty : proposal.proposedChanges.counterparty,
            description: proposal.proposedChanges.description ?? target.description
          });
          const replacement = ordinaryTransaction(replacementInput, now);
          writeSet.transactions.push(replacement);
          writeSet.accountDeltas.push({ accountId: replacement.accountId, deltaMinor: replacement.balanceEffectMinor });
        }
      }
    }
    const resolved: FinanceChangeProposal = { ...proposal, status: decision.decision, resultTransactionIds: writeSet.transactions.map((item) => item.id), resolvedAt: now, resolutionComment: decision.comment };
    const saved = this.store.resolveFinanceChangeProposal(resolved, writeSet);
    this.store.insertAudit({ actorType: "user", actorId: "local-user", action: `finance.change_${decision.decision}`, resourceType: "finance_change_proposal", resourceId: id, beforeSnapshot: proposal, afterSnapshot: saved, requestId }, now);
    return saved;
  }

  private saveCalculation(calculationType: FinanceCalculation["calculationType"], formulaVersion: string, inputSnapshot: unknown, assumptions: unknown, result: unknown, currency: string, periodStart: string | null, periodEnd: string | null, createdBy: FinanceCalculation["createdBy"], requestId?: string): FinanceCalculation {
    const now = this.clock.now().toISOString();
    const calculation = this.store.insertFinanceCalculation({ id: randomUUID(), calculationType, formulaVersion, inputSnapshot, assumptions, result, currency, periodStart, periodEnd, createdBy, createdAt: now });
    this.store.insertAudit({ actorType: createdBy === "runtime" ? "runtime" : "user", actorId: createdBy === "runtime" ? "agent-gateway" : "local-user", action: "finance.calculation_created", resourceType: "finance_calculation", resourceId: calculation.id, afterSnapshot: calculation, requestId }, now);
    return calculation;
  }
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requestFromResult(value: unknown): unknown {
  return objectRecord(value).request ?? {};
}

function riskForApproval(requestType: Approval["requestType"], request: unknown): Approval["riskLevel"] {
  if (requestType === "permission_required") {
    const text = JSON.stringify(request).toLowerCase();
    if (/delete|payment|publish|deploy|email|secret|credential|删除|支付|发布|部署/.test(text)) return "critical";
    return "high";
  }
  return requestType === "directory_requested" ? "high" : "medium";
}

function approvalSummary(requestType: Approval["requestType"], request: unknown): string {
  const record = objectRecord(request);
  const detail = String(record.description ?? record.reason ?? record.path ?? record.plan ?? "").trim();
  const label = requestType === "permission_required" ? "Runtime 请求执行受控操作" : requestType === "directory_requested" ? "Runtime 请求访问额外目录" : "Runtime 提交了待批准计划";
  return redactSensitiveText(detail ? `${label}：${detail.slice(0, 240)}` : label);
}

function isPathInside(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !path.startsWith("/"));
}

interface OrdinaryTransactionData {
  accountId: string;
  transactionType: "income" | "expense";
  amountMinor: number;
  currency: string;
  occurredAt: string;
  categoryId: string | null;
  category: string | null;
  counterparty: string | null;
  description: string;
}

function ordinaryTransaction(input: OrdinaryTransactionData, now: string): FinanceTransaction {
  return {
    id: randomUUID(), ...input, ...transactionFacts(input.transactionType, input.amountMinor),
    parentTransactionId: null, transferId: null, reversalOfTransactionId: null,
    deletedAt: null, createdAt: now, updatedAt: now
  };
}

function reversalTransaction(target: FinanceTransaction, now: string): FinanceTransaction {
  return {
    id: randomUUID(), accountId: target.accountId, transactionType: "adjustment", amountMinor: target.amountMinor,
    currency: target.currency, occurredAt: now, categoryId: target.categoryId, category: target.category,
    counterparty: target.counterparty, description: `冲销：${target.description || target.id}`,
    balanceEffectMinor: -target.balanceEffectMinor, reportingType: target.reportingType,
    reportingEffectMinor: -target.reportingEffectMinor, parentTransactionId: null, transferId: null,
    reversalOfTransactionId: target.id, deletedAt: null, createdAt: now, updatedAt: now
  };
}

function depositionTitle(policy: NonNullable<WorkSpec["resultDeposition"]>, workSpecTitle: string, runId: string, createdAt: string): string {
  const date = localDate(createdAt, policy.timezone);
  const shortId = runId.slice(0, 8);
  let title = policy.titleTemplate.replaceAll("{title}", workSpecTitle).replaceAll("{date}", date).replaceAll("{runId}", shortId).trim();
  if (policy.period === "run" && !title.includes(shortId)) title = `${title} (${shortId})`;
  title = redactSensitiveText(title).replace(/[\\/:\0]/g, "-").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!title) throw new Error("INVALID_KNOWLEDGE_TITLE");
  return title;
}

function depositionBody(run: Run, workSpec: WorkSpec): string {
  const submission = objectRecord(objectRecord(run.result).runtimeSubmission);
  const reviewed = run.reviewStatus === "accepted";
  const summary = String(submission.summary ?? objectRecord(run.result).finalResponse ?? (reviewed ? "运行已完成并通过人工验收。" : "运行已完成，结果尚未人工复核。"));
  const data = redactSensitiveValue(submission.data ?? run.result ?? {});
  const verification = Array.isArray(submission.verification) ? submission.verification.map((item) => `- ${String(item)}`).join("\n") : "- 未提供独立验证条目";
  return [
    "## 结果摘要",
    "",
    redactSensitiveText(summary),
    "",
    "## 结构化结果",
    "",
    "```json",
    JSON.stringify(data, null, 2),
    "```",
    "",
    "## 验证证据",
    "",
    verification,
    "",
    "## 运行信息",
    "",
    `- 结果状态：${reviewed ? "已人工验收" : "AI 生成，未人工复核"}`,
    `- 工作流：${workSpec.title}`,
    `- Run：${run.id}`,
    `- Runtime：${run.executorType}`,
    `- 尝试次数：${run.attempt}`,
    `- Skill：${workSpec.skill ? `${workSpec.skill.name}@${workSpec.skill.version} (${workSpec.skill.contentHash})` : "未绑定"}`
  ].join("\n");
}

function rehearsalChecks(run: Run, checkpoints: RunCheckpoint[]): RunEvaluationCheck[] {
  const submission = objectRecord(run.result).runtimeSubmission;
  const parsed = runtimeResultInputSchema.safeParse(submission);
  const verificationCount = parsed.success ? parsed.data.verification.length : 0;
  const completed = checkpoints.filter((checkpoint) => checkpoint.status === "completed" || checkpoint.status === "reused");
  return [
    { code: "rehearsal_mode", passed: run.runMode === "rehearsal", detail: run.runMode === "rehearsal" ? "这是预执行 Run。" : "Run 模式不是 rehearsal。" },
    { code: "terminal_success", passed: run.status === "succeeded", detail: run.status === "succeeded" ? "Runtime 已成功结束。" : `当前状态是 ${run.status}。` },
    { code: "structured_result", passed: parsed.success, detail: parsed.success ? "结构化结果符合当前 Schema。" : "缺少有效的结构化结果。" },
    { code: "verification", passed: verificationCount > 0, detail: verificationCount > 0 ? `包含 ${verificationCount} 条验证证据。` : "没有独立验证条目。" },
    { code: "checkpoint_evidence", passed: completed.length > 0, detail: completed.length > 0 ? `包含 ${completed.length} 个完成或复用的步骤证据。` : "没有完成的步骤检查点。" }
  ];
}

function failureDrillChecks(run: Run): RunEvaluationCheck[] {
  const drill = objectRecord(objectRecord(run.result).failureDrill);
  return [
    { code: "failure_drill_mode", passed: run.runMode === "failure_drill", detail: run.runMode === "failure_drill" ? "这是失败演练 Run。" : "Run 模式不是 failure_drill。" },
    { code: "invalid_result_rejected", passed: drill.rejected === true, detail: drill.rejected === true ? "无效结果被当前 Schema 拒绝。" : "无效结果没有被拒绝。" },
    { code: "expected_failure_recorded", passed: run.status === "failed" && run.errorCode === "EXPECTED_VALIDATION_REJECTION", detail: run.status === "failed" && run.errorCode === "EXPECTED_VALIDATION_REJECTION" ? "拒绝被记录为预期失败。" : "没有记录预期的校验拒绝。" }
  ];
}

function promotionEvidence(workSpecId: string, evaluations: RunEvaluation[]): Pick<RehearsalPromotionGate, "workSpecId" | "ready" | "passedRehearsalRoots" | "passedFailureDrillRunIds" | "missing"> {
  const relevant = evaluations.filter((item) => item.workSpecId === workSpecId && item.passed);
  const passedRehearsalRoots = [...new Set(relevant.filter((item) => item.runMode === "rehearsal").map((item) => item.rehearsalRootRunId))];
  const passedFailureDrillRunIds = [...new Set(relevant.filter((item) => item.runMode === "failure_drill").map((item) => item.runId))];
  const missing: string[] = [];
  if (passedRehearsalRoots.length < 2) missing.push(`还需要 ${2 - passedRehearsalRoots.length} 次独立通过的预执行`);
  if (passedFailureDrillRunIds.length < 1) missing.push("还需要 1 次通过的失败演练");
  return { workSpecId, ready: missing.length === 0, passedRehearsalRoots, passedFailureDrillRunIds, missing };
}

function localDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function isValidTimezone(timezone: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); return true; }
  catch { return false; }
}

function assertNoSymlinkSegments(root: string, target: string): void {
  const path = relative(root, target);
  if (path.startsWith("../") || path === "..") throw new Error("KNOWLEDGE_PATH_NOT_ALLOWED");
  let cursor = root;
  for (const segment of path.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error("KNOWLEDGE_SYMLINK_NOT_ALLOWED");
  }
}

function isWritableRealDirectory(path: string): boolean {
  try {
    if (lstatSync(path).isSymbolicLink() || !statSync(path).isDirectory()) return false;
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function collectMarkdown(root: string): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(path);
    }
  };
  walk(root);
  return files;
}

function parseMarkdown(content: string, relativePath: string): { title: string; body: string; frontmatter: Record<string, unknown>; tags: string[] } {
  const frontmatter: Record<string, unknown> = {};
  let body = content;
  if (content.startsWith("---\n")) {
    const end = content.indexOf("\n---\n", 4);
    if (end >= 0) {
      const block = content.slice(4, end);
      body = content.slice(end + 5);
      const lines = block.split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]!;
        if (/^\s/.test(line)) continue;
        const separator = line.indexOf(":");
        if (separator <= 0) continue;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        if (value) {
          frontmatter[key] = parseFrontmatterValue(value);
          continue;
        }
        const items: unknown[] = [];
        let cursor = index + 1;
        while (cursor < lines.length) {
          const match = lines[cursor]!.match(/^\s+-\s+(.+)$/);
          if (!match) break;
          items.push(parseFrontmatterValue(match[1]!));
          cursor += 1;
        }
        frontmatter[key] = items.length > 0 ? items : "";
        index = cursor - 1;
      }
    }
  }
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = String(frontmatter.title ?? heading ?? relativePath.split("/").pop()?.replace(/\.md$/i, "") ?? relativePath);
  const rawTags = frontmatter.tags;
  const tags = Array.isArray(rawTags) ? rawTags.map(String) : typeof rawTags === "string" ? rawTags.split(/[\s,]+/).filter(Boolean) : [];
  return { title, body, frontmatter, tags };
}

function parseFrontmatterValue(value: string): unknown {
  if (!value) return "";
  if ((value.startsWith("[") && value.endsWith("]")) || (value.startsWith('"') && value.endsWith('"'))) {
    try { return JSON.parse(value); } catch { /* fall through to permissive parsing */ }
  }
  if (value.startsWith("[") && value.endsWith("]")) return value.slice(1, -1).split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  if (value === "true" || value === "false") return value === "true";
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value.replace(/^['"]|['"]$/g, "");
}

const knowledgeEntityKeys = {
  project: ["project_id", "project_ids"],
  work_spec: ["work_spec_id", "work_spec_ids"],
  run: ["run_id", "run_ids"],
  artifact: ["artifact_id", "artifact_ids"]
} as const;

function extractKnowledgeLinks(frontmatter: Record<string, unknown>): KnowledgeLinkInput[] {
  const links = new Map<string, KnowledgeLinkInput>();
  if (Array.isArray(frontmatter.knowledge_links)) {
    for (const raw of frontmatter.knowledge_links) {
      const item = objectRecord(raw);
      const entityType = String(item.entityType ?? item.entity_type ?? "");
      const entityId = String(item.entityId ?? item.entity_id ?? "").trim();
      const relation = String(item.relation ?? "mentions").trim();
      if (!["project", "work_spec", "run", "artifact"].includes(entityType) || !entityId || !/^[a-z][a-z0-9_-]*$/.test(relation)) continue;
      const link = { entityType: entityType as KnowledgeLinkInput["entityType"], entityId, relation };
      links.set(`${link.entityType}:${entityId}:${relation}`, link);
    }
  }
  for (const [entityType, keys] of Object.entries(knowledgeEntityKeys) as Array<[KnowledgeLinkInput["entityType"], readonly string[]]>) {
    for (const key of keys) {
      const raw = frontmatter[key];
      const values = Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === "" ? [] : [raw];
      for (const value of values) {
        const entityId = String(value).trim();
        if (!entityId) continue;
        const link = { entityType, entityId, relation: "mentions" };
        links.set(`${entityType}:${entityId}:mentions`, link);
      }
    }
  }
  return [...links.values()];
}

function knowledgeFileStem(title: string): string {
  const stem = title.normalize("NFKC").trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}._-]/gu, "").replace(/^\.+|\.+$/g, "").slice(0, 120);
  if (!stem || stem === "." || stem === "..") throw new Error("INVALID_KNOWLEDGE_TITLE");
  return stem;
}

function renderKnowledgeMarkdown(input: { title: string; body: string; tags: string[]; links: KnowledgeLinkInput[]; createdAt: string }): string {
  const lines = ["---", `title: ${JSON.stringify(input.title)}`, `tags: ${JSON.stringify([...new Set(input.tags)])}`, "source: personal-os", `created_at: ${JSON.stringify(input.createdAt)}`];
  if (input.links.length > 0) lines.push(`knowledge_links: ${JSON.stringify(input.links)}`);
  lines.push("---", "", input.body, "");
  return lines.join("\n");
}
