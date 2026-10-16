import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { calculateDeadlineStatus } from "@/server/services/deadline-service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CreateTaskModal } from "@/components/task/CreateTaskModal";
import { formatTaskStatus } from "@/lib/utils/formatters";
import {
  Clock,
  AlertTriangle,
  ArrowRight,
  Megaphone,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  Flame,
  Trophy,
  Sparkles,
  Bot,
  ExternalLink,
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
      const order = {
        OVERDUE: 0,
        DUE_TODAY: 1,
        DUE_TOMORROW: 2,
        DUE_URGENT: 3,
        UPCOMING: 4,
        ACCEPTED: 5,
        NO_DEADLINE: 6,
      };
      return order[a.deadlineCalc.urgency] - order[b.deadlineCalc.urgency];
    });

  const focusTask = urgentTasks[0] || allTasks.find((t) => !t.isAccepted);

  // Active tasks (in progress, ready, or submitted)
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
  const submittedTasks = allTasks.filter((t) => t.userProgress?.status === "SUBMITTED").length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Group announcements
  const announcements = await prisma.announcement.findMany({
    where: { group: { code: "5130901/40102" } },
    include: { author: true },
    orderBy: { publishedAt: "desc" },
    take: 4,
  });

  // User Gamification stats
  const gamificationProfile = user
    ? await prisma.userGamificationProfile.findUnique({
        where: { userId: user.id },
      })
    : null;

  // Pending AI suggestions for admins
  const pendingSuggestionsCount =
    user?.isOwner || user?.permissions.includes("manage_tasks")
      ? await prisma.aiSuggestion.count({ where: { status: "PENDING" } })
      : 0;

  const canManageTasks = user?.permissions.includes("manage_tasks") ?? false;

  const coursesListForModal = offerings.map((o) => ({
    id: o.id,
    title: o.courseDefinition.title,
    shortTitle: o.courseDefinition.shortTitle,
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner / Brand Subhead */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Student Value <span className="text-cyan-400 font-mono">1.984</span>
            </h1>
            <Badge variant="default" className="text-[10px] font-mono">
              BETA 5130901/40102
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Оперативный центр учебного семестра · СПбПУ ИКНК
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/deadlines">
            <Button size="sm" variant="outline" className="text-xs">
              Все дедлайны
            </Button>
          </Link>
          {canManageTasks && <CreateTaskModal courses={coursesListForModal} />}
        </div>
      </div>

      {/* ADMIN AI INGESTION CALLOUT (Only shown if pending suggestions exist) */}
      {pendingSuggestionsCount > 0 && (
        <div className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-950/20 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Bot className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-200">
              В очереди AI Ingestion есть{" "}
              <strong className="text-cyan-300 font-semibold">{pendingSuggestionsCount}</strong>{" "}
              извлеченных предложений из транскрипций на ревью.
            </span>
          </div>
          <Link
            href="/admin"
            className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 shrink-0"
          >
            <span>Ревью</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* TOP ROW: FOCUS TASK + GAMIFICATION WIDGET */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: What should I do now? (8 cols) */}
        <div className="lg:col-span-8">
          {focusTask ? (
            <Card className="glass-panel border-cyan-500/40 relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-400" />
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-xs uppercase tracking-wider font-bold text-cyan-400">
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
              <CardContent className="space-y-4">
                {focusTask.description && (
                  <p className="text-sm text-slate-300 line-clamp-2">
                    {focusTask.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Дедлайн: {focusTask.deadlineCalc.formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Статус:{" "}
                        <strong className="text-slate-200">
                          {formatTaskStatus(focusTask.userProgress?.status)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <Link href={`/tasks/${focusTask.id}`}>
                    <Button size="sm" variant="primary" className="gap-1.5 font-semibold">
                      <span>Перейти к сдаче</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-panel border-slate-800 p-6 text-center h-full flex flex-col justify-center items-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
              <h3 className="text-base font-semibold text-slate-100">
                Все первоочередные задачи закрыты!
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                На данный момент срочных или просроченных заданий нет.
              </p>
            </Card>
          )}
        </div>

        {/* Right: Gamification & Streak Widget (4 cols) */}
        <div className="lg:col-span-4">
          <Card className="glass-panel border-slate-800 h-full flex flex-col justify-between p-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-cyan-400" />
                  Рейтинг и активность
                </span>
                <Link
                  href="/leaderboard"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                >
                  Таблица
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30">
                  <span className="text-xl font-mono font-black text-white">
                    {gamificationProfile?.level ?? 1}
                  </span>
                  <span className="absolute -bottom-1 text-[9px] uppercase font-bold text-cyan-300">
                    УР.
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{gamificationProfile?.totalXp ?? 0} XP</span>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                    <span>Ударный режим: {gamificationProfile?.currentStreak ?? 0} дн.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 mt-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Прогресс до уровня {(gamificationProfile?.level ?? 1) + 1}</span>
                <span className="text-slate-300 font-mono">
                  {(gamificationProfile?.totalXp ?? 0) % 100} / 100 XP
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-cyan-400 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(gamificationProfile?.totalXp ?? 0) % 100}%` }}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* SEMESTER PROGRESSION METRICS */}
      <Card className="glass-panel border-slate-800/80">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-sm text-slate-200">
                Семестровый прогресс группы
              </span>
              <span className="text-xs text-slate-400">
                · Зачтено: {completedTasks} · Сдано на проверку: {submittedTasks} · Всего: {totalTasks}
              </span>
            </div>
            <div className="text-sm font-bold text-cyan-400 font-mono">
              {progressPercent}%
            </div>
          </div>

          <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* TWO-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Deadlines & Active Tasks (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Urgent Deadlines List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-cyan-400" />
                Контрольные сроки ({urgentTasks.length})
              </h2>
              <Link href="/deadlines" className="text-xs text-cyan-400 hover:text-cyan-300">
                Все дедлайны →
              </Link>
            </div>

            {urgentTasks.length > 0 ? (
              <div className="space-y-2">
                {urgentTasks.map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="block group">
                    <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-cyan-500/40 transition-all flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                            {task.courseShortTitle}
                          </Badge>
                          <span className="font-medium text-sm text-slate-200 group-hover:text-cyan-300 transition-colors truncate">
                            {task.title}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-3">
                          <span>Срок: {task.deadlineCalc.formattedDate}</span>
                          <span>·</span>
                          <span>
                            {task.primaryDeadline?.type === "HARD" ? "Жесткий" : "Рекомендуемый"}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Badge variant={task.deadlineCalc.badgeVariant}>
                          {task.deadlineCalc.badgeLabel}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 text-center text-xs text-slate-400">
                На ближайшее время дедлайнов нет.
              </div>
            )}
          </div>

          {/* Active Tasks in Progress */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Задачи в активной работе ({activeTasks.length})
            </h2>

            {activeTasks.length > 0 ? (
              <div className="space-y-2">
                {activeTasks.map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="block group">
                    <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-cyan-500/40 transition-all flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                            {task.courseShortTitle}
                          </Badge>
                          <span className="font-medium text-sm text-slate-200 group-hover:text-cyan-300 transition-colors truncate">
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
                        <Badge
                          variant={task.userProgress?.status === "SUBMITTED" ? "info" : "default"}
                        >
                          {formatTaskStatus(task.userProgress?.status)}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 text-center text-xs text-slate-400">
                Нет задач со статусом «В работе». Перейдите в дисциплины для выбора задания.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Announcements & Quick Access (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Announcements Stream */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-cyan-400" />
              Объявления и важные изменения
            </h2>

            {announcements.length > 0 ? (
              <div className="space-y-2.5">
                {announcements.map((ann) => (
                  <Card key={ann.id} className="glass-panel border-slate-800 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-200">{ann.title}</span>
                      {ann.isPinned && (
                        <Badge variant="warning" className="text-[10px]">
                          Закреплено
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{ann.content}</p>
                    <div className="text-[11px] text-slate-500 pt-1.5 border-t border-slate-800/60 flex items-center justify-between">
                      <span>Автор: {ann.author.nickname}</span>
                      <span>{new Date(ann.publishedAt).toLocaleDateString("ru-RU")}</span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 text-center text-xs text-slate-400">
                Новых объявлений нет.
              </div>
            )}
          </div>

          {/* Quick Study Resources */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              Быстрый переход
            </h2>
            <div className="space-y-2">
              <Link
                href="/courses"
                className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 flex items-center justify-between text-xs text-slate-300 hover:text-cyan-300 transition-colors"
              >
                <span>Все 10 дисциплин 5-го семестра</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>
              <Link
                href="/transcripts"
                className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 flex items-center justify-between text-xs text-slate-300 hover:text-cyan-300 transition-colors"
              >
                <span>Транскрипции лекций и занятий</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>
              <Link
                href="/calendar"
                className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 flex items-center justify-between text-xs text-slate-300 hover:text-cyan-300 transition-colors"
              >
                <span>Академический календарь и Google Calendar</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
