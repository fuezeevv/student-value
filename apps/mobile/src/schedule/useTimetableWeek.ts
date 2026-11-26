import { useCallback, useEffect, useState } from "react";
import {
  showStudentScheduleSubject,
  type MobileLesson,
} from "@studentvalue/mobile-contracts";
import {
  syncGroupTimetableFromRuzId,
  syncTeacherTimetableFromRuz,
  syncTimetableFromApi,
} from "../api/client";
import { getTimetableRepository } from "../storage/repository";

type Selection = {
  group: string;
  week: string;
  teacherId: number | null;
  groupId: number | null;
  origin: string;
};

type Week = {
  days: { date: string; lessons: MobileLesson[] }[];
  savedAt: string;
  fetchedAt: string;
  stale: boolean;
};

const maxAgeMs = 15 * 60 * 1000;

export function useTimetableWeek(
  { group, week, teacherId, groupId, origin }: Selection,
  canFetch: boolean,
) {
  const key = JSON.stringify([group, week, teacherId, groupId, origin]);
  const [state, setState] = useState<{
    key: string;
    value: Week | null;
    syncing: boolean;
    error?: string;
  }>();
  const [request, setRequest] = useState<{ key: string }>();
  const refresh = useCallback(() => setRequest({ key }), [key]);

  useEffect(() => {
    if (!week) return;
    let active = true;

    const read = async (): Promise<Week | null> => {
      const cached = await getTimetableRepository().getSnapshot(group, week);
      const snapshot = cached?.snapshot;
      if (!snapshot?.data || !cached) return null;
      const isTeacher = new URL(snapshot.sourceUrl).pathname.startsWith(
        "/teachers/",
      );
      if (
        isTeacher !== Boolean(teacherId) ||
        ((teacherId ?? groupId) &&
          snapshot.group.ruzId !== (teacherId ?? groupId))
      )
        return null;
      return {
        days: snapshot.data.days.map((day) => ({
          date: day.date,
          lessons: day.lessons.filter((lesson) =>
            showStudentScheduleSubject(lesson.subject),
          ),
        })),
        savedAt: cached.savedAt,
        fetchedAt: cached.sourceFetchedAt,
        stale:
          snapshot.state === "STALE" ||
          Date.now() - Date.parse(cached.sourceFetchedAt) > maxAgeMs,
      };
    };

    void (async () => {
      let value: Week | null = null;
      try {
        value = await read();
        if (!active) return;
        const syncing =
          canFetch && (!value || value.stale || request?.key === key);
        setState({ key, value, syncing });
        if (!syncing) return;
        const result = teacherId
          ? await syncTeacherTimetableFromRuz(teacherId, group, week)
          : groupId && group !== "5130901/40102"
            ? await syncGroupTimetableFromRuzId(groupId, group, week)
            : await syncTimetableFromApi(group, week, origin);
        if (!active) return;
        if (result.success) value = await read();
        if (active)
          setState({
            key,
            value,
            syncing: false,
            error: result.success ? undefined : result.message,
          });
      } catch {
        if (active)
          setState({
            key,
            value,
            syncing: false,
            error: "Не удалось загрузить расписание",
          });
      }
    })();

    return () => {
      active = false;
    };
  }, [key, group, week, teacherId, groupId, origin, canFetch, request]);

  const visible = state?.key === key ? state : undefined;
  return {
    week: visible?.value ?? null,
    syncing: visible?.syncing ?? false,
    error: visible?.error,
    refresh,
  };
}
