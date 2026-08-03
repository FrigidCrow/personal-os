import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { resolve } from "node:path";

const serverPath = resolve(process.env.PERSONAL_OS_MCP_SERVER_PATH ?? "apps/mcp-v2/dist/index.js");
const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath], env: { PERSONAL_OS_API_URL: "http://127.0.0.1:8787" }, stderr: "pipe" });
const client = new Client({ name: "personal-os-phase9-smoke", version: "0.1.0" });

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  const expected = ["append_run_event", "get_approval_status", "get_run_context", "request_approval", "save_artifact", "search_knowledge", "submit_run_result"].sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`Unexpected MCP tools: ${names.join(", ")}`);
  console.log(JSON.stringify({ ok: true, protocol: "stdio", tools: names }, null, 2));
} finally {
  await client.close();
}
