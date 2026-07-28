import type {
  CodexRun,
  CodexRunEvent,
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
  opportunities: () => request<ItemList<Opportunity>>("/api/opportunities"),
  createExperiment: (opportunityId: string) => request<Experiment>(`/api/opportunities/${opportunityId}/experiment`, { method: "POST", body: JSON.stringify({}) }),
  experiments: () => request<ItemList<Experiment>>("/api/experiments"),
  experiment: (id: string) => request<Experiment>(`/api/experiments/${id}`),
  updateExperiment: (id: string, input: ExperimentPatch) => request<Experiment>(`/api/experiments/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  recordExperimentResult: (id: string, input: { status: "measuring" | "won" | "lost" | "pivoted"; resultSummary: string }) => request<Experiment>(`/api/experiments/${id}/result`, { method: "POST", body: JSON.stringify(input) }),
  assets: () => request<ItemList<IncomeAsset>>("/api/assets"),
  latestReport: () => request<DailyReport>("/api/reports/latest"),
  generateReport: (mode: "demo" | "live") => request<DailyReport>("/api/reports/generate", { method: "POST", body: JSON.stringify({ mode }) }),
  runs: () => request<ItemList<CodexRun>>("/api/codex/runs"),
  run: (id: string) => request<CodexRun>(`/api/codex/runs/${id}`),
  runEvents: (id: string) => request<ItemList<CodexRunEvent>>(`/api/codex/runs/${id}/events`),
  runStreamUrl: (id: string) => `/api/codex/runs/${id}/stream`,
  acceptRun: (id: string) => request<CodexRun>(`/api/codex/runs/${id}/accept`, { method: "POST" })
};
