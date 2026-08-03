# Personal OS Phase 10 工作流运营闭环计划

**状态**：Passed

**日期**：2026-08-03

**方法**：Plan → Work → Review → Test → Push

## 1. 本阶段要解决什么

Phase 9 已经让 Codex 和 OpenWorker 能通过受控 MCP 执行固定 Skill，但日常维护仍要改仓库文件、手工判断能不能运行、手工重建 WorkSpec，再逐个处理失败。

Phase 10 要把这些操作收进 Web：

`编写 Skill → 检查 → 发布版本 → 创建/升级雷达 → 运行前体检 → 定时执行 → 自动重试 → 人工验收`

系统仍然是本地单体应用。SQLite 保存结构化事实，Git 保存 Skill 原文与版本历史，Obsidian 保存长文知识，Codex/OpenWorker 只是执行器。

## 2. 范围

### 本阶段实现

1. Skill 工作台：填写名称、版本、说明和执行方法；先检查，后发布。
2. Skill 安全发布：只允许写入仓库 `.agents/skills/<name>/`；拒绝路径逃逸、同版本覆盖、并发覆盖和明显密钥。
3. 工作流体检：检查生命周期、Runtime 健康、项目/Git 前置条件、Skill 快照完整性和定时绑定。
4. 工作流升级：从旧 WorkSpec 创建一个新的不可变版本；旧版本和历史 Run 不改变。
5. 定时换绑：人工把某条 Schedule 从旧版本切到新版本，并写入 Audit。
6. 运营状态：统一显示健康、等待处理、连续失败、下次执行、最近运行和重试次数。
7. 定时失败恢复：仅对 Scheduler 创建、错误可重试、尚未达到 `maxAttempts` 的 Run 自动创建新尝试。
8. README 和简单使用说明：只描述当前真实功能。

### 本阶段不实现

- Agent 自己修改或发布 Skill；
- 自动批准高风险操作；
- 付款、购买、外联、内容发布、删除用户文件或生产部署；
- 自动把失败的定时规则静默关闭；
- 用“健康接口返回 200”替代真实运行验收；
- 新增消息队列、微服务或第三方工作流平台。

## 3. 数据与权限边界

### Skill

- 权威原文：Git 仓库 `.agents/skills`；
- WorkSpec 保存 Skill 的名称、版本、全文和 SHA-256；
- 发布新版本不会改写历史 WorkSpec；
- Web 发布要求 `expectedCurrentHash`，防止两个页面互相覆盖；
- Skill 发布是人工动作，Agent Gateway 不暴露发布工具。

### WorkSpec 与 Schedule

- WorkSpec 继续不可变；升级会创建新的 ID；
- Schedule 只通过独立的人工换绑动作切换到新 WorkSpec；
- 换绑前新 WorkSpec 必须为 active 且通过静态体检；
- 原 WorkSpec 只有在没有启用中的 Schedule 后才能退休。

### 自动重试

- 只处理 idempotency key 以 `schedule:` 开头的定时 Run；
- 只重试 Runtime 暂时不可用、超时和普通执行失败；
- 参数、权限、路径、审批拒绝和人工取消不自动重试；
- 每次重试是新的 Run，保留 `retryOfRunId` 和 attempt；
- 到达最大次数后停止，并在运营状态中显示为 degraded。

## 4. UI 设计

这是单用户本地控制台，不是营销页面。

- 设计参数：变化度 5、动效 3、信息密度 6；
- 沿用 Radix、Phosphor、graphite/signal-orange；
- 雷达首页增加紧凑的运营状态和 Skill 工作台入口；
- 详情页增加“运行体检”和“创建新版”；
- 所有写操作都有明确进行中、成功和失败反馈；
- 390px 宽度不能横向溢出；
- 不增加玻璃、渐变大图、无意义动画或新的视觉系统。

## 5. 失败与回退

- Skill 检查失败：不写文件；
- Skill 发布失败：保留旧文件，临时文件清理；
- WorkSpec 新版创建失败：旧版本和 Schedule 不变；
- Schedule 换绑失败：仍指向旧版本；
- 自动重试失败：达到上限后停止，不形成无限循环；
- 前端新增能力异常时，旧的创建、运行、审批、知识和财务 API 仍可独立使用；
- 代码回退使用 Git；业务事实不做破坏性回滚。

## 6. 自动化治理结论

**APPROVE AS PILOT**

理由：所有新增写操作都在本机、受限目录和 Core API 内；Skill 发布与 Schedule 换绑必须由人发起；自动重试有来源、错误类别和次数三重上限；高风险动作没有新增执行能力。

Pilot 限制：只用于本机单用户和现有生产 Schedule。单元、API、浏览器和真实本地运行验证已经通过；对外发布、付款和删除等高风险能力仍不在本阶段范围内。

## 7. 测试计划

1. Skill：合法检查、发布、版本/hash、同版本拒绝、并发 hash 冲突、路径和密钥拒绝；
2. WorkSpec：体检通过/失败、Skill 快照篡改检测、新版不修改旧版；
3. Schedule：换绑成功、目标无效拒绝、Audit、原规则时间不变；
4. Retry：定时可重试错误自动新建 Run、最大次数停止、手动 Run 不自动重试；
5. Operations：健康、未运行、等待、连续失败和暂停状态计算；
6. API：统一响应、Zod 校验、错误码和请求 ID；
7. UI：Skill 检查/发布、工作流体检、创建新版、Schedule 换绑、健康状态；
8. 回归：Vitest、TypeScript、ESLint、Build、Playwright；
9. 生产：5273/8787、Scheduler、SQLite、现有 Schedule、Codex/OpenWorker health；
10. 安全：Git diff、运行日志和生产数据库不包含真实 Capability/API Key。

## 8. 完成结论

Phase 10 已完成并部署。Skill 发布、工作流体检、不可变新版、定时换绑、运营状态和有限自动重试已经形成一个可操作闭环。所有写入仍经过 Core API，Schedule 不会静默切换版本，Agent 也没有获得新的高风险权限。
