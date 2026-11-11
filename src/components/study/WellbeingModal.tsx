"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Sparkles, ArrowRight } from "lucide-react";

export type WellbeingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  totalTasks?: number;
  completedTasks?: number;
  overdueTasks?: number;
};

export function WellbeingModal({
  isOpen,
  onClose,
  totalTasks = 13,
  completedTasks = 2,
  overdueTasks = 4,
}: WellbeingModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const isSafe = overdueTasks === 0;

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (percent / 100) * circumference;

  const modalContent = (
    <div
      id="wellbeing-modal"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Дневной минимум и правила допуска"
    >
      <div
        className="w-full sm:max-w-md bg-[var(--surface)] text-[var(--ink)] rounded-t-3xl sm:rounded-3xl border border-[var(--border)] shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Дневной минимум</h2>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Ориентиры и правила допуска
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--surface-active)] hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Circular Activity Gauge */}
          <div className="flex flex-col items-center justify-center pt-1">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 110 110">
                <circle
                  cx="55"
                  cy="55"
                  r={radius}
                  className="stroke-black/10 dark:stroke-white/10"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="55"
                  cy="55"
                  r={radius}
                  className={isSafe ? "stroke-emerald-500" : "stroke-[var(--wine)]"}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="font-mono text-2xl font-extrabold tracking-tight">
                  {percent}%
                </span>
                <span className="text-[9px] font-mono uppercase text-[var(--ink-muted)] tracking-wider">
                  {isSafe ? "В порядке" : "Внимание"}
                </span>
              </div>
            </div>

            <p className="mt-2.5 text-xs text-center font-medium text-[var(--ink-secondary)] max-w-xs">
              {isSafe
                ? "Все дедлайны под контролем. Сдавайте лабораторные в спокойном темпе."
                : `${overdueTasks} дедлайн(а) требуют сдачи. Достаточно закрывать по 1 шагу лабораторной в день.`}
            </p>
          </div>

          {/* Academic minimums per confirmed course facts */}
          <div className="space-y-2 pt-1">
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--ink-muted)]">
              Правила допуска по предметам
            </h3>

            <div className="space-y-2 text-xs">
              {/* FPGA / Fedotov */}
              <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-active)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)]">
                    ПЛИС / Синтез (Федотов А.А.)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/15 text-blue-600 dark:text-blue-300 font-bold">
                    1/3 лабы
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
                  Лаба делится на 3 части: проект дома → прошивка на плате DE10-Lite в ауд. 410 → отчёт в DL.
                </p>
              </div>

              {/* OTU / Nesterov / Fedotov */}
              <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-active)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)]">
                    ОТУ (Нестеров / Федотов И.В.)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-bold">
                    Только лабы
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
                  Домашки Нестерова сдавать не обязательно. Для допуска к зачёту нужны только лабораторные у Федотова.
                </p>
              </div>

              {/* SAPR / Sidnev */}
              <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-active)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)]">
                    САПР (Сиднев А.Г.)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-600 dark:text-amber-300 font-bold">
                    1 упр/неделю
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
                  САПР и «Системный анализ» — один курс Сиднева. Сдаются упражнения на практикуме.
                </p>
              </div>

              {/* SOVD / Semenov & Kadrgulov */}
              <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-active)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)]">
                    СОВД (Семенов / Кадргулов)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-bold">
                    Расчёт 1 готов
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
                  Семенов — лекции, Кадргулов — практика. Расчётка №1 (вариант 5) рассчитана и готова к сдаче.
                </p>
              </div>
            </div>
          </div>

          {/* Action button: go to deadlines */}
          <Link
            href="/deadlines"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[var(--wine)] hover:bg-[var(--wine-hover)] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <span>Перейти к срокам и дедлайнам</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
