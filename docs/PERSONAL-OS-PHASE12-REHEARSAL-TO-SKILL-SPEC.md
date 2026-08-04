# Personal OS Phase 12: Rehearsal to Skill

Status: Passed and deployed
Date: 2026-08-04

## Outcome

A complex Radar workflow can be proved in the real runtime before it becomes daily automation:

```text
immutable WorkSpec revision
  -> preflight
  -> rehearsal 1
  -> rehearsal 2
  -> failure-path drill
  -> Skill candidate
  -> human publish
  -> new immutable WorkSpec revision pinned to the Skill
  -> explicit schedule rebind
```

Phase 12 does not add a general graph editor. Checkpoints remain the step-level evidence mechanism and Codex/OpenWorker remain the execution runtimes.

## Managed local resources

Device workflows must not rely on Codex sandbox access to emulator internals. A WorkSpec may name one preconfigured `managedResource`. The Core API starts that resource before the Agent turn and stops it in `finally`, including Agent failure and partial resource-start failure. The resource command is an absolute, trusted LaunchAgent configuration, runs without a shell and is not user-supplied task input.

The first resource is `qishui-emulator`. Core owns the dedicated `Qishui_Radar_API_35` lifecycle; Codex owns visual decisions and Skill execution. The emulator manager disables crash-consent prompts, targets only the recorded AVD process/ADB serial and performs bounded cleanup escalation.

## Run modes

Runs declare `production`, `rehearsal` or `failure_drill`.

- production follows the WorkSpec review/deposition policy;
- rehearsal never auto-deposits and never advances a schedule;
- failure drill supplies an intentionally invalid result expectation and succeeds only when deterministic validation rejects it.

Every Run stores an immutable WorkSpec and Skill fingerprint through the WorkSpec reference. Rehearsal retries may reuse Phase 11 checkpoints.

## Evaluation

Each rehearsal receives a persisted evaluation with:

- structured result present;
- terminal success state;
- required verification entries;
- completed checkpoint evidence;
- evaluator version;
- pass/fail checks and human note.

The default deterministic gate requires two distinct passed rehearsal roots and one passed failure drill for the same WorkSpec revision. Retries of one rehearsal root count once.

## Candidate and publication

A candidate stores the proposed Skill content, SemVer, content hash and evidence Run IDs in SQLite. It is not written into `.agents/skills` while pending.

Human publication:

1. revalidates the candidate and evidence against current state;
2. rejects stale or changed hashes;
3. publishes through the existing RepositorySkillRegistry;
4. creates a new immutable WorkSpec revision pinned to the published Skill snapshot;
5. leaves schedule rebinding as a separate explicit user action.

The current production WorkSpec and schedules never follow `latest` and never change when a draft or candidate is edited.

## UI

The Radar detail page adds a `验证晋级` surface containing:

- gate summary with the exact missing evidence;
- preflight action;
- rehearsal action and evidence list;
- failure-drill action;
- candidate editor and validation state;
- publish action;
- clear final action to rebind a selected schedule.

Loading, empty, error and success states are explicit. No fabricated progress percentage is shown.

## Test plan

- additive migration and backward compatibility;
- Run-mode boundaries and no rehearsal deposition;
- two-success root counting and retry de-duplication;
- failure drill pass/fail semantics;
- candidate gate, secret redaction, name/version/hash validation;
- pending candidate filesystem isolation;
- stale candidate and double-publish conflicts;
- published immutable WorkSpec revision and explicit schedule rebind;
- browser end-to-end promotion journey;
- mobile/theme/accessibility, typecheck, lint, build and live smoke test.

## Live Qishui proof

WorkSpec revision 6 completed two independent rehearsals from an initially stopped emulator and one deterministic failure drill. Both rehearsals collected and validated official Android `热歌榜` and `新歌榜` Top10, generated isolated diffs/library/Obsidian previews, reported `protected_storage` truthfully, submitted no Suno job and ended with the managed emulator stopped. The daily `09:00 Asia/Tokyo` schedule was enabled only after the gate became ready.
