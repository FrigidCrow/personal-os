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

The current deep-research gate supersedes the original breadth limit: daily reports contain no more than three qualified opportunities.

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

## 12. MVP2 execution control

Status: Passed
Date: 2026-07-28

MVP2 的详细架构、实施顺序和安全边界以 [`AUTOMATION-PLAN.md`](./AUTOMATION-PLAN.md) 为准；逐项验收以 [`MVP2-ACCEPTANCE.md`](./MVP2-ACCEPTANCE.md) 为准。

执行严格遵循：

```text
Plan
  -> Work: Phase A -> B -> C -> D -> E
  -> Review: requirement audit + automated gates
  -> Full E2E inventory: MVP1 + MVP1.1 + MVP2
  -> Feature-level UI -> HTTP -> backend -> SQLite traces
  -> Complete business-journey E2E
```

最终结果：`MVP2-ACCEPTANCE.md` 的 C01-C30 全部 Passed；`FULL-E2E-ACCEPTANCE.md` 已完成 MVP1、MVP1.1 与 MVP2 的功能盘点、7 条浏览器级 UI -> HTTP -> backend -> SQLite 用例，以及真实 Codex/OpenWorker 全流程验收。

## 13. Recurring task lifecycle correction

Status: Implemented and verified
Date: 2026-07-28

Recurring cron tasks are persistent automation definitions. A successful occurrence completes its Agent Run, not the recurring task itself.

Acceptance criteria:

- The task board has a dedicated `定时任务` column immediately after Inbox so it is visible without searching at the end of the board.
- Active and paused recurring cron tasks appear only in `定时任务`, regardless of the current occurrence state.
- Accepting one recurring run returns the task definition to Ready while the accepted Agent Run remains Done.
- Pausing a recurring task keeps it in `定时任务` and prevents future automatic dispatch.
- A separate, confirmed `结束定时任务` action marks the automation as completed; only then may it appear in Done.
- Existing recurring tasks whose last accepted run left them in Done are migrated by presentation and lifecycle rules without deleting history.
- The scheduled card continues to expose its latest run state, next execution time, pause/resume control, review entry when needed, and task detail.
- Domain, database, API, browser, mobile, typecheck, lint, build, and patch-hygiene checks pass with direct evidence recorded in `WORKLOG.md` and `REVIEW.md`.

## 14. Opportunity radar monetization gate and reliable worker execution

Status: Implemented and verified
Date: 2026-07-29

The opportunity radar must produce testable sales paths, not only plausible ideas. Its discovery rules belong to the user, while the minimum evidence and sales-channel gate remain system invariants.

Acceptance criteria:

- The opportunity radar UI lets the user edit the operator profile and additional search instructions without editing source code.
- Schedule, timezone, catch-up behavior, and executor are stored in SQLite and remain editable from the radar page.
- Every newly generated opportunity includes a concrete offer, target payer, pricing approach, at least one verifiable sales channel with a direct URL and access method, and a first-sale plan.
- A candidate without a verifiable sales channel is rejected before persistence and does not appear in a daily report.
- The opportunity card presents the offer, buyer, channels, and first-sale path before the minimum experiment and evidence sections.
- OpenWorker may atomically claim an overdue radar job, receive only the configured read-only research brief, save schema-validated opportunities and one daily report, and mark the radar run succeeded or failed.
- OpenWorker idle polling is reported as an idle state, not described as a failed Personal OS task.
- The existing AI news recurring task is routed to OpenWorker so the configured DeepSeek model can execute it while Codex usage is unavailable.
- Permanent Codex quota errors remain visible with their original reason and are not misreported as an empty OpenWorker queue.
- Domain, database, MCP, API, scheduler, browser, mobile, typecheck, lint, build, and live integration checks pass with evidence recorded in `WORKLOG.md` and `REVIEW.md`.

## 15. Opportunity radar deep-research gate

Status: Implemented and verified
Date: 2026-07-29

The radar must behave like a conservative investment committee, not an idea generator. A daily run scans broadly across multiple verticals, then deeply researches and persists at most three qualified candidates. A run is fully successful only when all three candidates independently clear the evidence gate and score at least 85.

Acceptance criteria:

- New live radar candidates classify evidence as demand, payment, channel, feasibility, or counter-evidence, with source date, strength, what the source proves, and what it does not prove.
- A live candidate requires at least two independent demand facts and at least one strong fact in every required evidence class before persistence.
- A structured assessment records the current alternative, competitive landscape, automated delivery flow, first-100-visitor acquisition plan, external dependencies, failure reasons, and unresolved unknowns.
- The program calculates a 100-point research score from demand, payment, acquisition, closure, differentiation, feasibility, and recurring-value dimensions. A candidate below 85, or below the critical dimension floors, is rejected before persistence.
- Codex and OpenWorker receive the same conservative research doctrine: scan broadly across verticals, return at most three deeply researched candidates, never lower the threshold to fill slots, direct user/payment evidence outranks marketing pages, negative evidence is mandatory, and manual fulfillment is not an acceptable core loop.
- A run with three gate-passing candidates at 85 or above is `succeeded`. A run with zero to two qualifying candidates persists the honest partial report but is marked `partial`, never `succeeded` or operationally `failed`.
- The Radar UI shows an explicit qualified-count target of three and distinguishes full success, partial research, and execution failure.
- Historical and demo opportunities remain readable after a non-destructive SQLite migration, but cannot start a new experiment unless the current deep-research gate passes.
- The Radar UI shows the score breakdown, gate result, evidence categories and strengths, proof limitations, competitive alternatives, closure path, dependencies, failure reasons, and unknowns without changing the existing visual system.
- Domain, database, MCP, API, Web, browser, mobile, typecheck, lint, build, and patch-hygiene checks pass with direct evidence recorded in `docs/RADAR-DEEP-RESEARCH-ACCEPTANCE.md`, `WORKLOG.md`, and `REVIEW.md`.

## 16. Opportunity radar live-state visibility

Status: Implemented and verified
Date: 2026-07-29

The immediate-research action must expose its real lifecycle. Queued work is not idle, and active research must be visible without waiting a full minute or inferring state from the next-run timestamp.

Acceptance criteria:

- Clicking immediate research stores an explicit `queued` state and immediately renders `已加入调研队列`.
- OpenWorker claiming the job changes the state to `running`, rendered as `正在中文调研` with its actual start time.
- The primary action is disabled while queued or running and cannot enqueue duplicates.
- The Radar page polls every three seconds only while queued or running, then returns to the normal one-minute interval.
- A compact active-state strip appears inside the existing schedule panel on desktop and mobile without inventing unsupported sub-steps.
- Automatic due OpenWorker research also enters `queued` before claim, rather than remaining `idle`.
- Domain, database, scheduler, API, browser, mobile, typecheck, lint, build, and patch-hygiene checks pass with direct evidence recorded in `WORKLOG.md` and `REVIEW.md`.
