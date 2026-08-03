# Personal OS vNext 高风险重写实施计划

**状态**：Completed（MVP1 至 Phase 7 已完成；vNext 已获得正式主权）

**日期**：2026-08-01

**原则**：轻量、自建、本地优先、一人公司可维护

**方法**：Plan → Work → Review → Test，每个阶段独立验收

## 1. 决策摘要

允许重写以下核心部分：

- 数据模型与数据库迁移机制；
- Core API 与 Application Service；
- Task、Run、Log、Event、Schedule 的统一执行内核；
- Codex/OpenWorker Adapter 与 Context/Permission 管线；
- Web UI 信息架构和数据访问层；
- Obsidian 知识索引；
- 完整财务模块；
- Audit、Secret Reference、成本与 Artifact 治理。

不采用在当前线上代码中边运行边大改的方式。vNext 在同一仓库内并行建设，使用独立端口和独立数据库。只有迁移、回归、真实只读冒烟和回滚演练全部通过后，才替换当前 5273/8787 服务。

重写的目标不是照抄 Vue/FastAPI/PostgreSQL 技术栈，而是获得干净的领域模型和依赖方向。vNext 继续使用 TypeScript、React、Hono 和 SQLite，原因是：

1. 单语言栈更适合一人维护；
2. Codex SDK、OpenWorker MCP、现有 UI 与测试均为 TypeScript；
3. 当前规模不需要 PostgreSQL；
4. 重写业务内核已经足够高风险，没有必要同时承担语言和框架迁移风险。

## 2. 重写策略比较

| 方案 | 优点 | 代价 | 决策 |
|---|---|---|---|
| 当前项目原地重构 | 改动路径短 | 线上与迁移相互干扰，难回滚，旧概念持续污染新模型 | 不采用 |
| 同仓库 TypeScript vNext | 可重写核心、复用适配经验、独立测试、可一键回滚 | 切换前会暂时存在两套实现 | 采用 |
| Vue + FastAPI 全栈重写 | 与外部设计稿技术选型一致 | 两种语言、所有 Adapter 重写、维护成本最高 | 不采用 |

## 3. 不可妥协的安全边界

接受高风险重写不等于接受数据和外部行为风险：

- 当前正式 SQLite 只读迁移，重写过程不得原地修改；
- 每次迁移演练前创建 SQLite 在线备份；
- Secret 值不得进入数据库、Task、日志、Artifact、Obsidian 或 Git；
- 付款、转账、外联、发布、生产部署、删除文件和修改历史财务交易必须审批；
- 默认测试不得消耗真实 Codex/Suno/API 额度，不得发送消息或发布内容；
- 现有 Qishui Skill、Obsidian Vault、Git 仓库和外部音频目录只建立引用，不复制或删除；
- 最终切换必须有明确的十分钟内回滚路径。

## 4. vNext 核心概念

### 4.1 WorkSpec

WorkSpec 表示“要做什么”，不保存单次执行状态。

```text
WorkSpec
├─ id
├─ kind                  one_off | workflow
├─ title
├─ instructions
├─ project_id
├─ executor_policy
├─ skill_version_id
├─ context_refs
├─ input_schema
├─ output_schema
├─ approval_policy
├─ retry_policy
├─ timeout_seconds
├─ lifecycle_status      draft | active | paused | retired
├─ created_at
└─ updated_at
```

### 4.2 Run

Run 是唯一执行事实。Codex、OpenWorker、未来 Runtime 和定时任务均写入同一张表。

```text
queued
  ↓
running
  ├─ waiting_input
  ├─ waiting_approval
  ├─ succeeded
  ├─ partially_succeeded
  ├─ failed
  └─ cancelled
```

Run 保留：解析后的输入、权限过滤后的上下文、Runtime、外部会话、尝试次数、成本、错误、开始/完成时间和幂等键。

### 4.3 RunEvent

第一版使用一张 append-only 表同时承担日志与事件：

- `event_type`
- `level`
- `source`
- `message`
- `structured_data`
- `sequence`
- `request_id`
- `created_at`

SSE 只读取 RunEvent。数据量确实成为瓶颈后，再考虑拆分 Log/Event。

### 4.4 Workflow、Skill 与 Schedule

- Workflow 是可重复 WorkSpec；
- Skill 是版本化执行方法；
- Schedule 只引用一个已激活的 WorkSpec/Skill Version；
- Scheduler 到期后只创建 Run，不直接调用 Runtime；
- 编辑草稿不能静默改变已调度的 Skill 版本。

### 4.5 Artifact

Artifact 保存元数据与位置，不强制复制内容：

- `storage_kind`: managed_file | git | obsidian | external | database
- path/URI
- MIME、大小、SHA-256
- Project、WorkSpec、Run、Runtime 反向引用
- 创建来源与审计记录

Git 与 Obsidian 内容只建立索引；真正需要托管的生成物写入 `~/.local/share/personal-os-v2/artifacts/<run-id>/`。

### 4.6 Finance 与 Operating Ledger

完整财务和项目投入产出分开：

- FinanceAccount/FinanceTransaction 是个人现金事实；
- OperatingUnit/OperatingEntry 是项目或产品的经营归因；
- FinanceTransactionAllocation 将真实交易分摊到经营单元；
- FinanceCalculation 保存公式版本、输入快照、假设和结果；
- Agent 只创建 ChangeProposal，不能直接改历史交易。

金额使用最小货币单位整数。汇率使用十进制定点字符串或分数，不使用浮点数作为权威值。

## 5. 目标目录结构

```text
apps/
  web-v2/                       React Web UI，开发端口 5373
  api-v2/                       Hono HTTP/SSE，开发端口 8887
  mcp-v2/                       Codex/OpenWorker MCP transport

packages/
  contracts/                    API/MCP DTO 与 Zod Schema
  domain/
    execution/
    automation/
    projects/
    artifacts/
    knowledge/
    finance/
    approvals/
    audit/
  application/
    execution/
    scheduling/
    context/
    permissions/
    artifacts/
    knowledge/
    finance/
  infrastructure/
    sqlite/
      migrations/
      repositories/
    filesystem/
    obsidian/
    secrets/
  runtime-adapters/
    codex/
    openworker/
    shell/
    fake/
  test-support/

tools/
  migrate-v1-to-v2/
  verify-migration/
  cutover/
  rollback/
```

vNext 验收完成前，不删除现有 `apps/web`、`apps/server`、`apps/mcp` 和原数据库。

## 6. Application 执行管线

不构建动态 Hook 平台。第一版使用显式、类型安全、可测试的固定管线：

```text
CreateRun
  → ValidateInput
  → ResolveContextReferences
  → ApplyFieldPermissions
  → RedactSensitiveData
  → EvaluateApprovalPolicy
  → SelectRuntime
  → StartExecution
  → StreamRunEvents
  → CollectArtifacts
  → RecordUsageAndCost
  → ValidateOutput
  → PersistAudit
  → RequestHumanAcceptance
```

HTTP、SSE、Scheduler 和 MCP 只是 transport，全部调用同一套 Application Use Case，不能直接调用 Repository 写入业务事实。

## 7. UI 信息架构

不恢复八个一级菜单。一级导航保持五项：

| 一级区域 | 包含内容 |
|---|---|
| 今日 | 现金摘要、审批、等待输入、失败恢复、活跃 Run、今日 Schedule |
| 项目 | 目标、Git/Obsidian 上下文、Workflow、Run、Artifact、经营账本 |
| 雷达 | Workflow、Skill、预执行、Schedule、生产版本、报告 |
| 运行 | 一次性请求、Runtime、日志、重试、取消、审批、人工验收 |
| 资产 | 成果、文件、知识搜索、完整财务、投入产出 |

Runtime/Agent 状态放在页头；Schedule 在雷达和相关 Workflow 内；Approval 聚合到今日和运行；Task 不作为用户维护的 Kanban。

## 8. 数据迁移策略

### 8.1 独立数据库

- 当前正式库：`~/.local/share/personal-os/data/personal-os.db`
- vNext 开发库：`~/.local/share/personal-os-v2/data/personal-os-v2.db`
- 迁移工具只以只读模式打开当前正式库；
- 每次导入都写入 `import_runs`，保存来源文件 SHA-256、表计数、开始时间、完成时间和错误。

### 8.2 映射

| v1 | vNext |
|---|---|
| projects | projects |
| tasks | work_specs，按 one_off/workflow 重新分类 |
| radar_definitions | workflows + skill drafts |
| radar_skill_versions | skill_versions |
| agent_runs | runs |
| codex_runs | runs，作为 legacy 来源导入；停止新增 |
| agent_run_events/codex_run_events | run_events |
| radar_run_steps | run_steps |
| approval_requests | approvals |
| artifacts | artifacts |
| task cron/radar_schedule | schedules |
| opportunities/experiments/income_assets | portfolio 实体与 Artifact |
| ledger_accounts/entries/allocations | operating_units/entries/allocations |
| daily_reports | knowledge documents + report artifacts |

### 8.3 最终切换

1. 暂停旧 Scheduler 和 Dispatcher；
2. 创建最终在线备份；
3. 对旧库执行只读最终导入；
4. 验证计数、引用、状态、金额和文件路径；
5. 启动 vNext API 8887/Web 5373 做本地验收；
6. 停止旧 5273/8787 LaunchAgent；
7. 将 vNext 切换到 5273/8787；
8. 执行真实只读 Run 和 Schedule 去重检查；
9. 观察一个完整调度周期后封存旧服务。

不使用长期双写。单用户本地系统不值得承担双写一致性复杂度。

### 8.4 回滚

如果切换后出现数据、调度、Runtime 或 UI 阻断：

1. 停止 vNext；
2. 恢复旧 LaunchAgent；
3. 使用切换前旧数据库备份；
4. 将 vNext 切换期间产生的新 Run/财务输入导出为 JSON 待人工合并；
5. 回滚目标时间不超过十分钟。

## 9. 实施阶段

### Phase 0：稳定基线与可恢复快照

交付：

- 提交并推送当前通过测试的工作区；
- 备份正式数据库；
- 标记 Git tag；
- 导出当前 API、数据库表、Runtime、Schedule 和 UI 行为清单；
- 建立脱敏生产数据库 fixture；
- 建立 ADR：重写策略、技术栈、Run 唯一事实、SQLite、无双写切换。

退出条件：当前 110 项测试、7/7 E2E、构建和正式健康检查全部通过；可以从 tag 和数据库备份恢复。

### Phase 1：vNext 骨架与迁移系统

交付：

- 新工作区包与依赖方向；
- `schema_migrations` 和前向迁移 runner；
- Repository 接口与 SQLite 实现；
- 标准响应、错误码、request ID；
- Fake Clock、Fake Runtime、测试数据库工具；
- v1 → vNext 导入器骨架。

退出条件：空库、逐版本升级、重复迁移、失败迁移恢复和生产 fixture 导入测试通过。

### Phase 2：统一执行内核

MVP2 的直接实施范围冻结在 [`PERSONAL-OS-VNEXT-MVP2-AI-SPEC.md`](./PERSONAL-OS-VNEXT-MVP2-AI-SPEC.md)，逐项证据记录在 [`PERSONAL-OS-VNEXT-MVP2-ACCEPTANCE.md`](./PERSONAL-OS-VNEXT-MVP2-ACCEPTANCE.md)。本轮先完成真实 Runtime 适配与 fail-closed 等待状态；完整 Approval 恢复、成本账单和丰富 Artifact 收集仍按 Phase 3/后续治理实施，不在 Adapter 内暗中自动批准或猜测费用。

交付：

- WorkSpec、Run、RunStep、RunEvent；
- Context Reference 与字段权限；
- ExecutorAdapter 契约；
- Codex/OpenWorker/Fake Adapter；
- SSE、取消、等待输入、等待审批、重试、人工验收；
- Artifact 收集和 Runtime 成本记录。

退出条件：两种 Runtime 通过同一 Adapter 契约测试；Run 状态机不存在非法跳转；进程重启不产生重复执行。

### Phase 3：统一 Scheduler、Approval 与 Audit

Phase 3 的具体 Runtime 恢复、人工验收、Artifact、成本与安全契约冻结在 [`PERSONAL-OS-VNEXT-PHASE3-AI-SPEC.md`](./PERSONAL-OS-VNEXT-PHASE3-AI-SPEC.md)，逐项证据记录在 [`PERSONAL-OS-VNEXT-PHASE3-ACCEPTANCE.md`](./PERSONAL-OS-VNEXT-PHASE3-ACCEPTANCE.md)。Phase 3 不执行 Phase 7 的生产端口切换。

状态：2026-08-02 已通过。等待输入/审批会恢复同一 Runtime 会话；Approval、最终验收、Usage/可信成本、Git Artifact、append-only Audit、Secret 过滤和跨重启 Scheduler 均有确定性测试与真实只读冒烟证据。生产切换仍留在 Phase 7。

交付：

- schedules；
- 时区、catch-up、暂停、立即运行、幂等触发；
- Approval policy；
- append-only AuditLog；
- Secret Reference 和敏感数据过滤；
- Scheduler/Runtime 健康状态。

退出条件：跨重启同一调度周期只产生一个 Run；高风险动作不能绕过审批；审计可以重放关键决策链。

### Phase 4：Obsidian 知识模块

状态：2026-08-02 已通过。KnowledgeLink、中文检索、frontmatter 关系、受控写入、文件监听和知识工作区均通过多层测试；正式 v2 已迁移到 schema 6，生产切换仍留在 Phase 7。

交付：

- KnowledgeDocument、KnowledgeLink；
- SQLite FTS5；
- Markdown/frontmatter 解析；
- hash 增量索引、删除标记、文件监听；
- 项目/Run/Artifact 反向关联；
- `Inbox/Generated/Reports` 受控创建；
- 全局知识搜索 UI。

退出条件：中文关键词、标签、frontmatter 和实体链接搜索通过；重复索引不产生重复数据；路径越界写入被拒绝。

### Phase 5：完整财务模块

状态：2026-08-02 已在并行 vNext 环境通过 20 项直接门禁。规格与证据见 `PERSONAL-OS-VNEXT-PHASE5-SPEC.md`、`PERSONAL-OS-VNEXT-PHASE5-ACCEPTANCE.md`；未执行生产切换。

交付：

- Account、Transaction、Category、Budget；
- 月度汇总、预算偏差、现金流预测；
- Calculation formula version/input snapshot；
- 逻辑删除、冲销和修改提议；
- Transaction → Operating Unit 分摊；
- 财务 UI 与审批。

退出条件：金额精度、转账守恒、退款、外币折算、分摊去重、公式复现和审批门禁全部通过。

### Phase 6：五区 Web UI 重写

状态：2026-08-02 已通过。五区总装、统一搜索、稳定详情路由、Today 行动聚合、固定 WorkSpec/Skill 版本可见性、Schedule 编辑和完整响应式回归均完成；194/194 全量测试、10/10 vNext 浏览器旅程与 7/7 旧系统回归通过。本阶段未切换生产主权。

交付：

- 今日、项目、雷达、运行、资产；
- 统一搜索；
- Run 实时日志；
- Schedule/Skill 管理；
- 财务和知识子视图；
- Runtime 能力与成本；
- 桌面/移动、浅色/深色/系统主题、减少动效。

UI 可以从 Phase 2 开始按垂直切片同步建设，但 Phase 6 才执行完整信息架构验收。

### Phase 7：迁移、切换与封存

交付：

- 三次生产副本迁移演练；
- 最终冻结窗口；
- 端口/LaunchAgent 切换；
- 真实 Codex/OpenWorker 只读冒烟；
- Schedule 去重验证；
- 回滚演练；
- 旧代码和旧数据库只读封存。

退出条件：所有自动化与人工验收门禁通过，且完成一次真实回滚演练。

## 10. 测试计划

测试不是 Phase 7 的收尾工作。每个 Phase 都先写失败测试，再实现，再执行阶段级回归。

### 10.1 测试层级

| 层级 | 范围 | 工具/方式 | 是否阻断合并 |
|---|---|---|---|
| 静态检查 | TypeScript、依赖方向、未使用代码、Schema | `tsc`、ESLint、自定义架构规则 | 是 |
| Domain 单元测试 | 状态机、金额、权限、重试、调度规则 | Vitest 表驱动/属性测试 | 是 |
| Application 测试 | Use Case、事务边界、Hook 管线 | Fake Repository/Clock/Runtime | 是 |
| Repository 集成 | SQLite、FTS5、外键、事务、迁移 | 临时文件数据库，不只用内存库 | 是 |
| Adapter 契约 | Codex/OpenWorker/Shell/Fake 一致性 | 共享 Contract Test Suite | 是 |
| API/MCP 契约 | DTO、错误、SSE、幂等和权限 | Hono integration + MCP protocol | 是 |
| UI 组件 | 表单、状态、错误、可访问性 | Vitest + Testing Library | 是 |
| 浏览器 E2E | 用户关键闭环 | Playwright | 是 |
| 迁移验证 | v1 生产副本 → vNext | 脱敏 fixture + 校验器 | 是 |
| 故障恢复 | kill/restart/租约/限流/重复触发 | 受控故障注入 | 是 |
| Live smoke | 真实 Runtime 与本地文件 | 只读、小成本、人工监督 | 切换时阻断 |

### 10.2 Execution 必测状态

- 每个合法状态转移；
- 每个非法状态转移必须拒绝；
- waiting_input 提供输入后从原检查点继续；
- waiting_approval 批准、拒绝、过期；
- cancelled 不能再次提交结果；
- validation/test failure 不进行无意义自动重试；
- timeout、限流、临时不可用按退避策略重试；
- 相同幂等键不能创建第二个 Run；
- 进程在 queued/running/approval 状态退出后恢复；
- Runtime 上报未知成本不能记为 0，也不能覆盖已知成本。

### 10.3 Adapter 契约测试

每个 Adapter 必须通过同一套测试：

1. `validate` 返回能力缺口；
2. `start` 返回外部句柄；
3. 日志按序转换为 RunEvent；
4. 状态映射无歧义；
5. cancel 幂等；
6. timeout 可分类；
7. Artifact 与成本可以回收；
8. 高风险 Proposed Action 转成 Approval；
9. Secret 值不会进入提示、日志或结果；
10. Adapter 崩溃不会把 Run 标成成功。

真实 Codex/OpenWorker 测试只保留极小的只读 smoke；绝大多数测试使用 Fake Runtime，避免额度和网络造成随机失败。

### 10.4 Scheduler 必测场景

- Asia/Tokyo 时区和夏令时边界；
- 服务停机后的 catch-up 开/关；
- 同一周期跨重启只触发一次；
- 手动 run-now 不改变下一个正常周期；
- pause/resume；
- Skill 新草稿不能改变已绑定版本；
- Scheduler 只创建 Run，不直接调用 Runtime；
- 错过多个周期时只按配置补一次，不形成任务风暴。

### 10.5 Finance 必测不变量

- 金额从不使用二进制浮点作为权威；
- 收入、支出、退款、调整的正负方向一致；
- transfer 两边金额守恒且不计收入/支出；
- 逻辑删除不改变历史审计可见性；
- 修改历史交易产生 proposal/audit，不静默覆盖；
- 预计收入不进入实际现金；
- 预算与实际区分；
- 分摊总额严格等于源交易，不重复统计；
- 外币必须保存原币、汇率快照和本位币金额；
- 相同 input snapshot + formula version 得到完全相同结果；
- 零投入 ROI 不显示无穷；
- 月末、闰年和跨时区归属正确。

Finance 使用 golden fixtures 覆盖至少：纯人民币、纯日元、人民币/日元混合、退款、转账、应收、应付、共享订阅和项目分摊。

### 10.6 Knowledge 必测场景

- Markdown/frontmatter 正常与畸形输入；
- 中文、英文、标签和路径搜索；
- 文件修改后的增量更新；
- 重复事件幂等；
- 文件删除转为 deleted_at；
- wiki link/实体引用；
- 软链接和路径越界；
- 大文件、二进制文件和编码异常；
- 受控写入只能进入允许目录；
- 索引失败不能修改原始 Obsidian 文件。

### 10.7 Artifact/File 必测场景

- SHA-256、大小和 MIME；
- 同一 Run 重复注册幂等；
- Git/Obsidian/external 不被复制；
- managed_file 原子写入；
- 路径遍历、符号链接越界和无权限目录；
- 删除操作必须审批并保留 Audit；
- 音频等大文件不会进入 Git。

### 10.8 Security 必测场景

- 浏览器不能直接调用 Runtime；
- Agent 权限小于用户权限；
- 财务写入、文件删除、外联、付款、生产部署无法绕过 Approval；
- API Key、Token、完整账号和密码会被日志过滤；
- SecretReference 只能解析已允许的名称；
- 请求输入、MCP 输入和 frontmatter 全部做 Schema 校验；
- localhost 绑定与无鉴权边界在启动时明确检查；
- 审批重放、重复提交和过期审批被拒绝。

### 10.9 数据迁移测试

每次迁移演练必须输出机器可读报告：

- 每张表源记录数、目标记录数和跳过原因；
- Project/Run/Artifact/Approval/Schedule 外键完整率；
- 所有金额字段合计与分币级差异；
- Run 状态映射清单；
- 文件路径存在率与允许的缺失原因；
- 原始记录 ID → vNext ID 映射；
- 重复执行导入器不产生重复数据；
- 迁移失败时目标事务回滚；
- 导入器不能写入源数据库；
- `PRAGMA quick_check` 和 foreign key check 通过。

必须使用三类 fixture：最小构造库、完整测试库、脱敏正式库副本。

### 10.10 浏览器关键旅程

1. 创建一次性工作并自动路由 Codex；
2. OpenWorker 领取、心跳、提交、人工验收；
3. Run 等待输入后继续；
4. 高风险动作审批、拒绝和过期；
5. 失败 Run 从检查点重试；
6. Workflow 预执行、Skill 固化、绑定 Schedule；
7. 服务重启后 Schedule 不重复；
8. Artifact 注册、预览、下载和反向追踪；
9. Obsidian 修改后可被搜索；
10. 新建交易、月度汇总、预测、修改提议和审计；
11. 项目经营账本引用真实交易分摊；
12. Qishui Radar 前置检查和步骤恢复，不执行受保护音频绕过；
13. 浅色、深色、系统主题和减少动效；
14. 390px 移动端无横向溢出；
15. `/tasks`、旧 Run 和旧 Artifact 链接兼容跳转。

### 10.11 故障与恢复测试

- API 在事务提交前/后被 kill；
- Scheduler 在创建 Run 前/后被 kill；
- OpenWorker 领取后不再 heartbeat；
- SSE 中断和重连；
- SQLite busy/磁盘空间不足/只读文件系统；
- Obsidian 文件在索引时被移动；
- Artifact 写到一半进程退出；
- Codex/OpenWorker 返回非法 Schema；
- 迁移导入中断后重新执行；
- vNext 切换失败后十分钟内恢复旧服务。

### 10.12 性能与容量基线

单机目标不是极限吞吐，而是可预测：

- 10,000 Runs、100,000 RunEvents 下，运行列表首屏 API 小于 500ms；
- 10,000 KnowledgeDocument 下，关键词搜索小于 500ms；
- 100,000 FinanceTransaction 下，单月汇总小于 500ms；
- Dashboard 本地首屏数据小于 1 秒；
- SSE 重连后不丢失已持久化事件；
- 数据库备份和迁移不会把源库损坏。

性能测试在 CI 使用固定硬件很难稳定，因此以本机基线报告和明显回归阈值为主。

## 11. 每阶段质量门禁

每个 Phase 完成前必须同时满足：

1. 该阶段验收条目全部有直接证据；
2. 新 Domain/Application 分支覆盖率不低于 90%，项目总体不低于 80%；
3. TypeScript、Lint、Build 通过；
4. SQLite quick check、外键和迁移幂等通过；
5. 受影响的 API/MCP 契约测试通过；
6. 受影响的 Playwright 关键旅程通过；
7. 没有真实 Secret、付费动作或外部写入出现在测试产物；
8. `git diff --check` 通过；
9. WORKLOG 记录实际命令和偏差；
10. REVIEW 记录发现、修复、遗留风险和回滚方式。

覆盖率不是成功的替代品。金额守恒、幂等、审批不可绕过、迁移不丢数据和重启不重复执行属于必须通过的不变量。

## 12. 最终发布门禁

以下任一项失败，禁止替换当前生产服务：

- 脱敏正式库三次迁移结果不一致；
- Project、Run、Artifact、Schedule、Ledger/Finance 数据计数或金额不一致；
- 存在没有解释的丢失记录；
- Codex 或 OpenWorker 契约不通过；
- Schedule 在重启后重复执行；
- 高风险动作可以绕过 Approval；
- Obsidian 原文被索引器意外改写；
- 财务计算无法用 formula version + input snapshot 复现；
- 关键 E2E、移动布局或主题失败；
- 回滚演练超过十分钟或不能恢复旧 UI/API。

## 13. 明确删除或不迁移的内容

最终切换后，经人工核对可删除：

- 旧 `codex_runs` 写路径和 `/api/codex/runs` 独立实现；
- 不可到达的 TasksPage/ExperimentsPage 旧 UI；
- 专用 `radar_schedule` 单例调度代码；
- `PersonalOsDatabase` 巨型类；
- 分散在 route/MCP 中的业务校验；
- 旧 demo seed 对生产启动的任何隐式影响；
- 已被 vNext E2E 替代的脆弱实现细节测试。

不会删除：旧数据库备份、Obsidian 文件、Git 项目、Qishui 外部数据、Run 审计、Artifact 路径和人工审批记录。

## 14. 推荐立即执行的第一批工作

第一批只做 Phase 0 和 Phase 1：

1. 提交当前通过 110 项测试的控制层版本；
2. 备份正式数据库并生成脱敏 fixture；
3. 创建 vNext workspace、迁移 runner、Fake Runtime 和测试工具；
4. 写 WorkSpec/Run/RunEvent 状态机测试；
5. 写 v1 → vNext 数据映射的失败测试；
6. 建立 vNext API health 和第一个纵向切片：创建 Run → Fake Runtime → SSE → 完成；
7. 不接真实 Codex/OpenWorker，不修改现有 5273/8787。

当这个最小纵向切片和迁移测试通过后，再接 Codex/OpenWorker。这样可以判断新架构是否真的比旧系统更清楚，而不是先迁入所有历史复杂度。

## 15. MVP1 实施结果（2026-08-01）

MVP1 已按独立 Web `5373`、API `8887` 和 SQLite v2 数据库落地。统一 WorkSpec/Run/RunEvent、Schedule、Artifact、Knowledge、Finance 与 Audit 主链路已完成，Internal/Process Executor 可真实运行，Codex/OpenWorker 保留为明确不可用的 Adapter 槽位，不以 Fake 结果冒充外部 Runtime。

v1 只读导入器已在正式旧库上完成演练和版本 2 补迁移。当前 v2 数据库包含 4 个 WorkSpec、12 个历史 Run、21 个 Artifact，以及真实迁移的 AI 晨报 06:30 和机会雷达 08:00 两条日程；两个 Radar 定义及其 Skill 内容也已保留。源库 SHA-256 在导入后保持不变。

MVP1 的逐项结论和测试证据见 [PERSONAL-OS-VNEXT-MVP1-ACCEPTANCE.md](PERSONAL-OS-VNEXT-MVP1-ACCEPTANCE.md) 与根目录 `REVIEW.md`。

## 16. Phase 7 实施结果（2026-08-02）

三次全新目标迁移使用同一正式 v1 在线快照，canonical fingerprint 均为 `cd11d69a45964d35a279b6bcddc5097d3cbdbf33a7e388f5fe6ac6a34736c0d9`。正式导入为 schema 8 / importer 4，所有声明映射计数一致；19 条旧 Artifact 路径中 17 条存在，2 条在切换前已经缺失，其数据库记录和 legacy 引用仍完整保留。

生产运行包已迁移到 `~/.local/share/personal-os-v2/runtime/current`，解决 macOS `launchd` 从 `Documents` 启动时的 `EX_CONFIG`。正式 Web/API、v2 数据库和唯一 Scheduler 已切换到 vNext；Codex 与 OpenWorker 均通过正式 API 创建真实 Run、Runtime session、事件、审计和人工验收记录。调度重启验证为首次 1 个 Run、重启后 0 个、同一 firing 总数 1。

真实 v1 回滚和再次切回 vNext 均在 2 秒内健康。v1 回滚自动化被强制禁用。旧数据库、旧 plist、旧源码和全部机器报告封存在 `~/.local/share/personal-os-v2/cutover/release-2026-08-02-phase7` 并只读加密哈希清单。逐项证据见 [PERSONAL-OS-VNEXT-PHASE7-ACCEPTANCE.md](PERSONAL-OS-VNEXT-PHASE7-ACCEPTANCE.md)。
