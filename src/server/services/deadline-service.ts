import {ru} from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { effectiveDeadline, moscowDate } from "@/server/domain/deadline-date";

export const MOSCOW_TZ = "Europe/Moscow";

export type UrgencyLevel =
  | "ACCEPTED"
  | "OVERDUE"
  | "DUE_TODAY"
  | "DUE_TOMORROW"
  | "DUE_URGENT" // 2 to 7 days
  | "UPCOMING"   // > 7 days
  | "NO_DEADLINE";

export interface DeadlineCalculationResult {
  urgency: UrgencyLevel;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  formattedDate: string;
  badgeLabel: string;
  badgeVariant: "destructive" | "warning" | "urgent" | "info" | "muted" | "success";
}

export function calculateDeadlineStatus(
  deadlineDate: Date | string | null,
  now: Date = new Date(),
  isAccepted: boolean = false,
  isTimeStrict: boolean = true
): DeadlineCalculationResult {
  if (isAccepted) {
    return {
      urgency: "ACCEPTED",
      daysRemaining: null,
      hoursRemaining: null,
      formattedDate: deadlineDate
        ? formatInTimeZone(new Date(deadlineDate), MOSCOW_TZ, "dd.MM.yyyy")
        : "—",
      badgeLabel: "Принято",
      badgeVariant: "success",
    };
  }

  if (!deadlineDate) {
    return {
      urgency: "NO_DEADLINE",
      daysRemaining: null,
      hoursRemaining: null,
      formattedDate: "Срок не указан",
      badgeLabel: "Без срока",
      badgeVariant: "muted",
    };
  }

  const strict = isTimeStrict && !(typeof deadlineDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(deadlineDate));
  const targetDate = effectiveDeadline(deadlineDate, strict);
  const diffMs = targetDate.getTime() - now.getTime();
  const diffDays = Math.round((Date.parse(moscowDate(targetDate)) - Date.parse(moscowDate(now))) / 86400000);
  const diffHours = Math.floor(diffMs / 3600000);
  const formatted = formatInTimeZone(targetDate, MOSCOW_TZ, strict ? "d MMMM yyyy, HH:mm (МСК)" : "d MMMM yyyy",{locale:ru});

  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      urgency: "OVERDUE",
      daysRemaining: diffDays,
      hoursRemaining: diffHours,
      formattedDate: formatted,
      badgeLabel: overdueDays === 0 ? "Просрочено сегодня" : `Просрочено на ${overdueDays} дн.`,
      badgeVariant: "destructive",
    };
  }

  if (diffDays === 0) {
    return {
      urgency: "DUE_TODAY",
      daysRemaining: 0,
      hoursRemaining: diffHours,
      formattedDate: formatted,
      badgeLabel: "Сегодня",
      badgeVariant: "destructive",
    };
  }

  if (diffDays === 1) {
    return {
      urgency: "DUE_TOMORROW",
      daysRemaining: 1,
      hoursRemaining: diffHours,
      formattedDate: formatted,
      badgeLabel: "Завтра",
      badgeVariant: "warning",
    };
  }

  if (diffDays <= 7) {
    return {
      urgency: "DUE_URGENT",
      daysRemaining: diffDays,
      hoursRemaining: diffHours,
      formattedDate: formatted,
      badgeLabel: `Осталось ${diffDays} дн.`,
      badgeVariant: "urgent",
    };
  }

  return {
    urgency: "UPCOMING",
    daysRemaining: diffDays,
    hoursRemaining: diffHours,
    formattedDate: formatted,
    badgeLabel: `Через ${diffDays} дн.`,
    badgeVariant: "info",
  };
}
