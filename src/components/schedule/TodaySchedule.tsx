import type { SessionUser } from "@/lib/auth/session";
import { loadRuzSchedule } from "@/server/schedule/ruz";
import { SchedulePanel } from "./SchedulePanel";

export async function TodaySchedule({
  user,
  now,
  courses,
  tasks = [],
}: {
  user: SessionUser;
  now: Date;
  courses: { id: string; title: string }[];
  tasks?: Array<{
    id: string;
    title: string;
    courseId: string;
    deadline?: { date: Date; title?: string | null } | null;
  }>;
}) {
  const result = await loadRuzSchedule(user);
  return (
    <SchedulePanel
      result={result}
      now={now}
      compact
      courses={courses}
      tasks={tasks}
    />
  );
}
