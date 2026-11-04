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
import { requestedWeek } from "@/lib/schedule/ruz";
import { calculateDeadlineStatus } from "@/server/services/deadline-service";

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
      <div className="preview-context">
        <span>
          Гостевой просмотр · {group.track} {group.label} · {group.code}
        </span>
        <div className="preview-context-actions">
          <Link href={`${base}/schedule`}>Расписание ↗</Link>
          <Link href="/browse#groups">Сменить группу ↗</Link>
        </div>
      </div>
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
      ) : (
        <>
          {!view.length && tasks.length > 0 && (
            <div className="preview-overview">
              <p>
                Работ: <strong>{tasks.length}</strong> · Предметов:{" "}
                {courses.length}
              </p>
              <Link className="text-link" href={`${base}/schedule`}>
                Пары и аудитории · расписание ↗
              </Link>
            </div>
          )}
          {courses.length > 0 &&
            lists.map(([label, items]) => (
              <section className="preview-task-section" key={label}>
                <div className="section-heading">
                  <h2>
                    {label}
                    <span className="count">{items.length}</span>
                  </h2>
                  {!view.length && (
                    <Link className="text-link" href={`${base}/deadlines`}>
                      Все работы ↗
                    </Link>
                  )}
                </div>
                {items.length ? (
                  <div className="work-list">
                    {items.map((t) => (
                      <PublicTaskRow key={t.id} task={t} base={base} />
                    ))}
                  </div>
                ) : (
                  <p className="quiet-empty">
                    {label.includes("срок")
                      ? "Подтверждённых дат в этом разделе пока нет."
                      : "Работ в этом разделе пока нет."}
                  </p>
                )}
              </section>
            ))}
          {!view.length && (
            <Suspense
              fallback={
                <p role="status" className="quiet-empty">
                  Получаем расписание РУЗ…
                </p>
              }
            >
              <PublicSubjects
                slug={slug}
                base={base}
                courses={courses}
                week={week}
                showSchedule
              />
            </Suspense>
          )}
          {!view.length && overdue.length > 0 && (
            <p className="preview-explainer">
              Ещё {overdue.length} работ с прошедшей датой —{" "}
              <Link href={`${base}/deadlines`}>в полном списке</Link>. Гостевой
              режим не знает, какие из них вы уже выполнили.
            </p>
          )}
        </>
      )}
      {!tasks.length && view[0] === "deadlines" && (
        <p className="quiet-empty">
          Задания и сроки этой группы пока не опубликованы.{" "}
          <Link href={`${base}/courses`}>Предметы</Link> и{" "}
          <Link href={`${base}/schedule`}>расписание</Link> уже можно
          посмотреть.
        </p>
      )}
      <aside className="preview-account-note">
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
