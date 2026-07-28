# MVP2 Acceptance Matrix

Status: Planned
Created: 2026-07-28
Reviewed: Pending
Source: `docs/AUTOMATION-PLAN.md`

MVP2 采用 Plan -> Work -> Review。任何条目在获得直接证据前都保持 `Pending`；测试通过但未覆盖该条目的完整行为，不视为完成。

| ID | Requirement | Required direct evidence | Status |
|---|---|---|---|
| C01 | 空数据库与现有 MVP1 数据库都能无损迁移到 MVP2 schema | 对临时空库和 MVP1 fixture 分别执行迁移，查询表结构、数据数量与外键 | Pending |
| C02 | Task 具备 executor、executionMode、triggerType、triggerConfig、riskLevel、maxAttempts、nextRunAt 等字段，旧任务得到兼容默认值 | Domain schema、数据库读写及迁移断言 | Pending |
| C03 | Codex 与 OpenWorker 使用统一 `agent_runs`，历史 Codex thread 与运行记录可读 | 迁移测试、统一 API 返回、旧 `/api/codex/runs` 兼容测试 | Pending |
| C04 | AgentRun 状态机和事件类型拒绝非法转换并保留完整审计时间线 | Domain 负向测试与数据库事件顺序断言 | Pending |
| C05 | 同一任务最多一个活跃运行，幂等键不能重复 | 并发领取、唯一索引和重复请求测试 | Pending |
| C06 | Router 按显式执行器、项目规则和确定性白名单选路，无法判断时回到 Human | 路由表驱动单元测试 | Pending |
| C07 | High risk 任务不会被自动分派 | Domain、Dispatcher 与 API 负向测试 | Pending |
| C08 | 手动触发可通过统一 Dispatcher 启动 Codex demo 并进入 Needs Review | API 集成测试与数据库状态断言 | Pending |
| C09 | Automatic 低风险 Codex 任务能被本地 Dispatcher 自动启动且不会跳过人工验收 | 调度器集成测试、运行事件与任务状态断言 | Pending |
| C10 | Live Codex 仍要求真实 Git 仓库、非空验收条件、workspace-write、禁网和安全策略 | Adapter 前置校验测试与实际运行配置证据 | Pending |
| C11 | 用户可暂停自动执行、取消未开始运行，并对允许重试的失败运行手动重试 | API、Web 交互和数据库断言 | Pending |
| C12 | 领取租约、30 秒心跳、2 分钟过期、有限重试和最终 Blocked 行为可恢复 | 可控时钟的租约/心跳/回收测试 | Pending |
| C13 | MCP 提供 `list_claimable_tasks`、`claim_task` 与 `get_execution_context`，领取是原子的 | MCP 协议测试及数据库并发断言 | Pending |
| C14 | MCP 可发送心跳、事件、产物、结果和失败，结果只能进入 Needs Review | MCP 工具测试与落库断言 | Pending |
| C15 | MCP 可创建审批并只读查询审批状态 | MCP 工具测试、审批记录不可由 Agent 修改的负向测试 | Pending |
| C16 | 发送消息、日历写入、发布、外部写入等后果性操作在批准前不可执行 | 权限边界测试和审批阻断 E2E | Pending |
| C17 | Agent、MCP 与 Dispatcher 均不能直接把 Task 或 Run 标记为 Done | API/MCP 工具枚举与状态转换负向测试 | Pending |
| C18 | OpenWorker 能通过 Personal OS MCP 完成一次真实、无外部写操作的 Pull 任务 | OpenWorker 实例日志、MCP 事件、产物和 SQLite 记录 | Pending |
| C19 | Web 任务创建和详情可配置执行者、执行方式、触发器/时区、风险与最大尝试次数 | 浏览器表单交互、HTTP 请求体与数据库记录 | Pending |
| C20 | 任务队列显示路由结果和运行状态，并提供暂停、取消、重试入口 | 桌面与移动浏览器交互证据 | Pending |
| C21 | Agent Runs 页面统一展示 Codex/OpenWorker、健康、session、事件、产物、验证、错误与重试信息 | 浏览器详情、API 响应和落库记录 | Pending |
| C22 | Approval Inbox 展示目标、动作和预览；Approve/Reject 明确、可键盘操作、移动端可用，过期默认拒绝 | 浏览器 E2E、可访问性检查和数据库断言 | Pending |
| C23 | MVP2 HTTP API 在边界校验输入并返回一致错误，所有变更都通过 database package | API 正向/负向集成测试和源码审查 | Pending |
| C24 | manual、cron、event、dependency 触发器与时区、重复 tick、最近一次 catch-up 规则可验证 | 可控时钟 Scheduler 测试 | Pending |
| C25 | 本地健康检查、卡死检测、重启恢复、LaunchAgent 安装/卸载、备份与保留策略有实现和验证 | 脚本 dry-run、进程重启与数据库恢复测试 | Pending |
| C26 | 安装、端口、启动、OpenWorker MCP 配置和故障恢复步骤可以复制执行 | 文档命令逐项 smoke test | Pending |
| C27 | MVP2 单元、集成、Web、MCP、Adapter、Scheduler 和 E2E 自动化覆盖通过 | `npm test`、typecheck、lint、build 与 E2E 报告 | Pending |
| C28 | 至少一个真实 Codex 场景从 Web 创建到人工验收完整通过 | 浏览器点击、request/response、运行日志和 SQLite 查询 | Pending |
| C29 | 至少一个真实 OpenWorker 场景从自动领取到人工验收完整通过 | OpenWorker/MCP 日志、Web 点击和 SQLite 查询 | Pending |
| C30 | MVP1、MVP1.1、MVP2 的所有功能均被列入全量功能清单，缺失功能补齐后逐项执行 UI -> HTTP -> backend -> SQLite E2E，再执行完整业务旅程 | `docs/FULL-E2E-ACCEPTANCE.md`、自动化 trace、浏览器证据和最终 review | Pending |

## Required gates

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Review 阶段还必须验证依赖审计、`git diff --check`、桌面/移动端、light/dark/system、键盘操作、reduced motion，以及浏览器控制台无错误。
