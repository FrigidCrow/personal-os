import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import {
  agentRunEventTypeSchema,
  approvalRequestInputSchema,
  assertAgentRunTransition,
  assertTaskTransition,
  calculateOpportunityScore,
  dailyReportInputSchema,
  experimentInputSchema,
  incomeAssetInputSchema,
  opportunityInputSchema,
  projectInputSchema,
  taskInputSchema,
  type AgentExecutor,
  type AgentRun,
  type AgentRunEvent,
  type AgentRunEventType,
  type AgentRunStatus,
  type ApprovalRequest,
  type ApprovalStatus,
  type CodexRun,
  type CodexRunEvent,
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
  type TaskCreateInput,
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

function nullableJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return JSON.parse(value) as Record<string, unknown>;
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
    taskType: row.task_type as Task["taskType"],
    executor: row.executor as Task["executor"],
    executionMode: row.execution_mode as Task["executionMode"],
    triggerType: row.trigger_type as Task["triggerType"],
    triggerConfig: nullableJson(row.trigger_config),
    triggerTimezone: String(row.trigger_timezone),
    riskLevel: row.risk_level as Task["riskLevel"],
    maxAttempts: Number(row.max_attempts),
    nextRunAt: nullableString(row.next_run_at),
    lastScheduledAt: nullableString(row.last_scheduled_at),
    automationPaused: booleanFromDb(row.automation_paused),
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

function mapAgentRun(row: Row): AgentRun {
  return {
    id: String(row.id),
    projectId: nullableString(row.project_id),
    taskId: String(row.task_id),
    executor: row.executor as AgentExecutor,
    externalSessionId: nullableString(row.external_session_id),
    status: row.status as AgentRunStatus,
    mode: row.mode as AgentRun["mode"],
    attempt: Number(row.attempt),
    idempotencyKey: String(row.idempotency_key),
    promptSnapshot: String(row.prompt_snapshot),
    workingDirectory: nullableString(row.working_directory),
    finalResponse: nullableString(row.final_response),
    artifactPaths: JSON.parse(String(row.artifact_paths)) as string[],
    verificationSummary: nullableString(row.verification_summary),
    errorMessage: nullableString(row.error_message),
    requiresHumanReview: booleanFromDb(row.requires_human_review),
    claimedAt: nullableString(row.claimed_at),
    leaseExpiresAt: nullableString(row.lease_expires_at),
    heartbeatAt: nullableString(row.heartbeat_at),
    startedAt: nullableString(row.started_at),
    completedAt: nullableString(row.completed_at),
    nextRetryAt: nullableString(row.next_retry_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toCodexRun(run: AgentRun): CodexRun {
  return {
    id: run.id,
    projectId: run.projectId,
    taskId: run.taskId,
    threadId: run.externalSessionId,
    status: run.status,
    mode: run.mode,
    workingDirectory: run.workingDirectory,
    promptSnapshot: run.promptSnapshot,
    finalResponse: run.finalResponse,
    artifactPaths: run.artifactPaths,
    verificationSummary: run.verificationSummary,
    errorMessage: run.errorMessage,
    requiresHumanReview: run.requiresHumanReview,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt
  };
}

function mapAgentRunEvent(row: Row): AgentRunEvent {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    eventType: row.event_type as AgentRunEventType,
    message: String(row.message),
    createdAt: String(row.created_at)
  };
}

function mapApprovalRequest(row: Row): ApprovalRequest {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    actionType: row.action_type as ApprovalRequest["actionType"],
    destination: String(row.destination),
    summary: String(row.summary),
    payloadPreview: nullableString(row.payload_preview),
    status: row.status as ApprovalStatus,
    expiresAt: nullableString(row.expires_at),
    resolvedAt: nullableString(row.resolved_at),
    createdAt: String(row.created_at)
  };
}

export interface PersonalOsDatabaseOptions {
  filePath: string;
  seed?: boolean;
  clock?: () => Date;
}

export class PersonalOsDatabase {
  readonly connection: Sqlite;
  private readonly clock: () => Date;

  constructor(options: PersonalOsDatabaseOptions) {
    this.clock = options.clock ?? (() => new Date());
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

  private timestamp(): string {
    return this.clock().toISOString();
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
        task_type TEXT NOT NULL DEFAULT 'other',
        executor TEXT NOT NULL DEFAULT 'human',
        execution_mode TEXT NOT NULL DEFAULT 'manual',
        trigger_type TEXT NOT NULL DEFAULT 'manual',
        trigger_config TEXT,
        trigger_timezone TEXT NOT NULL DEFAULT 'UTC',
        risk_level TEXT NOT NULL DEFAULT 'medium',
        max_attempts INTEGER NOT NULL DEFAULT 1,
        next_run_at TEXT,
        last_scheduled_at TEXT,
        automation_paused INTEGER NOT NULL DEFAULT 0,
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

    this.ensureColumn("tasks", "task_type", "TEXT NOT NULL DEFAULT 'other'");
    this.ensureColumn("tasks", "executor", "TEXT NOT NULL DEFAULT 'human'");
    this.ensureColumn("tasks", "execution_mode", "TEXT NOT NULL DEFAULT 'manual'");
    this.ensureColumn("tasks", "trigger_type", "TEXT NOT NULL DEFAULT 'manual'");
    this.ensureColumn("tasks", "trigger_config", "TEXT");
    this.ensureColumn("tasks", "trigger_timezone", "TEXT NOT NULL DEFAULT 'UTC'");
    this.ensureColumn("tasks", "risk_level", "TEXT NOT NULL DEFAULT 'medium'");
    this.ensureColumn("tasks", "max_attempts", "INTEGER NOT NULL DEFAULT 1");
    this.ensureColumn("tasks", "next_run_at", "TEXT");
    this.ensureColumn("tasks", "last_scheduled_at", "TEXT");
    this.ensureColumn("tasks", "automation_paused", "INTEGER NOT NULL DEFAULT 0");

    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        executor TEXT NOT NULL CHECK (executor IN ('codex', 'openworker')),
        external_session_id TEXT,
        status TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'live',
        attempt INTEGER NOT NULL DEFAULT 1,
        idempotency_key TEXT NOT NULL UNIQUE,
        prompt_snapshot TEXT NOT NULL,
        working_directory TEXT,
        final_response TEXT,
        artifact_paths TEXT NOT NULL DEFAULT '[]',
        verification_summary TEXT,
        error_message TEXT,
        requires_human_review INTEGER NOT NULL DEFAULT 1,
        claimed_at TEXT,
        lease_expires_at TEXT,
        heartbeat_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        next_retry_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_run_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS approval_requests (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL,
        destination TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_preview TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        expires_at TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO agent_runs (
        id, project_id, task_id, executor, external_session_id, status, mode,
        attempt, idempotency_key, prompt_snapshot, working_directory,
        final_response, artifact_paths, verification_summary, error_message,
        requires_human_review, started_at, completed_at, created_at, updated_at
      )
      SELECT
        id, project_id, task_id, 'codex', thread_id, status, mode,
        1, 'legacy-codex:' || id, prompt_snapshot, working_directory,
        final_response, artifact_paths, verification_summary, error_message,
        requires_human_review, started_at, completed_at, created_at, updated_at
      FROM codex_runs;

      INSERT OR IGNORE INTO agent_run_events (id, run_id, event_type, message, created_at)
      SELECT id, run_id,
        CASE
          WHEN event_type IN (
            'queued', 'claimed', 'running', 'heartbeat', 'tool_request',
            'approval_requested', 'approval_resolved', 'artifact_saved',
            'verification', 'needs_review', 'failed', 'cancelled'
          ) THEN event_type
          ELSE 'verification'
        END,
        message,
        created_at
      FROM codex_run_events;

      -- OpenWorker has never had a deterministic demo adapter: every queued
      -- OpenWorker run is consumed by the external process over MCP. Repair
      -- records created before the dispatcher enforced that invariant.
      UPDATE agent_runs SET mode = 'live'
      WHERE executor = 'openworker' AND mode = 'demo';

      CREATE INDEX IF NOT EXISTS idx_agent_runs_task ON agent_runs(task_id);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_executor_status ON agent_runs(executor, status);
      CREATE INDEX IF NOT EXISTS idx_agent_run_events_run ON agent_run_events(run_id);
      CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
    `);
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.connection.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((item) => item.name === column)) {
      this.connection.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
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

  createTask(raw: TaskCreateInput, id = randomUUID()): Task {
    const input = taskInputSchema.parse(raw);
    if (input.projectId) this.requireProject(input.projectId);
    const timestamp = now();
    this.connection.prepare(`
      INSERT INTO tasks (
        id, project_id, title, description, status, delegation_mode, priority,
        due_date, acceptance_criteria, task_type, executor, execution_mode,
        trigger_type, trigger_config, trigger_timezone, risk_level, max_attempts,
        next_run_at, last_scheduled_at, automation_paused, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      input.taskType,
      input.executor,
      input.executionMode,
      input.triggerType,
      input.triggerConfig ? JSON.stringify(input.triggerConfig) : null,
      input.triggerTimezone,
      input.riskLevel,
      input.maxAttempts,
      input.nextRunAt ?? null,
      input.lastScheduledAt ?? null,
      input.automationPaused ? 1 : 0,
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
        priority = ?, due_date = ?, acceptance_criteria = ?, task_type = ?, executor = ?,
        execution_mode = ?, trigger_type = ?, trigger_config = ?, trigger_timezone = ?,
        risk_level = ?, max_attempts = ?, next_run_at = ?, last_scheduled_at = ?,
        automation_paused = ?, updated_at = ?
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
      input.taskType,
      input.executor,
      input.executionMode,
      input.triggerType,
      input.triggerConfig ? JSON.stringify(input.triggerConfig) : null,
      input.triggerTimezone,
      input.riskLevel,
      input.maxAttempts,
      input.nextRunAt ?? null,
      input.lastScheduledAt ?? null,
      input.automationPaused ? 1 : 0,
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

  prepareTaskForAutomation(id: string): Task {
    const task = this.requireTask(id);
    if (task.executionMode !== "automatic" || task.triggerType === "manual") {
      throw new Error("Only triggered automatic tasks can be prepared for another run.");
    }
    if (task.status === "ready") return task;
    if (task.status !== "done") throw new Error(`Task cannot be prepared for automation from status: ${task.status}`);
    if (this.getActiveRunForTask(id)) throw new Error("Active run already exists for task.");
    const timestamp = this.timestamp();
    this.connection.prepare("UPDATE tasks SET status = 'ready', updated_at = ? WHERE id = ?").run(timestamp, id);
    return this.requireTask(id);
  }

  operationalHealth(asOf = this.timestamp()): {
    database: "ok" | "error";
    quickCheck: string;
    foreignKeyViolations: number;
    activeRuns: number;
    staleRuns: number;
    pendingApprovals: number;
    checkedAt: string;
  } {
    const quickCheck = String((this.connection.pragma("quick_check", { simple: true }) as string | undefined) ?? "error");
    const foreignKeyViolations = (this.connection.pragma("foreign_key_check") as unknown[]).length;
    const activeRuns = Number((this.connection.prepare(`
      SELECT COUNT(*) AS count FROM agent_runs WHERE status IN ('queued', 'claimed', 'running', 'awaiting_approval')
    `).get() as { count: number }).count);
    const staleRuns = Number((this.connection.prepare(`
      SELECT COUNT(*) AS count FROM agent_runs
      WHERE status IN ('claimed', 'running', 'awaiting_approval') AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
    `).get(asOf) as { count: number }).count);
    const pendingApprovals = Number((this.connection.prepare("SELECT COUNT(*) AS count FROM approval_requests WHERE status = 'pending'").get() as { count: number }).count);
    return {
      database: quickCheck === "ok" && foreignKeyViolations === 0 ? "ok" : "error",
      quickCheck,
      foreignKeyViolations,
      activeRuns,
      staleRuns,
      pendingApprovals,
      checkedAt: asOf
    };
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

  updateExperiment(id: string, raw: ExperimentInput): Experiment {
    const input = experimentInputSchema.parse(raw);
    this.requireExperiment(id);
    if (input.opportunityId) this.requireOpportunity(input.opportunityId);
    this.connection.prepare(`
      UPDATE experiments SET
        opportunity_id = ?, title = ?, hypothesis = ?, status = ?, time_cap_hours = ?,
        budget_cap = ?, deadline = ?, success_condition = ?, stop_condition = ?,
        result_summary = ?, updated_at = ?
      WHERE id = ?
    `).run(
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
      now(),
      id
    );
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

  listDailyReports(limit = 14): DailyReport[] {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 90));
    const rows = this.connection.prepare("SELECT * FROM daily_reports ORDER BY report_date DESC, created_at DESC LIMIT ?").all(safeLimit) as Row[];
    return rows.map((row) => this.hydrateDailyReport(row));
  }

  getReportByDate(reportDate: string): DailyReport | null {
    const row = this.connection.prepare("SELECT * FROM daily_reports WHERE report_date = ?").get(reportDate) as Row | undefined;
    return row ? this.hydrateDailyReport(row) : null;
  }

  createAgentRun(input: {
    taskId: string;
    projectId?: string | null;
    executor: AgentExecutor;
    mode?: "demo" | "live";
    workingDirectory?: string | null;
    promptSnapshot: string;
    idempotencyKey: string;
    attempt?: number;
  }, id = randomUUID()): AgentRun {
    const task = this.requireTask(input.taskId);
    if (input.projectId) this.requireProject(input.projectId);
    if (input.idempotencyKey.trim().length === 0) throw new Error("Idempotency key is required");
    const timestamp = this.timestamp();
    const create = this.connection.transaction(() => {
      const duplicate = this.connection.prepare("SELECT id FROM agent_runs WHERE idempotency_key = ?").get(input.idempotencyKey) as { id: string } | undefined;
      if (duplicate) throw new Error(`Duplicate idempotency key: ${input.idempotencyKey}`);
      const active = this.connection.prepare(`
        SELECT id FROM agent_runs
        WHERE task_id = ? AND status IN ('queued', 'claimed', 'running', 'awaiting_approval')
        LIMIT 1
      `).get(input.taskId) as { id: string } | undefined;
      if (active) throw new Error(`Active run already exists for task: ${input.taskId}`);
      this.connection.prepare(`
        INSERT INTO agent_runs (
          id, project_id, task_id, executor, status, mode, attempt,
          idempotency_key, prompt_snapshot, working_directory, artifact_paths,
          requires_human_review, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, '[]', 1, ?, ?)
      `).run(
        id,
        input.projectId ?? task.projectId ?? null,
        input.taskId,
        input.executor,
        input.mode ?? "live",
        input.attempt ?? 1,
        input.idempotencyKey,
        input.promptSnapshot,
        input.workingDirectory ?? null,
        timestamp,
        timestamp
      );
      this.insertAgentRunEvent(id, "queued", `Task queued for ${input.executor}.`, timestamp);
    });
    create.immediate();
    return this.requireAgentRun(id);
  }

  updateAgentRun(id: string, patch: Partial<Pick<AgentRun,
    "externalSessionId" | "status" | "finalResponse" | "artifactPaths" |
    "verificationSummary" | "errorMessage" | "requiresHumanReview" |
    "claimedAt" | "leaseExpiresAt" | "heartbeatAt" | "startedAt" |
    "completedAt" | "nextRetryAt"
  >>): AgentRun {
    const current = this.requireAgentRun(id);
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    ) as typeof patch;
    if (definedPatch.status && definedPatch.status !== current.status) {
      assertAgentRunTransition(current.status, definedPatch.status);
    }
    const next = { ...current, ...definedPatch, updatedAt: this.timestamp() };
    this.connection.prepare(`
      UPDATE agent_runs SET
        external_session_id = ?, status = ?, final_response = ?, artifact_paths = ?,
        verification_summary = ?, error_message = ?, requires_human_review = ?,
        claimed_at = ?, lease_expires_at = ?, heartbeat_at = ?, started_at = ?,
        completed_at = ?, next_retry_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      next.externalSessionId,
      next.status,
      next.finalResponse,
      JSON.stringify(next.artifactPaths),
      next.verificationSummary,
      next.errorMessage,
      next.requiresHumanReview ? 1 : 0,
      next.claimedAt,
      next.leaseExpiresAt,
      next.heartbeatAt,
      next.startedAt,
      next.completedAt,
      next.nextRetryAt,
      next.updatedAt,
      id
    );
    return this.requireAgentRun(id);
  }

  listAgentRuns(filters: { executor?: AgentExecutor; status?: AgentRunStatus; limit?: number } = {}): AgentRun[] {
    const clauses: string[] = [];
    const values: Array<string | number> = [];
    if (filters.executor) {
      clauses.push("executor = ?");
      values.push(filters.executor);
    }
    if (filters.status) {
      clauses.push("status = ?");
      values.push(filters.status);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    values.push(filters.limit ?? 50);
    return (this.connection.prepare(`SELECT * FROM agent_runs ${where} ORDER BY created_at DESC LIMIT ?`).all(...values) as Row[]).map(mapAgentRun);
  }

  getAgentRun(id: string): AgentRun | null {
    const row = this.connection.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as Row | undefined;
    return row ? mapAgentRun(row) : null;
  }

  getActiveRunForTask(taskId: string): AgentRun | null {
    const row = this.connection.prepare(`
      SELECT * FROM agent_runs
      WHERE task_id = ? AND status IN ('queued', 'claimed', 'running', 'awaiting_approval')
      ORDER BY created_at DESC LIMIT 1
    `).get(taskId) as Row | undefined;
    return row ? mapAgentRun(row) : null;
  }

  listClaimableRuns(executor: AgentExecutor): AgentRun[] {
    return (this.connection.prepare(`
      SELECT agent_runs.* FROM agent_runs
      JOIN tasks ON tasks.id = agent_runs.task_id
      WHERE agent_runs.executor = ? AND agent_runs.status = 'queued'
        AND tasks.status = 'ready' AND tasks.automation_paused = 0
      ORDER BY agent_runs.created_at
    `).all(executor) as Row[]).map(mapAgentRun);
  }

  claimAgentRun(runId: string, leaseMilliseconds = 120_000): AgentRun {
    if (!Number.isFinite(leaseMilliseconds) || leaseMilliseconds <= 0) throw new Error("Lease duration must be positive");
    const claimedAt = this.timestamp();
    const leaseExpiresAt = new Date(this.clock().getTime() + leaseMilliseconds).toISOString();
    const claim = this.connection.transaction(() => {
      const result = this.connection.prepare(`
        UPDATE agent_runs
        SET status = 'claimed', claimed_at = ?, heartbeat_at = ?, lease_expires_at = ?, updated_at = ?
        WHERE id = ? AND status = 'queued'
      `).run(claimedAt, claimedAt, leaseExpiresAt, claimedAt, runId);
      if (result.changes !== 1) {
        const current = this.getAgentRun(runId);
        if (!current) throw new Error(`Agent run not found: ${runId}`);
        throw new Error(`Run cannot be claimed from status: ${current.status}`);
      }
      const run = this.requireAgentRun(runId);
      const task = this.requireTask(run.taskId);
      if (task.status === "ready") {
        this.connection.prepare("UPDATE tasks SET status = 'in_progress', updated_at = ? WHERE id = ?").run(claimedAt, task.id);
      } else if (task.status !== "in_progress") {
        throw new Error(`Task cannot be claimed from status: ${task.status}`);
      }
      this.insertAgentRunEvent(runId, "claimed", `Lease acquired until ${leaseExpiresAt}.`, claimedAt);
    });
    claim.immediate();
    return this.requireAgentRun(runId);
  }

  heartbeatAgentRun(runId: string, leaseMilliseconds = 120_000): AgentRun {
    if (!Number.isFinite(leaseMilliseconds) || leaseMilliseconds <= 0) throw new Error("Lease duration must be positive");
    const heartbeatAt = this.timestamp();
    const leaseExpiresAt = new Date(this.clock().getTime() + leaseMilliseconds).toISOString();
    const result = this.connection.prepare(`
      UPDATE agent_runs
      SET heartbeat_at = ?, lease_expires_at = ?, updated_at = ?
      WHERE id = ? AND status IN ('claimed', 'running', 'awaiting_approval')
        AND lease_expires_at IS NOT NULL AND lease_expires_at >= ?
    `).run(heartbeatAt, leaseExpiresAt, heartbeatAt, runId, heartbeatAt);
    if (result.changes !== 1) {
      const current = this.getAgentRun(runId);
      if (!current) throw new Error(`Agent run not found: ${runId}`);
      throw new Error(`Run lease is not active: ${current.status}`);
    }
    this.insertAgentRunEvent(runId, "heartbeat", `Lease extended until ${leaseExpiresAt}.`, heartbeatAt);
    return this.requireAgentRun(runId);
  }

  cancelAgentRun(runId: string): AgentRun {
    const run = this.requireAgentRun(runId);
    if (!(["queued", "claimed"] as AgentRunStatus[]).includes(run.status)) {
      throw new Error(`Only an unstarted run can be cancelled: ${run.status}`);
    }
    const timestamp = this.timestamp();
    const cancel = this.connection.transaction(() => {
      this.connection.prepare(`
        UPDATE agent_runs
        SET status = 'cancelled', completed_at = ?, lease_expires_at = NULL, updated_at = ?
        WHERE id = ?
      `).run(timestamp, timestamp, runId);
      const task = this.requireTask(run.taskId);
      if (task.status === "in_progress") {
        this.connection.prepare("UPDATE tasks SET status = 'ready', updated_at = ? WHERE id = ?").run(timestamp, task.id);
      }
      this.insertAgentRunEvent(runId, "cancelled", "The queued run was cancelled by the user.", timestamp);
    });
    cancel.immediate();
    return this.requireAgentRun(runId);
  }

  recordAgentRunFailure(runId: string, message: string, retryDelayMilliseconds = 30_000): AgentRun {
    const run = this.requireAgentRun(runId);
    if (!(["queued", "claimed", "running", "awaiting_approval"] as AgentRunStatus[]).includes(run.status)) {
      throw new Error(`Run cannot fail from status: ${run.status}`);
    }
    const task = this.requireTask(run.taskId);
    const timestamp = this.timestamp();
    const retryable = run.attempt < task.maxAttempts;
    const nextRetryAt = retryable ? new Date(this.clock().getTime() + retryDelayMilliseconds).toISOString() : null;
    const fail = this.connection.transaction(() => {
      this.connection.prepare(`
        UPDATE agent_runs
        SET status = 'failed', error_message = ?, completed_at = ?, next_retry_at = ?,
            lease_expires_at = NULL, updated_at = ?
        WHERE id = ?
      `).run(message, timestamp, nextRetryAt, timestamp, runId);
      if (retryable && task.status === "in_progress") {
        this.connection.prepare("UPDATE tasks SET status = 'ready', updated_at = ? WHERE id = ?").run(timestamp, task.id);
      } else if (!retryable && task.status !== "blocked") {
        this.connection.prepare("UPDATE tasks SET status = 'blocked', updated_at = ? WHERE id = ?").run(timestamp, task.id);
      }
      this.insertAgentRunEvent(runId, "failed", retryable ? `${message} Retry scheduled for ${nextRetryAt}.` : `${message} Maximum attempts reached.`, timestamp);
    });
    fail.immediate();
    return this.requireAgentRun(runId);
  }

  listRetryableAgentRuns(asOf = this.timestamp()): AgentRun[] {
    return (this.connection.prepare(`
      SELECT * FROM agent_runs
      WHERE status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= ?
      ORDER BY next_retry_at
    `).all(asOf) as Row[]).map(mapAgentRun);
  }

  markAgentRunRetried(runId: string): AgentRun {
    this.requireAgentRun(runId);
    const timestamp = this.timestamp();
    this.connection.prepare("UPDATE agent_runs SET next_retry_at = NULL, updated_at = ? WHERE id = ?")
      .run(timestamp, runId);
    return this.requireAgentRun(runId);
  }

  recoverExpiredAgentRuns(asOf = this.timestamp()): AgentRun[] {
    const expired = (this.connection.prepare(`
      SELECT * FROM agent_runs
      WHERE status IN ('claimed', 'running', 'awaiting_approval')
        AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
      ORDER BY lease_expires_at
    `).all(asOf) as Row[]).map(mapAgentRun);
    return expired.map((run) => this.recordAgentRunFailure(run.id, "Worker lease expired.", 0));
  }

  appendAgentRunEvent(runId: string, eventType: AgentRunEventType, message: string): AgentRunEvent {
    this.requireAgentRun(runId);
    const parsedType = agentRunEventTypeSchema.parse(eventType);
    return this.insertAgentRunEvent(runId, parsedType, message, this.timestamp());
  }

  saveAgentRunArtifact(runId: string, path: string): AgentRun {
    const run = this.requireAgentRun(runId);
    const artifactPaths = Array.from(new Set([...run.artifactPaths, path]));
    const timestamp = this.timestamp();
    const save = this.connection.transaction(() => {
      this.connection.prepare("UPDATE agent_runs SET artifact_paths = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(artifactPaths), timestamp, runId);
      this.insertAgentRunEvent(runId, "artifact_saved", path, timestamp);
    });
    save.immediate();
    return this.requireAgentRun(runId);
  }

  submitAgentRunResult(runId: string, input: {
    finalResponse: string;
    verificationSummary: string;
    artifactPaths?: string[];
    externalSessionId?: string | null;
  }): AgentRun {
    const run = this.requireAgentRun(runId);
    if (!(["claimed", "running"] as AgentRunStatus[]).includes(run.status)) {
      throw new Error(`Run cannot submit a result from status: ${run.status}`);
    }
    const task = this.requireTask(run.taskId);
    if (task.status !== "in_progress") throw new Error(`Task must be in progress before result submission: ${task.status}`);
    const timestamp = this.timestamp();
    const artifactPaths = Array.from(new Set([...(run.artifactPaths ?? []), ...(input.artifactPaths ?? [])]));
    const submit = this.connection.transaction(() => {
      if (run.status === "claimed") {
        this.connection.prepare("UPDATE agent_runs SET status = 'running', started_at = ?, updated_at = ? WHERE id = ?")
          .run(timestamp, timestamp, runId);
        this.insertAgentRunEvent(runId, "running", "Worker started execution.", timestamp);
      }
      this.connection.prepare(`
        UPDATE agent_runs SET
          status = 'needs_review', external_session_id = ?, final_response = ?,
          artifact_paths = ?, verification_summary = ?, completed_at = ?,
          lease_expires_at = NULL, requires_human_review = 1, updated_at = ?
        WHERE id = ?
      `).run(
        input.externalSessionId ?? run.externalSessionId,
        input.finalResponse,
        JSON.stringify(artifactPaths),
        input.verificationSummary,
        timestamp,
        timestamp,
        runId
      );
      this.connection.prepare("UPDATE tasks SET status = 'needs_review', updated_at = ? WHERE id = ?")
        .run(timestamp, task.id);
      this.insertAgentRunEvent(runId, "verification", input.verificationSummary, timestamp);
      this.insertAgentRunEvent(runId, "needs_review", "Worker submitted the result for human review.", timestamp);
    });
    submit.immediate();
    return this.requireAgentRun(runId);
  }

  listAgentRunEvents(runId: string): AgentRunEvent[] {
    this.requireAgentRun(runId);
    const rows = this.connection.prepare("SELECT * FROM agent_run_events WHERE run_id = ? ORDER BY created_at, rowid").all(runId) as Row[];
    return rows.map(mapAgentRunEvent);
  }

  createApprovalRequest(raw: {
    runId: string;
    actionType: ApprovalRequest["actionType"];
    destination: string;
    summary: string;
    payloadPreview?: string | null;
    expiresAt?: string | null;
  }, id = randomUUID()): ApprovalRequest {
    const input = approvalRequestInputSchema.parse(raw);
    const run = this.requireAgentRun(input.runId);
    if (run.status !== "running") throw new Error(`Run must be running to request approval: ${run.id}`);
    const timestamp = this.timestamp();
    const create = this.connection.transaction(() => {
      this.connection.prepare(`
        INSERT INTO approval_requests (
          id, run_id, action_type, destination, summary, payload_preview,
          status, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        id,
        input.runId,
        input.actionType,
        input.destination,
        input.summary,
        input.payloadPreview,
        input.expiresAt ?? null,
        timestamp
      );
      this.connection.prepare("UPDATE agent_runs SET status = 'awaiting_approval', updated_at = ? WHERE id = ?").run(timestamp, input.runId);
      this.insertAgentRunEvent(input.runId, "approval_requested", `${input.actionType}: ${input.summary}`, timestamp);
    });
    create.immediate();
    return this.requireApprovalRequest(id);
  }

  listApprovalRequests(status?: ApprovalStatus): ApprovalRequest[] {
    const rows = status
      ? this.connection.prepare("SELECT * FROM approval_requests WHERE status = ? ORDER BY created_at DESC").all(status) as Row[]
      : this.connection.prepare("SELECT * FROM approval_requests ORDER BY created_at DESC").all() as Row[];
    return rows.map(mapApprovalRequest);
  }

  getApprovalRequest(id: string): ApprovalRequest | null {
    const row = this.connection.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id) as Row | undefined;
    return row ? mapApprovalRequest(row) : null;
  }

  resolveApprovalRequest(id: string, decision: "approved" | "rejected"): ApprovalRequest {
    const approval = this.requireApprovalRequest(id);
    if (approval.status !== "pending") throw new Error(`Approval is already resolved: ${approval.status}`);
    const run = this.requireAgentRun(approval.runId);
    if (run.status !== "awaiting_approval") throw new Error(`Run is not awaiting approval: ${run.status}`);
    const timestamp = this.timestamp();
    const leaseExpiresAt = new Date(this.clock().getTime() + 120_000).toISOString();
    const resolve = this.connection.transaction(() => {
      this.connection.prepare("UPDATE approval_requests SET status = ?, resolved_at = ? WHERE id = ?")
        .run(decision, timestamp, id);
      this.connection.prepare(`
        UPDATE agent_runs SET status = 'running', heartbeat_at = ?, lease_expires_at = ?, updated_at = ?
        WHERE id = ?
      `).run(timestamp, leaseExpiresAt, timestamp, run.id);
      this.insertAgentRunEvent(run.id, "approval_resolved", `Human reviewer ${decision} ${approval.actionType} for ${approval.destination}.`, timestamp);
    });
    resolve.immediate();
    return this.requireApprovalRequest(id);
  }

  expireApprovalRequests(asOf = this.timestamp()): ApprovalRequest[] {
    const pending = (this.connection.prepare(`
      SELECT * FROM approval_requests
      WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= ?
      ORDER BY expires_at
    `).all(asOf) as Row[]).map(mapApprovalRequest);
    return pending.map((approval) => {
      const run = this.requireAgentRun(approval.runId);
      const leaseExpiresAt = new Date(new Date(asOf).getTime() + 120_000).toISOString();
      const expire = this.connection.transaction(() => {
        this.connection.prepare("UPDATE approval_requests SET status = 'expired', resolved_at = ? WHERE id = ?")
          .run(asOf, approval.id);
        if (run.status === "awaiting_approval") {
          this.connection.prepare(`
            UPDATE agent_runs SET status = 'running', heartbeat_at = ?, lease_expires_at = ?, updated_at = ?
            WHERE id = ?
          `).run(asOf, leaseExpiresAt, asOf, run.id);
        }
        this.insertAgentRunEvent(run.id, "approval_resolved", `Approval expired and defaulted to rejection for ${approval.actionType}.`, asOf);
      });
      expire.immediate();
      return this.requireApprovalRequest(approval.id);
    });
  }

  acceptAgentRun(runId: string, resolutionMessage = "Human reviewer accepted the final result."): AgentRun {
    const run = this.requireAgentRun(runId);
    if (run.status !== "needs_review") throw new Error(`Run is not ready for review: ${run.status}`);
    const task = this.requireTask(run.taskId);
    if (task.status !== "needs_review") throw new Error(`Task is not ready for approval: ${task.status}`);
    const timestamp = this.timestamp();
    const accept = this.connection.transaction(() => {
      this.connection.prepare("UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?").run(timestamp, task.id);
      this.connection.prepare(`
        UPDATE agent_runs SET status = 'done', requires_human_review = 0,
          completed_at = COALESCE(completed_at, ?), updated_at = ? WHERE id = ?
      `).run(timestamp, timestamp, run.id);
      this.insertAgentRunEvent(run.id, "approval_resolved", resolutionMessage, timestamp);
    });
    accept.immediate();
    return this.requireAgentRun(runId);
  }

  rejectAgentRun(runId: string, reason: string): AgentRun {
    const run = this.requireAgentRun(runId);
    if (run.status !== "needs_review") throw new Error(`Run is not ready for review: ${run.status}`);
    const task = this.requireTask(run.taskId);
    if (task.status !== "needs_review") throw new Error(`Task is not ready for rejection: ${task.status}`);
    const timestamp = this.timestamp();
    const reject = this.connection.transaction(() => {
      this.connection.prepare("UPDATE tasks SET status = 'blocked', updated_at = ? WHERE id = ?").run(timestamp, task.id);
      this.connection.prepare("UPDATE agent_runs SET status = 'blocked', error_message = ?, updated_at = ? WHERE id = ?")
        .run(reason, timestamp, run.id);
      this.insertAgentRunEvent(run.id, "failed", `Human reviewer rejected the result: ${reason}`, timestamp);
    });
    reject.immediate();
    return this.requireAgentRun(runId);
  }

  createCodexRun(input: {
    taskId: string;
    projectId?: string | null;
    mode: "demo" | "live";
    workingDirectory?: string | null;
    promptSnapshot: string;
    idempotencyKey?: string;
    attempt?: number;
  }, id = randomUUID()): CodexRun {
    const run = this.createAgentRun({
      ...input,
      executor: "codex",
      idempotencyKey: input.idempotencyKey ?? `codex:${id}`,
      attempt: input.attempt
    }, id);
    return toCodexRun(run);
  }

  updateCodexRun(id: string, patch: Partial<Pick<CodexRun, "threadId" | "status" | "finalResponse" | "artifactPaths" | "verificationSummary" | "errorMessage" | "requiresHumanReview" | "startedAt" | "completedAt">>): CodexRun {
    const run = this.updateAgentRun(id, {
      externalSessionId: patch.threadId,
      status: patch.status,
      finalResponse: patch.finalResponse,
      artifactPaths: patch.artifactPaths,
      verificationSummary: patch.verificationSummary,
      errorMessage: patch.errorMessage,
      requiresHumanReview: patch.requiresHumanReview,
      startedAt: patch.startedAt,
      completedAt: patch.completedAt
    });
    return toCodexRun(run);
  }

  listCodexRuns(limit = 50): CodexRun[] {
    return this.listAgentRuns({ executor: "codex", limit }).map(toCodexRun);
  }

  findLatestThreadForProject(projectId: string): string | null {
    const row = this.connection.prepare(`
      SELECT external_session_id FROM agent_runs
      WHERE project_id = ? AND executor = 'codex' AND external_session_id IS NOT NULL
      ORDER BY updated_at DESC LIMIT 1
    `).get(projectId) as { external_session_id: string } | undefined;
    return row?.external_session_id ?? null;
  }

  appendCodexRunEvent(runId: string, eventType: string, message: string): CodexRunEvent {
    const aliases: Record<string, AgentRunEventType> = {
      accepted: "approval_resolved",
      blocked: "failed"
    };
    const parsed = agentRunEventTypeSchema.safeParse(eventType);
    const event = this.appendAgentRunEvent(runId, parsed.success ? parsed.data : (aliases[eventType] ?? "tool_request"), message);
    return event;
  }

  listCodexRunEvents(runId: string): CodexRunEvent[] {
    return this.listAgentRunEvents(runId);
  }

  getCodexRun(id: string): CodexRun | null {
    const run = this.getAgentRun(id);
    return run?.executor === "codex" ? toCodexRun(run) : null;
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
    const latestReport = this.getLatestDailyReport();
    const opportunities = (latestReport?.opportunities ?? []).filter((item) => ["candidate", "shortlisted"].includes(item.status)).sort((a, b) => b.score - a.score).slice(0, 5);
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
      latestReport,
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

  private requireAgentRun(id: string): AgentRun {
    const run = this.getAgentRun(id);
    if (!run) throw new Error(`Agent run not found: ${id}`);
    return run;
  }

  private requireApprovalRequest(id: string): ApprovalRequest {
    const approval = this.getApprovalRequest(id);
    if (!approval) throw new Error(`Approval request not found: ${id}`);
    return approval;
  }

  private insertAgentRunEvent(runId: string, eventType: AgentRunEventType, message: string, createdAt: string): AgentRunEvent {
    const event = { id: randomUUID(), runId, eventType, message, createdAt };
    this.connection.prepare("INSERT INTO agent_run_events (id, run_id, event_type, message, created_at) VALUES (?, ?, ?, ?, ?)").run(
      event.id,
      event.runId,
      event.eventType,
      event.message,
      event.createdAt
    );
    return event;
  }
}

export function createDatabase(filePath = process.env.DATABASE_PATH ?? "./data/personal-os.db", seed = false): PersonalOsDatabase {
  return new PersonalOsDatabase({ filePath, seed });
}
