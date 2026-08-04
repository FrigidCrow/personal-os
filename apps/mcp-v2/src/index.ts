import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";

export const PERSONAL_OS_MCP_TOOLS = [
  "get_run_context",
  "append_run_event",
  "save_checkpoint",
  "search_knowledge",
  "save_artifact",
  "request_approval",
  "get_approval_status",
  "submit_run_result"
] as const;

const capability = z.string().trim().min(20).max(200).optional().describe("Short-lived capability from the Personal OS run prompt. Omit when the MCP process already has PERSONAL_OS_RUN_CAPABILITY.");

export interface PersonalOsMcpOptions {
  apiBaseUrl?: string;
  environmentCapability?: string;
  fetcher?: typeof fetch;
}

export function createPersonalOsMcpServer(options: PersonalOsMcpOptions = {}): McpServer {
  const apiBaseUrl = (options.apiBaseUrl ?? process.env.PERSONAL_OS_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
  assertLoopback(apiBaseUrl);
  const environmentCapability = options.environmentCapability ?? process.env.PERSONAL_OS_RUN_CAPABILITY;
  const fetcher = options.fetcher ?? fetch;
  const server = new McpServer({ name: "personal-os-v2", version: "0.1.0" }, { capabilities: { tools: {} } });

  const call = async (path: string, method: "GET" | "POST", capabilityToken?: string, body?: unknown) => {
    const token = environmentCapability || capabilityToken;
    if (!token) throw new Error("Personal OS run capability is required.");
    const response = await fetcher(`${apiBaseUrl}/api/v2/runtime/mcp${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000)
    });
    const envelope = await response.json().catch(() => null) as { success?: boolean; data?: unknown; error?: { code?: string; message?: string } } | null;
    if (!response.ok || !envelope?.success) throw new Error(`${envelope?.error?.code ?? `HTTP_${response.status}`}: ${envelope?.error?.message ?? "Personal OS API request failed"}`);
    return envelope.data;
  };

  const result = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: { data }
  });
  const guarded = <T>(handler: () => Promise<T>) => handler().then(result).catch((error: unknown) => ({
    isError: true,
    content: [{ type: "text" as const, text: safeError(error) }]
  }));

  server.registerTool("get_run_context", {
    title: "Get Personal OS run context",
    description: "Read the bounded context for the currently executing Personal OS run. Call this first.",
    inputSchema: z.object({ capabilityToken: capability }),
    annotations: { readOnlyHint: true, destructiveHint: false }
  }, ({ capabilityToken }) => guarded(() => call("/context", "GET", capabilityToken)));

  server.registerTool("append_run_event", {
    title: "Report Personal OS run progress",
    description: "Append a truthful, user-visible progress or verification event to the current run.",
    inputSchema: z.object({
      capabilityToken: capability,
      eventType: z.string().regex(/^agent\.[a-z0-9_.-]+$/).max(100),
      level: z.enum(["debug", "info", "warning", "error", "critical"]).default("info"),
      message: z.string().trim().min(1).max(4_000),
      structuredData: z.unknown().optional()
    }),
    annotations: { readOnlyHint: false, destructiveHint: false }
  }, ({ capabilityToken, ...body }) => guarded(() => call("/events", "POST", capabilityToken, body)));

  server.registerTool("save_checkpoint", {
    title: "Save a recoverable workflow checkpoint",
    description: "Save truthful progress for one stable workflow step. Mark completed only when its output can be reused after a retry.",
    inputSchema: z.object({
      capabilityToken: capability,
      stepKey: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
      label: z.string().trim().min(1).max(160),
      status: z.enum(["running", "completed", "failed"]),
      summary: z.string().trim().min(1).max(4_000),
      data: z.unknown().default({})
    }),
    annotations: { readOnlyHint: false, destructiveHint: false }
  }, ({ capabilityToken, ...input }) => guarded(() => call("/checkpoints", "POST", capabilityToken, input)));

  server.registerTool("search_knowledge", {
    title: "Search Personal OS knowledge",
    description: "Read-only search over the indexed Obsidian knowledge base.",
    inputSchema: z.object({ capabilityToken: capability, query: z.string().trim().min(1).max(200), limit: z.number().int().min(1).max(20).default(10) }),
    annotations: { readOnlyHint: true, destructiveHint: false }
  }, ({ capabilityToken, query, limit }) => guarded(() => call(`/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`, "GET", capabilityToken)));

  server.registerTool("save_artifact", {
    title: "Register a repository artifact",
    description: "Register an existing regular file inside the assigned Git repository as a run artifact.",
    inputSchema: z.object({ capabilityToken: capability, name: z.string().trim().min(1).max(240), uri: z.string().trim().min(1).max(4_000), mimeType: z.string().trim().max(240).nullable().default(null) }),
    annotations: { readOnlyHint: false, destructiveHint: false }
  }, ({ capabilityToken, ...input }) => guarded(() => call("/artifacts", "POST", capabilityToken, { storageKind: "git", ...input })));

  server.registerTool("request_approval", {
    title: "Request human approval",
    description: "Create a visible approval checkpoint for a risky or scope-expanding action, then stop the current turn.",
    inputSchema: z.object({
      capabilityToken: capability,
      requestType: z.enum(["permission_required", "directory_requested", "plan_proposed"]),
      summary: z.string().trim().min(1).max(500),
      request: z.unknown().default({})
    }),
    annotations: { readOnlyHint: false, destructiveHint: false }
  }, ({ capabilityToken, ...input }) => guarded(() => call("/approvals", "POST", capabilityToken, input)));

  server.registerTool("get_approval_status", {
    title: "Get current approval status",
    description: "Read the current pending approval for this run, if any.",
    inputSchema: z.object({ capabilityToken: capability }),
    annotations: { readOnlyHint: true, destructiveHint: false }
  }, ({ capabilityToken }) => guarded(() => call("/approvals/current", "GET", capabilityToken)));

  server.registerTool("submit_run_result", {
    title: "Submit structured run result",
    description: "Submit the final structured outcome and exact verification evidence before ending the run.",
    inputSchema: z.object({
      capabilityToken: capability,
      summary: z.string().trim().min(1).max(20_000),
      data: z.unknown().default({}),
      verification: z.array(z.string().trim().min(1).max(2_000)).max(50).default([])
    }),
    annotations: { readOnlyHint: false, destructiveHint: false }
  }, ({ capabilityToken, ...input }) => guarded(() => call("/result", "POST", capabilityToken, input)));

  return server;
}

function assertLoopback(value: string): void {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) throw new Error("PERSONAL_OS_MCP_LOOPBACK_REQUIRED");
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Personal OS MCP tool failed";
  return message.replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]").replace(/[A-Za-z0-9_-]{40,}/g, "[REDACTED]");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  serveStdio(() => createPersonalOsMcpServer(), { onerror: (error) => process.stderr.write(`${safeError(error)}\n`) });
}
