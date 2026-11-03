# 架构文档

## 目录结构

```
types.ts                    # 全局类型：EventItem, TodoItem, TodoTreeNode 等
app/
  layout.tsx                # 根布局：lang="zh-CN"、ErrorBoundary
  globals.css               # 仅 @import，新增选择器放 styles/ 模块
  page.tsx                  # 首页：时间轴、待办树、搜索、今日记录、统计
  calendar/page.tsx         # 日历页：按天查看 + 添加日程
  memo/page.tsx             # 备忘录页：复盘心得 + 周期备忘
styles/                     # CSS 按功能模块拆分（顺序即级联顺序）
  variables.css             # 根变量、基础元素、滚动条、body
  layout.css                # 页面骨架、header、面板、通用布局
  timeline.css              # 自适应时间轴
  legacy-timeline.css       # 旧版时间轴（双版本切换开发分支）
  components.css            # 通用组件、日历、待办
  modal.css                 # 弹窗和表单
  workspace.css             # 首页、统计、批量操作、备份提醒
  memo.css                  # 备忘录、富文本
  archive.css               # 待办归档
components/
  app-header.tsx            # 三页共用顶部导航栏（含同步状态指示）
  timeline-switcher.tsx     # 经典版 / 自适应版切换（旧版走 next/dynamic 懒加载）
  legacy-day-timeline.tsx   # 经典版时间轴：连续缩放、拖拽平移、卡片分层
  day-timeline.tsx          # 自适应时间轴工具栏、导航、滚轮、拖拽及详情选择
  adaptive-day-view.tsx     # 1 天与 3 天共用的真实时间画布
  adaptive-three-day-view.tsx
  adaptive-week-view.tsx    # 7 天：每日优先级数量与工时
  adaptive-month-view.tsx   # 30 天：六级密度，点击回到当天
  timeline-detail-panel.tsx # 自适应版侧栏详情
  timeline-popover.tsx      # 聚簇/溢出弹层
  timeline-summary-now.tsx  # 概览视图的“现在”标记
  diary-timeline.tsx        # 文字日记时间轴
  search-panel.tsx          # 搜索结果（命中高亮、类型/标签筛选）
  todo-tree.tsx             # 递归待办树（紧凑摘要、详情展开、批量选择）
  archived-todos-panel.tsx  # 已完成/已取消待办归档与恢复
  memo-list.tsx             # 备忘录列表
  memo-form-panel.tsx       # 备忘录编辑弹窗
  memo-detail-panel.tsx     # 备忘录详情与 checklist 勾选
  memo-steps-editor.tsx     # 周期备忘步骤编辑器
  rich-text-editor.tsx      # 复盘心得富文本编辑器
  work-record-panel.tsx     # 工作记录编辑弹窗（含内联标签管理）
  task-form-panel.tsx       # 任务编辑弹窗（含子步骤编辑）
  settings-panel.tsx        # 云同步设置
  export-panel.tsx          # 导出 JSON/CSV + 导入 JSON
  backup-reminder.tsx       # 周一/周五首开“记得备份”气泡
  stats-dashboard.tsx       # 数据统计概览
  help-icon.tsx             # 可复用 ⓘ 帮助图标
  error-boundary.tsx        # 顶层错误边界
hooks/
  use-app-data.ts           # 共享 hook：数据加载、持久化、云同步、撤销
  use-continuous-day-scroll.ts # 自适应时间轴的连续日滚动与拖拽
  use-keyboard-shortcuts.ts # 全局键盘快捷键
  use-focus-trap.ts         # 模态弹窗焦点锁定
  use-backup-reminder.ts    # 备份提醒（周一周五首开去重）
lib/
  storage.ts                # 存储层统一出口（re-export）
  storage-migrate.ts        # 数据版本迁移系统
  storage-local.ts          # LocalStorage、自定义标签、时间轴版本偏好、JSON 导入导出
  storage-gist.ts           # Gist 云同步、同步状态
  storage-legacy.ts         # 旧 LocalStorage 键名映射
  utils.ts                  # 纯函数：syncLinkedItems、树构建、格式化、拼音、genId
  timeline-adaptive.ts      # 自适应时间轴纯函数（模式、待办碰撞、记录 lane/overflow、统计、密度）
  legacy-timeline-layout.ts # 经典版时间轴纯函数（条目构造、lane、卡片宽度、周聚合）
  ledger-operations.ts      # Event/Todo 的纯业务变更，统一返回双向关联快照
  search-index.ts           # Todo/Event/Memo 搜索索引构建与全文/拼音匹配
  search-results.ts         # 搜索结果类型/标签过滤、排序，以及标签选项聚合
  memo.ts                   # 备忘录纯函数（正文转文本、搜索、排序、进度）
  constants.ts              # 共享常量（BASE_TAGS）
  sample-data.ts            # 示例数据（当前仅用其中的部门选项，其余保留作参考）
```

## 核心类型 (`types.ts`)

```typescript
EventItem {
  id, startTime, endTime, title, detail?, tags[], linkedTodoIds?[], updatedAt
}
TodoItem {
  id, title, startTime?, dueDate?, priority(high|medium|low),
  status(pending|in_progress|completed|cancelled), tags[],
  department?, contactPerson?, remarks?, parentId|null,
  pinnedToToday?, linkedEventIds?[], steps?[], updatedAt
}
TodoTreeNode extends TodoItem { children[], computedStatus }
TodoStep { id, content, completed, scheduledTime? }
MemoItem { id, type("note"|"checklist"), title, tags[], date?, content?, steps?[], createdAt, updatedAt }
MemoStep { id, content, completed, isWarning? }
SearchResult { id, kind("event"|"todo"|"memo"), title, snippet, dateLabel, tags[] }
```

**关键约束**：Event ↔ Todo 通过 `linkedTodoIds` ↔ `linkedEventIds` 双向关联。任何修改关联的操作必须经过 `syncLinkedItems()` 保持两端一致。Memo 独立于 Event/Todo 关联模型，但与它们共用标签、LocalStorage、导入导出和 Gist 云同步。

## 数据流

### 读取

```
loadAndMigrateFromStorage() → 有数据 → useState 初始化
                              ↓ 无数据
                          返回空数组
                              ↓
                    syncLinkedItems(events, todos)
                              ↓
          ┌───────────────────┼───────────────────┬───────────────────┐
          ↓                   ↓                   ↓                   ↓
    filteredTodos          events              memos          allSearchItems(含拼音)
          ↓                   ↓                   ↓                   ↓
    buildTodoTree()     todayRecords       sort/filter        searchResults(过滤)
          ↓
    getTodayFocus()
          ↓
    组件渲染（主要派生计算通过 useMemo）
```

### 写回

```
Event/Todo 操作 → setData()（记录撤销历史）→ syncLinkedItems() → useState 更新
                                                     │
Memo 操作 → setMemos()（独立撤销历史）───────────────┤
                                                     ↓
  useEffect（isInitialized 守卫） → 保存 events / todos / memos / customTags 到 LocalStorage
                                                     │
  useEffect（3s 防抖，离线跳过） → pushToCloud(events, todos, customTags, memos)
                                                     │
                                    合并出的远端更新（mergedFromRemote）
                                                     ↓
                        setData / setMemosState（无历史 setter，不污染撤销栈）
```

**isInitialized 守卫**：防止首次渲染时覆盖 LocalStorage。`isInitialized` 在 `useEffect` 中设为 `true`，确保 hydration 完成前不写存储。

**云端合并回写**：`pushToCloud()` 返回合并后的 `events/todos/memos/customTags`。若本次有远端更新被采纳，hook 直接把结果写回状态与 LocalStorage，否则云端已是最新、界面要等刷新才同步。回写使用无历史的 setter —— 云端合并不是用户操作，`Ctrl+Z` 不应撤销它。

**撤销**：`use-app-data.ts` 为 Event/Todo 和 Memo 维护两套独立历史栈，分别通过 `setData`/`undo` 与 `setMemos`/`undoMemos` 操作；每套上限 20 步。

## 存储层（lib/storage-*）

| 模块 | 职责 |
|------|------|
| `storage-migrate.ts` | `CURRENT_DATA_VERSION`、`migrateData`、`parseVersion`、`migrations[]`（纯函数） |
| `storage-local.ts` | Event/Todo/Memo LocalStorage 读写、版本号、自定义标签、时间轴版本偏好、JSON 导入导出（含结构校验） |
| `storage-gist.ts` | Gist API、Event/Todo/Memo ID 级合并、`initCloudSync`/`pushToCloud`/`pullAndMerge`、同步状态订阅 |
| `storage.ts` | 统一 re-export，既有调用方无感 |

**模块级同步状态**：`syncStatus` / `syncError` / `lastSyncAt` 存在 `storage-gist.ts`，通过 `onSyncChange()` 订阅广播（`use-app-data` 和设置面板都会监听）。

## 组件约定

- 所有组件以 `"use client"` 开头 — 静态导出无 SSR
- Props 类型定义在组件文件内，用 `type` 不用 `interface`
- **展示型组件**：纯展示 + 回调；共享数据状态集中在 `useAppData()`，页面级 UI 状态留在各自 `page.tsx`
- **模态弹窗组件**：自管理表单状态，通过 `onSave`/`onClose` 回调通信；带 `role="dialog"` + `useFocusTrap`
- **派生数据**：全部用 `useMemo`

## CSS 规范

- 颜色/间距用 CSS 自定义属性：`var(--text)`, `var(--muted)`, `var(--border-color)` 等
- 类名语义化：`.line-timeline`, `.todo-card`, `.search-results-wrap`
- 内联 `style` 仅用于运行时动态值（位置、颜色变量），静态样式放 CSS
- **禁止 Tailwind 或任何 CSS 框架**
- 样式按模块拆分到 `styles/`，`globals.css` **仅做 `@import`**（顺序即级联顺序）；新增选择器放归属模块，不要继续向入口追加 CSS
## 工具函数分工

- `lib/utils.ts`：共享函数（`syncLinkedItems`、`buildTodoTree`、格式化、拼音、`genId`）
- `lib/ledger-operations.ts`：Event/Todo 的保存、删除、恢复、批量操作；无 UI/存储副作用，统一调用 `syncLinkedItems()`，页面只提交返回快照
- `app/page.tsx`：仅决定何时调用操作、更新选择和弹窗状态；其他页面修改 Event/Todo 时也应逐步复用此业务层
- `lib/timeline-adaptive.ts`：时间轴纯布局逻辑（可单测）
- `lib/storage-*.ts`：有副作用（`localStorage`、`fetch`、`FileReader`、`Blob`）
- 日期格式化统一用 `Intl.DateTimeFormat("zh-CN", ...)`，不用 `moment`/`dayjs`

## 标签系统

- 预设标签：`lib/constants.ts` 的 `BASE_TAGS` = `["党建", "人事", "纪检", "编制", "档案", "外出", "会议", "其他"]`
- 交互：`.chip-button.chip-tag` 点击切换选中态
- 自定义标签：在新建/编辑工作记录或任务的弹窗内联管理（输入框 + 回车添加，内联 ✕ 删除）
- 保存时合并预设 + 自定义为 `tags: string[]`，无标签默认 `["其他"]`
- 自定义标签存 LocalStorage + 云端同步

## 时间轴（双版本并存）

两套实现同时维护，由 `components/timeline-switcher.tsx` 按偏好只挂载一套；旧版通过 `next/dynamic` 懒加载。偏好写 LocalStorage（`loadTimelineMode` / `saveTimelineMode`），默认**经典版**。

| 版本 | 入口 | 纯计算 | 样式 |
|---|---|---|---|
| 经典版（默认） | `legacy-day-timeline.tsx` | `legacy-timeline-layout.ts` | `styles/legacy-timeline.css` |
| 自适应版 | `day-timeline.tsx` + `adaptive-*-view.tsx` | `timeline-adaptive.ts` | `styles/timeline.css` |

**两版共用规则**
- 条目统一由 `buildTimelineItems()` 构造：工作记录全绘制；待办**只绘制 `pending` / `in_progress`**。`completed` 与 `cancelled` 都不进入时间轴 —— 已完成项已收口到首页归档区，留在轴上会和进行中的计划混淆。
- 概览统计（7 天优先级数量、30 天密度）**仍计入已完成**。即「渲染不绘制、统计仍计入」，避免“本周工作量”被低估。
- 待办锚点取 `startTime`，否则 `dueDate`；逾期只按截止时间判断。待办跨度固定 30 分钟，跨零点时结束时间落到次日（`todoToTimeline`）。
- 未选中时不预占详情栏，详细视图高度跟随实际层数。

**经典版**
- 连续缩放 3%–2400%（`MIN_SCALE` / `MAX_SCALE`）：滚轮锚定光标位置，按钮锚定视窗中心。
- 卡片宽度 `clamp(时长占比, 72px, 260px)`；同侧避让只推 `--card-offset-x`，锚点圆点与连接线不动，保证时间对应关系可读。
- 画布按 today ±730 天铺开，视口虚拟化只渲染可见范围；待办以菱形锚点、记录以真实起止成块。
- 工具栏缩放按钮为「－ 百分比 ＋」，与常见软件方向一致。

**自适应版**
- 固定 1/3/7/30 天；滚轮按 1.75/4.5/10 天阈值切换表现，不无限压缩同一种 UI。
- 待办碰撞按画布宽度换算标签占位，复用最多 3 层；局部同时达 4 项才聚合，聚合窗口固定于首个节点，不随成员延伸成链。
- 工作块最多 3 lane，额外记录通过 `+N记录` 访问，不改变时长或横移；7 天看优先级数量与工时，30 天按六级密度，点击回到当天。
- `AdaptiveDayView` 被 1/3 天共用，周/月单独渲染统计。

**验证**：`legacy-timeline-layout.test.ts` 覆盖条目过滤与跨零点时长；`timeline-adaptive.test.ts` 覆盖聚合、lane、跨日统计和密度；Playwright 覆盖详情编辑、切换、月视图跳转、拖拽及窄屏。系统保留 3536 时可仅为测试设置 `E2E_PORT`，不改变 `npm run dev` 端口。

## 数据版本迁移

- `CURRENT_DATA_VERSION` 定义在 `lib/storage-migrate.ts` 顶部
- `migrations[]` 数组存放各版本的转换函数
- 所有数据入口自动调用 `migrateData()`

**加字段流程**：
1. 在 `types.ts` 加字段（用 `?` 可选）
2. `CURRENT_DATA_VERSION` 加 1
3. 在 `migrations` 末尾追加迁移函数
4. 组件中做好 `undefined` 兜底（`??` 默认值）

## 质量保障

- `npm run build`：类型检查 + 静态导出
- `npm run lint`：ESLint 9 + `eslint-config-next`（关闭 React Compiler 专属规则）
- `npm test`：Vitest 单元测试（纯函数 + buildCsv）
- `npm run test:e2e`：Playwright 冒烟测试（需先 `npx playwright install chromium`）
- `npm run check:architecture`：样式入口/纯业务层边界守卫
- `npm run typecheck`：全仓库 TS 检查，包含 Vitest 测试文件
- CI（deploy.yml）：lint → architecture → test → build → 部署
