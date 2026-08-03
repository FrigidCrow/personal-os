# Personal OS vNext Phase 4 知识模块规格

**状态**：Implementation contract frozen

**日期**：2026-08-02

## 1. 目标

Phase 4 把现有的 Obsidian 只读全文索引升级为可追踪的个人知识层。Obsidian Markdown 原文仍是知识事实源；SQLite 只保存检索索引、文件元数据和与 Project、WorkSpec、Run、Artifact 的关系，不替代 Obsidian 编辑体验。

## 2. 范围

- `KnowledgeDocument` 保留 Vault、路径、标题、正文哈希、frontmatter、标签和软删除状态。
- 新增 `KnowledgeLink`，支持 `project`、`work_spec`、`run`、`artifact` 四类实体。
- frontmatter 支持 `project_id/project_ids`、`work_spec_id/work_spec_ids`、`run_id/run_ids`、`artifact_id/artifact_ids`。
- FTS5 搜索覆盖中文标题、正文和标签；可按标签或实体关系过滤。
- 文件内容 hash 未变化时不得重复写文档；关系可以被重新校准。
- 删除 Markdown 后文档软删除，FTS 和反向关系查询立即排除该文档。
- API 启动后监听已登记 Vault 的 Markdown 变化，经去抖后自动重建该 Vault 的增量索引。
- UI 支持全局检索、笔记详情、标签、frontmatter、实体关系、Vault 状态和受控创建。

## 3. 受控写入

系统只允许在已登记 Vault 的以下一级目录创建新 Markdown：

- `Inbox`
- `Generated`
- `Reports`

文件名由标题规范化生成，不接受调用方传入路径。已存在文件不得覆盖；写入使用同目录临时文件和原子重命名。标题、正文和元数据在落盘前经过 Secret 过滤。路径越界、符号链接目录、未知 Vault 和文件冲突都必须拒绝。

## 4. 关系一致性

- frontmatter 每次索引时重新解析，旧的 `frontmatter` 来源关系先删后写。
- 只有真实存在的目标实体才能形成关系。
- 未知实体引用计入 `invalidLinks`，不会丢弃同一文档的正文索引。
- 同一文档、实体、关系和来源只能保存一次。
- 反向查询只返回未删除文档。

## 5. 监听与健康状态

- 使用 Node 本地文件监听，不增加独立队列或知识服务。
- 监听事件只负责标记 Vault 需要重建，实际索引仍走 `KnowledgeService.indexVault`。
- 同一 Vault 的密集事件合并为一次索引。
- 停服时必须关闭 watcher 和 timer。
- 健康状态暴露正在监听的 Vault 数、最近一次索引时间和脱敏后的最近错误。

## 6. UI 设计读数

- 产品语境：本地优先、单人公司的业务控制台。
- 设计模式：保留现有 Radix Themes、Phosphor、Geist、暖黑和烧橙强调色。
- 信息密度：6/10；动效强度：3/10；视觉差异度：4/10。
- 知识结果必须可点击并出现明确选中态；详情与创建是同一工作区的次级面板。
- 加载、空、错误、创建中、创建成功、索引中和监听异常都要有明确反馈。
- 390px 宽度下不得产生页面横向滚动，并尊重 `prefers-reduced-motion`。

## 7. 非目标

- 不引入向量数据库、RAG 问答或 embedding。
- 不自动改写用户已有 Markdown。
- 不开放任意路径写入、覆盖或删除。
- 不改变 5273/8787 生产服务、权威 v1 数据库或 Scheduler 主权。

## 8. 测试层级

1. Contract/Domain：schema、路径和关系键。
2. Application：解析、增量索引、无效引用、受控创建、Secret 过滤、watcher 去抖。
3. Infrastructure：Migration 6、FTS5、关系唯一性、反向查询和软删除。
4. API：搜索过滤、详情、创建、健康状态和错误码。
5. E2E：创建笔记、搜索、打开详情、看到实体关系；桌面和 390px。
6. Regression：全量单元/集成、vNext 和旧系统 E2E、typecheck、lint、build、SQLite quick/FK check。

## 9. 切换边界

Phase 4 只在并行 vNext 端口和 v2 数据库交付。通过验收不代表允许切换生产端口、卸载旧服务或删除旧知识路径。
