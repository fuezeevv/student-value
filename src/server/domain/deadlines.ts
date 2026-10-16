import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { requireCoursePermission, audienceMemberIds } from "./access";
import { moveDeadlineDate, effectiveDeadline } from "./deadline-date";

export async function rescheduleDeadline(
  user: SessionUser,
  deadlineId: string,
  newDay: string,
  newType?: "HARD" | "SOFT",
  sourceNote?: string,
) {
  const existing = await prisma.deadline.findUniqueOrThrow({
    where: { id: deadlineId },
    include: { task: true },
  });
  await requireCoursePermission(
    user,
    existing.courseOfferingId,
    "manage_deadlines",
  );
  if (existing.status !== "ACTIVE")
    throw new Error("Срок уже изменён. Обновите страницу");
  const date = moveDeadlineDate(existing, newDay);
  const type = z.enum(["HARD", "SOFT"]).parse(newType ?? existing.type);
  if (
    date.getTime() ===
      effectiveDeadline(existing.date, existing.isTimeStrict).getTime() &&
    type === existing.type
  )
    return existing;
  const note = z
    .string()
    .trim()
    .min(8, "Укажите основание изменения срока")
    .max(4000)
    .parse(sourceNote);
  const recipients = await audienceMemberIds(existing.taskId);
  return prisma.$transaction(async (tx) => {
    const locked = await tx.deadline.updateMany({
      where: {
        id: deadlineId,
        status: "ACTIVE",
        updatedAt: existing.updatedAt,
      },
      data: { status: "SUPERSEDED" },
    });
    if (locked.count !== 1)
      throw new Error("Срок уже изменён. Обновите страницу");
    const id = randomUUID();
    const source = await tx.source.create({
      data: {
        groupId: user.groupId,
        type: "HEADMAN_RECORD",
        title: "Основание переноса срока",
      },
    });
    const reference = await tx.sourceReference.create({
      data: {
        sourceId: source.id,
        entityType: "DEADLINE",
        entityId: id,
        quoteText: note,
        confidence: "CONFIRMED",
        createdById: user.id,
      },
    });
    const deadline = await tx.deadline.create({
      data: {
        id,
        taskId: existing.taskId,
        courseOfferingId: existing.courseOfferingId,
        title: existing.title,
        date,
        type,
        isTimeStrict: existing.isTimeStrict,
        originalDeadlineId: existing.id,
        createdById: user.id,
        provenance: "HEADMAN_CONFIRMED",
        sourceReferenceId: reference.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "RESCHEDULE_DEADLINE",
        entityType: "DEADLINE",
        entityId: id,
        details: {
          groupId: user.groupId,
          originalDeadlineId: existing.id,
          oldDate: existing.date.toISOString(),
          newDate: date.toISOString(),
          sourceReferenceId: reference.id,
        },
      },
    });
    if (recipients.length)
      await tx.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          type: "DEADLINE_CHANGE",
          title: "Изменился срок сдачи",
          message: existing.task.title,
          link: `/tasks/${existing.taskId}`,
        })),
      });
    return deadline;
  });
}
