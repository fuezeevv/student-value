import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { loadStudyWorkspace } from "@/server/queries/study-workspace";
import { loadRuzSchedule } from "@/server/schedule/ruz";
import { CalendarNotice } from "@/components/workspace/CalendarNotice";
import {
  ScheduleWorkbench,
  type WorkbenchDay,
  type WorkbenchTask,
} from "@/components/schedule/ScheduleWorkbench";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import {
  appliesToSubgroup,
  showScheduleSubject,
  subjectKey,
  sourceUrl,
} from "@/lib/schedule/ruz";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user || !user.groupId) redirect("/login");

  const [workspace, ruzResult, gamification, announcements, changes] =
    await Promise.all([
      loadStudyWorkspace(user),
      loadRuzSchedule(user),
      prisma.userGamificationProfile.findUnique({
        where: { userId: user.id },
        select: { totalXp: true },
      }),
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

  const { offerings, tasks, now } = workspace;

  const nowMoscowTime = formatInTimeZone(now, "Europe/Moscow", "HH:mm");
  const todayDateStr = formatInTimeZone(now, "Europe/Moscow", "yyyy-MM-dd");

  // Academic week calculation
  const moscowDate = new Date(todayDateStr + "T12:00:00+03:00");
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

  // Filter lessons for user's subgroup & valid subjects
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
        .filter(
          (l) =>
            showScheduleSubject(l.subject) &&
            appliesToSubgroup(l, ruzResult.data!.groupCode, ruzResult.subgroup),
        )
        .map((l) => {
          const matchedCourse = offerings.find(
            (o) =>
              subjectKey(o.courseDefinition.title) === subjectKey(l.subject),
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
            courseHref: matchedCourse ? `/courses/${matchedCourse.id}` : undefined,
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

  // Map workspace tasks to WorkbenchTask
  const workbenchTasks: WorkbenchTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    courseTitle: t.courseTitle,
    courseShortTitle: t.courseShortTitle,
    courseId: t.courseId,
    deadlineDate: t.deadline?.date,
    deadlineFormatted: t.deadline
      ? t.timing.formattedDate
      : undefined,
    urgency: t.timing.urgency as "OVERDUE" | "SOON" | "NORMAL" | "NONE",
    completed: t.completed,
    accepted: t.accepted,
    materials: t.materials.map((m: { material: { id: string; title: string; url: string } }) => ({
      id: m.material.id,
      title: m.material.title,
      url: m.material.url,
    })),
  }));


  const groupCode = user.groupName || "5130901/40102";

  return (
    <>
      <CalendarNotice userId={user.id} />

      {/* SCHEDULE-FIRST WORKBENCH — primary interface */}
      <ScheduleWorkbench
        groupCode={groupCode}
        weekLabel={weekLabel}
        days={days}
        tasks={workbenchTasks}
        totalXp={gamification?.totalXp ?? 45}
        isGuest={false}
        fetchedAt={ruzResult.fetchedAt}
        scheduleState={ruzResult.state}
        sourceUrl={ruzResult.data ? sourceUrl(ruzResult.data) : undefined}
        nowMoscowTime={nowMoscowTime}
        todayDateStr={todayDateStr}
      />

      {/* Secondary: Announcements & updates if present */}
      {(announcements.length > 0 || changes.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-[var(--ink-faint)] mt-2">
          {announcements.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[var(--ink)] tracking-tight">
                Объявления группы
              </h3>
              <div className="space-y-2">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-xl bg-white/60 border border-[var(--ink-faint)] text-xs"
                  >
                    <p className="font-bold text-[var(--ink)]">{a.title}</p>
                    <p className="text-[var(--ink-secondary)] mt-1">{a.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {changes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[var(--ink)] tracking-tight">
                Уведомления
              </h3>
              <div className="space-y-2">
                {changes.map((n) => (
                  <div
                    key={n.id}
                    className="p-3.5 rounded-xl bg-white/60 border border-[var(--ink-faint)] text-xs"
                  >
                    <p className="font-medium text-[var(--ink)]">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
