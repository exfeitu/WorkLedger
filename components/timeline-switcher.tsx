"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentProps } from "react";
import { DayTimeline } from "./day-timeline";

// 保留独立加载边界，两种时间轴只挂载当前选中的一种。
const LegacyDayTimeline = dynamic(() => import("./legacy-day-timeline").then(module => module.LegacyDayTimeline), {
  loading: () => <p role="status">正在加载旧版时间轴…</p>,
});

export function TimelineSwitcher(props: ComponentProps<typeof DayTimeline>) {
  const [legacy, setLegacy] = useState(true);
  return <div className="timeline-switcher">
    <div className="timeline-version-toolbar">
      <button type="button" className="timeline-version-toggle" aria-pressed={legacy}
        aria-label={legacy ? "切换到新版时间轴" : "切换到旧版时间轴"}
        onClick={() => setLegacy(value => !value)}>
        {legacy ? "体验新版 ↗" : "返回经典版 ↗"}
      </button>
    </div>
    {legacy ? <div className="legacy-timeline"><LegacyDayTimeline {...props}
      linkedTodoTitles={Object.fromEntries((props.todos ?? []).map(todo => [todo.id, todo.title]))} />
    </div> : <DayTimeline {...props} />}
  </div>;
}
