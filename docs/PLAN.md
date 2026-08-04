# Personal OS MVP1 Execution Plan

Status: Phase 11 passed and deployed
Date: 2026-07-28  
Method: Plan -> Work -> Review

## Current stage: Phase 11 recoverable workflows — passed

Phase 11 adds recoverable step checkpoints and controlled post-acceptance Obsidian deposition. It must preserve immutable Run history, make resume-versus-restart explicit, keep all file writes inside registered Vault directories and surface deposition failures in Today. The frozen scope and gates are in [`PERSONAL-OS-PHASE11-RECOVERABLE-WORKFLOWS-SPEC.md`](PERSONAL-OS-PHASE11-RECOVERABLE-WORKFLOWS-SPEC.md).

Status: **Passed and deployed on 2026-08-03.** Production Web `5273`, API `8787`, Scheduler and migration 11 are healthy. Direct evidence is recorded in [`PERSONAL-OS-PHASE11-RECOVERABLE-WORKFLOWS-ACCEPTANCE.md`](PERSONAL-OS-PHASE11-RECOVERABLE-WORKFLOWS-ACCEPTANCE.md).

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

## 27. vNext MVP2 AI Runtime integration

**状态**：Completed

**日期**：2026-08-01

vNext MVP2 在已经通过的独立 5373/8887 系统上接入真实 Codex 与 OpenWorker。详细 AI 契约见 [`PERSONAL-OS-VNEXT-MVP2-AI-SPEC.md`](./PERSONAL-OS-VNEXT-MVP2-AI-SPEC.md)，逐项门禁见 [`PERSONAL-OS-VNEXT-MVP2-ACCEPTANCE.md`](./PERSONAL-OS-VNEXT-MVP2-ACCEPTANCE.md)。

实施顺序：

1. 冻结 Adapter、目录、Prompt、Secret 和 waiting 状态契约；
2. 扩展 Application 结果状态和 Project 上下文；
3. 实现可注入、可取消、默认只读的 Codex Adapter；
4. 实现 Token 文件、REST health、WebSocket event 映射的 OpenWorker Adapter；
5. 注册到 API 并更新 Runtime health；
6. 运行确定性契约测试、全量回归、浏览器 E2E、数据库检查与真实只读冒烟；
7. 在 `WORKLOG.md` 和 `REVIEW.md` 记录证据与遗留边界。

本阶段不切换旧 5273/8787，不删除旧实现，不自动批准 OpenWorker 请求，不猜测 Token/费用，也不把 transport 完成误认为业务成功。

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

## 17. Radar platform and Task-to-Skill lifecycle

Status: Implemented and verified
Date: 2026-07-29

The specialized opportunity radar will evolve into one Task inside a broader research-automation control plane named `雷达`. A new or complex Radar Task must first run in a real read-only rehearsal, expose its steps and failures, pass deterministic validation, and receive human approval before it can become a versioned Skill used by a production schedule.

The complete product, state-machine, data-model, UI, migration, API, safety and phased-delivery design is recorded in [`RADAR-PLATFORM-DESIGN.md`](./RADAR-PLATFORM-DESIGN.md).

The implementation release contract and rollback boundary are frozen in [`RADAR-PLATFORM-ACCEPTANCE.md`](./RADAR-PLATFORM-ACCEPTANCE.md). This implementation covers design Phases 1 through 3. Phase 4 conditional/parallel orchestration remains deferred.

Implementation acceptance criteria:

- The left navigation exposes one `雷达` control plane containing multiple research Tasks; ordinary one-off work remains in the existing task queue.
- The original opportunity radar becomes a Radar Task without deleting opportunities, daily reports, evidence, schedule history, deep-research gates, or its repository Skill.
- Radar Task drafts define source policy, ordered steps, input/output schemas, success semantics, tool capabilities, risk and expected schedule.
- Complex Tasks support preflight, single-step debugging, real end-to-end rehearsal, intermediate artifacts, real run events and restart from a valid checkpoint.
- Production scheduling is unavailable until deterministic validators pass, at least two independent rehearsals succeed, a critical failure path is exercised, and a human approves the Skill candidate.
- Approved Skills are immutable, versioned, content-hashed and traceable to rehearsal evidence. Schedules bind to an explicit Skill Version and never drift with `latest` or an edited Task draft.
- Editing a live Task creates a new draft version while the current production schedule remains pinned to the last approved version.
- Unreviewed generated Skill drafts cannot enter a discoverable Skill directory. Approval materializes the reviewed version into repository `.agents/skills` without storing secrets or automatically committing to Git.
- Every production occurrence remains a separate Agent Run with idempotency, lease, heartbeat, bounded retry, artifacts, validation evidence and Needs Review.
- Capability manifests keep network reads, file paths, connectors, external writes, secret references, runtime and cost limits explicit; expanded permissions require new approval.
- Phase-level automated, API, migration, browser, mobile, typecheck, lint, build and patch-hygiene evidence must be recorded before any implementation phase is declared complete.

## 18. Radar workspace, runtime fallback and music pilot

Status: Passed
Date: 2026-07-29

The Radar landing page is an operational index, not a report canvas. A Radar Task owns its reports, schedule, runtime policy, rehearsal evidence and approved Skill versions inside a dedicated workspace route. Runtime selection is expanded from one executor field to a preferred executor with an optional bounded fallback. The first new complex draft is `汽水热歌拆解与原创实验`.

Implementation acceptance criteria:

- `/radar` renders a compact task control plane with real counts for active runs, items needing attention, enabled schedules and recent failures. It does not render the opportunity report hero, archive or report body.
- Clicking a Radar Task navigates to `/radar/:id`. The dedicated workspace preserves definition, pipeline, rehearsal, Skill, schedule and run history. The built-in opportunity Radar additionally owns its existing report and settings surface there.
- A Radar definition persists a preferred executor, optional fallback executor, bounded fallback triggers and maximum handoffs. Existing definitions migrate without changing their preferred executor.
- Pipeline steps can declare `inherit`, `codex` or `openworker` as their runtime preference. The generated Skill and immutable definition snapshot retain those choices.
- Preflight reports preferred and fallback readiness separately. A missing optional fallback does not hide a healthy preferred runtime, while an unavailable preferred runtime can use an eligible healthy fallback.
- Dispatch-time capability failure and a retryable failed Run may hand off once to the configured fallback. The audit trail identifies both executor attempts; quality-gate failure never triggers executor handoff.
- Codex remains protected by the existing valid local Git project requirement. The UI explains when a configured Codex preference or fallback is not ready.
- An idempotent built-in draft named `汽水热歌拆解与原创实验` is created without a production schedule or approved Skill. It records the Top 10 snapshot, deduplication, authorized-audio rule, deterministic audio analysis, hit-pattern synthesis, originality transformation, Suno prompt package, quality gate and approval checkpoint.
- The music draft never authorizes DRM bypass, redistribution, artist/voice imitation or automatic Suno credit consumption. Missing legal audio lowers analysis coverage instead of inventing audio features. Suno generation remains a separately approved external action.
- The music output contract includes chart snapshot, deduplication, analysis confidence, reusable patterns, originality constraints, formal lyrics, pronunciation lyrics, Style of Music, Exclude Styles, generation settings and results.
- Domain, database, server, Web, migration, mobile, light/dark, typecheck, lint, build, browser flow and patch-hygiene evidence are recorded before this section changes to Passed.

## 19. Real Obsidian export for Radar results

Status: Passed
Date: 2026-07-29

The current `obsidianPath` project field is metadata only. This milestone turns it into a real, human-triggered Markdown export while keeping SQLite authoritative for structured state. The first linked project is `汽水音乐实验室`, backed by `/Users/frigidcrow/Dev/qishui-music` and an Obsidian project note inside the user's existing Vault.

Implementation acceptance criteria:

- The API receives the Vault root from `OBSIDIAN_VAULT_PATH`; it never accepts an arbitrary filesystem destination from the browser.
- A Radar export derives its destination from the Radar's linked Project and that Project's `obsidianPath`. Missing configuration, missing Project linkage, missing final output and paths outside the Vault are rejected without writing files.
- Only completed-output states (`needs_review` or `done`) can be exported. Draft prompts, queued runs and empty results cannot create Obsidian notes.
- Export uses an atomic temporary-file rename, a deterministic per-Run note path and a collision check. Re-exporting the same Run is idempotent; an unrelated existing note is never overwritten.
- The note contains YAML frontmatter linking Project, Radar definition, Task, Run, executor, status, timestamps and source repository, followed by the complete Markdown result and verification summary.
- The Project hub note is created only when absent and is never overwritten. Every exported result links back to it using an Obsidian wiki link.
- The Agent Run stores the exported note as an artifact and appends an `artifact_saved` event, so the relationship is visible from Personal OS rather than existing only on disk.
- The Radar workspace shows whether Obsidian is configured, which Project note owns the archive and an explicit export/re-export action with loading, success, error and disabled states.
- The Qishui Radar is linked to a new Personal OS project using the cloned Git repository and `Projects/Qishui Music.md`; Codex fallback readiness can use that valid local Git repository.
- Unit/integration, API, path traversal, collision, browser, mobile, theme, typecheck, lint, build, live file, SQLite and patch-hygiene evidence are recorded before this section changes to Passed.

Completed evidence: 8 files / 96 unit and integration tests, 10/10 Playwright journeys, ESLint, TypeScript, production builds and patch hygiene pass. The live API reports the Qishui Radar linked to Project `d71130fa-f5d7-4f3a-a4eb-13799412aeab`, revision 1 preserved, OpenWorker → Codex preserved, 11 steps preserved and Obsidian export ready at `Projects/Qishui Music.md`.

## 20. Goal-directed Radar recovery and truthful quality state

Status: Implemented and verified
Date: 2026-07-30

The first Qishui rehearsal exposed two separate failures: the public web source did not expose the requested chart, and the Codex fallback lost the immutable Radar definition while also lacking a step-result bridge. Codex completion was then presented as `needs_review` before the program gate passed. This milestone changes Radar from a one-shot executor into a bounded, evidence-preserving recovery loop.

Implementation acceptance criteria:

- Retry and executor fallback preserve the complete Radar definition, source Run, failed checks, prior output, validated checkpoints and a requirement to use a materially different recovery strategy.
- Live Codex Radar runs use SDK structured output. The server validates the complete report, verification summary, every pipeline step, blocker, recovery attempts and next actions before writing any terminal state.
- Codex network and Web search access follow the Radar capability manifest instead of the unrelated business-report task type.
- A completed executor turn does not become reviewable until every required step and the output contract pass. A failed program gate cannot be human-accepted.
- A recoverable failure transitions out of `needs_review`, records the exact checks, schedules or immediately starts the next bounded attempt, and preserves earlier evidence rather than restarting blindly.
- `input required` is only accepted after at least three distinct lawful strategies are documented or the configured attempt budget is exhausted. It must name the smallest missing input or connector and retain all partial artifacts.
- New Radar Tasks receive four bounded attempts by default. The built-in Qishui pilot is migrated from two to four attempts without changing its definition revision, Runtime route, safety boundary or historical Runs.
- The Radar workspace distinguishes executing, recovering, quality failed and waiting for input. It shows failed checks, attempt budget and the next recovery action; misleading `等待验收 / 程序门禁未通过` combinations are removed.
- The existing failed Qishui evidence remains immutable. After deployment it is explicitly recovered through the new path rather than edited into a false success.
- Unit, integration, fallback, structured-output, malformed-output, input-required, acceptance-guard, browser, mobile, theme, typecheck, lint, build, live health and patch-hygiene evidence are recorded before this section changes to Passed.

Completed evidence: the recovery loop is schema-constrained, bounded to four attempts, preserves the immutable definition and checkpoints, blocks invalid review/acceptance, and exposes recovery truthfully in the workspace. The old 747-character Qishui result remains immutable and is marked failed against 14 explicit checks. Live attempt 3/4 exercised four lawful source strategies, saved a complete report and three original creation directions, then truthfully requested the minimum missing App screenshot instead of fabricating a chart. Final verification passed 101 unit/integration tests, 10/10 Playwright journeys, TypeScript, ESLint, production builds, SQLite quick/foreign-key checks, live health and patch hygiene.

## 21. Qishui Android emulator runtime

Status: Runtime implemented; current chart target decision required
Date: 2026-07-30

The Qishui Radar uses a project Skill, bounded ADB operations and local Vision OCR. This milestone added a dedicated Apple Silicon Android emulator runtime while preserving the visible-UI, login, copyright and spend boundaries.

Implementation acceptance criteria:

- Install the stable Android command-line SDK, emulator and an ARM64 Google Play system image under the current user's Android SDK directory without installing an x86 image.
- Create one dedicated AVD named `Qishui_Radar_API_35` with hardware acceleration, persistent app/login state and enough local storage for the official client and evidence screenshots.
- Add idempotent start, readiness, status and stop commands to `qishui-music`. Starting waits for Android boot completion and returns one explicit emulator serial; stopping targets only the managed AVD.
- APK installation accepts only an official Qishui download or an explicit user-provided local APK. It records source URL, package name, version and SHA-256, and never substitutes an unofficial mirror.
- The first login, account selection, SMS verification, captcha and risk-control challenge remain explicit human checkpoints. Automation never reads credentials or bypasses those controls.
- The collection bridge can select the managed emulator, keep it awake and unlocked during visible-UI capture, and return `input_required` when the app is absent, login is required or the current Qishui build rejects emulators.
- Personal OS preflight distinguishes missing emulator tooling, stopped managed AVD, missing Qishui package and login-required state with a concrete next action instead of treating them as final task failure.
- Startup and shutdown are bounded and resource-aware: no duplicate emulator instance, no unrelated device shutdown and no background emulator left running after scheduled collection unless human login is pending.
- Unit tests cover AVD discovery, serial selection, lifecycle state, package metadata and actionable failure semantics. Existing snapshot truthfulness and copyright boundaries remain unchanged.
- Qishui tests, Personal OS server tests, typecheck, lint, build, live preflight and patch hygiene pass before this section changes to Passed.

Implementation evidence: Android command-line tools, Emulator 36.6.11, API 35, Google Play ARM64 image, Build Tools 35.0.0 and the dedicated `Qishui_Radar_API_35` AVD are installed. The AVD uses host GPU acceleration, 4 GB RAM and persistent userdata. The Qishui 20.3.0 APK was obtained through the official page's `ugapk.com/GMg3/` redirect, verified as `com.luna.music`, hashed, installed and persisted across a cold lifecycle test. `qishui_emulator.py` provides the bounded AVD lifecycle. The earlier monolithic daily wrapper and UIAutomator bridge were removed after the workflow was reframed as `qishui-daily-sync` Skill plus bounded device/archive tools. Personal OS preflight now verifies Skill and tool availability without starting the emulator; the selected executor starts it inside the Skill run. The user completed the one-time agreement and anonymous browsing passes the app/runtime gate. Current App evidence supports the chosen `热歌榜` and `新歌榜`; 欧美榜 remains explicitly excluded.

## 22. Qishui dual-chart snapshots and daily rank diff

Status: In progress
Date: 2026-07-30

The production source target is now the two chart types visibly available in Qishui 20.3.0: `热歌榜` and `新歌榜`. The unavailable `上升榜` target is retired. Each daily run must collect both official Top10 lists before calculating cross-day changes.

Implementation acceptance criteria:

- One Skill-controlled managed emulator session collects `热歌榜 Top10` and `新歌榜 Top10` through visible UI, with separate screenshots, OCR JSON and snapshot files for each chart.
- Each snapshot stores the exact chart name, collection time, ranks 1–10, title and artist. A missing chart, partial ranking or chart-name mismatch prevents dual-chart success.
- The parser ignores Android private-use icon glyphs, total track counts and ranks above 10, separates `歌手 · 专辑`, and merges overlapping scroll pages without inventing entries.
- Daily diff compares each chart only with the latest earlier snapshot of the same chart. It emits new entries, upward/downward/stable rank changes and prior Top10 exits; positive rank delta means movement upward.
- The first successful day is explicitly a baseline rather than a fabricated change report. Duplicate runs for the same date deterministically replace the same snapshot/diff paths.
- Lifecycle remains `start → preflight both charts → capture both charts → diff → release`. If either chart needs human input the AVD stays available; otherwise it is released on success and recoverable failure.
- Personal OS preflight validates both visible chart routes. The live Qishui Radar pipeline and instructions name both charts and the daily diff instead of `上升榜`.
- Python unit tests cover both chart schemas, multi-page parsing, previous-snapshot selection and every diff state. A live two-chart capture, strict validation, Personal OS tests, typecheck, lint, build and patch hygiene are recorded before this section changes to Passed.

## 23. Qishui minimum daily library sync

Status: In progress
Date: 2026-07-30

The current milestone is intentionally narrow: every scheduled Radar occurrence obtains the official `热歌榜 Top10` and `新歌榜 Top10`, downloads only previously unseen tracks through the official client when the account is entitled to do so, reuses one canonical local audio path for repeated tracks, and writes a daily Obsidian note. Audio analysis, songwriting and Suno remain later pipeline stages and are not part of this acceptance gate.

Implementation acceptance criteria:

- The production entrypoint is `Radar schedule → pinned qishui-daily-sync Skill → capability-approved AI Runtime → direct ADB/image interaction + deterministic OCR/archive tools → Obsidian`.
- The Skill and AI Runtime own ordering, screenshot judgment, bounded retries, recovery and success. No monolithic automation script or redundant ADB wrapper may own the run.
- Runtime selection is capability-gated, not label-gated. Codex currently satisfies local Shell/ADB and image requirements. OpenWorker remains a platform default for suitable tasks but is rejected for this device stage until those capabilities are explicitly connected and verified.
- Personal OS preflight checks Skill and atomic-tool availability without starting the emulator. The selected runtime starts and stops it inside the versioned Skill run.
- Chart extraction uses screenshots as the authority. The AI Runtime decides bounded gestures from the latest image; UIAutomator and fixed-selector orchestration are not part of the production path.
- Only `热歌榜` and `新歌榜` are accepted. Each chart must yield ranks 1–10 with title and artist; `欧美榜` and every other chart are rejected.
- A normalized title-and-artist key identifies repeated tracks. One canonical audio file is stored under `/Users/frigidcrow/Dev/qishui-music/audio/`; later daily notes reuse its path and never duplicate or redownload the file.
- New-track downloads use only the official client and the current user's real entitlement. Login, VIP, DRM, private/encrypted storage or non-exportable app cache are explicit input/coverage gates, never bypassed.
- Audio binaries and download directories are ignored by Git. Git may store only metadata, relative paths, status and Markdown.
- The Obsidian Vault comes from trusted runtime configuration. Each successful day writes one idempotent note under `Projects/Qishui Music/Daily/` containing both charts, new/reused/download-blocked status, canonical local paths and rank changes.
- A one-track probe proves whether an officially downloaded file can be exported from the current emulator to the Mac before batch download is enabled. A protected or inaccessible file reports the exact blocker and does not fabricate a local path.
- The Personal OS Qishui Radar keeps its daily schedule and full long-term downstream pipeline, but the current production step succeeds only after both Top10 lists and the daily Obsidian note are saved; audio coverage is reported separately and truthfully.
- Unit tests cover strict dual-chart validation, safe evidence paths, dedupe/path reuse, idempotent notes, Git audio exclusions and download-gate semantics. Live proof covers both chart screenshots and the one-track download/export probe.

## 24. AI Runtime visual control layer

Status: Passed and deployed
Date: 2026-07-30

Personal OS is being repositioned from a task manager with Agent features into the local visual control layer above Codex and OpenWorker. The task Kanban will leave primary navigation without deleting its database or compatibility APIs. Workflow, Run, Artifact, Approval, Project Context and Runtime Capability become the user-facing objects.

### 2026-08-02 vNext Phase 3 governance

Phase 3 closes the governance gaps left intentionally open by MVP2: resumable input and approval waits on the original Runtime session, first-decision-wins Approval records, independent final acceptance, trusted-only cost recording, bounded Artifact collection, append-only Audit and restart-safe Scheduler behavior. The frozen contract and direct gates are `PERSONAL-OS-VNEXT-PHASE3-AI-SPEC.md` and `PERSONAL-OS-VNEXT-PHASE3-ACCEPTANCE.md`. Production cutover remains outside this phase.

Status: **Passed in the parallel vNext environment on 2026-08-02.** The next implementation stage is Phase 4 knowledge integration; no 5273/8787 authority switch is approved.

The product plan, information architecture, phased migration and success metrics are defined in [AI-RUNTIME-CONTROL-LAYER-PLAN.md](AI-RUNTIME-CONTROL-LAYER-PLAN.md). The implementation cannot be marked complete until every required row in [AI-RUNTIME-CONTROL-LAYER-ACCEPTANCE.md](AI-RUNTIME-CONTROL-LAYER-ACCEPTANCE.md) has direct evidence.

## 25. Asset investment and return ledger

Status: Passed and deployed
Date: 2026-07-30

The consolidated Asset area will include an investment-and-return ledger for a Project, Radar Workflow, income asset, experiment or custom operating unit. Actual paid costs and received revenue are the authority for cash profit, payback and ROI; expected revenue, committed cost, time and unknown Runtime usage remain visible but separate. Every entry can be traced back to its Run, Workflow, Artifact and local evidence without turning Personal OS into a payment or tax system.

The product scope, accounting semantics, UI structure, safety boundaries and calculation examples are defined in [ASSET-ROI-LEDGER-PLAN.md](ASSET-ROI-LEDGER-PLAN.md). Its acceptance rows are part of Phase 3 in [AI-RUNTIME-CONTROL-LAYER-ACCEPTANCE.md](AI-RUNTIME-CONTROL-LAYER-ACCEPTANCE.md).

## 26. Personal OS vNext clean rewrite

Status: MVP1 through Phase 7 completed; vNext is the production authority
Date: 2026-08-01

The current control layer is functionally valuable but structurally difficult to evolve. The user accepts a high-risk rewrite because the current product is not usable enough as a daily operating system. The rewrite will therefore replace the execution model, database structure, API/application boundaries, scheduler, knowledge index, finance core and Web data architecture rather than limiting the work to an in-place refactor.

The rewrite must remain reversible. It will be built in parallel inside the same monorepo on separate ports and a separate SQLite database. The current 5273/8787 services and authority database remain available until production-copy migration, full regression, real read-only Runtime smoke and a timed rollback drill pass.

The complete architecture, migration, phase plan, deletion boundary and embedded multi-layer test plan are defined in [PERSONAL-OS-VNEXT-REWRITE-PLAN.md](PERSONAL-OS-VNEXT-REWRITE-PLAN.md). The parallel MVP1 now passes its dedicated acceptance matrix on Web 5373/API 8887. Production cutover, real Codex/OpenWorker adapters and removal of old paths remain separately gated.

### 2026-08-02 vNext Phase 4 knowledge integration

Phase 4 upgrades the existing Obsidian index into a traceable knowledge layer with KnowledgeLink, entity reverse lookup, controlled note creation, incremental file watching and an actionable knowledge workspace. Obsidian Markdown remains the source of truth; SQLite stores only searchable metadata and relationships. The implementation and regression contract is frozen in [PERSONAL-OS-VNEXT-PHASE4-SPEC.md](PERSONAL-OS-VNEXT-PHASE4-SPEC.md) and [PERSONAL-OS-VNEXT-PHASE4-ACCEPTANCE.md](PERSONAL-OS-VNEXT-PHASE4-ACCEPTANCE.md). No production port, Scheduler authority or v1 database switch is approved by this phase.

Status: **Passed in the parallel vNext environment on 2026-08-02.** The next implementation stage is Phase 5 finance depth; no 5273/8787 authority switch is approved.

### 2026-08-02 vNext Phase 5 complete finance

Phase 5 separates cash facts, budgets, reproducible calculations and operating attribution. Transfers are paired and atomic, cross-currency rates are rational integers, refunds and reversals retain lineage, allocations are bounded and idempotent, and historical mutation is only possible through a first-decision-wins ChangeProposal. The implementation contract and test gates are frozen in [PERSONAL-OS-VNEXT-PHASE5-SPEC.md](PERSONAL-OS-VNEXT-PHASE5-SPEC.md) and [PERSONAL-OS-VNEXT-PHASE5-ACCEPTANCE.md](PERSONAL-OS-VNEXT-PHASE5-ACCEPTANCE.md). Phase 7 cutover remains prohibited until this and the Phase 6 UI audit pass.

Status: **Passed in the parallel vNext environment on 2026-08-02.** Migration 7 is installed in the official v2 database; v1, 5273/8787 and Scheduler authority remain unchanged. The next implementation stage is the Phase 6 five-zone UI consolidation and audit.

### Phase 6 five-zone final integration

Phase 6 consolidates the already delivered domain capabilities into Today, Projects, Radar, Runs and Assets. It adds multi-entity global search, stable cross-zone detail routes, actionable Today attention, immutable WorkSpec-as-Skill-version visibility and editable audited Schedule rules while retaining the existing design system. The frozen implementation and test contracts are [PERSONAL-OS-VNEXT-PHASE6-SPEC.md](PERSONAL-OS-VNEXT-PHASE6-SPEC.md) and [PERSONAL-OS-VNEXT-PHASE6-ACCEPTANCE.md](PERSONAL-OS-VNEXT-PHASE6-ACCEPTANCE.md).

Status: **Passed in the parallel vNext environment on 2026-08-02.** The five-zone control surface, global search, stable entity routes, actionable Today view and audited Schedule editing passed the full UI and regression matrix. Production ports, database authority, Scheduler authority and Runtime record authority remain unchanged; Phase 7 is now the only active stage.

### 2026-08-02 vNext Phase 7 production cutover

Phase 7 completed three deterministic production-snapshot migrations, schema/import validation, production runtime packaging outside the macOS-protected source directory, a real v1 rollback, final vNext reactivation, real Codex/OpenWorker control-plane Runs, persisted Schedule restart de-duplication and read-only v1 archival.

Status: **Passed and deployed on 2026-08-02.** Formal Web `5273`, API `8787`, v2 database and the only enabled Scheduler now belong to vNext. v1 remains available only through the explicit `--generation=v1` rollback command with automation disabled. Evidence is recorded in [PERSONAL-OS-VNEXT-PHASE7-ACCEPTANCE.md](PERSONAL-OS-VNEXT-PHASE7-ACCEPTANCE.md).

### 2026-08-02 Phase 8 sovereignty cleanup

Phase 8 removes the now-retired v1 source, Runtime, database, rollback generation, MCP queue and migration-only tooling. The exact destructive boundary and recovery approach are frozen in [PERSONAL-OS-PHASE8-SOVEREIGNTY-CLEANUP-PLAN.md](PERSONAL-OS-PHASE8-SOVEREIGNTY-CLEANUP-PLAN.md); direct gates are tracked in [PERSONAL-OS-PHASE8-SOVEREIGNTY-CLEANUP-ACCEPTANCE.md](PERSONAL-OS-PHASE8-SOVEREIGNTY-CLEANUP-ACCEPTANCE.md).

Status: **Passed on 2026-08-02.** v2 business facts, Qishui/Obsidian assets and current OpenWorker remained protected; old source, database, Runtime, MCP, Skills, migration tools and background pull automation are no longer active. Phase 9 will rebuild Codex/OpenWorker MCP and repository Skills directly on the v2 contract rather than retaining the v1 MCP bridge.

### 2026-08-03 Phase 9 native Agent Gateway and Skill authority

Phase 9 adds a native v2 stdio MCP gateway above the current Core API, short-lived per-Run capabilities, immutable repository Skill snapshots, audited progress/artifact/result callbacks and approval checkpoints shared by Codex and OpenWorker. The design and direct gates are recorded in [PERSONAL-OS-PHASE9-AGENT-GATEWAY-SPEC.md](PERSONAL-OS-PHASE9-AGENT-GATEWAY-SPEC.md) and [PERSONAL-OS-PHASE9-AGENT-GATEWAY-ACCEPTANCE.md](PERSONAL-OS-PHASE9-AGENT-GATEWAY-ACCEPTANCE.md).

Status: **Passed and deployed on 2026-08-03.** Both Runtimes completed real MCP result loops, the two production schedules are pinned to versioned Skills, and no old pull worker or direct database MCP authority was restored.

### 2026-08-03 Phase 11 recoverable workflows and Obsidian deposition

Phase 11 adds immutable per-step checkpoints to the native Agent Gateway, explicit resume-versus-restart retries, and controlled result deposition after human acceptance. SQLite remains the authority for recovery state; Obsidian remains the Markdown authority. Deposition failures do not falsify Run success and are surfaced in Today for manual retry.

Status: **Passed and deployed on 2026-08-03.** Migration 11, the eighth MCP tool, desktop/mobile recovery UI, controlled `Reports`/`Generated` writes and production health gates all passed. Evidence is recorded in [PERSONAL-OS-PHASE11-RECOVERABLE-WORKFLOWS-ACCEPTANCE.md](PERSONAL-OS-PHASE11-RECOVERABLE-WORKFLOWS-ACCEPTANCE.md).

### 2026-08-04 Phase 11.1 automatic low-risk report deposition

Recurring read-only reports must not require repetitive daily acceptance. This correction adds explicit review and deposition triggers, managed Obsidian subdirectories, local-day note deduplication and actionable deposition failures. Existing WorkSpecs keep the conservative Phase 11 defaults. The canonical AI briefing and opportunity scan move through immutable revisions and explicit schedule rebinds.

Status: **Passed and deployed on 2026-08-04.** Migration 12, managed subdirectories, local-day deduplication and the automatic-success policy passed all gates. The production Obsidian Vault is registered, and the canonical 06:30 AI briefing and 08:00 opportunity scan schedules now bind immutable revision 2 WorkSpecs that write successful reports to `Reports/AI日报` and `Reports/机会雷达` without daily approval. Evidence is recorded in [PERSONAL-OS-PHASE11-1-AUTOMATIC-DEPOSITION-ACCEPTANCE.md](PERSONAL-OS-PHASE11-1-AUTOMATIC-DEPOSITION-ACCEPTANCE.md).

### 2026-08-04 Phase 12 rehearsal-to-Skill production gate

The v2 control plane will restore the proven Radar lifecycle that was lost during the rewrite: real preflight, two independent rehearsals, a failure-path drill, a database-only Skill candidate, human publication into `.agents/skills`, a new immutable WorkSpec revision and a separate schedule rebind. It reuses Phase 11 checkpoints and does not introduce arbitrary DAG orchestration.

Status: **Passed and deployed on 2026-08-04.** Migration 13 restores the real rehearsal-to-Skill lifecycle on the current v2 control plane. Two distinct passed rehearsal roots and one passed deterministic failure drill are required; pending candidates stay in SQLite; human publication creates an immutable WorkSpec revision; Schedule rebinding remains a separate explicit action. Evidence is recorded in [PERSONAL-OS-PHASE12-REHEARSAL-TO-SKILL-ACCEPTANCE.md](PERSONAL-OS-PHASE12-REHEARSAL-TO-SKILL-ACCEPTANCE.md).

The Qishui production proof also adds a bounded managed-resource lifecycle: Core starts and stops the dedicated Android AVD outside the Codex workspace sandbox, while Codex remains the visual control loop. Two live isolated rehearsals and a failure drill passed before the daily `09:00 Asia/Tokyo` schedule was enabled.

### 2026-08-04 Phase 13 production automation operations

Phase 13 turns Scheduler execution into an operator-readable ledger. Every planned occurrence records whether it fired on time, caught up after sleep/restart, was skipped by policy or failed before a Run could start. Radar then combines that evidence with the current checkpoint, latest success, next trigger, Obsidian deposition, duration, actual cost and an explainable failure category. Today surfaces unresolved schedule misses without adding an external notification service or a new task queue.

Status: **Planned.** The implementation and test contract are frozen in [PERSONAL-OS-PHASE13-PRODUCTION-OPERATIONS-SPEC.md](PERSONAL-OS-PHASE13-PRODUCTION-OPERATIONS-SPEC.md) and [PERSONAL-OS-PHASE13-PRODUCTION-OPERATIONS-ACCEPTANCE.md](PERSONAL-OS-PHASE13-PRODUCTION-OPERATIONS-ACCEPTANCE.md). No Phase 13 code may be merged until every acceptance row has direct evidence.
