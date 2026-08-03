import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { FinanceService, KnowledgeService, PersonalOsService } from "@personal-os/vnext-application";
import { FakeExecutor } from "@personal-os/vnext-runtime";
import { applyMigrations, migrations, SqliteVNextStore } from "./index.js";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("vNext SQLite migrations", () => {
  it("migrates an empty database and remains idempotent", () => {
    const database = new Database(":memory:");
    applyMigrations(database);
    applyMigrations(database);
    expect(database.prepare("SELECT COUNT(*) count FROM schema_migrations").get()).toEqual({ count: migrations.length });
    database.close();
  });

  it("rolls back a failed migration", () => {
    const database = new Database(":memory:");
    expect(() => applyMigrations(database, [{ version: 99, name: "broken", up(db) { db.exec("CREATE TABLE should_rollback(id TEXT); INSERT INTO missing_table VALUES (1)"); } }])).toThrow();
    expect(database.prepare("SELECT name FROM sqlite_master WHERE name='should_rollback'").get()).toBeUndefined();
    expect(database.prepare("SELECT version FROM schema_migrations WHERE version=99").get()).toBeUndefined();
    database.close();
  });

  it("applies governance migration with safe backfill and append-only audit triggers", () => {
    const database = new Database(":memory:");
    applyMigrations(database, migrations.slice(0, 4));
    const now = "2026-08-01T00:00:00.000Z";
    database.prepare(`INSERT INTO work_specs(id,project_id,kind,title,instructions,executor_type,input_json,timeout_seconds,max_attempts,lifecycle_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run("w", null, "one_off", "old", "old", "internal", "{}", 5, 2, "active", now, now);
    database.prepare(`INSERT INTO runs(id,work_spec_id,project_id,executor_type,status,input_json,attempt,created_at,finished_at) VALUES (?,?,?,?,?,?,?,?,?)`).run("r", "w", null, "internal", "succeeded", "{}", 1, now, now);
    database.prepare(`INSERT INTO audit_logs(id,actor_type,actor_id,action,resource_type,resource_id,created_at) VALUES (?,?,?,?,?,?,?)`).run("a", "system", "test", "created", "run", "r", now);
    applyMigrations(database);
    expect(database.prepare("SELECT review_status FROM runs WHERE id='r'").get()).toEqual({ review_status: "accepted" });
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='approvals'").get()).toEqual({ name: "approvals" });
    expect(() => database.prepare("UPDATE audit_logs SET action='changed' WHERE id='a'").run()).toThrow("AUDIT_LOG_APPEND_ONLY");
    expect(() => database.prepare("DELETE FROM audit_logs WHERE id='a'").run()).toThrow("AUDIT_LOG_APPEND_ONLY");
    database.close();
  });

  it("creates the Phase 4 knowledge relation indexes exactly once", () => {
    const database = new Database(":memory:");
    applyMigrations(database);
    applyMigrations(database);
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_links'").get()).toEqual({ name: "knowledge_links" });
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='knowledge_links_entity_idx'").get()).toEqual({ name: "knowledge_links_entity_idx" });
    expect(database.pragma("foreign_key_check")).toEqual([]);
    database.close();
  });

  it("creates all seven Phase 5 finance tables and backfills transaction facts", () => {
    const database = new Database(":memory:");
    applyMigrations(database, migrations.slice(0, 6));
    const now = "2026-08-01T00:00:00.000Z";
    database.prepare("INSERT INTO finance_accounts(id,name,account_type,currency,initial_balance_minor,current_balance_minor,institution,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run("a", "现金", "cash", "CNY", 0, 100, null, 1, now, now);
    database.prepare("INSERT INTO finance_transactions(id,account_id,transaction_type,amount_minor,currency,occurred_at,category,counterparty,description,deleted_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run("t", "a", "income", 100, "CNY", now, null, null, "旧数据", null, now, now);
    applyMigrations(database);
    const names = (database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((row) => row.name);
    expect(names).toEqual(expect.arrayContaining(["finance_categories", "finance_budgets", "finance_calculations", "operating_units", "finance_allocations", "operating_entries", "finance_change_proposals"]));
    expect(database.prepare("SELECT balance_effect_minor,reporting_type,reporting_effect_minor FROM finance_transactions WHERE id='t'").get()).toEqual({ balance_effect_minor: 100, reporting_type: "income", reporting_effect_minor: 100 });
    expect(database.pragma("foreign_key_check")).toEqual([]);
    database.close();
  });
});

describe("vNext repository integrations", () => {
  it("persists a unified run and append-only events", async () => {
    const store = new SqliteVNextStore();
    const fake = new FakeExecutor();
    const service = new PersonalOsService(store, [fake]);
    const workSpec = service.createWorkSpec({ title: "test", instructions: "test", executorType: "fake", input: {}, projectId: null, kind: "one_off", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const first = service.createRun(workSpec.id, { idempotencyKey: "same" });
    expect(service.createRun(workSpec.id, { idempotencyKey: "same" }).id).toBe(first.id);
    await service.startRun(first.id);
    expect(store.getRun(first.id)?.status).toBe("succeeded");
    expect(store.listRunEvents(first.id).map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
    expect(store.listAudit().some((item) => item.action === "run.succeeded")).toBe(true);
    store.close();
  });

  it("indexes and searches Chinese Obsidian markdown incrementally", () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-vault-")); directories.push(root);
    writeFileSync(join(root, "客户A.md"), "---\ntags:\n  - 客户\n  - 项目\n---\n# 客户A\n微信小程序交付记录");
    const store = new SqliteVNextStore();
    const knowledge = new KnowledgeService(store);
    const vault = knowledge.addVault({ name: "test", rootPath: root });
    expect(knowledge.indexVault(vault.id)).toEqual({ indexed: 1, unchanged: 0, deleted: 0, linked: 0, invalidLinks: 0 });
    expect(knowledge.indexVault(vault.id)).toEqual({ indexed: 0, unchanged: 1, deleted: 0, linked: 0, invalidLinks: 0 });
    expect(store.searchKnowledge("微信小程序")[0]).toMatchObject({ title: "客户A", snippet: expect.stringContaining("微信小程序") });
    rmSync(join(root, "客户A.md"));
    expect(knowledge.indexVault(vault.id).deleted).toBe(1);
    expect(store.searchKnowledge("微信小程序")).toHaveLength(0);
    store.close();
  });

  it("indexes frontmatter links, filters by entity and excludes deleted reverse links", () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-links-")); directories.push(root);
    const store = new SqliteVNextStore();
    const execution = new PersonalOsService(store, [new FakeExecutor()]);
    const project = execution.createProject({ name: "中文项目", description: "", repositoryPath: null, obsidianPath: null, status: "active" });
    const workSpec = execution.createWorkSpec({ projectId: project.id, kind: "workflow", title: "知识沉淀", instructions: "整理", executorType: "fake", input: {}, timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = execution.createRun(workSpec.id);
    const artifact = store.insertArtifact({ id: "artifact-phase4", runId: run.id, workSpecId: workSpec.id, projectId: project.id, storageKind: "managed_file", name: "报告", uri: join(root, "report.md"), mimeType: "text/markdown", sizeBytes: null, checksum: null, createdAt: "2026-08-02T00:00:00.000Z" });
    writeFileSync(join(root, "沉淀.md"), `---\ntitle: "中文知识沉淀"\ntags: ["客户", "交付"]\nproject_ids: ["${project.id}", "missing-project"]\nwork_spec_id: "${workSpec.id}"\nrun_id: "${run.id}"\nartifact_id: "${artifact.id}"\n---\n# 中文知识沉淀\n微信支付交付结论`);
    const knowledge = new KnowledgeService(store);
    const vault = knowledge.addVault({ name: "links", rootPath: root });
    expect(knowledge.indexVault(vault.id)).toMatchObject({ indexed: 1, linked: 4, invalidLinks: 1 });
    const document = store.searchKnowledge("微信支付", 10, { tag: "客户", entityType: "project", entityId: project.id })[0];
    expect(document?.title).toBe("中文知识沉淀");
    expect(store.listKnowledgeLinksForDocument(document!.id)).toHaveLength(4);
    expect(knowledge.indexVault(vault.id)).toMatchObject({ indexed: 0, unchanged: 1, linked: 4, invalidLinks: 1 });
    expect(store.listKnowledgeLinksForDocument(document!.id)).toHaveLength(4);
    expect(store.listKnowledgeLinksForEntity("artifact", artifact.id)).toHaveLength(1);
    rmSync(join(root, "沉淀.md"));
    expect(knowledge.indexVault(vault.id).deleted).toBe(1);
    expect(store.listKnowledgeLinksForEntity("artifact", artifact.id)).toHaveLength(0);
    store.close();
  });

  it("searches every control-plane entity with bounded literal matching", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-global-search-")); directories.push(root);
    const store = new SqliteVNextStore();
    const execution = new PersonalOsService(store, [new FakeExecutor()]);
    const project = execution.createProject({ name: "青鸟计划", description: "中文项目搜索", repositoryPath: null, obsidianPath: null, status: "active" });
    const spec = execution.createWorkSpec({ projectId: project.id, kind: "workflow", title: "青鸟采集技能", instructions: "每天采集青鸟数据", executorType: "fake", input: {}, timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = execution.createRun(spec.id);
    await execution.startRun(run.id);
    store.insertArtifact({ id: "bluebird-artifact", runId: run.id, workSpecId: spec.id, projectId: project.id, storageKind: "external", name: "青鸟报告", uri: join(root, "report.md"), mimeType: "text/markdown", sizeBytes: 10, checksum: null, createdAt: "2026-08-02T01:00:00.000Z" });
    writeFileSync(join(root, "洞察.md"), "# 青鸟知识\n青鸟转化路径");
    const knowledge = new KnowledgeService(store);
    const vault = knowledge.addVault({ name: "search", rootPath: root });
    knowledge.indexVault(vault.id);

    expect(new Set(store.searchControlPlane("青鸟", 30).map((item) => item.entityType))).toEqual(new Set(["project", "work_spec", "run", "artifact", "knowledge"]));
    expect(store.searchControlPlane("%_", 30)).toEqual([]);
    expect(store.searchControlPlane("青鸟", 2)).toHaveLength(2);
    expect(execution.searchControlPlane("   ")).toEqual([]);
    store.close();
  });

  it("creates only controlled notes atomically, redacts secrets and refuses overwrite or symlink targets", () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-create-note-")); directories.push(root);
    const outside = mkdtempSync(join(tmpdir(), "personal-os-outside-")); directories.push(outside);
    const store = new SqliteVNextStore();
    const execution = new PersonalOsService(store, [new FakeExecutor()]);
    const project = execution.createProject({ name: "产品", description: "", repositoryPath: null, obsidianPath: null, status: "active" });
    const knowledge = new KnowledgeService(store);
    const vault = knowledge.addVault({ name: "write", rootPath: root });
    const detail = knowledge.createDocument({ vaultId: vault.id, directory: "Generated", title: "阶段四复盘", body: "token=should-not-leak\n正文", tags: ["复盘"], links: [{ entityType: "project", entityId: project.id, relation: "documents" }] });
    expect(detail.document.relativePath).toBe("Generated/阶段四复盘.md");
    expect(detail.links).toMatchObject([{ entityType: "project", entityId: project.id, relation: "documents", source: "generated" }]);
    const onDisk = readFileSync(join(root, detail.document.relativePath), "utf8");
    expect(onDisk).toContain("token=[REDACTED]");
    expect(onDisk).not.toContain("should-not-leak");
    expect(() => knowledge.createDocument({ vaultId: vault.id, directory: "Generated", title: "阶段四复盘", body: "覆盖", tags: [], links: [] })).toThrow("KNOWLEDGE_DOCUMENT_EXISTS");
    expect(() => knowledge.createDocument({ vaultId: vault.id, directory: "Inbox", title: "未知关系", body: "", tags: [], links: [{ entityType: "project", entityId: "missing", relation: "mentions" }] })).toThrow("KNOWLEDGE_LINK_TARGET_NOT_FOUND");
    const redactedTitle = knowledge.createDocument({ vaultId: vault.id, directory: "Inbox", title: "token=title-secret", body: "", tags: [], links: [] });
    expect(redactedTitle.document.relativePath).not.toContain("title-secret");
    expect(readFileSync(join(root, redactedTitle.document.relativePath), "utf8")).not.toContain("title-secret");
    symlinkSync(outside, join(root, "Reports"));
    expect(() => knowledge.createDocument({ vaultId: vault.id, directory: "Reports", title: "越界", body: "", tags: [], links: [] })).toThrow("KNOWLEDGE_SYMLINK_NOT_ALLOWED");
    expect(() => knowledge.createDocument({ vaultId: vault.id, directory: "Inbox", title: "../逃逸", body: "", tags: [], links: [] })).toThrow();
    expect(readFileSync(join(root, detail.document.relativePath), "utf8")).toBe(onDisk);
    store.close();
  });

  it("watches Markdown changes with debounce and releases the watcher", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-watch-")); directories.push(root);
    const store = new SqliteVNextStore();
    const knowledge = new KnowledgeService(store, undefined, 20);
    const vault = knowledge.addVault({ name: "watch", rootPath: root });
    expect(knowledge.startWatchingAll()).toMatchObject({ watchedVaults: 1, lastError: null });
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    writeFileSync(join(root, "自动.md"), "# 自动索引\n本地监听已经生效");
    await waitUntil(() => store.searchKnowledge("本地监听").length === 1);
    expect(knowledge.health()).toMatchObject({ watchedVaults: 1, lastIndexedAt: expect.any(String), lastError: null });
    knowledge.stopWatching();
    expect(knowledge.health().watchedVaults).toBe(0);
    expect(store.getVault(vault.id)).not.toBeNull();
    store.close();
  }, 10_000);

  it("keeps finance balances and monthly summaries consistent", () => {
    const store = new SqliteVNextStore();
    const finance = new FinanceService(store);
    const account = finance.createAccount({ name: "微信", accountType: "virtual", currency: "cny", initialBalanceMinor: 1_000, institution: null });
    finance.createTransaction({ accountId: account.id, transactionType: "income", amountMinor: 5_000, currency: "CNY", occurredAt: "2026-08-01T00:00:00.000Z", category: "项目", counterparty: null, description: "回款" });
    const expense = finance.createTransaction({ accountId: account.id, transactionType: "expense", amountMinor: 1_200, currency: "CNY", occurredAt: "2026-08-02T00:00:00.000Z", category: "工具", counterparty: null, description: "订阅" });
    expect(store.getFinanceAccount(account.id)?.currentBalanceMinor).toBe(4_800);
    expect(store.getMonthlyFinanceSummary("2026-08", "CNY")).toEqual({ month: "2026-08", currency: "CNY", incomeMinor: 5_000, expenseMinor: 1_200, netMinor: 3_800 });
    const proposal = finance.createChangeProposal({ targetTransactionId: expense.id, proposalType: "delete", proposedChanges: {}, rationale: "重复支出" });
    expect(store.getFinanceAccount(account.id)?.currentBalanceMinor).toBe(4_800);
    finance.decideChangeProposal(proposal.id, { decision: "approved", comment: "确认删除" });
    expect(store.getFinanceAccount(account.id)?.currentBalanceMinor).toBe(6_000);
    expect(store.getMonthlyFinanceSummary("2026-08", "CNY").expenseMinor).toBe(0);
    store.close();
  });

  it("rolls back the transaction row when the balance update fails", () => {
    const store = new SqliteVNextStore();
    const finance = new FinanceService(store);
    const account = finance.createAccount({ name: "现金", accountType: "cash", currency: "CNY", initialBalanceMinor: 2_000, institution: null });
    store.connection.exec(`CREATE TRIGGER reject_balance_update BEFORE UPDATE ON finance_accounts BEGIN SELECT RAISE(ABORT, 'balance rejected'); END;`);
    expect(() => finance.createTransaction({ accountId: account.id, transactionType: "expense", amountMinor: 500, currency: "CNY", occurredAt: "2026-08-01T00:00:00.000Z", category: null, counterparty: null, description: "应回滚" })).toThrow("balance rejected");
    expect(store.listFinanceTransactions()).toHaveLength(0);
    expect(store.getFinanceAccount(account.id)?.currentBalanceMinor).toBe(2_000);
    store.close();
  });

  it("posts balanced transfers atomically and excludes both legs from revenue", () => {
    const store = new SqliteVNextStore();
    const finance = new FinanceService(store);
    const from = finance.createAccount({ name: "微信", accountType: "virtual", currency: "CNY", initialBalanceMinor: 10_000, institution: null });
    const to = finance.createAccount({ name: "银行卡", accountType: "bank", currency: "CNY", initialBalanceMinor: 2_000, institution: null });
    const transfer = finance.createTransfer({ fromAccountId: from.id, toAccountId: to.id, fromAmountMinor: 3_000, toAmountMinor: 3_000, occurredAt: "2026-08-02T00:00:00.000Z", rateNumerator: null, rateDenominator: null, description: "归集" });
    expect(transfer.incoming.transferId).toBe(transfer.outgoing.transferId);
    expect(store.getFinanceAccount(from.id)?.currentBalanceMinor).toBe(7_000);
    expect(store.getFinanceAccount(to.id)?.currentBalanceMinor).toBe(5_000);
    expect(finance.monthlySummary("2026-08", "CNY")).toEqual({ month: "2026-08", currency: "CNY", incomeMinor: 0, expenseMinor: 0, netMinor: 0 });
    store.close();
  });

  it("rolls back both transfer legs when the second balance update fails", () => {
    const store = new SqliteVNextStore();
    const finance = new FinanceService(store);
    const from = finance.createAccount({ name: "A", accountType: "cash", currency: "CNY", initialBalanceMinor: 5_000, institution: null });
    const to = finance.createAccount({ name: "B", accountType: "cash", currency: "CNY", initialBalanceMinor: 0, institution: null });
    store.connection.prepare(`CREATE TRIGGER reject_target_balance BEFORE UPDATE ON finance_accounts WHEN OLD.id='${to.id}' BEGIN SELECT RAISE(ABORT, 'target rejected'); END;`).run();
    expect(() => finance.createTransfer({ fromAccountId: from.id, toAccountId: to.id, fromAmountMinor: 1_000, toAmountMinor: 1_000, occurredAt: "2026-08-02T00:00:00.000Z", rateNumerator: null, rateDenominator: null, description: "失败转账" })).toThrow("target rejected");
    expect(store.listFinanceTransactions()).toHaveLength(0);
    expect(store.getFinanceAccount(from.id)?.currentBalanceMinor).toBe(5_000);
    expect(store.getFinanceAccount(to.id)?.currentBalanceMinor).toBe(0);
    store.close();
  });

  it("validates rational FX and refund limits in both cash directions", () => {
    const store = new SqliteVNextStore();
    const finance = new FinanceService(store);
    const cny = finance.createAccount({ name: "人民币", accountType: "bank", currency: "CNY", initialBalanceMinor: 1_000, institution: null });
    const jpy = finance.createAccount({ name: "日元", accountType: "bank", currency: "JPY", initialBalanceMinor: 0, institution: null });
    expect(() => finance.createTransfer({ fromAccountId: cny.id, toAccountId: jpy.id, fromAmountMinor: 101, toAmountMinor: 1_415, occurredAt: "2026-08-02T00:00:00.000Z", rateNumerator: 14, rateDenominator: 1, description: "汇兑" })).toThrow("TRANSFER_RATE_RESULT_MISMATCH");
    finance.createTransfer({ fromAccountId: cny.id, toAccountId: jpy.id, fromAmountMinor: 101, toAmountMinor: 1_414, occurredAt: "2026-08-02T00:00:00.000Z", rateNumerator: 14, rateDenominator: 1, description: "汇兑" });
    const expense = finance.createTransaction({ accountId: cny.id, transactionType: "expense", amountMinor: 300, currency: "CNY", occurredAt: "2026-08-03T00:00:00.000Z", category: "软件", counterparty: null, description: "订阅" });
    finance.createRefund({ originalTransactionId: expense.id, amountMinor: 100, occurredAt: "2026-08-04T00:00:00.000Z", description: "部分退款" });
    expect(() => finance.createRefund({ originalTransactionId: expense.id, amountMinor: 201, occurredAt: "2026-08-05T00:00:00.000Z", description: "超额" })).toThrow("REFUND_EXCEEDS_ORIGINAL");
    const income = finance.createTransaction({ accountId: cny.id, transactionType: "income", amountMinor: 500, currency: "CNY", occurredAt: "2026-08-03T00:00:00.000Z", category: "服务", counterparty: null, description: "回款" });
    finance.createRefund({ originalTransactionId: income.id, amountMinor: 200, occurredAt: "2026-08-04T00:00:00.000Z", description: "退客户" });
    expect(finance.monthlySummary("2026-08", "CNY")).toEqual({ month: "2026-08", currency: "CNY", incomeMinor: 300, expenseMinor: 200, netMinor: 100 });
    store.close();
  });

  it("keeps change proposals inert until approval and preserves history on update", () => {
    const store = new SqliteVNextStore();
    const finance = new FinanceService(store);
    const account = finance.createAccount({ name: "经营账户", accountType: "bank", currency: "CNY", initialBalanceMinor: 0, institution: null });
    const income = finance.createTransaction({ accountId: account.id, transactionType: "income", amountMinor: 1_000, currency: "CNY", occurredAt: "2026-08-01T00:00:00.000Z", category: null, counterparty: null, description: "旧金额" });
    expect(() => finance.deleteTransaction(income.id)).toThrow("FINANCE_CHANGE_PROPOSAL_REQUIRED");
    const proposal = finance.createChangeProposal({ targetTransactionId: income.id, proposalType: "update", proposedChanges: { amountMinor: 1_500, description: "新金额" }, rationale: "凭证修正" });
    expect(store.getFinanceAccount(account.id)?.currentBalanceMinor).toBe(1_000);
    const resolved = finance.decideChangeProposal(proposal.id, { decision: "approved", comment: "已核对" });
    expect(resolved.resultTransactionIds).toHaveLength(2);
    expect(store.getFinanceTransaction(income.id)?.deletedAt).toBeNull();
    expect(store.getFinanceAccount(account.id)?.currentBalanceMinor).toBe(1_500);
    expect(store.listFinanceTransactions().filter((item) => item.reversalOfTransactionId === income.id)).toHaveLength(1);
    expect(() => finance.decideChangeProposal(proposal.id, { decision: "rejected", comment: "重复决定" })).toThrow("FINANCE_PROPOSAL_ALREADY_RESOLVED");
    expect(() => finance.createChangeProposal({ targetTransactionId: income.id, proposalType: "reverse", proposedChanges: {}, rationale: "再次冲销" })).toThrow("TRANSACTION_ALREADY_REVERSED");
    store.close();
  });

  it("rolls back proposal status, new facts and balances when approval fails", () => {
    const store = new SqliteVNextStore();
    const finance = new FinanceService(store);
    const account = finance.createAccount({ name: "故障账户", accountType: "bank", currency: "CNY", initialBalanceMinor: 0, institution: null });
    const transaction = finance.createTransaction({ accountId: account.id, transactionType: "income", amountMinor: 1_000, currency: "CNY", occurredAt: "2026-08-01T00:00:00.000Z", category: null, counterparty: null, description: "原事实" });
    const proposal = finance.createChangeProposal({ targetTransactionId: transaction.id, proposalType: "update", proposedChanges: { amountMinor: 1_500 }, rationale: "修正" });
    store.connection.exec("CREATE TRIGGER reject_proposal_balance BEFORE UPDATE ON finance_accounts BEGIN SELECT RAISE(ABORT, 'proposal balance rejected'); END;");
    expect(() => finance.decideChangeProposal(proposal.id, { decision: "approved", comment: "触发回滚" })).toThrow("proposal balance rejected");
    expect(store.getFinanceChangeProposal(proposal.id)?.status).toBe("pending");
    expect(store.listFinanceTransactions()).toHaveLength(1);
    expect(store.getFinanceAccount(account.id)?.currentBalanceMinor).toBe(1_000);
    store.close();
  });

  it("stores reproducible budgets, forecasts and rational conversions", () => {
    const store = new SqliteVNextStore();
    const finance = new FinanceService(store);
    const account = finance.createAccount({ name: "成本账户", accountType: "bank", currency: "CNY", initialBalanceMinor: 10_000, institution: null });
    const category = finance.createCategory({ name: "软件订阅", kind: "expense" });
    finance.createTransaction({ accountId: account.id, transactionType: "expense", amountMinor: 1_200, currency: "CNY", occurredAt: "2026-08-02T00:00:00.000Z", categoryId: category.id, category: category.name, counterparty: null, description: "工具" });
    const first = finance.setBudget({ month: "2026-08", currency: "CNY", categoryId: category.id, plannedMinor: 2_000 });
    const updated = finance.setBudget({ month: "2026-08", currency: "CNY", categoryId: category.id, plannedMinor: 2_500 });
    expect(updated.id).toBe(first.id);
    expect(finance.listBudgets("2026-08", "CNY")).toHaveLength(1);
    expect(store.listAudit().some((item) => item.action === "finance.budget_updated" && item.beforeSnapshot !== null)).toBe(true);
    const variance = finance.calculateBudgetVariance({ month: "2026-08", currency: "CNY" });
    expect(variance).toMatchObject({ formulaVersion: "budget-variance-v1", result: { totalVarianceMinor: 1_300 } });
    expect(variance.inputSnapshot).toMatchObject({ month: "2026-08", currency: "CNY", items: [{ plannedMinor: 2_500, actualMinor: 1_200, varianceMinor: 1_300 }] });
    expect(finance.replayCalculation(variance.id).matches).toBe(true);
    const forecast = finance.calculateCashflow({ currency: "CNY", openingBalanceMinor: 10_000, months: [{ month: "2026-09", expectedIncomeMinor: 5_000, expectedExpenseMinor: 2_000 }] });
    expect(finance.replayCalculation(forecast.id)).toMatchObject({ matches: true, result: { closingBalanceMinor: 13_000 } });
    const conversion = finance.calculateConversion({ amountMinor: 101, fromCurrency: "CNY", toCurrency: "JPY", rateNumerator: 14, rateDenominator: 1 });
    expect(conversion).toMatchObject({ formulaVersion: "currency-rational-v1", result: { convertedMinor: 1_414, unroundedNumerator: "1414" } });
    expect(finance.replayCalculation(conversion.id).matches).toBe(true);
    store.close();
  });

  it("separates allocated cash, expected money and time for an operating unit", () => {
    const store = new SqliteVNextStore();
    const finance = new FinanceService(store);
    const account = finance.createAccount({ name: "项目账户", accountType: "bank", currency: "CNY", initialBalanceMinor: 0, institution: null });
    const unit = finance.createOperatingUnit({ name: "汽水音乐实验", unitType: "radar", referenceId: "radar-qishui", currency: "CNY" });
    const income = finance.createTransaction({ accountId: account.id, transactionType: "income", amountMinor: 2_000, currency: "CNY", occurredAt: "2026-08-01T00:00:00.000Z", category: null, counterparty: null, description: "收入" });
    const allocation = finance.allocate({ transactionId: income.id, operatingUnitId: unit.id, amountMinor: 1_200, idempotencyKey: "allocation-1" });
    expect(finance.allocate({ transactionId: income.id, operatingUnitId: unit.id, amountMinor: 1_200, idempotencyKey: "allocation-1" }).id).toBe(allocation.id);
    expect(() => finance.allocate({ transactionId: income.id, operatingUnitId: unit.id, amountMinor: 1_300, idempotencyKey: "allocation-1" })).toThrow("ALLOCATION_IDEMPOTENCY_CONFLICT");
    const secondUnit = finance.createOperatingUnit({ name: "第二单元", unitType: "custom", referenceId: "second-unit", currency: "CNY" });
    expect(() => finance.allocate({ transactionId: income.id, operatingUnitId: secondUnit.id, amountMinor: 801, idempotencyKey: "allocation-2" })).toThrow("ALLOCATION_EXCEEDS_TRANSACTION");
    finance.createOperatingEntry({ operatingUnitId: unit.id, entryType: "expected_income", amountMinor: 5_000, currency: "CNY", minutes: null, description: "预计", occurredAt: "2026-08-01T00:00:00.000Z" });
    finance.createOperatingEntry({ operatingUnitId: unit.id, entryType: "committed_cost", amountMinor: 800, currency: "CNY", minutes: null, description: "承诺成本", occurredAt: "2026-08-01T00:00:00.000Z" });
    finance.createOperatingEntry({ operatingUnitId: unit.id, entryType: "time", amountMinor: null, currency: null, minutes: 90, description: "调研", occurredAt: "2026-08-01T00:00:00.000Z" });
    expect(finance.operatingSummary(unit.id)).toEqual({ operatingUnitId: unit.id, currency: "CNY", actualIncomeMinor: 1_200, actualExpenseMinor: 0, expectedIncomeMinor: 5_000, committedCostMinor: 800, timeMinutes: 90 });
    store.close();
  });

  it("allows a runtime to create only redacted proposals", () => {
    const store = new SqliteVNextStore();
    const finance = new FinanceService(store);
    const account = finance.createAccount({ name: "账户", accountType: "cash", currency: "CNY", initialBalanceMinor: 0, institution: null });
    const transaction = finance.createTransaction({ accountId: account.id, transactionType: "income", amountMinor: 100, currency: "CNY", occurredAt: "2026-08-01T00:00:00.000Z", category: null, counterparty: null, description: "事实" });
    const proposal = finance.createChangeProposal({ targetTransactionId: transaction.id, proposalType: "update", proposedChanges: { description: "api_key: super-secret" }, rationale: "token=super-secret" }, "runtime");
    expect(proposal.requestedBy).toBe("runtime");
    expect(JSON.stringify(proposal)).not.toContain("super-secret");
    expect(store.getFinanceAccount(account.id)?.currentBalanceMinor).toBe(100);
    store.close();
  });
});

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 250; index += 1) {
    if (predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  throw new Error("CONDITION_NOT_REACHED");
}
