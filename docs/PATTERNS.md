# 常见改动模式

每个模式按步骤排列。先读 `docs/AI-START-HERE.md` 并运行 `git status --short --branch`，不要覆盖当前其他 Agent 的未提交改动。遵循这些步骤可以避免常见的遗漏。

---

## 1. 给 EventItem、TodoItem 或 MemoItem 加字段

1. 在 `types.ts` 中加字段（可选字段用 `?`）
2. `CURRENT_DATA_VERSION` 加 1，在 `migrations` 末尾追加迁移函数
3. 在用到该类型的组件中处理新字段的展示和编辑
4. **容易遗漏**：`lib/utils.ts` 的 `exportRows()` 函数需要在导出映射中加上新字段
5. **容易遗漏**：`components/export-panel.tsx` 的 `buildCsv()` 函数需要在 CSV 表头和数据行中加上新字段
6. **容易遗漏**：组件代码需要对旧数据中 `undefined` 的新字段做空值兜底

---

## 2. 新增一个页面

1. 在 `app/` 下创建目录 + `page.tsx`（以 `"use client"` 开头）
2. 使用 `useAppData()` hook 获取数据和 cloudEnabled
3. 在 `components/app-header.tsx` 中加入页面入口，并更新 `activePage` 类型/高亮逻辑
4. **不要**创建 `layout.tsx`（除非该路由有独立布局需求）
5. **不要**使用 `generateStaticParams` 或 `generateMetadata`（静态导出不支持）
6. 如果页面需要共享数据、云同步、导入导出或撤销，优先复用 `useAppData()` 和现有 `SettingsPanel` / `ExportPanel` 模式

---

## 3. 新增一个组件

1. 在 `components/` 下创建文件，以 `"use client"` 开头
2. Props 类型定义在组件文件内，用 `type` 不用 `interface`
3. 样式放到对应模块：时间轴 → `timeline.css`；首页与统计 → `workspace.css`；备忘录 → `memo.css`；归档 → `archive.css`；通用 UI → `components.css`；弹窗 → `modal.css`
4. `app/globals.css` 只维护模块 `@import` 顺序；修改前先定位原选择器，避免末尾叠加覆盖规则

---

## 4. 新增一个模态弹窗

1. 在 `components/` 下创建文件
2. 使用 `.modal-overlay > .modal-panel` 的 HTML 结构（CSS 已有）
3. 表单状态自管理，通过 `onSave(data)` + `onClose()` 回调与父通信
4. 点击遮罩层关闭：`e.target === e.currentTarget` 判断
5. 标签选择用 chip 模式：预设标签 `.chip-button.chip-tag` + 自定义输入
6. 页面回调只负责选择/弹窗状态；Event/Todo 业务变更调用 `lib/ledger-operations.ts`，再 `setData(next)`

---

## 5. 修改双向关联

1. 先在 `lib/ledger-operations.ts` 里实现纯数据操作（入参：旧快照 + 操作参数；出参：新 events/todos 快照），补 `lib/__tests__/ledger-operations.test.ts`。
2. 所有 Event/Todo 变更必须保证 `linkedTodoIds` ↔ `linkedEventIds` 对称；`syncLinkedItems()` 会合并两端引用，**解绑须同时清除两侧**。
3. 首页调用纯业务操作后执行 `setData(next)`；不要把存储副作用、弹窗开关或时间戳生成塞进纯函数。
4. 日历页还有独立页面级修改路径；调整关联规则时必须同步检查 `app/calendar/page.tsx` 并补回归测试。

---

## 6. 修改数据存储结构

1. 先在 `types.ts` 中改类型
2. 在 `lib/storage-migrate.ts` 中更新 `CURRENT_DATA_VERSION` 并追加 migration
3. 在 `lib/storage-local.ts` 同步 LocalStorage、导入导出和结构校验；**不要**直接改既有 key 名
4. 在 `lib/storage-gist.ts` 同步 `createGist`、`updateGist`、`fetchRawGist`、`pushToCloud` / `pullAndMerge`
5. 新字段必须考虑旧备份/旧 Gist 缺失时的默认值，并补对应 migration / storage 单测
