import { useRef } from "react";
import type { GestureResponderEvent } from "react-native";
import { daySwipeDirection } from "@studentvalue/mobile-contracts";

export function useDaySwipe(previous: () => void, next: () => void) {
  const start = useRef<{ x: number; y: number; at: number } | null>(null);
  return {
    onTouchStart: ({ nativeEvent }: GestureResponderEvent) => {
      start.current =
        nativeEvent.touches.length === 1
          ? { x: nativeEvent.pageX, y: nativeEvent.pageY, at: Date.now() }
          : null;
    },
    onTouchMove: ({ nativeEvent }: GestureResponderEvent) => {
      if (nativeEvent.touches.length !== 1) start.current = null;
    },
    onTouchCancel: () => {
      start.current = null;
    },
    onTouchEnd: ({ nativeEvent }: GestureResponderEvent) => {
      const from = start.current;
      start.current = null;
      if (!from || nativeEvent.touches.length) return;
      const dx = nativeEvent.pageX - from.x;
      const direction = daySwipeDirection({
        dx,
        dy: nativeEvent.pageY - from.y,
        vx: dx / Math.max(1, Date.now() - from.at),
      });
      if (direction === 1) next();
      if (direction === -1) previous();
    },
  };
}
