# Personal OS vNext MVP2 验收表

**状态**：Passed

**日期**：2026-08-01

| ID | 验收项 | 直接证据 | 状态 |
|---|---|---|---|
| M2-01 | API 注册 Codex/OpenWorker，并在 health 中报告真实配置状态 | `/api/v2/health` 返回四个执行器；OpenWorker REST + Token 健康通过 | Passed |
| M2-02 | 两种 AI Runtime 遵守同一 ExecutorAdapter 契约 | `vnext-runtime` 13 项适配器测试 | Passed |
| M2-03 | Codex 只接受存在的允许 Git 项目目录 | 允许根、越界和非 Git 负向测试 | Passed |
| M2-04 | Codex 默认 read-only、无网络、无 Web Search、never approval | client fake 精确断言 + live read-only smoke | Passed |
| M2-05 | Codex thread id、事件和最终响应持久化到统一 Run | Application external id/waiting 测试 + API/SSE 回归 | Passed |
| M2-06 | OpenWorker Token 只从受控文件读取且不出现在输出 | 假 Token 事件测试 + 真实 Token diff 扫描 | Passed |
| M2-07 | OpenWorker assistant/tool/turn 事件按序转换为 RunEvent | WebSocket fake 测试 + live turn | Passed |
| M2-08 | OpenWorker 权限/目录/计划/提问请求进入 waiting 状态，不自动批准 | 四种 prompt 参数化测试 + Application 状态机测试 | Passed |
| M2-09 | Codex/OpenWorker 取消会传播至底层执行 | SDK signal 断言、WS interrupt、Application late-success 测试 | Passed |
| M2-10 | Runtime 错误、空结果和非法目录不能被标记成功 | Codex/OpenWorker 空结果、路径和协议负向测试 | Passed |
| M2-11 | Internal/Process/Schedule/SSE/迁移和 v1 UI 无回归 | 152/152 tests，vNext 5/5 E2E，旧系统 7/7 E2E，build passed | Passed |
| M2-12 | SQLite quick check/外键、patch hygiene 和 Secret 扫描通过 | `quick_check=ok`、零 FK、diff check 与真实 Token 扫描通过 | Passed |
| M2-13 | Codex 与 OpenWorker 完成只读真实冒烟，或记录可复现的外部阻断 | Codex `PERSONAL_OS_CODEX_SMOKE_OK`；OpenWorker `PERSONAL_OS_OPENWORKER_SMOKE_OK` | Passed |
| M2-14 | 旧系统和旧数据库保持不变，未执行端口切换 | v1 SHA-256 仍为 `2f185b…246`；vNext 仍为 5373/8887 | Passed |
| M2-15 | Web 可为 Codex/OpenWorker 选择正确 Runtime 配置，且不再显示“待接入” | vNext 浏览器第 3 条旅程 | Passed |

## 验收摘要

- Codex live thread：`019fbdbd-a315-7943-b012-16cfe4a04d35`，只读、无网络，返回真实 usage（26,285 input / 135 output），费用保持未知。
- OpenWorker live session：`personal-os-v2-smoke-openworker-1785594757468`，未调用工具，费用和 usage 保持未知。
- Review 发现并修复两项真实问题：Codex 非致命 SDK warning 被误判为失败；Web 对 AI Runtime 仍错误显示本地命令表单。
- 数据完整性复核又修复一项旧初始化副作用：重复打开开发数据库不再无条件刷新汽水任务的 `updated_at`；权威 v1 数据库 SHA-256 仍为 `2f185b…246`。
- MVP2 没有执行 production cutover。Approval 恢复、丰富 Artifact 收集和账单成本仍属于后续治理阶段。

## 退出条件

M2-01 至 M2-12 和 M2-14 至 M2-15 必须全部 Passed。M2-13 只有认证/上游服务不可用时可以 Blocked，但必须给出明确诊断。任何真实外部写入、Secret 泄露、假成功或旧系统数据变化都阻断 MVP2。
