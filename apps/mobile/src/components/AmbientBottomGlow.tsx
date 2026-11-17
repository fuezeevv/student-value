import React from "react";
import { View } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
export const AmbientBottomGlow = React.memo(() => {
  const { isDark } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 330,
      }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient
            id="bottomReflection"
            cx="52%"
            cy="105%"
            rx="78%"
            ry="100%"
          >
            <Stop
              offset="0"
              stopColor="#9b304d"
              stopOpacity={isDark ? 0.12 : 0.055}
            />
            <Stop
              offset="0.55"
              stopColor="#9b304d"
              stopOpacity={isDark ? 0.035 : 0.018}
            />
            <Stop offset="1" stopColor="#9b304d" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bottomReflection)" />
      </Svg>
    </View>
  );
});
