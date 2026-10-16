"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/permissions/checker";
import { TeacherCourseStatus, EnrollmentStatus } from "@prisma/client";
import { broadcastGroupNotification } from "@/server/services/notification-service";
import { CreateAnnouncementSchema, CreateAnnouncementInput } from "@/lib/validations/schemas";

// Review AI Suggestion
export async function reviewSuggestionAction(
  suggestionId: string,
  status: "APPROVED" | "REJECTED" | "EDITED",
  reviewNotes?: string
) {
  const user = await getCurrentUser();
  await requirePermission(user, "manage_tasks", "reviewSuggestionAction");

  const suggestion = await prisma.aiSuggestion.update({
    where: { id: suggestionId },
    data: {
      status,
      reviewNotes: reviewNotes || null,
      reviewedById: user!.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "REVIEW_AI_SUGGESTION",
      entityType: "AI_SUGGESTION",
      entityId: suggestionId,
      details: { status, reviewNotes },
    },
  });

  revalidatePath("/admin");
  return { success: true, suggestion };
}

// Create Announcement
export async function createAnnouncementAction(
  rawInput: CreateAnnouncementInput
) {
  const user = await getCurrentUser();
  await requirePermission(user, "manage_announcements", "createAnnouncementAction");

  const validated = CreateAnnouncementSchema.parse(rawInput);

  const announcement = await prisma.announcement.create({
    data: {
      groupId: user!.groupId,
      courseOfferingId: validated.courseOfferingId || null,
      title: validated.title,
      content: validated.content,
      isPinned: validated.isPinned,
      priority: validated.priority,
      authorId: user!.id,
    },
  });

  // Broadcast in-app notification to all group members
  await broadcastGroupNotification(user!.groupId, {
    title: `Объявление: ${validated.title}`,
    message: validated.content.slice(0, 100),
    type: "ANNOUNCEMENT",
    link: validated.courseOfferingId ? `/courses/${validated.courseOfferingId}` : "/",
  });

  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "CREATE_ANNOUNCEMENT",
      entityType: "ANNOUNCEMENT",
      entityId: announcement.id,
      details: { title: announcement.title, priority: announcement.priority },
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true, announcementId: announcement.id };
}

// Update Teacher Info / Conflict status
export async function updateTeacherCourseAction(
  courseOfferingId: string,
  teacherId: string,
  role?: string,
  status: TeacherCourseStatus = TeacherCourseStatus.CONFIRMED,
  notes?: string
) {
  const user = await getCurrentUser();
  await requirePermission(user, "manage_courses", "updateTeacherCourseAction");

  await prisma.courseTeacher.upsert({
    where: { id: `ct-${courseOfferingId}-${teacherId}` },
    update: {
      role: role || null,
      status,
      notes: notes || null,
    },
    create: {
      id: `ct-${courseOfferingId}-${teacherId}`,
      courseOfferingId,
      teacherId,
      role: role || null,
      status,
      notes: notes || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "UPDATE_TEACHER_COURSE",
      entityType: "COURSE_TEACHER",
      entityId: `ct-${courseOfferingId}-${teacherId}`,
      details: { courseOfferingId, teacherId, status, notes },
    },
  });

  revalidatePath(`/courses/${courseOfferingId}`);
  revalidatePath("/admin");
  return { success: true };
}

// Link Enrollment to User (Administrative verification)
export async function linkEnrollmentAction(enrollmentId: string, targetUserId: string) {
  const user = await getCurrentUser();
  await requirePermission(user, "manage_members", "linkEnrollmentAction");

  const updated = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      userId: targetUserId,
      status: EnrollmentStatus.VERIFIED,
      verifiedById: user!.id,
      verifiedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "LINK_ENROLLMENT_USER",
      entityType: "ENROLLMENT",
      entityId: enrollmentId,
      details: { targetUserId, fullName: updated.fullName },
    },
  });

  revalidatePath("/members");
  revalidatePath("/admin");
  return { success: true };
}

// Update Deadline Date / Type / Provenance
export async function updateDeadlineAction(
  deadlineId: string,
  newDate: string,
  newType?: "HARD" | "SOFT"
) {
  const user = await getCurrentUser();
  await requirePermission(user, "manage_tasks", "updateDeadlineAction");

  const existing = await prisma.deadline.findUnique({
    where: { id: deadlineId },
    include: { task: true },
  });

  if (!existing) {
    throw new Error("Дедлайн не найден");
  }

  const updated = await prisma.deadline.update({
    where: { id: deadlineId },
    data: {
      date: new Date(newDate),
      ...(newType ? { type: newType } : {}),
      provenance: "HEADMAN_CONFIRMED",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user!.id,
      action: "UPDATE_DEADLINE",
      entityType: "DEADLINE",
      entityId: deadlineId,
      details: {
        taskTitle: existing.task.title,
        oldDate: existing.date.toISOString(),
        newDate: updated.date.toISOString(),
        type: updated.type,
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/deadlines");
  revalidatePath("/calendar");
  revalidatePath("/admin");
  return { success: true, deadline: updated };
}

