import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { coverageLabels, lessonTypes } from "@/lib/study/lesson-context";
type Lesson = {
  id: string;
  sessionDate: Date;
  endsAt: Date | null;
  isTimeKnown: boolean;
  topic: string | null;
  type: string;
  status: string;
  taughtBy: string | null;
  context: { coverage: string; audienceNote: string | null } | null;
  _count: { transcripts: number; materials: number; tasks: number };
};
export function CourseJournal({
  id,
  lessons,
  filter,
}: {
  id: string;
  lessons: Lesson[];
  filter?: string;
}) {
  const type = filter && lessonTypes[filter] ? filter : "";
  const shown = lessons.filter((l) => !type || l.type === type);
  const months = [
    ...new Set(
      shown.map((l) =>
        formatInTimeZone(l.sessionDate, "Europe/Moscow", "yyyy-MM"),
      ),
    ),
  ];
  const covered = lessons.filter((l) =>
    l.context
      ? l.context.coverage !== "SCHEDULE_ONLY"
      : l._count.transcripts || l._count.materials || l.topic,
  ).length;
  return (
    <section aria-label="Журнал занятий">
      <div className="section-heading">
        <h2>
          Занятия семестра <span className="count">{lessons.length}</span>
        </h2>
      </div>
      <p className="text-sm text-slate-400 mb-5">
        Содержание и материалы есть у {covered} из {lessons.length} занятий.
        Расписание показывает запланированную пару; само по себе оно не
        подтверждает, что пара состоялась.
      </p>
      <nav className="lesson-filters" aria-label="Виды занятий">
        {[
          ["", "Все"],
          ["LECTURE", "Лекции"],
          ["PRACTICE", "Практики"],
          ["LAB", "Лабораторные"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/courses/${id}?type=${value}`}
            aria-current={type === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!shown.length && (
        <p className="quiet-empty">
          Для этого вида занятий записей пока нет. Это не означает, что занятий
          не было.
        </p>
      )}
      {months.map((month) => (
        <section className="journal-month" key={month}>
          <h3 className="journal-month-title">
            {formatInTimeZone(
              new Date(month + "-15T12:00:00+03:00"),
              "Europe/Moscow",
              "MM.yyyy",
            )}
          </h3>
          {shown
            .filter(
              (l) =>
                formatInTimeZone(l.sessionDate, "Europe/Moscow", "yyyy-MM") ===
                month,
            )
            .map((l) => (
              <Link
                className="journal-entry"
                key={l.id}
                href={`/lessons/${l.id}`}
              >
                <div className="journal-date">
                  <strong>
                    {formatInTimeZone(l.sessionDate, "Europe/Moscow", "dd.MM")}
                  </strong>
                  <span>
                    {l.isTimeKnown
                      ? formatInTimeZone(
                          l.sessionDate,
                          "Europe/Moscow",
                          "HH:mm",
                        )
                      : "Время ?"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="journal-kind">
                    {lessonTypes[l.type]}
                    {l.context?.audienceNote
                      ? ` · ${l.context.audienceNote}`
                      : ""}
                    {l.status === "CANCELLED" ? " · Отменено" : ""}
                  </p>
                  <h4>{l.topic ?? "Тема пока не восстановлена"}</h4>
                  <p className="journal-meta">
                    {l.context
                      ? coverageLabels[l.context.coverage]
                      : l._count.transcripts
                        ? "Есть текст занятия"
                        : "Запись редактора"}
                    {l._count.materials
                      ? ` · Файлов и ссылок: ${l._count.materials}`
                      : ""}
                    {l._count.tasks
                      ? ` · Связанных работ: ${l._count.tasks}`
                      : ""}
                  </p>
                </div>
                <span className="text-slate-500" aria-hidden>
                  ↗
                </span>
              </Link>
            ))}
        </section>
      ))}
    </section>
  );
}
