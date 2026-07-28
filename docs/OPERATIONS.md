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

## 2. 开发运行

```bash
npm install
npm run dev
```

开发 Web 和 API 分别监听 `5273` 与 `8787`。开发进程不由 launchd 管理。

## 3. 构建与登录自启

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

安装两个启动项：

- `com.frigidcrow.personal-os.api`
- `com.frigidcrow.personal-os.web`

它们启用 `RunAtLoad` 与 `KeepAlive`。日志写入项目的 `logs/`，不会提交到 Git。Homebrew 更新 Node 后应重新运行安装命令，使 plist 使用新的 Node 绝对路径。

查看状态或主动重启：

```bash
launchctl print gui/$(id -u)/com.frigidcrow.personal-os.api
launchctl print gui/$(id -u)/com.frigidcrow.personal-os.web
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

OpenWorker 自动化 `Personal OS Pull Worker` 每五分钟尝试领取一个任务。模型未配置时应保持暂停；在 OpenWorker Settings 中配置模型后再启用。不要把 OpenWorker Token 或模型密钥写入 Personal OS 仓库、日志或 MCP 参数。
