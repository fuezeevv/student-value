import { lessonActivity } from "./presentation";

type FlowLesson = { start: string; subject: string };
type FlowDay<T extends FlowLesson> = { date: string; lessons: T[] };

/** Public RUZ data only; never infer homework, attendance or a class having happened. */
export function scheduleFlow<T extends FlowLesson>(
  days: FlowDay<T>[],
  date: string,
  time: string,
) {
  const events = days
    .flatMap((day) => day.lessons.map((lesson) => ({ date: day.date, lesson })))
    .sort((a, b) =>
      `${a.date} ${a.lesson.start}`.localeCompare(
        `${b.date} ${b.lesson.start}`,
      ),
    );
  const current =
    events.find(
      (event) =>
        event.date === date && lessonActivity(event.lesson.start, time).active,
    ) ?? null;
  const upcoming = events.filter(
    (event) =>
      event.date > date || (event.date === date && event.lesson.start > time),
  );
  // The destination after this class matters first. The current class stays a quiet progress line.
  const focus = upcoming[0] ?? current;
  return { focus, current, following: upcoming.slice(1, 4) };
}
