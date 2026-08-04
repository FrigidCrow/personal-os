# Work Log

## 2026-08-04 - Phase 12 rehearsal-to-Skill production gate

### Plan

- Restore the proven preflight → two independent rehearsals → failure drill → candidate → human publish lifecycle on the current v2 control plane.
- Reuse Phase 11 checkpoints, keep candidates database-only and keep Schedule rebinding separate from publication.

### Work

- Added migration 13 with Run mode/root lineage, immutable evaluations and Skill candidates.
- Added deterministic rehearsal evaluation, schema failure drills, evidence gates, candidate validation and human publication into the existing repository Skill registry.
- Publication creates a new immutable WorkSpec revision pinned to the exact Skill hash. The source WorkSpec and every Schedule remain unchanged until explicit rebind.
- Added a `验证晋级` Radar surface with honest evidence counts, evaluation actions, full candidate content review, human publish and explicit final rebind.

### Review

- Rehearsal mode is present in the Runtime prompt and MCP context; it cannot auto-deposit, enter production review or modify Schedule firing state.
- Nonterminal Runs cannot be evaluated. Retry roots are stable, failed/cancelled evidence does not count, pending candidates do not touch the filesystem and stale/double publication is rejected.

### Test

- 112 unit/integration tests, 14/14 Playwright journeys, TypeScript, ESLint, production builds and patch hygiene passed.
- Production backup completed; migration 13, Web/API health, SQLite quick/foreign-key checks and the live empty promotion gate passed. Exactly two existing schedules remain enabled and retain their Phase 11.1 WorkSpec bindings.

## 2026-08-04 - Phase 11.1 automatic Obsidian deposition

### Plan

- Remove repetitive daily acceptance from only the pinned-Skill, low-risk Codex/OpenWorker report path while preserving the conservative review requirement everywhere else.
- Register the real Obsidian Vault, keep writes below managed report directories and deduplicate recurring reports by local calendar day.

### Work

- Added migration 12, explicit review/deposition triggers, managed subdirectories, local-time periods and persisted deposition deduplication keys.
- Added automatic completion deposition, same-day note reuse, unreviewed-AI disclosure, pinned Skill provenance and retry routing without changing Run truth when the file write fails.
- Added Radar controls for write timing, subdirectory, deduplication period and timezone.
- Registered `/Users/frigidcrow/Documents/Obsidian Vault`, indexed it and rebound the two enabled production schedules to immutable revision 2 WorkSpecs: AI briefing → `Reports/AI日报`; opportunity scan → `Reports/机会雷达`.

### Review

- Legacy WorkSpecs and Phase 11 note JSON are normalized to conservative defaults; automatic policy requires a real pinned repository Skill and an Agent Runtime.
- Traversal and nested symlink paths are rejected. Failed and cancelled Runs do not write notes; a same-day rerun reuses the managed note instead of overwriting or duplicating it.

### Test

- 109 unit/integration tests, 13/13 Playwright journeys, TypeScript, ESLint, production builds and patch hygiene passed before deployment.
- Production backup completed; migration 12 started cleanly; SQLite `quick_check` is `ok`, foreign-key check is empty and exactly two schedules remain enabled.

## 2026-07-30 - Asset investment and return ledger planning

### Plan

- Extend the future Asset area with an operating-unit ledger that answers actual money invested, actual money received, cash profit, payback, ROI and time invested for one Project, Radar, product, experiment or custom initiative.
- Keep actual cash, expected amounts and time as separate views so forecasts cannot masquerade as realized returns.

### Work

- Added `docs/ASSET-ROI-LEDGER-PLAN.md` with the accounting unit, entry lifecycle, calculation rules, attribution, shared-cost allocation, correction semantics, UI structure, MVP boundary and direct calculation examples.
- Integrated the ledger into the control-layer Asset information architecture and Phase 3 acceptance checklist.
- Added the initiative to `docs/PLAN.md`; no schema, API or UI implementation was started in this planning change.

### Review

- The cash ledger is deliberately narrower than accounting software: no payment connection, tax workflow, invoicing automation or silent exchange-rate lookup.
- Actual ROI uses only paid costs and received revenue. Runtime usage with an unknown price remains unknown, and time remains hours unless the user explicitly configures an opportunity-cost view.

### Test

- Documentation links and patch hygiene checked; implementation checks remain Pending by design.

## 2026-07-30 - AI Runtime visual control layer planning

### Plan

- Reframe Personal OS as the local visual control layer above Codex and OpenWorker rather than a second task manager.
- Retire the Task Kanban from primary navigation without deleting task data or compatibility APIs.
- Make Workflow, Run, Artifact, Approval, Project Context and Runtime Capability the user-facing objects.

### Work

- Added `docs/AI-RUNTIME-CONTROL-LAYER-PLAN.md` with the product definition, five-item information architecture, Runtime visibility contract, non-destructive Task queue retirement and three implementation phases.
- Added a direct-evidence acceptance checklist. Only Phase 0 is checked; navigation and UI work remain explicitly Pending.
- Updated the Qishui source definition and live Radar revision 8 with the verified official-download versus exportability distinction, five explicit audio coverage states and a no-repeat rule for known protected storage.
- Updated the live Task acceptance criteria and ran revision-8 preflight successfully with nine checks.
- Attempted to create an immutable Skill Candidate. The platform correctly refused promotion because revision 8 still requires two independent successful rehearsals and one failure drill; no gate was bypassed and no schedule was enabled.

### Review

- The current seven-item navigation and repeated Task/Run/Radar surfaces confirm that the problem is object-model duplication, not missing Kanban polish.
- Phase 0 is truthful across Radar, repository Skill, local library and Obsidian. The Qishui offline file remains `protected_storage`, not `available`.
- The broader control-layer redesign is a plan only; TasksPage and all existing data remain intact until Phase 1 acceptance is implemented.

### Test

- Personal OS passed 104/104 tests across 9 files, TypeScript, ESLint, all production builds and patch hygiene.
- Live health reports both Codex and OpenWorker available, SQLite quick check `ok`, zero foreign-key violations and no stale Runs.
- Live Qishui revision 8 preflight passed 9/9; its schedule remains disabled and Skill promotion truthfully reports two successful rehearsals plus one failure drill still required.

## 2026-07-30 - Qishui minimum daily library sync

### Plan

- Narrow the current production milestone to official 热歌榜 Top10 and 新歌榜 Top10, title/artist extraction, cross-day dedupe, entitled official download, canonical local audio paths and automatic Obsidian daily notes.
- Make the versioned `qishui-daily-sync` Skill and selected AI Runtime the workflow authority. The AI owns ordering, screenshot judgment, retries and recovery; local code exposes only AVD lifecycle, OCR and deterministic archive/validation operations.
- Prove one real official download can be exported from the current emulator before enabling batch download. Preserve login, VIP, DRM and protected-storage boundaries as explicit gates.
- Keep audio binaries local-only and ignored by Git. Repeated tracks reference the existing canonical path instead of copying or downloading the file again.

### Work

- Created `.agents/skills/qishui-daily-sync` with runtime, recovery and success contracts plus an atomic tool reference; generated `agents/openai.yaml` and passed Skill validation.
- Removed the intermediate `qishui_device_tool.py` after review showed it merely wrapped ADB actions that Codex can perform directly. Kept `qishui_archive_tool.py` only for strict single-chart persistence and deterministic library/diff/Obsidian synchronization.
- Deleted the obsolete 726-line monolithic daily wrapper, the 1161-line UIAutomator bridge and its bridge-specific test suite after removing every production and documentation reference.
- Updated the live Qishui Radar to revision 7 with `qishui-daily-sync` and direct AI-driven ADB/image interaction. Codex is the current supported runtime; automatic OpenWorker fallback is disabled until its declared tool manifest proves local Shell/ADB and image capability.
- Changed Personal OS preflight to verify the Skill, AVD and atomic tools without launching the emulator. The selected Skill runtime now owns start and stop.

### Review

- Review found a Python-version incompatibility in the real archive CLI (`zip(strict=True)`). It was removed before any archive mutation occurred and the live sync was rerun successfully.
- Review confirmed the screenshot is the evidence authority: a Codex-driven atomic smoke used direct ADB, inspected the visible 热歌榜 and 新歌榜, made one visually justified swipe per chart, and confirmed continuous ranks 1–10 through screenshots plus Vision OCR. An intentionally shortened deep link opened a blank page; Codex detected it visually, restored the full configured URI and recovered without adding a navigation wrapper.
- After the user completed login, the one-track official download succeeded inside 汽水音乐「我的 → 下载」. The client explicitly limits it to local playback during the VIP entitlement and exposes no media file outside app-private storage, so the verified coverage state is `protected_storage`; no audio path is fabricated and no media is added to Git.

### Test

- Qishui: 11/11 unit tests passed; Skill validation passed; the deterministic archive CLI loads; real dual-chart archive sync wrote 10 + 10 entries and the Obsidian daily note idempotently.
- Personal OS: 104/104 tests, TypeScript, ESLint and all production builds passed.
- Live API health passed, revision-7 Radar preflight passed all nine checks including the AI Runtime device-capability gate, and the deployed API/Web LaunchAgents were restarted from the new build.

## 2026-07-29 - Radar platform implementation

### Plan

- Froze implementation scope to design Phases 1 through 3: unified Radar control plane, real rehearsal, deterministic promotion gates, immutable Skill versions, explicit schedule pinning, and non-destructive import of the existing opportunity radar.
- Deferred Phase 4 arbitrary branching, parallel orchestration, shared collection caches, and automatic Skill improvement suggestions.
- Added `docs/RADAR-PLATFORM-ACCEPTANCE.md` with 28 Pending checks and explicit release, migration, rollback, safety, UI, and test gates before changing business code.
- Kept the specialized opportunity scheduler as the only scheduling authority for the imported opportunity radar during this MVP so migration cannot create duplicate daily runs.

### Work

- Added typed Radar definition, source policy, input/output contracts, ordered steps, deterministic success policy, capability manifest, lifecycle, run mode, preflight, step, evaluation, and immutable Skill Version contracts.
- Added deterministic output checks for content length, unique source URLs, required sections, Chinese content, forbidden phrases, and JSON parseability.
- Added additive SQLite tables for definitions, preflights, step state, run evaluations, and Skill versions plus `run_mode`, definition revision, and Skill Version pinning on Agent Runs.
- Imported the specialized opportunity radar idempotently as a manual control-plane Task with its approved repository Skill. Its existing `radar_schedule` remains the only execution authority, preventing a duplicate generic Cron.
- Added database state transitions for draft revisioning, persisted preflight, real step updates, two-success plus failure-drill promotion readiness, immutable candidate creation, human approval, and explicit production version binding.
- Kept a live schedule pinned when its editable definition advances to a new draft revision. Production Runs record the approved Skill's definition revision rather than the newer unapproved draft.

Work A verification:

- Domain and database suites pass with 2 files / 39 tests.
- TypeScript passes.
- Focused tests cover unsafe Skill names, path traversal, duplicate step keys, deterministic validation, rehearsal metadata, real step state, promotion blocking, immutable approval, pinned-version execution, and idempotent opportunity-radar import.

### Work B - execution and promotion lifecycle

- Added the Radar Platform service and HTTP routes for create/edit, preflight, real rehearsal, deterministic evaluation, failed-step checkpoint retry, failure drill, Skill candidate generation, human approval, explicit schedule binding, and production run-now.
- Extended Dispatcher, Codex and OpenWorker metadata with rehearsal/production mode, definition revision and pinned Skill Version. Generic production always injects the approved content and SHA-256 rather than the editable draft.
- Added `update_radar_step` to Personal OS MCP and the OpenWorker allowlist. Both rehearsal and production runs now initialize persisted steps; terminal checkpoints are immutable at the MCP boundary.
- A failed step creates a new rehearsal Run, copies prior passed/skipped summaries as checkpoints, increments retry count only on the resumed step, and keeps the failed source Run unchanged.
- Added the two-success plus failure-drill promotion gate. Candidate content stays in SQLite until the local user approves it; approval validates frontmatter, name, size, credential patterns, path safety, content hash and unrelated-Skill conflicts before atomic materialization.
- Added a Codex-specific project gate. A Codex Radar cannot be created or preflighted without a project whose local Git repository still exists; OpenWorker remains valid for standalone read-only research.
- Production schedules bind an exact approved Skill Version. Tests execute two consecutive production occurrences with the same version, definition revision and content hash.

### Work C - unified Radar Web control plane

- Renamed the navigation destination to `雷达`, kept the original opportunity reports intact, and added multi-Task cards with lifecycle, executor, pinned version, next run and latest status.
- Added one six-tab Task detail surface: `定义`, `流程`, `预执行`, `Skill`, `定时`, and `运行记录`.
- Added the complete UI flow for Radar draft creation/editing, Codex project selection, preflight, real rehearsal, deterministic evaluation, failure drill, checkpoint retry, promotion readiness, Skill content/diff/evidence review, human approval, schedule pinning and run-now.
- Used persisted run steps only. Missing events render `等待执行器`; failed steps show their actual error and a retry action; no percentage or invented phase is generated.
- Preserved the graphite/signal-orange Radix/Phosphor system and added explicit loading, empty, error, success, active and blocked states. The existing opportunity Radar remains the first built-in Task, not a second scheduler.

### Review

- Review found and fixed five implementation gaps before release: raw English schedule status, missing detail close control, a 475px intrinsic mobile dialog width, Codex creation without a project binding, and the design requirement for failed-step checkpoint retry.
- Review also found that a hash-only approval card did not let a human actually review generated Skill content. The Skill tab now exposes complete content, change summary and evidence Run ids before approval.
- Production Radar dispatch now initializes the same persisted step contract as rehearsal, and generated Skills explicitly require `update_radar_step`; MCP rejects submission while required steps remain incomplete.
- The pre-migration backup is `backups/personal-os-2026-07-29T08-28-30-261Z.db`. Backup and live databases both pass `integrity_check`; live foreign-key violations are zero. Existing projects, runs, opportunities, reports, experiments, assets and schedule counts are unchanged. The only intentional legacy-table increase is one imported manual `research_radar` Task.

### Test

- Unit/integration: 8 files / 90 tests passed across Domain, SQLite, server, Dispatcher and MCP.
- Browser: 9/9 Playwright journeys passed. The Radar journey creates a draft, passes preflight, deliberately fails a real step, resumes from a persisted checkpoint, completes two independent successful rehearsals, evaluates both, runs the failure drill, reviews and approves the Skill, and pins the schedule; HTTP and SQLite evidence is attached to the trace.
- TypeScript, ESLint, all production builds and `git diff --check` pass.
- In-app browser review covered the deployed 5273 page, all six tabs, explicit close behavior, desktop layout and 390 x 844 mobile layout. The mobile document width equals the viewport width.
- Live API health reports SQLite `ok`, `quickCheck=ok`, zero foreign-key violations, zero active/stale Runs and zero pending approvals after deployment.
- Final deployment moved the LaunchAgent authority database to `~/.local/share/personal-os/data/personal-os.db` after an online backup and stopped-write SQLite backup. The migrated database preserves 1 project, 2 Tasks, 7 Agent Runs, 23 opportunities, 2 reports, 1 Radar definition and 1 approved Radar Skill Version; `quick_check` passes and foreign-key violations remain zero. The former repository database and timestamped backups were retained.
- OpenWorker now runs from a user-level runtime outside macOS-protected `Documents`; its `personal_os` MCP is connected with 26 tools and explicitly exposes `update_radar_step`. The production API reports both Codex and OpenWorker available.
- Final post-deployment regression repeated 8 files / 90 tests, TypeScript, ESLint, production builds, 9/9 Playwright journeys, an empty browser error log, desktop visual review and live API/database health checks.

## 2026-07-29 - Radar platform design

### Plan

- Reframed the specialized opportunity radar as one Task inside a unified `雷达` research-automation control plane.
- Kept the current task scheduler, Agent Run lifecycle, OpenWorker/Codex adapters, approval gate, SQLite authority and repository Skills as foundations rather than proposing a second execution system.

### Design work

- Added `docs/RADAR-PLATFORM-DESIGN.md` with the product boundary, Task-to-Skill promotion lifecycle, rehearsal model, version pinning, ordered pipeline contract, data model, UI information architecture, API draft, capability manifest and phased implementation plan.
- Defined Task as an editable experimental definition and Skill Version as an immutable, approved production protocol.
- Required real read-only rehearsal, deterministic validators, two independent successes, a failure-path exercise and human approval before production scheduling.
- Designed a non-destructive migration that imports the existing opportunity radar, schedule and repository Skill while preserving all opportunity and report data.
- Recorded four implementation-time product decisions and provided recommended defaults; no business code, live database or existing schedule was changed.

### Verification

- Checked the design against the current `tasks`, `agent_runs`, Cron lifecycle, OpenWorker Pull model, Radar-specific evidence gates and `.agents/skills` layout.
- Confirmed the plan does not authorize automatic external writes, secret storage, Skill self-approval or silent production-version changes.

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

### Work - Phase C: OpenWorker MCP Pull contract

- Added the planned MCP tools for claimable work, atomic claim, execution context, heartbeat, typed events, approval request/status, artifacts, result submission, and failure handling.
- Kept the legacy Codex-oriented MCP tools for compatibility, but changed the shared event and artifact paths to the generic AgentRun model.
- Added database operations that list only queued/unpaused work, atomically acquire a lease, persist artifacts with events, and transactionally submit a worker result to Needs Review.
- Added fake-worker tool and in-memory MCP protocol tests covering one successful claimant, execution context safety policy, heartbeat, timeline events, artifact persistence, result submission, and pending approval blocking.
- Built the MCP bundle and added it to the running OpenWorker instance as `personal_os`. The OpenWorker config is connected and limits actual session exposure to the ten Pull-workflow tools; these control-plane writes do not require OpenWorker's duplicate approval layer.
- Created OpenWorker automation `task-c53f71a26e` (`Personal OS Pull Worker`, every five minutes, Asia/Tokyo) with strict one-task, local-artifact, approval, and Needs Review instructions.
- Paused that automation because OpenWorker reports `model_ready: false` and `has_key: false`; no provider key exists in the process environment. No key was read, copied, logged, or stored in the repository.

Phase C verification so far:

- Fake OpenWorker contract passed through real MCP client/server protocol and SQLite persistence.
- OpenWorker `/v1/mcp` reports `personal_os` connected with the intended include-tool whitelist and no last error.
- Full gates passed with 6 test files / 43 tests, TypeScript, ESLint, production builds, and patch hygiene.
- The required real OpenWorker model run remains Pending until a model is configured in OpenWorker Settings; the paused automation can then be enabled and run without code changes.

### Work - Phase D: Web control and human approval

- Added human-only HTTP operations to list, inspect, approve, reject, and expire consequential action requests. Approval resolution returns the worker to Running with a renewed lease; expiry defaults to rejection.
- Added generic Agent Run SSE, final acceptance, final rejection with a persisted reason, and compatibility delegation from the legacy Codex acceptance route.
- Added database transactions that keep Task and AgentRun final states synchronized. Agents still have no MCP method that can approve an action or mark a result Done.
- Added task automation controls to the create and edit surfaces: task type, explicit or automatic executor, manual or automatic execution, trigger, cron/timezone, risk, maximum attempts, and next-run time.
- Extended the task board with route, automation, risk, and latest-run context plus dispatch, pause, resume, cancel, retry, and review controls.
- Replaced the Codex-only review surface with a unified Agent control plane for Codex and OpenWorker. It includes filters, live events, session and attempt metadata, artifacts, failures, final accept/reject, and an Approval Inbox with destination, action, preview, and explicit decisions.
- Preserved the graphite and signal-orange visual system, Radix Themes, Phosphor icons, responsive behavior, reduced-motion behavior, and the existing `/review` route while changing its information architecture from a Codex list to a human decision surface.

Phase D verification so far:

- Database tests cover approval resolution, duplicate-resolution rejection, expiration-as-rejection, lease renewal, final acceptance, and final rejection.
- API tests cover approval list/resolve, duplicate resolution, generic Agent Run SSE, final acceptance, final rejection, and SQLite state assertions.
- Full automated gates passed with 6 test files / 48 tests, TypeScript, ESLint, production builds, and patch hygiene.
- Rendered desktop, mobile, keyboard, and complete request/response/SQLite E2E evidence remains scheduled for the dedicated Review stage.

### Work - Phase E: reliable local operation

- Added validated cron parsing with IANA timezone support and deterministic next-occurrence calculation.
- Completed all four trigger policies: manual dispatch, cron dispatch, internal event dispatch with stable event ids, and one-time dependency dispatch after prerequisite acceptance.
- Cron now advances `nextRunAt` before dispatch. Missed schedules are skipped by default; explicit `catchUp` runs only the latest missed occurrence and advances immediately to the next future time.
- Recurring cron and event tasks can be prepared for another run only after their previous result was accepted. Active-run and idempotency constraints remain enforced.
- Added operational health reporting for SQLite quick check, foreign keys, active runs, expired leases, pending approvals, and executor adapters. The Agent control plane now shows executor and database health.
- Added build-backed macOS LaunchAgent install and uninstall scripts for API `8787` and Web `5273`, with loopback-only binding, KeepAlive, logs, dry-run defaults, and explicit `--apply` mutation.
- Added online SQLite backup with source integrity validation and a 14-backup retention default. Added dry-run-first privacy cleanup for resolved approval previews and old terminal-run prompt snapshots.
- Added `docs/OPERATIONS.md` with exact ports, install, health, restart, logs, backup, restore, privacy, trigger, and OpenWorker MCP instructions.
- Installed both LaunchAgents on this machine after creating a valid database backup, replacing the temporary Personal OS development processes. OpenWorker remains independent on Web `5274` and server `8765`.

Phase E verification so far:

- Trigger tests cover cron advancement, duplicate tick suppression, default missed-run skip, one-item catch-up, stable event id behavior, recurring event rearm, and dependency dispatch exactly once.
- API tests cover automation validation, event dispatch, health response, and persisted AgentRun creation.
- LaunchAgent dry-runs produced only the two intended plist targets. Applied services both reported `state = running`; API health returned database `ok` and Web returned HTTP 200.
- A forced API restart changed PID `20596` to `20749`; AgentRun count remained 2 before and after, and the post-restart health check passed.
- The online backup passed `quick_check = ok`, retained 4 tasks and 2 AgentRuns, and returned zero foreign-key violations.
- Full automated gates passed with 6 test files / 54 tests, TypeScript, ESLint, and patch hygiene. A fresh production build and rendered E2E remain part of Review.

### Review - MVP2 full acceptance and E2E

- Inventoried every MVP1, MVP1.1 and MVP2 function in `docs/FULL-E2E-ACCEPTANCE.md`; no required capability remained unimplemented.
- Added a Playwright acceptance harness with isolated API, Web and SQLite state. Seven browser cases capture mutation request/response payloads and query the resulting SQLite rows directly.
- Covered shell navigation, project CRUD, task automation, Codex Demo acceptance, approval approve/reject, final review rejection, task/project deletion, and opportunity/experiment/asset flows.
- Exercised negative paths that had only positive coverage during Work: approval rejection, final result rejection with reason, task deletion and project deletion.
- Completed real Codex run `2485d0f9-f6e2-4cf1-9f62-87fe7009b761` through Web acceptance; the isolated repository received only the requested acceptance artifact.
- Completed real OpenWorker/Ollama run `6088109f-3b11-4e2f-a4a3-027b5c6a1a5e` through list, atomic claim, heartbeat, context read, result submission and Web acceptance.
- Fixed the five real integration gaps documented in the acceptance report. OpenWorker commit `428adf4` attaches MCP tools to headless automation and enforces an exact runtime allowlist.
- Final browser E2E: 7/7 passed in 41.1 seconds. Personal OS automated gates: 6 files / 57 tests, typecheck, lint, production build, zero dependency vulnerabilities and clean patch hygiene.
- OpenWorker regression gates: 933 passed, 1 skipped; focused MCP/automation subset: 63 passed.
- Operational smoke verified loopback listeners on 5273, 8787, 5274 and 8765, healthy SQLite, running Personal OS LaunchAgents, backup/privacy/install dry-runs and zero pending approvals after review.

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

## 2026-07-28 - Recurring task lifecycle correction

### Plan

- Defined recurring Cron tasks as persistent automation definitions rather than one-off task executions.
- Added direct acceptance criteria to `docs/PLAN.md` before implementation, including a dedicated board column, pause behavior, explicit completion, migration, and verification.

### Work

- Added `automation_completed_at` as a nullable SQLite lifecycle marker. Existing databases migrate without deleting tasks, runs, or artifacts.
- Rearmed historical automatic Cron tasks left in Done by the previous per-run acceptance behavior. The live `每日 AI 新闻与新技术晨报` task migrated to Ready with its schedule and history intact.
- Changed recurring-run acceptance so the Agent Run becomes Done while the recurring task returns to Ready.
- Added an explicit completion operation that rejects unresolved runs, pauses future execution, records the completion time, and then moves the task to Done.
- Added an active-recurring domain rule and used it to prevent completed schedules from being dispatched or resumed.
- Added a dedicated `定时任务` board column immediately after Inbox. Active and paused Cron tasks are excluded from ordinary workflow columns, remain clickable, show next-run and latest-run context, and cannot be accidentally dragged into a one-off task state.
- Added `启用定时任务`, pause/resume, review, and confirmed `结束定时任务` controls. Long scheduled descriptions are clamped on cards while remaining complete in task detail.
- Applied the relevant `design-taste-frontend` product-UI checks with variance 4, motion 2, and density 8, preserving Radix Themes, Phosphor icons, the current theme, compact hierarchy, focus behavior, and mobile scroll-snap navigation.

### Review

- Unit and integration tests: 7 files / 70 tests passed.
- Full Playwright acceptance: 8/8 passed, including the new scheduled-column lifecycle from create to pause to explicit completion.
- Focused recurring-task browser regression passed again after moving the column into the initial viewport.
- TypeScript, ESLint, full production build, and patch hygiene passed.
- Live API confirmed `每日 AI 新闻与新技术晨报` is Ready, active, not completed, and scheduled for 06:30 Asia/Tokyo.
- Rendered desktop and 390px mobile evidence is stored in `review-artifacts/scheduled-task-column.png` and `review-artifacts/scheduled-task-column-mobile.png`.

## 2026-07-29 - Opportunity radar monetization gate and OpenWorker recovery

### Plan

- Diagnosed the two reported scheduled failures before changing code. The AI news task exhausted Codex usage on all three attempts; the opportunity radar failed for the same reason. OpenWorker's `no claimable tasks` message was a successful idle poll, not either failed execution.
- Added acceptance criteria to `docs/PLAN.md` for editable discovery rules, a non-optional sales-channel gate, dedicated OpenWorker radar claiming, correct idle reporting, and live executor recovery.
- Applied the product-UI portions of `design-taste-frontend` with variance 4, motion 2, and density 8, preserving the current graphite, orange, Radix Themes, and Phosphor system.

### Work

- Added SQLite-backed radar executor, operator profile, and custom instructions. The radar settings dialog now edits all three alongside time, timezone, catch-up, and enabled state.
- Added required opportunity fields for the concrete offer, pricing, structured sales channels, direct channel URLs, access methods, and first-sale plan. Zod rejects new candidates without at least one channel before persistence.
- Added a `成交路径` section to opportunity cards. Historical records without the new fields are clearly marked as not having passed the channel gate and cannot be converted into experiments.
- Added atomic OpenWorker radar claim, save, complete, fail, stale-claim recovery, and run-now queue operations. The server scheduler leaves OpenWorker jobs claimable instead of invoking Codex.
- Expanded the OpenWorker MCP and runtime allowlist with five radar-only tools. The five-minute pull worker now checks ordinary tasks first, then due radar research, and reports an explicit Chinese Idle message when neither exists.
- Routed the live 06:30 AI news task from Codex to OpenWorker, returned it from Blocked to Ready, and queued a live recovery run. Reconfigured the 08:00 opportunity radar for OpenWorker with a saved custom search rule and queued a live recovery run.
- Updated README, operations guidance, and the automation architecture plan to describe the DeepSeek-backed execution path and the sales-channel invariant.

### Review

- Unit and integration tests: 7 files / 73 tests passed.
- Full Playwright acceptance: 8/8 passed, including editable radar rules, the fixed sales gate copy, rendered sales channels, and first-sale plan.
- TypeScript, ESLint, production builds, dependency audit, and patch hygiene passed.
- In-app browser review covered the settings dialog, historical channel-gate state, OpenWorker execution label, desktop layout, 390px mobile layout, and browser console. No console errors were found.
- Live OpenWorker recovery completed after terminating the orphaned pre-upgrade sidecar and starting a fresh 8765 process. The refreshed MCP registry exposed 25 Personal OS tools, including all five radar claim/save/complete/fail operations.
- The recovered 06:30 AI news run reached Needs Review through OpenWorker. Its Chinese Markdown renders correctly in the review UI; the report remains intentionally unaccepted for human source review.
- The recovered 08:00 opportunity radar reached `succeeded` at 2026-07-29 13:50 JST and scheduled its next run for 2026-07-30 08:00 JST. The OpenWorker/DeepSeek run used 38 steps and saved a five-opportunity Chinese report.
- Live API validation confirmed all five saved opportunities contain a concrete offer, payer, pricing model, first-sale plan, and one or more structured sales channels with a URL and access method. The desktop and 390px radar views render these fields as the `成交路径已验证` section.
- The live verification also proved that an empty ordinary task queue is followed by `claim_due_radar`; it no longer causes the due radar job to be skipped. A true empty poll now returns the explicit Chinese Idle message.

## 2026-07-29 - Opportunity radar deep-research gate

### Plan

- Replaced the permissive zero-opportunity success proposal with the user's explicit target: scan multiple verticals, persist at most three qualified candidates, and count the run as fully successful only at 3/3 with every score at least 85.
- Added `docs/RADAR-DEEP-RESEARCH-ACCEPTANCE.md` before implementation and used the `product-trend-researcher` evidence doctrine plus the existing `design-taste-frontend` product-UI contract.
- Preserved the editable user profile and custom rules, while treating the 85-point threshold, five evidence classes, three-candidate target, and experiment gate as non-editable system invariants.

### Work

- Added a seven-dimension 100-point assessment, critical score floors, two-source demand requirement, five strong dated evidence categories, five distinct strong-source URLs, blocking-dependency rejection, and an atomic maximum of three saved candidates per claim.
- Added the `partial` scheduler state. Codex and OpenWorker now return `succeeded` only for exactly three qualified candidates; zero to two preserve the honest report as not fully qualified, while operational exceptions remain `failed`.
- Added structured alternatives, current cost, competition, automated delivery, first-100 acquisition, dependencies, failure reasons, unknowns, evidence proof scope, and limitations across Domain, SQLite, Codex JSON schema, MCP tools, and the repository Radar Skill.
- Prevented old shallow opportunities from starting new experiments. Existing data remains readable after additive SQLite migrations and now shows its missing-gate reasons.
- Expanded the Radar UI with a compact audit panel, score breakdown, 3-candidate target, full/partial/failure status distinction, evidence classes and strengths, risks, closure path, and explicit legacy state. Kept the existing graphite/orange, Radix, Geist, and Phosphor system.
- Updated the saved live custom prompt from the conflicting 75-point/one-plus-two rule to three formal candidates at 85 points. The next run remains 2026-07-30 08:00 Asia/Tokyo.
- Created a pre-deployment SQLite backup at `backups/personal-os-2026-07-29T05-56-06-058Z.db`, rebuilt all services, restarted Personal OS and OpenWorker, and verified `personal_os` is connected in the refreshed OpenWorker registry.

### Review

- Final unit and integration result: 7 files / 80 tests passed, including 1/3 partial, 3/3 success, fourth-candidate rejection, weak critical evidence rejection, 84-point rejection, migration compatibility, and legacy experiment blocking.
- Final browser result: 8/8 Playwright journeys passed. Desktop and 390px Radar audit screenshots are stored in the Playwright output; mobile document width equals viewport width.
- TypeScript, ESLint, all production builds, dependency audit with zero vulnerabilities, and `git diff --check` passed.
- Live health after deployment reports SQLite `ok`, zero active or stale runs, zero pending approvals, next Radar run at `2026-07-29T23:00:00.000Z`, and OpenWorker `personal_os` registered and connected.
- The program can validate evidence structure and declared strength but cannot independently guarantee the semantic truth of every cited page. Real evidence should still be reviewed before authorizing spend or launching an experiment.

## 2026-07-29 - Opportunity radar live-state visibility

### Plan

- Used the user's screenshot to confirm that immediate research was represented as generic `idle / 等待执行`, with no explicit queued state and no visible active-run strip.
- Added the live-state acceptance criteria to `docs/PLAN.md` and the Radar acceptance matrix before implementation.
- Applied `design-taste-frontend` as a preserve-mode product UI fix with variance 4, motion 2, and density 8. The change uses the existing Radix, Geist, graphite, orange, and Phosphor system.

### Work

- Added `queued` to the domain schedule status. Immediate and automatic due OpenWorker research now persist `queued` before claim, and claim still atomically changes it to `running`.
- Prevented duplicate immediate runs while queued or running and mapped duplicate requests to the existing invalid-state response.
- Added an active status strip with real queue/start timestamps and explicit `已加入调研队列` or `正在中文调研` copy. No unsupported search phases are invented.
- Changed the primary action to `已加入队列` or `正在中文调研` and disabled it for both active states.
- Changed active schedule and report polling to three seconds, restoring the one-minute schedule interval when inactive. A transition to a terminal state invalidates reports, opportunities, and dashboard data.
- Adjusted the timing fact from generic `下次调研` to `排队时间` or `开始时间` while active.

### Review

- Unit/integration result remains 7 files / 80 tests passed; database, API, and scheduler checks now cover queued persistence, automatic queueing, and duplicate rejection.
- Full Playwright result: 8/8 journeys passed. A focused rerun directly verified queued and running copy, disabled buttons, three-second transition polling, and 390px width without overflow.
- Direct screenshots: `radar-queued-desktop.png`, `radar-running-mobile.png`, and the live deployed `review-artifacts/radar-live-running.png`.
- TypeScript, ESLint, production build, and `git diff --check` passed.
- Deployed API and Web without restarting the active OpenWorker research. Live 5273 showed `正在中文调研`, `OpenWorker 已领取任务`, and the real 15:10 start time; the action was disabled.

## 2026-07-29 - Radar workspace, runtime fallback and Qishui music pilot

### Plan

- Moved task-specific reports and controls out of the Radar landing page into a dedicated `/radar/:id` workspace contract.
- Defined a preferred/backup Runtime strategy with bounded failure triggers, one handoff, separate readiness checks and a non-fallback quality gate.
- Defined the first complex draft, `汽水热歌拆解与原创实验`, as a gated pilot rather than an immediately scheduled downloader or Suno publisher.
- Applied the product-control-plane parts of `design-taste-frontend`, the approval and bounded-retry rules from `automation-governance-architect`, and the lyric/style/originality contract from `chinese-suno-songwriter`.

### Work

- Replaced the Radar homepage report canvas with active, attention, scheduled and recent-failure facts plus compact task cards. Each card now opens a full-page task workspace.
- Preserved the opportunity report, archive, immediate research and editable schedule inside the built-in opportunity Radar's report tab.
- Added persisted preferred executor, optional fallback, four explicit fallback triggers, maximum handoffs and per-step Runtime preference. UI editing keeps step keys, kinds, instructions and executor choices losslessly across revisions.
- Added route-aware preflight and dispatch fallback. Unavailable/capability/timeout/tool failures can use the configured backup once; validation and content-quality failures remain on the original route and require correction.
- Added an idempotent 11-step Qishui draft: official Top 10 capture, cross-day deduplication, legal-audio coverage, deterministic librosa/Essentia features, hit-pattern and counter-example analysis, originality transformation, Chinese Suno package, quality gate, generation approval and report persistence.
- Kept the draft manual, unscheduled and without an approved Skill. It does not authorize DRM bypass, audio redistribution, artist/voice/melody imitation or automatic Suno credit use.
- Backed up the live SQLite database before migration, rebuilt API/Web and deployed to loopback ports 8787/5273 without restarting the independent OpenWorker service.

### Review

- Unit/integration: 8 files / 93 tests passed. TypeScript, ESLint, all production builds and `git diff --check` passed.
- Full browser acceptance: 10/10 journeys passed, including the new Qishui workflow, Runtime edit persistence, route migration, original Radar report flow, themes and 390px no-overflow checks.
- Live health reports database `ok`, zero active/stale runs and zero pending approvals. SQLite quick/foreign-key checks pass.
- Live Qishui state is `draft`, OpenWorker to Codex, one maximum handoff, 11 steps, manual trigger, no schedule binding, no Skill version and no runs.
- Rendered evidence is stored in `review-artifacts/radar-control-plane-live.png`, `review-artifacts/qishui-workspace-live.png` and the Playwright Qishui mobile screenshot.

## 2026-07-29 - Real Obsidian Radar export and Qishui project link

### Plan

- Kept SQLite authoritative for structured state and defined Obsidian as the human-readable report archive.
- Required a server-configured Vault, a linked Project and a completed Radar result; browser requests cannot choose arbitrary filesystem destinations.
- Applied the existing Personal OS control-surface language from `design-taste-frontend` in preserve mode instead of introducing a second visual system.

### Work

- Cloned the empty `git@github.com:FrigidCrow/qishui-music.git` repository to `/Users/frigidcrow/Dev/qishui-music` and linked it to the new `汽水音乐实验室` Project.
- Created the non-destructive Obsidian hub `Projects/Qishui Music.md` and connected the Qishui Radar to it without advancing definition revision 1 or resetting its 11-step/runtime/success rules.
- Added atomic, deterministic, collision-safe Radar Run export with YAML metadata, full Markdown output, verification summary, wiki linkage, artifact registration and audit event.
- Added connected/blocked state to the Definition tab and export/re-export controls to Run History.
- Fixed partial Radar PATCH handling so schema defaults cannot overwrite omitted fields when only Project linkage changes.
- Added `OBSIDIAN_VAULT_PATH` to the API LaunchAgent and documented the storage and recovery model.

### Review

- 8 files / 96 unit and integration tests and 10/10 Playwright journeys pass, including traversal, premature export, collision, idempotency and the rendered export flow.
- ESLint, TypeScript, all production builds, health, Web response and `git diff --check` pass.
- Live API reports database `ok`, no active/stale Runs or approvals, and Qishui Obsidian state `configured=true`, `projectLinked=true`, `canExport=true`.
- Deployment backup: `backups/personal-os-2026-07-29T13-25-00-604Z.db`. Rendered evidence: `review-artifacts/qishui-obsidian-live.png`.

## 2026-07-30 - Goal-directed Radar recovery and truthful quality state

### Plan

- Diagnosed the two Qishui attempts independently: OpenWorker could not obtain the official chart, while the Codex fallback returned only a 747-character completion summary and never persisted its 11 step states.
- Added a release contract in `docs/RADAR-RECOVERY-ACCEPTANCE.md` before implementation. The contract requires bounded different-strategy recovery, immutable evidence, structured Codex output, deterministic gates and a concrete input request only after lawful strategies are exhausted.
- Applied the automation governance boundary as a controlled pilot: four attempts, no external Suno write, no private-interface reverse engineering and no false success. Used the existing Radar visual system for the status correction.

### Work

- Added a shared Radar evaluator that combines output-contract checks with required persisted steps. OpenWorker submissions and Codex completions now pass through the same gate.
- Added schema-constrained Codex Radar results with exact pipeline keys, complete user-facing report, per-step evidence, recovery strategies, blocker and next actions. The adapter writes every step into SQLite before choosing recovery, input-required or review.
- Made network and Web search follow each Radar capability manifest. A completed Codex turn only reaches Needs Review after its report and all required steps pass.
- Added quality-failure and input-required state transitions. Invalid results leave review immediately, cannot be accepted and either schedule a bounded retry or block with the smallest required input.
- Fixed retry context loss: every recovery carries the immutable definition, source Run/error/result, failed checks, original assignment and validated checkpoints, and must select a materially different lawful strategy.
- Increased generic and Qishui Radar attempt budgets to four, without changing the Qishui definition revision or safety policy. Added manual recovery API/UI as a fallback when the scheduler is unavailable.
- Reworked rehearsal evidence cards to show attempt budget, failed checks, active recovery, exhausted input and a manual continue action. Removed the misleading waiting-review plus failed-gate combination.
- Filtered stale failed Runs whose Tasks are no longer retryable so the dispatcher does not repeatedly log impossible retries.
- Backed up the authority database, deployed with live Codex mode and completed Qishui recovery Run `b8add224-4e27-46c5-9f46-65d1b658bed4` as attempt 3/4.

### Review

- Dedicated Codex tests cover successful structured completion, malformed output and input-required only after three distinct strategies plus a concrete next action.
- Unit/integration result: 9 files / 101 tests passed. Full browser acceptance: 10/10 passed, including Radar promotion, checkpoint recovery and Obsidian export.
- TypeScript, ESLint, production builds, `git diff --check`, SQLite `quick_check`, foreign keys, API health and Web response passed.
- Live attempt 3/4 checked four lawful source strategies, saved a 7,645-character report, nine unique URLs, three original lyric directions, five passing snapshot tests and three clean lyric audits. It then requested one App screenshot containing chart name, ranks 1–10, song, artist and device time; no substitute chart or invented audio feature was used.
- Live browser evidence shows attempt 3/4 waiting for that exact input, earlier attempts marked as already continued, the new-run button disabled, no false manual-recovery button, no console error and no horizontal overflow at 1440px. Screenshot: `review-artifacts/qishui-recovery-live.png`.
- Pre-deployment backup: `backups/personal-os-2026-07-29T16-13-59-936Z.db`.

## 2026-07-30 - Qishui Android emulator runtime

### Plan

- Added the dedicated ARM64 emulator acceptance contract to `docs/PLAN.md` before implementation.
- Kept chart collection on visible Android UI only. APK provenance, login consent, captcha, copyright and Suno spending remain explicit gates.
- Required idempotent lifecycle control, persistent app state, bounded resource use and actionable `input_required` results rather than terminal failure on recoverable setup gaps.

### Work

- Installed Android command-line tools, Platform Tools 37.0.0, Emulator 36.6.11, API 35, Build Tools 35.0.0 and the Google Play ARM64 API 35 image under the user's Android SDK.
- Created `Qishui_Radar_API_35`, enabled host GPU acceleration, assigned 4 GB RAM and retained persistent userdata. Cold stop/start completed successfully without touching other devices.
- Resolved the official Qishui Android distribution chain: the website's short link requires a trailing slash and redirects to the `ugapk.cn` CDN. Downloaded Qishui 20.3.0, verified `com.luna.music`, recorded SHA-256 `af25225eb944468a33738249ee2cd5a89093829280353f684775aeee12f87b45`, and installed it.
- Added `qishui_emulator.py` for status/start/stop/store/APK installation. The later monolithic daily wrapper and UIAutomator bridge were removed when collection moved to the versioned `qishui-daily-sync` Skill plus bounded device/archive tools.
- Replaced `monkey` application launch with resolved Launcher Activity startup. Added privacy agreement, login, SMS, captcha and risk control as human checkpoints, and removed automatic acceptance/grant clicks.
- Personal OS preflight now starts the managed AVD, passes its exact serial to the bridge and displays the bridge's concrete recovery action. The live Qishui Radar pipeline was upgraded to revision 4 and uses the lifecycle wrapper.

### Review

- Qishui unit result: 20 tests passed, plus Python compile and patch hygiene.
- Personal OS result: 104 tests passed; focused Radar Platform test has 9 passing cases; TypeScript, ESLint, production builds and patch hygiene passed.
- Live lifecycle evidence covers stopped, cold start, boot completion, app persistence, missing-app recovery with automatic shutdown, official APK installation and live Personal OS preflight.
- The user completed Qishui's `个人信息保护指引`; anonymous browsing and application readiness passed without an account login.
- Real UI inspection found only `热歌榜`、`新歌榜` and `欧美榜`, consistent across the tab hierarchy. The configured `上升榜` is absent, so no available chart was substituted silently.
- Fixed real UI parsing for private-use icon glyphs, zero-width characters, `歌手 · 专辑` lines, total counts and ranks above 10. Two visible 热歌榜 pages now produce a verified continuous 1–10 list.
- Upgraded preflight to confirm the target chart through visible navigation, preventing app launch alone from producing a false green check. Remaining acceptance is an explicit product decision about replacing the unavailable 上升榜 target.

## 2026-07-30 - AI Runtime control layer and investment/return ledger

### Plan

- Repositioned Personal OS as the local visual control layer above Codex and OpenWorker, with Workflow, Run, Artifact, Approval and Project Context as the visible objects.
- Reduced primary navigation to Today, Projects, Radar, Runs and Assets. Kept Task as a private dispatcher compatibility record rather than deleting history.
- Defined an Asset ledger that separates actual cash, forecasts and time, and supports Project, Radar, income asset, experiment, Artifact and custom operating-unit bindings.
- Used `design-taste-frontend` to preserve the existing visual language while strengthening hierarchy, status clarity, responsive behavior and reduced-motion support.

### Work

- Replaced the task-centric dashboard with an attention-first Today view and added reusable Run Request entry points on Today, Projects and Runs.
- Consolidated Codex/OpenWorker runs, approval, live event stream, workflow steps, routing explanation, capability mismatch and human acceptance into `/runs`; legacy `/tasks` and `/review` now redirect there.
- Added server-owned Runtime capability manifests, auto/explicit routing and persisted route/fallback context without allowing the browser to call a Runtime directly.
- Added a unified Artifact index with backfill from existing runs, reports, experiments, income assets and approved Skills. Obsidian and Git content remain linked by path rather than duplicated in SQLite.
- Added operating-unit ledgers, entries, actual/expected summaries, time tracking, manual FX, immutable reversal, shared-cost allocation, CSV export and optional Run/Artifact/evidence attribution.
- Added trusted Runtime cost reporting through MCP. Unknown amounts remain unknown instead of becoming zero, while known costs create an actual paid ledger entry linked to the Run and billing source.
- Added the linked investment/return state to Project and Radar pages, while preserving the live Qishui revision 8 definition, schedule state and all existing records.

### Review

- Found and fixed a cost-integrity edge case where a later usage-only Runtime report could erase an already-recorded actual amount.
- Live migration preserved 21 existing Artifacts, all Task history and the Qishui revision 8 Radar. SQLite quick check and foreign-key checks remain clean.
- Production UI at `127.0.0.1:5273` shows exactly five primary areas and both Runtime capabilities from the live API.

### Test

- TypeScript, ESLint, all production builds and `git diff --check` pass.
- Unit/integration: 9 files and 110 tests pass, including document classification, ledger calculations, shared-cost de-duplication, reversal, FX and Runtime cost idempotency.
- Browser acceptance: 7/7 journeys pass, including legacy redirects, mobile/theme behavior, unified Run routing, Project workspace, approval, Artifact library and actual-versus-expected ledger behavior.
- Live smoke Run `0f4df8bc-3e20-4d46-bf4f-20f8dd1ce33a` verified explicit OpenWorker routing and persistence, then was deliberately cancelled before execution.
- Pre-deployment backup: `backups/personal-os-2026-07-30T08-44-53-087Z.db`.

## 2026-08-01 - Personal OS vNext MVP1 clean rewrite

### Plan

- Accepted the user's high-risk rewrite boundary but kept it reversible: vNext was built beside the current system on Web 5373, API 8887 and a separate SQLite database.
- Froze the direct acceptance matrix in `docs/PERSONAL-OS-VNEXT-MVP1-ACCEPTANCE.md` before implementation.
- Backed up the live v1 database to `~/.local/share/personal-os/backups/personal-os-2026-08-01T12-10-07-261Z.db` before migration work.
- Used the applicable parts of `design-taste-frontend` for the visual redesign and state/accessibility gates. The skill explicitly targets marketing surfaces rather than dashboards, so the control-console information architecture and existing Radix/Phosphor design system were preserved.

### Work

- Added shared vNext contracts, domain state machine, application services, SQLite repositories/migrations and executor adapters under `packages/vnext-*`.
- Added `apps/api-v2` with request IDs, Zod validation, standard envelopes, Run lifecycle APIs, append-only events, race-safe SSE replay/live handoff, Schedule, Knowledge, Finance, Audit and Artifact endpoints.
- Added Internal and Process Executors. Process execution uses argv, `shell:false`, an executable allowlist and allowed working-directory roots. Unconfigured Codex/OpenWorker work fails explicitly instead of returning a demo success.
- Added Obsidian Markdown/frontmatter incremental indexing with FTS5 Chinese search and deletion tracking.
- Added finance accounts, integer smallest-unit transactions, currency checks, monthly summaries and audit. Transaction posting/soft deletion and account-balance adjustment are atomic; a trigger-induced failure test proves rollback.
- Added the five-zone `apps/web-v2` control console: Today, Projects, Radar, Runs and Assets. It supports desktop/mobile layouts, system/light/dark themes, real loading/empty/error states, live Run events, cancel/retry, workflow schedules, knowledge search and finance entry.
- Added a read-only, SHA-256 keyed, versioned v1 importer. Version 2 closes the review gap by preserving Radar definitions, embedded Skill content, cron tasks and the singleton opportunity Radar schedule.
- Rehearsed the importer against the live v1 database, then upgraded the official v2 database. It now contains 4 WorkSpecs, 12 legacy Runs, 21 Artifacts and 2 enabled schedules. The imported schedules are AI news at 06:30 and opportunity Radar at 08:00, both `Asia/Tokyo`.
- Created an online v2 backup before the importer v2 upgrade at `~/.local/share/personal-os-v2/data/personal-os-v2-pre-importer-v2-20260801-213906.db`.

### Review

- Fixed four issues found during review: missing Radar/Schedule migration, non-atomic finance balance updates, an SSE replay/subscribe race, and a completed-delay AbortSignal listener leak.
- Live v1 SHA-256 remained `2f185b0dd06247af7fd58e819c36cf0ef811750f01ee89abf199234f693fd246` after import. v2 `PRAGMA quick_check` returned `ok`; `PRAGMA foreign_key_check` returned no rows.
- Security scan found no `shell:true`, arbitrary child-process `exec`, or embedded Secret values in vNext paths. Matches for `.exec` are SQLite DDL/test calls.
- Visual review covered Today/Radar/Assets in dark mode and Today in light mode after Motion settled. Five-zone hierarchy, readable state contrast and imported production data were verified.
- MVP1 deliberately does not cut over 5273/8787 and does not include real Codex/OpenWorker adapters. Those remain MVP2 gates, not hidden incomplete behavior.

### Test

- `npm test`: 15 files, 139 tests passed.
- `npm run typecheck -- --pretty false`: passed.
- `npm run lint`: passed.
- `npm run build`: all old and vNext workspaces passed.
- `npm run test:e2e:vnext`: 4/4 journeys passed.
- `npm run test:e2e`: old-system regression 7/7 passed.
- `npm run healthcheck:vnext`: healthy; Internal and Process Executors available.
- `git diff --check`: passed.

## 2026-08-01 - Personal OS vNext MVP2 AI Runtime integration

### Plan

- Froze the provider-native runtime design in `docs/PERSONAL-OS-VNEXT-MVP2-AI-SPEC.md` and the direct acceptance matrix in `docs/PERSONAL-OS-VNEXT-MVP2-ACCEPTANCE.md` before implementation.
- Reused `@openai/codex-sdk` and OpenWorker's authenticated local REST/WebSocket protocol instead of adding another Agent framework.
- Kept Codex read-only/no-network by default, OpenWorker approval/input requests fail-closed, secrets file-backed, and the old 5273/8787 authority untouched.
- The `gsd-ai-integration-phase` workflow could not initialize because this repository has no `.planning/ROADMAP.md`; the repository's mandatory Plan → Work → Review → Test process remains authoritative.

### Work

- Extended the common Adapter result with fail-closed waiting states and external Runtime session IDs, and passed the linked Project into the execution context without letting transports bypass Application Service.
- Added a provider-native Codex Adapter using streamed SDK events, AbortSignal cancellation, allowed-root/Git validation, safe prompt construction, real usage capture and read-only/no-network defaults. Personal OS isolates global Plugin/Skill search injection so a large personal Codex installation cannot consume the Runtime prompt budget; versioned WorkSpec instructions remain available.
- Added an authenticated OpenWorker REST/WebSocket Adapter with loopback-only URL validation, file-backed Token handling, managed/project workspaces, assistant/tool event mapping, interrupt propagation and explicit waiting_input/waiting_approval mapping.
- Registered both adapters in API v2 and made health probes asynchronous. OpenWorker health verifies the live local server and Token; Codex health distinguishes SDK configuration from live execution authentication.
- Added a repeatable `npm run smoke:runtimes:vnext -- --codex --openworker` command. The smoke is read-only, uses no Web Search and reports each Runtime independently.
- Replaced the vNext Web placeholders with actual Codex/OpenWorker forms: Project selection, Codex sandbox/network controls and OpenWorker agent selection. Added all Runtime and waiting events to the SSE subscriber.
- Updated README and MVP2 implementation/acceptance documents. No old service, database, Obsidian content or project file was deleted or switched.

### Review

- Found that Codex SDK `ThreadItem` errors are documented non-fatal notices. The first Adapter implementation incorrectly failed the Run on a skills-budget warning even though the turn completed; it now records `runtime.warning` and only fails on top-level/turn failures.
- Found that the Web still labelled both AI Runtimes as “待接入” and rendered Process command fields for them. Runtime-specific forms and a browser journey now prevent that dead integration.
- Found that the original smoke stopped before OpenWorker when Codex failed. The runner now isolates both results and returns a non-zero exit only after reporting every requested Runtime.
- Added structured/free-text Secret redaction and verified the real 64-byte OpenWorker Token is absent from the Git diff.

### Test

- Unit/integration: 15 files, 152/152 tests passed; vNext subset 6 files, 41/41; Runtime Adapter file 13/13.
- Browser: vNext 5/5 journeys and old system 7/7 regression passed.
- TypeScript, ESLint, full production build, vNext build and `git diff --check` passed.
- Final real read-only smoke passed for Codex thread `019fbdbd-a315-7943-b012-16cfe4a04d35` and OpenWorker session `personal-os-v2-smoke-openworker-1785594757468`. The supported `skills.include_instructions = false` configuration replaced two invalid broad `skills` overrides and reduced the Codex smoke input from 37,077 to 26,285 tokens without hiding WorkSpec instructions supplied by Personal OS.
- Live v2 health reports four available Executors. SQLite `quick_check=ok` and foreign keys are clean. v1 database SHA-256 remains `2f185b0dd06247af7fd58e819c36cf0ef811750f01ee89abf199234f693fd246`.
- Review caught a legacy initializer that refreshed the development Qishui Task timestamp on every database open. The update is now conditional on an actual `max_attempts` migration, with a reopen-idempotency regression test; the installed v1 authority database was never changed.

## 2026-08-02 - Personal OS vNext Phase 3 Runtime governance

### Plan

- Froze the governance contract and direct gates in `docs/PERSONAL-OS-VNEXT-PHASE3-AI-SPEC.md` and `docs/PERSONAL-OS-VNEXT-PHASE3-ACCEPTANCE.md` before implementation.
- Kept provider-native Codex/OpenWorker sessions, SQLite and the five-zone vNext UI; no new Agent framework or production cutover was introduced.
- Required deterministic state/protocol tests for waiting recovery, Approval replay/expiry, Artifact boundaries, trusted costs, Secret filtering and Scheduler restart behavior.

### Work

- Added same-Run continuation for `waiting_input` and `waiting_approval`. Codex uses `resumeThread`; OpenWorker uses its native `question_response`, `approval`, `directory_response` and `plan_response` frames.
- Added one-per-Run pending Approval records with risk, filtered payload, 24-hour expiry, first-decision-wins resolution and fail-closed rejection/expiry continuation.
- Separated Runtime completion from human acceptance. Successful and partial Runs now enter pending review without rewriting their execution result.
- Persisted provider usage independently from actual money. Actual cost accepts only provider bills or manual receipts, uses smallest-unit integers and rejects conflicting rewrites.
- Collected completed Codex file changes as Git Artifacts only after repository containment, regular-file, size and SHA-256 checks; duplicate references are idempotent and path escape fails the Run.
- Added migration 5 with governance fields, Approval storage, Artifact uniqueness and append-only Audit UPDATE/DELETE triggers. Secret filtering now preserves `secret://` references while removing actual values without erasing numeric token counters.
- Made API restart fail only genuinely interrupted `running` work, preserving waiting states. Added Scheduler health, pending Approval health, cross-restart firing tests, bounded catch-up and run-now independence.
- Added Runs governance UI for input, approval, review, usage, cost and Artifacts, plus a Today approval inbox and top-bar Scheduler/Approval health.
- Migrated the official v2 database through migration 5 after saving `review-artifacts/phase3/personal-os-v2.pre-phase3.db`; no old port or authority switch was performed.

### Review

- Fixed a Secret-filter false positive that replaced numeric `inputTokens`; numeric usage is now preserved while string secrets remain redacted.
- Moved Run-state/resumability checks before an Approval decision commit, preventing a decision from being persisted against a non-waiting Run.
- Added all-candidate validation and in-memory de-duplication before repeat Artifact registration.
- Real OpenWorker smoke exposed an operational fault outside the Adapter: the long-lived server had 313 file descriptors and `Too many open files` while HTTP health still returned 200. A normal LaunchAgent restart reduced the count to 81 and restored execution. This remains a production-readiness observation for Phase 7.
- Formal review found no Phase 3 release-blocking defect. Production cutover, automated high-risk actions and inferred provider pricing remain prohibited.

### Test

- Unit/integration: 15 files, 170/170 passed; focused vNext: 6 files, 59/59 passed.
- Browser: vNext governance 6/6; old-system regression 7/7.
- TypeScript, ESLint, all workspace production builds and `git diff --check` passed.
- Official v2 database: schema migrations 1–5, `quick_check=ok`, zero foreign-key violations; exact real OpenWorker Token scan returned zero matches in v2 DB and source.
- Real read-only Runtime smoke: Codex returned `PERSONAL_OS_CODEX_SMOKE_OK` with trusted usage; OpenWorker returned `PERSONAL_OS_OPENWORKER_SMOKE_OK` after its exhausted legacy process was restarted.
- v1 authority had no Phase 3 logical writes or port switch; its verification-window SHA-256 remained `91f140486a4082ad21f61cf355c60a8e7422130339626beae67025903ce6e6bd`.

## 2026-08-02 - Personal OS vNext Phase 4 Obsidian knowledge integration

### Plan

- Froze the Phase 4 knowledge contract and 17 direct gates before implementation.
- Kept Obsidian Markdown as the original source, SQLite as the index/relationship store and the existing five-zone UI/design system.
- Prohibited arbitrary path writes, overwrite, symlink escape, production cutover and new heavy knowledge infrastructure.

### Work

- Added Migration 6 `knowledge_links` with typed Project/WorkSpec/Run/Artifact relationships, uniqueness and reverse indexes.
- Extended Markdown/frontmatter parsing for scalar, inline-array, JSON and common indented-list values; unknown entity references are counted without hiding the document.
- Added filtered FTS5/LIKE Chinese search, document detail and reverse-link APIs, hash-idempotent indexing and deletion-safe relation queries.
- Added controlled, Secret-filtered, no-overwrite note creation in `Inbox`, `Generated` and `Reports` using same-directory temporary files and atomic hard-link publication.
- Added local Vault watching with per-Vault debounce, sanitized health state and deterministic shutdown.
- Rebuilt the knowledge UI into Vault health, selectable search results and relationship detail, plus a controlled creation form and desktop/mobile states.

### Review

- Redacted titles before filename derivation, rechecked symlink roots on every write, added multiline frontmatter support and improved Chinese fallback snippets.
- Visual review confirmed the existing Radix/Phosphor, warm neutral and orange-accent system remains coherent. Desktop uses a three-pane knowledge workspace; mobile collapses to one column without horizontal overflow.
- No existing Obsidian file is rewritten. The official v2 database currently has zero registered Vaults, documents or links.

### Test

- Unit/integration: 15 files, 175/175; focused vNext: 6 files, 64/64.
- Browser: vNext 6/6 and old system 7/7.
- TypeScript, ESLint, all workspace builds, vNext build and `git diff --check` passed.
- Official v2 upgraded through Migration 6 after online backup `review-artifacts/phase4/personal-os-v2-before-phase4-20260802.db`; `quick_check=ok`, zero FK violations.
- v1 authority SHA-256 remained `91f140486a4082ad21f61cf355c60a8e7422130339626beae67025903ce6e6bd`; 5273/8787 and Scheduler authority were not switched.

## 2026-08-02 - Personal OS vNext Phase 5 finance completion

### Plan

- Froze the Phase 5 finance contract and 20 direct acceptance gates before implementation.
- Kept monetary authority in integer minor units, required immutable calculation snapshots and routed destructive or historical changes through reviewable proposals.
- Preserved the parallel-run boundary: the v2 database could migrate, but the v1 ports, Scheduler and Runtime record authority could not switch in this phase.

### Work

- Added Migration 7 with categories, budgets, calculations, operating units, allocations, operating entries and finance change proposals, plus linked transfer, refund and reversal fields on transactions.
- Implemented atomic same-currency and FX transfers, linked income/expense refunds, cumulative refund limits, balanced reporting effects and safe-integer overflow checks.
- Replaced direct transaction deletion with first-decision-wins change proposals. Runtime actors can only propose redacted changes; a user can approve or reject update, delete and reversal actions with an Audit trail.
- Added replayable monthly summaries, budget variance, cash-flow forecasts and rational currency conversions using BigInt half-up rounding.
- Added operating-unit cost and revenue allocation, idempotent allocation keys, committed/expected time and a separate operating summary that does not rewrite cash facts.
- Rebuilt the Assets finance workspace into overview, accounts, transactions, budgets, forecast, operations and proposals, with exact string-to-minor-unit input conversion and responsive desktop/mobile states.
- Migrated the official v2 database through Migration 7 after an online backup; the v1 database and all production authorities remained untouched.

### Review

- Removed the old adjustment/refund-shaped bypass from ordinary transaction creation and confirmed there is no direct PATCH or DELETE transaction endpoint.
- Proved atomic rollback for failed two-sided transfers and failed proposal application; rejected duplicate reversals and delete/reverse proposals when an active refund exists.
- Kept transfer balance effects visible while excluding both sides from income/expense reporting. Refunds reverse only the reporting fact they reference.
- Fixed a mobile min-content overflow in the finance command area and verified the 390px document width while retaining an internally scrollable sub-navigation.
- Formal review found no Phase 5 release-blocking defect. Provider pricing is still not inferred and financial side effects remain review-gated.

### Test

- Unit/integration: 15 files, 191/191 tests passed; focused vNext: 6 files, 80/80.
- Browser: vNext 7/7 journeys and old-system 7/7 regression passed.
- TypeScript, ESLint, all workspace builds and the vNext production build passed; the existing bundle-size warning is non-blocking.
- Official v2: migrations 1–7, `quick_check=ok`, zero foreign-key violations. Backup: `review-artifacts/phase5/personal-os-v2-before-phase5-20260802.db`.
- Visual evidence: `review-artifacts/phase5/finance-ui-desktop-dark.png` and `finance-ui-mobile-light.png`.
- v1 authority SHA-256 remained `91f140486a4082ad21f61cf355c60a8e7422130339626beae67025903ce6e6bd`; no production port, Scheduler or Runtime-record switch occurred.

## 2026-08-02 - Personal OS vNext Phase 6 five-zone final integration

### Plan

- Froze a dedicated Phase 6 specification and 18 direct gates before implementation.
- Limited the work to final integration of Today, Projects, Radar, Runs and Assets, plus unified search and stable cross-zone routes; no second design system or production cutover was allowed.
- Defined each immutable workflow WorkSpec as the exact Skill version pinned by a Schedule instead of presenting an editable draft as a production version.

### Work

- Added a parameterized SQLite/Application global search use case for Project, WorkSpec, Run, Artifact and Knowledge, with Chinese matching, literal wildcard escaping and bounded results.
- Added a Radix/Phosphor global search surface with `⌘K`/`Ctrl+K`, keyboard navigation, close control, loading/empty/error states and stable entity routes.
- Added Project detail aggregation for repository/Obsidian context, WorkSpecs, Runs, Artifacts and project Operating Unit facts.
- Added Radar fixed-version detail for Runtime, instructions, input, retries, schedules, Runs and Artifacts. Schedule rules can now be edited with Audit and next-occurrence recomputation without changing the pinned WorkSpec.
- Made project association available to every Runtime while retaining the Codex Git requirement, so internal and OpenWorker work also appears in project context.
- Upgraded Today into an actionable queue for waiting input, approvals, pending acceptance and failed recovery, backed by the Phase 5 monthly cash summary.
- Added stable Run, Artifact and Knowledge routes, plus `/tasks` and `/review` compatibility redirects to Runs.
- Replaced floating-point Run-cost conversion with exact BigInt minor-unit parsing.

### Review

- Fixed an update-Schema bug where inherited defaults made an empty Schedule patch appear valid.
- Fixed the missing project selector for Internal/Process workflows and one-off Runs, which otherwise left Project aggregation structurally empty.
- Added an explicit mobile close control to global search, removed the remaining vNext decorative gradient and tightened responsive Project/Radar layouts.
- Rebalanced the Radar detail grid so the long fixed definition and shorter Run/Artifact panels use available desktop space without a dead column.
- Increased the bounded file-watcher assertion window after one parallel-suite timeout; the watcher then passed three isolated repetitions, focused vNext and full regression.

### Test

- Unit/integration: 15 files, 194/194; focused vNext: 6 files, 83/83.
- Browser: vNext 10/10 and old-system 7/7.
- TypeScript, quiet ESLint, all workspace builds and `git diff --check` passed; only the existing vNext bundle-size warning remains.
- Seven desktop/mobile routes and the search Dialog passed 390px overflow checks; light, dark, system and reduced-motion paths passed.
- Official v2 remains schema 7 with `quick_check=ok` and zero FK violations; exact OpenWorker Token scans of Git diff and v2 DB returned zero matches.
- v1 SHA-256 remained `91f140486a4082ad21f61cf355c60a8e7422130339626beae67025903ce6e6bd`; Phase 6 made no authority switch.

## 2026-08-02 - Personal OS vNext Phase 7 production cutover

### Plan

- Froze 19 blocking cutover gates covering source immutability, deterministic migration, live Runtime execution, Scheduler uniqueness, rollback, Secret scanning, regression and read-only archival.
- Defined sovereignty as the conjunction of formal Web/API LaunchAgents, the v2 authority database and the only enabled Scheduler; a parallel dev process never counted as a cutover.
- Required three fresh-database rehearsals, a real v1 rollback under ten minutes and a final vNext reactivation before the archive could be sealed.

### Work

- Added schema migration 8 with append-only `legacy_records`, importer v4, source/target verifier, three-run rehearsal, cutover archive and generation-aware LaunchAgent tooling.
- Migrated all declared v1 tables with exact entity mappings. Unsupported opportunity/report/evidence/experiment/income/radar facts remain losslessly discoverable as legacy records and database Artifacts.
- Completed three fresh rehearsals from v1 snapshot SHA-256 `15d759…b343`; all produced canonical fingerprint `cd11d69…c0d9`, schema 8, importer 4, quick check ok and zero foreign-key violations.
- Replaced direct `Documents/Codex` production execution with an atomic runtime package at `~/.local/share/personal-os-v2/runtime/current`, including v1/vNext API/Web and only required runtime dependencies.
- Installed vNext on formal `5273/8787`, proved persisted Scheduler restart de-duplication, actually rolled back to v1, and switched back to vNext. Both generation changes reached healthy in 2 seconds; v1 automation remained disabled.
- Created real production control-plane WorkSpecs and Runs for Codex and OpenWorker. Both returned the exact acceptance token, persisted session/events/audit, and were manually accepted; Codex left the Qishui repository unchanged.
- Updated the desktop launcher and default install generation so normal future starts deploy and preserve vNext rather than restoring v1.

### Review

- Initial LaunchAgent switching failed with `EX_CONFIG` even though the exact Node entrypoint worked manually. The failure was isolated to macOS background access to the source directory and resolved through the local runtime package; both processes then remained `running` under launchd.
- Full vNext E2E exposed a Run-selection race: while a new WorkSpec/Run was being created, the previous Run's acceptance control remained actionable and the new WorkSpec was absent from cache. The UI now seeds both caches atomically, disables old governance during creation and tests the selected title before acceptance.
- Two of 19 historical Artifact paths were already missing in the v1 snapshot. Their records and source payloads were retained and the verifier reports the paths explicitly; no unexplained migration loss remains.
- No release-blocking finding remains. The vNext bundle warning over 500 kB is a performance follow-up, not a correctness or cutover blocker.

### Test

- Vitest: 19 files, 203/203; focused vNext: 6 files, 84/84.
- Browser: vNext 10/10 after the race fix; v1 regression 7/7.
- TypeScript, full ESLint, all workspace builds and `git diff --check` passed.
- Production health: vNext API/Web and Scheduler healthy on 8787/5273; OpenWorker remained on 8765 throughout rollback.
- Production Runtime: Codex Run `9c9cc97d-c11f-4a41-9283-3a4457434b27`; OpenWorker Run `7186c49a-b267-4fa3-b234-e5a2b9b99400`.
- Scheduler restart: first create 1, restarted create 0, persisted Run 1, firing 1.
- Exact OpenWorker Token scan: 167 changed/database/plist/archive files, zero matches.
- Machine evidence and the final v1/v2 snapshots are under `~/.local/share/personal-os-v2/cutover/release-2026-08-02-phase7`.

## 2026-08-02 - Personal OS Phase 8 sovereignty cleanup

### Plan

- Froze an exact deletion boundary: old executable/write-authority assets leave the active system, while historical Markdown and user assets remain.
- Chose macOS Trash for recovery instead of irreversible deletion and recorded the v2 database hash before any move.

### Work

- Removed the v1 API, Web, MCP, domain/database packages, E2E suite, importer, cutover tools, old database and repository MCP/Skill configuration from the active tree.
- Rebuilt package scripts, lockfile, health, backup, deployment and LaunchAgent generation around the single current API/Web/database.
- Exported and deleted the 954-run OpenWorker `Personal OS Pull Worker`; cleared the v1 MCP registration.
- Deployed a current-only production Runtime and moved both previous Runtimes, v1 data root and Phase 7 cutover archive to `~/.Trash/personal-os-retired-v1-20260802-201302`.
- Rebuilt OpenWorker from current source into the v2 runtime root, pinned its compatible MCP dependency and moved its default workspace/log paths away from the retired root.
- Replaced old/new E2E naming with one current Playwright configuration and updated README/operations guidance.

### Review

- E2E initially failed because the renamed current Vault still had one old `e2e-vnext-vault` test path; corrected it and passed all 10 journeys.
- LaunchAgent could not read the source OpenWorker virtualenv under Documents. A freshly built runtime under `~/.local/share/personal-os-v2/openworker-runtime` resolved the macOS background-access boundary.
- Fresh dependency resolution installed incompatible `mcp==2.0.0`; pinned `mcp==1.28.1`, matching the working source environment and proving server startup.
- No blocking old authority remains. Historical Markdown may mention v1 only as audit history.

### Test

- Vitest 7 files / 87 tests; Playwright 10/10.
- TypeScript, ESLint, all current workspace builds and `git diff --check` passed.
- Formal API/Web/Scheduler, OpenWorker API/Web and both Runtime adapters report healthy.
- v2 database hash remained `2871ca4848be…2a0`; `quick_check=ok`.
- OpenWorker automation list is empty; `mcpServers={}`; current Runtime contains no `api-v1` or `web-v1`.

## 2026-08-03 - Personal OS Phase 9 Agent Gateway and Skills

### Plan

- Approved a local pilot with one authority chain: Schedule/User → immutable WorkSpec + Skill → Run → Runtime → MCP → Core API → SQLite/Audit/UI.
- Limited the MCP surface to seven bounded tools and excluded payments, external contact, publishing, deletion, production deployment and direct database access.
- Defined Capability expiry/revocation, structured-result, approval-resume, secret scanning and dual-Runtime live gates before deployment acceptance.

### Work

- Added migration 9, Skill snapshots, repository Skill registry, scoped in-memory Runtime capabilities and seven `/api/v2/runtime/mcp/*` endpoints.
- Built an official SDK stdio MCP server and connected it to Codex per Run and OpenWorker's fixed local MCP configuration.
- Added three versioned Skills, pinned the two production schedules, exposed Skill selection/hash in Radar UI and retained the push Scheduler model.
- Added a structured-result success gate, detailed Codex MCP events, idempotent Skill pinning and current-only atomic Runtime deployment.
- Cancelled the obsolete pre-Phase-9 opportunity Run/approval, retired smoke WorkSpecs and removed generated previous Runtime directories.

### Review

- The first real Codex smoke proved `get_run_context` but cancelled both write-like calls in headless mode. The fix auto-approves only the exact governed Personal OS MCP tool set; no Shell, filesystem or foreign MCP permission changed.
- The failed smoke exposed a false-positive terminal rule. Skill-bound Agent Runs can no longer succeed without `submit_run_result` evidence.
- No Blocker, Critical or unresolved High finding remains. The existing Web bundle-size warning is non-blocking.

### Test

- Vitest 8 files / 93 tests; Playwright 10/10.
- TypeScript, ESLint, all workspace builds, official SDK MCP smoke and `git diff --check` passed.
- All three Skills passed `quick_validate.py`; SQLite migration 9 has `quick_check=ok` and zero foreign-key violations.
- Formal API/Scheduler report healthy with two enabled schedules, zero pending approvals, three Skills and seven MCP tools.
- Real Codex Run `a7dea800-63ff-4357-8164-2cc5bb94e7c5` and OpenWorker Run `1285be3f-e7e0-4561-bf70-8c842cd1f780` both submitted the exact structured acceptance result and were accepted.

## 2026-08-03 - Personal OS Phase 10 workflow operations

### Plan

- Froze the human-controlled lifecycle: write Skill, validate, publish, create an immutable workflow revision, preflight, explicitly rebind a Schedule and observe bounded retry.
- Kept Git as Skill authority, SQLite as business authority and Core API as the only write path; no new high-risk Agent action was authorized.
- Defined 13 acceptance gates covering security, lineage, Schedule binding, retry, UI, production health and documentation.

### Work

- Added a two-step Skill workbench with atomic repository publishing, strict version increase, optimistic Hash protection and Secret/path/symlink rejection.
- Added immutable WorkSpec revision lineage, explainable preflight checks, explicit audited Schedule rebinding and a unified workflow operations health view.
- Added Scheduler-only bounded automatic retry with one Run per attempt, retry lineage and an exhausted event; manual failures remain user-controlled.
- Rebuilt the Radar workspace around operational health, preflight, version creation and Schedule rebinding; added a simple Chinese user guide and current README.
- Made the formal Runtime read Skills from the source Git worktree and added bounded startup retries to the health command.

### Review

- Fixed production Skill authority accidentally pointing at an ephemeral deployed Runtime by explicitly configuring the source `.agents/skills` root.
- Fixed Schedule rebinding storage so `work_spec_id` is actually updated without changing Cron, timezone or enabled state.
- Enforced root and symlink checks on both Skill reads and writes, and kept Skill bodies out of Audit payloads.
- Visual review passed on desktop dark and 390px mobile dark. No unresolved Blocker, Critical or High finding remains.

### Test

- Vitest 8 files / 100 tests; Playwright 11/11.
- TypeScript, ESLint, Build and `git diff --check` passed; only the existing Vite bundle-size advisory remains.
- Production Web/API/Scheduler and both Runtime adapters report healthy; schema 10 has `quick_check=ok`, zero foreign-key violations and two enabled schedules.
- Production backup created at `~/.local/share/personal-os-v2/backups/personal-os-v2-2026-08-03T01-49-01-441Z.db` before deployment.
# 2026-08-04 Phase 11.1 and Phase 12 plan

- Froze the Phase 11.1 automatic-deposition specification and 12-row acceptance matrix.
- Froze the Phase 12 rehearsal-to-Skill specification and 14-row acceptance matrix.
- Chose backward-compatible defaults: required review and on-acceptance deposition.
- Chose explicit immutable revision and schedule-rebind migration for the two daily reports.
- Chose persisted Run modes, evaluations and database-only candidates instead of reviving the retired v1 control plane.

## 2026-08-04 - Phase 11.1, Phase 12 and Qishui production proof

### Work

- Added automatic low-risk Obsidian deposition with managed subdirectories, local-day de-duplication and actionable deposition failures; rebound the AI briefing and opportunity scan to immutable automatic-deposition revisions.
- Added production/rehearsal/failure-drill Run modes, deterministic evaluation, two-rehearsal promotion gates, database-only Skill candidates, human publication and explicit Schedule rebinding.
- Added a trusted managed-resource lifecycle to Codex Runtime. Core starts and stops the dedicated Qishui AVD outside the Codex sandbox, including cleanup after Agent failure and partial start failure.
- Hardened the Qishui emulator against crash-consent startup stalls and stale no-ADB processes; bounded cleanup validates the stored PID belongs to the dedicated AVD before escalation.
- Completed two live isolated Qishui rehearsals, one failure drill and enabled the daily `09:00 Asia/Tokyo` production Schedule only after the gate became ready.
- Made Qishui source metadata truthful: screenshot-only visual review is the default; OCR is claimed only when it actually succeeded and was reconciled.

### Review

- The first live rehearsal passed the full dual-chart workflow but exposed that the published Skill directory lacked `references/tools.md`; the reference is now installed and the second rehearsal read it directly.
- A second-start emulator hang exposed crash-report consent and incomplete partial-start cleanup. The dedicated process is now identified safely, crash prompts are disabled and Core cleanup covers start failures.
- macOS Vision OCR remains unavailable with `Foundation._GenericObjCError`. Both live runs preserved the failure evidence and used Codex visual review of official screenshots; no OCR or audio facts were fabricated.
- Qishui audio remains `protected_storage`: 0/20 current tracks have a lawful ffprobe-readable path. Chart metadata analysis and original Suno prompt preparation work; audio-derived analysis remains gated.

### Test

- Personal OS: 118/118 unit/integration tests, 14/14 Playwright journeys, TypeScript, ESLint, production build and `git diff --check` passed.
- Qishui: 17/17 unit tests, Skill quick validation and patch hygiene passed.
- Live rehearsal roots `a318a63b-e3a4-4983-ab01-0c2a600aebcf` and `335073ff-0578-4b33-8291-da533170d97b` passed; failure drill `91fb86a8-4fb8-4d6f-8b1b-8f7ee4b0d354` passed.
- Production health is green with three enabled schedules; plain LaunchAgent reinstall preserves the Qishui script, Python path and three narrow allowed roots.
## 2026-08-04 - Personal OS Phase 13 production automation operations

### Plan

- Froze a Scheduler-owned occurrence ledger with four outcomes: on-time fire, bounded catch-up, policy skip and Run start failure.
- Kept the five-zone information architecture and chose the Radar landing page as the operational surface instead of restoring a task queue or adding a sixth navigation area.
- Defined direct tests for migration backfill, restart windows, de-duplication, failure classification, current checkpoints, deposition visibility, duration, trusted cost, Today alerts and responsive themes.
- Limited recovery to the existing WorkSpec timeout and maximum-attempt policy; no external notification, automatic schedule mutation or high-risk Agent authority was added.

### Work

- Added migration 14 and upgraded `schedule_firings` into a queryable occurrence ledger with outcome, lateness, Run linkage and redacted failure details.
- Updated Scheduler Tick to persist skips, catch-ups and start failures, advance stale schedules exactly once and repair an occurrence left incomplete by a process crash.
- Extended restart recovery so a Scheduler-created Run left queued before execution becomes an explicit failed attempt and enters the existing finite retry chain.
- Expanded workflow operations with active Run, current checkpoint, latest success, terminal duration, actual cost, deposition, occurrence history, failure category and operator guidance.
- Rebuilt the Radar operations band into a dense production view and added unresolved schedule failures to Today while preserving the original workflow and schedule editors.
- Added Phase 13 unit, migration and browser journeys, including desktop dark and 390px light visual evidence.
