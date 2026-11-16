import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  calculateLessonProgress,
  type MobileLesson,
} from "@studentvalue/mobile-contracts";
import { SpringPressable } from "./SpringPressable";
import { ArrowUpRightIcon, ChevronDownIcon } from "./NativeIcons";

export type FlowHeroCardProps = {
  lesson: MobileLesson | null;
  groupCode: string;
  dateLabel: string;
  isToday: boolean;
  isLoaded: boolean;
  totalLessonsToday: number;
  allDoneToday: boolean;
  nowMoscowMinutes: number;
  containerHeight?: number;
  onOpenSubject?: (lesson: MobileLesson) => void;
  onSelectGroup?: () => void;
  onScrollCuePress?: () => void;
};

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
  "ГИ": "Гуманитарный институт",
};

function formatPolytechRoom(rooms: string[]): string {
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

export const FlowHeroCard: React.FC<FlowHeroCardProps> = ({
  lesson,
  groupCode,
  dateLabel,
  isToday,
  isLoaded,
  totalLessonsToday,
  allDoneToday,
  nowMoscowMinutes,
  containerHeight,
  onOpenSubject,
  onSelectGroup,
  onScrollCuePress,
}) => {
  const cardHeight = containerHeight && containerHeight > 300 ? containerHeight : 560;

  if (!isLoaded) {
    return (
      <View style={[styles.stateContainer, { height: cardHeight }]}>
        <Text style={styles.stateTitle}>Расписание не загружено</Text>
        <Text style={styles.stateSubtitle}>
          Данные отсутствуют в памяти устройства. Потяните вниз для обновления.
        </Text>
      </View>
    );
  }

  if (totalLessonsToday === 0) {
    return (
      <View style={[styles.stateContainer, { height: cardHeight }]}>
        <SpringPressable onPress={onSelectGroup} activeScale={0.94}>
          <Text style={styles.groupCodeEyebrow}>{groupCode}</Text>
        </SpringPressable>
        <Text style={styles.dateEyebrow}>{dateLabel}</Text>
        <Text style={styles.bigEmptyTime}>—:—</Text>
        <Text style={styles.stateTitle}>В этот день пар нет</Text>
        <Text style={styles.stateSubtitle}>
          Выходной или свободный от занятий день по расписанию группы.
        </Text>
      </View>
    );
  }

  if (allDoneToday) {
    return (
      <View style={[styles.stateContainer, { height: cardHeight }]}>
        <SpringPressable onPress={onSelectGroup} activeScale={0.94}>
          <Text style={styles.groupCodeEyebrow}>{groupCode}</Text>
        </SpringPressable>
        <Text style={styles.dateEyebrow}>{dateLabel}</Text>
        <Text style={styles.bigEmptyTime}>✓</Text>
        <Text style={styles.stateTitle}>Занятия на сегодня завершены</Text>
        <Text style={styles.stateSubtitle}>
          Все пары подошли к концу. Листайте ниже для просмотра дедлайнов.
        </Text>
        {onScrollCuePress && (
          <TouchableOpacity
            style={styles.scrollCueContainer}
            onPress={onScrollCuePress}
            activeOpacity={0.7}
          >
            <Text style={styles.scrollCueText}>Сроки и задания ↓</Text>
            <ChevronDownIcon size={16} color="#93c5fd" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!lesson) {
    return null;
  }

  const progressResult = isToday
    ? calculateLessonProgress(lesson.start, nowMoscowMinutes, 90)
    : { isOngoing: false, progressPercent: 0 };
  const isOngoing = progressResult.isOngoing;
  const progressPercent = progressResult.progressPercent;

  return (
    <View style={[styles.heroFullscreenContainer, { height: cardHeight }]}>
      {/* Top section: Group and Date */}
      <View style={styles.heroTopGroup}>
        <SpringPressable
          onPress={onSelectGroup}
          activeScale={0.95}
          accessibilityRole="button"
          accessibilityLabel={`Группа ${groupCode}. Нажмите для выбора.`}
        >
          <Text style={styles.groupCodeEyebrow}>{groupCode}</Text>
        </SpringPressable>
        <Text style={styles.dateEyebrow}>{dateLabel}</Text>
      </View>

      {/* Center section: Clock, Title, Format, Room, Teacher, Link */}
      <View style={styles.heroCenterGroup}>
        <View style={styles.timeWrapper}>
          <Text style={styles.bigTimeText}>{lesson.start}</Text>
          {isOngoing && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${Math.min(100, Math.max(4, progressPercent))}%` },
                ]}
              />
            </View>
          )}
        </View>

        <Text style={styles.subjectTitleHero} numberOfLines={4}>
          {lesson.subject.toUpperCase()}
        </Text>

        {lesson.type ? (
          <Text style={styles.lessonTypeHero}>{lesson.type}</Text>
        ) : null}

        <Text style={styles.roomHero}>{formatPolytechRoom(lesson.rooms)}</Text>

        {lesson.teachers.length > 0 && (
          <Text style={styles.teacherHero}>{lesson.teachers.join(", ")}</Text>
        )}

        <SpringPressable
          style={styles.openSubjectButton}
          activeScale={0.95}
          onPress={() => onOpenSubject?.(lesson)}
          accessibilityRole="button"
          accessibilityLabel={`Открыть предмет ${lesson.subject}`}
        >
          <Text style={styles.openSubjectText}>Открыть предмет</Text>
          <ArrowUpRightIcon size={14} color="#93c5fd" />
        </SpringPressable>
      </View>

      {/* Bottom section: Action cue to scroll to "Далее сегодня" full screen */}
      <View style={styles.heroBottomGroup}>
        {totalLessonsToday > 1 ? (
          <TouchableOpacity
            style={styles.scrollCueContainer}
            onPress={onScrollCuePress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Открыть расписание на день"
          >
            <Text style={styles.scrollCueText}>
              Далее сегодня ({totalLessonsToday - 1}) ↓
            </Text>
            <ChevronDownIcon size={16} color="#93c5fd" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.scrollCueContainer}
            onPress={onScrollCuePress}
            activeOpacity={0.7}
          >
            <Text style={styles.scrollCueText}>Дедлайны и задания ↓</Text>
            <ChevronDownIcon size={16} color="#93c5fd" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroFullscreenContainer: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  heroTopGroup: {
    alignItems: "center",
    paddingTop: 8,
  },
  groupCodeEyebrow: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  dateEyebrow: {
    fontSize: 15,
    fontWeight: "500",
    color: "#94a3b8",
    textTransform: "capitalize",
  },
  heroCenterGroup: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 10,
  },
  timeWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    minWidth: 160,
  },
  bigTimeText: {
    fontSize: 66,
    fontWeight: "300",
    color: "#f8fafc",
    letterSpacing: -1.5,
    fontFamily: "monospace",
    textAlign: "center",
  },
  bigEmptyTime: {
    fontSize: 52,
    fontWeight: "300",
    color: "#475569",
    marginVertical: 12,
    textAlign: "center",
  },
  progressTrack: {
    width: "100%",
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#a5b4fc",
    borderRadius: 2,
  },
  subjectTitleHero: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 30,
    letterSpacing: 0.5,
    marginBottom: 10,
    maxWidth: 340,
  },
  lessonTypeHero: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fda4af",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  roomHero: {
    fontSize: 15,
    fontWeight: "500",
    color: "#cbd5e1",
    textAlign: "center",
    marginBottom: 4,
  },
  teacherHero: {
    fontSize: 14,
    color: "#8a9bb5",
    textAlign: "center",
    marginBottom: 14,
  },
  openSubjectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "rgba(51, 120, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.25)",
    borderRadius: 24,
    marginTop: 2,
  },
  openSubjectText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#93c5fd",
  },
  heroBottomGroup: {
    alignItems: "center",
    paddingBottom: 4,
  },
  scrollCueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  scrollCueText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#93c5fd",
  },
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 8,
  },
  stateSubtitle: {
    fontSize: 14,
    color: "#8a9bb5",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
});
