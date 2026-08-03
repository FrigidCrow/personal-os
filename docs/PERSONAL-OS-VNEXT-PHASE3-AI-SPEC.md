# Personal OS vNext Phase 3 治理规范

**状态**：Frozen for implementation

**日期**：2026-08-02

**范围**：Runtime 等待恢复、Approval、人工验收、Artifact、Usage/Cost、Audit 与 Scheduler 治理；不执行生产切换

## 1. 目标

Phase 3 把 MVP2 的“能看见等待状态”升级为可完成的人工治理闭环：同一个 Run 在 `waiting_input` 或 `waiting_approval` 后，必须使用原 `externalRunId` 继续；每一次请求、决定、恢复、结果、Artifact、成本和最终验收都必须持久化并可审计。

## 2. 框架决策

继续使用现有 TypeScript Application Service、SQLite、Codex SDK 与 OpenWorker 本地 REST/WebSocket 协议，不引入 LangGraph、Dify 或新的审批平台。状态与治理由 Personal OS 持有，Runtime 只负责继续执行。

`gsd-ai-integration-phase` 无法按阶段号初始化，因为仓库没有 `.planning/ROADMAP.md`；本阶段继续遵守仓库的 `docs/PLAN.md → WORKLOG.md → REVIEW.md` 门禁，并采用确定性评估优先、人工判断只处理主观结果的原则。

## 3. 等待与恢复契约

- `waiting_input`：用户提交非空回答后，Run 转回 `running`，使用原会话继续；回答必须经过 Secret 过滤。
- `waiting_approval`：系统创建一个且仅一个 Pending Approval；批准、拒绝或过期均形成不可覆盖的决定，再把协议对应的 response 发送回原 Runtime 会话。
- OpenWorker 根据原请求发送 `approval`、`directory_response`、`plan_response` 或 `question_response`，不得用普通新任务冒充恢复。
- Codex 使用 `resumeThread` 继续已存在的 thread；没有 thread id 时禁止伪造恢复。
- API 重启只把真正处于 `running` 的 Run 标为中断；等待输入和等待审批的 Run 必须保留。
- 拒绝与过期默认 fail-closed，不授权目标动作，但允许 Runtime 生成“已跳过该动作”的最终说明。

## 4. Approval 与最终验收

- Approval 包含 Run、请求类型、风险、摘要、过滤后的 payload、状态、过期时间与解决意见。
- Pending Approval 只能第一次决定生效；重复、过期后批准、跨 Run 重放均拒绝。
- consequential action 仍由 Runtime 自己执行；Personal OS 只把明确决定回传，不直接代做外部动作。
- Runtime 完成不等于用户接受。`succeeded` 与 `partially_succeeded` 默认进入 `review_pending`；用户可以接受或拒绝结果，决定不改写原执行状态。

## 5. Usage、Cost 与 Artifact

- Adapter 把可信 usage 放在统一字段；未知保持 `null`。
- 实际成本只能来自 `provider_bill` 或 `manual_receipt`，以最小货币单位整数保存；Token 用量不能自动换算成账单金额。
- Codex 成功的文件变更可以注册为 Git Artifact；路径必须位于绑定仓库内且文件真实存在。
- 同一个 Run、storage kind 与 URI 重复收集必须幂等。
- Git、Obsidian 和 external Artifact 只保存引用；本阶段不复制大文件，也不把音频加入 Git。

## 6. Audit、Secret 与 Scheduler

- AuditLog 是 append-only；数据库触发器拒绝 UPDATE/DELETE。
- WorkSpec、Run input、Approval payload、事件和 Audit snapshot 均执行结构化与自由文本 Secret 过滤。
- Secret 只能以 `secret://<scope>/<name>` 引用；本阶段不提供把明文 Secret 写入 SQLite 的 API。
- Schedule firing 仍由唯一键保证跨重启幂等；catch-up 最多补一次，不形成风暴。
- Health 返回数据库、Runtime、Scheduler 最近 tick 与 Pending Approval 数量。

## 7. 评测策略

确定性门禁优先覆盖：状态转换、重复审批、审批过期、原会话恢复、审计不可变、Secret 过滤、Artifact 路径与幂等、已知/未知成本、Schedule 跨重启幂等和 SQLite 完整性。

产品级评测维度：

| 维度 | 通过标准 | 阻断失败 |
|---|---|---|
| 升级准确性 | 每个高风险请求都进入 Approval，普通回答不误建审批 | 高风险动作绕过审批 |
| 状态忠实度 | 等待、恢复、拒绝、过期、完成和验收均与持久化事实一致 | 等待被报成成功或重复执行 |
| 可追溯性 | Run 可回放请求、决定、Runtime 事件、Artifact、成本和验收 | 关键决定无 Audit |
| 数据安全 | Secret 不进入数据库、日志、结果、Artifact 或 Git diff | 任意真实 Secret 泄露 |
| 成本真实性 | 未知为 null；实际金额只来自受信来源 | 用 Token 猜测费用或记为 0 |

真实测试只使用只读/无外部写入场景。OpenWorker 治理 smoke 可以提出问题或只读计划审批；不得付款、发布、外联、删除文件或生产部署。

## 8. 明确不包含

- 生产端口和 Scheduler authority 切换；
- 自动批准、常驻授权或审批规则自学习；
- 自动根据 Token 单价估算账单；
- 付款、发邮件、发布、生产部署；
- 任意文件复制、音频入库或 Git 提交。
