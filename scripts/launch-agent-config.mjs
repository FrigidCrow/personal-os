import { delimiter } from "node:path";
import { join } from "node:path";

export function buildPersonalOsServices({
  nodePath,
  projectRoot,
  runtimeRoot,
  v2DatabasePath,
  obsidianVaultPath,
  allowedRoots = [projectRoot],
  qishuiEmulatorScript,
  pythonPath,
  timezone = "Asia/Tokyo"
}) {
  return [
    {
      label: "com.frigidcrow.personal-os.api",
      args: [nodePath, join(runtimeRoot, "api-v2", "index.js")],
      workingDirectory: runtimeRoot,
      environment: {
        HOST: "127.0.0.1",
        PORT: "8787",
        PERSONAL_OS_V2_DATABASE_PATH: v2DatabasePath,
        PERSONAL_OS_V2_SCHEDULER_ENABLED: "true",
        PERSONAL_OS_SKILLS_ROOT: join(projectRoot, ".agents", "skills"),
        PERSONAL_OS_ALLOWED_ROOTS: allowedRoots.join(delimiter),
        ...(qishuiEmulatorScript ? { PERSONAL_OS_QISHUI_EMULATOR_SCRIPT: qishuiEmulatorScript } : {}),
        ...(pythonPath ? { PERSONAL_OS_PYTHON_PATH: pythonPath } : {}),
        PERSONAL_OS_TIMEZONE: timezone,
        OBSIDIAN_VAULT_PATH: obsidianVaultPath
      }
    },
    {
      label: "com.frigidcrow.personal-os.web",
      args: [nodePath, join(runtimeRoot, "personal-os-static-server.mjs")],
      workingDirectory: runtimeRoot,
      environment: { NODE_ENV: "production", STATIC_ROOT: join(runtimeRoot, "web-v2"), PORT: "5273", API_TARGET: "http://127.0.0.1:8787" }
    }
  ];
}

export function renderLaunchAgentPlist(service, logsDirectory) {
  const argumentsXml = service.args.map((argument) => `    <string>${xml(String(argument))}</string>`).join("\n");
  const environmentXml = Object.entries(service.environment).map(([key, value]) => `      <key>${xml(key)}</key><string>${xml(String(value))}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${xml(service.label)}</string>
  <key>ProgramArguments</key><array>
${argumentsXml}
  </array>
  <key>WorkingDirectory</key><string>${xml(service.workingDirectory)}</string>
  <key>EnvironmentVariables</key><dict>
${environmentXml}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${xml(join(logsDirectory, `${service.label}.log`))}</string>
  <key>StandardErrorPath</key><string>${xml(join(logsDirectory, `${service.label}.error.log`))}</string>
</dict></plist>\n`;
}

function xml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
