import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { canEditCourse } from "@/server/domain/lessons";
import { taskVisibilityWhere } from "@/server/domain/access";
import { LessonForm, MaterialForm } from "@/components/workspace/LessonForm";
import { OperationForm } from "@/components/workspace/OperationForm";
import { transcriptNotesAction } from "@/server/actions/proposal-actions";
import { HighlightedText } from "@/components/text/HighlightedText";
import {
  coverageLabels,
  lessonTypes,
  parseLessonEvidence,
} from "@/lib/study/lesson-context";
export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; version?: string }>;
}) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const { q, version } = await searchParams;
  const visible = await taskVisibilityWhere(user);
  const lesson = await prisma.classSession.findFirst({
    where: {
      id,
      courseOffering: { groups: { some: { groupId: user.groupId } } },
    },
    include: {
      context: true,
      courseOffering: { include: { courseDefinition: true } },
      teacher: { select: { fullName: true } },
      transcripts: { orderBy: { createdAt: "desc" } },
      tasks: {
        where: { task: visible },
        include: { task: { select: { id: true, title: true } } },
      },
      materials: { include: { material: true } },
    },
  });
  if (!lesson) notFound();
  const edit = canEditCourse(user, lesson.courseOfferingId);
  if (!["PUBLISHED", "CANCELLED"].includes(lesson.status) && !edit) notFound();
  const tasks = edit
    ? await prisma.task.findMany({
        where: {
          AND: [visible, { courseOfferingId: lesson.courseOfferingId }],
        },
        select: { id: true, title: true },
      })
    : [];
  const shownTranscript =
    lesson.transcripts.find((t) => t.id === version) ?? lesson.transcripts[0];
  const evidence = parseLessonEvidence(lesson.context?.evidence);
  const history = await prisma.auditLog.findMany({
    where: {
      entityType: "CLASS_SESSION",
      entityId: id,
      action: { in: ["CREATE_LESSON", "UPDATE_LESSON"] },
      details: { path: ["groupId"], equals: user.groupId },
    },
    include: { user: { select: { nickname: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return (
    <div className="max-w-4xl mx-auto space-y-9">
      <nav className="breadcrumb">
        <Link href={`/courses/${lesson.courseOfferingId}`}>
          {lesson.courseOffering.courseDefinition.shortTitle}
        </Link>
        <span>/</span>
        <Link href="/lessons">Занятия</Link>
      </nav>
      <header>
        <p className="eyebrow">
          {lessonTypes[lesson.type]} ·{" "}
          {formatInTimeZone(
            lesson.sessionDate,
            "Europe/Moscow",
            lesson.isTimeKnown
              ? "dd.MM.yyyy · HH:mm"
              : "dd.MM.yyyy · время не указано",
          )}
          {lesson.endsAt
            ? ` — ${formatInTimeZone(lesson.endsAt, "Europe/Moscow", "HH:mm")}`
            : ""}
        </p>
        <h1 className="page-title">{lesson.topic ?? "Занятие"}</h1>
        <p className="page-intro">
          {lesson.taughtBy ??
            lesson.teacher?.fullName ??
            "Кто проводил — уточняется"}
          {lesson.room ? ` · ${lesson.room}` : ""}
        </p>
        {lesson.context && (
          <p className="text-sm text-blue-200 mt-4">
            {coverageLabels[lesson.context.coverage]}
            {lesson.context.audienceNote
              ? ` · ${lesson.context.audienceNote}`
              : ""}
          </p>
        )}
        {lesson.context?.coverage === "SCHEDULE_ONLY" && (
          <p className="text-sm text-slate-400 mt-4">
            Пара указана в расписании. Подтверждения проведения и содержания
            пока нет. Тема, домашнее задание и отсутствие домашней работы из
            расписания не следуют.
          </p>
        )}
        {lesson.status !== "PUBLISHED" && (
          <p className="mt-4 text-rose-200">
            {lesson.status === "CANCELLED"
              ? "Занятие отменено"
              : lesson.status === "DRAFT"
                ? "Черновик · виден редакторам предмета"
                : "Архивная запись"}
          </p>
        )}
      </header>
      <div className="flex flex-wrap gap-5">
        {lesson.recordingUrl && (
          <a
            className="action-primary"
            href={lesson.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть запись ↗
          </a>
        )}
        <Link
          className="text-link"
          href={`/proposals/new?course=${lesson.courseOfferingId}&lesson=${id}`}
        >
          Предложить уточнение ↗
        </Link>
      </div>
      <nav className="lesson-filters" aria-label="Разделы занятия">
        <a href="#overview">Обзор</a>
        {lesson.context?.guideText && <a href="#guide">Памятка</a>}
        {lesson.context?.assignmentNotes && (
          <a href="#assignment">Что задано</a>
        )}
        <a href="#materials">Материалы</a>
        {lesson.transcripts.length > 0 && (
          <a href="#transcript">Текст занятия</a>
        )}
      </nav>
      <section id="overview">
        <h2 className="text-xl mb-4">Что проходили</h2>
        {lesson.summary ? (
          <p className="whitespace-pre-wrap leading-relaxed text-slate-300">
            {lesson.summary}
          </p>
        ) : (
          <p className="text-slate-400">
            Краткий итог пока не добавлен. Можно открыть запись или текст
            занятия.
          </p>
        )}
        {lesson.notes && (
          <p className="whitespace-pre-wrap text-slate-400 mt-4">
            {lesson.notes}
          </p>
        )}
      </section>
      {lesson.context?.guideText && (
        <section className="lesson-guide" id="guide">
          <div className="section-heading">
            <h2>Разбор и памятка к занятию</h2>
            <a className="text-link" href={`/api/lessons/${id}/guide`}>
              Скачать текст ↓
            </a>
          </div>
          <p className="text-xs text-slate-400">
            Составлено для Student Value по указанным ниже материалам. Это
            учебное объяснение, а не новый документ преподавателя. Схемы,
            таблицы сигналов и точные требования сверяйте с оригиналом.
          </p>
          {lesson.context.guideText
            .split("\n\n")
            .map((part, i) =>
              part.startsWith("## ") ? (
                <h3 key={i}>{part.slice(3)}</h3>
              ) : (
                <p key={i}>{part}</p>
              ),
            )}
        </section>
      )}
      {lesson.context?.assignmentNotes && (
        <section id="assignment">
          <h2 className="text-xl mb-4">Что делать после занятия</h2>
          <p className="whitespace-pre-wrap text-slate-300 leading-relaxed">
            {lesson.context.assignmentNotes}
          </p>
        </section>
      )}
      <section id="related-work">
        <h2 className="text-xl mb-3">Связанные работы</h2>
        {lesson.tasks.length ? (
          lesson.tasks.map((link) => (
            <Link
              key={link.id}
              className="study-row"
              href={`/tasks/${link.task.id}`}
            >
              <span>{link.task.title}</span>
              <span>↗</span>
            </Link>
          ))
        ) : (
          <p className="text-slate-400">
            Работы ещё не связаны с занятием. Упоминание в записи само по себе
            не означает, что задание опубликовано.
          </p>
        )}
      </section>
      <section id="materials">
        <h2 className="text-xl mb-3">Материалы</h2>
        {lesson.materials.length ? (
          lesson.materials.map((link) => (
            <a
              key={link.id}
              className="study-row"
              href={link.material.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                {link.material.title}
              </span>
              <span>↗</span>
            </a>
          ))
        ) : (
          <p className="text-slate-400">Материалы пока не добавлены.</p>
        )}
        {canEditCourse(user, lesson.courseOfferingId, "manage_materials") && (
          <details className="mt-6">
            <summary className="text-link min-h-11 cursor-pointer">
              Прикрепить материал
            </summary>
            <div className="mt-5">
              <MaterialForm
                courseId={lesson.courseOfferingId}
                sessionId={lesson.id}
              />
            </div>
          </details>
        )}
      </section>
      <section id="transcript">
        <h2 className="text-xl mb-3">Транскрипция</h2>
        {lesson.transcripts.length ? (
          <>
            <p className="text-sm text-slate-400 mb-5">
              В тексте возможны ошибки распознавания. Важные формулировки стоит
              сверить с записью.
            </p>
            <form className="flex gap-3 mb-5">
              <input
                name="q"
                defaultValue={q ?? ""}
                aria-label="Найти в тексте занятия"
                placeholder="Найти в тексте…"
                maxLength={200}
                className="min-w-0 flex-1 min-h-12 rounded-xl border border-[rgba(11,26,45,0.15)] bg-white px-4 text-[#0b1a2d] placeholder:text-[#577291] focus:outline-none focus:border-[#962640]"
              />
              <button className="action-primary">Найти</button>
            </form>
            <details open={Boolean(q)}>
              <summary className="text-link min-h-11 cursor-pointer">
                Читать текст занятия
                {shownTranscript?.id !== lesson.transcripts[0]?.id
                  ? " · предыдущая версия"
                  : ""}
              </summary>
              <div className="whitespace-pre-wrap break-words leading-relaxed text-sm text-slate-300 max-h-[32rem] overflow-y-auto mt-4 p-4 border border-slate-700 rounded-xl">
                <HighlightedText
                  text={shownTranscript.rawText}
                  query={q?.slice(0, 200) ?? ""}
                />
              </div>
            </details>
            <OperationForm
              action={transcriptNotesAction}
              label="Найти фразы о заданиях и сроках"
              className="mt-5"
            >
              <input type="hidden" name="sessionId" value={id} />
              <p className="text-xs text-slate-400">
                Подходящие фразы попадут в предложения с точной цитатой. Ничего
                не опубликуется без проверки.
              </p>
            </OperationForm>
            {lesson.transcripts.length > 1 && (
              <details className="mt-5">
                <summary className="text-sm text-slate-400 cursor-pointer">
                  Предыдущие версии текста · {lesson.transcripts.length - 1}
                </summary>
                {lesson.transcripts.slice(1).map((t) => (
                  <details key={t.id} className="mt-4">
                    <summary className="text-sm">
                      {formatInTimeZone(
                        t.createdAt,
                        "Europe/Moscow",
                        "dd.MM.yyyy HH:mm",
                      )}
                    </summary>
                    <p className="text-sm text-slate-400 whitespace-pre-wrap break-words mt-3">
                      {t.rawText}
                    </p>
                  </details>
                ))}
              </details>
            )}
          </>
        ) : (
          <p className="text-slate-400">Текст записи пока не добавлен.</p>
        )}
      </section>
      <section className="border-t border-slate-700 pt-6">
        <h2 className="text-lg mb-3">Откуда сведения</h2>
        {lesson.context?.scheduleUrl && (
          <a
            className="text-link block mb-4"
            target="_blank"
            rel="noopener noreferrer"
            href={lesson.context.scheduleUrl}
          >
            Расписание СПбПУ этой недели ↗
          </a>
        )}
        <p className="text-sm text-slate-400 whitespace-pre-wrap">
          {lesson.sourceNote ?? "Источник пока не указан"}
        </p>
        {evidence.length > 0 && (
          <div className="mt-5 space-y-4">
            {evidence.map((e, i) => (
              <details
                className="border-l border-slate-600 pl-4 text-sm"
                key={i}
              >
                <summary className="cursor-pointer text-slate-300 break-words [overflow-wrap:anywhere]">
                  {e.label}
                  {e.relation === "INFERRED"
                    ? " · связь предположительная"
                    : e.relation === "RELATED"
                      ? " · материал по теме"
                      : " · прямой источник"}
                </summary>
                {e.location && (
                  <p className="text-xs text-slate-400 mt-3">{e.location}</p>
                )}
                {e.quote && (
                  <blockquote className="text-slate-400 whitespace-pre-wrap mt-3">
                    {e.quote}
                  </blockquote>
                )}
                {e.url && (
                  <a
                    className="text-link block mt-3"
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть источник ↗
                  </a>
                )}
                {e.sha256 && (
                  <p className="text-xs text-slate-500 break-all mt-3">
                    SHA-256: {e.sha256}
                  </p>
                )}
              </details>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">
          Доступ к записи управляется в сервисе, где хранится файл.
        </p>
      </section>
      {history.length > 0 && (
        <details>
          <summary className="text-link min-h-11 cursor-pointer">
            История занятия
          </summary>
          <div className="mt-4 space-y-5">
            {history.map((event) => {
              const data = event.details as {
                before?: {
                  summary?: string;
                  sessionDate?: string;
                  isTimeKnown?: boolean;
                  status?: string;
                };
                after?: {
                  summary?: string;
                  sessionDate?: string;
                  isTimeKnown?: boolean;
                  sourceNote?: string;
                };
              };
              return (
                <article
                  className="border-l border-slate-600 pl-4"
                  key={event.id}
                >
                  <p className="text-sm">
                    {event.user?.nickname ?? "Редактор"} ·{" "}
                    {event.action === "CREATE_LESSON"
                      ? "добавил занятие"
                      : "обновил занятие"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatInTimeZone(
                      event.createdAt,
                      "Europe/Moscow",
                      "dd.MM.yyyy HH:mm",
                    )}
                  </p>
                  {(edit || data.before?.status !== "DRAFT") &&
                    data.before?.sessionDate &&
                    data.before.sessionDate !== data.after?.sessionDate && (
                      <p className="text-sm text-slate-400 mt-2">
                        Дата:{" "}
                        {formatInTimeZone(
                          new Date(data.before.sessionDate),
                          "Europe/Moscow",
                          data.before.isTimeKnown
                            ? "dd.MM.yyyy HH:mm"
                            : "dd.MM.yyyy",
                        )}{" "}
                        →{" "}
                        {data.after?.sessionDate &&
                          formatInTimeZone(
                            new Date(data.after.sessionDate),
                            "Europe/Moscow",
                            data.after?.isTimeKnown
                              ? "dd.MM.yyyy HH:mm"
                              : "dd.MM.yyyy",
                          )}
                      </p>
                    )}
                  {(edit || data.before?.status !== "DRAFT") &&
                    data.before?.summary &&
                    data.before.summary !== data.after?.summary && (
                      <details className="text-xs text-slate-400 mt-2">
                        <summary className="cursor-pointer">
                          Ранее в кратком итоге
                        </summary>
                        <p className="whitespace-pre-wrap mt-2">
                          {data.before.summary}
                        </p>
                      </details>
                    )}
                </article>
              );
            })}
          </div>
        </details>
      )}
      {edit && (
        <details className="border-t border-slate-700 pt-6">
          <summary className="text-link min-h-11 cursor-pointer">
            Изменить занятие
          </summary>
          <div className="mt-5">
            <LessonForm
              courseId={lesson.courseOfferingId}
              tasks={tasks}
              session={lesson}
            />
          </div>
        </details>
      )}
    </div>
  );
}
