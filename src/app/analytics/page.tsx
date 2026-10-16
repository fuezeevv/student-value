import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  BarChart2,
  CheckCircle2,
  Clock,
  TrendingUp,
  PieChart,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();

  const offerings = await prisma.courseOffering.findMany({
    where: {
      semester: { isCurrent: true },
      groups: { some: { group: { code: "5130901/40102" } } },
    },
    include: {
      courseDefinition: true,
      tasks: {
        where: { status: "PUBLISHED" },
        include: {
          progress: user ? { where: { userId: user.id } } : false,
          deadlines: { where: { status: "ACTIVE" } },
        },
      },
    },
  });

  const allTasks = offerings.flatMap((o) =>
    o.tasks.map((t) => ({
      ...t,
      courseCode: o.courseDefinition.code,
      courseTitle: o.courseDefinition.shortTitle,
      userProgress: t.progress?.[0],
      isAccepted: t.progress?.[0]?.status === "ACCEPTED",
      isSubmitted: t.progress?.[0]?.status === "SUBMITTED",
      isInProgress: t.progress?.[0]?.status === "IN_PROGRESS",
    }))
  );

  const totalTasks = allTasks.length;
  const acceptedTasks = allTasks.filter((t) => t.isAccepted).length;
  const submittedTasks = allTasks.filter((t) => t.isSubmitted).length;
  const inProgressTasks = allTasks.filter((t) => t.isInProgress).length;
  const notStartedTasks = totalTasks - acceptedTasks - submittedTasks - inProgressTasks;

  const completionRate = totalTasks > 0 ? Math.round((acceptedTasks / totalTasks) * 100) : 0;

  // Breakdown by course
  const courseStats = offerings.map((o) => {
    const tasks = o.tasks;
    const count = tasks.length;
    const accepted = tasks.filter((t) => t.progress?.[0]?.status === "ACCEPTED").length;
    const submitted = tasks.filter((t) => t.progress?.[0]?.status === "SUBMITTED").length;
    const percent = count > 0 ? Math.round((accepted / count) * 100) : 0;

    return {
      id: o.id,
      code: o.courseDefinition.code,
      title: o.courseDefinition.shortTitle,
      count,
      accepted,
      submitted,
      percent,
    };
  });

  // Task type breakdown
  const typeMap: Record<string, number> = {};
  allTasks.forEach((t) => {
    typeMap[t.type] = (typeMap[t.type] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-cyan-400" />
          Академическая аналитика и прогресс
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Персональные и групповые метрики успеваемости группы 5130901/40102
        </p>
      </div>

      {/* METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-panel border-slate-800 p-4 space-y-1">
          <span className="text-xs text-slate-400 block">Всего заданий</span>
          <div className="text-2xl font-mono font-bold text-white">{totalTasks}</div>
          <span className="text-[11px] text-slate-500">В активных курсах</span>
        </Card>

        <Card className="glass-panel border-cyan-500/30 p-4 space-y-1">
          <span className="text-xs text-cyan-400 block font-medium">Подтверждено (ACCEPTED)</span>
          <div className="text-2xl font-mono font-bold text-cyan-300">{acceptedTasks}</div>
          <span className="text-[11px] text-cyan-500/80">Официально зачтено</span>
        </Card>

        <Card className="glass-panel border-blue-500/30 p-4 space-y-1">
          <span className="text-xs text-blue-400 block font-medium">На проверке (SUBMITTED)</span>
          <div className="text-2xl font-mono font-bold text-blue-300">{submittedTasks}</div>
          <span className="text-[11px] text-blue-500/80">Ожидает верификации</span>
        </Card>

        <Card className="glass-panel border-slate-800 p-4 space-y-1">
          <span className="text-xs text-slate-400 block font-medium">Коэффициент сдачи</span>
          <div className="text-2xl font-mono font-bold text-white">{completionRate}%</div>
          <span className="text-[11px] text-slate-500">Общий прогресс</span>
        </Card>
      </div>

      {/* COURSE BREAKDOWN */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          Прогресс по дисциплинам семестра
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courseStats.map((cs) => (
            <Card key={cs.id} className="glass-panel border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {cs.code}
                  </Badge>
                  <span className="font-semibold text-sm text-white">{cs.title}</span>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {cs.accepted} / {cs.count} сдано ({cs.percent}%)
                </span>
              </div>

              <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-cyan-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${cs.percent}%` }}
                />
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Сдано на проверку: {cs.submitted}</span>
                <Link
                  href={`/courses/${cs.id}`}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <span>Страница курса</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* WORKLOAD DISTRIBUTION */}
      <Card className="glass-panel border-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-cyan-400" />
          Структура заданий семестра по типам
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {Object.entries(typeMap).map(([type, count]) => (
            <div key={type} className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
              <span className="text-slate-400 block mb-1 font-mono text-[11px]">{type}</span>
              <span className="font-bold text-base text-cyan-300 font-mono">{count} заданий</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
