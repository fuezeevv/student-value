import Link from "next/link";
import {
  ArrowRight,
  Lock,
  Download,
} from "lucide-react";
import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import { prisma } from "@/lib/db/prisma";
import { switchDevUserAction } from "@/server/actions/task-actions";
import { BrandMark } from "@/components/ui/Logo";
import { googleConfiguration } from "@/lib/auth/google";
import { LegalLinks } from "@/components/layout/LegalLinks";
import { publicGroups } from "@/lib/groups/public-groups";

export async function LoginPanel({ error }: { error?: string }) {
  const dev = isDevAuthEnabled();
  let google = null;
  if (!dev) {
    try {
      google = googleConfiguration();
    } catch {
      google = null;
    }
  }
  const accounts = dev
    ? await prisma.user.findMany({
        where: {
          id: { in: ["user-dev-owner", "user-dev-student"] },
          identities: { some: { provider: "LOCAL_DEV" } },
        },
        select: { id: true, nickname: true },
      })
    : [];

  return (
    <div className="relative max-w-xl mx-auto py-6 sm:py-12 px-2 sm:px-0">
      <div className="relative rounded-3xl border border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl p-6 sm:p-9 shadow-sm">
        {/* Academic cohort badge */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(150,38,64,0.08)] dark:bg-[rgba(255,77,109,0.12)] border border-[rgba(150,38,64,0.2)] dark:border-[rgba(255,77,109,0.3)] text-[#962640] dark:text-[#ff4d6d] text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#962640] dark:bg-[#ff4d6d]" />
            СПбПУ · учебные группы
          </div>
          <span className="text-xs text-[var(--ink-muted)] font-mono font-bold tracking-wider">
            v1.984
          </span>
        </div>

        <div className="flex items-center gap-3.5 mb-5">
          <div className="p-2.5 rounded-2xl bg-[var(--surface-active)] border border-[var(--border)] shadow-xs">
            <BrandMark className="w-10 h-10" />
          </div>
          <div>
            <p className="eyebrow !tracking-[2px]">Student Value</p>
            <span className="text-xs text-[var(--ink-muted)]">
              академическое расписание и дедлайны
            </span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
          Учёба становится яснее.
        </h1>
        <p className="text-sm text-[var(--ink-secondary)] leading-relaxed mt-2 mb-6">
          Что сделать сейчас, что скоро сдавать и всё нужное по предмету — в одном выверенном месте.
        </p>

        {/* ==================== 1. БЫСТРЫЙ ВЫБОР ГРУППЫ БЕЗ ВХОДА (СВЕРХУ) ==================== */}
        <div className="mb-7 p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-xs font-mono font-bold text-[#962640] dark:text-[#ff4d6d] uppercase tracking-wider flex items-center gap-1.5">
              <span>⚡ Расписание сразу без регистрации</span>
            </span>
            <span className="text-[11px] font-mono text-[var(--ink-muted)]">
              8 официальных групп
            </span>
          </div>
          <p className="text-xs text-[var(--ink-secondary)] leading-relaxed mb-3.5">
            Нажмите на свою группу — расписание и пары откроются сразу:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {publicGroups.map((g) => (
              <Link
                key={g.code}
                href={`/browse/${g.code.replace("/", "-")}`}
                className="px-3 py-2.5 rounded-xl bg-[var(--surface-active)] hover:bg-[#962640] hover:text-white dark:hover:bg-[#ff4d6d] border border-[var(--border)] text-center transition-all active:scale-[0.97] group shadow-xs"
              >
                <span className="block font-bold text-xs text-[var(--ink)] group-hover:text-white transition-colors">
                  {g.track} {g.label}
                </span>
                <span className="block text-[10px] font-mono text-[var(--ink-muted)] group-hover:text-white/80 transition-colors">
                  {g.code.split("/")[1]}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* ==================== 2. ВХОД В ЛИЧНЫЙ АККАУНТ ==================== */}
        {dev ? (
          <section className="border-t border-[var(--border)] pt-5">
            <h2 className="text-base font-bold text-[var(--ink)] mb-1">
              Локальный вход (режим разработки)
            </h2>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed mb-4">
              Выберите тестовую роль для проверки сценариев платформы:
            </p>
            <div className="space-y-2.5">
              {accounts.map((account) => {
                const isOwner = account.id === "user-dev-owner";
                return (
                  <form
                    key={account.id}
                    action={switchDevUserAction.bind(null, account.id)}
                  >
                    <button
                      type="submit"
                      className="w-full min-h-13 flex justify-between items-center gap-4 bg-[var(--surface-active)] hover:border-[#962640] border border-[var(--border)] rounded-xl px-4 py-3 text-left transition-all active:scale-[0.98] shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isOwner
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-blue-100 text-blue-800 border border-blue-300"
                          }`}
                        >
                          {isOwner ? "👑" : "🎓"}
                        </span>
                        <div>
                          <span className="text-sm font-bold text-[var(--ink)] block">
                            {isOwner ? "Староста" : "Студент"}
                          </span>
                          <span className="text-xs text-[var(--ink-muted)]">
                            {account.nickname}
                          </span>
                        </div>
                      </div>
                      <ArrowRight size={17} className="text-[var(--ink-muted)]" />
                    </button>
                  </form>
                );
              })}
            </div>
          </section>
        ) : google ? (
          <section className="border-t border-[var(--border)] pt-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-[var(--ink)]">
                Войти в личный кабинет
              </h2>
              <span className="text-xs text-[#577291] font-mono">
                Синхронизация прогресса
              </span>
            </div>
            <p className="text-xs text-[var(--ink-secondary)] leading-relaxed mb-4">
              Сохраняет выполненные работы, личные варианты, опыт и календарь.
            </p>

            {error && (
              <div
                role="alert"
                className="text-xs text-[#962640] dark:text-[#ff99ac] bg-[rgba(150,38,64,0.08)] border border-[rgba(150,38,64,0.2)] rounded-xl p-3.5 mb-4 leading-relaxed font-medium"
              >
                Вход не завершён. Проверьте выбранный аккаунт Google и
                код-приглашение от старосты.
              </div>
            )}

            <form action="/api/auth/google" method="post" className="space-y-3.5">
              <details className="group rounded-xl border border-[var(--border)] bg-[var(--surface-active)] p-3.5 text-xs transition-colors hover:border-[#962640]">
                <summary className="cursor-pointer font-bold text-[var(--ink)] flex items-center justify-between list-none">
                  <span className="flex items-center gap-2">
                    <Lock size={14} className="text-[#962640] dark:text-[#ff4d6d]" />
                    Первый вход · ввести код старосты
                  </span>
                  <span className="text-[11px] text-[#962640] dark:text-[#ff4d6d] group-open:rotate-90 transition-transform">
                    →
                  </span>
                </summary>
                <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
                  <label className="block text-[var(--ink-muted)] font-medium">
                    Код-приглашение в группу
                    <input
                      name="invite"
                      type="password"
                      autoComplete="off"
                      maxLength={124}
                      placeholder="Вставьте приглашение..."
                      className="block w-full mt-1 min-h-10 px-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-sm focus:outline-none focus:border-[#962640] transition-colors font-mono"
                    />
                  </label>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    Код одноразовый и привязывает аккаунт к вашей учебной группе.
                  </p>
                </div>
              </details>

              <button
                type="submit"
                className="w-full min-h-13 flex items-center justify-center gap-3 rounded-xl bg-[#0b1a2d] hover:bg-[#15273e] text-white font-semibold text-sm shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                {/* Authentic 4-color Google G icon */}
                <svg
                  className="w-5 h-5 shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Войти через Google</span>
                <ArrowRight size={17} className="text-slate-300 ml-auto" />
              </button>
            </form>
          </section>
        ) : (
          <section className="border-t border-[var(--border)] pt-5">
            <h2 className="text-base font-bold text-[var(--ink)] mb-1">
              Вход готовится к запуску
            </h2>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Подключаем вход через Google. Личный прогресс и файлы доступны
              участникам после авторизации.
            </p>
          </section>
        )}

        {/* ==================== 3. СКАЧАТЬ АНДРОИД APK (ЕДИНАЯ КНОПКА-ПЛАШКА) ==================== */}
        <a
          href="/studentvalue1984.apk"
          download
          className="mt-6 p-4 rounded-2xl bg-[var(--surface-active)] hover:border-[#962640] dark:hover:border-[#ff4d6d] border border-[var(--border)] flex items-center justify-between gap-3 text-xs shadow-xs transition-all active:scale-[0.98] group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-lg shrink-0">
              🤖
            </span>
            <div>
              <span className="font-bold text-[var(--ink)] block text-sm group-hover:text-[#962640] dark:group-hover:text-[#ff4d6d] transition-colors">
                Приложение для Android (.apk)
              </span>
              <span className="text-[11px] text-[var(--ink-muted)]">
                Установить на телефон · автономная работа · v1.984
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(150,38,64,0.08)] group-hover:bg-[#962640] group-hover:text-white text-[#962640] dark:text-[#ff4d6d] font-bold text-xs transition-colors shrink-0">
            <Download size={14} />
            <span>Скачать</span>
          </div>
        </a>

        {/* Единый футер с юридическими условиями (без повторов) */}
        <div className="mt-7 pt-4 border-t border-[var(--border)] text-xs text-[var(--ink-muted)]">
          <LegalLinks />
        </div>
      </div>
    </div>
  );
}
