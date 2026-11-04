import { beforeAll, describe, it, expect } from "vitest";
import { prisma as p } from "../src/lib/db/prisma";
import {
  loadPublicGroups,
  loadPublicWorkspace,
} from "../src/server/queries/public-workspace";
import {
  loadPublicRuzSchedule,
  loadRuzSchedule,
} from "../src/server/schedule/ruz";
import {
  seedPublicPreview,
  previewFixture as f,
} from "./fixtures/public-preview";
beforeAll(() => seedPublicPreview(p));
async function counts() {
  return Promise.all([
    p.user.count(),
    p.session.count(),
    p.enrollment.count(),
    p.groupMember.count(),
    p.studentTaskProgress.count(),
    p.xpEvent.count(),
    p.userAchievement.count(),
  ]);
}
describe("anonymous read-only group projection", () => {
  it("opens only the eight authorized codes, without enrollment, and rejects arbitrary group paths", async () => {
    expect((await loadPublicGroups()).map((g) => g.code)).toHaveLength(8);
    expect(await loadPublicWorkspace("test-group")).toBeNull();
    expect(await loadPublicWorkspace("5130901-40103")).toBeNull();
    const emptyGroup = await p.studyGroup.findUniqueOrThrow({
      where: { code: "5130902/40204" },
    });
    expect(
      await p.enrollment.count({ where: { groupId: emptyGroup.id } }),
    ).toBe(0);
    expect(await loadPublicWorkspace("5130902-40204")).not.toBeNull();
    expect(
      (await loadPublicWorkspace(f.slug))?.courses
        .find((c) => c.id === f.courseId)
        ?.tasks.map((t) => t.id),
    ).toEqual([f.taskId]);
  });
  it("withholds mixed/individual/subgroup/draft/missing-audience tasks and personal/file/source fields even in serialized output", async () => {
    const workspace = await loadPublicWorkspace(f.slug),
      json = JSON.stringify(workspace);
    expect(
      workspace?.courses.find((c) => c.id === f.courseId)?.tasks,
    ).toHaveLength(1);
    expect(
      workspace?.courses.find((c) => c.id === f.courseId)?.tasks[0].deadlines,
    ).toHaveLength(1);
    expect(
      workspace?.courses.find((c) => c.id === f.courseId)?.tasks[0].materials,
    ).toEqual([{ title: "[TEST] Методичка" }]);
    for (const forbidden of [
      "PRIVATE",
      "studentNotes",
      "userId",
      "enrollmentId",
      "progress",
      "variants",
      "sourceReference",
      "content",
      "/materials/",
      "test-preview-material",
      "test-preview-mixed",
      "test-preview-foreign",
      "test-preview-subgroup",
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });
  it("keeps groups separate, never creates accounts/progress/XP and never lends guest access to the private membership guard", async () => {
    const before = await counts();
    const empty = await loadPublicWorkspace("5130902-40204");
    expect(empty?.courses).toEqual([]);
    await Promise.all(
      Array.from({ length: 10 }, () => loadPublicWorkspace(f.slug)),
    );
    expect(await counts()).toEqual(before);
    await expect(
      loadRuzSchedule({
        id: "user-dev-student",
        nickname: "test",
        avatarUrl: null,
        bio: null,
        isOwner: false,
        isSystemAdmin: false,
        groupId: f.groupId,
        permissions: [],
      }),
    ).rejects.toThrow();
  });
  it("reuses bounded validated public RUZ transport without a user identity and refuses arbitrary or mismatched mappings", async () => {
    const now = new Date("2026-11-09T08:00:00Z");
    let calls = 0;
    await p.ruzScheduleCache.updateMany({
      where: { groupId: f.groupId, weekStart: "2026-11-09" },
      data: {
        fetchedAt: new Date("2026-11-08T08:00:00Z"),
        retryAfter: null,
        leaseUntil: null,
      },
    });
    const result = await loadPublicRuzSchedule(f.slug, "2026-11-09", {
      now,
      fetcher: async () => {
        calls++;
        return {
          week: { date_start: "2026.11.09", date_end: "2026.11.15" },
          group: { id: 45591, name: "5130901/40102", faculty: { id: 125 } },
          days: [],
        };
      },
    });
    expect(result.state).toBe("FRESH");
    expect(result.subgroup).toBeNull();
    expect(calls).toBe(1);
    await loadPublicRuzSchedule(f.slug, "2026-11-09", {
      now,
      fetcher: async () => {
        throw Error("Must use cache");
      },
    });
    await expect(loadPublicRuzSchedule("test-group")).rejects.toThrow();
    await p.studyGroup.update({
      where: { id: f.groupId },
      data: { ruzGroupId: null },
    });
    try {
      const missing = await loadPublicRuzSchedule(f.slug, undefined, {
        fetcher: async () => {
          throw Error("Must not fetch wrong mapping");
        },
      });
      expect(missing.state).toBe("UNCONFIGURED");
    } finally {
      await p.studyGroup.update({
        where: { id: f.groupId },
        data: { ruzGroupId: 45591 },
      });
    }
  });
});
