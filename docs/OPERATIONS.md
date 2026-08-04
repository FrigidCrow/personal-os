# Personal OS 运维手册

本手册只描述当前系统。旧版运行、迁移和回滚命令已退出支持。

## 固定地址

| 服务 | 地址 |
|---|---|
| Personal OS Web | `http://127.0.0.1:5273` |
| Personal OS API | `http://127.0.0.1:8787` |
| OpenWorker Web | `http://127.0.0.1:5274` |
| OpenWorker API | `http://127.0.0.1:8765` |

## 权威路径

| 内容 | 路径 |
|---|---|
| 业务数据库 | `~/.local/share/personal-os-v2/data/personal-os-v2.db` |
| 生产运行时 | `~/.local/share/personal-os-v2/runtime/current` |
| Skill 原文 | 仓库 `.agents/skills` |
| 日志 | `~/.local/share/personal-os-v2/logs` |
| 备份 | `~/.local/share/personal-os-v2/backups` |
| 启动状态 | `~/.local/share/personal-os-v2/control/active-runtime.json` |

不要把数据库、密钥、运行日志或用户生成物提交到 Git。

## 启动与更新

日常启动可以双击桌面上的 Personal OS 启动器。源码更新后执行：

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm run deploy:runtime
npm run launchagent:install -- --apply
npm run healthcheck
```

安装命令只会生成当前 API 和 Web 两个 LaunchAgent。若传入已废弃的 `--generation` 参数会直接拒绝执行。
`healthcheck` 会在服务刚重启时短暂重试，避免 LaunchAgent 还没监听端口就误报失败。

在这台个人机器上，安装器会自动检测 `~/Dev/qishui-music`、对应的 Obsidian 项目目录和 Python 3.12，并把 `qishui-emulator` 注册为 API 的受管资源。也可以显式覆盖：

```bash
PERSONAL_OS_ALLOWED_ROOTS="/path/to/personal-os:/path/to/qishui-music:/path/to/Obsidian/Qishui" \
PERSONAL_OS_QISHUI_EMULATOR_SCRIPT="/path/to/qishui-music/scripts/qishui_emulator.py" \
PERSONAL_OS_PYTHON_PATH="/absolute/path/to/python3" \
npm run launchagent:install -- --apply
```

这些变量只配置可信本地命令和目录，不接受 Task 输入覆盖。不要把整个 Home 目录加入允许路径。

## 检查

```bash
curl -fsS http://127.0.0.1:8787/api/v2/health
curl -fsS http://127.0.0.1:5273/
lsof -nP -iTCP:8787 -sTCP:LISTEN
lsof -nP -iTCP:5273 -sTCP:LISTEN
```

代码级验证：

```bash
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

当前数据库 Schema 为 14。正式更新时由 API 启动过程按顺序执行迁移；migration 12 增加自动日报沉淀，migration 13 增加预执行评估与候选 Skill 状态，migration 14 把 Schedule firing 升级为可追踪的调度发生账本。

执行器级验证：

```bash
npm run smoke:runtimes
npm run smoke:control-plane
```

真实执行会产生任务、运行记录和生成物；运行前确认工作目录与允许路径正确。

## 备份

```bash
npm run backup
```

备份前会执行 SQLite `quick_check`，默认保留最近 14 份。可用以下环境变量覆盖：

- `PERSONAL_OS_V2_DATABASE_PATH`
- `PERSONAL_OS_BACKUP_DIR`
- `PERSONAL_OS_BACKUP_KEEP`

## 故障定位

1. 先运行 `npm run healthcheck`。
2. 查看 `~/.local/share/personal-os-v2/logs`。
3. 用 `launchctl print gui/$(id -u)/com.frigidcrow.personal-os.api` 检查 API。
4. 用 `launchctl print gui/$(id -u)/com.frigidcrow.personal-os.web` 检查 Web。
5. 若运行时不完整，重新执行构建、部署和 LaunchAgent 安装。

定时异常先打开 Web 的“雷达”，查看“生产自动化运营”：

- `按时触发`：调度器在允许窗口内创建了 Run；
- `恢复后补跑`：服务恢复后按 `catchUp` 策略补跑一次；
- `已按策略跳过`：计划时间已错过，规则不允许补跑；
- `启动 Run 失败`：调度器领取了计划时间，但 WorkSpec 状态或 Core 前置条件阻止创建 Run。

手动“立即运行”不会写成定时发生，也不会改变下一次计划时间。不要直接修改 `schedule_firings`；它是 Scheduler 的审计事实。

不要恢复旧 v1 MCP、旧数据库或旧 OpenWorker 拉取任务。Codex/OpenWorker 现在通过原生 v2 MCP、每 Run 短期 Capability 和受版本管理的 Skills 接入当前 Core API。
