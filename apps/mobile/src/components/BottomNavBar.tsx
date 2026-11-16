import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ListIcon, BookIcon, ClockIcon, ProfileIcon } from "./NativeIcons";

export type NavTab = "flow" | "subjects" | "deadlines" | "profile";

export interface BottomNavBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  style?: StyleProp<ViewStyle>;
}

interface TabDef {
  key: NavTab;
  label: string;
  renderIcon: (active: boolean) => React.ReactNode;
}

const TABS: TabDef[] = [
  {
    key: "flow",
    label: "Поток",
    renderIcon: (active) => (
      <ListIcon size={20} color={active ? "#1e1b4b" : "#64748b"} />
    ),
  },
  {
    key: "subjects",
    label: "Предметы",
    renderIcon: (active) => (
      <BookIcon size={20} color={active ? "#1e1b4b" : "#64748b"} />
    ),
  },
  {
    key: "deadlines",
    label: "Сроки",
    renderIcon: (active) => (
      <ClockIcon size={20} color={active ? "#1e1b4b" : "#64748b"} />
    ),
  },
  {
    key: "profile",
    label: "Профиль",
    renderIcon: (active) => (
      <ProfileIcon size={20} color={active ? "#1e1b4b" : "#64748b"} />
    ),
  },
];

export const BottomNavBar = React.memo<BottomNavBarProps>(({
  activeTab,
  onSelectTab,
  style,
}) => {
  return (
    <View style={[styles.bottomBarContainer, style]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            style={styles.tabItem}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Вкладка ${tab.label}`}
          >
            <View
              style={[
                styles.iconWrapper,
                isActive && styles.activePill,
              ]}
            >
              {tab.renderIcon(isActive)}
            </View>
            <Text
              style={[
                styles.tabLabel,
                isActive ? styles.activeLabel : styles.inactiveLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

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
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItemPressed: {
    opacity: 0.75,
  },
  iconWrapper: {
    width: 60,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    overflow: "hidden",
  },
  activePill: {
    backgroundColor: "#c7d2fe",
    borderRadius: 16,
    overflow: "hidden",
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
