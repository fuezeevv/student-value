import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  parseTimeToMinutes,
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
  onPrevDay?: () => void;
  onNextDay?: () => void;
  onResetToday?: () => void;
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
  onPrevDay,
  onNextDay,
  onResetToday,
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
          <View style={styles.groupCodeRow}>
            <Text style={styles.groupCodeEyebrow}>{groupCode}</Text>
            <ChevronDownIcon size={13} color="#94a3b8" />
          </View>
        </SpringPressable>
        <View style={styles.dateNavRow}>
          {onPrevDay && (
            <TouchableOpacity
              onPress={onPrevDay}
              style={styles.heroDayArrow}
              accessibilityRole="button"
              accessibilityLabel="Предыдущий день"
            >
              <Text style={styles.heroDayArrowText}>‹</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.dateEyebrow}>{dateLabel}</Text>
          {onNextDay && (
            <TouchableOpacity
              onPress={onNextDay}
              style={styles.heroDayArrow}
              accessibilityRole="button"
              accessibilityLabel="Следующий день"
            >
              <Text style={styles.heroDayArrowText}>›</Text>
            </TouchableOpacity>
          )}
        </View>
        {!isToday && onResetToday && (
          <TouchableOpacity
            onPress={onResetToday}
            style={styles.heroTodayChip}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Вернуться к сегодняшнему дню"
          >
            <Text style={styles.heroTodayChipText}>Сегодня</Text>
          </TouchableOpacity>
        )}
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
          <View style={styles.groupCodeRow}>
            <Text style={styles.groupCodeEyebrow}>{groupCode}</Text>
            <ChevronDownIcon size={13} color="#94a3b8" />
          </View>
        </SpringPressable>
        <View style={styles.dateNavRow}>
          {onPrevDay && (
            <TouchableOpacity
              onPress={onPrevDay}
              style={styles.heroDayArrow}
              accessibilityRole="button"
              accessibilityLabel="Предыдущий день"
            >
              <Text style={styles.heroDayArrowText}>‹</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.dateEyebrow}>{dateLabel}</Text>
          {onNextDay && (
            <TouchableOpacity
              onPress={onNextDay}
              style={styles.heroDayArrow}
              accessibilityRole="button"
              accessibilityLabel="Следующий день"
            >
              <Text style={styles.heroDayArrowText}>›</Text>
            </TouchableOpacity>
          )}
        </View>
        {!isToday && onResetToday && (
          <TouchableOpacity
            onPress={onResetToday}
            style={styles.heroTodayChip}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Вернуться к сегодняшнему дню"
          >
            <Text style={styles.heroTodayChipText}>Сегодня</Text>
          </TouchableOpacity>
        )}
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

  const startMin = parseTimeToMinutes(lesson.start);
  const endMin = lesson.scheduledEnd ? parseTimeToMinutes(lesson.scheduledEnd) : startMin + 90;
  const isOngoing = isToday && nowMoscowMinutes >= startMin && nowMoscowMinutes < endMin;
  const isPast = isToday && nowMoscowMinutes >= endMin;
  const isFuture = isToday && nowMoscowMinutes < startMin;

  const totalDuration = Math.max(1, endMin - startMin);
  const elapsed = Math.max(0, Math.min(totalDuration, nowMoscowMinutes - startMin));
  const remaining = Math.max(0, endMin - nowMoscowMinutes);
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
  const minutesUntilStart = startMin - nowMoscowMinutes;

  return (
    <View style={[styles.heroFullscreenContainer, { height: cardHeight }]}>
      {/* Top section: Group and Date with day arrows and return to today */}
      <View style={styles.heroTopGroup}>
        <SpringPressable
          onPress={onSelectGroup}
          activeScale={0.95}
          accessibilityRole="button"
          accessibilityLabel={`Расписание ${groupCode}. Нажмите для выбора группы или преподавателя.`}
        >
          <View style={styles.groupCodeRow}>
            <Text style={styles.groupCodeEyebrow}>{groupCode}</Text>
            <ChevronDownIcon size={13} color="#94a3b8" />
          </View>
        </SpringPressable>
        <View style={styles.dateNavRow}>
          {onPrevDay && (
            <TouchableOpacity
              onPress={onPrevDay}
              style={styles.heroDayArrow}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Предыдущий день"
            >
              <Text style={styles.heroDayArrowText}>‹</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.dateEyebrow}>{dateLabel}</Text>
          {onNextDay && (
            <TouchableOpacity
              onPress={onNextDay}
              style={styles.heroDayArrow}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Следующий день"
            >
              <Text style={styles.heroDayArrowText}>›</Text>
            </TouchableOpacity>
          )}
        </View>
        {!isToday && onResetToday && (
          <TouchableOpacity
            onPress={onResetToday}
            style={styles.heroTodayChip}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Вернуться к сегодняшнему дню"
          >
            <Text style={styles.heroTodayChipText}>Сегодня</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Center section: Clock, Progress breakdown, Title, Format, Room, Teacher, Link */}
      <View style={styles.heroCenterGroup}>
        <View style={styles.timeWrapper}>
          <Text style={styles.bigTimeText}>{lesson.start}</Text>

          {/* Ongoing Lesson: Smooth filling bar directly under the time */}
          {isOngoing && (
            <View style={styles.ongoingContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${Math.min(100, Math.max(3, progressPercent))}%` },
                  ]}
                />
              </View>

              <View style={styles.ongoingInfoRow}>
                <View style={styles.liveDot} />
                <Text style={styles.timeRemainingText}>
                  {remaining > 0
                    ? `Осталось ${remaining} мин · Прошло ${elapsed} мин`
                    : `Завершается · Прошло ${elapsed} мин`}
                </Text>
              </View>
            </View>
          )}

          {/* Upcoming lesson countdown */}
          {isFuture && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {minutesUntilStart <= 120
                  ? `До начала: ${minutesUntilStart} мин`
                  : `Начало в ${lesson.start}`}
              </Text>
            </View>
          )}

          {/* Completed lesson label */}
          {isPast && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgePastText}>
                Пара завершена {lesson.scheduledEnd ? `в ${lesson.scheduledEnd}` : ""}
              </Text>
            </View>
          )}

          {!isToday && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {lesson.scheduledEnd ? `${lesson.start} — ${lesson.scheduledEnd}` : "90 минут"}
              </Text>
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
  },
  groupCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  dateNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  heroDayArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  heroDayArrowText: {
    fontSize: 18,
    color: "#94a3b8",
    fontWeight: "700",
    lineHeight: 20,
  },
  heroTodayChip: {
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  heroTodayChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#93c5fd",
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
    minWidth: 220,
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
  ongoingContainer: {
    width: "100%",
    maxWidth: 220,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 6,
  },
  progressTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#38bdf8",
    borderRadius: 2,
  },
  ongoingInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  timeRemainingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#cbd5e1",
    letterSpacing: 0.2,
  },
  statusBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#93c5fd",
  },
  statusBadgePastText: {
    fontSize: 12,
    color: "#64748b",
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
