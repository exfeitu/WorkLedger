import { expect, test, type Page } from "@playwright/test";
import type { EventItem, TodoItem } from "../types";

const date = "2026-09-14";
const stamp = (time: string) => `${date}T${time}:00`;
const task = (id: string, time: string, priority: TodoItem["priority"] = "medium"): TodoItem => ({
  id, title: `任务${id} · 完整标题验证`, startTime: stamp(time), priority, status: "pending", parentId: null,
  tags: ["测试"], department: "技术部", contactPerson: "小林", remarks: "核对时间位置", updatedAt: stamp("08:00"),
});
const todos: TodoItem[] = [task("A", "08:00", "high"), { ...task("B", "08:10"), status: "in_progress" },
  task("C", "12:00"), task("D", "12:10", "low"), { ...task("E", "12:20", "low"), status: "completed" },
  ...["F", "G", "H", "I"].map(id => task(id, "16:00", "high")),
  task("晚", "23:59"), { ...task("未定", "00:00"), startTime: undefined }];
const events: EventItem[] = ["a", "b", "c", "d"].map((id, index) => ({
  id, title: `工作记录${id}`, startTime: stamp("09:00"), endTime: stamp(index === 0 ? "11:00" : "10:00"),
  detail: "详情不会常驻时间块", tags: ["测试"], linkedTodoIds: index === 0 ? ["A"] : [], updatedAt: stamp("08:00"),
}));

async function loadFixture(page: Page, data = { events, todos }, legacy = false) {
  await page.goto("/WorkLedger");
  await page.getByRole("button", { name: "📊 导出", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "导出数据", exact: true });
  // 使用产品导入入口，在 Playwright 隔离浏览器中装载，不直接操作存储。
  await dialog.locator('input[type="file"]').setInputFiles({ name: "timeline.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 3, ...data, memos: [], customTags: [] })) });
  await expect(dialog.getByText(/导入成功/)).toBeVisible();
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.locator(".legacy-timeline")).toBeVisible();
  if (!legacy) await page.getByRole("button", { name: "切换到新版时间轴", exact: true }).click();
  await page.getByLabel(legacy ? "旧版跳转日期" : "跳转日期", { exact: true }).fill(date);
}

test.use({ viewport: { width: 1600, height: 1000 } });

test("默认经典时间轴可切换、缩放、跳转并编辑同一份数据", async ({ page }, info) => {
  await page.clock.setFixedTime(new Date(`${date}T14:00:00`));
  await loadFixture(page, { todos: [todos[0]], events: [events[0]] }, true);
  const legacy = page.locator(".legacy-timeline");
  await expect(legacy).toBeVisible();
  expect(await legacy.locator(".line-timeline-shell").evaluate(n => n.clientHeight)).toBeLessThanOrEqual(360);
  await expect(page.locator(".at-root")).toHaveCount(0);
  await legacy.getByLabel("旧版跳转日期").fill(date);
  await expect(legacy.locator(".line-event-card").filter({ hasText: "工作记录a" })).toBeVisible();
  await expect(legacy.locator(".line-todo-card")).toHaveCount(1);
  await expect(legacy.locator(".timeline-event-strip, .timeline-task-node")).toHaveCount(0);
  await legacy.getByRole("button", { name: "＋", exact: true }).click();
  await expect(legacy.locator(".axis-zoom-value")).toHaveText("105%");
  await legacy.screenshot({ path: info.outputPath("legacy-timeline.png") });
  await legacy.locator(".line-event-card").filter({ hasText: "工作记录a" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "切换到新版时间轴", exact: true }).click();
  await expect(page.locator(".at-root")).toBeVisible();
  await expect(page.locator(".legacy-timeline")).toHaveCount(0);
  await expect(page.locator(".at-heading")).toContainText("12 小时");
  await expect(page.locator('.at-root [data-event-id="a"]')).toHaveCount(1);
  await page.reload();
  await expect(legacy.locator(".line-timeline-shell")).toBeVisible();
  await expect(page.locator(".at-root")).toHaveCount(0);
  await page.getByRole("button", { name: "切换到新版时间轴", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "切换到旧版时间轴", exact: true }).click();
  await expect(legacy.locator(".line-timeline-shell")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("经典旧版密集任务及记录始终逐项显示卡片，缩小不聚合", async ({ page }, info) => {
  await page.clock.setFixedTime(new Date(`${date}T14:00:00`));
  await loadFixture(page, { todos: ["甲", "乙", "丙", "丁"].map(id => task(id, "09:00")), events }, true);
  const legacy = page.locator(".legacy-timeline");
  await legacy.getByLabel("旧版跳转日期").fill(date);
  await expect(legacy.locator(".line-event-card")).toHaveCount(8);
  await expect(legacy.locator(".line-todo-card")).toHaveCount(4);
  for (let i = 0; i < 18; i++) await legacy.getByRole("button", { name: "－", exact: true }).click();
  await expect(legacy.locator(".axis-zoom-value")).toHaveText("10%");
  await expect(legacy.locator(".line-event-card")).toHaveCount(8);
  for (const width of await legacy.locator(".line-event-card").evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width))) {
    expect(width).toBeGreaterThanOrEqual(190);
    expect(width).toBeLessThanOrEqual(260);
  }
  const boxes = await legacy.locator(".line-event-card").evaluateAll(nodes => nodes.map(n => {
    const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
  }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
  }
  await expect(legacy.locator(".line-event-card p").first()).toContainText("详情不会常驻时间块");
  await legacy.screenshot({ path: info.outputPath("classic-full-cards.png") });
});

test("打开时按早班晚班自动定位，空日使用默认工作时段", async ({ page }) => {
  for (const [from, to, hour] of [["05:30", "14:00", 5.5], ["16:00", "23:00", 11], ["", "", 8]] as const) {
    await loadFixture(page, { todos: [], events: from ? [{ ...events[0], startTime: stamp(from), endTime: stamp(to) }] : [] });
    const scroll = page.locator(".at-scroll");
    await expect.poll(() => scroll.evaluate(n => (n.scrollLeft / (n.clientWidth * 2) - 2) * 24)).toBeCloseTo(hour, 1);
    if (from) {
      const bounds = (await scroll.boundingBox())!;
      const record = (await page.locator('[data-current="true"] .at-event').boundingBox())!;
      expect(record.x).toBeGreaterThanOrEqual(bounds.x - 1);
      expect(record.x + record.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    }
  }
});

test("12 小时工作窗口与跨午夜连续平移", async ({ page }, info) => {
  await loadFixture(page, { todos: [task("早", "09:15"), task("晚", "17:30")], events: [
    { ...events[0], startTime: stamp("09:00"), endTime: stamp("12:00") },
    { ...events[1], startTime: stamp("14:00"), endTime: stamp("19:00") },
  ] });
  const root = page.locator(".at-root");
  const scroll = root.locator(".at-scroll");
  const current = root.locator('[data-current="true"]');
  const bounds = (await scroll.boundingBox())!;
  expect((await current.boundingBox())!.x).toBeCloseTo(bounds.x - bounds.width * 8 / 12, 0);
  expect((await current.boundingBox())!.width).toBeCloseTo(bounds.width * 2, 0);
  expect(await root.getByRole("button", { name: "1天", exact: true }).evaluate(n => getComputedStyle(n).backgroundColor)).toBe("rgb(79, 143, 99)");
  for (const name of [/任务早.*09:15/, /任务晚.*17:30/]) {
    const box = (await current.getByRole("button", { name }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(bounds.x);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  }
  await root.screenshot({ path: info.outputPath("full-day.png") });
  const next = root.locator('[data-date="2026-09-15"]');
  await scroll.evaluate(n => { n.scrollLeft += n.clientWidth * 1.5; });
  const before = (await next.boundingBox())!.x;
  await expect(root.getByLabel("跳转日期")).toHaveValue("2026-09-15");
  expect((await next.boundingBox())!.x).toBeCloseTo(before, 0);
  await root.screenshot({ path: info.outputPath("midnight-continuous.png") });
  await root.getByRole("button", { name: "后一时间段" }).click();
  await expect(root.getByLabel("跳转日期")).toHaveValue("2026-09-16");
  expect((await root.locator('[data-current="true"]').boundingBox())!.x).toBeCloseTo(before, 0);
  await root.getByLabel("跳转日期").fill("2026-09-30");
  const motion = await root.evaluate(async node => {
    const day = node.querySelector('[data-date="2026-10-01"]')!;
    const samples: number[] = [];
    (node.querySelector('[aria-label="后一时间段"]') as HTMLButtonElement).click();
    for (let i = 0; i < 70; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      samples.push(day.getBoundingClientRect().x);
    }
    return { samples, retained: day.isConnected };
  });
  expect(motion.retained).toBe(true);
  expect(new Set(motion.samples.map(Math.round)).size).toBeGreaterThan(5);
  for (let i = 1; i < motion.samples.length; i++) {
    expect(motion.samples[i] - motion.samples[i - 1]).toBeLessThanOrEqual(1);
  }
  await expect(root.getByLabel("跳转日期")).toHaveValue("2026-10-01");
  await root.getByRole("button", { name: "后一时间段" }).evaluate(node => {
    for (let i = 0; i < 5; i++) (node as HTMLButtonElement).click();
  });
  await expect(root.getByLabel("跳转日期")).toHaveValue("2026-10-06");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => current.evaluate(n => Math.abs(n.getBoundingClientRect().width - n.closest('.at-scroll')!.clientWidth * 2))).toBeLessThan(1);
});

test("approved-visual-tasks-across-time", async ({ page }, info) => {
  await page.clock.setFixedTime(new Date(`${date}T14:00:00`));
  const visualTodos: TodoItem[] = [
    { ...task("overdue", "09:30", "high"), title: "提交周报", dueDate: stamp("09:30") },
    { ...task("done", "11:30", "low"), title: "核对资料", status: "completed" },
    { ...task("now", "14:00"), title: "整理问题清单", status: "in_progress" },
    { ...task("later", "16:00", "high"), title: "项目评审" },
  ];
  const visualEvents = [
    ["08:00", "09:00", "需求梳理"], ["08:30", "09:20", "晨会"], ["09:15", "10:30", "接口开发"],
    ["10:00", "11:00", "问题沟通"], ["10:15", "10:45", "电话支持"], ["10:45", "12:00", "联调排查"],
    ["11:30", "12:30", "数据核对"], ["13:00", "14:00", "文档整理"],
  ].map(([from, to, title], index) => ({ ...events[0], id: `visual-${index}`, title, startTime: stamp(from), endTime: stamp(to), linkedTodoIds: [] }));
  await loadFixture(page, { todos: visualTodos, events: visualEvents });
  const root = page.locator(".at-root");
  await expect(root.locator(".at-todo")).toHaveCount(4);
  await expect(root.locator(".at-cluster")).toHaveCount(0);
  await expect(root.locator(".at-overdue")).toHaveText("逾期未完成");
  await expect(root.locator('[data-current="true"] .at-day')).toHaveAttribute("data-todo-lanes", "1");
  const overdue = root.getByRole("button", { name: /提交周报，09:30.*逾期未完成/ });
  const noon = root.locator(".at-now");
  expect((await overdue.boundingBox())!.x).toBeLessThan((await noon.boundingBox())!.x);
  await expect(root.locator(".at-status-completed .at-pin")).toHaveText("✓");
  await expect(root.locator(".at-status-in_progress")).toHaveCount(1);
  await expect(root.getByText("未来安排")).toHaveCount(0);
  await expect(root.getByText("已发生")).toHaveCount(0);
  await root.locator(".at-scroll").focus();
  await root.screenshot({ path: info.outputPath("approved-day.png") });
  await overdue.click();
  await expect(root.getByRole("complementary", { name: "时间轴详情" }).getByText("2026/09/14 09:30").first()).toBeVisible();
  await root.screenshot({ path: info.outputPath("approved-detail.png") });
  await root.getByRole("button", { name: "关闭详情" }).click();
  await root.getByRole("button", { name: "3天", exact: true }).click();
  await expect(root.getByRole("button", { name: "2项待办", exact: true })).toHaveCount(2);
  await root.screenshot({ path: info.outputPath("approved-three.png") });
  await root.getByRole("button", { name: "1天", exact: true }).click();
  await root.getByLabel("跳转日期").fill("2026-09-13");
  await root.getByRole("button", { name: "今天", exact: true }).click();
  await expect(root.getByLabel("跳转日期")).toHaveValue(date);
  const box = (await root.locator(".at-scroll").boundingBox())!;
  await expect.poll(async () => Math.abs((await noon.boundingBox())!.x - (box.x + box.width * (14 - 8) / 12))).toBeLessThan(3);
});

test("day-baseline-step1", async ({ page }, info) => {
  await page.clock.setFixedTime(new Date("2026-09-14T12:27:00"));
  await loadFixture(page);
  const root = page.locator(".at-root");
  const scroll = root.locator(".at-scroll");
  await expect(root.getByRole("complementary", { name: "时间轴详情" })).toHaveCount(0);
  const fullWidth = await scroll.evaluate(n => n.clientWidth);
  expect(fullWidth).toBeGreaterThan(1300);
  await expect(root.locator(".at-now")).toContainText("12:27");
  const nowLabel = (await root.locator(".at-now > span").boundingBox())!;
  const noonTick = (await root.locator('[data-current="true"] .at-hour-axis').getByText("12:00", { exact: true }).boundingBox())!;
  expect(nowLabel.y + nowLabel.height).toBeLessThan(noonTick.y);
  expect(await root.locator(".at-todo-label strong").first().evaluate(n => getComputedStyle(n).fontSize)).toBe("14px");
  await root.screenshot({ path: info.outputPath("day-full-width.png") });
  await scroll.evaluate(n => { n.scrollLeft += 50; });
  const left = await scroll.evaluate(n => n.scrollLeft / n.clientWidth);
  await root.getByRole("button", { name: /任务C.*12:00/ }).click();
  await expect.poll(() => scroll.evaluate(n => n.clientWidth)).toBeLessThan(fullWidth);
  expect(await scroll.evaluate(n => n.scrollLeft / n.clientWidth)).toBeCloseTo(left, 2);
  await root.screenshot({ path: info.outputPath("day-detail.png") });
  await root.getByRole("button", { name: "关闭详情", exact: true }).click();
  await expect.poll(() => scroll.evaluate(n => n.clientWidth)).toBe(fullWidth);
  expect(await scroll.evaluate(n => n.scrollLeft / n.clientWidth)).toBeCloseTo(left, 2);
  const denseHeight = await root.locator(".at-time-area").evaluate(n => n.clientHeight);
  await loadFixture(page, { todos: [todos[0]], events: [events[0]] });
  const sparseHeight = await root.locator(".at-time-area").evaluate(n => n.clientHeight);
  expect(denseHeight - sparseHeight).toBeGreaterThan(200);
  await root.screenshot({ path: info.outputPath("day-sparse.png") });
});

test("详细视图：真实时间、2/3 错层、4 项聚合、记录溢出和详情编辑", async ({ page }, info) => {
  await loadFixture(page);
  const root = page.locator(".at-root");
  await expect(root).toHaveAttribute("data-view", "day");
  await expect(root.locator(".at-todo")).toHaveCount(6);
  const a = root.getByRole("button", { name: /任务A.*08:00/ });
  const b = root.getByRole("button", { name: /任务B.*08:10/ });
  expect((await b.boundingBox())!.y - (await a.boundingBox())!.y).toBe(60);
  const tops = await root.locator(".at-todo-label").evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
  }));
  for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) {
    const a = tops[i], b = tops[j];
    expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
  }
  await expect(root.locator(".at-event")).toHaveCount(3);
  expect(await root.locator(".at-event").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-lane")))).toEqual(["0", "1", "2"]);
  const canvasWidth = await root.locator('[data-current="true"] .at-day').evaluate(node => node.getBoundingClientRect().width);
  expect((await root.locator('[data-event-id="a"]').boundingBox())!.width).toBeCloseTo(canvasWidth * 2 / 24, 0);
  await a.click();
  const details = page.getByRole("complementary", { name: "时间轴详情" });
  await expect(details.getByText("技术部")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await details.getByRole("button", { name: "工作记录a", exact: true }).click();
  await expect(details.getByText("详情不会常驻时间块")).toBeVisible();
  await details.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await root.getByRole("button", { name: "+1记录", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "+1记录" }).getByText("工作记录d")).toBeVisible();
  await page.keyboard.press("Escape");
  await root.getByRole("button", { name: "4项待办", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "4项待办" }).locator("div > button")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await a.click();
  await root.screenshot({ path: info.outputPath("timeline-day.png") });
});

test("3/7/30 天降低密度、月视图回到当天、日期导航和滚轮阈值", async ({ page }, info) => {
  await loadFixture(page);
  const root = page.locator(".at-root");
  await root.getByRole("button", { name: "3天", exact: true }).click();
  await expect(root.locator(".at-day")).toHaveCount(3);
  await expect(root.locator(".at-todo-label")).toHaveCount(0);
  await root.screenshot({ path: info.outputPath("timeline-three.png") });
  await root.getByRole("button", { name: "7天", exact: true }).click();
  const first = root.locator(".at-week-day").first();
  await expect(first.getByText("高 5", { exact: true })).toBeVisible();
  await expect(first.getByText("中 3", { exact: true })).toBeVisible();
  await expect(first.getByText("低 2", { exact: true })).toBeVisible();
  await expect(first.getByText("4 条", { exact: true })).toBeVisible();
  await expect(first.getByText("5.0h", { exact: true })).toBeVisible();
  await root.screenshot({ path: info.outputPath("timeline-week.png") });
  await root.getByRole("button", { name: "30天", exact: true }).click();
  await expect(root.locator(".at-month-day")).toHaveCount(30);
  await root.locator(".at-month-day").first().hover();
  await expect(root.getByRole("status")).toContainText("高 5 / 中 3 / 低 2");
  await expect(root.locator(".at-heat-todo.level-5")).toHaveCount(1);
  await root.screenshot({ path: info.outputPath("timeline-month.png") });
  await root.locator(".at-month-day").nth(2).click();
  await expect(root).toHaveAttribute("data-view", "day");
  await expect(root.getByLabel("跳转日期")).toHaveValue("2026-09-16");
  await root.getByRole("button", { name: "后一时间段" }).click();
  await expect(root.getByLabel("跳转日期")).toHaveValue("2026-09-17");
  await root.getByRole("button", { name: "前一时间段" }).click();
  await expect(root.getByLabel("跳转日期")).toHaveValue("2026-09-16");
  for (const mode of ["three", "week", "month"]) {
    await root.locator(".at-scroll").dispatchEvent("wheel", { deltaY: 400 });
    await expect(root).toHaveAttribute("data-view", mode);
  }
  await root.locator(".at-scroll").dispatchEvent("wheel", { deltaY: -2000 });
  await expect(root).toHaveAttribute("data-view", "day");
  const scroll = root.locator(".at-scroll");
  const before = await scroll.evaluate(n => n.scrollLeft);
  const bounds = (await scroll.boundingBox())!;
  await page.mouse.move(bounds.x + 250, bounds.y + bounds.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds.x + 150, bounds.y + bounds.height / 2); await page.mouse.up();
  expect(await scroll.evaluate(n => n.scrollLeft)).toBeGreaterThan(before);
});

test("窄屏不溢出页面，聚合列表可键盘关闭", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page);
  const root = page.locator(".at-root");
  await root.locator(".at-cluster").first().click();
  const dialog = page.locator(".at-popover");
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
