const baseUrl = (process.env.PERSONAL_OS_API_BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const skills = await get("/skills");
const projects = await get("/projects");
const skill = skills.find((item) => item.name === "personal-os-agent-run");
const project = projects.find((item) => item.repositoryPath?.endsWith("/personal-os"));
if (!skill || !project) throw new Error("Phase 9 smoke prerequisites are missing.");

const outcomes = [];
for (const runtime of ["codex", "openworker"]) {
  const token = `PHASE9_${runtime.toUpperCase()}_MCP_OK`;
  const spec = await post("/work-specs", {
    title: `Phase 9 ${runtime} MCP 正式验收`,
    instructions: [
      "This is a read-only production smoke test. Do not read or change files and do not use the network.",
      "Use the Personal OS MCP tools in this exact order:",
      "1. get_run_context",
      `2. append_run_event with eventType agent.phase9_smoke and message ${token}`,
      `3. submit_run_result with summary ${token}, data { runtime: "${runtime}", mcp: true }, and verification ["get_run_context succeeded", "append_run_event succeeded"]`,
      `Then reply exactly: ${token}`
    ].join("\n"),
    executorType: runtime,
    projectId: project.id,
    kind: "one_off",
    input: { runtime: runtime === "codex" ? { sandboxMode: "read-only", networkAccess: false, webSearch: false } : { agent: "cowork" } },
    timeoutSeconds: 180,
    maxAttempts: 1,
    lifecycleStatus: "active",
    skill
  });
  const queued = await post(`/work-specs/${spec.id}/runs`, { start: true, idempotencyKey: `phase9:${runtime}:${Date.now()}` });
  const run = await waitForTerminal(queued.id, 200_000);
  const events = await get(`/runs/${run.id}/events`);
  if (run.status !== "succeeded") throw new Error(`${runtime} smoke failed: ${run.errorCode ?? run.status}: ${run.errorMessage ?? JSON.stringify(run.result)}`);
  if (run.result?.runtimeSubmission?.summary !== token) throw new Error(`${runtime} did not submit the structured MCP result.`);
  if (!events.some((event) => event.eventType === "agent.phase9_smoke" && event.message === token)) throw new Error(`${runtime} did not append the MCP progress event.`);
  await post(`/runs/${run.id}/accept`, { comment: "Phase 9 real MCP smoke passed." });
  await post(`/work-specs/${spec.id}/retire`, {});
  outcomes.push({ runtime, runId: run.id, externalRunId: run.externalRunId, events: events.length, tokenUsage: run.usage ?? null });
}

console.log(JSON.stringify({ ok: true, outcomes }, null, 2));

async function waitForTerminal(id, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const run = await get(`/runs/${id}`);
    if (["succeeded", "partially_succeeded", "failed", "cancelled", "waiting_input", "waiting_approval"].includes(run.status)) return run;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }
  throw new Error(`Runtime smoke timed out: ${id}`);
}
async function get(path) {
  const response = await fetch(`${baseUrl}/api/v2${path}`, { signal: AbortSignal.timeout(10_000) });
  return await unwrap(response);
}
async function post(path, body) {
  const response = await fetch(`${baseUrl}/api/v2${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  return await unwrap(response);
}
async function unwrap(response) {
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(`${payload.error?.code ?? response.status}: ${payload.error?.message ?? "request failed"}`);
  return payload.data;
}
