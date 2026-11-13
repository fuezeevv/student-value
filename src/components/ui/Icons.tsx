import type { SVGProps } from "react";

// Bespoke code-native icons crafted with smooth rounded joints and 1.7px stroke weight
// eliminating generic stock icon packs in favor of an authentic student editorial aesthetic.

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

export function TodayIcon({ size = 20, width, height, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width ?? size}
      height={height ?? size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 5h10M10 12h7M10 19h10" />
      <rect
        x="3"
        y="3"
        width="3"
        height="4"
        rx="1.5"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="3"
        y="9"
        width="3"
        height="6"
        rx="1.5"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="3"
        y="17"
        width="3"
        height="4"
        rx="1.5"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function SubjectsIcon({
  size = 20,
  width,
  height,
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width ?? size}
      height={height ?? size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 5.5c3-1.2 6-.6 9 1.4v14c-3-2-6-2.6-9-1.4zM21 5.5c-3-1.2-6-.6-9 1.4v14c3-2 6-2.6 9-1.4z" />
      <path d="M6 9l3 1M15 10l3-1M6 13l3 1" />
    </svg>
  );
}

export function DeadlinesIcon({
  size = 20,
  width,
  height,
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width ?? size}
      height={height ?? size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M19.8 8A8.5 8.5 0 1 0 20 15.5" />
      <path d="M12 6.5V12l3 2M17 3.5l2 2M19 19l2 2" />
      <circle cx="20.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SafetyShieldIcon({
  size = 20,
  width,
  height,
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width ?? size}
      height={height ?? size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
