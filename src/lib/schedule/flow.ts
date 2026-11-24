import { parseTimeToMinutes } from "../../../packages/mobile-contracts/src/lesson-progress";
import { selectScheduleFlow } from "../../../packages/mobile-contracts/src/schedule-flow";

export function scheduleFlow<T extends { start: string }>(
  days: { date: string; lessons: T[] }[],
  date: string,
  time: string,
) {
  return selectScheduleFlow(days, date, parseTimeToMinutes(time));
}
