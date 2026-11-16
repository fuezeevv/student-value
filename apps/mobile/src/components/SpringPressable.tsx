import React from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  StyleSheet,
} from "react-native";

export interface SpringPressableProps
  extends Omit<PressableProps, "style" | "children"> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  activeScale?: number;
}

/**
 * High-performance, crash-free tactile pressable.
 * Uses native Pressable state to deliver immediate tactile feedback
 * without risking native driver crashes during list scrolling.
 */
export const SpringPressable: React.FC<SpringPressableProps> = ({
  children,
  style,
  containerStyle,
  activeScale = 0.97,
  disabled,
  ...props
}) => {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        containerStyle,
        style,
        pressed && !disabled && {
          opacity: 0.85,
          transform: [{ scale: activeScale }],
        },
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
};
