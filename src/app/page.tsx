import Link from "next/link";
import { chooseFocus } from "@/lib/study/priority";
import { ArrowRight, ArrowUpRight, CornerDownRight } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/checker";
import { isTrustedAccepted } from "@/server/domain/trust";
import {
  loadStudyWorkspace,
  byDeadline,
  progressLabel,
} from "@/server/queries/study-workspace";
import { StudyTaskRow } from "@/components/study/StudyTaskRow";
import { FluidRibbon } from "@/components/study/FluidRibbon";
import { CreateTaskModal } from "@/components/task/CreateTaskModal";
import { formatInTimeZone } from "date-fns-tz";

export default async function TodayPage() {
  const user = await requireCurrentUser();
  const { offerings, tasks, now } = await loadStudyWorkspace(user);
  const day = formatInTimeZone(now, "Europe/Moscow", "yyyy-MM-dd");
  const dayStart = new Date(`${day}T00:00:00+03:00`);
  const todayLessons = await prisma.classSession.findMany({
    where: {
      status: { in: ["PUBLISHED", "CANCELLED"] },
      sessionDate: {
        gte: dayStart,
        lt: new Date(dayStart.getTime() + 86400000),
      },
      courseOffering: { groups: { some: { groupId: user.groupId } } },
    },
    include: { courseOffering: { include: { courseDefinition: true } } },
    orderBy: { sessionDate: "asc" },
    take: 10,
  });
  const [announcements, changes] = await Promise.all([
    prisma.announcement.findMany({
      where: { groupId: user.groupId, status: "PUBLISHED" },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: 3,
      include: { sourceReference: { include: { source: true } } },
    }),
    prisma.notification.findMany({
      where: {
        userId: user.id,
        isRead: false,
        OR: [{ groupId: user.groupId }, { groupId: null }],
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);
  const open = tasks.filter((t) => !t.accepted);
  const overdue = open
    .filter((t) => t.timing.urgency === "OVERDUE")
    .sort(byDeadline);
  const upcoming = open
    .filter((t) => t.deadline && t.timing.urgency !== "OVERDUE")
    .sort(byDeadline);
  const active = open
    .filter((t) =>
      ["IN_PROGRESS", "READY", "NEEDS_FIX"].includes(
        t.userProgress?.status ?? "",
      ),
    )
    .sort(byDeadline);
  const focus = chooseFocus(tasks);
  const otherActive = active.filter((t) => t.id !== focus?.id);
  const accepted = tasks.filter((t) => t.accepted).length;
  const submitted = tasks.filter(
    (t) => t.userProgress?.status === "SUBMITTED",
  ).length;
  const courseOrder = [...offerings].sort((a, b) => {
    const rank = (id: string) =>
      tasks.filter((t) => t.courseId === id && !t.accepted).length ? 0 : 1;
    return rank(a.id) - rank(b.id);
  });
  const date = now.toLocaleDateString("ru-RU", {
    timeZone: "Europe/Moscow",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{date}</p>
          <h1 className="page-title">Сегодня</h1>
          <p className="page-intro">
            {user.groupName ?? "Ваша группа"} · работы, ближайшие сроки и
            новости.
          </p>
        </div>
        {hasPermission(user, "manage_tasks") && offerings.length > 0 && (
          <div className="heading-action">
            <CreateTaskModal
              courses={offerings.map((o) => ({
                id: o.id,
                title: o.courseDefinition.title,
                shortTitle: o.courseDefinition.shortTitle,
              }))}
            />
          </div>
        )}
      </div>
      <section className="mb-8 border-b border-slate-700 pb-6">
        <div className="section-heading">
          <h2>Сегодня на занятиях</h2>
          <Link className="text-link" href="/lessons">
            Занятия и записи ↗
          </Link>
        </div>
        {todayLessons.length ? (
          <div className="divide-y divide-slate-800">
            {todayLessons.map((lesson) => (
              <Link
                key={lesson.id}
                className="flex gap-4 py-3 items-baseline text-sm"
                href={`/lessons/${lesson.id}`}
              >
                <span className="font-mono text-blue-200 shrink-0">
                  {lesson.status === "CANCELLED"
                    ? "Отменено"
                    : lesson.isTimeKnown
                      ? formatInTimeZone(
                          lesson.sessionDate,
                          "Europe/Moscow",
                          "HH:mm",
                        )
                      : "Время уточняется"}
                </span>
                <span className="min-w-0">
                  <strong className="font-medium text-slate-200">
                    {lesson.courseOffering.courseDefinition.shortTitle}
                  </strong>
                  <span className="block text-slate-400 mt-1">
                    {lesson.topic ?? "Занятие"}
                    {lesson.room ? ` · ${lesson.room}` : ""}
                  </span>
                </span>
                <span className="ml-auto">↗</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Расписание на сегодня ещё не добавлено. Это не означает, что занятий
            нет.
          </p>
        )}
        {hasPermission(user, "manage_courses") && offerings.length === 0 && (
          <Link className="action-primary mt-5" href="/group">
            Добавить первый предмет
          </Link>
        )}
      </section>
      <div className="daily-grid">
        <section className="daily-focus" aria-label="На чём сосредоточиться">
          <div className="focus-sheet">
            <FluidRibbon />
            <p className="eyebrow">
              {focus
                ? ["IN_PROGRESS", "READY", "NEEDS_FIX"].includes(
                    focus.userProgress?.status ?? "",
                  )
                  ? "Продолжить работу"
                  : focus.timing.urgency === "OVERDUE"
                    ? "Вернуться к работе"
                    : "Следующий шаг"
                : tasks.length
                  ? "На сегодня"
                  : "Ваше пространство"}
            </p>
            <h2>
              {focus
                ? focus.title
                : tasks.length
                  ? "Все работы отправлены или зачтены"
                  : "Начните с предмета"}
            </h2>
            <p>
              {focus
                ? focus.deadline
                  ? `${focus.courseShortTitle} · ${focus.timing.badgeLabel}`
                  : `${focus.courseShortTitle} · срок пока не указан`
                : tasks.length
                  ? "Проверяйте результаты и объявления группы здесь."
                  : "Опубликованные задания появятся здесь. Пока можно посмотреть, что есть по вашим предметам."}
            </p>
            {focus && (
              <div className="focus-meta">
                <span>
                  {focus.deadline
                    ? `Срок: ${focus.timing.formattedDate}`
                    : "Можно работать без привязки к дате"}
                </span>
                <span>· {progressLabel(focus)}</span>
              </div>
            )}
            <div className="focus-actions">
              <Link
                className="action-primary"
                href={focus ? `/tasks/${focus.id}` : "/courses"}
              >
                {focus ? (
                  <>
                    <span className="hidden sm:inline">Открыть работу</span>
                    <span className="sm:hidden">К работе</span>
                  </>
                ) : (
                  "К предметам"
                )}
                <ArrowRight size={17} />
              </Link>
              {focus && (
                <Link className="text-link" href={`/courses/${focus.courseId}`}>
                  <span className="hidden sm:inline">Всё по предмету</span>
                  <span className="sm:hidden">К предмету</span>
                  <ArrowUpRight size={15} />
                </Link>
              )}
            </div>
          </div>
          {overdue.length > 0 && (
            <div className="overdue-note">
              <CornerDownRight size={17} />
              <span>
                Срок прошёл: {overdue.length}. Зачёт не отмечен.{" "}
                <Link href="/deadlines#overdue">Разобраться со сроками</Link>
              </span>
            </div>
          )}
          <div className="progress-summary" aria-label="Мой учебный прогресс">
            <div>
              <strong>
                {accepted}
                <span>зачтено из {tasks.length}</span>
              </strong>
            </div>
            <div>
              <strong>
                {active.length}
                <span>в работе</span>
              </strong>
            </div>
            <div>
              <strong>
                {submitted}
                <span>на проверке</span>
              </strong>
            </div>
            <Link
              href="/analytics"
              className="text-link"
              aria-label="Подробнее о моём прогрессе"
            >
              <ArrowUpRight size={19} />
            </Link>
          </div>
          {otherActive.length > 0 && (
            <div className="mt-6">
              {otherActive.slice(0, 2).map((task) => (
                <StudyTaskRow key={task.id} task={task} showDate={false} />
              ))}
            </div>
          )}
        </section>
        <section className="daily-deadlines">
          <div className="section-heading">
            <h2>
              Впереди<span className="count">{upcoming.length}</span>
            </h2>
            <Link className="text-link" href="/deadlines">
              Все сроки
              <ArrowUpRight size={15} />
            </Link>
          </div>
          {upcoming.length ? (
            <>
              {upcoming.slice(0, 3).map((task) => (
                <StudyTaskRow key={task.id} task={task} />
              ))}
              {!upcoming.some(
                (t) => (t.timing.daysRemaining ?? Infinity) <= 7,
              ) && (
                <p className="text-xs text-slate-400 leading-relaxed mt-4">
                  На ближайшие 7 дней подтверждённых сроков нет.
                </p>
              )}
            </>
          ) : (
            <p className="quiet-empty">
              Предстоящие сроки пока не указаны. Задания без даты доступны в
              предметах.
            </p>
          )}
        </section>
        <section className="daily-courses">
          <div className="section-heading">
            <h2>
              Мои предметы<span className="count">{offerings.length}</span>
            </h2>
            <Link className="text-link" href="/courses">
              Все предметы
              <ArrowUpRight size={15} />
            </Link>
          </div>
          {courseOrder.slice(0, 5).map((o) => {
            const done = o.tasks.filter((t) =>
              isTrustedAccepted(t.progress[0]),
            ).length;
            return (
              <Link
                className={`course-line compact ${courseOrder.indexOf(o) > 2 ? "mobile-extra" : ""}`}
                key={o.id}
                href={`/courses/${o.id}`}
              >
                <span className="course-code">
                  {o.courseDefinition.shortTitle}
                </span>
                <span className="course-name">
                  {o.courseDefinition.title}
                  <span className="block text-slate-400 mt-1">
                    {o.tasks.length
                      ? `${done} из ${o.tasks.length} зачтено`
                      : "Задания пока не опубликованы"}
                  </span>
                </span>
                <ArrowUpRight size={16} className="text-slate-500" />
              </Link>
            );
          })}
          {!offerings.length && (
            <p className="quiet-empty">
              Предметы текущего семестра ещё не добавлены.
            </p>
          )}
        </section>
        <section className="daily-changes">
          <div className="section-heading">
            <h2>В группе</h2>
            <Link className="text-link" href="/notifications">
              Изменения
              <ArrowUpRight size={15} />
            </Link>
          </div>
          {changes.map((change) => (
            <Link href="/notifications" key={change.id} className="change-link">
              <span className="eyebrow !text-blue-300">Непрочитанное</span>
              {change.title}
              <span>{change.message}</span>
            </Link>
          ))}
          {announcements.map((a) => (
            <article key={a.id} className="announcement-entry">
              <time dateTime={a.publishedAt?.toISOString()}>
                {a.publishedAt.toLocaleDateString("ru-RU", {
                  timeZone: "Europe/Moscow",
                  day: "numeric",
                  month: "long",
                })}
                {a.isPinned ? " · Закреплено" : ""}
              </time>
              <h3>{a.title}</h3>
              <p>{a.content}</p>
              {a.sourceReference && (
                <details className="mt-3 text-xs text-slate-400 leading-relaxed">
                  <summary className="min-h-8">
                    Источник ·{" "}
                    {a.sourceReference.confidence === "CONFIRMED"
                      ? "подтверждён"
                      : "требует проверки"}
                  </summary>
                  <p className="!text-xs mt-2">
                    {a.sourceReference.source.title}
                  </p>
                  <p className="!text-xs mt-2">{a.sourceReference.quoteText}</p>
                </details>
              )}
            </article>
          ))}
          {!announcements.length && !changes.length && (
            <p className="quiet-empty">
              Новых сообщений нет. Изменения сроков и результаты проверки
              появятся в уведомлениях.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
