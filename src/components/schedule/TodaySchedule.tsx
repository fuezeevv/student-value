import type { SessionUser } from "@/lib/auth/session";
import { loadRuzSchedule } from "@/server/schedule/ruz";
import { SchedulePanel } from "./SchedulePanel";
export async function TodaySchedule({
  user,
  now,
  courses,
}: {
  user: SessionUser;
  now: Date;
  courses: { id: string; title: string }[];
}) {
  const result = await loadRuzSchedule(user);
  return <SchedulePanel result={result} now={now} compact courses={courses} />;
}
