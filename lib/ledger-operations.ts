import type { EventItem, TodoItem, TodoStatus } from "@/types";
import { syncLinkedItems } from "@/lib/utils";

/**
 * Pure changes to the work ledger. These functions know nothing about React,
 * LocalStorage or Gist. Callers commit the returned snapshot via useAppData.setData.
 */
export type LedgerSnapshot = { events: EventItem[]; todos: TodoItem[] };

export function upsertTodo(state: LedgerSnapshot, todo: TodoItem) {
  const exists = state.todos.some((item) => item.id === todo.id);
  const next = exists
    ? state.todos.map((item) => item.id === todo.id ? todo : item)
    : [...state.todos, todo];
  return syncLinkedItems(state.events, next);
}

export function upsertWorkRecord(
  state: LedgerSnapshot,
  record: EventItem,
  linkedTodoId: string | null,
) {
  const exists = state.events.some((item) => item.id === record.id);
  // The work-record form chooses exactly one task. Replace this record's link
  // on both sides *before* reconciliation (which otherwise unions stale links).
  const chosenId = state.todos.some((todo) => todo.id === linkedTodoId) ? linkedTodoId : null;
  const linkedRecord = { ...record, linkedTodoIds: chosenId ? [chosenId] : [] };
  const nextEvents = exists
    ? state.events.map((item) => item.id === record.id ? linkedRecord : item)
    : [...state.events, linkedRecord];
  const nextTodos = state.todos.map((todo) => {
    const otherLinks = (todo.linkedEventIds ?? []).filter((id) => id !== record.id);
    return {
      ...todo,
      linkedEventIds: todo.id === chosenId ? [...otherLinks, record.id] : otherLinks,
    };
  });
  return syncLinkedItems(nextEvents, nextTodos);
}

export function deleteWorkRecord(state: LedgerSnapshot, id: string) {
  const events = state.events.filter((item) => item.id !== id);
  const todos = state.todos.map((todo) => ({
    ...todo,
    linkedEventIds: (todo.linkedEventIds ?? []).filter((eventId) => eventId !== id),
  }));
  return syncLinkedItems(events, todos);
}

export function deleteTodos(state: LedgerSnapshot, ids: ReadonlySet<string>) {
  const todos = state.todos.filter((todo) => !ids.has(todo.id));
  const events = state.events.map((event) => ({
    ...event,
    linkedTodoIds: (event.linkedTodoIds ?? []).filter((id) => !ids.has(id)),
  }));
  return syncLinkedItems(events, todos);
}

export function restoreTodo(
  state: LedgerSnapshot,
  id: string,
  updatedAt: string,
) {
  const todos = state.todos.map((todo) => todo.id === id
    ? { ...todo, status: "in_progress" as const, updatedAt }
    : todo);
  return syncLinkedItems(state.events, todos);
}

export function setTodosStatus(
  state: LedgerSnapshot,
  ids: ReadonlySet<string>,
  status: TodoStatus,
  updatedAt: string,
) {
  const todos = state.todos.map((todo) => ids.has(todo.id)
    ? { ...todo, status, updatedAt }
    : todo);
  return syncLinkedItems(state.events, todos);
}

