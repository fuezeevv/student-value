import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { requirePermission, ForbiddenError } from "@/lib/permissions/checker";
import { equalSecret, hashToken } from "@/lib/auth/google";
import { createEnrollmentGrant } from "./google-login";
import { requireCoursePermission } from "./access";

const text = z.string().trim().min(2).max(160);
const email = z.string().trim().email().max(254);
export async function createGroupWorkspace(user: SessionUser, raw: unknown) {
  if (!user.isPlatformOwner)
    throw new ForbiddenError("Подключать группы может владелец платформы");
  const input = z
    .object({ code: text, name: text, headmanName: text, headmanEmail: email })
    .parse(raw);
  return prisma.$transaction(async (tx) => {
    const group = await tx.studyGroup.create({
      data: { code: input.code, name: input.name },
    });
    const id = randomUUID();
    const grant = createEnrollmentGrant(
      id,
      input.headmanEmail,
      null,
      Date.now(),
      { groupId: group.id, owner: true },
    );
    await tx.enrollment.create({
      data: {
        id,
        groupId: group.id,
        fullName: input.headmanName,
        initialOwner: true,
        claimToken: grant.stored,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_GROUP_WORKSPACE",
        entityType: "GROUP",
        entityId: group.id,
        details: {
          groupId: group.id,
          headmanEnrollmentId: id,
          recipientHash: JSON.parse(grant.stored).recipient,
        },
      },
    });
    return { code: grant.code, groupId: group.id };
  });
}

/** Reissue only to the same recipient; a platform owner cannot silently redirect an ownership grant. */
export async function reissueHeadmanInvitation(
  user: SessionUser,
  groupId: string,
  recipient: string,
) {
  if (!user.isPlatformOwner)
    throw new ForbiddenError("Доступно владельцу платформы");
  const normalized = email.parse(recipient).toLowerCase();
  return prisma.$transaction(
    async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: {
          groupId,
          initialOwner: true,
          userId: null,
          status: "PENDING_CLAIM",
        },
      });
      if (!enrollment?.claimToken)
        throw new ForbiddenError("Нет ожидающего приглашения старосты");
      let previous;
      try {
        previous = JSON.parse(enrollment.claimToken);
      } catch {
        throw new ForbiddenError("Приглашение повреждено");
      }
      if (
        previous.v !== 2 ||
        previous.owner !== true ||
        previous.groupId !== groupId ||
        typeof previous.recipient !== "string" ||
        !equalSecret(previous.recipient, hashToken(normalized))
      )
        throw new ForbiddenError(
          "Укажите Google email первоначального получателя",
        );
      const grant = createEnrollmentGrant(
        enrollment.id,
        normalized,
        null,
        Date.now(),
        { groupId, owner: true },
      );
      const updated = await tx.enrollment.updateMany({
        where: {
          id: enrollment.id,
          claimToken: enrollment.claimToken,
          initialOwner: true,
          userId: null,
        },
        data: { claimToken: grant.stored },
      });
      if (updated.count !== 1)
        throw new ForbiddenError("Приглашение уже изменилось");
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "REISSUE_HEADMAN_INVITATION",
          entityType: "ENROLLMENT",
          entityId: enrollment.id,
          details: { groupId, recipientHash: previous.recipient },
        },
      });
      return { code: grant.code };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function inviteGroupMember(user: SessionUser, raw: unknown) {
  await requirePermission(user, "manage_members");
  await requirePermission(user, "view_private_member_identity");
  const input = z
    .object({
      enrollmentId: z.string().optional(),
      fullName: text,
      email,
      subgroup: z.number().int().min(1).max(50).nullable().optional(),
    })
    .parse(raw);
  return prisma.$transaction(
    async (tx) => {
      const enrollment = input.enrollmentId
        ? await tx.enrollment.findFirst({
            where: { id: input.enrollmentId, groupId: user.groupId },
          })
        : await tx.enrollment.findUnique({
            where: {
              groupId_fullName: {
                groupId: user.groupId,
                fullName: input.fullName,
              },
            },
          });
      if (input.enrollmentId && !enrollment)
        throw new ForbiddenError("Запись не найдена в вашей группе");
      if (
        enrollment?.status === "ARCHIVED" ||
        enrollment?.userId ||
        enrollment?.initialOwner
      )
        throw new ForbiddenError(
          "Для этой записи обычное приглашение недоступно",
        );
      const id = enrollment?.id ?? randomUUID();
      const grant = createEnrollmentGrant(id, input.email, null, Date.now(), {
        groupId: user.groupId,
        owner: false,
      });
      if (enrollment)
        await tx.enrollment.update({
          where: { id },
          data: { claimToken: grant.stored },
        });
      else
        await tx.enrollment.create({
          data: {
            id,
            groupId: user.groupId,
            fullName: input.fullName,
            subgroup: input.subgroup,
            claimToken: grant.stored,
          },
        });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "ISSUE_GROUP_INVITATION",
          entityType: "ENROLLMENT",
          entityId: id,
          details: {
            groupId: user.groupId,
            recipientHash: JSON.parse(grant.stored).recipient,
            replacesPrevious: Boolean(enrollment?.claimToken),
          },
        },
      });
      return { code: grant.code, groupId: user.groupId };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function delegateCourse(
  user: SessionUser,
  memberId: string,
  courseId: string,
  enabled: boolean,
) {
  await requirePermission(user, "manage_roles");
  await requireCoursePermission(user, courseId, "manage_roles");
  const member = await prisma.groupMember.findFirst({
    where: {
      id: memberId,
      groupId: user.groupId,
      group: {
        enrollments: {
          some: {
            userId: { not: null },
            status: { in: ["CLAIMED", "VERIFIED"] },
          },
        },
      },
    },
  });
  if (!member || member.isOwner)
    throw new ForbiddenError("Участник недоступен для делегирования");
  const active = await prisma.enrollment.findFirst({
    where: {
      groupId: user.groupId,
      userId: member.userId,
      status: { in: ["CLAIMED", "VERIFIED"] },
    },
  });
  if (!active) throw new ForbiddenError("У участника нет действующего доступа");
  await prisma.$transaction(async (tx) => {
    const role = await tx.role.upsert({
      where: {
        groupId_name: {
          groupId: user.groupId,
          name: `Редактор предмета · ${courseId}`,
        },
      },
      update: {},
      create: {
        groupId: user.groupId,
        name: `Редактор предмета · ${courseId}`,
      },
    });
    await tx.rolePermission.upsert({
      where: {
        roleId_permission: {
          roleId: role.id,
          permission: `manage_course:${courseId}`,
        },
      },
      update: {},
      create: { roleId: role.id, permission: `manage_course:${courseId}` },
    });
    if (enabled)
      await tx.userGroupRole.upsert({
        where: {
          groupMemberId_roleId: { groupMemberId: member.id, roleId: role.id },
        },
        update: {},
        create: { groupMemberId: member.id, roleId: role.id },
      });
    else
      await tx.userGroupRole.deleteMany({
        where: { groupMemberId: member.id, roleId: role.id },
      });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: enabled ? "DELEGATE_COURSE" : "REVOKE_COURSE_DELEGATION",
        entityType: "GROUP_MEMBER",
        entityId: member.id,
        details: { groupId: user.groupId, courseId },
      },
    });
  });
}

export async function addGroupCourse(user: SessionUser, raw: unknown) {
  await requirePermission(user, "manage_courses");
  const input = z
    .object({
      title: text,
      shortTitle: text.optional(),
      semester: text.optional(),
      startDay: z.string().optional(),
      endDay: z.string().optional(),
    })
    .parse(raw);
  const { parseDateOnly } = await import("./deadline-date");
  const start = input.startDay ? parseDateOnly(input.startDay) : null,
    end = input.endDay ? parseDateOnly(input.endDay) : null;
  if (start && end && end < start)
    throw new ForbiddenError("Конец семестра раньше начала");
  return prisma.$transaction(async (tx) => {
    const definition = await tx.courseDefinition.create({
      data: {
        code: `subject-${randomUUID()}`,
        title: input.title,
        shortTitle: input.shortTitle ?? input.title,
      },
    });
    const semester = await tx.semester.create({
      data: {
        name: input.semester ?? "Учебный период не уточнён",
        startDate: start,
        endDate: end,
      },
    });
    const course = await tx.courseOffering.create({
      data: {
        courseDefinitionId: definition.id,
        semesterId: semester.id,
        groups: { create: { groupId: user.groupId } },
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "ADD_GROUP_COURSE",
        entityType: "COURSE",
        entityId: course.id,
        details: { groupId: user.groupId, title: input.title },
      },
    });
    return course.id;
  });
}
