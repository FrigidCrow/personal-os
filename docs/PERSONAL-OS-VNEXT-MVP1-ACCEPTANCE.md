# Personal OS vNext MVP1 验收清单

**状态**：Passed（MVP1 完成，正式端口切换仍未执行）

**日期**：2026-08-01

**实施方式**：Plan → Work → Review → Test

## 1. MVP1 的完成定义

MVP1 是一套可以在旧系统旁边独立启动、独立存储、独立测试的 Personal OS 控制层。它必须把“定义工作 → 执行 → 查看实时过程 → 失败恢复 → 定时触发 → 形成资产与账目”跑通，而不是只建立目录或空接口。

MVP1 使用：

- Web：`http://127.0.0.1:5373`
- API：`http://127.0.0.1:8887`
- 数据库：`~/.local/share/personal-os-v2/data/personal-os-v2.db`
- 旧系统端口 `5273/8787` 和旧数据库在验收期间保持不变

## 2. 范围

### 必须交付

- Project、WorkSpec、Run、RunEvent、Schedule、Artifact、KnowledgeDocument、FinanceAccount、FinanceTransaction、AuditLog 的 vNext 数据模型；
- 前向 SQLite 迁移与独立数据库；
- 统一执行状态机和 ExecutorAdapter 契约；
- Internal 与本地进程 Executor；本地进程必须支持 `python3`、`node` 和显式允许的命令，禁止 shell 字符串插值；
- 创建、启动、取消、重试和查看 Run；
- RunEvent 驱动的 SSE 实时日志；
- Schedule 的启停、立即执行、时区和同周期幂等；
- Obsidian Markdown/frontmatter 的只读增量索引和中文全文搜索；
- 财务账户、收支交易和月度汇总；
- 关键写操作的 append-only 审计；
- Today、Projects、Radar、Runs、Assets 五区 Web UI；
- v1 数据库只读导入和校验报告；
- 单元、集成、API、E2E、迁移与故障恢复测试。

### 本期明确不做

- 正式接管 `5273/8787`；
- 删除旧应用或旧数据库；
- 真实 Codex/OpenWorker/Suno 外部调用；
- 自动付款、外联、发布或生产部署；
- 完整会计、多人权限、向量数据库和分布式 Worker。

Codex/OpenWorker 在 MVP1 中以稳定的 ExecutorAdapter 契约和 Fake Adapter 完成接入准备；真实 Adapter 属于 MVP2，不能用演示结果冒充真实执行。

## 3. 验收矩阵

| ID | 验收项 | 直接证据 | 状态 |
|---|---|---|---|
| A-01 | vNext 使用独立应用、端口和数据库，旧系统可继续运行 | 5373/8887 健康检查；旧 E2E 使用 15273/18787 独立通过 | Passed |
| A-02 | 数据库迁移可从空库执行，可重复执行，失败不留下半迁移状态 | migration rollback/idempotency 测试；schema 1–4 | Passed |
| A-03 | API 输入均由共享 Zod Contract 校验，领域/应用/基础设施依赖方向清晰 | `tsc --noEmit`；API validation 测试 | Passed |
| E-01 | 用户可创建 Project 和 WorkSpec，并创建、启动 Run | API 测试与 vNext E2E 第 2 条 | Passed |
| E-02 | Run 合法状态可转换，非法转换被拒绝 | Domain 状态机测试 | Passed |
| E-03 | Internal 和本地进程 Executor 通过相同契约测试 | Runtime Adapter 测试 | Passed |
| E-04 | Shell/Python 使用 argv 启动且受可执行文件、工作目录白名单限制 | `spawn(..., shell:false)`；越界拒绝测试 | Passed |
| E-05 | stdout/stderr 和状态作为 RunEvent 持久化并通过 SSE 实时显示 | API SSE 测试与 vNext E2E 第 3 条 | Passed |
| E-06 | running Run 可取消；failed/cancelled Run 可创建新尝试重试；历史不被覆盖 | Application lifecycle 与 vNext E2E | Passed |
| E-07 | 相同幂等键不会产生第二个 Run | Repository/Application 幂等测试 | Passed |
| S-01 | Schedule 可创建、暂停、恢复和立即执行 | API 与 vNext E2E | Passed |
| S-02 | 相同时区调度周期只创建一个 Run，重启后仍可去重 | `schedule_firings` 唯一键与 Scheduler 测试 | Passed |
| K-01 | 可配置 Vault，并增量索引 Markdown、frontmatter、标签与内容 hash | Knowledge 集成测试 | Passed |
| K-02 | 中文关键词搜索可返回匹配笔记，重复索引不重复，删除文件会标记删除 | FTS5 集成测试与 vNext E2E 第 4 条 | Passed |
| F-01 | 可创建账户及 income/expense 交易，金额使用最小货币单位整数 | Finance API/集成测试；余额原子回滚测试 | Passed |
| F-02 | 月度汇总按币种返回收入、支出和净额，逻辑删除不计入汇总 | Finance 集成测试与 vNext E2E 第 4 条 | Passed |
| AU-01 | Project、WorkSpec、Run、Schedule、Knowledge 索引、Finance 写入均有审计记录 | API/Repository 审计断言 | Passed |
| M-01 | v1 导入器只读打开源库，记录来源 SHA-256、计数、错误和完成状态 | importer 测试；正式库 SHA `2f185b…246` 未变化 | Passed |
| M-02 | 重复导入同一源库不会重复创建实体 | 版本化 importer 幂等测试与正式库二次导入 | Passed |
| UI-01 | 五区导航可用，桌面与移动布局存在，支持浅色/深色/系统主题 | vNext E2E 第 1 条与深浅色人工截图 | Passed |
| UI-02 | Runs 页面可查看实时日志、错误、取消和重试结果 | vNext E2E 第 3 条 | Passed |
| UI-03 | Radar 页面管理 workflow WorkSpec 与 Schedule，不恢复任务看板 | vNext E2E 第 2 条；正式库 3 个 Workflow/2 个 Schedule | Passed |
| UI-04 | Assets 页面可搜索 Obsidian，并录入/查看财务月度汇总 | vNext E2E 第 4 条 | Passed |
| Q-01 | `test:vnext`、`typecheck`、`lint`、`build:vnext` 全部通过 | 全量 139 tests、TypeScript、ESLint、全部 workspace build | Passed |
| Q-02 | vNext 浏览器关键旅程全部通过，且测试不调用真实外部服务 | Playwright vNext 4/4 | Passed |
| Q-03 | 旧系统原有测试继续通过 | 旧 Playwright 7/7；全量 Vitest 139/139 | Passed |

## 4. 发布门禁

只有上表全部为 Passed，并且 `REVIEW.md` 记录了直接证据后，才可以称为“MVP1 重构完成”。MVP1 完成也不代表已经切换正式端口；正式切换仍需单独的数据迁移演练、真实 Runtime 只读冒烟和回滚演练。

验收结论：MVP1 通过。当前仍是并行 vNext，不执行正式端口替换，不删除旧服务，也不声称真实 Codex/OpenWorker Adapter 已完成。
