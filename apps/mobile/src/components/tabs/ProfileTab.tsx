import React from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import type { MobileSessionUser } from "../../auth/token-storage";
import { SpringPressable } from "../SpringPressable";

export interface ProfileTabProps {
  sessionUser: MobileSessionUser | null;
  groupCode: string;
  cachedLessonsCount: number;
  cachedTasksCount: number;
  apiOrigin: string;
  isStale: boolean;
  onOpenGroupPicker: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onSelectOrigin: (origin: string) => void;
  onRefreshData: () => void;
}

export const ProfileTab = React.memo<ProfileTabProps>(({
  sessionUser,
  groupCode,
  cachedLessonsCount,
  cachedTasksCount,
  apiOrigin,
  isStale,
  onOpenGroupPicker,
  onOpenLogin,
  onLogout,
  onSelectOrigin,
  onRefreshData,
}) => {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Профиль и настройки</Text>
        <Text style={styles.headerSubtitle}>
          Student Value · Автономный академический компаньон
        </Text>
      </View>

      {/* Account Card */}
      <View style={styles.card}>
        <View style={styles.accountRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {sessionUser
                ? (sessionUser.nickname[0] || "U").toUpperCase()
                : "G"}
            </Text>
          </View>
          <View style={styles.accountDetails}>
            <Text style={styles.accountName}>
              {sessionUser ? sessionUser.nickname : "Гостевой доступ"}
            </Text>
            <Text style={styles.accountSubtitle}>
              {sessionUser
                ? `Студент · ${sessionUser.groupName || sessionUser.nickname}`
                : "Доступно только публичное расписание"}
            </Text>
          </View>
        </View>

        {sessionUser ? (
          <SpringPressable
            style={styles.logoutButton}
            activeScale={0.96}
            onPress={() => {
              Alert.alert(
                "Выход из аккаунта",
                "Вы уверены, что хотите выйти? Локальные отметки прогресса будут сохранены.",
                [
                  { text: "Отмена", style: "cancel" },
                  { text: "Выйти", style: "destructive", onPress: onLogout },
                ],
              );
            }}
          >
            <Text style={styles.logoutButtonText}>Выйти из профиля</Text>
          </SpringPressable>
        ) : (
          <SpringPressable
            style={styles.loginButton}
            activeScale={0.96}
            onPress={onOpenLogin}
          >
            <Text style={styles.loginButtonText}>Войти через Google</Text>
          </SpringPressable>
        )}
      </View>

      {/* Group Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Учебная группа</Text>
        <View style={styles.groupInfoRow}>
          <View>
            <Text style={styles.groupCodeLarge}>{groupCode}</Text>
            <Text style={styles.groupSubtext}>СПбПУ Петра Великого</Text>
          </View>
          <SpringPressable
            style={styles.changeGroupButton}
            activeScale={0.94}
            onPress={onOpenGroupPicker}
          >
            <Text style={styles.changeGroupText}>Сменить</Text>
          </SpringPressable>
        </View>
      </View>

      {/* Offline Storage Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Память устройства (SQLite)</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Сохранено пар в расписании:</Text>
          <Text style={styles.statValue}>{cachedLessonsCount}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Сохранено заданий:</Text>
          <Text style={styles.statValue}>{cachedTasksCount}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Статус кэша:</Text>
          <Text style={[styles.statValue, isStale && styles.statWarning]}>
            {isStale ? "Требует обновления" : "Актуален"}
          </Text>
        </View>

        <SpringPressable
          style={styles.refreshSyncButton}
          activeScale={0.96}
          onPress={onRefreshData}
        >
          <Text style={styles.refreshSyncText}>Синхронизировать сейчас</Text>
        </SpringPressable>
      </View>

      {/* Server Endpoint Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Серверный эндпоинт</Text>
        <Text style={styles.serverInfoText}>Текущий: {apiOrigin}</Text>

        <View style={styles.originButtonsRow}>
          <SpringPressable
            style={[
              styles.originChip,
              apiOrigin.includes("192.168") && styles.originChipActive,
            ]}
            activeScale={0.94}
            onPress={() => onSelectOrigin("http://192.168.0.26:3000")}
          >
            <Text
              style={[
                styles.originChipText,
                apiOrigin.includes("192.168") && styles.originChipTextActive,
              ]}
            >
              LAN (192.168.0.26)
            </Text>
          </SpringPressable>

          <SpringPressable
            style={[
              styles.originChip,
              apiOrigin.includes("studentvalue1984.eu.cc") &&
                styles.originChipActive,
            ]}
            activeScale={0.94}
            onPress={() => onSelectOrigin("https://studentvalue1984.eu.cc")}
          >
            <Text
              style={[
                styles.originChipText,
                apiOrigin.includes("studentvalue1984.eu.cc") &&
                  styles.originChipTextActive,
              ]}
            >
              Production (eu.cc)
            </Text>
          </SpringPressable>
        </View>
      </View>
    </ScrollView>
  );
});

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
    marginBottom: 20,
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
  card: {
    backgroundColor: "#111d33",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3378ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 2,
  },
  accountSubtitle: {
    fontSize: 12,
    color: "#8a9bb5",
  },
  loginButton: {
    backgroundColor: "#3378ff",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  logoutButton: {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fda4af",
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#93c5fd",
    marginBottom: 12,
  },
  groupInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupCodeLarge: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    fontFamily: "monospace",
    marginBottom: 2,
  },
  groupSubtext: {
    fontSize: 13,
    color: "#8a9bb5",
  },
  changeGroupButton: {
    backgroundColor: "#16253d",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#223554",
  },
  changeGroupText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#93c5fd",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    color: "#8a9bb5",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f8fafc",
  },
  statWarning: {
    color: "#fca5a5",
  },
  refreshSyncButton: {
    backgroundColor: "rgba(51, 120, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(51, 120, 255, 0.3)",
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  refreshSyncText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#93c5fd",
  },
  serverInfoText: {
    fontSize: 12,
    color: "#8a9bb5",
    marginBottom: 10,
    fontFamily: "monospace",
  },
  originButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  originChip: {
    backgroundColor: "#16253d",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#223554",
  },
  originChipActive: {
    backgroundColor: "rgba(51, 120, 255, 0.25)",
    borderColor: "#3378ff",
  },
  originChipText: {
    fontSize: 12,
    color: "#8a9bb5",
  },
  originChipTextActive: {
    color: "#93c5fd",
    fontWeight: "700",
  },
});
