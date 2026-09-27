import { EventItem, MemoItem, TodoItem } from "@/types";
import { CURRENT_DATA_VERSION, migrateData, parseVersion } from "@/lib/storage-migrate";
import {
  loadCustomTags,
  loadEventsFromStorage,
  loadMemosFromStorage,
  loadTodosFromStorage,
} from "@/lib/storage-local";
import { LEGACY_GIST_FILENAME, LEGACY_STORAGE_KEYS } from "@/lib/storage-legacy";

const GIST_FILENAME = "work-ledger-data.json";
const GIST_DESCRIPTION = "工作台账 · 工作数据";
const GIST_API_BASE = "https://api.github.com";

// ============================================================
// 云同步配置类型
// ============================================================

export type GistSettings = {
  token: string;
  gistId: string;
};

export type SyncStatus = "idle" | "syncing" | "success" | "error";

let _syncStatus: SyncStatus = "idle";
let _syncError: string | null = null;
let _lastSyncAt: string | null = null;
let _syncListeners: Array<() => void> = [];

export function getSyncStatus(): SyncStatus {
  return _syncStatus;
}

export function getSyncError(): string | null {
  return _syncError;
}

export function getLastSyncAt(): string | null {
  return _lastSyncAt;
}

export function onSyncChange(listener: () => void): () => void {
  _syncListeners.push(listener);
  return () => {
    _syncListeners = _syncListeners.filter((l) => l !== listener);
  };
}

function notifySyncListeners(): void {
  _syncListeners.forEach((l) => l());
}

function setSyncStatus(status: SyncStatus, error?: string | null): void {
  _syncStatus = status;
  _syncError = error ?? null;
  if (status === "success") {
    _lastSyncAt = new Date().toISOString();
  }
  notifySyncListeners();
}

// ============================================================
// 设置管理（Token + Gist ID 存在 LocalStorage）
// ============================================================

const STORAGE_KEY_SETTINGS = "work-ledger-settings";

export function loadSettings(): GistSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const current = localStorage.getItem(STORAGE_KEY_SETTINGS);
    const legacy = current ? null : localStorage.getItem(LEGACY_STORAGE_KEYS.settings);
    const data = current ?? legacy;
    if (!data) return null;

    const parsed = JSON.parse(data);
    if (parsed.token && parsed.gistId) {
      if (!current) {
        localStorage.setItem(STORAGE_KEY_SETTINGS, data);
        localStorage.removeItem(LEGACY_STORAGE_KEYS.settings);
      }
      return parsed as GistSettings;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSettings(settings: GistSettings): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    localStorage.removeItem(LEGACY_STORAGE_KEYS.settings);
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

export function clearSettings(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY_SETTINGS);
  localStorage.removeItem(LEGACY_STORAGE_KEYS.settings);
  _lastSyncAt = null;
  setSyncStatus("idle");
}

// ============================================================
// GitHub Gist API
// ============================================================

function gistHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * 查找当前用户下已有的工作台账 Gist
 */
async function findExistingGist(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${GIST_API_BASE}/gists?per_page=100`, {
      headers: gistHeaders(token),
    });

    if (!res.ok) return null;

    const gists: Array<{
      id: string;
      files: Record<string, { filename: string }>;
    }> = await res.json();

    const found = gists.find((g) =>
      g.files && (g.files[GIST_FILENAME] || g.files[LEGACY_GIST_FILENAME]),
    );
    return found ? found.id : null;
  } catch {
    return null;
  }
}

/**
 * 创建新的 Gist 并返回 gistId
 */
async function createGist(
  token: string,
  events: EventItem[],
  todos: TodoItem[],
  customTags: string[],
  memos: MemoItem[] = [],
): Promise<string | null> {
  try {
    const content = JSON.stringify(
      {
        version: CURRENT_DATA_VERSION,
        updatedAt: new Date().toISOString(),
        events,
        todos,
        customTags,
        memos,
      },
      null,
      2,
    );

    const res = await fetch(`${GIST_API_BASE}/gists`, {
      method: "POST",
      headers: gistHeaders(token),
      body: JSON.stringify({
        description: GIST_DESCRIPTION,
        public: false,
        files: {
          [GIST_FILENAME]: {
            content,
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { message?: string }).message ?? `创建 Gist 失败 (${res.status})`,
      );
    }

    const data: { id: string } = await res.json();
    return data.id;
  } catch (error) {
    console.error("Failed to create gist:", error);
    throw error;
  }
}

/**
 * 更新已有 Gist 的内容
 */
async function updateGist(
  token: string,
  gistId: string,
  events: EventItem[],
  todos: TodoItem[],
  customTags: string[],
  memos: MemoItem[] = [],
): Promise<void> {
  const content = JSON.stringify(
    {
      version: CURRENT_DATA_VERSION,
      updatedAt: new Date().toISOString(),
      events,
      todos,
      customTags,
      memos,
    },
    null,
    2,
  );

  const res = await fetch(`${GIST_API_BASE}/gists/${gistId}`, {
    method: "PATCH",
    headers: gistHeaders(token),
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: { content },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? `更新 Gist 失败 (${res.status})`,
    );
  }
}

async function migrateLegacyGistFilename(
  token: string,
  gistId: string,
  content: string,
): Promise<void> {
  try {
    const res = await fetch(`${GIST_API_BASE}/gists/${gistId}`, {
      method: "PATCH",
      headers: gistHeaders(token),
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: { content },
          [LEGACY_GIST_FILENAME]: null,
        },
      }),
    });
    if (!res.ok) {
      console.warn("Failed to migrate legacy Gist filename:", res.status);
    }
  } catch (error) {
    console.warn("Failed to migrate legacy Gist filename:", error);
  }
}

/**
 * 从 Gist 拉取原始数据（含版本号，不做迁移）。
 * 兼容旧版云端数据：无 memos 字段时默认空数组，不报错。
 */
async function fetchRawGist(
  token: string,
  gistId: string,
): Promise<{ events: EventItem[]; todos: TodoItem[]; customTags: string[]; memos: MemoItem[]; version: number } | null> {
  try {
    const res = await fetch(`${GIST_API_BASE}/gists/${gistId}`, {
      headers: gistHeaders(token),
    });

    if (!res.ok) return null;

    const data: {
      files: Record<string, { content?: string }>;
    } = await res.json();

    const currentFile = data.files?.[GIST_FILENAME];
    const legacyFile = data.files?.[LEGACY_GIST_FILENAME];
    const file = currentFile ?? legacyFile;
    if (!file?.content) return null;

    if (!currentFile?.content && legacyFile?.content) {
      await migrateLegacyGistFilename(token, gistId, legacyFile.content);
    }

    const parsed = JSON.parse(file.content);
    if (!parsed.events || !parsed.todos) return null;

    return {
      version: parseVersion(parsed.version),
      events: parsed.events as EventItem[],
      todos: parsed.todos as TodoItem[],
      customTags: (parsed.customTags as string[]) ?? [],
      memos: (parsed.memos as MemoItem[]) ?? [],
    };
  } catch {
    return null;
  }
}

// ============================================================
// 多端同步：ID 级别合并（updatedAt 最新的胜出）
// ============================================================

type HasUpdatedAt = { id: string; updatedAt: string };

/**
 * 合并本地和远端数据：ID 相同按 updatedAt 取最新，无冲突时自动合并。
 * 返回合并后的数组和可能的冲突提示。
 */
export function mergeItems<T extends HasUpdatedAt>(
  local: T[],
  remote: T[],
): { merged: T[]; fromRemote: string[] } {
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const merged: T[] = [];
  const fromRemote: string[] = [];

  for (const id of allIds) {
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);

    if (localItem && !remoteItem) {
      merged.push(localItem);
    } else if (!localItem && remoteItem) {
      merged.push(remoteItem);
      fromRemote.push(id);
    } else if (localItem && remoteItem) {
      // 两边都有 — updatedAt 较新的胜出
      if (remoteItem.updatedAt > localItem.updatedAt) {
        merged.push(remoteItem);
        fromRemote.push(id);
      } else {
        merged.push(localItem);
      }
    }
  }

  return { merged, fromRemote };
}

// ============================================================
// 对外云同步接口
// ============================================================

/**
 * 初始化云同步：验证 Token 并找到/创建 Gist
 */
export async function initCloudSync(token: string): Promise<GistSettings> {
  const userRes = await fetch(`${GIST_API_BASE}/user`, {
    headers: gistHeaders(token),
  });

  if (!userRes.ok) {
    if (userRes.status === 401) {
      throw new Error("Token 无效，请检查 GitHub Personal Access Token");
    }
    throw new Error(`GitHub API 连接失败 (${userRes.status})`);
  }

  let gistId = await findExistingGist(token);

  if (!gistId) {
    const storedEvents = loadEventsFromStorage();
    const storedTodos = loadTodosFromStorage();
    gistId = await createGist(
      token,
      storedEvents ?? [],
      storedTodos ?? [],
      loadCustomTags(),
      loadMemosFromStorage() ?? [],
    );
    if (!gistId) {
      throw new Error("创建云端 Gist 失败，请重试");
    }
  }

  const settings: GistSettings = { token, gistId };
  saveSettings(settings);
  setSyncStatus("success");
  return settings;
}

/**
 * 推送数据到云端（先拉取合并，再推送，防止覆盖他人更新）
 */
export async function pushToCloud(
  events: EventItem[],
  todos: TodoItem[],
  customTags?: string[],
  memos?: MemoItem[],
): Promise<{ mergedFromRemote: boolean; customTags: string[] }> {
  const tags = customTags ?? loadCustomTags();
  const localMemos = memos ?? loadMemosFromStorage() ?? [];
  const settings = loadSettings();
  if (!settings) return { mergedFromRemote: false, customTags: tags };

  setSyncStatus("syncing");

  try {
    // 1. 先拉取远端数据
    const remote = await fetchRawGist(settings.token, settings.gistId);

    let finalEvents = events;
    let finalTodos = todos;
    let finalTags = tags;
    let finalMemos = localMemos;
    let mergedFromRemote = false;

    if (remote) {
      // 2. ID 级别合并：updatedAt 最新胜出
      const eventsResult = mergeItems(events, remote.events);
      const todosResult = mergeItems(todos, remote.todos);
      const memosResult = mergeItems(localMemos, remote.memos);
      finalEvents = eventsResult.merged;
      finalTodos = todosResult.merged;
      finalMemos = memosResult.merged;
      // 标签合并：取并集（云端独有的也保留）
      finalTags = Array.from(new Set([...tags, ...(remote.customTags ?? [])]));
      mergedFromRemote =
        eventsResult.fromRemote.length > 0 ||
        todosResult.fromRemote.length > 0 ||
        memosResult.fromRemote.length > 0;
    }

    // 3. 推送合并后的数据
    await updateGist(settings.token, settings.gistId, finalEvents, finalTodos, finalTags, finalMemos);
    setSyncStatus("success");
    return { mergedFromRemote, customTags: finalTags };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "云端同步失败";
    setSyncStatus("error", message);
    console.error("Cloud sync failed:", error);
    return { mergedFromRemote: false, customTags: tags };
  }
}

/**
 * 从云端拉取并与本地数据合并（用于 app 初始化时自动同步）。
 * 合并规则：ID 相同按 updatedAt 最新胜出，本地独有保留，远端独有采纳。
 */
export async function pullAndMerge(
  localEvents: EventItem[],
  localTodos: TodoItem[],
  localTags: string[],
  localMemos?: MemoItem[],
): Promise<{
  events: EventItem[];
  todos: TodoItem[];
  customTags: string[];
  memos: MemoItem[];
  mergedFromRemote: boolean;
} | null> {
  const settings = loadSettings();
  if (!settings) return null;

  setSyncStatus("syncing");

  try {
    const localMemosArr = localMemos ?? loadMemosFromStorage() ?? [];
    const remote = await fetchRawGist(settings.token, settings.gistId);
    if (!remote) {
      setSyncStatus("success");
      return {
        events: localEvents,
        todos: localTodos,
        customTags: localTags,
        memos: localMemosArr,
        mergedFromRemote: false,
      };
    }

    // 迁移远端旧版本数据
    let remoteEvents = remote.events;
    let remoteTodos = remote.todos;
    let remoteTags = remote.customTags ?? [];
    let remoteMemos = remote.memos ?? [];
    if (remote.version < CURRENT_DATA_VERSION) {
      const migrated = migrateData(
        { events: remoteEvents, todos: remoteTodos, memos: remoteMemos },
        remote.version,
      );
      remoteEvents = migrated.events;
      remoteTodos = migrated.todos;
      remoteMemos = migrated.memos ?? remoteMemos;
    }

    const eventsResult = mergeItems(localEvents, remoteEvents);
    const todosResult = mergeItems(localTodos, remoteTodos);
    const memosResult = mergeItems(localMemosArr, remoteMemos);
    const mergedTags = Array.from(new Set([...localTags, ...remoteTags]));

    setSyncStatus("success");
    return {
      events: eventsResult.merged,
      todos: todosResult.merged,
      customTags: mergedTags,
      memos: memosResult.merged,
      mergedFromRemote:
        eventsResult.fromRemote.length > 0 ||
        todosResult.fromRemote.length > 0 ||
        memosResult.fromRemote.length > 0,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "自动同步失败";
    setSyncStatus("error", message);
    console.error("Auto pull-merge failed:", error);
    return null;
  }
}

/**
 * 从云端拉取数据（自动迁移到当前版本）
 */
export async function pullFromCloud(): Promise<{
  events: EventItem[];
  todos: TodoItem[];
  memos: MemoItem[];
} | null> {
  const settings = loadSettings();
  if (!settings) {
    throw new Error("未配置云同步，请先在设置中输入 GitHub Token");
  }

  setSyncStatus("syncing");

  try {
    const raw = await fetchRawGist(settings.token, settings.gistId);
    if (!raw) {
      setSyncStatus("error", "未找到云端数据");
      return null;
    }

    if (raw.version < CURRENT_DATA_VERSION) {
      const migrated = migrateData(
        { events: raw.events, todos: raw.todos, memos: raw.memos ?? [] },
        raw.version,
      );
      setSyncStatus("success");
      return { ...migrated, memos: migrated.memos ?? [] };
    }

    setSyncStatus("success");
    return { events: raw.events, todos: raw.todos, memos: raw.memos ?? [] };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "从云端加载失败";
    setSyncStatus("error", message);
    throw error;
  }
}
