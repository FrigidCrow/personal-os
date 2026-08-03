# Obsidian Radar Export Acceptance

Status: Passed
Date: 2026-07-29

| ID | Acceptance check | Status | Evidence |
|---|---|---|---|
| OE-01 | Vault root is server configuration and cannot be supplied by a browser request | Passed | API test sends a hostile `destination`; the service ignores it and derives the Vault path from server configuration |
| OE-02 | Export destination stays inside the configured Vault and rejects traversal or an external absolute Project path | Passed | Negative filesystem test rejects `../outside.md` with no outside file written |
| OE-03 | Only a linked Radar Run with a non-empty final result and status `needs_review` or `done` can export | Passed | API state test rejects a queued Run; service guards linkage, terminal output state and non-empty final response |
| OE-04 | Export writes complete Markdown atomically to a deterministic per-Run path and does not overwrite an unrelated collision | Passed | Filesystem assertions prove stable per-Run path, temporary-file rename and HTTP 409 collision refusal |
| OE-05 | Project hub creation is create-only and exported notes contain durable Project/Radar/Task/Run/repository metadata | Passed | Existing user-maintained hub remains byte-identical; note assertions cover IDs, wiki link, full result and verification summary |
| OE-06 | Re-export is idempotent and the Run records the note in artifacts and audit events | Passed | Re-export returns `created: false`; artifact path remains unique and only one `artifact_saved` event exists |
| OE-07 | Radar workspace shows configured/linked state and export/re-export controls with complete interaction states | Passed | Playwright promotion journey exports through rendered controls; live Definition UI shows the connected Vault and Project path |
| OE-08 | Qishui Radar is linked to the cloned Git repository and a real Obsidian Project note | Passed | Live API and filesystem verify `/Users/frigidcrow/Dev/qishui-music`, origin, Project linkage and `Projects/Qishui Music.md` |
| OE-09 | Full regression, mobile/theme, typecheck, lint, build, health and patch hygiene pass | Passed | 8 files / 96 tests, 10/10 Playwright, lint, typecheck, builds, live health, Web response and `git diff --check` |
