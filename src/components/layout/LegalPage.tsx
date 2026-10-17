import Link from "next/link";
import type { ReactNode } from "react";
import { LegalLinks } from "./LegalLinks";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="max-w-3xl mx-auto py-4 sm:py-8">
      <Link
        href="/"
        className="text-link mb-8 inline-flex min-h-11 items-center"
      >
        ← Student Value 1.984
      </Link>
      <header className="border-b border-slate-700 pb-8 mb-8">
        <p className="eyebrow">О сервисе</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-intro mt-4">{intro}</p>
        <p className="text-xs text-slate-400 mt-5">
          Обновлено <time dateTime="2026-10-18">18 октября 2026</time>
        </p>
      </header>
      <div className="space-y-9 text-sm sm:text-base leading-relaxed text-slate-300 [&_h2]:text-lg [&_h2]:sm:text-xl [&_h2]:font-semibold [&_h2]:text-slate-100 [&_h2]:mb-3 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-2 [&_a]:text-blue-300 [&_a]:underline [&_a]:underline-offset-4 [&_code]:break-all [&_code]:text-sm">
        {children}
      </div>
      <div className="border-t border-slate-700 pt-7 mt-10 text-sm text-slate-400">
        <LegalLinks />
      </div>
    </article>
  );
}
