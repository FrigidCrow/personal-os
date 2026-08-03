import { EventEmitter } from "node:events";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, linkSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, watch, writeFileSync, type FSWatcher } from "node:fs";
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
  runReviewInputSchema,
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
  type RunEvent,
  type RunStatus,
  type Schedule,
  type ScheduleInput,
  type ScheduleRebindInput,
  type ScheduleUpdateInput,
  type RuntimeCapabilityScope,
  type SkillDraftInput,
  type SkillDraftValidation,
  type SkillPublishInput,
  type SkillSnapshot,
  type VaultInput,
  type WorkSpec,
  type WorkSpecInput,
  type WorkSpecPreflight,
  type WorkSpecPreflightCheck,
  type WorkSpecRevisionInput,
  type WorkflowOperationsSummary
} from "@personal-os/vnext-contracts";
import { assertRunTransition, calculateBudgetVariance, calculateCashflowForecast, canRetryRun, convertMinorUnits, isTerminalRunStatus, redactSensitiveText, redactSensitiveValue, safeAdd, scheduleFiringKey, transactionFacts } from "@personal-os/vnext-domain";

export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };
const ALL_RUNTIME_SCOPES: RuntimeCapabilityScope[] = [
  "context:read",
  "event:append",
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

export interface CreateRunOptions {
  input?: unknown;
  idempotencyKey?: string;
  retryOfRunId?: string;
  attempt?: number;
  requestId?: string;
}

export class PersonalOsService {
  private readonly emitter = new EventEmitter();
  private readonly controllers = new Map<string, AbortController>();
  private readonly executors = new Map<WorkSpec["executorType"], ExecutorAdapter>();

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
    const run: Run = {
      id: randomUUID(),
      workSpecId,
      projectId: workSpec.projectId,
      executorType: workSpec.executorType,
      status: "queued",
      input: redactSensitiveValue(options.input ?? workSpec.input),
      attempt: options.attempt ?? 1,
      idempotencyKey: options.idempotencyKey ?? null,
      retryOfRunId: options.retryOfRunId ?? null,
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
    this.publish(run.id, { eventType: "run.queued", level: "info", source: "application", message: "运行已进入队列。", structuredData: { workSpecId }, requestId: options.requestId });
    this.audit("run.created", "run", run.id, run, options.requestId, run.id);
    return run;
  }

  async startRun(runId: string, requestId?: string): Promise<Run> {
    let run = this.requireRun(runId);
    if (run.status !== "queued") throw new Error(`RUN_NOT_QUEUED:${run.status}`);
    if (!this.executors.has(run.executorType)) {
      const failed = this.failRun(run, "EXECUTOR_UNAVAILABLE", `执行器 ${run.executorType} 尚未配置。`, requestId);
      this.maybeAutoRetryScheduled(failed, "EXECUTOR_UNAVAILABLE", failed.errorMessage ?? "", requestId);
      return failed;
    }
    run = this.transition(run, "running", { startedAt: this.clock.now().toISOString() }, requestId);
    return await this.executeRunningRun(run, null, requestId);
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
      run: { id: run.id, status: run.status, attempt: run.attempt, executorType: run.executorType, input: run.input, createdAt: run.createdAt, startedAt: run.startedAt },
      workSpec: { id: workSpec.id, kind: workSpec.kind, title: workSpec.title, instructions: workSpec.instructions, skill: workSpec.skill ? { name: workSpec.skill.name, version: workSpec.skill.version, contentHash: workSpec.skill.contentHash, path: workSpec.skill.path } : null },
      project: project ? { id: project.id, name: project.name, repositoryPath: project.repositoryPath, obsidianPath: project.obsidianPath } : null,
      recentEvents: this.store.listRunEvents(run.id).slice(-20),
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

  retryRun(runId: string, requestId?: string): Run {
    const previous = this.requireRun(runId);
    if (!canRetryRun(previous.status)) throw new Error(`RUN_NOT_RETRYABLE:${previous.status}`);
    const workSpec = this.requireWorkSpec(previous.workSpecId);
    if (previous.attempt >= workSpec.maxAttempts) throw new Error("MAX_ATTEMPTS_REACHED");
    return this.createRun(previous.workSpecId, {
      input: previous.input,
      retryOfRunId: previous.id,
      attempt: previous.attempt + 1,
      requestId
    });
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
      const updated = this.transition(latest, effectiveStatus, {
        result: mergedResult,
        usage: redactSensitiveValue(output.usage ?? latest.usage),
        externalRunId,
        reviewStatus: waiting ? "not_required" : "pending",
        reviewedAt: null,
        reviewComment: null,
        finishedAt: waiting ? null : this.clock.now().toISOString()
      }, requestId);
      if (effectiveStatus === "waiting_approval" && !pendingApproval) this.createApproval(updated, requestId);
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

  createDocument(input: KnowledgeCreateInput, requestId?: string): KnowledgeDocumentDetail {
    const parsed = knowledgeCreateInputSchema.parse(input);
    const vault = this.store.getVault(parsed.vaultId);
    if (!vault) throw new Error("VAULT_NOT_FOUND");
    for (const link of parsed.links) if (!this.entityExists(link)) throw new Error(`KNOWLEDGE_LINK_TARGET_NOT_FOUND:${link.entityType}:${link.entityId}`);
    const root = resolve(vault.rootPath);
    if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error("VAULT_PATH_NOT_FOUND");
    if (lstatSync(root).isSymbolicLink()) throw new Error("VAULT_SYMLINK_NOT_ALLOWED");
    const directory = resolve(root, parsed.directory);
    if (!isPathInside(root, directory)) throw new Error("KNOWLEDGE_PATH_NOT_ALLOWED");
    mkdirSync(directory, { recursive: true });
    if (lstatSync(directory).isSymbolicLink()) throw new Error("KNOWLEDGE_SYMLINK_NOT_ALLOWED");
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
      this.store.insertAudit({ actorType: "user", actorId: "local-user", action: "knowledge.document_created", resourceType: "knowledge_document", resourceId: document.id, afterSnapshot: { vaultId: vault.id, relativePath, links: detail.links }, requestId }, now);
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
