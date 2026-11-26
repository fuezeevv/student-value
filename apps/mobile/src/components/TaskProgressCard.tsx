import { GlassFill } from "./GlassFill";
import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../theme/ThemeProvider";
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type { UserTaskProgress } from "@studentvalue/mobile-contracts";

interface TaskProgressCardProps {
  taskId: string;
  title: string;
  subject: string;
  deadlineText: string;
  progress: UserTaskProgress | null;
  isLoggedIn: boolean;
  readOnlyReason?: string;
  materialId?: string | null;
  materialTitle?: string | null;
  reminderScheduled?: boolean;
  onToggleStatus: (taskId: string, currentStatus: string) => void;
  onOpenLogin: () => void;
  onOpenMaterial?: (materialId: string) => void;
  onToggleReminder?: () => void;
  loading?: boolean;
}

export const TaskProgressCard: React.FC<TaskProgressCardProps> = ({
  taskId,
  title,
  subject,
  deadlineText,
  progress,
  isLoggedIn,
  readOnlyReason,
  materialId,
  materialTitle,
  reminderScheduled = false,
  onToggleStatus,
  onOpenLogin,
  onOpenMaterial,
  onToggleReminder,
  loading = false,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();

  const status = progress?.status || "NOT_STARTED";
  const isAccepted = status === "ACCEPTED";
  const isReady = status === "READY" || status === "SUBMITTED" || isAccepted;
  const syncState = progress?.syncState || "SYNCED";

  return (
    <View style={styles.card}>
      <GlassFill dark={isDark} />
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <Text style={styles.subjectText}>{subject}</Text>
          <Text style={styles.deadlineBadge}>{deadlineText}</Text>
        </View>

        {isLoggedIn && (
          <View style={styles.syncIndicator}>
            {syncState === "PENDING_SYNC" ? (
              <View style={[styles.syncDot, styles.syncDotPending]} />
            ) : syncState === "FAILED" ? (
              <View style={[styles.syncDot, styles.syncDotFailed]} />
            ) : (
              <View style={[styles.syncDot, styles.syncDotSynced]} />
            )}
            <Text style={styles.syncStateText}>
              {syncState === "PENDING_SYNC"
                ? "В очереди"
                : syncState === "FAILED"
                  ? "Сбой"
                  : "Синхронизировано"}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.titleText}>{title}</Text>

      {/* Course Material Attachment (Stage C) */}
      {materialId && (
        <TouchableOpacity
          style={styles.materialRow}
          onPress={() => onOpenMaterial?.(materialId)}
          accessibilityRole="button"
          accessibilityLabel={`Учебный материал: ${materialTitle ?? "Методические указания"}`}
        >
          <Text style={styles.materialIcon}>📄</Text>
          <View style={styles.materialInfo}>
            <Text style={styles.materialLabel}>Учебный материал</Text>
            <Text style={styles.materialTitle} numberOfLines={1}>
              {materialTitle ?? "Методические указания к работе"}
            </Text>
          </View>
          <Text style={styles.materialArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Deadline Reminder Row (Stage C) */}
      {isLoggedIn && onToggleReminder && (
        <View style={styles.reminderRow}>
          <TouchableOpacity
            style={styles.reminderButton}
            onPress={onToggleReminder}
            disabled={isReady}
            accessibilityState={{ disabled: isReady }}
            accessibilityRole="button"
            accessibilityLabel={`Напоминание о дедлайне: ${reminderScheduled ? "Включено" : "Выключено"}`}
          >
            <Text style={styles.reminderIcon}>
              {isReady ? "🔕" : reminderScheduled ? "🔔" : "🔔"}
            </Text>
            <Text style={styles.reminderText}>
              {isReady
                ? "Работа отмечена выполненной"
                : reminderScheduled
                  ? "Напоминание включено"
                  : "Включить напоминание о дедлайне"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Progress Action Area */}
      <View style={styles.actionRow}>
        {readOnlyReason ? (
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            {readOnlyReason}
          </Text>
        ) : !isLoggedIn ? (
          <TouchableOpacity
            style={styles.guestButton}
            onPress={onOpenLogin}
            accessibilityRole="button"
            accessibilityLabel="Войти для отметки выполнения"
          >
            <Text style={styles.guestButtonText}>
              Войдите, чтобы отметить работу
            </Text>
          </TouchableOpacity>
        ) : isReady ? (
          <View style={styles.readyContainer}>
            <View style={styles.readyBadge}>
              <Text style={styles.readyBadgeText}>✓ Выполнено</Text>
              <Text style={styles.readySubtext}>
                {isAccepted
                  ? progress?.isVerified
                    ? "Подтверждено"
                    : "Результат требует уточнения"
                  : "Самостоятельная отметка"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.unmarkButton}
              onPress={() => onToggleStatus(taskId, status)}
              disabled={loading || isAccepted}
              accessibilityRole="button"
              accessibilityLabel={
                isAccepted
                  ? "Подтверждённый результат изменяет проверяющий"
                  : "Снять отметку о выполнении"
              }
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Text style={styles.unmarkButtonText}>
                  {isAccepted ? "Изменяет проверяющий" : "Снять отметку"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.markReadyButton}
            onPress={() => onToggleStatus(taskId, status)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Отметить выполненным"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.markReadyText}>
                Отметить выполненным (+20 XP)
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: colors.line,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    badgeGroup: {
      flex: 1,
      marginRight: 8,
    },
    subjectText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.link,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    deadlineBadge: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.muted,
      marginTop: 2,
    },
    syncIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    syncDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    syncDotSynced: {
      backgroundColor: "#10b981",
    },
    syncDotPending: {
      backgroundColor: "#f59e0b",
    },
    syncDotFailed: {
      backgroundColor: "#ef4444",
    },
    syncStateText: {
      fontSize: 11,
      color: colors.muted,
    },
    titleText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#f0f4f8",
      lineHeight: 22,
      marginVertical: 8,
    },
    materialRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(30, 41, 59, 0.7)",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginTop: 8,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.line,
    },
    materialIcon: {
      fontSize: 18,
      marginRight: 10,
    },
    materialInfo: {
      flex: 1,
    },
    materialLabel: {
      fontSize: 10,
      color: colors.muted,
      textTransform: "uppercase",
      fontWeight: "700",
    },
    materialTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.link,
    },
    materialArrow: {
      fontSize: 18,
      color: colors.muted,
      fontWeight: "700",
    },
    reminderRow: {
      marginVertical: 6,
    },
    reminderButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
    },
    reminderIcon: {
      fontSize: 14,
    },
    reminderText: {
      fontSize: 12,
      color: colors.muted,
    },
    actionRow: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    guestButton: {
      backgroundColor: "#1e3a8a",
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    guestButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.link,
    },
    readyContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    readyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    readyBadgeText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.success,
    },
    readySubtext: {
      fontSize: 12,
      color: "#6b7d96",
    },
    unmarkButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.15)",
    },
    unmarkButtonText: {
      fontSize: 13,
      color: colors.muted,
    },
    markReadyButton: {
      backgroundColor: "#2563eb",
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    markReadyText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.onAccent,
    },
  });
