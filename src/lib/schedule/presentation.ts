import {
  calculateLessonProgress,
  parseTimeToMinutes,
} from "../../../packages/mobile-contracts/src/lesson-progress";
export {
  lessonTypeLabel as lessonType,
  teachingRoom,
} from "../../../packages/mobile-contracts/src/schedule-display";

/** Activity length confirmed by the group owner; original RUZ slots remain unchanged. */
export function lessonActivity(start: string, now: string) {
  const { isOngoing, progressPercent } = calculateLessonProgress(
    start,
    parseTimeToMinutes(now),
  );
  const end = parseTimeToMinutes(start) + 90;
  return {
    active: isOngoing,
    progress: progressPercent,
    end: `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
  };
}
