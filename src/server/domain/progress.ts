import { enqueuePersonalCalendar } from "@/server/calendar/queue";
import { z } from "zod";
import { VerificationSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/checker";
import { requireCoursePermission, requireTaskAudience } from "./access";

const selfStatus = z.enum(["NOT_STARTED", "IN_PROGRESS", "READY", "SUBMITTED"]);
export async function updateOwnProgress(
  user: SessionUser,
  taskId: string,
  status: string,
  notes?: string,
) {
  const newStatus = selfStatus.parse(status); // ACCEPTED is forbidden even for the owner.
  await requireTaskAudience(user, taskId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.studentTaskProgress.findUnique({
      where: { taskId_userId: { taskId, userId: user.id } },
    });
    if (existing?.status === "ACCEPTED")
      throw new ForbiddenError(
        "Подтверждённый результат изменяет проверяющий; заметки можно сохранить отдельно",
      );
    const submittedAt =
      newStatus === "SUBMITTED"
        ? (existing?.submittedAt ?? new Date())
        : existing?.submittedAt;
    const values = {
      status: newStatus,
      ...(notes !== undefined
        ? { studentNotes: z.string().max(10000).parse(notes) }
        : {}),
      submittedAt,
      isVerified: false,
      verifiedById: null,
      verifiedAt: null,
      verificationSource: null,
      verificationSourceReferenceId: null,
      acceptedAt: null,
    };
    await enqueuePersonalCalendar(tx, user.id);
    if (existing) {
      const updated = await tx.studentTaskProgress.updateMany({
        where: {
          id: existing.id,
          updatedAt: existing.updatedAt,
          status: { not: "ACCEPTED" },
        },
        data: values,
      });
      if (updated.count !== 1)
        throw new ForbiddenError(
          "Результат изменился. Обновите страницу перед сменой статуса",
        );
      return tx.studentTaskProgress.findUniqueOrThrow({
        where: { id: existing.id },
      });
    }
    return tx.studentTaskProgress.create({
      data: { taskId, userId: user.id, ...values },
    });
  });
}
export async function saveOwnNotes(
  user: SessionUser,
  taskId: string,
  notes: string,
) {
  await requireTaskAudience(user, taskId);
  const text = z.string().max(10000).parse(notes);
  return prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId, userId: user.id } },
    update: { studentNotes: text },
    create: { taskId, userId: user.id, studentNotes: text },
  });
}
export async function verifyProgress(
  user: SessionUser,
  taskId: string,
  targetUserId: string,
  accept: boolean,
  method: VerificationSource,
  referenceId?: string,
  newEvidence?: {
    title: string;
    quoteText: string;
    type: "TEACHER_STATEMENT" | "OFFICIAL_DOCUMENT";
  },
) {
  accept = z.boolean().parse(accept);
  method = z.nativeEnum(VerificationSource).parse(method);
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  await requireCoursePermission(user, task.courseOfferingId, "verify_progress");
  if (user.id === targetUserId)
    throw new ForbiddenError("Нельзя подтвердить собственную работу");
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: user.groupId, userId: targetUserId } },
    include: { user: true },
  });
  if (!member) throw new ForbiddenError("Студент не принадлежит вашей группе");
  await requireTaskAudience(
    { ...member.user, groupId: user.groupId, isOwner: false, permissions: [] },
    taskId,
  );
  if (
    accept &&
    method !== "HEADMAN_CONFIRMED" &&
    method !== "TEACHER_CONFIRMED"
  )
    throw new ForbiddenError("Недопустимый способ подтверждения");
  // Ownership alone never means the actor is a teacher.
  if (
    accept &&
    method === "TEACHER_CONFIRMED" &&
    !user.permissions.includes(
      `teacher_confirm_progress:${task.courseOfferingId}`,
    )
  )
    throw new ForbiddenError(
      "Прямое подтверждение доступно только преподавателю курса",
    );
  const proof = newEvidence
    ? z
        .object({
          title: z.string().trim().min(3).max(300),
          quoteText: z.string().trim().min(12).max(6000),
          type: z.enum(["TEACHER_STATEMENT", "OFFICIAL_DOCUMENT"]),
        })
        .parse(newEvidence)
    : null;
  const evidence = referenceId
    ? await prisma.sourceReference.findUnique({
        where: { id: referenceId },
        include: { source: true },
      })
    : null;
  if (
    accept &&
    !proof &&
    (!evidence ||
      evidence.confidence !== "CONFIRMED" ||
      !evidence.quoteText?.trim() ||
      evidence.source.groupId !== user.groupId ||
      !["OFFICIAL_DOCUMENT", "TEACHER_STATEMENT"].includes(
        evidence.source.type,
      ) ||
      evidence.entityType !== "TASK_PROGRESS" ||
      evidence.entityId !== `${taskId}:${targetUserId}`)
  )
    throw new ForbiddenError(
      "Нужен подтверждённый источник результата именно этого студента и задания",
    );
  return prisma.$transaction(async (tx) => {
    const before = await tx.studentTaskProgress.findUnique({
      where: { taskId_userId: { taskId, userId: targetUserId } },
      select: {
        id: true,
        taskId: true,
        userId: true,
        status: true,
        isVerified: true,
        verifiedById: true,
        verifiedAt: true,
        verificationSource: true,
        verificationSourceReferenceId: true,
        acceptedAt: true,
        submittedAt: true,
      },
    });
    let evidenceId = referenceId;
    if (accept && proof) {
      const source = await tx.source.create({
        data: { groupId: user.groupId, type: proof.type, title: proof.title },
      });
      const ref = await tx.sourceReference.create({
        data: {
          sourceId: source.id,
          entityType: "TASK_PROGRESS",
          entityId: `${taskId}:${targetUserId}`,
          quoteText: proof.quoteText,
          confidence: "CONFIRMED",
          createdById: user.id,
        },
      });
      evidenceId = ref.id;
    }
    const now = new Date();
    const data = {
      status: accept ? ("ACCEPTED" as const) : ("NEEDS_FIX" as const),
      isVerified: accept,
      verifiedById: accept ? user.id : null,
      verifiedAt: accept ? now : null,
      verificationSource: accept ? method : null,
      verificationSourceReferenceId: accept ? evidenceId : null,
      acceptedAt: accept ? now : null,
    };
    const progress = await tx.studentTaskProgress.upsert({
      where: { taskId_userId: { taskId, userId: targetUserId } },
      update: data,
      create: { taskId, userId: targetUserId, ...data },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "VERIFY_PROGRESS",
        entityType: "TASK_PROGRESS",
        entityId: progress.id,
        details: {
          groupId: user.groupId,
          before: JSON.parse(JSON.stringify(before)),
          after: JSON.parse(JSON.stringify(data)),
        },
      },
    });
    await tx.notification.create({
      data: {
        userId: targetUserId,
        type: "PROGRESS_VERIFIED",
        groupId: user.groupId,
        title: accept
          ? "Подтверждение результата"
          : "Работа требует исправлений",
        message: accept
          ? method === "HEADMAN_CONFIRMED"
            ? `Староста зафиксировал подтверждение преподавателя: ${task.title}`
            : `Преподаватель подтвердил: ${task.title}`
          : task.title,
        link: `/tasks/${taskId}`,
      },
    });
    await enqueuePersonalCalendar(tx, targetUserId);
    return progress;
  });
}
