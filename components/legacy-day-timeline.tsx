"use client";

import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EventItem, TodoItem } from "@/types";
import {
  BASE_VISIBLE_DAYS,
  CARD_HORIZONTAL_GAP,
  CARD_HEIGHT,
  AXIS_CARD_GAP,
  FULL_CARD_MAX_WIDTH,
  FULL_CARD_MIN_WIDTH,
  LANE_HEIGHT,
  MAX_SCALE,
  MIN_SCALE,
  PRIORITY_LABEL,
  SCALE_STEP,
  STATUS_LABEL,
  TRACK_PADDING,
  TimelineItem,
  assignLanes,
  buildWeekBrackets,
  endOfDay,
  eventToTimeline,
  formatClock,
  formatDayLabel,
  startOfDay,
  todoToTimeline,
} from "@/lib/legacy-timeline-layout";

type LegacyDayTimelineProps = {
  events: EventItem[];
  todos?: TodoItem[];
  linkedTodoTitles?: Record<string, string>;
  onEventClick?: (event: EventItem) => void;
  onTodoClick?: (todo: TodoItem) => void;
  // 外部控制（由父组件渲染工具栏时使用）
  scale?: number;
  onScaleChange?: (scale: number) => void;
  scrollToTodayTrigger?: number;
  scrollToDate?: string;
};

type PositionedItem = TimelineItem & {
  color: string;
  stack: number;
  side: "top" | "bottom";
  leftPercent: number;
  widthPercent: number;
  cardOffsetXPx: number;
  cardWidthPx: number;
};

export function LegacyDayTimeline({ events, todos = [], linkedTodoTitles = {}, onEventClick, onTodoClick, scale: externalScale, onScaleChange, scrollToTodayTrigger, scrollToDate }: LegacyDayTimelineProps) {
  const [internalScale, setInternalScale] = useState(1);
  const scale = externalScale ?? internalScale;
  const setScale = useCallback((v: number) => {
    if (onScaleChange) {
      onScaleChange(v);
    } else {
      setInternalScale(v);
    }
  }, [onScaleChange]);
  const [jumpDate, setJumpDate] = useState("");
  const targetDate = scrollToDate || jumpDate;
  const hasExternalToolbar = externalScale !== undefined;

  // 清理 RAF
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const wheelZoomingRef = useRef(false);
  const prevScaleRef = useRef(scale);

  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [timelineReady, setTimelineReady] = useState(false);

  // 视口虚拟化：只渲染可视区域附近的元素
  const [viewportLeft, setViewportLeft] = useState(0);
  const visibleRange = useMemo(() => ({
    left: viewportLeft - containerWidth * 0.5,
    right: viewportLeft + containerWidth * 1.5,
  }), [viewportLeft, containerWidth]);

  // 同步 scrollLeft 到状态（RAF 节流），用于虚拟化
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setViewportLeft(container.scrollLeft);
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // useLayoutEffect 调整 scrollLeft 后同步 viewportLeft
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (container) setViewportLeft(container.scrollLeft);
  }, [scale]);

  // 首帧立即读取容器宽度（useLayoutEffect 在 paint 前同步执行，消除白屏）
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (container) {
      const w = container.clientWidth;
      if (w > 0) setContainerWidth(w);
    }
  }, []);

  // 拖动平移
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const [dragging, setDragging] = useState(false);

  // 后续尺寸变化由 ResizeObserver 处理（useLayoutEffect 避免 ResizeObserver 的异步延迟）
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 合并 events 和 todos 为统一的时间轴条目
  const allItems = useMemo<TimelineItem[]>(() => {
    const eventItems = events.map(eventToTimeline);
    const todoItems = todos
      .filter((t) => t.status !== "cancelled")
      .map(todoToTimeline);
    return [...eventItems, ...todoItems].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }, [events, todos]);

  const todayStart = useMemo(() => startOfDay(new Date().toISOString()), []);

  const timelineDays = useMemo(() => {
    const TODAY = new Date(todayStart);
    // 始终至少覆盖 today 前后各 730 天（约 4 年），实现"无限"可滚动
    const FALLBACK_START = new Date(TODAY);
    FALLBACK_START.setDate(FALLBACK_START.getDate() - 730);
    const FALLBACK_END = new Date(TODAY);
    FALLBACK_END.setDate(FALLBACK_END.getDate() + 730);

    if (!allItems.length) {
      const days: string[] = [];
      const cursor = new Date(FALLBACK_START);
      while (cursor <= FALLBACK_END) {
        days.push(cursor.toISOString());
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    }
    const dataStart = startOfDay(allItems[0].startTime);
    const dataEnd = startOfDay(allItems[allItems.length - 1].startTime);
    const start = dataStart < FALLBACK_START ? dataStart : FALLBACK_START;
    const end = dataEnd > FALLBACK_END ? dataEnd : FALLBACK_END;
    const days: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(cursor.toISOString());
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [allItems, todayStart]);

  const timeOrigin = useMemo(
    () => (timelineDays.length ? startOfDay(timelineDays[0]).getTime() : todayStart.getTime()),
    [timelineDays, todayStart],
  );
  const timeEnd = useMemo(
    () => (timelineDays.length ? endOfDay(timelineDays[timelineDays.length - 1]).getTime() : timeOrigin + 7 * 86400000),
    [timelineDays, timeOrigin],
  );
  const totalRangeMs = timeEnd - timeOrigin;

  const visibleDays = BASE_VISIBLE_DAYS / scale;
  const totalDays = timelineDays.length;
  const shellWidth = Math.max((totalDays / visibleDays) * containerWidth, containerWidth);

  // 缩放后统一调整 scroll 位置（useLayoutEffect 在 DOM 更新后、绘制前执行，消除闪烁）
  useLayoutEffect(() => {
    if (!initializedRef.current) return;
    const prevScale = prevScaleRef.current;
    if (prevScale === scale) return;
    prevScaleRef.current = scale;

    const container = scrollRef.current;
    if (!container) return;

    if (wheelZoomingRef.current) {
      wheelZoomingRef.current = false;
      // 滚轮缩放：锚定光标位置
      const { ratio, viewportX } = lastCursorRef.current;
      container.scrollLeft = Math.max(0, ratio * shellWidth - viewportX);
    } else {
      // 按钮缩放：保持视窗中心不变
      const centerXInViewport = containerWidth / 2;
      const centerXInContent = centerXInViewport + container.scrollLeft;
      const prevVisibleDays = BASE_VISIBLE_DAYS / prevScale;
      const prevShellWidth = Math.max((totalDays / prevVisibleDays) * containerWidth, containerWidth);
      const centerRatio = prevShellWidth > 0 ? centerXInContent / prevShellWidth : 0.5;
      container.scrollLeft = Math.max(0, centerRatio * shellWidth - centerXInViewport);
    }
  }, [scale, shellWidth, containerWidth, totalDays]);

  useLayoutEffect(() => {
    if (initializedRef.current) return;
    const container = scrollRef.current;
    if (!container || !containerWidth || !totalRangeMs) return;
    const todayMs = todayStart.getTime();
    const todayRatio = totalRangeMs > 0 ? (todayMs - timeOrigin) / totalRangeMs : 0.5;
    const todayPx = todayRatio * shellWidth;
    container.scrollLeft = Math.max(0, todayPx - containerWidth / 2);
    initializedRef.current = true;
    setTimelineReady(true);
  }, [containerWidth, shellWidth, timeOrigin, totalRangeMs, todayStart]);

  // 响应外部"回到今天"触发
  useEffect(() => {
    if (scrollToTodayTrigger === undefined || scrollToTodayTrigger === 0) return;
    scrollToToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToTodayTrigger]);

  // 响应外部跳转到指定日期
  useEffect(() => {
    if (!targetDate || !initializedRef.current) return;
    const container = scrollRef.current;
    if (!container || !containerWidth || !totalRangeMs) return;
    const targetMs = startOfDay(targetDate + (targetDate.length === 10 ? "T00:00:00" : "")).getTime();
    const targetRatio = totalRangeMs > 0 ? (targetMs - timeOrigin) / totalRangeMs : 0;
    const targetPx = targetRatio * shellWidth;
    container.scrollTo({ left: Math.max(0, targetPx - containerWidth / 2), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  // 不依赖 scale/shellWidth 的稳定计算（lane 分配、颜色、百分比位置）
  const stableItems = useMemo(
    () => assignLanes(allItems, timeOrigin, totalRangeMs),
    [allItems, timeOrigin, totalRangeMs],
  );

  // 仅依赖 shellWidth 的像素计算（缩放时重算，稳定部分不变）
  const positionedItems = useMemo<PositionedItem[]>(() => {
    if (!stableItems.length) return [];
    const laneRights = { top: [] as number[], bottom: [] as number[] };

    return stableItems.map((item) => {
      const naturalLeftPx = (item.leftPercent / 100) * shellWidth;
      const naturalWidthPx = Math.max(40, (item.widthPercent / 100) * shellWidth);
      const cardWidthPx = Math.min(FULL_CARD_MAX_WIDTH, Math.max(FULL_CARD_MIN_WIDTH, naturalWidthPx));

      const sameSideRight = laneRights[item.side][item.stack] ?? -Infinity;
      const shiftedLeftPx = Math.max(naturalLeftPx, sameSideRight + CARD_HORIZONTAL_GAP);
      const cardOffsetXPx = shiftedLeftPx - naturalLeftPx;

      laneRights[item.side][item.stack] = shiftedLeftPx + cardWidthPx;

      return {
        ...item,
        cardOffsetXPx,
        cardWidthPx,
      };
    });
  }, [stableItems, shellWidth]);

  // 视口虚拟化：仅保留可见范围内的条目（memoized 避免每帧 filter）
  const visiblePositionedItems = useMemo(() => {
    if (!positionedItems.length) return [];
    return positionedItems.filter((item) => {
      const itemLeftPx = (item.leftPercent / 100) * shellWidth + item.cardOffsetXPx;
      const itemRightPx = itemLeftPx + item.cardWidthPx;
      return itemRightPx >= visibleRange.left && itemLeftPx <= visibleRange.right;
    });
  }, [positionedItems, shellWidth, visibleRange]);

  const { trackHeight, axisTop } = useMemo(() => {
    // 只为当前窗口附近的卡片预留空间，且上下两侧分别计算。
    const extent = (side: "top" | "bottom") => {
      const stack = visiblePositionedItems.reduce((max, item) => item.side === side ? Math.max(max, item.stack) : max, -1);
      return stack < 0 ? 44 : stack * LANE_HEIGHT + AXIS_CARD_GAP + 8 + CARD_HEIGHT + TRACK_PADDING;
    };
    const top = extent("top");
    return { trackHeight: top + extent("bottom"), axisTop: top };
  }, [visiblePositionedItems]);

  // 按周聚合计数（以周一为周起始对齐）
  const weekBrackets = useMemo(() => buildWeekBrackets(allItems), [allItems]);

  // 根据可见天数和视口宽度动态计算刻度密度，避免缩小时标签过密
  const axisDensity = useMemo(() => {
    if (containerWidth <= 0) return 4;
    const visibleHours = visibleDays * 24;
    const targetLabelCount = Math.max(4, Math.floor(containerWidth / 72));
    return Math.max(1, Math.ceil(visibleHours / targetLabelCount));
  }, [visibleDays, containerWidth]);

  const hourMarks = useMemo(() => {
    const totalHours = Math.floor(totalRangeMs / 3600000) + 1;
    if (totalHours <= 0) return [];
    const marks: { key: string; leftPercent: number; label: string }[] = [];

    // 从第1小时开始，优先显示奇数时间点，自然避开 00:00（日边界）
    for (let hour = 1; hour < totalHours; hour += axisDensity) {
      marks.push({
        key: `h-${hour}`,
        leftPercent: totalRangeMs > 0 ? (hour * 3600000) / totalRangeMs * 100 : 0,
        label: `${String(hour % 24).padStart(2, "0")}:00`,
      });
    }

    return marks;
  }, [totalRangeMs, axisDensity]);

  // 视口虚拟化：只保留可见范围内的元素
  const pxFromPct = useCallback((pct: number) => (pct / 100) * shellWidth, [shellWidth]);
  const isVisible = useCallback((px: number) => px >= visibleRange.left && px <= visibleRange.right, [visibleRange]);

  const visibleHourMarks = useMemo(
    () => hourMarks.filter((m) => isVisible(pxFromPct(m.leftPercent))),
    [hourMarks, pxFromPct, isVisible],
  );

  const visibleDaySeps = useMemo(() => {
    // timelineDays 是 ISO 字符串数组，左边界对应 day 的 00:00
    return timelineDays.filter((day) => {
      const dayPx = pxFromPct(totalRangeMs > 0 ? ((startOfDay(day).getTime() - timeOrigin) / totalRangeMs) * 100 : 0);
      return isVisible(dayPx);
    });
  }, [timelineDays, totalRangeMs, timeOrigin, pxFromPct, isVisible]);

  const visibleWeekBrackets = useMemo(
    () => weekBrackets.filter((w) => isVisible(pxFromPct(totalRangeMs > 0 ? ((w.start.getTime() - timeOrigin) / totalRangeMs) * 100 : 0))),
    [weekBrackets, totalRangeMs, timeOrigin, pxFromPct, isVisible],
  );

  const visibleDayLabels = useMemo(
    () => timelineDays.filter((day) => isVisible(pxFromPct(totalRangeMs > 0 ? ((startOfDay(day).getTime() - timeOrigin) / totalRangeMs) * 100 : 0))),
    [timelineDays, totalRangeMs, timeOrigin, pxFromPct, isVisible],
  );

  const scrollToToday = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !totalRangeMs) return;
    const todayMs = todayStart.getTime();
    const todayRatio = totalRangeMs > 0 ? (todayMs - timeOrigin) / totalRangeMs : 0.5;
    const todayPx = todayRatio * shellWidth;
    container.scrollTo({ left: Math.max(0, todayPx - containerWidth / 2), behavior: "smooth" });
  }, [todayStart, timeOrigin, totalRangeMs, shellWidth, containerWidth]);

  // 鼠标拖动平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button,input")) return;
    const container = scrollRef.current;
    if (!container) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartScrollLeft.current = container.scrollLeft;
    setDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const container = scrollRef.current;
    if (!container) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStartX.current;
      container.scrollLeft = dragStartScrollLeft.current - dx;
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      setDragging(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  // 年份标签
  const yearLabel = useMemo(() => {
    if (!timelineDays.length) return "";
    const midIdx = Math.floor(timelineDays.length / 2);
    const midDate = new Date(timelineDays[midIdx]);
    return `${midDate.getFullYear()}年`;
  }, [timelineDays]);

  // 滚轮缩放 RAF 批处理，消除卡顿
  const pendingFactorRef = useRef(1);
  const rafIdRef = useRef<number | null>(null);
  const lastCursorRef = useRef({ ratio: 0, viewportX: 0 });
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const container = scrollRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cursorXInViewport = event.clientX - rect.left;
      const cursorXInContent = cursorXInViewport + container.scrollLeft;
      lastCursorRef.current = {
        ratio: shellWidth > 0 ? cursorXInContent / shellWidth : 0,
        viewportX: cursorXInViewport,
      };

      // 累积缩放因子
      const tickFactor = event.deltaY < 0 ? 1.05 : 0.95;
      pendingFactorRef.current *= tickFactor;

      if (rafIdRef.current !== null) return; // 已有待处理的 RAF
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const factor = pendingFactorRef.current;
        pendingFactorRef.current = 1;
        const nextScale = scaleRef.current * factor;
        const clamped = Number(Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale)).toFixed(4));
        if (clamped === scaleRef.current) return;
        wheelZoomingRef.current = true;

        // 预测缩放后的视口位置，提前更新避免虚拟化闪烁
        const nextVisDays = BASE_VISIBLE_DAYS / clamped;
        const nextShellW = Math.max((totalDays / nextVisDays) * containerWidth, containerWidth);
        const { ratio, viewportX } = lastCursorRef.current;
        setViewportLeft(Math.max(0, ratio * nextShellW - viewportX));

        setScale(clamped);
      });
    },
    [shellWidth, containerWidth, totalDays, setScale],
  );

  return (
    <div className="line-timeline" suppressHydrationWarning>
      {!hasExternalToolbar && (
        <div className="line-timeline-toolbar">
          <input type="date" aria-label="旧版跳转日期" value={jumpDate} onChange={event => setJumpDate(event.target.value)} />
          <button className="axis-zoom-button" onClick={() => setScale(Math.min(MAX_SCALE, scale + SCALE_STEP))} type="button">＋</button>
          <span className="axis-zoom-value axis-zoom-value-inline">{Math.round(scale * 100)}%</span>
          <button className="axis-zoom-button" onClick={() => setScale(Math.max(MIN_SCALE, scale - SCALE_STEP))} type="button">－</button>
          <span className="toolbar-sep" />
          <button className="axis-today-button" type="button" onClick={scrollToToday}>今天</button>
          <span className="toolbar-sep" />
          <span className="axis-zoom-value-inline" style={{ minWidth: "auto", fontSize: "0.75rem" }}>
            {Math.round(visibleDays * 10) / 10}天
          </span>
        </div>
      )}
      <div className="line-timeline-hscroll" ref={scrollRef} onWheel={handleWheel} onMouseDown={handleMouseDown} style={{ cursor: dragging ? "grabbing" : "grab", opacity: timelineReady ? 1 : 0, transition: "opacity 0.15s ease" }}>
        <div className="line-timeline-shell" style={{ width: shellWidth, height: trackHeight, "--axis-y": `${axisTop}px` } as CSSProperties}>
          <div className="line-timeline-year">{yearLabel}</div>
          <div className="line-timeline-track">
            <div className="line-timeline-axis" />

            {/* 时间刻度 */}
            <div className="line-timeline-axis-zone">
              {visibleHourMarks.map((mark) => (
                <div key={mark.key} className="axis-time-mark" style={{ left: `${mark.leftPercent}%` }}>
                  <strong className="axis-hour-label">{mark.label}</strong>
                </div>
              ))}
            </div>

            {/* 日分隔竖线 */}
            {visibleDaySeps.map((day) => {
              const dayStart = startOfDay(day).getTime();
              const dayLeftPercent = totalRangeMs > 0 ? ((dayStart - timeOrigin) / totalRangeMs) * 100 : 0;
              return <div key={`sep-${day}`} className="line-day-separator" style={{ left: `${dayLeftPercent}%` }} />;
            })}

            {/* 周计数括号 */}
            {visibleWeekBrackets.map((week) => {
              const ws = week.start.getTime();
              const we = week.end.getTime() + 86400000;
              const leftPct = totalRangeMs > 0 ? ((ws - timeOrigin) / totalRangeMs) * 100 : 0;
              const widthPct = totalRangeMs > 0 ? ((we - ws) / totalRangeMs) * 100 : 0;
              return (
                <div
                  key={`wk-${week.start.toISOString()}`}
                  className="week-bracket"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                >
                  <span className="week-bracket-label">
                    {week.eventCount > 0 && `${week.eventCount}记录`}
                    {week.eventCount > 0 && week.todoCount > 0 && " · "}
                    {week.todoCount > 0 && `${week.todoCount}待办`}
                  </span>
                </div>
              );
            })}

            {/* 每日标签 */}
            {visibleDayLabels.map((day) => {
              const dayStart = startOfDay(day).getTime();
              const dayLeftPercent = totalRangeMs > 0 ? ((dayStart - timeOrigin) / totalRangeMs) * 100 : 0;
              return <div key={day} className="line-day-chip" style={{ left: `${dayLeftPercent}%` }}>{formatDayLabel(day)}</div>;
            })}

            {/* 统一渲染时间轴条目（事件 + 待办）—— 使用 memoized 可见条目 */}
            {visiblePositionedItems.map((item) => {
              const isTodo = item.kind === "todo";
              const style = {
                left: `${item.leftPercent}%`,
                width: `${item.widthPercent}%`,
                "--event-color": item.color,
                "--stack-offset": `${item.stack * LANE_HEIGHT}px`,
                "--card-offset-x": `${item.cardOffsetXPx}px`,
                "--card-width": `${item.cardWidthPx}px`,
                "--axis-card-gap": `${AXIS_CARD_GAP}px`,
                "--card-height": `${CARD_HEIGHT}px`,
              } as CSSProperties;

              const handleClick = () => {
                if (isTodo && item.todoData && onTodoClick) {
                  onTodoClick(item.todoData);
                } else if (!isTodo && item.eventData && onEventClick) {
                  onEventClick(item.eventData);
                }
              };

              return (
                <article
                  key={`${item.kind}-${item.id}`}
                  className={`line-event line-event-${item.side} ${isTodo ? "line-todo" : ""}`}
                  style={style}
                >
                  <div className="line-event-axis-group">
                    <span className={`line-event-point ${isTodo ? "line-todo-point" : ""}`} />
                    <span className="line-event-stem" />
                  </div>
                  <button
                    className={`line-event-card ${isTodo ? "line-todo-card" : ""}`}
                    type="button"
                    onClick={handleClick}
                  >
                    <div className="line-event-time">
                      {isTodo ? "📌 待办" : `${formatClock(item.startTime)} — ${formatClock(item.endTime)}`}
                    </div>
                    {!isTodo && item.eventData?.linkedTodoIds?.length ? (
                      <div className="link-badge-group link-badge-group-event">
                        {item.eventData.linkedTodoIds.filter((id) => linkedTodoTitles[id]).map((id) => (
                          <div key={id} className="link-badge link-badge-event">关联待办：{linkedTodoTitles[id]}</div>
                        ))}
                      </div>
                    ) : null}
                    <h4>{item.title}</h4>
                    {isTodo && item.todoData ? (
                      <div className="line-todo-meta">
                        <span className={`line-todo-priority priority-${item.todoData.priority}`}>
                          {PRIORITY_LABEL[item.todoData.priority] ?? item.todoData.priority}
                        </span>
                        <span className="line-todo-status">{STATUS_LABEL[item.todoData.status] ?? item.todoData.status}</span>
                      </div>
                    ) : (
                      <p>{item.detail}</p>
                    )}
                    <div className="tag-row compact-tags">
                      {item.tags.map((tag) => <span key={tag} className="tag chip">{tag}</span>)}
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
