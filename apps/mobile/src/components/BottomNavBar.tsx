import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { BookIcon, ProfileIcon } from "./NativeIcons";
import { GlassFill } from "./GlassFill";

export type NavTab = "flow" | "subjects" | "deadlines" | "profile";

const tabs = [
  { key: "flow", label: "Поток", path: "M3 10 12 3l9 7v10H3z M9 20v-6h6v6" },
  { key: "subjects", label: "Предметы", icon: BookIcon },
  {
    key: "deadlines",
    label: "Сроки",
    path: "M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5 M8 14h2 M14 14h2",
  },
  { key: "profile", label: "Профиль", icon: ProfileIcon },
] as const;

export const BottomNavBar = memo(function BottomNavBar({
  activeTab,
  onSelectTab,
}: {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}) {
  return (
    <View style={styles.bar}>
      <GlassFill />
      {tabs.map((tab) => {
        const selected = activeTab === tab.key;
        const color = selected ? "#ffffff" : "#414e76";
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            style={[styles.tab, selected && styles.selected]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
          >
            {"icon" in tab ? (
              <tab.icon size={20} color={color} />
            ) : (
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path
                  d={tab.path}
                  stroke={color}
                  strokeWidth={1.8}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </Svg>
            )}
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginTop: 5,
    marginBottom: 9,
    padding: 4,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#ffffff",
    overflow: "hidden",
    backgroundColor: "#e9eeff",
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    gap: 3,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  selected: { backgroundColor: "#4556cb" },
  label: { fontSize: 11, fontWeight: "700", textAlign: "center" },
});
