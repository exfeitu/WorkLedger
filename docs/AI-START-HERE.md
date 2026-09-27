# AI 开发入口：改哪里、如何验证

这是给新接手的 AI/Agent 的执行索引，不是功能需求清单。先看本文件，再按改动类型读取相关源码；不要无差别读完整仓库。

## 开始前（必须）
1. 运行 `git status --short --branch` 和 `git log -3 --oneline`，确认当前分支、未提交改动和本地/远端差异。
2. 若工作区不干净：保留所有已有修改和未跟踪文件。只修改本次必要文件；不要 reset、clean、覆盖或擅自提交他人的进行中工作。
3. 读取 `AGENTS.md` 的技术硬约束及 `docs/ARCHITECTURE.md` 中对应模块。
4. 记录本次改动范围和可验证的验收条件；先定位现有入口与测试再编辑。
5. 修改后至少运行 `npm run check:architecture && npm run lint && npm run typecheck && npm test && npm run build`；UI 改动再跑对应 Playwright 与真实页面检查。
6. 只有在确认工作区归属、测试通过且发布被授权后才提交/推送；不要把其他人的 WIP 混入发布。

## 分层与依赖方向
```text
app/*/page.tsx           页面装配、筛选、导航、弹窗开关
        ↓
components/*             UI 与输入/展示；通过 props 和 callbacks 通信
        ↓
lib/ledger-operations.ts  工作记录/待办的纯业务变更（返回完整关联快照）
lib/timeline-adaptive.ts  时间数据、碰撞、聚合、日统计的纯计算
lib/search-index.ts       三种数据的索引构建与文本匹配
lib/search-results.ts     搜索结果的筛选与排序
        ↓
types.ts + lib/utils.ts   数据契约及共享纯函数
        ↑
hooks/use-app-data.ts     状态、撤销、读写与云同步编排（组件消费）
        ↓
lib/storage.ts → storage-local / storage-gist / storage-migrate
```
这是一张职责图，不是运行时的严格单向 import 树：组件可读取 hook，纯函数不能反向读取 UI、React 或存储。

## 改动定位表
| 需求 | 首先查看 | 必须联动 |
|---|---|---|
| 工作记录或待办保存/删除/批量状态 | `lib/ledger-operations.ts` | `app/page.tsx` 调用、`lib/__tests__/ledger-operations.test.ts` |
| 跨页面数据状态、撤销、云同步 | `hooks/use-app-data.ts` | `lib/storage-*.ts`、迁移与存储测试 |
| 改数据字段 | `types.ts`、`lib/storage-migrate.ts` | `docs/PATTERNS.md` 的字段变更清单、导入导出和云端测试 |
| 1 天任务/记录的重叠与统计 | `lib/timeline-adaptive.ts` | `components/adaptive-day-view.tsx`、timeline 单测及 E2E |
| 3/7/30 天展示 | `components/adaptive-three-day-view.tsx`、`adaptive-week-view.tsx`、`adaptive-month-view.tsx` | `components/day-timeline.tsx`、timeline 单测/E2E |
| 时间轴缩放、日期导航、详情选择 | `components/day-timeline.tsx` | `hooks/use-continuous-day-scroll.ts`、`components/timeline-detail-panel.tsx` |
| 首页搜索与排序 | `lib/search-index.ts`、`lib/search-results.ts` | `components/search-panel.tsx`、相关单测；`app/page.tsx` 只保留 useMemo 组装 |
| 日历 | `app/calendar/page.tsx` | Event/Todo 双向关联、日历 E2E |
| 备忘录与富文本 | `app/memo/page.tsx`、`lib/memo.ts` | `components/memo-*.tsx`、memo 测试 |
| 改样式 | `app/globals.css`（只看 import 顺序） | 下面的 CSS 模块归属表、截图对比 |

## CSS 所有权与版本隔离
- `app/globals.css` **只放 @import**；不在此新增选择器。
- `styles/variables.css`：令牌/基础；`layout.css`：整体布局；`components.css`：通用部件；`modal.css`：弹窗。
- `styles/timeline.css`：自适应时间轴；`styles/legacy-timeline.css`：旧版时间轴（仅在切换功能完整集成时存在）。
- `styles/workspace.css`：首页、统计、批量、备份提醒；`styles/memo.css`：备忘录/富文本；`styles/archive.css`：归档。
- 不把同一个选择器分别追加到多个文件末尾“覆盖”旧样式；找到原定义再改。不要让新时间轴和旧版共用不必要的全局类。

## 数据与 UI 交界
- Event ↔ Todo 是双向关系。业务变更通过 `lib/ledger-operations.ts` 返回**两份数组**；页面只调用 `setData(result)` 提交，不能就地修改数据。
- `syncLinkedItems()` 使用双侧链接并集，不能仅删一侧就声称已解除关联；解绑需先同时清理两端，并补回归测试。
- `useAppData()` 负责初始化守卫、自动保存、Gist 合并和撤销；不要把浏览器副作用放到 `lib/ledger-operations.ts`。
- 历史数据、导入文件、私有 Gist 属于用户数据，不要用测试脚本或重构顺手覆盖。

## 完成判据
- 变更前后的关键用户操作仍可用；新增业务分支有单测。
- 对 UI 至少测：空数据、同刻密集、跨日、窄屏、切换视图；保留旧版时分别测试新旧两条路径。
- 记录修改文件、测试输出及尚未解决的风险。未通过测试不要写“已完成”；未经确认不要写“已上线”。

