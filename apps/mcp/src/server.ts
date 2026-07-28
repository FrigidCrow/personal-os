import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PersonalOsDatabase } from "@personal-os/database";
import {
  dailyReportInputSchema,
  experimentStatusSchema,
  incomeAssetInputSchema,
  opportunityInputSchema,
  taskStatusSchema
} from "@personal-os/domain";
import { createPersonalOsTools } from "./tools.js";

function toolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}

export function createPersonalOsMcpServer(database: PersonalOsDatabase): McpServer {
  const tools = createPersonalOsTools(database);
  const server = new McpServer(
    { name: "personal-os", version: "0.1.0" },
    {
      instructions: "Read Personal OS context before acting. Update task and run state as work progresses. Codex completion always enters needs_review; only a human may mark work done. Never perform payments, purchases, outreach, publishing, or production deployment through this server."
    }
  );

  server.registerTool("get_today_context", {
    title: "Get today context",
    description: "Read the current dashboard, focus tasks, projects, opportunities, experiments, assets, and Codex queue.",
    annotations: { readOnlyHint: true }
  }, async () => toolResult(tools.getTodayContext()));

  server.registerTool("get_project", {
    title: "Get project",
    description: "Read one project and its tasks.",
    inputSchema: z.object({ projectId: z.string().uuid() }),
    annotations: { readOnlyHint: true }
  }, async ({ projectId }) => toolResult(tools.getProject(projectId)));

  server.registerTool("get_task", {
    title: "Get task",
    description: "Read one task and its project context.",
    inputSchema: z.object({ taskId: z.string().uuid() }),
    annotations: { readOnlyHint: true }
  }, async ({ taskId }) => toolResult(tools.getTask(taskId)));

  server.registerTool("update_task_status", {
    title: "Update task status",
    description: "Move a task through a valid workflow state. This tool cannot mark a task done.",
    inputSchema: z.object({ taskId: z.string().uuid(), status: taskStatusSchema.exclude(["done"]) })
  }, async ({ taskId, status }) => toolResult(tools.updateTaskStatus(taskId, status)));

  server.registerTool("append_run_event", {
    title: "Append run event",
    description: "Record a concise Codex execution event.",
    inputSchema: z.object({ runId: z.string().uuid(), eventType: z.string().trim().min(1).max(80), message: z.string().trim().min(1).max(1000) })
  }, async ({ runId, eventType, message }) => toolResult(tools.appendRunEvent(runId, eventType, message)));

  server.registerTool("mark_task_blocked", {
    title: "Mark task blocked",
    description: "Mark a task blocked and record the reason on its run when available.",
    inputSchema: z.object({ taskId: z.string().uuid(), reason: z.string().trim().min(1).max(1000), runId: z.string().uuid().optional() })
  }, async ({ taskId, reason, runId }) => toolResult(tools.markTaskBlocked(taskId, reason, runId)));

  server.registerTool("complete_task", {
    title: "Submit task for review",
    description: "Submit Codex work for human review. This changes the task to needs_review, never done.",
    inputSchema: z.object({
      taskId: z.string().uuid(),
      runId: z.string().uuid(),
      finalResponse: z.string().trim().min(1).max(8000),
      verificationSummary: z.string().trim().min(1).max(4000),
      artifactPaths: z.array(z.string().trim().min(1).max(1000)).max(100).default([])
    })
  }, async (input) => toolResult(tools.completeTask(input)));

  server.registerTool("save_artifact", {
    title: "Save artifact",
    description: "Attach a local artifact path to a Codex run.",
    inputSchema: z.object({ runId: z.string().uuid(), path: z.string().trim().min(1).max(1000) })
  }, async ({ runId, path }) => toolResult(tools.saveArtifact(runId, path)));

  server.registerTool("create_asset_candidate", {
    title: "Create asset candidate",
    description: "Capture a reusable income asset candidate from delivery or an experiment.",
    inputSchema: incomeAssetInputSchema
  }, async (input) => toolResult(tools.createAssetCandidate(input)));

  server.registerTool("save_opportunity", {
    title: "Save opportunity",
    description: "Save an evidence-backed revenue opportunity. At least one direct source is required.",
    inputSchema: opportunityInputSchema
  }, async (input) => toolResult(tools.saveOpportunity(input)));

  server.registerTool("save_daily_report", {
    title: "Save daily report",
    description: "Save a daily report with no more than five opportunity ids.",
    inputSchema: dailyReportInputSchema
  }, async (input) => toolResult(tools.saveDailyReport(input)));

  server.registerTool("record_experiment_result", {
    title: "Record experiment result",
    description: "Record a measured, won, lost, or pivoted experiment result.",
    inputSchema: z.object({
      experimentId: z.string().uuid(),
      status: experimentStatusSchema.extract(["measuring", "won", "lost", "pivoted"]),
      resultSummary: z.string().trim().min(1).max(4000)
    })
  }, async ({ experimentId, status, resultSummary }) => toolResult(tools.recordExperimentResult(experimentId, status, resultSummary)));

  return server;
}

