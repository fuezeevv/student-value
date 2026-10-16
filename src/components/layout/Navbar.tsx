"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionUser } from "@/lib/auth/session";
import { switchDevUserAction } from "@/server/actions/task-actions";
import { Logo } from "@/components/ui/Logo";
import {
  BookOpen,
  Calendar,
  CheckSquare,
  FileText,
  Home,
  Shield,
  User,
  Search,
  Bell,
  Trophy,
  Users,
  BarChart2,
  Settings,
  Menu,
  X,
  ChevronDown,
  Layers,
} from "lucide-react";

interface NavbarProps {
  user: SessionUser | null;
  unreadCount?: number;
  devAuthEnabled?: boolean;
}

export function Navbar({ user, unreadCount = 0, devAuthEnabled = false }: NavbarProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement>(null);

  // Close "More" dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(event.target as Node)
      ) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  }, [pathname]);

  const handleSwitch = (targetId: string) => {
    startTransition(async () => {
      await switchDevUserAction(targetId);
    });
  };

  const isAdmin =
    user?.isOwner ||
    user?.isSystemAdmin ||
    user?.permissions.some((p) =>
      ["manage_tasks", "manage_group", "verify_progress", "manage_courses"].includes(p)
    );

  // Primary student navigation (Clean 4 essential items)
  const primaryLinks = [
    { href: "/", label: "Главная", icon: Home, exact: true },
    { href: "/courses", label: "Дисциплины", icon: BookOpen },
    { href: "/deadlines", label: "Дедлайны", icon: CheckSquare },
    { href: "/calendar", label: "Календарь", icon: Calendar },
  ];

  // Secondary items grouped under "Ещё" / Menu
  const secondaryLinks = [
    { href: "/transcripts", label: "Материалы и стенограммы", icon: FileText },
    { href: "/leaderboard", label: "Рейтинг и достижения", icon: Trophy },
    { href: "/members", label: "Состав группы", icon: Users },
    { href: "/analytics", label: "Аналитика", icon: BarChart2 },
    { href: "/settings", label: "Настройки", icon: Settings },
  ];

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const isSecondaryActive = secondaryLinks.some((l) => isActive(l.href));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#070a13]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Custom SVG Logo (Always leads to /) */}
        <Logo />

        {/* Center: Primary Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(0,229,255,0.12)]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          {/* Secondary Dropdown Menu ("Ещё") */}
          <div className="relative" ref={moreDropdownRef}>
            <button
              type="button"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSecondaryActive
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Ещё</span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                  moreMenuOpen ? "rotate-180 text-cyan-300" : ""
                }`}
              />
            </button>

            {/* Dropdown Content */}
            {moreMenuOpen && (
              <div className="absolute left-0 mt-2 w-56 rounded-xl bg-[#0c1222] border border-slate-800 shadow-2xl py-2 z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Ресурсы группы
                </div>
                {secondaryLinks.map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMoreMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${
                        active
                          ? "bg-cyan-950/40 text-cyan-300"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Admin Center Button (Exclusively for headman / admins) */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ml-1 ${
                isActive("/admin")
                  ? "bg-gradient-to-r from-cyan-950/60 to-rose-950/60 text-cyan-200 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,229,255,0.15)]"
                  : "border border-cyan-800/40 bg-slate-900/40 text-cyan-300 hover:border-cyan-500/40 hover:bg-cyan-950/30"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Панель старосты</span>
            </Link>
          )}
        </nav>

        {/* Right Action Icons: Search, Notifications, Profile / Mobile Toggle */}
        <div className="flex items-center gap-2">
          {/* Global Search Button */}
          <Link
            href="/search"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
            title="Глобальный поиск"
          >
            <Search className="w-4 h-4" />
          </Link>

          {/* Notifications Bell */}
          <Link
            href="/notifications"
            className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
            title="Центр уведомлений"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 text-[9px] font-bold text-white bg-rose-500 rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          {/* User Account / Profile link */}
          {user ? (
            <Link
              href="/settings"
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-900/60 transition-colors border border-transparent hover:border-slate-800"
              title={`Профиль: ${user.nickname}`}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.nickname}
                  className="w-7 h-7 rounded-full border border-cyan-500/40 bg-slate-800 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300 text-xs font-bold">
                  {user.nickname.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="hidden xl:inline text-xs font-semibold text-slate-200">
                {user.nickname}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              Войти
            </Link>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white"
            aria-label="Открыть меню"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800/90 bg-[#070a13] px-4 pt-3 pb-6 space-y-4 shadow-2xl animate-in slide-in-from-top-2 duration-150">
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-1">
              Основные разделы
            </div>
            {primaryLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-300 hover:bg-slate-900/60"
                  }`}
                >
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-900 space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-1">
              Ресурсы и группа
            </div>
            {secondaryLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-cyan-950/40 text-cyan-300"
                      : "text-slate-300 hover:bg-slate-900/60"
                  }`}
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {isAdmin && (
            <div className="pt-2 border-t border-slate-900">
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold bg-cyan-950/40 text-cyan-300 border border-cyan-500/40"
              >
                <Shield className="w-4 h-4 text-cyan-400" />
                <span>Панель старосты</span>
              </Link>
            </div>
          )}

          {/* Development Switcher (Dev mode only) */}
          {devAuthEnabled && user && (
            <div className="pt-2 border-t border-slate-900 text-xs">
              <span className="text-[10px] text-slate-500 block mb-1">
                Переключение роли (Dev):
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSwitch("user-dev-owner")}
                  className={`p-2 rounded-lg text-center font-medium border text-xs cursor-pointer ${
                    user.id === "user-dev-owner"
                      ? "bg-cyan-950/50 border-cyan-500 text-cyan-300"
                      : "bg-slate-900 border-slate-800 text-slate-400"
                  }`}
                >
                  Староста
                </button>
                <button
                  onClick={() => handleSwitch("user-dev-student")}
                  className={`p-2 rounded-lg text-center font-medium border text-xs cursor-pointer ${
                    user.id === "user-dev-student"
                      ? "bg-cyan-950/50 border-cyan-500 text-cyan-300"
                      : "bg-slate-900 border-slate-800 text-slate-400"
                  }`}
                >
                  Студент [Demo]
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
