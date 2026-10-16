import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import type { SessionUser } from "../src/lib/auth/session";
import {
  taskVisibilityWhere,
  requireTaskAudience,
  requireCoursePermission,
} from "../src/server/domain/access";
import { verifyProgress, saveOwnNotes } from "../src/server/domain/progress";
import {
  isTrustedAccepted,
  progressEvidenceInclude,
} from "../src/server/domain/trust";
import { rescheduleDeadline } from "../src/server/domain/deadlines";
import { hasPermission } from "../src/lib/permissions/checker";
import { assignedVariants } from "../src/server/domain/variants";
import { bootstrap } from "../prisma/bootstrap";
let currentUser: SessionUser;
const base = {
  avatarUrl: null,
  bio: null,
  isSystemAdmin: false,
  groupId: "test-group",
  permissions: [],
};
const student: SessionUser = {
  ...base,
  id: "user-dev-student",
  nickname: "test_student",
  isOwner: false,
};
const owner: SessionUser = {
  ...base,
  id: "user-dev-owner",
  nickname: "test_headman",
  isOwner: true,
};
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../src/lib/auth/session", () => ({
  requireCurrentUser: async () => currentUser,
  getCurrentUser: async () => currentUser,
}));
import {
  updateStudentProgressAction,
  createTaskAction,
  saveStudentNotesAction,
} from "../src/server/actions/task-actions";
import {
  linkEnrollmentAction,
  createAnnouncementAction,
} from "../src/server/actions/admin-actions";
beforeEach(() => {
  currentUser = student;
});
async function deadline(strict = false) {
  const id = randomUUID();
  const d = await prisma.deadline.create({
    data: {
      id,
      taskId: "task-otu-lab1",
      courseOfferingId: "test-course",
      date: new Date(
        strict ? "2026-10-16T14:35:27+03:00" : "2026-10-16T23:59:59.999+03:00",
      ),
      isTimeStrict: strict,
      createdById: owner.id,
    },
  });
  const r = await prisma.sourceReference.create({
    data: {
      sourceId: "test-teacher-source",
      entityType: "DEADLINE",
      entityId: id,
      quoteText: "[TEST] Срок преподавателя",
      confidence: "CONFIRMED",
    },
  });
  return prisma.deadline.update({
    where: { id: d.id },
    data: { sourceReferenceId: r.id, provenance: "TEACHER" },
  });
}
describe("task scope and server actions", () => {
  it("limits visibility to published tasks addressed to the student", async () => {
    const tasks = await prisma.task.findMany({
      where: await taskVisibilityWhere(student),
      select: { id: true },
    });
    const ids = tasks.map((t) => t.id);
    expect(ids).toContain("task-otu-lab1");
    for (const id of [
      "test-foreign-task",
      "test-subgroup-task",
      "test-individual-task",
      "test-draft-task",
      "test-no-audience",
    ]) {
      expect(ids).not.toContain(id);
      await expect(requireTaskAudience(student, id)).rejects.toThrow();
      await expect(
        updateStudentProgressAction(id, "IN_PROGRESS"),
      ).rejects.toThrow();
    }
  });
  it("allows correct subgroup and individual recipients", async () => {
    const peer = { ...student, id: "test-peer" };
    await expect(
      requireTaskAudience(peer, "test-subgroup-task"),
    ).resolves.toBeDefined();
    await expect(
      requireTaskAudience(peer, "test-individual-task"),
    ).resolves.toBeDefined();
  });
  it("does not treat a group owner as owner of another group", async () => {
    expect(hasPermission(owner, "manage_tasks", "test-other-group")).toBe(
      false,
    );
    await expect(
      requireCoursePermission(owner, "test-other-course", "manage_tasks"),
    ).rejects.toThrow();
  });
  it("does not let course management grant verification authority", async () => {
    await expect(
      requireCoursePermission(
        { ...student, permissions: ["manage_course:test-course"] },
        "test-course",
        "verify_progress",
      ),
    ).rejects.toThrow();
  });
  it("blocks cross-group creates and enrollment linking", async () => {
    currentUser = owner;
    await expect(
      createTaskAction({
        courseOfferingId: "test-other-course",
        title: "No cross group",
        type: "LABORATORY",
        sourceNote: "[TEST] подтверждённое задание",
        deadlineType: "HARD",
        isTimeStrict: false,
      }),
    ).rejects.toThrow();
    await expect(
      createAnnouncementAction({
        title: "Недоступный курс",
        content: "Это тестовое объявление",
        courseOfferingId: "test-other-course",
        isPinned: false,
        priority: "NORMAL",
      }),
    ).rejects.toThrow();
    const outsider = await prisma.enrollment.upsert({
      where: {
        groupId_fullName: {
          groupId: "test-other-group",
          fullName: "PRIVATE OTHER",
        },
      },
      update: {},
      create: { groupId: "test-other-group", fullName: "PRIVATE OTHER" },
    });
    await expect(
      linkEnrollmentAction(outsider.id, student.id),
    ).rejects.toThrow();
  });
  it("keeps an unassigned variant unassigned", async () => {
    const variants = await prisma.taskVariant.findMany({
      where: {
        taskId: "task-otu-lab1",
        assignments: {
          some: {
            enrollment: { userId: student.id },
            confidence: "CONFIRMED",
            sourceReference: { confidence: "CONFIRMED" },
          },
        },
      },
    });
    expect(variants).toHaveLength(0);
  });
});
describe("accepted and personal progress", () => {
  it("rejects self ACCEPTED through the server action for student and owner", async () => {
    await expect(
      updateStudentProgressAction("task-otu-lab1", "ACCEPTED"),
    ).rejects.toThrow();
    currentUser = owner;
    await expect(
      updateStudentProgressAction("task-otu-lab1", "ACCEPTED"),
    ).rejects.toThrow();
    await expect(
      verifyProgress(
        owner,
        "task-otu-lab1",
        owner.id,
        true,
        "HEADMAN_CONFIRMED",
        "test-evidence",
      ),
    ).rejects.toThrow();
  });
  it("requires evidence and never promotes an owner to teacher", async () => {
    await expect(
      verifyProgress(
        owner,
        "task-otu-lab1",
        "test-peer",
        true,
        "HEADMAN_CONFIRMED",
      ),
    ).rejects.toThrow();
    await expect(
      verifyProgress(
        owner,
        "task-otu-lab1",
        "test-peer",
        true,
        "TEACHER_CONFIRMED",
        "test-evidence",
      ),
    ).rejects.toThrow();
    await expect(
      verifyProgress(
        owner,
        "task-otu-lab1",
        student.id,
        true,
        "HEADMAN_CONFIRMED",
        "test-evidence",
      ),
    ).rejects.toThrow();
  });
  it("persists method, actor, date and source; saving notes preserves acceptance", async () => {
    await verifyProgress(
      owner,
      "task-otu-lab1",
      "test-peer",
      true,
      "HEADMAN_CONFIRMED",
      "test-evidence",
    );
    await saveOwnNotes(
      { ...student, id: "test-peer" },
      "task-otu-lab1",
      "Мои приватные заметки",
    );
    const row = await prisma.studentTaskProgress.findUniqueOrThrow({
      where: {
        taskId_userId: { taskId: "task-otu-lab1", userId: "test-peer" },
      },
      include: progressEvidenceInclude,
    });
    expect(isTrustedAccepted(row)).toBe(true);
    expect(row.verificationSource).toBe("HEADMAN_CONFIRMED");
    expect(row.verifiedById).toBe(owner.id);
    expect(row.studentNotes).toBe("Мои приватные заметки");
  });
  it("enforces structural trust at the database boundary", async () => {
    await expect(
      prisma.studentTaskProgress.upsert({
        where: {
          taskId_userId: { taskId: "task-otu-lab1", userId: student.id },
        },
        update: {
          status: "ACCEPTED",
          isVerified: true,
          verifiedById: student.id,
        },
        create: {
          taskId: "task-otu-lab1",
          userId: student.id,
          status: "ACCEPTED",
          isVerified: true,
          verifiedById: student.id,
        },
      }),
    ).rejects.toThrow();
  });
  it("saves ordinary personal progress and notes", async () => {
    await updateStudentProgressAction("task-otu-lab1", "IN_PROGRESS");
    await saveStudentNotesAction("task-otu-lab1", "Личный черновик");
    const row = await prisma.studentTaskProgress.findUniqueOrThrow({
      where: { taskId_userId: { taskId: "task-otu-lab1", userId: student.id } },
    });
    expect(row.status).toBe("IN_PROGRESS");
    expect(row.studentNotes).toBe("Личный черновик");
  });
});
describe("deadline history", () => {
  it("preserves old date and Moscow time, adds source and notifies recipients once", async () => {
    const old = await deadline(true);
    const before = await prisma.notification.count({
      where: { type: "DEADLINE_CHANGE" },
    });
    const next = await rescheduleDeadline(
      owner,
      old.id,
      "2026-11-20",
      "SOFT",
      "[TEST] Преподаватель перенёс срок на занятии",
    );
    expect(next.id).not.toBe(old.id);
    expect(next.originalDeadlineId).toBe(old.id);
    expect(next.date.toISOString()).toBe("2026-11-20T11:35:27.000Z");
    const history = await prisma.deadline.findUniqueOrThrow({
      where: { id: old.id },
    });
    expect(history.status).toBe("SUPERSEDED");
    expect(history.date).toEqual(old.date);
    expect(next.sourceReferenceId).toBeTruthy();
    const after = await prisma.notification.count({
      where: { type: "DEADLINE_CHANGE" },
    });
    expect(after - before).toBe(
      await prisma.groupMember.count({ where: { groupId: "test-group" } }),
    );
    await rescheduleDeadline(owner, next.id, "2026-11-20", "SOFT");
    expect(
      await prisma.notification.count({ where: { type: "DEADLINE_CHANGE" } }),
    ).toBe(after);
  });
  it("keeps date-only deadlines at the end of the selected Moscow date", async () => {
    const old = await deadline();
    const next = await rescheduleDeadline(
      owner,
      old.id,
      "2026-10-27",
      undefined,
      "[TEST] Новый срок подтверждён старостой",
    );
    expect(next.isTimeStrict).toBe(false);
    expect(next.date.toISOString()).toBe("2026-10-27T20:59:59.999Z");
  });
  it("requires permission and evidence before any write", async () => {
    const old = await deadline();
    await expect(
      rescheduleDeadline(
        student,
        old.id,
        "2026-11-20",
        undefined,
        "[TEST] denied",
      ),
    ).rejects.toThrow();
    await expect(
      rescheduleDeadline(owner, old.id, "2026-11-20"),
    ).rejects.toThrow();
    expect(
      (await prisma.deadline.findUniqueOrThrow({ where: { id: old.id } }))
        .status,
    ).toBe("ACTIVE");
  });
  it("allows only one concurrent reschedule of the same original deadline", async () => {
    const old = await deadline();
    const results = await Promise.allSettled([
      rescheduleDeadline(
        owner,
        old.id,
        "2026-11-21",
        undefined,
        "[TEST] Concurrent A",
      ),
      rescheduleDeadline(
        owner,
        old.id,
        "2026-11-22",
        undefined,
        "[TEST] Concurrent B",
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await prisma.deadline.count({ where: { originalDeadlineId: old.id } }),
    ).toBe(1);
  });
});
describe("create-only seed", () => {
  it("preserves actual progress, edited deadlines, XP and achievements on repeated runs", async () => {
    await bootstrap(prisma);
    const row = await prisma.studentTaskProgress.findUniqueOrThrow({
      where: { taskId_userId: { taskId: "task-otu-lab1", userId: student.id } },
    });
    const deadline = await prisma.deadline.update({
      where: { id: "dl-cad-ex-1" },
      data: { date: new Date("2027-01-20T20:59:59.999Z") },
    });
    const events = await prisma.xpEvent.count();
    const achievements = await prisma.userAchievement.count();
    await bootstrap(prisma);
    await bootstrap(prisma);
    expect(
      await prisma.studentTaskProgress.findUnique({ where: { id: row.id } }),
    ).toEqual(row);
    expect(
      await prisma.deadline.findUnique({ where: { id: deadline.id } }),
    ).toEqual(deadline);
    expect(await prisma.xpEvent.count()).toBe(events);
    expect(await prisma.userAchievement.count()).toBe(achievements);
  });
});

describe("explicit variant evidence", () => {
  it("shows only a single confirmed assignment with evidence about that assignment", async () => {
    const task = await prisma.task.create({
      data: {
        courseOfferingId: "test-course",
        title: "[TEST] Вариант с основанием",
        type: "LABORATORY",
        createdById: owner.id,
        updatedById: owner.id,
        audiences: { create: { targetType: "GROUP", groupId: owner.groupId } },
      },
    });
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: {
        groupId_userId: { groupId: student.groupId, userId: student.id },
      },
    });
    const variant = await prisma.taskVariant.create({
      data: { taskId: task.id, variantNumber: "7" },
    });
    const assignment = await prisma.variantAssignment.create({
      data: { taskVariantId: variant.id, enrollmentId: enrollment.id },
    });
    expect(
      (await assignedVariants(student, [task.id])).get(task.id),
    ).toBeUndefined();
    const source = await prisma.sourceReference.create({
      data: {
        sourceId: "test-teacher-source",
        entityType: "VARIANT_ASSIGNMENT",
        entityId: assignment.id,
        quoteText: "[TEST] Преподаватель назначил вариант 7",
        confidence: "CONFIRMED",
      },
    });
    await prisma.variantAssignment.update({
      where: { id: assignment.id },
      data: { confidence: "CONFIRMED", sourceReferenceId: source.id },
    });
    expect(
      (await assignedVariants(student, [task.id])).get(task.id)?.variantNumber,
    ).toBe("7");
    const second = await prisma.taskVariant.create({
      data: { taskId: task.id, variantNumber: "8" },
    });
    const secondAssignment = await prisma.variantAssignment.create({
      data: {
        taskVariantId: second.id,
        enrollmentId: enrollment.id,
        confidence: "CONFIRMED",
      },
    });
    const secondRef = await prisma.sourceReference.create({
      data: {
        sourceId: "test-teacher-source",
        entityType: "VARIANT_ASSIGNMENT",
        entityId: secondAssignment.id,
        quoteText: "[TEST] Конфликтующий вариант",
        confidence: "CONFIRMED",
      },
    });
    await prisma.variantAssignment.update({
      where: { id: secondAssignment.id },
      data: { sourceReferenceId: secondRef.id },
    });
    expect(
      (await assignedVariants(student, [task.id])).get(task.id),
    ).toBeUndefined();
  });
});
