import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGACY_STORAGE_KEYS } from "@/lib/storage-legacy";
import { loadEventsFromStorage, loadTodosFromStorage } from "@/lib/storage-local";
import { loadSettings } from "@/lib/storage-gist";

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
  it("moves legacy event/todo keys into the new namespace on first read", () => {
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
});

