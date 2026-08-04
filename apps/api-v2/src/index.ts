import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { serve } from "@hono/node-server";
import { FinanceService, KnowledgeService, PersonalOsService, RepositorySkillRegistry, RuntimeCapabilityAuthority, ScheduleService } from "@personal-os/vnext-application";
import { SqliteVNextStore } from "@personal-os/vnext-infrastructure";
import { CodexExecutor, CommandManagedResourceController, InternalExecutor, OpenWorkerExecutor, ProcessExecutor, type ManagedResourceController } from "@personal-os/vnext-runtime";
import { createVNextApp } from "./app.js";

const port = Number(process.env.PORT ?? 8887);
const databasePath = resolve(process.env.PERSONAL_OS_V2_DATABASE_PATH ?? join(homedir(), ".local", "share", "personal-os-v2", "data", "personal-os-v2.db"));
const allowedRoots = (process.env.PERSONAL_OS_ALLOWED_ROOTS ?? process.cwd()).split(delimiter).filter(Boolean).map((value) => resolve(value));
const allowedExecutables = (process.env.PERSONAL_OS_ALLOWED_EXECUTABLES ?? "python3,node").split(",").map((value) => value.trim()).filter(Boolean);
const openWorkerRoot = resolve(process.env.PERSONAL_OS_V2_OPENWORKER_ROOT ?? join(homedir(), ".local", "share", "personal-os-v2", "openworker-workspaces"));
const schedulerEnabled = process.env.PERSONAL_OS_V2_SCHEDULER_ENABLED === "true";
const skillsRoot = resolve(process.env.PERSONAL_OS_SKILLS_ROOT ?? join(process.cwd(), ".agents", "skills"));
const mcpServerPath = resolve(process.env.PERSONAL_OS_MCP_SERVER_PATH ?? join(process.cwd(), "personal-os-mcp.mjs"));
const apiBaseUrl = (process.env.PERSONAL_OS_API_BASE_URL ?? `http://127.0.0.1:${port}`).replace(/\/$/, "");
const managedResources: Record<string, ManagedResourceController> = {};
const qishuiEmulatorScript = process.env.PERSONAL_OS_QISHUI_EMULATOR_SCRIPT;
if (qishuiEmulatorScript) {
  const script = resolve(qishuiEmulatorScript);
  if (!allowedRoots.some((root) => isInside(root, script))) throw new Error(`MANAGED_RESOURCE_SCRIPT_NOT_ALLOWED:${script}`);
  if (!existsSync(script) || !statSync(script).isFile()) throw new Error(`MANAGED_RESOURCE_SCRIPT_NOT_FOUND:${script}`);
  const python = resolve(process.env.PERSONAL_OS_PYTHON_PATH ?? "/usr/bin/python3");
  managedResources["qishui-emulator"] = new CommandManagedResourceController({
    command: python,
    startArgs: [script, "start", "--timeout", "180"],
    stopArgs: [script, "stop", "--timeout", "60"],
    cwd: resolve(dirname(script), ".."),
    timeoutMs: 240_000
  });
}

const store = new SqliteVNextStore(databasePath);
const skills = new RepositorySkillRegistry(skillsRoot);
const capabilities = new RuntimeCapabilityAuthority();
const execution = new PersonalOsService(store, [
  new InternalExecutor(),
  new ProcessExecutor({ allowedRoots, allowedExecutables }),
  new CodexExecutor({ allowedRoots, mcpServerPath, apiBaseUrl, managedResources }),
  new OpenWorkerExecutor({
    allowedRoots,
    managedRoot: openWorkerRoot,
    baseUrl: process.env.OPENWORKER_BASE_URL,
    tokenFile: process.env.OPENWORKER_TOKEN_FILE
  })
], undefined, capabilities, skills);
const schedules = new ScheduleService(store, execution);
const knowledge = new KnowledgeService(store);
const finance = new FinanceService(store);
const app = createVNextApp({ store, execution, schedules, knowledge, finance, skills, schedulerEnabled });
execution.recoverInterruptedRuns();
knowledge.startWatchingAll();

const schedulerTimer = schedulerEnabled ? setInterval(() => {
  execution.expireApprovals();
  void schedules.tick().catch((error: unknown) => console.error("Personal OS scheduler tick failed", error));
}, 15_000) : null;
schedulerTimer?.unref();

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`Personal OS API listening on http://127.0.0.1:${info.port}`);
  console.log(`Database: ${databasePath}`);
  console.log(`Scheduler: ${schedulerEnabled ? "enabled" : "disabled"}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { if (schedulerTimer) clearInterval(schedulerTimer); knowledge.stopWatching(); store.close(); process.exit(0); });
}

function isInside(root: string, candidate: string): boolean {
  const value = relative(root, candidate);
  return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}
