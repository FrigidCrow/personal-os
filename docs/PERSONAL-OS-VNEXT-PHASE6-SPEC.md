# Personal OS vNext Phase 6 五区总装规范

**状态**：Frozen for implementation

**日期**：2026-08-02

**范围**：五区信息架构、统一搜索、跨区追踪、Schedule/Skill 管理和完整响应式验收；不执行生产切换

## 1. 目标

Phase 6 不重新设计已经通过验收的页面，而是把 Phase 1–5 的能力收束为一个真正可操作的 Codex/OpenWorker 可视控制层：用户从“今天”发现需要处理的事情，在“项目”和“雷达”理解上下文与固定执行定义，在“运行”处理实时执行和治理，在“资产”追踪成果、知识与经营事实。

一级导航只保留今天、项目、雷达、运行、资产。Task 看板、独立 Approval、独立 Schedule、独立 Finance 和独立 Knowledge 不重新成为一级菜单。

## 2. 冻结决策

### 2.1 Skill 版本语义

- vNext WorkSpec 创建后没有更新或覆盖接口；其指令、Runtime、输入、重试和超时快照是不可变的。
- 一个 `kind=workflow` 且已激活的 WorkSpec 作为一个固定 Skill 版本展示。
- Schedule 继续绑定精确 `work_spec_id`，不能绑定 `latest` 或一个可编辑草稿。
- 需要改变执行方法时创建新的 WorkSpec 版本，再显式建立或修改 Schedule 绑定；Phase 6 不伪造可变“技能编辑器”。

### 2.2 统一搜索

- Core API 提供一个只读搜索用例，搜索 Project、WorkSpec、Run、Artifact 和 KnowledgeDocument。
- 每条结果返回实体类型、稳定 ID、标题、摘要、时间和可用关联 ID；路由由 Web 决定。
- 查询做长度限制、结果上限和 SQLite 参数绑定，不拼接用户 SQL。
- Web 在页头提供全局搜索，支持 `⌘K` / `Ctrl+K`、键盘选择、关闭和空/加载/错误状态。
- 结果进入稳定详情路由，不只跳到一个无法定位实体的列表页。

### 2.3 五区行为

#### 今天

- 展示本月净现金流、活跃 Run、需处理事项和已启用 Schedule。
- “需处理事项”聚合等待输入、等待审批、待人工验收和可重试失败，并直达对应 Run。
- 下一次 Schedule 和最近 Audit 保持可见。

#### 项目

- 项目卡片可打开稳定详情。
- 详情聚合 Git/Obsidian 上下文、WorkSpec、Run、Artifact 和绑定 Operating Unit 的经营摘要。
- 项目详情只引用权威事实，不复制业务数据。

#### 雷达

- Workflow 卡片可打开稳定详情。
- 详情展示固定 Skill 版本 ID、Runtime、指令、输入、超时/重试、绑定 Schedule、最近 Runs 和 Artifacts。
- Schedule 支持新建、编辑名称/Cron/时区/catch-up/启用状态、暂停、恢复和立即运行。
- 修改 Schedule 仍绑定一个明确的不可变 Workflow WorkSpec。

#### 运行

- 保留真实 SSE 日志、等待输入、审批、重试、取消、人工验收、可信成本与 Artifact。
- 支持稳定 `/runs/:id` 路由和从其他区域直接定位。
- 实际成本继续只接受供应商账单或人工凭证，不从 Token 推断。

#### 资产

- 保留成果、知识和财务三个子视图。
- Artifact 和 Knowledge 搜索结果可通过稳定路由打开并看到来源/关系。
- 财务继续使用 Phase 5 已验收的七个子视图，不在 Phase 6 改写计算或审批规则。

### 2.4 导航兼容

- `/tasks` 兼容跳到 `/runs`，不恢复 Task 看板。
- `/review` 兼容跳到 `/runs`。
- 动态 Project、Radar、Run、Artifact 和 Knowledge 路由可刷新、可从搜索进入。

## 3. 视觉与交互合同

- 延续当前 Geist、Radix Themes、Phosphor、暖中性色和单一橙色强调系统。
- 不引入第二套组件库、渐变、玻璃拟态泛滥、装饰性巨大标题或新的仪表盘卡片体系。
- 桌面优先使用索引 + 详情的密度；移动端按阅读顺序折叠，不把桌面三栏硬缩小。
- 浅色、深色、跟随系统和 `prefers-reduced-motion` 均必须通过。
- 390px 视口所有五区和搜索层均不得造成 document 横向溢出。
- 所有网络视图有加载、空、错误或保存反馈；图标只使用 Phosphor。

## 4. 安全与主权边界

- 搜索是只读用例，不能成为绕过 Application/Approval 的写入口。
- Schedule 修改写 Audit；`run-now` 仍只创建 Run，不直接调用 Runtime。
- 浏览器不读取 Runtime Token、数据库文件或任意本地文件。
- Phase 6 允许迁移 v2 schema 和改进 v2 Web/API，但不改变 5273/8787、v1 数据库、Scheduler 或 Runtime 记录主权。
- 只有 Phase 7 的重复迁移、回滚和真实 Runtime 门禁全部通过后才允许主权切换。

## 5. 测试策略

### 确定性测试

- 多实体搜索、中文搜索、结果上限、空查询和 SQL 特殊字符。
- Schedule 编辑、重新计算 next run、停用状态、Audit 和原 WorkSpec 绑定不漂移。
- Project/Radar 聚合只读事实和稳定实体关系。
- 旧兼容路径、动态详情路径和搜索结果路由。

### 浏览器测试

- `⌘K` 搜索并进入 Project、Workflow、Run、Artifact、Knowledge。
- Today 处理入口进入正确 Run。
- Radar 编辑 Schedule 后刷新仍保留，并立即运行形成 Run。
- 五区桌面/390px 移动无溢出；浅色、深色、系统主题和减少动效。
- 关键页面加载、空和错误状态；无未处理浏览器异常。

### 回归

- Phase 1–5 focused tests。
- 全仓 unit/integration、TypeScript、ESLint、workspace build。
- vNext 和旧系统 Playwright 全量回归。
- SQLite `quick_check`、foreign key check、v1 哈希与无主权切换证明。

## 6. 退出条件

`PERSONAL-OS-VNEXT-PHASE6-ACCEPTANCE.md` 所有门禁通过，正式 Review 无阻断项，且旧系统仍可独立启动与回滚，才可以进入 Phase 7。
