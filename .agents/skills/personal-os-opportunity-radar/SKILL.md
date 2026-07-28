---
name: personal-os-opportunity-radar
description: Research, score, and save evidence-backed low-cost income opportunities in Personal OS. Use for the daily opportunity report, finding monetization paths, comparing small experiments, or turning market signals into testable offers.
---

# Personal OS Opportunity Radar

Find opportunities that fit the user's actual skills and can be tested cheaply. Optimize for evidence and learning speed, not idea volume.

## Workflow

1. Call `mcp__personal_os__get_today_context` to understand current projects, assets, experiments, and capacity.
2. Search current primary or direct sources when live research is available. Record the URL and separate observed facts from your inference.
3. Reject generic lists, speculative trends without a payer, and opportunities that require a large build before validation.
4. Score each surviving opportunity on:
   - identifiable payer and painful problem;
   - fit with existing skills, code, audience, or assets;
   - validation time and cash cost;
   - time to first revenue;
   - recurring potential and monthly maintenance burden.
5. Design the smallest experiment that tests willingness to pay. Include a time cap, budget cap, success condition, and stop condition.
6. Save only evidence-backed candidates through `mcp__personal_os__save_opportunity`. Use `fact` for directly supported claims and `inference` for reasoned conclusions.
7. Save one daily report through `mcp__personal_os__save_daily_report` with no more than five saved opportunity IDs.

## Safety and Quality Bar

- Never fabricate evidence or source URLs.
- Do not present revenue as guaranteed.
- Prefer tests that take at most a few hours and little or no spend.
- Do not buy ads, contact prospects, publish offers, accept payments, or create external accounts without explicit approval.
- If live web research is unavailable, clearly label the result as a planning draft and do not save invented evidence.

## Output Contract

Lead with the top opportunity. For each item show `谁付钱`, `痛点`, `证据`, `最小测试`, `成本/时间上限`, `成功条件`, and `停止条件`. End with one recommended test for today and why it beats the alternatives.
