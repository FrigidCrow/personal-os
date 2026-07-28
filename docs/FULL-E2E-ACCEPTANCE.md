# MVP1 + MVP1.1 + MVP2 Full E2E Acceptance

Status: Passed  
Date: 2026-07-28  
Method: Plan -> Work -> Review -> feature E2E -> full journey E2E

This is the exhaustive product inventory used for the MVP2 closeout. A row is only passed when its declared layer has direct evidence. `UI -> HTTP -> backend -> SQLite` means the test begins with a rendered browser interaction, records the mutation request and response, then queries the isolated SQLite database for the resulting authoritative state.

## Evidence legend

- **P**: Playwright browser test and retained trace/screenshot.
- **A**: API integration test.
- **D**: domain/database unit or integration test.
- **M**: MCP protocol test.
- **R**: real local executor journey (not a mocked or demo adapter).
- **O**: operational smoke or recovery exercise.

## 1. Foundation and local operation

| ID | Function | Required layer | Planned evidence | Status |
|---|---|---|---|---|
| F01 | Fresh install, schema creation and seeded first run | backend -> SQLite | D, A | Passed |
| F02 | Existing MVP1 data migrates without loss; legacy Codex history remains readable | backend -> SQLite | D, A | Passed |
| F03 | API and Web bind only to documented loopback ports 8787 and 5273 | process -> HTTP | O | Passed |
| F04 | OpenWorker remains independent on 8765 and 5274 and its MCP connection is healthy | process -> MCP | O, R | Passed |
| F05 | Liveness and operational health expose database, leases, approvals and executors | UI -> HTTP -> backend -> SQLite | P, A, O | Passed |
| F06 | LaunchAgents install safely, restart failed processes and preserve database state | OS -> process -> SQLite | O | Passed |
| F07 | Online backup validates integrity, retains data and obeys retention | script -> SQLite | O | Passed |
| F08 | Privacy cleanup is dry-run first and redacts only eligible audit data | script -> SQLite | D, O | Passed |
| F09 | Installation, ports, startup, OpenWorker MCP and recovery commands are documented and executable | docs -> process | O | Passed |

## 2. Shell, dashboard and presentation states

| ID | Function | Required layer | Planned evidence | Status |
|---|---|---|---|---|
| U01 | All seven primary routes and project detail navigate from the rendered shell | UI -> HTTP | P | Passed |
| U02 | Dashboard summarizes focus tasks, portfolio, opportunities, experiments, assets, review work and revenue metrics | UI -> HTTP -> SQLite | P, A | Passed |
| U03 | Light, dark and system themes render and persist | UI | P | Passed |
| U04 | Mobile navigation and core flows work at 390 x 844 with no document overflow | UI | P | Passed |
| U05 | Keyboard activation, visible focus and correctly labelled dialogs work | UI | P | Passed |
| U06 | Reduced-motion preference removes nonessential route and ambient motion | UI | P | Passed |
| U07 | Loading, empty, retryable error, success toast and explicit demo states exist | UI | P, source audit | Passed |
| U08 | Browser console has no application errors during the tested journeys | UI | P | Passed |

## 3. Projects and tasks

| ID | Function | Required layer | Planned evidence | Status |
|---|---|---|---|---|
| T01 | Project create, edit and delete persist all business and integration fields | UI -> HTTP -> backend -> SQLite | P | Passed |
| T02 | Project detail shows metadata, Git/Obsidian context and associated tasks | UI -> HTTP -> SQLite | P, A | Passed |
| T03 | Task create persists project, content, priority, acceptance and all automation fields | UI -> HTTP -> backend -> SQLite | P | Passed |
| T04 | Task card click and keyboard activation open complete editable detail | UI -> HTTP -> SQLite | P | Passed |
| T05 | Task detail edit and confirmed deletion persist correctly | UI -> HTTP -> backend -> SQLite | P | Passed |
| T06 | Pointer drag performs each valid board transition | UI -> HTTP -> state machine -> SQLite | P, D | Passed |
| T07 | Invalid transitions, including bypassing review, return conflict and do not mutate | HTTP -> state machine -> SQLite | A, D | Passed |
| T08 | Cards expose route, risk, automation and latest run context | UI -> HTTP -> SQLite | P | Passed |
| T09 | Automatic task pause/resume, queued cancellation and bounded retry have working controls | UI -> HTTP -> dispatcher -> SQLite | P, A, D | Passed |

## 4. Generic agent control and safety

| ID | Function | Required layer | Planned evidence | Status |
|---|---|---|---|---|
| G01 | Explicit and deterministic automatic routing choose Codex, OpenWorker or Human correctly | router -> SQLite | D, A | Passed |
| G02 | High-risk automatic work is never dispatched | HTTP -> router -> SQLite | D, A | Passed |
| G03 | One active run per task and unique idempotency keys prevent duplicate execution | dispatcher -> SQLite | D | Passed |
| G04 | Run states reject illegal transitions and preserve ordered events | state machine -> SQLite | D | Passed |
| G05 | Manual Codex Demo moves Ready -> In Progress -> Needs Review and never directly to Done | UI -> HTTP -> adapter -> SQLite | P, A | Passed |
| G06 | Unified control page lists Codex and OpenWorker with filters, health and run status | UI -> HTTP -> SQLite | P | Passed |
| G07 | Run detail shows session, attempt/retry, lease, prompt, directory, result, verification, artifacts, failures and event timeline | UI -> HTTP/SSE -> SQLite | P | Passed |
| G08 | Active run detail consumes SSE and closes at a terminal/review state | UI -> SSE -> SQLite | P, A | Passed |
| G09 | Final accept changes both run and task to Done in one transaction | UI -> HTTP -> backend -> SQLite | P, D | Passed |
| G10 | Final reject requires a reason, audits it and blocks both run and task | UI -> HTTP -> backend -> SQLite | P, D | Passed |
| G11 | Agents, MCP and Dispatcher have no operation that can mark work Done or self-approve | surface audit -> state machine | M, A, D | Passed |

## 5. Approval inbox

| ID | Function | Required layer | Planned evidence | Status |
|---|---|---|---|---|
| AP01 | Worker can request approval with action, destination, summary, preview and expiry | MCP -> backend -> SQLite | M, D | Passed |
| AP02 | Pending approval appears in the human inbox with complete context | UI -> HTTP -> SQLite | P | Passed |
| AP03 | Human Approve resumes the run with a renewed lease and an audit event | UI -> HTTP -> backend -> SQLite | P, D | Passed |
| AP04 | Human Reject resumes safely without authorizing the action and audits the decision | UI -> HTTP -> backend -> SQLite | P, D | Passed |
| AP05 | Expired approval defaults to rejection; duplicate or agent-side resolution fails | backend -> SQLite | D, A, M | Passed |

## 6. Triggers, leases and recovery

| ID | Function | Required layer | Planned evidence | Status |
|---|---|---|---|---|
| S01 | Manual dispatch creates one eligible run | HTTP -> dispatcher -> SQLite | A, D | Passed |
| S02 | Cron uses validated expression and IANA timezone and advances before dispatch | scheduler -> SQLite | D, A | Passed |
| S03 | Repeated ticks are idempotent; missed schedules skip by default | scheduler -> SQLite | D | Passed |
| S04 | Explicit catch-up runs only the latest missed occurrence | scheduler -> SQLite | D | Passed |
| S05 | Event trigger uses stable event ids and can rearm only after accepted completion | HTTP -> dispatcher -> SQLite | A, D | Passed |
| S06 | Dependency trigger dispatches once after prerequisite acceptance | dispatcher -> SQLite | D | Passed |
| S07 | Claim is atomic; heartbeat renews the configured lease; stale claims recover | MCP/dispatcher -> SQLite | D, M, R | Passed |
| S08 | Retry creates a new attempt and maximum attempts end in Blocked | UI/dispatcher -> SQLite | P, D | Passed |
| S09 | Server restart does not duplicate or lose an active run | process -> backend -> SQLite | D, O | Passed |

## 7. OpenWorker Pull integration

| ID | Function | Required layer | Planned evidence | Status |
|---|---|---|---|---|
| W01 | MCP exposes only the ten planned Pull-workflow tools to OpenWorker | OpenWorker -> MCP | M, O | Passed |
| W02 | Claimable listing excludes paused, unsafe and already-active work | MCP -> backend -> SQLite | M, D | Passed |
| W03 | Claim and execution context provide safety policy, project context and acceptance criteria | MCP -> SQLite | M | Passed |
| W04 | Heartbeat, typed events, artifacts, result and failure persist in generic AgentRun records | MCP -> backend -> SQLite | M | Passed |
| W05 | Result submission stops at Needs Review | MCP -> state machine -> SQLite | M, D | Passed |
| W06 | A real OpenWorker/Ollama automation claims a safe task, executes it and returns evidence | OpenWorker -> MCP -> SQLite | R | Passed |
| W07 | The returned OpenWorker result is explicitly accepted in Personal OS Web | UI -> HTTP -> backend -> SQLite | R, P | Passed |

## 8. Opportunity, experiment and asset loop

| ID | Function | Required layer | Planned evidence | Status |
|---|---|---|---|---|
| BZ01 | Demo and Live reports are deliberate actions and clearly distinguished | UI -> HTTP -> backend -> SQLite | P, A | Passed |
| BZ02 | Report contains no more than five evidence-backed opportunities | backend -> SQLite -> UI | D, A, P | Passed |
| BZ03 | Each opportunity shows payer, model, effort, budget, time-to-revenue, experiment, success/stop rules and linked evidence types | UI -> HTTP -> SQLite | P | Passed |
| BZ04 | Opportunity converts once into a capped experiment | UI -> HTTP -> backend -> SQLite | P, D | Passed |
| BZ05 | Experiment detail opens by click/keyboard and all fields are editable | UI -> HTTP -> SQLite | P | Passed |
| BZ06 | Experiment result and measured/terminal status persist | UI -> HTTP -> backend -> SQLite | P, A | Passed |
| BZ07 | Asset list exposes lifecycle, monthly revenue, maintenance and next action | UI -> HTTP -> SQLite | P, A | Passed |
| BZ08 | API/MCP can create an income-asset candidate without external money or publishing side effects | HTTP/MCP -> SQLite | A, M | Passed |

## 9. Required real full journeys

These run only after every feature row above has evidence.

| Journey | End-to-end path | Status |
|---|---|---|
| J01 | Project -> configured task -> real Live Codex -> events/artifacts/verification -> human accept -> Done | Passed |
| J02 | Safe automatic task -> real OpenWorker/Ollama cron -> MCP claim/heartbeat/result -> human accept -> Done | Passed |
| J03 | Daily opportunity report -> evidence review -> minimal experiment -> result -> asset visibility | Passed |

## 10. Gap review

Initial source and route audit found no missing top-level MVP1/MVP1.1/MVP2 route. Three review-hardening changes were included before execution:

1. A deterministic Playwright environment uses isolated Web/API ports and an isolated SQLite database.
2. Mutation tests retain request, response and SQLite snapshots as attachments.
3. Task, run and approval cards expose stable test ids so evidence targets a single persisted record rather than visible copy shared by multiple cards.

The executed review then found and closed five real integration gaps:

1. Headless OpenWorker automations did not attach enabled MCP tools. OpenWorker commit `428adf4` now prepares and attaches them before engine construction.
2. Prompt-only tool guidance was not reliable with local models. OpenWorker automations now support an exact runtime `tool_allowlist`; the Personal OS worker exposes only the ten Pull tools.
3. Small models confused `runId` with `taskId`. `list_claimable_tasks` now returns explicit `taskId`, `claimArguments`, and `contextArguments`, and the MCP descriptions state the distinction.
4. A fixed two-minute lease was shorter than several local-model reasoning cycles. The MCP default remains two minutes, while deployments may set `WORKER_LEASE_MILLISECONDS`; this machine uses ten minutes and still records heartbeats and stale recovery.
5. Real OpenWorker pulls were incorrectly persisted and rendered as Demo. The Dispatcher now enforces `mode=live` for OpenWorker, and migration repairs historical mislabeled rows.

Each gap has a regression test. Failed exploratory runs were retained in SQLite as failure and lease-recovery evidence rather than deleted.

## 11. Executed evidence

- Playwright feature suite: 7/7 passed in 41.1 seconds, with 7 trace archives, screenshots, mutation request/response attachments, and direct SQLite snapshots in `review-artifacts/`.
- Automated coverage begins at the rendered UI for project/task CRUD, pointer drag, task detail, automation pause/resume/cancel/retry, Codex accept/reject, approval approve/reject, report generation, opportunity conversion, experiment result, and asset visibility.
- Unit and integration suite: 6 files / 57 tests passed after the final migration repair.
- Real J01: task `b1daa06b-ce14-404b-84eb-1305d0a3a477`, live Codex run `2485d0f9-f6e2-4cf1-9f62-87fe7009b761`, thread `019fa8b0-d844-7140-81b8-2cbd54e6d26e`. Codex only added `CODEX_ACCEPTANCE.md`, returned `PERSONAL_OS_CODEX_LIVE_OK`, stopped at Needs Review, then Web approval moved task and run to Done.
- Real J02: OpenWorker/Ollama run `6088109f-3b11-4e2f-a4a3-027b5c6a1a5e` performed list, atomic claim, running event, heartbeat, context read and result submission through MCP. Seven persisted events were inspected in Web; human approval then moved task and run to Done.
- J03: Playwright generated a deliberate Demo opportunity report, verified the five-item cap, converted an opportunity, edited and completed the experiment, and verified asset metrics through the rendered Web/API/SQLite path.
- OpenWorker upstream regression suite: 933 passed, 1 skipped. Personal OS-specific subset: 63 passed.
- Operations: API 8787, Web 5273, OpenWorker server 8765 and GUI 5274 all listen only on loopback. LaunchAgents are running; health, install dry-run, backup dry-run and privacy dry-run passed.
- Browser review ended with Codex and OpenWorker both shown as `live`, both Done, zero active runs, zero stale leases and zero pending approvals.

## 12. Required quality gates

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm audit --audit-level=high
git diff --check
```
