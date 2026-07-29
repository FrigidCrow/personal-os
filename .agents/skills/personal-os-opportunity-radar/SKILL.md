---
name: personal-os-opportunity-radar
description: Research, score, and save evidence-backed low-cost income opportunities in Personal OS. Use for the daily opportunity report, finding monetization paths, comparing small experiments, or turning market signals into testable offers.
---

# Personal OS Opportunity Radar

Find opportunities that fit the user's actual skills and can become automated, low-maintenance products. Operate as a conservative investment committee. Scan broadly across verticals, then deeply research only candidates that can clear the program gate.

## Workflow

1. Call `mcp__personal_os__get_today_context` to understand current projects, assets, experiments, and capacity.
2. Search current primary or direct sources when live research is available. Record the URL and separate observed facts from your inference.
3. Reject generic lists, speculative trends without a payer, manual fulfillment as the core loop, unavailable commercial-account dependencies, and products without an automated Chinese payment and delivery path.
4. For each serious candidate collect two independent demand facts plus strong dated fact evidence for payment, channel access, implementation feasibility, and counter-evidence. A marketing or pricing page alone is not payment proof.
5. Record what each source proves and does not prove. Investigate current alternatives, free substitutes, platform-native features, privacy objections, external dependencies, and the three most likely failure modes.
6. Score each candidate out of 100: demand 20, payment 20, acquisition 15, closure 15, differentiation 10, feasibility 10, recurring value 10. Do not save a score below 85 or any candidate that misses a critical score floor.
7. Design the smallest automated funnel that tests willingness to pay. Include a time cap, budget cap, success condition, and stop condition. Interviews, cold outreach, and manual delivery are not the core experiment.
8. Save at most three gate-passing candidates through `mcp__personal_os__save_radar_opportunity`. Never lower the standard to fill a slot.
9. Save one daily report through `mcp__personal_os__save_radar_report`. Three qualified candidates produce full success; zero to two produce an honest partial run.

## Safety and Quality Bar

- Never fabricate evidence or source URLs.
- Do not present revenue as guaranteed.
- Prefer narrow MVPs that one developer can build in 3-7 days with little spend.
- Do not buy ads, contact prospects, publish offers, accept payments, or create external accounts without explicit approval.
- If live web research is unavailable, clearly label the result as a planning draft and do not save invented evidence.

## Output Contract

Show the qualified-count target first. For each item show `谁付钱`, `当前替代方案`, `需求与付费证据`, `反证`, `竞争格局`, `获客路径`, `自动交付闭环`, `外部依赖`, `失败原因`, `未知项`, `分项评分`, `最小测试`, `成功条件`, and `停止条件`. Never describe a zero-to-two result as fully successful.
