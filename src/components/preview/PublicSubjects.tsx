import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { publicGroupDefinition } from "@/lib/groups/public-groups";
import { subjectKey, moscowDay } from "@/lib/schedule/ruz";
import { matchSubjectCourse, type RuzSubject } from "@/lib/schedule/subjects";
import {
  loadPublicSubjectCatalog,
  type PublicSubjectCatalog,
} from "@/server/schedule/public-subjects";
import { SchedulePanel } from "@/components/schedule/SchedulePanel";
type Course = {
  id: string;
  title: string;
  shortTitle?: string;
  tasks?: unknown[];
};
type Props = { slug: string; base: string; courses: Course[]; week?: string };
const date = (day: string) =>
  formatInTimeZone(
    new Date(day + "T12:00:00+03:00"),
    "Europe/Moscow",
    "d MMMM",
    { locale: ru },
  );
export function SubjectSources({
  catalog,
  slug,
}: {
  catalog: PublicSubjectCatalog;
  slug: string;
}) {
  const definition = publicGroupDefinition(slug)!;
  const timestamps = catalog.weeks.flatMap((w) =>
    w.fetchedAt ? [w.fetchedAt.getTime()] : [],
  );
  return (
    <div className="subject-sources">
      <p>
        По расписанию с {date(catalog.start)} по {date(catalog.end)}. Это
        перечень за выбранный период, а не полный учебный план семестра.
      </p>
      <div>
        {catalog.weeks.map((w) => (
          <a
            key={w.weekStart}
            href={`https://ruz.spbstu.ru/faculty/125/groups/${definition.ruzId}?date=${w.weekStart}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            РУЗ · {date(w.weekStart)} ↗
          </a>
        ))}
      </div>
      {timestamps.length > 0 && (
        <p>
          Проверено{" "}
          {formatInTimeZone(
            new Date(Math.min(...timestamps)),
            "Europe/Moscow",
            "dd.MM · HH:mm",
          )}{" "}
          МСК
        </p>
      )}
      {catalog.weeks.some((w) => w.state !== "FRESH") && (
        <p className="schedule-warning" role="status">
          Часть расписания пока не обновилась. Перечень может быть неполным;
          сохранённые сведения показаны с датой проверки.
        </p>
      )}
    </div>
  );
}
function SubjectList({
  catalog,
  base,
  courses,
}: {
  catalog: PublicSubjectCatalog;
  base: string;
  courses: Course[];
}) {
  const represented = new Set(
    catalog.subjects.map((s) => matchSubjectCourse(s, courses)?.id),
  );
  const remaining = courses.filter((c) => !represented.has(c.id));
  return (
    <>
      <div className="public-subject-list">
        {catalog.subjects.map((subject) => {
          const course = matchSubjectCourse(subject, courses);
          return (
            <Link
              className="public-subject-row"
              key={subject.id}
              href={`${base}/courses/${course?.id ?? subject.id}?week=${catalog.start}`}
            >
              <span>
                <strong>{subject.title}</strong>
                <span className="public-subject-meta">
                  {subject.types.join(" · ")}
                </span>
              </span>
              <span className="public-subject-origin">
                {course?.tasks?.length
                  ? `Работ: ${course.tasks.length}`
                  : "Расписание и преподаватели"}
              </span>
              <ArrowUpRight size={18} />
            </Link>
          );
        })}
      </div>
      {!catalog.subjects.length && (
        <p className="quiet-empty">
          Получить перечень предметов пока не удалось. Это не означает, что
          занятий нет: можно открыть официальный РУЗ по ссылкам выше.
        </p>
      )}
      {remaining.length > 0 && (
        <section className="mt-8">
          <h3 className="text-base mb-3">Ещё в учебном пространстве</h3>
          <div className="public-subject-list">
            {remaining.map((c) => (
              <Link
                key={c.id}
                href={`${base}/courses/${c.id}`}
                className="public-subject-row"
              >
                <span>
                  <strong>{c.title}</strong>
                  <span className="public-subject-meta">
                    Общих опубликованных работ: {c.tasks?.length ?? 0}
                  </span>
                </span>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export async function PublicSubjects({
  slug,
  base,
  courses,
  week,
  showSchedule = false,
}: Props & { showSchedule?: boolean }) {
  const catalog = await loadPublicSubjectCatalog(slug, { week });
  const links = catalog.subjects.map((s) => ({
    id: matchSubjectCourse(s, courses)?.id ?? s.id,
    title: s.title,
    href: `${base}/courses/${matchSubjectCourse(s, courses)?.id ?? s.id}?week=${catalog.start}`,
  }));
  return (
    <>
      {showSchedule && (
        <SchedulePanel
          result={catalog.weeks[0]}
          courses={links}
          publicBase={base}
          compact
        />
      )}
      <section className="public-subject-section">
        <div className="section-heading">
          <h2>
            Предметы из расписания{" "}
            <span className="count">{catalog.subjects.length}</span>
          </h2>
        </div>
        <SubjectSources catalog={catalog} slug={slug} />
        <SubjectList catalog={catalog} base={base} courses={courses} />
      </section>
    </>
  );
}
export function SubjectDetails({
  subject,
  catalog,
  slug,
}: {
  subject: RuzSubject;
  catalog: PublicSubjectCatalog;
  slug: string;
}) {
  const today = moscowDay(),
    future = subject.meetings.filter((m) => m.date >= today);
  return (
    <section className="public-subject-details">
      <SubjectSources catalog={catalog} slug={slug} />
      <h2>Преподаватели по видам занятий</h2>
      <div className="subject-teaching">
        {subject.types.map((type) => (
          <div key={type}>
            <h3>{type}</h3>
            <p>
              {[
                ...new Set(
                  subject.meetings
                    .filter((m) => m.type === type)
                    .flatMap((m) => m.teachers),
                ),
              ].join(", ") || "В РУЗ преподаватель не указан"}
            </p>
          </div>
        ))}
      </div>
      <h2>Занятия в расписании</h2>
      <div>
        {(future.length ? future : subject.meetings).map((m, i) => (
          <article key={i} className="subject-meeting">
            <div>
              <strong>{date(m.date)}</strong>
              <span>
                {m.start}–{m.end}
              </span>
            </div>
            <div>
              <h3>{m.type}</h3>
              {m.teachers.length > 0 && <p>{m.teachers.join(", ")}</p>}
              {m.rooms.length > 0 && <p>{m.rooms.join(" / ")}</p>}
              {m.note && <p className="public-subject-meta">{m.note}</p>}
            </div>
          </article>
        ))}
      </div>
      {subject.links.map((url) => (
        <a
          className="text-link block"
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          DL · ссылка из РУЗ ↗
        </a>
      ))}
      <p className="preview-explainer">
        Здесь показаны запланированные пары всех подгрупп. Расписание не
        подтверждает выдачу задания или дату сдачи.
      </p>
    </section>
  );
}
export async function PublicSubjectPage({
  slug,
  id,
  week,
  base,
}: Props & { id: string }) {
  const catalog = await loadPublicSubjectCatalog(slug, { week }),
    subject = catalog.subjects.find((s) => s.id === id);
  if (!subject) notFound();
  return (
    <>
      <h2 className="subject-detail-title">{subject.title}</h2>
      <SubjectDetails subject={subject} catalog={catalog} slug={slug} />
      <Link className="text-link" href={`${base}/courses`}>
        Все предметы группы ↗
      </Link>
    </>
  );
}
export async function PublicCourseSchedule({
  slug,
  courseTitle,
  week,
}: {
  slug: string;
  courseTitle: string;
  week?: string;
}) {
  const catalog = await loadPublicSubjectCatalog(slug, { week }),
    subject = catalog.subjects.find(
      (s) => subjectKey(s.title) === subjectKey(courseTitle),
    );
  return subject ? (
    <>
      <h2 className="subject-detail-title mt-8">Расписание и преподаватели</h2>
      <SubjectDetails subject={subject} catalog={catalog} slug={slug} />
    </>
  ) : null;
}
