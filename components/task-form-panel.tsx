"use client";

import { useMemo, useRef, useState } from "react";
import { Priority, TodoItem, TodoStatus, TodoStep } from "@/types";
import { BASE_TAGS } from "@/lib/constants";
import { genId } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/use-focus-trap";

type TaskFormPanelProps = {
  editTodo?: TodoItem;
  customTags?: string[];
  onTagCreated?: (tag: string) => void;
  onTagDeleted?: (tag: string) => void;
  onSave: (todo: TodoItem) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
};

export function TaskFormPanel({ editTodo, customTags = [], onTagCreated, onTagDeleted, onSave, onDelete, onClose }: TaskFormPanelProps) {
  const isEdit = !!editTodo;
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);
  const allTags = useMemo(
    () => Array.from(new Set([...BASE_TAGS, ...customTags])),
    [customTags],
  );

  const [title, setTitle] = useState(editTodo?.title ?? "");
  const [dueDate, setDueDate] = useState(editTodo?.dueDate?.slice(0, 16) ?? "");
  const [priority, setPriority] = useState<Priority>(editTodo?.priority ?? "medium");
  const [status, setStatus] = useState<TodoStatus>(editTodo?.status ?? "pending");
  const [department, setDepartment] = useState(editTodo?.department ?? "");
  const [contactPerson, setContactPerson] = useState(editTodo?.contactPerson ?? "");
  const [remarks, setRemarks] = useState(editTodo?.remarks ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(editTodo?.tags ?? []);
  const [customTagInput, setCustomTagInput] = useState("");
  const [steps, setSteps] = useState<TodoStep[]>(editTodo?.steps ?? []);
  const [newStepText, setNewStepText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const addStep = () => {
    const text = newStepText.trim();
    if (!text) return;
    setSteps((prev) => [...prev, { id: genId("step"), content: text, completed: false }]);
    setNewStepText("");
  };

  const toggleStep = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)),
    );
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const updateStepScheduledTime = (id: string, value: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, scheduledTime: value || undefined } : s)),
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
    }
    onTagCreated?.(trimmed);
    setCustomTagInput("");
  };

  const handleSave = () => {
    setValidationError(null);

    if (!title.trim()) {
      setValidationError("请输入任务标题");
      return;
    }

    const allTags = [...selectedTags];
    if (customTagInput.trim()) {
      allTags.push(customTagInput.trim());
    }

    const todo: TodoItem = {
      id: editTodo?.id ?? genId("todo"),
      title: title.trim(),
      dueDate: dueDate || undefined,
      priority,
      status,
      tags: allTags.length > 0 ? allTags : ["其他"],
      department: department.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      remarks: remarks.trim() || undefined,
      parentId: editTodo?.parentId ?? null,
      // 编辑时保留用户原置顶选择；新建任务默认按状态决定
      pinnedToToday:
        editTodo?.pinnedToToday ?? (status !== "completed" && status !== "cancelled"),
      linkedEventIds: editTodo?.linkedEventIds,
      steps: steps.length > 0 ? steps : undefined,
      updatedAt: new Date().toISOString(),
    };

    onSave(todo);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "编辑任务" : "新建任务"}
    >
      <div className="modal-panel task-form-panel" ref={panelRef}>
        <div className="modal-header">
          <h2>{isEdit ? "✏️ 编辑任务" : "➕ 新建任务"}</h2>
          <button className="modal-close-button" type="button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* 任务标题 */}
        <div className="record-section">
          <label className="record-label" htmlFor="task-title">
            任务标题 <span className="required">*</span>
          </label>
          <input
            id="task-title"
            className="record-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="任务名称（例如：准备职级晋升报审材料）"
            autoFocus
          />
        </div>

        {/* 优先级 & 状态 */}
        <div className="record-section">
          <div className="task-form-grid">
            <div>
              <label className="record-label" htmlFor="task-priority">优先级</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="high">🔴 高优先级</option>
                <option value="medium">🟡 中优先级</option>
                <option value="low">🟢 低优先级</option>
              </select>
            </div>
            <div>
              <label className="record-label" htmlFor="task-status">状态</label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TodoStatus)}
              >
                <option value="pending">未开始</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>
          </div>
        </div>

        {/* 截止时间 & 部门 */}
        <div className="record-section">
          <div className="task-form-grid">
            <div>
              <label className="record-label" htmlFor="task-duedate">截止时间</label>
              <input
                id="task-duedate"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="record-label" htmlFor="task-dept">部门</label>
              <input
                id="task-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="例如：组织部"
              />
            </div>
          </div>
        </div>

        {/* 联系人 */}
        <div className="record-section">
          <label className="record-label" htmlFor="task-contact">联系人</label>
          <input
            id="task-contact"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="例如：张主任 / 138****1024"
          />
        </div>

        {/* 标签 */}
        <div className="record-section">
          <label className="record-label">标签</label>
          <div className="record-tags-row">
            {allTags.map((tag) => (
              <span key={tag}>
              <button
                key={tag}
                type="button"
                className={`chip-button chip-tag ${selectedTags.includes(tag) ? "chip-tag-active" : ""}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
              {!BASE_TAGS.includes(tag) && onTagDeleted && <button type="button" className="chip-remove" title={`删除标签"${tag}"`}
                onClick={() => { onTagDeleted(tag); setSelectedTags(prev => prev.filter(t => t !== tag)); }}>×</button>}
              </span>
            ))}
          </div>
          <div className="record-custom-tag">
            <input
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="自定义标签（回车添加）"
            />
            {customTagInput.trim() && (
              <button type="button" className="ghost-button" onClick={addCustomTag}>
                添加
              </button>
            )}
          </div>
        </div>

        {/* 子任务步骤 */}
        <div className="record-section">
          <label className="record-label">任务步骤（可选）</label>
          <div className="todo-steps-editor">
            {steps.length > 0 && (
              <div className="todo-steps-list">
                {steps.map((step) => (
                  <div key={step.id} className="todo-step-row">
                    <button
                      type="button"
                      className={`chip-button chip-time ${step.completed ? "todo-step-done" : ""}`}
                      onClick={() => toggleStep(step.id)}
                      title={step.completed ? "标记为未完成" : "标记为完成"}
                    >
                      {step.completed ? "✓" : "○"}
                    </button>
                    <span
                      className={`todo-step-content ${step.completed ? "todo-step-done-text" : ""}`}
                    >
                      {step.content}
                    </span>
                    <input
                      type="datetime-local"
                      className="todo-step-time"
                      value={step.scheduledTime?.slice(0, 16) ?? ""}
                      onChange={(e) => updateStepScheduledTime(step.id, e.target.value)}
                      aria-label={`${step.content} 的提醒时间`}
                    />
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => removeStep(step.id)}
                      title="删除该步骤"
                      aria-label={`删除步骤 ${step.content}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="record-custom-tag" style={{ marginBottom: 0 }}>
              <input
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addStep();
                  }
                }}
                placeholder="输入步骤内容，回车添加"
              />
              {newStepText.trim() && (
                <button type="button" className="ghost-button" onClick={addStep}>
                  添加
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 备注 */}
        <div className="record-section">
          <label className="record-label" htmlFor="task-remarks">备注</label>
          <textarea
            id="task-remarks"
            className="record-detail-input"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="补充说明、具体步骤、注意事项..."
            rows={4}
          />
        </div>

        {/* 错误提示 */}
        {validationError && (
          <div className="record-error">{validationError}</div>
        )}

        {/* 操作栏 */}
        <div className="record-actions">
          {isEdit && onDelete && (
            <button
              type="button"
              className="ghost-button"
              style={{ color: "#dc2626", marginRight: "auto" }}
              onClick={() => {
                if (confirm("确定要删除这个任务吗？此操作不可恢复。")) {
                  onDelete(editTodo!.id);
                  onClose();
                }
              }}
            >
              🗑️ 删除任务
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            {isEdit ? "保存修改" : "保存任务"}
          </button>
        </div>
      </div>
    </div>
  );
}
