import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { PersonalOsDatabase } from "@personal-os/database";
import { createPersonalOsMcpServer } from "./server.js";

describe("Personal OS MCP protocol", () => {
  let database: PersonalOsDatabase;
  let client: Client;
  let server: ReturnType<typeof createPersonalOsMcpServer>;

  beforeEach(async () => {
    database = new PersonalOsDatabase({ filePath: ":memory:", seed: true });
    server = createPersonalOsMcpServer(database);
    client = new Client({ name: "personal-os-test", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    database.close();
  });

  it("lists the safe tool surface and reads dashboard context", async () => {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    expect(names).toContain("get_today_context");
    expect(names).toContain("complete_task");
    expect(names).toEqual(expect.arrayContaining([
      "list_claimable_tasks",
      "claim_task",
      "get_execution_context",
      "heartbeat_run",
      "request_approval",
      "get_approval_status",
      "submit_run_result",
      "fail_run"
    ]));
    expect(names).not.toContain("accept_run");
    expect(names).not.toContain("publish");
    expect(names).not.toContain("purchase");

    const result = await client.callTool({ name: "get_today_context", arguments: {} }, CallToolResultSchema);
    if (!Array.isArray(result.content)) throw new Error("Expected MCP content array");
    const block = result.content[0];
    expect(block?.type).toBe("text");
    if (block?.type !== "text") throw new Error("Expected MCP text response");
    const dashboard = JSON.parse(block.text) as { projects: unknown[]; focusTasks: unknown[] };
    expect(dashboard.projects.length).toBeGreaterThan(0);
    expect(dashboard.focusTasks.length).toBeGreaterThan(0);
  });

  it("submits completed work through the protocol without bypassing human review", async () => {
    const task = database.listTasks().find((item) => item.status === "ready")!;
    const run = database.createCodexRun({
      taskId: task.id,
      projectId: task.projectId,
      mode: "demo",
      workingDirectory: null,
      promptSnapshot: task.title
    });

    await client.callTool({
      name: "update_task_status",
      arguments: { taskId: task.id, status: "in_progress" }
    });
    await client.callTool({
      name: "complete_task",
      arguments: {
        taskId: task.id,
        runId: run.id,
        finalResponse: "MCP protocol path completed.",
        verificationSummary: "In-memory MCP client and server round trip passed.",
        artifactPaths: []
      }
    });

    expect(database.getTask(task.id)?.status).toBe("needs_review");
    expect(database.getCodexRun(run.id)?.status).toBe("needs_review");
    expect(database.getCodexRun(run.id)?.requiresHumanReview).toBe(true);
  });

  it("runs a deterministic OpenWorker pull flow through the MCP protocol", async () => {
    const task = database.createTask({
      title: "MCP pull task",
      status: "ready",
      acceptanceCriteria: ["Result is submitted for review"],
      taskType: "general_writing",
      executor: "openworker",
      executionMode: "automatic",
      riskLevel: "low",
      maxAttempts: 2
    });
    const run = database.createAgentRun({
      taskId: task.id,
      executor: "openworker",
      promptSnapshot: "Write a local result.",
      idempotencyKey: "protocol:pull:1"
    });

    const listed = await client.callTool({ name: "list_claimable_tasks", arguments: { executor: "openworker" } }, CallToolResultSchema);
    const listedBlock = Array.isArray(listed.content) ? listed.content[0] : null;
    if (listedBlock?.type !== "text") throw new Error("Expected text result");
    expect(JSON.parse(listedBlock.text)).toEqual([
      expect.objectContaining({
        runId: run.id,
        taskId: task.id,
        claimArguments: { taskId: task.id, executor: "openworker" },
        contextArguments: { runId: run.id },
        task: expect.objectContaining({ id: task.id })
      })
    ]);

    await client.callTool({ name: "claim_task", arguments: { taskId: task.id, executor: "openworker" } });
    await client.callTool({ name: "append_run_event", arguments: { runId: run.id, eventType: "running", message: "Fake worker started." } });
    await client.callTool({
      name: "submit_run_result",
      arguments: {
        runId: run.id,
        finalResponse: "Fake worker result.",
        verificationSummary: "Protocol result persisted.",
        artifactPaths: []
      }
    });

    expect(database.getAgentRun(run.id)?.status).toBe("needs_review");
    expect(database.getTask(task.id)?.status).toBe("needs_review");
  });
});
