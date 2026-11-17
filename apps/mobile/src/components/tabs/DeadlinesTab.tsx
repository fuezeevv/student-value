import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type {
  CachedTask,
  UserTaskProgress,
} from "@studentvalue/mobile-contracts";
import { SpringPressable } from "../SpringPressable";
import { TaskProgressCard } from "../TaskProgressCard";

export interface DeadlinesTabProps {
  tasks: CachedTask[];
  taskProgress: Record<string, UserTaskProgress>;
  groupCode: string;
  statusMessage?: string | null;
  isLoggedIn: boolean;
  scheduledReminders: Record<string, boolean>;
  updatingTaskId: string | null;
  onToggleStatus: (taskId: string, currentStatus: string) => void;
  onToggleReminder: (task: CachedTask) => void;
  onOpenMaterial: (materialId: string) => void;
  onOpenLogin: () => void;
}

export const DeadlinesTab = React.memo<DeadlinesTabProps>(
  ({
    tasks,
    taskProgress,
    groupCode,
    statusMessage,
    isLoggedIn,
    scheduledReminders,
    updatingTaskId,
    onToggleStatus,
    onToggleReminder,
    onOpenMaterial,
    onOpenLogin,
  }) => {
    const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

    const filteredTasks = useMemo(() => {
      return tasks.filter((t) => {
        const prog = taskProgress[t.id];
        const isDone =
          prog &&
          (prog.status === "READY" ||
            prog.status === "SUBMITTED" ||
            prog.status === "ACCEPTED");
        if (filter === "pending") return !isDone;
        if (filter === "done") return isDone;
        return true;
      });
    }, [tasks, taskProgress, filter]);

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Сроки и задания</Text>
          <Text style={styles.headerSubtitle}>
            Группа {groupCode} · {tasks.length} опубликованных работ
          </Text>
        </View>

        {statusMessage && (
          <Text style={styles.headerSubtitle}>{statusMessage}</Text>
        )}
        {/* Filter Chips */}
        <View style={styles.filterRow}>
          <SpringPressable
            style={[
              styles.filterChip,
              filter === "all" && styles.filterChipActive,
            ]}
            activeScale={0.94}
            onPress={() => setFilter("all")}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === "all" && styles.filterChipTextActive,
              ]}
            >
              Все ({tasks.length})
            </Text>
          </SpringPressable>

          <SpringPressable
            style={[
              styles.filterChip,
              filter === "pending" && styles.filterChipActive,
            ]}
            activeScale={0.94}
            onPress={() => setFilter("pending")}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === "pending" && styles.filterChipTextActive,
              ]}
            >
              Предстоит сдать
            </Text>
          </SpringPressable>

          <SpringPressable
            style={[
              styles.filterChip,
              filter === "done" && styles.filterChipActive,
            ]}
            activeScale={0.94}
            onPress={() => setFilter("done")}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === "done" && styles.filterChipTextActive,
              ]}
            >
              Выполнено
            </Text>
          </SpringPressable>
        </View>

        {/* Tasks List */}
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <TaskProgressCard
              key={task.id}
              taskId={task.id}
              title={task.title}
              subject={task.subject}
              deadlineText={
                task.deadlineMoscowStr
                  ? `Дедлайн: ${task.deadlineMoscowStr}`
                  : "Без установленного дедлайна"
              }
              progress={taskProgress[task.id] || null}
              isLoggedIn={isLoggedIn}
              materialId={task.materialId}
              materialTitle={task.materialTitle}
              reminderScheduled={Boolean(scheduledReminders[task.id])}
              onToggleReminder={() => onToggleReminder(task)}
              onOpenMaterial={(matId) => onOpenMaterial(matId)}
              onToggleStatus={onToggleStatus}
              onOpenLogin={onOpenLogin}
              loading={updatingTaskId === task.id}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Заданий не найдено</Text>
            <Text style={styles.emptySubtitle}>
              {filter === "done"
                ? "У вас пока нет отмеченных выполненных работ."
                : "Все задания выполнены или ещё не опубликованы."}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1322",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#8a9bb5",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  filterChip: {
    backgroundColor: "#16253d",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#223554",
  },
  filterChipActive: {
    backgroundColor: "#3378ff",
    borderColor: "#60a5fa",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8a9bb5",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#8a9bb5",
    textAlign: "center",
    lineHeight: 18,
  },
});
