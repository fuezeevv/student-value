"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { publicGroups } from "@/lib/groups/public-groups";
import { updateStudentProgressAction } from "@/server/actions/task-actions";
import { ArrowUpRight, Check, ExternalLink, FileDown } from "lucide-react";

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

  // Task completion toggle
  const toggleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const willBeCompleted = !task.completed;
    const xpDelta = willBeCompleted ? 20 : -20;

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
    <div className="w-full flex flex-col space-y-7">
      {/* ==================== ВЕРХНИЙ БЛОК: ГРУППА, СТАТУС РУЗ, ТЕЛЕГРАМ ==================== */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--ink-faint)] text-xs font-mono">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[var(--ink-muted)]">Группа:</span>
            <select
              aria-label="Выбор группы"
              value={groupCode}
              onChange={(e) => {
                const target = e.target.value;
                const path = `/browse/${target.replace("/", "-")}`;
                window.location.href = path;
              }}
              className="bg-transparent text-[var(--ink)] font-bold font-mono focus:outline-none cursor-pointer border-b border-[var(--ink-muted)] pb-0.5"
            >
              {publicGroups.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.track} · {g.code} {g.code === groupCode ? "(Выбрана)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="h-3 w-px bg-[var(--ink-muted)] opacity-30 hidden sm:block" />

          <span className="text-[var(--ink-muted)]">{weekLabel}</span>

          {fetchedAt && (
            <>
              <div className="h-3 w-px bg-[var(--ink-muted)] opacity-30 hidden sm:block" />
              <span className="text-[var(--ink-muted)] hidden md:inline">
                РУЗ проверен в{" "}
                {formatInTimeZone(new Date(fetchedAt), "Europe/Moscow", "HH:mm")} МСК
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors hidden sm:inline"
          >
            Официальный РУЗ СПбПУ ↗
          </a>
          <div className="h-3 w-px bg-[var(--ink-muted)] opacity-30 hidden sm:block" />
          <a
            href="https://t.me/studentvalue"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--wine)] font-bold hover:underline flex items-center gap-1"
          >
            <span>Канал @studentvalue ↗</span>
          </a>
        </div>
      </div>

      {scheduleState === "STALE" && (
        <div className="p-3 rounded-lg bg-[var(--wine-soft)] border-l-4 border-l-[var(--wine)] text-xs text-[#6b1d30]">
          Расписание РУЗ временно не ответило, показана сохранённая копия.
        </div>
      )}

      {/* ==================== 1. ПЕРЕКЛЮЧАТЕЛЬ ДНЕЙ НЕДЕЛИ ==================== */}
      <div className="flex items-baseline justify-between gap-4 border-b border-[var(--ink-faint)] pb-1 overflow-x-auto">
        <div className="flex items-center gap-4 sm:gap-8 font-mono text-sm shrink-0">
          {days.map((day) => {
            const isActive = day.date === selectedDate;
            const isToday = day.isToday || day.date === todayDateStr;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={`day-tab pb-3 text-left relative cursor-pointer ${
                  isActive ? "active" : ""
                }`}
              >
                <span
                  className={`block text-[11px] uppercase tracking-wider ${
                    isActive
                      ? "text-[var(--wine)] font-bold"
                      : "text-[var(--ink-muted)]"
                  }`}
                >
                  {isToday ? `${day.dayLabel} · СЕГОДНЯ` : day.dayLabel}
                </span>
                <span
                  className={`font-bold text-base ${
                    isActive ? "text-[var(--ink)]" : "text-[var(--ink-secondary)]"
                  }`}
                >
                  {day.dateLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Быстрый телеметрический статус прямо сейчас */}
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
              <span className="bg-white/80 font-bold px-2 py-0.5 rounded text-[var(--ink)]">
                {activeLesson.rooms[0]}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ==================== 2. ГЛАВНЫЙ ГЕРОЙ-БЛОК (ТЕКУЩАЯ / СЛЕДУЮЩАЯ ПАРА) ==================== */}
      {heroLesson ? (
        <div className="p-5 sm:p-7 rounded-xl bg-white/75 backdrop-blur-sm shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-[var(--wine)]">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2.5 font-mono text-xs flex-wrap">
              <span className="px-2 py-0.5 rounded bg-[var(--wine-soft)] text-[var(--wine)] font-bold uppercase tracking-wider">
                {activeLesson
                  ? `ИДЁТ СЕЙЧАС · до ${activeLesson.end}`
                  : nextLesson
                    ? `СЛЕДУЮЩАЯ ПАРА · в ${nextLesson.start}`
                    : `ПАРА · в ${heroLesson.start}`}
              </span>
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
                <span className="font-bold">⚡ Горит дедлайн по этому предмету:</span>
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

          {/* Крупный моноширинный номер аудитории */}
          {heroLesson.rooms.length > 0 && (
            <div className="shrink-0 text-left md:text-right">
              <span className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-muted)] font-semibold">
                Аудитория
              </span>
              <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight block">
                {heroLesson.rooms.join(" / ")}
              </span>
              <span className="block text-xs text-[var(--ink-muted)] font-medium mt-0.5">
                {heroLesson.building || "Учебный корпус"}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-white/60 border border-[var(--ink-faint)] text-center">
          <p className="font-bold text-[var(--ink)]">
            В этот день пар нет
          </p>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            Свободное время для подготовки, курсовых и дедлайнов.
          </p>
        </div>
      )}

      {/* ==================== 3. ПОЛНАЯ ТАБЛИЦА ЗАНЯТИЙ НА ДЕНЬ ==================== */}
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

            return (
              <div
                key={`${lesson.start}-${idx}`}
                className={`schedule-row p-3.5 flex items-start sm:items-center justify-between gap-4 transition-all ${
                  isCurrent
                    ? "bg-white/80 border-l-4 border-l-[var(--wine)] shadow-xs"
                    : isPast
                      ? "opacity-55 hover:opacity-100"
                      : "hover:bg-white/45"
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
                      {lesson.rooms.join(" / ")}
                    </span>
                    <span className="block text-[11px] text-[var(--ink-muted)]">
                      {lesson.building || "Корпус"}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-xs text-[var(--ink-muted)] font-mono">
            На этот день в РУЗ занятий не запланировано.
          </div>
        )}
      </div>

      {/* ==================== 4. БЛИЖАЙШИЕ ДЕДЛАЙНЫ И РАБОТЫ (Things 3 style) ==================== */}
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

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl bg-white/65 hover:bg-white/85 transition-all flex items-start gap-4 ${
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
                        <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
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
            <div className="p-6 rounded-xl bg-white/40 border border-[var(--ink-faint)] text-center text-xs text-[var(--ink-muted)] font-mono">
              Опубликованных дедлайнов пока нет.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
