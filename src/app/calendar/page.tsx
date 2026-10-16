import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";
import { taskVisibilityWhere } from "@/server/domain/access";
import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { getCalendarIntegrationStatus } from "@/server/services/calendar-service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDeadlineType } from "@/lib/utils/formatters";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Download,
  Share2,
  CalendarCheck,
  ShieldAlert,
} from "lucide-react";

export default async function CalendarPage() {
  const user = await requireCurrentUser();
  const groupId = user?.groupId || "";

  const calendarStatus = await getCalendarIntegrationStatus(groupId);

  // Fetch active deadlines
  const deadlines = await prisma.deadline.findMany({
    where: { ...confirmedDeadlineWhere, task: await taskVisibilityWhere(user) },
    include: {
      task: {
        include: {
          courseOffering: { include: { courseDefinition: true } },
        },
      },
      calendarEvents: true,
    },
    orderBy: { date: "asc" },
  });

  // Schedule facts appear only after they have a stored source; none are assumed.
  const knownSessions: Array<{course:string;day:string;time:string;room:string;source:string;color:string}> = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-cyan-400" />
            Календарь сроков
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Контрольные сроки вашей группы; доступен экспорт файла .ics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a href="/api/calendar/export" download="spbpu-40102-deadlines.ics">
            <Button size="sm" variant="primary" className="text-xs gap-1.5 font-semibold">
              <Download className="w-3.5 h-3.5" />
              <span>Скачать .ics файл</span>
            </Button>
          </a>
        </div>
      </div>

      {/* TWO INTEGRATION SCENARIOS: GROUP CALENDAR & PERSONAL CALENDAR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scenario A: Group Shared Calendar */}
        <Card className="glass-panel border-cyan-500/40 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-cyan-400" />
                <CardTitle className="text-base text-white">
                  Сценарий А: Общий календарь группы
                </CardTitle>
              </div>
              <Badge variant="success" className="text-[10px]">
                Доступен
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Все контрольные сроки и дедлайны семестра сформированы в единый поток. Вы можете
              импортировать его в Google Calendar, Apple Calendar, Outlook или Яндекс Календарь.
            </p>

            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Дедлайнов в выгрузке:</span>
                <span className="font-mono font-bold text-cyan-300">{deadlines.length} событий</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Формат:</span>
                <span className="font-mono text-slate-200">iCalendar (RFC 5545 / .ics)</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <a
                href="/api/calendar/export"
                download="spbpu-40102-deadlines.ics"
                className="flex-1"
              >
                <Button size="sm" variant="outline" className="w-full text-xs gap-1.5">
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Экспорт .ics</span>
                </Button>
              </a>
              <a
                href="https://calendar.google.com/calendar/r/settings/addbyurl"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button size="sm" variant="primary" className="w-full text-xs gap-1.5">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Добавить в Google</span>
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Scenario B: Personal Google Calendar */}
        <Card className="glass-panel border-slate-800 flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-slate-400" />
                <CardTitle className="text-base text-slate-200">
                  Сценарий Б: Личный Google Calendar
                </CardTitle>
              </div>
              <Badge variant="muted" className="text-[10px]">
                Интеграция не подключена
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Планируемая синхронизация с личным аккаунтом Google (автоматическое создание
              напоминаний о сдачах в вашей личной сетке календаря).
            </p>

            <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-300">Статус:</div>
              <p className="text-[11px] leading-relaxed">
                Индивидуальная авторизация через Google OAuth пока не настроена. Для добавления сроков
                используйте скачивание общего календаря группы через кнопку слева.
              </p>
            </div>

            <div className="pt-2">
              <Link href="/settings">
                <Button size="sm" variant="outline" className="w-full text-xs">
                  Настройки профиля и авторизации →
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TWO SECTIONS: DEADLINES SCHEDULE + KNOWN SESSIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Deadlines in Calendar (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Контрольные сроки семестра в календаре
          </h2>

          <div className="space-y-2.5">
            {deadlines.map((dl) => {
              const isSynced = dl.calendarEvents.some((e) => e.syncStatus === "SYNCED");
              const courseTitle = dl.task.courseOffering.courseDefinition.shortTitle;
              const dateStr = new Date(dl.date).toLocaleDateString("ru-RU", {
                timeZone: "Europe/Moscow",
                day: "numeric",
                month: "long",
                year: "numeric",
              });

              return (
                <div
                  key={dl.id}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {courseTitle}
                      </Badge>
                      <span className="font-medium text-slate-200 truncate">
                        {dl.task.title}
                      </span>
                    </div>
                    <div className="text-slate-400 flex items-center gap-2">
                      <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{dateStr}</span>
                      <span>·</span>
                      <span className={dl.type === "HARD" ? "text-rose-400" : "text-blue-400"}>
                        {formatDeadlineType(dl.type)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isSynced ? (
                      <Badge variant="success" className="text-[10px]">
                        Синхронизировано
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Календарь группы
                      </Badge>
                    )}
                    <Link href={`/tasks/${dl.taskId}`}>
                      <Button size="sm" variant="outline" className="text-xs px-2.5 h-7">
                        Сдать
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Known Verified Sessions (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Подтверждённые занятия
          </h2>

          <div className="space-y-3">
            {knownSessions.length === 0 && <p className="text-sm text-slate-400">Подтверждённые занятия ещё не добавлены.</p>}
            {knownSessions.map((session, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${session.color} space-y-1.5`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white">{session.course}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {session.room}
                  </Badge>
                </div>
                <div className="text-xs text-slate-300">
                  {session.day} · {session.time}
                </div>
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/40">
                  Преподаватель / источник: {session.source}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
