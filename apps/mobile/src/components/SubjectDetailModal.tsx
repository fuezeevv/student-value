import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from "react-native";
import type { MobileLesson, CachedTask } from "@studentvalue/mobile-contracts";
import { SpringPressable } from "./SpringPressable";

export interface SubjectDetailModalProps {
  visible: boolean;
  lesson: MobileLesson | null;
  subject?: string | null;
  tasks: CachedTask[];
  onClose: () => void;
  onOpenMaterial?: (materialId: string) => void;
}

export const SubjectDetailModal: React.FC<SubjectDetailModalProps> = ({
  visible,
  lesson,
  subject,
  tasks,
  onClose,
  onOpenMaterial,
}) => {
  const title = lesson?.subject ?? subject;
  if (!title) return null;

  // Filter tasks that match this subject
  const subjectTasks = tasks.filter(
    (t) => t.subject.trim().toLowerCase() === title.trim().toLowerCase(),
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Grab handle */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text style={styles.typeEyebrow}>
                {lesson?.type || "Учебный курс"}
              </Text>
              <Text style={styles.titleText}>{title}</Text>
            </View>
            <SpringPressable
              style={styles.closeButton}
              onPress={onClose}
              activeScale={0.9}
              accessibilityRole="button"
              accessibilityLabel="Закрыть карточку предмета"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </SpringPressable>
          </View>

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Class Info Box */}
            {lesson && (
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Информация о занятии</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Время:</Text>
                  <Text style={styles.infoValue}>
                    {lesson.start} – {lesson.scheduledEnd}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Аудитория:</Text>
                  <Text style={styles.infoValue}>
                    {lesson.rooms.join(", ") || "Уточняется"}
                  </Text>
                </View>
                {lesson.teachers.length > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Преподаватель:</Text>
                    <Text style={styles.infoValue}>
                      {lesson.teachers.join(", ")}
                    </Text>
                  </View>
                )}
                {lesson.note ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Примечание:</Text>
                    <Text style={styles.infoValueNote}>{lesson.note}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Subject Tasks / Materials */}
            <View style={styles.tasksSection}>
              <Text style={styles.sectionTitle}>
                Задания и материалы курса ({subjectTasks.length})
              </Text>

              {subjectTasks.length > 0 ? (
                subjectTasks.map((t) => (
                  <View key={t.id} style={styles.taskCard}>
                    <Text style={styles.taskCardTitle}>{t.title}</Text>
                    <Text style={styles.taskDeadlineText}>
                      {t.deadlineMoscowStr
                        ? `Срок: ${t.deadlineMoscowStr}`
                        : "Без установленного дедлайна"}
                    </Text>

                    {t.materialId && (
                      <SpringPressable
                        style={styles.materialDownloadButton}
                        activeScale={0.96}
                        onPress={() => onOpenMaterial?.(t.materialId!)}
                      >
                        <Text style={styles.materialDownloadText}>
                          📄 {t.materialTitle || "Методические указания"}
                        </Text>
                      </SpringPressable>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    По этому предмету пока нет прикреплённых заданий в базе
                    группы.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#0d1726",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  handleBar: {
    width: 44,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  typeEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fda4af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f8fafc",
    lineHeight: 26,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#cbd5e1",
    fontWeight: "700",
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  infoCard: {
    backgroundColor: "#16253d",
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#93c5fd",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: "#8a9bb5",
    width: "35%",
  },
  infoValue: {
    fontSize: 13,
    color: "#f8fafc",
    fontWeight: "600",
    width: "65%",
    textAlign: "right",
  },
  infoValueNote: {
    fontSize: 13,
    color: "#fca5a5",
    fontStyle: "italic",
    width: "65%",
    textAlign: "right",
  },
  tasksSection: {
    marginBottom: 16,
  },
  taskCard: {
    backgroundColor: "#111d33",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  taskCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 4,
  },
  taskDeadlineText: {
    fontSize: 12,
    color: "#8a9bb5",
    marginBottom: 8,
  },
  materialDownloadButton: {
    backgroundColor: "rgba(51, 120, 255, 0.12)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  materialDownloadText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#93c5fd",
  },
  emptyBox: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 14,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
});
