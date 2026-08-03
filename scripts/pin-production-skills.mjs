const baseUrl = (process.env.PERSONAL_OS_API_BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const apply = process.argv.includes("--apply");
const mappings = [
  { title: /AI.*新闻.*新技术|AI.*晨报/i, skill: "prepare-ai-briefing" },
  { title: /赚钱机会|机会扫描|机会雷达/i, skill: "discover-china-opportunities" }
];

const [skills, specs, schedules] = await Promise.all([get("/skills"), get("/work-specs"), get("/schedules")]);
const actions = [];
for (const oldSpec of specs) {
  const mapping = mappings.find((entry) => entry.title.test(oldSpec.title));
  if (!mapping) continue;
  const skill = skills.find((entry) => entry.name === mapping.skill);
  if (!skill) throw new Error(`Skill not found: ${mapping.skill}`);
  const alreadyCanonical = oldSpec.skill?.contentHash === skill.contentHash && oldSpec.input?.phase9Skill?.contentHash === skill.contentHash;
  if (alreadyCanonical) continue;
  const bound = schedules.filter((entry) => entry.workSpecId === oldSpec.id && entry.enabled);
  if (bound.length === 0) continue;
  const canonicalInput = { runtime: { agent: "cowork" }, phase9Skill: { name: skill.name, version: skill.version, contentHash: skill.contentHash } };
  const existing = specs.find((entry) => entry.title === oldSpec.title && entry.skill?.contentHash === skill.contentHash && entry.input?.phase9Skill?.contentHash === skill.contentHash);
  actions.push({ oldSpecId: oldSpec.id, title: oldSpec.title, skill: `${skill.name}@${skill.version}`, schedules: bound.map((entry) => entry.id), existingSpecId: existing?.id ?? null });
  if (!apply) continue;
  const nextSpec = existing ?? await post("/work-specs", {
    projectId: oldSpec.projectId,
    kind: oldSpec.kind,
    title: oldSpec.title,
    instructions: oldSpec.instructions,
    executorType: oldSpec.executorType,
    input: canonicalInput,
    timeoutSeconds: oldSpec.timeoutSeconds,
    maxAttempts: oldSpec.maxAttempts,
    lifecycleStatus: oldSpec.lifecycleStatus,
    skill
  });
  for (const oldSchedule of bound) {
    const duplicate = schedules.find((entry) => entry.workSpecId === nextSpec.id && entry.name === oldSchedule.name && entry.cronExpression === oldSchedule.cronExpression && entry.timezone === oldSchedule.timezone);
    if (!duplicate) await post("/schedules", { workSpecId: nextSpec.id, name: oldSchedule.name, cronExpression: oldSchedule.cronExpression, timezone: oldSchedule.timezone, enabled: oldSchedule.enabled, catchUp: oldSchedule.catchUp });
    if (oldSchedule.enabled) await post(`/schedules/${oldSchedule.id}/pause`);
  }
}

if (apply) {
  for (const oldSpec of specs) {
    const mapping = mappings.find((entry) => entry.title.test(oldSpec.title));
    if (!mapping || oldSpec.lifecycleStatus === "retired") continue;
    const hasEnabledSchedule = schedules.some((entry) => entry.workSpecId === oldSpec.id && entry.enabled);
    const hasCanonicalReplacement = specs.some((entry) => entry.id !== oldSpec.id && entry.title === oldSpec.title && entry.skill?.name === mapping.skill && entry.input?.phase9Skill?.contentHash === entry.skill?.contentHash && schedules.some((schedule) => schedule.workSpecId === entry.id && schedule.enabled));
    if (!hasEnabledSchedule && hasCanonicalReplacement) await post(`/work-specs/${oldSpec.id}/retire`);
  }
}

console.log(JSON.stringify({ apply, actions }, null, 2));

async function get(path) {
  const response = await fetch(`${baseUrl}/api/v2${path}`, { signal: AbortSignal.timeout(10_000) });
  return await unwrap(response);
}
async function post(path, body) {
  const response = await fetch(`${baseUrl}/api/v2${path}`, { method: "POST", headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000) });
  return await unwrap(response);
}
async function unwrap(response) {
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(`${payload.error?.code ?? response.status}: ${payload.error?.message ?? "request failed"}`);
  return payload.data;
}
