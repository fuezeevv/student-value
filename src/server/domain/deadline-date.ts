import { formatInTimeZone } from "date-fns-tz";
export const MOSCOW_TZ = "Europe/Moscow";
export function moscowDate(value: Date | string) {
  return formatInTimeZone(new Date(value), MOSCOW_TZ, "yyyy-MM-dd");
}
export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Укажите дату в формате ГГГГ-ММ-ДД");
  const result = new Date(`${value}T23:59:59.999+03:00`);
  if (!Number.isFinite(result.getTime()) || moscowDate(result) !== value)
    throw new Error("Некорректная дата");
  return result;
}
export function effectiveDeadline(date: Date | string, isTimeStrict = true) {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))
    return parseDateOnly(date);
  return isTimeStrict ? new Date(date) : parseDateOnly(moscowDate(date));
}
/** Changing the day of a strict deadline preserves its Moscow wall-clock time. */
export function moveDeadlineDate(
  existing: { date: Date; isTimeStrict: boolean },
  newDay: string,
) {
  parseDateOnly(newDay);
  if (!existing.isTimeStrict) return parseDateOnly(newDay);
  return new Date(
    `${newDay}T${formatInTimeZone(existing.date, MOSCOW_TZ, "HH:mm:ss.SSS")}+03:00`,
  );
}
