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
  onToggleStatus: (taskId: string, currentStatus: string) => void;
  onOpenLogin: () => void;
  loading?: boolean;
}

export const TaskProgressCard: React.FC<TaskProgressCardProps> = ({
  taskId,
  title,
  subject,
  deadlineText,
  progress,
  isLoggedIn,
  onToggleStatus,
  onOpenLogin,
  loading = false,
}) => {
  const status = progress?.status || "NOT_STARTED";
  const isReady = status === "READY" || status === "SUBMITTED";
  const syncState = progress?.syncState || "SYNCED";

  return (
    <View style={styles.card}>
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

      {/* Progress Action Area */}
      <View style={styles.actionRow}>
        {!isLoggedIn ? (
          <TouchableOpacity
            style={styles.guestButton}
            onPress={onOpenLogin}
            accessibilityRole="button"
            accessibilityLabel="Войти для отметки выполнения"
          >
            <Text style={styles.guestButtonText}>Войдите, чтобы отметить работу</Text>
          </TouchableOpacity>
        ) : isReady ? (
          <View style={styles.readyContainer}>
            <View style={styles.readyBadge}>
              <Text style={styles.readyBadgeText}>✓ Выполнено</Text>
              <Text style={styles.readySubtext}>(ожидает проверки)</Text>
            </View>

            <TouchableOpacity
              style={styles.unmarkButton}
              onPress={() => onToggleStatus(taskId, status)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Снять отметку о выполнении"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#8a9bb5" />
              ) : (
                <Text style={styles.unmarkButtonText}>Снять отметку</Text>
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
              <Text style={styles.markReadyText}>Отметить выполненным (+20 XP)</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#16253d",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#223554",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#93c5fd",
  },
  deadlineBadge: {
    fontSize: 11,
    color: "#f87171",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncDotSynced: {
    backgroundColor: "#34d399",
  },
  syncDotPending: {
    backgroundColor: "#fbbf24",
  },
  syncDotFailed: {
    backgroundColor: "#f87171",
  },
  syncStateText: {
    fontSize: 10,
    color: "#8a9bb5",
  },
  titleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f0f4f8",
    marginBottom: 12,
  },
  actionRow: {
    marginTop: 4,
  },
  guestButton: {
    backgroundColor: "rgba(147, 197, 253, 0.08)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
    alignItems: "center",
  },
  guestButtonText: {
    fontSize: 13,
    color: "#93c5fd",
    fontWeight: "600",
  },
  readyContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  readyBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  readyBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#34d399",
  },
  readySubtext: {
    fontSize: 11,
    color: "#8a9bb5",
  },
  unmarkButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  unmarkButtonText: {
    fontSize: 12,
    color: "#8a9bb5",
  },
  markReadyButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  markReadyText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
