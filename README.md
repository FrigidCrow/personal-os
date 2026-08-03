# Personal OS

Personal OS 是一个本地优先的个人业务控制面。Web 负责观察与下达意图，Core API 统一保存任务、运行、审批、资产、财务、知识索引和定时计划；Codex 与 OpenWorker 是可替换的执行器。

当前仓库只有一套可运行系统：

- Web：`apps/web-v2`，正式端口 `5273`
- API：`apps/api-v2`，正式端口 `8787`
- 领域与应用层：`packages/vnext-domain`、`packages/vnext-application`
- 基础设施：`packages/vnext-infrastructure`
- 数据库：`~/.local/share/personal-os-v2/data/personal-os-v2.db`
- 生产运行时：`~/.local/share/personal-os-v2/runtime/current`
- Agent Gateway：`apps/mcp-v2`，由 Codex/OpenWorker 通过每 Run 短期 Capability 调用
- 版本化 Skills：`.agents/skills`，WorkSpec 固定版本、内容和 SHA-256

旧 API、旧 Web、旧数据库、旧 MCP、旧切换/回滚工具和 OpenWorker v1 拉取任务已退出运行链路。历史 Markdown 文档仅用于审计，不能作为启动说明。

## 开发

要求 Node.js 22.12 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5273`。开发服务器代理到本地 API。

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

双击桌面启动器时，`scripts/start-personal-os.command` 会同时检查并启动 Personal OS 与 OpenWorker。运维细节见 [`docs/OPERATIONS.md`](docs/OPERATIONS.md)。

## Agent Gateway 与 Skills

Personal OS 向执行中的 Codex/OpenWorker 提供七个受控 MCP 工具：读取本次运行上下文、上报进度、搜索知识、登记仓库内产物、请求审批、读取审批状态和提交结构化结果。MCP 只连接 Loopback Core API，不直接访问 SQLite，也不提供付款、外联、发布、删除或生产部署工具。

每个 Agent Run 都会获得绑定 Run、执行器、Scope 和 TTL 的短期 Capability；进入等待态、终态或取消后即失效。Skill-bound Codex/OpenWorker Run 没有提交结构化 MCP 结果时不能标记成功。

仓库当前包含：

- `personal-os-agent-run`：受控 Agent Run 通用协议；
- `discover-china-opportunities`：中国市场赚钱机会深度调研；
- `prepare-ai-briefing`：每日 AI 新闻与新技术晨报。

协议与生产验收见 [`docs/PERSONAL-OS-PHASE9-AGENT-GATEWAY-ACCEPTANCE.md`](docs/PERSONAL-OS-PHASE9-AGENT-GATEWAY-ACCEPTANCE.md)。

## 权威边界

- SQLite 是结构化业务状态的唯一事实源。
- Obsidian 保存 Markdown 原文，数据库只保存索引与引用。
- Agent 通过 Adapter 执行，不直接拥有或静默修改业务事实。
- 高风险动作必须进入审批。
- Codex/OpenWorker 只能通过原生 v2 MCP 的短期 Capability 回写当前 Run；不能直接访问数据库。

阶段计划和验收证据见 [`docs/PLAN.md`](docs/PLAN.md)、[`WORKLOG.md`](WORKLOG.md) 和 [`REVIEW.md`](REVIEW.md)。
