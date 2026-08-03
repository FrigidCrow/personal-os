import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const configPath = resolve(process.env.OPENWORKER_MCP_CONFIG ?? join(homedir(), ".config", "coworker", "mcp.json"));
const runtimeRoot = resolve(process.env.PERSONAL_OS_RUNTIME_ROOT ?? join(homedir(), ".local", "share", "personal-os-v2", "runtime", "current"));
const mcpServerPath = join(runtimeRoot, "personal-os-mcp.mjs");
const apiBaseUrl = (process.env.PERSONAL_OS_API_BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const apply = process.argv.includes("--apply");
const tools = ["get_run_context", "append_run_event", "search_knowledge", "save_artifact", "request_approval", "get_approval_status", "submit_run_result"];

if (!existsSync(mcpServerPath)) throw new Error(`Personal OS MCP build is missing: ${mcpServerPath}`);
const current = readJson(configPath);
const next = {
  ...current,
  mcpServers: {
    ...(current.mcpServers ?? {}),
    personal_os: {
      command: process.execPath,
      args: [mcpServerPath],
      cwd: runtimeRoot,
      env: { PERSONAL_OS_API_URL: apiBaseUrl },
      enabled: true,
      include_tools: tools,
      requires_approval: false
    }
  }
};

if (!apply) {
  console.log(JSON.stringify({ apply: false, configPath, server: next.mcpServers.personal_os }, null, 2));
  process.exit(0);
}

mkdirSync(dirname(configPath), { recursive: true });
const temporary = `${configPath}.tmp-${process.pid}`;
writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
renameSync(temporary, configPath);
await reloadOpenWorker();
console.log(JSON.stringify({ ok: true, configPath, server: "personal_os", tools: tools.length }));

function readJson(path) {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { throw new Error(`OpenWorker MCP config is invalid JSON: ${path}`); }
}

async function reloadOpenWorker() {
  const tokenPath = resolve(process.env.OPENWORKER_TOKEN_FILE ?? join(homedir(), ".config", "coworker", "personal-os-8765.token"));
  if (!existsSync(tokenPath)) return;
  const token = readFileSync(tokenPath, "utf8").trim();
  if (!token) return;
  try {
    const response = await fetch(`${process.env.OPENWORKER_BASE_URL ?? "http://127.0.0.1:8765"}/v1/mcp/reload`, { method: "POST", headers: { "X-OpenWorker-Token": token }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`OpenWorker MCP config was saved but reload failed: ${error instanceof Error ? error.message : "unknown"}`, { cause: error });
  }
}
