import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteVNextStore } from "@personal-os/vnext-infrastructure";
import { FakeExecutor, InternalExecutor } from "@personal-os/vnext-runtime";
import { PersonalOsService, RepositorySkillRegistry, RuntimeCapabilityAuthority, ScheduleService, type Clock, type ExecutionContext, type ExecutionResult, type ExecutorAdapter } from "./index.js";

class MutableClock implements Clock {
  constructor(public value: Date) {}
  now(): Date { return this.value; }
}

function internalWorkSpec(service: PersonalOsService, input: unknown, maxAttempts = 2) {
  return service.createWorkSpec({ title: "test", instructions: "test", executorType: "internal", input, projectId: null, kind: "one_off", timeoutSeconds: 5, maxAttempts, lifecycleStatus: "active" });
}

class ScriptedExecutor implements ExecutorAdapter {
  readonly type = "fake" as const;
  calls: ExecutionContext[] = [];
  constructor(private readonly outputs: ExecutionResult[]) {}
  validate(): void {}
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    this.calls.push(context);
    const output = this.outputs[this.calls.length - 1];
    if (!output) throw new Error("SCRIPT_EXHAUSTED");
    return output;
  }
  health() { return { available: true, detail: "scripted" }; }
}

async function waitForRun(store: SqliteVNextStore, id: string, status: string): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (store.getRun(id)?.status === status) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2));
  }
  throw new Error(`RUN_DID_NOT_REACH:${status}`);
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 200; index += 1) {
    if (predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2));
  }
  throw new Error("WAIT_TIMEOUT");
}

describe("PersonalOsService execution lifecycle", () => {
  it("issues scoped capabilities that expire and revoke without persisting the secret", () => {
    const clock = new MutableClock(new Date("2026-08-03T00:00:00.000Z"));
    const authority = new RuntimeCapabilityAuthority(clock);
    const issued = authority.issue("run-a", "codex", ["context:read"], 60);
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(authority.authorize(issued.token, "context:read")).toMatchObject({ runId: "run-a", executorType: "codex" });
    expect(() => authority.authorize(issued.token, "result:submit")).toThrow("RUNTIME_CAPABILITY_SCOPE_DENIED");
    authority.revokeRun("run-a");
    expect(() => authority.authorize(issued.token, "context:read")).toThrow("RUNTIME_CAPABILITY_INVALID");
    const expiring = authority.issue("run-b", "openworker", ["context:read"], 1);
    clock.value = new Date("2026-08-03T00:00:02.000Z");
    expect(() => authority.authorize(expiring.token, "context:read")).toThrow("RUNTIME_CAPABILITY_EXPIRED");
  });

  it("loads versioned repository skills and rejects a forged snapshot", () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-skills-"));
    const skillRoot = join(root, "skills");
    const directory = join(skillRoot, "verify-market");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "SKILL.md"), `---\nname: verify-market\ndescription: Verify a market.\nmetadata:\n  version: "2.1.0"\n---\n\n# Verify\n`);
    const registry = new RepositorySkillRegistry(skillRoot);
    const snapshot = registry.get("verify-market");
    expect(snapshot).toMatchObject({ name: "verify-market", version: "2.1.0", contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const store = new SqliteVNextStore();
    const service = new PersonalOsService(store, [new FakeExecutor()], undefined, undefined, registry);
    const spec = service.createWorkSpec({ title: "skill", instructions: "skill", executorType: "fake", input: {}, skill: snapshot });
    expect(store.getWorkSpec(spec.id)?.skill).toEqual(snapshot);
    expect(() => service.createWorkSpec({ title: "forged", instructions: "forged", executorType: "fake", input: {}, skill: { ...snapshot!, contentHash: "0".repeat(64) } })).toThrow("SKILL_SNAPSHOT_MISMATCH");
    store.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("validates and atomically publishes increasing Skill versions", () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-skill-studio-"));
    const registry = new RepositorySkillRegistry(join(root, "skills"));
    const store = new SqliteVNextStore();
    const service = new PersonalOsService(store, [new FakeExecutor()], undefined, undefined, registry);
    const draft = { name: "daily-research", version: "1.0.0", displayName: "每日调研", description: "完成一份有证据的每日调研。", instructions: "# 每日调研\n\n1. 读取上下文。\n2. 核验来源。\n3. 提交结果。", expectedCurrentHash: null };
    const validation = service.validateSkillDraft(draft);
    expect(validation).toMatchObject({ valid: true, current: null, candidate: { name: "daily-research", version: "1.0.0", contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) } });
    const published = service.publishSkill({ ...draft, validatedContentHash: validation.candidate.contentHash });
    expect(registry.get("daily-research")).toEqual(published);
    expect(readFileSync(join(root, "skills", "daily-research", "agents", "openai.yaml"), "utf8")).toContain("$daily-research");
    expect(service.validateSkillDraft({ ...draft, expectedCurrentHash: published.contentHash }).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SKILL_VERSION_MUST_INCREASE" })]));
    expect(service.validateSkillDraft({ ...draft, version: "1.0.1", expectedCurrentHash: "0".repeat(64) }).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SKILL_CONCURRENT_UPDATE" })]));
    expect(service.validateSkillDraft({ ...draft, version: "1.0.1", expectedCurrentHash: published.contentHash, instructions: "# Secret\n\napi_key: sk_1234567890abcdefghijklmnop" }).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SKILL_SECRET_DETECTED" })]));
    expect(() => service.validateSkillDraft({ ...draft, name: "../escape" })).toThrow();
    const outside = mkdtempSync(join(tmpdir(), "personal-os-skill-outside-"));
    symlinkSync(outside, join(root, "skills", "linked-skill"));
    const linkedDraft = { ...draft, name: "linked-skill", expectedCurrentHash: null };
    const linkedValidation = service.validateSkillDraft(linkedDraft);
    expect(() => service.publishSkill({ ...linkedDraft, validatedContentHash: linkedValidation.candidate.contentHash })).toThrow("SKILL_SYMLINK_NOT_ALLOWED");
    expect(store.listAudit().some((entry) => entry.action === "skill.published" && JSON.stringify(entry).includes("每日调研") === false)).toBe(true);
    store.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("creates immutable workflow revisions and explains preflight and operations health", async () => {
    const store = new SqliteVNextStore();
    const service = new PersonalOsService(store, [new InternalExecutor()]);
    const first = service.createWorkSpec({ title: "日报", instructions: "生成日报", executorType: "internal", input: { operation: "echo", message: "ok", delayMs: 0 }, kind: "workflow", maxAttempts: 3 });
    const revision = service.createWorkSpecRevision(first.id, { title: "日报新版", instructions: "生成并核验日报", executorType: "internal", input: { operation: "echo", message: "new", delayMs: 0 }, maxAttempts: 3 });
    expect(revision).toMatchObject({ revisionOfWorkSpecId: first.id, revisionNumber: 2, title: "日报新版" });
    const parallelRevision = service.createWorkSpecRevision(first.id, { title: "日报第三版", instructions: "另一条改进", executorType: "internal", input: { operation: "echo", message: "third", delayMs: 0 }, maxAttempts: 3 });
    expect(parallelRevision).toMatchObject({ revisionOfWorkSpecId: first.id, revisionNumber: 3 });
    expect(store.getWorkSpec(first.id)).toMatchObject({ revisionOfWorkSpecId: null, revisionNumber: 1, title: "日报" });
    expect(await service.preflightWorkSpec(revision.id)).toMatchObject({ ready: true, checks: expect.arrayContaining([expect.objectContaining({ code: "executor", status: "pass" }), expect.objectContaining({ code: "schedule", status: "warning" })]) });
    expect(service.listWorkflowOperations().find((item) => item.workSpec.id === revision.id)).toMatchObject({ health: "never_run", latestRun: null, consecutiveFailures: 0 });
    const run = service.createRun(revision.id);
    await service.startRun(run.id);
    expect(service.listWorkflowOperations().find((item) => item.workSpec.id === revision.id)).toMatchObject({ health: "healthy", latestRun: { id: run.id } });
    store.close();
  });

  it("requires skill-bound agent runtimes to submit a structured MCP result before success", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-required-result-"));
    const skillRoot = join(root, "skills");
    const directory = join(skillRoot, "agent-run");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "SKILL.md"), `---\nname: agent-run\ndescription: Governed agent run.\nmetadata:\n  version: "1.0.0"\n---\n\n# Run\n`);
    const registry = new RepositorySkillRegistry(skillRoot);
    const snapshot = registry.get("agent-run");

    const failedStore = new SqliteVNextStore();
    const missingSubmission: ExecutorAdapter = {
      type: "codex",
      validate: () => undefined,
      health: () => ({ available: true, detail: "fixture" }),
      execute: async () => ({ status: "succeeded", externalRunId: "codex-missing", result: { finalResponse: "claimed success" } })
    };
    const failedService = new PersonalOsService(failedStore, [missingSubmission], undefined, undefined, registry);
    const failedSpec = failedService.createWorkSpec({ title: "missing", instructions: "missing", executorType: "codex", input: {}, skill: snapshot });
    const failedRun = failedService.createRun(failedSpec.id);
    expect(await failedService.startRun(failedRun.id)).toMatchObject({ status: "failed", errorMessage: "RUNTIME_RESULT_SUBMISSION_REQUIRED" });
    failedStore.close();

    const passedStore = new SqliteVNextStore();
    const submitted: ExecutorAdapter = {
      type: "codex",
      validate: () => undefined,
      health: () => ({ available: true, detail: "fixture" }),
      execute: async (context) => {
        const grant = passedService.getCapabilityAuthority().authorize(context.capability!.token, "result:submit");
        passedService.submitRuntimeResult(grant, { summary: "verified", data: { mcp: true }, verification: ["submitted"] });
        return { status: "succeeded", externalRunId: "codex-submitted", result: { finalResponse: "verified" } };
      }
    };
    const passedService = new PersonalOsService(passedStore, [submitted], undefined, undefined, registry);
    const passedSpec = passedService.createWorkSpec({ title: "submitted", instructions: "submitted", executorType: "codex", input: {}, skill: snapshot });
    const passedRun = passedService.createRun(passedSpec.id);
    expect(await passedService.startRun(passedRun.id)).toMatchObject({ status: "succeeded", result: { runtimeSubmission: { summary: "verified", verification: ["submitted"] } } });
    passedStore.close();
    rmSync(root, { recursive: true, force: true });
  });
  it("cancels a running executor without allowing a late success", async () => {
    const store = new SqliteVNextStore();
    const service = new PersonalOsService(store, [new InternalExecutor()]);
    const workSpec = internalWorkSpec(service, { operation: "delay", message: "late", delayMs: 500 });
    const run = service.createRun(workSpec.id);
    const pending = service.startRun(run.id);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
    service.cancelRun(run.id);
    expect((await pending).status).toBe("cancelled");
    expect(store.getRun(run.id)?.status).toBe("cancelled");
    store.close();
  });

  it("retries as a new immutable attempt and enforces max attempts", async () => {
    const store = new SqliteVNextStore();
    const service = new PersonalOsService(store, [new InternalExecutor()]);
    const workSpec = internalWorkSpec(service, { operation: "fail", message: "boom", delayMs: 0 });
    const first = service.createRun(workSpec.id);
    expect((await service.startRun(first.id)).status).toBe("failed");
    const second = service.retryRun(first.id);
    expect(second).toMatchObject({ attempt: 2, retryOfRunId: first.id, status: "queued" });
    expect((await service.startRun(second.id)).status).toBe("failed");
    expect(() => service.retryRun(second.id)).toThrow("MAX_ATTEMPTS_REACHED");
    expect(store.getRun(first.id)?.status).toBe("failed");
    store.close();
  });

  it("marks interrupted work as failed on restart", () => {
    const store = new SqliteVNextStore();
    const service = new PersonalOsService(store, [new InternalExecutor()]);
    const workSpec = internalWorkSpec(service, { operation: "echo", message: "ok", delayMs: 0 });
    const run = service.createRun(workSpec.id);
    store.updateRun({ ...run, status: "running", startedAt: new Date().toISOString() });
    expect(service.recoverInterruptedRuns()).toBe(1);
    expect(store.getRun(run.id)).toMatchObject({ status: "failed", errorCode: "PROCESS_RESTARTED" });
    store.close();
  });

  it("persists external runtime ids and fail-closed waiting states", async () => {
    const store = new SqliteVNextStore();
    const fake = new FakeExecutor({ status: "waiting_approval", externalRunId: "external-1", result: { requestType: "permission_required" } });
    const service = new PersonalOsService(store, [fake]);
    const workSpec = service.createWorkSpec({ title: "approval", instructions: "approval", executorType: "fake", input: {}, projectId: null, kind: "one_off", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = service.createRun(workSpec.id);
    expect(await service.startRun(run.id)).toMatchObject({ status: "waiting_approval", externalRunId: "external-1", finishedAt: null });
    expect(store.listRunEvents(run.id).map((event) => event.eventType)).toContain("run.waiting_approval");
    store.close();
  });

  it("resumes the same Run after user input and keeps its runtime session", async () => {
    const store = new SqliteVNextStore();
    const adapter = new ScriptedExecutor([
      { status: "waiting_input", externalRunId: "session-1", result: { requestType: "question_requested", request: { question: "继续？" } } },
      { status: "succeeded", externalRunId: "session-1", result: { finalResponse: "已继续" }, usage: { inputTokens: 2 } }
    ]);
    const service = new PersonalOsService(store, [adapter]);
    const spec = service.createWorkSpec({ title: "input", instructions: "input", executorType: "fake", input: {}, projectId: null, kind: "one_off", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = service.createRun(spec.id);
    expect(await service.startRun(run.id)).toMatchObject({ status: "waiting_input", externalRunId: "session-1" });
    expect(service.submitRunInput(run.id, { answer: "继续" })).toMatchObject({ id: run.id, status: "running", externalRunId: "session-1" });
    await waitForRun(store, run.id, "succeeded");
    expect(adapter.calls[1]?.resume).toMatchObject({ kind: "input", answer: "继续" });
    expect(store.getRun(run.id)).toMatchObject({ status: "succeeded", reviewStatus: "pending", usage: { inputTokens: 2 } });
    store.close();
  });

  it("creates one approval, applies the first decision, and resumes the same Run", async () => {
    const store = new SqliteVNextStore();
    const adapter = new ScriptedExecutor([
      { status: "waiting_approval", externalRunId: "session-2", result: { requestType: "permission_required", request: { description: "publish report" } } },
      { status: "succeeded", externalRunId: "session-2", result: { finalResponse: "批准后完成" } }
    ]);
    const service = new PersonalOsService(store, [adapter]);
    const spec = service.createWorkSpec({ title: "approval", instructions: "approval", executorType: "fake", input: {}, projectId: null, kind: "one_off", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = service.createRun(spec.id);
    await service.startRun(run.id);
    const approval = store.listApprovals("pending")[0]!;
    expect(approval).toMatchObject({ runId: run.id, status: "pending", riskLevel: "critical" });
    expect(service.resolveApproval(approval.id, { decision: "approved", comment: "确认" })).toMatchObject({ status: "approved" });
    expect(() => service.resolveApproval(approval.id, { decision: "rejected", comment: "晚到" })).toThrow("APPROVAL_ALREADY_RESOLVED");
    await waitForRun(store, run.id, "succeeded");
    expect(adapter.calls[1]?.resume).toMatchObject({ kind: "approval", decision: "approved", requestType: "permission_required" });
    store.close();
  });

  it("resumes with an explicit denial without authorizing the requested action", async () => {
    const store = new SqliteVNextStore();
    const adapter = new ScriptedExecutor([
      { status: "waiting_approval", externalRunId: "session-deny", result: { requestType: "directory_requested", request: { path: "/private", writable: true } } },
      { status: "succeeded", externalRunId: "session-deny", result: { finalResponse: "已跳过目录访问" } }
    ]);
    const service = new PersonalOsService(store, [adapter]);
    const spec = service.createWorkSpec({ title: "deny", instructions: "deny", executorType: "fake", input: {}, projectId: null, kind: "one_off", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = service.createRun(spec.id);
    await service.startRun(run.id);
    const approval = store.listApprovals("pending")[0]!;
    service.resolveApproval(approval.id, { decision: "rejected", comment: "不允许越界" });
    await waitForRun(store, run.id, "succeeded");
    expect(adapter.calls[1]?.resume).toMatchObject({ kind: "approval", decision: "rejected", requestType: "directory_requested" });
    expect(store.listApprovals()[0]?.status).toBe("rejected");
    store.close();
  });

  it("expires stale approvals fail-closed and preserves waiting states across restart", async () => {
    const clock = new MutableClock(new Date("2026-08-01T00:00:00.000Z"));
    const root = mkdtempSync(join(tmpdir(), "personal-os-wait-restart-"));
    const database = join(root, "wait.db");
    const store = new SqliteVNextStore(database);
    const adapter = new ScriptedExecutor([
      { status: "waiting_approval", externalRunId: "session-3", result: { requestType: "plan_proposed", request: { plan: "draft" } } },
      { status: "succeeded", externalRunId: "session-3", result: { finalResponse: "拒绝后安全结束" } }
    ]);
    const service = new PersonalOsService(store, [adapter], clock);
    const spec = service.createWorkSpec({ title: "expiry", instructions: "expiry", executorType: "fake", input: {}, projectId: null, kind: "one_off", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = service.createRun(spec.id);
    await service.startRun(run.id);
    store.close();
    const reopened = new SqliteVNextStore(database);
    const resumedService = new PersonalOsService(reopened, [adapter], clock);
    expect(resumedService.recoverInterruptedRuns()).toBe(0);
    expect(reopened.getRun(run.id)?.status).toBe("waiting_approval");
    clock.value = new Date("2026-08-02T00:00:01.000Z");
    expect(resumedService.expireApprovals()).toBe(1);
    await waitForRun(reopened, run.id, "succeeded");
    expect(reopened.listApprovals()[0]?.status).toBe("expired");
    expect(adapter.calls[1]?.resume).toMatchObject({ kind: "approval", decision: "expired" });
    reopened.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("records final acceptance, trusted cost, artifacts, and redacted audit evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-artifact-"));
    mkdirSync(join(root, ".git"));
    writeFileSync(join(root, "report.md"), "# report\n");
    const store = new SqliteVNextStore();
    const adapter = new ScriptedExecutor([{ status: "succeeded", result: { finalResponse: "token=hidden" }, usage: { inputTokens: 12 }, artifacts: [{ storageKind: "git", name: "report.md", uri: "report.md", mimeType: "text/markdown" }, { storageKind: "git", name: "report.md", uri: "report.md", mimeType: "text/markdown" }] }]);
    const service = new PersonalOsService(store, [adapter]);
    const project = service.createProject({ name: "artifact", description: "", repositoryPath: root, obsidianPath: null, status: "active" });
    const spec = service.createWorkSpec({ title: "artifact", instructions: "artifact", executorType: "fake", input: {}, projectId: project.id, kind: "one_off", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = service.createRun(spec.id);
    expect(await service.startRun(run.id)).toMatchObject({ status: "succeeded", reviewStatus: "pending" });
    expect(store.listArtifactsForRun(run.id)[0]).toMatchObject({ uri: "report.md", sizeBytes: 9, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(service.acceptRun(run.id, { comment: "验收通过" })).toMatchObject({ reviewStatus: "accepted", reviewComment: "验收通过" });
    expect(service.recordActualCost(run.id, { amountMinor: 125, currency: "cny", source: "provider_bill" })).toMatchObject({ actualCostMinor: 125, actualCostCurrency: "CNY", costSource: "provider_bill" });
    expect(service.recordActualCost(run.id, { amountMinor: 125, currency: "CNY", source: "provider_bill" }).actualCostMinor).toBe(125);
    expect(() => service.recordActualCost(run.id, { amountMinor: 126, currency: "CNY", source: "provider_bill" })).toThrow("RUN_COST_ALREADY_RECORDED");
    expect(JSON.stringify(store.listAudit(100))).not.toContain("hidden");
    store.close();
  });

  it("rejects artifact paths outside the bound repository before reporting success", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-artifact-root-"));
    const outside = mkdtempSync(join(tmpdir(), "personal-os-artifact-outside-"));
    mkdirSync(join(root, ".git"));
    writeFileSync(join(outside, "escape.md"), "escape");
    const store = new SqliteVNextStore();
    const adapter = new ScriptedExecutor([{ status: "succeeded", result: { finalResponse: "done" }, artifacts: [{ storageKind: "git", name: "escape.md", uri: join(outside, "escape.md"), mimeType: "text/markdown" }] }]);
    const service = new PersonalOsService(store, [adapter]);
    const project = service.createProject({ name: "escape", description: "", repositoryPath: root, obsidianPath: null, status: "active" });
    const spec = service.createWorkSpec({ title: "escape", instructions: "escape", executorType: "fake", input: {}, projectId: project.id, kind: "one_off", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = service.createRun(spec.id);
    expect(await service.startRun(run.id)).toMatchObject({ status: "failed", errorMessage: "ARTIFACT_PATH_ESCAPE" });
    expect(store.listArtifactsForRun(run.id)).toHaveLength(0);
    store.close();
  });

  it("filters secrets across WorkSpec, Run, Approval, events, results, and audit", async () => {
    const store = new SqliteVNextStore();
    const adapter: ExecutorAdapter = {
      type: "fake",
      validate: () => undefined,
      health: () => ({ available: true, detail: "secret fixture" }),
      execute: async (context) => {
        context.emit({ eventType: "runtime.output", level: "info", source: "fixture", message: "token=event-secret", structuredData: { password: "event-structured-secret" } });
        return { status: "waiting_approval", externalRunId: "secret-session", result: { requestType: "permission_required", request: { description: "API key: approval-secret", authorization: "approval-authorization-secret" }, token: "result-secret" } };
      }
    };
    const service = new PersonalOsService(store, [adapter]);
    const spec = service.createWorkSpec({ title: "secret", instructions: "password: instruction-secret", executorType: "fake", input: { apiKey: "spec-secret" }, projectId: null, kind: "one_off", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const run = service.createRun(spec.id, { input: { authorization: "run-secret" } });
    await service.startRun(run.id);
    const evidence = JSON.stringify({ spec: store.getWorkSpec(spec.id), run: store.getRun(run.id), approval: store.listApprovals(), events: store.listRunEvents(run.id), audit: store.listAudit(100) });
    for (const secret of ["instruction-secret", "spec-secret", "run-secret", "event-secret", "event-structured-secret", "approval-secret", "approval-authorization-secret", "result-secret"]) expect(evidence).not.toContain(secret);
    expect(evidence).toContain("[REDACTED]");
    store.close();
  });
});

describe("ScheduleService", () => {
  it("updates timing and catch-up without changing the pinned WorkSpec", () => {
    const clock = new MutableClock(new Date("2026-08-01T00:00:00.000Z"));
    const store = new SqliteVNextStore();
    const execution = new PersonalOsService(store, [new FakeExecutor()], clock);
    const workSpec = execution.createWorkSpec({ title: "固定技能版本", instructions: "不可变", executorType: "fake", input: {}, projectId: null, kind: "workflow", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const schedules = new ScheduleService(store, execution, clock);
    const schedule = schedules.create({ workSpecId: workSpec.id, name: "早报", cronExpression: "0 8 * * *", timezone: "Asia/Tokyo", enabled: true, catchUp: false });
    const before = schedule.nextRunAt;
    clock.value = new Date("2026-08-01T00:30:00.000Z");
    const updated = schedules.update(schedule.id, { name: "晨报", cronExpression: "30 9 * * *", catchUp: true });
    expect(updated).toMatchObject({ workSpecId: workSpec.id, name: "晨报", cronExpression: "30 9 * * *", catchUp: true });
    expect(updated.nextRunAt).not.toBe(before);
    expect(store.listAudit().find((item) => item.action === "schedule.updated")).toMatchObject({ beforeSnapshot: { name: "早报" }, afterSnapshot: { name: "晨报", workSpecId: workSpec.id } });
    expect(() => schedules.update(schedule.id, {})).toThrow();
    store.close();
  });

  it("rebinds a Schedule only to an active workflow and preserves its timing", () => {
    const clock = new MutableClock(new Date("2026-08-01T00:00:00.000Z"));
    const store = new SqliteVNextStore();
    const execution = new PersonalOsService(store, [new FakeExecutor()], clock);
    const first = execution.createWorkSpec({ title: "第一版", instructions: "v1", executorType: "fake", input: {}, kind: "workflow" });
    const second = execution.createWorkSpecRevision(first.id, { title: "第二版", instructions: "v2", executorType: "fake", input: {} });
    const oneOff = execution.createWorkSpec({ title: "一次性", instructions: "no", executorType: "fake", input: {}, kind: "one_off" });
    const schedules = new ScheduleService(store, execution, clock);
    const schedule = schedules.create({ workSpecId: first.id, name: "日报", cronExpression: "0 8 * * *", timezone: "Asia/Tokyo", enabled: true, catchUp: false });
    const rebound = schedules.rebind(schedule.id, { workSpecId: second.id });
    expect(rebound).toMatchObject({ workSpecId: second.id, nextRunAt: schedule.nextRunAt, lastRunAt: schedule.lastRunAt });
    expect(store.listAudit().find((entry) => entry.action === "schedule.rebound")).toMatchObject({ beforeSnapshot: { workSpecId: first.id }, afterSnapshot: { workSpecId: second.id } });
    expect(() => schedules.rebind(schedule.id, { workSpecId: oneOff.id })).toThrow("SCHEDULE_REBIND_TARGET_NOT_ACTIVE_WORKFLOW");
    store.close();
  });

  it("automatically retries retryable scheduled failures but never manual runs", async () => {
    const clock = new MutableClock(new Date("2026-08-01T00:00:00.000Z"));
    const store = new SqliteVNextStore();
    let calls = 0;
    const flaky: ExecutorAdapter = {
      type: "fake",
      validate: () => undefined,
      health: () => ({ available: true, detail: "flaky" }),
      execute: async () => { calls += 1; if (calls !== 2) throw new Error("TEMPORARY_NETWORK_FAILURE"); return { status: "succeeded", result: { recovered: true } }; }
    };
    const execution = new PersonalOsService(store, [flaky], clock);
    const spec = execution.createWorkSpec({ title: "恢复", instructions: "恢复", executorType: "fake", input: {}, kind: "workflow", maxAttempts: 2 });
    const schedules = new ScheduleService(store, execution, clock);
    schedules.create({ workSpecId: spec.id, name: "每分钟", cronExpression: "* * * * *", timezone: "UTC", enabled: true, catchUp: true });
    clock.value = new Date("2026-08-01T00:01:00.000Z");
    expect(await schedules.tick()).toBe(1);
    await waitUntil(() => store.listRuns().length === 2 && store.listRuns().some((run) => run.status === "succeeded"));
    const scheduledRuns = store.listRuns();
    expect(scheduledRuns).toHaveLength(2);
    expect(scheduledRuns.find((run) => run.attempt === 2)).toMatchObject({ retryOfRunId: scheduledRuns.find((run) => run.attempt === 1)?.id, status: "succeeded" });
    expect(store.listRunEvents(scheduledRuns.find((run) => run.attempt === 1)!.id).some((event) => event.eventType === "run.retry_scheduled")).toBe(true);
    const manual = execution.createRun(spec.id);
    await execution.startRun(manual.id);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
    expect(store.listRuns().filter((run) => run.retryOfRunId === manual.id)).toHaveLength(0);
    store.close();
  });

  it("stops scheduled recovery at max attempts and emits an operator-visible event", async () => {
    const clock = new MutableClock(new Date("2026-08-01T00:00:00.000Z"));
    const store = new SqliteVNextStore();
    const alwaysFailing: ExecutorAdapter = { type: "fake", validate: () => undefined, health: () => ({ available: true, detail: "downstream unavailable" }), execute: async () => { throw new Error("TEMPORARY_DOWNSTREAM_FAILURE"); } };
    const execution = new PersonalOsService(store, [alwaysFailing], clock);
    const spec = execution.createWorkSpec({ title: "有限恢复", instructions: "最多两次", executorType: "fake", input: {}, kind: "workflow", maxAttempts: 2 });
    const schedules = new ScheduleService(store, execution, clock);
    schedules.create({ workSpecId: spec.id, name: "每分钟", cronExpression: "* * * * *", timezone: "UTC", enabled: true, catchUp: true });
    clock.value = new Date("2026-08-01T00:01:00.000Z");
    await schedules.tick();
    await waitUntil(() => store.listRuns().length === 2 && store.listRuns().every((run) => run.status === "failed"));
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
    expect(store.listRuns()).toHaveLength(2);
    const finalRun = store.listRuns().find((run) => run.attempt === 2)!;
    expect(store.listRunEvents(finalRun.id).some((event) => event.eventType === "run.retry_exhausted")).toBe(true);
    store.close();
  });

  it("creates at most one run for a schedule occurrence", async () => {
    const clock = new MutableClock(new Date("2026-08-01T00:00:00.000Z"));
    const store = new SqliteVNextStore();
    const fake = new FakeExecutor();
    const execution = new PersonalOsService(store, [fake], clock);
    const workSpec = execution.createWorkSpec({ title: "workflow", instructions: "workflow", executorType: "fake", input: {}, projectId: null, kind: "workflow", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const schedules = new ScheduleService(store, execution, clock);
    schedules.create({ workSpecId: workSpec.id, name: "每分钟", cronExpression: "* * * * *", timezone: "UTC", enabled: true, catchUp: true });
    clock.value = new Date("2026-08-01T00:01:00.000Z");
    expect(await schedules.tick()).toBe(1);
    expect(await schedules.tick()).toBe(0);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
    expect(store.listRuns()).toHaveLength(1);
    expect(fake.executions).toBe(1);
    store.close();
  });

  it("catches up at most once after a database restart and keeps run-now independent", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-schedule-restart-"));
    const database = join(root, "schedule.db");
    const clock = new MutableClock(new Date("2026-08-01T00:00:00.000Z"));
    const firstStore = new SqliteVNextStore(database);
    const firstExecution = new PersonalOsService(firstStore, [new FakeExecutor()], clock);
    const spec = firstExecution.createWorkSpec({ title: "restart", instructions: "restart", executorType: "fake", input: {}, projectId: null, kind: "workflow", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const firstSchedules = new ScheduleService(firstStore, firstExecution, clock);
    const schedule = firstSchedules.create({ workSpecId: spec.id, name: "每分钟", cronExpression: "* * * * *", timezone: "UTC", enabled: true, catchUp: true });
    const planned = schedule.nextRunAt;
    firstStore.close();

    clock.value = new Date("2026-08-01T00:04:00.000Z");
    const secondStore = new SqliteVNextStore(database);
    const fake = new FakeExecutor();
    const secondExecution = new PersonalOsService(secondStore, [fake], clock);
    const secondSchedules = new ScheduleService(secondStore, secondExecution, clock);
    expect(await secondSchedules.tick()).toBe(1);
    expect(await secondSchedules.tick()).toBe(0);
    const beforeRunNow = secondStore.getSchedule(schedule.id)?.nextRunAt;
    secondSchedules.runNow(schedule.id);
    expect(secondStore.getSchedule(schedule.id)?.nextRunAt).toBe(beforeRunNow);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
    expect(secondStore.listRuns()).toHaveLength(2);
    expect(secondStore.listRuns().some((run) => run.idempotencyKey === `${schedule.id}:${planned}`)).toBe(true);
    expect(secondSchedules.health()).toMatchObject({ status: "healthy", lastTickAt: clock.value.toISOString(), enabledSchedules: 1 });
    secondStore.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("skips stale occurrences when catch-up is disabled", async () => {
    const clock = new MutableClock(new Date("2026-08-01T00:00:00.000Z"));
    const store = new SqliteVNextStore();
    const fake = new FakeExecutor();
    const execution = new PersonalOsService(store, [fake], clock);
    const spec = execution.createWorkSpec({ title: "skip", instructions: "skip", executorType: "fake", input: {}, projectId: null, kind: "workflow", timeoutSeconds: 5, maxAttempts: 2, lifecycleStatus: "active" });
    const schedules = new ScheduleService(store, execution, clock);
    const schedule = schedules.create({ workSpecId: spec.id, name: "不补跑", cronExpression: "* * * * *", timezone: "UTC", enabled: true, catchUp: false });
    clock.value = new Date("2026-08-01T00:05:00.000Z");
    expect(await schedules.tick()).toBe(0);
    expect(store.listRuns()).toHaveLength(0);
    expect(store.getSchedule(schedule.id)).toMatchObject({ lastRunAt: schedule.nextRunAt });
    store.close();
  });
});
