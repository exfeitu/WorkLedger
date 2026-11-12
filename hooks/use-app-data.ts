"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadAndMigrateFromStorage,
  saveEventsToStorage,
  saveTodosToStorage,
  saveMemosToStorage,
  loadMemosFromStorage,
  pushToCloud,
  pullAndMerge,
  loadSettings,
  loadCustomTags,
  addCustomTag as addTag,
  removeCustomTag,
  saveCustomTags,
  getSyncStatus,
  getSyncError,
  getLastSyncAt,
  onSyncChange,
} from "@/lib/storage";
import { syncLinkedItems } from "@/lib/utils";
import { removeTagFromLedger } from "@/lib/ledger-operations";
import type { MemoItem } from "@/types";

type SyncedData = ReturnType<typeof syncLinkedItems>;

export type AppData = SyncedData & {
  memos: MemoItem[];
  customTags: string[];
  isInitialized: boolean;
  cloudEnabled: boolean;
  isOnline: boolean;
  syncStatus: "idle" | "syncing" | "success" | "error";
  syncError: string | null;
  lastSyncAt: string | null;
  canUndo: boolean;
  canUndoMemos: boolean;
  addCustomTag: (tag: string) => void;
  deleteCustomTag: (tag: string) => boolean;
  setCustomTags: (tags: string[]) => void;
  setData: (data: SyncedData) => void;
  setMemos: (memos: MemoItem[]) => void;
  undo: () => void;
  undoMemos: () => void;
  refreshCloudStatus: () => void;
};

const MAX_UNDO_STEPS = 20;

/**
 * 封装页面共享的数据加载、持久化、云同步逻辑。
 * page.tsx 和 calendar/page.tsx 共用此 hook，避免重复代码。
 */
export function useAppData(): AppData {
  const [isInitialized, setIsInitialized] = useState(false);
  const [{ events, todos }, setData] = useState(() => {
    const stored = loadAndMigrateFromStorage();
    if (stored.events.length > 0 || stored.todos.length > 0) {
      return syncLinkedItems(stored.events, stored.todos);
    }
    return { events: [], todos: [] };
  });

  const [customTags, setTagsState] = useState<string[]>(() => loadCustomTags());
  const [memos, setMemosState] = useState<MemoItem[]>(() => loadMemosFromStorage() ?? []);
  // 初始值 false 避免 SSR hydration 不一致（localStorage 仅在浏览器可用）
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  // 云同步状态（同步指标、设置面板共享）
  const [syncStatus, setSyncStatus] = useState(getSyncStatus());
  const [syncError, setSyncError] = useState(getSyncError());
  const [lastSyncAt, setLastSyncAt] = useState(getLastSyncAt());

  // 撤销历史栈
  const historyRef = useRef<Array<{ events: typeof events; todos: typeof todos }>>([]);
  const [canUndo, setCanUndo] = useState(false);

  // 备忘录独立撤销栈（与 events/todos 分离，避免改动既有 setData 签名）
  const memosHistoryRef = useRef<Array<MemoItem[]>>([]);
  const [canUndoMemos, setCanUndoMemos] = useState(false);

  // 初始化：标记就绪 + 读取云同步状态 + 自动从云端拉取（合并为单个 effect 减少 commit）
  useEffect(() => {
    setIsInitialized(true);
    const cloudReady = loadSettings() !== null;
    setCloudEnabled(cloudReady);

    if (cloudReady) {
      pullAndMerge(events, todos, customTags, memos).then((result) => {
        if (!result) return;
        if (result.customTags.length > customTags.length) {
          setTagsState(result.customTags);
        }
        if (result.mergedFromRemote) {
          const synced = syncLinkedItems(result.events, result.todos);
          setData(synced);
          saveEventsToStorage(synced.events);
          saveTodosToStorage(synced.todos);
          // 备忘录用普通 setter 落库（不压撤销栈，与 init 合并一致）
          setMemosState(result.memos);
          saveMemosToStorage(result.memos);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听云同步状态变化（由 storage.ts 的 onSyncChange 广播）
  useEffect(() => {
    return onSyncChange(() => {
      setSyncStatus(getSyncStatus());
      setSyncError(getSyncError());
      setLastSyncAt(getLastSyncAt());
    });
  }, []);

  // 在线/离线监听
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // 数据变更 → 自动存 LocalStorage
  useEffect(() => {
    if (isInitialized) {
      saveEventsToStorage(events);
      saveTodosToStorage(todos);
    }
  }, [events, todos, isInitialized]);

  // 标签变更 → 自动存 LocalStorage
  useEffect(() => {
    if (isInitialized) {
      saveCustomTags(customTags);
    }
  }, [customTags, isInitialized]);

  // 备忘录变更 → 自动存 LocalStorage
  useEffect(() => {
    if (isInitialized) {
      saveMemosToStorage(memos);
    }
  }, [memos, isInitialized]);

  // 云同步自动推送（3 秒防抖；离线时跳过）
  useEffect(() => {
    if (!isInitialized || !isOnline) return;

    const settings = loadSettings();
    if (!settings) return;

    const timer = setTimeout(async () => {
      const result = await pushToCloud(events, todos, customTags, memos);
      if (result.customTags.length > customTags.length) {
        setTagsState(result.customTags);
      }
      if (result.mergedFromRemote) {
        // 远端合并出的更新直接回写本地状态，否则云端已最新、界面要刷新才同步。
        // 用无历史 setter：云端合并不是用户操作，不该进 Ctrl+Z 撤销栈。
        setData(syncLinkedItems(result.events, result.todos));
        setMemosState(result.memos);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [events, todos, memos, customTags, isInitialized, isOnline]);

  const addCustomTag = useCallback(
    (tag: string) => setTagsState(addTag(tag)),
    [],
  );

  const deleteCustomTag = useCallback(
    (tag: string) => {
      const references = [
        ...events.filter(item => item.tags.includes(tag)).map(item => `工作记录：${item.title}`),
        ...todos.filter(item => item.tags.includes(tag)).map(item => `待办：${item.title}`),
        ...memos.filter(item => item.tags.includes(tag)).map(item => `备忘录：${item.title}`),
      ];
      if (!window.confirm(`删除标签“${tag}”？\n${references.length ? `以下 ${references.length} 项关联了此标签：\n${references.join("\n")}` : "没有已保存的关联条目。"}\n\n确认后从以上条目中移除该标签，保留条目及其他标签。`)) return false;
      const next = removeTagFromLedger({ events, todos, memos }, tag, new Date().toISOString());
      setData({ events: next.events, todos: next.todos });
      setMemosState(next.memos);
      setTagsState(removeCustomTag(tag));
      return true;
    },
    [events, todos, memos],
  );

  const setCustomTags = useCallback((tags: string[]) => {
    setTagsState(Array.from(new Set(tags.filter(Boolean))));
  }, []);

  const refreshCloudStatus = useCallback(() => {
    setCloudEnabled(loadSettings() !== null);
  }, []);

  // 带撤销历史的 setData：每次修改前快照当前数据入栈
  const setDataWithHistory = useCallback(
    (next: SyncedData) => {
      historyRef.current = [
        ...historyRef.current.slice(-(MAX_UNDO_STEPS - 1)),
        { events, todos },
      ];
      setCanUndo(true);
      setData(next);
    },
    [events, todos],
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setData(prev);
    setCanUndo(historyRef.current.length > 0);
  }, []);

  // 带撤销历史的 setMemos：每次修改前快照当前数据入栈
  const setMemosWithHistory = useCallback(
    (next: MemoItem[]) => {
      memosHistoryRef.current = [
        ...memosHistoryRef.current.slice(-(MAX_UNDO_STEPS - 1)),
        memos,
      ];
      setCanUndoMemos(true);
      setMemosState(next);
    },
    [memos],
  );

  const undoMemos = useCallback(() => {
    const prev = memosHistoryRef.current.pop();
    if (!prev) return;
    setMemosState(prev);
    setCanUndoMemos(memosHistoryRef.current.length > 0);
  }, []);

  return {
    events,
    todos,
    memos,
    customTags,
    isInitialized,
    cloudEnabled,
    isOnline,
    syncStatus,
    syncError,
    lastSyncAt,
    canUndo,
    canUndoMemos,
    addCustomTag,
    deleteCustomTag,
    setCustomTags,
    setData: setDataWithHistory,
    setMemos: setMemosWithHistory,
    undo,
    undoMemos,
    refreshCloudStatus,
  };
}
