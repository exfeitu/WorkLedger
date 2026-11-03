import { describe, expect, it } from "vitest";
import type { EventItem, TodoItem } from "@/types";
import { adaptiveViewForDays, buildDetailedTodoMarkers, layoutDetailedEvents, buildDaySummaries, densityLevel, todoAnchorMs, startOfLocalDay, shiftDate, isTodoOverdue } from "../timeline-adaptive";
const start = +new Date("2026-09-14T00:00:00");
const end = +new Date("2026-09-15T00:00:00");
const todo = (id: string, time = "09:00", priority: TodoItem["priority"] = "medium"): TodoItem => ({
  id, title: id, startTime: "2026-09-14T" + time + ":00", priority, status: "pending", tags: [], parentId: null, updatedAt: "",
});
const event = (id: string, from = "09:00", to = "11:00"): EventItem => ({
  id, title: id, startTime: "2026-09-14T" + from + ":00", endTime: "2026-09-14T" + to + ":00", tags: [], updatedAt: "",
});
describe("自适应模式与日期", () => {
  it("按阈值切换四种表现，而非一直压缩卡片", () => {
    expect([1, 1.75, 1.76, 3, 4.5, 4.51, 7, 10, 10.1, 30].map(adaptiveViewForDays))
      .toEqual(["day", "day", "three", "three", "three", "week", "week", "week", "month", "month"]);
  });
  it("本地日期跨月导航", () => {
    expect(shiftDate("2026-09-30", 1)).toBe("2026-10-01");
    expect(startOfLocalDay("2026-09-14").getDate()).toBe(14);
  });
});
describe("真实时间待办节点", () => {
  it("相邻但不同时拥挤的任务复用层，不链式聚合整段时间", () => {
    const source = ["08:00", "09:30", "11:00", "12:30", "14:00"].map((time, i) => todo(String(i), time));
    expect(buildDetailedTodoMarkers(source, 108).map(m => [m.kind, m.lane])).toEqual([
      ["item", 0], ["item", 1], ["item", 0], ["item", 1], ["item", 0],
    ]);
  });
  it("聚合窗口不会随成员延长，后续时段继续独立展示", () => {
    const source = ["09:00", "09:10", "09:20", "09:30", "09:50", "10:00", "10:50"].map((time, i) => todo(String(i), time));
    const markers = buildDetailedTodoMarkers(source, 60);
    expect(markers.map(m => m.kind)).toEqual(["cluster", "item", "item"]);
    if (markers[0].kind === "cluster") expect(markers[0].todos).toHaveLength(5);
    expect(markers[1].anchorMs).toBe(todoAnchorMs(source[5]));
    expect(source).toHaveLength(7);
  });
  it("三天模式的聚合也保留不同时段的分布", () => {
    const markers = buildDetailedTodoMarkers(["08:00", "09:00", "10:00", "11:00"].map((t, i) => todo(String(i), t)), 90, 2);
    expect(markers).toHaveLength(2);
    expect(markers.map(m => m.anchorMs)).toEqual([todoAnchorMs(todo("a", "08:00")), todoAnchorMs(todo("b", "10:00"))]);
  });
  it("大量不均匀时间输入无丢失、不改原数据，层内标签不相撞", () => {
    const source = Array.from({ length: 150 }, (_, i) => ({ ...todo(String(i)), startTime: new Date(start + ((i * 97) % 1440) * 60000).toISOString() }));
    const before = JSON.stringify(source);
    const markers = buildDetailedTodoMarkers(source, 108, 4, end);
    expect(markers.flatMap(m => m.kind === "item" ? [m.todo.id] : m.todos.map(t => t.id)).sort()).toEqual(source.map(t => t.id).sort());
    expect(JSON.stringify(source)).toBe(before);
    for (let lane = 0; lane < 3; lane++) {
      const sameLane = markers.filter(m => m.lane === lane);
      for (let i = 1; i < sameLane.length; i++) {
        expect(Math.min(sameLane[i].anchorMs, end - 108 * 60000) - Math.min(sameLane[i - 1].anchorMs, end - 108 * 60000)).toBeGreaterThanOrEqual(108 * 60000);
      }
    }
  });
  it("逾期只按截止时间判断，不移动锚点、不误标完成任务", () => {
    const now = +new Date("2026-09-14T14:00:00");
    const past = { ...todo("past", "09:30"), dueDate: "2026-09-14T10:00:00" };
    expect(isTodoOverdue(past, now)).toBe(true);
    expect(todoAnchorMs(past)).toBe(+new Date("2026-09-14T09:30:00"));
    expect(isTodoOverdue(todo("only-start"), now)).toBe(false);
    expect(isTodoOverdue({ ...past, status: "completed" }, now)).toBe(false);
    expect(isTodoOverdue({ ...past, status: "cancelled" }, now)).toBe(false);
    expect(isTodoOverdue({ ...past, dueDate: "2026-09-14" }, now)).toBe(false);
    expect(isTodoOverdue({ ...past, dueDate: "2026-09-13" }, now)).toBe(true);
    expect(isTodoOverdue({ ...past, dueDate: "invalid" }, now)).toBe(false);
  });
  it("午夜边界向内显示的标题仍参与碰撞计算", () => {
    const markers = buildDetailedTodoMarkers([todo("a", "22:40"), todo("b", "23:59")], 90, 4, end);
    expect(markers.map(m => m.lane)).toEqual([0, 1]);
    expect(markers[1].anchorMs).toBe(todoAnchorMs(todo("b", "23:59")));
  });
  it.each([2, 3])("%i 个相近任务保持独立并向下错层", (count) => {
    const source = Array.from({ length: count }, (_, i) => todo(String(i), "09:" + String(i * 10).padStart(2, "0")));
    const markers = buildDetailedTodoMarkers(source);
    expect(markers).toHaveLength(count);
    expect(markers.map(m => m.lane)).toEqual(Array.from({ length: count }, (_, i) => i));
    markers.forEach((m, i) => { expect(m.kind).toBe("item"); expect(m.anchorMs).toBe(todoAnchorMs(source[i])); });
  });
  it.each([4, 20])("%i 个接近任务聚合，内容无遗漏", count => {
    const source = Array.from({ length: count }, (_, i) => todo(String(i)));
    const [marker] = buildDetailedTodoMarkers(source);
    expect(marker.kind).toBe("cluster");
    if (marker.kind === "cluster") expect(marker.todos).toHaveLength(count);
    expect(marker.anchorMs).toBe(todoAnchorMs(source[0]));
  });
  it("远离的节点复用第一层，三天模式可将两个节点聚合", () => {
    expect(buildDetailedTodoMarkers([todo("a"), todo("b", "12:00")]).map(m => m.lane)).toEqual([0, 0]);
    expect(buildDetailedTodoMarkers([todo("a"), todo("b", "09:10")], 90, 2)[0].kind).toBe("cluster");
  });
  it("未设时间、取消项与完成项都不绘制", () => {
    const source = [
      { ...todo("a"), startTime: undefined },
      { ...todo("b"), status: "cancelled" as const },
      { ...todo("c"), status: "completed" as const },
      todo("d"),
    ];
    expect(buildDetailedTodoMarkers(source).map(m => m.id)).toEqual(["d"]);
  });
});
describe("记录分层及真实持续时间", () => {
  it("前三条分到三层，第四条进入溢出列表", () => {
    const layout = layoutDetailedEvents(["a", "b", "c", "d"].map(id => event(id)), start, end);
    expect(layout.visible.map(e => e.lane)).toEqual([0, 1, 2]);
    expect(layout.overflow[0].events.map(e => e.id)).toEqual(["d"]);
  });
  it("相邻区间不重叠；极短记录不人为扩宽", () => {
    const layout = layoutDetailedEvents([event("a", "09:00", "10:00"), event("b", "10:00", "10:01")], start, end);
    expect(layout.visible.map(e => e.lane)).toEqual([0, 0]);
    expect(layout.visible[1].leftPercent).toBeCloseTo(100 * 10 / 24);
    expect(layout.visible[1].widthPercent).toBeCloseTo(100 / 1440);
  });
  it("跨日区间裁剪，无效和逆序记录排除", () => {
    const overnight = { ...event("a"), startTime: "2026-09-13T23:00:00", endTime: "2026-09-14T01:00:00" };
    const layout = layoutDetailedEvents([overnight, event("b", "12:00", "11:00"), { ...event("c"), endTime: "invalid" }], start, end);
    expect(layout.visible).toHaveLength(1);
    expect(layout.visible[0].leftPercent).toBe(0);
    expect(layout.visible[0].widthPercent).toBeCloseTo(100 / 24);
  });
});
describe("每日统计与月密度", () => {
  it("7 天统计高中低、完成项与跨日工时，未安排任务不重复计入", () => {
    const summaries = buildDaySummaries(start, 7, [
      todo("h", "09:00", "high"), todo("m"), { ...todo("l", "10:00", "low"), status: "completed" },
      { ...todo("u"), startTime: undefined },
    ], [event("a", "09:00", "11:30"), { ...event("b"), startTime: "2026-09-14T23:00:00", endTime: "2026-09-15T02:00:00" }]);
    expect(summaries).toHaveLength(7);
    expect(summaries[0].priorityCounts).toEqual({ high: 1, medium: 1, low: 1 });
    expect(summaries[0].eventHours).toBe(3.5);
    expect(summaries[1].eventHours).toBe(2);
    expect(summaries[1].events).toHaveLength(1);
    expect(summaries.slice(1).every(d => d.todos.length === 0)).toBe(true);
  });
  it("相对强度映射到 0—5，正确处理空值和上限", () => {
    expect([0, 1, 2, 4, 6, 8, 10, 20].map(v => densityLevel(v, 10))).toEqual([0, 1, 1, 2, 3, 4, 5, 5]);
    expect(densityLevel(1, 0)).toBe(0);
    expect(densityLevel(NaN, 10)).toBe(0);
  });
});
