# Phase 11.1 acceptance

Status: Passed and deployed
Date: 2026-08-04

| ID | Acceptance check | Status | Evidence |
|---|---|---|---|
| AD-01 | Migration adds policy and deposition metadata without rewriting existing WorkSpecs, Runs or notes | Passed | Migration 12 adds columns and an index only; migration regression preserves the legacy row. |
| AD-02 | Existing WorkSpecs default to required review and on-acceptance deposition | Passed | Contract, SQLite backfill and legacy JSON normalization tests pass. |
| AD-03 | `not_required` is accepted only for a pinned-Skill workflow with explicit on-success deposition | Passed | Application negative tests reject missing Skill, wrong Runtime, one-off and trigger/review mismatches. |
| AD-04 | Structured successful Runs under the safe policy deposit automatically and do not enter pending review | Passed | Application and API integration tests prove the completion observer writes the note and records `reviewStatus=not_required`. |
| AD-05 | Failed, cancelled, waiting and unstructured Agent Runs never create an Obsidian note | Passed | Completion is reachable only after structured success; dedicated cancelled and failed Agent regressions create no deposition. |
| AD-06 | Calendar-day deposition creates at most one managed note for a WorkSpec and local day | Passed | Two same-day Runs reuse one document; the next local day creates a new note. |
| AD-07 | Managed subdirectories remain below Reports or Generated and reject traversal and symlink escape | Passed | Schema traversal tests and nested symlink preflight regression pass. |
| AD-08 | Deposition failure preserves successful Run truth and creates a visible failure event and alert | Passed | Failure-path test preserves accepted Run truth; existing Today failed-deposition path remains covered. |
| AD-09 | Manual review and acceptance deposition remain unchanged for required-review WorkSpecs | Passed | Phase 11 service, API and Playwright regression remains green. |
| AD-10 | Radar UI explains automatic versus acceptance-based deposition and supports safe configuration | Passed | Playwright creates an automatic daily workflow and verifies trigger, period and subdirectory; desktop/mobile regressions pass. |
| AD-11 | The two canonical daily schedules bind new immutable auto-deposit revisions and retain history | Passed | Live schedules now bind revisions `a3855480…` and `11f97fd9…`; old WorkSpecs remain present and disabled schedule history is unchanged. |
| AD-12 | Test, typecheck, lint, build, Playwright and patch hygiene pass | Passed | 109 unit/integration tests and 13/13 Playwright journeys pass; TypeScript, ESLint, production builds and `git diff --check` pass. |

Production evidence:

- registered Vault: `/Users/frigidcrow/Documents/Obsidian Vault`;
- AI briefing: `06:30 Asia/Tokyo` → `Reports/AI日报`, successful Run writes automatically;
- opportunity scan: `08:00 Asia/Tokyo` → `Reports/机会雷达`, successful Run writes automatically;
- both use calendar-day deduplication, retain a pinned Skill hash and do not require repetitive daily acceptance;
- production SQLite `quick_check` is `ok`, foreign-key check is empty and exactly two schedules are enabled.
