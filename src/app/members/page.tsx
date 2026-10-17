import React from "react";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/checker";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Users, Shield, User, CheckCircle2, Clock, Lock } from "lucide-react";

export default async function MembersPage() {
  const user = await requireCurrentUser();
  const canViewPrivateIdentity = user
    ? hasPermission(user, "view_private_member_identity")
    : false;

  const group = await prisma.studyGroup.findFirst({
    where: { id: user.groupId },
    include: {
      members: {
        include: {
          user: {
            include: {
              gamificationProfile: true,
            },
          },
          userRoles: { include: { role: { include: { permissions: true } } } },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  const courses = await prisma.courseOffering.findMany({
    where: { groups: { some: { groupId: user.groupId } } },
    include: { courseDefinition: true },
  });
  const enrollments = canViewPrivateIdentity
    ? await prisma.enrollment.findMany({
        where: { groupId: user.groupId },
        orderBy: { fullName: "asc" },
        include: { user: { select: { nickname: true } } },
      })
    : [];

  if (!group) {
    return (
      <div className="p-6 text-center text-slate-400">Группа не найдена.</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-cyan-400" />
              Состав учебной группы
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {group.name} · {group.department}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              Всего по списку: {group._count.enrollments} студентов
            </Badge>
            <Badge variant="default" className="text-xs">
              Зарегистрировано: {group.members.length} польз.
            </Badge>
          </div>
        </div>
      </div>

      {/* ADMIN VIEW: OFFICIAL ENROLLMENT ROSTER (Only if permitted) */}
      {canViewPrivateIdentity ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Список группы · доступ старосты
            </h2>
            <span className="text-xs text-cyan-400 font-mono">
              Личные данные участников
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">№</th>
                  <th className="py-3 px-4">ФИО студента</th>
                  <th className="py-3 px-4">Подгруппа</th>
                  <th className="py-3 px-4">Номер в ведомости</th>
                  <th className="py-3 px-4">Статус аккаунта</th>
                  <th className="py-3 px-4">Привязанный профиль</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {enrollments.map((enr, idx) => (
                  <tr
                    key={enr.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      {enr.fullName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px]">
                        Подгруппа {enr.subgroup ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {enr.studentIdNumber || "—"}
                    </td>
                    <td className="py-3 px-4">
                      {enr.status === "VERIFIED" ? (
                        <Badge variant="success" className="text-[10px]">
                          Подтвержден
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="text-[10px]">
                          Ожидает заявки
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {enr.user ? (
                        <span className="text-cyan-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />@
                          {enr.user.nickname}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center gap-3 text-xs text-slate-400">
          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            Поименный список студентов защищен политикой приватности и доступен
            только старосте и администраторам группы.
          </span>
        </div>
      )}

      {/* PUBLIC DIRECTORY: REGISTERED ACTIVE MEMBERS */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-400" />
          Зарегистрированные участники пространства
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {group.members.map((member) => {
            const roleNames = member.userRoles
              .map((ur) => {
                const scoped = ur.role.permissions.find((p) =>
                  p.permission.startsWith("manage_course:"),
                );
                if (scoped)
                  return `Редактор: ${courses.find((c) => `manage_course:${c.id}` === scoped.permission)?.courseDefinition.shortTitle ?? "предмет"}`;
                return (
                  (
                    { Owner: "Староста", Student: "Студент" } as Record<
                      string,
                      string
                    >
                  )[ur.role.name] ?? ur.role.name
                );
              })
              .join(", ");
            const isOwner = member.isOwner;

            return (
              <div
                key={member.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-cyan-500/30 transition-all flex items-start gap-3.5"
              >
                <img
                  src={
                    member.user.avatarUrl ||
                    "https://api.dicebear.com/7.x/bottts/svg?seed=user"
                  }
                  alt={member.user.nickname}
                  className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 shrink-0"
                />

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white truncate">
                      {member.user.nickname}
                    </span>
                    {isOwner && (
                      <Badge
                        variant="default"
                        className="text-[9px] px-1.5 py-0 font-bold"
                      >
                        Староста
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {member.user.bio || "Участник группы"}
                  </div>
                  <div className="text-[11px] text-cyan-400/90 font-mono pt-1">
                    Роли: {roleNames || (isOwner ? "Староста" : "Студент")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
