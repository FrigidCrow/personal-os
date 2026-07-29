import type { PersonalOsDatabase } from "@personal-os/database";
import { CronExpressionParser } from "cron-parser";
import type {
  AgentExecutor,
  AgentRunEventType,
  ApprovalActionType,
  DailyReportInput,
  ExperimentStatus,
  IncomeAssetInput,
  OpportunityInput,
  TaskStatus
} from "@personal-os/domain";

export function createPersonalOsTools(
  database: PersonalOsDatabase,
  options: { leaseMilliseconds?: number } = {}
) {
  const leaseMilliseconds = options.leaseMilliseconds ?? 120_000;
  return {
    getTodayContext: () => database.getDashboard(),
    getProject: (projectId: string) => {
      const project = database.getProject(projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
      return { ...project, tasks: database.listTasks({ projectId }) };
    },
    getTask: (taskId: string) => {
      const task = database.getTask(taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      return { task, project: task.projectId ? database.getProject(task.projectId) : null };
    },
    listClaimableTasks: (executor: AgentExecutor = "openworker") => database.listClaimableRuns(executor).map((run) => {
      const task = database.getTask(run.taskId)!;
      return {
        runId: run.id,
        taskId: task.id,
        executor: run.executor,
        attempt: run.attempt,
        claimArguments: { taskId: task.id, executor: run.executor },
        contextArguments: { runId: run.id },
        task,
        project: task.projectId ? database.getProject(task.projectId) : null
      };
    }),
    claimTask: (taskId: string, executor: AgentExecutor = "openworker") => {
      const run = database.getActiveRunForTask(taskId);
      if (!run || run.status !== "queued") throw new Error(`No queued run exists for task: ${taskId}`);
      if (run.executor !== executor) throw new Error(`Queued run belongs to ${run.executor}, not ${executor}`);
      return database.claimAgentRun(run.id, leaseMilliseconds);
    },
    getExecutionContext: (runId: string) => {
      const run = database.getAgentRun(runId);
      if (!run) throw new Error(`Agent run not found: ${runId}`);
      const task = database.getTask(run.taskId);
      if (!task) throw new Error(`Task not found: ${run.taskId}`);
      const project = task.projectId ? database.getProject(task.projectId) : null;
      return {
        run,
        task,
        project,
        safety: {
          allowed: ["read approved context", "write local task artifacts", "run proportionate local verification"],
          requiresApproval: ["send_message", "calendar_write", "publish", "shell with external effect", "external_write"],
          prohibited: ["payment", "purchase", "financial transfer", "credential or OTP handling", "production deployment"],
          finalState: "needs_review"
        }
      };
    },
    heartbeatRun: (runId: string) => database.heartbeatAgentRun(runId, leaseMilliseconds),
    appendAgentRunEvent: (runId: string, eventType: AgentRunEventType, message: string) => {
      const run = database.getAgentRun(runId);
      if (!run) throw new Error(`Agent run not found: ${runId}`);
      if (eventType === "running" && run.status === "claimed") {
        database.updateAgentRun(runId, { status: "running", startedAt: new Date().toISOString() });
      }
      return database.appendAgentRunEvent(runId, eventType, message);
    },
    requestApproval: (input: {
      runId: string;
      actionType: ApprovalActionType;
      destination: string;
      summary: string;
      payloadPreview?: string | null;
      expiresAt?: string | null;
    }) => {
      const run = database.getAgentRun(input.runId);
      if (!run) throw new Error(`Agent run not found: ${input.runId}`);
      if (run.status === "claimed") {
        database.updateAgentRun(run.id, { status: "running", startedAt: new Date().toISOString() });
      }
      return database.createApprovalRequest(input);
    },
    getApprovalStatus: (approvalId: string) => {
      const approval = database.getApprovalRequest(approvalId);
      if (!approval) throw new Error(`Approval request not found: ${approvalId}`);
      return approval;
    },
    submitRunResult: (input: {
      runId: string;
      finalResponse: string;
      verificationSummary: string;
      artifactPaths?: string[];
      externalSessionId?: string | null;
    }) => database.submitAgentRunResult(input.runId, input),
    failRun: (runId: string, reason: string) => database.recordAgentRunFailure(runId, reason),
    updateTaskStatus: (taskId: string, status: Exclude<TaskStatus, "done">) => database.transitionTask(taskId, status),
    appendRunEvent: (runId: string, eventType: string, message: string) => database.appendCodexRunEvent(runId, eventType, message),
    markTaskBlocked: (taskId: string, reason: string, runId?: string) => {
      const task = database.transitionTask(taskId, "blocked");
      if (runId) {
        const run = database.getCodexRun(runId);
        if (run?.status === "queued" || run?.status === "claimed") {
          database.updateCodexRun(runId, { status: "running", startedAt: new Date().toISOString() });
        }
        database.appendCodexRunEvent(runId, "blocked", reason);
        database.updateCodexRun(runId, { status: "blocked", errorMessage: reason });
      }
      return { task, reason };
    },
    completeTask: (input: { taskId: string; runId: string; finalResponse: string; verificationSummary: string; artifactPaths: string[] }) => {
      const task = database.getTask(input.taskId);
      if (!task) throw new Error(`Task not found: ${input.taskId}`);
      if (task.status !== "in_progress") throw new Error(`Task must be in progress before Codex completion: ${task.status}`);
      const currentRun = database.getCodexRun(input.runId);
      if (!currentRun) throw new Error(`Codex run not found: ${input.runId}`);
      if (currentRun.status === "queued" || currentRun.status === "claimed") {
        database.updateCodexRun(input.runId, { status: "running", startedAt: new Date().toISOString() });
      }
      const transitioned = database.transitionTask(input.taskId, "needs_review");
      const run = database.updateCodexRun(input.runId, {
        status: "needs_review",
        finalResponse: input.finalResponse,
        verificationSummary: input.verificationSummary,
        artifactPaths: input.artifactPaths,
        completedAt: new Date().toISOString(),
        requiresHumanReview: true
      });
      database.appendCodexRunEvent(input.runId, "needs_review", "Codex submitted the task for human review through MCP.");
      return { task: transitioned, run };
    },
    saveArtifact: (runId: string, path: string) => {
      return database.saveAgentRunArtifact(runId, path);
    },
    createAssetCandidate: (input: IncomeAssetInput) => database.createAsset({ ...input, stage: input.stage ?? "idea" }),
    saveOpportunity: (input: OpportunityInput) => database.createOpportunity(input),
    saveDailyReport: (input: DailyReportInput) => database.createDailyReport(input),
    claimDueRadar: (executor: AgentExecutor = "openworker") => {
      const schedule = database.claimDueRadar(executor);
      if (!schedule) return { claimed: false as const, reason: "No due radar research is available." };
      const claimStartedAt = schedule.lastStartedAt!;
      const reportDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: schedule.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(claimStartedAt));
      return {
        claimed: true as const,
        claimStartedAt,
        scheduledFor: schedule.nextRunAt,
        reportDate,
        timezone: schedule.timezone,
        searchProfile: schedule.searchProfile,
        customInstructions: schedule.customInstructions,
        hardRequirements: [
          "Return at most five opportunities in Simplified Chinese.",
          "Every opportunity must identify a concrete offer, payer, pricing model, first-sale plan, and at least one verifiable sales channel.",
          "Every sales channel must include a direct public URL and a specific access method. If no channel can be verified, omit the candidate.",
          "Cite direct sources, label fact versus inference, and never claim guaranteed income.",
          "Do not contact anyone, publish, purchase, create accounts, or perform any external write."
        ]
      };
    },
    saveRadarOpportunity: (claimStartedAt: string, input: OpportunityInput) => {
      database.assertActiveRadarClaim(claimStartedAt);
      return database.createOpportunity({ ...input, status: "candidate", isDemo: false });
    },
    saveRadarReport: (claimStartedAt: string, input: DailyReportInput) => {
      database.assertActiveRadarClaim(claimStartedAt);
      return database.createDailyReport({ ...input, generatedBy: "openworker", isDemo: false });
    },
    completeRadarRun: (claimStartedAt: string) => {
      const schedule = database.assertActiveRadarClaim(claimStartedAt);
      const nextRunAt = CronExpressionParser.parse(schedule.expression, {
        currentDate: new Date(),
        tz: schedule.timezone
      }).next().toDate().toISOString();
      return database.completeRadarClaim(claimStartedAt, nextRunAt);
    },
    failRadarRun: (claimStartedAt: string, reason: string) => {
      const schedule = database.assertActiveRadarClaim(claimStartedAt);
      const nextRunAt = CronExpressionParser.parse(schedule.expression, {
        currentDate: new Date(),
        tz: schedule.timezone
      }).next().toDate().toISOString();
      return database.failRadarClaim(claimStartedAt, nextRunAt, reason);
    },
    recordExperimentResult: (experimentId: string, status: Extract<ExperimentStatus, "measuring" | "won" | "lost" | "pivoted">, resultSummary: string) =>
      database.recordExperimentResult(experimentId, { status, resultSummary })
  };
}

export type PersonalOsTools = ReturnType<typeof createPersonalOsTools>;
