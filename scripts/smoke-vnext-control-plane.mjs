import { execFileSync } from "node:child_process";

const baseUrl = process.env.PERSONAL_OS_V2_API_URL ?? "http://127.0.0.1:8787/api/v2";
const repositoryPath = process.env.PERSONAL_OS_SMOKE_REPOSITORY ?? "/Users/frigidcrow/Dev/qishui-music";
const projects = await api("GET", "/projects");
const project = projects.data.find((item) => item.repositoryPath === repositoryPath);
if (!project) throw new Error(`No vNext project is bound to ${repositoryPath}.`);
const gitBefore = gitSnapshot(repositoryPath);

const codex = await executeRuntime({
  token: "PERSONAL_OS_PHASE7_CODEX_OK",
  workSpec: {
    projectId: project.id,
    kind: "one_off",
    title: "Phase 7 Codex 正式控制面验收",
    instructions: "Read README.md only. Confirm its first heading is 汽水音乐实验室. Do not modify files, run commands, or use the network. Then reply exactly: PERSONAL_OS_PHASE7_CODEX_OK",
    executorType: "codex",
    input: { additionalInstructions: "Return only the exact acceptance token.", sandboxMode: "read-only", networkAccess: false, webSearch: false },
    timeoutSeconds: 180,
    maxAttempts: 1,
    lifecycleStatus: "active"
  }
});

const openworker = await executeRuntime({
  token: "PERSONAL_OS_PHASE7_OPENWORKER_OK",
  workSpec: {
    projectId: null,
    kind: "one_off",
    title: "Phase 7 OpenWorker 正式控制面验收",
    instructions: "Do not call tools, read files, or modify anything. Reply exactly: PERSONAL_OS_PHASE7_OPENWORKER_OK",
    executorType: "openworker",
    input: { additionalInstructions: "Return only the exact acceptance token.", agent: "cowork" },
    timeoutSeconds: 180,
    maxAttempts: 1,
    lifecycleStatus: "active"
  }
});

const gitAfter = gitSnapshot(repositoryPath);
if (gitBefore !== gitAfter) throw new Error("Read-only Codex smoke changed the repository working tree.");
console.log(JSON.stringify({ ok: true, baseUrl, project: { id: project.id, repositoryPath }, gitUnchanged: true, codex, openworker, verifiedAt: new Date().toISOString() }, null, 2));

async function executeRuntime({ token, workSpec }) {
  const createdSpec = await api("POST", "/work-specs", workSpec);
  const createdRun = await api("POST", `/work-specs/${createdSpec.data.id}/runs`, { start: true, idempotencyKey: `phase7:${workSpec.executorType}:${Date.now()}` });
  const run = await waitForTerminalRun(createdRun.data.id, 190_000);
  const finalResponse = run.result && typeof run.result === "object" && typeof run.result.finalResponse === "string" ? run.result.finalResponse.trim() : "";
  if (run.status !== "succeeded" || finalResponse !== token || !run.externalRunId) {
    throw new Error(`${workSpec.executorType} control-plane smoke failed: ${JSON.stringify({ status: run.status, finalResponse, externalRunId: run.externalRunId, errorCode: run.errorCode, errorMessage: run.errorMessage })}`);
  }
  const accepted = await api("POST", `/runs/${run.id}/accept`, { comment: "Phase 7 正式主权切换验收通过。" });
  const events = await api("GET", `/runs/${run.id}/events`);
  const audit = await api("GET", "/audit?limit=500");
  const runAudit = audit.data.filter((item) => item.runId === run.id);
  if (accepted.data.reviewStatus !== "accepted" || !events.data.some((event) => event.eventType === "runtime.session") || !events.data.some((event) => event.eventType === "run.succeeded") || runAudit.length < 3) {
    throw new Error(`${workSpec.executorType} control-plane evidence is incomplete.`);
  }
  return {
    workSpecId: createdSpec.data.id,
    runId: run.id,
    status: run.status,
    externalRunId: run.externalRunId,
    finalResponse,
    reviewStatus: accepted.data.reviewStatus,
    eventCount: events.data.length,
    eventTypes: [...new Set(events.data.map((event) => event.eventType))],
    auditCount: runAudit.length,
    usage: run.usage ?? null
  };
}

async function waitForTerminalRun(runId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await api("GET", `/runs/${runId}`);
    if (["succeeded", "partially_succeeded", "failed", "cancelled", "waiting_input", "waiting_approval"].includes(response.data.status)) return response.data;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
  }
  throw new Error(`Timed out waiting for vNext run ${runId}.`);
}

async function api(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(`${method} ${path} failed: ${JSON.stringify(payload.error ?? payload)}`);
  return payload;
}

function gitSnapshot(cwd) {
  return execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd, encoding: "utf8" });
}
