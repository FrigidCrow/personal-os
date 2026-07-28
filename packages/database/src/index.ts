import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import {
  assertTaskTransition,
  calculateOpportunityScore,
  dailyReportInputSchema,
  experimentInputSchema,
  incomeAssetInputSchema,
  opportunityInputSchema,
  projectInputSchema,
  taskInputSchema,
  type CodexRun,
  type CodexRunStatus,
  type DailyReport,
  type DailyReportInput,
  type Evidence,
  type Experiment,
  type ExperimentInput,
  type IncomeAsset,
  type IncomeAssetInput,
  type Opportunity,
  type OpportunityInput,
  type Project,
  type ProjectInput,
  type Task,
  type TaskInput,
  type TaskStatus
} from "@personal-os/domain";

type Sqlite = Database.Database;
type Row = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function booleanFromDb(value: unknown): boolean {
  return value === 1;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function mapProject(row: Row): Project {
  return {
    id: String(row.id),
    name: String(row.name),
    lane: row.lane as Project["lane"],
    status: row.status as Project["status"],
    outcome: String(row.outcome),
    nextAction: String(row.next_action),
    deadline: nullableString(row.deadline),
    expectedRevenue: nullableNumber(row.expected_revenue),
    actualRevenue: nullableNumber(row.actual_revenue),
    repositoryPath: nullableString(row.repository_path),
    obsidianPath: nullableString(row.obsidian_path),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapTask(row: Row): Task {
  return {
    id: String(row.id),
    projectId: nullableString(row.project_id),
    title: String(row.title),
    description: String(row.description),
    status: row.status as Task["status"],
    delegationMode: row.delegation_mode as Task["delegationMode"],
    priority: row.priority as Task["priority"],
    dueDate: nullableString(row.due_date),
    acceptanceCriteria: JSON.parse(String(row.acceptance_criteria)) as string[],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapEvidence(row: Row): Evidence {
  return {
    id: String(row.id),
    opportunityId: String(row.opportunity_id),
    label: String(row.label),
    sourceUrl: String(row.source_url),
    type: row.evidence_type as Evidence["type"],
    summary: String(row.summary)
  };
}

function mapExperiment(row: Row): Experiment {
  return {
    id: String(row.id),
    opportunityId: nullableString(row.opportunity_id),
    title: String(row.title),
    hypothesis: String(row.hypothesis),
    status: row.status as Experiment["status"],
    timeCapHours: Number(row.time_cap_hours),
    budgetCap: Number(row.budget_cap),
    deadline: nullableString(row.deadline),
    successCondition: String(row.success_condition),
    stopCondition: String(row.stop_condition),
    resultSummary: nullableString(row.result_summary),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapAsset(row: Row): IncomeAsset {
  return {
    id: String(row.id),
    projectId: nullableString(row.project_id),
    experimentId: nullableString(row.experiment_id),
    name: String(row.name),
    stage: row.stage as IncomeAsset["stage"],
    revenueModel: String(row.revenue_model),
    monthlyRevenue: Number(row.monthly_revenue),
    maintenanceHoursMonthly: Number(row.maintenance_hours_monthly),
    nextAction: String(row.next_action),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapRun(row: Row): CodexRun {
  return {
    id: String(row.id),
    projectId: nullableString(row.project_id),
    taskId: String(row.task_id),
    threadId: nullableString(row.thread_id),
    status: row.status as CodexRunStatus,
    mode: row.mode as CodexRun["mode"],
    workingDirectory: nullableString(row.working_directory),
    promptSnapshot: String(row.prompt_snapshot),
    finalResponse: nullableString(row.final_response),
    artifactPaths: JSON.parse(String(row.artifact_paths)) as string[],
    verificationSummary: nullableString(row.verification_summary),
    errorMessage: nullableString(row.error_message),
    requiresHumanReview: booleanFromDb(row.requires_human_review),
    startedAt: nullableString(row.started_at),
    completedAt: nullableString(row.completed_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export interface PersonalOsDatabaseOptions {
  filePath: string;
  seed?: boolean;
}

export class PersonalOsDatabase {
  readonly connection: Sqlite;

  constructor(options: PersonalOsDatabaseOptions) {
    if (options.filePath !== ":memory:") {
      const absolutePath = resolve(options.filePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      this.connection = new Database(absolutePath);
    } else {
      this.connection = new Database(":memory:");
    }

    this.connection.pragma("foreign_keys = ON");
    if (options.filePath !== ":memory:") {
      this.connection.pragma("journal_mode = WAL");
    }
    this.migrate();

    if (options.seed) {
      this.seedDemoData();
    }
  }

  close(): void {
    this.connection.close();
  }

  migrate(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        lane TEXT NOT NULL,
        status TEXT NOT NULL,
        outcome TEXT NOT NULL,
        next_action TEXT NOT NULL,
        deadline TEXT,
        expected_revenue REAL,
        actual_revenue REAL,
        repository_path TEXT,
        obsidian_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        delegation_mode TEXT NOT NULL,
        priority TEXT NOT NULL,
        due_date TEXT,
        acceptance_criteria TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS opportunities (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        payer TEXT NOT NULL,
        pain TEXT NOT NULL,
        summary TEXT NOT NULL,
        business_model TEXT NOT NULL,
        confidence INTEGER NOT NULL,
        personal_fit INTEGER NOT NULL,
        validation_effort_hours REAL NOT NULL,
        validation_budget REAL NOT NULL,
        time_to_revenue TEXT NOT NULL,
        recurring_potential INTEGER NOT NULL,
        maintenance_hours_monthly REAL NOT NULL,
        hypothesis TEXT NOT NULL,
        minimal_experiment TEXT NOT NULL,
        success_condition TEXT NOT NULL,
        stop_condition TEXT NOT NULL,
        status TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS opportunity_evidence (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        source_url TEXT NOT NULL,
        evidence_type TEXT NOT NULL,
        summary TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        hypothesis TEXT NOT NULL,
        status TEXT NOT NULL,
        time_cap_hours REAL NOT NULL,
        budget_cap REAL NOT NULL,
        deadline TEXT,
        success_condition TEXT NOT NULL,
        stop_condition TEXT NOT NULL,
        result_summary TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS income_assets (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        experiment_id TEXT REFERENCES experiments(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        stage TEXT NOT NULL,
        revenue_model TEXT NOT NULL,
        monthly_revenue REAL NOT NULL DEFAULT 0,
        maintenance_hours_monthly REAL NOT NULL DEFAULT 0,
        next_action TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_reports (
        id TEXT PRIMARY KEY,
        report_date TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_report_opportunities (
        report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
        opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        rank INTEGER NOT NULL,
        PRIMARY KEY (report_id, opportunity_id)
      );

      CREATE TABLE IF NOT EXISTS codex_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        thread_id TEXT,
        status TEXT NOT NULL,
        mode TEXT NOT NULL,
        working_directory TEXT,
        prompt_snapshot TEXT NOT NULL,
        final_response TEXT,
        artifact_paths TEXT NOT NULL DEFAULT '[]',
        verification_summary TEXT,
        error_message TEXT,
        requires_human_review INTEGER NOT NULL DEFAULT 1,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS codex_run_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES codex_runs(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
      CREATE INDEX IF NOT EXISTS idx_runs_task ON codex_runs(task_id);
      CREATE INDEX IF NOT EXISTS idx_runs_status ON codex_runs(status);
      CREATE INDEX IF NOT EXISTS idx_run_events_run ON codex_run_events(run_id);
    `);
  }

  listProjects(): Project[] {
    return (this.connection.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as Row[]).map(mapProject);
  }

  getProject(id: string): Project | null {
    const row = this.connection.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Row | undefined;
    return row ? mapProject(row) : null;
  }

  createProject(raw: ProjectInput, id = randomUUID()): Project {
    const input = projectInputSchema.parse(raw);
    const timestamp = now();
    this.connection.prepare(`
      INSERT INTO projects (
        id, name, lane, status, outcome, next_action, deadline,
        expected_revenue, actual_revenue, repository_path, obsidian_path,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.lane,
      input.status,
      input.outcome,
      input.nextAction,
      input.deadline ?? null,
      input.expectedRevenue ?? null,
      input.actualRevenue ?? null,
      input.repositoryPath ?? null,
      input.obsidianPath ?? null,
      timestamp,
      timestamp
    );
    return this.requireProject(id);
  }

  updateProject(id: string, raw: ProjectInput): Project {
    const input = projectInputSchema.parse(raw);
    this.requireProject(id);
    this.connection.prepare(`
      UPDATE projects SET
        name = ?, lane = ?, status = ?, outcome = ?, next_action = ?, deadline = ?,
        expected_revenue = ?, actual_revenue = ?, repository_path = ?, obsidian_path = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      input.name,
      input.lane,
      input.status,
      input.outcome,
      input.nextAction,
      input.deadline ?? null,
      input.expectedRevenue ?? null,
      input.actualRevenue ?? null,
      input.repositoryPath ?? null,
      input.obsidianPath ?? null,
      now(),
      id
    );
    return this.requireProject(id);
  }

  deleteProject(id: string): Project {
    const project = this.requireProject(id);
    this.connection.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return project;
  }

  listTasks(filters: { status?: TaskStatus; projectId?: string } = {}): Task[] {
    const clauses: string[] = [];
    const values: string[] = [];
    if (filters.status) {
      clauses.push("status = ?");
      values.push(filters.status);
    }
    if (filters.projectId) {
      clauses.push("project_id = ?");
      values.push(filters.projectId);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    return (
      this.connection
        .prepare(`SELECT * FROM tasks ${where} ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, updated_at DESC`)
        .all(...values) as Row[]
    ).map(mapTask);
  }

  getTask(id: string): Task | null {
    const row = this.connection.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Row | undefined;
    return row ? mapTask(row) : null;
  }

  createTask(raw: TaskInput, id = randomUUID()): Task {
    const input = taskInputSchema.parse(raw);
    if (input.projectId) this.requireProject(input.projectId);
    const timestamp = now();
    this.connection.prepare(`
      INSERT INTO tasks (
        id, project_id, title, description, status, delegation_mode, priority,
        due_date, acceptance_criteria, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId ?? null,
      input.title,
      input.description,
      input.status,
      input.delegationMode,
      input.priority,
      input.dueDate ?? null,
      JSON.stringify(input.acceptanceCriteria),
      timestamp,
      timestamp
    );
    return this.requireTask(id);
  }

  updateTask(id: string, raw: TaskInput): Task {
    const input = taskInputSchema.parse(raw);
    const current = this.requireTask(id);
    if (input.status !== current.status) {
      assertTaskTransition(current.status, input.status);
    }
    if (input.projectId) this.requireProject(input.projectId);
    this.connection.prepare(`
      UPDATE tasks SET
        project_id = ?, title = ?, description = ?, status = ?, delegation_mode = ?,
        priority = ?, due_date = ?, acceptance_criteria = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.projectId ?? null,
      input.title,
      input.description,
      input.status,
      input.delegationMode,
      input.priority,
      input.dueDate ?? null,
      JSON.stringify(input.acceptanceCriteria),
      now(),
      id
    );
    return this.requireTask(id);
  }

  deleteTask(id: string): Task {
    const task = this.requireTask(id);
    this.connection.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return task;
  }

  transitionTask(id: string, nextStatus: TaskStatus): Task {
    const task = this.requireTask(id);
    assertTaskTransition(task.status, nextStatus);
    this.connection.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?").run(nextStatus, now(), id);
    return this.requireTask(id);
  }

  listOpportunities(): Opportunity[] {
    return (this.connection.prepare("SELECT * FROM opportunities ORDER BY created_at DESC").all() as Row[]).map((row) => this.hydrateOpportunity(row));
  }

  getOpportunity(id: string): Opportunity | null {
    const row = this.connection.prepare("SELECT * FROM opportunities WHERE id = ?").get(id) as Row | undefined;
    return row ? this.hydrateOpportunity(row) : null;
  }

  createOpportunity(raw: OpportunityInput, id = randomUUID()): Opportunity {
    const input = opportunityInputSchema.parse(raw);
    const timestamp = now();
    const insert = this.connection.transaction(() => {
      this.connection.prepare(`
        INSERT INTO opportunities (
          id, title, payer, pain, summary, business_model, confidence, personal_fit,
          validation_effort_hours, validation_budget, time_to_revenue, recurring_potential,
          maintenance_hours_monthly, hypothesis, minimal_experiment, success_condition,
          stop_condition, status, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, input.title, input.payer, input.pain, input.summary, input.businessModel,
        input.confidence, input.personalFit, input.validationEffortHours, input.validationBudget,
        input.timeToRevenue, input.recurringPotential, input.maintenanceHoursMonthly,
        input.hypothesis, input.minimalExperiment, input.successCondition, input.stopCondition,
        input.status, input.isDemo ? 1 : 0, timestamp, timestamp
      );
      const statement = this.connection.prepare(`
        INSERT INTO opportunity_evidence (id, opportunity_id, label, source_url, evidence_type, summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const evidence of input.evidence) {
        statement.run(randomUUID(), id, evidence.label, evidence.sourceUrl, evidence.type, evidence.summary);
      }
    });
    insert();
    return this.requireOpportunity(id);
  }

  listExperiments(): Experiment[] {
    return (this.connection.prepare("SELECT * FROM experiments ORDER BY updated_at DESC").all() as Row[]).map(mapExperiment);
  }

  getExperiment(id: string): Experiment | null {
    const row = this.connection.prepare("SELECT * FROM experiments WHERE id = ?").get(id) as Row | undefined;
    return row ? mapExperiment(row) : null;
  }

  createExperiment(raw: ExperimentInput, id = randomUUID()): Experiment {
    const input = experimentInputSchema.parse(raw);
    if (input.opportunityId) this.requireOpportunity(input.opportunityId);
    const timestamp = now();
    this.connection.prepare(`
      INSERT INTO experiments (
        id, opportunity_id, title, hypothesis, status, time_cap_hours, budget_cap,
        deadline, success_condition, stop_condition, result_summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.opportunityId ?? null,
      input.title,
      input.hypothesis,
      input.status,
      input.timeCapHours,
      input.budgetCap,
      input.deadline ?? null,
      input.successCondition,
      input.stopCondition,
      input.resultSummary ?? null,
      timestamp,
      timestamp
    );
    if (input.opportunityId) {
      this.connection.prepare("UPDATE opportunities SET status = 'experiment', updated_at = ? WHERE id = ?").run(timestamp, input.opportunityId);
    }
    return this.requireExperiment(id);
  }

  createExperimentFromOpportunity(opportunityId: string, overrides: Partial<ExperimentInput> = {}): Experiment {
    const opportunity = this.requireOpportunity(opportunityId);
    return this.createExperiment({
      opportunityId,
      title: opportunity.title,
      hypothesis: opportunity.hypothesis,
      status: "hypothesis",
      timeCapHours: Math.max(1, opportunity.validationEffortHours),
      budgetCap: opportunity.validationBudget,
      deadline: null,
      successCondition: opportunity.successCondition,
      stopCondition: opportunity.stopCondition,
      resultSummary: null,
      ...overrides
    });
  }

  recordExperimentResult(id: string, input: { status: "measuring" | "won" | "lost" | "pivoted"; resultSummary: string }): Experiment {
    this.requireExperiment(id);
    this.connection.prepare("UPDATE experiments SET status = ?, result_summary = ?, updated_at = ? WHERE id = ?").run(
      input.status,
      input.resultSummary,
      now(),
      id
    );
    return this.requireExperiment(id);
  }

  listAssets(): IncomeAsset[] {
    return (this.connection.prepare("SELECT * FROM income_assets ORDER BY updated_at DESC").all() as Row[]).map(mapAsset);
  }

  createAsset(raw: IncomeAssetInput, id = randomUUID()): IncomeAsset {
    const input = incomeAssetInputSchema.parse(raw);
    if (input.projectId) this.requireProject(input.projectId);
    if (input.experimentId) this.requireExperiment(input.experimentId);
    const timestamp = now();
    this.connection.prepare(`
      INSERT INTO income_assets (
        id, project_id, experiment_id, name, stage, revenue_model, monthly_revenue,
        maintenance_hours_monthly, next_action, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId ?? null,
      input.experimentId ?? null,
      input.name,
      input.stage,
      input.revenueModel,
      input.monthlyRevenue,
      input.maintenanceHoursMonthly,
      input.nextAction,
      timestamp,
      timestamp
    );
    return this.requireAsset(id);
  }

  createDailyReport(raw: DailyReportInput, id = randomUUID()): DailyReport {
    const input = dailyReportInputSchema.parse(raw);
    input.opportunityIds.forEach((opportunityId) => this.requireOpportunity(opportunityId));
    const timestamp = now();
    const insert = this.connection.transaction(() => {
      this.connection.prepare(`
        INSERT INTO daily_reports (id, report_date, title, summary, generated_by, is_demo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(report_date) DO UPDATE SET
          title = excluded.title,
          summary = excluded.summary,
          generated_by = excluded.generated_by,
          is_demo = excluded.is_demo,
          created_at = excluded.created_at
      `).run(id, input.reportDate, input.title, input.summary, input.generatedBy, input.isDemo ? 1 : 0, timestamp);

      const reportRow = this.connection.prepare("SELECT id FROM daily_reports WHERE report_date = ?").get(input.reportDate) as { id: string };
      this.connection.prepare("DELETE FROM daily_report_opportunities WHERE report_id = ?").run(reportRow.id);
      const link = this.connection.prepare("INSERT INTO daily_report_opportunities (report_id, opportunity_id, rank) VALUES (?, ?, ?)");
      input.opportunityIds.forEach((opportunityId, index) => link.run(reportRow.id, opportunityId, index + 1));
    });
    insert();
    return this.getReportByDate(input.reportDate)!;
  }

  getLatestDailyReport(): DailyReport | null {
    const row = this.connection.prepare("SELECT * FROM daily_reports ORDER BY report_date DESC, created_at DESC LIMIT 1").get() as Row | undefined;
    return row ? this.hydrateDailyReport(row) : null;
  }

  getReportByDate(reportDate: string): DailyReport | null {
    const row = this.connection.prepare("SELECT * FROM daily_reports WHERE report_date = ?").get(reportDate) as Row | undefined;
    return row ? this.hydrateDailyReport(row) : null;
  }

  createCodexRun(input: {
    taskId: string;
    projectId?: string | null;
    mode: "demo" | "live";
    workingDirectory?: string | null;
    promptSnapshot: string;
  }, id = randomUUID()): CodexRun {
    this.requireTask(input.taskId);
    if (input.projectId) this.requireProject(input.projectId);
    const timestamp = now();
    this.connection.prepare(`
      INSERT INTO codex_runs (
        id, project_id, task_id, thread_id, status, mode, working_directory,
        prompt_snapshot, artifact_paths, requires_human_review, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, 'queued', ?, ?, ?, '[]', 1, ?, ?)
    `).run(
      id,
      input.projectId ?? null,
      input.taskId,
      input.mode,
      input.workingDirectory ?? null,
      input.promptSnapshot,
      timestamp,
      timestamp
    );
    return this.requireRun(id);
  }

  updateCodexRun(id: string, patch: Partial<Pick<CodexRun, "threadId" | "status" | "finalResponse" | "artifactPaths" | "verificationSummary" | "errorMessage" | "requiresHumanReview" | "startedAt" | "completedAt">>): CodexRun {
    const current = this.requireRun(id);
    const next = { ...current, ...patch, updatedAt: now() };
    this.connection.prepare(`
      UPDATE codex_runs SET
        thread_id = ?, status = ?, final_response = ?, artifact_paths = ?,
        verification_summary = ?, error_message = ?, requires_human_review = ?,
        started_at = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      next.threadId,
      next.status,
      next.finalResponse,
      JSON.stringify(next.artifactPaths),
      next.verificationSummary,
      next.errorMessage,
      next.requiresHumanReview ? 1 : 0,
      next.startedAt,
      next.completedAt,
      next.updatedAt,
      id
    );
    return this.requireRun(id);
  }

  listCodexRuns(limit = 50): CodexRun[] {
    return (this.connection.prepare("SELECT * FROM codex_runs ORDER BY created_at DESC LIMIT ?").all(limit) as Row[]).map(mapRun);
  }

  findLatestThreadForProject(projectId: string): string | null {
    const row = this.connection.prepare(`
      SELECT thread_id FROM codex_runs
      WHERE project_id = ? AND thread_id IS NOT NULL
      ORDER BY updated_at DESC LIMIT 1
    `).get(projectId) as { thread_id: string } | undefined;
    return row?.thread_id ?? null;
  }

  appendCodexRunEvent(runId: string, eventType: string, message: string): { id: string; runId: string; eventType: string; message: string; createdAt: string } {
    this.requireRun(runId);
    const event = { id: randomUUID(), runId, eventType, message, createdAt: now() };
    this.connection.prepare("INSERT INTO codex_run_events (id, run_id, event_type, message, created_at) VALUES (?, ?, ?, ?, ?)").run(
      event.id,
      event.runId,
      event.eventType,
      event.message,
      event.createdAt
    );
    return event;
  }

  listCodexRunEvents(runId: string): Array<{ id: string; runId: string; eventType: string; message: string; createdAt: string }> {
    this.requireRun(runId);
    const rows = this.connection.prepare("SELECT * FROM codex_run_events WHERE run_id = ? ORDER BY created_at").all(runId) as Row[];
    return rows.map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      eventType: String(row.event_type),
      message: String(row.message),
      createdAt: String(row.created_at)
    }));
  }

  getCodexRun(id: string): CodexRun | null {
    const row = this.connection.prepare("SELECT * FROM codex_runs WHERE id = ?").get(id) as Row | undefined;
    return row ? mapRun(row) : null;
  }

  getDashboard(): {
    projects: Project[];
    focusTasks: Task[];
    taskCounts: Record<TaskStatus, number>;
    opportunities: Opportunity[];
    experiments: Experiment[];
    assets: IncomeAsset[];
    runs: CodexRun[];
    latestReport: DailyReport | null;
    metrics: { activeProjects: number; openLoops: number; monthlyRevenue: number; lowTouchRevenue: number; maintenanceHours: number };
  } {
    const projects = this.listProjects();
    const tasks = this.listTasks();
    const opportunities = this.listOpportunities().filter((item) => ["candidate", "shortlisted"].includes(item.status)).sort((a, b) => b.score - a.score).slice(0, 5);
    const experiments = this.listExperiments();
    const assets = this.listAssets();
    const taskCounts = Object.fromEntries(
      ["inbox", "ready", "in_progress", "needs_review", "done", "blocked"].map((status) => [status, tasks.filter((task) => task.status === status).length])
    ) as Record<TaskStatus, number>;

    return {
      projects,
      focusTasks: tasks.filter((task) => !["done"].includes(task.status)).slice(0, 6),
      taskCounts,
      opportunities,
      experiments,
      assets,
      runs: this.listCodexRuns(8),
      latestReport: this.getLatestDailyReport(),
      metrics: {
        activeProjects: projects.filter((project) => project.status === "active").length,
        openLoops: tasks.filter((task) => task.status !== "done").length,
        monthlyRevenue: projects.reduce((sum, project) => sum + (project.actualRevenue ?? 0), 0),
        lowTouchRevenue: assets.reduce((sum, asset) => sum + asset.monthlyRevenue, 0),
        maintenanceHours: assets.reduce((sum, asset) => sum + asset.maintenanceHoursMonthly, 0)
      }
    };
  }

  seedDemoData(): void {
    const existing = this.connection.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number };
    if (existing.count > 0) return;

    const projectId = "11111111-1111-4111-8111-111111111111";
    const assetProjectId = "22222222-2222-4222-8222-222222222222";
    const opportunityId = "33333333-3333-4333-8333-333333333333";
    const opportunityTwoId = "44444444-4444-4444-8444-444444444444";

    this.createProject({
      name: "客户交付自动化",
      lane: "cash_now",
      status: "active",
      outcome: "交付当前客户门户，并沉淀一份可复用的发布检查清单。",
      nextAction: "核对 API 集成的验收条件。",
      deadline: "2026-08-01",
      expectedRevenue: 180000,
      actualRevenue: 90000,
      repositoryPath: "/path/to/client-project",
      obsidianPath: "Projects/Client delivery automation.md"
    }, projectId);

    this.createProject({
      name: "可复用客户周报工具包",
      lane: "assets",
      status: "active",
      outcome: "通过一个真实付费用户验证可复用的周报产品。",
      nextAction: "向三个现有联系人展示私有 Demo。",
      deadline: "2026-08-12",
      expectedRevenue: 30000,
      actualRevenue: 0,
      repositoryPath: "/path/to/reporting-kit",
      obsidianPath: "Assets/Reporting kit.md"
    }, assetProjectId);

    this.createTask({
      projectId,
      title: "验证客户数据导出流程",
      description: "运行集成测试，并记录 CSV 导出与规格不一致的地方。",
      status: "ready",
      delegationMode: "codex_ready",
      priority: "critical",
      dueDate: "2026-07-29",
      acceptanceCriteria: ["集成测试通过", "导出字段与客户规格一致"]
    }, "55555555-5555-4555-8555-555555555555");

    this.createTask({
      projectId: assetProjectId,
      title: "准备周报工具包验证页面",
      description: "只使用已经确认的能力，制作一页简洁的验证页面。",
      status: "in_progress",
      delegationMode: "mixed",
      priority: "high",
      dueDate: "2026-07-31",
      acceptanceCriteria: ["价值主张具体", "意向表单可用"]
    }, "66666666-6666-4666-8666-666666666666");

    this.createTask({
      projectId: null,
      title: "整理 Inbox 中的三条零散记录",
      description: "把每条记录归入项目、收入资产候选，或者归档。",
      status: "inbox",
      delegationMode: "human_only",
      priority: "medium",
      dueDate: null,
      acceptanceCriteria: []
    }, "77777777-7777-4777-8777-777777777777");

    this.createOpportunity({
      title: "客户项目状态自动周报",
      payer: "持续承接客户项目的小型软件工作室",
      pain: "每周都要手工从任务、提交和部署记录中整理客户报告。",
      summary: "验证一次性配置费加低维护月度服务的标准化方案。",
      businessModel: "一次性配置费加月度订阅",
      confidence: 68,
      personalFit: 91,
      validationEffortHours: 2,
      validationBudget: 0,
      timeToRevenue: "可能在 7-14 天内",
      recurringPotential: 82,
      maintenanceHoursMonthly: 2,
      hypothesis: "十家目标工作室中至少两家会要求查看可用样例。",
      minimalExperiment: "生成一份真实样例，展示给十位目标工作室经营者，在开发产品前询问是否愿意参加付费试点。",
      successCondition: "七天内获得两次有效沟通，或一个付费试点。",
      stopCondition: "与十位相关对象沟通后仍无有效反馈。",
      status: "shortlisted",
      isDemo: true,
      evidence: [
        {
          label: "演示用买家信号",
          sourceUrl: "https://example.com/demo-agency-reporting-signal",
          type: "fact",
          summary: "这是一条用于界面验收的样例证据，采取行动前必须替换为真实来源。"
        },
        {
          label: "持续服务模式推断",
          sourceUrl: "https://example.com/demo-recurring-model",
          type: "inference",
          summary: "订阅收费只是待验证假设，仍然需要真实客户反馈。"
        }
      ]
    }, opportunityId);

    this.createOpportunity({
      title: "AI 编码仓库接入审计",
      payer: "正在采用 AI 编码代理的小型团队",
      pain: "代码仓库缺少简洁的代理指令、测试命令和安全执行边界。",
      summary: "验证一项标准化审计服务，交付 AGENTS.md、工作流 Skill 和实施清单。",
      businessModel: "固定范围审计加可选维护服务",
      confidence: 62,
      personalFit: 87,
      validationEffortHours: 3,
      validationBudget: 0,
      timeToRevenue: "可能在 14 天内",
      recurringPotential: 58,
      maintenanceHoursMonthly: 1,
      hypothesis: "五位已有联系的人中至少一位愿意购买仓库审计。",
      minimalExperiment: "制作一个匿名的改造前后样例，向五位已有联系人提供付费审计名额。",
      successCondition: "一个付费审计，或两次明确的购买沟通。",
      stopCondition: "五次相关报价后仍没有购买沟通。",
      status: "candidate",
      isDemo: true,
      evidence: [
        {
          label: "演示用工作流缺口",
          sourceUrl: "https://example.com/demo-agent-guidance-gap",
          type: "fact",
          summary: "这是一条用于界面验收的样例证据，开始测试前必须核对真实来源。"
        }
      ]
    }, opportunityTwoId);

    const experiment = this.createExperimentFromOpportunity(opportunityId, {
      title: "周报试点验证",
      status: "preparing",
      deadline: "2026-08-04"
    });

    this.createAsset({
      projectId: assetProjectId,
      experimentId: experiment.id,
      name: "客户周报工具包",
      stage: "experiment",
      revenueModel: "一次性配置费加月度订阅",
      monthlyRevenue: 12000,
      maintenanceHoursMonthly: 2,
      nextAction: "完成三次真实需求验证沟通。"
    });

    this.createDailyReport({
      reportDate: "2026-07-28",
      title: "机会雷达日报",
      summary: "两个演示机会与当前技术画像匹配。完整开发前先验证真实付费意愿。",
      generatedBy: "demo",
      opportunityIds: [opportunityId, opportunityTwoId],
      isDemo: true
    });
  }

  private hydrateOpportunity(row: Row): Opportunity {
    const evidence = (this.connection.prepare("SELECT * FROM opportunity_evidence WHERE opportunity_id = ? ORDER BY rowid").all(String(row.id)) as Row[]).map(mapEvidence);
    const input = {
      title: String(row.title),
      payer: String(row.payer),
      pain: String(row.pain),
      summary: String(row.summary),
      businessModel: String(row.business_model),
      confidence: Number(row.confidence),
      personalFit: Number(row.personal_fit),
      validationEffortHours: Number(row.validation_effort_hours),
      validationBudget: Number(row.validation_budget),
      timeToRevenue: String(row.time_to_revenue),
      recurringPotential: Number(row.recurring_potential),
      maintenanceHoursMonthly: Number(row.maintenance_hours_monthly),
      hypothesis: String(row.hypothesis),
      minimalExperiment: String(row.minimal_experiment),
      successCondition: String(row.success_condition),
      stopCondition: String(row.stop_condition),
      status: row.status as Opportunity["status"],
      isDemo: booleanFromDb(row.is_demo)
    };
    return {
      id: String(row.id),
      ...input,
      evidence,
      score: calculateOpportunityScore(input),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }

  private hydrateDailyReport(row: Row): DailyReport {
    const opportunityRows = this.connection.prepare(`
      SELECT opportunities.*
      FROM daily_report_opportunities
      JOIN opportunities ON opportunities.id = daily_report_opportunities.opportunity_id
      WHERE daily_report_opportunities.report_id = ?
      ORDER BY daily_report_opportunities.rank
    `).all(String(row.id)) as Row[];
    const opportunities = opportunityRows.map((opportunityRow) => this.hydrateOpportunity(opportunityRow));
    return {
      id: String(row.id),
      reportDate: String(row.report_date),
      title: String(row.title),
      summary: String(row.summary),
      generatedBy: row.generated_by as DailyReport["generatedBy"],
      opportunityIds: opportunities.map((opportunity) => opportunity.id),
      opportunities,
      isDemo: booleanFromDb(row.is_demo),
      createdAt: String(row.created_at)
    };
  }

  private requireProject(id: string): Project {
    const project = this.getProject(id);
    if (!project) throw new Error(`Project not found: ${id}`);
    return project;
  }

  private requireTask(id: string): Task {
    const task = this.getTask(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return task;
  }

  private requireOpportunity(id: string): Opportunity {
    const opportunity = this.getOpportunity(id);
    if (!opportunity) throw new Error(`Opportunity not found: ${id}`);
    return opportunity;
  }

  private requireExperiment(id: string): Experiment {
    const experiment = this.getExperiment(id);
    if (!experiment) throw new Error(`Experiment not found: ${id}`);
    return experiment;
  }

  private requireAsset(id: string): IncomeAsset {
    const row = this.connection.prepare("SELECT * FROM income_assets WHERE id = ?").get(id) as Row | undefined;
    if (!row) throw new Error(`Income asset not found: ${id}`);
    return mapAsset(row);
  }

  private requireRun(id: string): CodexRun {
    const run = this.getCodexRun(id);
    if (!run) throw new Error(`Codex run not found: ${id}`);
    return run;
  }
}

export function createDatabase(filePath = process.env.DATABASE_PATH ?? "./data/personal-os.db", seed = true): PersonalOsDatabase {
  return new PersonalOsDatabase({ filePath, seed });
}
