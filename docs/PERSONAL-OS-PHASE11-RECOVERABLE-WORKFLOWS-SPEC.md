# Personal OS Phase 11 可恢复工作流与成果沉淀计划

**状态**：Passed and deployed

**日期**：2026-08-03

**方法**：Plan → Work → Review → Test

## 1. 本阶段目标

Phase 10 已经能安全维护 Skill、工作流版本和定时规则。Phase 11 要解决复杂任务失败后重复劳动、过程不可见，以及成功结果没有稳定进入 Obsidian 的问题。

目标闭环：

`触发 Run → 分步骤保存检查点 → 失败后复用已完成步骤 → 提交结构化结果 → 人工验收 → 受控写入 Obsidian → 登记成果`

## 2. 自动化治理结论

**APPROVE AS PILOT**

- 时间收益：日报、机会调研和榜单采集会反复执行，复用检查点能直接减少重复工作；
- 数据风险：检查点和报告属于业务记录，必须可追溯且不能静默覆盖；
- 外部依赖：Codex、OpenWorker、Obsidian 和采集来源都可能暂时不可用；
- 扩展性：一人本地系统不需要消息队列，但必须保证幂等、有限重试和人工恢复。

Pilot 只允许写入已登记 Vault 的 `Generated` 或 `Reports`。付款、外联、内容发布、任意文件覆盖和删除仍然禁止。

## 3. 实现范围

### 检查点

- Agent Gateway 增加 `save_checkpoint`；
- 每个检查点包含稳定步骤键、名称、状态、摘要和受控结构化数据；
- 同一个 Run 的步骤键唯一；完成后的检查点不能降级或改写；
- 重试默认复制已完成检查点为 `reused`，重新执行必须由用户明确选择；
- 新 Runtime 上下文包含已复用检查点，并要求先验证再跳过对应步骤。

### 成果沉淀

- WorkSpec 可固定一个 Obsidian 沉淀策略；
- 只在人工验收通过后执行；
- 使用确定性标题和 Run 关系防止重复笔记；
- 成功后同时建立 KnowledgeDocument、Run 关系和 Obsidian Artifact；
- 文件或索引失败会留下 `failed` 记录，允许人工重试，不撤销已经完成的验收。

### UI

- 运行详情显示步骤时间线、完成/失败/复用状态；
- 重试时可以选择“继续已完成步骤”或“全部重做”；
- 显示 Obsidian 沉淀状态、文件位置和重试入口；
- “今天”收集沉淀失败，避免成功 Run 的后处理故障被隐藏。

## 4. 权威与失败语义

- SQLite：检查点、沉淀状态和业务关系的唯一事实源；
- Obsidian：Markdown 原文；
- Git：Skill 原文与代码；
- Runtime：只报告过程和结果，不拥有长期事实。

失败规则：

1. Runtime 失败不会删除检查点；
2. 恢复只复制 `completed` 或 `reused`；
3. 完成检查点再次提交相同内容返回原记录，不同内容返回冲突；
4. Obsidian 写入失败不会把 Run 改回失败，但必须进入“今天”；
5. 同一个 Run 最多生成一份沉淀记录和一篇结果笔记；
6. 没有登记 Vault 时不能保存沉淀策略；路径不可写会在体检中失败，若运行期间才失效则必须留下可重试故障。

## 5. 测试门禁

1. Migration 11 可从旧库升级并幂等执行；
2. 检查点创建、更新、完成锁定、脱敏和越权拒绝；
3. 默认重试复用完成步骤，全部重做不复制；
4. Runtime 上下文和 Prompt 包含恢复信息；
5. 人工验收后只生成一篇受控笔记和一个 Artifact；
6. 重复验收/重试沉淀幂等；
7. Vault 缺失、文件冲突和写入错误保留失败记录；
8. API 统一响应、Capability Scope 和错误码正确；
9. UI 能查看步骤、选择恢复方式、查看和重试沉淀；
10. 390px 无横向溢出，亮色、暗色和 reduced-motion 不回退；
11. Vitest、TypeScript、ESLint、Build、Playwright 和 `git diff --check` 全部通过；
12. 正式数据库 `quick_check=ok`，API、Web、Scheduler 和 Runtime 健康。

## 6. 回退

- 代码使用 Git 回退；
- Migration 11 只新增表和可空列，不改写历史 Run；
- 关闭 WorkSpec 沉淀策略即可停止新笔记；
- 已生成笔记不自动删除，避免破坏用户知识；
- Agent Gateway 新工具移除后，旧七个工具仍可继续工作。
