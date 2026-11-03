import { SearchResult } from "@/types";

export type SearchSort = "default" | "date-desc" | "date-asc" | "title";

/**
 * 标签筛选下拉的选项来源。
 *
 * 必须独立于搜索结果：关键词为空时没有命中项，若从结果派生，下拉就只剩“全部标签”，
 * 用户无法直接用标签浏览。这里合并预设标签、自定义标签与数据中实际出现的标签。
 */
export function collectFilterTags(
  sources: Array<{ tags?: string[] }>,
  extra: string[] = [],
): string[] {
  const all = new Set<string>(extra.filter(Boolean));
  for (const item of sources) {
    for (const tag of item.tags ?? []) {
      if (tag) all.add(tag);
    }
  }
  return Array.from(all).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function filterAndSortResults(
  results: SearchResult[],
  kind: SearchResult["kind"] | "all",
  tag: string,
  sort: SearchSort,
): SearchResult[] {
  const filtered = results.filter((result) =>
    (kind === "all" || result.kind === kind) && (!tag || result.tags.includes(tag)),
  );
  if (sort === "default") return filtered;
  const timestamp = (result: SearchResult) => {
    const value = result.dateValue ? new Date(result.dateValue).getTime() : NaN;
    return Number.isFinite(value) ? value : null;
  };
  return filtered.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "zh-CN", { numeric: true });
    const first = timestamp(a);
    const second = timestamp(b);
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return sort === "date-asc" ? first - second : second - first;
  });
}
