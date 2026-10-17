import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/checker";
import { taskVisibilityWhere } from "@/server/domain/access";
import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";
import {
  isTrustedAccepted,
  progressEvidenceInclude,
} from "@/server/domain/trust";
import { assignedVariants } from "@/server/domain/variants";
import { calculateDeadlineStatus } from "@/server/services/deadline-service";
import { CreateTaskModal } from "@/components/task/CreateTaskModal";
import { formatTaskStatus } from "@/lib/utils/formatters";
import { formatInTimeZone } from "date-fns-tz";
import { canEditCourse } from "@/server/domain/lessons";
import { MaterialForm } from "@/components/workspace/LessonForm";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const offering = await prisma.courseOffering.findFirst({
    where: { id, groups: { some: { groupId: user.groupId } } },
    include: {
      courseDefinition: true,
      semester: true,
      teachers: { include: { teacher: true } },
      materials: true,
      sessions: {
        where: { status: { in: ["PUBLISHED", "CANCELLED"] } },
        orderBy: { sessionDate: "desc" },
        take: 8,
      },
      tasks: {
        where: await taskVisibilityWhere(user),
        orderBy: [{ number: "asc" }, { createdAt: "asc" }],
        include: {
          deadlines: {
            where: confirmedDeadlineWhere,
            orderBy: { date: "asc" },
          },
          progress: {
            where: { userId: user.id },
            include: progressEvidenceInclude,
          },
        },
      },
    },
  });
  if (!offering) notFound();
  const variants = await assignedVariants(
    user,
    offering.tasks.map((t) => t.id),
  );
  const done = offering.tasks.filter((t) =>
    isTrustedAccepted(t.progress[0]),
  ).length;
  const canManage =
    hasPermission(user, "manage_tasks") ||
    user.permissions.includes(`manage_course:${id}`);
  const typeNames: Record<string, string> = {
    LABORATORY: "Лабораторная",
    HOMEWORK: "Домашняя работа",
    EXERCISE: "Упражнение",
    CALCULATION_WORK: "Расчётная работа",
    COURSE_PROJECT: "Курсовая работа",
    OTHER: "Задание",
  };
  return (
    <>
      <nav className="breadcrumb" aria-label="Путь">
        <Link href="/courses">
          <ArrowLeft size={14} />
          Предметы
        </Link>
        <span>/</span>
        <span>{offering.courseDefinition.shortTitle}</span>
      </nav>
      <header className="course-banner">
        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="eyebrow">
              {offering.courseDefinition.shortTitle} · {offering.semester.name}
            </p>
            <h1 className="page-title">{offering.courseDefinition.title}</h1>
          </div>
          {canManage && (
            <div className="hidden sm:block">
              <CreateTaskModal
                courseOfferingId={id}
                courses={[
                  {
                    id,
                    title: offering.courseDefinition.title,
                    shortTitle: offering.courseDefinition.shortTitle,
                  },
                ]}
              />
            </div>
          )}
        </div>
      </header>
      <nav className="course-nav" aria-label="Разделы предмета">
        <a href="#work">
          Работы{" "}
          <span className="text-slate-400 ml-1">{offering.tasks.length}</span>
        </a>
        <a href="#materials">Материалы</a>
        <a href="#lessons">Занятия и записи</a>
        <a href="#about">О предмете</a>
      </nav>
      <div className="workspace-grid">
        <section id="work">
          <div className="section-heading">
            <h2>Ваши работы</h2>
            <span className="text-xs text-slate-400">
              {done} из {offering.tasks.length} зачтено
            </span>
          </div>
          {offering.tasks.length ? (
            <div className="work-list">
              {offering.tasks.map((task, index) => {
                const progress = task.progress[0];
                const accepted = isTrustedAccepted(progress);
                const deadline = task.deadlines[0];
                const timing = calculateDeadlineStatus(
                  deadline?.date ?? null,
                  new Date(),
                  accepted,
                  deadline?.isTimeStrict ?? true,
                );
                const variant = variants.get(task.id);
                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="study-row"
                  >
                    <span className="work-number">
                      {task.number ?? index + 1}
                    </span>
                    <div className="study-row-main">
                      <p className="eyebrow !tracking-normal !normal-case !text-slate-400 mb-1">
                        {typeNames[task.type] ?? "Задание"}
                      </p>
                      <h3 className="study-row-title">{task.title}</h3>
                      <div className="study-row-meta">
                        <span>
                          {deadline ? timing.formattedDate : "Срок не указан"}
                        </span>
                        {variant && (
                          <span>Ваш вариант: {variant.variantNumber}</span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`study-row-end ${timing.urgency === "OVERDUE" ? "overdue" : ""}`}
                    >
                      <strong>{timing.badgeLabel}</strong>
                      <span>
                        {progress?.status === "ACCEPTED" && !accepted
                          ? "Нужна проверка"
                          : formatTaskStatus(progress?.status)}
                      </span>
                    </div>
                    <ArrowUpRight
                      size={16}
                      className="shrink-0 text-slate-500"
                    />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="quiet-empty">
              <p className="text-slate-200 text-lg mb-2">
                Опубликованных работ пока нет
              </p>
              <p>
                В приложении ещё нет доступных вам заданий по этому предмету.
                Это не означает, что заданий не было на занятии.
              </p>
            </div>
          )}
          {canManage && (
            <div className="sm:hidden mt-6">
              <CreateTaskModal
                courseOfferingId={id}
                courses={[
                  {
                    id,
                    title: offering.courseDefinition.title,
                    shortTitle: offering.courseDefinition.shortTitle,
                  },
                ]}
              />
            </div>
          )}
          <section id="lessons" className="mt-10">
            <div className="section-heading">
              <h2>Занятия и записи</h2>
              <Link className="text-link" href={`/lessons?course=${id}`}>
                Все занятия ↗
              </Link>
            </div>
            {offering.sessions.length ? (
              offering.sessions.map((lesson) => (
                <Link
                  className="study-row"
                  href={`/lessons/${lesson.id}`}
                  key={lesson.id}
                >
                  <div className="study-row-main">
                    <p className="study-row-title">
                      {lesson.topic ?? "Занятие"}
                    </p>
                    <p className="study-row-meta">
                      {formatInTimeZone(
                        lesson.sessionDate,
                        "Europe/Moscow",
                        "dd.MM.yyyy",
                      )}
                      {lesson.recordingUrl ? " · Есть запись" : ""}
                      {lesson.status === "CANCELLED" ? " · Отменено" : ""}
                    </p>
                  </div>
                  <span>↗</span>
                </Link>
              ))
            ) : (
              <p className="quiet-empty">
                Занятия ещё не добавлены. Здесь появятся темы, записи, материалы
                и текст, связанные с конкретной датой.
              </p>
            )}
            {canEditCourse(user, id) && (
              <Link
                className="text-link mt-5"
                href={`/lessons/new?course=${id}`}
              >
                Добавить занятие ↗
              </Link>
            )}
            <Link
              className="text-link mt-5 block"
              href={`/proposals/new?course=${id}`}
            >
              Предложить уточнение по предмету ↗
            </Link>
          </section>
        </section>
        <aside className="workspace-aside">
          <section>
            <h2>Мой прогресс</h2>
            <p>
              <span className="text-2xl text-slate-100 mr-1">{done}</span> из{" "}
              {offering.tasks.length} работ зачтено
            </p>
            {offering.tasks.length > 0 && (
              <div className="course-progress" aria-hidden="true">
                {offering.tasks.map((t) => (
                  <span
                    key={t.id}
                    className={isTrustedAccepted(t.progress[0]) ? "done" : ""}
                  />
                ))}
              </div>
            )}
            <p>
              Зачёт учитывается после независимого подтверждения результата.
            </p>
          </section>
          <section id="materials">
            <h2>Материалы</h2>
            {offering.materials.length ? (
              offering.materials.map((m) => (
                <a
                  key={m.id}
                  className="text-link !flex"
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {m.title}
                  <ArrowUpRight size={15} />
                </a>
              ))
            ) : (
              <p>
                Файлы и ссылки ещё не добавлены. Источники конкретных заданий —
                внутри работ.
              </p>
            )}
            <Link
              className="text-link mt-2"
              href={`/transcripts?course=${encodeURIComponent(offering.courseDefinition.code)}`}
            >
              Стенограммы занятий
              <ArrowUpRight size={15} />
            </Link>
            {canEditCourse(user, id, "manage_materials") && (
              <details className="mt-5">
                <summary className="text-link cursor-pointer min-h-11">
                  Добавить материал
                </summary>
                <div className="mt-4">
                  <MaterialForm courseId={id} />
                </div>
              </details>
            )}
          </section>
          <section id="about">
            <h2>О предмете</h2>
            {offering.format && <p className="mb-4">{offering.format}</p>}
            {offering.teachers.length ? (
              offering.teachers.map((t) => (
                <div className="teacher-line" key={t.id}>
                  {t.teacher.fullName}
                  {t.role && (
                    <span className="block text-slate-400 text-xs">
                      {t.role}
                    </span>
                  )}
                  {t.status !== "CONFIRMED" && (
                    <small>
                      {t.status === "DISPUTED"
                        ? "Сведения противоречивы · нужно уточнить"
                        : "Связь с предметом не подтверждена источником"}
                    </small>
                  )}
                </div>
              ))
            ) : (
              <p>Сведения о преподавателе пока не добавлены.</p>
            )}
            {offering.softwareRequired && (
              <p className="mt-5">{offering.softwareRequired}</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
