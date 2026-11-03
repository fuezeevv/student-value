import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/checker";
import {
  requireCoursePermission,
  requireTaskAudience,
  taskVisibilityWhere,
} from "./access";
import { enqueueGroupCalendars } from "@/server/calendar/queue";

/** Reversible removal; provider events are reconciled from current visible work. */
export async function setDeadlineCancelled(
  user: SessionUser,
  id: string,
  cancelled: boolean,
  reason: string,
) {
  cancelled = z.boolean().parse(cancelled);
  const note = z.string().trim().min(5).max(2000).parse(reason);
  const before = await prisma.deadline.findUniqueOrThrow({ where: { id } });
  await requireCoursePermission(
    user,
    before.courseOfferingId,
    "manage_deadlines",
  );
  await requireTaskAudience(user, before.taskId);
  const target = cancelled ? "CANCELLED" : "ACTIVE";
  if (before.status === target) return;
  if (before.status !== (cancelled ? "ACTIVE" : "CANCELLED"))
    throw new ForbiddenError("Этот срок уже заменён другим");
  await prisma.$transaction(
    async (tx) => {
      // Serialize lifecycle changes for a task, including restore/cancel races.
      await tx.$queryRaw`SELECT id FROM "Task" WHERE id = ${before.taskId} FOR UPDATE`;
      if (
        !cancelled &&
        (await tx.deadline.count({
          where: { taskId: before.taskId, status: "ACTIVE" },
        }))
      )
        throw new ForbiddenError(
          "У работы уже есть действующий срок. Сначала проверьте его",
        );
      const changed = await tx.deadline.updateMany({
        where: { id, status: before.status, updatedAt: before.updatedAt },
        data: { status: target },
      });
      if (changed.count !== 1)
        throw new ForbiddenError("Срок изменился. Обновите страницу");
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: cancelled ? "CANCEL_DEADLINE" : "RESTORE_DEADLINE",
          entityType: "DEADLINE",
          entityId: id,
          details: {
            groupId: user.groupId,
            reason: note,
            beforeStatus: before.status,
            afterStatus: target,
          },
        },
      });
      await enqueueGroupCalendars(tx, user.groupId);
    },
    { timeout: 20000 },
  );
}

export async function setTaskArchived(
  user: SessionUser,
  id: string,
  archived: boolean,
  reason: string,
) {
  archived = z.boolean().parse(archived);
  const note = z.string().trim().min(5).max(2000).parse(reason);
  const visibility = await taskVisibilityWhere(user);
  const before = await prisma.task.findFirst({
    where: {
      ...visibility,
      status: { in: ["PUBLISHED", "ARCHIVED"] },
      id,
      mergedIntoId: null,
    },
  });
  if (!before) throw new ForbiddenError("Работа недоступна");
  await requireCoursePermission(user, before.courseOfferingId, "manage_tasks");
  const target = archived ? "ARCHIVED" : "PUBLISHED";
  if (before.status === target) return;
  await prisma.$transaction(
    async (tx) => {
      const changed = await tx.task.updateMany({
        where: { id, status: before.status, updatedAt: before.updatedAt },
        data: { status: target, updatedById: user.id },
      });
      if (changed.count !== 1)
        throw new ForbiddenError("Работа изменилась. Обновите страницу");
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: archived ? "ARCHIVE_TASK" : "RESTORE_TASK",
          entityType: "TASK",
          entityId: id,
          details: {
            groupId: user.groupId,
            reason: note,
            beforeStatus: before.status,
            afterStatus: target,
          },
        },
      });
      await enqueueGroupCalendars(tx, user.groupId);
    },
    { timeout: 20000 },
  );
}
