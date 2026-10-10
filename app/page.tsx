"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { TimelineSwitcher } from "@/components/timeline-switcher";
import { DiaryTimeline } from "@/components/diary-timeline";
import { SearchPanel } from "@/components/search-panel";
import { TodoTree } from "@/components/todo-tree";
import { ArchivedTodosPanel } from "@/components/archived-todos-panel";
import { TaskFormPanel } from "@/components/task-form-panel";
import { WorkRecordPanel } from "@/components/work-record-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { ExportPanel } from "@/components/export-panel";
import { AppHeader } from "@/components/app-header";
import { BackupReminder } from "@/components/backup-reminder";
import { StatsDashboard } from "@/components/stats-dashboard";
import { HelpIcon } from "@/components/help-icon";
import { departmentOptions } from "@/lib/sample-data";
import {
  buildTodoTree,
  formatDateTime,
  getFilterValues,
  getTodayFocus,
  isTodoActive,
  isTodoArchived,
  syncLinkedItems,
} from "@/lib/utils";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { EventItem, TodoItem } from "@/types";
import { useAppData } from "@/hooks/use-app-data";
import { buildSearchIndex, findSearchResults } from "@/lib/search-index";
import { deleteTodos, deleteWorkRecord, restoreTodo, setTodosStatus, upsertTodo, upsertWorkRecord } from "@/lib/ledger-operations";

export default function HomePage() {
  const [legacyTimeline, setLegacyTimeline] = useState(true);
  const {
    events, todos, memos, setMemos, customTags, isInitialized, cloudEnabled, isOnline,
    syncStatus, syncError, canUndo, addCustomTag, deleteCustomTag,
    setCustomTags, setData, undo, refreshCloudStatus,
  } = useAppData();

  const [departmentFilter, setDepartmentFilter] = useState<string>("全部部门");
  const [contactFilter, setContactFilter] = useState<string>("全部联系人");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllTodos, setShowAllTodos] = useState(false);
  const [showWorkRecordPanel, setShowWorkRecordPanel] = useState(false);
  const [showTaskFormPanel, setShowTaskFormPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | undefined>(undefined);
  const [editingTodo, setEditingTodo] = useState<TodoItem | undefined>(undefined);
  const [selectedTodoIds, setSelectedTodoIds] = useState<Set<string>>(new Set());
  const [todoSelectionMode, setTodoSelectionMode] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleTagCreated = addCustomTag;
  const handleTagDeleted = deleteCustomTag;

  const departmentChoices = useMemo(
    () => ["全部部门", ...Array.from(new Set([...departmentOptions, ...getFilterValues(todos, "department")]))],
    [todos],
  );
  const contactChoices = useMemo(() => ["全部联系人", ...getFilterValues(todos, "contactPerson")], [todos]);

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      const matchDepartment = departmentFilter === "全部部门" || todo.department === departmentFilter;
      const matchContact = contactFilter === "全部联系人" || todo.contactPerson === contactFilter;
      return matchDepartment && matchContact;
    });
  }, [contactFilter, departmentFilter, todos]);

  // 待办列表只显示未完成的（未开始/进行中）；已完成/已取消进入归档区
  const activeTodos = useMemo(() => filteredTodos.filter(isTodoActive), [filteredTodos]);
  const archivedTodos = useMemo(() => filteredTodos.filter(isTodoArchived), [filteredTodos]);

  const todoTree = useMemo(() => buildTodoTree(activeTodos), [activeTodos]);
  const archivedTodoTree = useMemo(() => buildTodoTree(archivedTodos), [archivedTodos]);
  const todayFocus = useMemo(() => getTodayFocus(filteredTodos), [filteredTodos]);
  const todayRecords = useMemo(() => {
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    return events.filter((event) => event.startTime.startsWith(todayStr));
  }, [events]);
  const linkedTodoTitles = useMemo(() => Object.fromEntries(todos.map((todo) => [todo.id, todo.title])), [todos]);
  const linkedEventTitles = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event.title])), [events]);

  const allSearchItems = useMemo(() => buildSearchIndex(events, todos, memos), [events, todos, memos]);
  const searchResults = useMemo(() => findSearchResults(allSearchItems, searchQuery), [allSearchItems, searchQuery]);

  const handleSaveTask = (todo: TodoItem) => {
    setData(upsertTodo({ events, todos }, todo));
    setShowTaskFormPanel(false);
    setEditingTodo(undefined);
  };

  const handleSaveWorkRecord = (event: EventItem, linkedTodoId: string | null) => {
    setData(upsertWorkRecord({ events, todos }, event, linkedTodoId));
    setShowWorkRecordPanel(false);
    setEditingEvent(undefined);
  };

  const handleDeleteEvent = (id: string) => {
    setData(deleteWorkRecord({ events, todos }, id));
    setEditingEvent(undefined);
  };

  const handleDeleteTodo = (id: string) => {
    setData(deleteTodos({ events, todos }, new Set([id])));
    setEditingTodo(undefined);
  };

  // 归档恢复：一键改回"进行中"，回到待办列表
  const handleRestoreTodo = (id: string) => {
    setData(restoreTodo({ events, todos }, id, new Date().toISOString()));
  };

  // 批量选择
  const toggleSelectTodo = useCallback((id: string) => {
    setSelectedTodoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const batchDeleteTodos = useCallback(() => {
    if (selectedTodoIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedTodoIds.size} 个待办？此操作不可恢复。`)) return;
    setData(deleteTodos({ events, todos }, selectedTodoIds));
    setSelectedTodoIds(new Set());
    setTodoSelectionMode(false);
  }, [selectedTodoIds, todos, events, setData]);

  const batchSetStatus = useCallback((status: TodoItem["status"]) => {
    if (selectedTodoIds.size === 0) return;
    setData(setTodosStatus({ events, todos }, selectedTodoIds, status, new Date().toISOString()));
    setSelectedTodoIds(new Set());
    setTodoSelectionMode(false);
  }, [selectedTodoIds, todos, events, setData]);

  // 键盘快捷键
  useKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onNewTask: () => setShowTaskFormPanel(true),
    onNewRecord: () => setShowWorkRecordPanel(true),
    onUndo: undo,
    onEscape: () => {
      setShowWorkRecordPanel(false);
      setShowTaskFormPanel(false);
      setShowSettingsPanel(false);
      setShowExportPanel(false);
      setEditingEvent(undefined);
      setEditingTodo(undefined);
    },
  });

  // 未初始化时显示骨架屏
  if (!isInitialized) {
    return (
      <main className="app-shell">
        <div className="skeleton-block" style={{ height: 84 }} />
        <div className="skeleton-block" style={{ height: 420 }} />
        <div className="two-col">
          <div className="skeleton-block" style={{ height: 220 }} />
          <div className="skeleton-block" style={{ height: 220 }} />
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="workspace-simple">
        <AppHeader
          activePage="timeline"
          tips={[
            "聚焦时间轴回溯、今日记录、待办跟进与快速检索。",
            "时间轴支持鼠标滚轮缩放（1小时 ~ 30天）和拖拽平移。",
            "待办和工作记录自动同步到 GitHub Gist 云端。",
            "快捷键：Ctrl+K 搜索 · Ctrl+N 新建任务 · Ctrl+Shift+N 快速记录 · Ctrl+Z 撤销。",
          ]}
          cloudEnabled={cloudEnabled}
          isOnline={isOnline}
          syncStatus={syncStatus}
          syncError={syncError}
          onQuickRecord={() => setShowWorkRecordPanel(true)}
          onAddTask={() => setShowTaskFormPanel(true)}
          onOpenSync={() => setShowSettingsPanel(true)}
          onOpenExport={() => setShowExportPanel(true)}
        />

        <div className="content-layout simple-layout">
          <section className="content-main">
            {/* 时间轴 —— 第一个功能模块，独占全宽 */}
            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>时间轴</h2>
                    <HelpIcon tips={[
                      "滚轮缩放自动切换 1 / 3 / 7 / 30 天展示密度。",
                      "拖拽平移，使用日期和前后按钮跳转时间段。",
                      "点击待办或工作记录先查看右侧详情，再按需编辑。",
                      "待办圆点表示时间，颜色表示优先级，外圈表示进行中，勾选表示完成。",
                      "工作块宽度表示真实时长；周视图看统计，月视图看密度。",
                    ]} />
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={undo}
                      disabled={!canUndo}
                      title="撤销上一步 (Ctrl+Z)"
                    >
                      ↩ 撤销
                    </button>
                    <button type="button" className="timeline-version-toggle" aria-pressed={legacyTimeline}
                      aria-label={legacyTimeline ? "切换到新版时间轴" : "切换到旧版时间轴"}
                      onClick={() => setLegacyTimeline(value => !value)}>
                      {legacyTimeline ? "体验新版 ↗" : "返回经典版 ↗"}
                    </button>
                  </div>
                </div>
                <TimelineSwitcher legacy={legacyTimeline} events={events} todos={todos} onEventClick={setEditingEvent} onTodoClick={setEditingTodo} />
              </article>
            </section>

            {/* 今日待办 + 今日工作记录 并排 */}
            <div className="two-col">
              <section className="grid overview-grid">
                <article className="panel section-card">
                  <div className="section-head section-head-tight">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <h2>今日待办</h2>
                      <HelpIcon tips={[
                        "显示今日需要跟进的待办任务，按优先级排列。",
                        "使用顶部\"📝 快速记录工作\"按钮记录工作。",
                        "使用顶部\"+ 添加任务\"按钮创建待办。",
                        "点击时间轴上的待办先查看详情，再按需编辑或删除。",
                      ]} />
                    </div>
                  </div>
                  <div className="focus-list">
                    {todayFocus.length > 0 ? (
                      todayFocus.map((item) => (
                        <div key={item.id} className="focus-item" style={{
                          padding: '16px',
                          marginBottom: '12px',
                          background: 'var(--card-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '16px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text)' }}>{item.title}</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
                              {item.department ?? "未指定部门"} · {item.contactPerson ?? "未指定联系人"}
                            </p>
                          </div>
                          <div className="focus-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                            <span className={`priority priority-${item.priority}`} style={{ fontSize: '0.75rem' }}>{item.priority}</span>
                            <strong style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{formatDateTime(item.dueDate)}</strong>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                        <p>暂无今日待办</p>
                      </div>
                    )}
                  </div>
                </article>
              </section>

              <section className="grid overview-grid">
                <article className="panel section-card">
                  <div className="section-head section-head-tight">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <h2>今日工作记录</h2>
                      <HelpIcon tips={[
                        "以时间线形式展示今日新增的工作记录。",
                        "使用顶部\"📝 快速记录工作\"按钮添加记录。",
                        "每条记录包含标题、详情、标签和关联待办。",
                        "点击时间轴上的工作块先查看详情，再按需编辑或删除。",
                      ]} />
                    </div>
                  </div>
                  <DiaryTimeline events={todayRecords} />
                </article>
              </section>
            </div>

            {/* 数据统计（不太重要，置于今日待办/工作记录下方） */}
            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>数据统计</h2>
                    <HelpIcon tips={[
                      "展示工作记录量、待办状态分布和标签使用情况。",
                      "标签分布取出现次数最多的前 8 个。",
                    ]} />
                  </div>
                </div>
                <StatsDashboard events={events} todos={todos} />
              </article>
            </section>

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>待办任务</h2>
                    <span className="todo-count-badge">未完成 {activeTodos.length} 项</span>
                    <HelpIcon tips={[
                      "使用顶部下拉菜单按\"部门\"和\"联系人\"筛选待办。",
                      "列表只显示未完成的待办，右上角数字即剩余待办数。",
                      "已完成/已取消的任务自动进入下方\"已归档\"区。",
                      "点击任意待办卡片可编辑内容或删除。",
                      "勾选多个待办后可批量修改状态或删除。",
                    ]} />
                  </div>
                  <div className="filters">
                    <button
                      className={`ghost-button todo-selection-mode-button ${todoSelectionMode ? "is-active" : ""}`}
                      type="button"
                      aria-pressed={todoSelectionMode}
                      onClick={() => {
                        setTodoSelectionMode((active) => !active);
                        if (todoSelectionMode) setSelectedTodoIds(new Set());
                      }}
                    >
                      {todoSelectionMode ? "退出批量" : "批量选择"}
                    </button>
                    <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                      {departmentChoices.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <select value={contactFilter} onChange={(event) => setContactFilter(event.target.value)}>
                      {contactChoices.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedTodoIds.size > 0 && (
                  <div className="batch-bar">
                    <span>已选 {selectedTodoIds.size} 项</span>
                    <button className="chip-button" type="button" onClick={() => batchSetStatus("in_progress")}>
                      标记进行中
                    </button>
                    <button className="chip-button" type="button" onClick={() => batchSetStatus("completed")}>
                      标记完成
                    </button>
                    <button className="chip-button batch-danger" type="button" onClick={batchDeleteTodos}>
                      批量删除
                    </button>
                    <button className="chip-button" type="button" onClick={() => {
                      setSelectedTodoIds(new Set());
                      setTodoSelectionMode(false);
                    }}>
                      取消选择
                    </button>
                  </div>
                )}

                {activeTodos.length === 0 ? (
                  <p className="empty-note" style={{ padding: "16px 0" }}>
                    没有未完成的待办 🎉
                  </p>
                ) : (
                  <TodoTree nodes={todoTree} linkedEventTitles={linkedEventTitles} maxDisplay={showAllTodos ? undefined : 3} onTodoClick={setEditingTodo} selectedIds={selectedTodoIds} onToggleSelect={todoSelectionMode ? toggleSelectTodo : undefined} />
                )}
                {activeTodos.length > 3 && (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setShowAllTodos(!showAllTodos)}
                    style={{ marginTop: '12px', width: '100%' }}
                  >
                    {showAllTodos ? "收起" : `展开全部 (${activeTodos.length} 个未完成)`}
                  </button>
                )}
              </article>
            </section>

            {/* 已归档：已完成/已取消的待办，可查看与一键恢复 */}
            <ArchivedTodosPanel
              nodes={archivedTodoTree}
              onRestore={handleRestoreTodo}
              onTodoClick={setEditingTodo}
            />

            <section className="grid overview-grid">
              <article className="panel section-card">
                <div className="section-head section-head-tight">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2>搜索结果</h2>
                    <HelpIcon tips={[
                      "输入关键词后自动搜索匹配的待办、工作记录和备忘录。",
                      "搜索范围包括标题、内容和标签，支持拼音。",
                      "可按类型和标签组合筛选，按日期或标题排序。",
                      "日期为待办截止时间、记录开始时间或备忘日期；未设置日期的结果排在最后。",
                    ]} />
                  </div>
                </div>
                <SearchPanel results={searchResults} query={searchQuery} onQueryChange={setSearchQuery} inputRef={searchInputRef} />
              </article>
            </section>
          </section>

          <aside className="right-rail panel">
            {/* 右侧边栏预留 */}
          </aside>
        </div>
      </section>

      {showWorkRecordPanel && (
        <WorkRecordPanel
          events={events}
          todos={todos}
          linkedTodoTitles={linkedTodoTitles}
          customTags={customTags}
          onTagCreated={handleTagCreated}
          onTagDeleted={handleTagDeleted}
          onSave={handleSaveWorkRecord}
          onClose={() => setShowWorkRecordPanel(false)}
        />
      )}

      {showTaskFormPanel && (
        <TaskFormPanel
          customTags={customTags}
          onTagCreated={handleTagCreated}
          onSave={handleSaveTask}
          onClose={() => setShowTaskFormPanel(false)}
        />
      )}

      {/* 编辑工作记录（从时间轴点击进入） */}
      {editingEvent && (
        <WorkRecordPanel
          events={events}
          todos={todos}
          linkedTodoTitles={linkedTodoTitles}
          editEvent={editingEvent}
          customTags={customTags}
          onTagDeleted={handleTagDeleted}
          onTagCreated={handleTagCreated}
          onSave={handleSaveWorkRecord}
          onDelete={handleDeleteEvent}
          onClose={() => setEditingEvent(undefined)}
        />
      )}

      {/* 编辑任务（从待办树点击进入） */}
      {editingTodo && (
        <TaskFormPanel
          editTodo={editingTodo}
          customTags={customTags}
          onTagCreated={handleTagCreated}
          onSave={handleSaveTask}
          onDelete={handleDeleteTodo}
          onClose={() => setEditingTodo(undefined)}
        />
      )}

      {showSettingsPanel && (
        <SettingsPanel
          events={events}
          todos={todos}
          customTags={customTags}
          memos={memos}
          onDataLoaded={(loadedEvents, loadedTodos, loadedTags, loadedMemos) => {
            const synced = syncLinkedItems(loadedEvents, loadedTodos);
            setData(synced);
            setCustomTags(loadedTags);
            setMemos(loadedMemos);
            setShowSettingsPanel(false);
          }}
          onClose={() => {
            setShowSettingsPanel(false);
            refreshCloudStatus();
          }}
        />
      )}

      {showExportPanel && (
        <ExportPanel
          events={events}
          todos={todos}
          customTags={customTags}
          memos={memos}
          onImport={(loadedEvents, loadedTodos, loadedTags, loadedMemos) => {
            const synced = syncLinkedItems(loadedEvents, loadedTodos);
            setData(synced);
            // 标签随导入覆盖（旧备份无标签字段时 importDataFromFile 已回退为保留本地标签）
            setCustomTags(loadedTags);
            setMemos(loadedMemos);
          }}
          onClose={() => setShowExportPanel(false)}
        />
      )}

      <BackupReminder onOpenExport={() => setShowExportPanel(true)} />
    </main>
  );
}
