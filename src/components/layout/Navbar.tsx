"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { switchDevUserAction } from "@/server/actions/task-actions";
import { Logo } from "@/components/ui/Logo";
import { ConnectionStatus } from "@/components/offline/ConnectionStatus";
import type { DailyTask } from "@/components/study/WellbeingHeaderTrigger";
import { PreviewNavbar } from "@/components/preview/PreviewNavbar";
import { GroupSwitcher } from "@/components/workspace/GroupSwitcher";
import { TodayIcon, SubjectsIcon, DeadlinesIcon } from "@/components/ui/Icons";
import { WellbeingHeaderTrigger } from "@/components/study/WellbeingHeaderTrigger";
import { Menu, X, ArrowUpRight } from "lucide-react";

const primary = [
  { href: "/", label: "Сегодня", icon: TodayIcon },
  { href: "/courses", label: "Предметы", icon: SubjectsIcon },
  { href: "/deadlines", label: "Сроки", icon: DeadlinesIcon },
];
const secondary = [
  { href: "/schedule", label: "Расписание пар" },
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
  dailyTasks = [],
  unreadCount = 0,
  devAuthEnabled = false,
}: {
  user: SessionUser | null;
  dailyTasks?: DailyTask[];
  unreadCount?: number;
  devAuthEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
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
      if (open && e.key === "Escape" && !e.defaultPrevented) {
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
  if (pathname === "/browse" || pathname.startsWith("/browse/")) {
    return <PreviewNavbar pathname={pathname} signedIn={!!user} />;
  }
  return (
    <>
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <header className="site-header">
        <div className="nav-inner">
          {/* Brand Logo */}
          <div className="flex items-center">
            <Logo />
          </div>

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
            <ConnectionStatus
              groupCode={
                user?.groups?.find((g) => g.id === user.groupId)?.code ||
                user?.groupName?.match(/\d{7}\/\d{5}/)?.[0]
              }
            />
            {user && (
              <WellbeingHeaderTrigger
                key={user.id}
                userId={user.id}
                tasks={dailyTasks}
              />
            )}
            {user && !mobile ? (
              <button
                ref={trigger}
                onClick={toggle}
                className="account-button flex items-center gap-1.5"
                aria-label="Открыть меню"
                aria-expanded={open}
                aria-controls="account-menu"
              >
                <span className="account-initial">
                  {user.nickname.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden lg:inline">{user.nickname}</span>
                {open ? (
                  <X size={17} className="hidden lg:inline" />
                ) : (
                  <Menu size={17} className="hidden lg:inline" />
                )}
              </button>
            ) : !user ? (
              <Link className="text-link" href="/login">
                Войти
              </Link>
            ) : null}
          </div>
          {open && (
            <div id="account-menu" ref={menu} className="account-menu">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--border)]">
                <p className="eyebrow !mb-0">{user?.nickname}</p>
              </div>
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
              <a
                href="https://t.me/studentvalue"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                Новости и вопросы · Telegram <ArrowUpRight size={15} />
              </a>
              <a
                href="/studentvalue1984.apk"
                download
                onClick={() => setOpen(false)}
                className="flex justify-between items-center text-xs text-blue-300 py-2.5 mt-1 border-t border-white/10 hover:text-white transition-colors"
              >
                <span>Приложение для Android</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 border border-blue-400/20">
                  .apk
                </span>
              </a>
              {user?.isPlatformOwner && (
                <Link href="/platform" className="text-link block py-3">
                  Все группы и аккаунты
                </Link>
              )}
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
          {primary.map(({ href, label, icon: Icon }) => {
            const isTabActive = active(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isTabActive ? "page" : undefined}
                className="flex flex-col items-center justify-center"
              >
                <span
                  className={`flex items-center justify-center transition-all ${
                    isTabActive
                      ? "px-4 py-1 rounded-full bg-[#cfc6ff] text-[#0b1a2d] dark:bg-[#cfc6ff] dark:text-[#0b1a2d] shadow-xs"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Icon size={20} strokeWidth={isTabActive ? 2.2 : 1.7} />
                </span>
                <span
                  className={`text-[10px] mt-0.5 ${
                    isTabActive
                      ? "font-bold text-[var(--ink)]"
                      : "text-[var(--ink-muted)]"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
          {mobile && (
            <button
              ref={trigger}
              onClick={toggle}
              aria-label="Открыть меню"
              aria-expanded={open}
              aria-controls="account-menu"
              className="mobile-profile"
            >
              <span className="account-initial">
                {user.nickname.slice(0, 1).toUpperCase()}
              </span>
              <span>Профиль</span>
            </button>
          )}
        </nav>
      )}
    </>
  );
}
