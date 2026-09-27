import { expect, test } from "@playwright/test";

/**
 * 备忘录模块冒烟测试：复盘心得（富文本）+ 周期备忘（步骤清单）的完整链路。
 */

test("复盘心得：新建 → 富文本输入 → 搜索 → 编辑 → 删除", async ({ page }) => {
  await page.goto("/WorkLedger/memo");

  // 新建心得
  await page.getByRole("button", { name: "+ 新建心得" }).click();
  await page.getByRole("textbox", { name: "标题" }).fill("2026年XX项目复盘");
  // 富文本正文（fill 对 contenteditable 设置纯文本并触发 input）
  await page.locator(".rich-text-area").fill("这次项目踩了一个工资相关的坑");
  await page.getByRole("button", { name: "保存" }).click();

  // 列表出现
  await expect(page.getByText("2026年XX项目复盘").first()).toBeVisible();

  // 全文搜索命中正文内容
  await page.getByLabel("搜索备忘录").fill("工资");
  await expect(page.getByText("2026年XX项目复盘").first()).toBeVisible();
  await page.getByLabel("搜索备忘录").fill("");

  // 打开详情，正文可见
  await page.getByText("2026年XX项目复盘").first().click();
  const detail = page.locator(".memo-detail-panel");
  await expect(detail.getByText("工资相关的坑").first()).toBeVisible();

  // 详情内编辑
  await detail.getByRole("button", { name: "编辑" }).click();
  await page.getByRole("textbox", { name: "标题" }).fill("2026年XX项目复盘（改）");
  await page.getByRole("button", { name: "保存修改" }).click();

  // 删除
  await page.getByText("2026年XX项目复盘（改）").first().click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".memo-detail-panel").getByRole("button", { name: "删除" }).click();
  await expect(page.getByText("2026年XX项目复盘（改）").first()).not.toBeVisible();
});

test("全局搜索：主页搜「工资」命中备忘录", async ({ page }) => {
  // 先在备忘录页创建一条含「工资」的笔记
  await page.goto("/WorkLedger/memo");
  await page.getByRole("button", { name: "+ 新建心得" }).click();
  await page.getByRole("textbox", { name: "标题" }).fill("工资核算流程复盘");
  await page.locator(".rich-text-area").fill("涉及工资表与绩效奖金");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("工资核算流程复盘").first()).toBeVisible();

  // 回到主页全局搜索
  await page.goto("/WorkLedger");
  await page.getByRole("textbox", { name: "搜索", exact: true }).fill("工资");
  await expect(page.getByText("工资核算流程复盘").first()).toBeVisible();
});

test("周期备忘：新建 → 添加步骤与易错点 → 详情勾选进度", async ({ page }) => {
  await page.goto("/WorkLedger/memo");

  // 切到周期备忘 tab
  await page.getByRole("tab", { name: "周期备忘" }).click();
  await page.getByRole("button", { name: "+ 新建备忘" }).click();
  await page.getByRole("textbox", { name: "标题" }).fill("办理员工职务晋升");

  // 添加两个步骤
  const stepInput = page.getByPlaceholder("输入步骤内容，回车添加");
  await stepInput.fill("核对身份证复印件");
  await page.getByRole("button", { name: "添加步骤" }).click();
  await stepInput.fill("收集审批表");
  await page.getByRole("button", { name: "添加步骤" }).click();

  // 第一个步骤标记为易错点
  await page.locator(".memo-step-row").first().getByRole("button", { name: "易错点" }).click();
  await page.getByRole("button", { name: "保存" }).click();

  // 列表显示进度 0/2
  await expect(page.getByText("0/2 步").first()).toBeVisible();

  // 打开详情，勾选第一步 → 进度更新为 1/2
  await page.getByText("办理员工职务晋升").first().click();
  const detail = page.locator(".memo-detail-panel");
  await expect(detail.getByText("1/2").first()).not.toBeVisible();
  await detail.locator(".memo-step-row").first().locator('input[type="checkbox"]').check();
  await expect(detail.getByText("1/2 步已完成").first()).toBeVisible();
});
