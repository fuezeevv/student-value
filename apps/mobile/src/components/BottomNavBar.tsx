import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SpringPressable } from "./SpringPressable";
import { ListIcon, BookIcon, ClockIcon, ProfileIcon } from "./NativeIcons";

export type NavTab = "flow" | "subjects" | "deadlines" | "profile";

export interface BottomNavBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  style?: StyleProp<ViewStyle>;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  style,
}) => {
  return (
    <View style={[styles.bottomBarContainer, style]}>
      {/* 1. Поток (Flow) */}
      <SpringPressable
        containerStyle={styles.tabItemContainer}
        style={styles.tabContent}
        activeScale={0.92}
        onPress={() => onSelectTab("flow")}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === "flow" }}
        accessibilityLabel="Вкладка Поток"
      >
        <View
          style={[
            styles.iconWrapper,
            activeTab === "flow" && styles.activePill,
          ]}
        >
          <ListIcon
            size={20}
            color={activeTab === "flow" ? "#1e1b4b" : "#64748b"}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            activeTab === "flow" ? styles.activeLabel : styles.inactiveLabel,
          ]}
        >
          Поток
        </Text>
      </SpringPressable>

      {/* 2. Предметы (Subjects) */}
      <SpringPressable
        containerStyle={styles.tabItemContainer}
        style={styles.tabContent}
        activeScale={0.92}
        onPress={() => onSelectTab("subjects")}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === "subjects" }}
        accessibilityLabel="Вкладка Предметы"
      >
        <View
          style={[
            styles.iconWrapper,
            activeTab === "subjects" && styles.activePill,
          ]}
        >
          <BookIcon
            size={20}
            color={activeTab === "subjects" ? "#1e1b4b" : "#64748b"}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            activeTab === "subjects" ? styles.activeLabel : styles.inactiveLabel,
          ]}
        >
          Предметы
        </Text>
      </SpringPressable>

      {/* 3. Сроки (Deadlines) */}
      <SpringPressable
        containerStyle={styles.tabItemContainer}
        style={styles.tabContent}
        activeScale={0.92}
        onPress={() => onSelectTab("deadlines")}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === "deadlines" }}
        accessibilityLabel="Вкладка Сроки"
      >
        <View
          style={[
            styles.iconWrapper,
            activeTab === "deadlines" && styles.activePill,
          ]}
        >
          <ClockIcon
            size={20}
            color={activeTab === "deadlines" ? "#1e1b4b" : "#64748b"}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            activeTab === "deadlines" ? styles.activeLabel : styles.inactiveLabel,
          ]}
        >
          Сроки
        </Text>
      </SpringPressable>

      {/* 4. Профиль (Profile) */}
      <SpringPressable
        containerStyle={styles.tabItemContainer}
        style={styles.tabContent}
        activeScale={0.92}
        onPress={() => onSelectTab("profile")}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === "profile" }}
        accessibilityLabel="Вкладка Профиль"
      >
        <View
          style={[
            styles.iconWrapper,
            activeTab === "profile" && styles.activePill,
          ]}
        >
          <ProfileIcon
            size={20}
            color={activeTab === "profile" ? "#1e1b4b" : "#64748b"}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            activeTab === "profile" ? styles.activeLabel : styles.inactiveLabel,
          ]}
        >
          Профиль
        </Text>
      </SpringPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#0b1322",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    paddingHorizontal: 8,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  tabItemContainer: {
    flex: 1,
    alignItems: "center",
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    width: 60,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  activePill: {
    backgroundColor: "#c7d2fe",
  },
  tabLabel: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  activeLabel: {
    color: "#ffffff",
    fontWeight: "700",
  },
  inactiveLabel: {
    color: "#64748b",
    fontWeight: "500",
  },
});
