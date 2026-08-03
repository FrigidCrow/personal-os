import { describe, expect, it } from "vitest";
import { buildPersonalOsServices, renderLaunchAgentPlist } from "./launch-agent-config.mjs";

const base = {
  nodePath: "/node",
  projectRoot: "/repo",
  runtimeRoot: "/runtime",
  v2DatabasePath: "/data/personal-os-v2.db",
  obsidianVaultPath: "/vault",
  allowedRoots: ["/repo", "/projects/qishui"],
  timezone: "Asia/Tokyo"
};

describe("current Personal OS LaunchAgents", () => {
  it("renders only the current API, web and scheduler configuration", () => {
    const services = buildPersonalOsServices(base);
    expect(services).toMatchObject([
      { label: "com.frigidcrow.personal-os.api", args: ["/node", "/runtime/api-v2/index.js"], workingDirectory: "/runtime", environment: { PORT: "8787", PERSONAL_OS_V2_DATABASE_PATH: "/data/personal-os-v2.db", PERSONAL_OS_V2_SCHEDULER_ENABLED: "true" } },
      { label: "com.frigidcrow.personal-os.web", args: ["/node", "/runtime/personal-os-static-server.mjs"], workingDirectory: "/runtime", environment: { STATIC_ROOT: "/runtime/web-v2", API_TARGET: "http://127.0.0.1:8787" } }
    ]);
    const serialized = JSON.stringify(services);
    expect(serialized).not.toContain("api-v1");
    expect(serialized).not.toContain("web-v1");
    expect(services[0]!.environment).not.toHaveProperty("DATABASE_PATH");
    const plist = renderLaunchAgentPlist(services[0]!, "/logs");
    expect(plist).toContain("PERSONAL_OS_V2_SCHEDULER_ENABLED");
    expect(plist).not.toMatch(/TOKEN|API_KEY|SECRET/);
  });
});
