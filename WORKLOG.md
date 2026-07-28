# Work Log

## 2026-07-28 - MVP2 automated agent dispatch

### Plan

- Re-read the current repository, `AGENTS.md`, MVP1/MVP1.1 acceptance matrices, and the approved automated-agent architecture before implementation.
- Confirmed the fixed implementation order: common AgentRun -> Dispatcher and Codex -> OpenWorker MCP Pull -> Approval Inbox -> reliable local operation.
- Recorded 30 direct-evidence acceptance requirements in `docs/MVP2-ACCEPTANCE.md`, including the requested full MVP1+MVP2 feature inventory and UI-to-SQLite E2E traces.
- Preserved the independent OpenWorker installation and loopback-only port baseline in `docs/AUTOMATION-PLAN.md`; installation alone is not treated as integration evidence.
- Kept every MVP2 acceptance row Pending until Work and Review produce direct evidence.

### Work - Phase A: common run model

- Extended Task with typed task kind, executor, execution mode, trigger configuration and timezone, risk, retry count, scheduling timestamps, and pause state while preserving manual/human defaults for MVP1 records.
- Added the generic AgentRun, typed event, approval request, and run-state transition contracts in the domain package. A running agent cannot transition directly to Done.
- Added additive SQLite migration logic for existing task tables and created `agent_runs`, `agent_run_events`, and `approval_requests` without deleting the legacy Codex tables.
- Migrated legacy Codex runs and events into the generic tables with preserved ids, thread ids, result data, timestamps, and a deterministic legacy idempotency key.
- Changed the Codex database compatibility methods to read and write the generic tables. The old `/api/codex/runs` surface remains compatible, while new runs no longer write `codex_runs`.
- Added immediate transactions that reject duplicate idempotency keys and a second active run for the same task.
- Added migration, compatibility, duplicate-run, approval-audit, default-value, and illegal-transition tests.

Phase A verification:

- Full automated gates passed with 5 test files / 31 tests.
- A SQLite backup of the current development database migrated with 4 tasks, 2 legacy Codex runs, and 2 matching generic runs; `PRAGMA integrity_check` returned `ok` and `foreign_key_check` returned no rows.
- TypeScript, ESLint, all production builds, and `git diff --check` passed.

### Work - Phase B: Dispatcher and Codex automation

- Added deterministic routing that honors explicit executor choices, routes repository code work to Codex, routes approved business/document work to OpenWorker, and sends unknown or automatic high-risk work to the human queue.
- Added a shared `ExecutorAdapter` contract with Codex and OpenWorker Pull implementations plus health reporting.
- Added the local Agent Dispatcher with manual dispatch, due-task ticks, automatic Codex execution, retry dispatch, automation pause, queued-run cancellation, and executor health APIs.
- Preserved the Codex demo/live adapter and compatibility API while requiring a real Git repository and non-empty acceptance criteria for live execution. Live continues to use workspace-write, approval `never`, and disabled network access.
- Added transactional claim, heartbeat, lease expiry, cancellation, failure classification, retry scheduling, and maximum-attempt blocking behavior.
- Added generic Agent Run HTTP list/detail/event/cancel/retry routes and a manual dispatcher tick route. Existing Codex routes remain available.
- Started the Dispatcher on the local Server interval and stop it during graceful shutdown.

Phase B verification:

- Automatic Codex demo integration passed Ready -> Running -> Needs Review and retained the human acceptance gate.
- Router tests covered explicit, Codex, OpenWorker, unknown, and automatic high-risk decisions.
- Lease tests covered claim exclusivity, 30-second heartbeat timing, 2-minute expiry, retryable recovery, and final-attempt Blocked behavior.
- A file-backed restart test proved that reopening the Server database with a valid claimed lease creates no duplicate run.
- API tests covered OpenWorker queue dispatch/list/pause/cancel and a second unique retry attempt.
- Full gates passed with 6 test files / 40 tests, TypeScript, ESLint, production builds, and patch hygiene.

## 2026-07-28 - Plan

- Cloned the empty remote repository into `/Users/frigidcrow/Documents/Codex/dev/personal-os`.
- Confirmed `main` has no commits and `origin` points to `git@github.com:FrigidCrow/personal-os.git`.
- Defined MVP1 scope, architecture, Codex interaction contract, design contract, work packages, gates, and definition of done.
- Created a requirement-level acceptance matrix before implementation.

## Work

### Domain, database, and API foundation

- Created an npm workspace for Web, API, MCP, domain, and database modules.
- Added strict TypeScript, ESLint, Vitest, workspace build scripts, and environment examples.
- Implemented task state-transition rules and evidence-backed opportunity validation.
- Implemented SQLite migrations, repositories, demonstration seed data, dashboard aggregates, reports, experiments, assets, and Codex run persistence.
- Implemented the Hono API for dashboard, projects, tasks, opportunities, experiments, assets, reports, and run reads.
- Added domain, database, and API integration tests.
- Verified 14 tests pass and TypeScript typecheck passes.

### Web control plane

- Applied the `design-taste-frontend` design read with `DESIGN_VARIANCE=5`, `MOTION_INTENSITY=3`, and `VISUAL_DENSITY=7`.
- Built a responsive React control plane with Radix Themes, custom semantic tokens, and Phosphor Icons.
- Implemented dashboard, project management, task board, opportunity radar, experiments, income assets, and Codex review pages.
- Added accessible light, dark, and system themes, mobile navigation, loading, empty, error, and demo states.
- Added project create/update/delete and real repository/Obsidian path editing.
- Added explicit Demo versus Live Codex assignment controls and preserved a human approval gate.
- Replaced React Router with the smaller SPA-only Wouter router after a new React Router RSC advisory appeared; `npm audit` now reports zero vulnerabilities.

### Codex, MCP, and opportunity radar

- Implemented a deterministic Demo adapter and a live `@openai/codex-sdk` adapter with thread resume, workspace binding, artifact capture, and verification summaries.
- Added server-side validation that Live tasks point to an existing local Git repository.
- Added persisted run events, polling reads, and a terminal Server-Sent Events stream.
- Implemented the local STDIO MCP server with 12 tools. MCP can read context and submit work for review but cannot approve work or perform payments, purchases, outreach, publishing, or production deployment.
- Added protocol-level MCP tests using an in-memory client/server transport.
- Implemented Demo and Live opportunity reports, evidence requirements, a five-item maximum, manual generation, and a configurable local cron schedule.
- Created and validated three repository Skills: daily focus, opportunity radar, and weekly review.
- Added project-scoped Codex MCP configuration and copy-pasteable global setup guidance.

### Integration evidence collected during Work

- Codex SDK read-only smoke returned `PERSONAL_OS_CODEX_SDK_OK` with a persisted thread id.
- A live Codex thread called `personal_os.get_today_context` through MCP and returned `PERSONAL_OS_MCP_LIVE_OK 2`.
- The rendered Web flow created a real project and task, started Live Codex run `efa93fba`, received `PERSONAL_OS_LIVE_WEB_OK`, reported two successful checks and zero changed paths, then required explicit human approval.
- The rendered Web flow also completed and approved a clearly labeled Demo run and converted an evidence-backed opportunity into a capped experiment.
- Desktop dark, desktop light, mobile navigation, and mobile single-column layouts were inspected in the in-app browser.
- The previous generated development database was moved to `work/old-db/personal-os.db-before-chinese-seed`; it remains recoverable and is ignored by Git.

## Review

- Audited the full A01–A24 acceptance matrix and recorded requirement-level evidence.
- Added a missing API regression test for income-asset stage and maintenance visibility.
- Bound the unauthenticated API to `127.0.0.1` by default after the network-exposure review.
- Re-ran 24 tests, typecheck, lint, production builds, dependency audit, diff checks, Skill validation, API smoke, and built MCP smoke.
- Confirmed all 24 acceptance requirements passed. Final evidence is recorded in `REVIEW.md` and `docs/MVP1-ACCEPTANCE.md`.

## 2026-07-28 - Visual redesign follow-up

- Reopened the frontend after the first visual direction was rejected as too static and generic.
- Applied `design-taste-frontend` again as a redesign overhaul with variance 8, motion 7, and density 5.
- Audited the original small typography, repeated card hierarchy, wide text sidebar, flat metric rail, and weak interaction feedback.
- Researched Morrow, Siena, Awwwards interaction design, and Raycast as references without copying assets or layouts.
- Replaced the sage and cyan admin styling with a graphite and signal-orange product system.
- Added a compact command rail, shared active-navigation motion, route transitions, animated dashboard orbit, count-up metrics, radar motion, tactile controls, and responsive modal navigation.
- Self-hosted Geist Variable and retained Radix Themes plus Phosphor as the only component and icon systems.
- Tested Dashboard, Projects, Tasks, Radar, Experiments, Assets, Review, project dialog, mobile navigation, and light/dark themes in the in-app browser.
- Confirmed a 390px document has no horizontal overflow and that motion collapses under `prefers-reduced-motion`.
- Final production Lighthouse: Performance 94, Accessibility 100, Best Practices 100, LCP 2499.6ms, CLS 0, and TBT 97ms.
- Re-ran 24 tests, typecheck, lint, all production builds, dependency audit, and diff checks successfully.

## 2026-07-28 - MVP1.1 closeout

### Plan

- Added a five-part MVP1.1 closeout section to `docs/PLAN.md` before implementation.
- Added `docs/MVP1.1-ACCEPTANCE.md` with nine requirement-level acceptance rows.
- Preserved the MVP1 product boundary, local-first data ownership, and human approval gate.

### Work

- Added confirmed task deletion to the editable task detail dialog and used the existing database cascade for related Codex run records.
- Added experiment detail, full editing, status changes, and an explicit measured-result API and Web flow.
- Added `/projects/:id` with outcome, next action, revenue, deadline, repository, Obsidian linkage, and associated tasks.
- Added one accessible global success-toast provider and connected all existing successful Web mutations.
- Added complete Codex run detail, persisted event timeline, EventSource consumption, cache updates, reconnect feedback, and terminal stream shutdown.
- Corrected new Codex runs to store the complete execution prompt snapshot instead of only the task title.
- Added API regression coverage for project detail hydration, experiment editing/result recording, full prompt snapshots, persisted events, and an SSE stream opened while a run is active.
- Kept database migrations unchanged because the required experiment, project, task, run, and event fields already existed.

### Review

- Browser created and deleted a temporary task through the confirmation flow, then verified the record was gone.
- Browser edited an experiment, recorded a result, and restored the demonstration record to its original title, status, and empty result.
- Browser opened a real project detail route and a Live Codex audit dialog with thread, directory, result, verification, and four events.
- Browser checked mobile project/detail surfaces at 390px, light and dark rendering, success feedback, and console errors; no horizontal overflow or browser error was found.
- Final gates: 5 test files / 26 tests, TypeScript, ESLint, production build, dependency audit, and patch hygiene passed.
