# MVP1 Review

Status: Passed

Reviewed: 2026-07-28

Scope: `docs/PLAN.md` and `docs/MVP1-ACCEPTANCE.md`

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
