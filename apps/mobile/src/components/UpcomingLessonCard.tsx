import { lessonTypeLabel } from "@studentvalue/mobile-contracts";
import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../theme/ThemeProvider";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { MobileLesson } from "@studentvalue/mobile-contracts";
import { SpringPressable } from "./SpringPressable";

export interface UpcomingLessonCardProps {
  lesson: MobileLesson;
  onPress?: () => void;
}

const BUILDING_NAMES: Record<string, string> = {
  "1": "Первый корпус",
  "2": "Второй корпус",
  "3": "Третий корпус",
  "4": "Четвёртый корпус",
  "5": "Пятый корпус",
  "9": "Девятый корпус",
  "10": "Десятый корпус",
  "11": "11-й корпус",
  "16": "16-й корпус",
  "Гл.": "Главный корпус",
  ГИ: "Гуманитарный институт",
};

function formatRoom(rooms: string[]): string {
  if (!rooms || rooms.length === 0) return "Аудитория уточняется";
  return rooms
    .map((r) => {
      const trimmed = r.trim();
      const kMatch = trimmed.match(/^(\d+|Гл|ГИ)\s*к\.?\s*(\S+)$/i);
      if (kMatch) {
        const b = BUILDING_NAMES[kMatch[1]] || `${kMatch[1]}-й корпус`;
        return `${b} · аудитория ${kMatch[2]}`;
      }
      const dashMatch = trimmed.match(/^(\d+)-(\d+[a-zA-Zа-яА-Я]?)$/);
      if (dashMatch) {
        const b = BUILDING_NAMES[dashMatch[1]] || `${dashMatch[1]}-й корпус`;
        return `${b} · аудитория ${dashMatch[2]}`;
      }
      return trimmed;
    })
    .join(", ");
}

export const UpcomingLessonCard: React.FC<UpcomingLessonCardProps> = ({
  lesson,
  onPress,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <SpringPressable
      style={styles.cardContainer}
      activeScale={0.97}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Пара ${lesson.start}: ${lesson.subject}`}
    >
      <View style={styles.timeHeader}>
        <Text style={styles.timeText}>{lesson.start}</Text>
        <Text style={styles.durationText}>до {lesson.scheduledEnd}</Text>
      </View>

      <Text style={styles.subjectText}>{lesson.subject}</Text>

      <View style={styles.detailsRow}>
        <Text style={styles.detailsText}>
          {lesson.type ? `${lessonTypeLabel(lesson.type)} · ` : ""}
          {formatRoom(lesson.rooms)}
        </Text>
      </View>

      {lesson.teachers.length > 0 && (
        <Text style={styles.teacherText}>{lesson.teachers.join(", ")}</Text>
      )}
    </SpringPressable>
  );
};

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    cardContainer: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.07)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    timeHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
      marginBottom: 6,
    },
    timeText: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.link,
      fontFamily: "monospace",
    },
    durationText: {
      fontSize: 12,
      color: colors.subtle,
      fontFamily: "monospace",
    },
    subjectText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      lineHeight: 22,
      marginBottom: 6,
    },
    detailsRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    detailsText: {
      fontSize: 13,
      color: colors.muted,
    },
    teacherText: {
      fontSize: 12,
      color: colors.subtle,
      marginTop: 4,
    },
  });
