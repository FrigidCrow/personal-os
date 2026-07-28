# Work Log

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
