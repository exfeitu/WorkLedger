import { describe, expect, it } from "vitest";
import type { EventItem, TodoItem } from "@/types";
import {
  deleteTodos, deleteWorkRecord, restoreTodo, setTodosStatus,
  upsertTodo, upsertWorkRecord, type LedgerSnapshot,
} from "@/lib/ledger-operations";

const timestamp = "2026-09-24T10:00:00.000Z";
const task = (id: string): TodoItem => ({
  id, title: id, priority: "medium", status: "pending", tags: [],
  parentId: null, updatedAt: timestamp, linkedEventIds: [],
});
const record = (id: string): EventItem => ({
  id, title: id, startTime: "2026-09-24T09:00:00",
  endTime: "2026-09-24T10:00:00", tags: [],
  updatedAt: timestamp, linkedTodoIds: [],
});
const empty = (): LedgerSnapshot => ({ events: [], todos: [] });

describe("ledger operations", () => {
  it("creates and updates tasks without mutating the previous snapshot", () => {
    const original = empty();
    const added = upsertTodo(original, task("a"));
    const updated = upsertTodo(added, { ...task("a"), title: "updated" });
    expect(original.todos).toEqual([]);
    expect(added.todos[0].title).toBe("a");
    expect(updated.todos).toHaveLength(1);
    expect(updated.todos[0].title).toBe("updated");
  });

  it("upserts a work record with a symmetric task link", () => {
    const source = { events: [], todos: [task("a")] };
    const result = upsertWorkRecord(source, record("e"), "a");
    expect(result.events[0].linkedTodoIds).toEqual(["a"]);
    expect(result.todos[0].linkedEventIds).toEqual(["e"]);
    expect(source.todos[0].linkedEventIds).toEqual([]);
  });

  it("switching a record's selected task clears the old symmetric link", () => {
    const source = upsertWorkRecord(
      { events: [], todos: [task("a"), task("b")] }, record("e"), "a",
    );
    const updated = upsertWorkRecord(source, { ...source.events[0], title: "edited" }, "b");
    expect(updated.events[0].linkedTodoIds).toEqual(["b"]);
    expect(updated.todos[0].linkedEventIds).toEqual([]);
    expect(updated.todos[1].linkedEventIds).toEqual(["e"]);
  });

  it("removing the selected task truly unlinks both sides", () => {
    const source = upsertWorkRecord({ events: [], todos: [task("a")] }, record("e"), "a");
    const updated = upsertWorkRecord(source, source.events[0], null);
    expect(updated.events[0].linkedTodoIds).toEqual([]);
    expect(updated.todos[0].linkedEventIds).toEqual([]);
  });

  it("deleting one record removes its links but retains unrelated records", () => {
    const source = upsertWorkRecord({ events: [record("keep")], todos: [task("a")] }, record("e"), "a");
    const result = deleteWorkRecord(source, "e");
    expect(result.events.map((item) => item.id)).toEqual(["keep"]);
    expect(result.todos[0].linkedEventIds).toEqual([]);
    expect(source.events).toHaveLength(2);
  });

  it("deleting selected tasks removes their reciprocal links", () => {
    const source = upsertWorkRecord(
      { events: [record("e")], todos: [task("a"), task("b")] },
      record("e"), "a",
    );
    const result = deleteTodos(source, new Set(["a"]));
    expect(result.todos.map((item) => item.id)).toEqual(["b"]);
    expect(result.events[0].linkedTodoIds).toEqual([]);
    expect(source.todos).toHaveLength(2);
  });

  it("restores and bulk-updates status using an explicit timestamp", () => {
    const source: LedgerSnapshot = {
      events: [], todos: [{ ...task("a"), status: "completed" }, task("b")],
    };
    const restored = restoreTodo(source, "a", "new");
    expect(restored.todos[0]).toMatchObject({ status: "in_progress", updatedAt: "new" });
    const changed = setTodosStatus(restored, new Set(["a", "b"]), "completed", "bulk");
    expect(changed.todos.every((item) => item.status === "completed" && item.updatedAt === "bulk")).toBe(true);
    expect(source.todos[0].status).toBe("completed");
    expect(source.todos[1].status).toBe("pending");
  });
});

