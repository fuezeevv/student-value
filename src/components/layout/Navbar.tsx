"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { switchDevUserAction } from "@/server/actions/task-actions";
import { Logo } from "@/components/ui/Logo";
import { GroupSwitcher } from "@/components/workspace/GroupSwitcher";
import {
  BookOpen,
  CalendarDays,
  Sun,
  Search,
  Bell,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";

const primary = [
  { href: "/", label: "Сегодня", icon: Sun },
  { href: "/courses", label: "Предметы", icon: BookOpen },
  { href: "/deadlines", label: "Сроки", icon: CalendarDays },
];
const secondary = [
  { href: "/lessons", label: "Занятия и записи" },
  { href: "/proposals", label: "Предложения и уточнения" },
  { href: "/group", label: "Моя группа и приглашения" },
  { href: "/calendar", label: "Личный календарь" },
  { href: "/analytics", label: "Мой прогресс" },
  { href: "/leaderboard", label: "Рейтинг и достижения" },
  { href: "/settings", label: "Профиль и настройки" },
];

export function Navbar({
  user,
  unreadCount = 0,
  devAuthEnabled = false,
}: {
  user: SessionUser | null;
  unreadCount?: number;
  devAuthEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname.startsWith(href) ||
        (href === "/courses" && pathname.startsWith("/tasks"));
  const isAdmin =
    user?.isOwner ||
    user?.permissions.some((p) =>
      [
        "manage_tasks",
        "manage_group",
        "manage_courses",
        "manage_deadlines",
        "manage_members",
        "manage_announcements",
      ].includes(p),
    );
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (
        !menu.current?.contains(e.target as Node) &&
        !(e.target as Element).closest('[aria-controls="account-menu"]')
      )
        setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [open]);
  const toggle = () => setOpen((v) => !v);
  return (
    <>
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <header className="site-header">
        <div className="nav-inner">
          <Logo />
          {user && (
            <nav className="desktop-nav" aria-label="Главная навигация">
              {primary.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={active(href) ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}
          <div className="nav-actions">
            {user && (
              <>
                <Link href="/search" className="icon-button" aria-label="Поиск">
                  <Search size={19} />
                </Link>
                <Link
                  href="/notifications"
                  className="icon-button notification-link"
                  aria-label={`Уведомления${unreadCount ? `: ${unreadCount} непрочитанных` : ""}`}
                >
                  <Bell size={19} />
                  {unreadCount > 0 && (
                    <span>{unreadCount > 9 ? "9+" : unreadCount}</span>
                  )}
                </Link>
              </>
            )}
            {user ? (
              <button
                ref={trigger}
                onClick={toggle}
                className="account-button"
                aria-label="Открыть меню"
                aria-expanded={open}
                aria-controls="account-menu"
              >
                <span className="account-initial">
                  {user.nickname.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden lg:inline">{user.nickname}</span>
                {open ? <X size={17} /> : <Menu size={17} />}
              </button>
            ) : (
              <Link className="text-link" href="/login">
                Войти
              </Link>
            )}
          </div>
          {open && (
            <div id="account-menu" ref={menu} className="account-menu">
              <p className="eyebrow">{user?.nickname}</p>
              {user?.groups && (
                <GroupSwitcher groups={user.groups} current={user.groupId} />
              )}
              {secondary.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                  <ArrowUpRight size={15} />
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="menu-admin"
                >
                  Панель старосты
                  <ArrowUpRight size={15} />
                </Link>
              )}
              {devAuthEnabled && (
                <details className="dev-tools">
                  <summary>Локальная разработка</summary>
                  <div className="flex gap-2 mt-3">
                    {[
                      ["user-dev-owner", "Староста"],
                      ["user-dev-student", "Студент"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await switchDevUserAction(id);
                            setOpen(false);
                          })
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </header>
      {user && (
        <nav className="mobile-nav" aria-label="Навигация на телефоне">
          {primary.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          ))}
          <button
            onClick={toggle}
            aria-expanded={open}
            aria-controls="account-menu"
          >
            <Menu size={20} />
            <span>Ещё</span>
          </button>
        </nav>
      )}
    </>
  );
}
