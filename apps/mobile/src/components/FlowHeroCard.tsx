import {
  lessonTypeLabel,
  teachingRoom,
  type MobileLesson,
} from "@studentvalue/mobile-contracts";
import { View, Text, StyleSheet, Pressable } from "react-native";
import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../theme/ThemeProvider";
import { ArrowUpRightIcon, ChevronDownIcon } from "./NativeIcons";

type FlowHeroCardProps = {
  lesson: MobileLesson | null;
  dateLabel: string;
  focusDayLabel?: string;
  isToday: boolean;
  isLoaded: boolean;
  totalLessonsToday: number;
  currentProgress?: number;
  following?: { lesson: MobileLesson; dateLabel?: string };
  stale: boolean;
  loading: boolean;
  error?: string;
  containerHeight: number;
  onOpenSubject: (lesson: MobileLesson) => void;
  onScrollCuePress: () => void;
  onOpenFollowing?: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onResetToday: () => void;
};

export function FlowHeroCard({
  lesson,
  dateLabel,
  focusDayLabel,
  isToday,
  isLoaded,
  totalLessonsToday,
  currentProgress,
  following,
  stale,
  loading,
  error,
  containerHeight,
  onOpenSubject,
  onScrollCuePress,
  onOpenFollowing,
  onPrevDay,
  onNextDay,
  onResetToday,
}: FlowHeroCardProps) {
  const { isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const emptyTitle = !isLoaded
    ? loading
      ? "Загружаем расписание"
      : "Расписание пока недоступно"
    : totalLessonsToday === 0
      ? "В этот день пар нет"
      : "Пары на сегодня закончились";
  const emptyDetail = !isLoaded
    ? (error ?? "На устройстве нет расписания на эту неделю.")
    : isToday && error
      ? "Расписание следующей недели пока недоступно."
      : isToday && loading
        ? "Проверяем расписание следующей недели."
        : isToday
          ? "Можно открыть другой день или перейти к работам."
          : null;

  const progress = currentProgress !== undefined && (
    <View
      style={styles.progressTrack}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Прогресс пары"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(currentProgress),
      }}
    >
      <View style={[styles.progressBar, { width: `${currentProgress}%` }]} />
    </View>
  );

  return (
    <View style={[styles.container, { minHeight: containerHeight || 560 }]}>
      <View style={styles.dateBlock}>
        <View style={styles.dateNav}>
          <Pressable
            onPress={onPrevDay}
            style={styles.dayArrow}
            accessibilityRole="button"
            accessibilityLabel="Предыдущий день"
          >
            <Text style={[styles.arrowText, isDark && styles.darkDate]}>‹</Text>
          </Pressable>
          <Text style={[styles.date, isDark && styles.darkDate]}>
            {dateLabel}
          </Text>
          <Pressable
            onPress={onNextDay}
            style={styles.dayArrow}
            accessibilityRole="button"
            accessibilityLabel="Следующий день"
          >
            <Text style={[styles.arrowText, isDark && styles.darkDate]}>›</Text>
          </Pressable>
        </View>
        {!isToday && (
          <Pressable
            onPress={onResetToday}
            style={styles.action}
            accessibilityRole="button"
          >
            <Text style={[styles.actionText, isDark && styles.darkDate]}>
              Сегодня
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.center}>
        {lesson ? (
          <>
            <Text style={styles.eyebrow}>
              {focusDayLabel ??
                (currentProgress !== undefined
                  ? "Текущая пара"
                  : isToday
                    ? "Ближайшая пара"
                    : "Первая пара")}
            </Text>
            <Text style={styles.time}>{lesson.start}</Text>
            {currentProgress !== undefined && (
              <View style={styles.underTime}>{progress}</View>
            )}
            <Text style={styles.subject}>{lesson.subject}</Text>
            <Text style={styles.type}>{lessonTypeLabel(lesson.type)}</Text>
            <Text style={styles.room}>
              {lesson.rooms.map(teachingRoom).join(" / ") ||
                "Аудитория не указана"}
            </Text>
            {lesson.teachers.length > 0 && (
              <Text style={styles.muted}>{lesson.teachers.join(", ")}</Text>
            )}
            {lesson.note && <Text style={styles.muted}>{lesson.note}</Text>}
            <Pressable
              style={[styles.action, styles.subjectAction]}
              onPress={() => onOpenSubject(lesson)}
              accessibilityRole="button"
              accessibilityLabel={`Открыть предмет ${lesson.subject}`}
            >
              <Text style={styles.actionText}>Открыть предмет</Text>
              <ArrowUpRightIcon size={14} color="#273ca7" />
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            {emptyDetail && <Text style={styles.muted}>{emptyDetail}</Text>}
          </>
        )}
      </View>

      <View style={styles.bottom}>
        {following && onOpenFollowing && (
          <Pressable
            onPress={onOpenFollowing}
            style={styles.following}
            accessibilityRole="button"
            accessibilityLabel={`Открыть день: ${following.dateLabel ?? dateLabel}, ${following.lesson.start}, ${following.lesson.subject}`}
          >
            <View style={styles.followingContent}>
              <Text style={styles.eyebrow}>
                {following.dateLabel ?? "Дальше"} · {following.lesson.start}
              </Text>
              <Text style={styles.followingTitle} numberOfLines={2}>
                {following.lesson.subject}
              </Text>
            </View>
            <ChevronDownIcon size={16} color="#414c74" />
          </Pressable>
        )}
        {stale && <Text style={styles.cache}>Сохранённое расписание РУЗ</Text>}
        <Pressable
          style={styles.action}
          onPress={onScrollCuePress}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>
            {lesson || totalLessonsToday
              ? "Все пары на день"
              : "Расписание и сроки"}
          </Text>
          <ChevronDownIcon size={16} color="#273ca7" />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
    darkDate: { color: "#f0f3ff" },
    eyebrow: { fontSize: 14, fontWeight: "600", color: "#3d476a" },
    dateBlock: { alignItems: "center" },
    dateNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    dayArrow: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    arrowText: { fontSize: 23, color: colors.link },
    date: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: "600",
      color: colors.muted,
      textAlign: "center",
    },
    center: {
      justifyContent: "center",
      flexGrow: 1,
      paddingHorizontal: 22,
      paddingVertical: 22,
      marginVertical: 5,
      backgroundColor: "rgba(245,247,255,0.92)",
      borderRadius: 27,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.8)",
      gap: 6,
    },
    time: {
      fontVariant: ["tabular-nums"],
      fontSize: 60,
      fontWeight: "800",
      letterSpacing: -3,
      color: "#161e3a",
      textAlign: "left",
    },
    underTime: { width: "100%", marginBottom: 7 },
    progressTrack: {
      width: "100%",
      height: 4,
      marginTop: 4,
      borderRadius: 2,
      backgroundColor: "#c1c9e8",
      overflow: "hidden",
    },
    progressBar: {
      height: "100%",
      backgroundColor: "#922454",
      borderRadius: 2,
    },
    subject: {
      maxWidth: 440,
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 30,
      textAlign: "left",
      color: "#161e3a",
    },
    type: { fontSize: 13, fontWeight: "700", color: "#334597" },
    room: { color: "#303a59", fontSize: 15 },
    muted: { color: "#485373", fontSize: 13 },
    emptyTitle: {
      color: "#161e3a",
      textAlign: "left",
      fontSize: 22,
      fontWeight: "700",
    },
    bottom: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 3 },
    current: { paddingBottom: 7 },
    following: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "rgba(245,247,255,0.77)",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 13,
    },
    followingContent: { flex: 1 },
    followingTitle: {
      marginTop: 3,
      color: "#161e3a",
      fontSize: 14,
      fontWeight: "600",
    },
    cache: {
      color: "#414c74",
      fontSize: 11,
      textAlign: "center",
      marginTop: 4,
    },
    action: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 8,
    },
    subjectAction: { alignSelf: "flex-start", paddingHorizontal: 0 },
    actionText: { color: "#273ca7", fontSize: 14, fontWeight: "700" },
  });
