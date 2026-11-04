import { createHash } from "node:crypto";
import { showScheduleSubject, subjectKey, type RuzLesson } from "./ruz";
import type { ScheduleResult } from "@/server/schedule/ruz";
export type SubjectMeeting = RuzLesson & { date: string; weekStart: string };
export type RuzSubject = {
  id: string;
  title: string;
  types: string[];
  meetings: SubjectMeeting[];
  links: string[];
};
export function collectRuzSubjects(weeks: ScheduleResult[]): RuzSubject[] {
  const subjects = new Map<string, RuzSubject>();
  for (const week of weeks)
    for (const day of week.data?.days ?? [])
      for (const lesson of day.lessons) {
        if (!showScheduleSubject(lesson.subject)) continue;
        const key = subjectKey(lesson.subject);
        let subject = subjects.get(key);
        if (!subject) {
          subject = {
            id:
              "ruz-" +
              createHash("sha256").update(key).digest("hex").slice(0, 16),
            title: lesson.subject,
            types: [],
            meetings: [],
            links: [],
          };
          subjects.set(key, subject);
        }
        if (!subject.types.includes(lesson.type))
          subject.types.push(lesson.type);
        if (lesson.lmsUrl && !subject.links.includes(lesson.lmsUrl))
          subject.links.push(lesson.lmsUrl);
        const meeting = {
          ...lesson,
          date: day.date,
          weekStart: week.weekStart,
        };
        if (
          !subject.meetings.some(
            (m) => JSON.stringify(m) === JSON.stringify(meeting),
          )
        )
          subject.meetings.push(meeting);
      }
  return [...subjects.values()]
    .map((s) => ({
      ...s,
      meetings: s.meetings.sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
      ),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
}
export function matchSubjectCourse<T extends { id: string; title: string }>(
  subject: RuzSubject,
  courses: T[],
): T | null {
  const matches = courses.filter(
    (c) => subjectKey(c.title) === subjectKey(subject.title),
  );
  return matches.length === 1 ? matches[0] : null;
}
