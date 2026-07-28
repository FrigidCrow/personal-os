import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createDatabase } from "@personal-os/database";
import {
  attachDatabase,
  createProjectFromUi,
  createTaskFromUi,
  databaseRow,
  databaseRows,
  dragTaskToStatus,
  e2eDatabasePath,
  selectOption,
  tracedMutation
} from "./helpers";

test.describe.configure({ mode: "serial" });

let projectId = "";
let projectName = "";
let workerTaskId = "";

test.beforeAll(() => {
  mkdirSync("/tmp/personal-os-e2e-repository", { recursive: true });
});

test("shell, dashboard, themes, mobile navigation and accessibility states", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今天的控制面" })).toBeVisible();

  const destinations: Array<[string, string]> = [
    ["/projects", "项目组合"],
    ["/tasks", "任务队列"],
    ["/radar", "机会雷达"],
    ["/experiments", "微型实验室"],
    ["/assets", "收入资产"],
    ["/review", "Agent 控制面"]
  ];
  for (const [href, heading] of destinations) {
    await page.locator(`.desktop-sidebar a[href="${href}"]`).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.getByRole("radio", { name: "浅色" }).click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-theme-mode", "light");
  await page.getByRole("radio", { name: "深色" }).click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-theme-mode", "dark");
  await page.getByRole("radio", { name: "系统" }).click();
  expect(await page.evaluate(() => localStorage.getItem("personal-os-theme"))).toBe("system");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "打开导航" }).click();
  await page.getByRole("dialog").getByRole("link", { name: /^任务/ }).click();
  await expect(page.getByText("从输入到验收", { exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(overflow.scrollWidth).toBe(overflow.width);
  expect(consoleErrors).toEqual([]);
  await testInfo.attach("responsive-layout.json", { body: Buffer.from(JSON.stringify(overflow, null, 2)), contentType: "application/json" });
});

test("project CRUD starts in the UI and is verified in SQLite", async ({ page }, testInfo) => {
  projectName = `E2E 控制面项目 ${Date.now()}`;
  const project = await createProjectFromUi(page, testInfo, projectName);
  projectId = project.id;
  let row = databaseRow<Record<string, unknown>>("SELECT * FROM projects WHERE id = ?", projectId);
  expect(row?.name).toBe(projectName);
  expect(row?.repository_path).toBe("/tmp/personal-os-e2e-repository");
  await attachDatabase(testInfo, "project-create", row);

  await page.getByRole("button", { name: `编辑 ${projectName}` }).click();
  const projectDialog = page.getByRole("dialog", { name: "编辑项目" });
  await expect(projectDialog).toBeVisible();
  await projectDialog.getByRole("textbox", { name: "下一步行动", exact: true }).fill("已通过编辑请求验证更新链路");
  await tracedMutation(
    page,
    testInfo,
    "project-update",
    (response) => response.url().endsWith(`/api/projects/${projectId}`) && response.request().method() === "PATCH",
    () => projectDialog.getByRole("button", { name: "保存修改", exact: true }).click()
  );
  row = databaseRow("SELECT id, next_action, updated_at FROM projects WHERE id = ?", projectId);
  expect(row?.next_action).toBe("已通过编辑请求验证更新链路");
  await attachDatabase(testInfo, "project-update", row);

  await page.locator(".project-panel").filter({ hasText: projectName }).getByRole("link", { name: "查看详情", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  await expect(page.getByText("已通过编辑请求验证更新链路", { exact: true })).toBeVisible();
  await expect(page.getByText("/tmp/personal-os-e2e-repository", { exact: true })).toBeVisible();
});

test("task automation form, pointer drag, detail edit, pause, cancel and retry persist", async ({ page }, testInfo) => {
  const task = await createTaskFromUi(page, testInfo, {
    title: `E2E OpenWorker 队列 ${Date.now()}`,
    projectName,
    taskType: "业务报告",
    executor: "OpenWorker",
    executionMode: "自动执行",
    trigger: "事件",
    risk: "低风险",
    maxAttempts: 3
  });
  workerTaskId = task.id;
  let row = databaseRow<Record<string, unknown>>("SELECT * FROM tasks WHERE id = ?", workerTaskId);
  expect(row).toMatchObject({ executor: "openworker", execution_mode: "automatic", trigger_type: "event", risk_level: "low", max_attempts: 3 });
  await attachDatabase(testInfo, "task-automation-create", row);

  const transition = page.waitForResponse((response) => response.url().endsWith(`/api/tasks/${workerTaskId}/transition`) && response.request().method() === "POST");
  await dragTaskToStatus(page, workerTaskId, "ready");
  const transitionResponse = await transition;
  expect(transitionResponse.ok()).toBeTruthy();
  await expect(page.getByTestId(`task-card-${workerTaskId}`)).toBeVisible();
  row = databaseRow("SELECT id, status FROM tasks WHERE id = ?", workerTaskId);
  expect(row?.status).toBe("ready");
  await testInfo.attach("task-drag-http.json", { body: Buffer.from(JSON.stringify({ request: transitionResponse.request().postDataJSON(), response: await transitionResponse.json() }, null, 2)), contentType: "application/json" });
  await attachDatabase(testInfo, "task-drag", row);

  await page.waitForTimeout(400);
  await page.getByTestId(`task-card-${workerTaskId}`).click({ position: { x: 40, y: 55 } });
  const taskDialog = page.getByRole("dialog");
  await expect(taskDialog).toBeVisible();
  await expect(taskDialog.getByRole("heading", { name: task.title })).toBeVisible();
  await taskDialog.getByRole("button", { name: "编辑详情" }).click();
  await taskDialog.getByRole("textbox", { name: "任务说明", exact: true }).fill("详情编辑已经经过浏览器、API 和数据库三层验证");
  await tracedMutation(
    page,
    testInfo,
    "task-detail-update",
    (response) => response.url().endsWith(`/api/tasks/${workerTaskId}`) && response.request().method() === "PATCH",
    () => taskDialog.getByRole("button", { name: "保存更改", exact: true }).click()
  );
  expect(databaseRow<Record<string, unknown>>("SELECT description FROM tasks WHERE id = ?", workerTaskId)?.description).toContain("三层验证");
  await taskDialog.getByRole("button", { name: "关闭", exact: true }).click();

  await tracedMutation(
    page,
    testInfo,
    "automation-pause",
    (response) => response.url().endsWith(`/api/tasks/${workerTaskId}/automation/pause`) && response.request().method() === "POST",
    () => page.getByTestId(`task-card-${workerTaskId}`).getByRole("button", { name: "暂停" }).click()
  );
  expect(databaseRow<Record<string, unknown>>("SELECT automation_paused FROM tasks WHERE id = ?", workerTaskId)?.automation_paused).toBe(1);
  await page.getByTestId(`task-card-${workerTaskId}`).getByRole("button", { name: "恢复" }).click();
  await expect.poll(() => databaseRow<Record<string, unknown>>("SELECT automation_paused FROM tasks WHERE id = ?", workerTaskId)?.automation_paused).toBe(0);

  const dispatch = await tracedMutation<{ id: string }>(
    page,
    testInfo,
    "openworker-dispatch",
    (response) => response.url().endsWith(`/api/tasks/${workerTaskId}/dispatch`) && response.request().method() === "POST",
    () => page.getByTestId(`task-card-${workerTaskId}`).getByRole("button", { name: "交给 Worker" }).click()
  );
  const firstRunId = dispatch.body.id;
  expect(databaseRow<Record<string, unknown>>("SELECT executor, status, attempt, mode FROM agent_runs WHERE id = ?", firstRunId)).toMatchObject({ executor: "openworker", status: "queued", attempt: 1, mode: "live" });
  await tracedMutation(
    page,
    testInfo,
    "openworker-cancel",
    (response) => response.url().endsWith(`/api/agent-runs/${firstRunId}/cancel`) && response.request().method() === "POST",
    () => page.getByTestId(`task-card-${workerTaskId}`).getByRole("button", { name: "取消运行" }).click()
  );
  expect(databaseRow<Record<string, unknown>>("SELECT status FROM agent_runs WHERE id = ?", firstRunId)?.status).toBe("cancelled");
  const retried = await tracedMutation<{ id: string }>(
    page,
    testInfo,
    "openworker-retry",
    (response) => response.url().endsWith(`/api/agent-runs/${firstRunId}/retry`) && response.request().method() === "POST",
    () => page.getByTestId(`task-card-${workerTaskId}`).getByRole("button", { name: "重试" }).click()
  );
  expect(databaseRow<Record<string, unknown>>("SELECT executor, status, attempt FROM agent_runs WHERE id = ?", retried.body.id)).toMatchObject({ executor: "openworker", status: "queued", attempt: 2 });
});

test("Codex demo reaches review, streams audit detail and only human acceptance finishes it", async ({ page }, testInfo) => {
  const task = await createTaskFromUi(page, testInfo, {
    title: `E2E Codex 人工门 ${Date.now()}`,
    projectName,
    taskType: "测试",
    executor: "Codex",
    risk: "低风险",
    maxAttempts: 2,
    acceptance: "Demo 结果进入 Needs Review\n人工批准后才进入 Done"
  });
  await page.getByTestId(`task-card-${task.id}`).getByRole("button", { name: "整理完成" }).click();
  await expect.poll(() => databaseRow<Record<string, unknown>>("SELECT status FROM tasks WHERE id = ?", task.id)?.status).toBe("ready");
  await page.getByTestId(`task-card-${task.id}`).getByRole("button", { name: "启动 Codex" }).click();
  const dispatched = await tracedMutation<{ id: string }>(
    page,
    testInfo,
    "codex-demo-dispatch",
    (response) => response.url().endsWith(`/api/tasks/${task.id}/dispatch`) && response.request().method() === "POST",
    () => page.getByRole("button", { name: "开始 Demo", exact: true }).click()
  );
  const runId = dispatched.body.id;
  await expect.poll(() => databaseRow<Record<string, unknown>>("SELECT status FROM agent_runs WHERE id = ?", runId)?.status, { timeout: 20_000 }).toBe("needs_review");
  expect(databaseRow<Record<string, unknown>>("SELECT status FROM tasks WHERE id = ?", task.id)?.status).toBe("needs_review");

  await page.goto("/review");
  const card = page.getByTestId(`run-card-${runId}`);
  await expect(card).toContainText("待审查");
  await card.getByRole("button", { name: "查看运行详情" }).click();
  const runDialog = page.getByRole("dialog");
  await expect(runDialog.getByText("事件时间线", { exact: true })).toBeVisible();
  await expect(runDialog.getByText("运行已结束", { exact: true })).toBeVisible();
  await expect(runDialog).toContainText("Demo 适配器验证了任务可以从 Ready 进入 In Progress，再进入 Needs Review");
  await runDialog.getByRole("button", { name: "关闭", exact: true }).click();
  await tracedMutation(
    page,
    testInfo,
    "codex-demo-accept",
    (response) => response.url().endsWith(`/api/agent-runs/${runId}/accept`) && response.request().method() === "POST",
    () => card.getByRole("button", { name: "批准结果" }).click()
  );
  const result = {
    task: databaseRow("SELECT id, status FROM tasks WHERE id = ?", task.id),
    run: databaseRow("SELECT id, status, requires_human_review FROM agent_runs WHERE id = ?", runId),
    events: databaseRows("SELECT event_type, message FROM agent_run_events WHERE run_id = ? ORDER BY rowid", runId)
  };
  expect(result.task?.status).toBe("done");
  expect(result.run?.status).toBe("done");
  await attachDatabase(testInfo, "codex-demo-accepted", result);
});

test("approval inbox approves and rejects only from rendered human controls", async ({ page }, testInfo) => {
  const database = createDatabase(e2eDatabasePath, false);
  const task = database.createTask({
    projectId,
    title: `E2E 审批动作 ${Date.now()}`,
    description: "验证审批收件箱的人类权限边界",
    status: "ready",
    delegationMode: "mixed",
    priority: "medium",
    acceptanceCriteria: ["审批决定被审计"],
    taskType: "email",
    executor: "openworker",
    executionMode: "manual",
    triggerType: "manual",
    triggerConfig: null,
    triggerTimezone: "Asia/Tokyo",
    riskLevel: "medium",
    maxAttempts: 1,
    nextRunAt: null,
    lastScheduledAt: null,
    automationPaused: false
  });
  const run = database.createAgentRun({ taskId: task.id, executor: "openworker", promptSnapshot: "Approval E2E", idempotencyKey: `approval-${task.id}` });
  database.claimAgentRun(run.id);
  database.updateAgentRun(run.id, { status: "running", startedAt: new Date().toISOString() });
  const approval = database.createApprovalRequest({
    runId: run.id,
    actionType: "send_message",
    destination: "test@example.invalid",
    summary: "发送验收消息",
    payloadPreview: "这是一段只供人工审查的预览"
  });
  database.close();

  await page.goto("/review");
  const card = page.getByTestId(`approval-card-${approval.id}`);
  await expect(card).toContainText("test@example.invalid");
  await expect(card).toContainText("这是一段只供人工审查的预览");
  await tracedMutation(
    page,
    testInfo,
    "approval-approve",
    (response) => response.url().endsWith(`/api/approvals/${approval.id}/resolve`) && response.request().method() === "POST",
    () => card.getByRole("button", { name: "批准操作" }).click()
  );
  expect(databaseRow<Record<string, unknown>>("SELECT status FROM approval_requests WHERE id = ?", approval.id)?.status).toBe("approved");
  expect(databaseRow<Record<string, unknown>>("SELECT status FROM agent_runs WHERE id = ?", run.id)?.status).toBe("running");
  await attachDatabase(testInfo, "approval-approved", {
    approval: databaseRow("SELECT * FROM approval_requests WHERE id = ?", approval.id),
    run: databaseRow("SELECT id, status, lease_expires_at FROM agent_runs WHERE id = ?", run.id)
  });

  const rejectionDatabase = createDatabase(e2eDatabasePath, false);
  const rejectedApproval = rejectionDatabase.createApprovalRequest({
    runId: run.id,
    actionType: "external_write",
    destination: "https://example.invalid/publish",
    summary: "拒绝外部写入",
    payloadPreview: "不允许自动发布这段内容"
  });
  rejectionDatabase.close();
  await page.reload();
  const rejectedCard = page.getByTestId(`approval-card-${rejectedApproval.id}`);
  await expect(rejectedCard).toContainText("不允许自动发布这段内容");
  await tracedMutation(
    page,
    testInfo,
    "approval-reject",
    (response) => response.url().endsWith(`/api/approvals/${rejectedApproval.id}/resolve`) && response.request().method() === "POST",
    () => rejectedCard.getByRole("button", { name: "拒绝" }).click()
  );
  expect(databaseRow<Record<string, unknown>>("SELECT status FROM approval_requests WHERE id = ?", rejectedApproval.id)?.status).toBe("rejected");
  expect(databaseRow<Record<string, unknown>>("SELECT status FROM agent_runs WHERE id = ?", run.id)?.status).toBe("running");
});

test("review rejection and destructive CRUD require rendered human confirmation", async ({ page }, testInfo) => {
  const rejectedTask = await createTaskFromUi(page, testInfo, {
    title: `E2E 驳回与删除 ${Date.now()}`,
    projectName,
    taskType: "测试",
    executor: "Codex",
    risk: "低风险",
    acceptance: "结果必须由人工明确批准或驳回"
  });
  await page.getByTestId(`task-card-${rejectedTask.id}`).getByRole("button", { name: "整理完成" }).click();
  await page.getByTestId(`task-card-${rejectedTask.id}`).getByRole("button", { name: "启动 Codex" }).click();
  const dispatched = await tracedMutation<{ id: string }>(
    page,
    testInfo,
    "codex-demo-for-reject",
    (response) => response.url().endsWith(`/api/tasks/${rejectedTask.id}/dispatch`) && response.request().method() === "POST",
    () => page.getByRole("button", { name: "开始 Demo", exact: true }).click()
  );
  await expect.poll(
    () => databaseRow<Record<string, unknown>>("SELECT status FROM agent_runs WHERE id = ?", dispatched.body.id)?.status,
    { timeout: 20_000 }
  ).toBe("needs_review");
  await page.goto("/review");
  const runCard = page.getByTestId(`run-card-${dispatched.body.id}`);
  await runCard.getByRole("button", { name: "驳回" }).click();
  const rejectDialog = page.getByRole("dialog", { name: "驳回 Agent 结果" });
  await rejectDialog.getByLabel("驳回原因", { exact: true }).fill("缺少可复核的产物证据");
  await tracedMutation(
    page,
    testInfo,
    "codex-demo-reject",
    (response) => response.url().endsWith(`/api/agent-runs/${dispatched.body.id}/reject`) && response.request().method() === "POST",
    () => rejectDialog.getByRole("button", { name: "确认驳回" }).click()
  );
  expect(databaseRow<Record<string, unknown>>("SELECT status, error_message FROM agent_runs WHERE id = ?", dispatched.body.id)).toMatchObject({
    status: "blocked",
    error_message: "缺少可复核的产物证据"
  });
  expect(databaseRow<Record<string, unknown>>("SELECT status FROM tasks WHERE id = ?", rejectedTask.id)?.status).toBe("blocked");

  const disposableTask = await createTaskFromUi(page, testInfo, { title: `E2E 待删除任务 ${Date.now()}` });
  await page.getByTestId(`task-card-${disposableTask.id}`).click({ position: { x: 40, y: 55 } });
  await page.getByRole("dialog").getByRole("button", { name: "删除任务" }).click();
  const deleteTaskDialog = page.getByRole("alertdialog", { name: "删除任务？" });
  await tracedMutation(
    page,
    testInfo,
    "task-delete",
    (response) => response.url().endsWith(`/api/tasks/${disposableTask.id}`) && response.request().method() === "DELETE",
    () => deleteTaskDialog.getByRole("button", { name: "确认删除" }).click()
  );
  expect(databaseRow("SELECT id FROM tasks WHERE id = ?", disposableTask.id)).toBeUndefined();

  const disposableProjectName = `E2E 待删除项目 ${Date.now()}`;
  const disposableProject = await createProjectFromUi(page, testInfo, disposableProjectName);
  await page.getByRole("button", { name: `删除 ${disposableProjectName}` }).click();
  const deleteProjectDialog = page.getByRole("alertdialog", { name: "删除项目？" });
  await tracedMutation(
    page,
    testInfo,
    "project-delete",
    (response) => response.url().endsWith(`/api/projects/${disposableProject.id}`) && response.request().method() === "DELETE",
    () => deleteProjectDialog.getByRole("button", { name: "确认删除" }).click()
  );
  expect(databaseRow("SELECT id FROM projects WHERE id = ?", disposableProject.id)).toBeUndefined();
});

test("opportunity report converts to an experiment, edits it and records a result", async ({ page }, testInfo) => {
  await page.goto("/radar");
  await tracedMutation(
    page,
    testInfo,
    "radar-demo-generate",
    (response) => response.url().endsWith("/api/reports/generate") && response.request().method() === "POST",
    () => page.getByRole("button", { name: "生成 Demo", exact: true }).click()
  );
  await expect(page.getByText("Demo 机会报告已生成", { exact: true })).toBeVisible();
  expect(databaseRows("SELECT * FROM daily_report_opportunities").length).toBeLessThanOrEqual(5);

  const candidate = page.locator(".opportunity-panel").filter({ has: page.getByRole("button", { name: "启动最小实验" }) }).first();
  const title = (await candidate.getByRole("heading", { level: 2 }).textContent())?.trim() ?? "";
  const converted = await tracedMutation<{ id: string }>(
    page,
    testInfo,
    "opportunity-convert",
    (response) => response.url().includes("/api/opportunities/") && response.url().endsWith("/experiment") && response.request().method() === "POST",
    () => candidate.getByRole("button", { name: "启动最小实验" }).click()
  );
  const experimentId = converted.body.id;
  expect(databaseRow<Record<string, unknown>>("SELECT title, status FROM experiments WHERE id = ?", experimentId)?.title).toBe(title);

  await page.goto("/experiments");
  await page.getByRole("button", { name: `查看实验 ${title}` }).click();
  await page.getByRole("button", { name: "编辑实验" }).click();
  await page.getByLabel("资金上限", { exact: true }).fill("88");
  await tracedMutation(
    page,
    testInfo,
    "experiment-update",
    (response) => response.url().endsWith(`/api/experiments/${experimentId}`) && response.request().method() === "PATCH",
    () => page.getByRole("button", { name: "保存更改" }).click()
  );
  await page.getByRole("button", { name: "记录结果" }).click();
  await selectOption(page, "结果状态", "验证成功");
  await page.getByLabel("结果摘要", { exact: true }).fill("获得一个明确的付费意向，达到最小实验成功条件。");
  await tracedMutation(
    page,
    testInfo,
    "experiment-result",
    (response) => response.url().endsWith(`/api/experiments/${experimentId}/result`) && response.request().method() === "POST",
    () => page.getByRole("button", { name: "保存结果" }).click()
  );
  const row = databaseRow<Record<string, unknown>>("SELECT status, budget_cap, result_summary FROM experiments WHERE id = ?", experimentId);
  expect(row).toMatchObject({ status: "won", budget_cap: 88 });
  await attachDatabase(testInfo, "experiment-result", row);

  await page.goto("/assets");
  await expect(page.getByText("低维护月收入", { exact: true })).toBeVisible();
  await expect(page.getByText("每月维护时间", { exact: true })).toBeVisible();
  await expect(page.getByText("月收入", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("月维护", { exact: true }).first()).toBeVisible();
});
