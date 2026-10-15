import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/session";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "СПбПУ 40102 • Учебная платформа",
  description: "Организация учебного процесса студенческой группы 5130901/40102 СПбПУ, осенний семестр 2026",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="ru" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased">
        <Navbar user={user} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500">
          Учебная платформа группы СПбПУ 5130901/40102 • 5 семестр, Осень 2026 • Facts != Product Assumptions
        </footer>
      </body>
    </html>
  );
}
