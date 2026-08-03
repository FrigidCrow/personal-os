# Personal OS vNext Phase 7 切换规格

**状态**：Completed / Production switched

**日期**：2026-08-02

**方法**：Plan → Work → Review → Test

**目标**：在可重复迁移、真实 Runtime、调度幂等和十分钟回滚都得到直接证据后，把正式入口 `5273/8787` 从 v1 切换到 vNext，并将 v1 只读封存。

## 1. 主权边界

主权只由以下三项共同决定：

1. `com.frigidcrow.personal-os.api` 指向哪一代 API；
2. `com.frigidcrow.personal-os.web` 指向哪一代 Web；
3. 唯一启用的 Scheduler 写入哪一个数据库。

只有三项同时指向 vNext，才称为“vNext 获得正式主权”。仅在 `5373/8887` 启动、完成迁移或生成新界面都不算切换。

## 2. 切换前事实

- v1 权威库：`~/.local/share/personal-os/data/personal-os.db`；
- vNext 权威库：`~/.local/share/personal-os-v2/data/personal-os-v2.db`；
- 正式入口：Web `127.0.0.1:5273`、API `127.0.0.1:8787`；
- OpenWorker 保持独立运行于 `127.0.0.1:8765`，切换 Personal OS 时不替换、不重装；
- v1 不双写 vNext；冻结后只允许最终只读快照和导入。

## 3. 阻断式门禁

任一门禁失败，都不得安装 vNext 正式 LaunchAgent：

- v1 快照 `quick_check` 非 `ok` 或存在外键错误；
- 三次全新目标库迁移的 canonical fingerprint 不一致；
- 已声明映射的源记录存在未解释丢失；
- v1 文件哈希在只读导入前后变化；
- vNext 目标库 `quick_check`、外键或 schema 版本失败；
- Codex 或 OpenWorker 真实只读冒烟失败；
- 同一 Schedule 周期可以创建两个 Run；
- 旧 Web/API 不能在十分钟内恢复；
- 旧数据库、旧 LaunchAgent 和旧代码没有可校验备份；
- 自动化测试、浏览器测试、类型检查、Lint、Build 或 `git diff --check` 失败。

## 4. 数据迁移契约

### 4.1 一等实体

- `projects` → `projects`；
- `tasks`/`radar_definitions`/固定 Skill 快照 → `work_specs`；
- `agent_runs`/`codex_runs` → `runs`；
- Run 事件 → `run_events`；
- `artifacts` → `artifacts`；
- cron Task 与雷达计划 → `schedules`；
- `approval_requests` → `approvals`；
- 可表达的经营账户/记录 → `operating_units`/`operating_entries`。

### 4.2 无损遗留记录

vNext 当前没有一等模型的旧机会、日报、证据、实验、收入资产、雷达预执行证据和无法安全转换的账本记录，写入 append-only 语义的 `legacy_records`。其中机会、日报、实验和收入资产同时注册为 `database` Artifact，使其仍可在资产与统一搜索中发现。不得为了凑目标模型而伪造财务事实。

### 4.3 演练报告

每次演练必须输出机器可读 JSON，包含：

- 源/目标路径和 SHA-256；
- 源表计数、导入/跳过/保留计数；
- 主键映射完整率；
- 金额/分钟合计；
- Artifact 路径存在率与缺失清单；
- `quick_check`、外键检查、schema 版本；
- canonical fingerprint；
- 导入前后源哈希一致性。

## 5. 正式切换流程

1. 构建 v1 与 vNext，执行全部自动化回归；
2. 创建带时间戳的切换目录，在线备份 v1/vNext 数据库、LaunchAgent 和源代码快照；
3. 暂停 v1 Web/API，从而冻结旧 Scheduler/Dispatcher；
4. 对最终 v1 快照执行只读导入，并运行迁移验证；
5. 在隔离测试端口以 Scheduler 禁用模式启动 vNext，完成 UI/API 本地验收；
6. 使用同一正式 label 把 Web/API 切换到 vNext `5273/8787`，仅 vNext Scheduler 启用；
7. 执行健康、五区页面、Codex/OpenWorker 真实只读冒烟和 Schedule 去重验证；
8. 执行一次真实回滚：恢复 v1 plist 与 v1 DB 引用，验证旧 UI/API；
9. 再次切换到 vNext，重复健康与去重验证；
10. 把 v1 数据库快照、plist 和旧代码包设为只读，生成 SHA-256 清单。

正式 Runtime 不从 `Documents/Codex` 源码目录直接启动。构建产物和必要 Node 依赖原子部署到 `~/.local/share/personal-os-v2/runtime/current`，LaunchAgent 只引用该目录；这也是 v1 回滚 generation 的运行边界。

## 6. 回滚契约

回滚必须是显式 generation 切换，不依赖手工改 plist：

```text
停止 vNext label
→ 恢复切换前 v1 plist
→ 确认 v1 DATABASE_PATH
→ 启动 v1 API/Web
→ /api/health 与 5273 首页通过
→ 导出切换窗口内 vNext 新增事实，等待人工合并
```

演练计时从停止 vNext 开始，到旧 `/api/health` 和首页同时成功结束，必须小于十分钟。

## 7. Scheduler 独占

- 并行验收端口的 vNext API 必须显式设置 `PERSONAL_OS_V2_SCHEDULER_ENABLED=false`；
- 正式 vNext LaunchAgent 必须显式设置为 `true`；
- v1 与 vNext API 不得同时以 Scheduler enabled 运行；
- 同一 `schedule_id + scheduled_for` 由 `schedule_firings` 唯一约束；
- 重启前后比较 schedule firing 和 Run 数量，重复即阻断。

## 8. 真实 Runtime 冒烟

冒烟只允许只读、小输入、无外部发布：

- Codex：读取仓库内指定文档并返回固定事实，不写工作区；
- OpenWorker：读取受管工作区的固定文件并返回固定事实，不调用外联、付款或发布；
- 仅健康接口成功不算 Runtime 冒烟成功；
- Runtime 输出必须回写同一套 Run/RunEvent/Artifact/Audit 数据链。

## 9. 封存边界

- 不删除 `apps/web`、`apps/server`、`apps/mcp`；
- 不删除 v1 原库或切换前备份；
- 生成旧代码压缩包、旧数据库备份、旧 plist、构建与迁移报告、SHA-256 清单；
- 封存副本设为只读；
- 活跃 LaunchAgent 只保留 vNext Web/API 与独立 OpenWorker；
- 回滚命令和封存路径写入正式报告。

## 10. 测试计划

### 10.1 先写失败测试

- importer：审批、无损 legacy、经营账本、重复导入、源只读；
- verifier：计数不匹配、外键失败、fingerprint 不同必须失败；
- LaunchAgent：v1/vNext 生成内容、端口、数据库、Scheduler 独占、无 Secret；
- API：生产 CORS、Scheduler disabled 健康状态；
- rollback：generation 恢复后健康检查与计时报告。

### 10.2 分层回归

- Vitest 全量；
- vNext focused tests；
- vNext Playwright；
- v1 Playwright；
- TypeScript、ESLint、workspace build；
- 三次生产副本迁移；
- 真实 Runtime smoke；
- 实际 LaunchAgent rollback；
- 数据库与文件封存验证。

## 11. 完成定义

只有 `PERSONAL-OS-VNEXT-PHASE7-ACCEPTANCE.md` 全部为 Passed、Review 没有阻断项、正式 `5273/8787` 运行 vNext、实际回滚成功且旧资产已只读封存，Phase 7 才完成。
