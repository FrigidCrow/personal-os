# Personal OS

Personal OS 是 Codex 和 OpenWorker 上面的一层本地控制台。你可以在一个 Web 页面里管理项目、自动工作流、运行记录、成果、Obsidian 知识和投入产出。

当前只有这一套系统：

| 服务 | 地址 |
|---|---|
| Personal OS Web | `http://127.0.0.1:5273` |
| Personal OS API | `http://127.0.0.1:8787` |
| OpenWorker Web | `http://127.0.0.1:5274` |

## 现在能做什么

- 为项目绑定本地 Git 仓库和 Obsidian 路径；
- 在 Skill 工作台里检查并发布新的执行方法；
- 用 Codex、OpenWorker、本地命令或内置 Runtime 创建工作流；
- 运行前检查 Runtime、项目、Skill、定时和重试设置；
- 为工作流设置 Cron 定时；
- 创建工作流新版，并把定时规则明确换绑到新版；
- 让复杂雷达先预执行两次并通过失败演练，再由你审查并发布为专属 Skill；
- 由 Core 在 Agent 运行前后启动和清理专用本地资源，例如汽水音乐 Android 模拟器；
- 让 Codex/OpenWorker 分步骤保存检查点，失败后选择继续完成的步骤或全部重做；
- 实时查看运行、日志、审批、结果、成本和成果；
- 普通结果验收后写入 Obsidian；固定 Skill 的低风险日报成功后可以自动写入，不用每天审批；
- 定时运行遇到临时错误时有限重试，到达上限后停下等待处理；
- 搜索 Obsidian，受控创建笔记；
- 记录收入、支出、预算、预测和项目投入产出。

日常操作请直接看 [Personal OS 使用说明书](docs/USER-GUIDE.md)。部署、备份和故障处理见 [运维手册](docs/OPERATIONS.md)。

## 开发

需要 Node.js 22.12 或更高版本。

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5273`。开发环境会自动把 Web 请求转发到本地 API。

## 验证

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## 正式运行

```bash
npm run build
npm run deploy:runtime
npm run launchagent:install -- --apply
npm run healthcheck
```

也可以双击桌面的 `启动 Personal OS.command`。它会检查 Personal OS 和 OpenWorker，并打开 Web 页面。

## 数据放在哪里

- 结构化业务数据：`~/.local/share/personal-os-v2/data/personal-os-v2.db`
- 正式运行文件：`~/.local/share/personal-os-v2/runtime/current`
- Skill 原文：仓库 `.agents/skills`
- 长文知识：你的 Obsidian Vault
- 代码与交付物：各项目 Git 仓库

SQLite 是业务状态的唯一事实源。Obsidian 保存 Markdown 原文，Git 保存代码和 Skill 历史。不要把数据库、密钥、运行日志或下载的音频提交到 Git。

## Codex 和 OpenWorker 怎么接入

工作流启动后，Personal OS 会为本次 Run 发一个短期权限。Codex 或 OpenWorker 只能通过 8 个受控 MCP 工具读取上下文、保存可恢复步骤、上报进度、搜索知识、登记仓库成果、请求审批、读取审批状态和提交结构化结果。

Agent 不能通过这套 MCP 直接付款、联系客户、发布内容、删除文件或部署生产环境。高风险动作仍需人工决定。

当前汽水音乐雷达已绑定 `qishui-daily-sync@1.0.1`，每天 `09:00`（`Asia/Tokyo`）由 Core 启动专用模拟器，Codex 视觉采集热歌榜和新歌榜各 Top10，生成差分、曲库、Obsidian 日报与中文原创实验，再自动关闭模拟器。音频仍按真实能力单独验收；应用私有或受保护文件不会被伪装为可分析音频。

当前恢复、自动沉淀和晋级门禁见 [阶段 11](docs/PERSONAL-OS-PHASE11-RECOVERABLE-WORKFLOWS-SPEC.md)、[阶段 11.1](docs/PERSONAL-OS-PHASE11-1-AUTOMATIC-DEPOSITION-SPEC.md) 与 [阶段 12](docs/PERSONAL-OS-PHASE12-REHEARSAL-TO-SKILL-SPEC.md)。
