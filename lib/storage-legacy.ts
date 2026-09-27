/**
 * Temporary compatibility identifiers for data created before the Work Ledger rename.
 * New writes must never use these values. Once all active users have migrated,
 * this file can be removed together with the fallback paths that import it.
 */
export const LEGACY_STORAGE_KEYS = {
  events: "little-job-helper-events",
  todos: "little-job-helper-todos",
  version: "little-job-helper-version",
  customTags: "little-job-helper-custom-tags",
  memos: "little-job-helper-memos",
  settings: "little-job-helper-settings",
} as const;

export const LEGACY_GIST_FILENAME = "little-job-helper-data.json";

