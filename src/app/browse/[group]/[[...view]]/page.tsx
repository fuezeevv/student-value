import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FileLock2 } from "lucide-react";
import { loadPublicWorkspace } from "@/server/queries/public-workspace";
import { browsePath } from "@/lib/groups/public-groups";
import { PublicTaskRow } from "@/components/preview/PublicTaskRow";
import { PublicScheduleView } from "@/components/preview/PublicSchedule";
import {
  PublicSubjects,
  PublicSubjectPage,
  PublicCourseSchedule,
} from "@/components/preview/PublicSubjects";
import {
  requestedWeek,
  showScheduleSubject,
  subjectKey,
  sourceUrl,
} from "@/lib/schedule/ruz";
import { loadPublicRuzSchedule } from "@/server/schedule/ruz";
import { calculateDeadlineStatus } from "@/server/services/deadline-service";
import {
  ScheduleWorkbench,
  WorkbenchDay,
  WorkbenchTask,
} from "@/components/schedule/ScheduleWorkbench";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

export default async function PublicGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string; view?: string[] }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { group: slug, view = [] } = await params;
  const workspace = await loadPublicWorkspace(slug);
  if (!workspace) notFound();
  const { group, courses } = workspace,
    base = browsePath(group.code),
    tasks = courses.flatMap((c) => c.tasks);
  const course =
    view[0] === "courses" && view[1]
      ? courses.find((c) => c.id === view[1])
      : null;
  const remoteSubjectId =
    view[0] === "courses" && /^ruz-[a-f0-9]{16}$/.test(view[1] ?? "")
      ? view[1]
      : null;
  const task =
    view[0] === "tasks" && view[1] ? tasks.find((t) => t.id === view[1]) : null;
  if (
    view.length > 2 ||
    (view.length === 2 && !course && !task && !remoteSubjectId) ||
    (view.length === 1 &&
      !["courses", "deadlines", "schedule"].includes(view[0]))
  )
    notFound();
  const query = await searchParams;
  let week: string | undefined;
  try {
    week = query.week ? requestedWeek(query.week) : undefined;
  } catch {
    return (
      <>
        <h1 className="page-title">Неделя недоступна</h1>
        <Link className="text-link" href={`${base}/courses`}>
          К текущим предметам группы
        </Link>
      </>
    );
  }

  const ruzResult = await loadPublicRuzSchedule(slug, week);

  const now = new Date();
  const nowMoscowTime = formatInTimeZone(now, "Europe/Moscow", "HH:mm");
  const todayDateStr = formatInTimeZone(now, "Europe/Moscow", "yyyy-MM-dd");

  // Academic week calculation
  const moscowDate = new Date((ruzResult.weekStart || todayDateStr) + "T12:00:00+03:00");
  const sept1 = new Date("2026-09-01T12:00:00+03:00");
  const dayOfWeek = (sept1.getDay() + 6) % 7;
  const firstMonday = new Date(sept1);
  firstMonday.setDate(sept1.getDate() - dayOfWeek);
  const diffDays = Math.floor(
    (moscowDate.getTime() - firstMonday.getTime()) / 86400000,
  );
  const weekNumber = Math.max(1, Math.floor(diffDays / 7) + 1);
  const isEven = weekNumber % 2 === 0;
  const weekLabel = `${weekNumber}-я неделя · ${isEven ? "Чётная" : "Нечётная"}`;

  const days: WorkbenchDay[] =
    ruzResult.data?.days.map((d) => {
      const dDate = new Date(d.date + "T12:00:00+03:00");
      const short = formatInTimeZone(dDate, "Europe/Moscow", "EEEEEE", {
        locale: ru,
      });
      const dayLabel = short.charAt(0).toUpperCase() + short.slice(1);
      const dateLabel = formatInTimeZone(dDate, "Europe/Moscow", "d MMM", {
        locale: ru,
      }).replace(".", "");

      const lessons = d.lessons
        .filter((l) => showScheduleSubject(l.subject))
        .map((l) => {
          const matchedCourse = courses.find(
            (c) => subjectKey(c.title) === subjectKey(l.subject),
          );
          return {
            subject: l.subject,
            start: l.start,
            end: l.end,
            type: l.type,
            note: l.note,
            teachers: l.teachers,
            rooms: l.rooms,
            lmsUrl: l.lmsUrl,
            courseId: matchedCourse?.id,
            courseHref: matchedCourse
              ? `${base}/courses/${matchedCourse.id}`
              : undefined,
          };
        });

      return {
        date: d.date,
        dayLabel,
        dateLabel,
        isToday: d.date === todayDateStr,
        lessons,
      };
    }) ?? [];

  const workbenchTasks: WorkbenchTask[] = tasks.map((t) => {
    const d = t.deadlines[0];
    const timing = d
      ? calculateDeadlineStatus(d.date, now, false, d.isTimeStrict)
      : null;
    return {
      id: t.id,
      title: t.title,
      courseTitle: t.courseTitle,
      courseId: t.courseId,
      deadlineDate: d?.date,
      deadlineFormatted: timing?.formattedDate,
      urgency: timing?.urgency as any,
      completed: false,
      materials: t.materials.map((m) => ({ title: m.title })),
    };
  });

  const title = task
    ? task.title
    : course
      ? course.shortTitle
      : view[0] === "courses"
        ? "Предметы"
        : view[0] === "deadlines"
          ? "Работы и сроки"
          : view[0] === "schedule"
            ? "Расписание пар"
            : courses.length
              ? "Что по учёбе"
              : "Пары и предметы";

  const upcoming = tasks
    .filter((t) => t.deadlines[0] && t.deadlines[0].date >= new Date())
    .sort(
      (a, b) => a.deadlines[0].date.getTime() - b.deadlines[0].date.getTime(),
    );
  const overdue = tasks
    .filter((t) => t.deadlines[0] && t.deadlines[0].date < new Date())
    .sort(
      (a, b) => b.deadlines[0].date.getTime() - a.deadlines[0].date.getTime(),
    );
  const undated = tasks.filter((t) => !t.deadlines.length);
  const lists =
    view[0] === "deadlines"
      ? ([
          ["Предстоящие сроки", upcoming],
          ["Срок уже прошёл", overdue],
          ["Без указанной даты", undated],
        ] as const)
      : ([
          ["Ближайшие сроки", upcoming.slice(0, 3)],
          ["Можно приступать · без даты", undated.slice(0, 4)],
        ] as const);

  return (
    <>
      {view.length > 0 && (
        <div className="preview-context">
          <span>
            Гостевой просмотр · {group.track} {group.label} · {group.code}
          </span>
          <div className="preview-context-actions">
            <Link href={`${base}/courses`}>Все предметы ↗</Link>
            <Link href="/browse#groups">Сменить группу ↗</Link>
          </div>
        </div>
      )}

      {view.length > 0 && (
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              {courses[0]?.semester ?? "Учебное пространство группы"}
            </p>
            <h1 className={task ? "page-title preview-task-title" : "page-title"}>
              {title}
            </h1>
            <p className="page-intro">
              {course
                ? course.title
                : task
                  ? task.courseTitle
                  : tasks.length
                    ? "Общие работы и подтверждённые сроки — без регистрации."
                    : "Актуальное расписание, преподаватели и аудитории — по официальному РУЗ."}
            </p>
          </div>
        </div>
      )}

      {remoteSubjectId ? (
        <Suspense
          fallback={
            <p className="quiet-empty" role="status">
              Получаем предмет и занятия из РУЗ…
            </p>
          }
        >
          <PublicSubjectPage
            slug={slug}
            base={base}
            id={remoteSubjectId}
            week={week}
            courses={courses}
          />
        </Suspense>
      ) : task ? (
        <section>
          <p className="preview-task-date">
            {task.deadlines[0]
              ? `${task.deadlines[0].title || "Сдать до"}: ${calculateDeadlineStatus(task.deadlines[0].date, new Date(), false, task.deadlines[0].isTimeStrict).formattedDate}`
              : "Срок не указан"}
          </p>
          {task.description && (
            <div className="preview-description">{task.description}</div>
          )}
          {task.materials.length > 0 && (
            <div className="preview-materials">
              <h2>К работе прикреплены</h2>
              <ul>
                {task.materials.map((m, i) => (
                  <li key={i}>
                    <FileLock2 size={16} />
                    {m.title}
                  </li>
                ))}
              </ul>
              <p>
                Ссылки и исходные файлы доступны участникам группы после входа.
              </p>
            </div>
          )}
          <Link className="text-link" href={`${base}/courses/${task.courseId}`}>
            Всё по предмету ↗
          </Link>
        </section>
      ) : course ? (
        <>
          <div className="section-heading">
            <h2>
              Общие работы <span className="count">{course.tasks.length}</span>
            </h2>
          </div>
          <div className="work-list">
            {course.tasks.map((t) => (
              <PublicTaskRow key={t.id} task={t} base={base} />
            ))}
          </div>
          {!course.tasks.length && (
            <p className="quiet-empty">
              Общих опубликованных работ пока нет. Это не означает, что заданий
              на занятиях не было.
            </p>
          )}
          <p className="preview-explainer">
            Опубликованных записей занятий: {course.lessonCount}. Журнал,
            исходные материалы и записи открываются участникам группы после
            входа.
          </p>
          <Suspense
            fallback={
              <p role="status" className="quiet-empty">
                Получаем расписание предмета…
              </p>
            }
          >
            <PublicCourseSchedule
              slug={slug}
              courseTitle={course.title}
              week={week}
            />
          </Suspense>
        </>
      ) : view[0] === "courses" ? (
        <Suspense
          fallback={
            <p role="status" className="quiet-empty">
              Получаем предметы из РУЗ…
            </p>
          }
        >
          <PublicSubjects
            slug={slug}
            base={base}
            courses={courses}
            week={week}
          />
        </Suspense>
      ) : view[0] === "schedule" ? (
        <PublicScheduleView
          slug={slug}
          base={base}
          rawWeek={week}
          courses={courses.map((c) => ({ id: c.id, title: c.title }))}
        />
      ) : view[0] === "deadlines" ? (
        <>
          {lists.map(([label, items]) => (
            <section className="preview-task-section" key={label}>
              <div className="section-heading">
                <h2>
                  {label}
                  <span className="count">{items.length}</span>
                </h2>
              </div>
              {items.length ? (
                <div className="work-list">
                  {items.map((t) => (
                    <PublicTaskRow key={t.id} task={t} base={base} />
                  ))}
                </div>
              ) : (
                <p className="quiet-empty">Работ в этом разделе пока нет.</p>
              )}
            </section>
          ))}
        </>
      ) : (
        /* SCHEDULE-FIRST DEFAULT WORKBENCH VIEW */
        <div className="space-y-8">
          <ScheduleWorkbench
            groupCode={group.code}
            weekLabel={weekLabel}
            days={days}
            tasks={workbenchTasks}
            totalXp={45}
            isGuest={true}
            publicBase={base}
            fetchedAt={ruzResult.fetchedAt}
            scheduleState={ruzResult.state}
            sourceUrl={ruzResult.data ? sourceUrl(ruzResult.data) : undefined}
            nowMoscowTime={nowMoscowTime}
            todayDateStr={todayDateStr}
          />

          {/* RUZ Live Subjects for empty groups or browsing */}
          <Suspense
            fallback={
              <p role="status" className="quiet-empty">
                Получаем предметы из РУЗ…
              </p>
            }
          >
            <PublicSubjects
              slug={slug}
              base={base}
              courses={courses}
              week={week}
            />
          </Suspense>

          <div className="flex items-center justify-between pt-4 text-xs font-mono text-[var(--ink-muted)]">
            <span>
              Показаны официальные данные РУЗ СПбПУ для группы {group.code}
            </span>
            <Link className="text-link" href={`${base}/courses`}>
              Все предметы группы ({courses.length}) ↗
            </Link>
          </div>
        </div>
      )}

      <aside className="preview-account-note mt-8">
        <div>
          <strong>Хотите вести свой прогресс?</strong>
          <p>
            Войдите через Google с приглашением старосты: появятся файлы, личные
            отметки, XP и подключение календаря.
          </p>
        </div>
        <Link className="action-primary" href="/login">
          Войти в группу ↗
        </Link>
      </aside>
    </>
  );
}
