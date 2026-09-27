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
  day-timeline.tsx          # 自适应时间轴工具栏、导航、滚轮、拖拽及详情选择
  diary-timeline.tsx        # 文字日记时间轴
  search-panel.tsx          # 搜索结果（命中高亮）
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
  backup-reminder.tsx       # 周一/周五首开"记得备份"气泡
  stats-dashboard.tsx       # 数据统计概览
  help-icon.tsx             # 可复用 ⓘ 帮助图标
  error-boundary.tsx        # 顶层错误边界
hooks/
  use-app-data.ts           # 共享 hook：数据加载、持久化、云同步、撤销
  use-keyboard-shortcuts.ts # 全局键盘快捷键
  use-focus-trap.ts         # 模态弹窗焦点锁定
  use-backup-reminder.ts    # 备份提醒（周一周五首开去重）
lib/
  storage.ts                # 存储层统一出口（re-export）
  storage-migrate.ts        # 数据版本迁移系统
  storage-local.ts          # LocalStorage、自定义标签、JSON 导入导出
  storage-gist.ts           # Gist 云同步、同步状态
  utils.ts                  # 纯函数：syncLinkedItems、树构建、格式化、拼音、genId
  timeline-adaptive.ts      # 时间轴纯函数（模式、待办碰撞、记录 lane/overflow、统计、密度）
  ledger-operations.ts      # Event/Todo 的纯业务变更，统一返回双向关联快照
  search-index.ts           # Todo/Event/Memo 搜索索引构建与全文/拼音匹配
  search-results.ts         # 搜索结果类型/标签过滤和排序
  memo.ts                   # 备忘录纯函数（正文转文本、搜索、排序、进度）
  constants.ts              # 共享常量（BASE_TAGS）
  sample-data.ts            # 示例数据（当前未使用，保留作参考）
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
```

**isInitialized 守卫**：防止首次渲染时覆盖 LocalStorage。`isInitialized` 在 `useEffect` 中设为 `true`，确保 hydration 完成前不写存储。

**撤销**：`use-app-data.ts` 为 Event/Todo 和 Memo 维护两套独立历史栈，分别通过 `setData`/`undo` 与 `setMemos`/`undoMemos` 操作；每套上限 20 步。

## 存储层（lib/storage-*）

| 模块 | 职责 |
|------|------|
| `storage-migrate.ts` | `CURRENT_DATA_VERSION`、`migrateData`、`parseVersion`、`migrations[]`（纯函数） |
| `storage-local.ts` | Event/Todo/Memo LocalStorage 读写、版本号、自定义标签、JSON 导入导出（含结构校验） |
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

## 时间轴缩放与原生时间表达

- **模式**：固定 1/3/7/30 天；滚轮按 1.75/4.5/10 天阈值切换表现，不无限压缩同一种 UI。
- **真实坐标**：日期按本地零点划分；待办取安排时间、否则截止时间。未安排任务单独列出，取消项不绘制，完成项保留勾选点。
- **待办碰撞**：按画布宽度换算标签占位，优先复用最多 3 层；局部同时碰撞达到 4 项才聚合。聚合窗口固定于首个节点，不随成员延伸成链。三天模式隐藏标题，局部邻近节点聚合。午夜标签向内收，时间锚点不移动。
- **待办语义**：不按过去/未来分区或着色；圆点颜色表示优先级，外圈表示进行中，勾选表示完成。逾期只按截止时间判断，并保留原安排/截止锚点；仅安排在过去不等于逾期。未选中时不预占详情栏，详细视图高度跟随实际层数。
- **工作块**：实际开始/结束决定位置与宽度，跨日裁切；最多 3 个 lane，额外记录通过当天 `+N记录` 列表访问，不改变时长或横移。
- **概览**：7 天展示每日高/中/低数量、记录数及工时；30 天按待办数/总工时绘制 0–5 级相对密度，悬停查看统计，点击回到当天。工时为记录时长相加，跨日分摊，不对重叠时间去重。
- **详情**：单项点击选中 ID，侧栏从最新数据派生内容；只有编辑按钮调用已有表单。概览视图不预留空侧栏。
- **交互**：日期跳转、前后时间段、今天、红色当前时间线；拖拽平移，拖过画布边界可切换日期。窄屏允许内部横向滚动，详情置于下方。
- **结构**：`lib/timeline-adaptive.ts` 负责纯计算；`AdaptiveDayView` 被 1/3 天共用，周/月单独渲染统计。旧二维装箱及浮动卡片路径已移除。
- **验证**：Vitest 覆盖聚合、lane、跨日统计和密度；Playwright 覆盖详情编辑、四档切换、月视图跳转、拖拽及窄屏。系统保留 3536 时可仅为测试设置 `E2E_PORT`，不改变 `npm run dev` 端口。

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
