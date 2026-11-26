import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

type GradientStop = { offset: number; color: string; opacity?: number };

export function GradientFill({
  stops,
  diagonal = false,
}: {
  stops: readonly GradientStop[];
  diagonal?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={({
        nativeEvent: {
          layout: { width, height },
        },
      }) =>
        setSize((old) =>
          old.width === width && old.height === height
            ? old
            : { width, height },
        )
      }
    >
      {size.width > 0 && size.height > 0 && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient
              id="fill"
              x1="0%"
              y1="0%"
              x2={diagonal ? "100%" : "18%"}
              y2="100%"
            >
              {stops.map(({ offset, color, opacity }) => (
                <Stop
                  key={offset}
                  offset={offset}
                  stopColor={color}
                  stopOpacity={opacity ?? 1}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#fill)" />
        </Svg>
      )}
    </View>
  );
}
