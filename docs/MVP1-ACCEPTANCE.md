# MVP1 Acceptance Matrix

Reviewed: 2026-07-28

Result: 24 Passed, 0 Failed, 0 Blocked

| ID | Requirement | Review evidence | Status |
|---|---|---|---|
| A01 | Local install and start are documented | README includes prerequisites, install, environment, build, dev, live Codex, MCP, radar, backup, and verification steps; built API passed a fresh-database smoke test. | Passed |
| A02 | Dashboard summarizes actionable state | In-app browser rendered desktop and mobile views with focus tasks, portfolio, opportunity, experiment, asset, review queue, and outcome metrics. | Passed |
| A03 | Project CRUD persists in SQLite | API integration test creates, updates, deletes, and directly verifies database state; browser also created a real local project. | Passed |
| A04 | Task CRUD and valid state transitions work | API/database tests cover create, update, delete, and the declared transition graph. | Passed |
| A05 | Invalid task transition is rejected | API and domain negative tests reject `Ready -> Done` with `409 INVALID_TRANSITION`. | Passed |
| A06 | Web can assign a task to Codex | Browser completed demo and live assignment flows; live run `efa93fba-ac41-4e88-abe9-67c6ac5d89b6` persisted with a real thread id. | Passed |
| A07 | Run status is observable in Web | Review page polls active runs, API exposes SSE, and integration tests assert `text/event-stream` plus the `needs_review` event. | Passed |
| A08 | Completed run enters Needs Review | Demo integration test and real live browser run both persisted task and run as `Needs Review`. | Passed |
| A09 | User can accept reviewed work | Browser acceptance action persisted the live task and run as `Done`; direct transition bypass is rejected by integration test. | Passed |
| A10 | MCP can read project and task context | Built STDIO smoke exposed 12 tools and returned `get_today_context`; a live Codex call returned `PERSONAL_OS_MCP_LIVE_OK 2`. | Passed |
| A11 | MCP can update and complete a task safely | Protocol/tool tests verify updates and `complete_task -> Needs Review`; surface audit confirms there is no `accept_run` tool. | Passed |
| A12 | Opportunity cards include evidence and minimal experiment | Zod/domain tests require evidence; Radar UI renders payer, pain, evidence link/type, hypothesis, smallest experiment, success, and stop conditions. | Passed |
| A13 | Daily report contains no more than five opportunities | Domain schema rejects six ids; API test and rendered report stay at five or fewer. | Passed |
| A14 | Opportunity converts into experiment | Database and API integration tests pass; browser converted the demo AI repository-audit opportunity into an experiment. | Passed |
| A15 | Experiment includes caps and stop conditions | Validation enforces positive time cap, non-negative budget, success condition, and stop condition; UI rendered the 3 h / ¥0 capped experiment. | Passed |
| A16 | Income asset stage and maintenance burden are visible | Dedicated API regression test persists `stage` and `maintenanceHoursMonthly`; Assets UI renders the lifecycle rail, revenue, maintenance, and next action. | Passed |
| A17 | Light, dark, and system theme work | Light and dark desktop renders were inspected; system mode and persistent three-way theme control are implemented. | Passed |
| A18 | Mobile navigation and core pages work below 768px | 390 × 844 interaction check passed; navigation dialog worked and document scroll width equaled client width. | Passed |
| A19 | Loading, empty, and error states exist | Shared `LoadingState`, `EmptyState`, and retryable `ErrorState` are used across query-backed pages; empty review queue rendered correctly. | Passed |
| A20 | Demo data and demo Codex runs are clearly labeled | Copy/browser audit confirmed demo banners, badges, buttons, evidence warnings, and mode labels; live results are distinct. | Passed |
| A21 | No automatic payment, outreach, or publishing tools exist | API and all 12 MCP tools were enumerated; none can pay, buy, contact, publish, deploy to production, or approve human review. | Passed |
| A22 | Test, typecheck, lint, and build pass | Final review: 5 test files / 24 tests passed; typecheck, ESLint, production build, `npm audit`, and `git diff --check` all passed. | Passed |
| A23 | Repository guidance and skills are documented | `AGENTS.md`, `.codex/config.toml`, README, and three repository Skills exist; each Skill passed the official validator and contains trigger examples. | Passed |
| A24 | Implementation is committed to Git | Work commit `2f08d2c`, review-test commit `8438ec4`, and loopback security fix `b0a849a` are present on `main`; final review documentation is committed separately. | Passed |
