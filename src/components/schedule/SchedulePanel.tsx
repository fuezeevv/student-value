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
function LessonRow({
  lesson,
  courses,
  compact = false,
  publicBase,
}: {
  publicBase?: string;
  lesson: RuzLesson;
  courses: Course[];
  compact?: boolean;
}) {
  const matched = courses.filter(
    (c) => subjectKey(c.title) === subjectKey(lesson.subject),
  );
  const course = matched.length === 1 ? matched[0] : null;
  return (
    <article className="schedule-lesson">
      <div className="schedule-time">
        <strong>{lesson.start}</strong>
        <span>{lesson.end}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="schedule-kind">
          {lesson.type}
          {lesson.note
            ? ` · ${compact ? lesson.note.replace(/\d{7}\/\d{5}\s*п\/г\s*/g, "подгруппа ") : lesson.note}`
            : ""}
        </p>
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
        {lesson.rooms.length > 0 && (
          <p className="schedule-room">{lesson.rooms.join(" / ")}</p>
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
}: {
  publicBase?: string;
  result: ScheduleResult;
  courses: Course[];
  now?: Date;
  compact?: boolean;
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
  return (
    <section
      className={compact ? "schedule-panel schedule-compact" : "schedule-panel"}
      aria-label="Официальное расписание"
    >
      <div className="section-heading">
        <h2>{compact ? "Пары и аудитории" : "Расписание недели"}</h2>
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
          Официальный РУЗ ↗
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
        <p className="text-slate-300 py-3">
          Для этой группы ещё не привязано расписание. Староста может передать
          владельцу сайта полный номер группы и ссылку РУЗ.
        </p>
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
            (compact ? day.lessons.slice(0, 2) : day.lessons).map(
              (lesson, i) => (
                <LessonRow
                  key={`${lesson.start}-${i}`}
                  lesson={lesson}
                  courses={courses}
                  compact={compact}
                  publicBase={publicBase}
                />
              ),
            )
          ) : (
            <p className="schedule-empty">
              В РУЗ учебных пар для Student Value не указано.
            </p>
          )}
          {compact && day.lessons.length > 2 && (
            <Link
              className="text-link block py-3"
              href={`${publicBase ?? ""}/schedule#day-${day.date}`}
            >
              Ещё {day.lessons.length - 2} · открыть день ↗
            </Link>
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
