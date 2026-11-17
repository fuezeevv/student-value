import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import type { MobileSessionUser } from "../auth/token-storage";
import { startMobileGoogleLogin, logoutMobile } from "../auth/client";
import { flushOutbox, type FlushReport } from "../sync/outbox";

interface AuthModalProps {
  visible: boolean;
  user: MobileSessionUser | null;
  pendingCount: number;
  onClose: () => void;
  onUserChanged: (user: MobileSessionUser | null) => void;
  onFlushComplete: (report: FlushReport) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  user,
  pendingCount,
  onClose,
  onUserChanged,
  onFlushComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await startMobileGoogleLogin();
      if (res.kind === "SUCCESS") {
        onUserChanged(res.user);
        onClose();
      } else if (res.kind === "ERROR") {
        setError(res.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    const warning =
      pendingCount > 0
        ? `В очереди ${pendingCount} неотправленных операций. При выходе они будут удалены.`
        : "Вы уверены, что хотите выйти из аккаунта?";

    Alert.alert("Выход из аккаунта", warning, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Выйти",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await logoutMobile();
            onUserChanged(null);
            onClose();
          } catch {
            onUserChanged(null);
            setError(
              "Сессия завершена, но не все файлы удалось удалить. Повторите очистку устройства.",
            );
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleSyncNow = async () => {
    setLoading(true);
    try {
      const rep = await flushOutbox();
      onFlushComplete(rep);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {user ? (
            /* Logged in state */
            <View style={styles.profileSection}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarInitial}>
                  {(user.nickname[0] || "U").toUpperCase()}
                </Text>
              </View>

              <Text style={styles.userName}>{user.nickname}</Text>
              <Text style={styles.userRole}>
                {user.isOwner ? "Староста группы" : "Студент"} · Группа{" "}
                {user.groupName || user.groupId}
              </Text>

              {/* Outbox Status Card */}
              <View style={styles.outboxCard}>
                <View style={styles.outboxRow}>
                  <Text style={styles.outboxLabel}>Офлайн-очередь:</Text>
                  <Text style={styles.outboxValue}>
                    {pendingCount === 0
                      ? "Все отметки синхронизированы"
                      : `${pendingCount} ожидают отправки`}
                  </Text>
                </View>

                {pendingCount > 0 && (
                  <TouchableOpacity
                    style={styles.syncNowButton}
                    onPress={handleSyncNow}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#93c5fd" />
                    ) : (
                      <Text style={styles.syncNowText}>
                        Синхронизировать сейчас
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Logout Button */}
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                disabled={loading}
              >
                <Text style={styles.logoutText}>Выйти из аккаунта</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Guest / Login state */
            <View style={styles.loginSection}>
              <Text style={styles.loginTitle}>Вход в аккаунт</Text>
              <Text style={styles.loginSubtitle}>
                Войдите через Google для сохранения личного прогресса, отметок
                выполнения заданий и получения XP.
              </Text>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={styles.googleLoginButton}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#0b1424" />
                ) : (
                  <Text style={styles.googleButtonText}>
                    Войти через Google
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.securityNote}>
                OAuth 2.0 PKCE · Системный браузер · Без сохранения паролей
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Закрыть</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#16253d",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#223554",
  },
  profileSection: {
    alignItems: "center",
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#ffffff",
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f0f4f8",
    marginBottom: 4,
  },
  userRole: {
    fontSize: 13,
    color: "#93c5fd",
    marginBottom: 16,
  },
  outboxCard: {
    width: "100%",
    backgroundColor: "#0b1424",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#223554",
  },
  outboxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  outboxLabel: {
    fontSize: 13,
    color: "#8a9bb5",
  },
  outboxValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dbeafe",
  },
  syncNowButton: {
    marginTop: 10,
    backgroundColor: "#1e3a5f",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  syncNowText: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
  },
  logoutButton: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    alignItems: "center",
    marginBottom: 10,
  },
  logoutText: {
    color: "#f87171",
    fontSize: 14,
    fontWeight: "600",
  },
  loginSection: {
    alignItems: "center",
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f0f4f8",
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 13,
    color: "#8a9bb5",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  googleLoginButton: {
    width: "100%",
    backgroundColor: "#f0f4f8",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 14,
  },
  googleButtonText: {
    color: "#0b1424",
    fontSize: 15,
    fontWeight: "700",
  },
  securityNote: {
    fontSize: 11,
    color: "#6b7d96",
    textAlign: "center",
    marginBottom: 10,
  },
  closeButton: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  closeText: {
    color: "#8a9bb5",
    fontSize: 14,
  },
});
