import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../theme/ThemeProvider";
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export type DayItem = {
  date: string; // YYYY-MM-DD
  dayNumber: string; // "16"
  dayLabel: string; // "ПН"
  isToday: boolean;
  hasLessons: boolean;
};

export type DaySwitcherProps = {
  days: DayItem[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onResetToday?: () => void;
  monthYearLabel: string;
  weekParity: string;
  isTodaySelected?: boolean;
};

export const DaySwitcher: React.FC<DaySwitcherProps> = ({
  days,
  selectedDate,
  onSelectDate,
  onPrevDay,
  onNextDay,
  onPrevWeek,
  onNextWeek,
  onResetToday,
  monthYearLabel,
  weekParity,
  isTodaySelected,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {/* Month, Parity and Week navigation */}
      <View style={styles.headerRow}>
        <View style={styles.arrowGroup}>
          {onPrevWeek && (
            <TouchableOpacity
              onPress={onPrevWeek}
              style={styles.weekArrow}
              accessibilityLabel="Предыдущая неделя"
              accessibilityRole="button"
            >
              <Text style={styles.weekArrowText}>«</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onPrevDay}
            style={styles.navArrow}
            accessibilityLabel="Предыдущий день"
            accessibilityRole="button"
          >
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.monthText}>{monthYearLabel}</Text>
          <Text style={styles.parityText}>{weekParity}</Text>
        </View>

        <View style={styles.arrowGroup}>
          <TouchableOpacity
            onPress={onNextDay}
            style={styles.navArrow}
            accessibilityLabel="Следующий день"
            accessibilityRole="button"
          >
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
          {onNextWeek && (
            <TouchableOpacity
              onPress={onNextWeek}
              style={styles.weekArrow}
              accessibilityLabel="Следующая неделя"
              accessibilityRole="button"
            >
              <Text style={styles.weekArrowText}>»</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 7 Day Pills */}
      <View style={styles.daysRow}>
        {days.map((item) => {
          const isSelected = item.date === selectedDate;
          return (
            <TouchableOpacity
              key={item.date}
              onPress={() => onSelectDate(item.date)}
              style={[
                styles.dayPill,
                isSelected ? styles.dayPillActive : styles.dayPillInactive,
                item.isToday && !isSelected && styles.dayPillToday,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.dayNumber} ${item.dayLabel}${
                item.isToday ? ", сегодня" : ""
              }`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.dayNumber,
                  isSelected ? styles.textActive : styles.textInactive,
                  item.isToday && !isSelected && styles.textToday,
                ]}
              >
                {item.dayNumber}
              </Text>
              <Text
                style={[
                  styles.dayLabel,
                  isSelected ? styles.labelActive : styles.labelInactive,
                ]}
              >
                {item.dayLabel}
              </Text>

              {/* Lesson dot indicator */}
              <View style={styles.dotContainer}>
                {item.hasLessons ? (
                  <View
                    style={[
                      styles.dot,
                      isSelected ? styles.dotActive : styles.dotInactive,
                    ]}
                  />
                ) : (
                  <View style={styles.dotSpacer} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Quick return to today button if viewing another day/week */}
      {isTodaySelected === false && onResetToday && (
        <TouchableOpacity
          onPress={onResetToday}
          style={styles.todayBar}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Вернуться к сегодняшнему дню"
        >
          <Text style={styles.todayBarText}>Вернуться к сегодняшнему дню</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      backgroundColor: "rgba(15, 23, 42, 0.4)",
      borderRadius: 18,
      marginHorizontal: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.line,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    arrowGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    navArrow: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: colors.soft,
    },
    weekArrow: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: "rgba(147, 197, 253, 0.08)",
    },
    arrowText: {
      fontSize: 20,
      color: colors.muted,
      fontWeight: "700",
      lineHeight: 22,
    },
    weekArrowText: {
      fontSize: 16,
      color: colors.link,
      fontWeight: "700",
      lineHeight: 18,
    },
    headerCenter: {
      alignItems: "center",
    },
    monthText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: -0.2,
      textTransform: "capitalize",
    },
    parityText: {
      fontSize: 11,
      color: colors.muted,
      fontWeight: "600",
      marginTop: 1,
    },
    daysRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 4,
    },
    dayPill: {
      flex: 1,
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      paddingVertical: 6,
    },
    dayPillActive: {
      backgroundColor: "#cfc6ff",
    },
    dayPillToday: {
      borderWidth: 1,
      borderColor: "rgba(147, 197, 253, 0.4)",
      backgroundColor: "rgba(59, 130, 246, 0.08)",
    },
    dayPillInactive: {
      backgroundColor: "transparent",
    },
    dayNumber: {
      fontSize: 16,
      fontWeight: "800",
      fontFamily: "monospace",
    },
    dayLabel: {
      fontSize: 10,
      fontWeight: "700",
      fontFamily: "monospace",
      marginTop: 2,
    },
    textActive: {
      color: "#0b1a2d",
    },
    textInactive: {
      color: colors.text,
    },
    textToday: {
      color: colors.link,
    },
    labelActive: {
      color: "#0b1a2d",
    },
    labelInactive: {
      color: colors.subtle,
    },
    dotContainer: {
      height: 4,
      marginTop: 3,
      alignItems: "center",
      justifyContent: "center",
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    dotActive: {
      backgroundColor: "#0b1a2d",
    },
    dotInactive: {
      backgroundColor: "#818cf8",
    },
    dotSpacer: {
      width: 4,
      height: 4,
    },
    todayBar: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      backgroundColor: "rgba(147, 197, 253, 0.08)",
    },
    todayBarText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.link,
    },
  });
