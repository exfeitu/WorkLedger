import { useMemo, useState } from "react";
import { SearchResult } from "@/types";
import { filterAndSortResults, SearchSort } from "@/lib/search-results";

type SearchPanelProps = {
  results: SearchResult[];
  query: string;
  onQueryChange: (value: string) => void;
  /** 全量可选标签（预设 + 自定义 + 数据中出现过的）；未传时回退为从结果派生。 */
  availableTags?: string[];
  inputRef?: React.Ref<HTMLInputElement>;
};

/** 将文本中匹配 query 的部分用 <mark> 高亮 */
function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q || !text) return text;

  const lower = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let index = 0;
  let start = lower.indexOf(lowerQuery);

  while (start !== -1) {
    if (start > index) parts.push(text.slice(index, start));
    parts.push(
      <mark key={`${start}-${text.slice(start, start + q.length)}`} className="search-mark">
        {text.slice(start, start + q.length)}
      </mark>,
    );
    index = start + q.length;
    start = lower.indexOf(lowerQuery, index);
  }
  if (index < text.length) parts.push(text.slice(index));
  return parts;
}

export function SearchPanel({ results, query, onQueryChange, availableTags, inputRef }: SearchPanelProps) {
  const [kind, setKind] = useState<SearchResult["kind"] | "all">("all");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<SearchSort>("default");
  // 选项来自全量标签；附带当前结果与已选值，避免筛选过程中选项跳动。
  const tags = useMemo(() => {
    const merged = new Set([...(availableTags ?? []), ...results.flatMap((result) => result.tags)]);
    if (tag) merged.add(tag);
    return Array.from(merged).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [availableTags, results, tag]);
  const visibleResults = useMemo(() => filterAndSortResults(results, kind, tag, sort), [results, kind, tag, sort]);
  const hasFilters = kind !== "all" || tag !== "";
  const kindLabel = (kind: SearchResult["kind"]) => {
    if (kind === "todo") return "待办";
    if (kind === "event") return "工作记录";
    return "备忘录";
  };

  return (
    <div className="search-results-wrap" role="search">
      <div className="search-box">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索待办、工作记录、备忘录、联系人、标签（支持拼音）"
          aria-label="搜索"
        />
      </div>
      <div className="search-controls">
        <label>类型
          <select aria-label="搜索类型" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="all">全部类型</option>
            <option value="todo">待办</option>
            <option value="event">工作记录</option>
            <option value="memo">备忘录</option>
          </select>
        </label>
        <label>标签
          <select aria-label="搜索标签" value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">全部标签</option>
            {tags.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>排序
          <select aria-label="搜索排序" value={sort} onChange={(event) => setSort(event.target.value as SearchSort)}>
            <option value="default">默认顺序</option>
            <option value="date-desc">日期从新到旧</option>
            <option value="date-asc">日期从旧到新</option>
            <option value="title">标题顺序</option>
          </select>
        </label>
        {hasFilters || sort !== "default" ? <button type="button" className="button ghost" onClick={() => { setKind("all"); setTag(""); setSort("default"); }}>重置筛选与排序</button> : null}
      </div>
      {query.trim() ? <p className="search-result-count" role="status">显示 {visibleResults.length} / {results.length} 条结果</p> : null}
      <div className="search-results">
        {visibleResults.length > 0 ? (
          visibleResults.map((result) => (
            <article key={result.id} className="search-card">
              <div className="search-card-top">
                <span className={`pill pill-${result.kind}`}>{kindLabel(result.kind)}</span>
                <span className="search-date">{result.dateLabel}</span>
              </div>
              <h4>{highlight(result.title, query)}</h4>
              <p>{highlight(result.snippet, query)}</p>
              <div className="tag-row">
                {result.tags.map((tag) => (
                  <span key={tag} className="tag chip">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))
        ) : (
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "20px 0" }}>
            {query.trim() ? (results.length > 0 && hasFilters ? "没有符合筛选条件的结果，可重置筛选后查看全部匹配项" : "未找到匹配结果") : "输入关键词开始搜索"}
          </p>
        )}
      </div>
    </div>
  );
}
