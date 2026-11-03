import { describe, expect, it } from "vitest";
import { collectFilterTags, filterAndSortResults } from "../search-results";
import { SearchResult } from "@/types";

const results: SearchResult[] = [
  { id: "a", kind: "todo", title: "任务10", snippet: "", dateLabel: "", tags: ["人事"], dateValue: "2026-09-15T09:00:00" },
  { id: "b", kind: "event", title: "任务2", snippet: "", dateLabel: "", tags: ["人事"], dateValue: "2026-09-14T10:00:00" },
  { id: "c", kind: "todo", title: "任务1", snippet: "", dateLabel: "", tags: ["会议"] },
  { id: "d", kind: "memo", title: "任务3", snippet: "", dateLabel: "", tags: [], dateValue: "invalid" },
];

describe("搜索筛选和排序", () => {
  it("组合筛选类型和标签，保留原始结果数组", () => {
    expect(filterAndSortResults(results, "todo", "人事", "default").map((item) => item.id)).toEqual(["a"]);
    expect(filterAndSortResults(results, "memo", "人事", "default")).toEqual([]);
    filterAndSortResults(results, "all", "", "title");
    expect(results.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("日期升降序都将未设置和无效日期放在最后", () => {
    expect(filterAndSortResults(results, "all", "", "date-asc").map((item) => item.id)).toEqual(["b", "a", "c", "d"]);
    expect(filterAndSortResults(results, "all", "", "date-desc").map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("标题中的数字按自然顺序排序", () => {
    expect(filterAndSortResults(results, "all", "", "title").map((item) => item.id)).toEqual(["c", "b", "d", "a"]);
  });
});

describe("标签筛选选项", () => {
  it("合并预设标签与数据中出现的标签并去重排序", () => {
    const sources = [{ tags: ["人事", "会议"] }, { tags: ["人事"] }, { tags: [] }];
    expect(collectFilterTags(sources, ["党建", "人事"])).toEqual(["党建", "会议", "人事"]);
  });

  it("无数据时仍返回预设标签，保证下拉不会为空", () => {
    expect(collectFilterTags([], ["党建", "人事"])).toEqual(["党建", "人事"]);
  });

  it("忽略空标签", () => {
    expect(collectFilterTags([{ tags: ["", "会议"] }], [])).toEqual(["会议"]);
  });
});
