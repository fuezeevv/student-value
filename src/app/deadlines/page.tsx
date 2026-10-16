import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";
import { taskVisibilityWhere } from "@/server/domain/access";
import { isTrustedAccepted, progressEvidenceInclude } from "@/server/domain/trust";
import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { calculateDeadlineStatus, DeadlineCalculationResult } from "@/server/services/deadline-service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatTaskStatus, formatDeadlineProvenance } from "@/lib/utils/formatters";
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface DeadlineBoardItem {
  taskId: string;
  taskTitle: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseShortTitle: string;
  deadline: any | null;
  deadlineCalc: DeadlineCalculationResult;
  userProgress: any;
  isAccepted: boolean;
}

interface DeadlinesPageProps {
  searchParams: Promise<{
    course?: string;
    type?: string;
    hideCompleted?: string;
  }>;
}

export default async function DeadlinesPage({ searchParams }: DeadlinesPageProps) {
  const params = await searchParams;
  const user = await requireCurrentUser();
  const visibleTasks = await taskVisibilityWhere(user);

  const courseFilter = params.course || "";
  const typeFilter = params.type || "";
  const hideCompleted = params.hideCompleted === "true";

  // Fetch all course offerings and their tasks & deadlines
  const offerings = await prisma.courseOffering.findMany({
    where: {
      semester: { isCurrent: true },
      groups: { some: { groupId: user.groupId } },
    },
    include: {
      courseDefinition: true,
      tasks: {
        where: visibleTasks,
        include: {
          deadlines: {
            where: confirmedDeadlineWhere,
            orderBy: { date: "asc" },
          },
          progress: { where: { userId: user.id }, include: progressEvidenceInclude },
        },
      },
    },
  });

  const allItems: DeadlineBoardItem[] = offerings.flatMap((o) =>
    o.tasks.flatMap((t): DeadlineBoardItem[] => {
      const userProgress = t.progress?.[0];
      const isAccepted = isTrustedAccepted(userProgress);
      const primaryDeadline = t.deadlines[0];

      const calc = calculateDeadlineStatus(
        primaryDeadline ? primaryDeadline.date : null,
        new Date(),
        isAccepted,
        primaryDeadline?.isTimeStrict ?? true
      );

      return [
        {
          taskId: t.id,
          taskTitle: t.title,
          courseId: o.id,
          courseCode: o.courseDefinition.code,
          courseTitle: o.courseDefinition.title,
          courseShortTitle: o.courseDefinition.shortTitle,
          deadline: primaryDeadline || null,
          deadlineCalc: calc,
          userProgress,
          isAccepted,
        },
      ];
    })
  );

  // Apply filters
  const filteredItems = allItems.filter((item) => {
    if (courseFilter && item.courseCode !== courseFilter) return false;
    if (typeFilter && item.deadline?.type !== typeFilter) return false;
    if (hideCompleted && item.isAccepted) return false;
    return true;
  });

  // Categorize
  const overdue = filteredItems.filter((i) => i.deadlineCalc.urgency === "OVERDUE");
  const urgent = filteredItems.filter(
    (i) =>
      i.deadlineCalc.urgency === "DUE_TODAY" ||
      i.deadlineCalc.urgency === "DUE_TOMORROW" ||
      i.deadlineCalc.urgency === "DUE_URGENT"
  );
  const upcoming = filteredItems.filter((i) => i.deadlineCalc.urgency === "UPCOMING");
  const noDeadline = filteredItems.filter((i) => i.deadlineCalc.urgency === "NO_DEADLINE");
  const completed = filteredItems.filter((i) => i.isAccepted);

  const coursesList = offerings.map((o) => ({
    code: o.courseDefinition.code,
    shortTitle: o.courseDefinition.shortTitle,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-cyan-400" />
            Контрольные сроки и дедлайны
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Все академические обязательства группы 5130901/40102 на 5 семестр
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Course filter buttons */}
          <Link
            href={`/deadlines?${new URLSearchParams({
              ...(typeFilter ? { type: typeFilter } : {}),
              ...(hideCompleted ? { hideCompleted: "true" } : {}),
            })}`}
          >
            <Button
              size="sm"
              variant={!courseFilter ? "primary" : "outline"}
              className="text-xs"
            >
              Все предметы
            </Button>
          </Link>
          {coursesList.map((c) => (
            <Link
              key={c.code}
              href={`/deadlines?${new URLSearchParams({
                course: c.code,
                ...(typeFilter ? { type: typeFilter } : {}),
                ...(hideCompleted ? { hideCompleted: "true" } : {}),
              })}`}
            >
              <Button
                size="sm"
                variant={courseFilter === c.code ? "primary" : "outline"}
                className="text-xs"
              >
                {c.shortTitle}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Sub-filter bar: Type and Hide completed */}
      <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Тип дедлайна:</span>
          <Link
            href={`/deadlines?${new URLSearchParams({
              ...(courseFilter ? { course: courseFilter } : {}),
              ...(hideCompleted ? { hideCompleted: "true" } : {}),
            })}`}
            className={`px-2 py-1 rounded ${
              !typeFilter ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            Все
          </Link>
          <Link
            href={`/deadlines?${new URLSearchParams({
              ...(courseFilter ? { course: courseFilter } : {}),
              type: "HARD",
              ...(hideCompleted ? { hideCompleted: "true" } : {}),
            })}`}
            className={`px-2 py-1 rounded ${
              typeFilter === "HARD" ? "bg-rose-500/20 text-rose-300 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            Жесткие сроки
          </Link>
          <Link
            href={`/deadlines?${new URLSearchParams({
              ...(courseFilter ? { course: courseFilter } : {}),
              type: "SOFT",
              ...(hideCompleted ? { hideCompleted: "true" } : {}),
            })}`}
            className={`px-2 py-1 rounded ${
              typeFilter === "SOFT" ? "bg-blue-500/20 text-blue-300 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            Рекомендуемые сроки
          </Link>
        </div>

        <div>
          <Link
            href={`/deadlines?${new URLSearchParams({
              ...(courseFilter ? { course: courseFilter } : {}),
              ...(typeFilter ? { type: typeFilter } : {}),
              hideCompleted: hideCompleted ? "false" : "true",
            })}`}
            className={`px-2.5 py-1 rounded border transition-colors ${
              hideCompleted
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-slate-800/80 text-slate-300 border-slate-700"
            }`}
          >
            {hideCompleted ? "✓ Сданные скрыты" : "Показывать сданные"}
          </Link>
        </div>
      </div>

      {/* OVERDUE SECTION (If any exist) */}
      {overdue.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Просрочено ({overdue.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overdue.map((item) => (
              <DeadlineCard key={item.taskId} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* URGENT (TODAY / THIS WEEK) */}
      {urgent.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Срочно (ближайшие 48 часов) ({urgent.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {urgent.map((item) => (
              <DeadlineCard key={item.taskId} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* UPCOMING */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          Предстоящие контрольные сроки ({upcoming.length})
        </h2>
        {upcoming.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcoming.map((item) => (
              <DeadlineCard key={item.taskId} item={item} />
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-400">
            Предстоящих дедлайнов с заданными фильтрами нет.
          </div>
        )}
      </div>

      {/* NO DEADLINE / TBD */}
      {noDeadline.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            Задания без установленного дедлайна ({noDeadline.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {noDeadline.map((item) => (
              <DeadlineCard key={item.taskId} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeadlineCard({ item }: { item: any }) {
  const prov = formatDeadlineProvenance(item.deadline?.provenance);

  return (
    <Link href={`/tasks/${item.taskId}`} className="block group">
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-3 h-full">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-mono">
                {item.courseShortTitle}
              </Badge>
              {item.deadline && (
                <Badge variant={prov.variant} className="text-[10px] px-1.5 py-0">
                  {prov.label}
                </Badge>
              )}
            </div>
            <Badge variant={item.deadlineCalc.badgeVariant}>
              {item.deadlineCalc.badgeLabel}
            </Badge>
          </div>
          <h3 className="font-semibold text-sm text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-2">
            {item.taskTitle}
          </h3>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>{item.deadlineCalc.formattedDate}</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium text-slate-300 group-hover:text-cyan-300">
            <span>{formatTaskStatus(item.userProgress?.status)}</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </Link>
  );
}
