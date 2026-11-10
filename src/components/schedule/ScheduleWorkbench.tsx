"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { publicGroups } from "@/lib/groups/public-groups";
import { updateStudentProgressAction } from "@/server/actions/task-actions";
import { ArrowUpRight, Check, ExternalLink, FileDown, Sparkles } from "lucide-react";

export type WorkbenchLesson = {
  subject: string;
  start: string;
  end: string;
  type: string;
  note?: string;
  teachers: string[];
  rooms: string[];
  lmsUrl?: string | null;
  building?: string;
  courseId?: string;
  courseHref?: string;
};

export type WorkbenchDay = {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"
  dateLabel: string; // "2 нояб", "3 нояб", etc.
  isToday: boolean;
  lessons: WorkbenchLesson[];
};

export type WorkbenchTask = {
  id: string;
  title: string;
  courseTitle: string;
  courseShortTitle?: string;
  courseId?: string;
  deadlineDate?: Date | string | null;
  deadlineFormatted?: string;
  urgency?: "OVERDUE" | "SOON" | "NORMAL" | "NONE";
  completed: boolean;
  accepted?: boolean;
  teacher?: string | null;
  materials?: Array<{ id?: string; title: string; url?: string }>;
};

export type ScheduleWorkbenchProps = {
  groupCode: string;
  groupLabel?: string;
  weekLabel?: string;
  days: WorkbenchDay[];
  tasks: WorkbenchTask[];
  totalXp?: number;
  isGuest?: boolean;
  publicBase?: string;
  fetchedAt?: Date | string | null;
  scheduleState?: "FRESH" | "STALE" | "UNAVAILABLE" | "UNCONFIGURED";
  sourceUrl?: string;
  nowMoscowTime?: string; // "HH:mm"
  todayDateStr?: string; // "YYYY-MM-DD"
};

function parseMinutes(t: string): number {
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatCountdown(targetTimeStr: string, nowTimeStr: string): string {
  const targetMin = parseMinutes(targetTimeStr);
  const nowMin = parseMinutes(nowTimeStr);
  const diff = targetMin - nowMin;
  if (diff <= 0) return "прямо сейчас";
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) return `${hours} ч ${mins} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${mins} мин`;
}

function getBreakMinutes(prevEnd: string, nextStart: string): number {
  return parseMinutes(nextStart) - parseMinutes(prevEnd);
}

function formatPolytechRoom(room: string): string {
  if (!room) return "";
  const match = room.match(/^(\d+)\s*к\.?\s*(?:[•·-]\s*)?(\d+.*)$/i);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return room;
}

export function ScheduleWorkbench({
  groupCode,
  groupLabel,
  weekLabel = "11-я неделя · Нечётная",
  days,
  tasks: initialTasks,
  totalXp: initialXp = 45,
  isGuest = false,
  publicBase,
  fetchedAt,
  scheduleState = "FRESH",
  sourceUrl = "https://ruz.spbstu.ru",
  nowMoscowTime = "12:00",
  todayDateStr,
}: ScheduleWorkbenchProps) {
  // Determine initial selected day: today if present, or next day with lessons, or first day
  const defaultDate = useMemo(() => {
    if (!days.length) return "";
    const today = days.find((d) => d.isToday || d.date === todayDateStr);
    if (today && today.lessons.length > 0) return today.date;

    const futureWithLessons = days.find(
      (d) => d.date >= (todayDateStr ?? "") && d.lessons.length > 0,
    );
    if (futureWithLessons) return futureWithLessons.date;

    const anyWithLessons = days.find((d) => d.lessons.length > 0);
    if (anyWithLessons) return anyWithLessons.date;

    return days[0]?.date ?? "";
  }, [days, todayDateStr]);

  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);
  const [tasks, setTasks] = useState<WorkbenchTask[]>(initialTasks);
  const [xp, setXp] = useState<number>(initialXp);
  const [xpFloat, setXpFloat] = useState<{ id: string; delta: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentDay = useMemo(() => {
    return days.find((d) => d.date === selectedDate) || days[0];
  }, [days, selectedDate]);

  // Active / next lesson calculations for hero callout
  const isSelectedToday = currentDay?.isToday || currentDay?.date === todayDateStr;

  const { activeLesson, nextLesson, heroLesson } = useMemo(() => {
    if (!currentDay || !currentDay.lessons.length) {
      return { activeLesson: null, nextLesson: null, heroLesson: null };
    }
    if (isSelectedToday) {
      const active = currentDay.lessons.find(
        (l) => l.start <= nowMoscowTime && nowMoscowTime <= l.end,
      );
      const next = currentDay.lessons.find((l) => nowMoscowTime < l.start);
      return {
        activeLesson: active || null,
        nextLesson: next || null,
        heroLesson: active || next || currentDay.lessons[0],
      };
    }
    return {
      activeLesson: null,
      nextLesson: null,
      heroLesson: currentDay.lessons[0],
    };
  }, [currentDay, isSelectedToday, nowMoscowTime]);

  // Contextual task for the hero lesson
  const heroTask = useMemo(() => {
    if (!heroLesson) return null;
    const heroNorm = heroLesson.subject.toLowerCase();
    return (
      tasks.find(
        (t) =>
          !t.completed &&
          (t.courseTitle.toLowerCase().includes(heroNorm) ||
            heroNorm.includes(t.courseTitle.toLowerCase()) ||
            (t.courseShortTitle &&
              heroNorm.includes(t.courseShortTitle.toLowerCase()))),
      ) || null
    );
  }, [heroLesson, tasks]);

  // Task completion toggle with dopamine trigger
  const toggleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const willBeCompleted = !task.completed;
    const xpDelta = willBeCompleted ? 20 : -20;

    // Trigger dopamine float animation
    if (willBeCompleted) {
      setXpFloat({ id: taskId, delta: 20 });
      setTimeout(() => setXpFloat(null), 1800);
    }

    // Optimistic client update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: willBeCompleted } : t)),
    );
    setXp((prev) => Math.max(0, prev + xpDelta));

    if (!isGuest) {
      startTransition(async () => {
        try {
          await updateStudentProgressAction(
            taskId,
            willBeCompleted ? "READY" : "IN_PROGRESS",
          );
        } catch {
          // Revert on error
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, completed: !willBeCompleted } : t,
            ),
          );
          setXp((prev) => Math.max(0, prev - xpDelta));
        }
      });
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* ==================== КОМПАКТНАЯ ШАПКА ГРУППЫ И НЕДЕЛИ ==================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--ink-faint)] text-xs font-mono">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-xl shadow-xs">
            <span className="text-[var(--ink-muted)] font-medium">Группа:</span>
            <select
              aria-label="Выбор группы"
              value={groupCode}
              onChange={(e) => {
                const target = e.target.value;
                const path = `/browse/${target.replace("/", "-")}`;
                window.location.href = path;
              }}
              className="bg-transparent text-[var(--ink)] font-bold font-mono focus:outline-none cursor-pointer"
            >
              {publicGroups.map((g) => (
                <option key={g.code} value={g.code} className="dark:bg-slate-900 dark:text-slate-100">
                  {g.track} · {g.code} {g.code === groupCode ? "(Выбрана)" : ""}
                </option>
              ))}
            </select>
          </div>

          <span className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--ink-secondary)] font-medium shadow-xs">
            {weekLabel}
          </span>

          {fetchedAt && (
            <span className="text-[var(--ink-muted)] hidden sm:inline">
              РУЗ проверен в{" "}
              {formatInTimeZone(new Date(fetchedAt), "Europe/Moscow", "HH:mm")} МСК
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors hidden md:inline"
          >
            Официальный РУЗ ↗
          </a>
        </div>
      </div>

      {scheduleState === "STALE" && (
        <div className="p-3 rounded-lg bg-[var(--wine-soft)] border-l-4 border-l-[var(--wine)] text-xs text-[#6b1d30] dark:text-[#ff99ac]">
          Расписание РУЗ временно не ответило, показана сохранённая копия.
        </div>
      )}

      {/* ==================== 1. ПЕРЕКЛЮЧАТЕЛЬ ДНЕЙ НЕДЕЛИ С ТОЧКАМИ ==================== */}
      <div className="flex items-baseline justify-between gap-4 border-b border-[var(--ink-faint)] pb-2 overflow-x-auto">
        <div className="flex items-center gap-4 sm:gap-7 font-mono text-sm shrink-0">
          {days.map((day) => {
            const isActive = day.date === selectedDate;
            const isToday = day.isToday || day.date === todayDateStr;
            const pairCount = day.lessons.length;

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={`pb-2.5 text-left relative cursor-pointer transition-all border-b-2 ${
                  isActive
                    ? "border-b-[var(--wine)] font-bold"
                    : "border-b-transparent hover:text-[var(--ink)]"
                }`}
              >
                <span
                  className={`block text-[11px] uppercase tracking-wider font-mono ${
                    isActive
                      ? "text-[var(--wine)] font-extrabold"
                      : "text-[var(--ink-muted)] font-semibold"
                  }`}
                >
                  {isToday ? `${day.dayLabel} · СЕГОДНЯ` : day.dayLabel}
                </span>
                <span
                  className={`font-bold text-base block mt-0.5 ${
                    isActive ? "text-[var(--ink)]" : "text-[var(--ink-secondary)]"
                  }`}
                >
                  {day.dateLabel}
                </span>

                {/* Точки-индикаторы количества пар в день (в стиле PolyK) */}
                <div className="flex items-center gap-1 mt-1 justify-start">
                  {pairCount > 0 ? (
                    Array.from({ length: Math.min(5, pairCount) }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-1 h-1 rounded-full ${
                          isActive
                            ? "bg-[var(--wine)]"
                            : "bg-[var(--ink-muted)]"
                        }`}
                      />
                    ))
                  ) : (
                    <span className="text-[10px] text-[var(--ink-muted)]">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Быстрый статус прямо сейчас */}
        {activeLesson && (
          <div className="shrink-0 hidden lg:flex items-center gap-2 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-[var(--wine)] animate-ping" />
            <span className="text-[var(--wine)] font-bold uppercase tracking-wider">
              Прямо сейчас:
            </span>
            <span className="font-bold text-[var(--ink)] truncate max-w-xs">
              {activeLesson.subject}
            </span>
            {activeLesson.rooms.length > 0 && (
              <span className="bg-[var(--surface-active)] font-bold px-2 py-0.5 rounded text-[var(--ink)] shadow-xs">
                {activeLesson.rooms[0]}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ==================== 2. ГЛАВНЫЙ ГЕРОЙ-БЛОК (ТЕКУЩАЯ / СЛЕДУЮЩАЯ ПАРА) ==================== */}
      {heroLesson ? (
        <div className="p-5 sm:p-7 rounded-2xl bg-[var(--surface)] backdrop-blur-md shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-[var(--wine)] border border-[var(--border)]">
          <div className="space-y-2 flex-1 min-w-0">
            {/* Дофаминовый таймер обратного отсчёта */}
            <div className="flex items-center gap-2.5 font-mono text-xs flex-wrap">
              {activeLesson ? (
                <span className="px-2.5 py-1 rounded-md bg-[var(--wine)] text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  ИДЁТ СЕЙЧАС · осталось {formatCountdown(activeLesson.end, nowMoscowTime)} (до {activeLesson.end})
                </span>
              ) : nextLesson ? (
                <span className="px-2.5 py-1 rounded-md bg-[var(--wine-soft)] text-[var(--wine)] border border-[rgba(150,38,64,0.25)] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--wine)]" />
                  СЛЕДУЮЩАЯ ПАРА · через {formatCountdown(nextLesson.start, nowMoscowTime)} (в {nextLesson.start})
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/10 text-[var(--ink-secondary)] font-mono text-xs font-bold uppercase tracking-wider">
                  ПАРА · в {heroLesson.start}
                </span>
              )}

              <span className="text-[var(--ink-muted)]">{heroLesson.type}</span>
              {heroLesson.teachers.length > 0 && (
                <>
                  <span className="text-[var(--ink-muted)]">·</span>
                  <span className="text-[var(--ink-secondary)] font-medium">
                    {heroLesson.teachers.join(", ")}
                  </span>
                </>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[var(--ink)] tracking-tight">
              {heroLesson.courseHref ? (
                <Link
                  href={heroLesson.courseHref}
                  className="hover:text-[var(--wine)] transition-colors inline-flex items-center gap-1.5"
                >
                  <span>{heroLesson.subject}</span>
                  <ArrowUpRight size={20} className="shrink-0 text-[var(--ink-muted)]" />
                </Link>
              ) : (
                heroLesson.subject
              )}
            </h2>

            {/* Контекстный дедлайн по предмету этой пары */}
            {heroTask && (
              <div className="pt-1 flex items-center gap-2.5 text-xs font-mono text-[var(--wine)] flex-wrap">
                <span className="font-bold flex items-center gap-1">
                  <Sparkles size={13} />
                  Горит дедлайн по этому предмету:
                </span>
                <span className="font-semibold text-[var(--ink)]">{heroTask.title}</span>
                {heroTask.deadlineFormatted && (
                  <span className="text-[var(--ink-muted)]">
                    ({heroTask.deadlineFormatted})
                  </span>
                )}
                {heroTask.materials?.[0]?.url && (
                  <a
                    href={heroTask.materials[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-bold text-[var(--ink)] hover:text-[var(--wine)]"
                  >
                    Скачать материалы ↗
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Крупный номер аудитории без визуального мусора */}
          {heroLesson.rooms.length > 0 && (
            <div className="shrink-0 text-left md:text-right">
              <span className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-muted)] font-semibold">
                Аудитория
              </span>
              <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight block">
                {heroLesson.rooms.map(formatPolytechRoom).join(" / ")}
              </span>
              <span className="block text-xs text-[var(--ink-muted)] font-medium mt-0.5">
                {heroLesson.building || "Учебный корпус"}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center">
          <p className="font-bold text-[var(--ink)]">
            В этот день пар нет
          </p>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            Свободный день для подготовки, курсовых проектов и закрытия дедлайнов.
          </p>
        </div>
      )}

      {/* ==================== 3. ПОЛНАЯ ТАБЛИЦА ЗАНЯТИЙ С ПЕРЕРЫВАМИ ==================== */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-mono text-[var(--ink-muted)] pb-2 px-3 border-b border-[var(--ink-faint)]">
          <span>ВРЕМЯ И ПРЕДМЕТ</span>
          <span>АУДИТОРИЯ И КОРПУС</span>
        </div>

        {currentDay && currentDay.lessons.length > 0 ? (
          currentDay.lessons.map((lesson, idx) => {
            const isCurrent =
              isSelectedToday &&
              lesson.start <= nowMoscowTime &&
              nowMoscowTime <= lesson.end;
            const isPast = isSelectedToday && lesson.end < nowMoscowTime;

            // Check if there is a break before this lesson
            let breakElement = null;
            if (idx > 0) {
              const prev = currentDay.lessons[idx - 1];
              const breakMin = getBreakMinutes(prev.end, lesson.start);
              if (breakMin > 0) {
                breakElement = (
                  <div
                    key={`break-${idx}`}
                    className="schedule-break my-1.5 py-1.5 px-4 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-dashed border-[var(--border)] text-xs font-mono text-[var(--ink-muted)] flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>⏱</span>
                      <span>Перерыв {breakMin} минут</span>
                    </span>
                    <span className="text-[11px] opacity-75">{prev.end} — {lesson.start}</span>
                  </div>
                );
              }
            }

            return (
              <div key={`${lesson.start}-${idx}`}>
                {breakElement}

                <div
                  className={`schedule-row p-3.5 flex items-start sm:items-center justify-between gap-4 transition-all rounded-xl ${
                    isCurrent
                      ? "bg-[var(--surface-active)] border-l-4 border-l-[var(--wine)] shadow-xs"
                      : isPast
                        ? "opacity-50 hover:opacity-100"
                        : "hover:bg-[var(--surface-active)]"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                    <div
                      className={`font-mono text-xs w-28 shrink-0 ${
                        isCurrent
                          ? "font-bold text-[var(--wine)] flex items-center gap-1.5"
                          : "font-semibold text-[var(--ink-muted)]"
                      }`}
                    >
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-[var(--wine)] shrink-0" />
                      )}
                      {lesson.start} — {lesson.end}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {lesson.courseHref ? (
                          <Link
                            href={lesson.courseHref}
                            className="font-bold text-sm text-[var(--ink)] hover:text-[var(--wine)] truncate"
                          >
                            {lesson.subject}
                          </Link>
                        ) : (
                          <span className="font-bold text-sm text-[var(--ink)] truncate">
                            {lesson.subject}
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${
                            isCurrent
                              ? "bg-[var(--wine-soft)] text-[var(--wine)] font-bold"
                              : "text-[var(--ink-muted)]"
                          }`}
                        >
                          [ {lesson.type} ]
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)] mt-0.5 flex-wrap">
                        {lesson.teachers.length > 0 && (
                          <span>{lesson.teachers.join(", ")}</span>
                        )}
                        {lesson.note && (
                          <>
                            <span>·</span>
                            <span>{lesson.note}</span>
                          </>
                        )}
                        {lesson.lmsUrl && (
                          <>
                            <span>·</span>
                            <a
                              href={lesson.lmsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-[var(--ink-secondary)] hover:text-[var(--wine)]"
                            >
                              DL ↗
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {lesson.rooms.length > 0 && (
                    <div className="font-mono text-right shrink-0">
                      <span
                        className={`text-sm font-bold ${
                          isCurrent ? "text-[var(--wine)]" : "text-[var(--ink)]"
                        }`}
                      >
                        {lesson.rooms.map(formatPolytechRoom).join(" / ")}
                      </span>
                      <span className="block text-[11px] text-[var(--ink-muted)]">
                        {lesson.building || "Корпус"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-xs text-[var(--ink-muted)] font-mono">
            На этот день в РУЗ занятий не запланировано.
          </div>
        )}
      </div>

      {/* ==================== 4. БЛИЖАЙШИЕ ДЕДЛАЙНЫ (Things 3 / Linear style) ==================== */}
      <div className="pt-8 border-t border-[var(--ink-faint)] space-y-5">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-[var(--ink)] tracking-tight">
              Ближайшие дедлайны по предметам
            </h3>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">
              Синхронизируются со старостой и твоим расписанием
            </p>
          </div>

          <div className="text-xs font-mono">
            <span className="text-[var(--ink-muted)]">Выполнено: </span>
            <span className="font-bold text-[var(--ink)]">
              {completedCount} из {totalCount}
            </span>
            <span className="text-[var(--ink-muted)] ml-3">Опыт: </span>
            <span className="font-bold text-[var(--wine)]">{xp} XP</span>
          </div>
        </div>

        {/* Список задач */}
        <div className="space-y-2.5">
          {tasks.length > 0 ? (
            tasks.map((task) => {
              const isOverdue = task.urgency === "OVERDUE";
              const isSoon = task.urgency === "SOON";
              const isFloating = xpFloat?.id === task.id;

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-active)] border border-[var(--border)] transition-all flex items-start gap-4 relative ${
                    task.completed ? "opacity-60" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    className={`custom-check mt-1 shrink-0 ${
                      task.completed ? "is-checked" : ""
                    }`}
                    aria-label={
                      task.completed
                        ? "Вернуть к выполнению"
                        : "Отметить выполненным"
                    }
                  >
                    {task.completed && <Check size={12} strokeWidth={3} className="text-white" />}
                  </button>

                  {/* Дофаминовый бейдж +20 XP при клике */}
                  {isFloating && (
                    <span className="absolute left-10 -top-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white font-mono text-[11px] font-bold shadow-md animate-bounce pointer-events-none">
                      +20 XP ✨
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <span
                        className={`text-xs font-mono font-bold ${
                          isOverdue || isSoon
                            ? "text-[var(--wine)]"
                            : "text-[var(--ink-secondary)]"
                        }`}
                      >
                        {task.courseShortTitle || task.courseTitle}
                        {task.deadlineFormatted ? ` · ${task.deadlineFormatted}` : ""}
                      </span>

                      {task.accepted && (
                        <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 px-2 py-0.5 rounded">
                          ✓ Зачтено
                        </span>
                      )}
                    </div>

                    <p
                      className={`text-sm font-bold text-[var(--ink)] mt-1 leading-snug ${
                        task.completed ? "line-through text-[var(--ink-muted)]" : ""
                      }`}
                    >
                      {task.title}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)] mt-2 font-mono flex-wrap">
                      {task.teacher && <span>{task.teacher}</span>}
                      {task.materials &&
                        task.materials.map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-1">
                            {m.url ? (
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--ink)] font-semibold hover:underline inline-flex items-center gap-1"
                              >
                                <FileDown size={14} />
                                <span>{m.title}</span>
                              </a>
                            ) : (
                              <span>📄 {m.title}</span>
                            )}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-[var(--border)] text-center text-xs text-[var(--ink-muted)] font-mono">
              Опубликованных дедлайнов пока нет.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
