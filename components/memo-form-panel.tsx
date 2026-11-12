"use client";

import { useMemo, useRef, useState } from "react";
import { MemoItem, MemoType, MemoStep } from "@/types";
import { BASE_TAGS } from "@/lib/constants";
import { genId } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { RichTextEditor, sanitizeRichHtml } from "@/components/rich-text-editor";
import { MemoStepsEditor } from "@/components/memo-steps-editor";

type MemoFormPanelProps = {
  type: MemoType;
  editMemo?: MemoItem;
  customTags?: string[];
  onTagCreated?: (tag: string) => void;
  onTagDeleted?: (tag: string) => boolean | void;
  onSave: (memo: MemoItem) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
};

export function MemoFormPanel({
  type,
  editMemo,
  customTags = [],
  onTagCreated,
  onTagDeleted,
  onSave,
  onDelete,
  onClose,
}: MemoFormPanelProps) {
  const isEdit = !!editMemo;
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  const allTags = useMemo(
    () => Array.from(new Set([...BASE_TAGS, ...customTags])),
    [customTags],
  );

  const [title, setTitle] = useState(editMemo?.title ?? "");
  const [date, setDate] = useState(editMemo?.date ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(editMemo?.tags ?? []);
  const [customTagInput, setCustomTagInput] = useState("");
  const [content, setContent] = useState(editMemo?.content ?? "");
  const [steps, setSteps] = useState<MemoStep[]>(editMemo?.steps ?? []);
  const [validationError, setValidationError] = useState<string | null>(null);

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
      setValidationError("请输入标题");
      return;
    }

    const now = new Date().toISOString();
    const memo: MemoItem = {
      id: editMemo?.id ?? genId("memo"),
      type,
      title: title.trim(),
      tags: selectedTags.length > 0 ? selectedTags : ["其他"],
      date: date || undefined,
      ...(type === "note"
        ? { content: sanitizeRichHtml(content) }
        : { steps }),
      createdAt: editMemo?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(memo);
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
      aria-label={isEdit ? "编辑备忘录" : "新建备忘录"}
    >
      <div className="modal-panel memo-form-panel" ref={panelRef}>
        <div className="modal-header">
          <h2>
            {isEdit
              ? `✏️ 编辑${type === "note" ? "心得" : "备忘"}`
              : `＋ 新建${type === "note" ? "心得" : "备忘"}`}
          </h2>
          <button className="modal-close-button" type="button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="record-section">
          <label className="record-label" htmlFor="memo-title">
            标题 <span className="required">*</span>
          </label>
          <input
            id="memo-title"
            className="record-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === "note" ? "例如：2026年XX项目复盘" : "例如：办理员工职务晋升"}
            autoFocus
          />
        </div>

        <div className="record-section memo-form-grid">
          <div>
            <label className="record-label" htmlFor="memo-date">
              关联日期（可选）
            </label>
            <input
              id="memo-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="record-section">
          <label className="record-label">标签</label>
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
        </div>

        <div className="record-section">
          <label className="record-label">
            {type === "note" ? "正文内容" : "标准流程 / 注意事项"}
          </label>
          {type === "note" ? (
            <RichTextEditor
              key={editMemo?.id ?? "new-note"}
              initialHtml={content}
              onChange={setContent}
              placeholder="记录这次的经验、踩过的坑、关键数据..."
            />
          ) : (
            <MemoStepsEditor steps={steps} onChange={setSteps} />
          )}
        </div>

        {validationError && <div className="record-error">{validationError}</div>}

        <div className="record-actions">
          {isEdit && onDelete && (
            <button
              type="button"
              className="ghost-button"
              style={{ color: "#dc2626", marginRight: "auto" }}
              onClick={() => {
                if (confirm("确定要删除这条备忘录吗？此操作不可恢复。")) {
                  onDelete(editMemo!.id);
                  onClose();
                }
              }}
            >
              🗑️ 删除
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            {isEdit ? "保存修改" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
