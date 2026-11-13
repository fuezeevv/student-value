import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/session";
import { Navbar } from "@/components/layout/Navbar";
import { prisma } from "@/lib/db/prisma";
import { loadStudyWorkspace } from "@/server/queries/study-workspace";
import { LegalLinks } from "@/components/layout/LegalLinks";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
  width: "device-width",
  initialScale: 1,

  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Student Value 1.984",
  description:
    "Работы, сроки и материалы вашей группы — всё для ежедневной учёбы.",
  applicationName: "Student Value 1.984",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Student Value 1.984",
  },
  metadataBase: new URL(
    process.env.APP_ORIGIN || "https://studentvalue1984.eu.cc",
  ),
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Student Value 1.984",
    description:
      "Работы, сроки и материалы вашей группы — всё для ежедневной учёбы.",
    url: "https://studentvalue1984.eu.cc",
    siteName: "Student Value 1.984",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Student Value 1.984 — академическая платформа",
      },
    ],
    locale: "ru_RU",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const unreadCount = user
    ? await prisma.notification.count({
        where: {
          userId: user.id,
          isRead: false,
          OR: [{ groupId: user.groupId }, { groupId: null }],
        },
      })
    : 0;

  const workspace = user?.groupId ? await loadStudyWorkspace(user) : null;
  const dailyTasks =
    workspace?.tasks
      .filter((t) => !t.completed)
      .map((t) => ({
        id: t.id,
        title: t.title,
        course: t.courseShortTitle || t.courseTitle,
        type: t.type,
        deadline: t.deadline?.date.toISOString() ?? null,
      })) ?? [];
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar
          user={user}
          dailyTasks={dailyTasks}
          unreadCount={unreadCount}
          devAuthEnabled={isDevAuthEnabled()}
        />
        <main id="main" className="app-main">
          {children}
        </main>
        <footer className="site-footer flex-wrap gap-x-6 gap-y-4">
          <span>
            Student Value{" "}
            <span className="font-bold text-[var(--wine)]">1.984</span>
          </span>
          <span>Учёба в своём ритме.</span>
          <a
            href="https://t.me/studentvalue"
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            Новости и вопросы · Telegram ↗
          </a>
          <LegalLinks />
        </footer>
      </body>
    </html>
  );
}
