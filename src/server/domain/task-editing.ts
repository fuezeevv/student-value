import { enqueueGroupCalendars } from "@/server/calendar/queue";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/checker";
import {
  requireTaskAudience,
  requireCoursePermission,
  audienceMemberIds,
} from "./access";

export async function editTask(user: SessionUser, id: string, raw: unknown) {
  const input = z
    .object({
      title: z.string().trim().min(3).max(240),
      description: z.string().trim().max(20000),
      sourceNote: z.string().trim().min(8).max(4000),
      updatedAt: z.string().datetime(),
    })
    .parse(raw);
  const previous = await requireTaskAudience(user, id);
  await requireCoursePermission(
    user,
    previous.courseOfferingId,
    "manage_tasks",
  );
  if (previous.updatedAt.toISOString() !== input.updatedAt)
    throw new ForbiddenError("Работа уже изменилась. Обновите страницу");
  if (
    previous.title === input.title &&
    (previous.description ?? "") === input.description
  )
    return;
  const recipients = await audienceMemberIds(id);
  await prisma.$transaction(async (tx) => {
    const changed = await tx.task.updateMany({
      where: { id, updatedAt: previous.updatedAt },
      data: {
        title: input.title,
        description: input.description,
        updatedById: user.id,
      },
    });
    if (changed.count !== 1)
      throw new ForbiddenError("Работа уже изменилась. Обновите страницу");
    const source = await tx.source.create({
      data: {
        groupId: user.groupId,
        type: "HEADMAN_RECORD",
        title: "Уточнение задания редактором группы",
      },
    });
    const reference = await tx.sourceReference.create({
      data: {
        sourceId: source.id,
        entityType: "TASK",
        entityId: id,
        quoteText: input.sourceNote,
        confidence: "CONFIRMED",
        createdById: user.id,
      },
    });
    await tx.task.update({
      where: { id },
      data: { sourceReferenceId: reference.id },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "EDIT_TASK_CONTENT",
        entityType: "TASK",
        entityId: id,
        details: {
          groupId: user.groupId,
          courseId: previous.courseOfferingId,
          before: {
            title: previous.title,
            description: previous.description,
            sourceReferenceId: previous.sourceReferenceId,
          },
          after: {
            title: input.title,
            description: input.description,
            sourceReferenceId: reference.id,
          },
          sourceNote: input.sourceNote,
        },
      },
    });
    await enqueueGroupCalendars(tx, user.groupId);
    if (recipients.length)
      await tx.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          groupId: user.groupId,
          type: "COURSE_UPDATE",
          title: "Уточнено задание",
          message: input.title,
          link: `/tasks/${id}`,
        })),
      });
  });
}
