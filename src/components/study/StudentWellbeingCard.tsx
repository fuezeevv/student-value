"use client";

import { useMemo, useState } from "react";
import { SafetyShieldIcon } from "@/components/ui/Icons";
import { Sparkles } from "lucide-react";

export type WellbeingDayStatus = {
  dayLabel: string; // "П", "В", "С", "Ч", "П", "С", "В"
  dateLabel: string; // "9", "10", "11", etc.
  isToday: boolean;
  isPast: boolean;
  completionRate: number; // 0 to 1
  hasClasses: boolean;
};

export type StudentWellbeingCardProps = {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  streakDays?: number;
  dayStatuses?: WellbeingDayStatus[];
};

export function StudentWellbeingCard({
  totalTasks = 0,
  completedTasks = 0,
  overdueTasks = 0,
  streakDays = 5,
  dayStatuses = [
    { dayLabel: "П", dateLabel: "9", isToday: false, isPast: true, completionRate: 1, hasClasses: true },
    { dayLabel: "В", dateLabel: "10", isToday: false, isPast: true, completionRate: 1, hasClasses: false },
    { dayLabel: "С", dateLabel: "11", isToday: true, isPast: false, completionRate: 0.5, hasClasses: true },
    { dayLabel: "Ч", dateLabel: "12", isToday: false, isPast: false, completionRate: 0, hasClasses: true },
    { dayLabel: "П", dateLabel: "13", isToday: false, isPast: false, completionRate: 0, hasClasses: true },
    { dayLabel: "С", dateLabel: "14", isToday: false, isPast: false, completionRate: 0, hasClasses: false },
    { dayLabel: "В", dateLabel: "15", isToday: false, isPast: false, completionRate: 0, hasClasses: false },
  ],
}: StudentWellbeingCardProps) {
  const [open, setOpen] = useState(false);

  const percent = useMemo(() => {
    if (totalTasks === 0) return 100;
    return Math.min(100, Math.round((completedTasks / totalTasks) * 100));
  }, [totalTasks, completedTasks]);

  const isSafe = overdueTasks === 0;

  // SVG Arch meter calculation
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (percent / 100) * circumference;

  return (
    <div className="w-full rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-blue-50/50 via-[var(--surface)] to-slate-50/30 dark:from-slate-900/70 dark:via-[#161f2c] dark:to-slate-800/40 border border-[var(--border)] shadow-xs transition-all">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              isSafe
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400"
            }`}
          >
            <SafetyShieldIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Дневной минимум · Цель недели
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  isSafe
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                }`}
              >
                {isSafe ? "В безопасности" : "Внимание"}
              </span>
            </div>
            <h3 className="text-base font-bold text-[var(--ink)] mt-0.5">
              {isSafe
                ? "Безопасная траектория: риска отчисления нет"
                : `Внимание: ${overdueTasks} дедлайн(а) требуют сдачи`}
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs font-mono text-[var(--wine)] hover:underline cursor-pointer"
        >
          {open ? "Свернуть" : "Подробнее ▾"}
        </button>
      </div>

      {/* Samsung Digital Wellbeing Weekly Day Rings (Image 5 style) */}
      <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center justify-between gap-2 overflow-x-auto">
        {dayStatuses.map((d, i) => {
          const isDone = d.completionRate >= 1;
          const isPartial = d.completionRate > 0 && d.completionRate < 1;

          return (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 px-1">
              <span className="text-[10px] font-mono uppercase text-[var(--ink-muted)]">
                {d.dayLabel}
              </span>
              <div
                className={`relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  d.isToday
                    ? "bg-[var(--wine)] text-white shadow-xs"
                    : isDone
                      ? "border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                      : isPartial
                        ? "border-2 border-blue-400 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30"
                        : "border border-[var(--border)] text-[var(--ink-secondary)] bg-[var(--surface-active)]"
                }`}
              >
                {d.dateLabel}
              </div>
            </div>
          );
        })}

        {/* Small Arch Progress ring */}
        <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-[var(--border)]">
          <div className="relative w-12 h-12 shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-black/10 dark:stroke-white/10"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                className={isSafe ? "stroke-emerald-500" : "stroke-[var(--wine)]"}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-[11px] text-[var(--ink)]">
              {percent}%
            </div>
          </div>
          <div className="text-xs">
            <span className="block font-bold text-[var(--ink)]">
              {completedTasks} из {totalTasks} сдано
            </span>
            <span className="text-[11px] text-[var(--ink-muted)] font-mono">
              Цель недели
            </span>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[var(--ink-secondary)]">
          <div className="p-3 rounded-2xl bg-[var(--surface-active)] border border-[var(--border)]">
            <p className="font-bold text-[var(--ink)] flex items-center gap-1.5 mb-1">
              <Sparkles size={13} className="text-amber-500" />
              Минимум для зачёта и допуска к сессии:
            </p>
            <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
              Сдавайте хотя бы 1 лабораторную или расчётную в неделю, чтобы не накапливать критические хвосты перед зачётной неделей.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--surface-active)] border border-[var(--border)]">
            <p className="font-bold text-[var(--ink)] mb-1">Текущий темп:</p>
            <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
              Выполнено {completedTasks} из {totalTasks} заданий семестра ({percent}%). Дедлайнов на этой неделе: {totalTasks - completedTasks}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
