import { Platform } from "react-native";
import {
  mobileTimetableSchema,
  type MobileTimetable,
} from "@studentvalue/mobile-contracts";
import { getTimetableRepository } from "../storage/repository";

// Configurable API origin with fallback to local Wi-Fi or production
export const DEFAULT_API_ORIGIN =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? "http://10.210.5.173:3000" : "https://studentvalue1984.eu.cc");

export const KNOWN_API_ORIGINS = [
  { id: "lan", label: "Local Wi-Fi (10.210.5.173:3000)", origin: "http://10.210.5.173:3000" },
  { id: "usb", label: "Local USB (127.0.0.1:3000)", origin: "http://127.0.0.1:3000" },
  { id: "prod", label: "Production (eu.cc)", origin: "https://studentvalue1984.eu.cc" },
] as const;

export async function getActiveApiOrigin(): Promise<string> {
  try {
    const repo = getTimetableRepository();
    const saved = await repo.getPreference("api_origin");
    if (saved && saved.trim()) {
      const trimmed = saved.trim();
      // On real Android device, 127.0.0.1 loopback and stale subnet IPs cannot reach the dev server
      if (
        Platform.OS === "android" &&
        (trimmed.includes("127.0.0.1") || trimmed.includes("192.168.0.26"))
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
        message: "Структура ответа не соответствует контракту MobileTimetable v1",
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

export async function searchRuzTeachers(query: string): Promise<RuzSearchTeacher[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://ruz.spbstu.ru/api/v1/ruz/search/teachers?q=${encodeURIComponent(trimmed)}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.teachers || []).map((t: any) => ({
      id: t.id,
      full_name: t.full_name,
      chair: t.chair || "",
    }));
  } catch (err) {
    console.warn("Error searching RUZ teachers:", err);
    return [];
  }
}

export async function searchRuzGroups(query: string): Promise<RuzSearchGroup[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://ruz.spbstu.ru/api/v1/ruz/search/groups?q=${encodeURIComponent(trimmed)}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.groups || []).map((g: any) => ({
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
    console.warn("Error searching RUZ groups:", err);
    return [];
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

export async function syncTeacherTimetableFromRuz(
  teacherId: number,
  teacherDisplayName: string,
  date?: string,
): Promise<SyncResult> {
  const repo = getTimetableRepository();
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const weekStart = calculateWeekStart(targetDate);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://ruz.spbstu.ru/api/v1/ruz/teachers/${teacherId}/scheduler?date=${weekStart}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    );
    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        reason: "UNAVAILABLE",
        message: `РУЗ вернул ошибку HTTP ${res.status}`,
      };
    }

    const ruzData = await res.json();
    const ruzDays = ruzData.days || [];

    const days = Array.from({ length: 7 }, (_, i) => {
      const dayDate = addDaysTo(weekStart, i);
      const ruzDay = ruzDays.find((d: any) => d.date === dayDate);

      const lessons = (ruzDay?.lessons || []).map((l: any, idx: number) => ({
        id: `occ-teacher-${teacherId}-${dayDate}-${(l.time_start || "").replace(":", "")}-${idx}`,
        subject: l.subject || "Занятие",
        start: l.time_start || "00:00",
        scheduledEnd: l.time_end || "00:00",
        type: l.typeObj?.abbr || l.typeObj?.name || "Пара",
        teachers: [teacherDisplayName],
        rooms: (l.auditories || []).map(
          (a: any) =>
            `${a.name || "Ауд"}${a.building?.name ? ` (${a.building.name})` : ""}`,
        ),
        note: (l.groups || []).map((g: any) => g.name).join(", "),
      }));

      return {
        date: dayDate,
        lessons,
      };
    });

    const dto: MobileTimetable = {
      schemaVersion: 1,
      group: {
        code: teacherDisplayName,
        ruzId: teacherId,
      },
      weekStart,
      state: "FRESH",
      sourceFetchedAt: new Date().toISOString(),
      sourceUrl: `https://ruz.spbstu.ru/teachers/${teacherId}?date=${weekStart}`,
      data: {
        days: days as any,
      },
    };

    const validated = mobileTimetableSchema.parse(dto);
    await repo.saveSnapshot(validated);

    return {
      success: true,
      state: "FRESH",
      timetable: validated,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return {
        success: false,
        reason: "TIMEOUT",
        message: "Таймаут подключения к РУЗ (более 8 сек)",
      };
    }
    return {
      success: false,
      reason: "OFFLINE",
      message: "Нет подключения к официальному источнику РУЗ",
    };
  }
}

export async function syncGroupTimetableFromRuzId(
  groupId: number,
  groupCode: string,
  date?: string,
): Promise<SyncResult> {
  const repo = getTimetableRepository();
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const weekStart = calculateWeekStart(targetDate);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://ruz.spbstu.ru/api/v1/ruz/scheduler/${groupId}?date=${weekStart}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    );
    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        reason: "UNAVAILABLE",
        message: `РУЗ вернул ошибку HTTP ${res.status}`,
      };
    }

    const ruzData = await res.json();
    const ruzDays = ruzData.days || [];

    const days = Array.from({ length: 7 }, (_, i) => {
      const dayDate = addDaysTo(weekStart, i);
      const ruzDay = ruzDays.find((d: any) => d.date === dayDate);

      const lessons = (ruzDay?.lessons || []).map((l: any, idx: number) => ({
        id: `occ-group-${groupId}-${dayDate}-${(l.time_start || "").replace(":", "")}-${idx}`,
        subject: l.subject || "Занятие",
        start: l.time_start || "00:00",
        scheduledEnd: l.time_end || "00:00",
        type: l.typeObj?.abbr || l.typeObj?.name || "Пара",
        teachers: (l.teachers || []).map((t: any) => t.full_name),
        rooms: (l.auditories || []).map(
          (a: any) =>
            `${a.name || "Ауд"}${a.building?.name ? ` (${a.building.name})` : ""}`,
        ),
        note: l.additional_info ? l.additional_info.trim() : null,
      }));

      return {
        date: dayDate,
        lessons,
      };
    });

    const dto: MobileTimetable = {
      schemaVersion: 1,
      group: {
        code: groupCode,
        ruzId: groupId,
      },
      weekStart,
      state: "FRESH",
      sourceFetchedAt: new Date().toISOString(),
      sourceUrl: `https://ruz.spbstu.ru/faculty/125/groups/${groupId}?date=${weekStart}`,
      data: {
        days: days as any,
      },
    };

    const validated = mobileTimetableSchema.parse(dto);
    await repo.saveSnapshot(validated);

    return {
      success: true,
      state: "FRESH",
      timetable: validated,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return {
        success: false,
        reason: "TIMEOUT",
        message: "Таймаут подключения к РУЗ (более 8 сек)",
      };
    }
    return {
      success: false,
      reason: "OFFLINE",
      message: "Нет подключения к официальному источнику РУЗ",
    };
  }
}
