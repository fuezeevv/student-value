import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import {
  ForbiddenError,
  requirePermission,
  hasPermission,
} from "@/lib/permissions/checker";

export async function taskVisibilityWhere(
  user: SessionUser,
): Promise<Prisma.TaskWhereInput> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { groupId_userId: { groupId: user.groupId, userId: user.id } },
  });
  const subgroup = enrollment?.subgroup;
  return {
    status: "PUBLISHED",
    courseOffering: {
      status: "ACTIVE",
      groups: { some: { groupId: user.groupId } },
    },
    audiences: {
      some: {
        OR: [
          { targetType: "ALL_COURSE" },
          { targetType: "GROUP", groupId: user.groupId },
          ...(subgroup != null
            ? [
                {
                  targetType: "SUBGROUP" as const,
                  groupId: user.groupId,
                  subgroupNumber: subgroup,
                },
              ]
            : []),
          ...(enrollment
            ? [
                {
                  targetType: "INDIVIDUAL" as const,
                  enrollmentId: enrollment.id,
                },
              ]
            : []),
        ],
      },
    },
  };
}

export async function requireTaskAudience(user: SessionUser, taskId: string) {
  const where = await taskVisibilityWhere(user);
  const task = await prisma.task.findFirst({
    where: { AND: [where, { id: taskId }] },
  });
  if (!task)
    throw new ForbiddenError(
      "Задание недоступно для вашей группы или адресата",
    );
  return task;
}

export async function requireCoursePermission(
  user: SessionUser | null,
  courseId: string,
  permission: string,
) {
  if (!user) await requirePermission(user, permission);
  const course = await prisma.courseOffering.findUnique({
    where: { id: courseId },
    include: { groups: true },
  });
  const groupId = course?.groups.find(
    (g) => g.groupId === user!.groupId,
  )?.groupId;
  if (!groupId) throw new ForbiddenError("Курс недоступен в выбранной группе");
  if (course!.groups.length !== 1)
    throw new ForbiddenError(
      "Общий курс требует отдельного учебного пространства группы",
    );
  if (!hasPermission(user, permission, groupId)) {
    const contentPermission = [
      "manage_tasks",
      "manage_deadlines",
      "manage_materials",
      "manage_courses",
      "manage_sessions",
      "review_proposals",
    ].includes(permission);
    if (!(
      contentPermission &&
      hasPermission(user, `manage_course:${courseId}`, groupId)
    )) {
      await requirePermission(
        user,
        `${permission}:${courseId}`,
        "course",
        groupId,
      );
    }
  }
  return course!;
}

export async function audienceMemberIds(taskId: string) {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { courseOffering: { include: { groups: true } } },
  });
  const members = await prisma.groupMember.findMany({
    where: {
      groupId: { in: task.courseOffering.groups.map((g) => g.groupId) },
    },
    include: { user: true },
  });
  const ids: string[] = [];
  for (const m of members) {
    const user: SessionUser = {
      ...m.user,
      isOwner: false,
      groupId: m.groupId,
      permissions: [],
    };
    const where = await taskVisibilityWhere(user);
    if (await prisma.task.count({ where: { AND: [where, { id: taskId }] } }))
      ids.push(m.userId);
  }
  return [...new Set(ids)];
}
