import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/session";
import { Navbar } from "@/components/layout/Navbar";
import { prisma } from "@/lib/db/prisma";
import { LegalLinks } from "@/components/layout/LegalLinks";

export const metadata: Metadata = {
  title: "Student Value 1.984",
  description:
    "Работы, сроки и материалы вашей группы — всё для ежедневной учёбы.",
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

  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar
          user={user}
          unreadCount={unreadCount}
          devAuthEnabled={isDevAuthEnabled()}
        />
        <main id="main" className="app-main">
          {children}
        </main>
        <footer className="site-footer flex-wrap gap-x-6 gap-y-4">
          <span>
            Student Value <span className="text-blue-300">1.984</span>
          </span>
          <span>Учёба в своём ритме.</span>
          <LegalLinks />
        </footer>
      </body>
    </html>
  );
}
