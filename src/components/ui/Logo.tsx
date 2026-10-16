import React from "react";
import Link from "next/link";

interface LogoProps {
  className?: string;
  showSubtitle?: boolean;
}

export function Logo({ className = "", showSubtitle = true }: LogoProps) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-3 group select-none transition-transform hover:scale-[1.01] ${className}`}
      title="Student Value 1.984 — На главную"
    >
      {/* Abstract Modern Lightbar & Fluid Badge */}
      <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-b from-[#0f172a] to-[#070b15] border border-slate-700/60 group-hover:border-cyan-500/50 shadow-[0_2px_12px_rgba(0,0,0,0.5)] transition-all overflow-hidden shrink-0">
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-6 transform group-hover:rotate-3 transition-transform duration-300"
        >
          <defs>
            <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id="crimsonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
          </defs>

          {/* Background ambient geometry */}
          <circle cx="18" cy="18" r="14" fill="#0b1329" opacity="0.6" />

          {/* Left: Electric Cyan Wing / Fluid Layer */}
          <path
            d="M8 18C8 12.477 12.477 8 18 8V28C12.477 28 8 23.523 8 18Z"
            fill="url(#cyanGrad)"
            opacity="0.9"
          />

          {/* Right: Emergency Crimson Wing (Subtle police 102 reference) */}
          <path
            d="M18 8C23.523 8 28 12.477 28 18C28 23.523 23.523 28 18 28V8Z"
            fill="url(#crimsonGrad)"
            opacity="0.85"
          />

          {/* Center: Minimalist Lightbar Core */}
          <rect
            x="16.5"
            y="7"
            width="3"
            height="22"
            rx="1.5"
            fill="#ffffff"
            className="drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]"
          />
        </svg>

        {/* Ambient Corner Red Glow */}
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500/40 rounded-full blur-[2px]" />
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col leading-tight">
        <span className="font-bold text-sm tracking-tight text-white group-hover:text-cyan-200 transition-colors flex items-center gap-1.5 whitespace-nowrap">
          Student Value <span className="text-cyan-400 font-mono font-black text-xs px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">1.984</span>
        </span>
        {showSubtitle && (
          <span className="text-[10px] text-slate-400 font-medium tracking-tight whitespace-nowrap mt-0.5">
            СПбПУ · 5130901/40102 · 5 сем.
          </span>
        )}
      </div>
    </Link>
  );
}
