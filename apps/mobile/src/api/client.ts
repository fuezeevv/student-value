import { PUBLIC_GROUPS } from "@studentvalue/mobile-contracts";
import { z } from "zod";
import {
  parseMobileRuzSource,
  type RuzSelection,
} from "@studentvalue/mobile-contracts";
import { mobileRuzJson, MobileRuzRequestError } from "./ruz-transport";
import { Platform } from "react-native";
import {
  mobileTimetableSchema,
  type MobileTimetable,
} from "@studentvalue/mobile-contracts";
import { getTimetableRepository } from "../storage/repository";

// Configurable API origin with fallback to local Wi-Fi or production
export const DEFAULT_API_ORIGIN =
  process.env.EXPO_PUBLIC_API_URL || "https://studentvalue1984.eu.cc";

export const KNOWN_API_ORIGINS = [
  {
    id: "usb",
    label: "Local USB (127.0.0.1:3000)",
    origin: "http://127.0.0.1:3000",
  },
  {
    id: "lan",
    label: "Local Wi-Fi (192.168.0.26:3000)",
    origin: "http://192.168.0.26:3000",
  },
  {
    id: "prod",
    label: "Production (eu.cc)",
    origin: "https://studentvalue1984.eu.cc",
  },
] as const;

export async function getActiveApiOrigin(): Promise<string> {
  try {
    const repo = getTimetableRepository();
    const saved = await repo.getPreference("api_origin");
    if (saved && saved.trim()) {
      const trimmed = saved.trim();
      if (
        !process.env.EXPO_PUBLIC_API_URL &&
        [
          "http://127.0.0.1:3000",
          "http://192.168.0.26:3000",
          "http://10.210.5.173:3000",
        ].includes(trimmed)
      ) {
        return DEFAULT_API_ORIGIN;
      }
      return trimmed;
    }
  } catch {}
  return DEFAULT_API_ORIGIN;
}

export async function setActiveApiOrigin(origin: string): Promise<void> {
  const repo = getTimetableRepository();
  await repo.setPreference("api_origin", origin.trim());
}

export type SyncResult =
  | { success: true; state: "FRESH" | "STALE"; timetable: MobileTimetable }
  | {
      success: false;
      reason:
        | "OFFLINE"
        | "TIMEOUT"
        | "UNAVAILABLE"
        | "ENDPOINT_NOT_FOUND"
        | "SCHEMA_ERROR"
        | "STORAGE_ERROR"
        | "SCOPE_MISMATCH";
      message: string;
    };

const MAX_RESPONSE_BYTES = 512 * 1024; // 512 KB max timetable payload

export async function syncTimetableFromApi(
  groupCode: string,
  date?: string,
  apiOrigin?: string,
): Promise<SyncResult> {
  const repo = getTimetableRepository();
  const resolvedOrigin = apiOrigin || (await getActiveApiOrigin());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  const url = `${resolvedOrigin}/api/v1/timetable?group=${encodeURIComponent(
    groupCode,
  )}${date ? `&date=${encodeURIComponent(date)}` : ""}`;

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (res.status === 404) {
      clearTimeout(timer);
      const text = await res.text().catch(() => "");
      let parsedCode = "";
      try {
        parsedCode = JSON.parse(text).code;
      } catch {}

      if (parsedCode === "GROUP_NOT_FOUND") {
        return {
          success: false,
          reason: "UNAVAILABLE",
          message: "Группа не найдена в публичном каталоге расписания",
        };
      }

      const group = PUBLIC_GROUPS.find((item) => item.code === groupCode);
      if (group)
        return syncGroupTimetableFromRuzId(group.ruzId, group.code, date);
      return {
        success: false,
        reason: "ENDPOINT_NOT_FOUND",
        message: `API v1 расписания недоступен на сервере (${resolvedOrigin} вернул 404)`,
      };
    }

    if (res.status === 503) {
      clearTimeout(timer);
      return {
        success: false,
        reason: "UNAVAILABLE",
        message: "Расписание временно недоступно в официальном источнике РУЗ",
      };
    }

    if (!res.ok) {
      clearTimeout(timer);
      return {
        success: false,
        reason: "UNAVAILABLE",
        message: `Сервер вернул ошибку HTTP ${res.status}`,
      };
    }

    // Read and enforce size limit
    const rawText = await res.text();
    clearTimeout(timer);

    if (rawText.length > MAX_RESPONSE_BYTES) {
      return {
        success: false,
        reason: "SCHEMA_ERROR",
        message: "Размер ответа превышает допустимый лимит (512 КБ)",
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(rawText);
    } catch {
      return {
        success: false,
        reason: "SCHEMA_ERROR",
        message: "Сервер вернул некорректный JSON",
      };
    }

    let validated: MobileTimetable;
    try {
      validated = mobileTimetableSchema.parse(json);
    } catch (zodErr) {
      return {
        success: false,
        reason: "SCHEMA_ERROR",
        message:
          "Структура ответа не соответствует контракту MobileTimetable v1",
      };
    }

    // Scope check: verify received group matches requested group
    if (validated.group.code !== groupCode) {
      return {
        success: false,
        reason: "SCOPE_MISMATCH",
        message: `Получен ответ для группы ${validated.group.code}, запрошена ${groupCode}`,
      };
    }

    if (validated.state === "FRESH" || validated.state === "STALE") {
      try {
        const saved = await repo.saveSnapshot(validated);
        if (!saved) {
          // If save returned false, a newer snapshot is already saved locally
          return {
            success: true,
            state: validated.state,
            timetable: validated,
          };
        }
      } catch (dbErr) {
        return {
          success: false,
          reason: "STORAGE_ERROR",
          message: "Не удалось сохранить снимок в локальную базу данных SQLite",
        };
      }

      return {
        success: true,
        state: validated.state,
        timetable: validated,
      };
    }

    return {
      success: false,
      reason: "UNAVAILABLE",
      message: "Расписание для группы не настроено в системе",
    };
  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        reason: "TIMEOUT",
        message: "Таймаут подключения к серверу (более 8 сек)",
      };
    }

    return {
      success: false,
      reason: "OFFLINE",
      message: "Нет подключения к сети",
    };
  }
}

export type RuzSearchTeacher = {
  id: number;
  full_name: string;
  chair?: string;
};

export type RuzSearchGroup = {
  id: number;
  name: string;
  faculty?: {
    id: number;
    name: string;
    abbr?: string;
  };
};

export async function searchRuzTeachers(
  query: string,
): Promise<RuzSearchTeacher[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    const data = (await mobileRuzJson(
      `search/teachers?q=${encodeURIComponent(trimmed)}`,
    )) as { teachers?: unknown[] };
    const validated = z
      .object({
        teachers: z
          .array(
            z.object({
              id: z.number().int().positive(),
              full_name: z.string().trim().min(1).max(1000),
              chair: z.string().max(1000).optional(),
            }),
          )
          .max(500),
      })
      .parse(data);
    return validated.teachers.map((t: any) => ({
      id: t.id,
      full_name: t.full_name,
      chair: t.chair || "",
    }));
  } catch (err) {
    throw new Error(
      "Не удалось выполнить поиск преподавателей в РУЗ. Повторите попытку.",
    );
  }
}

export async function searchRuzGroups(
  query: string,
): Promise<RuzSearchGroup[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    const data = (await mobileRuzJson(
      `search/groups?q=${encodeURIComponent(trimmed)}`,
    )) as { groups?: unknown[] };
    const validated = z
      .object({
        groups: z
          .array(
            z.object({
              id: z.number().int().positive(),
              name: z.string().trim().min(1).max(1000),
              faculty: z
                .object({
                  id: z.number().int().positive(),
                  name: z.string().max(1000),
                  abbr: z.string().max(100).optional(),
                })
                .optional(),
            }),
          )
          .max(3000),
      })
      .parse(data);
    return validated.groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      faculty: g.faculty
        ? {
            id: g.faculty.id,
            name: g.faculty.name,
            abbr: g.faculty.abbr,
          }
        : undefined,
    }));
  } catch (err) {
    throw new Error(
      "Не удалось выполнить поиск групп в РУЗ. Повторите попытку.",
    );
  }
}

function calculateWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getTime() - day * 86400000);
  return monday.toISOString().slice(0, 10);
}

function addDaysTo(dateStr: string, count: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const next = new Date(d.getTime() + count * 86400000);
  return next.toISOString().slice(0, 10);
}

async function syncDirectRuz(
  selection: RuzSelection,
  date?: string,
): Promise<SyncResult> {
  const targetDate =
    date ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const weekStart = calculateWeekStart(targetDate);
  try {
    const path =
      selection.kind === "teacher"
        ? `teachers/${selection.id}/scheduler`
        : `scheduler/${selection.id}`;
    const raw = await mobileRuzJson(`${path}?date=${weekStart}`);
    const timetable = parseMobileRuzSource(raw, selection, weekStart);
    try {
      await getTimetableRepository().saveSnapshot(timetable);
    } catch {
      return {
        success: false,
        reason: "STORAGE_ERROR",
        message: "Не удалось сохранить расписание на устройстве",
      };
    }
    return { success: true, state: "FRESH", timetable };
  } catch (error) {
    const reason =
      error instanceof MobileRuzRequestError ? error.reason : "SCHEMA_ERROR";
    return {
      success: false,
      reason,
      message:
        reason === "TIMEOUT"
          ? "РУЗ не ответил вовремя"
          : reason === "SCHEMA_ERROR"
            ? "Ответ РУЗ не соответствует выбранному расписанию. Сохранённая копия не изменена."
            : "Не удалось обновить расписание из РУЗ",
    };
  }
}
export function syncTeacherTimetableFromRuz(
  teacherId: number,
  teacherDisplayName: string,
  date?: string,
): Promise<SyncResult> {
  return syncDirectRuz(
    { kind: "teacher", id: teacherId, label: teacherDisplayName },
    date,
  );
}
export function syncGroupTimetableFromRuzId(
  groupId: number,
  groupCode: string,
  date?: string,
): Promise<SyncResult> {
  return syncDirectRuz({ kind: "group", id: groupId, label: groupCode }, date);
}
