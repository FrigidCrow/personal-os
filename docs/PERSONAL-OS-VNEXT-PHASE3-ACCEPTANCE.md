# Personal OS vNext Phase 3 验收表

**状态**：Passed（并行 vNext；未批准生产切换）

**日期**：2026-08-02

| ID | 验收项 | 直接证据 | 状态 |
|---|---|---|---|
| P3-01 | waiting_input 提交回答后使用原 externalRunId 继续同一个 Run | Application 同 Run 测试；Codex `resumeThread` 与 OpenWorker `question_response` 协议测试 | Passed |
| P3-02 | waiting_approval 自动创建一个过滤后的 Pending Approval | Application/SQLite 集成测试验证单 Run 唯一 Pending Approval | Passed |
| P3-03 | 批准、拒绝与过期均 first-decision-wins，并按请求类型恢复 Runtime | Approval 重放负向测试；OpenWorker 四种原生 response 参数化测试 | Passed |
| P3-04 | API 重启保留等待态，只失败真正中断的 running Run | 文件 SQLite 关闭/重开恢复测试 | Passed |
| P3-05 | Runtime 完成后必须经过独立人工接受或拒绝 | Application/API 测试与 Playwright 人工验收旅程 | Passed |
| P3-06 | Usage 统一持久化；未知成本为 null；受信账单可幂等记录实际金额 | Codex usage、Application/API 成本来源与冲突测试 | Passed |
| P3-07 | Codex Git Artifact 自动收集，路径越界与重复注册被拒绝 | Codex file-change 映射、真实文件校验、SHA-256、去重与越界负向测试 | Passed |
| P3-08 | AuditLog 追加写且数据库拒绝更新或删除 | Migration 5 SQLite UPDATE/DELETE trigger 测试 | Passed |
| P3-09 | WorkSpec、Run、Approval、事件与 Audit 中的 Secret 均被过滤 | 跨层 Secret fixture；正式 v2 DB/仓库真实 OpenWorker Token 精确扫描 0 命中 | Passed |
| P3-10 | Schedule 跨 Store/Service 重启对同一周期只创建一个 Run | 文件数据库跨 Store/Service 重启测试 | Passed |
| P3-11 | catch-up 关闭时跳过过期周期，开启时最多补一次；run-now 不改正常周期 | Fake Clock 的开启、关闭、重启与 run-now 测试 | Passed |
| P3-12 | Health 暴露四个 Runtime、Scheduler 状态和 Pending Approval 数 | API 测试；正式 v2 DB 临时启动 health 返回 phase3/4 Executors/Scheduler/Approval | Passed |
| P3-13 | Runs UI 可回答问题、处理审批、验收结果并查看 Usage/Cost/Artifact | vNext UI 实现；Playwright 治理旅程和 390px 回归 | Passed |
| P3-14 | Migration 5 幂等，正式 v2 副本 quick_check/FK 均通过 | Migration 测试；正式 v2 迁移 1–5，`quick_check=ok`、0 FK；迁移前备份在 `review-artifacts/phase3/` | Passed |
| P3-15 | v1 权威数据库、旧服务和 5273/8787 均未切换或改写 | Phase 3 验证窗口 SHA-256 保持 `91f140…e6bd`，最新逻辑写入仍为 2026-08-01；无端口切换 | Passed |
| P3-16 | Codex/OpenWorker 现有真实只读执行无回归 | Codex `PERSONAL_OS_CODEX_SMOKE_OK`；OpenWorker 重启耗尽 FD 的旧进程后 `PERSONAL_OS_OPENWORKER_SMOKE_OK` | Passed |
| P3-17 | 全量单元/集成、vNext/旧系统 E2E、TypeScript、Lint、Build 全通过 | 170/170；vNext 单元 59/59、E2E 6/6；旧系统 E2E 7/7；TypeScript、ESLint、全构建、patch hygiene | Passed |

## 阻断条件

任何审批绕过、决定重放、等待态丢失、Secret 泄露、费用猜测、Artifact 越界、重复调度、v1 数据变化或外部写入都会阻断 Phase 3。Phase 3 Passed 仍不代表允许生产切换。

## 运维发现

首次 OpenWorker 真实冒烟失败并非 Adapter 回归：长期运行的旧 OpenWorker 进程已达到 `Too many open files`，HTTP health 仍返回 200，但无法创建本地执行器。通过 LaunchAgent 正常重启后文件描述符从 313 降至 81，真实只读冒烟通过。该现象说明 HTTP health 只能证明控制端点存活，生产切换前仍需增加 Runtime 执行级探针或上游 FD 泄漏修复。
