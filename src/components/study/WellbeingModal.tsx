"use client";

import { useEffect, useState, useMemo } from "react";
import { X, Play, Pause, RotateCcw, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

export type WellbeingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  totalTasks?: number;
  completedTasks?: number;
  overdueTasks?: number;
};

const WEEKDAYS = [
  { day: "П", date: "9", done: true, hasClass: true },
  { day: "В", date: "10", done: true, hasClass: false },
  { day: "С", date: "11", done: false, isToday: true, hasClass: true },
  { day: "Ч", date: "12", done: false, hasClass: true },
  { day: "П", date: "13", done: false, hasClass: true },
  { day: "С", date: "14", done: false, hasClass: false },
  { day: "В", date: "15", done: false, hasClass: false },
];

export function WellbeingModal({
  isOpen,
  onClose,
  totalTasks = 13,
  completedTasks = 2,
  overdueTasks = 4,
}: WellbeingModalProps) {
  // Focus Timer state (persisted in localStorage)
  const [selectedDuration, setSelectedDuration] = useState<number>(45 * 60); // default 45 mins (1 academic pair)
  const [timeLeft, setTimeLeft] = useState<number>(45 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [studiedTodaySeconds, setStudiedTodaySeconds] = useState<number>(0);

  // Load today's study time on mount
  useEffect(() => {
    try {
      const todayKey = `sv_study_time_${new Date().toISOString().slice(0, 10)}`;
      const saved = localStorage.getItem(todayKey);
      if (saved) {
        setStudiedTodaySeconds(parseInt(saved, 10) || 0);
      }
    } catch {}
  }, []);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });

        setStudiedTodaySeconds((prev) => {
          const next = prev + 1;
          try {
            const todayKey = `sv_study_time_${new Date().toISOString().slice(0, 10)}`;
            localStorage.setItem(todayKey, next.toString());
          } catch {}
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Target goal: 45 minutes of active study OR 1 lab step
  const targetSeconds = 45 * 60;
  const timerProgress = Math.min(100, Math.round((studiedTodaySeconds / targetSeconds) * 100));
  const tasksPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const overallScore = Math.max(timerProgress, tasksPercent);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (overallScore / 100) * circumference;

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const setTimerPreset = (mins: number) => {
    setIsRunning(false);
    setSelectedDuration(mins * 60);
    setTimeLeft(mins * 60);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-lg bg-[var(--surface)] text-[var(--ink)] rounded-t-3xl sm:rounded-3xl border border-[var(--border)] shadow-2xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Дневной минимум и фокус занятий"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-5 bg-[var(--surface)]/90 backdrop-blur-md border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Дневной минимум</h2>
              <p className="text-[11px] text-[var(--ink-muted)] font-mono">
                Цель недели · Samsung Wellbeing Style
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--surface-active)] hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[var(--ink-secondary)] transition-colors cursor-pointer"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Circular Activity Gauge */}
          <div className="flex flex-col items-center justify-center pt-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 130 130">
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  className="stroke-black/10 dark:stroke-white/10"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  className={
                    overallScore >= 100
                      ? "stroke-emerald-500 transition-all duration-500"
                      : overallScore >= 50
                        ? "stroke-blue-500 transition-all duration-500"
                        : "stroke-[var(--wine)] transition-all duration-500"
                  }
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="font-mono text-3xl font-extrabold tracking-tight">
                  {overallScore}%
                </span>
                <span className="text-[10px] font-mono uppercase text-[var(--ink-muted)] tracking-wider">
                  {overallScore >= 100 ? "Выполнено" : "Цель дня"}
                </span>
              </div>
            </div>

            <p className="mt-3 text-sm font-bold text-center">
              {overallScore >= 100
                ? "Дневной минимум выполнен! Риска отчисления нет."
                : "Сдайте хотя бы 1 шаг лабораторной или уделите 45 мин учёбе"}
            </p>
          </div>

          {/* Weekday Status Rings (Samsung style: П, В, С, Ч, П, С, В) */}
          <div className="p-4 rounded-2xl bg-[var(--surface-active)] border border-[var(--border)]">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--ink-muted)] mb-3">
              <span>АКТИВНОСТЬ ПО ДНЯМ</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">2/7 дней закрыто</span>
            </div>
            <div className="flex items-center justify-between gap-1">
              {WEEKDAYS.map((w, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-[10px] font-mono text-[var(--ink-muted)] uppercase">
                    {w.day}
                  </span>
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-xs transition-all ${
                      w.isToday
                        ? "ring-2 ring-[var(--wine)] bg-[var(--surface)] text-[var(--ink)] font-extrabold shadow-xs"
                        : w.done
                          ? "bg-emerald-500 text-white shadow-xs"
                          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)]"
                    }`}
                  >
                    {w.done ? "✓" : w.date}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Study Focus Timer (Samsung Screen Time / Pomodoro) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[var(--surface-active)] to-blue-50/20 dark:to-blue-950/20 border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Таймер фокуса на учёбе</h3>
                <p className="text-[11px] text-[var(--ink-muted)]">
                  Накоплено сегодня: {Math.floor(studiedTodaySeconds / 60)} мин / 45 мин
                </p>
              </div>
              <div className="flex gap-1">
                {[25, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setTimerPreset(mins)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                      selectedDuration === mins * 60
                        ? "bg-[var(--wine)] text-white"
                        : "bg-[var(--surface)] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--ink-secondary)] border border-[var(--border)]"
                    }`}
                  >
                    {mins}м
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="font-mono text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                {formatTimer(timeLeft)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRunning(!isRunning)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs ${
                    isRunning
                      ? "bg-amber-500 hover:bg-amber-600 text-white"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Pause size={14} /> Пауза
                    </>
                  ) : (
                    <>
                      <Play size={14} /> Начать
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRunning(false);
                    setTimeLeft(selectedDuration);
                  }}
                  className="p-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-active)] text-[var(--ink-muted)] transition-colors cursor-pointer"
                  aria-label="Сбросить"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Exact Subject Breakdown based on Academic Corpus */}
          <div className="space-y-3 pt-1">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-muted)]">
              Правила допуска и минимумы по предметам
            </h3>

            <div className="space-y-2.5 text-xs">
              {/* FPGA / Fedotov */}
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)]">
                    ПЛИС / Синтез (Федотов А.А.)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                    1/3 лабы в неделю
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
                  Лабораторная разделена на 3 этапа: 1) Подготовка проекта дома; 2) Прошивка и сдача на плате DE10-Lite в ауд. 410; 3) Загрузка отчёта в DL.
                </p>
              </div>

              {/* OTU / Nesterov / Fedotov */}
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)]">
                    ОТУ (Нестеров / Федотов И.В.)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                    Лабы обязательны
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
                  Домашние задания Нестерова выполнять НЕ обязательно. Для допуска к зачёту требуются только выполненные лабораторные работы у Федотова.
                </p>
              </div>

              {/* SAPR / Sidnev */}
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)]">
                    САПР (Сиднев А.Г.)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                    1 упражнение в неделю
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
                  Системный анализ и САПР — единый курс Сиднева. Требуется сдача упражнений по линейному и динамическому программированию.
                </p>
              </div>

              {/* SOVD / Semenov & Kadrgulov */}
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)]">
                    СОВД (Семенов / Кадргулов)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                    Расчёт 1 готов
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
                  Семенов читает лекции, Кадргулов ведёт практику. Расчётная работа №1 (вариант 5) рассчитана и готова к сдаче.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
