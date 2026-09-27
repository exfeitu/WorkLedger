import { describe, expect, it } from "vitest";
import type { EventItem, MemoItem, TodoItem } from "@/types";
import { buildSearchIndex, findSearchResults } from "@/lib/search-index";

const timestamp = "2026-09-24T10:00:00Z";
const todos: TodoItem[] = [{
  id: "t1", title: "交换机巡检", priority: "high", status: "pending",
  tags: ["网络"], parentId: null, updatedAt: timestamp, department: "信息通信",
}];
const events: EventItem[] = [{
  id: "e1", title: "设备复查", detail: "机房 A",
  startTime: timestamp, endTime: "2026-09-24T11:00:00Z",
  tags: ["巡检"], updatedAt: timestamp,
}];
const memos: MemoItem[] = [{
  id: "m1", type: "note", title: "处置心得", content: "<p>快速定位故障</p>",
  tags: ["复盘"], createdAt: timestamp, updatedAt: timestamp,
}];

describe("search index", () => {
  it("indexes all three data types in the existing order", () => {
    expect(buildSearchIndex(events, todos, memos).map((entry) => entry.id))
      .toEqual(["todo-t1", "event-e1", "memo-m1"]);
  });
  it("matches a task by searchable department and a memo by body", () => {
    const index = buildSearchIndex(events, todos, memos);
    expect(findSearchResults(index, "信息通信").map((entry) => entry.id)).toEqual(["todo-t1"]);
    expect(findSearchResults(index, "快速定位").map((entry) => entry.id)).toEqual(["memo-m1"]);
    expect(findSearchResults(index, "   ")).toEqual([]);
  });
  it("keeps the search metadata required by filters and sorting", () => {
    const index = buildSearchIndex(events, todos, memos);
    expect(index[0]).toMatchObject({ kind: "todo", tags: ["网络"], dateValue: undefined });
    expect(index[1]).toMatchObject({ kind: "event", dateValue: timestamp });
  });
});

