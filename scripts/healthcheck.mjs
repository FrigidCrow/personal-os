const target = process.env.PERSONAL_OS_HEALTH_URL ?? "http://127.0.0.1:8787/api/v2/health";
const response = await fetch(target, { signal: AbortSignal.timeout(5_000) });
if (!response.ok) throw new Error(`Personal OS health check failed: ${response.status}`);
const payload = await response.json();
if (!payload?.success || payload.data?.status !== "healthy") throw new Error("Personal OS health payload is invalid");
console.log(JSON.stringify({ ok: true, url: target, ...payload.data }));
