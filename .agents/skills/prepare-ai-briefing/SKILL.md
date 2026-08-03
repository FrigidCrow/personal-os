---
name: prepare-ai-briefing
description: Produce a sourced Chinese briefing for the previous 24 hours with separate AI news and AI technology sections. Use for scheduled Personal OS AI morning reports that require date verification, primary sources, deduplication, practical impact, and honest handling of quiet news days.
metadata:
  version: "1.0.0"
---

# AI 新闻与新技术晨报

## 流程

1. 读取 Run 时区和日期，以过去 24 小时为主窗口，明确事件发生时间与文章发布时间。
2. 优先检索公司公告、产品文档、论文、代码仓库、监管机构或作者原文；二手媒体只用于补充影响和交叉验证。
3. 去除同一事件的重复报道，区分正式发布、预告、传闻和分析。
4. 用 `append_run_event` 报告采集、核验、去重和成稿进度。

## 输出结构

### AI 新闻

公司、产品、融资、政策、产业采用等重要事件。每条包含：事实、发生/发布时间、为什么重要、对个人开发者或一人公司的实际影响、直接来源链接。

### AI 新技术

模型、Agent、推理、训练、评测、开源工具和论文进展。每条包含：技术变化、相对基线、证据强弱、能否现在复现或使用、直接来源链接。

最后给出 3 条以内的行动建议，并单列不确定或尚未证实的信息。新闻少时可以少写，但不得用旧闻填充或编造热度。通过 `submit_run_result` 提交中文摘要、条目数组、来源和核验说明。
