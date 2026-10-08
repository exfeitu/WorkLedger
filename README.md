# 工作台账（Work Ledger）

浏览器端个人工作生命周期管理工具：用时间轴回溯工作、用待办跟进任务、用备忘录沉淀复盘与周期 SOP，单人即可使用。

## 当前功能

- **自适应时间轴**：固定 1/3/7/30 天切换，滚轮跨阈值切换展示密度，拖拽平移、日期跳转和“今天”定位。1 天用真实时间圆点和最多 3 层工作块；3 天看时间分布；7 天看优先级数量和工时；30 天看六级密度，点击日期回到详细视图。单项先查看侧栏详情，再按需编辑。
- **重叠处理**：详细视图以真实时间点显示待办、按最多 3 层放置工作记录；局部拥挤时聚合或显示溢出数量，点击查看具体项目。
- **快速记录工作**：模态弹窗补录，默认"过去2小时到现在"，快捷时间调整按钮，标签 chip 选择，支持关联待办
- **新建任务**：模态弹窗，标签 chip 选择，支持子任务步骤、优先级/状态/部门/联系人字段
- **多级待办树**：父子任务嵌套，紧凑摘要 + 按需展开详情，步骤进度展示，部门/联系人/备注
- **待办归档**：已完成/已取消任务自动进入归档区，可一键恢复；支持显式批量选择模式
- **Event ↔ Todo 双向关联**：工作记录与待办任务相互关联，自动同步
- **文字日记视图**：当天工作记录按时间段展示
- **日历视图**：按天查看日程/待办，添加日程自动生成关联待办，卡片可点击编辑
- **备忘录 / 知识库**：`/memo` 提供“复盘心得”富文本笔记与“周期备忘”Checklist，支持易错点标记、标签、全文与拼音搜索
- **全局搜索**：关键词匹配 + 拼音（全拼/首字母）支持 + 命中高亮
- **数据统计**：工作记录量、待办完成率、标签分布概览
- **批量操作**：多选待办批量修改状态 / 删除
- **操作撤销**：Ctrl+Z 撤销最近 20 步修改
- **数据持久化**：LocalStorage 自动保存 + JSON/CSV 导出 + JSON 导入恢复
- **GitHub Gist 云同步**：自动备份到私有 Gist，跨设备恢复，自带版本历史，同步状态指示
- **数据版本迁移**：旧版本数据自动升级，加字段不怕兼容性问题
- **GitHub Pages 自动部署**：push master 即构建发布
- **移动端适配**：响应式布局、键盘快捷键

## 技术栈

Next.js 16（静态导出） + TypeScript 5.8 + 手写 CSS + LocalStorage + GitHub Gist API

## 运行方式

```bash
npm install          # 安装依赖
npm run dev          # localhost:3536/WorkLedger
npm run build        # 静态导出到 out/
npm run lint         # ESLint 检查
npm run check:architecture # 架构边界检查
npm run typecheck    # 全仓库 TypeScript 检查
npm test             # 单元测试（Vitest）
npm run test:e2e     # Playwright E2E（首次需安装 Chromium）
```

## 部署地址与路径

- 主源码仓库：`exfeitu/WorkLedger`，本地开发路径仍为 `/WorkLedger`。
- 新 GitHub Pages：`https://exfeitu.github.io/WorkLedger/`。
- 兼容旧入口：`https://exfeitu.github.io/LittleJobHelper/`。旧仓库只发布跳转页，自动跳转到 `/WorkLedger/` 并保留子路径、查询参数和锚点；不要再把应用源码推送到旧仓库覆盖跳转配置。
- 后续只更新 `WorkLedger/master`：GitHub Pages workflow 与已连接的 Vercel 项目自动部署，旧入口跳转到新 Pages，始终使用其最新版本。
- 两个 Pages 路径同源，在同一浏览器中共享本地存储。`loadSettings()` 会迁移旧命名的 Token/Gist ID，不需要将密钥放到网址、仓库或部署环境中。Vercel 不同源，需在该站配置同步；不能自动共享 Pages 的本地密钥。
- Vercel：继续使用现有 `little-job-helper` 项目，站点根路径 `/`。
- 构建路径由 `SITE_BASE_PATH` 显式指定；未指定时 Vercel 使用根路径，其他环境使用 `/WorkLedger`。保留 `output: 'export'`，Vercel 构建命令为 `npm run build`，输出目录为 `out`。

## 键盘快捷键

| 快捷键 | 作用 |
|--------|------|
| `Ctrl/Cmd + K` | 聚焦搜索框 |
| `Ctrl/Cmd + N` | 新建任务 |
| `Ctrl/Cmd + Shift + N` | 快速记录工作 |
| `Ctrl/Cmd + Z` | 撤销上一步 |
| `Esc` | 关闭当前弹窗 |

## 文档

- `docs/AI-START-HERE.md` — AI 接手项目的修改入口、模块定位、验证和 WIP 安全规范
- `AGENTS.md` — AI 开发上下文文档（项目架构、约定、禁止事项、常见改动模式）
- `docs/ARCHITECTURE.md` — 架构文档
- `docs/PATTERNS.md` — 常见改动模式
- `docs/AI-DEVELOPMENT.md` — AI 辅助开发方法论
- `docs/TODO.md` — 后续改进清单（含已完成项归档）
