import { expect, test } from "@playwright/test";

test("新版默认打开，测试标签可删除并保持删除状态", async ({ page }) => {
  await page.goto("/WorkLedger");
  await expect(page.locator(".at-root")).toBeVisible();
  await page.getByRole("button", { name: "📊 导出", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "导出数据" });
  await dialog.locator('input[type="file"]').setInputFiles({ name: "tags.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 3, events: [], todos: [], memos: [], customTags: ["1"] })) });
  await expect(dialog.getByText(/导入成功/)).toBeVisible();
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "+ 添加任务", exact: true }).click();
  await page.getByTitle('删除标签"1"', { exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "1", exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "+ 添加任务", exact: true }).click();
  await expect(page.getByTitle('删除标签"1"', { exact: true })).toHaveCount(0);
});
