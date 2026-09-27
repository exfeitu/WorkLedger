import { EventItem, MemoItem, TodoItem } from "@/types";
import { CURRENT_DATA_VERSION, DataBundle, migrateData, parseVersion } from "@/lib/storage-migrate";
import { LEGACY_STORAGE_KEYS } from "@/lib/storage-legacy";

const STORAGE_KEY_EVENTS = "work-ledger-events";
const STORAGE_KEY_TODOS = "work-ledger-todos";
const STORAGE_KEY_VERSION = "work-ledger-version";
const STORAGE_KEY_CUSTOM_TAGS = "work-ledger-custom-tags";
const STORAGE_KEY_MEMOS = "work-ledger-memos";

let legacyStorageChecked = false;

function ensureStorageNamespace(): void {
  if (typeof window === "undefined" || legacyStorageChecked) return;

  const pairs = [
    [STORAGE_KEY_EVENTS, LEGACY_STORAGE_KEYS.events],
    [STORAGE_KEY_TODOS, LEGACY_STORAGE_KEYS.todos],
    [STORAGE_KEY_VERSION, LEGACY_STORAGE_KEYS.version],
    [STORAGE_KEY_CUSTOM_TAGS, LEGACY_STORAGE_KEYS.customTags],
    [STORAGE_KEY_MEMOS, LEGACY_STORAGE_KEYS.memos],
  ] as const;

  try {
    for (const [currentKey, legacyKey] of pairs) {
      const currentValue = localStorage.getItem(currentKey);
      const legacyValue = localStorage.getItem(legacyKey);
      if (currentValue === null && legacyValue !== null) {
        localStorage.setItem(currentKey, legacyValue);
      }
      if (localStorage.getItem(currentKey) !== null) {
        localStorage.removeItem(legacyKey);
      }
    }
  } finally {
    legacyStorageChecked = true;
  }
}

// ============================================================
// LocalStorage 读写（含版本号管理）
// ============================================================

/**
 * 读取 LocalStorage 中的数据版本号，无记录时返回 0（legacy）。
 */
function getStoredVersion(): number {
  if (typeof window === "undefined") return CURRENT_DATA_VERSION;
  ensureStorageNamespace();

  try {
    const raw = localStorage.getItem(STORAGE_KEY_VERSION);
    if (raw === null) {
      // 有数据但无版本号 → legacy 数据
      const hasData =
        localStorage.getItem(STORAGE_KEY_EVENTS) !== null ||
        localStorage.getItem(STORAGE_KEY_TODOS) !== null;
      return hasData ? 0 : CURRENT_DATA_VERSION;
    }
    return parseInt(raw, 10) || 0;
  } catch {
    return 0;
  }
}

function setStoredVersion(version: number): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_VERSION, String(version));
  } catch (error) {
    console.error("Failed to save version:", error);
  }
}

export function loadEventsFromStorage(): EventItem[] | null {
  if (typeof window === "undefined") return null;
  ensureStorageNamespace();

  try {
    const data = localStorage.getItem(STORAGE_KEY_EVENTS);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to load events from storage:", error);
    return null;
  }
}

export function loadTodosFromStorage(): TodoItem[] | null {
  if (typeof window === "undefined") return null;
  ensureStorageNamespace();

  try {
    const data = localStorage.getItem(STORAGE_KEY_TODOS);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to load todos from storage:", error);
    return null;
  }
}

export function loadMemosFromStorage(): MemoItem[] | null {
  if (typeof window === "undefined") return null;
  ensureStorageNamespace();

  try {
    const data = localStorage.getItem(STORAGE_KEY_MEMOS);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to load memos from storage:", error);
    return null;
  }
}

/**
 * 从 LocalStorage 加载数据，如果数据版本过旧则自动迁移。
 * 迁移后的数据会立即写回 LocalStorage。
 */
export function loadAndMigrateFromStorage(): {
  events: EventItem[];
  todos: TodoItem[];
  memos: MemoItem[];
  migrated: boolean;
} {
  const events = loadEventsFromStorage();
  const todos = loadTodosFromStorage();
  // memos 独立读取，与 events/todos 的键分离
  const memos = loadMemosFromStorage() ?? [];
  const storedVersion = getStoredVersion();

  if (!events || !todos) {
    return { events: events ?? [], todos: todos ?? [], memos, migrated: false };
  }

  if (storedVersion < CURRENT_DATA_VERSION) {
    const migrated = migrateData({ events, todos, memos }, storedVersion);
    // 写回迁移后的数据
    saveEventsToStorage(migrated.events);
    saveTodosToStorage(migrated.todos);
    saveMemosToStorage(migrated.memos ?? memos);
    setStoredVersion(CURRENT_DATA_VERSION);
    return { ...migrated, memos: migrated.memos ?? memos, migrated: true };
  }

  return { events, todos, memos, migrated: false };
}

export function saveEventsToStorage(events: EventItem[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    setStoredVersion(CURRENT_DATA_VERSION);
  } catch (error) {
    console.error("Failed to save events to storage:", error);
  }
}

export function saveTodosToStorage(todos: TodoItem[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(todos));
    setStoredVersion(CURRENT_DATA_VERSION);
  } catch (error) {
    console.error("Failed to save todos to storage:", error);
  }
}

export function saveMemosToStorage(memos: MemoItem[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_MEMOS, JSON.stringify(memos));
    setStoredVersion(CURRENT_DATA_VERSION);
  } catch (error) {
    console.error("Failed to save memos to storage:", error);
  }
}

/**
 * 读取用户自定义标签列表
 */
export function loadCustomTags(): string[] {
  if (typeof window === "undefined") return [];
  ensureStorageNamespace();

  try {
    const data = localStorage.getItem(STORAGE_KEY_CUSTOM_TAGS);
    return data ? (JSON.parse(data) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * 保存用户自定义标签列表（去重）
 */
export function saveCustomTags(tags: string[]): void {
  if (typeof window === "undefined") return;

  try {
    const unique = Array.from(new Set(tags.filter(Boolean)));
    localStorage.setItem(STORAGE_KEY_CUSTOM_TAGS, JSON.stringify(unique));
  } catch (error) {
    console.error("Failed to save custom tags:", error);
  }
}

/**
 * 追加一个新的自定义标签
 */
export function addCustomTag(tag: string): string[] {
  const current = loadCustomTags();
  if (!tag.trim() || current.includes(tag.trim())) return current;
  const next = [...current, tag.trim()];
  saveCustomTags(next);
  return next;
}

/**
 * 删除一个自定义标签
 */
export function removeCustomTag(tag: string): string[] {
  const current = loadCustomTags();
  const next = current.filter((t) => t !== tag);
  saveCustomTags(next);
  return next;
}

/**
 * 批量设置自定义标签（替换全部）
 */
export function setCustomTags(tags: string[]): string[] {
  const unique = Array.from(new Set(tags.filter(Boolean)));
  saveCustomTags(unique);
  return unique;
}

export function clearAllStorage(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY_EVENTS);
  localStorage.removeItem(STORAGE_KEY_TODOS);
  localStorage.removeItem(STORAGE_KEY_VERSION);
  localStorage.removeItem(STORAGE_KEY_CUSTOM_TAGS);
  localStorage.removeItem(STORAGE_KEY_MEMOS);
  [
    LEGACY_STORAGE_KEYS.events,
    LEGACY_STORAGE_KEYS.todos,
    LEGACY_STORAGE_KEYS.version,
    LEGACY_STORAGE_KEYS.customTags,
    LEGACY_STORAGE_KEYS.memos,
  ].forEach((key) => localStorage.removeItem(key));
}

// ============================================================
// JSON 文件导入/导出（含版本号 + 迁移 + 结构校验）
// ============================================================

/**
 * 导出数据为 JSON 文件（触发浏览器下载），包含自定义标签与备忘录，与云端同步格式保持一致。
 */
export function exportDataAsFile(
  events: EventItem[],
  todos: TodoItem[],
  customTags: string[] = [],
  memos: MemoItem[] = [],
): void {
  const data = {
    version: CURRENT_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    events,
    todos,
    customTags,
    memos,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `work-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 校验单条事件的基本结构。返回错误信息，合法返回 null。
 */
function validateEvent(event: unknown): string | null {
  if (!event || typeof event !== "object") return "事件必须是对象";
  const e = event as Record<string, unknown>;
  if (typeof e.id !== "string" || !e.id) return "事件缺少 id";
  if (typeof e.startTime !== "string" || !e.startTime) return "事件缺少 startTime";
  if (typeof e.title !== "string" || !e.title) return "事件缺少 title";
  return null;
}

/**
 * 校验单条待办的基本结构。返回错误信息，合法返回 null。
 */
function validateTodo(todo: unknown): string | null {
  if (!todo || typeof todo !== "object") return "待办必须是对象";
  const t = todo as Record<string, unknown>;
  if (typeof t.id !== "string" || !t.id) return "待办缺少 id";
  if (typeof t.title !== "string" || !t.title) return "待办缺少 title";
  return null;
}

/**
 * 校验单条备忘录的基本结构。返回错误信息，合法返回 null。
 */
function validateMemo(memo: unknown): string | null {
  if (!memo || typeof memo !== "object") return "备忘录必须是对象";
  const m = memo as Record<string, unknown>;
  if (typeof m.id !== "string" || !m.id) return "备忘录缺少 id";
  if (typeof m.title !== "string" || !m.title) return "备忘录缺少 title";
  if (m.type !== "note" && m.type !== "checklist") return "备忘录类型无效";
  return null;
}

/**
 * 从 JSON 文件导入数据（自动迁移旧版本 + 基础结构校验）
 */
export function importDataFromFile(file: File): Promise<{
  events: EventItem[];
  todos: TodoItem[];
  customTags: string[];
  memos: MemoItem[];
  migrated: boolean;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        if (!data.events || !data.todos) {
          throw new Error("数据格式无效：缺少 events 或 todos 字段");
        }

        // 基础结构校验
        for (const evt of data.events as unknown[]) {
          const err = validateEvent(evt);
          if (err) throw new Error(`数据格式无效：${err}`);
        }
        for (const todo of data.todos as unknown[]) {
          const err = validateTodo(todo);
          if (err) throw new Error(`数据格式无效：${err}`);
        }

        const fileVersion = parseVersion(data.version);
        // 旧版备份没有 customTags 字段：保留当前本地标签，避免导入旧备份时误删用户数据。
        // 新版备份即使为空数组也如实覆盖，遵循"导入会覆盖当前数据"的约定。
        const hasCustomTags = Array.isArray(data.customTags);
        const customTags: string[] = hasCustomTags
          ? Array.from(new Set((data.customTags as string[]).filter((t) => typeof t === "string")))
          : loadCustomTags();

        // 备忘录与 customTags 同一策略：旧备份无该字段时保留本地备忘，避免导入旧备份清空备忘。
        const hasMemos = Array.isArray(data.memos);
        let memos: MemoItem[] = hasMemos
          ? data.memos as MemoItem[]
          : (loadMemosFromStorage() ?? []);

        if (hasMemos) {
          for (const memo of data.memos as unknown[]) {
            const err = validateMemo(memo);
            if (err) throw new Error(`数据格式无效：${err}`);
          }
        }

        if (fileVersion < CURRENT_DATA_VERSION) {
          const migrated = migrateData(
            { events: data.events as EventItem[], todos: data.todos as TodoItem[], memos },
            fileVersion,
          );
          memos = migrated.memos ?? memos;
          resolve({ ...migrated, customTags, memos, migrated: true });
        } else {
          resolve({
            events: data.events as EventItem[],
            todos: data.todos as TodoItem[],
            customTags,
            memos,
            migrated: false,
          });
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsText(file);
  });
}
