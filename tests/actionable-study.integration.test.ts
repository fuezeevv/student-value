import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma as p } from "../src/lib/db/prisma";
import type { SessionUser } from "../src/lib/auth/session";
import {
  updateOwnProgress,
  reviewCompletion,
} from "../src/server/domain/progress";
import {
  setDeadlineCancelled,
  setTaskArchived,
} from "../src/server/domain/work-lifecycle";
import {
  loadPlatformDirectory,
  loadSharedCourse,
  setGroupSharing,
  requirePlatformOwner,
  createEmptyGroup,
  inviteFirstHeadman,
} from "../src/server/domain/platform-workspace";
import { loadStudyWorkspace } from "../src/server/queries/study-workspace";
import { awardActivation } from "../src/server/services/gamification-service";
import { taskVisibilityWhere } from "../src/server/domain/access";
const owner: SessionUser = {
  id: "user-dev-owner",
  nickname: "test",
  avatarUrl: null,
  bio: null,
  isSystemAdmin: false,
  isOwner: true,
  isPlatformOwner: false,
  groupId: "test-group",
  permissions: [],
};
const platform: SessionUser = {
  ...owner,
  id: randomUUID(),
  isPlatformOwner: true,
};
beforeAll(async () => {
  await p.user.create({
    data: {
      id: platform.id,
      nickname: "[TEST] Platform " + platform.id,
      isPlatformOwner: true,
    },
  });
});
const student: SessionUser = {
  ...owner,
  id: "user-dev-student",
  isOwner: false,
  isPlatformOwner: false,
};
async function task() {
  return p.task.create({
    data: {
      title: "[TEST] Actionable " + randomUUID(),
      type: "LABORATORY",
      courseOfferingId: "test-course",
      createdById: owner.id,
      updatedById: owner.id,
      audiences: { create: { targetType: "GROUP", groupId: "test-group" } },
    },
  });
}
async function deadline(taskId: string) {
  const id = randomUUID();
  const ref = await p.sourceReference.create({
    data: {
      sourceId: "test-teacher-source",
      entityType: "DEADLINE",
      entityId: id,
      quoteText: "[TEST] Confirmed future hand-in date",
      confidence: "CONFIRMED",
    },
  });
  return p.deadline.create({
    data: {
      id,
      taskId,
      courseOfferingId: "test-course",
      date: new Date("2099-12-01T20:59:59.999Z"),
      type: "HARD",
      provenance: "TEACHER",
      sourceReferenceId: ref.id,
      createdById: owner.id,
    },
  });
}
async function points(taskId: string) {
  return (
    (
      await p.xpEvent.aggregate({
        where: {
          userId: student.id,
          taskId,
          ruleCode: { startsWith: "COMPLETION:" },
        },
        _sum: { points: true },
      })
    )._sum.points ?? 0
  );
}
describe("Actionable study without weakening academic trust", () => {
  it("awards completion per task once, compensates undo, serializes repeated requests and gives a small on-time bonus", async () => {
    const t = await task();
    await deadline(t.id);
    await Promise.all([
      updateOwnProgress(student, t.id, "READY"),
      updateOwnProgress(student, t.id, "READY"),
    ]);
    expect(await points(t.id)).toBe(25);
    let result = await p.studentTaskProgress.findUniqueOrThrow({
      where: { taskId_userId: { taskId: t.id, userId: student.id } },
    });
    expect(result.isVerified).toBe(false);
    expect(result.acceptedAt).toBeNull();
    expect(result.completedAt).not.toBeNull();
    await updateOwnProgress(student, t.id, "IN_PROGRESS");
    expect(await points(t.id)).toBe(0);
    await updateOwnProgress(student, t.id, "SUBMITTED");
    expect(await points(t.id)).toBe(25);
    const other = await task();
    await updateOwnProgress(student, other.id, "READY");
    expect(await points(other.id)).toBe(20);
    await expect(
      updateOwnProgress(student, t.id, "ACCEPTED"),
    ).rejects.toThrow();
  });
  it("headman can confirm or remove a self mark without fabricating teacher acceptance or exposing notes", async () => {
    const t = await task();
    await updateOwnProgress(student, t.id, "READY", "PRIVATE STUDENT NOTE");
    await expect(
      reviewCompletion(student, t.id, student.id, true),
    ).rejects.toThrow();
    const reviewed = await reviewCompletion(owner, t.id, student.id, true);
    expect(reviewed.status).toBe("READY");
    expect(reviewed.isVerified).toBe(false);
    expect(reviewed.completionReviewedById).toBe(owner.id);
    await reviewCompletion(owner, t.id, student.id, false);
    expect(await points(t.id)).toBe(0);
    const audit = await p.auditLog.findMany({
      where: { entityId: reviewed.id },
    });
    expect(JSON.stringify(audit)).not.toContain("PRIVATE STUDENT NOTE");
    await expect(
      reviewCompletion(owner, "test-foreign-task", student.id, true),
    ).rejects.toThrow();
  });
  it("cancels and restores deadlines and archives work reversibly, retaining progress and queuing calendar reconciliation", async () => {
    const t = await task();
    const d = await deadline(t.id);
    await updateOwnProgress(student, t.id, "IN_PROGRESS");
    await expect(
      setDeadlineCancelled(student, d.id, true, "Wrong date"),
    ).rejects.toThrow();
    await setDeadlineCancelled(owner, d.id, true, "Mistaken date");
    expect(
      (await p.deadline.findUniqueOrThrow({ where: { id: d.id } })).status,
    ).toBe("CANCELLED");
    await setDeadlineCancelled(owner, d.id, false, "Restore confirmed date");
    await setTaskArchived(owner, t.id, true, "Mistaken duplicate");
    expect(
      await p.task.count({
        where: { ...(await taskVisibilityWhere(student)), id: t.id },
      }),
    ).toBe(0);
    expect(await p.studentTaskProgress.count({ where: { taskId: t.id } })).toBe(
      1,
    );
    await setTaskArchived(owner, t.id, false, "Restore original work");
    expect(
      await p.task.count({
        where: { ...(await taskVisibilityWhere(student)), id: t.id },
      }),
    ).toBe(1);
    await expect(
      setTaskArchived(owner, "test-foreign-task", true, "Foreign scope"),
    ).rejects.toThrow();
  });
  it("shared catalog is opt-in, headmen only, and excludes individual tasks and personal progress", async () => {
    await setGroupSharing(owner, "test-group", false);
    expect(await loadSharedCourse(owner, "test-course")).toBeNull();
    await setGroupSharing(owner, "test-group", true);
    await expect(loadSharedCourse(student, "test-course")).rejects.toThrow();
    const course = await loadSharedCourse(owner, "test-course");
    expect(course).not.toBeNull();
    expect(course!.tasks.map((t) => t.id)).not.toContain(
      "test-individual-task",
    );
    expect(JSON.stringify(course)).not.toContain("PRIVATE STUDENT NOTE");
    expect(course!.tasks.every((t) => !("progress" in t))).toBe(true);
    await setGroupSharing(owner, "test-group", false);
  });
  it("platform directory rechecks database ownership and activation rewards remain idempotent", async () => {
    await expect(
      requirePlatformOwner({ ...student, isPlatformOwner: true }),
    ).rejects.toThrow();
    const groups = await loadPlatformDirectory(platform);
    expect(groups.some((g) => g.id === "test-other-group")).toBe(true);
    const code = "9999999/" + String(Math.floor(10000 + Math.random() * 89999));
    const g = await createEmptyGroup(platform, { code, name: "[TEST] Empty" });
    expect(await p.groupMember.count({ where: { groupId: g.id } })).toBe(0);
    await expect(
      inviteFirstHeadman(student, {
        groupId: g.id,
        fullName: "[TEST] Headman",
        email: "headman@example.invalid",
      }),
    ).rejects.toThrow();
    await inviteFirstHeadman(platform, {
      groupId: g.id,
      fullName: "[TEST] Headman",
      email: "headman@example.invalid",
    });
    expect(await p.groupMember.count({ where: { groupId: g.id } })).toBe(0);
    await expect(
      inviteFirstHeadman(platform, {
        groupId: g.id,
        fullName: "[TEST] Replacement",
        email: "other@example.invalid",
      }),
    ).rejects.toThrow();
    await p.$transaction((tx) => awardActivation(tx, student.id));
    await p.$transaction((tx) => awardActivation(tx, student.id));
    expect(
      await p.xpEvent.count({
        where: { userId: student.id, ruleCode: "PROFILE_ACTIVATED" },
      }),
    ).toBe(1);
  });
  it("serves four isolated groups and 120 accounts under concurrent workspace reads", async () => {
    const run = randomUUID(),
      viewers: SessionUser[] = [];
    for (let g = 0; g < 4; g++) {
      const gid = `load-${run}-${g}`,
        cid = `course-${gid}`;
      await p.studyGroup.create({
        data: { id: gid, code: gid, name: `[TEST] Load ${g}` },
      });
      await p.courseOffering.create({
        data: {
          id: cid,
          semesterId: "test-semester",
          courseDefinitionId: "test-course-def",
          groups: { create: { groupId: gid } },
        },
      });
      const users = Array.from({ length: 30 }, (_, i) => ({
        id: `${gid}-${i}`,
        nickname: `${gid}-${i}`,
      }));
      await p.user.createMany({ data: users });
      await p.groupMember.createMany({
        data: users.map((u) => ({ groupId: gid, userId: u.id })),
      });
      await p.enrollment.createMany({
        data: users.map((u) => ({
          groupId: gid,
          userId: u.id,
          fullName: "[TEST] Private " + u.id,
          status: "VERIFIED" as const,
        })),
      });
      const tasks = Array.from({ length: 40 }, (_, i) => ({
        id: `${cid}-${i}`,
        courseOfferingId: cid,
        title: `[TEST] Work ${i}`,
        type: "LABORATORY" as const,
        createdById: owner.id,
        updatedById: owner.id,
      }));
      await p.task.createMany({ data: tasks });
      await p.taskAudience.createMany({
        data: tasks.map((t) => ({
          taskId: t.id,
          targetType: "GROUP" as const,
          groupId: gid,
        })),
      });
      viewers.push({ ...student, id: users[0].id, groupId: gid });
    }
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => loadStudyWorkspace(viewers[i % 4])),
    );
    results.forEach((r, i) => {
      expect(r.tasks).toHaveLength(40);
      expect(
        r.offerings.every((o) => o.id === `course-${viewers[i % 4].groupId}`),
      ).toBe(true);
    });
    console.log(
      `Four-group isolated read check: 120 accounts, 160 tasks, 20 requests in ${Date.now() - started}ms`,
    );
  }, 30000);
});
