import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { Codex, type ThreadEvent, type ThreadItem, type ThreadOptions } from "@openai/codex-sdk";
import {
  codexRuntimeOptionsSchema,
  internalExecutionInputSchema,
  openWorkerRuntimeOptionsSchema,
  processExecutionInputSchema
} from "@personal-os/vnext-contracts";
import type { ExecutionContext, ExecutionResult, ExecutorAdapter } from "@personal-os/vnext-application";

export class InternalExecutor implements ExecutorAdapter {
  readonly type = "internal" as const;

  validate(context: ExecutionContext): void {
    internalExecutionInputSchema.parse(context.run.input);
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const input = internalExecutionInputSchema.parse(context.run.input);
    context.emit({ eventType: "executor.started", level: "info", source: "internal", message: "Internal Executor 已启动。" });
    if (input.delayMs > 0) await abortableDelay(input.delayMs, context.signal);
    if (input.operation === "fail") {
      context.emit({ eventType: "executor.error", level: "error", source: "internal", message: input.message || "模拟执行失败。" });
      throw new Error(input.message || "INTERNAL_FAILURE");
    }
    context.emit({ eventType: "executor.output", level: "info", source: "internal", message: input.message || "执行完成。" });
    return { status: "succeeded", result: { message: input.message, operation: input.operation } };
  }

  health() { return { available: true, detail: "内置执行器可用。" }; }
}

export interface ProcessExecutorOptions {
  allowedExecutables?: string[];
  allowedRoots: string[];
}

export class ProcessExecutor implements ExecutorAdapter {
  readonly type = "process" as const;
  private readonly allowedExecutables: Set<string>;
  private readonly allowedRoots: string[];

  constructor(options: ProcessExecutorOptions) {
    this.allowedExecutables = new Set(options.allowedExecutables ?? ["python3", "node"]);
    this.allowedRoots = options.allowedRoots.map((root) => resolve(root));
  }

  validate(context: ExecutionContext): void {
    const input = processExecutionInputSchema.parse(context.run.input);
    if (!this.allowedExecutables.has(input.command)) throw new Error(`EXECUTABLE_NOT_ALLOWED:${input.command}`);
    const cwd = resolve(input.cwd);
    if (!this.allowedRoots.some((root) => isInside(root, cwd))) throw new Error(`WORKING_DIRECTORY_NOT_ALLOWED:${cwd}`);
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const input = processExecutionInputSchema.parse(context.run.input);
    this.validate(context);
    context.emit({ eventType: "executor.started", level: "info", source: "process", message: `启动 ${input.command}。`, structuredData: { command: input.command, args: input.args, cwd: input.cwd } });
    return await new Promise<ExecutionResult>((resolvePromise, reject) => {
      const child = spawn(input.command, input.args, {
        cwd: resolve(input.cwd),
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin", LANG: process.env.LANG ?? "en_US.UTF-8" }
      });
      const onAbort = () => child.kill("SIGTERM");
      context.signal.addEventListener("abort", onAbort, { once: true });
      child.stdout.on("data", (chunk: Buffer) => context.emit({ eventType: "executor.stdout", level: "info", source: "process", message: chunk.toString("utf8") }));
      child.stderr.on("data", (chunk: Buffer) => context.emit({ eventType: "executor.stderr", level: "warning", source: "process", message: chunk.toString("utf8") }));
      child.once("error", reject);
      child.once("close", (code, signal) => {
        context.signal.removeEventListener("abort", onAbort);
        if (context.signal.aborted) {
          reject(context.signal.reason instanceof Error ? context.signal.reason : new Error("CANCELLED"));
          return;
        }
        if (code !== 0) {
          reject(new Error(`PROCESS_EXITED:${code ?? signal ?? "unknown"}`));
          return;
        }
        resolvePromise({ status: "succeeded", result: { exitCode: code ?? 0 } });
      });
    });
  }

  health() {
    return { available: this.allowedRoots.length > 0, detail: `允许执行：${[...this.allowedExecutables].join(", ")}` };
  }
}

export class FakeExecutor implements ExecutorAdapter {
  readonly type = "fake" as const;
  executions = 0;
  constructor(private readonly result: ExecutionResult = { status: "succeeded", result: { fake: true } }) {}
  validate(): void {}
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    this.executions += 1;
    context.emit({ eventType: "executor.output", level: "info", source: "fake", message: "fake output" });
    return this.result;
  }
  health() { return { available: true, detail: "测试执行器可用。" }; }
}

interface CodexThreadLike {
  readonly id: string | null;
  runStreamed(input: string, options: { signal?: AbortSignal }): Promise<{ events: AsyncIterable<ThreadEvent> }>;
}

interface CodexClientLike {
  startThread(options: ThreadOptions): CodexThreadLike;
  resumeThread?(id: string, options?: ThreadOptions): CodexThreadLike;
}

export interface CodexExecutorOptions {
  allowedRoots: string[];
  mcpServerPath?: string;
  apiBaseUrl?: string;
  clientFactory?: (context: ExecutionContext) => CodexClientLike;
  managedResources?: Record<string, ManagedResourceController>;
}

export interface ManagedResourceController {
  start(signal: AbortSignal): Promise<void>;
  stop(): Promise<void>;
}

export interface CommandManagedResourceOptions {
  command: string;
  startArgs: string[];
  stopArgs: string[];
  cwd: string;
  timeoutMs?: number;
}

/** Runs a trusted, preconfigured lifecycle command without a shell. */
export class CommandManagedResourceController implements ManagedResourceController {
  private readonly timeoutMs: number;

  constructor(private readonly options: CommandManagedResourceOptions) {
    if (!isAbsolute(options.command)) throw new Error("MANAGED_RESOURCE_COMMAND_MUST_BE_ABSOLUTE");
    if (!isAbsolute(options.cwd)) throw new Error("MANAGED_RESOURCE_CWD_MUST_BE_ABSOLUTE");
    this.timeoutMs = options.timeoutMs ?? 240_000;
  }

  async start(signal: AbortSignal): Promise<void> {
    await runManagedCommand(this.options.command, this.options.startArgs, this.options.cwd, this.timeoutMs, signal);
  }

  async stop(): Promise<void> {
    await runManagedCommand(this.options.command, this.options.stopArgs, this.options.cwd, this.timeoutMs);
  }
}

const PERSONAL_OS_MCP_TOOL_NAMES = [
  "get_run_context",
  "append_run_event",
  "save_checkpoint",
  "search_knowledge",
  "save_artifact",
  "request_approval",
  "get_approval_status",
  "submit_run_result"
] as const;

export class CodexExecutor implements ExecutorAdapter {
  readonly type = "codex" as const;
  private readonly allowedRoots: string[];
  private readonly clientFactory: (context: ExecutionContext) => CodexClientLike;
  private readonly mcpServerPath: string | null;
  private readonly apiBaseUrl: string;
  private readonly managedResources: Readonly<Record<string, ManagedResourceController>>;

  constructor(options: CodexExecutorOptions) {
    this.allowedRoots = options.allowedRoots.map((root) => resolve(root));
    this.mcpServerPath = options.mcpServerPath ? resolve(options.mcpServerPath) : null;
    this.apiBaseUrl = (options.apiBaseUrl ?? "http://127.0.0.1:8787").replace(/\/$/, "");
    this.managedResources = options.managedResources ?? {};
    this.clientFactory = options.clientFactory ?? ((context) => {
      const mcp: Record<string, {
        command: string;
        args: string[];
        env: Record<string, string>;
        enabled_tools: string[];
        default_tools_approval_mode: "approve";
      }> = {};
      if (context.capability && this.mcpServerPath) {
        mcp.personal_os = {
          command: process.execPath,
          args: [this.mcpServerPath],
          enabled_tools: [...PERSONAL_OS_MCP_TOOL_NAMES],
          // This approval applies only to this per-run, loopback-only MCP server.
          // Core API capability scopes remain the authorization boundary.
          default_tools_approval_mode: "approve",
          env: {
            PERSONAL_OS_API_URL: this.apiBaseUrl,
            PERSONAL_OS_RUN_CAPABILITY: context.capability.token
          }
        };
      }
      return new Codex({
        config: {
          features: { skill_search: false, plugins: false },
          skills: { include_instructions: false },
          mcp_servers: mcp
        }
      }) as unknown as CodexClientLike;
    });
  }

  validate(context: ExecutionContext): void {
    const repository = context.project?.repositoryPath;
    if (!repository) throw new Error("CODEX_PROJECT_REPOSITORY_REQUIRED");
    const cwd = resolve(repository);
    if (!this.allowedRoots.some((root) => isInside(root, cwd))) throw new Error(`WORKING_DIRECTORY_NOT_ALLOWED:${cwd}`);
    if (!existsSync(cwd) || !statSync(cwd).isDirectory() || !existsSync(join(cwd, ".git"))) {
      throw new Error(`CODEX_GIT_REPOSITORY_REQUIRED:${cwd}`);
    }
    const options = codexOptions(context.run.input);
    if (options.managedResource && !this.managedResources[options.managedResource]) {
      throw new Error(`MANAGED_RESOURCE_UNAVAILABLE:${options.managedResource}`);
    }
    for (const directory of options.additionalDirectories) {
      if (!isAbsolute(directory)) throw new Error(`ADDITIONAL_DIRECTORY_MUST_BE_ABSOLUTE:${directory}`);
      const resolved = resolve(directory);
      if (!this.allowedRoots.some((root) => isInside(root, resolved))) throw new Error(`ADDITIONAL_DIRECTORY_NOT_ALLOWED:${resolved}`);
      if (!existsSync(resolved) || !statSync(resolved).isDirectory()) throw new Error(`ADDITIONAL_DIRECTORY_NOT_FOUND:${resolved}`);
    }
    if (options.webSearch && !options.networkAccess) throw new Error("CODEX_WEB_SEARCH_REQUIRES_NETWORK");
    if (context.capability && (!this.mcpServerPath || !existsSync(this.mcpServerPath))) throw new Error("PERSONAL_OS_MCP_SERVER_MISSING");
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    this.validate(context);
    const options = codexOptions(context.run.input);
    const managedResource = options.managedResource ? this.managedResources[options.managedResource]! : null;
    try {
      if (managedResource) {
        context.emit({ eventType: "managed_resource.starting", level: "info", source: "codex", message: `正在准备受管资源 ${options.managedResource}。` });
        await managedResource.start(context.signal);
        context.emit({ eventType: "managed_resource.ready", level: "info", source: "codex", message: `受管资源 ${options.managedResource} 已就绪。` });
      }
      return await this.executeThread(context, options);
    } finally {
      if (managedResource) {
        context.emit({ eventType: "managed_resource.stopping", level: "info", source: "codex", message: `正在释放受管资源 ${options.managedResource}。` });
        await managedResource.stop();
        context.emit({ eventType: "managed_resource.stopped", level: "info", source: "codex", message: `受管资源 ${options.managedResource} 已释放。` });
      }
    }
  }

  private async executeThread(context: ExecutionContext, options: ReturnType<typeof codexOptions>): Promise<ExecutionResult> {
    const cwd = resolve(context.project!.repositoryPath!);
    const threadOptions: ThreadOptions = {
      workingDirectory: cwd,
      skipGitRepoCheck: false,
      sandboxMode: options.sandboxMode,
      approvalPolicy: "never",
      networkAccessEnabled: options.networkAccess,
      webSearchMode: options.webSearch ? "live" : "disabled",
      ...(options.additionalDirectories.length > 0 ? { additionalDirectories: options.additionalDirectories.map((directory) => resolve(directory)) } : {}),
      ...(options.model ? { model: options.model } : {})
    };
    context.emit({
      eventType: "executor.started",
      level: "info",
      source: "codex",
      message: "Codex Runtime 已启动。",
      structuredData: { sandboxMode: options.sandboxMode, networkAccess: options.networkAccess, webSearch: options.webSearch }
    });
    const client = this.clientFactory(context);
    if (context.resume && !client.resumeThread) throw new Error("CODEX_RESUME_UNAVAILABLE");
    const thread = context.resume && context.run.externalRunId
      ? client.resumeThread!(context.run.externalRunId, threadOptions)
      : client.startThread(threadOptions);
    const prompt = context.resume ? buildResumePrompt(context.resume) : buildRuntimePrompt(context, options.additionalInstructions);
    const streamed = await thread.runStreamed(prompt, { signal: context.signal });
    let externalRunId: string | null = thread.id;
    let finalResponse = "";
    let usage: unknown = null;
    let fatalError: string | null = null;
    const artifactPaths = new Set<string>();
    for await (const event of streamed.events) {
      if (event.type === "thread.started") {
        externalRunId = event.thread_id;
        context.emit({ eventType: "runtime.session", level: "info", source: "codex", message: "Codex 会话已建立。", structuredData: { externalRunId } });
      } else if (event.type === "item.completed") {
        if (event.item.type === "agent_message") finalResponse = event.item.text;
        if (event.item.type === "file_change" && event.item.status === "completed") {
          for (const change of event.item.changes) {
            if (change.kind === "delete") continue;
            const absolute = resolve(cwd, change.path);
            // Additional directories can be writable, but Git artifacts remain
            // repository-scoped. An Obsidian write must not fail the whole Run.
            if (isInside(cwd, absolute)) artifactPaths.add(absolute);
          }
        }
        context.emit(codexItemEvent(event.item));
      } else if (event.type === "turn.completed") {
        usage = event.usage;
        context.emit({ eventType: "runtime.usage", level: "info", source: "codex", message: "Codex 已返回可信 Token 用量。", structuredData: event.usage });
      } else if (event.type === "turn.failed") {
        fatalError = event.error.message;
      } else if (event.type === "error") {
        fatalError = event.message;
      }
    }
    if (fatalError) throw new Error(`CODEX_EXECUTION_FAILED:${fatalError}`);
    if (!finalResponse.trim()) throw new Error("CODEX_EMPTY_RESULT");
    return {
      status: "succeeded",
      externalRunId,
      result: { runtime: "codex", finalResponse, usage, cost: null },
      usage,
      artifacts: [...artifactPaths].map((path) => ({ storageKind: "git", name: path.split(/[\\/]/).pop() || path, uri: path, mimeType: null }))
    };
  }

  health() {
    return { available: this.allowedRoots.length > 0, detail: "Codex SDK 已配置；Runtime 隔离全局 Plugin/Skill 搜索，真实认证在只读冒烟执行时验证。" };
  }
}

async function runManagedCommand(command: string, args: string[], cwd: string, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  if (!existsSync(command) || !statSync(command).isFile()) throw new Error(`MANAGED_RESOURCE_COMMAND_NOT_FOUND:${command}`);
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) throw new Error(`MANAGED_RESOURCE_CWD_NOT_FOUND:${cwd}`);
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin", LANG: process.env.LANG ?? "en_US.UTF-8" }
    });
    let stderr = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (error) rejectPromise(error);
      else resolvePromise();
    };
    const onAbort = () => {
      child.kill("SIGTERM");
      finish(signal?.reason instanceof Error ? signal.reason : new Error("CANCELLED"));
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error(`MANAGED_RESOURCE_TIMEOUT:${command}`));
    }, timeoutMs);
    timer.unref();
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.once("error", (error) => finish(error));
    child.once("close", (code, closeSignal) => {
      if (code === 0) finish();
      else finish(new Error(`MANAGED_RESOURCE_EXITED:${code ?? closeSignal ?? "unknown"}:${truncate(stderr, 1_000)}`));
    });
  });
}

interface SocketMessageEvent { data: string | ArrayBuffer | Blob }
interface OpenWorkerSocket {
  onopen: (() => void) | null;
  onmessage: ((event: SocketMessageEvent) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export interface OpenWorkerExecutorOptions {
  allowedRoots: string[];
  managedRoot: string;
  baseUrl?: string;
  tokenFile?: string;
  fetcher?: typeof fetch;
  socketFactory?: (url: string, protocols: string[]) => OpenWorkerSocket;
}

export class OpenWorkerExecutor implements ExecutorAdapter {
  readonly type = "openworker" as const;
  private readonly allowedRoots: string[];
  private readonly managedRoot: string;
  private readonly baseUrl: string;
  private readonly tokenFile: string;
  private readonly fetcher: typeof fetch;
  private readonly socketFactory: (url: string, protocols: string[]) => OpenWorkerSocket;

  constructor(options: OpenWorkerExecutorOptions) {
    this.allowedRoots = options.allowedRoots.map((root) => resolve(root));
    this.managedRoot = resolve(options.managedRoot);
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:8765").replace(/\/$/, "");
    this.tokenFile = resolve(options.tokenFile ?? join(homedir(), ".config", "coworker", "personal-os-8765.token"));
    this.fetcher = options.fetcher ?? fetch;
    this.socketFactory = options.socketFactory ?? ((url, protocols) => new WebSocket(url, protocols) as unknown as OpenWorkerSocket);
  }

  validate(context: ExecutionContext): void {
    assertLoopback(this.baseUrl);
    if (!existsSync(this.tokenFile) || !statSync(this.tokenFile).isFile()) throw new Error("OPENWORKER_TOKEN_FILE_MISSING");
    openWorkerOptions(context.run.input);
    this.resolveWorkspace(context);
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    this.validate(context);
    const runtimeOptions = openWorkerOptions(context.run.input);
    const workspace = this.resolveWorkspace(context);
    mkdirSync(workspace, { recursive: true });
    const token = this.readToken();
    const sessionId = context.run.externalRunId ?? `personal-os-v2-${context.run.id}`;
    const wsBase = this.baseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    const url = `${wsBase}/ws/session/${encodeURIComponent(sessionId)}?workspace=${encodeURIComponent(workspace)}&agent=${encodeURIComponent(runtimeOptions.agent)}`;
    context.emit({ eventType: "executor.started", level: "info", source: "openworker", message: "OpenWorker Runtime 已启动。", structuredData: { agent: runtimeOptions.agent, workspace } });

    return await new Promise<ExecutionResult>((resolvePromise, rejectPromise) => {
      const socket = this.socketFactory(url, ["openworker", token]);
      let settled = false;
      let sent = false;
      let finalResponse = "";
      let runtimeError: string | null = null;
      let partial = false;
      const finish = (result: ExecutionResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        socket.close();
        resolvePromise(result);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        socket.close();
        rejectPromise(error);
      };
      const abort = () => {
        try { socket.send(JSON.stringify({ type: "interrupt" })); } catch { /* socket may not be open */ }
        fail(context.signal.reason instanceof Error ? context.signal.reason : new Error("CANCELLED"));
      };
      const cleanup = () => context.signal.removeEventListener("abort", abort);
      context.signal.addEventListener("abort", abort, { once: true });

      socket.onopen = () => undefined;
      socket.onerror = () => fail(new Error("OPENWORKER_SOCKET_ERROR"));
      socket.onclose = () => { if (!settled) fail(new Error("OPENWORKER_SOCKET_CLOSED")); };
      socket.onmessage = (message) => {
        void messageText(message.data).then((raw) => {
          if (settled) return;
          const event = parseOpenWorkerEvent(raw);
          const data = redactSensitive(event.data, token, context.capability?.token) as Record<string, unknown>;
          if (event.type === "ready") {
            context.emit({ eventType: "runtime.session", level: "info", source: "openworker", message: "OpenWorker 会话已建立。", structuredData: { externalRunId: sessionId } });
            if (!sent) {
              sent = true;
              socket.send(JSON.stringify(context.resume
                ? this.resumeFrame(context.resume)
                : {
                    type: "user_message",
                    text: buildRuntimePrompt(context, runtimeOptions.additionalInstructions),
                    ...(runtimeOptions.model ? { model: runtimeOptions.model } : {})
                  }));
            }
            return;
          }
          if (event.type === "assistant_message") {
            const text = typeof data.text === "string" ? data.text : "";
            if (text) finalResponse = text;
            context.emit({ eventType: "runtime.output", level: "info", source: "openworker", message: truncate(text || "OpenWorker 返回了一条消息。"), structuredData: null });
            return;
          }
          if (event.type === "tool_proposed" || event.type === "tool_started" || event.type === "tool_finished") {
            context.emit({ eventType: `runtime.${event.type}`, level: event.type === "tool_finished" && data.status === "failed" ? "warning" : "info", source: "openworker", message: `OpenWorker 工具事件：${String(data.name ?? "unknown")}`, structuredData: data });
            return;
          }
          if (["permission_required", "directory_requested", "plan_proposed"].includes(event.type)) {
            context.emit({ eventType: "runtime.waiting_approval", level: "warning", source: "openworker", message: "OpenWorker 等待人工审批。", structuredData: { requestType: event.type, request: data } });
            finish({ status: "waiting_approval", externalRunId: sessionId, result: { runtime: "openworker", requestType: event.type, request: data, finalResponse: finalResponse || null } });
            return;
          }
          if (event.type === "question_requested") {
            context.emit({ eventType: "runtime.waiting_input", level: "warning", source: "openworker", message: "OpenWorker 等待用户输入。", structuredData: data });
            finish({ status: "waiting_input", externalRunId: sessionId, result: { runtime: "openworker", requestType: event.type, request: data, finalResponse: finalResponse || null } });
            return;
          }
          if (event.type === "turn_end" && data.status === "max_iterations_exceeded") partial = true;
          if (event.type === "error" || event.type === "input_rejected") runtimeError = String(data.error ?? "unknown OpenWorker error");
          if (event.type === "interrupted") runtimeError = "OpenWorker turn interrupted";
          if (event.type === "turn_done") {
            if (runtimeError) return fail(new Error(`OPENWORKER_EXECUTION_FAILED:${runtimeError}`));
            if (!finalResponse.trim()) return fail(new Error("OPENWORKER_EMPTY_RESULT"));
            finish({ status: partial ? "partially_succeeded" : "succeeded", externalRunId: sessionId, result: { runtime: "openworker", finalResponse, usage: null, cost: null }, usage: null });
          }
        }).catch((error: unknown) => fail(error instanceof Error ? error : new Error("OPENWORKER_PROTOCOL_ERROR")));
      };
    });
  }

  async health() {
    try {
      assertLoopback(this.baseUrl);
      const token = this.readToken();
      const response = await this.fetcher(`${this.baseUrl}/v1/health`, {
        headers: { "X-OpenWorker-Token": token },
        signal: AbortSignal.timeout(3_000)
      });
      if (!response.ok) return { available: false, detail: `OpenWorker health 返回 HTTP ${response.status}。` };
      return { available: true, detail: "OpenWorker 本地服务与 Token 验证通过。" };
    } catch (error) {
      return { available: false, detail: `OpenWorker 不可用：${safeError(error)}` };
    }
  }

  private readToken(): string {
    if (!existsSync(this.tokenFile)) throw new Error("OPENWORKER_TOKEN_FILE_MISSING");
    const token = readFileSync(this.tokenFile, "utf8").trim();
    if (!token) throw new Error("OPENWORKER_TOKEN_FILE_EMPTY");
    return token;
  }

  private resolveWorkspace(context: ExecutionContext): string {
    const repository = context.project?.repositoryPath;
    if (repository) {
      const cwd = resolve(repository);
      if (!existsSync(cwd) || !statSync(cwd).isDirectory()) throw new Error(`OPENWORKER_WORKSPACE_NOT_FOUND:${cwd}`);
      if (!this.allowedRoots.some((root) => isInside(root, cwd))) throw new Error(`WORKING_DIRECTORY_NOT_ALLOWED:${cwd}`);
      return cwd;
    }
    return resolve(this.managedRoot, context.run.id);
  }

  private resumeFrame(resume: NonNullable<ExecutionContext["resume"]>): Record<string, unknown> {
    if (resume.kind === "input") return { type: "question_response", answer: resume.answer };
    const approved = resume.decision === "approved";
    if (resume.requestType === "permission_required") return { type: "approval", decision: approved ? "once" : "deny" };
    if (resume.requestType === "plan_proposed") return { type: "plan_response", approved, mode: "interactive", feedback: resume.comment };
    const request = resume.request && typeof resume.request === "object" && !Array.isArray(resume.request) ? resume.request as Record<string, unknown> : {};
    const path = typeof request.path === "string" ? resolve(request.path) : "";
    const insideAllowedRoot = Boolean(path) && this.allowedRoots.some((root) => isInside(root, path));
    return {
      type: "directory_response",
      granted: approved && insideAllowedRoot,
      path: approved && insideAllowedRoot ? path : "",
      writable: approved && insideAllowedRoot && request.writable === true
    };
  }
}

function runtimeRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  return record.runtime && typeof record.runtime === "object" && !Array.isArray(record.runtime)
    ? record.runtime as Record<string, unknown>
    : {};
}

function codexOptions(input: unknown) { return codexRuntimeOptionsSchema.parse(runtimeRecord(input)); }
function openWorkerOptions(input: unknown) { return openWorkerRuntimeOptionsSchema.parse(runtimeRecord(input)); }

export function buildRuntimePrompt(context: ExecutionContext, additionalInstructions = ""): string {
  const safeInput = redactSensitive(context.run.input);
  return [
    `Personal OS Run: ${context.run.id}`,
    `Mode: ${context.run.runMode}${context.run.rehearsalRootRunId ? ` (root ${context.run.rehearsalRootRunId})` : ""}`,
    `Project: ${context.project?.name ?? "Unassigned"}`,
    `Work: ${context.workSpec.title}`,
    `Instructions:\n${context.workSpec.instructions}`,
    context.workSpec.skill ? `Pinned Skill ${context.workSpec.skill.name}@${context.workSpec.skill.version} (${context.workSpec.skill.contentHash}):\n${context.workSpec.skill.content}` : "",
    `Input:\n${JSON.stringify(safeInput, null, 2)}`,
    "Safety rules:",
    "- Follow repository AGENTS.md files.",
    "- Work only inside the assigned workspace.",
    "- Do not pay, purchase, publish, contact people, deploy to production, delete user files, bypass protected interfaces, or fabricate evidence.",
    "- Stop and request explicit human approval or input when required.",
    "- Finish with the complete result and a concise verification summary.",
    context.run.runMode === "rehearsal" ? "- This is a rehearsal: exercise the real read-only workflow, save checkpoint evidence, include verification entries, and do not treat the result as production or publish it externally." : "",
    context.capability ? [
      "Personal OS MCP is available for governed progress, recoverable checkpoints, knowledge, artifacts, approvals and structured results.",
      "Call get_run_context first. Reused checkpoints in that context are completed work: verify their referenced output still exists, then do not repeat them.",
      "Call save_checkpoint when a meaningful step starts, completes or fails. Use a stable stepKey so a later retry can resume safely.",
      "Call append_run_event for milestones and submit_run_result before finishing.",
      "After submit_run_result succeeds, do not call more tools or change files; return the final summary immediately.",
      context.run.executorType === "openworker" ? `If a tool asks for capabilityToken, pass this value exactly and never print or save it: ${context.capability.token}` : "The MCP process already holds the capability; omit capabilityToken."
    ].join("\n") : "",
    additionalInstructions ? `Additional instructions:\n${redactFreeText(additionalInstructions)}` : ""
  ].filter(Boolean).join("\n\n");
}

export function buildResumePrompt(resume: NonNullable<ExecutionContext["resume"]>): string {
  if (resume.kind === "input") return `用户对上一个问题的回答：\n${redactFreeText(resume.answer)}\n\n请在同一会话中继续原任务。`;
  const decision = resume.decision === "approved" ? "已批准" : resume.decision === "expired" ? "已过期，按拒绝处理" : "已拒绝";
  return `上一个 ${resume.requestType} 请求${decision}。${resume.comment ? `\n备注：${redactFreeText(resume.comment)}` : ""}\n\n请在同一会话中继续原任务，并遵守该决定。`;
}

function codexItemEvent(item: ThreadItem) {
  if (item.type === "agent_message") return { eventType: "runtime.output", level: "info" as const, source: "codex", message: truncate(item.text), structuredData: null };
  if (item.type === "command_execution") return { eventType: "runtime.command", level: item.status === "failed" ? "warning" as const : "info" as const, source: "codex", message: `Codex 命令执行：${item.status}`, structuredData: { id: item.id, status: item.status, exitCode: item.exit_code ?? null } };
  if (item.type === "file_change") return { eventType: "runtime.file_change", level: item.status === "failed" ? "warning" as const : "info" as const, source: "codex", message: `Codex 文件变更：${item.status}`, structuredData: { changes: item.changes } };
  if (item.type === "mcp_tool_call") return {
    eventType: "runtime.mcp_tool_call",
    level: item.status === "failed" ? "warning" as const : "info" as const,
    source: "codex",
    message: `Personal OS MCP：${item.server}.${item.tool} ${item.status}`,
    structuredData: { id: item.id, server: item.server, tool: item.tool, status: item.status, error: item.error?.message ?? null }
  };
  if (item.type === "error") return { eventType: "runtime.warning", level: "warning" as const, source: "codex", message: truncate(item.message), structuredData: { fatal: false } };
  return { eventType: `runtime.${item.type}`, level: "info" as const, source: "codex", message: `Codex 事件：${item.type}`, structuredData: { id: item.id } };
}

function parseOpenWorkerEvent(raw: string): { type: string; data: unknown } {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("OPENWORKER_PROTOCOL_ERROR");
  const event = parsed as Record<string, unknown>;
  if (typeof event.type !== "string") throw new Error("OPENWORKER_PROTOCOL_ERROR");
  return { type: event.type, data: event.data ?? {} };
}

async function messageText(data: string | ArrayBuffer | Blob): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return await data.text();
}

function redactSensitive(value: unknown, ...exactSecrets: Array<string | undefined>): unknown {
  if (typeof value === "string") {
    let output = redactFreeText(value);
    for (const secret of exactSecrets) if (secret) output = output.replaceAll(secret, "[REDACTED]");
    return output;
  }
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, ...exactSecrets));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) =>
    /token|secret|password|authorization|api[_-]?key/i.test(key) && typeof item !== "number"
      ? [key, "[REDACTED]"]
      : [key, redactSensitive(item, ...exactSecrets)]
  ));
}

function redactFreeText(value: string): string {
  return value.replace(/((?:api[_ -]?key|token|secret|password|密码|密钥)\s*[:=：]\s*)([^\s,;，；]+)/giu, "$1[REDACTED]");
}

function assertLoopback(baseUrl: string): void {
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol) || !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("OPENWORKER_LOOPBACK_REQUIRED");
  }
}

function truncate(value: string, length = 20_000): string { return value.length > length ? `${value.slice(0, length)}…` : value; }
function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  return /token/i.test(message) ? "认证配置错误" : message;
}


function isInside(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !path.startsWith("/"));
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolvePromise();
    }, milliseconds);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
  });
}
