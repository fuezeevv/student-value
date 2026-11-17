import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { z } from "zod";
import {
  mobileDayView,
  showStudentScheduleSubject,
  lessonTypeLabel,
  PUBLIC_GROUPS,
  type MobileLesson,
} from "@studentvalue/mobile-contracts";
import {
  syncGroupTimetableFromRuzId,
  syncTeacherTimetableFromRuz,
} from "../api/client";
import { getTimetableRepository } from "../storage/repository";
import { useTheme } from "../theme/ThemeProvider";
import { SchedulePickerModal } from "./SchedulePickerModal";
const selectionSchema = z
  .array(
    z.object({
      kind: z.enum(["group", "teacher"]),
      id: z.number().int().positive(),
      label: z.string().trim().min(1).max(200),
    }),
  )
  .max(3);
type Selection = z.infer<typeof selectionSchema>[number];
type Comparison = {
  selection: Selection;
  lessons: MobileLesson[];
  fetchedAt: string | null;
  state: "loading" | "fresh" | "stale" | "unavailable";
};
const colorsBySource = ["#6ca2ef", "#b084a9", "#3b9b88", "#a08b4c"];
function monday(date: string) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function ComparedSchedule({
  date,
  primaryLabel,
  primaryLessons,
  loaded,
}: {
  date: string;
  primaryLabel: string;
  primaryLessons: MobileLesson[];
  loaded: boolean;
}) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<Selection[]>([]);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [picker, setPicker] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    getTimetableRepository()
      .getPreference("comparison_schedules_v1")
      .then((raw) => {
        if (!active) return;
        try {
          if (raw) setSelected(selectionSchema.parse(JSON.parse(raw)));
        } catch {
          /* Ignore invalid public preference. */
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (ready)
      void getTimetableRepository()
        .setPreference("comparison_schedules_v1", JSON.stringify(selected))
        .catch(() => {});
  }, [selected, ready]);
  useEffect(() => {
    let active = true;
    setComparisons(
      selected.map((selection) => ({
        selection,
        lessons: [],
        state: "loading",
        fetchedAt: null,
      })),
    );
    const update = (value: Comparison) => {
      if (active)
        setComparisons((rows) =>
          rows.map((row) =>
            row.selection.kind === value.selection.kind &&
            row.selection.id === value.selection.id
              ? value
              : row,
          ),
        );
    };
    for (const selection of selected)
      void (async () => {
        let cached: Comparison | undefined;
        try {
          const stored = await getTimetableRepository().getSnapshot(
            selection.label,
            monday(date),
          );
          if (stored?.snapshot.group.ruzId === selection.id) {
            const day = mobileDayView(stored.snapshot, date);
            if (day.kind === "known") {
              cached = {
                selection,
                lessons: day.lessons.filter((l) =>
                  showStudentScheduleSubject(l.subject),
                ),
                fetchedAt: stored.snapshot.sourceFetchedAt,
                state: "stale",
              };
              update(cached);
              if (
                stored.snapshot.state === "FRESH" &&
                stored.snapshot.sourceFetchedAt &&
                Date.now() - Date.parse(stored.snapshot.sourceFetchedAt) <
                  10 * 60_000
              ) {
                update({ ...cached, state: "fresh" });
                return;
              }
            }
          }
        } catch {
          /* Retain explicit loading/unavailable state. */
        }
        const result =
          selection.kind === "teacher"
            ? await syncTeacherTimetableFromRuz(
                selection.id,
                selection.label,
                date,
              )
            : await syncGroupTimetableFromRuzId(
                selection.id,
                selection.label,
                date,
              );
        if (result.success) {
          const day = mobileDayView(result.timetable, date);
          if (day.kind === "known") {
            update({
              selection,
              lessons: day.lessons.filter((l) =>
                showStudentScheduleSubject(l.subject),
              ),
              state: result.state === "FRESH" ? "fresh" : "stale",
              fetchedAt: result.timetable.sourceFetchedAt,
            });
            return;
          }
        }
        update(
          cached ?? {
            selection,
            lessons: [],
            state: "unavailable",
            fetchedAt: null,
          },
        );
      })();
    return () => {
      active = false;
    };
  }, [selected, date]);
  const add = (selection: Selection) => {
    setSelected((previous) =>
      previous.some((s) => s.kind === selection.kind && s.id === selection.id)
        ? previous
        : [...previous, selection].slice(-3),
    );
    setPicker(false);
  };
  const rows = [
    ...primaryLessons.map((lesson) => ({
      lesson,
      label: primaryLabel,
      color: colorsBySource[0],
      key: `primary:${lesson.id}`,
    })),
    ...comparisons.flatMap((entry, index) =>
      entry.lessons.map((lesson) => ({
        lesson,
        label: entry.selection.label,
        color: colorsBySource[index + 1],
        key: `${entry.selection.kind}:${entry.selection.id}:${lesson.id}`,
      })),
    ),
  ].sort(
    (a, b) =>
      a.lesson.start.localeCompare(b.lesson.start) ||
      a.label.localeCompare(b.label),
  );
  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: "700",
            flex: 1,
          }}
        >
          Пары на день
        </Text>
        <Pressable
          onPress={() => setPicker(true)}
          accessibilityRole="button"
          style={{ padding: 12, minHeight: 48 }}
        >
          <Text style={{ color: colors.link }}>Сравнить ＋</Text>
        </Pressable>
      </View>
      {comparisons.map((entry) => (
        <View
          key={`${entry.selection.kind}:${entry.selection.id}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text }}>{entry.selection.label}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {entry.state === "loading"
                ? "Обновляем…"
                : entry.state === "unavailable"
                  ? "Расписание не загружено"
                  : `${entry.state === "stale" ? "Сохранённая копия" : "РУЗ"} · ${entry.fetchedAt ? new Date(entry.fetchedAt).toLocaleString("ru-RU") : ""}${entry.lessons.length === 0 ? " · отображаемых пар нет" : ""}`}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              setSelected((all) =>
                all.filter(
                  (s) =>
                    s.kind !== entry.selection.kind ||
                    s.id !== entry.selection.id,
                ),
              )
            }
            accessibilityLabel={`Убрать сравнение ${entry.selection.label}`}
            style={{ padding: 12, minHeight: 48 }}
          >
            <Text style={{ color: colors.link }}>Убрать</Text>
          </Pressable>
        </View>
      ))}
      {!loaded ? (
        <Text style={{ color: colors.muted, marginVertical: 16 }}>
          Основное расписание не загружено
        </Text>
      ) : null}
      {comparisons.some((s) => s.state === "loading") ? (
        <ActivityIndicator color={colors.link} />
      ) : null}
      {rows.map(({ lesson, label, color, key }) => (
        <View
          key={key}
          style={{
            paddingVertical: 18,
            borderBottomWidth: 1,
            borderColor: colors.line,
            flexDirection: "row",
            gap: 12,
          }}
        >
          <View style={{ width: 3, backgroundColor: color, borderRadius: 2 }} />
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}
            >
              {label} · {lesson.start}–{lesson.scheduledEnd}
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 17,
                lineHeight: 23,
                fontWeight: "600",
              }}
            >
              {lesson.subject}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 20 }}>
              {lessonTypeLabel(lesson.type)}
              {lesson.rooms.length ? ` · ${lesson.rooms.join(", ")}` : ""}
            </Text>
            {lesson.teachers.length ? (
              <Text
                style={{ color: colors.muted, marginTop: 4, lineHeight: 20 }}
              >
                {lesson.teachers.join(", ")}
              </Text>
            ) : null}
            {lesson.note ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                {lesson.note}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
      {loaded && !rows.length ? (
        <Text style={{ color: colors.muted, marginVertical: 16 }}>
          На этот день отображаемых пар нет
        </Text>
      ) : null}
      <SchedulePickerModal
        visible={picker}
        selectedSchedule={primaryLabel}
        onSelectGroup={(code, id) => {
          const ruzId =
            id ?? PUBLIC_GROUPS.find((group) => group.code === code)?.ruzId;
          if (ruzId) add({ kind: "group", id: ruzId, label: code });
        }}
        onSelectTeacher={(id, label) => add({ kind: "teacher", id, label })}
        onClose={() => setPicker(false)}
      />
    </View>
  );
}
