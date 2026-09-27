import { expect, test } from "@playwright/test";

for (const width of [1440, 1100, 768, 390]) {
  test(`calendar layout ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date("2026-09-20T12:00:00"));
    await page.goto("/WorkLedger/calendar");
    const main = page.locator(".calendar-main");
    const date = main.getByLabel("跳转日期");
    const title = main.getByRole("heading", { name: "2026年9月20日", exact: true });
    await expect(title).toBeVisible();
    await expect(date).toHaveValue("2026-09-20");
    const titleBox = (await title.boundingBox())!;
    const toolbar = (await main.locator(".calendar-day-toolbar").boundingBox())!;
    expect(titleBox.y + titleBox.height).toBeLessThan(toolbar.y);
    expect(titleBox.height).toBeLessThan(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const panel = (await main.boundingBox())!;
    for (const control of await main.locator("button,input").all()) {
      const bounds = (await control.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(panel.x);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(panel.x + panel.width);
    }
    await main.screenshot({ path: info.outputPath("calendar-empty.png") });
    await page.screenshot({ path: info.outputPath("calendar-page.png"), fullPage: true });
    await date.fill("2026-09-30");
    await main.getByRole("button", { name: "后一天", exact: true }).click();
    await expect(date).toHaveValue("2026-10-01");
    await main.getByRole("button", { name: "前一天", exact: true }).click();
    await expect(date).toHaveValue("2026-09-30");
    await date.fill("");
    await expect(date).toHaveValue("2026-09-30");
    await main.getByRole("button", { name: "今天", exact: true }).click();
    await expect(date).toHaveValue("2026-09-20");
    await expect(title).toBeVisible();
    await page.getByPlaceholder("日程标题", { exact: true }).fill("日历布局回归测试");
    await page.getByRole("button", { name: "添加日程并生成待办", exact: true }).click();
    await expect(main.locator(".calendar-column-title span")).toHaveText(["1", "1"]);
    await expect(main.locator(".calendar-card")).toHaveCount(2);
    await expect(main.locator(".calendar-empty")).toHaveCount(0);
    await main.screenshot({ path: info.outputPath("calendar-populated.png") });
    await main.getByRole("button", { name: "↩ 撤销", exact: true }).click();
    await expect(main.locator(".calendar-column-title span")).toHaveText(["0", "0"]);
    await expect(main.locator(".calendar-empty")).toHaveCount(2);
  });
}
