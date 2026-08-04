# Phase 12 acceptance

Status: Passed and deployed
Date: 2026-08-04

| ID | Acceptance check | Status | Evidence |
|---|---|---|---|
| RS-01 | Additive migration creates Run-mode, evaluation and Skill-candidate state without changing history | Passed | Migration 13 backfills historical Runs as `production`; SQLite migration and foreign-key tests pass. |
| RS-02 | Production, rehearsal and failure-drill Runs are distinguishable and retain normal logs, checkpoints and retries | Passed | Run rows, events, Runtime context and prompt carry mode/root; application tests cover all three modes. |
| RS-03 | Rehearsals never auto-deposit and never update schedule firing state | Passed | Two real fixture rehearsals produce zero depositions; source Schedule remains unchanged. |
| RS-04 | Evaluation persists deterministic checks and only passed evaluations count | Passed | Evaluator v1 checks terminal state, structured result, verification and checkpoint evidence; nonterminal evaluation is rejected. |
| RS-05 | Promotion requires two distinct successful rehearsal roots for the same WorkSpec revision | Passed | Failed root → resumed success counts once; a second independent root is required. |
| RS-06 | Promotion requires one passed failure drill that proves invalid output is rejected | Passed | Deterministic invalid fixture is rejected by the current result Schema and persisted as an expected failure with a passed evaluation. |
| RS-07 | Pending candidates remain database records and do not enter a discoverable Skill directory | Passed | Filesystem assertion proves the Skill directory is absent until publish. |
| RS-08 | Candidate content is validated, redacted, SemVer-checked and content-hashed | Passed | Existing repository validator rejects secrets and invalid versions; candidate content/hash are rechecked on publish. |
| RS-09 | Only a human publish endpoint can publish; stale, failed or already-published candidates are rejected | Passed | Application/API tests cover concurrent repository change and double publish conflicts. |
| RS-10 | Publication creates a new immutable WorkSpec revision pinned to the exact published Skill | Passed | Published snapshot hash equals the candidate and revision 2 points to the source WorkSpec. |
| RS-11 | Existing schedules remain unchanged until a separate explicit rebind | Passed | Application and API tests assert the Schedule remains bound to the source after publish; UI exposes a separate explicit action. |
| RS-12 | Radar UI exposes the real gate, evidence, candidate and publish workflow without fake progress | Passed | Playwright verifies missing evidence, failure drill, database candidate, content review, human publish and no implicit rebind. |
| RS-13 | Checkpoint resume remains available for failed rehearsal retries | Passed | Resume copies completed checkpoint evidence and preserves one rehearsal root. |
| RS-14 | Test, typecheck, lint, build, Playwright and patch hygiene pass | Passed | 118 unit/integration tests, 14/14 Playwright journeys, TypeScript, ESLint, production builds and `git diff --check` pass. |
| RS-15 | A trusted managed resource starts before Codex and is cleaned after success, Agent failure and partial start failure | Passed | Runtime unit tests cover ordering and both failure paths; lifecycle commands use absolute argv without a shell. |
| RS-16 | Qishui runs can start from an off emulator without granting Codex broad host access | Passed | Two independent live rehearsals emitted `managed_resource.ready`, completed official dual-chart collection and emitted `managed_resource.stopped`; the dedicated AVD ended `running=false`. |
| RS-17 | Qishui production scheduling is blocked until the real gate is ready | Passed | WorkSpec revision 6 has two passed rehearsal roots plus one passed failure drill; only then was the `09:00 Asia/Tokyo` Schedule enabled. |

Production evidence:

- database backup: `personal-os-v2-2026-08-03T16-20-39-995Z.db`;
- migration 13 is the current schema and SQLite `quick_check` is `ok` with no foreign-key violations;
- Web `5273`, API `8787`, Scheduler, Codex and OpenWorker are healthy;
- three schedules are enabled: AI briefing `06:30`, opportunity scan `08:00`, and Qishui dual-chart collection `09:00`, all in `Asia/Tokyo`;
- Qishui WorkSpec revision 6 is pinned to `qishui-daily-sync@1.0.1`; live rehearsal roots `a318a63b-e3a4-4983-ab01-0c2a600aebcf` and `335073ff-0578-4b33-8291-da533170d97b` passed, and failure drill `91fb86a8-4fb8-4d6f-8b1b-8f7ee4b0d354` proved invalid output is rejected;
- Qishui rehearsal output stayed below `data/rehearsals/<run-id>` and did not change canonical data or the real Obsidian Vault.
