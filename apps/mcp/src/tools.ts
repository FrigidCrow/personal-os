import type { PersonalOsDatabase } from "@personal-os/database";
import type { DailyReportInput, ExperimentStatus, IncomeAssetInput, OpportunityInput, TaskStatus } from "@personal-os/domain";

export function createPersonalOsTools(database: PersonalOsDatabase) {
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
    updateTaskStatus: (taskId: string, status: Exclude<TaskStatus, "done">) => database.transitionTask(taskId, status),
    appendRunEvent: (runId: string, eventType: string, message: string) => database.appendCodexRunEvent(runId, eventType, message),
    markTaskBlocked: (taskId: string, reason: string, runId?: string) => {
      const task = database.transitionTask(taskId, "blocked");
      if (runId) {
        database.appendCodexRunEvent(runId, "blocked", reason);
        database.updateCodexRun(runId, { status: "blocked", errorMessage: reason });
      }
      return { task, reason };
    },
    completeTask: (input: { taskId: string; runId: string; finalResponse: string; verificationSummary: string; artifactPaths: string[] }) => {
      const task = database.getTask(input.taskId);
      if (!task) throw new Error(`Task not found: ${input.taskId}`);
      if (task.status !== "in_progress") throw new Error(`Task must be in progress before Codex completion: ${task.status}`);
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
      const run = database.getCodexRun(runId);
      if (!run) throw new Error(`Codex run not found: ${runId}`);
      return database.updateCodexRun(runId, { artifactPaths: Array.from(new Set([...run.artifactPaths, path])) });
    },
    createAssetCandidate: (input: IncomeAssetInput) => database.createAsset({ ...input, stage: input.stage ?? "idea" }),
    saveOpportunity: (input: OpportunityInput) => database.createOpportunity(input),
    saveDailyReport: (input: DailyReportInput) => database.createDailyReport(input),
    recordExperimentResult: (experimentId: string, status: Extract<ExperimentStatus, "measuring" | "won" | "lost" | "pivoted">, resultSummary: string) =>
      database.recordExperimentResult(experimentId, { status, resultSummary })
  };
}

export type PersonalOsTools = ReturnType<typeof createPersonalOsTools>;
