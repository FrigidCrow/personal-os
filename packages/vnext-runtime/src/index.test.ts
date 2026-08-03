import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@personal-os/vnext-application";
import { CodexExecutor, InternalExecutor, OpenWorkerExecutor, ProcessExecutor, buildRuntimePrompt } from "./index.js";

function context(input: unknown): ExecutionContext {
  return {
    run: { id: "r", workSpecId: "w", projectId: null, executorType: "internal", status: "running", input, attempt: 1, idempotencyKey: null, retryOfRunId: null, externalRunId: null, errorCode: null, errorMessage: null, result: null, usage: null, actualCostMinor: null, actualCostCurrency: null, costSource: null, reviewStatus: "not_required", reviewedAt: null, reviewComment: null, createdAt: "", startedAt: "", finishedAt: null },
    workSpec: { id: "w", projectId: null, kind: "one_off", title: "test", instructions: "test", executorType: "internal", input, timeoutSeconds: 10, maxAttempts: 2, lifecycleStatus: "active", skill: null, createdAt: "", updatedAt: "" },
    project: null,
    resume: null,
    signal: new AbortController().signal,
    emit: () => undefined
  };
}

function projectContext(root: string, executorType: "codex" | "openworker", input: unknown = {}): ExecutionContext {
  const ctx = context(input);
  ctx.run.executorType = executorType;
  ctx.run.projectId = "p";
  ctx.workSpec.executorType = executorType;
  ctx.workSpec.projectId = "p";
  ctx.workSpec.instructions = "只返回验收结果";
  ctx.project = { id: "p", name: "runtime fixture", description: "", repositoryPath: root, obsidianPath: null, status: "active", createdAt: "", updatedAt: "" };
  return ctx;
}

class FakeOpenWorkerSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer | Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: Array<Record<string, unknown>> = [];
  closed = false;

  constructor(private readonly afterUserMessage: Array<Record<string, unknown>>) {
    queueMicrotask(() => this.emit({ type: "ready", data: { session_id: "session" } }));
  }

  send(raw: string): void {
    const message = JSON.parse(raw) as Record<string, unknown>;
    this.sent.push(message);
    if (["user_message", "approval", "directory_response", "plan_response", "question_response"].includes(String(message.type))) {
      for (const event of this.afterUserMessage) queueMicrotask(() => this.emit(event));
    }
  }
  close(): void { this.closed = true; }
  private emit(event: Record<string, unknown>): void { this.onmessage?.({ data: JSON.stringify(event) }); }
}

describe("runtime adapters", () => {
  it("executes the internal adapter", async () => {
    const result = await new InternalExecutor().execute(context({ operation: "echo", message: "ok", delayMs: 0 }));
    expect(result).toEqual({ status: "succeeded", result: { message: "ok", operation: "echo" } });
  });

  it("executes argv without a shell", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-runtime-"));
    const adapter = new ProcessExecutor({ allowedRoots: [root], allowedExecutables: ["node"] });
    const ctx = context({ command: "node", args: ["-e", "process.stdout.write('safe')"], cwd: root });
    ctx.run.executorType = "process";
    const result = await adapter.execute(ctx);
    expect(result.result).toEqual({ exitCode: 0 });
  });

  it("rejects executable and working-directory escapes", () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-runtime-"));
    const adapter = new ProcessExecutor({ allowedRoots: [root] });
    expect(() => adapter.validate(context({ command: "sh", args: ["-c", "echo unsafe"], cwd: root }))).toThrow("EXECUTABLE_NOT_ALLOWED");
    expect(() => adapter.validate(context({ command: "node", args: [], cwd: "/" }))).toThrow("WORKING_DIRECTORY_NOT_ALLOWED");
  });

  it("runs Codex through the provider SDK contract with safe defaults", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-codex-"));
    mkdirSync(join(root, ".git"));
    let receivedOptions: Record<string, unknown> = {};
    let receivedSignal: AbortSignal | undefined;
    const emitted: Array<Record<string, unknown>> = [];
    const adapter = new CodexExecutor({
      allowedRoots: [root],
      clientFactory: () => ({
        startThread(options) {
          receivedOptions = options;
          return {
            id: null,
            async runStreamed(_prompt, options) {
              receivedSignal = options.signal;
              return { events: (async function* () {
                yield { type: "thread.started", thread_id: "codex-thread" } as const;
                yield { type: "item.completed", item: { id: "mcp", type: "mcp_tool_call", server: "personal_os", tool: "get_run_context", arguments: {}, result: { content: [], structured_content: {} }, status: "completed" } } as const;
                yield { type: "item.completed", item: { id: "warning", type: "error", message: "non-fatal SDK warning" } } as const;
                yield { type: "item.completed", item: { id: "a", type: "agent_message", text: "只读检查完成" } } as const;
                yield { type: "turn.completed", usage: { input_tokens: 10, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 4, reasoning_output_tokens: 0 } } as const;
              })() };
            }
          };
        }
      })
    });
    const ctx = projectContext(root, "codex", { password: "do-not-send", runtime: { additionalInstructions: "API key: another-secret" } });
    ctx.emit = (event) => emitted.push(event as unknown as Record<string, unknown>);
    const result = await adapter.execute(ctx);
    expect(receivedOptions).toMatchObject({ workingDirectory: root, sandboxMode: "read-only", approvalPolicy: "never", networkAccessEnabled: false, webSearchMode: "disabled" });
    expect(receivedSignal).toBe(ctx.signal);
    expect(result).toMatchObject({ status: "succeeded", externalRunId: "codex-thread", result: { finalResponse: "只读检查完成" } });
    expect(result.usage).toMatchObject({ input_tokens: 10, output_tokens: 4 });
    expect(emitted).toContainEqual(expect.objectContaining({ eventType: "runtime.mcp_tool_call", message: "Personal OS MCP：personal_os.get_run_context completed" }));
    expect(buildRuntimePrompt(ctx)).not.toContain("do-not-send");
    expect(buildRuntimePrompt(ctx, "API key: another-secret")).not.toContain("another-secret");
  });

  it("rejects Codex outside allowed roots and non-Git projects", () => {
    const allowed = mkdtempSync(join(tmpdir(), "personal-os-allowed-"));
    const outside = mkdtempSync(join(tmpdir(), "personal-os-outside-"));
    const adapter = new CodexExecutor({ allowedRoots: [allowed] });
    expect(() => adapter.validate(projectContext(outside, "codex"))).toThrow("WORKING_DIRECTORY_NOT_ALLOWED");
    expect(() => adapter.validate(projectContext(allowed, "codex"))).toThrow("CODEX_GIT_REPOSITORY_REQUIRED");
  });

  it("resumes the persisted Codex thread instead of starting a new one", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-codex-resume-"));
    mkdirSync(join(root, ".git"));
    let resumedId = "";
    let prompt = "";
    const thread = {
      id: "codex-existing",
      async runStreamed(value: string) {
        prompt = value;
        return { events: (async function* () {
          yield { type: "item.completed", item: { id: "a", type: "agent_message", text: "继续完成" } } as const;
          yield { type: "turn.completed", usage: { input_tokens: 2, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 2, reasoning_output_tokens: 0 } } as const;
        })() };
      }
    };
    const adapter = new CodexExecutor({ allowedRoots: [root], clientFactory: () => ({
      startThread: () => { throw new Error("must not start"); },
      resumeThread: (id) => { resumedId = id; return thread; }
    }) });
    const ctx = projectContext(root, "codex");
    ctx.run.externalRunId = "codex-existing";
    ctx.resume = { kind: "input", answer: "请继续", request: { question: "继续？" } };
    expect(await adapter.execute(ctx)).toMatchObject({ status: "succeeded", externalRunId: "codex-existing" });
    expect(resumedId).toBe("codex-existing");
    expect(prompt).toContain("请继续");
    expect(prompt).not.toContain("Work: test");
  });

  it("maps an OpenWorker turn to a unified result without exposing its token", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-openworker-"));
    const tokenFile = join(root, "token");
    writeFileSync(tokenFile, "super-secret-token\n", { mode: 0o600 });
    const events: unknown[] = [];
    let socket: FakeOpenWorkerSocket | null = null;
    const adapter = new OpenWorkerExecutor({
      allowedRoots: [root], managedRoot: join(root, "managed"), tokenFile,
      socketFactory: (_url, protocols) => {
        expect(protocols).toEqual(["openworker", "super-secret-token"]);
        socket = new FakeOpenWorkerSocket([
          { type: "tool_finished", data: { name: "read_file", status: "completed", token: "super-secret-token" } },
          { type: "assistant_message", data: { text: "OpenWorker 检查完成" } },
          { type: "turn_done", data: {} }
        ]);
        return socket;
      }
    });
    const ctx = projectContext(root, "openworker", { runtime: { agent: "cowork" } });
    ctx.emit = (event) => events.push(event);
    const result = await adapter.execute(ctx);
    expect(result).toMatchObject({ status: "succeeded", externalRunId: "personal-os-v2-r", result: { finalResponse: "OpenWorker 检查完成" } });
    expect(JSON.stringify(events)).not.toContain("super-secret-token");
    expect(socket!.sent.some((item) => item.type === "user_message")).toBe(true);
  });

  it.each([
    ["permission_required", "waiting_approval"],
    ["directory_requested", "waiting_approval"],
    ["plan_proposed", "waiting_approval"],
    ["question_requested", "waiting_input"]
  ] as const)("maps OpenWorker %s to %s", async (eventType, status) => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-openworker-wait-"));
    const tokenFile = join(root, "token");
    writeFileSync(tokenFile, "token", { mode: 0o600 });
    const socket = new FakeOpenWorkerSocket([{ type: eventType, data: { question: "确认？", password: "hidden" } }]);
    const adapter = new OpenWorkerExecutor({ allowedRoots: [root], managedRoot: join(root, "managed"), tokenFile, socketFactory: () => socket });
    const result = await adapter.execute(projectContext(root, "openworker"));
    expect(result.status).toBe(status);
    expect(JSON.stringify(result)).not.toContain("hidden");
    expect(socket.sent.some((item) => item.type === "approval")).toBe(false);
  });

  it("continues a persisted OpenWorker question with a protocol response", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-openworker-resume-"));
    const tokenFile = join(root, "token");
    writeFileSync(tokenFile, "token", { mode: 0o600 });
    const socket = new FakeOpenWorkerSocket([{ type: "assistant_message", data: { text: "继续完成" } }, { type: "turn_done", data: {} }]);
    const adapter = new OpenWorkerExecutor({ allowedRoots: [root], managedRoot: join(root, "managed"), tokenFile, socketFactory: () => socket });
    const ctx = projectContext(root, "openworker");
    ctx.run.externalRunId = "openworker-existing";
    ctx.resume = { kind: "input", answer: "继续", request: { question: "继续？" } };
    expect(await adapter.execute(ctx)).toMatchObject({ status: "succeeded", externalRunId: "openworker-existing" });
    expect(socket.sent).toContainEqual({ type: "question_response", answer: "继续" });
    expect(socket.sent.some((item) => item.type === "user_message")).toBe(false);
  });

  it("maps approval decisions to fail-closed OpenWorker protocol frames", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-openworker-approval-"));
    const tokenFile = join(root, "token");
    writeFileSync(tokenFile, "token", { mode: 0o600 });
    const socket = new FakeOpenWorkerSocket([{ type: "assistant_message", data: { text: "安全结束" } }, { type: "turn_done", data: {} }]);
    const adapter = new OpenWorkerExecutor({ allowedRoots: [root], managedRoot: join(root, "managed"), tokenFile, socketFactory: () => socket });
    const ctx = projectContext(root, "openworker");
    ctx.run.externalRunId = "openworker-existing";
    ctx.resume = { kind: "approval", decision: "expired", requestType: "directory_requested", request: { path: "/", writable: true }, comment: "expired" };
    await adapter.execute(ctx);
    expect(socket.sent).toContainEqual({ type: "directory_response", granted: false, path: "", writable: false });
  });

  it.each([
    ["permission_required", "approved", { type: "approval", decision: "once" }],
    ["plan_proposed", "rejected", { type: "plan_response", approved: false, mode: "interactive", feedback: "deny" }]
  ] as const)("maps %s %s to the native OpenWorker response", async (requestType, decision, expectedFrame) => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-openworker-native-"));
    const tokenFile = join(root, "token");
    writeFileSync(tokenFile, "token", { mode: 0o600 });
    const socket = new FakeOpenWorkerSocket([{ type: "assistant_message", data: { text: "decision applied" } }, { type: "turn_done", data: {} }]);
    const adapter = new OpenWorkerExecutor({ allowedRoots: [root], managedRoot: join(root, "managed"), tokenFile, socketFactory: () => socket });
    const ctx = projectContext(root, "openworker");
    ctx.run.externalRunId = "openworker-existing";
    ctx.resume = { kind: "approval", decision, requestType, request: {}, comment: "deny" };
    await adapter.execute(ctx);
    expect(socket.sent).toContainEqual(expectedFrame);
  });

  it("grants only an explicitly approved OpenWorker directory inside an allowed root", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-openworker-directory-"));
    const tokenFile = join(root, "token");
    writeFileSync(tokenFile, "token", { mode: 0o600 });
    const socket = new FakeOpenWorkerSocket([{ type: "assistant_message", data: { text: "directory applied" } }, { type: "turn_done", data: {} }]);
    const adapter = new OpenWorkerExecutor({ allowedRoots: [root], managedRoot: join(root, "managed"), tokenFile, socketFactory: () => socket });
    const ctx = projectContext(root, "openworker");
    ctx.run.externalRunId = "openworker-existing";
    ctx.resume = { kind: "approval", decision: "approved", requestType: "directory_requested", request: { path: root, writable: true }, comment: "allow" };
    await adapter.execute(ctx);
    expect(socket.sent).toContainEqual({ type: "directory_response", granted: true, path: root, writable: true });
  });

  it("checks OpenWorker health with file-backed authentication", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-openworker-health-"));
    const tokenFile = join(root, "token");
    writeFileSync(tokenFile, "health-token", { mode: 0o600 });
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("X-OpenWorker-Token")).toBe("health-token");
      return new Response('{"status":"ok"}', { status: 200 });
    }) as typeof fetch;
    const adapter = new OpenWorkerExecutor({ allowedRoots: [root], managedRoot: join(root, "managed"), tokenFile, fetcher });
    expect(await adapter.health()).toEqual({ available: true, detail: "OpenWorker 本地服务与 Token 验证通过。" });
  });

  it("interrupts OpenWorker when the unified Run is cancelled", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-openworker-cancel-"));
    const tokenFile = join(root, "token");
    writeFileSync(tokenFile, "token", { mode: 0o600 });
    const socket = new FakeOpenWorkerSocket([]);
    const adapter = new OpenWorkerExecutor({ allowedRoots: [root], managedRoot: join(root, "managed"), tokenFile, socketFactory: () => socket });
    const controller = new AbortController();
    const ctx = projectContext(root, "openworker");
    ctx.signal = controller.signal;
    const pending = adapter.execute(ctx);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    controller.abort(new Error("CANCELLED"));
    await expect(pending).rejects.toThrow("CANCELLED");
    expect(socket.sent.some((item) => item.type === "interrupt")).toBe(true);
  });

  it("rejects empty OpenWorker and Codex turns instead of reporting success", async () => {
    const root = mkdtempSync(join(tmpdir(), "personal-os-runtime-empty-"));
    mkdirSync(join(root, ".git"));
    const tokenFile = join(root, "token");
    writeFileSync(tokenFile, "token", { mode: 0o600 });
    const openWorker = new OpenWorkerExecutor({
      allowedRoots: [root], managedRoot: join(root, "managed"), tokenFile,
      socketFactory: () => new FakeOpenWorkerSocket([{ type: "turn_done", data: {} }])
    });
    await expect(openWorker.execute(projectContext(root, "openworker"))).rejects.toThrow("OPENWORKER_EMPTY_RESULT");

    const codex = new CodexExecutor({ allowedRoots: [root], clientFactory: () => ({ startThread: () => ({
      id: null,
      async runStreamed() { return { events: (async function* () { yield { type: "turn.completed", usage: { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 } } as const; })() }; }
    }) }) });
    await expect(codex.execute(projectContext(root, "codex"))).rejects.toThrow("CODEX_EMPTY_RESULT");
  });
});
