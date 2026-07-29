# Personal OS 本地运行手册

## 1. 服务边界与端口

| Service | Address | Ownership |
|---|---|---|
| Personal OS Web | `http://127.0.0.1:5273` | 本项目，构建后的 Vite preview |
| Personal OS API | `http://127.0.0.1:8787` | 本项目，Hono Server |
| OpenWorker Web | `http://127.0.0.1:5274` | 独立 OpenWorker 项目 |
| OpenWorker agent server | `http://127.0.0.1:8765` | 独立 OpenWorker 项目 |

所有服务只绑定 loopback。`5173` 不属于 Personal OS，也不会被安装脚本占用。

OpenWorker 保持独立安装在 `/Users/frigidcrow/Documents/Codex/dev/openworker`。Personal OS 不复制它的源码、数据库、模型密钥或认证 Token，只通过 MCP Pull 契约交换任务和运行状态。

正常启动和 MCP 连接只迁移数据库结构，不自动生成 Demo 数据。`npm run seed` 是唯一的显式演示数据入口，不应在正式个人数据库上运行。

## 2. 开发运行

```bash
npm install
npm run dev
```

开发 Web 和 API 分别监听 `5273` 与 `8787`。开发进程不由 launchd 管理。

## 3. 构建与登录自启

### 桌面一键启动

双击桌面的 `启动 Personal OS.command` 会执行版本库中的 `scripts/start-personal-os.command`。桌面入口的可恢复副本保存在 `desktop/启动 Personal OS.command`：

1. 检查 Personal OS 与 OpenWorker 的安装路径和依赖。
2. 构建并启动 Personal OS API `8787` 与 Web `5273` 的 LaunchAgents。
3. 在独立的后台 `screen` 会话中启动 OpenWorker Server `8765`，并用 LaunchAgent 托管 Web `5274`。
4. 等待四个服务通过健康检查，然后打开两个 Web 页面。

启动器只绑定 `127.0.0.1`，会把独立 Server 的本地认证 Token 安全传给 5274 Web 进程，避免未认证健康响应导致白屏；Token 保存在 `~/.config/coworker/personal-os-8765.token`（权限 `0600`），不写入仓库或日志。由于 macOS 会阻止后台 Python 直接读取 `Documents` 中的虚拟环境，8765 使用脱离终端的 `screen` 会话，5274 仍由 launchd 保活。可以在不启动服务的情况下验证桌面入口和依赖：

```bash
zsh -n scripts/start-personal-os.command
scripts/start-personal-os.command --check
```

### 手动构建与 LaunchAgent

先构建，再预览即将写入的启动项：

```bash
npm run build
npm run launchagent:install
```

确认路径和端口后安装：

```bash
npm run launchagent:install -- --apply
npm run healthcheck
curl -fsS http://127.0.0.1:5273/ >/dev/null
```

桌面入口安装三个启动项：

- `com.frigidcrow.personal-os.api`
- `com.frigidcrow.personal-os.web`
- `com.frigidcrow.personal-os.openworker-web`

它们启用 `RunAtLoad` 与 `KeepAlive`。OpenWorker Server 位于名为 `personal-os-openworker` 的 detached screen 会话。日志写入项目的 `logs/`，不会提交到 Git。Homebrew 更新 Node 后应重新运行安装命令，使 plist 使用新的 Node 绝对路径。

查看状态或主动重启：

```bash
launchctl print gui/$(id -u)/com.frigidcrow.personal-os.api
launchctl print gui/$(id -u)/com.frigidcrow.personal-os.web
launchctl print gui/$(id -u)/com.frigidcrow.personal-os.openworker-web
screen -ls
launchctl kickstart -k gui/$(id -u)/com.frigidcrow.personal-os.api
launchctl kickstart -k gui/$(id -u)/com.frigidcrow.personal-os.web
```

卸载前先预览；只有带 `--apply` 才会停止服务并移除对应 plist：

```bash
npm run launchagent:uninstall
npm run launchagent:uninstall -- --apply
```

## 4. 健康与失败恢复

```bash
npm run healthcheck
```

健康响应验证 SQLite `quick_check`、外键、活跃运行、过期租约和待审批数量，并列出 Codex 与 OpenWorker Pull adapter 状态。

Dispatcher 每 15 秒执行一次：

- 先把过期审批按拒绝处理。
- 回收超过 2 分钟没有续租的运行。
- 在最大尝试次数内创建新的幂等重试；否则把任务标为 Blocked。
- 所有失败原因、下一次重试时间和事件都显示在 Agent 控制面。

Personal OS 的默认 worker lease 是 2 分钟。对较慢的本地 OpenWorker 模型，可通过 MCP 进程环境变量 `WORKER_LEASE_MILLISECONDS` 延长；本机使用 `600000`（10 分钟）。租约仍需通过 heartbeat 续期，过期后照常进入有限重试或 Blocked。

进程退出后 launchd 会重启它。SQLite 中的幂等键、单活跃运行约束和租约避免重启后重复执行同一个任务。

## 5. 触发器与 catch-up

- `manual`：只接受用户点击派发。
- `cron`：使用任务保存的 Cron 表达式和 IANA 时区；每次派发前推进 `nextRunAt`。
- `event`：调用 `POST /api/events`，传入稳定的 `eventId` 和 `eventName`。
- `dependency`：依赖任务通过人工验收变成 Done 后触发一次。

Cron 默认不补跑离线期间的旧周期。开启任务的 `catchUp` 后，只补跑最近一次，并立即把下一次时间推进到未来，不会逐个重放所有错过周期。

## 6. 数据备份与恢复

预览备份目标：

```bash
npm run backup -- --dry-run
```

创建 SQLite 在线备份：

```bash
npm run backup
```

默认写入 `backups/` 并保留最近 14 份。备份前执行 `quick_check`，备份目录不提交到 Git。

恢复前必须先停止 API，保留当前数据库的额外副本，然后把选定备份复制为 `data/personal-os.db`，最后重新启动 API 并运行健康检查。不要在 API 写入期间直接覆盖数据库文件。

## 7. 隐私保留

默认命令只报告将被清理的数量：

```bash
npm run privacy:cleanup
```

确认后执行：

```bash
npm run backup
npm run privacy:cleanup -- --apply
```

默认脱敏 30 天前已解决审批的 payload preview，以及 90 天前终态运行的 prompt snapshot。任务结果、状态、时间、事件和验收记录继续保留，便于审计。

## 8. OpenWorker MCP

OpenWorker 中的 `personal_os` MCP 使用构建产物：

```text
node /Users/frigidcrow/Documents/Codex/dev/personal-os/apps/mcp/dist/index.js
```

工作目录是 Personal OS 项目根目录，`DATABASE_PATH` 指向同一个 `data/personal-os.db`。实际暴露给 OpenWorker 的工具白名单为：

- `list_claimable_tasks`
- `claim_task`
- `get_execution_context`
- `heartbeat_run`
- `append_run_event`
- `request_approval`
- `get_approval_status`
- `save_artifact`
- `submit_run_result`
- `fail_run`
- `claim_due_radar`
- `save_radar_opportunity`
- `save_radar_report`
- `complete_radar_run`
- `fail_radar_run`

MCP 环境至少包含：

```text
DATABASE_PATH=/Users/frigidcrow/Documents/Codex/dev/personal-os/data/personal-os.db
WORKER_LEASE_MILLISECONDS=600000
```

OpenWorker 自动化 `Personal OS Pull Worker` 已启用，每五分钟先尝试领取一个普通任务，没有普通任务时再尝试领取到期的机会雷达。运行时 `tool_allowlist` 包含上面的十五个 Personal OS 工具以及只读的 `web_search` 与 `web_fetch`。当前使用 OpenWorker Settings 中配置的 DeepSeek 模型。普通任务仍提交到 Needs Review；雷达通过专用 claim 保存结构化机会与日报。空轮询是正常 Idle 状态，不是 Personal OS 任务失败。模型可在 OpenWorker Settings 中替换。不要把 OpenWorker Token、认证 seed 或模型密钥写入 Personal OS 仓库、日志、计划文档或 MCP 参数。

OpenWorker 的 headless automation MCP 附加与运行时 allowlist 修复记录在其独立仓库提交 `428adf4`。升级 OpenWorker 后应先运行该仓库完整测试，再验证 `/v1/mcp` 中 `personal_os` 为 connected，并执行一次无外部写操作的真实领取任务。

## 9. 已配置的每日研究

所有时间使用 `Asia/Tokyo`：

| 时间 | 自动化 | 执行器 | 结果位置 |
|---|---|---|---|
| 06:30 | 最近 24 小时 AI 新闻与 AI 新技术晨报 | OpenWorker，当前 DeepSeek 配置 + 只读 Web 搜索 | Agent 控制面的 Needs Review Run |
| 08:00 | 最小投入赚钱机会雷达 | OpenWorker，当前 DeepSeek 配置 + 只读 Web 搜索 | 机会雷达页与机会列表 |

06:30 任务为低风险只读报告，成功后进入 Needs Review，人工接受后 Run 进入 Done，定时任务定义回到 Ready 等待下一次 Cron。08:00 雷达由 Server 保存调度定义，OpenWorker 原子领取后把通过销售渠道门槛的机会和日报直接写入 SQLite。两者都不会外联、发布、购买、创建账户或登录。电脑和服务恢复后，两项自动化都只补最近一次错过的周期。
