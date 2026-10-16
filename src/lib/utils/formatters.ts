import {
  StudentTaskProgressStatus,
  DeadlineType,
  DeadlineProvenance,
  VerificationSource,
} from "@prisma/client";

export function formatTaskStatus(
  status?: StudentTaskProgressStatus | string | null
): string {
  switch (status) {
    case "ACCEPTED":
      return "Зачтено";
    case "SUBMITTED":
      return "Сдано на проверку";
    case "READY":
      return "Готово к сдаче";
    case "IN_PROGRESS":
      return "В процессе";
    case "NEEDS_FIX":
      return "Требуются правки";
    case "NOT_STARTED":
    default:
      return "Не начато";
  }
}

export function formatDeadlineType(type?: DeadlineType | string | null): string {
  switch (type) {
    case "HARD":
      return "Жесткий дедлайн";
    case "SOFT":
      return "Рекомендуемый срок";
    default:
      return "Не указан";
  }
}

export function formatDeadlineProvenance(
  provenance?: DeadlineProvenance | string | null
): { label: string; variant: "success" | "info" | "warning" | "muted" } {
  switch (provenance) {
    case "TEACHER":
      return { label: "Преподаватель", variant: "success" };
    case "HEADMAN_CONFIRMED":
      return { label: "Подтверждено старостой", variant: "info" };
    case "OFFICIAL":
      return { label: "Расписание СПбПУ", variant: "info" };
    case "PERSONAL":
      return { label: "Личный дедлайн", variant: "muted" };
    case "UNKNOWN":
    default:
      return { label: "Требует уточнения", variant: "warning" };
  }
}

export function formatVerificationSource(
  source?: VerificationSource | string | null
): string {
  switch (source) {
    case "TEACHER_CONFIRMED":
      return "Зачтено преподавателем";
    case "HEADMAN_CONFIRMED":
      return "Подтверждено старостой";
    case "SELF_REPORTED":
      return "Отмечено студентом";
    case "SYSTEM_VERIFIED":
      return "Системная верификация";
    default:
      return "Не верифицировано";
  }
}
