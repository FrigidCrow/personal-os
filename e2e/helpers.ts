import { resolve } from "node:path";
import Database from "better-sqlite3";
import { expect, type Page, type Response, type TestInfo } from "@playwright/test";

export const e2eDatabasePath = resolve(import.meta.dirname, "..", "review-artifacts", "e2e.db");

export function databaseRows<T = Record<string, unknown>>(sql: string, ...parameters: unknown[]): T[] {
  const database = new Database(e2eDatabasePath, { readonly: true });
  try {
    return database.prepare(sql).all(...parameters) as T[];
  } finally {
    database.close();
  }
}

export function databaseRow<T = Record<string, unknown>>(sql: string, ...parameters: unknown[]): T | undefined {
  const database = new Database(e2eDatabasePath, { readonly: true });
  try {
    return database.prepare(sql).get(...parameters) as T | undefined;
  } finally {
    database.close();
  }
}

export async function tracedMutation<T>(
  page: Page,
  testInfo: TestInfo,
  name: string,
  matches: (response: Response) => boolean,
  action: () => Promise<unknown>
): Promise<{ response: Response; body: T }> {
  const responsePromise = page.waitForResponse(matches);
  await action();
  const response = await responsePromise;
  const body = await response.json() as T;
  const request = response.request();
  await testInfo.attach(`${name}-http.json`, {
    body: Buffer.from(JSON.stringify({
      request: {
        method: request.method(),
        url: request.url(),
        body: request.postDataJSON()
      },
      response: { status: response.status(), body }
    }, null, 2)),
    contentType: "application/json"
  });
  expect(response.ok(), `${name} returned ${response.status()}`).toBeTruthy();
  return { response, body };
}

export async function attachDatabase(testInfo: TestInfo, name: string, value: unknown): Promise<void> {
  await testInfo.attach(`${name}-sqlite.json`, {
    body: Buffer.from(JSON.stringify(value, null, 2)),
    contentType: "application/json"
  });
}

export async function selectOption(page: Page, label: string, option: string): Promise<void> {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export async function createProjectFromUi(page: Page, testInfo: TestInfo, name: string) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "新增项目", exact: true }).click();
  await page.getByLabel("项目名称", { exact: true }).fill(name);
  await page.getByLabel("最终结果", { exact: true }).fill("交付一套可以重复验收的本地自动化闭环");
  await page.getByLabel("下一步行动", { exact: true }).fill("执行浏览器到数据库的完整验收");
  await page.getByLabel("Git 仓库绝对路径", { exact: true }).fill("/tmp/personal-os-e2e-repository");
  await page.getByLabel("Obsidian 笔记路径", { exact: true }).fill("Projects/personal-os-e2e.md");
  const result = await tracedMutation<{ id: string; name: string }>(
    page,
    testInfo,
    "project-create",
    (response) => response.url().endsWith("/api/projects") && response.request().method() === "POST",
    () => page.getByRole("button", { name: "创建项目", exact: true }).click()
  );
  await expect(page.getByText("项目已创建", { exact: true })).toBeVisible();
  return result.body;
}

interface CreateTaskOptions {
  title: string;
  description?: string;
  projectName?: string;
  executor?: "Codex" | "OpenWorker" | "自动路由" | "本人";
  executionMode?: "手动触发" | "自动执行";
  trigger?: "手动" | "定时" | "事件" | "依赖完成";
  risk?: "低风险" | "中风险" | "高风险";
  taskType?: string;
  maxAttempts?: number;
  acceptance?: string;
}

export async function createTaskFromUi(page: Page, testInfo: TestInfo, options: CreateTaskOptions) {
  await page.goto("/tasks");
  await page.getByRole("button", { name: "新增任务", exact: true }).click();
  await page.getByLabel("任务名称", { exact: true }).fill(options.title);
  await page.getByLabel("任务说明", { exact: true }).fill(options.description ?? "由 E2E 测试创建并跟踪每一层状态");
  if (options.projectName) await selectOption(page, "所属项目", options.projectName);
  if (options.taskType) await selectOption(page, "任务类型", options.taskType);
  if (options.executor) await selectOption(page, "执行器", options.executor);
  if (options.executionMode) await selectOption(page, "执行模式", options.executionMode);
  if (options.trigger) await selectOption(page, "触发方式", options.trigger);
  if (options.trigger === "事件") await page.getByLabel("内部事件名", { exact: true }).fill("e2e.worker.requested");
  if (options.trigger === "定时") await page.getByLabel("Cron 表达式", { exact: true }).fill("0 8 * * *");
  if (options.risk) await selectOption(page, "风险等级", options.risk);
  if (options.maxAttempts) await page.getByLabel("最大尝试次数", { exact: true }).fill(String(options.maxAttempts));
  await page.getByLabel("验收条件，每行一条", { exact: true }).fill(options.acceptance ?? "结果进入人工验收\n数据库状态与界面一致");
  const result = await tracedMutation<{ id: string; title: string }>(
    page,
    testInfo,
    `task-create-${options.title}`,
    (response) => response.url().endsWith("/api/tasks") && response.request().method() === "POST",
    () => page.getByRole("button", { name: "创建任务", exact: true }).click()
  );
  await expect(page.getByText("任务已创建", { exact: true })).toBeVisible();
  return result.body;
}

export async function dragTaskToStatus(page: Page, taskId: string, status: string): Promise<void> {
  const card = page.getByTestId(`task-card-${taskId}`);
  const column = page.locator(`[data-status="${status}"]`);
  const cardBox = await card.boundingBox();
  const columnBox = await column.boundingBox();
  if (!cardBox || !columnBox) throw new Error("Task card or target column is not visible");
  const start = { x: cardBox.x + cardBox.width / 2, y: cardBox.y + 22 };
  const end = { x: columnBox.x + columnBox.width / 2, y: columnBox.y + 150 };
  await card.dispatchEvent("pointerdown", { pointerId: 41, pointerType: "mouse", button: 0, buttons: 1, clientX: start.x, clientY: start.y, bubbles: true });
  await page.evaluate(({ start, end }) => {
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 41, pointerType: "mouse", buttons: 1, clientX: start.x + 12, clientY: start.y + 14, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 41, pointerType: "mouse", buttons: 1, clientX: end.x, clientY: end.y, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 41, pointerType: "mouse", button: 0, buttons: 0, clientX: end.x, clientY: end.y, bubbles: true }));
  }, { start, end });
}
