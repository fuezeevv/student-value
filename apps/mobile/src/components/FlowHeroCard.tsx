import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  calculateLessonProgress,
  type MobileLesson,
} from "@studentvalue/mobile-contracts";

export type FlowHeroCardProps = {
  lesson: MobileLesson | null;
  dateLabel: string;
  isToday: boolean;
  isLoaded: boolean;
  totalLessonsToday: number;
  allDoneToday: boolean;
  nextLesson?: MobileLesson | null;
  nowMoscowMinutes: number; // minutes from 00:00 Moscow time
};

function parseMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatRoom(rooms: string[]): string {
  if (!rooms.length) return "Аудитория уточняется";
  return rooms
    .map((r) => {
      const trimmed = r.trim();
      const m = trimmed.match(/^(\d+)-(\d+[a-zA-Zа-яА-Я]?)$/);
      if (m) {
        return `${m[1]}-й уч. корпус, ауд. ${m[2]}`;
      }
      return trimmed;
    })
    .join(", ");
}

export const FlowHeroCard: React.FC<FlowHeroCardProps> = ({
  lesson,
  dateLabel,
  isToday,
  isLoaded,
  totalLessonsToday,
  allDoneToday,
  nowMoscowMinutes,
}) => {
  if (!isLoaded) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateTitle}>Расписание не загружено</Text>
        <Text style={styles.stateSubtitle}>
          Данные для этой недели отсутствуют в памяти устройства. Подключитесь к сети для первой синхронизации.
        </Text>
      </View>
    );
  }

  if (totalLessonsToday === 0) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateDate}>{dateLabel}</Text>
        <Text style={styles.stateTitle}>В этот день пар нет</Text>
        <Text style={styles.stateSubtitle}>
          Выходной или свободный от занятий день по расписанию группы.
        </Text>
      </View>
    );
  }

  if (allDoneToday) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateDate}>{dateLabel}</Text>
        <Text style={styles.stateTitle}>Занятия на сегодня завершены</Text>
        <Text style={styles.stateSubtitle}>
          Все пары на сегодня подошли к концу. Переключите день выше для просмотра завтрашнего расписания.
        </Text>
      </View>
    );
  }

  if (!lesson) {
    return null;
  }

  // Calculate 90-minute progress if currently ongoing
  const progressResult = isToday
    ? calculateLessonProgress(lesson.start, nowMoscowMinutes, 90)
    : { isOngoing: false, progressPercent: 0 };
  const isOngoing = progressResult.isOngoing;
  const progressPercent = progressResult.progressPercent;

  return (
    <View style={styles.openContainer}>
      {/* 1. Date above start time */}
      <Text style={styles.dateEyebrow}>{dateLabel}</Text>

      {/* 2. Start time + 90-min subtle progress line */}
      <View style={styles.timeRow}>
        <Text style={styles.startTimeText}>{lesson.start}</Text>
        <Text style={styles.slotDuration}>до {lesson.scheduledEnd}</Text>
      </View>

      {/* Visual progress bar (90 minutes) - NO numbers countdown or "Идёт сейчас" */}
      {isOngoing && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              { width: `${progressPercent}%` },
            ]}
          />
        </View>
      )}

      {/* 3. Subject Name (large, readable typography) */}
      <Text style={styles.subjectTitle}>{lesson.subject}</Text>

      {/* 4. Format pill & location & teacher */}
      <View style={styles.detailsRow}>
        <View style={styles.formatPill}>
          <Text style={styles.formatText}>{lesson.type}</Text>
        </View>
        <Text style={styles.roomText}>{formatRoom(lesson.rooms)}</Text>
      </View>

      {lesson.teachers.length > 0 && (
        <Text style={styles.teacherText}>
          {lesson.teachers.join(", ")}
        </Text>
      )}

      {lesson.note ? (
        <Text style={styles.noteText}>{lesson.note}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  openContainer: {
    paddingVertical: 18,
    paddingHorizontal: 4,
  },
  dateEyebrow: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8a9bb5",
    textTransform: "capitalize",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  startTimeText: {
    fontSize: 38,
    fontWeight: "800",
    color: "#f0f4f8",
    fontFamily: "monospace",
    letterSpacing: -1,
  },
  slotDuration: {
    fontSize: 14,
    fontWeight: "500",
    color: "#8a9bb5",
    fontFamily: "monospace",
  },
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 2,
    marginVertical: 10,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#cfc6ff",
    borderRadius: 2,
  },
  subjectTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 28,
    marginTop: 6,
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  formatPill: {
    backgroundColor: "#16253d",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#223554",
  },
  formatText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#93c5fd",
    textTransform: "uppercase",
  },
  roomText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dbeafe",
  },
  teacherText: {
    fontSize: 13,
    color: "#8a9bb5",
    marginTop: 2,
  },
  noteText: {
    fontSize: 12,
    color: "#fca5a5",
    fontStyle: "italic",
    marginTop: 4,
  },
  stateContainer: {
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stateDate: {
    fontSize: 12,
    color: "#8a9bb5",
    marginBottom: 6,
    fontWeight: "600",
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f0f4f8",
    textAlign: "center",
    marginBottom: 6,
  },
  stateSubtitle: {
    fontSize: 13,
    color: "#8a9bb5",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 320,
  },
});
