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
}

interface SubjectSummary {
  title: string;
  types: string[];
  teachers: string[];
  rooms: string[];
  lessonCount: number;
  taskCount: number;
  sampleLesson: MobileLesson;
}

export const SubjectsTab = React.memo<SubjectsTabProps>(({
  lessons,
  tasks,
  groupCode,
  onOpenLesson,
}) => {
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

    // Count matching tasks
    for (const task of tasks) {
      const taskSubjLower = task.subject.toLowerCase();
      for (const [title, item] of subjectMap.entries()) {
        const titleLower = title.toLowerCase();
        if (
          taskSubjLower.includes(titleLower) ||
          titleLower.includes(taskSubjLower)
        ) {
          item.taskCount += 1;
        }
      }
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
          Группа {groupCode} · {subjects.length} дисциплин в расписании
        </Text>
      </View>

      {subjects.length > 0 ? (
        subjects.map((s) => (
          <SpringPressable
            key={s.title}
            style={styles.subjectCard}
            activeScale={0.97}
            onPress={() => onOpenLesson(s.sampleLesson)}
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
              <ArrowUpRightIcon size={14} color="#93c5fd" />
            </View>

            <Text style={styles.subjectTitle}>{s.title}</Text>

            {s.teachers.length > 0 && (
              <Text style={styles.teacherText}>{s.teachers.join(", ")}</Text>
            )}

            <View style={styles.cardFooter}>
              <Text style={styles.footerInfoText}>
                {s.lessonCount} {s.lessonCount === 1 ? "пара" : "пар(ы)"} в неделю
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
            Для выбранной группы нет загруженных пар на этой неделе. Потяните вниз для обновления.
          </Text>
        </View>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1322",
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
    color: "#f8fafc",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#8a9bb5",
  },
  subjectCard: {
    backgroundColor: "#111d33",
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
    color: "#ffffff",
    lineHeight: 23,
    marginBottom: 6,
  },
  teacherText: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 10,
  },
  footerInfoText: {
    fontSize: 12,
    color: "#64748b",
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
    color: "#93c5fd",
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8a9bb5",
    textAlign: "center",
    lineHeight: 20,
  },
});
