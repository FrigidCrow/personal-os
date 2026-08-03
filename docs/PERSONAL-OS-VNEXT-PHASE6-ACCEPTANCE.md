# Personal OS vNext Phase 6 验收表

**状态**：Passed

**日期**：2026-08-02

| ID | 验收项 | 直接证据 | 状态 |
|---|---|---|---|
| P6-01 | 一级导航严格保持今天、项目、雷达、运行、资产五区 | App 路由；vNext Playwright 10/10 | Passed |
| P6-02 | Today 聚合本月现金、活跃 Run、等待输入、审批、验收、失败恢复和 Schedule | Today E2E 直达待验收 Run；UI 聚合逻辑 | Passed |
| P6-03 | Project 可打开稳定详情并聚合上下文、WorkSpec、Run、Artifact 与经营摘要 | `/projects/:id`；桌面截图与浏览器旅程 | Passed |
| P6-04 | Radar 可打开固定 Skill 版本详情并显示完整执行快照 | `/radar/:id`；固定 ID/Runtime/输入/重试/超时 E2E | Passed |
| P6-05 | Schedule 可新建、编辑、暂停、恢复和立即运行，且仍绑定明确 WorkSpec | Application/API/E2E；编辑后绑定 ID 不变 | Passed |
| P6-06 | Schedule 编辑写 Audit，next run 重算且 run-now 不改变正常 next run | ScheduleService 确定性测试 | Passed |
| P6-07 | 统一搜索覆盖 Project、WorkSpec、Run、Artifact、Knowledge | 五实体 SQLite 集成测试与 `/api/v2/search` 测试 | Passed |
| P6-08 | 统一搜索支持中文、特殊字符、限制和空查询边界 | `青鸟`、`%_`、空查询与 limit 测试 | Passed |
| P6-09 | `⌘K`/`Ctrl+K` 搜索具有键盘、加载、空和错误状态 | Radix Dialog；键盘 Enter、移动关闭 E2E | Passed |
| P6-10 | 搜索结果和跨区链接进入稳定实体详情，刷新后仍定位 | Project/Radar/Run/Artifact/Knowledge 动态路由 | Passed |
| P6-11 | Run 保留 SSE、输入、审批、重试、验收、可信成本和 Artifact 治理 | vNext Run 治理回归；精确分币成本解析 | Passed |
| P6-12 | Assets 保留 Artifact、Knowledge 和 Phase 5 Finance 全部功能 | 知识与完整财务 E2E | Passed |
| P6-13 | 页头展示 Runtime/Scheduler 健康且不暴露 Secret | phase6 health；真实 OpenWorker Token diff/DB 扫描均为 0 | Passed |
| P6-14 | `/tasks` 与 `/review` 兼容进入 Runs，不恢复 Task 看板 | Playwright 兼容跳转 | Passed |
| P6-15 | 桌面与 390px 移动端五区、详情和搜索层无横向溢出 | 七路由宽度断言；Phase 6 四张截图 | Passed |
| P6-16 | 浅色、深色、系统主题和减少动效通过 | 主题循环、reduced-motion 财务旅程与视觉证据 | Passed |
| P6-17 | TypeScript、ESLint、build、全量单测、vNext 与旧系统 E2E 无回归 | 194/194；83/83 focused；10/10 vNext；7/7 old | Passed |
| P6-18 | v2 SQLite 完整，v1 哈希及生产端口/Scheduler/Runtime 主权未改变 | v2 `quick_check=ok`/0 FK；v1 SHA-256 `91f140…e6bd` | Passed |

## 验收摘要

- Phase 6 不新增数据库迁移；正式 v2 仍为 migrations 1–7，SHA-256 `66e4ed180e00f9199e451e5d5f47ed9ce2e298af719aea7c92d91a1dfab54c41`。
- 正式 v1 SHA-256 仍为 `91f140486a4082ad21f61cf355c60a8e7422130339626beae67025903ce6e6bd`。
- 视觉证据位于 `review-artifacts/phase6/`：全局搜索、Project 详情、Radar 详情和 390px 搜索层。
- Phase 6 没有启动生产切换。当前生产 LaunchAgent、端口、Scheduler 和 Runtime 记录主权未移交给 vNext。

## 阻断条件

- 搜索或详情绕过 Application/Approval 写业务事实；
- Schedule 修改导致 WorkSpec 漂移或重复触发；
- 任一 Runtime Secret 出现在 UI、日志、数据库或 Git diff；
- 五区任一核心操作只能通过隐藏旧页面完成；
- 390px document 横向溢出、主题不可读或 reduced-motion 仍播放非必要动效；
- Phase 6 提前切换 5273/8787、v1 数据库、Scheduler 或 Runtime 记录主权。
