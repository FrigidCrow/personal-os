# MVP1 Review

Status: Passed

Reviewed: 2026-07-28

Scope: `docs/PLAN.md` and `docs/MVP1-ACCEPTANCE.md`

## 2026-08-03 Phase 11 recoverable workflows addendum

Status: Passed and deployed.

- Completed checkpoints are immutable and redacted. Resume creates new `reused` records linked to the earlier checkpoint; restart copies none.
- Runtime capabilities gained only one bounded write action, `save_checkpoint`. The MCP still exposes no payment, outreach, publishing, deletion or production-deployment tool.
- Result deposition runs only after human acceptance, writes only to a registered Vault's `Reports` or `Generated` directory, creates a Run-linked KnowledgeDocument and Artifact, and never overwrites an existing note.
- Deposition failure remains separate from Run success, is audited, appears in Today and can be retried without duplicate notes.
- Review fixed writable-Vault detection, the premature-deposition HTTP error mapping, bounded Today rendering and future-safe checkpoint foreign keys.
- No blocker, critical or high finding remains. The existing Vite bundle-size warning is a later performance optimization and does not affect correctness or the local one-user deployment.
- Final evidence: 8 Vitest files / 105 tests, 12 Playwright journeys, TypeScript, ESLint, production build, MCP smoke, Runtime health, migration 11, SQLite `quick_check=ok`, healthy Web/API/Scheduler and four healthy executors.

## 2026-07-30 Asset investment and return ledger addendum

Status: Passed and deployed.

- The Asset redesign now includes a dedicated investment-and-return view organized by operating unit rather than a detached list of income records.
- Paid cost and received revenue are the only inputs to actual cash profit, payback and ROI. Forecasts, commitments, time and unknown Runtime cost remain separately visible.
- Attribution permits Project, Radar, Run and Artifact traceability while enforcing one primary operating unit per entry and non-duplicating shared-cost allocation.
- The scope intentionally excludes payment connections, tax accounting and automatic money movement. The live Asset area now exposes Results and Investment/Return tabs, with actual cash, forecast, time, ROI, payback, allocation and reversal behavior covered by database, API and browser tests.

## 2026-07-30 AI Runtime visual control layer addendum

Status: Passed and deployed.

- Product scope is now explicit: Personal OS is the visual control layer above Codex and OpenWorker, not a user-maintained Kanban.
- The non-destructive plan reduces primary navigation from seven entries to five and treats Workflow, Run, Artifact and Approval as the core visible objects.
- The Task queue remains in code and SQLite for compatibility, but has left primary navigation and `/tasks` redirects to the unified Runs view.
- Live Qishui Radar revision 8 contains the verified `protected_storage` capability and passed all nine preflight checks.
- Skill promotion remains blocked by the intended evidence gate: two successful revision-8 rehearsals and one failure drill are still required. Production scheduling remains disabled.
- Every row in `docs/AI-RUNTIME-CONTROL-LAYER-ACCEPTANCE.md` now has direct automated or live evidence.

## 2026-07-30 Qishui Skill-first addendum

Status: Passed for preflight; production scheduling remains intentionally unapproved.

- The earlier monolithic Qishui wrapper, UIAutomator bridge and redundant ADB device wrapper were removed. The operational boundary is now a project `qishui-daily-sync` Skill, direct AI Runtime shell/image use, and only AVD/OCR/archive deterministic tools.
- Personal OS revision 7 names the Skill and delegates direct ADB/image control to the selected AI Runtime. Codex is enabled for the current device stage; OpenWorker fallback is disabled because its active tool manifest lacks local Shell/ADB and image inspection.
- Live preflight passes without launching the emulator. A separate Codex-driven Skill smoke proved start → direct ADB open → visual inspection → one justified swipe → Vision OCR for both 热歌榜 and 新歌榜 ranks 1–10 → stop. The recovery from a blank page was performed by the AI Runtime, not a fixed navigation wrapper.
- Real archive sync validates both existing Top10 snapshots, reports zero available and twenty pending/blocked audio records, and writes `/Users/frigidcrow/Documents/Obsidian Vault/Projects/Qishui Music/Daily/2026-07-30.md`.
- The post-login official download probe succeeded inside 汽水音乐, but the client explicitly limits the file to local playback during the VIP entitlement and exposes no exportable media in shared storage. The truthful result is `protected_storage`; this blocks external audio analysis, not chart/Obsidian persistence, and prevents promotion of an unproven full download workflow.
- Automated gates: Qishui 11/11 tests and Skill validation; Personal OS 104/104 tests, typecheck, lint and production build.

## Outcome

Personal OS MVP1 delivers the planned local-first loop: a user can organize projects and tasks in the Web UI, delegate an eligible task to Codex, observe the run, review the result, and explicitly accept it. Opportunity research can be saved as an evidence-backed report, converted into a capped experiment, and tracked toward a low-maintenance income asset.

All 24 acceptance requirements passed. No open blocker remains for user acceptance.

## Automated gates

Final run after all review fixes:

| Gate | Result | Evidence |
|---|---|---|
| Unit and integration tests | Passed | 5 files, 24 tests |
| TypeScript | Passed | `tsc --noEmit` |
| ESLint | Passed | `eslint .` |
| Production build | Passed | MCP, API, and Vite Web bundles built |
| Dependency audit | Passed | 0 known vulnerabilities |
| Patch hygiene | Passed | `git diff --check` returned clean |
| Skill validation | Passed | All three repository Skills returned `Skill is valid!` |

Production smoke checks also passed:

- Built API returned a healthy response and an actionable dashboard from a fresh temporary SQLite database.
- `lsof` confirmed the API listened only on `127.0.0.1` after the security fix.
- Built MCP server started over STDIO, exposed 12 tools, and returned `get_today_context` successfully.

## Codex integration evidence

### Web to Codex

- A real project was connected to `/Users/frigidcrow/Documents/Codex/dev/personal-os`.
- The Web UI assigned the task `验证 Codex SDK 只读连接` in `live` mode.
- Run `efa93fba-ac41-4e88-abe9-67c6ac5d89b6` used Codex thread `019fa7c1-36c9-74e1-9d2f-59233735d787`.
- Codex returned `PERSONAL_OS_LIVE_WEB_OK`; both reported command checks completed and no path was changed.
- The task first entered `Needs Review`. It changed to `Done` only after an explicit click in the review page.
- The deterministic demo path completed the same state-machine and human-gate flow without presenting itself as a live run.

### Codex to Personal OS

- A live Codex SDK smoke task called the configured Personal OS MCP server and returned `PERSONAL_OS_MCP_LIVE_OK 2` from `get_today_context`.
- Protocol tests verify that `complete_task` stops at `Needs Review` and that no MCP acceptance tool exists.
- The tool surface contains no payment, purchase, outreach, publishing, production deployment, or human-approval capability.

## Frontend pre-flight

The frontend was implemented using the explicitly requested `design-taste-frontend` skill with these design dials: variance 5, motion 3, density 7.

- Visual direction: calm, high-contrast operator control plane rather than a marketing page.
- Components: Radix Themes, Phosphor icons, custom semantic tokens, one cyan accent, and consistent radii.
- Routes checked: Dashboard, Projects, Tasks, Radar, Experiments, Assets, and Review.
- Desktop checked at 1280 px in dark and light themes.
- Mobile checked at 390 × 844 with working navigation and no horizontal document overflow.
- `system`, `light`, and `dark` theme controls are present; the selected theme persists locally.
- Loading, empty, error, keyboard focus, dialog labeling, and reduced-motion behavior are implemented.
- Dense information is grouped into cards and tables without oversized headings, decorative SVG, or misleading gradients.

## Safety and data review

- The API binds to loopback by default; README warns against changing `HOST` because MVP1 has no authentication.
- Browser requests are restricted to the local API and CORS accepts only the local Vite origins.
- API inputs are validated with Zod; invalid task transitions return a conflict instead of mutating state.
- A pending Codex run cannot be bypassed by directly transitioning its task to `Done`.
- Live runs require an existing local Git repository path and execute with workspace-write, network disabled, and approval policy `never`.
- API keys are neither sent to the browser nor persisted in Personal OS.
- Demo records, reports, opportunities, and runs are visibly labeled as demo data.

## Review findings resolved

1. Added an API regression test proving that an income asset preserves its lifecycle stage and monthly maintenance burden.
2. Changed the API default from an unspecified host to `127.0.0.1`, preventing accidental LAN exposure in the unauthenticated MVP.
3. Replaced the vulnerable routing/build dependency path; the final dependency audit reports zero known vulnerabilities.

## Known limitations

- MVP1 is single-user and local-only. It has no accounts, remote sync, or multi-device conflict handling.
- Scheduled reports run inside the local Server process. Sleep or downtime is not backfilled.
- A live opportunity report can consume Codex/Web-search usage; the UI therefore requires a deliberate manual action or explicit scheduler configuration.
- The system stores Codex summaries, events, paths, and thread ids, not complete Codex conversations.
- Obsidian is linked by path only. Full note ingestion, embeddings, and semantic RAG are intentionally outside MVP1.
- External money-moving or reputation-affecting actions remain manual by design.

## Final verdict

**Passed — ready for user acceptance.**

The implementation satisfies A01–A24, including the actual bidirectional Codex path and human review gate. The remaining items above are declared MVP1 boundaries, not failed acceptance requirements.

## Visual redesign addendum

The original MVP1 visual direction was rejected during user acceptance for weak hierarchy and insufficient motion. A follow-up redesign overhaul was completed on 2026-07-28.

- Design dials changed from variance 5 / motion 3 / density 7 to variance 8 / motion 7 / density 5.
- Information architecture, workflows, labels, form fields, and safety gates were preserved.
- The new system uses a graphite and signal-orange palette, Geist Variable, an animated command rail, an asymmetric dashboard hero, Bento composition, route transitions, live data motion, and tactile interaction feedback.
- Desktop, 390px mobile, light, dark, dialogs, navigation, all seven routes, and reduced-motion behavior were reviewed.
- Portal theming and an ARIA issue found during review were fixed.
- Production Lighthouse passed at Performance 94, Accessibility 100, Best Practices 100, LCP 2499.6ms, CLS 0, and TBT 97ms.
- The complete visual rationale and reference list are recorded in `docs/VISUAL-REDESIGN.md`.

Visual follow-up verdict: **Passed - ready for renewed user acceptance.**

## MVP1.1 closeout review

Status: Passed

MVP1.1 closes the five interaction gaps recorded in `docs/PLAN.md`:

1. Task detail now supports deletion behind an explicit destructive confirmation.
2. Experiments now have readable detail, complete editing, status control, and result recording.
3. Project cards now lead to a real project detail route with execution context and associated tasks.
4. Successful mutations now use one accessible global feedback pattern.
5. Codex review now exposes complete run context and consumes the existing SSE stream while a run is active.

The closeout required no destructive migration. It also fixed the audit snapshot for new Codex runs so the persisted value contains the actual execution prompt rather than only the task title.

Direct browser evidence covered the task deletion confirmation, experiment edit/result flow, project detail route, global success messages, Live Codex detail, mobile layout, theme rendering, and a clean browser console. Temporary task data was deleted, and the edited demonstration experiment was restored to its original state.

Final automated evidence:

| Gate | Result |
|---|---|
| Unit and integration tests | Passed: 5 files, 26 tests |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed |
| Dependency audit | Passed: 0 known vulnerabilities |
| Patch hygiene | Passed |

MVP1.1 verdict: **Passed - ready for user acceptance.**

## MVP2 automated multi-executor review

Status: **Passed**

MVP2 now provides one Personal OS control plane for Codex, OpenWorker and Human execution. It includes deterministic routing, common AgentRun/event/artifact records, manual/cron/event/dependency triggers, atomic worker leases and heartbeat, bounded recovery, an Approval Inbox, explicit final acceptance, and loopback-only local operation.

Review used both isolated automated journeys and real executors:

- Playwright: 7/7 browser journeys passed. Every mutation captured its HTTP request and response, then verified backend effects directly in SQLite.
- Codex Live: run `2485d0f9-f6e2-4cf1-9f62-87fe7009b761` completed in an isolated Git repository and reached Done only after Web approval.
- OpenWorker Live: run `6088109f-3b11-4e2f-a4a3-027b5c6a1a5e` was claimed by Ollama through MCP, heartbeated, submitted with evidence and accepted in Web.
- Personal OS: 6 test files / 57 tests, typecheck, lint, build, dependency audit and diff checks passed.
- OpenWorker: 933 tests passed, 1 skipped; 63 focused MCP/automation tests passed.

The live review exposed five gaps that simulated tests had not: missing MCP attachment in headless automation, weak prompt-only tool restriction, ambiguous task/run identifiers for a small local model, an undersized worker lease, and OpenWorker Live rows mislabeled as Demo. All five were fixed and regression-tested. Earlier lease-expiry attempts remain in history as failure-recovery evidence instead of being deleted.

All C01-C30 requirements are Passed. The complete feature inventory, gap review, request/response/database evidence and journey results are recorded in `docs/MVP2-ACCEPTANCE.md` and `docs/FULL-E2E-ACCEPTANCE.md`.

MVP2 verdict: **Passed - ready for user acceptance.**

## Recurring task lifecycle review

Status: **Passed**

The task board now treats a recurring Cron task as a persistent automation definition. It appears in the dedicated `定时任务` column after Inbox, including while paused or while its latest occurrence is being executed or reviewed. It reaches Done only through the confirmed `结束定时任务` action.

Direct evidence:

| Acceptance check | Result | Evidence |
|---|---|---|
| Dedicated scheduled column | Passed | Desktop and 390px mobile rendered screenshots show `定时任务` after Inbox |
| One accepted run does not end the schedule | Passed | Database test verifies Agent Run Done and recurring Task Ready |
| Pause preserves the scheduled definition | Passed | Browser test verifies the card remains in `定时任务` and SQLite stores `automation_paused = 1` |
| Explicit completion is required for Done | Passed | Browser and API tests call `/automation/complete` and verify status Done plus `automation_completed_at` |
| Existing recurring Done records recover safely | Passed | Migration test and live API verify active historical Cron tasks return to Ready without history deletion |
| Full regression | Passed | 7 test files / 70 tests, 8/8 Playwright journeys, typecheck, lint, build, and patch hygiene |

Frontend review used the relevant product-UI portions of `design-taste-frontend`: clear state hierarchy, one existing accent, restrained feedback, complete action states, accessible confirmation, responsive scroll-snap, and no added decorative motion or second design system.

Recurring lifecycle verdict: **Passed - ready for user acceptance.**

## Opportunity radar monetization and OpenWorker recovery review

Status: **Passed**

The opportunity radar now treats a reachable sales path as an invariant rather than optional commentary. Users can edit the saved operator profile and additional search instructions from `机会雷达 → 定时设置`, while the system always requires an offer, payer, pricing model, first-sale plan, and at least one structured sales channel with a URL and access method.

Direct evidence:

| Acceptance check | Result | Evidence |
|---|---|---|
| User-owned discovery rules | Passed | Radar settings edit and persist operator profile, custom instructions, schedule, timezone, catch-up, enabled state, and executor |
| Channel gate before persistence | Passed | Domain and MCP tests reject candidates without a structured sales channel; historical ungated records cannot start an experiment |
| Actionable opportunity presentation | Passed | Live desktop and 390px browser reviews show payer, pricing, offer, channel link/access method, and first-sale plan before the experiment section |
| OpenWorker radar lifecycle | Passed | Fresh 8765 sidecar exposed 25 tools; a due radar run was atomically claimed, saved, completed, and advanced to the next 08:00 occurrence |
| Live monetization result | Passed | 2026-07-29 OpenWorker report contains five Chinese opportunities and every record passed the offer/payer/pricing/first-sale/channel checks |
| Empty-queue semantics | Passed | Pull Worker checks ordinary tasks first, then due radar; only a genuinely empty system reports the explicit Chinese Idle message |
| Scheduled task recovery | Passed | AI news completed to Needs Review through OpenWorker; radar completed with `succeeded`, no error, and next run 2026-07-30 08:00 JST |
| Full regression | Passed | 7 test files / 73 tests, 8/8 Playwright journeys, TypeScript, ESLint, production build, dependency audit, and patch hygiene |

The current AI news result is deliberately still in Needs Review. Rendering is verified, but accepting its factual content and sources remains a human decision.

Opportunity radar monetization verdict: **Passed - ready for user acceptance.**

## Opportunity radar deep-research gate review

Status: **Passed**

The prior breadth-oriented report is now superseded by a conservative research gate. A run may scan any number of verticals, but it can persist no more than three candidates. Every candidate must independently reach 85/100, clear the critical score floors, include two independent demand facts, and contain strong dated facts for demand, payment, channel, feasibility, and counter-evidence. Full success means exactly 3/3. Zero to two is an honest `partial` result, never success and never an operational failure.

Direct evidence:

| Acceptance check | Result | Evidence |
|---|---|---|
| Three-candidate success invariant | Passed | MCP contract saves three qualified candidates, rejects a fourth, creates their report, and completes as `succeeded` |
| Partial-result semantics | Passed | MCP and scheduler tests verify one qualified candidate completes as `partial` |
| Evidence and score gate | Passed | Domain and database tests verify 85 pass, 84 reject, missing strong payment reject, two demand sources, five categories, five unique strong URLs, and dimension floors |
| Persistence cap | Passed | Candidate count and insert execute inside one SQLite transaction; the fourth candidate is rejected |
| Historical compatibility | Passed | Additive migrations preserve old opportunities; a legacy shallow record remains readable but cannot start an experiment |
| Operator UI | Passed | Desktop and 390px screenshots render the gate, seven scores, alternatives, acquisition and delivery paths, dependencies, failure reasons, unknowns, and evidence limitations |
| Full regression | Passed | 7 files / 80 tests, 8/8 Playwright, TypeScript, ESLint, production build, dependency audit with 0 vulnerabilities, and clean patch hygiene |
| Live deployment | Passed | Personal OS 5273/8787 and OpenWorker 5274/8765 restarted healthy; refreshed OpenWorker MCP registry reports `personal_os` connected |

The implementation followed the existing visual system with design variance 4, motion intensity 2, and visual density 8. It adds no second component library, icon family, decorative motion, or new theme language. The mobile seven-score grid was reviewed at 390px and the last score now spans the final row without horizontal overflow.

Known limitation: program validation can prove that research has the required structure, thresholds, URL diversity, dates, and declared evidence strength. It cannot prove, without a separate source-verification service, that each cited page semantically supports the model's claim. The UI therefore exposes proof scope and limitations, and human review remains required before spending money or starting real market activity.

Opportunity radar deep-research verdict: **Passed - deployed for the next scheduled run.**

## Opportunity radar live-state visibility review

Status: **Passed**

The screenshot-reported gap was real: immediate research wrote the due timestamp but reused `idle`, so the page could only say `等待执行`. The lifecycle now distinguishes `queued` from `running`, exposes both states in the schedule panel, and prevents a second click while work is active.

Direct evidence:

| Acceptance check | Result | Evidence |
|---|---|---|
| Immediate queue feedback | Passed | Browser click receives HTTP 202, renders `已加入调研队列`, changes the CTA to `已加入队列`, and disables it |
| Running feedback | Passed | Database claim transition is observed by the browser within the three-second active polling interval and renders `正在中文调研` |
| Duplicate prevention | Passed | Database test rejects a second queue request while queued; the UI action is disabled for queued and running |
| Automatic schedule behavior | Passed | Scheduler test verifies a due OpenWorker run persists `queued` while remaining claimable |
| Responsive UI | Passed | Desktop queued and 390px running screenshots render the status strip with no document overflow |
| Live deployment | Passed | Live 5273 rendered `正在中文调研`, the actual 15:10 start time, and a disabled action while the user's OpenWorker run continued uninterrupted |
| Regression | Passed | 7 files / 80 tests, 8/8 Playwright, focused browser rerun, TypeScript, ESLint, production build, and patch hygiene |

The status strip uses restrained state feedback only. It introduces no fake progress percentage, fabricated search steps, extra design system, icon family, or decorative animation.

Opportunity radar live-state visibility verdict: **Passed - deployed.**

## Radar platform and Task-to-Skill review

Status: **Passed**

The specialized opportunity radar is now the first built-in Task inside a broader `雷达` research-automation control plane. New Radar Tasks are editable experiments until they complete real read-only rehearsals, deterministic evaluation, a failure drill and human Skill approval. Production scheduling pins an immutable content-hashed Skill Version and never follows the editable draft.

### Direct evidence

| Area | Result | Evidence |
|---|---|---|
| Non-destructive migration | Passed | Pre-migration backup and live database both return `integrity_check=ok`; live foreign keys return zero violations. Existing project/run/opportunity/report/experiment/asset/schedule counts are unchanged; one manual system Task is intentionally added for the opportunity-radar projection. |
| Original opportunity radar | Passed | Imported once with its approved repository Skill; its existing `radar_schedule` remains the sole scheduling authority. Existing 3 × 85-point evidence, counter-evidence, buyer, channel and monetization UI/regression tests still pass. |
| Definition and safety boundary | Passed | Zod validates source, input/output, pipeline, success and capability contracts. Unsafe names, traversal, malformed definitions, missing Codex Git projects and credential-like Skill content are rejected. |
| Real rehearsal | Passed | Agent Runs persist `runMode`, revision, ordered steps, timestamps, summaries, errors and evaluation checks. OpenWorker/Codex receive the immutable definition snapshot; UI reads only persisted events. |
| Failure recovery | Passed | Full browser journey deliberately fails `核验与去重`, displays the real error, starts a new Run from that step, preserves the preceding passed summary as an immutable checkpoint and increments retry count. |
| Promotion gate | Passed | Positive/negative tests require two distinct successful rehearsal Runs and one passed failure drill for the current revision. Candidate content stays in SQLite until human approval. |
| Human Skill review | Passed | UI exposes complete generated content, change summary, evidence Run ids and SHA-256. Approval rejects repeat approval and unrelated path overwrite before materializing `SKILL.md` and `agents/openai.yaml`. |
| Version pinning | Passed | Draft edits advance revision without changing the scheduled version. Two consecutive production tests use the same approved Skill id, definition revision and content hash, and both initialize real persisted steps. |
| UI and accessibility | Passed | Left navigation, multiple cards, six detail tabs, create/edit/preflight/retry/evaluate/approve/schedule controls, loading/empty/error/success/blocked states, explicit close button, themes and reduced motion are present. Desktop and 390px layouts have no document overflow. |
| Full regression | Passed | 8 files / 90 unit and integration tests; 9/9 Playwright journeys; TypeScript; ESLint; MCP/API/Web production builds; and `git diff --check`. |
| Constant local operation | Passed | LaunchAgent API and OpenWorker are healthy on loopback. The authority database is preserved under `~/.local/share/personal-os/data`, passes quick/foreign-key checks, and OpenWorker reports `personal_os` connected with 26 tools including `update_radar_step`. |

### Review findings resolved

1. Localized the remaining raw `succeeded` card value.
2. Added an accessible close button and constrained the Radix detail dialog to the mobile viewport.
3. Required Codex Radar Tasks to bind a valid project Git repository at creation and preflight.
4. Added persisted failed-step checkpoint retry, which the original Phase 2 design required but the first implementation pass omitted.
5. Made passed/skipped checkpoints terminal at the MCP boundary so an executor cannot silently rewrite them during resume.
6. Added pre-approval Skill content, diff and evidence review instead of asking the user to approve a hash-only card.
7. Initialized and enforced ordered step records for production Runs as well as rehearsals.

### Safety and rollback

- The feature is additive and local-first. No existing opportunity, report, evidence, schedule, Agent Run or Skill was deleted or rewritten.
- The existing opportunity scheduler can keep running if the new control-plane UI is disabled; the imported Task is manual and cannot double-dispatch it.
- Unapproved generated Skills are not discoverable on disk. Approval cannot perform external writes, store credentials, commit Git, publish or contact anyone.
- New generic schedules can be paused without losing Runs, evaluations or versions. Selecting an earlier approved version is the rollback mechanism; editing a draft does not alter production.
- Phase 4 DAG branching, parallel steps, shared caches and automatic Skill-improvement proposals remain explicitly deferred.

Radar Platform verdict: **Passed — deployed and ready for user acceptance.**

## Radar workspace, Runtime fallback and Qishui music pilot review

Status: **Passed and deployed**

The Radar landing page is now a cross-task operations index. Reports, definitions, flows, rehearsals, Skill promotion, schedules and run history belong to a dedicated task workspace. Runtime routing is explicit and bounded instead of silently assuming OpenWorker can complete every task.

| Acceptance check | Result | Evidence |
|---|---|---|
| Homepage information architecture | Passed | Live `/radar` contains two task cards and operational counts; it contains no opportunity report body or schedule editor |
| Dedicated workspace | Passed | `/radar/:id` browser journeys cover the built-in opportunity report and generic task tabs on desktop and 390px mobile |
| Runtime persistence | Passed | Domain and SQLite tests persist preferred, fallback, triggers, maximum handoffs and per-step choices; browser editing preserves all 11 music steps |
| Bounded handoff | Passed | Dispatcher tests cover unavailable preferred route, retry handoff after a tool failure and no handoff for a quality-gate failure; audit events identify the route change |
| Qishui pilot contract | Passed | Live API and SQLite expose the official Top 10, deduplication, authorized-audio coverage, deterministic analysis, originality, Suno package and approval workflow |
| Safe activation | Passed | Live state has no approved Skill, pinned version, schedule, next run or Agent Run; production controls remain disabled until rehearsal and human approval complete |
| Copyright and spend boundary | Passed | Definition excludes DRM bypass, redistribution, specific artist/voice/melody imitation and unapproved Suno credit use; missing legal audio must reduce coverage rather than fabricate features |
| Full regression | Passed | 8 files / 93 tests, 10/10 Playwright journeys, TypeScript, ESLint, production build, health check, live SQLite checks and clean patch hygiene |

The pilot does not yet claim that Qishui's current interface, a lawful audio source or Suno credits are available. Those facts are intentionally deferred to preflight. The task also does not download protected full tracks or submit a Suno generation automatically. After two accepted rehearsals, one failure drill and explicit Skill approval, the user can bind the desired daily time.

Radar workspace/runtime verdict: **Passed, deployed and ready for user preflight.**

## Obsidian Radar export review

Status: **Passed and deployed**

The previous Project `obsidianPath` was metadata only. Completed Radar results can now be deliberately exported from Run History into the configured Vault as durable Markdown, while SQLite remains the authority for status, scheduling and audit history.

| Acceptance check | Result | Evidence |
|---|---|---|
| Trusted destination | Passed | Vault root comes from API environment; hostile browser destination input is ignored and traversal is rejected |
| Safe persistence | Passed | Atomic temp/rename write, deterministic Run filename, unrelated collision refusal and create-only Project hub |
| Durable linkage | Passed | Frontmatter records Project, Radar, Task, Run, Runtime, timestamps and repository; Run records the note as an artifact and audit event |
| Idempotency | Passed | Re-export updates the same note and creates neither a duplicate artifact nor duplicate event |
| Operator UI | Passed | Definition shows Vault/Project state; Run History shows export, loading, blocked, success, re-export and archived states |
| Qishui integration | Passed | Git clone, Personal OS Project, Obsidian hub and Radar linkage are verified live; definition revision and execution contract remain unchanged |
| Regression | Passed | 96 tests, 10/10 browser journeys, lint, typecheck, builds, health and patch hygiene |

Known boundary: export is currently an explicit human action. It does not auto-fill Obsidian with unreviewed or failed outputs. The Qishui Radar has no completed Run yet, so its Project hub exists now and the first result note will appear after a successful rehearsal or production Run is exported.

Obsidian export verdict: **Passed — linked and ready for the first Qishui result.**

## Radar goal-directed recovery review

Status: **Passed and deployed**

The reported state was a real correctness defect. Codex had finished one turn, but the system treated that transport-level completion as reviewable even though the result was only 747 characters, contained two sources instead of three, omitted every required section and left all 11 persisted steps queued. Completion and success are now separate states.

| Acceptance check | Result | Evidence |
|---|---|---|
| Deterministic success | Passed | Shared evaluator requires the full output contract and every required persisted step before review |
| Structured Codex bridge | Passed | SDK output schema and Zod validation require exact step keys, complete report, verification, blocker, strategies and next actions |
| Goal-directed retry | Passed | Recovery prompt retains definition, previous result, failed checks, source Run and checkpoints, and forbids repeating the same failed route |
| Bounded autonomy | Passed | Four-attempt budget; input-required needs three distinct lawful strategies and one concrete minimum action; no unbounded loop |
| Review integrity | Passed | Failed Radar evaluation moves out of Needs Review and the database rejects acceptance without a passed standard evaluation |
| Truthful operator UI | Passed | Live workspace renders attempt 3/4 recovery and 14 failed checks; old evidence remains immutable and is not shown as waiting for acceptance |
| Safety boundary | Passed | Recovery cannot substitute another platform, reverse engineer private interfaces, spend Suno credits, publish, contact people or fabricate unavailable evidence |
| Regression | Passed | 101 unit/integration tests, 10/10 browser journeys, typecheck, lint, production build and patch hygiene |
| Live operation | Passed | Authority DB backup, SQLite quick/foreign-key checks, API health, Web response and completed Qishui attempt 3/4 recovery verified |

Review also found one unrelated retry-loop hygiene issue: old failed Runs whose Tasks were already Done could remain due forever and generate repeated skipped logs. Retry selection now joins the Task state and attempt budget, so only genuinely actionable failures are dispatched.

Known boundary: when the requested official source is not publicly exposed, the correct terminal state is not a fabricated replacement chart. The system must try the remaining approved paths, then ask for the smallest valid input, such as an official export or a screenshot from the user's authenticated app, and resume from that checkpoint.

Live attempt 3/4 produced a complete persisted recovery report, nine sources, three original lyric directions and passing deterministic checks. Because no approved route exposed the actual chart, it stopped at one precise boundary: provide an App screenshot containing chart name, ranks 1–10, song, artist and device time. The workspace now disables starting a fresh rehearsal and directs continuation from the failed chart-capture step after that input is present.

Radar recovery verdict: **Passed — invalid results can no longer masquerade as successful work, and the live Qishui task reached a concrete, resumable input boundary.**

## Qishui Android emulator runtime review

Status: **Runtime passed; chart target decision pending**

The machine now has a dedicated, persistent ARM64 Android runtime for Qishui collection. The lifecycle, provenance and truthful preflight behavior are verified; acceptance cannot be called fully complete until the user personally handles Qishui's privacy agreement and account gate.

| Acceptance check | Result | Evidence |
|---|---|---|
| Native Apple Silicon runtime | Passed | API 35 Google Play `arm64-v8a` image, Emulator 36.6.11 and hardware virtualization; no x86 image installed |
| Dedicated lifecycle | Passed | `Qishui_Radar_API_35` completed stop, cold start and boot wait; shutdown targets only the matching AVD serial |
| Resource configuration | Passed | Host GPU, 4 GB RAM, 512 MB VM heap, persistent 10 GB userdata; SDK uses 3.8 GB and AVD uses 5.3 GB with 148 GB free |
| APK provenance | Passed | Qishui official page → `ugapk.com/GMg3/` → `ugapk.cn`; package `com.luna.music`, version 20.3.0, SHA-256 recorded before install |
| App persistence | Passed | Package and version remain installed after a full emulator stop/start cycle |
| Safe app launch | Passed | Launcher Activity resolution plus `am start -W` replaces the failing physical-key `monkey` route |
| Human gates | Passed | Agreement/login/captcha/risk markers return `input_required`; automatic `同意` and permission grant clicks were removed |
| Scheduled cleanup | Passed | Wrapper released the AVD after a recoverable missing-app run and preserves it only for a human checkpoint |
| Personal OS integration | Passed | API restart deployed managed startup; live Radar revision 4 uses the wrapper; live preflight reports the current agreement page instead of false success |
| Target-aware preflight | Passed | Agreement cleared and anonymous browsing works; preflight now navigates to the configured chart and rejects the absent 上升榜 |
| Real UI parser | Passed | Two visible 热歌榜 pages reliably yield continuous ranks 1–10 after removing icon glyphs and separating artists from albums |
| Regression | Passed | 20 Qishui tests, 104 Personal OS tests, typecheck, lint, production builds and patch hygiene |

Current boundary: the agreement is complete and no account login is required for browsing. Qishui 20.3.0 visibly exposes only `热歌榜`、`新歌榜` and `欧美榜`; it does not expose the configured `上升榜`. The system will not call 热歌榜 an 上升榜. The available 热歌榜 Top10 path and parser are proven, but changing the production target requires explicit user approval.

## AI Runtime visual control layer and ledger review

Status: **Passed and deployed**

The product now behaves as a control layer rather than a second task manager. Task remains a private compatibility and scheduling object, while the primary interface is organized around intent, Runtime execution, approvals, reusable workflows and durable results.

| Acceptance check | Result | Evidence |
|---|---|---|
| Information architecture | Passed | Exactly five primary areas; `/tasks`, `/review` and `/experiments` redirect without deleting stored records |
| Unified Runtime operation | Passed | Today, Project and Runs can issue a Run Request; route reason, fallback, capabilities, steps, events, output and acceptance share one Run detail |
| Server-owned capability truth | Passed | Live health exposes Codex workspace/shell/web/structured output and OpenWorker pull/MCP/shell/image status with limitations |
| Project control surface | Passed | Project detail contains Runs, Workflow, Artifacts and Context instead of a task list |
| Artifact persistence | Passed | Existing run paths, reports, experiments, income assets and approved Skills are backfilled and linked to their source objects |
| Actual versus expected | Passed | Paid cost and received revenue alone determine actual profit and cash ROI; planned/committed/expected/invoiced values remain separate |
| Audit-safe accounting | Passed | Smallest-unit storage, explicit FX, Run attribution, evidence paths, reversals and balanced shared-cost allocation are tested |
| Unknown Runtime pricing | Passed | Unknown amount remains visibly unknown; known trusted reports create one idempotent paid cost entry |
| Regression | Passed | 110 tests, 7/7 Playwright journeys, typecheck, lint, builds and patch hygiene |
| Live deployment | Passed | Database backup, additive migration, API/Web restart, SQLite checks, both Runtime health checks and cancelled no-write smoke Run pass |

Review found no release-blocking defect. The one edge case found during review, usage-only cost reports overwriting a prior actual amount, was corrected before deployment. Payment-provider sync, tax accounting and automatic currency-rate lookup remain intentionally outside this module.

Control layer and ledger verdict: **Passed, deployed and ready for daily use.**

## 2026-08-01 Personal OS vNext MVP1 review

Status: **Passed as a parallel MVP1; production cutover is not approved yet.**

Scope: `docs/PERSONAL-OS-VNEXT-REWRITE-PLAN.md` and `docs/PERSONAL-OS-VNEXT-MVP1-ACCEPTANCE.md`.

### Outcome

The rewrite now provides a coherent local control layer rather than another Task Kanban. WorkSpec is the reusable definition, Run is the execution fact, RunEvent is the persisted timeline, Schedule creates Runs, and Assets unifies generated results, Obsidian knowledge and finance. Old 5273/8787 remains intact while vNext runs independently on 5373/8887.

Every MVP1 acceptance row is Passed. The official v2 store contains the live v1 core history and preserves the two real daily automations: AI news at 06:30 and opportunity Radar at 08:00. Radar objectives, contracts, pipelines and selected Skill content are embedded in the migrated WorkSpec input rather than reduced to a title.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| High | Importer v1 omitted Radar definitions, Skill content and schedules | Added versioned importer v2, supplemental idempotent upgrades, live migration and fixture coverage |
| High | Finance transaction insert and account balance update were separate commits | Replaced them with one SQLite transaction and added forced-failure rollback coverage |
| Medium | SSE could miss an event between backlog replay and subscription | Subscribe first, buffer during replay, de-duplicate by sequence and serialize live writes |
| Low | Internal delayed execution retained an AbortSignal listener after success | Remove the listener when the delay resolves |

No unresolved MVP1 release-blocking defect remains.

### Direct evidence

| Gate | Result |
|---|---|
| Unit/integration | 15 files, 139/139 tests |
| vNext browser journeys | 4/4 |
| Old-system browser regression | 7/7 |
| TypeScript / ESLint | Passed |
| Production builds | All workspaces passed |
| SQLite | `quick_check=ok`, zero foreign-key violations, schema migrations 1–4 |
| Live v2 data | 4 WorkSpecs, 12 Runs, 21 Artifacts, 2 Schedules |
| Source immutability | v1 SHA-256 unchanged after read-only import |
| Security / patch hygiene | No vNext shell interpolation or embedded secrets; `git diff --check` passed |
| Health | API healthy; Internal and Process Executors available |

### Remaining gates

- CodexAdapter and OpenWorkerAdapter must be implemented against the stable ExecutorAdapter contract and pass real read-only smoke tests.
- Approval, cost and richer Artifact collection remain follow-on governance work beyond this MVP1 matrix.
- Port replacement, old Scheduler shutdown and the timed ten-minute rollback drill remain Phase 7. Until then, vNext is a parallel accepted build, not the production authority.

Verdict: **MVP1 rewrite passed. Proceed to MVP2 Runtime integration; do not delete or cut over the old system yet.**

## 2026-08-01 Personal OS vNext MVP2 Runtime review

Status: **Passed as a parallel Runtime integration; production cutover remains intentionally pending.**

Scope: `docs/PERSONAL-OS-VNEXT-MVP2-AI-SPEC.md` and `docs/PERSONAL-OS-VNEXT-MVP2-ACCEPTANCE.md`.

### Outcome

vNext now calls both Codex and OpenWorker through the same server-owned execution contract. The UI can select the correct Runtime configuration, the API persists Run state/events/results, Codex returns a real thread ID and usage, and OpenWorker returns a real session ID. Approval or input prompts stop visibly instead of being auto-approved or misreported as success.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| High | A non-fatal Codex SDK warning was treated as a fatal turn error | Map item-level SDK errors to `runtime.warning`; only top-level and turn failures fail the Run; add regression coverage |
| High | vNext Web still showed AI Runtimes as “待接入” and submitted Process-shaped inputs | Add Project/Codex/OpenWorker-specific forms and a browser acceptance journey |
| Medium | Legacy database initialization rewrote the Qishui Task timestamp on every open | Make the compatibility update conditional and prove reopen idempotency in a file-backed regression test |
| Medium | Runtime SSE subscriber omitted `runtime.*` and waiting events | Subscribe to session/output/usage/tool/warning/waiting plus Run waiting events |
| Medium | First live smoke stopped after Codex and never reported OpenWorker | Isolate per-Runtime smoke results and report both before returning failure |
| Medium | Global Codex Plugin/Skill inventory exceeded the SDK prompt budget | Isolate global discovery in the Runtime invocation while preserving WorkSpec/Skill instructions in task context |

### Direct evidence

| Gate | Result |
|---|---|
| Unit/integration | 15 files, 152/152 tests |
| Runtime contract | 13/13 focused tests |
| vNext browser journeys | 5/5 |
| Old-system browser regression | 7/7 |
| TypeScript / ESLint / builds | Passed |
| Codex live smoke | `PERSONAL_OS_CODEX_SMOKE_OK`, thread `019fbdbd-a315-7943-b012-16cfe4a04d35`, 26,285 input / 135 output tokens, cost unknown |
| OpenWorker live smoke | `PERSONAL_OS_OPENWORKER_SMOKE_OK`, session `personal-os-v2-smoke-openworker-1785594757468`, usage/cost unknown |
| Security | Loopback OpenWorker, file-backed Token, no real Token in diff, Codex read-only/no-network defaults |
| SQLite | `quick_check=ok`, zero foreign-key violations |
| Source immutability | v1 SHA-256 remains `2f185b…246` |

### Remaining boundaries

- An OpenWorker permission/input request is persisted as a waiting Run, but resolving that prompt from vNext belongs to the Phase 3 Approval model. MVP2 never auto-approves it.
- Provider billing is not inferred from Token usage. Unknown cost remains `null` until a trusted billing source reports it.
- Rich Artifact collection and human acceptance are Phase 3/Artifact governance work.
- Ports 5373/8887 remain parallel. Old Scheduler authority and 5273/8787 have not been cut over or deleted.

Verdict: **MVP2 Runtime integration passed. Proceed to Phase 3 governance before any production cutover.**

## 2026-08-02 Personal OS vNext Phase 3 governance review

Status: **Passed as a parallel governance layer; production cutover remains pending.**

Scope: `docs/PERSONAL-OS-VNEXT-PHASE3-AI-SPEC.md` and `docs/PERSONAL-OS-VNEXT-PHASE3-ACCEPTANCE.md`.

### Outcome

The Runtime lifecycle is now governable end to end. A waiting Run continues the original Codex thread or OpenWorker session; Approval decisions are persisted once and translated to the provider's native protocol; completion remains separate from human acceptance; usage, trusted actual cost, Artifacts and Audit form a replayable evidence chain. Scheduler restart and catch-up behavior are deterministic.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| High | Restart recovery converted valid waiting input/approval into terminal failure | Recover only `running`; prove waiting persistence with a closed/reopened file database |
| High | OpenWorker prompts had no route back to the original provider session | Store external session ID and reconnect with the exact response frame for each request type |
| High | Runtime success could be mistaken for accepted business output | Add an independent pending/accepted/rejected review state and UI actions |
| High | Git Artifact candidates could escape the linked repository | Resolve and verify every real file under the bound repository before registration; fail on escape |
| Medium | Broad Secret-key matching erased numeric token-usage fields | Preserve numeric counters, filter string/structured secrets and preserve `secret://` references |
| Medium | Approval was updated before confirming the Run was still resumable | Validate Run state and session before the first-decision-wins update |
| Medium | HTTP health reported OpenWorker healthy while its process could not open more pipes | Record the limitation, restart the exhausted service for smoke, and retain execution-level smoke as a production gate |

### Direct evidence

| Gate | Result |
|---|---|
| Unit/integration | 15 files, 170/170 tests |
| vNext browser journeys | 6/6, including acceptance and actual-cost UI |
| Old-system browser regression | 7/7 |
| TypeScript / ESLint / builds / patch hygiene | Passed |
| Runtime continuation | Codex `resumeThread`; OpenWorker question/permission/directory/plan protocol tests |
| Approval governance | Approved/rejected/expired paths, replay rejection, one pending record per Run |
| Security | Cross-layer fixture passed; exact real OpenWorker Token scan returned 0 matches |
| SQLite | Migration 5 idempotent; append-only triggers; official v2 `quick_check=ok`, zero FK violations |
| Scheduler | File-backed cross-restart uniqueness, catch-up on/off and run-now independence passed |
| Codex live smoke | `PERSONAL_OS_CODEX_SMOKE_OK`, trusted usage persisted, cost unknown |
| OpenWorker live smoke | `PERSONAL_OS_OPENWORKER_SMOKE_OK` after normal restart of the FD-exhausted old process |
| v1 boundary | No Phase 3 logical writes or authority/port switch; verification hash `91f140…e6bd` stable |

### Remaining boundaries

- Phase 3 does not authorize production port/Scheduler cutover, automatic approval, payment, publishing, external contact or inferred provider billing.
- OpenWorker's long-running file-descriptor growth needs an upstream fix or execution-level watchdog before Phase 7 cutover; a 200 health response alone is not sufficient proof of executability.
- Phase 4 should deepen Obsidian entity links and controlled note creation; Phase 5 should complete budget/forecast/operating-ledger convergence before the migration and cutover phases.

Verdict: **Phase 3 governance passed. Proceed to Phase 4 knowledge integration; keep vNext parallel and reversible.**

## 2026-08-02 Personal OS vNext Phase 4 knowledge review

Status: **Passed as a parallel Obsidian knowledge layer; production cutover remains pending.**

### Outcome

Obsidian Markdown remains the source of truth while vNext now provides Chinese search, typed links to Project/WorkSpec/Run/Artifact, reverse lookup, deletion-safe indexes, local file watching and controlled note creation. The Assets knowledge tab is now an actionable three-part workspace with explicit health, result selection, detail, tags, relations and create states.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| High | A user-supplied secret in the note title could survive in the generated filename | Redact the title before deriving the filename and cover both file content and path in the Secret test |
| High | A permitted output directory could be replaced with a symlink | Reject symlink Vault roots and controlled directories on every write |
| Medium | The first frontmatter parser only handled inline arrays | Add common indented YAML list support while retaining deterministic dependency-free parsing |
| Medium | Chinese LIKE fallback returned a result without a useful snippet | Return the first 180 characters of the matching body as the fallback summary |
| Low | The knowledge result cards had no actionable selection or relationship detail | Replace static cards with keyboard-accessible buttons, selected state and a dedicated detail pane |

### Direct evidence

| Gate | Result |
|---|---|
| Unit/integration | 15 files, 175/175 tests |
| Focused vNext | 6 files, 64/64 tests |
| vNext browser journeys | 6/6, including knowledge creation and 390px layout |
| Old-system browser regression | 7/7 |
| TypeScript / ESLint / builds / patch hygiene | Passed; only the existing vNext bundle-size warning remains |
| SQLite | Migration 6; official v2 `quick_check=ok`, zero FK violations |
| v1 boundary | SHA-256 remains `91f140…e6bd`; no port or Scheduler switch |
| Visual review | Desktop three-pane and mobile single-column screenshots reviewed under `review-artifacts/phase4/` |

Verdict: **Phase 4 knowledge integration passed. Proceed to Phase 5 finance depth; keep vNext parallel and reversible.**

## 2026-08-02 Personal OS vNext Phase 5 finance review

Status: **Passed as a parallel finance authority candidate; production cutover remains pending.**

### Outcome

The finance domain now has one reproducible fact model for accounts, transactions, transfers, refunds, budgets, forecasts, currency conversion, operating allocations and governed corrections. Cash balance, accounting report effect, expected revenue/cost and committed time remain visibly separate. Runtime actors cannot mutate financial facts directly.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| High | The earlier generic transaction shape could represent an adjustment or unlinked refund | Restrict ordinary creation to income/expense; expose linked transfer/refund services with explicit invariants |
| High | Historical transactions could be deleted by a direct service/API mutation | Remove direct delete authority and require a persisted, reviewable change proposal |
| High | A two-sided transfer could leave one side committed if the second insert failed | Validate the complete write set and commit both sides with balance changes in one SQLite transaction |
| High | A proposal decision could persist while the financial mutation rolled back | Resolve decision, apply mutation and append Audit history in one atomic store operation |
| High | A refunded transaction could be deleted or reversed while its refund remained active | Reject delete/reverse proposals for targets with active refunds; retain update as an explicit reviewed correction |
| Medium | Repeated reversal approval could create multiple compensating facts | Enforce one reversal per source in both service validation and a unique database index |
| Medium | Floating-point UI conversion could silently alter user-entered money | Parse decimal strings with BigInt and send exact minor units; use rational BigInt conversion and half-up rounding in the domain |
| Medium | The finance command grid exceeded a 390px viewport | Replace min-content grid tracks with bounded `minmax(0, …)` tracks and prove document-width equality in Playwright |

### Direct evidence

| Gate | Result |
|---|---|
| Unit/integration | 15 files, 191/191 tests |
| Focused vNext | 6 files, 80/80 tests |
| vNext browser journeys | 7/7, including complete finance UI and mobile overflow diagnostics |
| Old-system browser regression | 7/7 |
| TypeScript / ESLint / builds | Passed; only the pre-existing vNext bundle-size warning remains |
| Transfer/refund integrity | Balanced, FX mismatch, cumulative limit, rollback and reporting-exclusion tests passed |
| Proposal governance | Redaction, approve/reject, history, duplicate reversal, active-refund and rollback paths passed |
| Calculation replay | Budget, forecast and currency-conversion snapshots reproduce their original result |
| Operating ledger | Allocation idempotency/conflict/limit and expected/committed summary tests passed |
| SQLite | Migration 7; official v2 `quick_check=ok`, zero foreign-key violations |
| Visual review | Desktop dark and 390px mobile light screenshots reviewed under `review-artifacts/phase5/` |
| v1 boundary | SHA-256 `91f140…e6bd` unchanged; no port, Scheduler or Runtime record-authority switch |

### Remaining boundaries

- Phase 5 does not authorize automatic payment, unreviewed Runtime finance writes, inferred provider billing, production port/Scheduler cutover or deletion of the old system.
- Phase 6 must integrate finance, knowledge, Runs, reusable WorkSpecs and schedules into the final five-zone control surface without creating a second design system.
- Phase 7 must prove repeated production-copy migration, rollback and execution-level Codex/OpenWorker health before sovereignty can move.

Verdict: **Phase 5 finance passed. Proceed to Phase 6 five-zone final integration; keep vNext parallel and reversible.**

## 2026-08-02 Personal OS vNext Phase 6 integration review

Status: **Passed as the final parallel UI; sovereignty remains with v1 until Phase 7 cutover gates pass.**

### Outcome

The five primary areas now form one navigable control surface rather than five isolated dashboards. A user can discover an attention item or search result, enter a stable Project/Skill/Run/Artifact/Knowledge record, inspect its originating facts and act through the governed API. Schedules expose editable timing while remaining pinned to an immutable workflow WorkSpec.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| High | Internal and Process workflows could not bind a Project, leaving Project aggregation empty | Expose optional project binding for every Runtime; keep Codex binding required and Git-filtered |
| High | Schedule update inherited defaults, so `{}` was treated as a valid change | Define an explicit optional update Schema and reject an empty object before mutation |
| Medium | Cross-zone cards and search results opened lists without stable entity identity | Add dynamic Project, Radar, Run, Artifact and Knowledge routes and preserve legacy redirects |
| Medium | Run actual-cost input used floating-point `Math.round` | Parse decimal strings into safe integer minor units with BigInt |
| Medium | Global search had no explicit close action on touch devices | Add a labelled Radix close control and mobile browser assertion |
| Medium | Radar detail produced a dead desktop column beside a long definition | Let the definition span two grid rows and stack normally below 1050px |
| Low | A decorative project gradient conflicted with the established restrained visual system | Replace it with a single mixed surface color |
| Test reliability | The file-watcher assertion timed out once only under parallel suite load | Retain the bounded event test, extend its ceiling to 5 seconds and prove three isolated plus focused/full passes |

### Direct evidence

| Gate | Result |
|---|---|
| Unit/integration | 15 files, 194/194 tests |
| Focused vNext | 6 files, 83/83 tests |
| vNext browser journeys | 10/10 |
| Old-system browser regression | 7/7 |
| Static/build hygiene | TypeScript, quiet ESLint, all builds and diff check passed |
| Unified search | Five entity types, Chinese, wildcard escaping, empty query and limit tests |
| Schedule management | Create/edit/pause/resume/run-now, next-run recomputation, Audit and pinned ID tests |
| Responsive/theme | Seven routes plus search at 390px; light/dark/system/reduced-motion passed |
| Visual review | Four Phase 6 screenshots reviewed; no second design system or horizontal overflow |
| Security | Exact OpenWorker Token appears zero times in Git diff and v2 DB |
| SQLite | Official v2 schema 7, `quick_check=ok`, zero FK violations |
| v1 boundary | SHA-256 `91f140…e6bd` unchanged; no sovereignty switch |

### Remaining boundary

Phase 6 does not authorize a production port, database, Scheduler or Runtime-record switch. Phase 7 must perform three production-copy migrations, a real rollback drill, execution-level Codex/OpenWorker smoke, Schedule duplicate checks, final freeze and read-only old-system archival.

Verdict: **Phase 6 passed. Proceed to Phase 7 migration rehearsals; do not move sovereignty before every cutover gate passes.**

## 2026-08-02 Personal OS vNext Phase 7 production cutover review

Status: **Passed; vNext owns the production control plane.**

### Outcome

Formal Web `5273`, API `8787`, the v2 database, Scheduler and Runtime record chain now belong to vNext. The old generation remains available through an explicit rollback command with its automation disabled, and a complete v1 snapshot is sealed read-only. OpenWorker remains an independent service on `8765` and was not replaced during the switch.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| Blocker | macOS LaunchAgent returned `EX_CONFIG` when its executable/working directory lived under `Documents/Codex` | Atomically deploy a self-contained production runtime under `~/.local/share/personal-os-v2/runtime/current`; point both vNext and v1 rollback generations there |
| High | Creating a new Run left the previous Run's governance buttons actionable until the create mutation settled | Disable governance while creation/action mutations are pending and atomically seed the new WorkSpec/Run caches |
| High | New Run detail could render the generic title because WorkSpec cache was not updated | Return both created entities, update both cache collections, invalidate both queries, and assert the selected Run title before E2E acceptance |
| Medium | A plain health endpoint could claim an Adapter was available without executing it | Execute Codex and OpenWorker through the formal vNext API and require session, exact response, event, audit and review evidence |
| Medium | Two old Artifact paths no longer exist | Preserve the source rows and payloads; expose the pre-existing missing paths in migration verification instead of silently dropping them |
| Low | Default LaunchAgent install and desktop launcher could restore v1 on a future start | Make vNext the default generation; desktop start now builds, deploys Runtime and explicitly installs `--generation=vnext` |

### Direct evidence

| Gate | Result |
|---|---|
| Deterministic migration | Three fresh targets, fingerprint `cd11d69…c0d9`; schema 8, importer 4 |
| Data integrity | All declared mapping counts match; quick checks ok; zero FK violations; source hash unchanged |
| Production health | vNext LaunchAgents running at 5273/8787 from the local runtime package; Scheduler enabled only in vNext |
| Live Runtime | Codex and OpenWorker exact-response Runs persisted and accepted; Qishui Git state unchanged |
| Schedule uniqueness | One firing and one Run before/after a persisted service restart |
| Real rollback | v1 healthy in 2 seconds with automation disabled; final vNext healthy again in 2 seconds |
| Automated regression | 203/203 Vitest; vNext 10/10 Playwright; v1 7/7 Playwright; typecheck, lint, builds and diff check passed |
| Secret boundary | Exact real OpenWorker Token scanned across 167 changed/database/plist/archive files with zero matches |
| Archive | v1 DB, pre/post v2 DB, old plist, old source, migration/runtime reports and SHA-256 manifest sealed read-only |

### Remaining non-blocking limitations

- The vNext production Web bundle remains above Vite's 500 kB advisory threshold. It should be code-split, but local first paint and all responsive journeys pass.
- Two historical Artifact paths cannot be restored because their files were already absent before cutover; the original references and database facts remain preserved.
- v1 is a rollback mechanism, not an active co-authority. New vNext facts created after cutover are not automatically back-ported into v1.

Verdict: **Phase 7 passed. The vNext rewrite and production sovereignty transfer are complete.**

## 2026-08-02 Personal OS Phase 8 sovereignty cleanup review

Status: **Passed; the current system is the only active Personal OS authority.**

### Outcome

The repository, package graph, production Runtime, LaunchAgents, SQLite authority and OpenWorker integration no longer contain an executable v1 path. Retired assets are recoverable only from `~/.Trash/personal-os-retired-v1-20260802-201302`; normal startup cannot select or write them.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| Blocker | OpenWorker's still-running LaunchAgent executable and workspace pointed into the retired v1 root | Rebuild current OpenWorker source under the v2 runtime root, replace the LaunchAgent and move its workspace/logs |
| High | An enabled five-minute OpenWorker automation still called the v1 MCP queue | Export its definition and delete the exact automation; verify the automation list is empty |
| High | OpenWorker MCP configuration still registered the v1 database-writing server | Remove `personal_os`; verify `mcpServers` is empty |
| High | Package lock retained deleted workspaces after an ordinary install | Preserve the stale lock in Trash and regenerate it from the current workspace graph |
| Medium | Renamed E2E configuration still referenced the old Vault name | Update the test path and rerun the complete 10-journey suite |
| Medium | Current-source OpenWorker install resolved incompatible MCP 2.0 | Pin MCP 1.28.1, matching the source runtime, and prove server/API health |
| Low | Historical Phase 7 acceptance still implied rollback remained supported | Mark it explicitly superseded by Phase 8 and rewrite current operations documentation |

### Direct evidence

| Gate | Result |
|---|---|
| Active source | Only `apps/api-v2`, `apps/web-v2` and `packages/vnext-*` remain |
| Active Runtime | Only current API/Web/static runtime; no previous directory or cutover root |
| Business facts | v2 SHA-256 unchanged; SQLite `quick_check=ok` |
| OpenWorker | Current-source runtime healthy at 8765, Web healthy at 5274, default workspace under v2, automation list empty |
| Regression | Vitest 87/87; Playwright 10/10; typecheck, lint, build and diff check passed |
| Recovery | 1.0 GB retired Runtime plus repository/config exports are in a named macOS Trash folder |

### Next-stage boundary

Phase 9 should implement a native v2 MCP gateway and versioned repository Skills for Codex/OpenWorker. It must call the current Core API/use cases, preserve approval/audit/lease semantics and never reintroduce direct v1-database tools or the old polling automation.

Verdict: **Phase 8 passed. Proceed to Phase 9 native v2 MCP + Skills integration.**

## 2026-08-03 Personal OS Phase 9 Agent Gateway review

Status: **Passed and deployed.**

### Outcome

Personal OS now owns a narrow native v2 Agent Gateway instead of relying on the removed v1 pull queue. Every Codex/OpenWorker execution receives a short-lived, scoped per-Run capability; versioned repository Skills are pinned into immutable WorkSpecs; progress, artifacts, approvals and structured results return only through Core API and Audit.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| High | Headless Codex allowed the read-only MCP call but cancelled progress/result writes because no approval UI existed | Set `default_tools_approval_mode=approve` only on the per-Run `personal_os` MCP server, restrict it to the exact seven governed tools, and retain Core API capability scopes as the authorization boundary |
| High | A Runtime could return explanatory text after MCP failure and still be marked succeeded | Require a persisted structured MCP submission before any Skill-bound Codex/OpenWorker Run can succeed |
| Medium | Codex MCP events were stored as generic item IDs, hiding which tool failed | Persist server, tool, status and safe error metadata as `runtime.mcp_tool_call` events |
| Medium | Re-running production Skill pinning could pause already canonical schedules | Make canonical detection idempotent; dry-run/apply/dry-run now produces no actions and both schedules remain enabled |
| Medium | Runtime deployment recreated retained `previous-*` generations after Phase 8 | Keep the old current directory only during the atomic swap and remove it after success; production contains only `current` |
| Low | Real-smoke WorkSpecs remained active after acceptance | Retire smoke WorkSpecs after successful verification; historical Runs remain auditable |

### Direct evidence

| Gate | Result |
|---|---|
| Automated regression | Vitest 93/93; Playwright 10/10; typecheck, ESLint, builds and diff check passed |
| MCP | Official SDK stdio smoke listed exactly seven tools; no Infrastructure or SQLite dependency |
| Live Codex | Run `a7dea800-63ff-4357-8164-2cc5bb94e7c5` persisted three completed MCP calls and structured result |
| Live OpenWorker | Run `1285be3f-e7e0-4561-bf70-8c842cd1f780` persisted progress and structured result through the fixed MCP server |
| Skills | Three repository Skills validated; production schedules pin the AI briefing and opportunity-research hashes |
| Production | API/Scheduler/Runtime health passed; two enabled schedules, zero pending approvals, only current Runtime |
| Data integrity | SQLite migration 9, `quick_check=ok`, zero foreign-key violations |
| Security | Token/config modes `0600`; source/log scan found no emitted Capability value; no high-risk external-action tool exists |

### Remaining non-blocking limitation

- The Web bundle still triggers Vite's existing 500 kB advisory warning. It does not block local correctness but should be code-split in a later performance phase.

Verdict: **Phase 9 passed. The native v2 Agent Gateway and Skill authority are ready for normal Personal OS workflows.**

## 2026-08-03 Personal OS Phase 10 workflow operations review

Status: **Passed and deployed.**

### Outcome

Personal OS now exposes the safe daily maintenance loop above Codex/OpenWorker: a user can validate and publish a Skill, create an immutable workflow revision, run an explainable preflight, explicitly rebind a Schedule and observe bounded automatic recovery. Historical WorkSpecs and Runs remain unchanged.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| High | Production Skill writes would have targeted the atomically replaced Runtime copy, so a later deployment could erase them | Configure the LaunchAgent with the Git worktree `.agents/skills` as the explicit read/write authority |
| High | Schedule update persisted timing fields but did not update `work_spec_id` during a rebind | Add the bound WorkSpec to the repository update and prove timing, timezone and enabled state remain unchanged |
| High | A Skill directory symlink could redirect a read or publish outside the allowed root | Reject symlinked Skill roots and entries on validation, read and atomic publish paths |
| Medium | A failed Runtime could immediately end a scheduled workflow without using its declared retry policy | Retry only Scheduler-created retryable failures, create a new Run per attempt and stop at `maxAttempts` |
| Medium | Skill source in Audit could expose instructions or accidental sensitive text | Audit only name, version and safe Hash metadata; validate obvious secrets before any write |
| Medium | Health check could run before a freshly installed LaunchAgent opened its port | Add a bounded startup retry window while preserving a non-zero failure after the limit |

### Direct evidence

| Gate | Result |
|---|---|
| Automated regression | Vitest 100/100; Playwright 11/11; typecheck, ESLint, Build and diff check passed |
| Skill governance | Version, optimistic conflict, secret, traversal, symlink and atomic publication tests passed |
| Workflow governance | Immutable lineage, preflight checks, Schedule rebind and Audit tests passed |
| Recovery | Scheduler-only retry, fresh Run lineage, manual no-retry and exhaustion tests passed |
| Production | Web 5273, API 8787, Scheduler, Codex and OpenWorker healthy; two enabled schedules |
| Database | Migration 10, `quick_check=ok`, zero foreign-key violations |
| Visual | Desktop and 390px Radar operations screenshots reviewed with no horizontal overflow |

### Remaining non-blocking limitations

- The existing Vite bundle remains above its 500 kB advisory threshold.
- Workflow health is visible in Personal OS but does not yet send an external notification when a schedule becomes degraded.
- Agent-created Obsidian prose still requires the existing controlled note flow; arbitrary Vault writes remain intentionally unavailable.

Verdict: **Phase 10 passed. Workflow maintenance and scheduled recovery are usable without giving Codex or OpenWorker uncontrolled authority.**

## 2026-08-04 Personal OS Phase 13 production automation operations review

Status: **Passed and deployed.**

### Outcome

The Scheduler now owns an auditable occurrence ledger, and Radar exposes the real production state above Codex and OpenWorker: current step, last success, next trigger, Obsidian deposition, duration, actual cost and an actionable failure category. Today surfaces unresolved schedule misses without restoring the retired task queue.

### Findings resolved before verdict

| Severity | Finding | Resolution |
|---|---|---|
| High | A successful rehearsal Run could make a production workflow look recovered | Exclude rehearsal and failure-drill Runs from production operations health, with a direct regression test |
| High | Rebinding a Schedule could attribute its historical occurrences to the newly bound WorkSpec | Persist `work_spec_id` on each occurrence, backfill from its linked Run first and test post-occurrence rebinding |
| Medium | A process restart could leave a scheduled queued Run permanently unstarted | Convert it to an explicit failed attempt and enter the existing bounded retry policy |
| Medium | The crash window between occurrence claim and Run creation was invisible | Detect the incomplete occurrence on the next Tick, record `start_failed` and write Audit |
| Low | The old Radar summary could not distinguish policy skip, catch-up and start failure | Expose the four occurrence outcomes and a compact operator-facing reason |

### Direct evidence

| Gate | Result |
|---|---|
| Automated regression | Vitest 125/125; Playwright 15/15; TypeScript, ESLint, Build and diff check passed |
| Scheduler correctness | On-time, catch-up, skip, start failure, restart de-duplication and bounded recovery tests passed |
| Lineage | Production-only Run selection and WorkSpec-stable occurrence history tests passed |
| Visual | Desktop dark and 390px light Radar operations screenshots reviewed without overflow |
| Production | Web 5273, API 8787, Scheduler, Codex and OpenWorker healthy; three schedules enabled |
| Database | Migration 14, `quick_check=ok`, zero foreign-key violations and six migrated/fired occurrences |
| Recovery | Pre-deploy backup `personal-os-v2-2026-08-04T01-27-36-277Z.db` retained |

### Remaining non-blocking limitation

- The existing Vite production bundle still exceeds its 500 kB advisory threshold. This is a later performance/code-splitting task and does not affect the local control plane's correctness.

Verdict: **Phase 13 passed. Production automation is now visible, attributable and recoverable without expanding Agent authority.**
