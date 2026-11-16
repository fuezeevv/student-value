import {
  mobileTimetableSchema,
  type MobileTimetable,
} from "@studentvalue/mobile-contracts";
import { getTimetableRepository } from "../storage/repository";

// Configurable API origin with fallback to local Wi-Fi or production
export const DEFAULT_API_ORIGIN =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? "http://192.168.0.26:3000" : "https://studentvalue1984.eu.cc");

export const KNOWN_API_ORIGINS = [
  { id: "lan", label: "Local Wi-Fi (192.168.0.26:3000)", origin: "http://192.168.0.26:3000" },
  { id: "usb", label: "Local USB (127.0.0.1:3000)", origin: "http://127.0.0.1:3000" },
  { id: "prod", label: "Production (eu.cc)", origin: "https://studentvalue1984.eu.cc" },
] as const;

export async function getActiveApiOrigin(): Promise<string> {
  try {
    const repo = getTimetableRepository();
    const saved = await repo.getPreference("api_origin");
    if (saved && saved.trim()) return saved.trim();
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
