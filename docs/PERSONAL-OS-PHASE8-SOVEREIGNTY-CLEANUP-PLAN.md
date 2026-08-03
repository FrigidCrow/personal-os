# Personal OS Phase 8 主权清理计划

**状态**：Passed

**日期**：2026-08-02

**方法**：Plan → Work → Review → Test

## 目标

Phase 7 已把正式主权切换到 vNext。Phase 8 删除所有仍可执行或写入 v1 事实的路径，使仓库、生产 Runtime、本地数据库和 OpenWorker 自动化只剩当前系统。

## 删除边界

- 删除 v1 `apps/server`、`apps/web`、`apps/mcp`；
- 删除 v1 `packages/database`、`packages/domain` 与旧 E2E；
- 删除 v1 导入、回滚、迁移演练和一次性 cutover 工具；
- 删除生产 Runtime 中 `api-v1`、`web-v1` 和历史 Runtime 副本；
- 删除 v1 本地数据库、备份、旧 MCP/OpenWorker Runtime 和 Phase 7 迁移副本；
- 导出后删除仍指向 v1 MCP 队列的 `Personal OS Pull Worker`；
- 删除仓库中指向 v1 MCP 的 `.codex/config.toml` 和旧 Skill 包；
- 删除 generation 切换，普通启动只允许当前 API/Web/SQLite/Scheduler。

历史规格、Review 和 Worklog 保留为文本审计材料，不具有运行或写入权限。外部旧资产先移动到 macOS 废纸篓，避免立即不可恢复。

## 保留边界

- `apps/api-v2`、`apps/web-v2`；
- `packages/vnext-*`；
- 当前 v2 权威数据库；
- 当前 OpenWorker 服务与 Token；
- Qishui 仓库、Obsidian Vault 和真实 Artifact；
- 当前 LaunchAgent labels 与正式 `5273/8787`；
- 历史 Markdown 文档。

## 测试计划

1. 清理前后记录 v2 数据库 SHA-256，清理过程不得改写业务事实；
2. 搜索仓库与生产 Runtime，禁止出现 v1 app/package/database/generation 路径；
3. `package-lock.json` 不得保留旧 workspace；
4. OpenWorker 自动化列表不得保留旧 Pull Worker；
5. Vitest、TypeScript、ESLint、当前 workspace build 全部通过；
6. 当前 Playwright 10 条旅程全部通过；
7. 正式 Web/API/Scheduler 和 OpenWorker 健康；
8. 桌面启动器 dry-run 只生成当前 Runtime；
9. `git diff --check` 通过。

## 下一阶段建议

Phase 9 应做“原生 v2 MCP 与 Skill 入口”：为 Codex/OpenWorker 提供只连接当前 Core API/数据库的受控工具面，重新生成每日聚焦、机会雷达和周复盘 Skill，并用真实会话验证读写、审批和审计链。完成前不恢复任何旧 MCP 自动化。

## 完成记录

- 可恢复清理目录：`~/.Trash/personal-os-retired-v1-20260802-201302`；
- 当前 Runtime 只含 `api-v2`、`web-v2`、静态服务和运行依赖；
- OpenWorker 已从当前源码重建到 `~/.local/share/personal-os-v2/openworker-runtime`，默认工作区迁到 v2 根目录；
- v2 数据库清理前后 SHA-256 均为 `2871ca…2a0`，`quick_check=ok`；
- Vitest 87/87、Playwright 10/10、TypeScript、ESLint、Build 和正式健康检查通过。
