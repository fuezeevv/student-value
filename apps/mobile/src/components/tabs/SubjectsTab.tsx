import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../../theme/ThemeProvider";
import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { MobileLesson, CachedTask } from "@studentvalue/mobile-contracts";
import { SpringPressable } from "../SpringPressable";
import { ArrowUpRightIcon } from "../NativeIcons";

export interface SubjectsTabProps {
  lessons: MobileLesson[];
  tasks: CachedTask[];
  groupCode: string;
  onOpenLesson: (lesson: MobileLesson) => void;
  onOpenSubjectTasks: (subject: string) => void;
}

interface SubjectSummary {
  title: string;
  types: string[];
  teachers: string[];
  rooms: string[];
  lessonCount: number;
  taskCount: number;
  sampleLesson: MobileLesson | null;
}

export const SubjectsTab = React.memo<SubjectsTabProps>(
  ({ lessons, tasks, groupCode, onOpenLesson, onOpenSubjectTasks }) => {
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);

    // Aggregate subjects from timetable lessons (memoized)
    const subjects = useMemo(() => {
      const subjectMap = new Map<string, SubjectSummary>();

      for (const l of lessons) {
        const key = l.subject.trim();
        if (!subjectMap.has(key)) {
          subjectMap.set(key, {
            title: key,
            types: [],
            teachers: [],
            rooms: [],
            lessonCount: 0,
            taskCount: 0,
            sampleLesson: l,
          });
        }
        const item = subjectMap.get(key)!;
        item.lessonCount += 1;
        if (l.type && !item.types.includes(l.type)) {
          item.types.push(l.type);
        }
        for (const t of l.teachers) {
          if (t && !item.teachers.includes(t)) {
            item.teachers.push(t);
          }
        }
        for (const r of l.rooms) {
          if (r && !item.rooms.includes(r)) {
            item.rooms.push(r);
          }
        }
      }

      // Issued work remains discoverable even when the selected week has no pair.
      for (const task of tasks) {
        const key = task.subject.trim();
        if (!subjectMap.has(key)) {
          subjectMap.set(key, {
            title: key,
            types: [],
            teachers: [],
            rooms: [],
            lessonCount: 0,
            taskCount: 0,
            sampleLesson: null,
          });
        }
        subjectMap.get(key)!.taskCount++;
      }

      return Array.from(subjectMap.values()).sort((a, b) =>
        a.title.localeCompare(b.title, "ru"),
      );
    }, [lessons, tasks]);

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Учебные предметы</Text>
          <Text style={styles.headerSubtitle}>
            Группа {groupCode} · {subjects.length} предметов с парами или
            заданиями
          </Text>
        </View>

        {subjects.length > 0 ? (
          subjects.map((s) => (
            <SpringPressable
              key={s.title}
              style={styles.subjectCard}
              activeScale={0.97}
              onPress={() =>
                s.sampleLesson
                  ? onOpenLesson(s.sampleLesson)
                  : onOpenSubjectTasks(s.title)
              }
              accessibilityRole="button"
              accessibilityLabel={`Предмет ${s.title}`}
            >
              <View style={styles.cardHeader}>
                <View style={styles.typeRow}>
                  {s.types.map((type) => (
                    <View key={type} style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{type}</Text>
                    </View>
                  ))}
                </View>
                <ArrowUpRightIcon size={14} color={colors.link} />
              </View>

              <Text style={styles.subjectTitle}>{s.title}</Text>

              {s.teachers.length > 0 && (
                <Text style={styles.teacherText}>{s.teachers.join(", ")}</Text>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.footerInfoText}>
                  {s.lessonCount
                    ? `${s.lessonCount} пар в выбранной неделе`
                    : "Пары на этой неделе не загружены"}
                </Text>
                {s.taskCount > 0 && (
                  <View style={styles.taskCountBadge}>
                    <Text style={styles.taskCountText}>
                      {s.taskCount} {s.taskCount === 1 ? "задание" : "заданий"}
                    </Text>
                  </View>
                )}
              </View>
            </SpringPressable>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Предметы не найдены</Text>
            <Text style={styles.emptySubtitle}>
              Для выбранной группы нет загруженных пар на этой неделе. Потяните
              вниз для обновления.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  },
);

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.canvas,
    },
    contentContainer: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.muted,
    },
    subjectCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.07)",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    typeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    typeBadge: {
      backgroundColor: "rgba(253, 164, 175, 0.12)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(253, 164, 175, 0.25)",
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#fda4af",
      textTransform: "uppercase",
    },
    subjectTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      lineHeight: 23,
      marginBottom: 6,
    },
    teacherText: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 12,
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: 10,
    },
    footerInfoText: {
      fontSize: 12,
      color: colors.subtle,
    },
    taskCountBadge: {
      backgroundColor: "rgba(51, 120, 255, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    taskCountText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.link,
    },
    emptyContainer: {
      padding: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
  });
