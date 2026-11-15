import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { MobileLesson } from "@studentvalue/mobile-contracts";

export type FullDayLessonListProps = {
  lessons: MobileLesson[];
  isLoaded: boolean;
};

export const FullDayLessonList: React.FC<FullDayLessonListProps> = ({
  lessons,
  isLoaded,
}) => {
  if (!isLoaded) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Расписание не загружено</Text>
        <Text style={styles.emptySubtitle}>
          Сохранённая копия для этой недели отсутствует.
        </Text>
      </View>
    );
  }

  if (lessons.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Занятий нет</Text>
        <Text style={styles.emptySubtitle}>
          В этот день по расписанию нет аудиторных занятий.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {lessons.map((lesson, idx) => (
        <View key={lesson.id || `${lesson.start}-${idx}`} style={styles.card}>
          <View style={styles.timeAndTypeRow}>
            <Text style={styles.timeText}>
              {lesson.start} — {lesson.scheduledEnd}
            </Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{lesson.type}</Text>
            </View>
          </View>

          <Text style={styles.subjectText}>{lesson.subject}</Text>

          {lesson.rooms.length > 0 && (
            <Text style={styles.roomText}>{lesson.rooms.join(", ")}</Text>
          )}

          {lesson.teachers.length > 0 && (
            <Text style={styles.teacherText}>{lesson.teachers.join(", ")}</Text>
          )}

          {lesson.note ? (
            <Text style={styles.noteText}>{lesson.note}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: 8,
    gap: 10,
  },
  card: {
    backgroundColor: "#0f1a2e",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1d2d47",
    padding: 14,
  },
  timeAndTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#93c5fd",
    fontFamily: "monospace",
  },
  typeBadge: {
    backgroundColor: "#16253d",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#223554",
  },
  typeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#bfdbfe",
    textTransform: "uppercase",
  },
  subjectText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 20,
    marginBottom: 6,
  },
  roomText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e2e8f0",
    marginBottom: 2,
  },
  teacherText: {
    fontSize: 12,
    color: "#8a9bb5",
  },
  noteText: {
    fontSize: 11,
    color: "#fca5a5",
    fontStyle: "italic",
    marginTop: 4,
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f0f4f8",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#8a9bb5",
    textAlign: "center",
  },
});
