import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FinanceService, KnowledgeService, PersonalOsService, RepositorySkillRegistry, ScheduleService, type ExecutionContext, type ExecutionResult, type ExecutorAdapter } from "@personal-os/vnext-application";
import { SqliteVNextStore } from "@personal-os/vnext-infrastructure";
import { FakeExecutor, InternalExecutor } from "@personal-os/vnext-runtime";
import { createVNextApp } from "./app.js";

function fixture() {
  const store = new SqliteVNextStore();
  const execution = new PersonalOsService(store, [new FakeExecutor(), new InternalExecutor()]);
  const schedules = new ScheduleService(store, execution);
  const knowledge = new KnowledgeService(store);
  const app = createVNextApp({ store, execution, schedules, knowledge, finance: new FinanceService(store) });
  return { store, execution, schedules, knowledge, app };
}

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

async function body<T>(response: Response): Promise<T> { return await response.json() as T; }

describe("vNext API", () => {
  it("reports awaited executor, governance and knowledge health for Phase 7", async () => {
    const { app, store } = fixture();
    const response = await app.request("/api/v2/health");
    expect(await body(response)).toMatchObject({ data: { status: "healthy", version: "0.1.0", pendingApprovals: 0, scheduler: { status: "healthy", serviceEnabled: false }, knowledge: { watchedVaults: 0, lastIndexedAt: null, lastError: null }, executors: expect.any(Array) } });
    store.close();
  });

  it("allows the formal 5273 origin after sovereignty cutover", async () => {
    const { app, store } = fixture();
    const response = await app.request("/api/v2/health", { headers: { origin: "http://127.0.0.1:5273" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5273");
    store.close();
  });

  it("creates a work spec, runs it, and exposes persisted SSE events", async () => {
    const { app, store } = fixture();
    const create = await app.request("/api/v2/work-specs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "日报", instructions: "生成日报", executorType: "internal", input: { operation: "echo", message: "完成", delayMs: 0 } }) });
    expect(create.status).toBe(201);
    const workSpec = (await body<{ data: { id: string } }>(create)).data;
    const start = await app.request(`/api/v2/work-specs/${workSpec.id}/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ start: true, idempotencyKey: "api-run" }) });
    expect(start.status).toBe(202);
    const run = (await body<{ data: { id: string } }>(start)).data;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
    expect(store.getRun(run.id)?.status).toBe("succeeded");
    const stream = await app.request(`/api/v2/runs/${run.id}/events/stream?once=1`);
    const text = await stream.text();
    expect(text).toContain("event: run.succeeded");
    expect(text).toContain("executor.output");
    store.close();
  });

  it("returns validation and not-found envelopes with request ids", async () => {
    const { app, store } = fixture();
    const invalid = await app.request("/api/v2/projects", { method: "POST", headers: { "content-type": "application/json", "x-request-id": "req-test" }, body: "{}" });
    expect(invalid.status).toBe(400);
    expect(await body(invalid)).toMatchObject({ success: false, requestId: "req-test", error: { code: "VALIDATION_ERROR" } });
    const missing = await app.request("/api/v2/runs/missing");
    expect(missing.status).toBe(404);
    store.close();
  });

  it("supports schedules, finance, and audit from the same API", async () => {
    const { app, store, execution } = fixture();
    const workSpec = execution.createWorkSpec({ title: "定时日报", instructions: "日报", executorType: "fake", input: {}, projectId: null, kind: "workflow", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const scheduleResponse = await app.request("/api/v2/schedules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workSpecId: workSpec.id, name: "日报", cronExpression: "0 8 * * *", timezone: "Asia/Tokyo" }) });
    expect(scheduleResponse.status).toBe(201);
    const schedule = (await body<{ data: { id: string; workSpecId: string; nextRunAt: string } }>(scheduleResponse)).data;
    const updatedResponse = await app.request(`/api/v2/schedules/${schedule.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "中文晨报", cronExpression: "30 6 * * *", catchUp: true }) });
    expect(await body(updatedResponse)).toMatchObject({ data: { workSpecId: workSpec.id, name: "中文晨报", cronExpression: "30 6 * * *", catchUp: true } });
    const accountResponse = await app.request("/api/v2/finance/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "现金", accountType: "cash", currency: "CNY", initialBalanceMinor: 0 }) });
    expect(accountResponse.status).toBe(201);
    const audit = await app.request("/api/v2/audit");
    expect((await body<{ data: unknown[] }>(audit)).data.length).toBeGreaterThanOrEqual(3);
    store.close();
  });

  it("exposes Phase 10 Skill, preflight, revision, operations and rebind APIs", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-phase10-api-")); directories.push(root);
    const skillRoot = join(root, "skills");
    const registry = new RepositorySkillRegistry(skillRoot);
    const store = new SqliteVNextStore();
    const execution = new PersonalOsService(store, [new InternalExecutor()], undefined, undefined, registry);
    const schedules = new ScheduleService(store, execution);
    const app = createVNextApp({ store, execution, schedules, knowledge: new KnowledgeService(store), finance: new FinanceService(store), skills: registry });
    const draft = { name: "phase-ten", version: "1.0.0", displayName: "阶段十", description: "验证阶段十工作流。", instructions: "# 阶段十\n\n1. 读取上下文。\n2. 执行并验证。\n3. 提交结果。", expectedCurrentHash: null };
    const checkedResponse = await app.request("/api/v2/skills/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    expect(checkedResponse.status).toBe(200);
    const checked = (await body<{ data: { valid: boolean; candidate: { contentHash: string } } }>(checkedResponse)).data;
    expect(checked.valid).toBe(true);
    const publishResponse = await app.request("/api/v2/skills/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, validatedContentHash: checked.candidate.contentHash }) });
    expect(publishResponse.status).toBe(201);
    const skill = (await body<{ data: unknown }>(publishResponse)).data;
    const firstResponse = await app.request("/api/v2/work-specs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "阶段十工作流", instructions: "执行", executorType: "internal", input: { operation: "echo", message: "ok", delayMs: 0 }, kind: "workflow", skill }) });
    const first = (await body<{ data: { id: string } }>(firstResponse)).data;
    const revisionResponse = await app.request(`/api/v2/work-specs/${first.id}/revisions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "阶段十新版", instructions: "执行并核验", executorType: "internal", input: { operation: "echo", message: "new", delayMs: 0 }, skill }) });
    const revision = (await body<{ data: { id: string; revisionNumber: number; revisionOfWorkSpecId: string } }>(revisionResponse)).data;
    expect(revision).toMatchObject({ revisionNumber: 2, revisionOfWorkSpecId: first.id });
    const scheduleResponse = await app.request("/api/v2/schedules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workSpecId: first.id, name: "阶段十定时", cronExpression: "0 8 * * *", timezone: "Asia/Tokyo" }) });
    const schedule = (await body<{ data: { id: string } }>(scheduleResponse)).data;
    const rebindResponse = await app.request(`/api/v2/schedules/${schedule.id}/rebind`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workSpecId: revision.id }) });
    expect(await body(rebindResponse)).toMatchObject({ data: { workSpecId: revision.id } });
    expect(await body(await app.request(`/api/v2/work-specs/${revision.id}/preflight`))).toMatchObject({ data: { ready: true, checks: expect.any(Array) } });
    expect(await body(await app.request("/api/v2/operations/workflows"))).toMatchObject({ data: expect.arrayContaining([expect.objectContaining({ workSpec: expect.objectContaining({ id: revision.id }), enabledScheduleCount: 1 })]) });
    store.close();
  });

  it("returns unified search results and validates empty queries", async () => {
    const { app, store, execution } = fixture();
    const project = execution.createProject({ name: "统一检索项目", description: "跨五区", repositoryPath: null, obsidianPath: null, status: "active" });
    const spec = execution.createWorkSpec({ title: "统一检索雷达", instructions: "查询统一检索信号", executorType: "fake", input: {}, projectId: project.id, kind: "workflow", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = execution.createRun(spec.id);
    const response = await app.request(`/api/v2/search?q=${encodeURIComponent("统一检索")}&limit=10`);
    const results = (await body<{ data: Array<{ entityType: string; id: string }> }>(response)).data;
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "project", id: project.id }),
      expect.objectContaining({ entityType: "work_spec", id: spec.id }),
      expect.objectContaining({ entityType: "run", id: run.id })
    ]));
    expect((await app.request("/api/v2/search?q=")).status).toBe(400);
    store.close();
  });

  it("exposes the complete finance workflow without direct historical mutation", async () => {
    const { app, store } = fixture();
    const json = { "content-type": "application/json" };
    const createAccount = async (name: string) => (await body<{ data: { id: string } }>(await app.request("/api/v2/finance/accounts", { method: "POST", headers: json, body: JSON.stringify({ name, accountType: "bank", currency: "CNY", initialBalanceMinor: 10_000 }) }))).data;
    const from = await createAccount("经营账户");
    const to = await createAccount("备用账户");
    const category = (await body<{ data: { id: string } }>(await app.request("/api/v2/finance/categories", { method: "POST", headers: json, body: JSON.stringify({ name: "服务收入", kind: "income" }) }))).data;
    const transactionResponse = await app.request("/api/v2/finance/transactions", { method: "POST", headers: json, body: JSON.stringify({ accountId: from.id, transactionType: "income", amountMinor: 2_000, currency: "CNY", occurredAt: "2026-08-01T00:00:00.000Z", categoryId: category.id, description: "客户回款" }) });
    expect(transactionResponse.status).toBe(201);
    const transaction = (await body<{ data: { id: string } }>(transactionResponse)).data;
    const forbiddenAdjustment = await app.request("/api/v2/finance/transactions", { method: "POST", headers: json, body: JSON.stringify({ accountId: from.id, transactionType: "adjustment", amountMinor: 2_000, currency: "CNY", occurredAt: "2026-08-01T00:00:00.000Z", description: "绕过审批" }) });
    expect(forbiddenAdjustment.status).toBe(400);
    expect((await app.request(`/api/v2/finance/transactions/${transaction.id}`, { method: "DELETE" })).status).toBe(404);

    const transfer = await app.request("/api/v2/finance/transfers", { method: "POST", headers: json, body: JSON.stringify({ fromAccountId: from.id, toAccountId: to.id, fromAmountMinor: 500, toAmountMinor: 500, occurredAt: "2026-08-02T00:00:00.000Z", description: "账户归集" }) });
    expect(transfer.status).toBe(201);
    expect(await body(transfer)).toMatchObject({ data: { outgoing: { reportingType: "transfer" }, incoming: { reportingType: "transfer" } } });

    const proposalResponse = await app.request("/api/v2/runtime/finance/change-proposals", { method: "POST", headers: json, body: JSON.stringify({ targetTransactionId: transaction.id, proposalType: "update", proposedChanges: { amountMinor: 2_500, description: "api_key: hidden" }, rationale: "token=hidden" }) });
    expect(proposalResponse.status).toBe(201);
    const proposal = (await body<{ data: { id: string; rationale: string; proposedChanges: { description: string } } }>(proposalResponse)).data;
    expect(JSON.stringify(proposal)).not.toContain("hidden");
    expect(store.getFinanceAccount(from.id)?.currentBalanceMinor).toBe(11_500);
    const approval = await app.request(`/api/v2/finance/change-proposals/${proposal.id}/resolve`, { method: "POST", headers: json, body: JSON.stringify({ decision: "approved", comment: "凭证已核对" }) });
    expect(approval.status).toBe(200);
    expect(await body(approval)).toMatchObject({ data: { status: "approved", resultTransactionIds: [expect.any(String), expect.any(String)] } });
    expect(store.getFinanceAccount(from.id)?.currentBalanceMinor).toBe(12_000);
    store.close();
  });

  it("serves budget, reproducible forecast and operating attribution APIs", async () => {
    const { app, store } = fixture();
    const json = { "content-type": "application/json" };
    const account = (await body<{ data: { id: string } }>(await app.request("/api/v2/finance/accounts", { method: "POST", headers: json, body: JSON.stringify({ name: "项目账户", accountType: "bank", currency: "CNY", initialBalanceMinor: 0 }) }))).data;
    const category = (await body<{ data: { id: string } }>(await app.request("/api/v2/finance/categories", { method: "POST", headers: json, body: JSON.stringify({ name: "项目收入", kind: "income" }) }))).data;
    const transaction = (await body<{ data: { id: string } }>(await app.request("/api/v2/finance/transactions", { method: "POST", headers: json, body: JSON.stringify({ accountId: account.id, transactionType: "income", amountMinor: 3_000, currency: "CNY", occurredAt: "2026-08-01T00:00:00.000Z", categoryId: category.id, description: "项目回款" }) }))).data;
    expect((await app.request("/api/v2/finance/budgets", { method: "POST", headers: json, body: JSON.stringify({ month: "2026-08", currency: "CNY", categoryId: category.id, plannedMinor: 5_000 }) })).status).toBe(201);
    const forecast = (await body<{ data: { id: string } }>(await app.request("/api/v2/finance/calculations/cashflow", { method: "POST", headers: json, body: JSON.stringify({ currency: "CNY", openingBalanceMinor: 3_000, months: [{ month: "2026-09", expectedIncomeMinor: 2_000, expectedExpenseMinor: 500 }] }) }))).data;
    expect(await body(await app.request(`/api/v2/finance/calculations/${forecast.id}/replay`, { method: "POST" }))).toMatchObject({ data: { matches: true, result: { closingBalanceMinor: 4_500 } } });
    const unit = (await body<{ data: { id: string } }>(await app.request("/api/v2/finance/operating-units", { method: "POST", headers: json, body: JSON.stringify({ name: "雷达实验", unitType: "radar", referenceId: "radar-1", currency: "CNY" }) }))).data;
    expect((await app.request("/api/v2/finance/allocations", { method: "POST", headers: json, body: JSON.stringify({ transactionId: transaction.id, operatingUnitId: unit.id, amountMinor: 1_500, idempotencyKey: "api-allocation" }) })).status).toBe(201);
    expect((await app.request("/api/v2/finance/operating-entries", { method: "POST", headers: json, body: JSON.stringify({ operatingUnitId: unit.id, entryType: "time", amountMinor: null, currency: null, minutes: 120, description: "研发", occurredAt: "2026-08-01T00:00:00.000Z" }) })).status).toBe(201);
    expect(await body(await app.request(`/api/v2/finance/operating-units/${unit.id}/summary`))).toMatchObject({ data: { actualIncomeMinor: 1_500, expectedIncomeMinor: 0, timeMinutes: 120 } });
    store.close();
  });

  it("exposes review, trusted cost, artifacts, and approval governance endpoints", async () => {
    const { app, store, execution } = fixture();
    const workSpec = execution.createWorkSpec({ title: "governance", instructions: "governance", executorType: "internal", input: { operation: "echo", message: "done", delayMs: 0 }, projectId: null, kind: "one_off", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = execution.createRun(workSpec.id);
    await execution.startRun(run.id);
    const accepted = await app.request(`/api/v2/runs/${run.id}/accept`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ comment: "通过" }) });
    expect(await body(accepted)).toMatchObject({ data: { reviewStatus: "accepted" } });
    const cost = await app.request(`/api/v2/runs/${run.id}/cost`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amountMinor: 88, currency: "cny", source: "manual_receipt" }) });
    expect(await body(cost)).toMatchObject({ data: { actualCostMinor: 88, actualCostCurrency: "CNY", costSource: "manual_receipt" } });
    const artifacts = await app.request(`/api/v2/runs/${run.id}/artifacts`);
    expect(await body(artifacts)).toMatchObject({ data: [] });
    const approvals = await app.request("/api/v2/approvals?status=pending");
    expect(await body(approvals)).toMatchObject({ data: [] });
    const invalidInput = await app.request(`/api/v2/runs/${run.id}/input`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answer: "late" }) });
    expect(invalidInput.status).toBe(409);
    store.close();
  });

  it("creates, searches and opens a controlled linked knowledge document", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-api-knowledge-")); directories.push(root);
    const { app, store, execution, knowledge } = fixture();
    const project = execution.createProject({ name: "知识项目", description: "", repositoryPath: null, obsidianPath: null, status: "active" });
    const vault = knowledge.addVault({ name: "API Vault", rootPath: root });
    const createdResponse = await app.request("/api/v2/knowledge/documents", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ vaultId: vault.id, directory: "Reports", title: "中文市场复盘", body: "微信支付验证已经完成", tags: ["市场"], links: [{ entityType: "project", entityId: project.id, relation: "documents" }] })
    });
    expect(createdResponse.status).toBe(201);
    const created = (await body<{ data: { document: { id: string }; links: Array<{ relation: string }> } }>(createdResponse)).data;
    expect(created.links).toMatchObject([{ relation: "documents" }]);
    const search = await app.request(`/api/v2/knowledge/search?q=${encodeURIComponent("微信支付")}&tag=${encodeURIComponent("市场")}&entityType=project&entityId=${project.id}`);
    expect((await body<{ data: Array<{ id: string }> }>(search)).data).toMatchObject([{ id: created.document.id }]);
    const detail = await app.request(`/api/v2/knowledge/documents/${created.document.id}`);
    expect(await body(detail)).toMatchObject({ data: { vault: { id: vault.id }, links: [{ entityId: project.id, source: "generated" }] } });
    const duplicate = await app.request("/api/v2/knowledge/documents", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ vaultId: vault.id, directory: "Reports", title: "中文市场复盘", body: "不能覆盖" })
    });
    expect(duplicate.status).toBe(409);
    const invalid = await app.request("/api/v2/knowledge/documents", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ vaultId: vault.id, directory: "../Outside", title: "越界", body: "" })
    });
    expect(invalid.status).toBe(400);
    store.close();
  });

  it("governs MCP callbacks, artifacts, structured results and approval resume with a per-run capability", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-api-mcp-")); directories.push(root);
    mkdirSync(join(root, ".git"));
    writeFileSync(join(root, "report.md"), "verified report");
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolvePromise) => { releaseFirst = resolvePromise; });
    const calls: ExecutionContext[] = [];
    const adapter: ExecutorAdapter = {
      type: "fake",
      validate: () => undefined,
      health: () => ({ available: true, detail: "gateway fixture" }),
      execute: async (context): Promise<ExecutionResult> => {
        calls.push(context);
        if (!context.resume) await firstGate;
        return { status: "succeeded", externalRunId: "gateway-session", result: { finalResponse: context.resume ? "resumed" : "first" } };
      }
    };
    const store = new SqliteVNextStore();
    const execution = new PersonalOsService(store, [adapter]);
    const app = createVNextApp({ store, execution, schedules: new ScheduleService(store, execution), knowledge: new KnowledgeService(store), finance: new FinanceService(store) });
    const project = execution.createProject({ name: "MCP 项目", description: "", repositoryPath: root, obsidianPath: null, status: "active" });
    const spec = execution.createWorkSpec({ title: "MCP 工作", instructions: "受控执行", executorType: "fake", projectId: project.id, input: {} });
    const queued = execution.createRun(spec.id);
    void execution.startRun(queued.id);
    await waitUntil(() => calls.length === 1);
    const token = calls[0]?.capability?.token;
    expect(token).toBeTruthy();
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

    expect((await app.request("/api/v2/runtime/mcp/context")).status).toBe(401);
    expect(await body(await app.request("/api/v2/runtime/mcp/context", { headers }))).toMatchObject({ data: { run: { id: queued.id, status: "running" }, workSpec: { id: spec.id }, project: { id: project.id } } });
    const progress = await app.request("/api/v2/runtime/mcp/events", { method: "POST", headers, body: JSON.stringify({ eventType: "agent.researching", message: "正在核验", structuredData: { capabilityToken: token } }) });
    expect(progress.status).toBe(201);
    expect(JSON.stringify(store.listRunEvents(queued.id))).not.toContain(token);

    const checkpoint = await app.request("/api/v2/runtime/mcp/checkpoints", { method: "POST", headers, body: JSON.stringify({ stepKey: "verify", label: "核验", status: "completed", summary: "已核验报告", data: { apiKey: "checkpoint-secret", rows: 1 } }) });
    expect(checkpoint.status).toBe(201);
    expect(await body(await app.request(`/api/v2/runs/${queued.id}/checkpoints`))).toMatchObject({ data: [{ stepKey: "verify", status: "completed", data: { apiKey: "[REDACTED]", rows: 1 } }] });
    const contextWithCheckpoint = JSON.stringify(await body(await app.request("/api/v2/runtime/mcp/context", { headers })));
    expect(contextWithCheckpoint).toContain("verify");
    expect(contextWithCheckpoint).not.toContain("checkpoint-secret");
    expect((await app.request("/api/v2/runtime/mcp/checkpoints", { method: "POST", headers, body: JSON.stringify({ stepKey: "verify", label: "核验", status: "completed", summary: "尝试覆盖", data: {} }) })).status).toBe(409);

    const artifact = await app.request("/api/v2/runtime/mcp/artifacts", { method: "POST", headers, body: JSON.stringify({ storageKind: "git", name: "report.md", uri: "report.md", mimeType: "text/markdown" }) });
    const artifactId = (await body<{ data: { id: string } }>(artifact)).data.id;
    const duplicate = await app.request("/api/v2/runtime/mcp/artifacts", { method: "POST", headers, body: JSON.stringify({ storageKind: "git", name: "report.md", uri: "report.md", mimeType: "text/markdown" }) });
    expect((await body<{ data: { id: string } }>(duplicate)).data.id).toBe(artifactId);
    const escaped = await app.request("/api/v2/runtime/mcp/artifacts", { method: "POST", headers, body: JSON.stringify({ storageKind: "git", name: "escape", uri: "../escape.md", mimeType: null }) });
    expect(escaped.status).toBe(400);

    expect((await app.request("/api/v2/runtime/mcp/result", { method: "POST", headers, body: JSON.stringify({ summary: "完成前等待审批", data: { verified: true }, verification: ["report.md exists"] }) })).status).toBe(202);
    const approvalResponse = await app.request("/api/v2/runtime/mcp/approvals", { method: "POST", headers, body: JSON.stringify({ requestType: "permission_required", summary: "需要批准继续", request: { action: "continue" } }) });
    const approval = (await body<{ data: { id: string } }>(approvalResponse)).data;
    releaseFirst();
    await waitUntil(() => store.getRun(queued.id)?.status === "waiting_approval");
    expect((await app.request("/api/v2/runtime/mcp/context", { headers })).status).toBe(401);
    expect(store.getRun(queued.id)?.result).toMatchObject({ runtimeSubmission: { summary: "完成前等待审批", data: { verified: true } }, approvalId: approval.id });

    const resolved = await app.request(`/api/v2/approvals/${approval.id}/resolve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: "approved", comment: "继续" }) });
    expect(resolved.status).toBe(202);
    await waitUntil(() => store.getRun(queued.id)?.status === "succeeded");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.resume).toMatchObject({ kind: "approval", decision: "approved" });
    expect(calls[1]?.capability?.token).not.toBe(token);
    expect(store.getRun(queued.id)).toMatchObject({ reviewStatus: "pending", result: { finalResponse: "resumed", runtimeSubmission: { summary: "完成前等待审批" } } });
    expect(store.listAudit().some((entry) => entry.actorType === "runtime" && entry.action === "runtime.result_submitted")).toBe(true);
    store.close();
  });

  it("deposits an accepted run through the API and exposes the resulting Obsidian artifact", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-api-phase11-")); directories.push(root);
    const { app, store, execution, knowledge } = fixture();
    const vault = knowledge.addVault({ name: "Phase 11 Vault", rootPath: root });
    const workSpec = execution.createWorkSpec({
      title: "阶段十一日报",
      instructions: "生成日报并等待验收",
      executorType: "internal",
      input: { operation: "echo", message: "阶段十一结果", delayMs: 0 },
      resultDeposition: { vaultId: vault.id, directory: "Reports", titleTemplate: "{date}-{title}" }
    });
    const run = execution.createRun(workSpec.id);
    await execution.startRun(run.id);
    expect((await app.request(`/api/v2/runs/${run.id}/deposition/retry`, { method: "POST" })).status).toBe(409);
    const accepted = await app.request(`/api/v2/runs/${run.id}/accept`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ comment: "结果可信" }) });
    expect(accepted.status).toBe(200);
    const depositionResponse = await app.request(`/api/v2/runs/${run.id}/deposition`);
    const saved = (await body<{ data: { status: string; relativePath: string; attempts: number } }>(depositionResponse)).data;
    expect(saved).toMatchObject({ status: "succeeded", attempts: 1, relativePath: expect.stringMatching(/^Reports\//) });
    expect(readFileSync(join(root, saved.relativePath), "utf8")).toContain("阶段十一结果");
    expect(await body(await app.request(`/api/v2/runs/${run.id}/artifacts`))).toMatchObject({ data: [expect.objectContaining({ storageKind: "obsidian", uri: expect.stringContaining(saved.relativePath) })] });
    expect(await body(await app.request("/api/v2/depositions?status=succeeded"))).toMatchObject({ data: [expect.objectContaining({ runId: run.id })] });
    store.close();
  });

  it("auto-deposits an explicit low-risk daily report without an acceptance request", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-api-phase11-auto-")); directories.push(root);
    const vaultRoot = join(root, "vault");
    const skillRoot = join(root, "skills");
    mkdirSync(vaultRoot, { recursive: true });
    mkdirSync(join(skillRoot, "auto-brief"), { recursive: true });
    writeFileSync(join(skillRoot, "auto-brief", "SKILL.md"), `---\nname: auto-brief\ndescription: Generate an automatic structured briefing.\nmetadata:\n  version: "1.0.0"\n---\n\n# Automatic briefing\n`);
    const registry = new RepositorySkillRegistry(skillRoot);
    const store = new SqliteVNextStore();
    const adapter: ExecutorAdapter = {
      type: "openworker",
      validate: () => undefined,
      health: () => ({ available: true, detail: "fixture" }),
      execute: async (context) => {
        const grant = execution.getCapabilityAuthority().authorize(context.capability!.token, "result:submit");
        execution.submitRuntimeResult(grant, { summary: "自动日报完成", data: { qualityStatus: "passed" }, verification: ["来源已核验"] });
        return { status: "succeeded", externalRunId: `openworker-${context.run.id}`, result: { finalResponse: "自动日报完成" } };
      }
    };
    const execution = new PersonalOsService(store, [adapter], undefined, undefined, registry);
    const schedules = new ScheduleService(store, execution);
    const knowledge = new KnowledgeService(store);
    const vault = knowledge.addVault({ name: "自动日报 Vault", rootPath: vaultRoot });
    const app = createVNextApp({ store, execution, schedules, knowledge, finance: new FinanceService(store), skills: registry });
    const createdResponse = await app.request("/api/v2/work-specs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      title: "自动 AI 日报", instructions: "生成只读日报", kind: "workflow", executorType: "openworker", input: {}, skill: registry.get("auto-brief"), reviewPolicy: "not_required",
      resultDeposition: { vaultId: vault.id, directory: "Reports", subdirectory: "AI日报", titleTemplate: "{date} AI 日报", trigger: "on_success", period: "calendar_day", timezone: "Asia/Tokyo" }
    }) });
    expect(createdResponse.status).toBe(201);
    const workSpec = (await body<{ data: { id: string } }>(createdResponse)).data;
    const runResponse = await app.request(`/api/v2/work-specs/${workSpec.id}/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ start: true }) });
    const run = (await body<{ data: { id: string } }>(runResponse)).data;
    await waitUntil(() => store.getRun(run.id)?.status === "succeeded" && store.getRunDeposition(run.id)?.status === "succeeded");
    expect(await body(await app.request(`/api/v2/runs/${run.id}`))).toMatchObject({ data: { reviewStatus: "not_required" } });
    expect(await body(await app.request(`/api/v2/runs/${run.id}/deposition`))).toMatchObject({ data: { status: "succeeded", relativePath: expect.stringMatching(/^Reports\/AI日报\//) } });
    expect((await app.request(`/api/v2/runs/${run.id}/accept`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status).toBe(409);
    store.close();
  });

  it("exposes the Phase 12 rehearsal, evaluation, failure-drill, candidate and human publish gate", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-api-phase12-")); directories.push(root);
    const skillRoot = join(root, "skills");
    mkdirSync(join(skillRoot, "base-radar"), { recursive: true });
    writeFileSync(join(skillRoot, "base-radar", "SKILL.md"), `---\nname: base-radar\ndescription: Execute a governed Radar rehearsal.\nmetadata:\n  version: "1.0.0"\n---\n\n# Base Radar\n`);
    const registry = new RepositorySkillRegistry(skillRoot);
    const store = new SqliteVNextStore();
    const adapter: ExecutorAdapter = {
      type: "openworker",
      validate: () => undefined,
      health: () => ({ available: true, detail: "fixture" }),
      execute: async (context) => {
        const checkpointGrant = execution.getCapabilityAuthority().authorize(context.capability!.token, "checkpoint:write");
        execution.saveRuntimeCheckpoint(checkpointGrant, { stepKey: "verify", label: "验证", status: "completed", summary: "已完成验证", data: {} });
        const resultGrant = execution.getCapabilityAuthority().authorize(context.capability!.token, "result:submit");
        execution.submitRuntimeResult(resultGrant, { summary: "预执行通过", data: { valid: true }, verification: ["结构化结果已核对"] });
        return { status: "succeeded", externalRunId: `openworker-${context.run.id}`, result: { finalResponse: "通过" } };
      }
    };
    const execution = new PersonalOsService(store, [adapter], undefined, undefined, registry);
    const schedules = new ScheduleService(store, execution);
    const app = createVNextApp({ store, execution, schedules, knowledge: new KnowledgeService(store), finance: new FinanceService(store), skills: registry });
    const source = execution.createWorkSpec({ title: "晋级雷达", instructions: "先预执行，再发布专属 Skill。", kind: "workflow", executorType: "openworker", input: {}, skill: registry.get("base-radar") });
    const schedule = schedules.create({ workSpecId: source.id, name: "晋级后定时", cronExpression: "0 8 * * *", timezone: "Asia/Tokyo", enabled: false, catchUp: false });

    for (let index = 0; index < 2; index += 1) {
      const response = await app.request(`/api/v2/work-specs/${source.id}/rehearsals`, { method: "POST" });
      expect(response.status).toBe(202);
      const run = (await body<{ data: { id: string; runMode: string } }>(response)).data;
      expect(run.runMode).toBe("rehearsal");
      await waitUntil(() => store.getRun(run.id)?.status === "succeeded");
      const evaluated = await app.request(`/api/v2/runs/${run.id}/evaluation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: `第 ${index + 1} 次` }) });
      expect(await body(evaluated)).toMatchObject({ data: { passed: true, runMode: "rehearsal" } });
    }
    const beforeDrill = await app.request(`/api/v2/work-specs/${source.id}/promotion`);
    expect(await body(beforeDrill)).toMatchObject({ data: { ready: false, passedRehearsalRoots: expect.any(Array) } });
    const drill = await app.request(`/api/v2/work-specs/${source.id}/failure-drills`, { method: "POST" });
    expect(await body(drill)).toMatchObject({ data: { run: { runMode: "failure_drill", status: "failed" }, evaluation: { passed: true } } });
    expect(await body(await app.request(`/api/v2/work-specs/${source.id}/promotion`))).toMatchObject({ data: { ready: true, passedRehearsalRoots: expect.any(Array), passedFailureDrillRunIds: expect.any(Array) } });

    const draft = { name: "promoted-radar", version: "1.0.0", displayName: "晋级雷达", description: "把验证通过的雷达流程沉淀成固定技能。", instructions: "# 晋级雷达\n\n1. 读取运行上下文。\n2. 保存步骤证据。\n3. 提交结构化结果并核验。", expectedCurrentHash: null };
    const candidateResponse = await app.request(`/api/v2/work-specs/${source.id}/skill-candidates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    expect(candidateResponse.status).toBe(201);
    const candidate = (await body<{ data: { id: string; status: string } }>(candidateResponse)).data;
    expect(candidate.status).toBe("pending");
    expect(existsSync(join(skillRoot, draft.name))).toBe(false);
    const publishedResponse = await app.request(`/api/v2/skill-candidates/${candidate.id}/publish`, { method: "POST" });
    expect(publishedResponse.status).toBe(201);
    const published = (await body<{ data: { publishedWorkSpecId: string; publishedSkill: { name: string } } }>(publishedResponse)).data;
    expect(published.publishedSkill.name).toBe(draft.name);
    expect(store.getWorkSpec(published.publishedWorkSpecId)).toMatchObject({ revisionOfWorkSpecId: source.id, skill: { name: draft.name } });
    expect(store.getSchedule(schedule.id)?.workSpecId).toBe(source.id);
    expect((await app.request(`/api/v2/skill-candidates/${candidate.id}/publish`, { method: "POST" })).status).toBe(409);
    store.close();
  });
});

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 200; index += 1) {
    if (predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2));
  }
  throw new Error("WAIT_TIMEOUT");
}
