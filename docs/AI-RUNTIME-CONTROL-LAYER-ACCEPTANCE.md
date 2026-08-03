# AI Runtime 可视控制层验收清单

状态：Passed
日期：2026-07-30

## Phase 0：能力真相

- [x] 汽水 Radar 明确区分“官方离线下载成功”和“可供外部分析的本地文件”。
- [x] `protected_storage` 有客户端可见提示、下载曲库和共享目录检查证据。
- [x] 只有文件存在且 `ffprobe` 可读时才允许标记 `available`。
- [x] Radar、Skill、曲库和 Obsidian 对同一音频状态表述一致。

## Phase 1：导航与运行主线

- [x] 一级导航只有今日、项目、雷达、运行、资产五项。
- [x] 任务队列不再出现在一级导航。
- [x] `/tasks` 安全重定向到 `/runs`，不删除任何任务数据。
- [x] Agent 控制能力迁移到统一运行页面。
- [x] 运行列表覆盖 Codex 与 OpenWorker。
- [x] 今日页优先显示审批、等待输入、失败恢复和活跃运行。
- [x] 一次性工作可以从今日或项目直接发起 Run。
- [x] 用户不需要手工维护 Task Status 才能完成一次性工作。
- [x] 桌面、移动、浅色、深色、系统主题与减少动效模式通过。

## Phase 2：Runtime 能力

- [x] 页头显示 Codex/OpenWorker 实际健康状态。
- [x] Run 显示 Runtime 选择理由和备用策略。
- [x] Run 显示 Thread ID、工作目录、项目与 Skill 版本。
- [x] Run 显示统一步骤和实时事件时间线。
- [x] Capability mismatch 显示缺失能力和下一合法动作。
- [x] Runtime 工具清单来自服务端事实，不由前端伪造。
- [x] 恢复、切换 Runtime 和质量失败在视觉与状态上互不混淆。

## Phase 3：产物与记忆

- [x] 资产页可按报告、Obsidian、代码、证据、实验和收入资产筛选。
- [x] 资产页提供独立的“成果库”和“投入产出”主视图。
- [x] 用户可为 Project、Radar、收入资产、实验、Artifact 或自定义事项建立经营单元。
- [x] 经营单元显示实际投入、实际产出、净现金收益、现金 ROI、回本进度和独立的时间投入。
- [x] 预计收入和待支付成本不进入实际金额、利润或 ROI。
- [x] Runtime 金额未知时显示未知而不是 0 元；自动成本保留 Run 和计费来源。
- [x] 共享成本分摊、退款和冲销不会造成重复统计或历史静默消失。
- [x] 金额以最小货币单位保存；人民币本位币和手工外币折算通过精度测试。
- [x] 每个 Artifact 反向链接到 Project、Workflow、Run 和 Runtime。
- [x] 每笔账可反向链接到 Project、Workflow、Run、Artifact 和本地凭证。
- [x] 项目页包含运行、Workflow、产物和上下文子视图。
- [x] Obsidian 与 Git 内容只链接，不重复复制到 SQLite。
- [x] 现有实验和收入资产数据无损迁移到新的可视入口。

## 数据与安全

- [x] TasksPage 退役不删除 `tasks` 表或历史记录。
- [x] 现有 Radar 调度不产生重复 Cron。
- [x] 浏览器不能绕过 Dispatcher 直接调用 Runtime。
- [x] 高风险动作继续经过 Approval。
- [x] 数据库迁移支持旧数据库无损升级；上线前备份支持恢复到旧版本。

## 自动化验证

- [x] Domain 与数据库单元测试通过。
- [x] Server 集成测试通过。
- [x] Web 组件与关键浏览器路径通过。
- [x] TypeScript、ESLint 和生产构建通过。
- [x] `git diff --check` 通过。
- [x] Live API、Codex health、OpenWorker health 与一条真实 Run 冒烟通过。
