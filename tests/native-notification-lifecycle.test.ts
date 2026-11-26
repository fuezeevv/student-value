import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { deadlineReminderTime } from "../packages/mobile-contracts/src/reminder-time";
import type {
  ScheduledNotificationRecord,
  CachedTask,
} from "../packages/mobile-contracts/src/sqlite/types";

/** Execute the actual mobile module with fake OS/storage bridges. This keeps
 * root CI independent of an Android SDK and never schedules a real alarm. */
function harness() {
  let generation = 0;
  const records = new Map<string, ScheduledNotificationRecord>();
  const nativeIds = new Set<string>();
  let scheduleHook: ((id: string) => Promise<void>) | undefined;
  const notifications = {
    setNotificationHandler: vi.fn(),
    setNotificationChannelAsync: vi.fn(async () => {}),
    AndroidImportance: { HIGH: 4 },
    SchedulableTriggerInputTypes: { DATE: "date" },
    getPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
    requestPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
    cancelScheduledNotificationAsync: vi.fn(async (id: string) => {
      nativeIds.delete(id);
    }),
    scheduleNotificationAsync: vi.fn(
      async (request: { identifier: string }) => {
        nativeIds.add(request.identifier);
        await scheduleHook?.(request.identifier);
        return request.identifier;
      },
    ),
    getAllScheduledNotificationsAsync: vi.fn(async () =>
      [...nativeIds].map((identifier) => ({ identifier })),
    ),
  };
  const repo = {
    saveScheduledNotification: async (record: ScheduledNotificationRecord) => {
      records.set(record.id, record);
    },
    deleteScheduledNotification: async (id: string) => {
      records.delete(id);
    },
    getScheduledNotificationsForTask: async (userId: string, taskId: string) =>
      [...records.values()].filter(
        (record) => record.userId === userId && record.taskId === taskId,
      ),
  };
  const modules: Record<string, unknown> = {
    "expo-notifications": notifications,
    "react-native": { Platform: { OS: "android" } },
    "@studentvalue/mobile-contracts": { deadlineReminderTime },
    "../storage/repository": { getTimetableRepository: () => repo },
    "../auth/session-lifecycle": {
      sessionGeneration: () => generation,
      isCurrentSession: (value: number) => value === generation,
    },
  };
  const code = ts.transpileModule(
    readFileSync(
      new URL("../apps/mobile/src/notifications/scheduler.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", code)((id: string) => {
    if (!(id in modules)) throw Error(`Unexpected native dependency: ${id}`);
    return modules[id];
  }, exports);
  type Params = {
    userId: string;
    taskId: string;
    deadlineId: string;
    taskTitle: string;
    subjectName: string;
    deadlineDateStr: string;
  };
  const api = exports as unknown as {
    scheduleDeadlineReminder: (
      params: Params,
    ) => Promise<ScheduledNotificationRecord | null>;
    cancelDeadlineReminder: (
      userId: string,
      taskId: string,
      deadlineId: string,
    ) => Promise<void>;
    activeReminderFlags: (
      userId: string,
      tasks: CachedTask[],
    ) => Promise<Record<string, boolean>>;
    reconcileTaskReminders: (
      userId: string,
      previous: CachedTask[],
      current: CachedTask[],
      completed: Set<string>,
    ) => Promise<void>;
  };
  return {
    api,
    notifications,
    records,
    nativeIds,
    logout: () => {
      generation++;
    },
    hook: (hook: typeof scheduleHook) => {
      scheduleHook = hook;
    },
  };
}
const params = () => ({
  userId: "[TEST] user",
  taskId: "[TEST] task",
  deadlineId: "[TEST] deadline",
  taskTitle: "[TEST] Work",
  subjectName: "[TEST] Course",
  deadlineDateStr: new Date(Date.now() + 7 * 86400000).toISOString(),
});
const task = (p: ReturnType<typeof params>) =>
  ({
    id: p.taskId,
    deadlineId: p.deadlineId,
    deadlineDate: p.deadlineDateStr,
    subject: p.subjectName,
    title: p.taskTitle,
  }) as CachedTask;
describe("native notification lifecycle with fake OS", () => {
  it("does not leave a late scheduled alarm after logout", async () => {
    const h = harness();
    let release!: () => void;
    let began!: () => void;
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    h.hook(async () => {
      began();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const pending = h.api.scheduleDeadlineReminder(params());
    await started;
    h.logout();
    release();
    expect(await pending).toBeNull();
    expect(h.nativeIds.size).toBe(0);
    expect(h.records.size).toBe(0);
  });
  it("late completion from an old login cannot cancel the new login's reminder", async () => {
    const h = harness();
    let release!: () => void;
    let began!: () => void;
    let calls = 0;
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    h.hook(async () => {
      if (++calls === 1) {
        began();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
    });
    const old = h.api.scheduleDeadlineReminder(params());
    await started;
    h.logout();
    const current = await h.api.scheduleDeadlineReminder(params());
    expect(current).not.toBeNull();
    release();
    expect(await old).toBeNull();
    expect(h.nativeIds.has(current!.id)).toBe(true);
    expect(h.records.has(current!.id)).toBe(true);
  });
  it("cancel invalidates a pending native schedule before it reaches SQLite", async () => {
    const h = harness();
    let release!: () => void;
    let began!: () => void;
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    h.hook(async () => {
      began();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const p = params();
    const pending = h.api.scheduleDeadlineReminder(p);
    await started;
    await h.api.cancelDeadlineReminder(p.userId, p.taskId, p.deadlineId);
    release();
    expect(await pending).toBeNull();
    expect(h.nativeIds.size).toBe(0);
  });
  it("restores the indicator only for the actual OS alarm and follows a changed deadline without another prompt", async () => {
    const h = harness();
    const p = params();
    const first = await h.api.scheduleDeadlineReminder(p);
    expect(
      (await h.api.activeReminderFlags(p.userId, [task(p)]))[p.taskId],
    ).toBe(true);
    const next = {
      ...p,
      deadlineId: "[TEST] moved",
      deadlineDateStr: new Date(Date.now() + 8 * 86400000).toISOString(),
    };
    await h.api.reconcileTaskReminders(
      p.userId,
      [task(p)],
      [task(next)],
      new Set(),
    );
    expect(h.nativeIds.has(first!.id)).toBe(false);
    expect(
      (await h.api.activeReminderFlags(p.userId, [task(next)]))[p.taskId],
    ).toBe(true);
    expect(h.notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    h.nativeIds.clear();
    expect(
      (await h.api.activeReminderFlags(p.userId, [task(next)]))[p.taskId],
    ).toBe(false);
  });
});
