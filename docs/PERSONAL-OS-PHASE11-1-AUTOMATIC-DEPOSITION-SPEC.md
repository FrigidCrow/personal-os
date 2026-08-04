# Personal OS Phase 11.1: Automatic report deposition

Status: Planned
Date: 2026-08-04

## Outcome

Low-risk recurring reports may write a structured result into a controlled Obsidian directory immediately after a successful run. The user does not approve the same read-only report every day. Code changes, finance mutations, external publishing, purchases and incomplete results keep their existing human gates.

## Policy

Each immutable WorkSpec declares one review policy:

- `required`: a completed Run enters `pending` review. Deposition is allowed only after acceptance.
- `not_required`: a completed Run is not queued for review. This policy is allowed only for a workflow with a pinned Skill and an explicit `on_success` deposition policy.

Each deposition policy declares:

- trigger: `on_acceptance` or `on_success`;
- managed root: `Reports` or `Generated`;
- optional safe subdirectory below that root;
- title template;
- period: one note per Run or one note per local calendar day;
- IANA timezone used by calendar-day titles and deduplication.

Defaults preserve Phase 11 behavior: review is required and deposition happens after acceptance.

## Completion flow

```text
Runtime returns structured success
  -> validate pinned Skill result
  -> persist terminal Run
  -> required: mark pending review
  -> not_required: keep review not_required
  -> on_success: deposit through controlled KnowledgeService
  -> deposition failure: keep Run success, emit an actionable alert
```

Failed, cancelled, waiting, unstructured Agent and rejected Runs never create a note. A rerun for the same WorkSpec and local calendar day reuses the managed note instead of producing a second file.

## Managed note

The note records:

- AI-generated and unreviewed status when applicable;
- report summary and structured data;
- verification evidence;
- WorkSpec, Run, Runtime and pinned Skill hash;
- quality status supplied by the structured result;
- deposition timestamp and source links.

The application writes only under the registered Vault and the selected managed root. Traversal and symlink escapes remain rejected.

## Production correction

The canonical daily AI briefing and opportunity scan receive new immutable WorkSpec revisions with:

- `reviewPolicy=not_required`;
- `resultDeposition.trigger=on_success`;
- `period=calendar_day` and `timezone=Asia/Tokyo`;
- `Reports/AI日报` and `Reports/机会雷达` respectively.

The two existing schedules are explicitly rebound. Historical WorkSpecs, Runs and disabled schedules remain intact.

## Test plan

- migration and old-row compatibility;
- schema defaults and invalid policy combinations;
- manual acceptance flow regression;
- automatic success deposition;
- no note for failure, waiting or missing structured Agent result;
- same-day deduplication and next-day separation;
- directory traversal and symlink rejection;
- deposition failure visibility without changing Run success;
- API, browser, mobile, theme, typecheck, lint, build and live production audit.
