"use client";

import dynamic from "next/dynamic";
import { type ComponentProps } from "react";
import { DayTimeline } from "./day-timeline";

// 保留独立加载边界，两种时间轴只挂载当前选中的一种。
const LegacyDayTimeline = dynamic(() => import("./legacy-day-timeline").then(module => module.LegacyDayTimeline), {
  loading: () => <p role="status">正在加载旧版时间轴…</p>,
});

export function TimelineSwitcher({ legacy, ...props }: ComponentProps<typeof DayTimeline> & { legacy: boolean }) {
  return <div className="timeline-switcher">
    {legacy ? <div className="legacy-timeline"><LegacyDayTimeline {...props}
      linkedTodoTitles={Object.fromEntries((props.todos ?? []).map(todo => [todo.id, todo.title]))} />
    </div> : <DayTimeline {...props} />}
  </div>;
}
