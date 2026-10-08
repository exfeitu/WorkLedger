import { expect, test } from "@playwright/test";

/**
 * 待办归档冒烟测试：
 * 新建任务 → 标记完成 → 从待办列表消失 → 归档计数 +1 → 展开归档可见 → 恢复回列表。
 */

test("待办归档：完成后移入归档并可恢复", async ({ page }) => {
  const title = "归档测试任务";

  await page.goto("/WorkLedger");

  // 新建任务
  await page.getByRole("button", { name: "+ 添加任务" }).click();
  await page.getByLabel("任务标题").fill(title);
  await page.getByRole("button", { name: "保存任务" }).click();

  // 出现在待办列表，未完成计数为 1
  await expect(page.getByText(title).first()).toBeVisible();
  await expect(page.getByText("未完成 1 项")).toBeVisible();

  // 勾选并批量标记完成
  await page.getByRole("button", { name: "批量选择" }).click();
  await page.getByLabel(`选择 ${title}`).check();
  await page.getByRole("button", { name: "标记完成" }).click();

  // 从待办列表消失，计数归零
  // 经典时间轴仍保留已完成任务卡片；这里只检查未完成待办列表。
  await expect(page.getByRole("button", { name: `编辑任务：${title}`, exact: true })).toHaveCount(0);
  await expect(page.getByText("未完成 0 项")).toBeVisible();
  await expect(page.getByText("没有未完成的待办")).toBeVisible();

  // 归档计数 +1
  await expect(page.getByRole("button", { name: "已归档 1 条" })).toBeVisible();

  // 展开归档，任务可见
  await page.getByRole("button", { name: "已归档 1 条" }).click();
  await expect(page.getByText(title).first()).toBeVisible();

  // 恢复 → 回到待办列表
  await page.getByRole("button", { name: "恢复" }).click();
  await expect(page.getByText("未完成 1 项")).toBeVisible();
  await expect(page.getByText(title).first()).toBeVisible();
});
