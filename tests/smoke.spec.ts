import { expect, test } from "@playwright/test";

/**
 * 冒烟测试：覆盖主用户路径。
 * 打开 → 新建任务 → 搜索验证 → 编辑 → 删除。
 */
test("主流程：新建任务 → 搜索 → 编辑 → 删除", async ({ page }) => {
  const title = "E2E 冒烟测试任务";

  // baseURL 含 basePath，绝对路径 goto("/") 会丢弃 /WorkLedger，需写完整路径
  await page.goto("/WorkLedger");

  // 新建任务
  await page.getByRole("button", { name: "+ 添加任务" }).click();
  await page.getByLabel("任务标题").fill(title);
  await page.getByRole("button", { name: "保存任务" }).click();

  // 在待办树中出现
  await expect(page.getByText(title).first()).toBeVisible();

  // 搜索命中
  await page.getByRole("textbox", { name: "搜索", exact: true }).fill("冒烟");
  await expect(page.getByRole("search").getByRole("heading", { name: title })).toBeVisible();

  // 清空搜索，进入待办树编辑
  await page.getByRole("textbox", { name: "搜索", exact: true }).fill("");
  await page.getByRole("button", { name: `编辑任务：${title}`, exact: true }).click();

  // 编辑弹窗中删除（确认对话框）
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除任务" }).click();

  // 删除后从待办树消失
  await expect(page.getByText(title).first()).not.toBeVisible();
});
