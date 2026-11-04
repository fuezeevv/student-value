import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Lock,
  Sparkles,
  Clock,
  ShieldCheck,
  Download,
} from "lucide-react";
import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { switchDevUserAction } from "@/server/actions/task-actions";
import { BrandMark } from "@/components/ui/Logo";
import { googleConfiguration } from "@/lib/auth/google";
import { LegalLinks } from "@/components/layout/LegalLinks";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  const dev = isDevAuthEnabled();
  const google = dev ? null : googleConfiguration();
  if (user && !dev) redirect("/");
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
    <div className="relative max-w-xl mx-auto py-8 sm:py-14 px-2 sm:px-0">
      {/* Ambient background glows (Gemini / Incy VPN style) */}
      <div
        className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-500/15 rounded-full blur-[100px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-48 -right-16 w-64 h-64 bg-rose-500/10 rounded-full blur-[90px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative rounded-3xl border border-white/[0.12] bg-[#101b2e]/85 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_24px_70px_rgba(0,0,0,0.55),_inset_0_1px_0_rgba(255,255,255,0.12)]">
        {/* Academic cohort badge */}
        <div className="flex items-center justify-between gap-3 mb-7 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/25 text-blue-300 text-xs font-medium tracking-wide">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            СПбПУ · учебные группы
          </div>
          <span className="text-xs text-slate-400 font-mono tracking-wider">
            v1.984
          </span>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-inner">
            <BrandMark className="w-11 h-11" />
          </div>
          <div>
            <p className="eyebrow !tracking-[2px]">Student Value</p>
            <span className="text-xs text-slate-400">
              академическое пространство
            </span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Учёба становится яснее.
        </h1>
        <p className="text-sm sm:text-base text-slate-300/85 leading-relaxed mt-3">
          Что сделать сейчас, что скоро сдавать и всё нужное по предмету — в
          одном выверенном месте.
        </p>

        {/* Feature telemetry chips (Yandex Weather & GitHub style) */}
        <div className="grid grid-cols-3 gap-2.5 my-7 text-xs">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center">
            <Clock className="w-4 h-4 mx-auto mb-1.5 text-blue-400" />
            <span className="text-slate-300 font-medium block">Дедлайны</span>
            <span className="text-[11px] text-slate-400">по МСК</span>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center">
            <Sparkles className="w-4 h-4 mx-auto mb-1.5 text-amber-300" />
            <span className="text-slate-300 font-medium block">Фокус дня</span>
            <span className="text-[11px] text-slate-400">без хаоса</span>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center">
            <ShieldCheck className="w-4 h-4 mx-auto mb-1.5 text-emerald-400" />
            <span className="text-slate-300 font-medium block">Защита</span>
            <span className="text-[11px] text-slate-400">OAuth / PKCE</span>
          </div>
        </div>

        <section className="login-preview-entry">
          <h2>Можно просто посмотреть</h2>
          <p>
            Выберите группу и откройте общие работы, сроки и расписание без
            входа.
          </p>
          <Link className="action-primary" href="/browse">
            Посмотреть без регистрации <ArrowRight size={17} />
          </Link>
        </section>
        {dev ? (
          <section className="border-t border-white/10 pt-6">
            <h2 className="text-base font-medium text-slate-200 mb-2">
              Локальный вход (режим разработки)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
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
                      className="w-full min-h-14 flex justify-between items-center gap-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-blue-400/40 rounded-2xl px-5 py-3 text-left transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                            isOwner
                              ? "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                              : "bg-blue-400/15 text-blue-300 border border-blue-400/30"
                          }`}
                        >
                          {isOwner ? "👑" : "🎓"}
                        </span>
                        <div>
                          <span className="text-sm font-medium text-slate-100 block">
                            {isOwner ? "Староста" : "Студент"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {account.nickname}
                          </span>
                        </div>
                      </div>
                      <ArrowRight size={17} className="text-slate-400" />
                    </button>
                  </form>
                );
              })}
            </div>
            {!accounts.length && (
              <p className="text-slate-400 text-xs mt-3">
                Локальные аккаунты не настроены.
              </p>
            )}
          </section>
        ) : google ? (
          <section className="border-t border-white/10 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-medium text-slate-200">
                Войти в свою группу
              </h2>
              <span className="text-xs text-slate-400">
                Google Cloud Identity
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              Вход привязан к вашему аккаунту Google. Для первого подключения
              требуется код-приглашение от старосты.
            </p>

            {error && (
              <div
                role="alert"
                className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 mb-5 leading-relaxed"
              >
                Вход не завершён. Проверьте выбранный аккаунт Google и
                персональный код. Если код уже был активирован ранее, оставьте
                поле пустым.
              </div>
            )}

            <form action="/api/auth/google" method="post" className="space-y-4">
              <details className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs transition-colors hover:border-white/15">
                <summary className="cursor-pointer font-medium text-slate-300 flex items-center justify-between list-none">
                  <span className="flex items-center gap-2">
                    <Lock size={14} className="text-blue-400" />
                    Первый вход · код приглашения
                  </span>
                  <span className="text-[11px] text-blue-400 group-open:rotate-90 transition-transform">
                    →
                  </span>
                </summary>
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                  <label className="block text-slate-400">
                    Персональный код от старосты
                    <input
                      name="invite"
                      type="password"
                      autoComplete="off"
                      maxLength={124}
                      placeholder="Вставьте приглашение..."
                      className="block w-full mt-1.5 min-h-11 px-3.5 rounded-xl border border-white/15 bg-[#0b1324] text-white text-sm focus:outline-none focus:border-blue-400 transition-colors font-mono"
                    />
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Код одноразовый и закрепляет ваше членство в академической
                    группе.
                  </p>
                </div>
              </details>

              <button
                type="submit"
                className="w-full min-h-14 flex items-center justify-center gap-3.5 rounded-2xl bg-white text-slate-900 font-semibold text-sm shadow-[0_4px_24px_rgba(255,255,255,0.16)] hover:bg-slate-100 hover:shadow-[0_6px_30px_rgba(255,255,255,0.26)] active:scale-[0.98] transition-all cursor-pointer"
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
                <ArrowRight size={17} className="text-slate-500 ml-auto" />
              </button>
            </form>

            <p className="text-[11px] text-slate-400/90 leading-relaxed mt-4">
              Сервис запрашивает только имя и email. Google Drive не
              затрагивается. Личный Google Календарь подключается добровольно в
              настройках.
            </p>
          </section>
        ) : (
          <section className="border-t border-white/10 pt-6">
            <h2 className="text-base font-medium text-slate-200 mb-2">
              Вход готовится к запуску
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Подключаем вход через Google. Личный прогресс и исходные файлы
              доступны участникам группы после подтверждения.
            </p>
          </section>
        )}

        {/* Android Native APK Download Card */}
        <div className="mt-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-base">
              🤖
            </span>
            <div>
              <span className="font-medium text-slate-100 block text-xs">
                Приложение для Android
              </span>
              <span className="text-[11px] text-slate-400">
                Автономный .apk · v1.984
              </span>
            </div>
          </div>
          <a
            href="/studentvalue1984.apk"
            download
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/30 text-blue-300 font-medium transition-all active:scale-[0.96]"
          >
            <Download size={14} />
            <span>Скачать APK</span>
          </a>
        </div>

        <div className="mt-7 pt-5 border-t border-white/[0.08] text-xs text-slate-400">
          <LegalLinks />
        </div>
      </div>
    </div>
  );
}
