import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { buildPersonalOsServices, renderLaunchAgentPlist } from "./launch-agent-config.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const launchAgentsDirectory = join(homedir(), "Library", "LaunchAgents");
const runtimeRoot = resolve(process.env.PERSONAL_OS_RUNTIME_ROOT ?? join(homedir(), ".local", "share", "personal-os-v2", "runtime", "current"));
const logsDirectory = resolve(process.env.PERSONAL_OS_LOGS_DIR ?? join(homedir(), ".local", "share", "personal-os-v2", "logs"));
const v2DataDirectory = resolve(process.env.PERSONAL_OS_V2_DATA_DIR ?? join(homedir(), ".local", "share", "personal-os-v2", "data"));
const v2DatabasePath = resolve(process.env.PERSONAL_OS_V2_DATABASE_PATH ?? join(v2DataDirectory, "personal-os-v2.db"));
const obsidianVaultPath = resolve(process.env.OBSIDIAN_VAULT_PATH ?? join(homedir(), "Documents", "Obsidian Vault"));
const apply = process.argv.includes("--apply");
const uid = process.getuid?.() ?? 0;
const openWorkerRoot = resolve(process.env.OPENWORKER_ROOT ?? "/Users/frigidcrow/Documents/Codex/dev/openworker");
const openWorkerGuiRoot = join(openWorkerRoot, "surfaces", "gui");
const openWorkerRuntime = resolve(process.env.OPENWORKER_RUNTIME ?? join(homedir(), ".local", "share", "personal-os-v2", "openworker-runtime"));
const openWorkerWorkspace = resolve(process.env.OPENWORKER_WORKSPACE ?? join(homedir(), ".local", "share", "personal-os-v2", "openworker-workspace"));
const includeOpenWorker = process.env.INCLUDE_OPENWORKER === "true";
const includeOpenWorkerServer = includeOpenWorker && process.env.INCLUDE_OPENWORKER_SERVER === "true";
const openWorkerApiToken = process.env.OPENWORKER_API_TOKEN ?? "";
if (process.argv.some((argument) => argument.startsWith("--generation=")) || process.env.PERSONAL_OS_GENERATION) {
  throw new Error("Generation switching has been removed; Personal OS now has one current runtime.");
}
const defaultQishuiRepository = join(homedir(), "Dev", "qishui-music");
const defaultQishuiEmulatorScript = join(defaultQishuiRepository, "scripts", "qishui_emulator.py");
const defaultQishuiObsidianPath = join(obsidianVaultPath, "Projects", "Qishui Music");
const defaultPythonPath = join(homedir(), ".pyenv", "versions", "3.12.9", "bin", "python3");
const defaultAllowedRoots = [projectRoot, ...(existsSync(defaultQishuiRepository) ? [defaultQishuiRepository] : []), ...(existsSync(defaultQishuiObsidianPath) ? [defaultQishuiObsidianPath] : [])];
const allowedRoots = (process.env.PERSONAL_OS_ALLOWED_ROOTS ? process.env.PERSONAL_OS_ALLOWED_ROOTS.split(delimiter) : defaultAllowedRoots).filter(Boolean).map((value) => resolve(value));
const qishuiEmulatorScript = process.env.PERSONAL_OS_QISHUI_EMULATOR_SCRIPT
  ? resolve(process.env.PERSONAL_OS_QISHUI_EMULATOR_SCRIPT)
  : existsSync(defaultQishuiEmulatorScript) ? defaultQishuiEmulatorScript : undefined;
const pythonPath = process.env.PERSONAL_OS_PYTHON_PATH
  ? resolve(process.env.PERSONAL_OS_PYTHON_PATH)
  : qishuiEmulatorScript && existsSync(defaultPythonPath) ? defaultPythonPath : undefined;
const controlDirectory = join(homedir(), ".local", "share", "personal-os-v2", "control");

const services = buildPersonalOsServices({
  nodePath: process.execPath,
  projectRoot,
  runtimeRoot,
  v2DatabasePath,
  obsidianVaultPath,
  allowedRoots,
  qishuiEmulatorScript,
  pythonPath,
  timezone: process.env.PERSONAL_OS_TIMEZONE ?? "Asia/Tokyo"
});

if (includeOpenWorker) {
  if (!openWorkerApiToken) throw new Error("OPENWORKER_API_TOKEN is required when INCLUDE_OPENWORKER=true.");
  if (includeOpenWorkerServer) {
    services.push({
      label: "com.frigidcrow.personal-os.openworker-server",
      args: [join(openWorkerRuntime, "bin", "openworker-server"), "--cwd", openWorkerWorkspace, "--host", "127.0.0.1", "--port", "8765"],
      workingDirectory: openWorkerRoot,
      environment: {
        COWORKER_API_TOKEN: openWorkerApiToken,
        PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
      }
    });
  }
  services.push({
    label: "com.frigidcrow.personal-os.openworker-web",
    args: [process.execPath, join(openWorkerGuiRoot, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", "5274", "--strictPort"],
    workingDirectory: openWorkerGuiRoot,
    environment: {
      NODE_OPTIONS: "--no-experimental-webstorage",
      VITE_COWORKER_API_TOKEN: openWorkerApiToken
    }
  });
}

for (const service of services) {
  const target = join(launchAgentsDirectory, `${service.label}.plist`);
  if (!apply) {
    console.log(JSON.stringify({ apply: false, label: service.label, target, args: service.args, workingDirectory: service.workingDirectory }));
    continue;
  }
}

if (apply) {
  const requiredRuntimePaths = [join(runtimeRoot, "api-v2", "index.js"), join(runtimeRoot, "web-v2", "index.html"), join(runtimeRoot, "personal-os-static-server.mjs")];
  if (includeOpenWorkerServer) requiredRuntimePaths.push(join(openWorkerRuntime, "bin", "openworker-server"));
  const missingRuntimePaths = requiredRuntimePaths.filter((path) => !existsSync(path));
  if (missingRuntimePaths.length > 0) throw new Error(`Production runtime is incomplete. Run npm run deploy:runtime first. Missing: ${missingRuntimePaths.join(", ")}`);
  mkdirSync(launchAgentsDirectory, { recursive: true });
  mkdirSync(logsDirectory, { recursive: true });
  mkdirSync(v2DataDirectory, { recursive: true });
  if (includeOpenWorkerServer) mkdirSync(openWorkerWorkspace, { recursive: true });
  mkdirSync(controlDirectory, { recursive: true });
  const previous = services.map((service) => {
    const target = join(launchAgentsDirectory, `${service.label}.plist`);
    return { service, target, content: existsSync(target) ? readFileSync(target, "utf8") : null };
  });
  try {
    for (const entry of previous) {
      const content = renderLaunchAgentPlist(entry.service, logsDirectory);
      spawnSync("launchctl", ["bootout", `gui/${uid}`, entry.target], { stdio: "ignore" });
      writeFileSync(entry.target, content, { mode: 0o600 });
      const result = spawnSync("launchctl", ["bootstrap", `gui/${uid}`, entry.target], { encoding: "utf8" });
      if (result.status !== 0) throw new Error(`launchctl bootstrap failed for ${entry.service.label}: ${result.stderr}`);
      console.log(JSON.stringify({ apply: true, system: "current", label: entry.service.label, target: entry.target }));
    }
    writeFileSync(join(controlDirectory, "active-runtime.json"), `${JSON.stringify({ system: "current", installedAt: new Date().toISOString(), labels: services.map((service) => service.label) }, null, 2)}\n`, { mode: 0o600 });
  } catch (error) {
    for (const entry of previous) {
      spawnSync("launchctl", ["bootout", `gui/${uid}`, entry.target], { stdio: "ignore" });
      if (entry.content !== null) {
        writeFileSync(entry.target, entry.content, { mode: 0o600 });
        spawnSync("launchctl", ["bootstrap", `gui/${uid}`, entry.target], { stdio: "ignore" });
      } else if (existsSync(entry.target)) rmSync(entry.target);
    }
    throw error;
  }
}
