import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { canEditCourse } from "@/server/domain/lessons";
import { Prisma } from "@prisma/client";
import { coverageLabels, lessonTypes } from "@/lib/study/lesson-context";
export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; page?: string }>;
}) {
  const user = await requireCurrentUser();
  const { course, page: rawPage } = await searchParams;
  const page = rawPage && /^[1-9]\d{0,3}$/.test(rawPage) ? Number(rawPage) : 1;
  const courses = await prisma.courseOffering.findMany({
    where: {
      status: "ACTIVE",
      mergedIntoId: null,
      groups: { some: { groupId: user.groupId } },
    },
    include: { courseDefinition: true },
  });
  const editable = courses
    .filter((c) => canEditCourse(user, c.id))
    .map((c) => c.id);
  const where: Prisma.ClassSessionWhereInput = {
    courseOffering: {
      status: "ACTIVE",
      mergedIntoId: null,
      groups: { some: { groupId: user.groupId } },
    },
    ...(course ? { courseOfferingId: course } : {}),
    OR: [
      { status: { in: ["PUBLISHED", "CANCELLED"] } },
      { courseOfferingId: { in: editable } },
    ],
  };
  const [lessons, total] = await Promise.all([
    prisma.classSession.findMany({
      where,
      include: {
        courseOffering: { include: { courseDefinition: true } },
        _count: { select: { transcripts: true, materials: true } },
        context: { select: { coverage: true, audienceNote: true } },
      },
      orderBy: [{ sessionDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * 50,
      take: 50,
    }),
    prisma.classSession.count({ where }),
  ]);
  const pageUrl = (n: number) =>
    `/lessons?${new URLSearchParams({ ...(course ? { course } : {}), page: String(n) })}`;
  return (
    <div className="max-w-5xl mx-auto">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{user.groupName}</p>
          <h1 className="page-title">Занятия и записи</h1>
          <p className="page-intro">
            Восстановите контекст: что проходили, что задано, где запись и
            материалы.
          </p>
        </div>
        {editable.length > 0 && (
          <Link
            className="action-primary"
            href={`/lessons/new${course ? `?course=${encodeURIComponent(course)}` : ""}`}
          >
            Добавить занятие
          </Link>
        )}
      </header>
      <form className="flex gap-3 mb-7">
        <select
          name="course"
          aria-label="Предмет"
          defaultValue={course ?? ""}
          className="min-w-0 min-h-12 flex-1 rounded-xl border border-[rgba(11,26,45,0.15)] bg-white px-4 text-[#0b1a2d] focus:outline-none focus:border-[#962640]"
        >
          <option value="">Все предметы</option>
          {courses.map((c) => (
            <option value={c.id} key={c.id}>
              {c.courseDefinition.shortTitle}
            </option>
          ))}
        </select>
        <button className="action-primary">Показать</button>
      </form>
      {lessons.length ? (
        <div>
          {lessons.map((lesson) => (
            <Link
              className="study-row"
              key={lesson.id}
              href={`/lessons/${lesson.id}`}
            >
              <div className="study-row-main">
                <p className="eyebrow !tracking-normal mb-2">
                  {lesson.courseOffering.courseDefinition.shortTitle} ·{" "}
                  {formatInTimeZone(
                    lesson.sessionDate,
                    "Europe/Moscow",
                    lesson.isTimeKnown ? "dd.MM.yyyy · HH:mm" : "dd.MM.yyyy",
                  )}
                  {lesson.status === "DRAFT"
                    ? " · Черновик"
                    : lesson.status === "CANCELLED"
                      ? " · Отменено"
                      : ""}
                </p>
                <h2 className="study-row-title">{lesson.topic ?? "Занятие"}</h2>
                <p className="study-row-meta">
                  {lessonTypes[lesson.type]}
                  {lesson.context?.audienceNote
                    ? ` · ${lesson.context.audienceNote}`
                    : ""}
                  {lesson.context
                    ? ` · ${coverageLabels[lesson.context.coverage]}`
                    : ""}
                  {lesson.recordingUrl ? "Есть запись" : ""}
                  {lesson._count.transcripts ? " · Есть текст" : ""}
                  {lesson._count.materials
                    ? ` · Материалов: ${lesson._count.materials}`
                    : ""}
                </p>
              </div>
              <span aria-hidden>↗</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="quiet-empty">
          <p className="text-lg text-slate-200 mb-3">
            Занятия пока не добавлены
          </p>
          <p>
            Это не означает, что сегодня нет пар. Староста может добавить дату
            из расписания, затем прикрепить запись и текст после занятия.
          </p>
        </div>
      )}
      {total > 50 && (
        <nav
          className="flex flex-wrap gap-5 mt-8 text-sm"
          aria-label="Страницы занятий"
        >
          {page > 1 && (
            <Link className="text-link" href={pageUrl(page - 1)}>
              ← Назад
            </Link>
          )}
          <span className="text-slate-400">
            Страница {page} из {Math.ceil(total / 50)} · занятий: {total}
          </span>
          {page * 50 < total && (
            <Link className="text-link" href={pageUrl(page + 1)}>
              Далее →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
