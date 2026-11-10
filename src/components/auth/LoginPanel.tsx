import {
  ArrowRight,
  Lock,
  Sparkles,
  Clock,
  ShieldCheck,
  Download,
} from "lucide-react";
import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import { prisma } from "@/lib/db/prisma";
import { switchDevUserAction } from "@/server/actions/task-actions";
import { BrandMark } from "@/components/ui/Logo";
import { googleConfiguration } from "@/lib/auth/google";
import { LegalLinks } from "@/components/layout/LegalLinks";

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
    <div className="relative max-w-xl mx-auto py-8 sm:py-14 px-2 sm:px-0">
      <div className="relative rounded-3xl border border-[rgba(11,26,45,0.12)] bg-white/85 backdrop-blur-xl p-7 sm:p-10 shadow-[0_12px_40px_rgba(11,26,45,0.06)]">
        {/* Academic cohort badge */}
        <div className="flex items-center justify-between gap-3 mb-7 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(150,38,64,0.08)] border border-[rgba(150,38,64,0.2)] text-[#962640] text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#962640]" />
            СПбПУ · учебные группы
          </div>
          <span className="text-xs text-[#577291] font-mono font-bold tracking-wider">
            v1.984
          </span>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="p-2.5 rounded-2xl bg-white border border-[rgba(11,26,45,0.1)] shadow-xs">
            <BrandMark className="w-11 h-11" />
          </div>
          <div>
            <p className="eyebrow !tracking-[2px]">Student Value</p>
            <span className="text-xs text-[#577291]">
              академическое пространство
            </span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1a2d]">
          Учёба становится яснее.
        </h1>
        <p className="text-sm sm:text-base text-[#3a4e66] leading-relaxed mt-3 mb-6">
          Что сделать сейчас, что скоро сдавать и всё нужное по предмету — в
          одном выверенном месте.
        </p>

        {dev ? (
          <section className="border-t border-[rgba(11,26,45,0.1)] pt-6">
            <h2 className="text-base font-bold text-[#0b1a2d] mb-2">
              Локальный вход (режим разработки)
            </h2>
            <p className="text-xs text-[#577291] leading-relaxed mb-4">
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
                      className="w-full min-h-14 flex justify-between items-center gap-4 bg-white/80 hover:bg-white border border-[rgba(11,26,45,0.1)] hover:border-[#962640] rounded-2xl px-5 py-3 text-left transition-all active:scale-[0.98] shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                            isOwner
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-blue-100 text-blue-800 border border-blue-300"
                          }`}
                        >
                          {isOwner ? "👑" : "🎓"}
                        </span>
                        <div>
                          <span className="text-sm font-bold text-[#0b1a2d] block">
                            {isOwner ? "Староста" : "Студент"}
                          </span>
                          <span className="text-xs text-[#577291]">
                            {account.nickname}
                          </span>
                        </div>
                      </div>
                      <ArrowRight size={17} className="text-[#577291]" />
                    </button>
                  </form>
                );
              })}
            </div>
            {!accounts.length && (
              <p className="text-[#577291] text-xs mt-3">
                Локальные аккаунты не настроены.
              </p>
            )}
          </section>
        ) : google ? (
          <section className="border-t border-[rgba(11,26,45,0.1)] pt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-[#0b1a2d]">
                Войти в свою группу
              </h2>
              <span className="text-xs text-[#577291] font-mono">
                Google Cloud Identity
              </span>
            </div>
            <p className="text-xs text-[#3a4e66] leading-relaxed mb-5">
              Вход привязан к вашему аккаунту Google. Для первого подключения
              требуется код-приглашение от старосты.
            </p>

            {error && (
              <div
                role="alert"
                className="text-xs text-[#962640] bg-[rgba(150,38,64,0.08)] border border-[rgba(150,38,64,0.2)] rounded-xl p-3.5 mb-5 leading-relaxed font-medium"
              >
                Вход не завершён. Проверьте выбранный аккаунт Google и
                персональный код. Если код уже был активирован ранее, оставьте
                поле пустым.
              </div>
            )}

            <form action="/api/auth/google" method="post" className="space-y-4">
              <details className="group rounded-2xl border border-[rgba(11,26,45,0.1)] bg-white/70 p-4 text-xs transition-colors hover:border-[#962640]">
                <summary className="cursor-pointer font-bold text-[#0b1a2d] flex items-center justify-between list-none">
                  <span className="flex items-center gap-2">
                    <Lock size={14} className="text-[#962640]" />
                    Первый вход · код приглашения
                  </span>
                  <span className="text-[11px] text-[#962640] group-open:rotate-90 transition-transform">
                    →
                  </span>
                </summary>
                <div className="mt-3 pt-3 border-t border-[rgba(11,26,45,0.08)] space-y-2">
                  <label className="block text-[#577291] font-medium">
                    Персональный код от старосты
                    <input
                      name="invite"
                      type="password"
                      autoComplete="off"
                      maxLength={124}
                      placeholder="Вставьте приглашение..."
                      className="block w-full mt-1.5 min-h-11 px-3.5 rounded-xl border border-[rgba(11,26,45,0.15)] bg-white text-[#0b1a2d] text-sm focus:outline-none focus:border-[#962640] transition-colors font-mono"
                    />
                  </label>
                  <p className="text-[11px] text-[#577291]">
                    Код одноразовый и закрепляет ваше членство в академической
                    группе.
                  </p>
                </div>
              </details>

              <button
                type="submit"
                className="w-full min-h-14 flex items-center justify-center gap-3.5 rounded-2xl bg-[#0b1a2d] text-white font-semibold text-sm shadow-[0_4px_16px_rgba(11,26,45,0.15)] hover:bg-[#1a2d42] active:scale-[0.98] transition-all cursor-pointer"
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

            <p className="text-[11px] text-[#577291] leading-relaxed mt-4">
              Сервис запрашивает только имя и email. Google Drive не
              затрагивается. Личный Google Календарь подключается добровольно в
              настройках.
            </p>
          </section>
        ) : (
          <section className="border-t border-[rgba(11,26,45,0.1)] pt-6">
            <h2 className="text-base font-bold text-[#0b1a2d] mb-2">
              Вход готовится к запуску
            </h2>
            <p className="text-xs text-[#577291] leading-relaxed">
              Подключаем вход через Google. Личный прогресс и исходные файлы
              доступны участникам группы после подтверждения.
            </p>
          </section>
        )}

        {/* Android Native APK Download Card */}
        <div className="mt-6 p-4 rounded-2xl bg-white/70 border border-[rgba(11,26,45,0.08)] flex items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-base">
              🤖
            </span>
            <div>
              <span className="font-bold text-[#0b1a2d] block text-xs">
                Приложение для Android
              </span>
              <span className="text-[11px] text-[#577291]">
                Автономный .apk · v1.984
              </span>
            </div>
          </div>
          <a
            href="/studentvalue1984.apk"
            download
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[rgba(150,38,64,0.08)] hover:bg-[rgba(150,38,64,0.15)] border border-[rgba(150,38,64,0.2)] text-[#962640] font-bold transition-all active:scale-[0.96]"
          >
            <Download size={14} />
            <span>Скачать APK</span>
          </a>
        </div>

        <div className="mt-7 pt-5 border-t border-[rgba(11,26,45,0.1)] text-xs text-[#577291]">
          <LegalLinks />
        </div>
      </div>
    </div>
  );
}
