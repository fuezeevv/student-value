import { calculateLessonProgress, parseTimeToMinutes } from "./lesson-progress";

type FlowLesson = { start: string };
type FlowDay<T extends FlowLesson> = { date: string; lessons: readonly T[] };

/** Pick the next scheduled destination, with an active class as fallback. */
export function selectScheduleFlow<T extends FlowLesson>(
  days: readonly FlowDay<T>[],
  today: string,
  nowMinutes: number,
) {
  const events = days
    .filter((day) => day.date >= today)
    .flatMap((day) => day.lessons.map((lesson) => ({ date: day.date, lesson })))
    .sort((a, b) =>
      `${a.date} ${a.lesson.start}`.localeCompare(
        `${b.date} ${b.lesson.start}`,
      ),
    );
  const current =
    events.find(
      ({ date, lesson }) =>
        date === today &&
        calculateLessonProgress(lesson.start, nowMinutes).isOngoing,
    ) ?? null;
  const upcoming = events.filter(
    ({ date, lesson }) =>
      date > today || parseTimeToMinutes(lesson.start) > nowMinutes,
  );
  return {
    focus: upcoming[0] ?? current,
    current,
    following: upcoming.slice(1, 4),
  };
}
