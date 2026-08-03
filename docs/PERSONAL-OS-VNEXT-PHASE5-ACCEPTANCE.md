# Personal OS vNext Phase 5 验收表

**状态**：Passed（并行 vNext；未批准生产切换）

**日期**：2026-08-02

| ID | 验收项 | 直接证据 | 状态 |
|---|---|---|---|
| P5-01 | Migration 7 建立 Category、Budget、Calculation、Operating Unit、Allocation、Operating Entry、ChangeProposal | `complete_finance` 迁移测试及官方 v2 七表清单 | Passed |
| P5-02 | 所有金额使用安全整数且币种必须与账户一致 | Zod safe integer、BigInt 溢出与币种负向测试 | Passed |
| P5-03 | 同币种转账金额守恒且数据库失败时两端都回滚 | 第二账户更新触发器故障注入，零交易且双余额不变 | Passed |
| P5-04 | 跨币种转账使用整数分数汇率并验证舍入结果 | `convertMinorUnits` 表驱动测试及错误目标金额拒绝 | Passed |
| P5-05 | 转账不进入收入支出汇总 | 成对转账后月度收入、支出、净额均为零 | Passed |
| P5-06 | 支出退款和收入退款方向正确，累计退款不超过原额 | 双方向退款与超额退款集成测试 | Passed |
| P5-07 | 冲销创建反向事实且同一交易不能重复冲销 | 审批生成唯一 reversal，重复提议在创建时拒绝 | Passed |
| P5-08 | 修改提议批准后保留原交易并创建冲销和替代交易 | 两个新事实、原交易保留、最终余额正确 | Passed |
| P5-09 | 删除、修改、冲销在未审批前不能改变余额或交易 | 直接删除拒绝、Pending 不改余额、审批故障全事务回滚 | Passed |
| P5-10 | Category 和月度 Budget 唯一且可审计更新 | 唯一约束、同 ID upsert 与 `finance.budget_updated` Audit | Passed |
| P5-11 | Budget Variance 保存实际、预算、差额、公式版本和输入快照 | `budget-variance-v1` 快照与 1300 差额断言 | Passed |
| P5-12 | Cashflow Forecast 可从保存快照得到完全一致结果 | Domain 逐月结果与保存后 replay `matches=true` | Passed |
| P5-13 | Currency Conversion 不使用浮点金额并保存有理数汇率 | BigInt 分子、整数分母、公式版本与 replay 测试 | Passed |
| P5-14 | Allocation 相同请求幂等、不同金额冲突、总额不能超交易 | 幂等键、冲突、跨单元超额及 SQLite Trigger | Passed |
| P5-15 | Operating Unit 汇总区分实际现金、预期金额与时间 | Service/API 与 Playwright 分栏汇总 | Passed |
| P5-16 | Agent 只能创建脱敏 ChangeProposal，不能直接修改交易 | Runtime 专用提议 API、Secret 清除、无 PATCH/DELETE 交易路由 | Passed |
| P5-17 | 财务 UI 完成交易、转账、退款、预算、预测、分摊和审批闭环 | `完整财务工作台...` Playwright 旅程 | Passed |
| P5-18 | 390px、浅色/深色/系统主题、减少动效和全部交互状态通过 | 7/7 vNext E2E、零横向溢出及 Phase 5 双主题截图 | Passed |
| P5-19 | 正式 v2 Migration 7 后 quick_check/FK 通过，v1 无写入 | 备份 `088b42...9347`；v2 schema 7；v1 `91f140...e6bd` 不变 | Passed |
| P5-20 | 全量单元/集成、旧/vNext E2E、TypeScript、Lint、Build 通过 | 191/191、vNext 7/7、旧 7/7、静态检查和全构建 | Passed |

## 阻断条件

任意浮点权威金额、转账单边提交、超额退款、超额分摊、历史覆盖、审批绕过、Secret 泄漏、Calculation 无法复现、v1 数据变化或生产端口切换都会阻断 Phase 5。
