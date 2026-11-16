import React from "react";
import { View, StyleSheet } from "react-native";

interface IconProps {
  size?: number;
  color?: string;
}

/**
 * Clean, code-native crisp vector icons rendered via React Native primitives.
 * Retina-sharp on any DPI, zero external bundle overhead, instant 120 FPS rendering.
 */

export const ListIcon: React.FC<IconProps> = ({ size = 22, color = "#ffffff" }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={styles.listRow}>
        <View style={[styles.listDot, { backgroundColor: color }]} />
        <View style={[styles.listLine, { backgroundColor: color }]} />
      </View>
      <View style={[styles.listRow, { marginVertical: size * 0.14 }]}>
        <View style={[styles.listDot, { backgroundColor: color }]} />
        <View style={[styles.listLine, { backgroundColor: color }]} />
      </View>
      <View style={styles.listRow}>
        <View style={[styles.listDot, { backgroundColor: color }]} />
        <View style={[styles.listLine, { backgroundColor: color }]} />
      </View>
    </View>
  );
};

export const BookIcon: React.FC<IconProps> = ({ size = 22, color = "#64748b" }) => {
  const w = size * 0.42;
  const h = size * 0.65;
  return (
    <View style={[styles.bookContainer, { width: size, height: size }]}>
      <View
        style={[
          styles.bookPageLeft,
          { width: w, height: h, borderColor: color },
        ]}
      />
      <View
        style={[
          styles.bookPageRight,
          { width: w, height: h, borderColor: color },
        ]}
      />
    </View>
  );
};

export const ClockIcon: React.FC<IconProps> = ({ size = 22, color = "#64748b" }) => {
  const radius = size * 0.42;
  return (
    <View
      style={[
        styles.clockCircle,
        {
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
          borderColor: color,
        },
      ]}
    >
      {/* Hour hand */}
      <View
        style={[
          styles.clockHour,
          {
            height: radius * 0.55,
            backgroundColor: color,
            top: radius * 0.45,
            left: radius - 1,
          },
        ]}
      />
      {/* Minute hand */}
      <View
        style={[
          styles.clockMinute,
          {
            width: radius * 0.5,
            backgroundColor: color,
            top: radius - 1,
            left: radius - 1,
          },
        ]}
      />
    </View>
  );
};

export const ProfileIcon: React.FC<IconProps> = ({ size = 22, color = "#64748b" }) => {
  const headSize = size * 0.38;
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={[
          styles.profileHead,
          {
            width: headSize,
            height: headSize,
            borderRadius: headSize / 2,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.profileBody,
          {
            width: size * 0.72,
            height: size * 0.35,
            borderTopLeftRadius: size * 0.35,
            borderTopRightRadius: size * 0.35,
            borderColor: color,
          },
        ]}
      />
    </View>
  );
};

export const ArrowUpRightIcon: React.FC<IconProps> = ({ size = 14, color = "#93c5fd" }) => {
  return (
    <View style={[styles.arrowContainer, { width: size, height: size }]}>
      <View style={[styles.arrowStem, { backgroundColor: color }]} />
      <View style={[styles.arrowHeadTop, { backgroundColor: color }]} />
      <View style={[styles.arrowHeadRight, { backgroundColor: color }]} />
    </View>
  );
};

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 16, color = "#8a9bb5" }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={[
          styles.chevron,
          {
            width: size * 0.5,
            height: size * 0.5,
            borderColor: color,
          },
        ]}
      />
    </View>
  );
};

export const MapIcon: React.FC<IconProps> = ({ size = 20, color = "#94a3b8" }) => {
  return (
    <View style={[styles.mapContainer, { width: size, height: size }]}>
      <View style={[styles.mapFold, { borderColor: color, borderRightWidth: 1 }]} />
      <View style={[styles.mapFold, { borderColor: color, borderRightWidth: 1, borderLeftWidth: 1 }]} />
      <View style={[styles.mapFold, { borderColor: color, borderLeftWidth: 1 }]} />
    </View>
  );
};

export const NewsIcon: React.FC<IconProps> = ({ size = 20, color = "#94a3b8" }) => {
  return (
    <View style={[styles.newsContainer, { width: size, height: size, borderColor: color }]}>
      <View style={[styles.newsHeaderLine, { backgroundColor: color }]} />
      <View style={[styles.newsBodyLine, { backgroundColor: color }]} />
      <View style={[styles.newsBodyLineShort, { backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "80%",
  },
  listDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    marginRight: 4,
  },
  listLine: {
    flex: 1,
    height: 2.2,
    borderRadius: 1.5,
  },
  bookContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 1.5,
  },
  bookPageLeft: {
    borderWidth: 1.8,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderRightWidth: 0.8,
  },
  bookPageRight: {
    borderWidth: 1.8,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    borderLeftWidth: 0.8,
  },
  clockCircle: {
    borderWidth: 1.8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  clockHour: {
    position: "absolute",
    width: 1.8,
    borderRadius: 1,
  },
  clockMinute: {
    position: "absolute",
    height: 1.8,
    borderRadius: 1,
  },
  profileHead: {
    borderWidth: 1.8,
    marginBottom: 1.5,
  },
  profileBody: {
    borderWidth: 1.8,
    borderBottomWidth: 0,
  },
  arrowContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowStem: {
    position: "absolute",
    width: 1.6,
    height: "80%",
    transform: [{ rotate: "-45deg" }],
    borderRadius: 1,
  },
  arrowHeadTop: {
    position: "absolute",
    top: 1,
    right: 1,
    width: "45%",
    height: 1.6,
    borderRadius: 1,
  },
  arrowHeadRight: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 1.6,
    height: "45%",
    borderRadius: 1,
  },
  chevron: {
    borderBottomWidth: 2,
    borderRightWidth: 2,
    transform: [{ rotate: "45deg" }],
    marginTop: -2,
  },
  mapContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  mapFold: {
    flex: 1,
    borderTopWidth: 1.6,
    borderBottomWidth: 1.6,
  },
  newsContainer: {
    borderWidth: 1.6,
    borderRadius: 4,
    padding: 3,
    justifyContent: "space-between",
  },
  newsHeaderLine: {
    width: "60%",
    height: 2.2,
    borderRadius: 1,
    marginBottom: 2,
  },
  newsBodyLine: {
    width: "100%",
    height: 1.8,
    borderRadius: 1,
    marginBottom: 2,
  },
  newsBodyLineShort: {
    width: "75%",
    height: 1.8,
    borderRadius: 1,
  },
});
