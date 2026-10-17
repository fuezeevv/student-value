import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";
import { requireCurrentUser } from "@/lib/auth/session";
import { taskVisibilityWhere } from "@/server/domain/access";
import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { ArrowUpRight } from "lucide-react";
import { HighlightedText } from "@/components/text/HighlightedText";
import { formatInTimeZone } from "date-fns-tz";

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    cat?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const user = await requireCurrentUser();
  const visibleTasks = await taskVisibilityWhere(user);
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 200) || "";
  const cat = params.cat || "ALL";

  let courseResults: any[] = [];
  let taskResults: any[] = [];
  let announcementResults: any[] = [];
  let sourceResults: any[] = [];
  let lessonResults: any[] = [];
  let transcriptResults: any[] = [];

  if (q.length > 0) {
    if (cat === "ALL" || cat === "LESSONS")
      lessonResults = await prisma.classSession.findMany({
        where: {
          status: { in: ["PUBLISHED", "CANCELLED"] },
          courseOffering: { groups: { some: { groupId: user.groupId } } },
          OR: [
            { topic: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { notes: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { courseOffering: { include: { courseDefinition: true } } },
        take: 10,
        orderBy: { sessionDate: "desc" },
      });
    if (cat === "ALL" || cat === "TRANSCRIPTS")
      transcriptResults = await prisma.transcript.findMany({
        where: {
          rawText: { contains: q, mode: "insensitive" },
          session: {
            status: { in: ["PUBLISHED", "CANCELLED"] },
            courseOffering: { groups: { some: { groupId: user.groupId } } },
          },
        },
        include: {
          session: {
            include: {
              courseOffering: { include: { courseDefinition: true } },
            },
          },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    if (cat === "ALL" || cat === "COURSES") {
      courseResults = await prisma.courseOffering.findMany({
        where: {
          groups: { some: { groupId: user.groupId } },
          status: "ACTIVE",
          semester: { isCurrent: true },
          OR: [
            {
              courseDefinition: { title: { contains: q, mode: "insensitive" } },
            },
            {
              courseDefinition: {
                shortTitle: { contains: q, mode: "insensitive" },
              },
            },
            {
              courseDefinition: { code: { contains: q, mode: "insensitive" } },
            },
            { softwareRequired: { contains: q, mode: "insensitive" } },
            { format: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { courseDefinition: true },
        take: 10,
      });
    }

    if (cat === "ALL" || cat === "TASKS") {
      taskResults = await prisma.task.findMany({
        where: {
          AND: [visibleTasks],
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            {
              requirements: {
                some: { content: { contains: q, mode: "insensitive" } },
              },
            },
          ],
        },
        include: {
          courseOffering: { include: { courseDefinition: true } },
          deadlines: { where: confirmedDeadlineWhere },
        },
        take: 15,
      });
    }

    if (cat === "ALL" || cat === "ANNOUNCEMENTS") {
      announcementResults = await prisma.announcement.findMany({
        where: {
          groupId: user.groupId,
          status: "PUBLISHED",
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { content: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
      });
    }

    if (cat === "ALL" || cat === "MATERIALS") {
      sourceResults = await prisma.courseMaterial.findMany({
        where: {
          courseOffering: { groups: { some: { groupId: user.groupId } } },
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { courseOffering: { include: { courseDefinition: true } } },
        take: 10,
      });
    }
  }

  const totalHits =
    courseResults.length +
    taskResults.length +
    announcementResults.length +
    sourceResults.length;
  const allHits = totalHits + lessonResults.length + transcriptResults.length;

  const categories = [
    ["ALL", "Всё"],
    ["COURSES", "Предметы"],
    ["TASKS", "Работы"],
    ["ANNOUNCEMENTS", "Объявления"],
    ["MATERIALS", "Материалы"],
    ["LESSONS", "Занятия"],
    ["TRANSCRIPTS", "Текст записей"],
  ];
  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Быстрый переход</p>
          <h1 className="page-title">Поиск</h1>
          <p className="page-intro">
            Найдите работу, материал или конкретную фразу в контексте занятия.
          </p>
        </div>
      </div>
      <form action="/search" className="flex gap-3 mb-5">
        <input
          type="search"
          aria-label="Поисковый запрос"
          name="q"
          defaultValue={q}
          placeholder="Название или тема…"
          className="min-w-0 flex-1 bg-[#142139] border border-slate-600 rounded-xl px-4 text-base min-h-12"
          autoFocus
        />
        <input type="hidden" name="cat" value={cat} />
        <button className="action-primary" type="submit">
          Найти
        </button>
      </form>
      <nav aria-label="Категории поиска" className="flex flex-wrap gap-3 mb-8">
        {categories.map(([id, label]) => (
          <Link
            key={id}
            href={`/search?${new URLSearchParams({ q, cat: id })}`}
            aria-current={cat === id ? "page" : undefined}
            className={`text-sm min-h-11 px-3 inline-flex items-center rounded-lg ${cat === id ? "bg-blue-500/20 text-blue-200" : "text-slate-400 hover:text-white"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!q ? (
        <p className="quiet-empty">
          Начните вводить название. В поиске доступны только материалы и работы
          вашей группы.
        </p>
      ) : !allHits ? (
        <p className="quiet-empty">
          По запросу «{q}» ничего не найдено. Попробуйте другое название или
          категорию.
        </p>
      ) : (
        <div>
          {lessonResults.length > 0 && (
            <section className="mb-8">
              <div className="section-heading">
                <h2>Занятия</h2>
              </div>
              {lessonResults.map((l) => (
                <Link
                  key={l.id}
                  href={`/lessons/${l.id}`}
                  className="study-row"
                >
                  <div className="study-row-main">
                    <p className="study-row-title">
                      <HighlightedText text={l.topic ?? "Занятие"} query={q} />
                    </p>
                    <p className="study-row-meta">
                      {l.courseOffering.courseDefinition.shortTitle} ·{" "}
                      {formatInTimeZone(
                        l.sessionDate,
                        "Europe/Moscow",
                        "dd.MM.yyyy",
                      )}
                    </p>
                  </div>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </section>
          )}
          {transcriptResults.length > 0 && (
            <section className="mb-8">
              <div className="section-heading">
                <h2>Фразы в записях занятий</h2>
              </div>
              {transcriptResults.map((t) => {
                const index = t.rawText
                  .toLocaleLowerCase("ru")
                  .indexOf(q.toLocaleLowerCase("ru"));
                const snippet = t.rawText.slice(
                  Math.max(0, index - 80),
                  index + q.length + 160,
                );
                return (
                  <Link
                    key={t.id}
                    href={`/lessons/${t.sessionId}?${new URLSearchParams({ q, version: t.id })}#transcript`}
                    className="study-row"
                  >
                    <div className="study-row-main">
                      <p className="study-row-title">
                        {t.session.topic ?? "Занятие"}
                      </p>
                      <p className="study-row-meta">
                        {t.session.courseOffering.courseDefinition.shortTitle} ·{" "}
                        {formatInTimeZone(
                          t.session.sessionDate,
                          "Europe/Moscow",
                          "dd.MM.yyyy",
                        )}
                      </p>
                      <p className="text-sm text-slate-300 mt-3 break-words">
                        …<HighlightedText text={snippet} query={q} />…
                      </p>
                    </div>
                    <ArrowUpRight size={17} />
                  </Link>
                );
              })}
            </section>
          )}
          {courseResults.length > 0 && (
            <section className="mb-8">
              <div className="section-heading">
                <h2>Предметы</h2>
              </div>
              {courseResults.map((c) => (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  className="study-row"
                >
                  <div className="study-row-main">
                    <p className="study-row-title">
                      {c.courseDefinition.title}
                    </p>
                    <p className="study-row-meta">
                      {c.courseDefinition.shortTitle}
                    </p>
                  </div>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </section>
          )}
          {taskResults.length > 0 && (
            <section className="mb-8">
              <div className="section-heading">
                <h2>Работы</h2>
              </div>
              {taskResults.map((t) => (
                <Link key={t.id} href={`/tasks/${t.id}`} className="study-row">
                  <div className="study-row-main">
                    <p className="study-row-title">{t.title}</p>
                    <p className="study-row-meta">
                      {t.courseOffering.courseDefinition.shortTitle}
                    </p>
                  </div>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </section>
          )}
          {announcementResults.length > 0 && (
            <section className="mb-8">
              <div className="section-heading">
                <h2>Объявления</h2>
              </div>
              {announcementResults.map((a) => (
                <article key={a.id} className="announcement-entry">
                  <h3>{a.title}</h3>
                  <p>{a.content}</p>
                </article>
              ))}
            </section>
          )}
          {sourceResults.length > 0 && (
            <section>
              <div className="section-heading">
                <h2>Материалы</h2>
              </div>
              {sourceResults.map((m) => (
                <a
                  key={m.id}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="study-row"
                >
                  <span className="study-row-main">
                    <span className="study-row-title">{m.title}</span>
                    <span className="study-row-meta block">
                      {m.courseOffering.courseDefinition.shortTitle}
                    </span>
                  </span>
                  <ArrowUpRight size={17} />
                </a>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
