"use client";

import { useRouter } from "next/navigation";
import { addDays } from "@/lib/schedule/ruz";
import { CompareSchedule } from "./CompareSchedule";
import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { publicGroups } from "@/lib/groups/public-groups";
import { updateStudentProgressAction } from "@/server/actions/task-actions";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ExternalLink,
  FileDown,
  Sparkles,
} from "lucide-react";

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
  totalXp: initialXp = 0,
  isGuest = false,
  publicBase,
  fetchedAt,
  scheduleState = "FRESH",
  sourceUrl = "https://ruz.spbstu.ru",
  nowMoscowTime = "12:00",
  todayDateStr,
}: ScheduleWorkbenchProps) {
  const router = useRouter();
  const [clock, setClock] = useState(nowMoscowTime);
  useEffect(() => {
    const update = () =>
      setClock(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Moscow",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);
  nowMoscowTime = clock;
  // Determine initial selected day: today if present, or next day with lessons, or first day
  const defaultDate = useMemo(() => {
    if (!days.length) return "";
    const today = days.find((d) => d.isToday || d.date === todayDateStr);
    if (today) return today.date;

    const futureWithLessons = days.find(
      (d) => d.date >= (todayDateStr ?? "") && d.lessons.length > 0,
    );
    if (futureWithLessons) return futureWithLessons.date;

    const anyWithLessons = days.find((d) => d.lessons.length > 0);
    if (anyWithLessons) return anyWithLessons.date;

    return days[0]?.date ?? "";
  }, [days, todayDateStr]);

  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);
  useEffect(() => setSelectedDate(defaultDate), [defaultDate]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [tasks, setTasks] = useState<WorkbenchTask[]>(initialTasks);
  const [xp, setXp] = useState<number>(initialXp);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    setTasks(initialTasks);
    setXp(initialXp);
  }, [initialTasks, initialXp]);
  const [isPending, startTransition] = useTransition();

  const selectedDateObj = useMemo(() => {
    const raw = selectedDate || todayDateStr || days[0]?.date || "2026-11-11";
    return new Date(raw + "T12:00:00+03:00");
  }, [selectedDate, todayDateStr, days]);

  const monthYearLabel = useMemo(() => {
    const s = formatInTimeZone(selectedDateObj, "Europe/Moscow", "LLLL yyyy", {
      locale: ru,
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [selectedDateObj]);

  const weekParityLabel = useMemo(() => {
    if (weekLabel.includes("·")) {
      return weekLabel.split("·")[1].trim().toLowerCase();
    }
    return "нечётная";
  }, [weekLabel]);

  const currentDay = useMemo(() => {
    return days.find((d) => d.date === selectedDate) || days[0];
  }, [days, selectedDate]);

  // Active / next lesson calculations for hero callout
  const isSelectedToday =
    currentDay?.isToday || currentDay?.date === todayDateStr;

  const { activeLesson, nextLesson, heroLesson } = useMemo(() => {
    if (!currentDay || !currentDay.lessons.length) {
      return { activeLesson: null, nextLesson: null, heroLesson: null };
    }
    if (isSelectedToday) {
      const active = currentDay.lessons.find(
        (l) => l.start <= nowMoscowTime && nowMoscowTime < l.end,
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
    if (!navigator.onLine) {
      setSaveError("Нет соединения. Отметка не сохранена.");
      return;
    }
    setSaveError("");
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const willBeCompleted = !task.completed;
    const xpDelta = 0;

    // Optimistic client update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, completed: willBeCompleted } : t,
      ),
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
          setSaveError(
            "Не удалось сохранить отметку. Проверьте соединение и попробуйте ещё раз.",
          );
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
  const orderedTasks = useMemo(() => {
    const tier = (t: WorkbenchTask) =>
      t.completed
        ? 3
        : t.deadlineDate && t.urgency !== "OVERDUE"
          ? 0
          : !t.deadlineDate
            ? 1
            : 2;
    const date = (t: WorkbenchTask) =>
      t.deadlineDate ? new Date(t.deadlineDate).getTime() : Infinity;
    return [...tasks].sort(
      (a, b) =>
        tier(a) - tier(b) ||
        (tier(a) === 2 ? date(b) - date(a) : date(a) - date(b)) ||
        a.title.localeCompare(b.title, "ru"),
    );
  }, [tasks]);
  const cleanGroup = (groupCode || "").replace(/^Группа\s+/i, "");

  return (
    <div
      data-schedule-updated={
        fetchedAt ? new Date(fetchedAt).toISOString() : undefined
      }
      className="w-full flex flex-col space-y-2.5 sm:space-y-4"
    >
      {/* ==================== 1. ПОЛИК-СТИЛЬ: ШАПКА НЕДЕЛИ И МЕСЯЦА ==================== */}
      <div className="flex items-center justify-between w-full max-w-xs mx-auto px-1 py-0.5">
        <button
          type="button"
          onClick={() => {
            if (days[0])
              router.push(
                `${isGuest ? publicBase : "/"}?week=${addDays(days[0].date, -7)}`,
              );
          }}
          className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-base text-[var(--ink-secondary)] hover:text-[var(--ink)] cursor-pointer transition-colors"
          aria-label="Предыдущая неделя"
        >
          ←
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="text-base sm:text-lg font-bold text-[var(--ink)] tracking-tight">
            {monthYearLabel}
          </span>
          <div className="text-xs font-medium text-[var(--ink-muted)] flex items-center gap-1.5 -mt-0.5">
            <span>{weekParityLabel}</span>
            <span>·</span>
            {isGuest ? (
              <select
                aria-label="Выбор группы"
                value={groupCode}
                onChange={(e) => {
                  const target = e.target.value;
                  const path = `/browse/${target.replace("/", "-")}`;
                  window.location.href = path;
                }}
                className="bg-transparent text-[var(--ink)] font-semibold font-mono focus:outline-none cursor-pointer text-xs underline"
              >
                {!publicGroups.some((g) => g.code === groupCode) && (
                  <option
                    value={groupCode}
                    className="dark:bg-slate-900 dark:text-slate-100"
                  >
                    {groupCode}
                  </option>
                )}
                {publicGroups.map((g) => (
                  <option
                    key={g.code}
                    value={g.code}
                    className="dark:bg-slate-900 dark:text-slate-100"
                  >
                    {g.track} · {g.code}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-semibold text-[var(--ink)] font-mono">
                {cleanGroup}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (days[0])
              router.push(
                `${isGuest ? publicBase : "/"}?week=${addDays(days[0].date, 7)}`,
              );
          }}
          className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-base text-[var(--ink-secondary)] hover:text-[var(--ink)] cursor-pointer transition-colors"
          aria-label="Следующая неделя"
        >
          →
        </button>
      </div>

      {scheduleState === "STALE" && (
        <div className="p-3 rounded-lg bg-[var(--wine-soft)] border-l-4 border-l-[var(--wine)] text-xs text-[#6b1d30] dark:text-[#ff99ac]">
          Расписание РУЗ временно не ответило, показана сохранённая копия.
        </div>
      )}

      {/* ==================== 2. ПОЛИК-СТИЛЬ: ПЛАШКИ ДНЕЙ НЕДЕЛИ (Image 1) ==================== */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full py-0">
        {days.slice(0, 7).map((day) => {
          const isActive = day.date === selectedDate;
          const pairCount = day.lessons.length;
          const dayNumber = day.dateLabel.split(" ")[0]; // "9", "10", "11", etc.

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setSelectedDate(day.date)}
              className={`flex flex-col items-center justify-center py-2 sm:py-2.5 px-0.5 rounded-2xl transition-all cursor-pointer ${
                isActive
                  ? "bg-[#cfc6ff] text-[#0b1a2d] dark:bg-[#cfc6ff] dark:text-[#0b1a2d] font-bold shadow-xs ring-1 ring-[#cfc6ff]"
                  : "bg-transparent text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <span
                className={`text-base sm:text-lg font-mono font-extrabold leading-none ${isActive ? "text-[#0b1a2d]" : "text-[var(--ink)]"}`}
              >
                {dayNumber}
              </span>
              <span
                className={`text-[10px] sm:text-[11px] font-mono uppercase font-bold tracking-wider mt-1 sm:mt-1.5 ${isActive ? "text-[#0b1a2d]/90 font-black" : "text-[var(--ink-muted)]"}`}
              >
                {day.dayLabel}
              </span>

              {/* Индикатор пар */}
              <div className="flex items-center justify-center gap-0.5 mt-1 sm:mt-1.5 h-1.5">
                {pairCount > 0 ? (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive
                        ? "bg-[#0b1a2d]"
                        : "bg-[var(--wine)] dark:bg-[#a5b4fc]"
                    }`}
                  />
                ) : (
                  <span className="w-1.5 h-1.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ==================== 3. ПОЛИК-СТИЛЬ: СПИСОК ПАР СРАЗУ НА ЭКРАНЕ (Image 1) ==================== */}
      <div className="space-y-2.5 sm:space-y-3.5 pt-0">
        <div className="flex items-center justify-between px-1 text-xs font-mono text-[var(--ink-muted)]">
          <span>Пары и аудитории</span>
          {currentDay && (
            <span>
              {currentDay.lessons.length}{" "}
              {currentDay.lessons.length === 1
                ? "пара"
                : currentDay.lessons.length >= 2 &&
                    currentDay.lessons.length <= 4
                  ? "пары"
                  : "пар"}
            </span>
          )}
        </div>

        {currentDay && currentDay.lessons.length > 0 ? (
          currentDay.lessons.map((lesson, idx) => {
            const isExpanded = expandedIndex === idx;
            const isCurrent =
              isSelectedToday &&
              lesson.start <= nowMoscowTime &&
              nowMoscowTime < lesson.end;
            const isNext =
              isSelectedToday && nextLesson?.start === lesson.start;

            const remainingMin = isCurrent
              ? Math.max(
                  1,
                  parseMinutes(lesson.end) - parseMinutes(nowMoscowTime),
                )
              : 0;

            // Check break
            let breakElement = null;
            if (idx > 0) {
              const prev = currentDay.lessons[idx - 1];
              const breakMin = getBreakMinutes(prev.end, lesson.start);
              if (breakMin > 0) {
                breakElement = (
                  <div
                    key={`break-${idx}`}
                    className="my-1.5 py-1 px-3 text-xs font-mono text-[var(--ink-muted)] flex items-center justify-between opacity-80"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>⏱</span>
                      <span>Перерыв {breakMin} минут</span>
                    </span>
                    <span className="text-[11px]">
                      {prev.end} — {lesson.start}
                    </span>
                  </div>
                );
              }
            }

            return (
              <div key={`${lesson.start}-${idx}`} className="space-y-1.5">
                {breakElement}

                {/* Time row */}
                <div className="flex items-center justify-between px-1 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold ${
                        isCurrent
                          ? "text-[var(--wine)] font-mono text-sm"
                          : "text-[var(--ink)]"
                      }`}
                    >
                      {lesson.start} — {lesson.end}
                    </span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--wine)] text-[#0b1a2d] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        Идёт сейчас · {remainingMin} мин
                      </span>
                    )}
                    {isNext && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                        Следующая пара
                      </span>
                    )}
                  </div>
                </div>

                {/* Card matching Image 1 PolyK */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border transition-all ${
                    isCurrent
                      ? "border-l-4 border-l-[var(--wine)] border-[var(--border)] shadow-xs"
                      : "border-[var(--border)] hover:border-black/20 dark:hover:border-white/20"
                  }`}
                >
                  <div
                    className="flex items-start justify-between gap-3 cursor-pointer select-none"
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  >
                    <h3 className="font-bold text-sm sm:text-base text-indigo-900 dark:text-[#cfc6ff] leading-snug">
                      {lesson.subject}
                    </h3>
                    <button
                      type="button"
                      aria-label={isExpanded ? "Свернуть" : "Развернуть"}
                      className="text-[var(--ink-muted)] hover:text-[var(--ink)] p-1 -mr-1 shrink-0 transition-transform cursor-pointer"
                    >
                      <ChevronDown
                        size={18}
                        className={`transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-2 text-xs space-y-0.5">
                    <p className="font-medium text-[var(--ink-secondary)]">
                      {lesson.type}
                    </p>
                    <p className="text-[var(--ink-muted)]">
                      {lesson.rooms.map(formatPolytechRoom).join(" / ") ||
                        "Аудитория не указана"}
                    </p>
                    {lesson.teachers.length > 0 && (
                      <p className="font-medium text-[var(--ink-secondary)]">
                        {lesson.teachers.join(", ")}
                      </p>
                    )}
                  </div>

                  {/* Expandable details: link to course, DL link, notes */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs space-y-2">
                      {lesson.courseHref && (
                        <div>
                          <Link
                            href={lesson.courseHref}
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                          >
                            <span>Материалы курса и конспекты</span>
                            <ArrowUpRight size={13} />
                          </Link>
                        </div>
                      )}
                      {lesson.lmsUrl && (
                        <div>
                          <a
                            href={lesson.lmsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--ink-muted)] hover:text-[var(--ink)]"
                          >
                            <span>Курс в СДО DL СПбПУ</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                      {lesson.note && (
                        <p className="text-[11px] text-[var(--ink-muted)] italic">
                          {lesson.note}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center text-xs text-[var(--ink-muted)] font-mono">
            {scheduleState === "UNAVAILABLE" || scheduleState === "UNCONFIGURED"
              ? "Расписание недоступно. Это не означает, что занятий нет."
              : "В этот день в расписании нет пар"}
          </div>
        )}
      </div>

      <CompareSchedule />
      {fetchedAt && (
        <p className="text-xs text-[var(--ink-muted)]">
          Обновлено{" "}
          {new Date(fetchedAt).toLocaleString("ru-RU", {
            timeZone: "Europe/Moscow",
          })}{" "}
          МСК{" "}
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              {" "}
              · РУЗ ↗
            </a>
          )}
        </p>
      )}
      {/* ==================== 4. БЛИЖАЙШИЕ ДЕДЛАЙНЫ (Things 3 / Linear style) ==================== */}
      <div className="pt-8 border-t border-[var(--ink-faint)] space-y-5">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-[var(--ink)] tracking-tight">
              Работы и ближайшие сроки
            </h3>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">
              Сначала — предстоящие сроки. Все задания доступны в разделе
              «Сроки».
            </p>
          </div>

          {!isGuest && (
            <div className="text-xs font-mono">
              <span className="text-[var(--ink-muted)]">Выполнено: </span>
              <span className="font-bold text-[var(--ink)]">
                {completedCount} из {totalCount}
              </span>
              <span className="text-[var(--ink-muted)] ml-3">Опыт: </span>
              <span className="font-bold text-[var(--wine)]">{xp} XP</span>
            </div>
          )}
        </div>

        {saveError && (
          <p role="alert" className="text-sm text-[var(--wine)]">
            {saveError}
          </p>
        )}
        <Link
          className="text-link text-sm"
          href={isGuest ? `${publicBase}/deadlines` : "/deadlines"}
        >
          Все работы · {totalCount} →
        </Link>
        {/* Список задач */}
        <div className="space-y-2.5">
          {tasks.length > 0 ? (
            orderedTasks.slice(0, 6).map((task) => {
              const isOverdue = task.urgency === "OVERDUE";
              const isSoon = task.urgency === "SOON";

              return (
                <div
                  key={task.id}
                  className={`work-item preview-work p-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-active)] border border-[var(--border)] transition-all flex items-start gap-4 relative ${
                    task.completed ? "opacity-60" : ""
                  }`}
                >
                  {!isGuest && (
                    <button
                      type="button"
                      disabled={isPending || task.accepted}
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
                      {task.completed && (
                        <Check
                          size={12}
                          strokeWidth={3}
                          className="text-white"
                        />
                      )}
                    </button>
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
                        {task.deadlineFormatted
                          ? ` · ${task.deadlineFormatted}`
                          : ""}
                      </span>

                      {task.accepted && (
                        <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 px-2 py-0.5 rounded">
                          ✓ Зачтено
                        </span>
                      )}
                    </div>

                    <p
                      className={`text-sm font-bold text-[var(--ink)] mt-1 leading-snug ${
                        task.completed
                          ? "line-through text-[var(--ink-muted)]"
                          : ""
                      }`}
                    >
                      <Link
                        href={
                          isGuest
                            ? `${publicBase}/tasks/${task.id}`
                            : `/tasks/${task.id}`
                        }
                      >
                        {task.title}
                      </Link>
                    </p>

                    <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)] mt-2 font-mono flex-wrap">
                      {task.teacher && <span>{task.teacher}</span>}
                      {task.materials &&
                        task.materials.map((m, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1"
                          >
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
              В сервисе пока нет опубликованных работ. Это не означает, что их
              не задавали.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
