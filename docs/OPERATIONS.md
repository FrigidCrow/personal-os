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

当前数据库 Schema 为 10。正式更新时由 API 启动过程自动执行 migration 10，为 WorkSpec 增加不可变版本链字段。

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

不要恢复旧 v1 MCP、旧数据库或旧 OpenWorker 拉取任务。Codex/OpenWorker 现在通过原生 v2 MCP、每 Run 短期 Capability 和受版本管理的 Skills 接入当前 Core API。
