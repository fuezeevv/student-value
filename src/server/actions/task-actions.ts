"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, setDevUserCookie } from "@/lib/auth/session";
import { requirePermission, hasPermission, ForbiddenError } from "@/lib/permissions/checker";
import {
  StudentTaskProgressStatus,
  TaskType,
  DeadlineType,
  TaskAudienceType,
  VerificationSource,
  DeadlineProvenance,
} from "@prisma/client";
import { awardXp, checkAndUnlockAchievement } from "@/server/services/gamification-service";
import {
  createNotification,
  broadcastGroupNotification,
} from "@/server/services/notification-service";
import { CreateTaskSchema, CreateTaskInput } from "@/lib/validations/schemas";

// --- Actions ---

export async function updateStudentProgressAction(
  taskId: string,
  newStatus: StudentTaskProgressStatus,
  studentNotes?: string
) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Необходимо войти в систему");
  }

  // TRUST MODEL ENFORCEMENT (ADR-015):
  // A student CANNOT self-report verified ACCEPTED unless they have verify_progress permission!
  if (newStatus === StudentTaskProgressStatus.ACCEPTED && !hasPermission(user, "verify_progress")) {
    throw new ForbiddenError(
      "Студент не может самостоятельно подтвердить зачет работы преподавателем. Для отметки о сдаче отчета используйте статус 'Сдано (SUBMITTED)'."
    );
  }

  const existing = await prisma.studentTaskProgress.findUnique({
    where: { taskId_userId: { taskId, userId: user.id } },
  });

  const isNowSubmitted = newStatus === StudentTaskProgressStatus.SUBMITTED;
  const isNowAccepted = newStatus === StudentTaskProgressStatus.ACCEPTED;

  await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId, userId: user.id } },
    update: {
      status: newStatus,
      studentNotes: studentNotes !== undefined ? studentNotes : existing?.studentNotes,
      submittedAt: isNowSubmitted ? new Date() : existing?.submittedAt,
      acceptedAt: isNowAccepted ? (existing?.acceptedAt ?? new Date()) : null,
      isVerified: isNowAccepted ? (existing?.isVerified ?? false) : false,
    },
    create: {
      taskId,
      userId: user.id,
      status: newStatus,
      studentNotes: studentNotes ?? null,
      submittedAt: isNowSubmitted ? new Date() : null,
      acceptedAt: isNowAccepted ? new Date() : null,
      isVerified: false,
    },
  });

  // Server-side idempotent XP Ledger reward for submission
  if (isNowSubmitted) {
    await awardXp({
      userId: user.id,
      taskId,
      ruleCode: "TASK_SUBMISSION",
      reason: "Задание отправлено на проверку",
    });
    await checkAndUnlockAchievement(user.id, "FIRST_STEP");
  }

  revalidatePath("/");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/deadlines");
  revalidatePath("/analytics");
  return { success: true };
}

export async function verifyTaskProgressAction(
  taskId: string,
  targetUserId: string,
  isAccepted: boolean,
  verificationSource: VerificationSource = VerificationSource.HEADMAN_CONFIRMED
) {
  const user = await getCurrentUser();
  await requirePermission(user, "verify_progress", "verifyTaskProgressAction");

  const newStatus = isAccepted
    ? StudentTaskProgressStatus.ACCEPTED
    : StudentTaskProgressStatus.NEEDS_FIX;

  const updated = await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId, userId: targetUserId } },
    update: {
      status: newStatus,
      isVerified: isAccepted,
      verifiedById: isAccepted ? user!.id : null,
      verifiedAt: isAccepted ? new Date() : null,
      verificationSource: isAccepted ? verificationSource : null,
      acceptedAt: isAccepted ? new Date() : null,
    },
    create: {
      taskId,
      userId: targetUserId,
      status: newStatus,
      isVerified: isAccepted,
      verifiedById: isAccepted ? user!.id : null,
      verifiedAt: isAccepted ? new Date() : null,
      verificationSource: isAccepted ? verificationSource : null,
      acceptedAt: isAccepted ? new Date() : null,
    },
  });

  // If verified ACCEPTED: award XP
  if (isAccepted) {
    const isTeacher = verificationSource === VerificationSource.TEACHER_CONFIRMED;
    await awardXp({
      userId: targetUserId,
      taskId,
      ruleCode: "TASK_ACCEPTED",
      reason: isTeacher
        ? "Работа зачтена преподавателем"
        : "Выполнение работы подтверждено старостой",
    });

    // Only award ACCEPTED_MASTER achievement if officially confirmed by teacher
    if (isTeacher) {
      await checkAndUnlockAchievement(targetUserId, "ACCEPTED_MASTER");
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true },
    });

    await createNotification({
      userId: targetUserId,
      title: isTeacher ? "Зачет преподавателем подтвержден!" : "Статус подтвержден старостой",
      message: `Работа «${task?.title ?? "Задание"}» отмечена как принятая.`,
      type: "PROGRESS_VERIFIED",
      link: `/tasks/${taskId}`,
    });
  }

  // Record into domain AuditLog
  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "VERIFY_PROGRESS",
      entityType: "TASK_PROGRESS",
      entityId: `${taskId}:${targetUserId}`,
      details: {
        isAccepted,
        newStatus,
        verificationSource,
      },
    },
  });

  revalidatePath("/");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/deadlines");
  revalidatePath("/analytics");
  return { success: true };
}

export async function createTaskAction(rawInput: CreateTaskInput) {
  const user = await getCurrentUser();
  await requirePermission(user, "manage_tasks", "createTaskAction");

  const validated = CreateTaskSchema.parse(rawInput);

  const courseOffering = await prisma.courseOffering.findUnique({
    where: { id: validated.courseOfferingId },
    include: { groups: true },
  });

  if (!courseOffering) {
    throw new Error("Указанный курс не найден");
  }

  const primaryGroup = courseOffering.groups[0];

  // Create Task
  const task = await prisma.task.create({
    data: {
      courseOfferingId: validated.courseOfferingId,
      title: validated.title,
      description: validated.description ?? null,
      type: validated.type,
      number: validated.number ?? null,
      createdById: user!.id,
      updatedById: user!.id,
      audiences: {
        create: {
          targetType: TaskAudienceType.GROUP,
          groupId: primaryGroup?.groupId ?? null,
        },
      },
      ...(validated.variantNumber
        ? {
            variants: {
              create: {
                variantNumber: validated.variantNumber,
                title: validated.variantTitle ?? null,
              },
            },
          }
        : {}),
    },
  });

  // Create Deadline if date is given
  if (validated.deadlineDate) {
    await prisma.deadline.create({
      data: {
        taskId: task.id,
        courseOfferingId: validated.courseOfferingId,
        title: "Срок сдачи",
        type: validated.deadlineType,
        date: new Date(validated.deadlineDate),
        isTimeStrict: validated.isTimeStrict,
        provenance: DeadlineProvenance.HEADMAN_CONFIRMED,
        createdById: user!.id,
      },
    });
  }

  // Broadcast in-app notification if group exists
  if (primaryGroup?.groupId) {
    await broadcastGroupNotification(primaryGroup.groupId, {
      title: "Новое задание добавлено",
      message: `Курс: ${validated.title}`,
      type: "TASK_NEW",
      link: `/tasks/${task.id}`,
    });
  }

  // Record in domain AuditLog
  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "CREATE_TASK",
      entityType: "TASK",
      entityId: task.id,
      details: {
        title: task.title,
        type: task.type,
        courseOfferingId: task.courseOfferingId,
        hasDeadline: Boolean(validated.deadlineDate),
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/deadlines");
  revalidatePath(`/courses/${validated.courseOfferingId}`);
  return { success: true, taskId: task.id };
}

export async function switchDevUserAction(userId: string) {
  const isDevAuth =
    process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_AUTH === "true";
  if (!isDevAuth) {
    throw new Error("Смена тестового пользователя доступна только в режиме разработки.");
  }
  await setDevUserCookie(userId);
  revalidatePath("/");
}
