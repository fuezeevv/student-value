"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionUser } from "@/lib/auth/session";
import { switchDevUserAction } from "@/server/actions/task-actions";
import { Badge } from "@/components/ui/Badge";
import { BookOpen, Home, Shield, User, RefreshCw } from "lucide-react";

interface NavbarProps {
  user: SessionUser | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (targetId: string) => {
    startTransition(async () => {
      await switchDevUserAction(targetId);
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand & Group context */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-sm group-hover:border-sky-400 transition-colors">
              П
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-slate-100 group-hover:text-sky-400 transition-colors">
                СПбПУ 40102
              </span>
              <span className="text-[10px] text-slate-400">Учебная платформа</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2 ml-2 pl-3 border-l border-slate-800">
            <Badge variant="secondary" className="text-[11px] font-mono">
              5130901/40102
            </Badge>
            <Badge variant="default" className="text-[11px]">
              Осень 2026 • 5 сем.
            </Badge>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              pathname === "/"
                ? "bg-slate-800 text-sky-400 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Главная</span>
          </Link>

          <Link
            href="/courses"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              pathname.startsWith("/courses")
                ? "bg-slate-800 text-sky-400 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Дисциплины</span>
          </Link>
        </nav>

        {/* Right: User & Dev Role Switcher */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              {/* Dev Role Switcher */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 px-1 hidden lg:inline">
                  DEV:
                </span>
                <button
                  onClick={() => handleSwitch("user-dev-owner")}
                  disabled={isPending || user.id === "user-dev-owner"}
                  className={`text-xs px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                    user.id === "user-dev-owner"
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Переключиться на профиль Старосты (Расул)"
                >
                  <Shield className="w-3 h-3" />
                  <span className="hidden sm:inline">Расул (Староста)</span>
                </button>

                <button
                  onClick={() => handleSwitch("user-dev-student")}
                  disabled={isPending || user.id === "user-dev-student"}
                  className={`text-xs px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                    user.id === "user-dev-student"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Переключиться на профиль обычного Студента"
                >
                  <User className="w-3 h-3" />
                  <span className="hidden sm:inline">Студент [DEMO]</span>
                </button>
              </div>

              {/* User Avatar */}
              <div className="flex items-center gap-2 pl-1">
                <img
                  src={user.avatarUrl || "https://api.dicebear.com/7.x/bottts/svg?seed=rasul"}
                  alt={user.nickname}
                  className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700"
                />
                <span className="text-xs font-medium text-slate-200 hidden xl:inline">
                  {user.nickname}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
