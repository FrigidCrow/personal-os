# Personal OS Phase 9 Agent Gateway 与 Skill 验收

**状态**：Passed

**完成日期**：2026-08-03

| ID | 验收项 | 直接证据 | 状态 |
|---|---|---|---|
| P9-01 | 每次运行签发绑定 Run/Executor/Scope/TTL 的随机 Capability | `RuntimeCapabilityAuthority` 单元测试覆盖随机令牌、绑定和 Scope；真实运行结束后健康页 `activeCapabilities=0` | Passed |
| P9-02 | 等待、终态、取消、重启后旧 Capability 失效 | 单元/API 测试覆盖过期、撤销、审批恢复时换发；取消旧机会雷达 Run 后审批同步拒绝 | Passed |
| P9-03 | MCP 只调用 Core API，不依赖 Infrastructure/SQLite | `apps/mcp-v2` 源码扫描无 Infrastructure、`better-sqlite3` 或 SQLite 导入 | Passed |
| P9-04 | stdio MCP 注册 7 个受控工具 | `npm run smoke:mcp` 通过，精确列出 7 个工具 | Passed |
| P9-05 | 受限运行上下文和知识只读检索可用 | API 集成测试与真实 Codex/OpenWorker `get_run_context` 调用通过 | Passed |
| P9-06 | Runtime 进度可实时写入 RunEvent 且敏感值脱敏 | API 测试覆盖事件脱敏；两次真实 Run 均持久化 `agent.phase9_smoke` | Passed |
| P9-07 | Artifact 只能登记项目仓库内文件且重复提交幂等 | 路径逃逸、普通文件、重复登记集成测试通过 | Passed |
| P9-08 | Agent 可请求审批，Run 等待并在决策后恢复原会话 | API 测试覆盖首个决定生效、原会话恢复和新 Capability | Passed |
| P9-09 | MCP 结构化结果与 Runtime 结果安全合并并进入人工验收 | 新增 `RUNTIME_RESULT_SUBMISSION_REQUIRED` 硬门禁；真实双 Runtime Run 已提交并验收 | Passed |
| P9-10 | Codex 每 Run 注入独立 MCP Capability | Codex Run `a7dea800-63ff-4357-8164-2cc5bb94e7c5` 完成 3 次 MCP 调用并提交结构化结果 | Passed |
| P9-11 | OpenWorker 使用固定 MCP 与短期 Capability | OpenWorker Run `1285be3f-e7e0-4561-bf70-8c842cd1f780` 完成同一协议；本地 MCP 精确暴露 7 个工具 | Passed |
| P9-12 | 仓库 Skills 通过官方校验并具有版本与内容 Hash | 3 个 Skill 均通过 `quick_validate.py`；Repository registry 与伪造 Hash 测试通过 | Passed |
| P9-13 | WorkSpec 固定 Skill 引用且 API/UI 可见 | migration 9、API/E2E 固定引用断言、Radar Skill 下拉和详情摘要通过 | Passed |
| P9-14 | Scheduler 保持推送式 Run，旧 Pull Worker 不复活 | 正式库仅 2 个启用 Schedule；旧机会雷达 WorkSpec 已退休且旧 Schedule 禁用 | Passed |
| P9-15 | 不存在付款、外联、发布、删除、生产部署 MCP Tool | 协议/源码清单仅含 7 个 Pilot 工具 | Passed |
| P9-16 | 全量单元/集成/类型/Lint/Build 通过 | Vitest 8 files / 93 tests；TypeScript、ESLint、全 workspace Build 通过 | Passed |
| P9-17 | Playwright 用户旅程与 MCP/Skill UI 断言通过 | Playwright 10/10，包括固定 Skill 创建与 Hash 显示 | Passed |
| P9-18 | 正式 5273/8787、Scheduler、Runtime 与 MCP 健康 | API `healthy`、2 个 Schedule、3 个 Skill、7 个 MCP Tool、Codex/OpenWorker 均 healthy | Passed |
| P9-19 | 日志、仓库和 Runtime 无真实 Token 或 Secret 泄漏 | 定向源码/日志扫描只命中字段名和测试夹具；Token 文件和 MCP 配置权限均为 `0600` | Passed |
| P9-20 | Review 无 Blocker/Critical/High 未解决项 | 见根目录 `REVIEW.md` Phase 9 记录 | Passed |

## 真实运行证据

- Codex：Run `a7dea800-63ff-4357-8164-2cc5bb94e7c5`，会话 `019fc4e9-2efc-73e3-acf0-864aa7c026ec`，结果 `PHASE9_CODEX_MCP_OK`。
- OpenWorker：Run `1285be3f-e7e0-4561-bf70-8c842cd1f780`，会话 `personal-os-v2-1285be3f-e7e0-4561-bf70-8c842cd1f780`，结果 `PHASE9_OPENWORKER_MCP_OK`。
- 两个 Run 均持久化进度事件、结构化结果和人工验收；测试 WorkSpec 随后退休，未污染 Radar 首页。

## 最终门禁

| Gate | Result |
|---|---|
| Unit / integration | 8 files, 93/93 |
| Browser | 10/10 |
| TypeScript / ESLint / Build | Passed；仅保留 Vite 500 kB 性能提示 |
| MCP protocol | 官方 TypeScript SDK stdio client，7/7 tools |
| Skills | 3/3 valid |
| SQLite | migration 9；`quick_check=ok`；0 FK violations |
| Production | 5273/8787 current-only runtime；2 enabled schedules；0 pending approvals |
| Runtime E2E | Codex passed；OpenWorker passed |
| Patch hygiene | `git diff --check` passed |

结论：**Phase 9 Passed。Personal OS 现在拥有原生 v2 Agent Gateway、固定版本 Skill 和 Codex/OpenWorker 双 Runtime 回写闭环。**
