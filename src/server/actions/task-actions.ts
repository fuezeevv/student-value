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
} from "@prisma/client";

// --- DTO Validation Schemas ---

export const CreateTaskSchema = z.object({
  courseOfferingId: z.string().min(1, "Выберите курс"),
  title: z.string().min(3, "Название задания должно быть не менее 3 символов"),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType),
  number: z.number().int().positive().optional().nullable(),
  deadlineDate: z.string().optional().nullable(), // ISO string from date input
  deadlineType: z.nativeEnum(DeadlineType).default(DeadlineType.HARD),
  isTimeStrict: z.boolean().default(false),
  variantNumber: z.string().optional().nullable(),
  variantTitle: z.string().optional().nullable(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

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

  revalidatePath("/");
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function verifyTaskProgressAction(
  taskId: string,
  targetUserId: string,
  isAccepted: boolean,
  verificationSource = "Подтверждено старостой / преподавателем"
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

  // Record into domain AuditLog
  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "VERIFY_TASK_PROGRESS",
      entityType: "TASK_PROGRESS",
      entityId: updated.id,
      details: {
        taskId,
        targetUserId,
        isAccepted,
        verificationSource,
      },
    },
  });

  revalidatePath("/");
  revalidatePath(`/tasks/${taskId}`);
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
      // Variant if specified
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
        createdById: user!.id,
      },
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
  revalidatePath(`/courses/${validated.courseOfferingId}`);
  return { success: true, taskId: task.id };
}

export async function switchDevUserAction(userId: string) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Смена тестового пользователя доступна только в режиме разработки.");
  }
  await setDevUserCookie(userId);
  revalidatePath("/");
}
