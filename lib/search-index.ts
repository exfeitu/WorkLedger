import type { EventItem, MemoItem, SearchResult, TodoItem } from "@/types";
import { formatDateTime, toPinyin, toPinyinInitials } from "@/lib/utils";
import { htmlToText, memoProgress, memoSearchText } from "@/lib/memo";

/** Search preparation is pure; a page should memoize this by its source arrays. */
export type IndexedSearchResult = SearchResult & { pinyin: string; initials: string };

function indexResult(result: SearchResult, searchableText: string): IndexedSearchResult {
  return { ...result, pinyin: toPinyin(searchableText), initials: toPinyinInitials(searchableText) };
}

export function buildSearchIndex(
  events: EventItem[],
  todos: TodoItem[],
  memos: MemoItem[],
): IndexedSearchResult[] {
  return [
    ...todos.map((todo) => indexResult({
      id: `todo-${todo.id}`,
      kind: "todo",
      title: todo.title,
      snippet: [todo.department, todo.contactPerson, todo.remarks].filter(Boolean).join(" · ") || "待办事项",
      dateLabel: todo.dueDate ? `截止 ${formatDateTime(todo.dueDate)}` : "未设置截止时间",
      dateValue: todo.dueDate,
      tags: todo.tags,
    }, `${todo.title} ${todo.department ?? ""} ${todo.contactPerson ?? ""} ${todo.remarks ?? ""} ${todo.tags.join(" ")}`)),
    ...events.map((event) => indexResult({
      id: `event-${event.id}`,
      kind: "event",
      title: event.title,
      snippet: event.detail ?? "工作记录",
      dateLabel: formatDateTime(event.startTime),
      dateValue: event.startTime,
      tags: event.tags,
    }, `${event.title} ${event.detail ?? ""} ${event.tags.join(" ")}`)),
    ...memos.map((memo) => {
      const progress = memo.type === "checklist" ? memoProgress(memo) : null;
      return indexResult({
        id: `memo-${memo.id}`,
        kind: "memo",
        title: memo.title,
        snippet: memo.type === "checklist"
          ? progress && progress.total > 0
            ? `周期备忘 · ${progress.completed}/${progress.total} 步`
            : "周期备忘"
          : htmlToText(memo.content ?? "").slice(0, 80) || "复盘心得",
        dateLabel: memo.date ? `备忘 ${memo.date}` : "备忘录",
        dateValue: memo.date,
        tags: memo.tags,
      }, memoSearchText(memo));
    }),
  ];
}

/** Keep the default result ordering stable: Todo → Event → Memo. */
export function findSearchResults(index: IndexedSearchResult[], query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return index.filter((result) => {
    const text = `${result.title} ${result.snippet} ${result.tags.join(" ")}`.toLowerCase();
    return text.includes(normalized)
      || result.pinyin.includes(normalized)
      || result.initials.includes(normalized);
  });
}

