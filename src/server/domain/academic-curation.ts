import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/checker";
import { enqueueGroupCalendars } from "@/server/calendar/queue";

type Tx = Prisma.TransactionClient;
type ComparedTask = Prisma.TaskGetPayload<{
  include: {
    sourceReference: true;
    audiences: true;
    deadlines: { include: { sourceReference: true } };
  };
}>;
async function owner(tx: Tx, user: SessionUser, evidence: string) {
  if (evidence.trim().length < 20 || evidence.length > 4000)
    throw new ForbiddenError("Нужно подтверждение исправления");
  if (
    !(await tx.groupMember.count({
      where: {
        userId: user.id,
        groupId: user.groupId,
        isOwner: true,
        group: {
          enrollments: {
            some: { userId: user.id, status: { in: ["CLAIMED", "VERIFIED"] } },
          },
        },
      },
    }))
  )
    throw new ForbiddenError("Исправление доступно владельцу своей группы");
}

/** Deliberately narrow repair: never move unknown academic content or silently widen delegated roles. */
export async function mergeEmptyCourse(
  user: SessionUser,
  fromId: string,
  toId: string,
  evidence: string,
) {
  if (fromId === toId) throw new ForbiddenError("Нужны разные записи");
  return prisma.$transaction(
    async (tx) => {
      await owner(tx, user, evidence);
      await tx.$queryRaw`SELECT id FROM "CourseOffering" WHERE id IN (${fromId}, ${toId}) ORDER BY id FOR UPDATE`;
      const select = {
        courseDefinition: true,
        groups: true,
        _count: {
          select: {
            tasks: true,
            deadlines: true,
            materials: true,
            sessions: true,
            announcements: true,
            proposals: true,
          },
        },
      };
      const from = await tx.courseOffering.findUniqueOrThrow({
        where: { id: fromId },
        include: select,
      });
      const to = await tx.courseOffering.findUniqueOrThrow({
        where: { id: toId },
        include: select,
      });
      if (
        [from, to].some(
          (c) => c.groups.length !== 1 || c.groups[0].groupId !== user.groupId,
        ) ||
        from.semesterId !== to.semesterId ||
        to.status !== "ACTIVE" ||
        to.mergedIntoId
      )
        throw new ForbiddenError("Разные учебные пространства или периоды");
      if (from.mergedIntoId === to.id && from.status === "ARCHIVED")
        return { changed: false };
      if (
        from.status !== "ACTIVE" ||
        from.mergedIntoId ||
        Object.values(from._count).some(Boolean)
      )
        throw new ForbiddenError(
          "Исходный предмет содержит учебные записи; нужно отдельное сопоставление",
        );
      if (
        await tx.rolePermission.count({
          where: { permission: { endsWith: ":" + fromId } },
        })
      )
        throw new ForbiddenError("Сначала сопоставьте делегированные права");
      if (
        (await tx.courseOffering.count({
          where: { courseDefinitionId: to.courseDefinitionId },
        })) !== 1
      )
        throw new ForbiddenError(
          "Название используется другими учебными пространствами",
        );
      await tx.courseDefinition.update({
        where: { id: to.courseDefinitionId },
        data: { title: from.courseDefinition.title },
      });
      await tx.courseTeacher.updateMany({
        where: { courseOfferingId: fromId },
        data: { courseOfferingId: toId },
      });
      await tx.courseOffering.update({
        where: { id: fromId },
        data: { status: "ARCHIVED", mergedIntoId: toId },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "MERGE_EMPTY_COURSE",
          entityType: "COURSE_OFFERING",
          entityId: fromId,
          details: {
            groupId: user.groupId,
            canonicalId: toId,
            evidence,
            previousTitle: to.courseDefinition.title,
            currentTitle: from.courseDefinition.title,
            recordsDeleted: false,
          },
        },
      });
      await enqueueGroupCalendars(tx, user.groupId);
      return { changed: true };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}

const semantic = (t: ComparedTask) => ({
  course: t.courseOfferingId,
  title: t.title,
  description: t.description,
  type: t.type,
  number: t.number,
  grading: t.gradingMetadata,
  source: t.sourceReference
    ? {
        quote: t.sourceReference.quoteText,
        confidence: t.sourceReference.confidence,
      }
    : null,
  audiences: t.audiences
    .map((a) => [a.targetType, a.groupId, a.subgroupNumber, a.enrollmentId])
    .sort(),
  deadlines: t.deadlines
    .map((d) => [
      d.date.toISOString(),
      d.isTimeStrict,
      d.status,
      d.provenance,
      d.sourceReference?.confidence,
      d.sourceReference?.quoteText,
    ])
    .sort(),
});

/** Record actual teaching roles with explicit headman evidence, independently of course merging. */
export async function confirmTeachingRoles(
  user: SessionUser,
  courseId: string,
  roles: { teacherId: string; role: string }[],
  evidence: string,
) {
  if (
    !roles.length ||
    roles.length > 20 ||
    new Set(roles.map((r) => r.teacherId)).size !== roles.length ||
    roles.some((r) => !r.role.trim() || r.role.length > 160)
  )
    throw new ForbiddenError("Некорректные роли преподавателей");
  return prisma.$transaction(
    async (tx) => {
      await owner(tx, user, evidence);
      await tx.$queryRaw`SELECT id FROM "CourseOffering" WHERE id=${courseId} FOR UPDATE`;
      const course = await tx.courseOffering.findFirstOrThrow({
        where: {
          id: courseId,
          status: "ACTIVE",
          mergedIntoId: null,
          groups: { some: { groupId: user.groupId } },
        },
        include: { groups: true },
      });
      if (course.groups.length !== 1)
        throw new ForbiddenError("Нужен предмет своей группы");
      const entries = await tx.courseTeacher.findMany({
        where: {
          courseOfferingId: courseId,
          teacherId: { in: roles.map((r) => r.teacherId) },
        },
        include: { sourceReference: true },
      });
      if (entries.length !== roles.length)
        throw new ForbiddenError(
          "Состав преподавателей изменился; проверьте записи",
        );
      if (
        entries.every(
          (e) =>
            e.status === "CONFIRMED" &&
            e.role === roles.find((r) => r.teacherId === e.teacherId)!.role &&
            e.sourceReference?.confidence === "CONFIRMED",
        )
      )
        return { changed: false };
      const source = await tx.source.create({
        data: {
          groupId: user.groupId,
          type: "HEADMAN_RECORD",
          title: "Подтверждение распределения преподавателей по видам занятий",
          documentMetadata: { method: "EXPLICIT_HEADMAN_CONFIRMATION" },
        },
      });
      for (const entry of entries) {
        const role = roles.find((r) => r.teacherId === entry.teacherId)!.role;
        const ref = await tx.sourceReference.create({
          data: {
            sourceId: source.id,
            entityType: "COURSE_TEACHER",
            entityId: entry.id,
            quoteText: evidence,
            confidence: "CONFIRMED",
            createdById: user.id,
          },
        });
        await tx.courseTeacher.update({
          where: { id: entry.id },
          data: {
            role,
            status: "CONFIRMED",
            sourceReferenceId: ref.id,
            notes:
              "Роль подтверждена старостой; прежняя отметка конфликта исправлена с сохранением истории.",
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "CONFIRM_TEACHING_ROLE",
            entityType: "COURSE_TEACHER",
            entityId: entry.id,
            details: {
              groupId: user.groupId,
              previousRole: entry.role,
              previousStatus: entry.status,
              previousNotes: entry.notes,
              role,
              sourceReferenceId: ref.id,
            },
          },
        });
      }
      return { changed: true };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}

/** Archive only an exact, unused duplicate. All history and original sources remain in place. */
export async function archiveUnusedDuplicate(
  user: SessionUser,
  fromId: string,
  toId: string,
  evidence: string,
) {
  if (fromId === toId) throw new ForbiddenError("Нужны разные записи");
  return prisma.$transaction(
    async (tx) => {
      await owner(tx, user, evidence);
      await tx.$queryRaw`SELECT id FROM "Task" WHERE id IN (${fromId}, ${toId}) ORDER BY id FOR UPDATE`;
      const include = {
        courseOffering: { include: { groups: true } },
        audiences: true,
        sourceReference: true,
        deadlines: { include: { sourceReference: true } },
        _count: {
          select: {
            progress: true,
            variants: true,
            requirements: true,
            materials: true,
            sessions: true,
            xpEvents: true,
            dependencies: true,
            dependentOn: true,
          },
        },
      };
      const from = await tx.task.findUniqueOrThrow({
        where: { id: fromId },
        include,
      });
      const to = await tx.task.findUniqueOrThrow({
        where: { id: toId },
        include,
      });
      if (
        [from, to].some(
          (t) =>
            t.courseOffering.groups.length !== 1 ||
            t.courseOffering.groups[0].groupId !== user.groupId ||
            t.courseOffering.status !== "ACTIVE",
        ) ||
        to.status !== "PUBLISHED" ||
        to.mergedIntoId
      )
        throw new ForbiddenError("Недоступное учебное пространство");
      if (from.status === "ARCHIVED" && from.mergedIntoId === to.id)
        return { changed: false };
      if (
        from.status !== "PUBLISHED" ||
        from.mergedIntoId ||
        Object.values(from._count).some(Boolean) ||
        (await tx.personalCalendarEvent.count({ where: { taskId: fromId } })) ||
        (await tx.changeProposal.count({ where: { taskId: fromId } }))
      )
        throw new ForbiddenError(
          "У дубликата есть связанные действия; нужно отдельное сопоставление",
        );
      if (JSON.stringify(semantic(from)) !== JSON.stringify(semantic(to)))
        throw new ForbiddenError("Содержание, адресаты или сроки различаются");
      await tx.task.update({
        where: { id: fromId },
        data: { status: "ARCHIVED", mergedIntoId: toId, updatedById: user.id },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "ARCHIVE_UNUSED_DUPLICATE",
          entityType: "TASK",
          entityId: fromId,
          details: {
            groupId: user.groupId,
            canonicalId: toId,
            evidence,
            recordsDeleted: false,
            progressMoved: false,
          },
        },
      });
      await enqueueGroupCalendars(tx, user.groupId);
      return { changed: true };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}
