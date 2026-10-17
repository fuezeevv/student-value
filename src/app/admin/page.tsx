import React from "react";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/checker";
import { AdminClient, AdminData } from "./AdminClient";
import { taskVisibilityWhere } from "@/server/domain/access";
import { Shield } from "lucide-react";

export default async function AdminPage() {
  const user = await requireCurrentUser();
  const allowed = (permission: string) =>
    hasPermission(user, permission, user.groupId);
  if (
    ![
      "manage_group",
      "manage_tasks",
      "manage_courses",
      "manage_deadlines",
      "manage_members",
      "manage_announcements",
    ].some(allowed)
  )
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl text-rose-400">403 Доступ ограничен</h2>
        <p>Панель доступна уполномоченным редакторам группы.</p>
      </div>
    );
  const privateAccess = allowed("view_private_member_identity");
  const [
    suggestions,
    offerings,
    announcements,
    enrollments,
    auditLogs,
    users,
    deadlines,
  ] = await Promise.all([
    allowed("manage_tasks")
      ? prisma.aiSuggestion.findMany({
          where: { source: { groupId: user.groupId } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : [],
    prisma.courseOffering.findMany({
      where: {
        groups: { some: { groupId: user.groupId } },
        semester: { isCurrent: true },
      },
      include: {
        courseDefinition: true,
        teachers: { include: { teacher: true } },
      },
    }),
    allowed("manage_announcements")
      ? prisma.announcement.findMany({
          where: { groupId: user.groupId, status: "PUBLISHED" },
          orderBy: { publishedAt: "desc" },
          take: 20,
        })
      : [],
    privateAccess
      ? prisma.enrollment.findMany({
          where: { groupId: user.groupId },
          orderBy: { fullName: "asc" },
          include: { user: { select: { nickname: true } } },
        })
      : [],
    allowed("manage_group") && privateAccess
      ? prisma.auditLog.findMany({
          where: { details: { path: ["groupId"], equals: user.groupId } },
          include: { user: { select: { nickname: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : [],
    privateAccess && allowed("manage_members")
      ? prisma.user.findMany({
          where: { memberships: { some: { groupId: user.groupId } } },
          select: { id: true, nickname: true },
          orderBy: { nickname: "asc" },
        })
      : [],
    allowed("manage_deadlines")
      ? prisma.deadline.findMany({
          where: {
            status: "ACTIVE",
            task: await taskVisibilityWhere(user),
          },
          include: {
            task: {
              include: {
                courseOffering: { include: { courseDefinition: true } },
              },
            },
          },
          orderBy: { date: "asc" },
        })
      : [],
  ]);
  const data: AdminData = {
    deadlines: deadlines.map((d) => ({
      id: d.id,
      taskId: d.taskId,
      taskTitle: d.task.title,
      courseShortTitle: d.task.courseOffering.courseDefinition.shortTitle,
      date: d.date.toISOString(),
      type: d.type,
      provenance: d.provenance,
    })),
    suggestions: suggestions.map((s) => ({
      id: s.id,
      entityType: s.entityType,
      title: s.title,
      confidence: s.confidence,
      suggestedData: s.suggestedData,
      status: s.status,
      reviewNotes: s.reviewNotes,
      createdAt: s.createdAt.toISOString(),
    })),
    courses: offerings.map((o) => ({
      id: o.id,
      code: o.courseDefinition.code,
      title: o.courseDefinition.title,
      shortTitle: o.courseDefinition.shortTitle,
      format: o.format,
      softwareRequired: o.softwareRequired,
      teachers: o.teachers.map((t) => ({
        id: t.id,
        teacherId: t.teacherId,
        fullName: t.teacher.fullName,
        role: t.role,
        status: t.status,
        notes: t.notes,
      })),
    })),
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      isPinned: a.isPinned,
      priority: a.priority,
      publishedAt: a.publishedAt.toISOString(),
    })),
    enrollments: enrollments.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      subgroup: e.subgroup,
      studentIdNumber: e.studentIdNumber,
      status: e.status,
      userId: e.userId,
      userNickname: e.user?.nickname ?? null,
    })),
    auditLogs: auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details,
      createdAt: l.createdAt.toISOString(),
      userNickname: l.user?.nickname ?? null,
    })),
    users,
  };
  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-cyan-400" />
          Панель старосты
        </h1>
      </div>
      <AdminClient data={data} />
    </div>
  );
}
