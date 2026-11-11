"use client";

import { useState } from "react";
import { WellbeingModal } from "./WellbeingModal";

export type WellbeingHeaderTriggerProps = {
  totalTasks?: number;
  completedTasks?: number;
  overdueTasks?: number;
};

export function WellbeingHeaderTrigger({
  totalTasks = 13,
  completedTasks = 2,
  overdueTasks = 4,
}: WellbeingHeaderTriggerProps) {
  const [open, setOpen] = useState(false);

  // Percent completion
  const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const isSafe = overdueTasks === 0;

  // Mini ring geometry
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (percent / 100) * circumference;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[var(--surface-active)] hover:bg-black/5 dark:hover:bg-white/10 border border-[var(--border)] transition-all cursor-pointer shadow-xs active:scale-95 group"
        aria-label="Дневной минимум и правила допуска"
        aria-expanded={open}
        aria-controls="wellbeing-modal"
      >
        <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r={radius}
            className="stroke-black/10 dark:stroke-white/10"
            strokeWidth="2.5"
            fill="none"
          />
          <circle
            cx="12"
            cy="12"
            r={radius}
            className={isSafe ? "stroke-emerald-500" : "stroke-[var(--wine)]"}
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        {/* Small center dot or status */}
        <span
          className={`absolute w-1.5 h-1.5 rounded-full ${
            isSafe ? "bg-emerald-500" : "bg-[var(--wine)]"
          }`}
        />
      </button>

      <WellbeingModal
        isOpen={open}
        onClose={() => setOpen(false)}
        totalTasks={totalTasks}
        completedTasks={completedTasks}
        overdueTasks={overdueTasks}
      />
    </>
  );
}
