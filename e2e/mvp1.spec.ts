import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("五区导航、主题与移动布局", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今天", exact: true })).toBeVisible();
  await expect(page.locator(".sidebar nav a")).toHaveCount(5);
  for (const [label, heading] of [["项目", "项目"], ["雷达", "雷达"], ["运行", "运行"], ["资产", "资产"]]) {
    await page.locator(".sidebar").getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await page.locator(".theme-button").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator(".theme-button").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator(".theme-button").click();
  await expect(page.locator(".theme-button")).toContainText("跟随系统");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".mobile-nav a")).toHaveCount(5);
  await page.locator(".mobile-nav").getByRole("link", { name: "雷达", exact: true }).click();
  await expect(page.getByRole("heading", { name: "雷达", exact: true })).toBeVisible();
  const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(widths.scroll).toBe(widths.client);
  expect(consoleErrors).toEqual([]);
});

test("项目、雷达和定时执行形成闭环", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "新建项目" }).click();
  await page.getByLabel("项目名称").fill("汽水音乐实验");
  await page.getByLabel("项目说明").fill("采榜、拆解与原创实验");
  await page.getByLabel("Git 路径").fill(process.cwd());
  await page.getByRole("button", { name: "保存项目" }).click();
  await expect(page.getByRole("heading", { name: "汽水音乐实验" })).toBeVisible();

  await page.goto("/radar");
  await page.getByRole("button", { name: "新建雷达" }).click();
  await page.getByLabel("名称").fill("每日热歌采集");
  await page.getByLabel("固定 Skill").selectOption("personal-os-agent-run");
  await page.getByLabel("所属项目").selectOption({ label: "汽水音乐实验" });
  await page.getByLabel("执行要求").fill("采集热歌榜和新歌榜 Top10，去重后写入 Obsidian");
  await page.getByRole("button", { name: "保存固定版本" }).click();
  await expect(page.getByRole("heading", { name: "每日热歌采集" })).toBeVisible();
  await page.getByRole("button", { name: "设置定时" }).click();
  await page.getByLabel("定时名称").fill("每日 08:00 采榜");
  await page.getByRole("button", { name: "保存定时" }).click();
  const row = page.locator(".schedule-row").filter({ hasText: "每日 08:00 采榜" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "立即运行" }).click();
  await row.getByRole("button", { name: "修改 每日 08:00 采榜" }).click();
  await page.getByLabel("Cron").fill("30 8 * * *");
  await page.getByLabel("错过后补跑一次").check();
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(row).toContainText("30 8 * * *");
  await expect(row).toContainText("补跑一次");
  await page.goto("/runs");
  await expect(page.locator(".run-index")).toContainText("每日热歌采集");
  await expect(page.locator(".run-detail")).toContainText("成功");
});

test("Skill 检查发布、工作流体检、创建新版和定时换绑", async ({ page }) => {
  await page.goto("/radar");
  await page.getByRole("button", { name: "Skill 工作台" }).click();
  await page.getByLabel("Skill 机器名称").fill("phase-ten-browser");
  await page.getByLabel("Skill 显示名称").fill("阶段十浏览器验证");
  await page.getByLabel("Skill 用途说明").fill("验证可视化工作流运营闭环。");
  await page.getByLabel("Skill 执行方法").fill("# 阶段十浏览器验证\n\n1. 读取运行上下文。\n2. 完成任务并核验。\n3. 提交结构化结果。");
  await page.getByRole("button", { name: "检查 Skill" }).click();
  await expect(page.getByText("检查通过，可以发布", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "发布这个版本" }).click();
  await expect(page.getByLabel("选择已有 Skill").locator("option[value='phase-ten-browser']")).toHaveCount(1);
  await page.getByRole("button", { name: "收起" }).click();

  await page.getByRole("button", { name: "新建雷达" }).click();
  await page.getByLabel("名称").fill("阶段十浏览器工作流");
  await page.getByLabel("固定 Skill").selectOption("phase-ten-browser");
  await page.getByLabel("执行要求").fill("执行阶段十浏览器验证并输出证据");
  await page.getByRole("button", { name: "保存固定版本" }).click();
  await page.getByRole("heading", { name: "阶段十浏览器工作流" }).click();
  await page.getByRole("button", { name: "添加定时" }).click();
  await page.getByLabel("定时名称").fill("阶段十换绑");
  await page.getByRole("button", { name: "保存定时" }).click();
  await page.getByRole("button", { name: "运行体检" }).click();
  await expect(page.getByRole("heading", { name: "可以运行" })).toBeVisible();
  await page.screenshot({ path: "review-artifacts/phase10/workflow-preflight-desktop-dark.png", fullPage: true });

  await page.getByRole("button", { name: "创建新版" }).click();
  await page.getByLabel("名称").fill("阶段十浏览器工作流新版");
  await page.getByRole("button", { name: "保存为新版本" }).click();
  await expect(page).toHaveURL(/\/radar\/[a-z0-9-]+$/);
  await expect(page.locator(".skill-lock")).toContainText("版本 2");
  await page.getByRole("link", { name: "全部雷达" }).click();
  const row = page.locator(".schedule-row").filter({ hasText: "阶段十换绑" });
  await row.getByLabel("换绑 阶段十换绑").selectOption({ label: "阶段十浏览器工作流新版 · v2" });
  await row.getByRole("button", { name: "确认换绑" }).click();
  await expect(row).toContainText("当前：阶段十浏览器工作流新版 · v2");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: "review-artifacts/phase10/radar-operations-mobile-dark.png", fullPage: true });
});

test("统一搜索、稳定详情与旧链接兼容", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开统一搜索" }).click();
  await page.getByRole("textbox", { name: "统一搜索" }).fill("汽水音乐实验");
  await expect(page.getByRole("option").filter({ hasText: "汽水音乐实验" }).first()).toBeVisible();
  await page.screenshot({ path: "review-artifacts/phase6/global-search-desktop-dark.png", fullPage: true });
  await page.keyboard.press("Enter");
  await expect(page.locator(".command-dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+$/);
  await expect(page.locator(".project-brief")).toContainText("Git 仓库");
  await expect(page.locator(".project-stat-band")).toContainText("工作定义");
  await page.screenshot({ path: "review-artifacts/phase6/project-detail-desktop-dark.png", fullPage: true });

  await page.getByRole("button", { name: "打开统一搜索" }).click();
  await page.getByRole("textbox", { name: "统一搜索" }).fill("每日热歌采集");
  const radarResult = page.getByRole("option").filter({ hasText: "每日热歌采集" }).filter({ hasText: "Skill" }).first();
  await expect(radarResult).toBeVisible();
  await radarResult.click();
  await expect(page.locator(".command-dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/radar\/[a-z0-9-]+$/);
  await expect(page.locator(".skill-lock")).toContainText("personal-os-agent-run@1.0.0");
  await expect(page.locator(".skill-lock strong")).toHaveText(/^[a-f0-9]{64}$/);
  await expect(page.locator(".definition-panel")).toContainText("采集热歌榜和新歌榜 Top10");
  await page.screenshot({ path: "review-artifacts/phase6/radar-detail-desktop-dark.png", fullPage: true });

  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/runs$/);
  await page.goto("/review");
  await expect(page).toHaveURL(/\/runs$/);
});

test("Today 聚合待处理运行并直达真实 Run", async ({ page }) => {
  const specResponse = await page.request.post("/api/v2/work-specs", { data: { title: "等待验收的晨报", instructions: "生成待验收内容", executorType: "internal", input: { operation: "echo", message: "晨报已生成", delayMs: 0 }, kind: "one_off", lifecycleStatus: "active" } });
  const spec = (await specResponse.json()).data as { id: string };
  const runResponse = await page.request.post(`/api/v2/work-specs/${spec.id}/runs`, { data: { start: true } });
  const run = (await runResponse.json()).data as { id: string };
  await page.goto("/");
  const attention = page.locator(`.approval-inbox a[href="/runs/${run.id}"]`);
  await expect(attention).toBeVisible();
  await attention.click();
  await expect(page).toHaveURL(new RegExp(`/runs/${run.id}$`));
  await expect(page.locator(".run-detail")).toContainText("待验收");
});

test("五区和搜索层在 390px 无横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/", "/projects", "/radar", "/runs", "/assets", "/assets/knowledge", "/assets/finance"]) {
    await page.goto(route);
    const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(widths.scroll, route).toBe(widths.client);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "打开统一搜索" }).click();
  await page.getByRole("textbox", { name: "统一搜索" }).fill("每日");
  await expect(page.locator(".command-dialog")).toBeVisible();
  const dialogOverflow = await page.locator(".command-dialog").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(dialogOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "review-artifacts/phase6/five-zone-mobile-search.png", fullPage: true });
  await page.getByRole("button", { name: "关闭搜索" }).click();
  await expect(page.locator(".command-dialog")).toBeHidden();
});

test("Codex 和 OpenWorker 在运行表单中使用各自的真实配置", async ({ page }) => {
  await page.goto("/runs");
  await page.getByRole("button", { name: "发起运行" }).click();
  const runtime = page.getByLabel("Runtime");
  await runtime.selectOption("openworker");
  await expect(page.getByLabel("OpenWorker Agent")).toBeVisible();
  await expect(page.getByLabel("命令")).toHaveCount(0);
  await runtime.selectOption("codex");
  await expect(page.getByLabel("所属项目")).toContainText("汽水音乐实验");
  await expect(page.getByLabel("文件权限")).toHaveValue("read-only");
  await expect(page.getByLabel("联网能力")).not.toBeChecked();
  await expect(page.locator("body")).not.toContainText("待接入");
});

test("运行实时日志、取消和新尝试重试", async ({ page }) => {
  await page.goto("/runs");
  await page.getByRole("button", { name: "发起运行" }).click();
  await page.getByLabel("工作名称").fill("取消恢复验证");
  await page.getByLabel("执行要求").fill("验证运行可以取消并作为新尝试重试");
  await page.getByLabel("输出消息").fill("最终完成");
  await page.getByLabel("延迟毫秒").fill("1200");
  await page.getByRole("button", { name: "开始运行" }).click();
  await expect(page.locator(".run-detail")).toContainText("运行中");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".run-detail")).toContainText("已取消");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.locator(".run-detail")).toContainText("成功", { timeout: 6_000 });
  await expect(page.locator(".terminal")).toContainText("最终完成");
});

test("运行结果需要人工验收并可登记真实成本", async ({ page }) => {
  await page.goto("/runs");
  await page.getByRole("button", { name: "发起运行" }).click();
  await page.getByLabel("工作名称").fill("治理闭环验证");
  await page.getByLabel("执行要求").fill("生成可验收结果");
  await page.getByLabel("输出消息").fill("治理结果完成");
  await page.getByRole("button", { name: "开始运行" }).click();
  await expect(page.locator(".run-detail h2")).toHaveText("治理闭环验证");
  await expect(page.locator(".run-detail")).toContainText("待验收");
  await page.getByLabel("验收备注").fill("结果符合预期");
  await page.getByRole("button", { name: "验收通过" }).click();
  await expect(page.locator(".governance-panel")).toContainText("已通过");
  await page.getByLabel("实际成本").fill("12.50");
  await page.getByRole("button", { name: "记录成本" }).click();
  await expect(page.locator(".governance-panel")).toContainText("CNY 12.50");
  await expect(page.locator(".governance-panel")).toContainText("人工凭证");
});

test("Obsidian 搜索、关系详情与受控创建", async ({ page }) => {
  const vault = resolve(process.cwd(), "review-artifacts", "e2e-current-vault");
  await page.goto("/assets");
  await page.getByRole("tab", { name: "知识" }).click();
  await page.getByRole("button", { name: "添加 Vault" }).click();
  await page.getByLabel("名称").fill("测试知识库");
  await page.getByLabel("本地路径").fill(vault);
  await page.getByRole("button", { name: "添加 Vault", exact: true }).last().click();
  await page.getByRole("button", { name: "重新索引" }).click();
  await page.getByLabel("搜索 Obsidian").fill("微信小程序");
  await expect(page.getByRole("heading", { name: "客户A交付记录" })).toBeVisible();
  await page.locator(".knowledge-results > button").filter({ hasText: "客户A交付记录" }).click();
  await expect(page.locator(".knowledge-detail")).toContainText("知识详情");
  await expect(page.locator(".knowledge-detail")).toContainText("客户");
  await page.getByRole("button", { name: "新建笔记" }).click();
  const noteForm = page.locator(".knowledge-note-form");
  await noteForm.getByLabel("标题").fill("Phase 4 验收沉淀");
  await noteForm.getByLabel("标签").fill("验收, 知识");
  await noteForm.getByLabel("正文").fill("知识关系和受控写入已经通过端到端验证。");
  await noteForm.getByLabel("关联业务对象").selectOption({ label: "项目 · 汽水音乐实验" });
  await noteForm.getByLabel("关系").selectOption("documents");
  await noteForm.getByRole("button", { name: "创建并索引" }).click();
  await expect(page.getByText("笔记已安全写入 Vault 并完成索引。", { exact: true })).toBeVisible();
  await expect(page.locator(".knowledge-detail")).toContainText("Phase 4 验收沉淀");
  await expect(page.locator(".knowledge-detail")).toContainText("项目");
  await expect(page.locator(".knowledge-detail")).toContainText("沉淀");
  await page.getByLabel("搜索 Obsidian").fill("受控写入");
  await expect(page.locator(".knowledge-index").getByRole("heading", { name: "Phase 4 验收沉淀" })).toBeVisible();
  await page.screenshot({ path: "review-artifacts/phase4/knowledge-ui-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const knowledgeWidths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(knowledgeWidths.scroll).toBe(knowledgeWidths.client);
  await page.screenshot({ path: "review-artifacts/phase4/knowledge-ui-mobile.png", fullPage: true });

});

test("完整财务工作台从现金事实走到预算、预测、经营归因和审批", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/assets");
  await page.getByRole("tab", { name: "财务" }).click();
  await expect(page.getByRole("navigation", { name: "财务工作区" })).toBeVisible();

  await page.getByRole("button", { name: "账户", exact: true }).click();
  await page.getByRole("button", { name: "添加账户" }).click();
  await page.getByLabel("账户名称").fill("微信余额");
  await page.getByRole("button", { name: "保存账户" }).click();
  await expect(page.getByText("账户已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加账户" }).click();
  await page.getByLabel("账户名称").fill("项目银行卡");
  await page.getByRole("button", { name: "保存账户" }).click();

  await page.getByRole("button", { name: "交易", exact: true }).click();
  await page.getByRole("button", { name: "记录收支" }).first().click();
  await page.getByLabel("金额").fill("128.50");
  await page.getByLabel("说明").fill("项目首付款");
  await page.getByRole("button", { name: "保存收支" }).click();
  await expect(page.locator(".finance-table")).toContainText("项目首付款");
  await page.getByRole("button", { name: "账户转账" }).click();
  await page.getByLabel("转出账户").selectOption({ label: "微信余额 · CNY" });
  await page.getByLabel("转入账户").selectOption({ label: "项目银行卡 · CNY" });
  await page.getByLabel("转出金额").fill("10.00");
  await page.getByLabel("转入金额").fill("10.00");
  await page.getByLabel("说明").fill("资金归集");
  await page.getByRole("button", { name: "原子入账" }).click();
  await expect(page.getByText("转账两端已原子入账", { exact: true })).toBeVisible();

  const incomeRow = page.locator(".finance-table article").filter({ hasText: "项目首付款" });
  await incomeRow.getByRole("button", { name: "退款" }).click();
  await page.getByLabel("退款金额").fill("8.50");
  await page.getByRole("button", { name: "登记退款" }).click();
  await expect(page.getByText("退款已关联原交易", { exact: true })).toBeVisible();
  await incomeRow.getByRole("button", { name: "提议变更" }).click();
  await page.getByLabel("修改后的金额").fill("130.00");
  await page.getByLabel("理由").fill("按最终到账凭证修正");
  await page.getByRole("button", { name: "提交审批" }).click();
  await expect(page.getByText("变更已进入审批，不会立即修改现金事实", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "批准并执行" }).click();
  await expect(page.getByText("审批已执行并保留历史", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "预算", exact: true }).click();
  await page.getByRole("button", { name: "新建分类" }).click();
  await page.getByLabel("分类名称").fill("软件订阅");
  await page.getByRole("button", { name: "创建分类" }).click();
  await page.getByRole("button", { name: "设置预算" }).click();
  await page.getByLabel("计划金额").fill("500.00");
  await page.getByRole("button", { name: "保存预算" }).click();
  await expect(page.locator(".budget-list")).toContainText("软件订阅");

  await page.getByRole("button", { name: "预测", exact: true }).click();
  await page.getByRole("button", { name: "新建预测" }).click();
  await page.getByLabel("期初余额").fill("120.00");
  await page.getByLabel("预计收入").nth(0).fill("200.00");
  await page.getByLabel("预计支出").nth(0).fill("50.00");
  await page.getByLabel("预计收入").nth(1).fill("100.00");
  await page.getByLabel("预计支出").nth(1).fill("20.00");
  await page.getByRole("button", { name: "保存预测快照" }).click();
  await expect(page.locator(".calculation-grid")).toContainText("cashflow-v1");

  await page.getByRole("button", { name: "经营归因", exact: true }).click();
  await page.getByRole("button", { name: "新增经营单元" }).click();
  await page.getByLabel("名称").fill("汽水音乐实验账本");
  await page.getByLabel("类型").selectOption("radar");
  await page.getByRole("button", { name: "创建经营单元" }).click();
  await page.getByRole("button", { name: "分摊交易" }).click();
  const incomeOption = await page.getByLabel("真实交易").locator("option").filter({ hasText: "项目首付款" }).last().getAttribute("value");
  await page.getByLabel("真实交易").selectOption(incomeOption!);
  await page.getByLabel("分摊金额").fill("50.00");
  await page.getByRole("button", { name: "保存归因" }).click();
  await page.getByRole("button", { name: "记录计划或时间" }).click();
  await page.getByLabel("记录类型").selectOption("time");
  await page.getByLabel("分钟").fill("90");
  await page.getByLabel("说明").fill("产品验证");
  await page.getByRole("button", { name: "记录经营项" }).click();
  await expect(page.locator(".operating-metrics")).toContainText("90 分钟");
  await expect(page.locator(".operating-metrics")).toContainText("¥50.00");

  await page.screenshot({ path: "review-artifacts/phase5/finance-ui-desktop-dark.png", fullPage: true });
  await page.locator(".theme-button").click();
  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  const overflow = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")].map((element) => ({ tag: element.tagName, className: element.className, text: element.innerText?.slice(0, 60), left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })).filter((item) => item.right > document.documentElement.clientWidth + 1 || item.left < -1).slice(0, 12));
  expect(widths.scroll, JSON.stringify(overflow)).toBe(widths.client);
  await page.screenshot({ path: "review-artifacts/phase5/finance-ui-mobile-light.png", fullPage: true });
});
