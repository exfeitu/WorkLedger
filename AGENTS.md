# AGENTS.md — Work Ledger

浏览器端个人工作生命周期管理工具：时间轴工作回溯 + 待办管理 + 日历 + 备忘录/周期 SOP，单人使用，Next.js 16 静态导出 + GitHub Pages 部署。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16 (App Router)，`output: 'export'` |
| 语言 | TypeScript 5.8，strict 模式 |
| 样式 | 手写 CSS，`globals.css` 按模块拆分到 `styles/`，无框架 |
| 存储 | LocalStorage + GitHub Gist 云同步（纯 fetch） |
| 部署 | GitHub Pages（`.github/workflows/deploy.yml`） |
| 测试 | Vitest（单元测试）+ Playwright（E2E） |
| 工具 | pinyin-pro（拼音搜索） |

**本项目没有**：数据库、后端、SSR、API Routes、Tailwind、组件库。

> 没有的东西和有的东西同等重要。不要擅自引入。

## 常用命令

```bash
npm run dev     # localhost:3536/WorkLedger
npm run build   # 静态导出到 out/
npm run lint    # ESLint
npm run check:architecture # CSS 入口、模块依赖约束
npm run typecheck # 全仓库 TypeScript 检查
npm test        # vitest 单元测试
```

## 硬约束

| # | 禁令 | 原因 |
|---|---|---|
| 1 | 不引入 CSS 框架 / 组件库 | 已有完整手写体系 |
| 2 | 不用 SSR / API Routes / Middleware | `output: 'export'` 不支持 |
| 3 | 不加数据库或后端依赖 | Gist API 已覆蓋 |
| 4 | 不在缺少 migration 的情况下修改既有数据字段 | 否则会破坏历史数据兼容 |
| 5 | 不改 `dev` 端口（3536） | `scripts/dev.js` 硬编码约定 |
| 6 | 不改 `next.config.mjs` 的 `output` | 会导致部署失败 |
| 7 | 不直接操作 LocalStorage | 必须通过 `lib/storage.ts` |
| 8 | 不在组件中直接修改 events/todos 数组 | 必须经 `setData()` + `syncLinkedItems()` |
| 9 | 在已授权范围内直接执行，不重复确认；缺少关键输入或涉及未授权的外部发布/付费/破坏性动作时才确认 | 高效执行且不扩大授权 |
| 10 | 新增/修改数据字段时必须同步 migration、导入导出和 Gist 数据结构 | 保持旧数据与多端同步兼容 |
| 11 | 先检查 git status；不得覆盖、清理、提交或发布其他人未完成的 WIP | 避免破坏并行 Agent 工作 |
| 12 | 首页 Event/Todo 业务变更放在 `lib/ledger-operations.ts`，组件只调用 `setData()` | 保持纯函数可测、UI 与数据逻辑分离 |
| 13 | `app/globals.css` 只放按顺序排列的 CSS import | 新功能样式放对应模块，避免全局样式再次膨胀 |

## 关键文件速查

| 文件 | 职责 |
|---|---|
| `types.ts` | 数据契约，所有类型定义 |
| `app/page.tsx` | 首页，状态中心，使用 `useAppData()` hook |
| `app/calendar/page.tsx` | 日历页，共享 `useAppData()` hook |
| `app/memo/page.tsx` | 备忘录/知识库页：复盘心得 + 周期备忘 |
| `components/app-header.tsx` | 三页共用的顶部导航栏 |
| `components/day-timeline.tsx` | 自适应时间轴（1/3/7/30 天切换、滚轮、拖拽、详情选择） |
| `components/memo-*.tsx` | 备忘录列表、编辑、详情与步骤编辑 |
| `lib/storage.ts` | 存储层统一出口（re-export） |
| `lib/storage-migrate.ts` | 数据版本迁移系统 |
| `lib/storage-local.ts` | LocalStorage、自定义标签、JSON 导入导出 |
| `lib/storage-gist.ts` | Gist 云同步、同步状态 |
| `lib/utils.ts` | 纯函数：`syncLinkedItems`、树构建、格式化、拼音 |
| `lib/ledger-operations.ts` | 工作记录/待办保存、删除、恢复、批量操作的纯业务层 |
| `lib/search-index.ts`、`lib/search-results.ts` | 搜索索引及匹配/筛选/排序，页面仅组装 |
| `lib/timeline-adaptive.ts` | 时间轴纯函数（待办碰撞聚合、最多 3 层记录、逐日统计、密度等级） |
| `lib/memo.ts` | 备忘录纯函数：富文本转文本、搜索文本、排序、进度 |
| `lib/constants.ts` | 共享常量（BASE_TAGS） |
| `hooks/use-app-data.ts` | 共享 hook：数据加载、持久化、云同步、撤销 |

## 详细文档

- **`docs/AI-START-HERE.md` — 新 Agent 必读：任务→源码定位、依赖边界、验证流程及 WIP 安全**
- `docs/ARCHITECTURE.md` — 完整架构：数据流、组件约定、CSS 规范、标签系统、时间轴系统、版本迁移
- `docs/PATTERNS.md` — 常见改动模式：加字段、加页面、加组件、加弹窗、改存储结构
- `docs/AI-DEVELOPMENT.md` — AI 辅助开发方法论和流程
- `docs/TODO.md` — 后续改进清单
- `README.md` — 用户文档
