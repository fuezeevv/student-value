import { useMemo } from "react";
import { PanResponder } from "react-native";
import { daySwipeDirection } from "@studentvalue/mobile-contracts";

export function useDaySwipe(previous: () => void, next: () => void) {
  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.numberActiveTouches === 1 &&
          Math.abs(gesture.dx) > 18 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.7,
        onPanResponderRelease: (_, gesture) => {
          const direction = daySwipeDirection(gesture);
          if (direction > 0) next();
          if (direction < 0) previous();
        },
        onPanResponderTerminationRequest: () => true,
        onShouldBlockNativeResponder: () => true,
      }),
    [previous, next],
  );
}
