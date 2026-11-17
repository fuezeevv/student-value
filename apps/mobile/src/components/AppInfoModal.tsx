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
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";

export interface AppInfoModalProps {
  visible: boolean;
  groupCode: string;
  isSyncing: boolean;
  isStale: boolean;
  isOffline?: boolean;
  apiOrigin: string;
  cachedAgeLabel: string;
  onClose: () => void;
  onRefresh: () => void;
  onOpenGroupPicker: () => void;
  onSelectOrigin: (origin: string) => void;
}

export const AppInfoModal: React.FC<AppInfoModalProps> = ({
  visible,
  groupCode,
  isSyncing,
  isStale,
  isOffline,
  apiOrigin,
  cachedAgeLabel,
  onClose,
  onRefresh,
  onOpenGroupPicker,
  onSelectOrigin,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const isDevOrigin =
    apiOrigin.includes("192.168.") ||
    apiOrigin.includes("127.0.0.1") ||
    apiOrigin.includes("localhost");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header with Brand Logo */}
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <Image
                source={require("../../assets/brand-mark.png")}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.brandTitle}>
                  Student Value <Text style={styles.brandAccent}>1.984</Text>
                </Text>
                <Text style={styles.brandSub}>
                  Мобильный компаньон студента
                </Text>
              </View>
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

          {/* Status Details */}
          <View style={styles.body}>
            {/* Connection / Network Status */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Статус сети:</Text>
              <View style={styles.statusPill}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isOffline ? "#f59e0b" : "#10b981" },
                  ]}
                />
                <Text style={styles.statusPillText}>
                  {isOffline === undefined ? "Проверяем подключение" : isOffline ? "Нет подключения" : "Сеть подключена"}
                </Text>
              </View>
            </View>

            {/* Cache Age */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Кэш данных:</Text>
              <Text style={styles.infoValue}>
                {cachedAgeLabel
                  ? `${isStale ? "Сохранённая копия · " : ""}${cachedAgeLabel}`
                  : "Нет сохранённой копии"}
              </Text>
            </View>

            {/* Current Group */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Группа:</Text>
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onOpenGroupPicker();
                }}
                style={styles.groupBadge}
                activeOpacity={0.7}
              >
                <Text style={styles.groupBadgeText}>{groupCode}</Text>
                <Text style={styles.editIconText}>✎</Text>
              </TouchableOpacity>
            </View>

            {/* Server Endpoint */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Сервер:</Text>
              <Text style={styles.serverCodeText} numberOfLines={1}>
                {apiOrigin.replace(/^https?:\/\//, "")}
              </Text>
            </View>

            {/* Server Switch Quick Selector */}
            <View style={styles.serverButtonsRow}>
              <TouchableOpacity
                onPress={() => onSelectOrigin("http://192.168.0.26:3000")}
                style={[
                  styles.serverSwitchButton,
                  isDevOrigin && styles.serverSwitchButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.serverSwitchText,
                    isDevOrigin && styles.serverSwitchTextActive,
                  ]}
                >
                  Dev LAN (192.168)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onSelectOrigin("https://studentvalue1984.eu.cc")}
                style={[
                  styles.serverSwitchButton,
                  !isDevOrigin && styles.serverSwitchButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.serverSwitchText,
                    !isDevOrigin && styles.serverSwitchTextActive,
                  ]}
                >
                  Production (eu.cc)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Force Sync Action */}
            <TouchableOpacity
              onPress={onRefresh}
              disabled={isSyncing}
              style={styles.syncActionButton}
              activeOpacity={0.8}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.syncActionButtonText}>
                  ↻ Обновить расписание сейчас
                </Text>
              )}
            </TouchableOpacity>
          </View>
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
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    modalCard: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: colors.canvas,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.1)",
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    brandLogo: {
      width: 32,
      height: 32,
      borderRadius: 8,
    },
    brandTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.3,
    },
    brandAccent: {
      color: colors.link,
      fontWeight: "700",
    },
    brandSub: {
      fontSize: 11,
      color: colors.subtle,
    },
    closeButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    closeButtonText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "600",
    },
    body: {
      gap: 12,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    infoLabel: {
      fontSize: 13,
      color: colors.muted,
    },
    infoValue: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "500",
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.soft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusPillText: {
      fontSize: 12,
      color: colors.muted,
      fontWeight: "500",
    },
    groupBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(59, 130, 246, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(59, 130, 246, 0.3)",
    },
    groupBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.link,
    },
    editIconText: {
      fontSize: 10,
      color: colors.link,
    },
    serverCodeText: {
      fontSize: 12,
      fontFamily: "monospace",
      color: colors.link,
      maxWidth: 180,
    },
    serverButtonsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    serverSwitchButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.soft,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: "center",
    },
    serverSwitchButtonActive: {
      backgroundColor: "rgba(59, 130, 246, 0.2)",
      borderColor: "#3b82f6",
    },
    serverSwitchText: {
      fontSize: 11,
      color: colors.muted,
      fontWeight: "600",
    },
    serverSwitchTextActive: {
      color: colors.link,
    },
    syncActionButton: {
      marginTop: 8,
      backgroundColor: "#2563eb",
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    syncActionButtonText: {
      color: colors.onAccent,
      fontSize: 14,
      fontWeight: "700",
    },
  });
