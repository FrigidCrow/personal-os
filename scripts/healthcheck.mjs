const target = process.env.PERSONAL_OS_HEALTH_URL ?? "http://127.0.0.1:8787/api/v2/health";
const maxAttempts = Number.parseInt(process.env.PERSONAL_OS_HEALTH_ATTEMPTS ?? "20", 10);
const retryDelayMs = Number.parseInt(process.env.PERSONAL_OS_HEALTH_RETRY_MS ?? "250", 10);

let lastError;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`Personal OS health check failed: ${response.status}`);
    const payload = await response.json();
    if (!payload?.success || payload.data?.status !== "healthy") {
      throw new Error("Personal OS health payload is invalid");
    }
    console.log(JSON.stringify({ ok: true, url: target, attempts: attempt, ...payload.data }));
    lastError = undefined;
    break;
  } catch (error) {
    lastError = error;
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

if (lastError) throw lastError;
