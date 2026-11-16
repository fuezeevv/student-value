import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
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
      // Match "3 к. 406" or "3 к.406"
      const kMatch = trimmed.match(/^(\d+|Гл|ГИ)\s*к\.?\s*(\S+)$/i);
      if (kMatch) {
        const b = BUILDING_NAMES[kMatch[1]] || `${kMatch[1]}-й корпус`;
        return `${b} · аудитория ${kMatch[2]}`;
      }
      // Match "3-406"
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
  onOpenSubject,
  onSelectGroup,
  onScrollCuePress,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  // Staggered entrance animation when lesson or date changes
  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(18);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        speed: 20,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, [lesson?.id, dateLabel]);

  // Subtle breathing loop for the scroll indicator
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 6,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const windowHeight = Dimensions.get("window").height;
  // Hero takes up almost full viewport (subtracting status bar + header + bottom bar ~ 160)
  const heroMinHeight = Math.max(480, windowHeight - 170);

  if (!isLoaded) {
    return (
      <View style={[styles.stateContainer, { minHeight: heroMinHeight }]}>
        <Text style={styles.stateTitle}>Расписание не загружено</Text>
        <Text style={styles.stateSubtitle}>
          Данные отсутствуют в памяти устройства. Потяните вниз для обновления.
        </Text>
      </View>
    );
  }

  if (totalLessonsToday === 0) {
    return (
      <View style={[styles.stateContainer, { minHeight: heroMinHeight }]}>
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
      <View style={[styles.stateContainer, { minHeight: heroMinHeight }]}>
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
          <SpringPressable
            style={styles.scrollCueContainer}
            onPress={onScrollCuePress}
            activeScale={0.92}
          >
            <Text style={styles.scrollCueText}>Сроки и задания</Text>
            <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
              <ChevronDownIcon size={14} color="#64748b" />
            </Animated.View>
          </SpringPressable>
        )}
      </View>
    );
  }

  if (!lesson) {
    return null;
  }

  // Calculate 90-minute progress if ongoing
  const progressResult = isToday
    ? calculateLessonProgress(lesson.start, nowMoscowMinutes, 90)
    : { isOngoing: false, progressPercent: 0 };
  const isOngoing = progressResult.isOngoing;
  const progressPercent = progressResult.progressPercent;

  return (
    <Animated.View
      style={[
        styles.heroFullscreenContainer,
        {
          minHeight: heroMinHeight,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* 1. Subtle Group Code */}
      <SpringPressable
        onPress={onSelectGroup}
        activeScale={0.95}
        accessibilityRole="button"
        accessibilityLabel={`Группа ${groupCode}. Нажмите для выбора.`}
      >
        <Text style={styles.groupCodeEyebrow}>{groupCode}</Text>
      </SpringPressable>

      {/* 2. Date */}
      <Text style={styles.dateEyebrow}>{dateLabel}</Text>

      {/* 3. Big Start Time */}
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

      {/* 4. Large Bold Uppercase Subject Title */}
      <Text style={styles.subjectTitleHero} numberOfLines={4}>
        {lesson.subject.toUpperCase()}
      </Text>

      {/* 5. Lesson Type Pill / Label */}
      {lesson.type ? (
        <Text style={styles.lessonTypeHero}>{lesson.type}</Text>
      ) : null}

      {/* 6. Building & Room */}
      <Text style={styles.roomHero}>{formatPolytechRoom(lesson.rooms)}</Text>

      {/* 7. Teacher Name */}
      {lesson.teachers.length > 0 && (
        <Text style={styles.teacherHero}>{lesson.teachers.join(", ")}</Text>
      )}

      {/* 8. Action Link: Открыть предмет ↗ */}
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

      {/* 9. Scroll down guidance cue */}
      {totalLessonsToday > 1 && (
        <SpringPressable
          style={styles.scrollCueContainer}
          onPress={onScrollCuePress}
          activeScale={0.92}
        >
          <Text style={styles.scrollCueText}>Ещё {totalLessonsToday - 1} пары сегодня</Text>
          <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
            <ChevronDownIcon size={14} color="#64748b" />
          </Animated.View>
        </SpringPressable>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  heroFullscreenContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  groupCodeEyebrow: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  dateEyebrow: {
    fontSize: 15,
    fontWeight: "500",
    color: "#94a3b8",
    marginBottom: 14,
    textTransform: "capitalize",
  },
  timeWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
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
    marginBottom: 12,
    maxWidth: 340,
  },
  lessonTypeHero: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fda4af",
    textAlign: "center",
    marginBottom: 8,
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
    marginBottom: 16,
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
    marginTop: 4,
  },
  openSubjectText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#93c5fd",
  },
  scrollCueContainer: {
    marginTop: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  scrollCueText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
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
