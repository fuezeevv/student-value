"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser, setDevUserCookie } from "@/lib/auth/session";
import { StudentTaskProgressStatus, VerificationSource } from "@prisma/client";
import { CreateTaskSchema, CreateTaskInput } from "@/lib/validations/schemas";
import { requireCoursePermission } from "@/server/domain/access";
import {
  updateOwnProgress,
  saveOwnNotes,
  verifyProgress,
} from "@/server/domain/progress";
import { parseDateOnly } from "@/server/domain/deadline-date";
import {
  awardXp,
  checkAndUnlockAchievement,
} from "@/server/services/gamification-service";
import { redirect } from "next/navigation";

function refreshTask(taskId: string) {
  for (const path of [
    "/",
    "/deadlines",
    "/analytics",
    `/tasks/${taskId}`,
    "/courses",
  ])
    revalidatePath(path, "layout");
}
export async function updateStudentProgressAction(
  taskId: string,
  newStatus: StudentTaskProgressStatus,
  studentNotes?: string,
) {
  const user = await requireCurrentUser();
  await updateOwnProgress(user, taskId, newStatus, studentNotes);
  if (newStatus === "SUBMITTED") {
    await awardXp({
      userId: user.id,
      taskId,
      ruleCode: "TASK_SUBMISSION",
      reason: "Задание отправлено на проверку",
    });
    await checkAndUnlockAchievement(user.id, "FIRST_STEP");
  }
  refreshTask(taskId);
  return { success: true };
}
export async function saveStudentNotesAction(taskId: string, notes: string) {
  const user = await requireCurrentUser();
  await saveOwnNotes(user, taskId, notes);
  refreshTask(taskId);
  return { success: true };
}
export async function verifyTaskProgressAction(
  taskId: string,
  targetUserId: string,
  isAccepted: boolean,
  verificationSource: VerificationSource = VerificationSource.HEADMAN_CONFIRMED,
  sourceReferenceId?: string,
) {
  const user = await requireCurrentUser();
  await verifyProgress(
    user,
    taskId,
    targetUserId,
    isAccepted,
    verificationSource,
    sourceReferenceId,
  );
  if (isAccepted) {
    await awardXp({
      userId: targetUserId,
      taskId,
      ruleCode: "TASK_ACCEPTED",
      reason: "Результат подтверждён с источником",
    });
    if (verificationSource === "TEACHER_CONFIRMED")
      await checkAndUnlockAchievement(targetUserId, "ACCEPTED_MASTER");
  }
  refreshTask(taskId);
  return { success: true };
}
export async function createTaskAction(rawInput: CreateTaskInput) {
  const user = await requireCurrentUser();
  const input = CreateTaskSchema.parse(rawInput);
  await requireCoursePermission(user, input.courseOfferingId, "manage_tasks");
  if (input.deadlineDate)
    await requireCoursePermission(
      user,
      input.courseOfferingId,
      "manage_deadlines",
    );
  const task = await prisma.$transaction(async (tx) => {
    const source = await tx.source.create({
      data: {
        groupId: user.groupId,
        type: "HEADMAN_RECORD",
        title: "Задание, зафиксированное старостой",
      },
    });
    const task = await tx.task.create({
      data: {
        courseOfferingId: input.courseOfferingId,
        title: input.title,
        description: input.description,
        type: input.type,
        number: input.number,
        createdById: user.id,
        updatedById: user.id,
        audiences: { create: { targetType: "GROUP", groupId: user.groupId } },
        ...(input.variantNumber
          ? {
              variants: {
                create: {
                  variantNumber: input.variantNumber,
                  title: input.variantTitle,
                },
              },
            }
          : {}),
      },
    });
    const ref = await tx.sourceReference.create({
      data: {
        sourceId: source.id,
        entityType: "TASK",
        entityId: task.id,
        quoteText: input.sourceNote,
        confidence: "CONFIRMED",
        createdById: user.id,
      },
    });
    await tx.task.update({
      where: { id: task.id },
      data: { sourceReferenceId: ref.id },
    });
    if (input.deadlineDate) {
      const dl = await tx.deadline.create({
        data: {
          taskId: task.id,
          courseOfferingId: task.courseOfferingId,
          date: parseDateOnly(input.deadlineDate),
          type: input.deadlineType,
          isTimeStrict: false,
          provenance: "HEADMAN_CONFIRMED",
          createdById: user.id,
        },
      });
      const dr = await tx.sourceReference.create({
        data: {
          sourceId: source.id,
          entityType: "DEADLINE",
          entityId: dl.id,
          quoteText: input.sourceNote,
          confidence: "CONFIRMED",
          createdById: user.id,
        },
      });
      await tx.deadline.update({
        where: { id: dl.id },
        data: { sourceReferenceId: dr.id },
      });
    }
    const members = await tx.groupMember.findMany({
      where: { groupId: user.groupId },
      select: { userId: true },
    });
    await tx.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        type: "TASK_NEW",
        title: "Новое задание",
        message: task.title,
        link: `/tasks/${task.id}`,
      })),
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_TASK",
        entityType: "TASK",
        entityId: task.id,
        details: { groupId: user.groupId, sourceReferenceId: ref.id },
      },
    });
    return task;
  });
  refreshTask(task.id);
  return { success: true, taskId: task.id };
}
export async function switchDevUserAction(userId: string) {
  await setDevUserCookie(userId);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function recordTaskVerificationAction(
  taskId: string,
  targetUserId: string,
  source: {
    title: string;
    quoteText: string;
    type: "TEACHER_STATEMENT" | "OFFICIAL_DOCUMENT";
  },
) {
  const user = await requireCurrentUser();
  await verifyProgress(
    user,
    taskId,
    targetUserId,
    true,
    VerificationSource.HEADMAN_CONFIRMED,
    undefined,
    source,
  );
  await awardXp({
    userId: targetUserId,
    taskId,
    ruleCode: "TASK_ACCEPTED",
    reason: "Староста зафиксировал подтверждение преподавателя с источником",
  });
  refreshTask(taskId);
  return { success: true };
}
