# MVP1 Acceptance Matrix

Status values: Pending, Passed, Failed, Blocked.

| ID | Requirement | Evidence required | Status |
|---|---|---|---|
| A01 | Local install and start are documented | Fresh install command and successful startup output | Pending |
| A02 | Dashboard summarizes actionable state | Rendered desktop and mobile screenshots | Pending |
| A03 | Project CRUD persists in SQLite | API integration test plus DB inspection | Pending |
| A04 | Task CRUD and valid state transitions work | API integration tests | Pending |
| A05 | Invalid task transition is rejected | Negative integration test | Pending |
| A06 | Web can assign a task to Codex | Browser flow plus created CodexRun | Pending |
| A07 | Run status is observable in Web | SSE or polling evidence plus screenshot | Pending |
| A08 | Completed run enters Needs Review | Integration test and UI evidence | Pending |
| A09 | User can accept reviewed work | Browser flow and persisted Done task | Pending |
| A10 | MCP can read project and task context | MCP smoke test output | Pending |
| A11 | MCP can update and complete a task safely | MCP smoke test plus DB state | Pending |
| A12 | Opportunity cards include evidence and minimal experiment | Schema test plus rendered detail | Pending |
| A13 | Daily report contains no more than five opportunities | Domain test and rendered report | Pending |
| A14 | Opportunity converts into experiment | API test and browser flow | Pending |
| A15 | Experiment includes caps and stop conditions | Validation test and rendered detail | Pending |
| A16 | Income asset stage and maintenance burden are visible | API test and UI evidence | Pending |
| A17 | Light, dark, and system theme work | Rendered light and dark screenshots | Pending |
| A18 | Mobile navigation and core pages work below 768px | Mobile screenshot and interaction check | Pending |
| A19 | Loading, empty, and error states exist | Component or browser evidence | Pending |
| A20 | Demo data and demo Codex runs are clearly labeled | Copy audit and screenshots | Pending |
| A21 | No automatic payment, outreach, or publishing tools exist | MCP/API surface audit | Pending |
| A22 | Test, typecheck, lint, and build pass | Command output recorded in review | Pending |
| A23 | Repository guidance and skills are documented | File inspection and trigger examples | Pending |
| A24 | Implementation is committed to Git | Clean status and commit id | Pending |

