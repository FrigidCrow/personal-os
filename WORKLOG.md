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
