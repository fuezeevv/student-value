import Link from "next/link";
import { BookOpen, CalendarDays, Grid2X2, Sun } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { browsePath, publicGroupDefinition } from "@/lib/groups/public-groups";

export function PreviewNavbar({
  pathname,
  signedIn,
}: {
  pathname: string;
  signedIn: boolean;
}) {
  const parts = pathname.split("/").filter(Boolean);
  const group = publicGroupDefinition(parts[1] ?? "");
  const base = group ? browsePath(group.code) : "/browse";
  const links = group
    ? [
        { href: base, label: "Обзор", icon: Sun },
        { href: `${base}/courses`, label: "Предметы", icon: BookOpen },
        { href: `${base}/deadlines`, label: "Сроки", icon: CalendarDays },
      ]
    : [];
  const active = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);
  return (
    <>
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <header className="site-header">
        <div className="nav-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Гостевая навигация">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              className="text-link preview-login"
              href={signedIn ? "/" : "/login"}
            >
              {signedIn ? "Мой аккаунт" : "Войти"} ↗
            </Link>
          </div>
        </div>
      </header>
      {group && (
        <nav className="mobile-nav" aria-label="Гостевая навигация на телефоне">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
          <Link href="/browse#groups">
            <Grid2X2 size={19} />
            Группы
          </Link>
        </nav>
      )}
    </>
  );
}
