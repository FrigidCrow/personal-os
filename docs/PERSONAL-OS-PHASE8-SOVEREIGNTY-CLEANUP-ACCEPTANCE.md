# Personal OS Phase 8 主权清理验收

**状态**：Passed

**完成时间**：2026-08-02

**可恢复清理目录**：`~/.Trash/personal-os-retired-v1-20260802-201302`

| ID | 验收项 | 直接证据 | 状态 |
|---|---|---|---|
| P8-01 | v1 应用、MCP、领域包和旧 E2E 已离开仓库 | `apps` 仅 `api-v2/web-v2`；`packages` 仅 `vnext-*`；当前 `e2e` 为 10 条新旅程 | Passed |
| P8-02 | 导入、回滚、迁移演练和 v1 generation 已删除 | `tools` 和旧脚本已移入废纸篓；`--generation=v1` 被明确拒绝 | Passed |
| P8-03 | 生产 Runtime 只含当前 API/Web | `runtime/current` 仅含 `api-v2`、`web-v2`、静态服务与依赖 | Passed |
| P8-04 | v1 数据库、旧 Runtime 和 cutover 副本已移入废纸篓 | 旧根目录、两个 previous Runtime 和 cutover archive 位于清理目录，原路径不存在 | Passed |
| P8-05 | OpenWorker 旧 Pull Worker 已导出并删除 | 定义导出为 `openworker/task-c53f71a26e.json`；`GET /v1/automations` 返回空列表 | Passed |
| P8-06 | v1 MCP 配置与旧 Skill 包已删除 | 仓库 `.codex/.agents` 已清理；OpenWorker `mcpServers={}` | Passed |
| P8-07 | v2 数据库清理前后 SHA-256 不变 | 前后均为 `2871ca4848be…2a0`；SQLite `quick_check=ok` | Passed |
| P8-08 | package-lock 与依赖图只含当前 workspace | 重新生成 lock；`npm ls --depth=0` 仅当前 7 个 workspace | Passed |
| P8-09 | 全量 Vitest、类型、Lint、Build 和 diff check 通过 | Vitest 7 files / 87 tests；TypeScript、ESLint、Build、patch hygiene 通过 | Passed |
| P8-10 | 当前 Playwright 10/10 与正式健康检查通过 | Playwright 10/10；5273/8787、Scheduler、Codex/OpenWorker health 正常 | Passed |
| P8-11 | Review 无阻断项且 Phase 9 边界已明确 | 根 `REVIEW.md` Phase 8 结论；下一阶段仅建设原生 v2 MCP + Skills | Passed |

## 验收结论

旧系统不再拥有源码、数据库、Runtime、MCP、Skill、Scheduler 或后台拉取任务。当前系统是唯一可启动和可写的 Personal OS。清理内容尚在 macOS 废纸篓中，可人工恢复，但任何正常命令都不再引用它。
