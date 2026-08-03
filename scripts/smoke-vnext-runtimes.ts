import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ExecutionContext } from "@personal-os/vnext-application";
import type { Project, Run, WorkSpec } from "@personal-os/vnext-contracts";
import { CodexExecutor, OpenWorkerExecutor } from "@personal-os/vnext-runtime";

const root = resolve(process.cwd());
const requested = new Set(process.argv.slice(2));
const executeCodex = requested.has("--codex");
const executeOpenWorker = requested.has("--openworker");
const results: Record<string, unknown> = {};

const codex = new CodexExecutor({ allowedRoots: [root] });
const openworker = new OpenWorkerExecutor({
  allowedRoots: [root],
  managedRoot: join(homedir(), ".local", "share", "personal-os-v2", "smoke-workspaces"),
  baseUrl: process.env.OPENWORKER_BASE_URL,
  tokenFile: process.env.OPENWORKER_TOKEN_FILE
});

results.health = {
  codex: await codex.health(),
  openworker: await openworker.health()
};

if (executeCodex) {
  results.codex = await attempt(() => runWithTimeout(codex, runtimeContext(
    "codex",
    "Read-only Codex smoke",
    "Read package.json only. If its name is personal-os, reply exactly: PERSONAL_OS_CODEX_SMOKE_OK. Do not modify files or use the network.",
    { runtime: { sandboxMode: "read-only", networkAccess: false, webSearch: false } },
    project(root)
  )));
}

if (executeOpenWorker) {
  results.openworker = await attempt(() => runWithTimeout(openworker, runtimeContext(
    "openworker",
    "Read-only OpenWorker smoke",
    "Do not call tools and do not modify files. Reply exactly: PERSONAL_OS_OPENWORKER_SMOKE_OK.",
    { runtime: { agent: "cowork" } },
    null
  )));
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
if (Object.values(results).some((value) => value && typeof value === "object" && "ok" in value && value.ok === false)) process.exitCode = 1;

function project(repositoryPath: string): Project {
  return { id: "smoke-project", name: "Personal OS", description: "", repositoryPath, obsidianPath: null, status: "active", createdAt: "", updatedAt: "" };
}

function runtimeContext(executorType: "codex" | "openworker", title: string, instructions: string, input: unknown, linkedProject: Project | null): ExecutionContext {
  const run: Run = {
    id: `smoke-${executorType}-${Date.now()}`,
    workSpecId: `smoke-${executorType}`,
    projectId: linkedProject?.id ?? null,
    executorType,
    status: "running",
    input,
    attempt: 1,
    idempotencyKey: null,
    retryOfRunId: null,
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
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
  const workSpec: WorkSpec = {
    id: run.workSpecId,
    projectId: run.projectId,
    kind: "one_off",
    title,
    instructions,
    executorType,
    input,
    timeoutSeconds: 120,
    maxAttempts: 1,
    lifecycleStatus: "active",
    skill: null,
    createdAt: run.createdAt,
    updatedAt: run.createdAt
  };
  return { run, workSpec, project: linkedProject, resume: null, signal: new AbortController().signal, emit: () => undefined };
}

async function runWithTimeout(adapter: CodexExecutor | OpenWorkerExecutor, context: ExecutionContext): Promise<unknown> {
  const controller = new AbortController();
  context.signal = controller.signal;
  const timer = setTimeout(() => controller.abort(new Error("SMOKE_TIMEOUT")), 120_000);
  timer.unref();
  try {
    return await adapter.execute(context);
  } finally {
    clearTimeout(timer);
  }
}

async function attempt(operation: () => Promise<unknown>): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  try {
    return { ok: true, result: await operation() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown smoke error" };
  }
}
