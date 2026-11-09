import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import {
  addDays,
  appliesToSubgroup,
  moscowDay,
  subjectKey,
  showScheduleSubject,
  sourceUrl,
  RUZ_ORIGIN,
  type RuzLesson,
} from "@/lib/schedule/ruz";
import type { ScheduleResult } from "@/server/schedule/ruz";

type Course = { id: string; title: string; href?: string };
type TaskPreview = {
  id: string;
  title: string;
  courseId: string;
  deadline?: { date: Date; title?: string | null } | null;
};

function LessonRow({
  lesson,
  courses,
  compact = false,
  publicBase,
  isCurrent = false,
}: {
  publicBase?: string;
  lesson: RuzLesson;
  courses: Course[];
  compact?: boolean;
  isCurrent?: boolean;
}) {
  const matched = courses.filter(
    (c) => subjectKey(c.title) === subjectKey(lesson.subject),
  );
  const course = matched.length === 1 ? matched[0] : null;
  return (
    <article
      className={`schedule-lesson ${isCurrent ? "schedule-lesson-active" : ""}`}
    >
      <div className="schedule-time">
        <strong className={isCurrent ? "!text-[var(--wine)] font-extrabold" : ""}>
          {lesson.start}
        </strong>
        <span>{lesson.end}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="schedule-kind">
            {lesson.type}
            {lesson.note
              ? ` · ${compact ? lesson.note.replace(/\d{7}\/\d{5}\s*п\/г\s*/g, "подгруппа ") : lesson.note}`
              : ""}
          </p>
          {isCurrent && <span className="schedule-hero-badge">Сейчас</span>}
        </div>
        {course ? (
          <Link
            className="schedule-subject"
            title={lesson.subject}
            href={course.href ?? `${publicBase ?? ""}/courses/${course.id}`}
          >
            {lesson.subject} ↗
          </Link>
        ) : (
          <h3 className="schedule-subject" title={lesson.subject}>
            {lesson.subject}
          </h3>
        )}
        {lesson.teachers.length > 0 && (
          <p className="schedule-teacher">{lesson.teachers.join(", ")}</p>
        )}
        {!compact && !course && lesson.lmsUrl && (
          <a
            href={lesson.lmsUrl}
            className="text-link text-sm inline-block mt-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            Материалы в DL ↗
          </a>
        )}
      </div>
      {lesson.rooms.length > 0 && (
        <div className="shrink-0 text-right">
          <p className="schedule-room">{lesson.rooms.join(" / ")}</p>
        </div>
      )}
    </article>
  );
}

function label(day: string) {
  return formatInTimeZone(
    new Date(day + "T12:00:00+03:00"),
    "Europe/Moscow",
    "EEEE, d MMMM",
    { locale: ru },
  );
}

export function SchedulePanel({
  result,
  courses,
  now = new Date(),
  compact = false,
  publicBase,
  tasks = [],
}: {
  publicBase?: string;
  result: ScheduleResult;
  courses: Course[];
  now?: Date;
  compact?: boolean;
  tasks?: TaskPreview[];
}) {
  const today = moscowDay(now);
  const days =
    result.data?.days.map((d) => ({
      ...d,
      lessons: d.lessons.filter(
        (l) =>
          showScheduleSubject(l.subject) &&
          appliesToSubgroup(l, result.data!.groupCode, result.subgroup),
      ),
    })) ?? [];
  const current = days.find((d) => d.date === today),
    next = days.find((d) => d.date > today && d.lessons.length > 0);
  const shown = compact
    ? current?.lessons.length
      ? [current]
      : publicBase && next
        ? [next]
        : []
    : days;

  const nowMoscow = formatInTimeZone(now, "Europe/Moscow", "HH:mm");
  const activeLesson = current?.lessons.find(
    (l) => l.start <= nowMoscow && nowMoscow <= l.end,
  );
  const nextLesson = current?.lessons.find((l) => nowMoscow < l.start);
  const heroLesson =
    activeLesson ||
    nextLesson ||
    (current?.lessons.length ? current.lessons[0] : null);
  const heroCourse = heroLesson
    ? courses.find((c) => subjectKey(c.title) === subjectKey(heroLesson.subject))
    : null;
  const heroTask = heroCourse
    ? tasks.find((t) => t.courseId === heroCourse.id)
    : null;

  return (
    <section
      className={compact ? "schedule-panel schedule-compact" : "schedule-panel"}
      aria-label="Официальное расписание"
    >
      <div className="section-heading">
        <h2>{compact ? "Расписание и аудитории" : "Расписание недели"}</h2>
        {compact ? (
          <Link className="text-link" href={`${publicBase ?? ""}/schedule`}>
            Вся неделя ↗
          </Link>
        ) : (
          <Link
            className="text-link"
            href={publicBase ? `${publicBase}/courses` : "/lessons"}
          >
            {publicBase ? "Предметы группы ↗" : "Занятия и записи ↗"}
          </Link>
        )}
      </div>
      <div className="schedule-source">
        <a
          href={result.data ? sourceUrl(result.data) : RUZ_ORIGIN}
          target="_blank"
          rel="noopener noreferrer"
        >
          Официальный РУЗ СПбПУ ↗
        </a>
        {result.fetchedAt && (
          <span>
            Проверено{" "}
            {formatInTimeZone(
              result.fetchedAt,
              "Europe/Moscow",
              "dd.MM · HH:mm",
            )}{" "}
            МСК
          </span>
        )}
      </div>
      {result.state === "STALE" && (
        <p role="status" className="schedule-warning">
          Расписание ещё не удалось обновить. Показана сохранённая версия;
          изменения могли ещё не появиться.
        </p>
      )}
      {result.state === "UNAVAILABLE" && (
        <p role="status" className="schedule-warning">
          Не удалось получить расписание РУЗ. Это не означает, что пар нет.
          Откройте официальный источник.
        </p>
      )}
      {result.state === "UNCONFIGURED" && (
        <p className="text-[var(--ink-secondary)] py-3">
          Для этой группы ещё не привязано расписание. Староста может передать
          владельцу сайта полный номер группы и ссылку РУЗ.
        </p>
      )}

      {/* Hero Callout for Current/Next Class */}
      {compact && heroLesson && current && current.lessons.length > 0 && (
        <div className="schedule-hero">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="schedule-hero-badge">
                {activeLesson
                  ? `ИДЁТ СЕЙЧАС · до ${activeLesson.end}`
                  : nextLesson
                    ? `СЛЕДУЮЩАЯ ПАРА · в ${nextLesson.start}`
                    : `ПАРА · в ${heroLesson.start}`}
              </span>
              <span className="text-xs text-[var(--ink-muted)] font-medium">
                {heroLesson.type}
              </span>
              {heroLesson.teachers.length > 0 && (
                <>
                  <span className="text-xs text-[var(--ink-muted)]">·</span>
                  <span className="text-xs text-[var(--ink-secondary)] font-medium">
                    {heroLesson.teachers.join(", ")}
                  </span>
                </>
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
              {heroCourse ? (
                <Link
                  href={
                    heroCourse.href ??
                    `${publicBase ?? ""}/courses/${heroCourse.id}`
                  }
                  className="hover:text-[var(--wine)]"
                >
                  {heroLesson.subject} ↗
                </Link>
              ) : (
                heroLesson.subject
              )}
            </h3>
            {heroTask && (
              <div className="pt-1 flex items-center gap-2 text-xs font-mono text-[var(--wine)] flex-wrap">
                <span className="font-bold">⚡ Задание по этому предмету:</span>
                <Link
                  href={`/tasks/${heroTask.id}`}
                  className="underline font-bold text-[var(--ink)] hover:text-[var(--wine)]"
                >
                  {heroTask.title}
                </Link>
                {heroTask.deadline && (
                  <span className="text-[var(--ink-muted)]">
                    (срок:{" "}
                    {formatInTimeZone(
                      heroTask.deadline.date,
                      "Europe/Moscow",
                      "d MMMM",
                      { locale: ru },
                    )}
                    )
                  </span>
                )}
              </div>
            )}
          </div>
          {heroLesson.rooms.length > 0 && (
            <div className="shrink-0 sm:text-right">
              <span className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-muted)] font-semibold">
                Аудитория
              </span>
              <span className="schedule-hero-room">
                {heroLesson.rooms.join(" / ")}
              </span>
            </div>
          )}
        </div>
      )}

      {compact &&
        current &&
        !current.lessons.length &&
        result.data &&
        today !== "2026-11-04" && (
          <p className="schedule-empty">
            Сегодня в РУЗ учебных пар для Student Value не указано.
          </p>
        )}
      {today === "2026-11-04" && result.data && (
        <p className={compact ? "schedule-empty" : "schedule-holiday"}>
          4 ноября — праздничный день.{" "}
          <a
            className="text-link"
            href="https://immit.spbstu.ru/info/951/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Объявление СПбПУ ↗
          </a>
        </p>
      )}
      {compact &&
        !current?.lessons.length &&
        next &&
        shown[0]?.date !== next.date && (
          <Link
            className="text-link block py-2"
            href={`${publicBase ?? ""}/schedule#day-${next.date}`}
          >
            {next.date === addDays(today, 1) ? "Завтра" : label(next.date)} ·
            расписание с {next.lessons[0].start} ↗
          </Link>
        )}
      {shown.map((day) => (
        <div key={day.date} className="schedule-day" id={`day-${day.date}`}>
          <h3 className="schedule-day-title">
            {day.date === today
              ? "Сегодня"
              : day.date === addDays(today, 1)
                ? "Завтра"
                : label(day.date)}
            {day.date === today || day.date === addDays(today, 1) ? (
              <span> · {label(day.date)}</span>
            ) : null}
          </h3>
          {day.lessons.length ? (
            day.lessons.map((lesson, i) => (
              <LessonRow
                key={`${lesson.start}-${i}`}
                lesson={lesson}
                courses={courses}
                compact={compact}
                publicBase={publicBase}
                isCurrent={day.date === today && lesson === activeLesson}
              />
            ))
          ) : (
            <p className="schedule-empty">
              В РУЗ учебных пар для Student Value не указано.
            </p>
          )}
        </div>
      ))}
      {!compact && (
        <p className="schedule-footnote">
          {result.subgroup !== null
            ? `Показана ваша подгруппа ${result.subgroup}. `
            : publicBase
              ? "Гостевой просмотр: показаны занятия всех подгрупп. "
              : "Подгруппа в профиле группы не указана: показаны занятия всех подгрупп. "}
          Время — Москва. Расписание обновляется при открытии, не чаще одного
          раза в 10 минут на группу и неделю. Военная подготовка, форсайт и НИР
          скрыты в Student Value. Содержание прошедших занятий и задания — в
          журнале и предметах.
        </p>
      )}
    </section>
  );
}
