import { StudyTaskRow } from "@/components/study/StudyTaskRow";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { courseDestination } from "@/server/domain/academic-aliases";
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
import { CourseJournal } from "@/components/workspace/CourseJournal";
import { canEditCourse } from "@/server/domain/lessons";
import { MaterialForm } from "@/components/workspace/LessonForm";

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; type?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab =
    query.type || query.tab === "classes"
      ? "classes"
      : query.tab === "materials"
        ? "materials"
        : "work";
  const user = await requireCurrentUser();
  const destination = await courseDestination(user, id);
  if (destination) redirect(`/courses/${destination}`);
  const offering = await prisma.courseOffering.findFirst({
    where: {
      id,
      status: "ACTIVE",
      mergedIntoId: null,
      groups: { some: { groupId: user.groupId } },
    },
    include: {
      courseDefinition: true,
      semester: true,
      teachers: { include: { teacher: true } },
      materials: true,
      sessions: {
        where: { status: { in: ["PUBLISHED", "CANCELLED"] } },
        orderBy: { sessionDate: "desc" },
        take: 200,
        include: {
          context: { select: { coverage: true, audienceNote: true } },
          _count: {
            select: { transcripts: true, materials: true, tasks: true },
          },
        },
      },
      tasks: {
        where: await taskVisibilityWhere(user),
        orderBy: [{ number: "asc" }, { createdAt: "asc" }],
        include: {
          materials: {
            include: {
              material: {
                select: { id: true, title: true, url: true, type: true },
              },
            },
          },
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
  const done = offering.tasks.filter(
    (t) =>
      isTrustedAccepted(t.progress[0]) ||
      ["READY", "SUBMITTED"].includes(t.progress[0]?.status ?? ""),
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
        <Link
          href={`/courses/${id}?tab=classes`}
          aria-current={tab === "classes" ? "page" : undefined}
        >
          Занятия <span className="count">{offering.sessions.length}</span>
        </Link>
        <Link
          href={`/courses/${id}?tab=work`}
          aria-current={tab === "work" ? "page" : undefined}
        >
          Работы <span className="count">{offering.tasks.length}</span>
        </Link>
        <Link
          href={`/courses/${id}?tab=materials`}
          aria-current={tab === "materials" ? "page" : undefined}
        >
          Библиотека
        </Link>
        <a href="#about">О предмете</a>
      </nav>
      <div className="workspace-grid">
        <section>
          {tab === "classes" && (
            <>
              <CourseJournal
                id={id}
                lessons={offering.sessions}
                filter={query.type}
              />
              {canEditCourse(user, id) && (
                <Link
                  className="text-link mt-6 block"
                  href={`/lessons/new?course=${id}`}
                >
                  Добавить занятие ↗
                </Link>
              )}
              <Link
                className="text-link mt-5 block"
                href={`/proposals/new?course=${id}`}
              >
                Дополнить историю предмета ↗
              </Link>
            </>
          )}
          {tab === "materials" && (
            <>
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
                    Файлы и ссылки ещё не добавлены. Источники конкретных
                    заданий — внутри работ.
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
            </>
          )}
          {tab === "work" &&
            offering.materials.some(
              (m) =>
                m.type === "SOURCE_CODE" && /\.exe(?:\.zip)?$/i.test(m.title),
            ) && (
              <section className="course-tools mb-7">
                <h2>Программы для работ</h2>
                <p>Windows · исходные файлы из учебных материалов</p>
                <div className="work-files">
                  {offering.materials
                    .filter(
                      (m) =>
                        m.type === "SOURCE_CODE" &&
                        /\.exe(?:\.zip)?$/i.test(m.title),
                    )
                    .map((m) => (
                      <a className="work-file" key={m.id} href={m.url}>
                        {m.title} ↓
                      </a>
                    ))}
                </div>
              </section>
            )}
          {tab === "work" && (
            <section id="work">
              <div className="section-heading">
                <h2>Ваши работы</h2>
                <span className="text-xs text-slate-400">
                  {done} из {offering.tasks.length} выполнено
                </span>
              </div>
              {offering.tasks.length ? (
                <div className="work-list">
                  {offering.tasks.map((task, index) => {
                    const progress = task.progress[0];
                    const accepted = isTrustedAccepted(progress);
                    const completed =
                      accepted ||
                      ["READY", "SUBMITTED"].includes(progress?.status ?? "");
                    const deadline = task.deadlines[0];
                    const timing = calculateDeadlineStatus(
                      deadline?.date ?? null,
                      new Date(),
                      completed,
                      deadline?.isTimeStrict ?? true,
                    );
                    const variant = variants.get(task.id);
                    return (
                      <StudyTaskRow
                        key={task.id}
                        showCourse={false}
                        task={{
                          ...task,
                          courseId: id,
                          courseCode: offering.courseDefinition.code,
                          courseShortTitle:
                            offering.courseDefinition.shortTitle,
                          courseTitle: offering.courseDefinition.title,
                          userProgress: progress,
                          accepted,
                          completed,
                          deadline: deadline ?? null,
                          timing,
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="quiet-empty">
                  <p className="text-slate-200 text-lg mb-2">
                    Опубликованных работ пока нет
                  </p>
                  <p>
                    В приложении ещё нет доступных вам заданий по этому
                    предмету. Это не означает, что заданий не было на занятии.
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
            </section>
          )}
        </section>
        <aside className="workspace-aside">
          <section>
            <h2>Мой прогресс</h2>
            <p>
              <span className="text-2xl text-slate-100 mr-1">{done}</span> из{" "}
              {offering.tasks.length} работ выполнено
            </p>
            {offering.tasks.length > 0 && (
              <div className="course-progress" aria-hidden="true">
                {offering.tasks.map((t) => (
                  <span
                    key={t.id}
                    className={
                      isTrustedAccepted(t.progress[0]) ||
                      ["READY", "SUBMITTED"].includes(
                        t.progress[0]?.status ?? "",
                      )
                        ? "done"
                        : ""
                    }
                  />
                ))}
              </div>
            )}
            <p>
              Отмечайте выполненные работы сами. Староста может подтвердить
              отметку или вернуть работу на доработку.
            </p>
          </section>
          <section id="about">
            <h2>О предмете</h2>
            {offering.format && <p className="mb-4">{offering.format}</p>}
            {offering.teachers.length ? (
              offering.teachers.map((t) => (
                <div className="teacher-line" key={t.id}>
                  {t.teacher.fullName}
                  {t.teacher.email && (
                    <a
                      className="text-link block mt-1"
                      href={`mailto:${t.teacher.email}`}
                    >
                      {t.teacher.email}
                    </a>
                  )}
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
