import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../theme/ThemeProvider";
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { KNOWN_API_ORIGINS } from "../api/client";

export const PUBLIC_GROUPS = [
  { code: "5130901/40101", track: "ИВТ", label: "101", ruzId: 45590 },
  { code: "5130901/40102", track: "ИВТ", label: "102", ruzId: 45591 },
  { code: "5130901/40201", track: "ИВТ", label: "201", ruzId: 45592 },
  { code: "5130901/40202", track: "ИВТ", label: "202", ruzId: 45593 },
  { code: "5130902/40201", track: "ИСиТ", label: "201", ruzId: 45594 },
  { code: "5130902/40202", track: "ИСиТ", label: "202", ruzId: 45595 },
  { code: "5130902/40203", track: "ИСиТ", label: "203", ruzId: 45596 },
  { code: "5130902/40204", track: "ИСиТ", label: "204", ruzId: 45597 },
] as const;

export type GroupPickerModalProps = {
  visible: boolean;
  selectedGroup: string;
  onSelectGroup: (code: string) => void;
  currentOrigin?: string;
  onSelectOrigin?: (origin: string) => void;
  onClose: () => void;
};

export const GroupPickerModal: React.FC<GroupPickerModalProps> = ({
  visible,
  selectedGroup,
  onSelectGroup,
  currentOrigin,
  onSelectOrigin,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <Text style={styles.title}>Выберите группу</Text>
          <Text style={styles.subtitle}>
            Официальные группы кафедры в СПбПУ
          </Text>

          <View style={styles.grid}>
            {PUBLIC_GROUPS.map((g) => {
              const isSelected = g.code === selectedGroup;
              return (
                <TouchableOpacity
                  key={g.code}
                  onPress={() => {
                    onSelectGroup(g.code);
                    onClose();
                  }}
                  style={[
                    styles.groupButton,
                    isSelected && styles.groupButtonSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.track} ${g.label}, ${g.code}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.labelRow}>
                    <Text
                      style={[
                        styles.trackText,
                        isSelected && styles.textSelected,
                      ]}
                    >
                      {g.track}
                    </Text>
                    <Text
                      style={[
                        styles.labelText,
                        isSelected && styles.textSelected,
                      ]}
                    >
                      {g.label}
                    </Text>
                  </View>
                  <Text
                    style={[styles.codeText, isSelected && styles.codeSelected]}
                  >
                    {g.code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {onSelectOrigin && (
            <View style={styles.originSection}>
              <Text style={styles.originTitle}>Сервер API (Origin)</Text>
              <View style={styles.originRow}>
                {KNOWN_API_ORIGINS.map((env) => {
                  const isCurrent = currentOrigin === env.origin;
                  return (
                    <TouchableOpacity
                      key={env.id}
                      onPress={() => onSelectOrigin(env.origin)}
                      style={[
                        styles.originButton,
                        isCurrent && styles.originButtonSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Выбрать источник ${env.label}`}
                    >
                      <Text
                        style={[
                          styles.originButtonText,
                          isCurrent && styles.originButtonTextSelected,
                        ]}
                      >
                        {env.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Закрыть выбор группы"
          >
            <Text style={styles.closeButtonText}>Закрыть</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.65)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: "#0d1627",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: "#1d2d47",
      padding: 20,
      paddingBottom: 34,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 12,
      color: colors.muted,
      textAlign: "center",
      marginBottom: 16,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    groupButton: {
      width: "48%",
      backgroundColor: colors.soft,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 10,
      minHeight: 52,
      justifyContent: "center",
    },
    groupButtonSelected: {
      backgroundColor: "rgba(99, 102, 241, 0.18)",
      borderColor: "#6366f1",
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginBottom: 2,
    },
    trackText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.muted,
      marginRight: 6,
    },
    labelText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    textSelected: {
      color: colors.link,
    },
    codeText: {
      fontSize: 11,
      color: "#5b6e8a",
      fontFamily: "monospace",
    },
    codeSelected: {
      color: "#818cf8",
    },
    originSection: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: 12,
      marginBottom: 16,
    },
    originTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
      marginBottom: 8,
    },
    originRow: {
      flexDirection: "column",
      gap: 6,
    },
    originButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.soft,
      borderWidth: 1,
      borderColor: colors.line,
      minHeight: 44,
      justifyContent: "center",
    },
    originButtonSelected: {
      backgroundColor: "rgba(99, 102, 241, 0.15)",
      borderColor: "#6366f1",
    },
    originButtonText: {
      fontSize: 12,
      color: colors.muted,
    },
    originButtonTextSelected: {
      color: colors.link,
      fontWeight: "600",
    },
    closeButton: {
      backgroundColor: colors.soft,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      minHeight: 48,
      justifyContent: "center",
    },
    closeButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.onAccent,
    },
  });
