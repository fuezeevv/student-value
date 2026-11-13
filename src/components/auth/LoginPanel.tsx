import { ArrowRight, Lock } from "lucide-react";
import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import { prisma } from "@/lib/db/prisma";
import { switchDevUserAction } from "@/server/actions/task-actions";
import { BrandMark } from "@/components/ui/Logo";
import { googleConfiguration } from "@/lib/auth/google";
import { GuestGroupSelect } from "./GuestGroupSelect";

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
    <div className="w-full max-w-md mx-auto my-auto py-2">
      <div className="relative rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7 shadow-xs">
        {/* Academic cohort badge */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(150,38,64,0.08)] dark:bg-[rgba(217,133,159,0.12)] border border-[rgba(150,38,64,0.2)] dark:border-[rgba(217,133,159,0.3)] text-[#962640] dark:text-[#d9859f] text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#962640] dark:bg-[#d9859f]" />
            СПбПУ · учебные группы
          </div>
          <span className="text-xs text-[var(--ink-muted)] font-mono font-bold tracking-wider">
            v1.984
          </span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-[var(--surface-active)] border border-[var(--border)] shadow-xs">
            <BrandMark className="w-9 h-9" />
          </div>
          <div>
            <p className="eyebrow !tracking-[2px]">Student Value</p>
            <span className="text-xs text-[var(--ink-muted)]">
              академическое расписание и дедлайны
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
          Учёба становится яснее.
        </h1>
        <p className="text-xs text-[var(--ink-secondary)] leading-relaxed mt-1 mb-5">
          Расписание, актуальные работы и дедлайны вашей группы в одном месте.
        </p>

        {/* ==================== 1. ВХОД В ЛИЧНЫЙ АККАУНТ (ОСНОВНОЙ БЛОК) ==================== */}
        {dev ? (
          <section className="space-y-3 mb-4">
            <div className="text-xs font-bold text-[var(--ink)]">
              Локальный вход (режим разработки):
            </div>
            <div className="space-y-2">
              {accounts.map((account) => {
                const isOwner = account.id === "user-dev-owner";
                return (
                  <form
                    key={account.id}
                    action={switchDevUserAction.bind(null, account.id)}
                  >
                    <button
                      type="submit"
                      className="w-full flex justify-between items-center gap-3 bg-[var(--surface-active)] hover:border-[#962640] border border-[var(--border)] rounded-xl px-4 py-2.5 text-left transition-all active:scale-[0.98] shadow-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">
                          {isOwner ? "👑" : "🎓"}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-[var(--ink)] block">
                            {isOwner ? "Староста" : "Студент"}
                          </span>
                          <span className="text-[11px] text-[var(--ink-muted)]">
                            {account.nickname}
                          </span>
                        </div>
                      </div>
                      <ArrowRight
                        size={15}
                        className="text-[var(--ink-muted)]"
                      />
                    </button>
                  </form>
                );
              })}
            </div>
          </section>
        ) : google ? (
          <section className="space-y-3 mb-4">
            {error && (
              <div
                role="alert"
                className="text-xs text-[#962640] dark:text-[#ff99ac] bg-[rgba(150,38,64,0.08)] border border-[rgba(150,38,64,0.2)] rounded-xl p-3 leading-relaxed font-medium"
              >
                Вход не завершён. Проверьте выбранный аккаунт Google и
                код-приглашение от старосты.
              </div>
            )}

            <form action="/api/auth/google" method="post" className="space-y-3">
              <details className="group rounded-xl border border-[var(--border)] bg-[var(--surface-active)] p-3 text-xs transition-colors hover:border-[#962640]">
                <summary className="cursor-pointer font-bold text-[var(--ink)] flex items-center justify-between list-none">
                  <span className="flex items-center gap-2">
                    <Lock
                      size={13}
                      className="text-[#962640] dark:text-[#d9859f]"
                    />
                    Первый вход · ввести код старосты
                  </span>
                  <span className="text-[11px] text-[#962640] dark:text-[#d9859f] group-open:rotate-90 transition-transform">
                    →
                  </span>
                </summary>
                <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] space-y-1.5">
                  <label className="block text-[var(--ink-muted)] font-medium">
                    Код-приглашение в группу
                    <input
                      name="invite"
                      type="password"
                      autoComplete="off"
                      maxLength={124}
                      placeholder="Вставьте приглашение..."
                      className="block w-full mt-1 min-h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-xs focus:outline-none focus:border-[#962640] transition-colors font-mono"
                    />
                  </label>
                  <p className="text-[10px] text-[var(--ink-muted)]">
                    Одноразовый код привязывает аккаунт к вашей учебной группе.
                  </p>
                </div>
              </details>

              <button
                type="submit"
                className="w-full min-h-12 px-4 flex items-center justify-center gap-3 rounded-xl bg-[#0b1a2d] dark:bg-slate-800 hover:bg-[#15273e] dark:hover:bg-slate-700 text-white font-semibold text-sm shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                {/* Authentic 4-color Google G icon */}
                <svg
                  className="w-4 h-4 shrink-0"
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
                <ArrowRight size={15} className="text-slate-300 ml-auto" />
              </button>
            </form>
          </section>
        ) : (
          <section className="p-3.5 rounded-xl bg-[var(--surface-active)] border border-[var(--border)] mb-4 text-xs">
            <h2 className="font-bold text-[var(--ink)] mb-0.5">
              Вход готовится к запуску
            </h2>
            <p className="text-[var(--ink-muted)]">
              Подключаем вход через Google. Расписание доступно без авторизации
              ниже:
            </p>
          </section>
        )}

        {/* ==================== 2. ОДИН МАЛЕНЬКИЙ ПРЯМОУГОЛЬНИК: РАСПИСАНИЕ БЕЗ ВХОДА (ПОСЛЕ ВХОДА) ==================== */}
        <div className="pt-3.5 border-t border-[var(--border)]">
          <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
            <span className="text-[var(--ink-muted)] font-medium">
              Или расписание без регистрации:
            </span>
            <GuestGroupSelect />
          </div>
        </div>

        {/* ==================== 3. ЕДИНАЯ КНОПКА-СТРОКА: СКАЧАТЬ ANDROID APK (БЕЗ РОБОТА И БЕЗ ОВАЛА) ==================== */}
        <a
          href="/studentvalue1984.apk"
          download
          className="mt-3.5 flex items-center justify-between px-4 py-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--wine)] bg-[var(--surface-active)] text-xs text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-all active:scale-[0.98] group cursor-pointer shadow-xs"
        >
          <span className="font-semibold text-[var(--ink)] group-hover:text-[var(--wine)] transition-colors">
            Приложение для Android (.apk)
          </span>
          <span className="font-mono text-[11px] text-[var(--ink-muted)]">
            v1.984.1 ↓
          </span>
        </a>
      </div>
    </div>
  );
}
