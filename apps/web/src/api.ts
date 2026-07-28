import type {
  AgentRun,
  AgentRunEvent,
  ApprovalRequest,
  CodexRun,
  DailyReport,
  Experiment,
  ExperimentInput,
  IncomeAsset,
  Opportunity,
  Project,
  ProjectInput,
  Task,
  TaskInput,
  TaskStatus
} from "@personal-os/domain";

export interface DashboardData {
  projects: Project[];
  focusTasks: Task[];
  taskCounts: Record<TaskStatus, number>;
  opportunities: Opportunity[];
  experiments: Experiment[];
  assets: IncomeAsset[];
  runs: CodexRun[];
  latestReport: DailyReport | null;
  metrics: {
    activeProjects: number;
    openLoops: number;
    monthlyRevenue: number;
    lowTouchRevenue: number;
    maintenanceHours: number;
  };
}

export interface HealthData {
  ok: boolean;
  service: string;
  codexMode: string;
  executors: Array<{ executor: "codex" | "openworker"; available: boolean; detail: string }>;
  operational: {
    database: "ok" | "error";
    quickCheck: string;
    foreignKeyViolations: number;
    activeRuns: number;
    staleRuns: number;
    pendingApprovals: number;
    checkedAt: string;
  };
}

interface ItemList<T> {
  items: T[];
}

export type TaskPatch = Partial<Omit<TaskInput, "status">>;
export type ExperimentPatch = Partial<ExperimentInput>;

export interface ProjectDetail extends Project {
  tasks: Task[];
}

interface ApiErrorBody {
  message?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.message ?? `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthData>("/api/health"),
  dashboard: () => request<DashboardData>("/api/dashboard"),
  projects: () => request<ItemList<Project>>("/api/projects"),
  project: (id: string) => request<ProjectDetail>(`/api/projects/${id}`),
  createProject: (input: ProjectInput) => request<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
  updateProject: (id: string, input: ProjectInput) => request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteProject: (id: string) => request<Project>(`/api/projects/${id}`, { method: "DELETE" }),
  tasks: () => request<ItemList<Task>>("/api/tasks"),
  createTask: (input: TaskInput) => request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(input) }),
  updateTask: (id: string, input: TaskPatch) => request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteTask: (id: string) => request<Task>(`/api/tasks/${id}`, { method: "DELETE" }),
  transitionTask: (id: string, status: TaskStatus) => request<Task>(`/api/tasks/${id}/transition`, { method: "POST", body: JSON.stringify({ status }) }),
  assignTask: (id: string, mode: "demo" | "live" = "demo") => request<CodexRun>(`/api/tasks/${id}/assign`, { method: "POST", body: JSON.stringify({ mode, newThread: false }) }),
  dispatchTask: (id: string, input: { mode?: "demo" | "live"; forceExecutor?: "codex" | "openworker" } = {}) => request<AgentRun>(`/api/tasks/${id}/dispatch`, { method: "POST", body: JSON.stringify(input) }),
  pauseTaskAutomation: (id: string, paused: boolean) => request<Task>(`/api/tasks/${id}/automation/pause`, { method: "POST", body: JSON.stringify({ paused }) }),
  opportunities: () => request<ItemList<Opportunity>>("/api/opportunities"),
  createExperiment: (opportunityId: string) => request<Experiment>(`/api/opportunities/${opportunityId}/experiment`, { method: "POST", body: JSON.stringify({}) }),
  experiments: () => request<ItemList<Experiment>>("/api/experiments"),
  experiment: (id: string) => request<Experiment>(`/api/experiments/${id}`),
  updateExperiment: (id: string, input: ExperimentPatch) => request<Experiment>(`/api/experiments/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  recordExperimentResult: (id: string, input: { status: "measuring" | "won" | "lost" | "pivoted"; resultSummary: string }) => request<Experiment>(`/api/experiments/${id}/result`, { method: "POST", body: JSON.stringify(input) }),
  assets: () => request<ItemList<IncomeAsset>>("/api/assets"),
  latestReport: () => request<DailyReport>("/api/reports/latest"),
  generateReport: (mode: "demo" | "live") => request<DailyReport>("/api/reports/generate", { method: "POST", body: JSON.stringify({ mode }) }),
  runs: () => request<ItemList<AgentRun>>("/api/agent-runs"),
  run: (id: string) => request<AgentRun>(`/api/agent-runs/${id}`),
  runEvents: (id: string) => request<ItemList<AgentRunEvent>>(`/api/agent-runs/${id}/events`),
  runStreamUrl: (id: string) => `/api/agent-runs/${id}/stream`,
  acceptRun: (id: string) => request<AgentRun>(`/api/agent-runs/${id}/accept`, { method: "POST" }),
  rejectRun: (id: string, reason: string) => request<AgentRun>(`/api/agent-runs/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  cancelRun: (id: string) => request<AgentRun>(`/api/agent-runs/${id}/cancel`, { method: "POST" }),
  retryRun: (id: string) => request<AgentRun>(`/api/agent-runs/${id}/retry`, { method: "POST" }),
  approvals: (status?: ApprovalRequest["status"]) => request<ItemList<ApprovalRequest>>(`/api/approvals${status ? `?status=${status}` : ""}`),
  resolveApproval: (id: string, decision: "approved" | "rejected") => request<ApprovalRequest>(`/api/approvals/${id}/resolve`, { method: "POST", body: JSON.stringify({ decision }) })
};
