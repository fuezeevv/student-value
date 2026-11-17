import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../theme/ThemeProvider";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import type { CachedTask } from "@studentvalue/mobile-contracts";

const WELLBEING_STORAGE_KEY = "sv_wellbeing_focus_v1";

export type WellbeingDay = {
  seconds: number;
  steps: string[];
  goal?: number;
};

export type WellbeingData = {
  days: Record<string, WellbeingDay>;
  running: number | null;
  goal: number;
  starts: Record<string, number>;
};

export function getMoscowDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const GOALS = [25, 45, 60, 90, 120, 180];

function planningLabels(task: CachedTask): string[] {
  if (task.type !== "LABORATORY") return ["Поработать над заданием"];
  const range = /(Lab|ЛР)\s*(\d+)\s*[–—-]\s*(?:Lab|ЛР)?\s*(\d+)/i.exec(
    task.title,
  );
  if (range) {
    const start = Number(range[2]);
    const end = Number(range[3]);
    if (end >= start && end - start < 20) {
      return Array.from(
        { length: (end - start + 1) * 3 },
        (_, i) =>
          `${range[1]}${start + Math.floor(i / 3)} · часть ${(i % 3) + 1}/3`,
      );
    }
  }
  return [
    "Первая часть работы · 1/3",
    "Вторая часть работы · 2/3",
    "Третья часть работы · 3/3",
  ];
}

export interface WellbeingModalProps {
  visible: boolean;
  tasks: CachedTask[];
  onClose: () => void;
  onFocusPercentChange?: (percent: number) => void;
}

export const WellbeingModal: React.FC<WellbeingModalProps> = ({
  visible,
  tasks,
  onClose,
  onFocusPercentChange,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [data, setData] = useState<WellbeingData>({
    days: {},
    running: null,
    goal: 45,
    starts: {},
  });
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(Date.now());

  const today = useMemo(() => getMoscowDayKey(), []);

  // Load saved focus state from local storage
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const raw = await SecureStore.getItemAsync(WELLBEING_STORAGE_KEY);
        if (raw && isMounted) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setData({
              goal: GOALS.includes(parsed.goal) ? parsed.goal : 45,
              running:
                typeof parsed.running === "number" &&
                parsed.running <= Date.now()
                  ? parsed.running
                  : null,
              starts: parsed.starts || {},
              days: parsed.days || {},
            });
          }
        }
      } catch {
        // Fallback to initial
      } finally {
        if (isMounted) setReady(true);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save changes to local storage
  useEffect(() => {
    if (!ready) return;
    try {
      SecureStore.setItemAsync(WELLBEING_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage error ignored
    }
  }, [data, ready]);

  // Tick timer every second only when modal is visible and timer is running
  useEffect(() => {
    if (!visible || !data.running) return;
    const timer = setInterval(() => {
      setTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, data.running]);

  const day = useMemo(() => {
    return data.days[today] || { seconds: 0, steps: [] };
  }, [data.days, today]);

  // Calculate live elapsed seconds if timer is active
  const liveSeconds = useMemo(() => {
    if (!data.running) return 0;
    const startedDay = getMoscowDayKey(new Date(data.running));
    if (startedDay !== today) return 0;
    const elapsed = Math.floor((tick - data.running) / 1000);
    return Math.max(0, Math.min(data.goal * 60 - day.seconds, elapsed));
  }, [data.running, data.goal, day.seconds, tick, today]);

  const totalSeconds = day.seconds + liveSeconds;
  const percent = Math.min(
    100,
    Math.floor((totalSeconds / (data.goal * 60)) * 100),
  );

  // Notify parent of focus percentage changes
  useEffect(() => {
    onFocusPercentChange?.(percent);
  }, [percent, onFocusPercentChange]);

  // Auto-stop when goal reached
  const stopTimer = useCallback(() => {
    setData((prev) => ({
      ...prev,
      running: null,
      days: {
        ...prev.days,
        [today]: {
          ...day,
          seconds: totalSeconds,
          goal: prev.goal,
        },
      },
    }));
  }, [day, totalSeconds, today]);

  useEffect(() => {
    if (data.running && totalSeconds >= data.goal * 60) {
      stopTimer();
    }
  }, [totalSeconds, data.running, data.goal, stopTimer]);

  const toggleTimer = () => {
    if (data.running) {
      stopTimer();
    } else {
      setData((prev) => ({
        ...prev,
        running: Date.now(),
      }));
    }
  };

  const handleSelectGoal = (newGoal: number) => {
    if (data.running) return;
    setData((prev) => ({
      ...prev,
      goal: newGoal,
    }));
  };

  const toggleStep = (stepId: string) => {
    const isChecked = day.steps.includes(stepId);
    const updatedSteps = isChecked
      ? day.steps.filter((s) => s !== stepId)
      : [...day.steps, stepId];

    setData((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [today]: {
          ...day,
          steps: updatedSteps,
          goal: prev.goal,
        },
      },
    }));
  };

  // Build daily bite-sized steps
  const dailyPlanSteps = useMemo(() => {
    return tasks
      .filter((t) => t.type !== "OPTIONAL")
      .flatMap((task) => {
        const labels = planningLabels(task);
        return labels.map((label, index) => {
          const stepId = `${task.id}:${index}`;
          return {
            id: stepId,
            taskTitle: task.title,
            course: task.subject,
            label,
            isCompleted: day.steps.includes(stepId),
          };
        });
      })
      .slice(0, 10);
  }, [tasks, day.steps]);

  // Last 7 days status strip
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const k = getMoscowDayKey(d);
      const record = data.days[k];
      const isPast = k < today;
      const isCurrent = k === today;
      const daySec = isCurrent ? totalSeconds : record?.seconds || 0;
      const targetSec = (record?.goal || data.goal) * 60;
      const done = daySec >= targetSec;
      const partial = daySec > 0 && !done;

      const shortDay = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"][
        d.getUTCDay()
      ];
      const dayNum = d.getDate();

      return {
        key: k,
        shortDay,
        dayNum,
        isPast,
        isCurrent,
        done,
        partial,
      };
    });
  }, [data.days, data.goal, today, totalSeconds]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle}>Сегодня в своём темпе</Text>
              <Text style={styles.modalSubtitle}>
                Дневной фокус и личный ориентир
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
          >
            {/* 7-Day Strip */}
            <View style={styles.weekStrip}>
              {weekDays.map((item) => (
                <View
                  key={item.key}
                  style={[
                    styles.weekDayItem,
                    item.isCurrent && styles.weekDayItemCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.weekDayLabel,
                      item.isCurrent && styles.weekDayLabelCurrent,
                    ]}
                  >
                    {item.shortDay}
                  </Text>
                  <View
                    style={[
                      styles.dayDot,
                      item.done && styles.dayDotDone,
                      item.partial && styles.dayDotPartial,
                      item.isCurrent &&
                        !item.done &&
                        !item.partial &&
                        styles.dayDotCurrent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumText,
                        (item.done || item.partial) && styles.dayNumTextActive,
                      ]}
                    >
                      {item.dayNum}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Timer Counter */}
            <View style={styles.timerBox}>
              <Text style={styles.timerBigValue}>
                {Math.floor(totalSeconds / 60)}{" "}
                <Text style={styles.timerSmall}>из {data.goal} мин</Text>
              </Text>
              <Text style={styles.timerPercentBadge}>{percent}% выполнено</Text>

              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${percent}%`,
                      backgroundColor: percent >= 100 ? "#10b981" : "#3b82f6",
                    },
                  ]}
                />
              </View>

              {/* Start / Pause Button */}
              <TouchableOpacity
                onPress={toggleTimer}
                style={[
                  styles.timerActionButton,
                  data.running
                    ? styles.timerButtonPause
                    : styles.timerButtonStart,
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={
                  data.running ? "Приостановить таймер" : "Начать заниматься"
                }
              >
                <Text style={styles.timerActionButtonText}>
                  {data.running ? "Пауза" : "Начать заниматься"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Goal Selector */}
            <View style={styles.goalSection}>
              <Text style={styles.sectionLabel}>Цель по времени на день:</Text>
              <View style={styles.goalPillsRow}>
                {GOALS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => handleSelectGoal(g)}
                    disabled={Boolean(data.running)}
                    style={[
                      styles.goalPill,
                      data.goal === g && styles.goalPillActive,
                      Boolean(data.running) && styles.goalPillDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.goalPillText,
                        data.goal === g && styles.goalPillTextActive,
                      ]}
                    >
                      {g}м
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Bite-sized steps */}
            <View style={styles.stepsSection}>
              <Text style={styles.sectionLabel}>
                Небольшие шаги на сегодня:
              </Text>
              <Text style={styles.stepsHint}>
                Разбиение текущих работ на небольшие части для спокойного темпа.
              </Text>

              {dailyPlanSteps.length > 0 ? (
                dailyPlanSteps.map((step) => (
                  <TouchableOpacity
                    key={step.id}
                    onPress={() => toggleStep(step.id)}
                    style={[
                      styles.stepCard,
                      step.isCompleted && styles.stepCardCompleted,
                    ]}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.stepCheckbox,
                        step.isCompleted && styles.stepCheckboxChecked,
                      ]}
                    >
                      {step.isCompleted && (
                        <Text style={styles.stepCheckmark}>✓</Text>
                      )}
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text
                        style={[
                          styles.stepCourseText,
                          step.isCompleted && styles.stepTextDone,
                        ]}
                      >
                        {step.course} · {step.taskTitle}
                      </Text>
                      <Text
                        style={[
                          styles.stepLabelText,
                          step.isCompleted && styles.stepTextDone,
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyStepsBox}>
                  <Text style={styles.emptyStepsText}>
                    Нет активных заданий для планирования.
                  </Text>
                </View>
              )}
            </View>

            {/* Academic Policy Disclaimer */}
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                Личный ориентир, не условие допуска к сессии. Время и шаги
                сохраняются только на этом устройстве. Отметка шага и таймер не
                меняют выполнение задания, баллы XP или зачёт преподавателя.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.canvas,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "88%",
      paddingBottom: Platform.OS === "ios" ? 34 : 20,
      borderWidth: 1,
      borderColor: colors.line,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.subtle,
      marginTop: 2,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    closeButtonText: {
      color: colors.muted,
      fontSize: 16,
      fontWeight: "600",
    },
    scrollArea: {
      paddingHorizontal: 20,
    },
    weekStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginVertical: 16,
      backgroundColor: colors.soft,
      padding: 10,
      borderRadius: 16,
    },
    weekDayItem: {
      alignItems: "center",
      gap: 6,
    },
    weekDayItemCurrent: {
      transform: [{ scale: 1.05 }],
    },
    weekDayLabel: {
      fontSize: 11,
      color: colors.subtle,
      fontWeight: "600",
    },
    weekDayLabelCurrent: {
      color: colors.link,
      fontWeight: "700",
    },
    dayDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.soft,
      borderWidth: 1,
      borderColor: colors.line,
    },
    dayDotDone: {
      backgroundColor: "#10b981",
      borderColor: "#10b981",
    },
    dayDotPartial: {
      backgroundColor: "#3b82f6",
      borderColor: "#3b82f6",
    },
    dayDotCurrent: {
      borderColor: colors.link,
      borderWidth: 1.5,
    },
    dayNumText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
    },
    dayNumTextActive: {
      color: colors.text,
    },
    timerBox: {
      backgroundColor: "rgba(30, 41, 59, 0.5)",
      borderRadius: 18,
      padding: 18,
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.line,
    },
    timerBigValue: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.text,
      fontFamily: "monospace",
    },
    timerSmall: {
      fontSize: 16,
      color: colors.muted,
      fontWeight: "500",
    },
    timerPercentBadge: {
      fontSize: 12,
      color: colors.link,
      fontWeight: "600",
      marginTop: 4,
      marginBottom: 12,
    },
    progressTrack: {
      width: "100%",
      height: 6,
      backgroundColor: colors.soft,
      borderRadius: 3,
      overflow: "hidden",
      marginBottom: 16,
    },
    progressBar: {
      height: "100%",
      borderRadius: 3,
    },
    timerActionButton: {
      width: "100%",
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    timerButtonStart: {
      backgroundColor: "#2563eb",
    },
    timerButtonPause: {
      backgroundColor: "#d97706",
    },
    timerActionButtonText: {
      color: colors.onAccent,
      fontSize: 15,
      fontWeight: "700",
    },
    goalSection: {
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.muted,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    goalPillsRow: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
    },
    goalPill: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 10,
      backgroundColor: colors.soft,
      borderWidth: 1,
      borderColor: colors.line,
    },
    goalPillActive: {
      backgroundColor: "rgba(59, 130, 246, 0.2)",
      borderColor: "#3b82f6",
    },
    goalPillDisabled: {
      opacity: 0.5,
    },
    goalPillText: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: "600",
    },
    goalPillTextActive: {
      color: colors.link,
    },
    stepsSection: {
      marginBottom: 16,
    },
    stepsHint: {
      fontSize: 12,
      color: colors.subtle,
      marginBottom: 10,
      lineHeight: 16,
    },
    stepCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.soft,
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.line,
    },
    stepCardCompleted: {
      opacity: 0.6,
    },
    stepCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: "#475569",
      alignItems: "center",
      justifyContent: "center",
    },
    stepCheckboxChecked: {
      backgroundColor: "#10b981",
      borderColor: "#10b981",
    },
    stepCheckmark: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "bold",
    },
    stepTextContainer: {
      flex: 1,
    },
    stepCourseText: {
      fontSize: 12,
      color: colors.link,
      fontWeight: "600",
      marginBottom: 2,
    },
    stepLabelText: {
      fontSize: 13,
      color: colors.text,
    },
    stepTextDone: {
      textDecorationLine: "line-through",
      color: colors.subtle,
    },
    emptyStepsBox: {
      padding: 14,
      borderRadius: 10,
      backgroundColor: colors.soft,
      alignItems: "center",
    },
    emptyStepsText: {
      fontSize: 12,
      color: colors.subtle,
    },
    disclaimerBox: {
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.soft,
      borderWidth: 1,
      borderColor: colors.line,
      marginBottom: 24,
    },
    disclaimerText: {
      fontSize: 11,
      color: colors.subtle,
      lineHeight: 16,
      textAlign: "center",
    },
  });
