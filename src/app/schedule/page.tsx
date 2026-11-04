import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { loadRuzSchedule } from "@/server/schedule/ruz";
import { SchedulePanel } from "@/components/schedule/SchedulePanel";
import { addDays, requestedWeek } from "@/lib/schedule/ruz";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireCurrentUser(),
    query = await searchParams,
    now = new Date();
  let week: string;
  try {
    week = requestedWeek(query.week, now);
  } catch {
    return (
      <div>
        <h1 className="page-title">Неделя недоступна</h1>
        <Link className="text-link" href="/schedule">
          К текущему расписанию
        </Link>
      </div>
    );
  }
  const [result, offerings] = await Promise.all([
    loadRuzSchedule(user, week),
    prisma.courseOffering.findMany({
      where: {
        status: "ACTIVE",
        mergedIntoId: null,
        semester: { isCurrent: true },
        groups: { some: { groupId: user.groupId } },
      },
      select: { id: true, courseDefinition: { select: { title: true } } },
    }),
  ]);
  const date = (value: string) =>
    formatInTimeZone(
      new Date(value + "T12:00:00+03:00"),
      "Europe/Moscow",
      "d MMMM",
      { locale: ru },
    );
  return (
    <div className="max-w-4xl mx-auto">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{user.groupName} · официальные данные</p>
          <h1 className="page-title">Расписание пар</h1>
          <p className="page-intro">
            {date(week)} — {date(addDays(week, 6))}
          </p>
        </div>
      </header>
      <nav className="schedule-week-nav" aria-label="Выбор недели">
        <Link href={`/schedule?week=${addDays(week, -7)}`}>← Предыдущая</Link>
        <Link href="/schedule">Эта неделя</Link>
        <Link href={`/schedule?week=${addDays(week, 7)}`}>Следующая →</Link>
      </nav>
      <SchedulePanel
        result={result}
        now={now}
        courses={offerings.map((c) => ({
          id: c.id,
          title: c.courseDefinition.title,
        }))}
      />
    </div>
  );
}
