const target = process.env.PERSONAL_OS_HEALTH_URL ?? "http://127.0.0.1:8787/api/health";
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 4_000);

try {
  const response = await fetch(target, { signal: controller.signal });
  const body = await response.json();
  if (!response.ok || body.ok !== true || body.operational?.database !== "ok") {
    throw new Error(`Unhealthy response (${response.status}): ${JSON.stringify(body)}`);
  }
  console.log(JSON.stringify({
    ok: true,
    url: target,
    database: body.operational.database,
    activeRuns: body.operational.activeRuns,
    staleRuns: body.operational.staleRuns,
    pendingApprovals: body.operational.pendingApprovals,
    checkedAt: body.operational.checkedAt
  }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, url: target, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
}
