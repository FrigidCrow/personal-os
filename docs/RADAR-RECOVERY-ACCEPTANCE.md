# Radar Goal-Directed Recovery Acceptance

Status: Passed
Date: 2026-07-30

| ID | Acceptance check | Status | Evidence |
|---|---|---|---|
| RR-01 | Fallback retains the immutable definition, failed checks, prior result and checkpoints | Passed | Dispatcher assertions verify source Run, immutable definition, original assignment, failed evidence and preserved checkpoints |
| RR-02 | Codex Radar output is schema constrained and writes every real step back to SQLite | Passed | Dedicated Codex adapter tests cover complete and malformed structured results plus exact persisted step states |
| RR-03 | Radar capability manifest controls Codex network and Web search access | Passed | Adapter test captures `networkAccessEnabled=true`, live Web search and SDK output schema from the definition |
| RR-04 | Program-gate failure cannot remain reviewable or be accepted | Passed | Database tests auto-reject short output; acceptance guard and live Qishui migration reject the old 747-character result |
| RR-05 | Recoverable failure starts a bounded, different-strategy attempt with audit evidence | Passed | Dispatcher/API tests and live Qishui Run `b8add224-4e27-46c5-9f46-65d1b658bed4` executed attempt 3/4 and recorded every structured recovery event |
| RR-06 | Waiting for input requires documented strategy exhaustion and a concrete minimum input | Passed | Structured Codex test rejects input-required output without three strategies, blocker and minimum next action |
| RR-07 | Qishui gains four attempts without changing revision, safety or historical evidence | Passed | Live API reports revision 1, OpenWorker to Codex, 11 steps, max attempts 4 and both original Runs preserved |
| RR-08 | UI communicates quality failure, recovery, attempt budget and blocked input truthfully | Passed | Live browser shows attempt 3/4 waiting for the exact screenshot, earlier attempts as already continued, no false controls and 1440px width without overflow |
| RR-09 | Existing functionality and Obsidian export remain intact | Passed | 10/10 Playwright journeys include Radar promotion, checkpoint recovery and Obsidian export |
| RR-10 | Build, lint, typecheck, live health and patch hygiene pass | Passed | 101 unit/integration tests, 10/10 browser tests, build, lint, typecheck, SQLite quick/foreign-key checks, health and `git diff --check` pass |
