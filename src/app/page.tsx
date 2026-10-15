import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { calculateDeadlineStatus } from "@/server/services/deadline-service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CreateTaskModal } from "@/components/task/CreateTaskModal";
import {
  Clock,
  AlertTriangle,
  ArrowRight,
  Megaphone,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Load group courses
  const offerings = await prisma.courseOffering.findMany({
    where: {
      semester: { isCurrent: true },
      groups: { some: { group: { code: "5130901/40102" } } },
    },
    include: {
      courseDefinition: true,
      tasks: {
        include: {
          deadlines: {
            where: { status: "ACTIVE" },
            orderBy: { date: "asc" },
          },
          progress: user ? { where: { userId: user.id } } : false,
          variants: true,
        },
      },
      announcements: {
        orderBy: { publishedAt: "desc" },
        take: 3,
      },
    },
  });

  // Flat tasks array with user progress and deadline calculation
  const allTasks = offerings.flatMap((o) =>
    o.tasks.map((t) => {
      const userProgress = t.progress?.[0];
      const isAccepted = userProgress?.status === "ACCEPTED";
      const primaryDeadline = t.deadlines[0];
      const deadlineCalc = calculateDeadlineStatus(
        primaryDeadline ? primaryDeadline.date : null,
        new Date(),
        isAccepted
      );

      return {
        ...t,
        courseCode: o.courseDefinition.code,
        courseTitle: o.courseDefinition.title,
        courseShortTitle: o.courseDefinition.shortTitle,
        userProgress,
        primaryDeadline,
        deadlineCalc,
        isAccepted,
      };
    })
  );

  // Focus tasks: Overdue first, then DUE_TODAY, DUE_TOMORROW, DUE_URGENT
  const urgentTasks = allTasks
    .filter((t) => !t.isAccepted && t.deadlineCalc.urgency !== "NO_DEADLINE")
    .sort((a, b) => {
      const order = { OVERDUE: 0, DUE_TODAY: 1, DUE_TOMORROW: 2, DUE_URGENT: 3, UPCOMING: 4, ACCEPTED: 5, NO_DEADLINE: 6 };
      return order[a.deadlineCalc.urgency] - order[b.deadlineCalc.urgency];
    });

  const focusTask = urgentTasks[0] || allTasks.find((t) => !t.isAccepted);

  // Active tasks (in progress or ready)
  const activeTasks = allTasks.filter(
    (t) =>
      t.userProgress?.status === "IN_PROGRESS" ||
      t.userProgress?.status === "READY" ||
      t.userProgress?.status === "SUBMITTED" ||
      t.userProgress?.status === "NEEDS_FIX"
  );

  // Progress metrics
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.isAccepted).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Group announcements
  const announcements = await prisma.announcement.findMany({
    where: { group: { code: "5130901/40102" } },
    include: { author: true },
    orderBy: { publishedAt: "desc" },
    take: 4,
  });

  const canManageTasks = user?.permissions.includes("manage_tasks") ?? false;

  const coursesListForModal = offerings.map((o) => ({
    id: o.id,
    title: o.courseDefinition.title,
    shortTitle: o.courseDefinition.shortTitle,
  }));

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            Рабочий стол семестра
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Осенний семестр 2026 • Учебная группа 5130901/40102
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canManageTasks && (
            <CreateTaskModal courses={coursesListForModal} />
          )}
        </div>
      </div>

      {/* FOCUS ZONE: "What should I do now?" */}
      {focusTask ? (
        <Card className="border-sky-500/40 bg-gradient-to-r from-sky-950/30 via-slate-900 to-slate-900/80 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500" />
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-xs uppercase tracking-wider font-bold text-sky-400">
                  Фокус: Что делать прямо сейчас
                </span>
              </div>
              <Badge variant={focusTask.deadlineCalc.badgeVariant}>
                {focusTask.deadlineCalc.badgeLabel}
              </Badge>
            </div>
            <CardTitle className="text-lg sm:text-xl text-white mt-1">
              [{focusTask.courseShortTitle}] {focusTask.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {focusTask.description && (
              <p className="text-sm text-slate-300 line-clamp-2">
                {focusTask.description}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Дедлайн: {focusTask.deadlineCalc.formattedDate}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Статус: {focusTask.userProgress ? focusTask.userProgress.status : "NOT_STARTED"}
                  </span>
                </div>
              </div>

              <Link href={`/tasks/${focusTask.id}`}>
                <Button size="sm" variant="primary" className="gap-1.5">
                  <span>Перейти к заданию</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-800 bg-slate-900/60 p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-slate-100">
            Все текущие задачи закрыты!
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            На данный момент срочных или требующих сдачи заданий нет.
          </p>
        </Card>
      )}

      {/* SEMESTER PROGRESSION BAR */}
      <Card className="border-slate-800 bg-slate-900/80">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <span className="font-semibold text-sm text-slate-200">
                Прогресс семестра
              </span>
              <span className="text-xs text-slate-400">
                • Закрыто {completedTasks} из {totalTasks} заданий
              </span>
            </div>
            <div className="text-sm font-bold text-sky-400">
              {progressPercent}%
            </div>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-sky-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* TWO-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Deadlines & Active Tasks (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Urgent / Overdue Deadlines List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Ближайшие дедлайны
              </h2>
              <span className="text-xs text-slate-400">
                {urgentTasks.length} {urgentTasks.length === 1 ? "задача" : "задач"}
              </span>
            </div>

            {urgentTasks.length > 0 ? (
              <div className="space-y-2">
                {urgentTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block group"
                  >
                    <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 hover:border-slate-700 transition-all flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                            {task.courseShortTitle}
                          </Badge>
                          <span className="font-medium text-sm text-slate-200 group-hover:text-sky-400 transition-colors truncate">
                            {task.title}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-3">
                          <span>Срок: {task.deadlineCalc.formattedDate}</span>
                          <span>•</span>
                          <span>{task.primaryDeadline?.type === "HARD" ? "Жесткий" : "Рекомендуемый"}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Badge variant={task.deadlineCalc.badgeVariant}>
                          {task.deadlineCalc.badgeLabel}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-slate-800/80 bg-slate-900/40 text-center text-xs text-slate-400">
                На ближайшее время дедлайнов нет.
              </div>
            )}
          </div>

          {/* Active Tasks in Progress */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              Задачи в активной работе ({activeTasks.length})
            </h2>

            {activeTasks.length > 0 ? (
              <div className="space-y-2">
                {activeTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block group"
                  >
                    <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 hover:border-slate-700 transition-all flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                            {task.courseShortTitle}
                          </Badge>
                          <span className="font-medium text-sm text-slate-200 group-hover:text-sky-400 transition-colors truncate">
                            {task.title}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {task.userProgress?.status === "SUBMITTED"
                            ? "Сдано на проверку"
                            : task.userProgress?.status === "READY"
                            ? "Сделано, готово к сдаче"
                            : "В процессе выполнения"}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <Badge variant={task.userProgress?.status === "SUBMITTED" ? "info" : "default"}>
                          {task.userProgress?.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-slate-800/80 bg-slate-900/40 text-center text-xs text-slate-400">
                Нет задач со статусом «В работе». Выберите задание из списка курсов.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Announcements & Quick Access (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Announcements Stream */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-sky-400" />
              Объявления и изменения
            </h2>

            {announcements.length > 0 ? (
              <div className="space-y-2.5">
                {announcements.map((ann) => (
                  <Card key={ann.id} className="border-slate-800 bg-slate-900/60 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-200">
                        {ann.title}
                      </span>
                      {ann.isPinned && (
                        <Badge variant="warning" className="text-[10px]">
                          Закреплено
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {ann.content}
                    </p>
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                      <span>Автор: {ann.author.nickname}</span>
                      <span>{new Date(ann.publishedAt).toLocaleDateString("ru-RU")}</span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-slate-800/80 bg-slate-900/40 text-center text-xs text-slate-400">
                Новых объявлений нет.
              </div>
            )}
          </div>

          {/* Quick Study Resources */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              Быстрые ресурсы группы
            </h2>
            <div className="space-y-2">
              <Link
                href="/courses"
                className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-800/50 flex items-center justify-between text-xs text-slate-300 hover:text-white transition-colors"
              >
                <span>Все 10 дисциплин 5-го семестра</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
