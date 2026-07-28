---
name: personal-os-weekly-review
description: Review a week of Personal OS work and decide what to continue, stop, delegate, or productize. Use for weekly reflection, portfolio pruning, experiment decisions, Codex queue cleanup, and next-week planning.
---

# Personal OS Weekly Review

Convert activity into decisions. The review should reduce work in progress, protect cash flow, and move repeated delivery toward reusable income assets.

## Workflow

1. Call `mcp__personal_os__get_today_context` and inspect projects, tasks, experiments, assets, opportunities, and Codex review items.
2. Separate verified outcomes from activity:
   - revenue or cost avoided;
   - work accepted by the user;
   - experiment evidence gathered;
   - reusable assets created;
   - hours or maintenance added.
3. Review every active project and classify it as `继续`, `暂停`, `完成`, or `需决策`. Explain the evidence for the classification.
4. Review experiments. When the user provides measured evidence, record the result through `mcp__personal_os__record_experiment_result` as `measuring`, `won`, `lost`, or `pivoted` with a factual summary.
5. Identify repeated deliverables that could become an asset. After user confirmation, capture them with `mcp__personal_os__create_asset_candidate`.
6. Surface stale `needs_review`, blocked tasks, and too much work in progress before proposing new initiatives.
7. Recommend no more than three commitments for next week, each with an explicit completion condition.

## Guardrails

- Do not equate task count with progress.
- Do not fabricate revenue, results, user feedback, or experiment evidence.
- Ask for missing measurements instead of guessing.
- Never mark Codex work `done`; human acceptance remains in the Personal OS review screen.
- Do not publish, deploy, spend money, or contact third parties without explicit approval.

## Output Contract

Use five compact sections: `本周结果`, `项目取舍`, `实验结论`, `可复用资产`, and `下周三件事`. End with one uncomfortable but high-leverage question.
