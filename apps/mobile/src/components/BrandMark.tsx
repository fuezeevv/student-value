import React from "react";
import Svg, { Path } from "react-native-svg";
/** Original paths from src/components/ui/Logo.tsx; no raster background. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M5 29C4 16 17 4 31 7C43 10 42 20 31 23C21 26 15 22 12 32C10 38 6 36 5 29Z"
        fill="#3378ff"
      />
      <Path
        d="M12 34C14 23 25 29 34 20C41 13 46 23 40 33C35 42 20 46 12 39C10 37 11 36 12 34Z"
        fill="#dcecff"
      />
      <Path
        d="M32 30C38 28 43 30 40 35C38 40 31 43 25 42C21 41 27 32 32 30Z"
        fill="#9b304d"
      />
    </Svg>
  );
}
export function OfflineMark({ color }: { color: string }) {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8C8 3 16 3 21 8M6 12C9 9 15 9 18 12M9 16C11 14 13 14 15 16M12 20H12.01M3 3L21 21"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
