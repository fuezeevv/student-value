import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/session";
import { Navbar } from "@/components/layout/Navbar";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "Student Value 1.984 • СПбПУ 5130901/40102",
  description:
    "Академическая организация и управление учебным процессом студенческой группы 5130901/40102 СПбПУ, осенний семестр 2026.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const unreadCount = user
    ? await prisma.notification.count({
        where: { userId: user.id, isRead: false },
      })
    : 0;

  return (
    <html lang="ru" className="dark">
      <body className="bg-[#070a13] text-slate-100 min-h-screen flex flex-col antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        <Navbar user={user} unreadCount={unreadCount} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
          {children}
        </main>
        <footer className="border-t border-slate-900/80 py-5 text-center text-xs text-slate-500 bg-[#050811]">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-400">Student Value 1.984</span>
              <span>·</span>
              <span>СПбПУ · ИКНК · 5130901/40102 · 5 семестр</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Староста группы: Батукаев Р. Р. · studentvalue1984.com
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
