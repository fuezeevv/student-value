import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/checker";
import { AdminClient, AdminData } from "./AdminClient";
import { Shield } from "lucide-react";

export default async function AdminPage() {
  const user = await getCurrentUser();

  // Server-side Authorization Check
  if (!user) {
    redirect("/login");
  }

  const isAdmin =
    user.isOwner ||
    user.isSystemAdmin ||
    hasPermission(user, "manage_group") ||
    hasPermission(user, "manage_tasks") ||
    hasPermission(user, "manage_courses");

  if (!isAdmin) {
    return (
      <div className="p-12 text-center space-y-3">
        <h2 className="text-xl font-bold text-rose-400">403 Доступ ограничен</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Панель управления доступна только старосте группы и уполномоченным администраторам.
        </p>
      </div>
    );
  }

  // Load all admin data
  const [suggestions, offerings, announcements, enrollments, auditLogs, users, deadlines] =
    await Promise.all([
      prisma.aiSuggestion.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.courseOffering.findMany({
        where: { semester: { isCurrent: true } },
        include: {
          courseDefinition: true,
          teachers: { include: { teacher: true } },
        },
      }),
      prisma.announcement.findMany({
        orderBy: { publishedAt: "desc" },
        take: 20,
      }),
      prisma.enrollment.findMany({
        where: { group: { code: "5130901/40102" } },
        orderBy: { fullName: "asc" },
        include: { user: true },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        include: { user: true },
        take: 30,
      }),
      prisma.user.findMany({
        select: { id: true, nickname: true },
        orderBy: { nickname: "asc" },
      }),
      prisma.deadline.findMany({
        where: { status: "ACTIVE" },
        include: {
          task: {
            include: {
              courseOffering: { include: { courseDefinition: true } },
            },
          },
        },
        orderBy: { date: "asc" },
      }),
    ]);

  const adminData: AdminData = {
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
      teachers: o.teachers.map((ct) => ({
        id: ct.id,
        teacherId: ct.teacherId,
        fullName: ct.teacher.fullName,
        role: ct.role,
        status: ct.status,
        notes: ct.notes,
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
      userNickname: e.user?.nickname || null,
    })),
    auditLogs: auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details,
      createdAt: l.createdAt.toISOString(),
      userNickname: l.user?.nickname || null,
    })),
    users,
  };

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-cyan-400" />
          Панель управления старосты (Admin Center)
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Управление курсами, модерация предложений AI, объявления и администрирование группы 5130901/40102
        </p>
      </div>

      <AdminClient data={adminData} />
    </div>
  );
}
