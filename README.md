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

构建后可安装 macOS 登录自启服务：

```bash
npm run build
npm run launchagent:install -- --apply
npm run healthcheck
```

Personal OS 固定使用 Web `5273` 和 API `8787`。独立安装的 OpenWorker 使用 Web `5274` 和 agent server `8765`，不会与其他占用 `5173` 的项目冲突。启动、备份、恢复、隐私清理和 OpenWorker MCP 配置见 [`docs/OPERATIONS.md`](docs/OPERATIONS.md)。

Server 默认只监听 `127.0.0.1`。MVP1 没有账号与鉴权，请不要把 `HOST` 改为局域网或公网地址。

第一次启动会在 `data/personal-os.db` 创建一个空的 SQLite 数据库，不会自动写入演示项目或任务。只有需要体验样例时才显式执行 `npm run seed`。自定义数据库位置：

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
- 低风险、自动执行的 `business_report` 是例外：使用只读工作区与实时 Web 搜索，成功后自动保存为 Done，且不得执行外联或其他外部写入；
- 执行结束后仍需人工检查 Git diff 和验证结果。

## 每日机会报告

Web 的“机会雷达”页可以手动生成报告，也提供可持久化的每日定时设置。新数据库默认开启每天 `08:00`、`Asia/Tokyo`，并允许在页面中修改时间、时区、执行器、个人能力画像、自定义搜索提示词、暂停状态和错过后补跑策略。设置保存在 SQLite，修改后不需要重启服务。

雷达默认由 OpenWorker 使用当前 DeepSeek 配置和只读 Web 搜索跨垂直扫描，也可以显式切换到 Codex。每天最多保存三个深挖候选；每个候选必须达到 85 分，并分别具备需求、真实付费、获客渠道、可实现性和反证强证据。只有 3/3 达标才显示完全成功，0-2 个会保留诚实结果并标记为未达标。雷达只保存研究结果，不会自动做外联、购买、发布或创建账户。

定时器运行在本地 Server 进程内，因此每日自动报告要求开发 Server 或生产 LaunchAgent 持续运行。默认启用一次性 catch-up，电脑或服务恢复后只补最近一次，不连续补跑多天。

## 数据与备份

- 结构化状态：使用 `better-sqlite3` 写入本机 `data/personal-os.db`，包括项目、任务、机会、实验、收入资产、Agent Run、事件、产物路径与审批记录。
- SQLite 启用外键和 WAL 模式，让 Personal OS API 与 OpenWorker MCP 可以安全地并发读取和写入同一个数据库。
- 浏览器 LocalStorage 只保存主题偏好等界面状态，不是业务数据的真实来源；清理缓存不会删除任务，换浏览器也不会复制数据库。
- 长文笔记：只保存 Obsidian 路径，不复制内容
- 源码与交付物：保留在各自 Git 仓库
- Codex 对话：保留 thread id 和摘要，不复制完整对话
- OpenWorker 自己的自动化、会话、模型和密钥存储在它的独立状态目录中，不写入 Personal OS 数据库；两个系统只通过 MCP 交换必要的任务和运行信息。

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

MVP1 验收标准见 `docs/MVP1-ACCEPTANCE.md`，历史执行计划见 `docs/PLAN.md`，下一阶段的 Codex / OpenWorker 自动调度方案见 `docs/AUTOMATION-PLAN.md`，实现记录见 `WORKLOG.md`，最终审查结论见 `REVIEW.md`。

## MVP1 安全边界

- 单用户、本地优先，没有云端账号系统。
- 没有自动付款、购买、外联、发布或生产部署。
- 机会是待验证假设，不是收入承诺。
- Demo 结果不会冒充真实 Codex 结果。
- 一般 Codex 提交进入人工审查；唯一例外是低风险、只读、自动化的 `business_report`，它会保存结果后自动完成，仍可在 Agent Run 中审阅。
