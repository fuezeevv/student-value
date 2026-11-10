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
      <rect x="3.5" y="4.5" width="17" height="16" rx="4" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="8" y1="2.5" x2="8" y2="5" />
      <line x1="16" y1="2.5" x2="16" y2="5" />
      <circle cx="12" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SubjectsIcon({ size = 20, width, height, ...props }: IconProps) {
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
      <path d="M4 19.5v-13A2.5 2.5 0 0 1 6.5 4H19a1 1 0 0 1 1 1v14.5" />
      <path d="M6.5 4v15.5A2.5 2.5 0 0 1 4 22h15a1 1 0 0 0 1-1v-1.5" />
      <path d="M9 8h7" />
      <path d="M9 12h5" />
    </svg>
  );
}

export function DeadlinesIcon({ size = 20, width, height, ...props }: IconProps) {
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
      <circle cx="12" cy="12" r="8.5" />
      <polyline points="12 7.5 12 12 15 14" />
      <line x1="12" y1="1.5" x2="12" y2="3.5" />
    </svg>
  );
}

export function SafetyShieldIcon({ size = 20, width, height, ...props }: IconProps) {
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
