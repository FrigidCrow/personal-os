import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const launchAgentsDirectory = join(homedir(), "Library", "LaunchAgents");
const logsDirectory = join(projectRoot, "logs");
const apply = process.argv.includes("--apply");
const uid = process.getuid?.() ?? 0;
const openWorkerRoot = resolve(process.env.OPENWORKER_ROOT ?? "/Users/frigidcrow/Documents/Codex/dev/openworker");
const openWorkerGuiRoot = join(openWorkerRoot, "surfaces", "gui");
const includeOpenWorker = process.env.INCLUDE_OPENWORKER === "true";
const includeOpenWorkerServer = includeOpenWorker && process.env.INCLUDE_OPENWORKER_SERVER === "true";
const openWorkerApiToken = process.env.OPENWORKER_API_TOKEN ?? "";

function xml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function plist({ label, args, workingDirectory, environment }) {
  const argumentsXml = args.map((argument) => `    <string>${xml(argument)}</string>`).join("\n");
  const environmentXml = Object.entries(environment).map(([key, value]) => `      <key>${xml(key)}</key><string>${xml(value)}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array>
${argumentsXml}
  </array>
  <key>WorkingDirectory</key><string>${xml(workingDirectory)}</string>
  <key>EnvironmentVariables</key><dict>
${environmentXml}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${xml(join(logsDirectory, `${label}.log`))}</string>
  <key>StandardErrorPath</key><string>${xml(join(logsDirectory, `${label}.error.log`))}</string>
</dict></plist>\n`;
}

const services = [
  {
    label: "com.frigidcrow.personal-os.api",
    args: [process.execPath, join(projectRoot, "apps", "server", "dist", "index.js")],
    workingDirectory: projectRoot,
    environment: {
      HOST: "127.0.0.1",
      PORT: "8787",
      DATABASE_PATH: join(projectRoot, "data", "personal-os.db"),
      CODEX_MODE: process.env.CODEX_MODE === "live" ? "live" : "demo",
      PERSONAL_OS_TIMEZONE: process.env.PERSONAL_OS_TIMEZONE ?? "Asia/Tokyo"
    }
  },
  {
    label: "com.frigidcrow.personal-os.web",
    args: [process.execPath, join(projectRoot, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", "127.0.0.1", "--port", "5273", "--strictPort"],
    workingDirectory: join(projectRoot, "apps", "web"),
    environment: { NODE_ENV: "production" }
  }
];

if (includeOpenWorker) {
  if (!openWorkerApiToken) throw new Error("OPENWORKER_API_TOKEN is required when INCLUDE_OPENWORKER=true.");
  if (includeOpenWorkerServer) {
    services.push({
      label: "com.frigidcrow.personal-os.openworker-server",
      args: [join(openWorkerRoot, ".venv", "bin", "openworker-server"), "--cwd", projectRoot, "--host", "127.0.0.1", "--port", "8765"],
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
  const content = plist(service);
  if (!apply) {
    console.log(JSON.stringify({ apply: false, label: service.label, target, args: service.args, workingDirectory: service.workingDirectory }));
    continue;
  }
  mkdirSync(launchAgentsDirectory, { recursive: true });
  mkdirSync(logsDirectory, { recursive: true });
  writeFileSync(target, content, { mode: 0o600 });
  spawnSync("launchctl", ["bootout", `gui/${uid}`, target], { stdio: "ignore" });
  const result = spawnSync("launchctl", ["bootstrap", `gui/${uid}`, target], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`launchctl bootstrap failed for ${service.label}: ${result.stderr}`);
  console.log(JSON.stringify({ apply: true, label: service.label, target }));
}
