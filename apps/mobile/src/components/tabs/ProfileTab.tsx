import { DEVELOPMENT_SERVER_CONTROLS } from "../../api/client";
import {
  useTheme,
  useThemedStyles,
  type Palette,
} from "../../theme/ThemeProvider";
import React, { useState } from "react";
import { ManagementModal } from "../ManagementModal";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
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
  onOpenCampusMap?: () => void;
  onOpenNews?: () => void;
}

export const ProfileTab = React.memo<ProfileTabProps>(
  ({
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
    onOpenCampusMap,
    onOpenNews,
  }) => {
    const { colors, choice, setChoice } = useTheme();
    const [managementOpen, setManagementOpen] = useState(false);
    const styles = useThemedStyles(createStyles);

    const website = (path: string) => {
      Linking.openURL(`https://studentvalue1984.eu.cc${path}`).catch(() => {
        Alert.alert(
          "Не удалось открыть сайт",
          "Откройте studentvalue1984.eu.cc в браузере.",
        );
      });
    };
    const canManage =
      sessionUser &&
      (sessionUser.isOwner ||
        sessionUser.permissions.some((permission) =>
          [
            "manage_group",
            "manage_tasks",
            "manage_courses",
            "manage_deadlines",
            "manage_members",
            "manage_announcements",
          ].includes(permission),
        ));
    const webLinks = [
      ...(canManage
        ? [
            { title: "Панель старосты", path: "/admin" },
            { title: "Обмен материалами групп", path: "/exchange" },
          ]
        : []),
      { title: "Настройки сайта и светлая / тёмная тема", path: "/settings" },
      { title: "Google Calendar", path: "/calendar" },
      { title: "Моя группа и приглашения", path: "/group" },
      { title: "Предложения и уточнения", path: "/proposals" },
      { title: "Прогресс и достижения", path: "/leaderboard" },
      ...(sessionUser?.isPlatformOwner
        ? [{ title: "Все группы и аккаунты", path: "/platform" }]
        : []),
    ];
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

        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Оформление приложения</Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 12,
            }}
          >
            {(
              [
                { id: "system", label: "Как в системе" },
                { id: "light", label: "Светлая" },
                { id: "dark", label: "Тёмная" },
              ] as const
            ).map((option) => (
              <SpringPressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: choice === option.id }}
                onPress={() => setChoice(option.id)}
                style={{
                  padding: 12,
                  minHeight: 48,
                  borderRadius: 14,
                  backgroundColor:
                    choice === option.id ? colors.raised : colors.soft,
                  borderWidth: 1,
                  borderColor: choice === option.id ? colors.link : colors.line,
                }}
              >
                <Text style={{ color: colors.text }}>{option.label}</Text>
              </SpringPressable>
            ))}
          </View>
        </View>
        {canManage ? (
          <SpringPressable
            onPress={() => setManagementOpen(true)}
            style={styles.card}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.link, fontSize: 18 }}>
              Работы и сроки · панель старосты →
            </Text>
            <Text style={{ color: colors.muted, marginTop: 8 }}>
              Редактировать, перенести срок или убрать ошибочное задание
            </Text>
          </SpringPressable>
        ) : null}
        <ManagementModal
          visible={managementOpen && Boolean(sessionUser)}
          onClose={() => setManagementOpen(false)}
          groupCode={groupCode}
        />
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
                  : "Публичные пары, предметы и работы"}
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
                  "Выйти и удалить личные данные, скачанные материалы и очередь с устройства? Неотправленные изменения будут потеряны. Отправленные результаты останутся на сервере.",
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

        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Возможности сайта</Text>
          <Text style={styles.serverInfoText}>
            Эти разделы откроются в браузере. Вход на сайте отдельный; нативный
            перенос ещё не завершён.
          </Text>
          {webLinks.map((link) => (
            <SpringPressable
              key={link.path}
              style={styles.serviceActionRow}
              onPress={() => website(link.path)}
              accessibilityRole="link"
              accessibilityLabel={`${link.title}, открыть сайт`}
            >
              <View style={styles.serviceTextCol}>
                <Text style={styles.serviceTitle}>{link.title}</Text>
              </View>
              <Text style={styles.serviceArrow}>↗</Text>
            </SpringPressable>
          ))}
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

        {/* Campus Services Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Сервисы Политеха</Text>

          {onOpenCampusMap && (
            <SpringPressable
              style={styles.serviceActionRow}
              activeScale={0.97}
              onPress={onOpenCampusMap}
              accessibilityRole="button"
              accessibilityLabel="Открыть карту кампуса"
            >
              <View style={styles.serviceIconBadge}>
                <Text style={styles.serviceIconText}>🗺️</Text>
              </View>
              <View style={styles.serviceTextCol}>
                <Text style={styles.serviceTitle}>Карта корпусов кампуса</Text>
                <Text style={styles.serviceSubtitle}>
                  Кампус в приложении и офлайн-планы главного здания
                </Text>
              </View>
              <Text style={styles.serviceArrow}>›</Text>
            </SpringPressable>
          )}

          {onOpenNews && (
            <SpringPressable
              style={[styles.serviceActionRow, { marginTop: 8 }]}
              activeScale={0.97}
              onPress={onOpenNews}
              accessibilityRole="button"
              accessibilityLabel="Открыть новости"
            >
              <View
                style={[
                  styles.serviceIconBadge,
                  { backgroundColor: "rgba(34, 158, 217, 0.15)" },
                ]}
              >
                <Text style={styles.serviceIconText}>📢</Text>
              </View>
              <View style={styles.serviceTextCol}>
                <Text style={styles.serviceTitle}>Новости и анонсы</Text>
                <Text style={styles.serviceSubtitle}>
                  Публикации проекта и студенческих сообществ
                </Text>
              </View>
              <Text style={styles.serviceArrow}>›</Text>
            </SpringPressable>
          )}
        </View>

        {/* Offline Storage Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Данные без интернета</Text>
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
        {DEVELOPMENT_SERVER_CONTROLS ? (
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
                    apiOrigin.includes("192.168") &&
                      styles.originChipTextActive,
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
        ) : null}
      </ScrollView>
    );
  },
);

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.canvas,
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
      color: colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.muted,
    },
    card: {
      backgroundColor: colors.surface,
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
      color: colors.onAccent,
    },
    accountDetails: {
      flex: 1,
    },
    accountName: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    accountSubtitle: {
      fontSize: 12,
      color: colors.muted,
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
      color: colors.onAccent,
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
      color: colors.link,
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
      color: colors.text,
      fontFamily: "monospace",
      marginBottom: 2,
    },
    groupSubtext: {
      fontSize: 13,
      color: colors.muted,
    },
    changeGroupButton: {
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#223554",
    },
    changeGroupText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.link,
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    statLabel: {
      fontSize: 13,
      color: colors.muted,
    },
    statValue: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
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
      color: colors.link,
    },
    serverInfoText: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 10,
      fontFamily: "monospace",
    },
    originButtonsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    originChip: {
      backgroundColor: colors.surface,
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
      color: colors.muted,
    },
    originChipTextActive: {
      color: colors.link,
      fontWeight: "700",
    },
    serviceActionRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.soft,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.line,
      gap: 12,
    },
    serviceIconBadge: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(59, 130, 246, 0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    serviceIconText: {
      fontSize: 18,
    },
    serviceTextCol: {
      flex: 1,
    },
    serviceTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    serviceSubtitle: {
      fontSize: 11,
      color: colors.muted,
      lineHeight: 15,
    },
    serviceArrow: {
      fontSize: 20,
      color: colors.subtle,
      fontWeight: "700",
    },
  });
