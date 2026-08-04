# Personal OS Phase 13 生产自动化运营中心设计

**状态**：Passed and deployed

**日期**：2026-08-04

**方法**：Plan -> Work -> Review -> Test

## 1. 本阶段要解决什么

Personal OS 已经能定时调用 Codex 和 OpenWorker，也能保存 Run、检查点、成果与 Obsidian 沉淀。但雷达首页目前只显示一个粗略健康状态，无法直接回答这些日常问题：

1. 计划时间到后，调度器真的触发了吗？
2. Mac 睡眠或服务重启导致错过时，是补跑、跳过还是启动失败？
3. 当前运行到哪一步，最近一次成功是什么时候？
4. 报告最终写到了哪个 Obsidian 路径？
5. 最近一次用了多久，真实成本是否已经登记？
6. 失败属于调度、Runtime、业务、托管资源、等待人工还是知识沉淀？

Phase 13 将这些事实集中到雷达首页的生产自动化运营中心。它不是新的任务队列，也不改变 Codex/OpenWorker 的执行职责。

## 2. 范围

### 本阶段实现

1. 持久化 ScheduleOccurrence：每个应触发时间保存 `fired`、`catch_up`、`skipped` 或 `start_failed`，并记录计划时间、观察时间、当时绑定的 WorkSpec、迟到时长和关联 Run；Schedule 换绑不会改写历史归属。
2. 修正错过语义：允许补跑时最多补跑一次；不允许补跑时明确记录跳过；重复 Tick 不创建重复 Run。
3. 丰富工作流运营汇总：当前 Run/步骤、最近一次成功、最近一次调度发生、连续失败、最近沉淀、耗时和真实成本。
4. 统一失败分类：`scheduler`、`runtime`、`business`、`managed_resource`、`input_or_approval`、`deposition`。
5. 雷达首页增加紧凑运营表面，先显示需要处理的工作流，再显示正常和暂停项。
6. Today 对最新的调度跳过或启动失败给出直达雷达的提醒；已有 Run 和沉淀提醒继续保留。
7. 继续使用 WorkSpec 的 `timeoutSeconds` 与 `maxAttempts` 作为运行和重试上限，不增加无限恢复。
8. 更新 README、使用说明和运维文档。

### 本阶段不实现

- 外部短信、邮件、微信或飞书通知；
- 依据 Token 猜测费用；
- 自动修改 Cron、自动暂停 Schedule 或自动换绑 WorkSpec；
- 自动绕过登录、审批、VIP、DRM、设备或网络限制；
- Prometheus、Grafana、消息队列或新的微服务；
- 等待多个自然日后才允许代码验收。

## 3. 数据设计

现有 `schedule_firings` 升级为可读的调度发生账本：

```text
ScheduleOccurrence
├─ idempotencyKey
├─ scheduleId
├─ workSpecId
├─ scheduledFor
├─ observedAt
├─ outcome
├─ latenessMs
├─ runId
├─ errorCode
└─ errorMessage
```

规则：

- `(scheduleId, scheduledFor)` 继续唯一；
- 正常准点触发为 `fired`；
- 超过一分钟且 `catchUp=true` 为 `catch_up`；
- 超过一分钟且 `catchUp=false` 为 `skipped`；
- 已领取发生记录但无法创建 Run 为 `start_failed`；
- 手动“立即运行”不伪装成定时发生，也不改变下一次计划时间；
- 旧的 firing 迁移为 `fired`，能通过 idempotency key 找到 Run 时补上 `runId`。

## 4. 运营汇总语义

每个活动工作流返回：

- 启用中的 Schedule 数量和最近下一次触发；
- 活跃 Run 与当前最新检查点；
- 最近 Run、最近成功 Run 和连续失败次数；
- 最近调度发生与累计跳过/启动失败数量；
- 最近 Obsidian 沉淀状态和路径；
- 最近终态 Run 的耗时、已登记成本和币种；
- 失败分类与一条可执行的中文处理说明。

健康优先级：

```text
暂停 > 等待人工/运行中 > 最新调度异常 > 沉淀失败 > 连续运行失败 > 正常 > 从未运行
```

旧的调度异常如果已经被更新的成功 Run 修复，不继续把工作流标成异常。

## 5. UI 设计契约

这是高密度单人运营台，沿用现有五区信息架构，不新增主导航。

- 模式：保留式演进；
- 设计系统：Radix Themes + Phosphor；
- `DESIGN_VARIANCE=4`；
- `MOTION_INTENSITY=3`；
- `VISUAL_DENSITY=8`；
- 雷达首页先给出工作流总数、正常数、需要处理数和启用定时数；
- 运营列表显示真实数值，不做装饰性进度条和虚构百分比；
- 数字和时间使用等宽数字；
- 状态更新只使用颜色、边框和轻微 hover 反馈；
- 支持浅色、深色、系统主题和 390px 单列布局；
- 提供加载、错误、空数据和成功状态；
- 可见文案不使用装饰性长破折号。

## 6. 安全与治理

- ScheduleOccurrence 只能由 Scheduler 写入；
- Agent Gateway 不增加调度写权限；
- 错误信息经过现有敏感信息清理后保存和返回；
- 跳过与启动失败写入 Audit；
- Today 提醒只提供查看和既有恢复入口，不自动执行高风险动作；
- 成本只显示供应商账单或人工凭证记录的实际金额；
- Obsidian 路径来自受控沉淀记录，不扫描或复制正文到运营汇总。

## 7. 测试计划

### 单元与集成

1. Migration 14 保留旧 firing，增加默认 outcome 并回填关联 Run；
2. 准点触发保存 `fired` 并关联唯一 Run；
3. 重启后的迟到补跑保存 `catch_up`，只生成一个 Run；
4. 禁止补跑时保存 `skipped`，不生成 Run，并写 Audit；
5. Run 创建失败保存 `start_failed`，错误经过脱敏；
6. 重复 Tick 不重复 occurrence 或 Run；
7. 运营汇总正确选择当前步骤、最近成功、沉淀、耗时与成本；
8. 六类失败分类覆盖；新成功结果可清除已恢复的旧异常；
9. API 只返回统一响应，不暴露敏感原文。

### UI 与端到端

1. 雷达首页显示运营中心真实数据和可用详情链接；
2. 调度异常显示在 Today，并能进入对应雷达；
3. 加载、错误、空状态存在；
4. 深色、浅色和 390px 无横向溢出；
5. 既有 Skill、预执行、运行、知识和财务流程回归通过。

### 工程与生产

1. Vitest、TypeScript、ESLint、Build、Playwright 全部通过；
2. `git diff --check`、密钥扫描和音频排除检查通过；
3. 正式数据库 Migration 14、`quick_check` 和外键检查通过；
4. 正式 Web/API/Scheduler/Codex/OpenWorker 健康；
5. 正式运营接口能读取当前三个生产 Schedule，不触发额外业务运行；
6. 生产部署前创建数据库备份。

## 8. 回退

- 代码通过 Git 回退；
- Migration 14 只增加列和索引，不删除旧数据；
- 新 UI 只读取扩展汇总，旧 Schedule、Run 和沉淀 API 保持可用；
- 若运营汇总异常，调度器仍按现有 Schedule 继续运行；
- 不对正式数据库做破坏性降级。
