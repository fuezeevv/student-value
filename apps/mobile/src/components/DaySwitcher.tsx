import { GlassFill } from "./GlassFill";
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
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  monthYearLabel: string;
  weekParity: string;
};

export const DaySwitcher: React.FC<DaySwitcherProps> = ({
  days,
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  monthYearLabel,
  weekParity,
}) => {
  const styles = createStyles;

  return (
    <View style={styles.container}>
      <GlassFill />
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
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.monthText}>Неделя</Text>
          <Text style={styles.parityText}>
            {monthYearLabel} · {weekParity}
          </Text>
        </View>

        <View style={styles.arrowGroup}>
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
    </View>
  );
};

const createStyles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    overflow: "hidden",
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f7f8ff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  arrowGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  weekArrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(147, 197, 253, 0.08)",
  },
  weekArrowText: {
    fontSize: 16,
    color: "#273ca7",
    fontWeight: "700",
    lineHeight: 18,
  },
  headerCenter: {
    alignItems: "center",
  },
  monthText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#161e3a",
    letterSpacing: -0.2,
    textTransform: "capitalize",
  },
  parityText: {
    fontSize: 11,
    color: "#475373",
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
    backgroundColor: "#4256c5",
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
    color: "#ffffff",
  },
  textInactive: {
    color: "#161e3a",
  },
  textToday: {
    color: "#273ca7",
  },
  labelActive: {
    color: "#ffffff",
  },
  labelInactive: {
    color: "#515d7a",
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
    backgroundColor: "#ffffff",
  },
  dotInactive: {
    backgroundColor: "#818cf8",
  },
  dotSpacer: {
    width: 4,
    height: 4,
  },
});
