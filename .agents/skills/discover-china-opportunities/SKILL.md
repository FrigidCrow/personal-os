---
name: discover-china-opportunities
description: Research and validate low-input revenue opportunities for the Chinese market. Use for the Personal OS opportunity radar when candidates need evidence of demand, willingness to pay, reachable buyers, domestic sales and payment channels, implementation feasibility, counter-evidence, and a concrete minimum experiment.
metadata:
  version: "1.0.0"
---

# 中国市场机会雷达

先读取 Personal OS Run 上下文，再按以下门禁调研。默认输出中文，面向中国大陆市场，优先微信、支付宝或国内平台能够完成收款的路径。

## 扫描与深挖

1. 从多个垂直领域扫描真实信号，不预设必须凑满数量。
2. 对每个候选分别寻找：需求证据、真实付费或采购证据、可触达买家、明确销售渠道、国内收款闭环、两周内最小实现路径、竞争/替代方案与反证。
3. 来源必须多样，至少包含一条原始需求或采购信号与一条独立验证来源。聚合转载和模型推断不能重复计证据。
4. 没有“卖给谁、在哪里触达、如何成交、如何收款”的候选直接淘汰。
5. 免费成熟替代品已经满足需求、只能依靠大量人工服务、需要未拥有的账户/资质/流量，或最小实验不能低成本执行的候选直接淘汰。

## 评分

每项 0–100，并记录证据与扣分理由：

- 需求真实性 20
- 付费可信度 20
- 买家与销售渠道闭环 20
- 两周内可实现性 15
- 与现有技能/资产匹配 10
- 经常性收入潜力 10
- 低维护性 5

反证必须实质扣分。只有综合分严格达到 85 且所有门禁齐全才算合格。完整成功条件是深挖出 3 个合格候选；不足 3 个必须标记为 `partially_succeeded` 或失败原因，不得用“零机会也成功”滑坡。

## 每个合格机会的输出

- 一句话价值主张；
- 目标买家的具体角色与痛点；
- 需求、付费、渠道、实现与反证证据链接；
- 产品形态、价格锚点、交付边界；
- 国内获客渠道、第一批名单如何获得、开场话术；
- 微信/支付宝/平台担保等成交收款路径；
- 48 小时最小实验、停止条件与成功指标；
- 首单时间、维护工时与收入均标注为推断；
- 未经授权不得投标、联系客户、发布内容或付费。

过程中用 `append_run_event` 报告扫描、深挖、淘汰和验证阶段，最后用 `submit_run_result` 提交结构化候选与证据摘要。
