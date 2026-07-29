import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PersonalOsDatabase } from "@personal-os/database";
import {
  agentExecutorSchema,
  agentRunEventTypeSchema,
  approvalActionTypeSchema,
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

export function createPersonalOsMcpServer(
  database: PersonalOsDatabase,
  options: { leaseMilliseconds?: number } = {}
): McpServer {
  const tools = createPersonalOsTools(database, options);
  const server = new McpServer(
    { name: "personal-os", version: "0.1.0" },
    {
      instructions: "Personal OS is the control plane. OpenWorker must list and atomically claim its queued work, heartbeat every 30 seconds, record concise events, and submit results to needs_review. Consequential actions require request_approval and must not occur before approval. Only a human may mark work done. Never perform payments, purchases, credential handling, publishing, outreach, or production deployment through this server."
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

  server.registerTool("list_claimable_tasks", {
    title: "List claimable tasks",
    description: "List queued Personal OS work. Copy claimArguments exactly into claim_task; taskId and runId are different IDs.",
    inputSchema: z.object({ executor: agentExecutorSchema.default("openworker") }),
    annotations: { readOnlyHint: true }
  }, async ({ executor }) => toolResult(tools.listClaimableTasks(executor)));

  server.registerTool("claim_task", {
    title: "Claim task",
    description: "Atomically claim a queued run and acquire the configured worker lease. Copy taskId from list_claimable_tasks.claimArguments; never pass runId as taskId.",
    inputSchema: z.object({ taskId: z.string().uuid(), executor: agentExecutorSchema.default("openworker") })
  }, async ({ taskId, executor }) => toolResult(tools.claimTask(taskId, executor)));

  server.registerTool("get_execution_context", {
    title: "Get execution context",
    description: "Read the claimed run, task, project, acceptance criteria, and safety policy without secrets.",
    inputSchema: z.object({ runId: z.string().uuid() }),
    annotations: { readOnlyHint: true }
  }, async ({ runId }) => toolResult(tools.getExecutionContext(runId)));

  server.registerTool("heartbeat_run", {
    title: "Heartbeat run",
    description: "Extend an active worker lease by the configured duration. Workers should call this before work and periodically while running.",
    inputSchema: z.object({ runId: z.string().uuid() })
  }, async ({ runId }) => toolResult(tools.heartbeatRun(runId)));

  server.registerTool("update_task_status", {
    title: "Update task status",
    description: "Move a task through a valid workflow state. This tool cannot mark a task done.",
    inputSchema: z.object({ taskId: z.string().uuid(), status: taskStatusSchema.exclude(["done"]) })
  }, async ({ taskId, status }) => toolResult(tools.updateTaskStatus(taskId, status)));

  server.registerTool("append_run_event", {
    title: "Append run event",
    description: "Record a concise typed Agent execution event. A running event starts a claimed run.",
    inputSchema: z.object({ runId: z.string().uuid(), eventType: agentRunEventTypeSchema, message: z.string().trim().min(1).max(1000) })
  }, async ({ runId, eventType, message }) => toolResult(tools.appendAgentRunEvent(runId, eventType, message)));

  server.registerTool("request_approval", {
    title: "Request approval",
    description: "Pause a run and request explicit human approval before a consequential action. This tool never executes the action.",
    inputSchema: z.object({
      runId: z.string().uuid(),
      actionType: approvalActionTypeSchema,
      destination: z.string().trim().min(1).max(500),
      summary: z.string().trim().min(1).max(1000),
      payloadPreview: z.string().trim().max(4000).nullable().default(null),
      expiresAt: z.string().datetime({ offset: true }).nullable().default(null)
    })
  }, async (input) => toolResult(tools.requestApproval(input)));

  server.registerTool("get_approval_status", {
    title: "Get approval status",
    description: "Read one immutable human approval decision.",
    inputSchema: z.object({ approvalId: z.string().uuid() }),
    annotations: { readOnlyHint: true }
  }, async ({ approvalId }) => toolResult(tools.getApprovalStatus(approvalId)));

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
      finalResponse: z.string().trim().min(1).max(24_000),
      verificationSummary: z.string().trim().min(1).max(4000),
      artifactPaths: z.array(z.string().trim().min(1).max(1000)).max(100).default([])
    })
  }, async (input) => toolResult(tools.completeTask(input)));

  server.registerTool("save_artifact", {
    title: "Save artifact",
    description: "Attach a local artifact path to a generic Agent run.",
    inputSchema: z.object({ runId: z.string().uuid(), path: z.string().trim().min(1).max(1000) })
  }, async ({ runId, path }) => toolResult(tools.saveArtifact(runId, path)));

  server.registerTool("submit_run_result", {
    title: "Submit run result",
    description: "Submit Agent work for human review. This can only end at needs_review, never done.",
    inputSchema: z.object({
      runId: z.string().uuid(),
      finalResponse: z.string().trim().min(1).max(8000),
      verificationSummary: z.string().trim().min(1).max(4000),
      artifactPaths: z.array(z.string().trim().min(1).max(1000)).max(100).default([]),
      externalSessionId: z.string().trim().min(1).max(500).nullable().default(null)
    })
  }, async (input) => toolResult(tools.submitRunResult(input)));

  server.registerTool("fail_run", {
    title: "Fail run",
    description: "Record a worker failure and apply Personal OS retry limits. This cannot mark work done.",
    inputSchema: z.object({ runId: z.string().uuid(), reason: z.string().trim().min(1).max(2000) })
  }, async ({ runId, reason }) => toolResult(tools.failRun(runId, reason)));

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

  server.registerTool("claim_due_radar", {
    title: "Claim due opportunity radar research",
    description: "Atomically claim one due read-only opportunity radar run. An empty result is an idle poll, not a failed task.",
    inputSchema: z.object({ executor: agentExecutorSchema.default("openworker") })
  }, async ({ executor }) => toolResult(tools.claimDueRadar(executor)));

  server.registerTool("save_radar_opportunity", {
    title: "Save a radar opportunity",
    description: "Save one channel-verified opportunity against the active radar claim.",
    inputSchema: z.object({
      claimStartedAt: z.string().datetime(),
      opportunity: opportunityInputSchema
    })
  }, async ({ claimStartedAt, opportunity }) => toolResult(tools.saveRadarOpportunity(claimStartedAt, opportunity)));

  server.registerTool("save_radar_report", {
    title: "Save an OpenWorker radar report",
    description: "Save the daily report after all channel-verified opportunities have been persisted.",
    inputSchema: z.object({
      claimStartedAt: z.string().datetime(),
      report: dailyReportInputSchema
    })
  }, async ({ claimStartedAt, report }) => toolResult(tools.saveRadarReport(claimStartedAt, report)));

  server.registerTool("complete_radar_run", {
    title: "Complete an opportunity radar run",
    description: "Mark the active radar claim successful and schedule the next occurrence.",
    inputSchema: z.object({ claimStartedAt: z.string().datetime() })
  }, async ({ claimStartedAt }) => toolResult(tools.completeRadarRun(claimStartedAt)));

  server.registerTool("fail_radar_run", {
    title: "Fail an opportunity radar run",
    description: "Record a concise failure reason and schedule the next occurrence.",
    inputSchema: z.object({
      claimStartedAt: z.string().datetime(),
      reason: z.string().trim().min(1).max(2000)
    })
  }, async ({ claimStartedAt, reason }) => toolResult(tools.failRadarRun(claimStartedAt, reason)));

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
