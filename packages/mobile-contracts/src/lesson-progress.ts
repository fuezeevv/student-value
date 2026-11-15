/**
 * Shared, pure academic 90-minute lesson progress calculation.
 * Preserves the provider scheduledEnd slot while calculating visual progress
 * strictly based on the confirmed 90-minute academic duration policy.
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export type LessonProgressResult = {
  isOngoing: boolean;
  isCompleted: boolean;
  progressPercent: number; // 0 to 100
  elapsedMinutes: number;
};

export function calculateLessonProgress(
  startTime: string,
  nowMinutes: number,
  durationMinutes = 90,
): LessonProgressResult {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = startMin + durationMinutes;

  if (nowMinutes < startMin) {
    return {
      isOngoing: false,
      isCompleted: false,
      progressPercent: 0,
      elapsedMinutes: 0,
    };
  }

  if (nowMinutes >= endMin) {
    return {
      isOngoing: false,
      isCompleted: true,
      progressPercent: 100,
      elapsedMinutes: durationMinutes,
    };
  }

  const elapsed = nowMinutes - startMin;
  const percent = Math.min(100, Math.max(0, (elapsed / durationMinutes) * 100));

  return {
    isOngoing: true,
    isCompleted: false,
    progressPercent: percent,
    elapsedMinutes: elapsed,
  };
}
