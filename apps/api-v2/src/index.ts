import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { FinanceService, KnowledgeService, PersonalOsService, RepositorySkillRegistry, RuntimeCapabilityAuthority, ScheduleService } from "@personal-os/vnext-application";
import { SqliteVNextStore } from "@personal-os/vnext-infrastructure";
import { CodexExecutor, InternalExecutor, OpenWorkerExecutor, ProcessExecutor } from "@personal-os/vnext-runtime";
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

const store = new SqliteVNextStore(databasePath);
const skills = new RepositorySkillRegistry(skillsRoot);
const capabilities = new RuntimeCapabilityAuthority();
const execution = new PersonalOsService(store, [
  new InternalExecutor(),
  new ProcessExecutor({ allowedRoots, allowedExecutables }),
  new CodexExecutor({ allowedRoots, mcpServerPath, apiBaseUrl }),
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
