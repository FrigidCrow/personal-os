# Atomic tool contract

Run commands from `/Users/frigidcrow/Dev/qishui-music`. The selected AI Runtime is the control loop. Do not invoke a device-orchestration wrapper. At present this device stage requires Codex; OpenWorker must first prove local Shell/ADB and image capabilities.

## Managed emulator

```bash
python3 scripts/qishui_emulator.py status
python3 scripts/qishui_emulator.py start
python3 scripts/qishui_emulator.py stop
```

Use only the `serial` returned by `start`. Never target all ADB devices.

## Direct device interaction

Read `config/qishui-runtime.json` first and confirm it contains only `hot` and `new`. The current verified chart IDs are:

- `hot`: `7036274230471712007`
- `new`: `7060812597884869927`

Open a chart directly. Replace `SERIAL` only with the value returned by the managed emulator:

```bash
adb -s SERIAL shell "am force-stop com.luna.music"
adb -s SERIAL shell "am start -W -a android.intent.action.VIEW -d 'luna://luna.com/chart?cur_chart_id=7036274230471712007&display_chart_ids=%5B%227036274230471712007%22%2C%227060812597884869927%22%5D&display_chart_titles=%5B%22%E7%83%AD%E6%AD%8C%E6%A6%9C%22%2C%22%E6%96%B0%E6%AD%8C%E6%A6%9C%22%5D&scene_name=personal_os_chart' com.luna.music"
```

For `new`, change only `cur_chart_id` to `7060812597884869927`. Keep the full URI and pass the complete remote command as one quoted argument. The URI contains `&`; an abbreviated URI or an unquoted remote command can open a blank chart page even though `am start` reports success.

Capture evidence and OCR it directly:

```bash
mkdir -p data/evidence/YYYY-MM-DD/hot
adb -s SERIAL exec-out screencap -p > data/evidence/YYYY-MM-DD/hot/chart.png
swift scripts/vision_ocr.swift data/evidence/YYYY-MM-DD/hot/chart.png
```

Use the runtime's image viewer on the saved PNG. Only after inspecting that image may the runtime issue a bounded gesture:

```bash
adb -s SERIAL shell "input tap X Y"
adb -s SERIAL shell "input swipe X1 Y1 X2 Y2 450"
```

Never use a serial not returned by `qishui_emulator.py start`. Keep screenshots under `data/evidence`. Every coordinate must be justified by the immediately preceding screenshot, and a new screenshot is required after the gesture.

## Deterministic persistence

After visual reconciliation, prepare one JSON array per chart:

```json
[
  {"rank": 1, "title": "歌名", "artist": "歌手", "requiresVip": false}
]
```

Then save and validate it:

```bash
python3 scripts/qishui_archive_tool.py save-chart --date YYYY-MM-DD --chart hot --input /absolute/path/hot.json --evidence /absolute/path/hot.png
python3 scripts/qishui_archive_tool.py save-chart --date YYYY-MM-DD --chart new --input /absolute/path/new.json --evidence /absolute/path/new.png
python3 scripts/qishui_archive_tool.py sync --date YYYY-MM-DD --obsidian-vault "/Users/frigidcrow/Documents/Obsidian Vault"
```

`save-chart` defaults to `--transcription-method screenshot_only`, which truthfully records screenshot visual review and does not claim OCR succeeded. Pass `--transcription-method screenshot_and_ocr` only when OCR really completed and the runtime reconciled it against the screenshot.

`save-chart` rejects anything other than ten continuous ranks with non-empty title and artist. `sync` computes rank changes, updates `data/library/tracks.json`, reuses canonical audio paths, and writes the daily Obsidian note.

After `sync`, the AI Runtime—not a deterministic script—must inspect the validated snapshots and diff, then write `Projects/Qishui Music/Analysis/YYYY-MM-DD.md` in Chinese. The daily note already links to this location. Keep observed chart facts, metadata-level interpretation, and audio-derived observations in explicitly separate sections.

For a Personal OS rehearsal, never use the canonical commands above. Use the stable root Run id from `get_run_context` for every attempt:

```bash
REHEARSAL_ROOT="data/rehearsals/REHEARSAL_ROOT_RUN_ID"
python3 scripts/qishui_archive_tool.py save-chart --date YYYY-MM-DD --chart hot --input "$REHEARSAL_ROOT/hot.json" --evidence "$REHEARSAL_ROOT/hot.png" --workspace-root "$REHEARSAL_ROOT"
python3 scripts/qishui_archive_tool.py save-chart --date YYYY-MM-DD --chart new --input "$REHEARSAL_ROOT/new.json" --evidence "$REHEARSAL_ROOT/new.png" --workspace-root "$REHEARSAL_ROOT"
python3 scripts/qishui_archive_tool.py sync --date YYYY-MM-DD --workspace-root "$REHEARSAL_ROOT"
```

This writes snapshots, diff, a seeded library copy and `obsidian-preview` only under the rehearsal root. Write the rehearsal analysis under that same preview tree. Do not edit source files or the real Vault during a rehearsal.

## Official audio gate

Audio handling remains a separate coverage step. Use the official app only. Record one of:

- `available` with a verified local media path;
- `login_required`;
- `vip_required`;
- `protected_storage`;
- `no_exportable_file`.

Never claim `available` until a local file exists and `ffprobe` can read it. The verified 2026-07-30 probe is `protected_storage`: after login, the official standard-quality download appeared under 汽水音乐「我的 → 下载」, while the client stated that the file is limited to local playback during the VIP entitlement and exposed no media file outside app-private storage.
