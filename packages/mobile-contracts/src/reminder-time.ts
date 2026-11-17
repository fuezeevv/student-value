/** Default reminder: previous Moscow calendar day at 10:00; then 2h before.
 * A late opt-in schedules in ten seconds only if still before the deadline. */
export function deadlineReminderTime(
  deadline: Date,
  nowMs = Date.now(),
): Date | null {
  const end = deadline.getTime();
  if (!Number.isFinite(end) || !Number.isFinite(nowMs) || end <= nowMs)
    return null;
  // Determine the previous CALENDAR day in MSK, including deadlines before 03:00.
  const previousMoscowDay = new Date(end + 3 * 3600_000 - 24 * 3600_000);
  previousMoscowDay.setUTCHours(7, 0, 0, 0);
  if (previousMoscowDay.getTime() > nowMs) return previousMoscowDay;
  if (end - 2 * 3600_000 > nowMs) return new Date(end - 2 * 3600_000);
  return end - nowMs > 10_000 ? new Date(nowMs + 10_000) : null;
}
