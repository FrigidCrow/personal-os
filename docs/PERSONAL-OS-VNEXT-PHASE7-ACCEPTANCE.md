# Personal OS vNext Phase 7 验收记录

> 历史记录：Phase 8 已于 2026-08-02 删除本页描述的 v1 rollback generation 与只读封存运行路径；当前系统不再支持回滚到 v1。

**状态**：Passed / Production authority switched

**完成时间**：2026-08-02

**规格**：[PERSONAL-OS-VNEXT-PHASE7-SPEC.md](./PERSONAL-OS-VNEXT-PHASE7-SPEC.md)

**机器证据目录**：`~/.local/share/personal-os-v2/cutover/release-2026-08-02-phase7`

| ID | 门禁 | 直接证据 | 状态 |
|---|---|---|---|
| P7-01 | v1 最终快照完整且导入前后哈希不变 | `final-import-v4.json`、`post-cutover-verify.json`；源 SHA-256 始终为 `15d759…b343` | Passed |
| P7-02 | importer 覆盖一等实体、审批、经营记录与无损 legacy | Importer v4 测试；机会、报告、证据、预执行等进入 append-only `legacy_records`，并注册可发现 Artifact | Passed |
| P7-03 | 三次全新目标迁移 fingerprint 完全一致 | `phase7-rehearsal-v4-2026-08-02` 三份报告，均为 `cd11d69…c0d9` | Passed |
| P7-04 | 目标计数、映射、金额/分钟和路径缺失均有解释 | 所有源表 mapped count 一致；金额/分钟均守恒；19 个路径 17 个存在，2 个在切换前已缺失但记录未丢 | Passed |
| P7-05 | 三次目标库 quick check、外键与 schema 通过 | 三次 `quick_check=ok`、FK=0、schema=8、importer=4 | Passed |
| P7-06 | vNext 生产 LaunchAgent 使用 5273/8787 和 v2 DB | `final-vnext-health-after-ui-fix.json`、正式 plist；运行入口位于 `runtime/current` | Passed |
| P7-07 | 正式仅 vNext Scheduler 开启 | vNext health 为 `serviceEnabled=true`；v1 回滚 plist 为 `PERSONAL_OS_AUTOMATION_ENABLED=false` | Passed |
| P7-08 | vNext 正式 API/Web 与五区 UI 健康 | 正式 health 200；vNext Playwright 10/10 | Passed |
| P7-09 | Codex 真实只读冒烟通过 | Run `9c9cc97d-c11f-4a41-9283-3a4457434b27`，thread `019fc147-ccf4-7ee1-804b-ee0999fbacbd`，固定响应与可信 usage 持久化，Git 未变化 | Passed |
| P7-10 | OpenWorker 真实只读冒烟通过 | Run `7186c49a-b267-4fa3-b234-e5a2b9b99400`，真实 session、固定响应、事件与审计持久化 | Passed |
| P7-11 | Schedule 重启与同周期触发不重复 | `schedule-restart-verification.json`：首次 1、重启后 0、Run=1、firing=1 | Passed |
| P7-12 | 完成一次真实回滚且小于十分钟 | `rollback-timing.json`：v1 API/Web 2 秒恢复，门限 600 秒 | Passed |
| P7-13 | 回滚后重新切回 vNext 并重复健康验证 | `final-vnext-timing.json`：2 秒；最终 health 与正式进程均正常 | Passed |
| P7-14 | v1 DB、plist、旧代码和报告只读封存并有哈希清单 | 封存目录、`SHA256SUMS.json`、文件 0444/目录 0555 | Passed |
| P7-15 | Secret 不进入 Git diff、数据库、报告和 plist | `secret-scan-final.json` 与最终复扫：167 个文件，精确 Token 命中 0 | Passed |
| P7-16 | 全量 Vitest 与 vNext focused tests 通过 | 19 files / 203 tests；focused 6 files / 84 tests | Passed |
| P7-17 | vNext 与 v1 Playwright 全部通过 | vNext 10/10；v1 7/7 | Passed |
| P7-18 | Typecheck、Lint、Build、diff check 通过 | `tsc --noEmit`、`eslint .`、全部 workspace build、`git diff --check` | Passed |
| P7-19 | Phase 7 正式 Review 无阻断项 | 根目录 `REVIEW.md` Phase 7 结论；发现的 launchd 与 Run 竞态均已修复并回归 | Passed |

## 关键偏差与处理

1. 初次切换时，macOS `launchd` 从 `Documents/Codex` 启动 Node 返回 `EX_CONFIG`。代码手工运行正常，故改为生成自包含运行包到 `~/.local/share/personal-os-v2/runtime/current`，日志迁到 `~/.local/share/personal-os-v2/logs`。v1 与 vNext 使用同一受控部署边界，真实回滚不再依赖源码目录权限。
2. 全量浏览器回归发现“创建新 Run 后立即验收”可能点击前一条 Run：旧 WorkSpec 缓存尚未更新，旧治理按钮仍可操作。修复为原子写入 WorkSpec/Run cache、创建期间禁用旧治理操作，并以新 Run 标题作为 E2E 同步点。focused 与完整 10/10 均通过。
3. 两个缺失旧 Artifact 路径在最终快照前已经不存在。迁移器保留其路径、来源 ID 与 payload，Verifier 明确列出，不把它们误报为迁移删除。

## 验收结论

Phase 7 全部 19 项门禁通过。正式 `5273/8787`、v2 数据库、Scheduler 与 Runtime 记录主权已交给 vNext；v1 仅保留为显式、自动化关闭的回滚 generation，并已只读封存。
