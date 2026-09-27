import { describe, expect, it } from "vitest";
import { CURRENT_DATA_VERSION, migrateData, parseVersion } from "@/lib/storage-migrate";
import type { DataBundle } from "@/lib/storage-migrate";
import type { MemoItem } from "@/types";

describe("parseVersion", () => {
  it("解析整数版本", () => {
    expect(parseVersion(2)).toBe(2);
  });

  it("解析 semver 字符串", () => {
    expect(parseVersion("1.0.0")).toBe(1);
    expect(parseVersion("2.5.3")).toBe(2);
  });

  it("非法输入回退为 0", () => {
    expect(parseVersion(undefined)).toBe(0);
    expect(parseVersion("abc")).toBe(0);
    expect(parseVersion(-1)).toBe(0);
  });
});

describe("migrateData", () => {
  it("v0 → 当前版本补全 updatedAt", () => {
    const data = {
      events: [{ id: "e1", startTime: "2026-01-01T09:00:00", endTime: "2026-01-01T10:00:00", title: "a", tags: [] }],
      todos: [{ id: "t1", title: "b", priority: "medium", status: "pending", tags: [], parentId: null }],
    };
    const result = migrateData(data as never, 0);
    expect(typeof result.events[0].updatedAt).toBe("string");
    expect(typeof result.todos[0].updatedAt).toBe("string");
  });

  it("目标版本与当前版本相等时不改动", () => {
    const data: DataBundle = {
      events: [{ id: "e1", startTime: "2026-01-01T09:00:00", endTime: "2026-01-01T10:00:00", title: "a", tags: [], updatedAt: "2026-01-01T00:00:00Z" }],
      todos: [{ id: "t1", title: "b", priority: "medium", status: "pending", tags: [], parentId: null, updatedAt: "2026-01-01T00:00:00Z" }],
    };
    const result = migrateData(data, CURRENT_DATA_VERSION);
    expect(result.events[0].id).toBe("e1");
    expect(result.events[0].updatedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("不修改入参（纯函数）", () => {
    const data = {
      events: [{ id: "e1", startTime: "2026-01-01T09:00:00", endTime: "2026-01-01T10:00:00", title: "a", tags: [] }],
      todos: [],
    };
    const snapshot = JSON.stringify(data);
    migrateData(data as never, 0);
    expect(JSON.stringify(data)).toBe(snapshot);
  });

  it("v2 → v3：无 memos 时补空数组", () => {
    const data = {
      events: [],
      todos: [],
      memos: undefined,
    };
    const result = migrateData(data, 2);
    expect(result.memos).toEqual([]);
  });

  it("v2 → v3：已有 memos 时原样保留", () => {
    const memos: MemoItem[] = [{ id: "m1", type: "note", title: "复盘", tags: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }];
    const data = { events: [], todos: [], memos };
    const result = migrateData(data, 2);
    expect(result.memos).toEqual(memos);
  });

  it("当前版本为 3", () => {
    expect(CURRENT_DATA_VERSION).toBe(3);
  });
});
