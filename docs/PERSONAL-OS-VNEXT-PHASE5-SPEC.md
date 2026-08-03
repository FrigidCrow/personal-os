# Personal OS vNext Phase 5 完整财务规格

**状态**：Implementation contract frozen

**日期**：2026-08-02

## 1. 目标

Phase 5 建立可审计、可复现、适合一人公司的财务核心。FinanceAccount 和 FinanceTransaction 保存真实现金事实；Budget、Calculation 和 Operating Unit 保存计划、计算与经营归因。Agent 可以读取财务并提出 ChangeProposal，但不能直接修改历史交易。

## 2. 金额与汇率

- 金额统一使用最小货币单位安全整数。
- 每笔交易必须与账户币种一致。
- 同币种转账两端金额必须相等。
- 跨币种转账必须提供正整数 `rateNumerator/rateDenominator`，目标金额由整数四舍五入公式验证。
- 任何权威计算不得依赖 JavaScript 浮点金额。
- 汇率、公式版本、输入快照、假设和结果必须随 Calculation 保存。

## 3. 交易语义

- `income` 增加余额并增加收入。
- `expense` 减少余额并增加支出。
- `refund` 必须引用原交易；退支出减少支出，退收入减少收入，累计退款不能超过原金额。
- `transfer_out/transfer_in` 必须共用 transfer ID；不计收入或支出。
- `adjustment` 仅由受控冲销或批准后的修改流程创建。
- 逻辑删除恢复余额但保留原始记录和 Audit。
- 冲销创建反向交易，不覆盖原交易；同一交易最多冲销一次。

## 4. 分类、预算和计算

- Category 支持收入、支出或两者，停用不删除历史引用。
- Budget 按月、币种和 Category 唯一；修改保存 Audit。
- 月度汇总按 reporting effect 计算，转账不影响净收入。
- Budget Variance 保存预算、实际、差额和输入快照。
- Cashflow Forecast 保存期初余额、逐月显式收入/支出假设、公式版本和逐月结果。
- Currency Conversion 保存有理数汇率、舍入前分子和最终整数结果。
- 任意 Calculation 可以使用其保存的输入快照重新计算并得到相同结果。

## 5. Operating Unit 与分摊

- Operating Unit 可以关联 Project，也可以代表 Radar、产品或自定义经营单元。
- Allocation 只分摊真实交易，币种必须一致。
- 同一交易和 Operating Unit 只能有一条 Allocation；相同请求幂等，不同金额冲突。
- 一笔交易的分摊总额不能超过交易金额。
- Operating Entry 记录预期收入、承诺成本或投入时间，不能伪装成现金事实。

## 6. ChangeProposal 与审批

- `update/delete/reverse` 都先创建 Pending ChangeProposal。
- Agent 创建提议时只保存脱敏理由和允许字段。
- first-decision-wins；拒绝不改变交易。
- 批准删除执行逻辑删除。
- 批准冲销创建反向交易。
- 批准修改创建“原交易冲销 + 新交易”，不覆盖历史。
- Proposal 状态、交易写入和余额变化必须在同一 SQLite 事务中完成。

## 7. UI

- 资产/财务包含概览、账户、交易、预算、预测、经营归因和待审批提议。
- 实际金额、预算、预测、时间投入分开展示。
- 转账、退款、分摊和提议都有明确表单及错误反馈。
- 加载、空、错误、保存中、成功和审批结果均可见。
- 390px 下无横向滚动；浅色、深色、系统主题与减少动效继续生效。

## 8. 非目标

- 不自动付款、转账、开票或报税。
- 不抓取银行账户，不保存网银凭证。
- 不构建复式会计总账或税务申报系统。
- 不允许 Agent 绕过审批修改现金事实。
- 不执行 Phase 7 生产端口或 Scheduler 主权切换。

## 9. 测试层级

1. Domain：整数金额、转账守恒、退款上限、分数汇率、预算差异、预测复现。
2. Application：ChangeProposal 门禁、分摊幂等、冲销与修改语义。
3. SQLite：Migration 7、余额原子性、约束、失败回滚、Calculation 快照。
4. API：所有输入 Schema、错误码、审批和读取模型。
5. E2E：账户、交易、预算、预测、Operating Unit、分摊和审批闭环。
6. Regression：全量测试、旧/vNext E2E、typecheck、lint、build、quick/FK check。
