---
name: personal-os-daily-focus
description: Build a realistic daily focus plan from Personal OS projects, tasks, opportunities, experiments, assets, and Codex runs. Use when the user asks what to do today, wants to reduce scattered work, needs a daily plan, or wants to hand an approved task to Codex.
---

# Personal OS Daily Focus

Turn the current Personal OS state into a short, executable day. Preserve the user's attention: prefer completion, revenue, and reusable leverage over starting more work.

## Workflow

1. Call `mcp__personal_os__get_today_context` before making recommendations.
2. Identify constraints: blocked work, review queue, deadlines, unfinished experiments, and excessive work in progress.
3. Choose at most three outcomes for today:
   - one outcome that protects or creates near-term cash;
   - one outcome that compounds into a reusable asset or system;
   - one maintenance or life-operations outcome only when it is genuinely urgent.
4. For each outcome, name the exact task, why it matters now, the smallest completion condition, and whether the human or Codex should do it.
5. Put Codex review items before new delegation. Do not treat `needs_review` as complete.
6. If the user explicitly asks to begin a task, call `mcp__personal_os__update_task_status` with `in_progress`. Never mark a task `done`; only the web review action may do that.
7. End with a concise stop-doing list and a first 25-minute action.

## Decision Rules

- Prefer a small finished result over a larger vague initiative.
- Respect dependencies and valid task transitions.
- Do not invent deadlines, revenue, customers, or completed work.
- Treat demo records as examples, not live evidence.
- Do not purchase, publish, deploy, contact people, or make irreversible changes without explicit user approval.
- If Personal OS has insufficient data, say exactly what is missing and propose the smallest capture step.

## Output Contract

Return four compact sections: `今日三件事`, `交给 Codex`, `暂时不做`, and `现在开始`. Include task IDs only when they help a follow-up tool call.
