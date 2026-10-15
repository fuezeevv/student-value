import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "warning" | "urgent" | "info" | "success" | "muted";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border";

  const variants = {
    default: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    secondary: "bg-slate-800 text-slate-300 border-slate-700",
    destructive: "bg-red-500/15 text-red-400 border-red-500/30",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    urgent: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    muted: "bg-slate-800/60 text-slate-400 border-slate-700/50",
  };

  return (
    <span className={twMerge(clsx(base, variants[variant], className))} {...props}>
      {children}
    </span>
  );
}
