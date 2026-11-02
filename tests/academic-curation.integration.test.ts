import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import type { SessionUser } from "../src/lib/auth/session";
import {
  mergeEmptyCourse,
  archiveUnusedDuplicate,
  confirmTeachingRoles,
} from "../src/server/domain/academic-curation";
import {
  courseDestination,
  taskDestination,
} from "../src/server/domain/academic-aliases";
import { requireCoursePermission } from "../src/server/domain/access";
const owner: SessionUser = {
  id: "user-dev-owner",
  nickname: "[TEST] owner",
  avatarUrl: null,
  bio: null,
  isOwner: true,
  isSystemAdmin: false,
  groupId: "test-group",
  permissions: [],
};
const student = { ...owner, id: "user-dev-student", isOwner: false };
const evidence =
  "[TEST] Explicit headman confirmation of the duplicate academic record";

it("records separate lecture/practice roles as sourced facts once, keeping the previous interpretation in audit", async () => {
  const c = await course();
  const teachers = await Promise.all(
    ["Lecturer", "Practitioner"].map((fullName) =>
      prisma.teacher.create({ data: { fullName: "[TEST] " + fullName } }),
    ),
  );
  for (const t of teachers)
    await prisma.courseTeacher.create({
      data: {
        courseOfferingId: c.id,
        teacherId: t.id,
        status: "DISPUTED",
        notes: "[TEST] former mistaken conflict",
      },
    });
  const roles = [
    { teacherId: teachers[0].id, role: "Лекции" },
    { teacherId: teachers[1].id, role: "Практики и расчётные работы" },
  ];
  await expect(
    confirmTeachingRoles(student, c.id, roles, evidence),
  ).rejects.toThrow();
  expect(await confirmTeachingRoles(owner, c.id, roles, evidence)).toEqual({
    changed: true,
  });
  expect(await confirmTeachingRoles(owner, c.id, roles, evidence)).toEqual({
    changed: false,
  });
  const links = await prisma.courseTeacher.findMany({
    where: { courseOfferingId: c.id },
    include: { sourceReference: true },
  });
  expect(
    links.every(
      (x) =>
        x.status === "CONFIRMED" &&
        x.sourceReference?.quoteText === evidence &&
        x.sourceReference.entityId === x.id,
    ),
  ).toBe(true);
  expect(
    await prisma.auditLog.count({
      where: {
        action: "CONFIRM_TEACHING_ROLE",
        entityId: { in: links.map((x) => x.id) },
      },
    }),
  ).toBe(2);
});
async function course() {
  return prisma.courseOffering.create({
    data: {
      semester: { connect: { id: "test-semester" } },
      courseDefinition: {
        create: {
          code: "TEST-" + randomUUID(),
          title: "[TEST] Confirmed full course name",
          shortTitle: "[TEST]",
        },
      },
      groups: { create: { groupId: owner.groupId } },
    },
  });
}
async function task(courseId: string) {
  return prisma.task.create({
    data: {
      courseOfferingId: courseId,
      title: "[TEST] Identical task",
      type: "HOMEWORK",
      createdById: owner.id,
      updatedById: owner.id,
      audiences: { create: { targetType: "GROUP", groupId: owner.groupId } },
    },
  });
}

it("merges an empty duplicate course once, preserving task IDs, progress and teacher uncertainty", async () => {
  const from = await course(),
    to = await course(),
    t = await task(to.id);
  const teacher = await prisma.teacher.create({
    data: { fullName: "[TEST] Teacher" },
  });
  const ct = await prisma.courseTeacher.create({
    data: {
      courseOfferingId: from.id,
      teacherId: teacher.id,
      role: "Практика",
      status: "CANDIDATE_UNVERIFIED",
    },
  });
  await prisma.studentTaskProgress.create({
    data: {
      userId: student.id,
      taskId: t.id,
      status: "READY",
      studentNotes: "[TEST] private original note",
    },
  });
  const before = await prisma.studentTaskProgress.findUnique({
    where: { taskId_userId: { userId: student.id, taskId: t.id } },
  });
  expect(await mergeEmptyCourse(owner, from.id, to.id, evidence)).toEqual({
    changed: true,
  });
  expect(await mergeEmptyCourse(owner, from.id, to.id, evidence)).toEqual({
    changed: false,
  });
  expect(await courseDestination(student, from.id)).toBe(to.id);
  expect(
    await courseDestination(
      { ...owner, groupId: "test-other-group", isPlatformOwner: true },
      from.id,
    ),
  ).toBeNull();
  expect(
    await prisma.studentTaskProgress.findUnique({
      where: { taskId_userId: { userId: student.id, taskId: t.id } },
    }),
  ).toEqual(before);
  expect(
    await prisma.courseTeacher.findUnique({ where: { id: ct.id } }),
  ).toMatchObject({ courseOfferingId: to.id, status: "CANDIDATE_UNVERIFIED" });
  await expect(
    requireCoursePermission(owner, from.id, "manage_tasks"),
  ).rejects.toThrow();
});
it("rejects course repair by a student and rejects a nonempty source atomically", async () => {
  const from = await course(),
    to = await course();
  await task(from.id);
  await expect(
    mergeEmptyCourse(student, from.id, to.id, evidence),
  ).rejects.toThrow();
  await expect(
    mergeEmptyCourse(owner, from.id, to.id, evidence),
  ).rejects.toThrow();
  expect(
    await prisma.courseOffering.findUnique({ where: { id: from.id } }),
  ).toMatchObject({ status: "ACTIVE", mergedIntoId: null });
});
it("does not silently transfer delegated permissions", async () => {
  const from = await course(),
    to = await course();
  const role = await prisma.role.create({
    data: {
      groupId: owner.groupId,
      name: "[TEST] repair " + randomUUID(),
      permissions: { create: { permission: "manage_course:" + from.id } },
    },
  });
  await expect(
    mergeEmptyCourse(owner, from.id, to.id, evidence),
  ).rejects.toThrow();
  expect(
    await prisma.rolePermission.count({
      where: { roleId: role.id, permission: "manage_course:" + to.id },
    }),
  ).toBe(0);
});
it("archives only the unused task, preserves private progress exactly and resolves old links within audience", async () => {
  const c = await course(),
    from = await task(c.id),
    to = await task(c.id);
  const progress = await prisma.studentTaskProgress.create({
    data: {
      taskId: to.id,
      userId: student.id,
      status: "READY",
      studentNotes: "[TEST] never copy or overwrite this",
    },
  });
  expect(await archiveUnusedDuplicate(owner, from.id, to.id, evidence)).toEqual(
    { changed: true },
  );
  expect(await archiveUnusedDuplicate(owner, from.id, to.id, evidence)).toEqual(
    { changed: false },
  );
  expect(
    await prisma.studentTaskProgress.findUnique({ where: { id: progress.id } }),
  ).toEqual(progress);
  expect(
    await prisma.task.count({ where: { id: { in: [from.id, to.id] } } }),
  ).toBe(2);
  expect(await taskDestination(student, from.id)).toBe(to.id);
  expect(
    await taskDestination(
      { ...owner, groupId: "test-other-group", isPlatformOwner: true },
      from.id,
    ),
  ).toBeNull();
});
it("refuses to lose any progress on the source, even NOT_STARTED", async () => {
  const c = await course(),
    from = await task(c.id),
    to = await task(c.id);
  await prisma.studentTaskProgress.create({
    data: { taskId: from.id, userId: student.id, status: "NOT_STARTED" },
  });
  await expect(
    archiveUnusedDuplicate(owner, from.id, to.id, evidence),
  ).rejects.toThrow();
  expect(
    await prisma.task.findUnique({ where: { id: from.id } }),
  ).toMatchObject({ status: "PUBLISHED", mergedIntoId: null });
});
it("refuses different audiences or content rather than fuzzy matching by title", async () => {
  const c = await course(),
    from = await task(c.id),
    to = await task(c.id);
  await prisma.task.update({
    where: { id: to.id },
    data: { description: "[TEST] different requirement" },
  });
  await expect(
    archiveUnusedDuplicate(owner, from.id, to.id, evidence),
  ).rejects.toThrow();
  await prisma.task.update({
    where: { id: to.id },
    data: { description: null },
  });
  await prisma.taskAudience.updateMany({
    where: { taskId: to.id },
    data: { targetType: "SUBGROUP", subgroupNumber: 7 },
  });
  await expect(
    archiveUnusedDuplicate(owner, from.id, to.id, evidence),
  ).rejects.toThrow();
});
it("rejects cross-group course repair and self alias at database boundary", async () => {
  const from = await course(),
    to = await course();
  await prisma.courseOfferingGroup.updateMany({
    where: { courseOfferingId: to.id },
    data: { groupId: "test-other-group" },
  });
  await expect(
    mergeEmptyCourse(owner, from.id, to.id, evidence),
  ).rejects.toThrow();
  await expect(
    prisma.courseOffering.update({
      where: { id: from.id },
      data: { status: "ARCHIVED", mergedIntoId: from.id },
    }),
  ).rejects.toThrow();
});
