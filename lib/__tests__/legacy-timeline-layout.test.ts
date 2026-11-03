import { describe, expect, it } from "vitest";
import type { EventItem, TodoItem } from "@/types";
import { buildTimelineItems, todoToTimeline } from "../legacy-timeline-layout";

const todo = (id: string, time = "09:00", status: TodoItem["status"] = "pending"): TodoItem => ({
  id, title: id, startTime: "2026-11-03T" + time + ":00", priority: "medium",
  status, tags: [], parentId: null, updatedAt: "",
});
const event = (id: string, from = "09:00", to = "10:00"): EventItem => ({
  id, title: id, startTime: "2026-11-03T" + from + ":00", endTime: "2026-11-03T" + to + ":00",
  tags: [], updatedAt: "",
});

describe("经典版时间轴条目", () => {
  it("只绘制未开始与进行中的待办，已完成和已取消都不出现", () => {
    const items = buildTimelineItems([], [
      todo("pending", "09:00"),
      todo("doing", "10:00", "in_progress"),
      todo("done", "11:00", "completed"),
      todo("cancelled", "12:00", "cancelled"),
    ]);
    expect(items.map((item) => item.id)).toEqual(["pending", "doing"]);
  });

  it("工作记录不受待办状态过滤影响，且与待办按开始时间混合排序", () => {
    const items = buildTimelineItems(
      [event("e1", "08:30")],
      [todo("t1", "09:00"), todo("done", "07:00", "completed")],
    );
    expect(items.map((item) => item.id)).toEqual(["e1", "t1"]);
    expect(items.map((item) => item.kind)).toEqual(["event", "todo"]);
  });
});

describe("待办时间跨度", () => {
  it("普通待办固定 30 分钟，结束晚于开始", () => {
    const item = todoToTimeline(todo("t", "09:00"));
    expect(item.startTime).toBe("2026-11-03T09:00:00");
    expect(item.endTime).toBe("2026-11-03T09:30:00");
  });

  it("跨零点的待办结束时间落到次日，不会早于开始", () => {
    const item = todoToTimeline(todo("t", "23:45"));
    expect(item.startTime).toBe("2026-11-03T23:45:00");
    expect(item.endTime).toBe("2026-11-04T00:15:00");
    expect(new Date(item.endTime).getTime()).toBeGreaterThan(new Date(item.startTime).getTime());
  });

  it("只有截止日期的待办锚定在上限位置，同样保持正向时长", () => {
    const item = todoToTimeline({ ...todo("t"), startTime: undefined, dueDate: "2026-11-03T23:50:00" });
    expect(item.endTime).toBe("2026-11-04T00:20:00");
    expect(new Date(item.endTime).getTime()).toBeGreaterThan(new Date(item.startTime).getTime());
  });
});
