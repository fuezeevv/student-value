import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Search as SearchIcon, BookOpen, CheckSquare, Megaphone, FileText, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    cat?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const cat = params.cat || "ALL";

  let courseResults: any[] = [];
  let taskResults: any[] = [];
  let announcementResults: any[] = [];
  let sourceResults: any[] = [];

  if (q.length > 0) {
    if (cat === "ALL" || cat === "COURSES") {
      courseResults = await prisma.courseOffering.findMany({
        where: {
          OR: [
            { courseDefinition: { title: { contains: q, mode: "insensitive" } } },
            { courseDefinition: { shortTitle: { contains: q, mode: "insensitive" } } },
            { courseDefinition: { code: { contains: q, mode: "insensitive" } } },
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
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        include: {
          courseOffering: { include: { courseDefinition: true } },
          deadlines: { where: { status: "ACTIVE" } },
        },
        take: 15,
      });
    }

    if (cat === "ALL" || cat === "ANNOUNCEMENTS") {
      announcementResults = await prisma.announcement.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { content: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
      });
    }

    if (cat === "ALL" || cat === "MATERIALS") {
      sourceResults = await prisma.source.findMany({
        where: {
          title: { contains: q, mode: "insensitive" },
        },
        take: 10,
      });
    }
  }

  const totalHits =
    courseResults.length +
    taskResults.length +
    announcementResults.length +
    sourceResults.length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Search Header */}
      <div className="space-y-3 pb-3 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <SearchIcon className="w-6 h-6 text-cyan-400" />
          Глобальный поиск Student Value 1.984
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Поиск по дисциплинам, заданиям, дедлайнам, объявлениям и материалам семестра
        </p>

        {/* Search input form */}
        <form method="GET" action="/search" className="relative mt-2">
          <SearchIcon className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Введите название курса, тему лабораторной, имя преподавателя..."
            className="w-full pl-11 pr-24 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400 shadow-inner"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-2 top-2 px-3 py-1 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 transition-colors"
          >
            Найти
          </button>
        </form>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <Link
            href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), cat: "ALL" })}`}
            className={`px-3 py-1 rounded-lg border transition-colors ${
              cat === "ALL"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Все результаты
          </Link>
          <Link
            href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), cat: "COURSES" })}`}
            className={`px-3 py-1 rounded-lg border transition-colors ${
              cat === "COURSES"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Дисциплины ({courseResults.length})
          </Link>
          <Link
            href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), cat: "TASKS" })}`}
            className={`px-3 py-1 rounded-lg border transition-colors ${
              cat === "TASKS"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Задания ({taskResults.length})
          </Link>
          <Link
            href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), cat: "ANNOUNCEMENTS" })}`}
            className={`px-3 py-1 rounded-lg border transition-colors ${
              cat === "ANNOUNCEMENTS"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Объявления ({announcementResults.length})
          </Link>
          <Link
            href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), cat: "MATERIALS" })}`}
            className={`px-3 py-1 rounded-lg border transition-colors ${
              cat === "MATERIALS"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Материалы ({sourceResults.length})
          </Link>
        </div>
      </div>

      {/* Results Feed */}
      {q.length === 0 ? (
        <div className="p-12 text-center text-slate-400 space-y-2">
          <SearchIcon className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm">Введите поисковый запрос для навигации по всей базе знаний группы.</p>
          <div className="flex flex-wrap justify-center gap-2 pt-2 text-xs">
            <Link href="/search?q=Simulink" className="text-cyan-400 hover:underline">
              #Simulink
            </Link>
            <Link href="/search?q=3-402" className="text-cyan-400 hover:underline">
              #3-402
            </Link>
            <Link href="/search?q=Blender" className="text-cyan-400 hover:underline">
              #Blender
            </Link>
            <Link href="/search?q=Нестеров" className="text-cyan-400 hover:underline">
              #Нестеров
            </Link>
          </div>
        </div>
      ) : totalHits === 0 ? (
        <div className="p-8 text-center text-slate-400">
          По запросу «<strong className="text-white">{q}</strong>» ничего не найдено.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Courses matches */}
          {courseResults.length > 0 && (
            <div className="space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                Найденные дисциплины ({courseResults.length})
              </h2>
              <div className="space-y-2">
                {courseResults.map((c) => (
                  <Link key={c.id} href={`/courses/${c.id}`} className="block group">
                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-cyan-500/40 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {c.courseDefinition.code}
                          </Badge>
                          <span className="font-semibold text-sm text-white group-hover:text-cyan-300">
                            {c.courseDefinition.title}
                          </span>
                        </div>
                        {c.softwareRequired && (
                          <div className="text-xs text-slate-400">ПО: {c.softwareRequired}</div>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tasks matches */}
          {taskResults.length > 0 && (
            <div className="space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-cyan-400" />
                Найденные задания ({taskResults.length})
              </h2>
              <div className="space-y-2">
                {taskResults.map((t) => (
                  <Link key={t.id} href={`/tasks/${t.id}`} className="block group">
                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-cyan-500/40 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {t.courseOffering.courseDefinition.shortTitle}
                          </Badge>
                          <span className="font-semibold text-sm text-white group-hover:text-cyan-300">
                            {t.title}
                          </span>
                        </div>
                        {t.description && (
                          <p className="text-xs text-slate-300 line-clamp-1">{t.description}</p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Announcements matches */}
          {announcementResults.length > 0 && (
            <div className="space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-cyan-400" />
                Объявления ({announcementResults.length})
              </h2>
              <div className="space-y-2">
                {announcementResults.map((ann) => (
                  <div key={ann.id} className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-1">
                    <div className="font-semibold text-sm text-white">{ann.title}</div>
                    <p className="text-xs text-slate-300">{ann.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materials matches */}
          {sourceResults.length > 0 && (
            <div className="space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Материалы и источники ({sourceResults.length})
              </h2>
              <div className="space-y-2">
                {sourceResults.map((src) => (
                  <div key={src.id} className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
                    <div className="font-semibold text-xs text-white">{src.title}</div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">{src.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
