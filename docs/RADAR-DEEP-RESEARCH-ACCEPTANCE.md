# Opportunity Radar Deep-Research Acceptance

Status: Passed
Date: 2026-07-29

| ID | Requirement | Status | Direct evidence |
|---|---|---|---|
| R01 | A live run saves at most three gate-passing candidates and succeeds only with three scores at or above 85 | Passed | MCP contract test saves three, rejects the fourth, and verifies `succeeded`; database test verifies the same atomic cap. |
| R02 | Evidence is classified into demand, payment, channel, feasibility, and counter-evidence | Passed | Domain schema and gate tests require all five categories. |
| R03 | Evidence records strength, source date, proof, and limitation | Passed | SQLite migration, domain schema, JSON output schema, and rendered evidence cards preserve all four fields. |
| R04 | Missing evidence classes or weak critical evidence are rejected before persistence | Passed | Domain and database tests remove strong payment evidence and verify gate rejection before insert. |
| R05 | Research assessment captures alternatives, competition, delivery, acquisition, dependencies, failure reasons, and unknowns | Passed | `opportunityAssessmentSchema`, SQLite JSON persistence, Codex/OpenWorker contracts, and Radar audit panel cover every field. |
| R06 | Weighted 100-point score, 85-point threshold, and critical dimension floors are enforced by program logic | Passed | Domain tests cover 85 pass, 84 reject, missing critical evidence, and dimension floors; persisted score is the seven-dimension sum. |
| R07 | Codex and OpenWorker scan broadly, deep-research at most three, and never fill a slot with a weak candidate | Passed | Server prompt, repository Radar Skill, and MCP `hardRequirements` share the same doctrine and strict persistence call. |
| R08 | Historical/demo records migrate without data loss and are visibly treated as legacy | Passed | Non-destructive `ensureColumn` migrations preserve old rows; database test keeps a shallow legacy row readable with a failed gate reason. |
| R09 | Only gate-passing opportunities can be converted to experiments | Passed | Database test verifies a legacy shallow opportunity is blocked; Playwright verifies a qualified candidate completes the conversion flow. |
| R10 | Desktop and mobile Radar UI expose the research gate and its supporting evidence | Passed | Playwright screenshots `radar-deep-research-desktop.png` and `radar-deep-research-mobile.png`; 390px document width has no overflow. |
| R11 | Automated, type, lint, build, browser, and patch-hygiene gates pass | Passed | 7 files / 80 tests, TypeScript, ESLint, all production builds, 0 dependency vulnerabilities, clean `git diff --check`, and 8/8 Playwright journeys. |
| R12 | Runs with zero to two qualifiers are marked partial and are never presented as fully successful | Passed | Scheduler and MCP tests verify one qualifier returns `partial`; UI labels zero-result reports as `0/3` and 未达标. |

Known evidence boundary: the program enforces required fields, URL uniqueness, dates, evidence classes, declared strength, score floors, and blocking dependencies. It does not independently prove that every cited page semantically supports the model's summary; factual source review remains necessary before spending money or launching an experiment.
