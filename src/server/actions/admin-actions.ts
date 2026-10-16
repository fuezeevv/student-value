"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { requirePermission, ForbiddenError } from "@/lib/permissions/checker";
import { TeacherCourseStatus } from "@prisma/client";
import { requireCoursePermission } from "@/server/domain/access";
import { rescheduleDeadline } from "@/server/domain/deadlines";
import {
  CreateAnnouncementSchema,
  CreateAnnouncementInput,
} from "@/lib/validations/schemas";

export async function reviewSuggestionAction(
  suggestionId: string,
  status: "APPROVED" | "REJECTED" | "EDITED",
  reviewNotes?: string,
) {
  const user = await requireCurrentUser();
  await requirePermission(user, "manage_tasks");
  const proposal = await prisma.aiSuggestion.findUnique({
    where: { id: suggestionId },
    include: { source: true },
  });
  if (!proposal?.source || proposal.source.groupId !== user.groupId)
    throw new ForbiddenError("Источник предложения недоступен в этой группе");
  const checked = z.enum(["APPROVED", "REJECTED", "EDITED"]).parse(status);
  await prisma.$transaction(async (tx) => {
    await tx.aiSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: checked,
        reviewNotes,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "REVIEW_AI_SUGGESTION",
        entityType: "AI_SUGGESTION",
        entityId: suggestionId,
        details: { groupId: user.groupId, status: checked, published: false },
      },
    });
  });
  revalidatePath("/admin");
  return { success: true };
}
export async function createAnnouncementAction(
  rawInput: CreateAnnouncementInput,
) {
  const user = await requireCurrentUser();
  await requirePermission(user, "manage_announcements");
  const input = CreateAnnouncementSchema.parse(rawInput);
  if (input.courseOfferingId)
    await requireCoursePermission(
      user,
      input.courseOfferingId,
      "manage_announcements",
    );
  const announcement = await prisma.$transaction(async (tx) => {
    const a = await tx.announcement.create({
      data: {
        groupId: user.groupId,
        courseOfferingId: input.courseOfferingId,
        title: input.title,
        content: input.content,
        isPinned: input.isPinned,
        priority: input.priority,
        authorId: user.id,
      },
    });
    const members = await tx.groupMember.findMany({
      where: { groupId: user.groupId },
      select: { userId: true },
    });
    await tx.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        title: input.title,
        message: input.content.slice(0, 100),
        type: "ANNOUNCEMENT",
        link: input.courseOfferingId
          ? `/courses/${input.courseOfferingId}`
          : "/",
      })),
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_ANNOUNCEMENT",
        entityType: "ANNOUNCEMENT",
        entityId: a.id,
        details: { groupId: user.groupId, title: a.title },
      },
    });
    return a;
  });
  revalidatePath("/", "layout");
  return { success: true, announcementId: announcement.id };
}
export async function updateTeacherCourseAction(
  courseOfferingId: string,
  teacherId: string,
  role?: string,
  status: TeacherCourseStatus = "CANDIDATE_UNVERIFIED",
  notes?: string,
  sourceReferenceId?: string,
) {
  const user = await requireCurrentUser();
  await requireCoursePermission(user, courseOfferingId, "manage_courses");
  const checked = z.nativeEnum(TeacherCourseStatus).parse(status);
  const source = sourceReferenceId
    ? await prisma.sourceReference.findUnique({
        where: { id: sourceReferenceId },
        include: { source: true },
      })
    : null;
  if (
    checked === "CONFIRMED" &&
    (!source ||
      source.confidence !== "CONFIRMED" ||
      source.source.groupId !== user.groupId ||
      source.entityType !== "COURSE_TEACHER" ||
      source.entityId !== `ct-${courseOfferingId}-${teacherId}`)
  )
    throw new ForbiddenError("Для подтверждения преподавателя нужен источник");
  await prisma.$transaction(async (tx) => {
    await tx.courseTeacher.upsert({
      where: { id: `ct-${courseOfferingId}-${teacherId}` },
      update: {
        role,
        status: checked,
        notes,
        sourceReferenceId: source?.id ?? null,
      },
      create: {
        id: `ct-${courseOfferingId}-${teacherId}`,
        courseOfferingId,
        teacherId,
        role,
        status: checked,
        notes,
        sourceReferenceId: source?.id ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_TEACHER_COURSE",
        entityType: "COURSE_TEACHER",
        entityId: `ct-${courseOfferingId}-${teacherId}`,
        details: { groupId: user.groupId, status: checked },
      },
    });
  });
  revalidatePath("/", "layout");
  return { success: true };
}
export async function linkEnrollmentAction(
  enrollmentId: string,
  targetUserId: string,
) {
  const user = await requireCurrentUser();
  await requirePermission(user, "manage_members");
  await requirePermission(user, "view_private_member_identity");
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, groupId: user.groupId },
  });
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: user.groupId, userId: targetUserId } },
  });
  if (!enrollment || !member)
    throw new ForbiddenError("Запись или участник недоступны в этой группе");
  await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: {
        userId: targetUserId,
        status: "VERIFIED",
        verifiedById: user.id,
        verifiedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "LINK_ENROLLMENT_USER",
        entityType: "ENROLLMENT",
        entityId: enrollmentId,
        details: { groupId: user.groupId, targetUserId },
      },
    });
  });
  revalidatePath("/admin");
  revalidatePath("/members");
  return { success: true };
}
export async function updateDeadlineAction(
  deadlineId: string,
  newDate: string,
  newType?: "HARD" | "SOFT",
  sourceNote?: string,
) {
  const user = await requireCurrentUser();
  const deadline = await rescheduleDeadline(
    user,
    deadlineId,
    newDate,
    newType,
    sourceNote,
  );
  revalidatePath("/", "layout");
  return { success: true, deadline };
}
