import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type {
  AuditInput,
  FinanceWriteSet,
  KnowledgeUpsert,
  NewRunEvent,
  VNextStore
} from "@personal-os/vnext-application";
import type {
  Approval,
  AuditLog,
  Artifact,
  ControlPlaneSearchResult,
  FinanceAccount,
  FinanceAllocation,
  FinanceBudget,
  FinanceCalculation,
  FinanceCategory,
  FinanceChangeProposal,
  FinanceTransaction,
  KnowledgeDocument,
  KnowledgeLink,
  KnowledgeLinkInput,
  KnowledgeLinkSource,
  KnowledgeSearchFilters,
  KnowledgeVault,
  MonthlyFinanceSummary,
  OperatingEntry,
  OperatingUnit,
  Project,
  Run,
  RunEvent,
  Schedule,
  WorkSpec,
  SkillSnapshot
} from "@personal-os/vnext-contracts";
import { applyMigrations, migrations, type Migration } from "./migrations.js";

export { applyMigrations, migrations, type Migration } from "./migrations.js";

type Row = Record<string, unknown>;

export class SqliteVNextStore implements VNextStore {
  readonly connection: Database.Database;

  constructor(path = ":memory:", options: { migrate?: boolean; migrations?: Migration[] } = {}) {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
    this.connection = new Database(path);
    this.connection.pragma("foreign_keys = ON");
    this.connection.pragma("journal_mode = WAL");
    this.connection.pragma("busy_timeout = 5000");
    if (options.migrate !== false) applyMigrations(this.connection, options.migrations ?? migrations);
  }

  close(): void { this.connection.close(); }

  listProjects(): Project[] {
    return (this.connection.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as Row[]).map(projectFromRow);
  }
  getProject(id: string): Project | null {
    return mapOne(this.connection.prepare("SELECT * FROM projects WHERE id = ?").get(id), projectFromRow);
  }
  insertProject(project: Project): Project {
    this.connection.prepare(`INSERT INTO projects(id,name,description,repository_path,obsidian_path,status,created_at,updated_at) VALUES (@id,@name,@description,@repositoryPath,@obsidianPath,@status,@createdAt,@updatedAt)`).run(project);
    return project;
  }

  listWorkSpecs(filters: { projectId?: string; kind?: WorkSpec["kind"] } = {}): WorkSpec[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.projectId) { conditions.push("project_id = ?"); params.push(filters.projectId); }
    if (filters.kind) { conditions.push("kind = ?"); params.push(filters.kind); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return (this.connection.prepare(`SELECT * FROM work_specs ${where} ORDER BY updated_at DESC`).all(...params) as Row[]).map(workSpecFromRow);
  }
  getWorkSpec(id: string): WorkSpec | null {
    return mapOne(this.connection.prepare("SELECT * FROM work_specs WHERE id = ?").get(id), workSpecFromRow);
  }
  insertWorkSpec(workSpec: WorkSpec): WorkSpec {
    this.connection.prepare(`INSERT INTO work_specs(id,project_id,kind,title,instructions,executor_type,input_json,timeout_seconds,max_attempts,lifecycle_status,skill_json,created_at,updated_at) VALUES (@id,@projectId,@kind,@title,@instructions,@executorType,@inputJson,@timeoutSeconds,@maxAttempts,@lifecycleStatus,@skillJson,@createdAt,@updatedAt)`).run({ ...workSpec, inputJson: stringify(workSpec.input), skillJson: stringifyNullable(workSpec.skill) });
    return workSpec;
  }
  updateWorkSpec(workSpec: WorkSpec): WorkSpec {
    const result = this.connection.prepare("UPDATE work_specs SET lifecycle_status=@lifecycleStatus,updated_at=@updatedAt WHERE id=@id").run(workSpec);
    if (result.changes !== 1) throw new Error("WORK_SPEC_NOT_FOUND");
    return workSpec;
  }

  searchControlPlane(query: string, limit = 30): ControlPlaneSearchResult[] {
    const needle = query.trim().slice(0, 200);
    if (!needle) return [];
    const bounded = Math.max(1, Math.min(100, Math.floor(limit)));
    const perEntity = Math.max(2, Math.ceil(bounded / 5));
    const pattern = `%${escapeLike(needle)}%`;
    const results: ControlPlaneSearchResult[] = [];

    const projectRows = this.connection.prepare(`SELECT id,name,description,repository_path,obsidian_path,updated_at FROM projects WHERE name LIKE ? ESCAPE '\\' COLLATE NOCASE OR description LIKE ? ESCAPE '\\' COLLATE NOCASE OR COALESCE(repository_path,'') LIKE ? ESCAPE '\\' COLLATE NOCASE OR COALESCE(obsidian_path,'') LIKE ? ESCAPE '\\' COLLATE NOCASE ORDER BY updated_at DESC LIMIT ?`).all(pattern, pattern, pattern, pattern, perEntity) as Row[];
    for (const row of projectRows) results.push({ entityType: "project", id: string(row, "id"), title: string(row, "name"), summary: string(row, "description") || nullableString(row, "repository_path") || "项目", updatedAt: string(row, "updated_at"), projectId: string(row, "id"), workSpecId: null, runId: null });

    const workSpecRows = this.connection.prepare(`SELECT id,project_id,title,instructions,kind,updated_at FROM work_specs WHERE title LIKE ? ESCAPE '\\' COLLATE NOCASE OR instructions LIKE ? ESCAPE '\\' COLLATE NOCASE ORDER BY updated_at DESC LIMIT ?`).all(pattern, pattern, perEntity) as Row[];
    for (const row of workSpecRows) results.push({ entityType: "work_spec", id: string(row, "id"), title: string(row, "title"), summary: `${string(row, "kind") === "workflow" ? "固定 Skill 版本" : "一次性工作"} · ${excerpt(string(row, "instructions"))}`, updatedAt: string(row, "updated_at"), projectId: nullableString(row, "project_id"), workSpecId: string(row, "id"), runId: null });

    const runRows = this.connection.prepare(`SELECT r.id,r.project_id,r.work_spec_id,r.status,r.executor_type,r.error_message,r.created_at,w.title FROM runs r JOIN work_specs w ON w.id=r.work_spec_id WHERE r.id LIKE ? ESCAPE '\\' COLLATE NOCASE OR r.status LIKE ? ESCAPE '\\' COLLATE NOCASE OR r.executor_type LIKE ? ESCAPE '\\' COLLATE NOCASE OR COALESCE(r.error_message,'') LIKE ? ESCAPE '\\' COLLATE NOCASE OR w.title LIKE ? ESCAPE '\\' COLLATE NOCASE ORDER BY r.created_at DESC LIMIT ?`).all(pattern, pattern, pattern, pattern, pattern, perEntity) as Row[];
    for (const row of runRows) results.push({ entityType: "run", id: string(row, "id"), title: string(row, "title"), summary: `${string(row, "status")} · ${string(row, "executor_type")}${nullableString(row, "error_message") ? ` · ${excerpt(nullableString(row, "error_message") ?? "")}` : ""}`, updatedAt: string(row, "created_at"), projectId: nullableString(row, "project_id"), workSpecId: string(row, "work_spec_id"), runId: string(row, "id") });

    const artifactRows = this.connection.prepare(`SELECT id,run_id,work_spec_id,project_id,name,uri,storage_kind,created_at FROM artifacts WHERE name LIKE ? ESCAPE '\\' COLLATE NOCASE OR uri LIKE ? ESCAPE '\\' COLLATE NOCASE OR storage_kind LIKE ? ESCAPE '\\' COLLATE NOCASE ORDER BY created_at DESC LIMIT ?`).all(pattern, pattern, pattern, perEntity) as Row[];
    for (const row of artifactRows) results.push({ entityType: "artifact", id: string(row, "id"), title: string(row, "name"), summary: `${string(row, "storage_kind")} · ${excerpt(string(row, "uri"))}`, updatedAt: string(row, "created_at"), projectId: nullableString(row, "project_id"), workSpecId: nullableString(row, "work_spec_id"), runId: nullableString(row, "run_id") });

    for (const document of this.searchKnowledge(needle, perEntity)) results.push({ entityType: "knowledge", id: document.id, title: document.title, summary: document.snippet ? stripSearchMarkup(document.snippet) : document.relativePath, updatedAt: document.modifiedAt, projectId: null, workSpecId: null, runId: null });
    return results.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title, "zh-CN")).slice(0, bounded);
  }

  listRuns(limit = 100): Run[] {
    return (this.connection.prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?").all(limit) as Row[]).map(runFromRow);
  }
  getRun(id: string): Run | null {
    return mapOne(this.connection.prepare("SELECT * FROM runs WHERE id = ?").get(id), runFromRow);
  }
  findRunByIdempotencyKey(key: string): Run | null {
    return mapOne(this.connection.prepare("SELECT * FROM runs WHERE idempotency_key = ?").get(key), runFromRow);
  }
  insertRun(run: Run): Run {
    this.connection.prepare(`INSERT INTO runs(id,work_spec_id,project_id,executor_type,status,input_json,attempt,idempotency_key,retry_of_run_id,external_run_id,error_code,error_message,result_json,usage_json,actual_cost_minor,actual_cost_currency,cost_source,review_status,reviewed_at,review_comment,created_at,started_at,finished_at) VALUES (@id,@workSpecId,@projectId,@executorType,@status,@inputJson,@attempt,@idempotencyKey,@retryOfRunId,@externalRunId,@errorCode,@errorMessage,@resultJson,@usageJson,@actualCostMinor,@actualCostCurrency,@costSource,@reviewStatus,@reviewedAt,@reviewComment,@createdAt,@startedAt,@finishedAt)`).run({ ...run, inputJson: stringify(run.input), resultJson: stringifyNullable(run.result), usageJson: stringifyNullable(run.usage) });
    return run;
  }
  updateRun(run: Run): Run {
    const result = this.connection.prepare(`UPDATE runs SET status=@status,input_json=@inputJson,external_run_id=@externalRunId,error_code=@errorCode,error_message=@errorMessage,result_json=@resultJson,usage_json=@usageJson,actual_cost_minor=@actualCostMinor,actual_cost_currency=@actualCostCurrency,cost_source=@costSource,review_status=@reviewStatus,reviewed_at=@reviewedAt,review_comment=@reviewComment,started_at=@startedAt,finished_at=@finishedAt WHERE id=@id`).run({ ...run, inputJson: stringify(run.input), resultJson: stringifyNullable(run.result), usageJson: stringifyNullable(run.usage) });
    if (result.changes !== 1) throw new Error("RUN_NOT_FOUND");
    return run;
  }
  appendRunEvent(runId: string, event: NewRunEvent, createdAt: string): RunEvent {
    return this.connection.transaction(() => {
      const row = this.connection.prepare("SELECT COALESCE(MAX(sequence), 0) AS sequence FROM run_events WHERE run_id = ?").get(runId) as { sequence: number };
      const created: RunEvent = {
        id: randomUUID(), runId, eventType: event.eventType, level: event.level, source: event.source,
        message: event.message, structuredData: event.structuredData ?? null, sequence: row.sequence + 1,
        requestId: event.requestId ?? null, createdAt
      };
      this.connection.prepare(`INSERT INTO run_events(id,run_id,event_type,level,source,message,structured_data_json,sequence,request_id,created_at) VALUES (@id,@runId,@eventType,@level,@source,@message,@structuredDataJson,@sequence,@requestId,@createdAt)`).run({ ...created, structuredDataJson: stringifyNullable(created.structuredData) });
      return created;
    })();
  }
  listRunEvents(runId: string, afterSequence = 0): RunEvent[] {
    return (this.connection.prepare("SELECT * FROM run_events WHERE run_id = ? AND sequence > ? ORDER BY sequence").all(runId, afterSequence) as Row[]).map(runEventFromRow);
  }

  listSchedules(): Schedule[] {
    return (this.connection.prepare("SELECT * FROM schedules ORDER BY next_run_at").all() as Row[]).map(scheduleFromRow);
  }
  getSchedule(id: string): Schedule | null {
    return mapOne(this.connection.prepare("SELECT * FROM schedules WHERE id = ?").get(id), scheduleFromRow);
  }
  insertSchedule(schedule: Schedule): Schedule {
    this.connection.prepare(`INSERT INTO schedules(id,work_spec_id,name,cron_expression,timezone,enabled,catch_up,next_run_at,last_run_at,created_at,updated_at) VALUES (@id,@workSpecId,@name,@cronExpression,@timezone,@enabled,@catchUp,@nextRunAt,@lastRunAt,@createdAt,@updatedAt)`).run({ ...schedule, enabled: int(schedule.enabled), catchUp: int(schedule.catchUp) });
    return schedule;
  }
  updateSchedule(schedule: Schedule): Schedule {
    const result = this.connection.prepare(`UPDATE schedules SET name=@name,cron_expression=@cronExpression,timezone=@timezone,enabled=@enabled,catch_up=@catchUp,next_run_at=@nextRunAt,last_run_at=@lastRunAt,updated_at=@updatedAt WHERE id=@id`).run({ ...schedule, enabled: int(schedule.enabled), catchUp: int(schedule.catchUp) });
    if (result.changes !== 1) throw new Error("SCHEDULE_NOT_FOUND");
    return schedule;
  }
  claimScheduleFiring(scheduleId: string, scheduledFor: string, key: string, createdAt: string): boolean {
    const result = this.connection.prepare("INSERT OR IGNORE INTO schedule_firings(idempotency_key,schedule_id,scheduled_for,created_at) VALUES (?,?,?,?)").run(key, scheduleId, scheduledFor, createdAt);
    return result.changes === 1;
  }

  insertAudit(input: AuditInput, createdAt: string): AuditLog {
    const log: AuditLog = {
      id: randomUUID(), actorType: input.actorType, actorId: input.actorId, action: input.action,
      resourceType: input.resourceType, resourceId: input.resourceId,
      beforeSnapshot: input.beforeSnapshot ?? null, afterSnapshot: input.afterSnapshot ?? null,
      requestId: input.requestId ?? null, runId: input.runId ?? null, createdAt
    };
    this.connection.prepare(`INSERT INTO audit_logs(id,actor_type,actor_id,action,resource_type,resource_id,before_snapshot_json,after_snapshot_json,request_id,run_id,created_at) VALUES (@id,@actorType,@actorId,@action,@resourceType,@resourceId,@beforeJson,@afterJson,@requestId,@runId,@createdAt)`).run({ ...log, beforeJson: stringifyNullable(log.beforeSnapshot), afterJson: stringifyNullable(log.afterSnapshot) });
    return log;
  }
  listAudit(limit = 100): AuditLog[] {
    return (this.connection.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?").all(limit) as Row[]).map(auditFromRow);
  }
  listApprovals(status?: Approval["status"]): Approval[] {
    const rows = status
      ? this.connection.prepare("SELECT * FROM approvals WHERE status=? ORDER BY requested_at DESC").all(status)
      : this.connection.prepare("SELECT * FROM approvals ORDER BY requested_at DESC").all();
    return (rows as Row[]).map(approvalFromRow);
  }
  getApproval(id: string): Approval | null {
    return mapOne(this.connection.prepare("SELECT * FROM approvals WHERE id=?").get(id), approvalFromRow);
  }
  getPendingApprovalForRun(runId: string): Approval | null {
    return mapOne(this.connection.prepare("SELECT * FROM approvals WHERE run_id=? AND status='pending'").get(runId), approvalFromRow);
  }
  insertApproval(approval: Approval): Approval {
    this.connection.prepare(`INSERT INTO approvals(id,run_id,request_type,risk_level,summary,payload_json,status,expires_at,requested_at,resolved_at,resolution_comment) VALUES (@id,@runId,@requestType,@riskLevel,@summary,@payloadJson,@status,@expiresAt,@requestedAt,@resolvedAt,@resolutionComment)`).run({ ...approval, payloadJson: stringify(approval.payload) });
    return approval;
  }
  updateApproval(approval: Approval): Approval {
    const result = this.connection.prepare(`UPDATE approvals SET status=@status,resolved_at=@resolvedAt,resolution_comment=@resolutionComment WHERE id=@id AND status='pending'`).run(approval);
    if (result.changes !== 1) throw new Error("APPROVAL_ALREADY_RESOLVED");
    return approval;
  }
  listArtifacts(limit = 100): Artifact[] {
    return (this.connection.prepare("SELECT * FROM artifacts ORDER BY created_at DESC LIMIT ?").all(limit) as Row[]).map(artifactFromRow);
  }
  listArtifactsForRun(runId: string): Artifact[] {
    return (this.connection.prepare("SELECT * FROM artifacts WHERE run_id=? ORDER BY created_at").all(runId) as Row[]).map(artifactFromRow);
  }
  getArtifact(id: string): Artifact | null {
    return mapOne(this.connection.prepare("SELECT * FROM artifacts WHERE id=?").get(id), artifactFromRow);
  }
  insertArtifact(artifact: Artifact): Artifact {
    this.connection.prepare(`INSERT OR IGNORE INTO artifacts(id,run_id,work_spec_id,project_id,storage_kind,name,uri,mime_type,size_bytes,checksum,created_at) VALUES (@id,@runId,@workSpecId,@projectId,@storageKind,@name,@uri,@mimeType,@sizeBytes,@checksum,@createdAt)`).run(artifact);
    return mapOne(this.connection.prepare("SELECT * FROM artifacts WHERE run_id=? AND storage_kind=? AND uri=?").get(artifact.runId, artifact.storageKind, artifact.uri), artifactFromRow) ?? artifact;
  }

  listVaults(): KnowledgeVault[] {
    return (this.connection.prepare("SELECT * FROM knowledge_vaults ORDER BY name").all() as Row[]).map(vaultFromRow);
  }
  getVault(id: string): KnowledgeVault | null {
    return mapOne(this.connection.prepare("SELECT * FROM knowledge_vaults WHERE id = ?").get(id), vaultFromRow);
  }
  insertVault(vault: KnowledgeVault): KnowledgeVault {
    this.connection.prepare("INSERT INTO knowledge_vaults(id,name,root_path,created_at,updated_at) VALUES (@id,@name,@rootPath,@createdAt,@updatedAt)").run(vault);
    return vault;
  }
  getKnowledgeDocument(id: string): KnowledgeDocument | null {
    return mapOne(this.connection.prepare("SELECT * FROM knowledge_documents WHERE id = ?").get(id), knowledgeFromRow);
  }
  getKnowledgeDocumentByPath(vaultId: string, relativePath: string): KnowledgeDocument | null {
    return mapOne(this.connection.prepare("SELECT * FROM knowledge_documents WHERE vault_id = ? AND relative_path = ?").get(vaultId, relativePath), knowledgeFromRow);
  }
  upsertKnowledgeDocument(document: KnowledgeUpsert): KnowledgeDocument {
    this.connection.transaction(() => {
      this.connection.prepare(`INSERT INTO knowledge_documents(id,vault_id,relative_path,title,body,content_hash,frontmatter_json,tags_json,modified_at,indexed_at,deleted_at) VALUES (@id,@vaultId,@relativePath,@title,@body,@contentHash,@frontmatterJson,@tagsJson,@modifiedAt,@indexedAt,NULL)
        ON CONFLICT(vault_id,relative_path) DO UPDATE SET title=excluded.title,body=excluded.body,content_hash=excluded.content_hash,frontmatter_json=excluded.frontmatter_json,tags_json=excluded.tags_json,modified_at=excluded.modified_at,indexed_at=excluded.indexed_at,deleted_at=NULL`).run({ ...document, frontmatterJson: stringify(document.frontmatter), tagsJson: stringify(document.tags) });
      this.connection.prepare("DELETE FROM knowledge_fts WHERE document_id = ?").run(document.id);
      this.connection.prepare("INSERT INTO knowledge_fts(document_id,title,body,tags) VALUES (?,?,?,?)").run(document.id, document.title, document.body, document.tags.join(" "));
    })();
    return this.getKnowledgeDocumentByPath(document.vaultId, document.relativePath)!;
  }
  markMissingKnowledgeDocumentsDeleted(vaultId: string, presentPaths: string[], deletedAt: string): number {
    const active = this.connection.prepare("SELECT id,relative_path FROM knowledge_documents WHERE vault_id=? AND deleted_at IS NULL").all(vaultId) as Array<{ id: string; relative_path: string }>;
    const present = new Set(presentPaths);
    const missing = active.filter((row) => !present.has(row.relative_path));
    const update = this.connection.prepare("UPDATE knowledge_documents SET deleted_at=? WHERE id=?");
    const remove = this.connection.prepare("DELETE FROM knowledge_fts WHERE document_id=?");
    this.connection.transaction(() => {
      for (const row of missing) { update.run(deletedAt, row.id); remove.run(row.id); }
    })();
    return missing.length;
  }
  replaceKnowledgeLinks(documentId: string, source: KnowledgeLinkSource, links: KnowledgeLinkInput[], createdAt: string): KnowledgeLink[] {
    this.connection.transaction(() => {
      this.connection.prepare("DELETE FROM knowledge_links WHERE document_id=? AND source=?").run(documentId, source);
      const insert = this.connection.prepare("INSERT OR IGNORE INTO knowledge_links(id,document_id,entity_type,entity_id,relation,source,created_at) VALUES (?,?,?,?,?,?,?)");
      for (const link of links) insert.run(randomUUID(), documentId, link.entityType, link.entityId, link.relation, source, createdAt);
    })();
    return (this.connection.prepare("SELECT * FROM knowledge_links WHERE document_id=? AND source=? ORDER BY created_at,id").all(documentId, source) as Row[]).map(knowledgeLinkFromRow);
  }
  listKnowledgeLinksForDocument(documentId: string): KnowledgeLink[] {
    return (this.connection.prepare("SELECT * FROM knowledge_links WHERE document_id=? ORDER BY entity_type,entity_id,relation").all(documentId) as Row[]).map(knowledgeLinkFromRow);
  }
  listKnowledgeLinksForEntity(entityType: KnowledgeLink["entityType"], entityId: string): KnowledgeLink[] {
    return (this.connection.prepare(`SELECT l.* FROM knowledge_links l JOIN knowledge_documents d ON d.id=l.document_id
      WHERE l.entity_type=? AND l.entity_id=? AND d.deleted_at IS NULL ORDER BY l.created_at DESC`).all(entityType, entityId) as Row[]).map(knowledgeLinkFromRow);
  }
  searchKnowledge(query: string, limit = 30, filters: KnowledgeSearchFilters = {}): KnowledgeDocument[] {
    const trimmed = query.trim();
    const filterConditions: string[] = [];
    const filterParams: unknown[] = [];
    if (filters.tag?.trim()) {
      filterConditions.push("EXISTS (SELECT 1 FROM json_each(d.tags_json) tag WHERE tag.value = ? COLLATE NOCASE)");
      filterParams.push(filters.tag.trim());
    }
    if (filters.entityType || filters.entityId) {
      const linkConditions = ["link.document_id=d.id"];
      if (filters.entityType) { linkConditions.push("link.entity_type=?"); filterParams.push(filters.entityType); }
      if (filters.entityId) { linkConditions.push("link.entity_id=?"); filterParams.push(filters.entityId); }
      filterConditions.push(`EXISTS (SELECT 1 FROM knowledge_links link WHERE ${linkConditions.join(" AND ")})`);
    }
    const filtered = filterConditions.length ? ` AND ${filterConditions.join(" AND ")}` : "";
    if (!trimmed) return (this.connection.prepare(`SELECT d.* FROM knowledge_documents d WHERE d.deleted_at IS NULL${filtered} ORDER BY d.indexed_at DESC LIMIT ?`).all(...filterParams, limit) as Row[]).map(knowledgeFromRow);
    const like = `%${trimmed.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const rows = this.connection.prepare(`SELECT d.*, snippet(knowledge_fts, 2, '<mark>', '</mark>', '…', 18) AS snippet
      FROM knowledge_fts JOIN knowledge_documents d ON d.id=knowledge_fts.document_id
      WHERE knowledge_fts MATCH ? AND d.deleted_at IS NULL${filtered} LIMIT ?`).all(ftsQuery(trimmed), ...filterParams, limit) as Row[];
    if (rows.length > 0) return rows.map(knowledgeFromRow);
    return (this.connection.prepare(`SELECT d.*, substr(d.body, 1, 180) AS snippet FROM knowledge_documents d WHERE d.deleted_at IS NULL AND (d.title LIKE ? ESCAPE '\\' OR d.body LIKE ? ESCAPE '\\' OR d.tags_json LIKE ? ESCAPE '\\')${filtered} ORDER BY d.indexed_at DESC LIMIT ?`).all(like, like, like, ...filterParams, limit) as Row[]).map(knowledgeFromRow);
  }

  listFinanceAccounts(): FinanceAccount[] {
    return (this.connection.prepare("SELECT * FROM finance_accounts ORDER BY name").all() as Row[]).map(accountFromRow);
  }
  getFinanceAccount(id: string): FinanceAccount | null {
    return mapOne(this.connection.prepare("SELECT * FROM finance_accounts WHERE id=?").get(id), accountFromRow);
  }
  insertFinanceAccount(account: FinanceAccount): FinanceAccount {
    this.connection.prepare(`INSERT INTO finance_accounts(id,name,account_type,currency,initial_balance_minor,current_balance_minor,institution,is_active,created_at,updated_at) VALUES (@id,@name,@accountType,@currency,@initialBalanceMinor,@currentBalanceMinor,@institution,@isActive,@createdAt,@updatedAt)`).run({ ...account, isActive: int(account.isActive) });
    return account;
  }
  listFinanceTransactions(): FinanceTransaction[] {
    return (this.connection.prepare("SELECT * FROM finance_transactions ORDER BY occurred_at DESC").all() as Row[]).map(transactionFromRow);
  }
  getFinanceTransaction(id: string): FinanceTransaction | null {
    return mapOne(this.connection.prepare("SELECT * FROM finance_transactions WHERE id=?").get(id), transactionFromRow);
  }
  postFinanceTransaction(transaction: FinanceTransaction, balanceDeltaMinor: number): FinanceTransaction {
    return this.postFinanceTransactionsAtomically({ transactions: [transaction], accountDeltas: [{ accountId: transaction.accountId, deltaMinor: balanceDeltaMinor }] })[0]!;
  }
  postFinanceTransactionsAtomically(writeSet: FinanceWriteSet): FinanceTransaction[] {
    return this.connection.transaction(() => applyFinanceWriteSet(this.connection, writeSet))();
  }
  softDeleteFinanceTransactionAndAdjustBalance(id: string, deletedAt: string): FinanceTransaction | null {
    return this.connection.transaction(() => {
      const existing = mapOne(this.connection.prepare("SELECT * FROM finance_transactions WHERE id=? AND deleted_at IS NULL").get(id), transactionFromRow);
      if (!existing) return null;
      applyFinanceWriteSet(this.connection, { transactions: [], accountDeltas: [{ accountId: existing.accountId, deltaMinor: -existing.balanceEffectMinor }], deleteTransactionId: id });
      return { ...existing, deletedAt, updatedAt: deletedAt };
    })();
  }
  getMonthlyFinanceSummary(month: string, currency: string): MonthlyFinanceSummary {
    const row = this.connection.prepare(`SELECT
      COALESCE(SUM(CASE WHEN reporting_type='income' THEN reporting_effect_minor ELSE 0 END),0) AS income,
      COALESCE(SUM(CASE WHEN reporting_type='expense' THEN reporting_effect_minor ELSE 0 END),0) AS expense
      FROM finance_transactions WHERE deleted_at IS NULL AND currency=? AND substr(occurred_at,1,7)=?`).get(currency, month) as { income: number; expense: number };
    return { month, currency, incomeMinor: row.income, expenseMinor: row.expense, netMinor: row.income - row.expense };
  }
  listFinanceCategories(): FinanceCategory[] {
    return (this.connection.prepare("SELECT * FROM finance_categories ORDER BY name").all() as Row[]).map(categoryFromRow);
  }
  getFinanceCategory(id: string): FinanceCategory | null {
    return mapOne(this.connection.prepare("SELECT * FROM finance_categories WHERE id=?").get(id), categoryFromRow);
  }
  insertFinanceCategory(category: FinanceCategory): FinanceCategory {
    this.connection.prepare("INSERT INTO finance_categories(id,name,kind,is_active,created_at,updated_at) VALUES (@id,@name,@kind,@isActive,@createdAt,@updatedAt)").run({ ...category, isActive: int(category.isActive) });
    return category;
  }
  listFinanceBudgets(month?: string, currency?: string): FinanceBudget[] {
    const conditions: string[] = [];
    const values: string[] = [];
    if (month) { conditions.push("month=?"); values.push(month); }
    if (currency) { conditions.push("currency=?"); values.push(currency); }
    return (this.connection.prepare(`SELECT * FROM finance_budgets ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY month DESC`).all(...values) as Row[]).map(budgetFromRow);
  }
  getFinanceBudget(month: string, currency: string, categoryId: string): FinanceBudget | null {
    return mapOne(this.connection.prepare("SELECT * FROM finance_budgets WHERE month=? AND currency=? AND category_id=?").get(month, currency, categoryId), budgetFromRow);
  }
  upsertFinanceBudget(budget: FinanceBudget): FinanceBudget {
    this.connection.prepare(`INSERT INTO finance_budgets(id,month,currency,category_id,planned_minor,created_at,updated_at)
      VALUES (@id,@month,@currency,@categoryId,@plannedMinor,@createdAt,@updatedAt)
      ON CONFLICT(month,currency,category_id) DO UPDATE SET planned_minor=excluded.planned_minor,updated_at=excluded.updated_at`).run(budget);
    return this.getFinanceBudget(budget.month, budget.currency, budget.categoryId)!;
  }
  listFinanceCalculations(limit = 100): FinanceCalculation[] {
    return (this.connection.prepare("SELECT * FROM finance_calculations ORDER BY created_at DESC LIMIT ?").all(limit) as Row[]).map(calculationFromRow);
  }
  getFinanceCalculation(id: string): FinanceCalculation | null {
    return mapOne(this.connection.prepare("SELECT * FROM finance_calculations WHERE id=?").get(id), calculationFromRow);
  }
  insertFinanceCalculation(calculation: FinanceCalculation): FinanceCalculation {
    this.connection.prepare(`INSERT INTO finance_calculations(id,calculation_type,formula_version,input_snapshot_json,assumptions_json,result_json,currency,period_start,period_end,created_by,created_at)
      VALUES (@id,@calculationType,@formulaVersion,@inputSnapshotJson,@assumptionsJson,@resultJson,@currency,@periodStart,@periodEnd,@createdBy,@createdAt)`).run({ ...calculation, inputSnapshotJson: stringify(calculation.inputSnapshot), assumptionsJson: stringify(calculation.assumptions), resultJson: stringify(calculation.result) });
    return calculation;
  }
  listOperatingUnits(): OperatingUnit[] {
    return (this.connection.prepare("SELECT * FROM operating_units ORDER BY updated_at DESC").all() as Row[]).map(operatingUnitFromRow);
  }
  getOperatingUnit(id: string): OperatingUnit | null {
    return mapOne(this.connection.prepare("SELECT * FROM operating_units WHERE id=?").get(id), operatingUnitFromRow);
  }
  insertOperatingUnit(unit: OperatingUnit): OperatingUnit {
    this.connection.prepare("INSERT INTO operating_units(id,name,unit_type,reference_id,currency,is_active,created_at,updated_at) VALUES (@id,@name,@unitType,@referenceId,@currency,@isActive,@createdAt,@updatedAt)").run({ ...unit, isActive: int(unit.isActive) });
    return unit;
  }
  listFinanceAllocations(operatingUnitId?: string): FinanceAllocation[] {
    const rows = operatingUnitId
      ? this.connection.prepare("SELECT * FROM finance_allocations WHERE operating_unit_id=? ORDER BY created_at DESC").all(operatingUnitId)
      : this.connection.prepare("SELECT * FROM finance_allocations ORDER BY created_at DESC").all();
    return (rows as Row[]).map(allocationFromRow);
  }
  getFinanceAllocationByIdempotencyKey(key: string): FinanceAllocation | null {
    return mapOne(this.connection.prepare("SELECT * FROM finance_allocations WHERE idempotency_key=?").get(key), allocationFromRow);
  }
  getFinanceAllocation(transactionId: string, operatingUnitId: string): FinanceAllocation | null {
    return mapOne(this.connection.prepare("SELECT * FROM finance_allocations WHERE transaction_id=? AND operating_unit_id=?").get(transactionId, operatingUnitId), allocationFromRow);
  }
  insertFinanceAllocation(allocation: FinanceAllocation): FinanceAllocation {
    this.connection.prepare("INSERT INTO finance_allocations(id,transaction_id,operating_unit_id,amount_minor,currency,idempotency_key,created_at,updated_at) VALUES (@id,@transactionId,@operatingUnitId,@amountMinor,@currency,@idempotencyKey,@createdAt,@updatedAt)").run(allocation);
    return allocation;
  }
  listOperatingEntries(operatingUnitId?: string): OperatingEntry[] {
    const rows = operatingUnitId
      ? this.connection.prepare("SELECT * FROM operating_entries WHERE operating_unit_id=? ORDER BY occurred_at DESC").all(operatingUnitId)
      : this.connection.prepare("SELECT * FROM operating_entries ORDER BY occurred_at DESC").all();
    return (rows as Row[]).map(operatingEntryFromRow);
  }
  insertOperatingEntry(entry: OperatingEntry): OperatingEntry {
    this.connection.prepare("INSERT INTO operating_entries(id,operating_unit_id,entry_type,amount_minor,currency,minutes,description,occurred_at,created_at) VALUES (@id,@operatingUnitId,@entryType,@amountMinor,@currency,@minutes,@description,@occurredAt,@createdAt)").run(entry);
    return entry;
  }
  listFinanceChangeProposals(status?: FinanceChangeProposal["status"]): FinanceChangeProposal[] {
    const rows = status
      ? this.connection.prepare("SELECT * FROM finance_change_proposals WHERE status=? ORDER BY created_at DESC").all(status)
      : this.connection.prepare("SELECT * FROM finance_change_proposals ORDER BY created_at DESC").all();
    return (rows as Row[]).map(changeProposalFromRow);
  }
  getFinanceChangeProposal(id: string): FinanceChangeProposal | null {
    return mapOne(this.connection.prepare("SELECT * FROM finance_change_proposals WHERE id=?").get(id), changeProposalFromRow);
  }
  insertFinanceChangeProposal(proposal: FinanceChangeProposal): FinanceChangeProposal {
    this.connection.prepare(`INSERT INTO finance_change_proposals(id,target_transaction_id,proposal_type,proposed_changes_json,rationale,requested_by,status,result_transaction_ids_json,resolved_at,resolution_comment,created_at)
      VALUES (@id,@targetTransactionId,@proposalType,@proposedChangesJson,@rationale,@requestedBy,@status,@resultTransactionIdsJson,@resolvedAt,@resolutionComment,@createdAt)`).run({ ...proposal, proposedChangesJson: stringify(proposal.proposedChanges), resultTransactionIdsJson: stringify(proposal.resultTransactionIds) });
    return proposal;
  }
  resolveFinanceChangeProposal(proposal: FinanceChangeProposal, writeSet: FinanceWriteSet): FinanceChangeProposal {
    return this.connection.transaction(() => {
      const updated = this.connection.prepare(`UPDATE finance_change_proposals SET status=@status,result_transaction_ids_json=@resultTransactionIdsJson,resolved_at=@resolvedAt,resolution_comment=@resolutionComment WHERE id=@id AND status='pending'`).run({ ...proposal, resultTransactionIdsJson: stringify(proposal.resultTransactionIds) });
      if (updated.changes !== 1) throw new Error("FINANCE_PROPOSAL_ALREADY_RESOLVED");
      applyFinanceWriteSet(this.connection, writeSet);
      return proposal;
    })();
  }
}

function applyFinanceWriteSet(connection: Database.Database, writeSet: FinanceWriteSet): FinanceTransaction[] {
  const mutationAt = writeSet.mutationAt ?? writeSet.transactions[0]?.updatedAt ?? new Date().toISOString();
  if (writeSet.deleteTransactionId) {
    const deleted = connection.prepare("UPDATE finance_transactions SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL").run(mutationAt, mutationAt, writeSet.deleteTransactionId);
    if (deleted.changes !== 1) throw new Error("FINANCE_TRANSACTION_NOT_FOUND_OR_DELETED");
  }
  const insert = connection.prepare(`INSERT INTO finance_transactions(
    id,account_id,transaction_type,amount_minor,currency,occurred_at,category_id,category,counterparty,description,
    balance_effect_minor,reporting_type,reporting_effect_minor,parent_transaction_id,transfer_id,reversal_of_transaction_id,deleted_at,created_at,updated_at
  ) VALUES (
    @id,@accountId,@transactionType,@amountMinor,@currency,@occurredAt,@categoryId,@category,@counterparty,@description,
    @balanceEffectMinor,@reportingType,@reportingEffectMinor,@parentTransactionId,@transferId,@reversalOfTransactionId,@deletedAt,@createdAt,@updatedAt
  )`);
  for (const transaction of writeSet.transactions) insert.run(transaction);
  const deltas = new Map<string, number>();
  for (const delta of writeSet.accountDeltas) {
    const next = (deltas.get(delta.accountId) ?? 0) + delta.deltaMinor;
    if (!Number.isSafeInteger(next)) throw new Error("FINANCE_INTEGER_OVERFLOW");
    deltas.set(delta.accountId, next);
  }
  for (const [accountId, deltaMinor] of deltas) {
    const account = connection.prepare("SELECT current_balance_minor FROM finance_accounts WHERE id=?").get(accountId) as { current_balance_minor: number } | undefined;
    if (!account) throw new Error("FINANCE_ACCOUNT_NOT_FOUND");
    const nextBalance = account.current_balance_minor + deltaMinor;
    if (!Number.isSafeInteger(nextBalance)) throw new Error("FINANCE_INTEGER_OVERFLOW");
    connection.prepare("UPDATE finance_accounts SET current_balance_minor=?,updated_at=? WHERE id=?").run(nextBalance, mutationAt, accountId);
  }
  return writeSet.transactions;
}

function mapOne<T>(value: unknown, mapper: (row: Row) => T): T | null { return value ? mapper(value as Row) : null; }
function string(row: Row, key: string): string { return String(row[key]); }
function nullableString(row: Row, key: string): string | null { return row[key] === null || row[key] === undefined ? null : String(row[key]); }
function number(row: Row, key: string): number { return Number(row[key]); }
function json(row: Row, key: string): unknown { const value = row[key]; return value === null || value === undefined ? null : JSON.parse(String(value)); }
function stringify(value: unknown): string { return JSON.stringify(value ?? null); }
function stringifyNullable(value: unknown): string | null { return value === null || value === undefined ? null : JSON.stringify(value); }
function int(value: boolean): number { return value ? 1 : 0; }
function ftsQuery(value: string): string { return value.split(/\s+/).filter(Boolean).map((token) => `"${token.replaceAll('"', '""')}"`).join(" AND "); }
function escapeLike(value: string): string { return value.replace(/[\\%_]/g, (character) => `\\${character}`); }
function excerpt(value: string): string { const compact = value.replace(/\s+/g, " ").trim(); return compact.length > 150 ? `${compact.slice(0, 147)}...` : compact; }
function stripSearchMarkup(value: string): string { return value.replace(/<\/?mark>/g, ""); }

function projectFromRow(row: Row): Project { return { id: string(row,"id"), name: string(row,"name"), description: string(row,"description"), repositoryPath: nullableString(row,"repository_path"), obsidianPath: nullableString(row,"obsidian_path"), status: string(row,"status") as Project["status"], createdAt: string(row,"created_at"), updatedAt: string(row,"updated_at") }; }
function workSpecFromRow(row: Row): WorkSpec { return { id:string(row,"id"),projectId:nullableString(row,"project_id"),kind:string(row,"kind") as WorkSpec["kind"],title:string(row,"title"),instructions:string(row,"instructions"),executorType:string(row,"executor_type") as WorkSpec["executorType"],input:json(row,"input_json"),timeoutSeconds:number(row,"timeout_seconds"),maxAttempts:number(row,"max_attempts"),lifecycleStatus:string(row,"lifecycle_status") as WorkSpec["lifecycleStatus"],skill:json(row,"skill_json") as SkillSnapshot | null,createdAt:string(row,"created_at"),updatedAt:string(row,"updated_at") }; }
function runFromRow(row: Row): Run { return { id:string(row,"id"),workSpecId:string(row,"work_spec_id"),projectId:nullableString(row,"project_id"),executorType:string(row,"executor_type") as Run["executorType"],status:string(row,"status") as Run["status"],input:json(row,"input_json"),attempt:number(row,"attempt"),idempotencyKey:nullableString(row,"idempotency_key"),retryOfRunId:nullableString(row,"retry_of_run_id"),externalRunId:nullableString(row,"external_run_id"),errorCode:nullableString(row,"error_code"),errorMessage:nullableString(row,"error_message"),result:json(row,"result_json"),usage:json(row,"usage_json"),actualCostMinor:row.actual_cost_minor===null||row.actual_cost_minor===undefined?null:number(row,"actual_cost_minor"),actualCostCurrency:nullableString(row,"actual_cost_currency"),costSource:nullableString(row,"cost_source") as Run["costSource"],reviewStatus:string(row,"review_status") as Run["reviewStatus"],reviewedAt:nullableString(row,"reviewed_at"),reviewComment:nullableString(row,"review_comment"),createdAt:string(row,"created_at"),startedAt:nullableString(row,"started_at"),finishedAt:nullableString(row,"finished_at") }; }
function runEventFromRow(row: Row): RunEvent { return { id:string(row,"id"),runId:string(row,"run_id"),eventType:string(row,"event_type"),level:string(row,"level") as RunEvent["level"],source:string(row,"source"),message:string(row,"message"),structuredData:json(row,"structured_data_json"),sequence:number(row,"sequence"),requestId:nullableString(row,"request_id"),createdAt:string(row,"created_at") }; }
function scheduleFromRow(row: Row): Schedule { return { id:string(row,"id"),workSpecId:string(row,"work_spec_id"),name:string(row,"name"),cronExpression:string(row,"cron_expression"),timezone:string(row,"timezone"),enabled:Boolean(number(row,"enabled")),catchUp:Boolean(number(row,"catch_up")),nextRunAt:string(row,"next_run_at"),lastRunAt:nullableString(row,"last_run_at"),createdAt:string(row,"created_at"),updatedAt:string(row,"updated_at") }; }
function auditFromRow(row: Row): AuditLog { return { id:string(row,"id"),actorType:string(row,"actor_type") as AuditLog["actorType"],actorId:string(row,"actor_id"),action:string(row,"action"),resourceType:string(row,"resource_type"),resourceId:string(row,"resource_id"),beforeSnapshot:json(row,"before_snapshot_json"),afterSnapshot:json(row,"after_snapshot_json"),requestId:nullableString(row,"request_id"),runId:nullableString(row,"run_id"),createdAt:string(row,"created_at") }; }
function approvalFromRow(row: Row): Approval { return { id:string(row,"id"),runId:string(row,"run_id"),requestType:string(row,"request_type") as Approval["requestType"],riskLevel:string(row,"risk_level") as Approval["riskLevel"],summary:string(row,"summary"),payload:json(row,"payload_json"),status:string(row,"status") as Approval["status"],expiresAt:nullableString(row,"expires_at"),requestedAt:string(row,"requested_at"),resolvedAt:nullableString(row,"resolved_at"),resolutionComment:nullableString(row,"resolution_comment") }; }
function artifactFromRow(row: Row): Artifact { return { id:string(row,"id"),runId:nullableString(row,"run_id"),workSpecId:nullableString(row,"work_spec_id"),projectId:nullableString(row,"project_id"),storageKind:string(row,"storage_kind") as Artifact["storageKind"],name:string(row,"name"),uri:string(row,"uri"),mimeType:nullableString(row,"mime_type"),sizeBytes:row.size_bytes === null || row.size_bytes === undefined ? null : number(row,"size_bytes"),checksum:nullableString(row,"checksum"),createdAt:string(row,"created_at") }; }
function vaultFromRow(row: Row): KnowledgeVault { return { id:string(row,"id"),name:string(row,"name"),rootPath:string(row,"root_path"),createdAt:string(row,"created_at"),updatedAt:string(row,"updated_at") }; }
function knowledgeFromRow(row: Row): KnowledgeDocument { return { id:string(row,"id"),vaultId:string(row,"vault_id"),relativePath:string(row,"relative_path"),title:string(row,"title"),contentHash:string(row,"content_hash"),frontmatter:(json(row,"frontmatter_json") ?? {}) as Record<string,unknown>,tags:(json(row,"tags_json") ?? []) as string[],modifiedAt:string(row,"modified_at"),indexedAt:string(row,"indexed_at"),deletedAt:nullableString(row,"deleted_at"),...(row.snippet ? { snippet:String(row.snippet) } : {}) }; }
function knowledgeLinkFromRow(row: Row): KnowledgeLink { return { id:string(row,"id"),documentId:string(row,"document_id"),entityType:string(row,"entity_type") as KnowledgeLink["entityType"],entityId:string(row,"entity_id"),relation:string(row,"relation"),source:string(row,"source") as KnowledgeLink["source"],createdAt:string(row,"created_at") }; }
function accountFromRow(row: Row): FinanceAccount { return { id:string(row,"id"),name:string(row,"name"),accountType:string(row,"account_type") as FinanceAccount["accountType"],currency:string(row,"currency"),initialBalanceMinor:number(row,"initial_balance_minor"),currentBalanceMinor:number(row,"current_balance_minor"),institution:nullableString(row,"institution"),isActive:Boolean(number(row,"is_active")),createdAt:string(row,"created_at"),updatedAt:string(row,"updated_at") }; }
function transactionFromRow(row: Row): FinanceTransaction { return { id:string(row,"id"),accountId:string(row,"account_id"),transactionType:string(row,"transaction_type") as FinanceTransaction["transactionType"],amountMinor:number(row,"amount_minor"),currency:string(row,"currency"),occurredAt:string(row,"occurred_at"),categoryId:nullableString(row,"category_id"),category:nullableString(row,"category"),counterparty:nullableString(row,"counterparty"),description:string(row,"description"),balanceEffectMinor:number(row,"balance_effect_minor"),reportingType:string(row,"reporting_type") as FinanceTransaction["reportingType"],reportingEffectMinor:number(row,"reporting_effect_minor"),parentTransactionId:nullableString(row,"parent_transaction_id"),transferId:nullableString(row,"transfer_id"),reversalOfTransactionId:nullableString(row,"reversal_of_transaction_id"),deletedAt:nullableString(row,"deleted_at"),createdAt:string(row,"created_at"),updatedAt:string(row,"updated_at") }; }
function categoryFromRow(row: Row): FinanceCategory { return { id:string(row,"id"),name:string(row,"name"),kind:string(row,"kind") as FinanceCategory["kind"],isActive:Boolean(number(row,"is_active")),createdAt:string(row,"created_at"),updatedAt:string(row,"updated_at") }; }
function budgetFromRow(row: Row): FinanceBudget { return { id:string(row,"id"),month:string(row,"month"),currency:string(row,"currency"),categoryId:string(row,"category_id"),plannedMinor:number(row,"planned_minor"),createdAt:string(row,"created_at"),updatedAt:string(row,"updated_at") }; }
function calculationFromRow(row: Row): FinanceCalculation { return { id:string(row,"id"),calculationType:string(row,"calculation_type") as FinanceCalculation["calculationType"],formulaVersion:string(row,"formula_version"),inputSnapshot:json(row,"input_snapshot_json"),assumptions:json(row,"assumptions_json"),result:json(row,"result_json"),currency:string(row,"currency"),periodStart:nullableString(row,"period_start"),periodEnd:nullableString(row,"period_end"),createdBy:string(row,"created_by") as FinanceCalculation["createdBy"],createdAt:string(row,"created_at") }; }
function operatingUnitFromRow(row: Row): OperatingUnit { return { id:string(row,"id"),name:string(row,"name"),unitType:string(row,"unit_type") as OperatingUnit["unitType"],referenceId:nullableString(row,"reference_id"),currency:string(row,"currency"),isActive:Boolean(number(row,"is_active")),createdAt:string(row,"created_at"),updatedAt:string(row,"updated_at") }; }
function allocationFromRow(row: Row): FinanceAllocation { return { id:string(row,"id"),transactionId:string(row,"transaction_id"),operatingUnitId:string(row,"operating_unit_id"),amountMinor:number(row,"amount_minor"),currency:string(row,"currency"),idempotencyKey:string(row,"idempotency_key"),createdAt:string(row,"created_at"),updatedAt:string(row,"updated_at") }; }
function operatingEntryFromRow(row: Row): OperatingEntry { return { id:string(row,"id"),operatingUnitId:string(row,"operating_unit_id"),entryType:string(row,"entry_type"),amountMinor:row.amount_minor===null?null:number(row,"amount_minor"),currency:nullableString(row,"currency"),minutes:row.minutes===null?null:number(row,"minutes"),description:string(row,"description"),occurredAt:string(row,"occurred_at"),createdAt:string(row,"created_at") } as OperatingEntry; }
function changeProposalFromRow(row: Row): FinanceChangeProposal { return { id:string(row,"id"),targetTransactionId:string(row,"target_transaction_id"),proposalType:string(row,"proposal_type") as FinanceChangeProposal["proposalType"],proposedChanges:(json(row,"proposed_changes_json") ?? {}) as FinanceChangeProposal["proposedChanges"],rationale:string(row,"rationale"),requestedBy:string(row,"requested_by") as FinanceChangeProposal["requestedBy"],status:string(row,"status") as FinanceChangeProposal["status"],resultTransactionIds:(json(row,"result_transaction_ids_json") ?? []) as string[],resolvedAt:nullableString(row,"resolved_at"),resolutionComment:nullableString(row,"resolution_comment"),createdAt:string(row,"created_at") }; }
