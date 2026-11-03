import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/checker";
import { randomUUID } from "node:crypto";
import { createEnrollmentGrant } from "./google-login";

export async function inviteFirstHeadman(user: SessionUser, raw: unknown) {
  await requirePlatformOwner(user);
  const input = z
    .object({
      groupId: z.string().min(1),
      fullName: z.string().trim().min(3).max(160),
      email: z.string().trim().email().max(254),
    })
    .parse(raw);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "StudyGroup" WHERE id = ${input.groupId} FOR UPDATE`;
    await tx.studyGroup.findUniqueOrThrow({ where: { id: input.groupId } });
    if (
      (await tx.groupMember.count({ where: { groupId: input.groupId } })) ||
      (await tx.enrollment.count({ where: { groupId: input.groupId } }))
    )
      throw new ForbiddenError(
        "В этой группе уже есть участники или приглашения. Используйте существующее приглашение старосты.",
      );
    const id = randomUUID(),
      grant = createEnrollmentGrant(id, input.email, null, Date.now(), {
        groupId: input.groupId,
        owner: true,
      });
    await tx.enrollment.create({
      data: {
        id,
        groupId: input.groupId,
        fullName: input.fullName,
        initialOwner: true,
        claimToken: grant.stored,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "INVITE_FIRST_HEADMAN",
        entityType: "GROUP",
        entityId: input.groupId,
        details: {
          groupId: input.groupId,
          enrollmentId: id,
          recipientHash: JSON.parse(grant.stored).recipient,
        },
      },
    });
    return { code: grant.code };
  });
}
export async function requirePlatformOwner(user: SessionUser) {
  if (
    !user.isPlatformOwner ||
    !(await prisma.user.count({
      where: { id: user.id, isPlatformOwner: true },
    }))
  )
    throw new ForbiddenError("Доступно владельцу сайта");
}
export async function loadPlatformDirectory(user: SessionUser) {
  await requirePlatformOwner(user);
  return prisma.studyGroup.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      shareStudyContent: true,
      _count: { select: { enrollments: true, courses: true } },
      members: {
        orderBy: { joinedAt: "asc" },
        select: {
          isOwner: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              nickname: true,
              createdAt: true,
              enrollments: {
                select: { groupId: true, fullName: true, status: true },
              },
            },
          },
        },
      },
    },
  });
}
export async function createEmptyGroup(user: SessionUser, raw: unknown) {
  await requirePlatformOwner(user);
  const input = z
    .object({
      code: z
        .string()
        .trim()
        .regex(/^\d{7}\/\d{5}$/, "Полный номер группы, например 5130901/40201"),
      name: z.string().trim().min(2).max(100),
    })
    .parse(raw);
  return prisma.$transaction(async (tx) => {
    const old = await tx.studyGroup.findUnique({ where: { code: input.code } });
    if (old) return old;
    const group = await tx.studyGroup.create({ data: input });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_EMPTY_GROUP",
        entityType: "GROUP",
        entityId: group.id,
        details: { groupId: group.id, code: group.code },
      },
    });
    return group;
  });
}
export async function setGroupSharing(
  user: SessionUser,
  groupId: string,
  shared: boolean,
) {
  shared = z.boolean().parse(shared);
  if (user.isPlatformOwner) await requirePlatformOwner(user);
  else if (
    !(await prisma.groupMember.count({
      where: { userId: user.id, groupId, isOwner: true },
    }))
  )
    throw new ForbiddenError("Настройку меняет староста этой группы");
  return prisma.$transaction(async (tx) => {
    const before = await tx.studyGroup.findUniqueOrThrow({
      where: { id: groupId },
    });
    if (before.shareStudyContent === shared) return;
    await tx.studyGroup.update({
      where: { id: groupId },
      data: { shareStudyContent: shared },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "SET_STUDY_SHARING",
        entityType: "GROUP",
        entityId: groupId,
        details: { groupId, from: before.shareStudyContent, to: shared },
      },
    });
  });
}
export async function requireHeadmanExchange(user: SessionUser) {
  if (user.isPlatformOwner) {
    await requirePlatformOwner(user);
    return;
  }
  if (
    !(await prisma.groupMember.count({
      where: {
        userId: user.id,
        isOwner: true,
        group: {
          enrollments: {
            some: { userId: user.id, status: { in: ["CLAIMED", "VERIFIED"] } },
          },
        },
      },
    }))
  )
    throw new ForbiddenError("Общие материалы доступны старостам");
}
export const sharedCourseWhere: Prisma.CourseOfferingWhereInput = {
  status: "ACTIVE",
  mergedIntoId: null,
  semester: { isCurrent: true },
  groups: {
    some: { group: { shareStudyContent: true } },
    every: { group: { shareStudyContent: true } },
  },
};
export function sharedTaskWhere(groupId: string): Prisma.TaskWhereInput {
  return {
    status: "PUBLISHED",
    mergedIntoId: null,
    audiences: {
      some: {
        OR: [{ targetType: "ALL_COURSE" }, { targetType: "GROUP", groupId }],
      },
    },
  };
}
export async function loadSharedCourse(user: SessionUser, id: string) {
  await requireHeadmanExchange(user);
  const course = await prisma.courseOffering.findFirst({
    where: { ...sharedCourseWhere, id },
    select: {
      id: true,
      courseDefinition: true,
      groups: {
        select: { group: { select: { id: true, name: true, code: true } } },
      },
    },
  });
  if (!course || course.groups.length !== 1) return null;
  const tasks = await prisma.task.findMany({
    where: {
      ...sharedTaskWhere(course.groups[0].group.id),
      courseOfferingId: id,
    },
    orderBy: [{ number: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      number: true,
      deadlines: {
        where: {
          status: "ACTIVE",
          provenance: { in: ["TEACHER", "OFFICIAL", "HEADMAN_CONFIRMED"] },
          sourceReference: { confidence: "CONFIRMED" },
        },
        orderBy: { date: "asc" },
        select: { date: true, title: true, isTimeStrict: true },
      },
      materials: {
        select: {
          material: {
            select: { id: true, title: true, url: true, type: true },
          },
        },
      },
    },
  });
  return { ...course, tasks };
}
