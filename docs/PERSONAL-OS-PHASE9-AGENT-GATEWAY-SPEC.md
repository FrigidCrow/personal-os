# Personal OS Phase 9 Agent Gateway 与 Skill 主权计划

**状态**：Passed（2026-08-03）

**日期**：2026-08-03

**方法**：Plan → Work → Review → Test

## 1. 流程摘要

Phase 9 在当前 v2 单体系统上增加一层受控 Agent Gateway。Scheduler 仍由 Personal OS 主动创建 Run，Codex 与 OpenWorker 仍只是执行器；新增的 MCP 只允许执行中的 Agent 把进度、结构化结果、审批请求和仓库内生成物写回当前 Core API。

完整链路：

`Schedule / 用户 → WorkSpec（固定 Skill）→ Run → Runtime → Personal OS MCP → Core API → SQLite / Artifact / Audit → UI Review`

本阶段不恢复旧 Pull Worker，不允许 MCP 直连 SQLite，也不把付款、外联、发布、删除或生产部署暴露为工具。

## 2. 自动化治理评估

- **输入来源**：用户创建或 Schedule 绑定的不可变 WorkSpec；每次运行只获取所属项目、固定 Skill、输入和必要的历史事实。
- **信任边界**：Web/Core API、Runtime 子进程、OpenWorker 本地服务和项目仓库彼此隔离；Runtime 不继承用户全部业务权限。
- **有副作用动作**：写运行事件、登记仓库内 Artifact、提交结构化结果、请求审批。均必须经 Core API 领域服务并留下 Audit。
- **高风险动作**：付款、购买、外联、发布、删除用户文件、生产部署、财务事实修改。本阶段不存在对应 MCP Tool，只能输出建议或请求人工审批。
- **失败策略**：Capability 缺失、过期、越权、Run 非运行中、路径逃逸或格式错误全部 fail closed；不得把失败伪装成成功。
- **可观测性**：所有 Tool 调用生成脱敏 RunEvent 和 Audit；UI 可实时看到来源、状态、结果、审批和 Artifact。

## 3. 治理结论

**APPROVE AS PILOT**

允许在本机单用户、Loopback API、当前 v2 数据库和明确允许的项目根目录内运行。正式扩大工具面前，必须先通过本阶段 Capability 隔离、审批恢复、双 Runtime 真实调用和生产健康验收。

## 4. 结论依据

当前 Scheduler 已采用推送式 Run 模型，Core API 已拥有 Run、Event、Approval、Artifact 与 Audit 事实。Phase 9 只需要为执行器提供窄接口，不需要引入队列平台或让 Agent 获得数据库权限。一次性随机 Capability 绑定 Run、执行器、Scope 和到期时间，可以把 OpenWorker/Codex 的权限限制在本次运行；终态、取消和进程重启均令其失效。

## 5. 目标架构

### 5.1 Runtime Capability

- 每次进入 `running` 时签发不可预测 Token；
- Token 固定绑定 `runId`、`executorType`、Scope、签发时间和到期时间；
- 只在内存中保存摘要，不写数据库、不写日志、不进入 Audit；
- MCP API 使用 Bearer Token 验证；OpenWorker 参数中的 Token 必须被日志脱敏；
- Run 进入等待态、终态、取消或服务重启后立即失效；恢复执行时重新签发。

### 5.2 MCP 工具面

Pilot 只提供：

1. `get_run_context`：读取本 Run 的受限上下文；
2. `append_run_event`：报告可视进度；
3. `search_knowledge`：只读搜索当前知识索引；
4. `save_artifact`：登记项目仓库内已经存在的文件；
5. `request_approval`：创建人工审批请求；
6. `get_approval_status`：读取本 Run 审批状态；
7. `submit_run_result`：提交结构化结果和验证摘要。

工具仅调用 `/api/v2/runtime/mcp/*`，禁止导入 Infrastructure 或访问 SQLite。

### 5.3 Runtime 接入

- Codex：每次 Run 通过 SDK 配置启动 stdio MCP，Capability 只存在于该 MCP 子进程环境；
- OpenWorker：加载固定本地 stdio MCP；每次 Run 在受控提示中传入短期 Capability，工具参数名强制使用 `capabilityToken` 并在事件中脱敏；
- 两者均使用同一个版本化 Skill 快照和同一组 Core API 规则。

### 5.4 Skill 主权

- 仓库 `.agents/skills/<name>/` 是版本化 Skill 源；
- 每个 Skill 必须包含有效 `SKILL.md` 与 `agents/openai.yaml`；
- WorkSpec 固定 `name/version/contentHash/path`，Schedule 仍只绑定 WorkSpec ID；
- Runtime 接收固定 Skill 内容，不依赖全局 Skill 搜索；
- 修改 Skill 必须创建新的 WorkSpec 固定版本，旧运行保持可复现。

## 6. 实施标准

- Core API 是唯一写入口；
- MCP Server 无数据库依赖；
- Tool 输入全部使用 Zod 校验并限制长度/数量；
- Artifact 只允许项目 Git 根目录内普通文件，重复登记幂等；
- Runtime 结果与 MCP 提交结果合并，不能覆盖审计字段；
- MCP 审批创建后，当前 Run 进入 `waiting_approval`，UI 决策后复用原 Runtime 会话继续；
- UI 明确显示 Skill 名称、版本和 SHA-256 摘要；
- 事件与错误不得包含 Token、API Key、密码或 Authorization Header。

## 7. 前置条件

- Personal OS API 只监听 `127.0.0.1`；
- SQLite v2 是唯一结构化事实源；
- Codex SDK 与 OpenWorker 本地服务健康；
- 项目仓库路径在允许根目录内；
- 高风险外部动作仍由人工执行或未来独立审批能力承接。

## 8. 测试计划

1. Capability：正确 Scope、过期、伪造、跨 Run、等待/终态/取消/重启失效；
2. MCP API：上下文最小化、事件脱敏、知识只读、Artifact 路径边界、结构化结果；
3. 审批：请求、等待、批准/拒绝、同会话恢复；
4. MCP Server：stdio 初始化、7 个 Tool 注册、API 成功与错误映射；
5. Runtime：Codex/OpenWorker 配置注入、Token 不出现在事件、真实只读冒烟；
6. Skill：官方校验器通过、Hash 固定、WorkSpec/API/UI 可见；
7. 回归：Vitest、TypeScript、ESLint、Build、Playwright 全部通过；
8. 生产：部署后 5273/8787、Scheduler、两种 Runtime 与 MCP 健康；
9. 安全：仓库/Runtime/日志扫描不存在真实 Capability 或旧 v1 MCP 路径；
10. Review：架构、安全、数据主权审查无阻断项。

## 9. 完成结论

Phase 9 已按 Plan → Work → Review → Test 完成。7 个 MCP 工具、每 Run Capability、固定 Skill 快照、审批恢复、结构化结果硬门禁、Codex/OpenWorker 接入和 UI 展示均已进入正式 current Runtime。真实双 Runtime 验收和完整回归证据见 `PERSONAL-OS-PHASE9-AGENT-GATEWAY-ACCEPTANCE.md`。
