import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";

const OFFICIAL_MAP = "https://www.spbstu.ru/campus-map/";
const OFFICIAL_PDF = "https://www.spbstu.ru/upload/sveden/map.pdf?v=2024";

// Coordinates, floor plans and accessibility details require their own verified
// sources. Until then, use the university's actual map rather than invented pins.
export function CampusMapModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const open = (url: string) =>
    Linking.openURL(url).catch(() =>
      Alert.alert(
        "Не удалось открыть карту",
        "Проверьте подключение к сети и повторите попытку.",
      ),
    );
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.heading}>
            <Text style={styles.title}>Карта кампуса</Text>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Закрыть карту"
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.text}>
            Официальная карта СПбПУ с расположением корпусов. Откроется в
            браузере; для загрузки нужен интернет.
          </Text>
          <Pressable
            onPress={() => open(OFFICIAL_MAP)}
            style={styles.primary}
            accessibilityRole="link"
          >
            <Text style={styles.primaryText}>Открыть карту СПбПУ ↗</Text>
          </Pressable>
          <Pressable
            onPress={() => open(OFFICIAL_PDF)}
            style={styles.secondary}
            accessibilityRole="link"
          >
            <Text style={styles.link}>Официальная схема в PDF ↗</Text>
          </Pressable>
          <Text style={styles.source}>Источник: spbstu.ru/campus-map</Text>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#16253d",
    padding: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "700", flex: 1 },
  close: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#cbd5e1", fontSize: 30 },
  text: { color: "#cbd5e1", fontSize: 16, lineHeight: 24, marginBottom: 24 },
  primary: {
    backgroundColor: "#2563eb",
    padding: 16,
    minHeight: 48,
    borderRadius: 12,
  },
  primaryText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  secondary: { paddingVertical: 20, minHeight: 48 },
  link: { color: "#93c5fd", fontSize: 16 },
  source: { color: "#94a3b8", fontSize: 12, marginTop: 8 },
});
