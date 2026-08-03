# Personal OS vNext Phase 4 验收表

**状态**：Passed（并行 vNext；未批准生产切换）

**日期**：2026-08-02

| ID | 验收项 | 直接证据 | 状态 |
|---|---|---|---|
| P4-01 | Migration 6 新增 KnowledgeLink、唯一约束和反向索引且可幂等升级 | Migration 测试；正式 v2 schema migrations 1–6 | Passed |
| P4-02 | 中文标题、正文和标签可通过 FTS5 或安全回退搜索 | SQLite 中文搜索与正文摘要测试 | Passed |
| P4-03 | frontmatter 标量和数组可关联 Project、WorkSpec、Run、Artifact | 四类真实实体关系集成测试 | Passed |
| P4-04 | 未知实体引用被计数，不阻断同一文档正文索引 | `invalidLinks=1` 且正文仍可检索的负向测试 | Passed |
| P4-05 | 重复索引不重复文档或关系，内容未变时记为 unchanged | 二次索引 `unchanged=1`、关系仍为 4 的测试 | Passed |
| P4-06 | Markdown 删除后软删除，FTS 与实体反向查询不再返回 | 删除文件后的搜索与 Artifact 反向查询测试 | Passed |
| P4-07 | 搜索支持标签、实体类型和实体 ID 过滤 | Store/API 组合过滤测试 | Passed |
| P4-08 | 笔记详情返回文档、Vault 和实体关系 | API 详情测试与 Playwright 详情面板 | Passed |
| P4-09 | 只允许在 Inbox、Generated、Reports 创建且不覆盖已有文件 | Zod 目录枚举、文件冲突 409 和原文不变测试 | Passed |
| P4-10 | 路径越界、符号链接目录和非法标题不能写入 Vault | traversal、symlink、非法标题负向测试 | Passed |
| P4-11 | 受控创建使用原子写入，并在落盘前过滤 Secret | 临时文件加 hard-link 原子发布；正文和文件名 Secret 测试 | Passed |
| P4-12 | Vault 文件变化经去抖自动更新索引，停服能释放 watcher | 真实文件事件、20ms 去抖和 watcher 释放测试 | Passed |
| P4-13 | Health 暴露监听数量、最近索引和脱敏错误 | Application/API health 测试 | Passed |
| P4-14 | 知识 UI 支持创建、搜索、选择详情、标签和实体关系 | vNext Playwright 完整知识旅程 | Passed |
| P4-15 | 390px 下无横向溢出，交互状态可读并尊重减少动效 | Playwright 宽度断言；桌面/移动审查截图 | Passed |
| P4-16 | 正式 v2 副本 Migration 6 后 quick_check/FK 通过，v1 无写入 | v2 `quick_check=ok`、0 FK；v1 SHA-256 仍为 `91f140…e6bd` | Passed |
| P4-17 | 全量单元/集成、vNext/旧系统 E2E、TypeScript、Lint、Build 通过 | 175/175；vNext 64/64；E2E 6/6 与 7/7；全部静态和构建门禁通过 | Passed |

## 阻断条件

任意路径越界、覆盖已有笔记、Secret 落盘、孤儿关系、重复关系、删除笔记仍可检索、watcher 未释放、v1 数据变化或生产端口切换都会阻断 Phase 4。

## 运维证据

- 正式 v2 数据库升级前备份：`review-artifacts/phase4/personal-os-v2-before-phase4-20260802.db`，SHA-256 `bcbcba…cf97`。
- 正式 v2 数据库已升级到 Migration 6；`PRAGMA quick_check` 为 `ok`，`PRAGMA foreign_key_check` 为 0 行。
- 正式 v2 当前没有登记 Vault、KnowledgeDocument 或 KnowledgeLink，因此迁移没有读取或改写任何真实 Obsidian 文件。
- 旧 5273/8787 服务、v1 Scheduler 主权和 v1 数据库均未切换；v1 SHA-256 在验证前后保持 `91f140486a4082ad21f61cf355c60a8e7422130339626beae67025903ce6e6bd`。
