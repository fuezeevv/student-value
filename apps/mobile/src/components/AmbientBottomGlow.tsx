import React from "react";
import { View, StyleSheet } from "react-native";

/**
 * Ambient bottom reflection:
 * A soft, elegant burgundy-wine ambient glow reflecting
 * naturally off the bottom of the screen glass around the navigation panel.
 */
export const AmbientBottomGlow: React.FC = React.memo(() => {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.glowLayer3} />
      <View style={styles.glowLayer2} />
      <View style={styles.glowLayer1} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 190,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  glowLayer3: {
    position: "absolute",
    bottom: -60,
    width: "135%",
    height: 190,
    borderRadius: 200,
    backgroundColor: "rgba(155, 48, 77, 0.035)",
  },
  glowLayer2: {
    position: "absolute",
    bottom: -35,
    width: "100%",
    height: 130,
    borderRadius: 140,
    backgroundColor: "rgba(155, 48, 77, 0.055)",
  },
  glowLayer1: {
    position: "absolute",
    bottom: -15,
    width: "70%",
    height: 80,
    borderRadius: 90,
    backgroundColor: "rgba(155, 48, 77, 0.075)",
  },
});
