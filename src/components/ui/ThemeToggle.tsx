"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  const applyTheme = (t: "light" | "dark") => {
    setTheme(t);
    const root = document.documentElement;
    root.setAttribute("data-theme", t);
    if (t === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("studentvalue-theme", t);
  };

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("studentvalue-theme");
    if (saved === "dark" || saved === "light") {
      applyTheme(saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark" : "light");
    }
  }, []);

  const toggleTheme = () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className={`w-9 h-9 rounded-xl flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${className}`}
        aria-label="Сменить тему оформления"
      >
        <span className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`w-9 h-9 rounded-xl flex items-center justify-center text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer ${className}`}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
    >
      {theme === "dark" ? (
        <Sun size={18} className="text-amber-400 rotate-0 transition-transform duration-300" />
      ) : (
        <Moon size={18} className="text-[var(--wine)] rotate-0 transition-transform duration-300" />
      )}
    </button>
  );
}
