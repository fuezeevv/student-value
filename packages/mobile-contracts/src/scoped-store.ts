/** Serialize per-scope writes and logout erasure, including asynchronous secure
 * key derivation. A queued stale-session write cannot repopulate erased data. */
export function createScopedStore(
  adapter: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
  },
  keyFor: (scope: string) => Promise<string>,
) {
  const queues = new Map<string, Promise<unknown>>();
  function enqueue<T>(scope: string, work: () => Promise<T>): Promise<T> {
    const task = (queues.get(scope) ?? Promise.resolve())
      .catch(() => {})
      .then(work);
    queues.set(scope, task);
    void task
      .finally(() => {
        if (queues.get(scope) === task) queues.delete(scope);
      })
      .catch(() => {});
    return task;
  }
  return {
    load: (scope: string) =>
      enqueue(scope, async () => adapter.get(await keyFor(scope))),
    save: (scope: string, value: string, isCurrent: () => boolean) =>
      enqueue(scope, async () => {
        if (!isCurrent()) return;
        const key = await keyFor(scope);
        if (isCurrent()) await adapter.set(key, value);
      }),
    clear: (scope: string) =>
      enqueue(scope, async () => adapter.remove(await keyFor(scope))),
  };
}
