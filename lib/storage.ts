/**
 * 存储层统一出口。
 *
 * 按职责拆分为三个模块：
 *  - lib/storage-migrate.ts  数据版本迁移系统
 *  - lib/storage-local.ts     LocalStorage 读写、自定义标签、JSON 导入导出
 *  - lib/storage-gist.ts      GitHub Gist 云同步（设置、同步状态、合并）
 *
 * 既有调用方（@/lib/storage）无需改动，所有 API 在此 re-export。
 */

// 迁移系统
export {
  CURRENT_DATA_VERSION,
  migrateData,
  parseVersion,
} from "@/lib/storage-migrate";
export type { DataBundle } from "@/lib/storage-migrate";

// LocalStorage 本地持久化
export {
  loadEventsFromStorage,
  loadTodosFromStorage,
  loadMemosFromStorage,
  loadAndMigrateFromStorage,
  saveEventsToStorage,
  saveTodosToStorage,
  saveMemosToStorage,
  loadCustomTags,
  saveCustomTags,
  addCustomTag,
  removeCustomTag,
  filterDeletedTags,
  setCustomTags,
  loadTimelineMode,
  saveTimelineMode,
  clearAllStorage,
  exportDataAsFile,
  importDataFromFile,
} from "@/lib/storage-local";
export type { TimelineMode } from "@/lib/storage-local";

// Gist 云同步
export {
  loadSettings,
  saveSettings,
  clearSettings,
  getSyncStatus,
  getSyncError,
  getLastSyncAt,
  onSyncChange,
  initCloudSync,
  pushToCloud,
  pullAndMerge,
  pullFromCloud,
  mergeItems,
} from "@/lib/storage-gist";
export type { GistSettings, SyncStatus } from "@/lib/storage-gist";
