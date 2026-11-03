import type { EventItem, Priority, TodoItem } from "@/types";

export type AdaptiveTimelineView = "day" | "three" | "week" | "month";
export const ADAPTIVE_VIEW_DAYS: Record<AdaptiveTimelineView, number> = { day: 1, three: 3, week: 7, month: 30 };
export const ADAPTIVE_VIEW_ORDER: AdaptiveTimelineView[] = ["day", "three", "week", "month"];
export const PRIORITY_COLORS: Record<Priority, string> = { high: "var(--danger)", medium: "#b88a44", low: "var(--accent)" };
export const PRIORITY_LABEL = { high: "高", medium: "中", low: "低" };
export const STATUS_LABEL = { pending: "未开始", in_progress: "进行中", completed: "已完成", cancelled: "已取消" };

export function adaptiveViewForDays(days: number): AdaptiveTimelineView {
  if (!Number.isFinite(days) || days <= 1.75) return "day";
  if (days <= 4.5) return "three";
  if (days <= 10) return "week";
  return "month";
}
export function startOfLocalDay(value: string | Date): Date {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(value + "T00:00:00") : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
export function localDateKey(value: string | Date): string {
  const date = startOfLocalDay(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}
export function shiftDate(value: string | Date, days: number): string {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}
export function buildTimelineWindow(value: string | Date, view: AdaptiveTimelineView) {
  const start = startOfLocalDay(value);
  const end = startOfLocalDay(shiftDate(value, ADAPTIVE_VIEW_DAYS[view]));
  return { start, end, startMs: +start, endMs: +end, dayCount: ADAPTIVE_VIEW_DAYS[view] };
}
export function formatClock(value: string | number): string {
  const date = new Date(value);
  return Number.isFinite(+date) ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "未设时间";
}
export function dateLabel(value: string | Date): string {
  return startOfLocalDay(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", weekday: "short" });
}
export function eventColor(id: string): string {
  const colors = ["var(--bg-soft)", "#cee4d4", "#e0e9d6", "#e9e3ce"];
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}
/** 没有真实时间时不生成锚点；不依赖当前时间或浏览器。 */
export function todoAnchorMs(todo: TodoItem): number | null {
  for (const value of [todo.startTime, todo.dueDate]) {
    if (!value) continue;
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? +startOfLocalDay(value) : +new Date(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
/** 安排时间不是截止时间；旧版仅日期的截止值按本地当天结束判断。 */
export function isTodoOverdue(todo: TodoItem, now: number): boolean {
  if (!todo.dueDate || todo.status === "completed" || todo.status === "cancelled") return false;
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(todo.dueDate)
    ? +startOfLocalDay(shiftDate(todo.dueDate, 1)) : +new Date(todo.dueDate);
  return Number.isFinite(deadline) && now > deadline;
}
export function eventInterval(event: EventItem): { start: number; end: number } | null {
  const start = +new Date(event.startTime);
  const end = +new Date(event.endTime);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}
/** 默认 12 小时窗口：最大化实际工作覆盖，重叠不重复计权；同分时靠近 08:00。 */
export function workWindowStartHour(date: string | Date, events: EventItem[]): number {
  const start = +startOfLocalDay(date);
  const end = +startOfLocalDay(shiftDate(date, 1));
  const intervals = events.map(eventInterval).filter((v): v is { start: number; end: number } => v !== null)
    .map(v => ({ start: Math.max(0, (v.start - start) / 3_600_000), end: Math.min(24, (Math.min(v.end, end) - start) / 3_600_000) }))
    .filter(v => v.end > v.start).sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && last.end >= interval.start) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  const candidates = [8, ...merged.flatMap(v => [v.start, v.end - 12])].map(v => Math.max(0, Math.min(12, v)));
  let best = 8, score = -1;
  for (const candidate of candidates) {
    const coverage = merged.reduce((sum, v) => sum + Math.max(0, Math.min(v.end, candidate + 12) - Math.max(v.start, candidate)), 0);
    if (coverage > score || (coverage === score && Math.abs(candidate - 8) < Math.abs(best - 8))) { best = candidate; score = coverage; }
  }
  return best;
}
export type DetailedTodoMarker =
  | { kind: "item"; id: string; anchorMs: number; lane: number; todo: TodoItem }
  | { kind: "cluster"; id: string; anchorMs: number; lane: number; todos: TodoItem[] };
/** proximityMinutes 由画布宽度与标签占位宽度换算，碰撞只影响层级，不移动时间锚点。 */
export function buildDetailedTodoMarkers(todos: TodoItem[], proximityMinutes = 40, clusterAt = 4, rangeEndMs = Infinity): DetailedTodoMarker[] {
  // 只绘制还在跟进中的待办：已完成项已进归档区，取消项从未发生。
  // 概览统计（buildDaySummaries）仍计入已完成，避免"本周工作量"被低估。
  const ordered = todos.filter(t => t.status !== "cancelled" && t.status !== "completed")
    .map(todo => ({ todo, anchorMs: todoAnchorMs(todo) }))
    .filter((entry): entry is { todo: TodoItem; anchorMs: number } => entry.anchorMs !== null)
    .sort((a, b) => a.anchorMs - b.anchorMs || a.todo.id.localeCompare(b.todo.id));
  const placed: { marker: DetailedTodoMarker; end: number }[] = [];
  const span = Math.max(1, proximityMinutes) * 60_000;
  const limit = Math.min(4, Math.max(2, clusterAt));
  for (const entry of ordered) {
    const labelStart = Math.min(entry.anchorMs, rangeEndMs - span);
    const active = placed.filter(p => p.end > labelStart);
    const cluster = active.find(p => p.marker.kind === "cluster");
    if (cluster && cluster.marker.kind === "cluster") {
      cluster.marker.todos.push(entry.todo);
      // 聚合窗口始终固定于首个节点，不因新成员延长，避免链式吞并整段时间。
      continue;
    }
    if (active.length >= limit - 1) {
      const members = [...active.flatMap(p => p.marker.kind === "item" ? [p.marker.todo] : p.marker.todos), entry.todo];
      const first = active[0];
      for (const item of active) placed.splice(placed.indexOf(item), 1);
      placed.push({ end: first.end, marker: { kind: "cluster", id: "todos-" + members[0].id,
        anchorMs: first.marker.anchorMs, lane: first.marker.lane, todos: members } });
      continue;
    }
    const lane = [0, 1, 2].find(lane => active.every(p => p.marker.lane !== lane))!;
    placed.push({ end: labelStart + span, marker: { kind: "item", id: entry.todo.id, ...entry, lane } });
  }
  return placed.map(p => p.marker).sort((a, b) => a.anchorMs - b.anchorMs || a.id.localeCompare(b.id));
}
export type DetailedEventBand = { event: EventItem; lane: number; leftPercent: number; widthPercent: number };
export type OverflowEventGroup = { id: string; anchorMs: number; events: EventItem[] };
export function layoutDetailedEvents(events: EventItem[], rangeStartMs: number, rangeEndMs: number, maxLanes = 3) {
  const visible: DetailedEventBand[] = [];
  const overflow: OverflowEventGroup[] = [];
  if (!(rangeEndMs > rangeStartMs)) return { visible, overflow };
  const ends = Array.from({ length: Math.min(3, Math.max(1, maxLanes)) }, () => -Infinity);
  const ordered = events.map(event => ({ event, interval: eventInterval(event) }))
    .filter((e): e is { event: EventItem; interval: { start: number; end: number } } => e.interval !== null)
    .sort((a, b) => a.interval.start - b.interval.start || a.event.id.localeCompare(b.event.id));
  for (const { event, interval } of ordered) {
    const start = Math.max(rangeStartMs, interval.start);
    const end = Math.min(rangeEndMs, interval.end);
    if (end <= start) continue;
    const lane = ends.findIndex(value => value <= start);
    if (lane < 0) {
      // 一天只有一个溢出入口，避免溢出标签之间再次碰撞。
      if (!overflow.length) overflow.push({ id: "overflow-" + rangeStartMs, anchorMs: start, events: [] });
      overflow[0].events.push(event);
    } else {
      ends[lane] = end;
      visible.push({ event, lane, leftPercent: (start - rangeStartMs) / (rangeEndMs - rangeStartMs) * 100, widthPercent: (end - start) / (rangeEndMs - rangeStartMs) * 100 });
    }
  }
  return { visible, overflow };
}
export type DayTimelineSummary = {
  dateKey: string; date: Date; todos: TodoItem[]; events: EventItem[];
  priorityCounts: Record<Priority, number>; eventHours: number;
};
export function buildDaySummaries(startDayMs: number, dayCount: number, todos: TodoItem[], events: EventItem[]): DayTimelineSummary[] {
  return Array.from({ length: Math.max(0, dayCount) }, (_, offset) => {
    const date = startOfLocalDay(shiftDate(new Date(startDayMs), offset));
    const end = +startOfLocalDay(shiftDate(date, 1));
    const dayTodos = todos.filter(t => {
      const anchor = todoAnchorMs(t);
      return t.status !== "cancelled" && anchor !== null && anchor >= +date && anchor < end;
    });
    const dayEvents = events.filter(event => {
      const interval = eventInterval(event);
      return interval !== null && interval.start < end && interval.end > +date;
    });
    return {
      dateKey: localDateKey(date), date, todos: dayTodos, events: dayEvents,
      priorityCounts: {
        high: dayTodos.filter(t => t.priority === "high").length,
        medium: dayTodos.filter(t => t.priority === "medium").length,
        low: dayTodos.filter(t => t.priority === "low").length,
      },
      // 记录工时相加；跨日记录按实际落在当天的时长分摊，不是去重占用时长。
      eventHours: dayEvents.reduce((sum, event) => {
        const interval = eventInterval(event)!;
        return sum + (Math.min(end, interval.end) - Math.max(+date, interval.start)) / 3_600_000;
      }, 0),
    };
  });
}
/** 相对当前窗口最大值的六级密度：0为空，1—5为非零强度。 */
export function densityLevel(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || value <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil(value / max * 5)));
}
