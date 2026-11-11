import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGACY_STORAGE_KEYS } from "@/lib/storage-legacy";
import { loadSettings } from "@/lib/storage-gist";
import { addCustomTag, removeCustomTag, filterDeletedTags, loadCustomTags, loadTimelineMode, saveTimelineMode } from "@/lib/storage-local";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  get length() { return this.data.size; }
}

function installStorage() {
  const storage = new MemoryStorage();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", storage);
  return storage;
}

afterEach(() => vi.unstubAllGlobals());

describe("Work Ledger storage rename", () => {
  it("defaults to adaptive while retaining an explicit classic preference", () => {
    installStorage();
    expect(loadTimelineMode()).toBe("adaptive");
    saveTimelineMode("classic");
    expect(loadTimelineMode()).toBe("classic");
  });
  it("removes numeric tags and filters remote resurrection, with explicit re-add supported", () => {
    installStorage();
    addCustomTag("1");
    expect(removeCustomTag("1")).toEqual([]);
    expect(loadCustomTags()).toEqual([]);
    expect(filterDeletedTags(["1", "工作"])).toEqual(["工作"]);
    expect(addCustomTag("1")).toEqual(["1"]);
  });
  it("moves legacy event/todo keys into the new namespace on first read", async () => {
    vi.resetModules();
    const { loadEventsFromStorage, loadTodosFromStorage } = await import("@/lib/storage-local");
    const storage = installStorage();
    storage.setItem(LEGACY_STORAGE_KEYS.events, JSON.stringify([{ id: "e1" }]));
    storage.setItem(LEGACY_STORAGE_KEYS.todos, JSON.stringify([{ id: "t1" }]));

    expect(loadEventsFromStorage()).toEqual([{ id: "e1" }]);
    expect(loadTodosFromStorage()).toEqual([{ id: "t1" }]);
    expect(storage.getItem("work-ledger-events")).not.toBeNull();
    expect(storage.getItem("work-ledger-todos")).not.toBeNull();
    expect(storage.getItem(LEGACY_STORAGE_KEYS.events)).toBeNull();
    expect(storage.getItem(LEGACY_STORAGE_KEYS.todos)).toBeNull();
  });

  it("moves legacy Gist settings into the new namespace", () => {
    const storage = installStorage();
    const settings = { token: "token", gistId: "gist" };
    storage.setItem(LEGACY_STORAGE_KEYS.settings, JSON.stringify(settings));

    expect(loadSettings()).toEqual(settings);
    expect(storage.getItem("work-ledger-settings")).toBe(JSON.stringify(settings));
    expect(storage.getItem(LEGACY_STORAGE_KEYS.settings)).toBeNull();
  });

  it("preserves existing new-site credentials when legacy settings also exist", () => {
    const storage = installStorage();
    const current = { token: "current-test-token", gistId: "current-gist" };
    storage.setItem("work-ledger-settings", JSON.stringify(current));
    storage.setItem(LEGACY_STORAGE_KEYS.settings, JSON.stringify({ token: "old-test-token", gistId: "old-gist" }));
    expect(loadSettings()).toEqual(current);
    expect(storage.getItem("work-ledger-settings")).toBe(JSON.stringify(current));
  });
});
