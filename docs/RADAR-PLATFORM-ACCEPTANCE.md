# Radar Platform MVP Acceptance

Status: Passed for Phases 1-3 and workspace/runtime extension
Date: 2026-07-29
Scope: `RADAR-PLATFORM-DESIGN.md` phases 1 through 3. Phase 4 arbitrary branching and parallel orchestration remains deferred.

This matrix is the release contract for turning the specialized opportunity radar into a multi-task `雷达` control plane with real rehearsal and Task-to-Skill promotion. Every row starts Pending. A row may move to Passed only with direct code, database, API, browser, or test evidence recorded in `REVIEW.md`.

## Scope and rollback

- The migration is additive. It may add tables and nullable columns but must not delete or rewrite opportunity, report, evidence, schedule, Task, Agent Run, or repository Skill history.
- The existing opportunity radar remains executable through its current specialized worker path during this MVP. The imported Radar Task is a control-plane projection, so the migration cannot create a second competing schedule.
- A newly created Radar Task remains manual and unscheduled until an approved Skill Version is explicitly selected.
- Disabling the new Radar Platform UI must leave the existing opportunity radar schedule and data usable. Dropping new tables is not part of automated rollback.
- Generated Skill drafts remain database artifacts. Only a human approval action may materialize a reviewed version under repository `.agents/skills`.

## Acceptance matrix

| ID | Acceptance check | Status | Required evidence |
|---|---|---|---|
| RP-01 | Additive SQLite migration creates Radar definitions, immutable Skill versions, preflight records, step records, and run evaluations without deleting existing rows | Passed | Migration test, integrity check, foreign-key check, row-count comparison |
| RP-02 | The original opportunity radar is imported idempotently as the first Radar Task while existing opportunities, reports, evidence, schedule state, history, and repository Skill remain intact | Passed | File-backed migration test and live backup audit |
| RP-03 | The imported opportunity radar keeps exactly one scheduling authority and cannot be double-dispatched by the generic Task scheduler | Passed | Scheduler test and database assertion |
| RP-04 | A Radar Task definition persists objective, scope, source policy, ordered pipeline, input contract, output contract, deterministic success policy, capability manifest, risk, executor, and lifecycle status | Passed | Domain, database, and API tests |
| RP-05 | Radar definitions and API payloads are schema-validated; unsafe Skill names, path traversal, malformed JSON, empty pipelines, and invalid capabilities are rejected | Passed | Domain/API negative tests |
| RP-06 | Preflight checks required inputs, pipeline shape, output rules, capability limits, executor readiness, and production version binding and persists an auditable result | Passed | Service and API tests |
| RP-07 | A rehearsal creates a real Agent Run with `runMode=rehearsal`, an immutable definition snapshot, and an optional pinned Skill Version; production runs use `runMode=production` | Passed | Database/API integration test |
| RP-08 | Rehearsal steps expose only real queued, running, passed, failed, skipped, or waiting states with timestamps, input/output summaries, retry count, and error details | Passed | Run-event/step test and browser evidence |
| RP-09 | The UI never fabricates a percentage or named research step when no matching persisted step event exists; the fallback state is `等待执行器` | Passed | Component/browser test |
| RP-10 | Deterministic validation checks persisted run output against required sections, minimum content length, minimum source URLs, language rule, and partial-result policy | Passed | Validator unit tests and API integration test |
| RP-11 | A Skill candidate is blocked until two distinct successful rehearsals and one passed failure-path drill exist for the same current definition revision | Passed | Promotion-gate positive and negative tests |
| RP-12 | A failure-path drill proves that an invalid result is rejected by the current deterministic policy; it is not counted as a successful production result | Passed | Validator and database test |
| RP-13 | An unapproved Skill candidate is stored in SQLite and is not written into a discoverable Skill directory | Passed | Filesystem/API test |
| RP-14 | Human approval creates an immutable, versioned, content-hashed Skill Version with evidence links and safely materializes `SKILL.md` and UI metadata under repository `.agents/skills` | Passed | Filesystem, hash, version, and API test |
| RP-15 | The approving endpoint cannot approve an already approved/retired candidate, cannot overwrite an unrelated Skill, and records approver and timestamp | Passed | API conflict and audit tests |
| RP-16 | A production schedule can only bind an approved Skill Version and stores the exact version ID and content hash; it never follows `latest` | Passed | Database/API/scheduler test |
| RP-17 | Editing a live Radar Task creates or advances a draft revision without changing the Skill Version pinned by the current production schedule | Passed | Database/API regression test |
| RP-18 | Expanding network, file, connector, secret-reference, external-write, runtime, or cost capabilities invalidates the prior approval and requires a new candidate | Passed | Capability-diff test |
| RP-19 | Generic production occurrences reuse existing idempotency, lease, heartbeat, retry, artifact, approval, and Needs Review behavior | Passed | Dispatcher integration test |
| RP-20 | The original opportunity radar retains its three-candidate, score-at-least-85, evidence, anti-evidence, channel, buyer, and monetization gates and renders existing reports | Passed | Existing regression suite and browser evidence |
| RP-21 | Left navigation exposes `雷达`; its home shows multiple Task cards, lifecycle, next run, latest result, health, executor, and pinned version | Passed | Desktop and mobile browser evidence |
| RP-22 | Radar detail provides `定义`, `流程`, `预执行`, `Skill`, `定时`, and `运行记录` views with real persisted data | Passed | Browser journey and API trace |
| RP-23 | The UI supports creating/editing a Radar draft, running preflight, starting rehearsal, evaluating output, running a failure drill, creating a candidate, approving it, and binding a schedule | Passed | End-to-end browser journey |
| RP-24 | Every async UI surface provides loading, empty, error, and success states; controls prevent duplicate submissions and explain blocked promotion/scheduling | Passed | Component/browser evidence |
| RP-25 | Desktop, 390px mobile, light, dark, keyboard focus, reduced motion, Radix components, Phosphor icons, and existing graphite/signal-orange system remain supported | Passed | Visual and accessibility audit |
| RP-26 | Server and MCP boundaries never expose secrets or accept external writes beyond declared capabilities; generated Skill content contains no credential values | Passed | Security test and review |
| RP-27 | Domain, database, server, MCP, and web tests pass together with TypeScript, ESLint, production build, Playwright, and `git diff --check` | Passed | Final test log |
| RP-28 | Work log, review evidence, migration/rollback notes, and operator instructions are complete before status changes to Passed | Passed | Documentation review |
| RP-29 | A failed rehearsal step can start a new rehearsal from that step while previously passed/skipped step summaries remain immutable checkpoints and retry count is visible | Passed | API, database, and full browser failure-to-recovery journey |
| RP-30 | The Radar landing page is a compact cross-task control plane and does not render a task-specific report, archive or schedule editor | Passed | Live desktop screenshot and browser journey |
| RP-31 | Every Radar Task opens at `/radar/:id` with a dedicated workspace; the opportunity report and its settings live only inside the built-in opportunity task | Passed | Route and full browser journey |
| RP-32 | Preferred executor, optional fallback, fallback triggers and maximum handoffs persist through additive migration without changing existing preferred runtimes | Passed | Domain/database migration tests and live SQLite audit |
| RP-33 | Pipeline steps persist an inherit/Codex/OpenWorker preference and immutable Skill snapshots retain it | Passed | Database/Skill content tests and 11-step browser assertion |
| RP-34 | Preflight exposes preferred and fallback readiness; eligible dispatch and retry failures can hand off at most once, while content-quality failure cannot hand off | Passed | Service/dispatcher tests and audit-event assertions |
| RP-35 | The idempotent Qishui music draft has no active schedule or approved Skill and contains the legally bounded Top 10, deduplication, analysis, originality, Suno package and approval workflow | Passed | Migration, live API/SQLite and browser evidence |
| RP-36 | The music contract never authorizes DRM bypass, redistribution, artist or voice imitation, or automatic credit consumption, and missing audio coverage is reported rather than fabricated | Passed | Persisted definition audit and negative assertions |
| RP-37 | The workspace/runtime extension passes unit/integration, TypeScript, ESLint, production build, Playwright, responsive/theme and patch-hygiene gates | Passed | 93 tests, 10/10 Playwright, build and final verification log |

## Phase exit rules

- Phase 1 exits only when RP-01 through RP-05, RP-20 through RP-22, and the relevant regression gates pass.
- Phase 2 exits only when RP-06 through RP-12, RP-23 through RP-25, and RP-29 pass.
- Phase 3 exits only when RP-13 through RP-19 and RP-26 through RP-28 pass.
- Any Failed or Pending row keeps the overall Radar Platform MVP in development.
