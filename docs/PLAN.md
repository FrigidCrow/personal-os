# Personal OS MVP1 Execution Plan

Status: Approved for implementation  
Date: 2026-07-28  
Method: Plan -> Work -> Review

## 1. Outcome

Build a local-first, responsive web control plane for a solo technical operator. It must unify projects, tasks, opportunity discovery, experiments, income assets, and Codex execution into one reviewable workflow.

MVP1 is complete only when the user can run the product locally and verify this loop:

```text
Create a task in Web
  -> assign it to Codex
  -> Codex reads task context
  -> run state appears in Web
  -> Codex or the adapter writes a result
  -> user reviews and accepts the result
```

## 2. Product scope

### Included

- Dashboard with today focus, portfolio state, Codex queue, opportunity summary, and income-asset summary.
- Project CRUD with lane, outcome, next action, revenue, deadline, repository, and Obsidian links.
- Task CRUD with `human_only`, `codex_ready`, and `mixed` delegation modes.
- Task workflow: Inbox, Ready, In Progress, Needs Review, Done, Blocked.
- Opportunity radar list with evidence, confidence, fit, effort, monetization path, and minimal experiment.
- Daily report reading experience.
- Experiment workflow with budget, time cap, success condition, stop condition, and result.
- Income asset list with stage, revenue model, monthly maintenance, and source project.
- Codex run lifecycle with thread id, status, working directory, final response, artifacts, and verification summary.
- Personal OS MCP server for Codex-to-system actions.
- Server-side Codex SDK adapter for Web-to-Codex actions.
- Local scheduled daily radar trigger with a manual trigger in Web.
- Global light, dark, and system theme.
- Loading, empty, error, and success states.
- Seed data clearly marked as demonstration data.

### Excluded

- Automatic payment, purchase, outreach, publishing, or production deployment.
- Banking and payment-provider integration.
- Multi-user accounts and team permissions.
- Full-web crawling.
- Embeddings, vector databases, and semantic RAG.
- Claims that an opportunity is guaranteed to make money.
- Cloud deployment as an MVP1 acceptance dependency.

## 3. Architecture

```text
apps/web
  React + Vite + TypeScript
  Radix Themes + custom design tokens
  TanStack Query for server state

apps/server
  Hono HTTP API
  SQLite persistence
  Server-Sent Events for Codex run updates
  Codex SDK gateway
  Daily radar scheduler

apps/mcp
  Local STDIO MCP server
  Tools backed by the same SQLite database

packages/domain
  Types, schemas, state transitions, scoring rules

packages/database
  SQLite connection, migrations, repositories, seed data
```

## 4. Data ownership

| Data | Authority |
|---|---|
| Project, task, run, opportunity, experiment, asset state | SQLite |
| Notes, research, long-form thinking | Obsidian |
| Source code and deliverables | Git repositories |
| Codex conversation | Codex thread |
| Codex execution summary and linkage | SQLite |

## 5. Codex integration contract

### Web to Codex

The server uses `@openai/codex-sdk` to start or resume a thread. Each request binds:

- `project_id`
- `task_id`
- `working_directory`
- `thread_id` when resuming
- task outcome and acceptance criteria
- allowed and disallowed actions

The server stores all lifecycle events as `CodexRun` records and exposes them to Web.

### Codex to Personal OS

The local MCP server exposes:

- `get_today_context`
- `get_project`
- `get_task`
- `update_task_status`
- `append_run_event`
- `mark_task_blocked`
- `complete_task`
- `save_artifact`
- `create_asset_candidate`
- `save_opportunity`
- `save_daily_report`
- `record_experiment_result`

MCP tools validate identifiers and state transitions. Destructive or external actions are not exposed in MVP1.

### Adapter modes

- `live`: uses Codex SDK and local Codex authentication.
- `demo`: deterministic adapter used for tests and UI acceptance when live authentication is unavailable.

The UI must visibly label demo runs. Demo mode may not be presented as a real Codex result.

## 6. Opportunity radar contract

Every recommended opportunity requires:

- payer and pain statement
- evidence entries with source URLs
- fact versus inference labels
- confidence
- personal fit
- validation effort
- path to first revenue
- recurring or reusable potential
- maintenance burden
- minimal experiment
- success and stop conditions

Daily reports contain no more than five shortlisted opportunities.

MVP1 supports a manual generate action and a configurable local daily schedule. The scheduled job may run in demo mode for deterministic acceptance and in live mode for real Codex research.

## 7. Frontend design contract

Design Read: a dense personal operations dashboard for a solo technical operator, with a calm, high-contrast control-room language.

Design dials:

- `DESIGN_VARIANCE: 5`
- `MOTION_INTENSITY: 3`
- `VISUAL_DENSITY: 7`

Foundation:

- Radix Themes as the accessible component base.
- Phosphor Icons as the single icon family.
- Custom CSS variables for semantic color, spacing, typography, and radius.
- One electric-cyan accent across both light and dark themes.
- One radius system: 12px surfaces, 8px controls, pill only for compact status filters.
- System theme by default with a manual light/dark/system selector.
- No AI-purple gradients, fake product screenshots, decorative status dots, generic three-card marketing rows, or decorative em dashes.

Product UI rules:

- Sidebar collapses to a mobile sheet below 768px.
- Dashboard content is one column below 768px.
- Tables become structured list rows on narrow screens.
- Meaningful state changes use restrained opacity/transform transitions.
- Reduced-motion preference disables non-essential transitions.
- All primary flows include loading, empty, error, and success feedback.
- Visible copy is functional and must distinguish sample data from real data.

## 8. Work packages

### Work package A: repository and domain foundation

- npm workspace and TypeScript configuration
- lint, test, typecheck, and build scripts
- domain schemas and state transition rules
- database schema, migrations, repositories, and seed command

Gate: domain and database tests pass.

### Work package B: HTTP API

- dashboard summary endpoint
- project, task, opportunity, experiment, asset, report, and run endpoints
- validation and consistent error response
- SSE run event endpoint

Gate: API integration tests cover primary CRUD and invalid transitions.

### Work package C: Web control plane

- app shell and theme
- dashboard
- projects and project detail
- tasks
- opportunities and daily report
- experiments
- assets
- Codex review queue

Gate: production build passes and primary user flows work at desktop and mobile widths.

### Work package D: Codex integration

- Codex gateway interface
- demo and live SDK implementations
- MCP server and tools
- run orchestration and event persistence
- manual daily report trigger
- local schedule configuration

Gate: automated demo loop passes and MCP tool calls mutate expected records.

### Work package E: guidance and repeatable workflows

- repository `AGENTS.md`
- `personal-os-opportunity-radar` skill
- `personal-os-daily-focus` skill
- `personal-os-weekly-review` skill
- setup documentation for local MCP and live Codex mode

Gate: documentation has copy-pasteable setup and verification commands.

## 9. Review plan

### Automated review

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- API smoke test against a temporary database
- MCP tool smoke test

### Product review

- Requirement-by-requirement acceptance audit against `docs/MVP1-ACCEPTANCE.md`.
- Create, delegate, review, and accept a task.
- Generate a daily report and convert an opportunity into an experiment.
- Verify demo labels and sample-data labels.
- Verify no unapproved external actions exist.

### Frontend review

- Desktop screenshot review.
- Mobile screenshot review.
- Light and dark theme review.
- Keyboard navigation review.
- Loading, empty, and error state review.
- Mechanical taste-skill pre-flight checks relevant to product UI.

## 10. MVP1.1 closeout

Status: Implemented and verified
Date: 2026-07-28

MVP1.1 closes the remaining interaction gaps without changing the product boundary, data ownership model, or human approval gate established by MVP1.

Implementation order:

1. Add confirmed deletion to the task detail experience.
2. Add experiment detail, editing, status management, and result recording.
3. Add a real project detail route with project context and associated tasks.
4. Add one global success-feedback system for completed mutations.
5. Expand Codex run detail and consume the existing Server-Sent Events stream in Web.

Acceptance gates:

- A task can be deleted only after an explicit confirmation, and related Codex run records follow the existing database cascade rule.
- An experiment can be opened, edited, and given a measured outcome from the Web UI.
- `/projects/:id` renders project metadata and associated tasks, including direct navigation from the project list.
- Successful create, update, delete, transition, conversion, generation, assignment, and approval actions show consistent accessible feedback.
- Codex run detail exposes mode, status, task and project linkage, thread id, working directory, prompt snapshot, timestamps, result, verification, artifacts, errors, and the persisted event timeline.
- Active Codex run detail uses `/api/codex/runs/:id/stream`; periodic list refresh remains only as a fallback for list-level freshness.
- Desktop, mobile, light, dark, keyboard, reduced-motion, test, typecheck, lint, and production-build review gates pass.

Requirement-level evidence is tracked in `docs/MVP1.1-ACCEPTANCE.md`.

## 11. Definition of done

MVP1 is done only when:

1. The repository runs from documented commands on the current machine.
2. All automated gates pass.
3. All MVP1 acceptance rows have direct evidence.
4. The full task-to-Codex-to-review loop is demonstrated.
5. The opportunity-to-experiment loop is demonstrated.
6. Frontend review includes rendered desktop and mobile evidence.
7. Remaining limitations are explicit and do not contradict an acceptance requirement.
8. The implementation is committed to Git.

## 11. Next phase

MVP1 已完成并保留为历史执行基线。下一阶段的自动多执行器方案见 [`AUTOMATION-PLAN.md`](./AUTOMATION-PLAN.md)，覆盖 Personal OS 自动调度 Codex 与 OpenWorker、通用 Agent Run、任务租约、审批 Inbox 和可靠恢复。
