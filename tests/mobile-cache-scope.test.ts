import { describe, expect, it } from "vitest";
import {
  TimetableSqliteRepository,
  type CachedTask,
} from "../packages/mobile-contracts/src";
import { NodeSqliteAdapter } from "../packages/mobile-contracts/src/sqlite/node-adapter";

describe("Task cache audience isolation", () => {
  it("separates guests and two accounts, preserves literal TEST titles, and clears only the logged-out account", async () => {
    const db = NodeSqliteAdapter.openInMemory();
    const repo = new TimetableSqliteRepository(db);
    const task: CachedTask = {
      id: "test-legitimate-id",
      groupCode: "[TEST] Group",
      title: "[TEST] work",
      subject: "[TEST] Subject",
      type: "LABORATORY",
      deadlineId: null,
      deadlineDate: null,
      deadlineMoscowStr: null,
      deadlineStatus: null,
      materialId: null,
      materialTitle: null,
      materialFilename: null,
      materialByteSize: null,
      materialMimeType: null,
      materialSha256: null,
      updatedAt: "2026-11-17T00:00:00Z",
    };
    await repo.saveCachedTasksForGroup(task.groupCode, [task], "user-a");
    expect(await repo.getCachedTasksForGroup(task.groupCode)).toEqual([]);
    expect(await repo.getCachedTasksForGroup(task.groupCode, "user-b")).toEqual(
      [],
    );
    expect(
      (await repo.getCachedTasksForGroup(task.groupCode, "user-a"))[0].title,
    ).toBe(task.title);
    await repo.saveCachedTasksForGroup(
      task.groupCode,
      [{ ...task, title: "B" }],
      "user-b",
    );
    await repo.clearUserData("user-a");
    expect(await repo.getCachedTasksForGroup(task.groupCode, "user-a")).toEqual(
      [],
    );
    expect(
      (await repo.getCachedTasksForGroup(task.groupCode, "user-b"))[0].title,
    ).toBe("B");
    await expect(
      repo.saveCachedTasksForGroup("Other", [task], "user-b"),
    ).rejects.toThrow();
    expect(
      (await repo.getCachedTasksForGroup(task.groupCode, "user-b"))[0].title,
    ).toBe("B");
  });
  it("commits optimistic progress together with its queue entry and rolls back duplicate IDs", async () => {
    const repo = new TimetableSqliteRepository(
      NodeSqliteAdapter.openInMemory(),
    );
    const progress = {
      userId: "a",
      taskId: "t",
      status: "READY" as const,
      isVerified: false,
      studentNotes: "[TEST] note",
      completedAt: "2026-11-17T00:00:00Z",
      updatedAt: "2026-11-17T00:00:00Z",
      syncState: "PENDING_SYNC" as const,
    };
    const operation = {
      id: "stable-op-id",
      userId: "a",
      taskId: "t",
      action: "SET_STATUS" as const,
      payload: { status: "READY" as const },
      createdAt: progress.updatedAt,
      status: "PENDING" as const,
    };
    await repo.enqueueProgressOperation(progress, operation);
    await expect(
      repo.enqueueProgressOperation(
        { ...progress, status: "IN_PROGRESS" },
        operation,
      ),
    ).rejects.toThrow();
    expect((await repo.getUserProgress("a", "t"))?.status).toBe("READY");
    expect(await repo.getPendingOperations("a")).toHaveLength(1);
    await expect(
      repo.enqueueProgressOperation({ ...progress, userId: "b" }, operation),
    ).rejects.toThrow();
    expect(await repo.getUserProgress("b", "t")).toBeNull();
  });
});
