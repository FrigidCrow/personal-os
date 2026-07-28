# Personal OS

一个本地优先、面向个人技术经营者的 Web 控制台。它把项目、任务、赚钱机会、低成本实验、可复用资产和 Codex 执行记录放进同一个可审查的工作流。

MVP1 的核心不是让 AI 自动替你做所有决定，而是建立这条闭环：

```text
在 Web 创建任务
  -> 交给 Codex
  -> Web 显示执行状态和结果
  -> 人工检查改动与验证结果
  -> 人工验收后才进入 Done
```

## 当前能力

- 今日总览：焦点任务、项目组合、机会、实验、资产和 Codex 队列。
- 项目与任务：SQLite 持久化、委派模式、状态流转和验收条件。
- Codex 执行：支持确定性的 `demo` 模式和真正调用 Codex SDK 的 `live` 模式。
- 人工闸门：Codex 只能提交到 `Needs Review`，不能自行标记 `Done`。
- 机会雷达：手动生成日报，也可通过本地 cron 定时生成。
- 实验与资产：把机会转为有时间/预算上限的实验，再沉淀为低维护资产。
- 双向集成：Web 通过 Codex SDK 发起任务；Codex 通过本地 MCP 读写 Personal OS。
- 仓库 Skills：每日聚焦、机会雷达、每周复盘。
- 响应式 Web：桌面与移动端，支持浅色、深色和跟随系统主题。

## 运行要求

- Node.js 22.12 或更高版本
- npm 10 或更高版本
- 使用 `live` 模式时，需要本机 Codex 已登录

## 本地启动

```bash
git clone git@github.com:FrigidCrow/personal-os.git
cd personal-os
npm install
cp .env.example .env
npm run build
npm run dev
```

然后打开 [http://localhost:5273](http://localhost:5273)。API 默认运行在 [http://localhost:8787](http://localhost:8787)，健康检查地址是 [http://localhost:8787/api/health](http://localhost:8787/api/health)。

Server 默认只监听 `127.0.0.1`。MVP1 没有账号与鉴权，请不要把 `HOST` 改为局域网或公网地址。

第一次启动会在 `data/personal-os.db` 创建 SQLite 数据库，并写入明确标注为演示数据的样例。自定义数据库位置：

```bash
DATABASE_PATH=/absolute/path/personal-os.db npm run dev
```

## 它怎样和 Codex 交互

Personal OS 有两个方向，职责不同。

### 1. Web 调 Codex：Codex SDK

当你在任务页点击“交给 Codex”时：

1. Web 调用 `POST /api/tasks/:id/assign`。
2. Server 创建 `CodexRun`，把任务从 `Ready` 变为 `In Progress`。
3. `demo` 模式走确定性适配器；`live` 模式用 `@openai/codex-sdk` 启动或恢复 Codex thread。
4. Codex 在项目绑定的 `repositoryPath` 中工作，提示中带入任务目标、描述、验收条件和安全边界。
5. 结果、thread id、文件路径和验证摘要写回 SQLite。
6. 任务进入 `Needs Review`。只有你在审查页点击验收，任务才会进入 `Done`。

这条路径适合“我在 Web 中派活给 Codex”。API key 不会放进浏览器，也不会存进 Personal OS 数据库。

### 2. Codex 调 Personal OS：MCP

本地 MCP server 让 Codex 在对话或编码过程中主动读取和更新系统状态，例如：

- 读取今日上下文、项目和任务；
- 更新任务状态、记录运行事件、提交人工审查；
- 保存机会和日报；
- 记录实验结果和资产候选。

MCP 故意不暴露付款、购买、发消息、发布、生产部署和人工验收工具。它不能绕过 Web 的人工验收。

仓库内已经包含 `.codex/config.toml`。在 Personal OS 仓库根目录启动 Codex、信任该项目，并完成 `npm run build` 后，Codex 会启动 `personal_os` MCP server。Codex 桌面端可用 `/mcp` 检查；如果另行安装了 Codex CLI，也可以运行：

```bash
codex mcp list
```

如果你希望在其他项目的 Codex 任务中也访问同一个 Personal OS，请添加用户级 MCP 配置，并把路径替换成你的真实绝对路径：

```bash
codex mcp add personal_os -- \
  node /absolute/path/personal-os/apps/mcp/dist/index.js
```

修改 MCP 配置后重启 Codex。Codex 桌面端、CLI 和 IDE 扩展共享同一套本地配置。

### 3. Skills：告诉 Codex 什么时候、怎样用 MCP

仓库提供三个 Skills：

- `$personal-os-daily-focus`：从当前状态选出今天最多三件高杠杆事项。
- `$personal-os-opportunity-radar`：研究并保存有来源、可低成本验证的赚钱机会。
- `$personal-os-weekly-review`：按结果而不是任务数量复盘，决定继续、暂停、委派或资产化。

示例：

```text
使用 $personal-os-daily-focus，结合当前项目和 Codex 审查队列，安排我今天的工作。
```

```text
使用 $personal-os-opportunity-radar，找出今天最值得用 4 小时以内验证的收入机会。
```

## 启用真正的 Codex 执行

先检查本机认证：

```bash
codex login status
```

可以使用 ChatGPT 登录：

```bash
codex login
```

如果只有 OpenAI API key，可以把 key 放在终端环境变量中，再通过标准输入登录。不要把 key 写进仓库或前端代码：

```bash
printenv OPENAI_API_KEY | codex login --with-api-key
```

然后把 `.env` 中的模式改为：

```dotenv
CODEX_MODE=live
```

在 Web 的任务页选择 `live` 后再委派。真实执行的前提：

- 任务必须处于 `Ready`；
- 委派模式不能是 `human_only`；
- 项目的 `repositoryPath` 必须是本机真实 Git 仓库绝对路径；
- MVP1 的 live 执行禁用网络，允许在工作区写文件，approval policy 为 `never`；
- 执行结束后仍需人工检查 Git diff 和验证结果。

## 每日机会报告

Web 的“机会雷达”页可以手动生成报告。默认是演示模式，报告和机会均有显式演示标记。

开启每日定时任务：

```dotenv
DAILY_RADAR_ENABLED=true
DAILY_RADAR_CRON=0 8 * * *
PERSONAL_OS_TIMEZONE=Asia/Tokyo
CODEX_MODE=demo
```

`CODEX_MODE=live` 时，雷达会用 Codex SDK 和实时 Web 搜索生成最多五个机会，并要求每条事实包含直接来源。它只保存研究结果，不会自动做外联、购买或发布。

MVP1 的定时器运行在本地 Server 进程内，因此每日自动报告要求 `npm run dev` 或生产 Server 持续运行；电脑休眠或进程停止期间不会补跑任务。

## 数据与备份

- 结构化状态：`data/personal-os.db`
- 长文笔记：只保存 Obsidian 路径，不复制内容
- 源码与交付物：保留在各自 Git 仓库
- Codex 对话：保留 thread id 和摘要，不复制完整对话

停止服务后备份 SQLite 文件即可：

```bash
cp data/personal-os.db /your/backup/location/personal-os-$(date +%F).db
```

## 验证

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

验收标准见 `docs/MVP1-ACCEPTANCE.md`，完整执行计划见 `docs/PLAN.md`，实现记录见 `WORKLOG.md`，最终审查结论见 `REVIEW.md`。

## MVP1 安全边界

- 单用户、本地优先，没有云端账号系统。
- 没有自动付款、购买、外联、发布或生产部署。
- 机会是待验证假设，不是收入承诺。
- Demo 结果不会冒充真实 Codex 结果。
- Codex 提交只能进入人工审查，不可直接完成任务。
