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
  monthYearLabel: string;
  weekParity: string;
};

export const DaySwitcher: React.FC<DaySwitcherProps> = ({
  days,
  selectedDate,
  onSelectDate,
  onPrevDay,
  onNextDay,
  monthYearLabel,
  weekParity,
}) => {
  return (
    <View style={styles.container}>
      {/* Month, Parity and Day navigation arrows */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={onPrevDay}
          style={styles.navArrow}
          accessibilityLabel="Предыдущий день"
          accessibilityRole="button"
        >
          <Text style={styles.arrowText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.monthText}>{monthYearLabel}</Text>
          <Text style={styles.parityText}>{weekParity}</Text>
        </View>

        <TouchableOpacity
          onPress={onNextDay}
          style={styles.navArrow}
          accessibilityLabel="Следующий день"
          accessibilityRole="button"
        >
          <Text style={styles.arrowText}>→</Text>
        </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  navArrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  arrowText: {
    fontSize: 18,
    color: "#8a9bb5",
    fontWeight: "600",
  },
  headerCenter: {
    alignItems: "center",
  },
  monthText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f0f4f8",
    letterSpacing: -0.2,
    textTransform: "capitalize",
  },
  parityText: {
    fontSize: 11,
    color: "#8a9bb5",
    fontWeight: "500",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayPill: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 4,
  },
  dayPillActive: {
    backgroundColor: "#cfc6ff",
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
    marginTop: 1,
  },
  textActive: {
    color: "#0b1a2d",
  },
  textInactive: {
    color: "#f0f4f8",
  },
  labelActive: {
    color: "#0b1a2d",
  },
  labelInactive: {
    color: "#8a9bb5",
  },
  dotContainer: {
    height: 4,
    marginTop: 2,
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
});
