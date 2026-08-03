# Personal OS vNext MVP2 AI Runtime 规范

**状态**：Frozen for implementation

**日期**：2026-08-01

**范围**：Codex 与 OpenWorker Runtime 接入，不切换旧系统

## 1. 目标

MVP2 将 vNext 从“只能运行 Internal/Process”的控制台升级为真正位于 Codex 与 OpenWorker 上层的可视控制层。两种 AI Runtime 必须遵守同一 `ExecutorAdapter` 契约，所有状态、事件和结果写回 vNext Run；浏览器不能直接持有 Runtime Token 或调用 Runtime。

## 2. 框架决策

不引入 LangChain、LangGraph、Dify 或新的 Agent 框架。

- Codex 使用仓库已经采用的 `@openai/codex-sdk`。
- OpenWorker 使用其本地服务公开的带 Token REST 与 WebSocket 协议。
- Runtime 包只做协议适配、状态映射、安全边界和结果回收；业务事实仍由 Application Service 与 SQLite 保存。

这是本地单人系统里依赖最少、行为最容易审计的方案。GSD AI Integration 工作流原本要求 `.planning/ROADMAP.md`，当前仓库没有该结构，因此本规范使用仓库既有 `docs/PLAN.md` → `WORKLOG.md` → `REVIEW.md` 门禁，不伪造 GSD 产物。

## 3. 统一执行契约

每个 Adapter 接收：

- 不可变 Run 快照；
- WorkSpec 标题、指令和输入；
- 关联 Project，以及允许的本地仓库目录；
- AbortSignal；
- 只写 RunEvent 的事件函数。

每个 Adapter 返回：

- `succeeded`、`partially_succeeded`、`waiting_input` 或 `waiting_approval`；
- Runtime 的外部会话 ID；
- 完整用户可见结果；
- 真实可得的 Runtime 元数据。未知 Token 或费用必须保留为未知，不能推断为 0。

## 4. Codex 契约

- 必须绑定一个存在的本地 Git 项目；默认 `read-only`、禁用网络、禁用 Web Search、`approvalPolicy=never`。
- Runtime 关闭全局 Plugin/Skill 搜索注入，避免个人 Codex 安装中过多插件挤爆上下文；WorkSpec 已绑定的指令和版本化 Skill 内容仍通过任务上下文传入。
- 只有服务端允许的项目仓库可成为 `workingDirectory`。
- 提示包含 WorkSpec、Run 输入、安全规则和验收要求，不包含 Secret。
- SDK item 转换为顺序 RunEvent；最终响应写入 Run.result；thread id 写入 `externalRunId`。
- 取消必须传播至 SDK 调用的 AbortSignal；错误或空响应不能标记成功。

## 5. OpenWorker 契约

- 默认连接 `http://127.0.0.1:8765`；Token 仅从环境变量指向的文件或用户配置文件读取，禁止写入数据库、日志和结果。
- 使用服务端 WebSocket 会话，发送一个标准化 `user_message`，并将 assistant/tool/turn/error 事件转换为 RunEvent。
- 工作目录只能是允许的 Project 仓库，或 MVP2 托管的 OpenWorker 工作目录。
- `permission_required`、`directory_requested`、`plan_proposed` 映射为 `waiting_approval`；`question_requested` 映射为 `waiting_input`。MVP2 不自动批准，不把等待误报为成功。
- `turn_done` 前出现 error/input_rejected 或没有任何最终响应时必须失败。
- 取消向会话发送 `interrupt`，然后关闭连接。

## 6. 安全与数据边界

- 监听地址仍为 loopback；Web 只调用 Core API。
- Runtime Token 只能在 Adapter 内部读取，结构化事件必须经敏感字段过滤。
- 默认提示明确禁止付款、外联、发布、生产部署、删除文件、绕过受保护接口和伪造证据。
- MVP2 真实冒烟使用临时 Git 仓库或托管临时目录，只读、短提示、无外部写入。
- 不删除旧 5273/8787 服务、旧数据库、Obsidian 或项目文件。

## 7. 评测策略

确定性测试使用可注入的 Codex client、WebSocket 和 fetch fake，覆盖：

1. 输入与目录校验；
2. Prompt 安全规则；
3. Runtime event 顺序和状态映射；
4. 外部会话 ID 与最终结果持久化；
5. waiting input/approval 的 fail-closed 行为；
6. 取消与超时；
7. Token 不进入事件、结果或异常；
8. Adapter 异常不能产生成功；
9. API health 能区分 configured 与 unavailable；
10. 旧 Internal/Process、Schedule、SSE、导入和 UI 回归。

真实测试分两级：Runtime health 不消耗模型额度；小型 read-only smoke 只有在本机认证和服务健康时执行，并在报告中明确是否实际执行。

## 8. 明确不包含

- 自动批准 OpenWorker 权限请求；
- 完整 Approval 实体、审批恢复和过期策略（Phase 3）；
- Token/费用账单推断；
- 自动收集任意文件为 Artifact；
- 生产端口切换、Scheduler authority 切换和旧代码删除（Phase 7）。
