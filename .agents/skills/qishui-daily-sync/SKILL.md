---
name: qishui-daily-sync
description: "Operate the daily Qishui Music library sync through Codex or OpenWorker. Use when a Radar run must collect 热歌榜 and 新歌榜 Top10 from the official Android app, inspect screenshots and OCR, deduplicate tracks, attempt entitled official downloads, reuse canonical local audio paths, write the Obsidian daily note, or recover a failed checkpoint."
metadata:
  version: "1.0.1"
---

# Qishui Daily Sync

Run this workflow as the decision-maker. Do not hand the entire run to a monolithic automation script.

Read [references/tools.md](references/tools.md) before acting. Use the runtime's native shell and image-reading abilities for device interaction. The Skill owns ordering, visual judgment, retries, recovery, and the final status.

## Runtime contract

- Work only in `/Users/frigidcrow/Dev/qishui-music`.
- Accept only `热歌榜` and `新歌榜`, ranks 1 through 10. Never collect 欧美榜.
- Treat the screenshot as source evidence and OCR JSON as a candidate transcription.
- Codex is the supported runtime for the current local-device stage because it has project shell and image inspection. OpenWorker is supported only after its active tool manifest proves local shell/ADB access; OCR text alone is not enough to control or verify the device.
- Use only the official Qishui client and the user's real account entitlement. Never bypass login, VIP, DRM, encryption, app-private storage, or risk controls.
- Keep one canonical audio file per normalized `title + artist`. A repeated track reuses its existing path and is not downloaded or copied again.
- Never add audio files, emulator images, credentials, cookies, tokens, or private app data to Git.

## Workflow

1. Claim the Radar run, read `runMode` and `rehearsalRootRunId`, and mark `preflight` running.
   - In `production`, use the canonical paths documented below.
   - In `rehearsal`, put every screenshot and generated file below `data/rehearsals/<rehearsalRootRunId>/`, pass that path through `--workspace-root` to both archive commands, and write the analysis beside the generated `obsidian-preview`. Never modify canonical snapshots, the canonical library, source code, or the real Obsidian Vault in rehearsal mode.
2. Check the managed emulator and required local tools. Start only `Qishui_Radar_API_35`; record its returned serial.
3. For each chart in order `hot`, then `new`:
   - Open the configured official chart deep link directly with ADB.
   - Capture a screenshot before every interaction that depends on page state.
   - Inspect the screenshot. Reach the chart download-selection view using bounded taps or one bounded swipe only when the visible UI justifies it.
   - Run OCR and reconcile its result against the screenshot.
   - Save a chart snapshot only after exactly ten continuous ranks have title and artist.
4. Mark `collect_charts` passed only after both valid snapshots exist.
5. Run deterministic archive sync to calculate same-chart changes and update the canonical track library.
6. For every newly seen track, check the library first. Attempt an official download only when no reusable audio path exists.
   - `login_required`, `vip_required`, `protected_storage`, and `no_exportable_file` are truthful coverage states, not fabricated success.
   - If login or verification needs a human, stop at `input_required`, preserve screenshots and the checkpoint, and state one concrete next action.
7. Write or update the idempotent Obsidian note under `Projects/Qishui Music/Daily/YYYY-MM-DD.md`. The note must show both Top10 lists, rank changes, and the audio state/path for every row.
8. Use the validated snapshots and same-chart diff to write a Chinese analysis note under `Projects/Qishui Music/Analysis/YYYY-MM-DD.md`.
   - Separate observed chart facts from interpretation.
   - Quantify retention, new/exited tracks, movement, explicit version labels, and cross-chart overlap before drawing a conclusion.
   - Never infer BPM, key, instrumentation, hook timing, vocal timbre, or song structure from titles and ranks. Analyze those only when a lawful local audio file exists and the observation cites that file.
   - Convert reusable patterns into one original-music experiment and a Suno-ready style prompt. Require original melody and lyrics; do not request imitation of a named living artist, a specific recording, lyrics, or melody.
9. Mark required Radar steps with their actual evidence. Register only repository-relative files as Artifacts; an Obsidian path is an output reference, not a Git Artifact. Stop the managed emulator in a final cleanup step unless the run is intentionally paused for an immediate human login checkpoint.
10. Submit the structured result exactly once. After `submit_run_result` succeeds, do not call more tools, modify files, or repeat checkpoints; return the final summary immediately.

## Recovery

- Retry the current atomic action at most twice when the UI is merely slow.
- On an unexpected or blank page, capture evidence, verify that the full configured URI and quoted remote ADB command were used, reopen that chart once, and resume from that chart rather than restarting completed charts. Do not silently substitute a shorter guessed URI.
- On OCR ambiguity, do not guess. Inspect the screenshot with the runtime's image capability. A runtime without image or local ADB capability must stop with `capability_mismatch` before touching the device.
- On a changed app layout, report `ui_changed` with the screenshot path and last successful checkpoint. Do not label the entire workflow impossible after one failed selector.
- On cleanup failure, report it separately; never hide a successfully archived run.

## Success contract

The run is successful only when both chart snapshots validate, the library/diff are persisted, both the Obsidian daily note and Chinese analysis note exist, and the managed emulator cleanup is accounted for. Download coverage is reported separately because account or storage restrictions may legitimately prevent an audio file from being exported.
