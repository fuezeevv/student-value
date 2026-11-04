import Link from "next/link";
import { Suspense } from "react";
import { SchedulePanel } from "@/components/schedule/SchedulePanel";
import { loadPublicRuzSchedule } from "@/server/schedule/ruz";
import { addDays, requestedWeek } from "@/lib/schedule/ruz";
type Props = {
  slug: string;
  base: string;
  courses: { id: string; title: string }[];
};
export async function PublicSchedule({
  slug,
  base,
  courses,
  week,
  compact = false,
}: Props & { week?: string; compact?: boolean }) {
  const result = await loadPublicRuzSchedule(slug, week);
  return (
    <SchedulePanel
      result={result}
      courses={courses}
      publicBase={base}
      compact={compact}
    />
  );
}
export function PublicScheduleView({
  slug,
  base,
  courses,
  rawWeek,
}: Props & { rawWeek?: string }) {
  let week: string;
  try {
    week = requestedWeek(rawWeek, new Date());
  } catch {
    return (
      <p className="quiet-empty">
        Неделя недоступна.{" "}
        <Link href={`${base}/schedule`}>Открыть текущую</Link>
      </p>
    );
  }
  return (
    <>
      <nav className="schedule-week-nav" aria-label="Выбор недели">
        <Link href={`${base}/schedule?week=${addDays(week, -7)}`}>
          ← Предыдущая
        </Link>
        <Link href={`${base}/schedule`}>Эта неделя</Link>
        <Link href={`${base}/schedule?week=${addDays(week, 7)}`}>
          Следующая →
        </Link>
      </nav>
      <Suspense
        fallback={
          <p role="status" className="quiet-empty">
            Получаем расписание РУЗ…
          </p>
        }
      >
        <PublicSchedule slug={slug} base={base} week={week} courses={courses} />
      </Suspense>
    </>
  );
}
