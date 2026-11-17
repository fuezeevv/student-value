import { describe, it, expect } from "vitest";
import { createScopedStore } from "../packages/mobile-contracts/src/scoped-store";
describe("local account data erasure", () => {
  it("serializes logout after an in-flight secure write and rejects stale queued writes", async () => {
    const values = new Map<string, string>();
    let release!: () => void;
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store = createScopedStore(
      {
        get: async (key) => values.get(key) ?? null,
        set: async (key, value) => {
          started();
          await gate;
          values.set(key, value);
        },
        remove: async (key) => {
          values.delete(key);
        },
      },
      async (scope) => scope,
    );
    let active = true;
    const save = store.save("account-a", "private focus", () => active);
    await began;
    active = false;
    const clear = store.clear("account-a");
    const stale = store.save("account-a", "must not return", () => active);
    release();
    await Promise.all([save, clear, stale]);
    expect(await store.load("account-a")).toBeNull();
  });
  it("does not erase another account or server scope", async () => {
    const values = new Map<string, string>();
    const store = createScopedStore(
      {
        get: async (key) => values.get(key) ?? null,
        set: async (key, value) => {
          values.set(key, value);
        },
        remove: async (key) => {
          values.delete(key);
        },
      },
      async (scope) => scope,
    );
    await store.save("production:a", "A", () => true);
    await store.save("production:b", "B", () => true);
    await store.save("local:a", "local", () => true);
    await store.clear("production:a");
    expect(await store.load("production:b")).toBe("B");
    expect(await store.load("local:a")).toBe("local");
  });
});
