"use client";

import { useMemo, useRef, useState } from "react";
import { EventItem, TodoItem } from "@/types";
import { BASE_TAGS } from "@/lib/constants";
import { genId } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/use-focus-trap";

type WorkRecordPanelProps = {
  events: EventItem[];
  todos: TodoItem[];
  linkedTodoTitles: Record<string, string>;
  editEvent?: EventItem;
  customTags?: string[];
  onTagCreated?: (tag: string) => void;
  onTagDeleted?: (tag: string) => boolean | void;
  onSave: (event: EventItem, linkedTodoId: string | null) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
};

function toDatetimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDatetimeLocal(value: string): Date {
  return new Date(value);
}

function calcDuration(start: string, end: string): string {
  const diffMs = fromDatetimeLocal(end).getTime() - fromDatetimeLocal(start).getTime();
  if (diffMs <= 0) return "0 分钟";
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} 分钟`;
  if (minutes === 0) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分钟`;
}

function getDefaultStartTime(): string {
  const d = new Date();
  d.setHours(d.getHours() - 2);
  return toDatetimeLocal(d);
}

function getDefaultEndTime(): string {
  return toDatetimeLocal(new Date());
}

export function WorkRecordPanel({ events, todos, linkedTodoTitles, editEvent, customTags = [], onTagCreated, onTagDeleted, onSave, onDelete, onClose }: WorkRecordPanelProps) {
  const isEdit = !!editEvent;
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);
  const allTags = useMemo(
    () => Array.from(new Set([...BASE_TAGS, ...customTags])),
    [customTags],
  );

  const [startTime, setStartTime] = useState(
    editEvent ? editEvent.startTime.slice(0, 16) : getDefaultStartTime,
  );
  const [endTime, setEndTime] = useState(
    editEvent ? editEvent.endTime.slice(0, 16) : getDefaultEndTime,
  );
  const [title, setTitle] = useState(editEvent?.title ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(editEvent?.tags ?? []);
  const [customTagInput, setCustomTagInput] = useState("");
  const [detail, setDetail] = useState(editEvent?.detail ?? "");
  const [linkedTodoId, setLinkedTodoId] = useState(editEvent?.linkedTodoIds?.[0] ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  const duration = useMemo(() => calcDuration(startTime, endTime), [startTime, endTime]);

  const activeTodos = useMemo(
    () => todos.filter((t) => t.status !== "completed" && t.status !== "cancelled"),
    [todos],
  );

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

  const adjustStartTime = (minutes: number) => {
    const d = fromDatetimeLocal(startTime);
    d.setMinutes(d.getMinutes() + minutes);
    const newStart = toDatetimeLocal(d);

    // 防止开始时间晚于结束时间
    if (fromDatetimeLocal(newStart).getTime() >= fromDatetimeLocal(endTime).getTime()) {
      // 顺延结束时间为开始时间 + 1 分钟
      const adjustedEnd = new Date(fromDatetimeLocal(newStart).getTime() + 60000);
      setEndTime(toDatetimeLocal(adjustedEnd));
    }
    setStartTime(newStart);
  };

  const setEndTimeToNow = () => {
    const now = getDefaultEndTime();
    setEndTime(now);

    // 如果开始时间晚于新的结束时间，自动调整
    if (fromDatetimeLocal(startTime).getTime() >= fromDatetimeLocal(now).getTime()) {
      const adjustedStart = new Date(fromDatetimeLocal(now).getTime() - 2 * 3600000);
      setStartTime(toDatetimeLocal(adjustedStart));
    }
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    // 自动修正结束时间
    if (fromDatetimeLocal(value).getTime() >= fromDatetimeLocal(endTime).getTime()) {
      const adjustedEnd = new Date(fromDatetimeLocal(value).getTime() + 60000);
      setEndTime(toDatetimeLocal(adjustedEnd));
    }
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
  };

  const handleSave = () => {
    setValidationError(null);

    if (!title.trim()) {
      setValidationError("请输入工作标题");
      return;
    }

    const startDate = fromDatetimeLocal(startTime);
    const endDate = fromDatetimeLocal(endTime);

    if (startDate.getTime() >= endDate.getTime()) {
      setValidationError("开始时间必须早于结束时间");
      return;
    }

    // 构建精确到秒的 ISO 时间字符串
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const formatTime = (d: Date) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

    const allTags = [...selectedTags];
    if (customTagInput.trim()) {
      allTags.push(customTagInput.trim());
    }

    const event: EventItem = {
      id: editEvent?.id ?? genId("event"),
      startTime: formatTime(startDate),
      endTime: formatTime(endDate),
      title: title.trim(),
      detail: detail.trim() || undefined,
      tags: allTags.length > 0 ? allTags : ["其他"],
      linkedTodoIds: linkedTodoId ? [linkedTodoId] : undefined,
      updatedAt: new Date().toISOString(),
    };

    onSave(event, linkedTodoId || null);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "编辑工作记录" : "快速记录工作"}
    >
      <div className="modal-panel work-record-panel" ref={panelRef}>
        <div className="modal-header">
          <h2>{isEdit ? "✏️ 编辑工作记录" : "📝 快速记录工作"}</h2>
          <button className="modal-close-button" type="button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* 时间选择区域 */}
        <div className="record-section record-time-section">
          <div className="record-time-row">
            <div className="record-time-field">
              <label className="record-label">开始时间</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
              />
            </div>
            <div className="record-time-field">
              <label className="record-label">结束时间</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
              />
            </div>
          </div>

          <div className="record-time-actions">
            <div className="record-quick-buttons">
              <span className="record-quick-label">快捷调整开始时间：</span>
              <button type="button" className="chip-button chip-time" onClick={() => adjustStartTime(-120)}>
                -2h
              </button>
              <button type="button" className="chip-button chip-time" onClick={() => adjustStartTime(-60)}>
                -1h
              </button>
              <button type="button" className="chip-button chip-time" onClick={() => adjustStartTime(-30)}>
                -30m
              </button>
              <button type="button" className="chip-button chip-time" onClick={() => adjustStartTime(-15)}>
                -15m
              </button>
              <button type="button" className="chip-button chip-time" onClick={() => adjustStartTime(15)}>
                +15m
              </button>
              <button type="button" className="chip-button chip-time" onClick={() => adjustStartTime(30)}>
                +30m
              </button>
            </div>
            <div className="record-end-actions">
              <button type="button" className="ghost-button" onClick={setEndTimeToNow}>
                🔄 结束时间设为现在
              </button>
              <span className="record-duration">
                预计时长：<strong>{duration}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* 核心内容区域 */}
        <div className="record-section">
          <label className="record-label" htmlFor="record-title">
            工作标题 <span className="required">*</span>
          </label>
          <input
            id="record-title"
            className="record-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="做了什么？（例如：参加会议、处理邮件、推进项目任务）"
            autoFocus
          />
        </div>

        {/* 标签选择区域 */}
        <div className="record-section">
          <label className="record-label">工作类型标签</label>
          <div className="record-tags-row">
            {allTags.map((tag) => {
              const isCustom = !BASE_TAGS.includes(tag);
              return (
                <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                  <button
                    type="button"
                    className={`chip-button chip-tag ${selectedTags.includes(tag) ? "chip-tag-active" : ""}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                  {isCustom && onTagDeleted && (
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={(e) => { e.stopPropagation(); if (onTagDeleted(tag) !== false) setSelectedTags(prev => prev.filter(t => t !== tag)); }}
                      title={`删除标签"${tag}"`}
                      style={{ marginLeft: "-4px", padding: "2px 4px", fontSize: "0.65rem", border: "none", background: "none", cursor: "pointer", color: "var(--muted)", opacity: 0.6 }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              );
            })}
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
          {selectedTags.filter((t) => !allTags.includes(t)).length > 0 && (
            <div className="record-custom-tags-list">
              {selectedTags
                .filter((t) => !allTags.includes(t))
                .map((tag) => (
                  <span key={tag} className="chip-button chip-tag chip-tag-active">
                    {tag}
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => toggleTag(tag)}
                      aria-label={`移除标签 ${tag}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* 备注详情 */}
        <div className="record-section">
          <label className="record-label" htmlFor="record-detail">
            备注详情
          </label>
          <textarea
            id="record-detail"
            className="record-detail-input"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="补充细节、对接人、关键数据..."
            rows={4}
          />
        </div>

        {/* 关联待办 */}
        <div className="record-section">
          <label className="record-label" htmlFor="record-linked-todo">
            关联待办（可选）
          </label>
          <select
            id="record-linked-todo"
            value={linkedTodoId}
            onChange={(e) => setLinkedTodoId(e.target.value)}
          >
            <option value="">不关联待办</option>
            {activeTodos.map((todo) => (
              <option key={todo.id} value={todo.id}>
                {todo.title}
                {todo.department ? ` · ${todo.department}` : ""}
                {todo.contactPerson ? ` · ${todo.contactPerson}` : ""}
              </option>
            ))}
          </select>
          {linkedTodoId && linkedTodoTitles[linkedTodoId] && (
            <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--accent)" }}>
              📅 将关联到待办：{linkedTodoTitles[linkedTodoId]}
            </p>
          )}
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
                if (confirm("确定要删除这条工作记录吗？此操作不可恢复。")) {
                  onDelete(editEvent!.id);
                  onClose();
                }
              }}
            >
              🗑️ 删除记录
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            {isEdit ? "保存修改" : "保存记录"}
          </button>
        </div>
      </div>
    </div>
  );
}
