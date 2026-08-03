import { describe, expect, it, vi } from "vitest";
import { PERSONAL_OS_MCP_TOOLS, createPersonalOsMcpServer } from "./index.js";

describe("Personal OS MCP server", () => {
  it("registers exactly the seven pilot tools with JSON schemas", () => {
    const server = createPersonalOsMcpServer({ apiBaseUrl: "http://127.0.0.1:8787", environmentCapability: "x".repeat(40), fetcher: vi.fn() as unknown as typeof fetch });
    expect(PERSONAL_OS_MCP_TOOLS).toHaveLength(7);
    for (const name of PERSONAL_OS_MCP_TOOLS) expect(server.toolInputSchemaJson(name)).toBeDefined();
    expect(PERSONAL_OS_MCP_TOOLS).not.toContain("send_email");
    expect(PERSONAL_OS_MCP_TOOLS).not.toContain("payment");
    expect(PERSONAL_OS_MCP_TOOLS).not.toContain("deploy");
  });

  it("refuses non-loopback Core API endpoints", () => {
    expect(() => createPersonalOsMcpServer({ apiBaseUrl: "https://example.com" })).toThrow("PERSONAL_OS_MCP_LOOPBACK_REQUIRED");
  });
});
