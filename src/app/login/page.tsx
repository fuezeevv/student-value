import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { switchDevUserAction } from "@/server/actions/task-actions";
import { BrandMark } from "@/components/ui/Logo";
import { googleConfiguration } from "@/lib/auth/google";

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
    <div className="max-w-xl mx-auto py-8 sm:py-14">
      <BrandMark className="w-14 h-14 mb-8" />
      <p className="eyebrow">Student Value 1.984</p>
      <h1 className="page-title">Учёба становится яснее.</h1>
      <p className="page-intro !text-base mt-5">
        Что сделать сейчас, что скоро сдавать и всё нужное по предмету — в одном
        месте.
      </p>
      {dev ? (
        <section className="mt-10 border-t border-slate-600 pt-7">
          <h2 className="text-lg mb-2">Локальный вход</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-5">
            Доступен только в режиме разработки. Внешний вход ещё не подключён.
          </p>
          <div className="space-y-3">
            {accounts.map((account) => (
              <form
                key={account.id}
                action={switchDevUserAction.bind(null, account.id)}
              >
                <button
                  type="submit"
                  className="w-full min-h-16 flex justify-between items-center gap-4 bg-[#142139] border border-slate-600 rounded-xl px-5 py-4 hover:border-blue-400 text-left"
                >
                  <span className="text-sm">
                    {account.id === "user-dev-owner" ? "Староста" : "Студент"}
                    <span className="block text-xs text-slate-400 mt-1">
                      {account.nickname}
                    </span>
                  </span>
                  <ArrowRight size={17} />
                </button>
              </form>
            ))}
          </div>
          {!accounts.length && (
            <p className="text-slate-400 text-sm">
              Локальные аккаунты не настроены.
            </p>
          )}
        </section>
      ) : google ? (
        <section className="mt-10 border-t border-slate-600 pt-7">
          <h2 className="text-lg mb-3">Войти в свою группу</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-5">
            Google подтверждает твой аккаунт. Для первого входа нужен
            персональный код от старосты.
          </p>
          {error && (
            <p role="alert" className="text-sm text-rose-300 mb-5">
              Вход не завершён. Проверь аккаунт Google и персональный код. Если
              код уже использован, оставь поле пустым.
            </p>
          )}
          <form action="/api/auth/google" method="post" className="space-y-5">
            <details className="text-sm text-slate-300">
              <summary className="cursor-pointer min-h-11 flex items-center">
                Первый вход · персональный код
              </summary>
              <label className="block mt-3">
                Код от старосты
                <input
                  name="invite"
                  type="password"
                  autoComplete="off"
                  maxLength={124}
                  className="block w-full mt-2 min-h-12 px-4 rounded-lg border border-slate-600 bg-[#142139] text-white"
                />
              </label>
              <p className="text-xs text-slate-400 mt-2">
                Код связан с конкретным студентом и его Google email.
              </p>
            </details>
            <button
              type="submit"
              className="w-full min-h-14 flex items-center justify-between rounded-xl px-5 py-4 bg-white text-slate-950 font-medium hover:bg-blue-50"
            >
              <span>Войти через Google</span>
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="text-xs text-slate-400 leading-relaxed mt-5">
            Нужны только имя и email. Доступ к Google Drive и Календарю не
            запрашивается.{" "}
            <a href="/privacy" className="underline">
              О данных и доступе
            </a>
          </p>
        </section>
      ) : (
        <section className="mt-10 border-t border-slate-600 pt-7">
          <h2 className="text-lg mb-3">Вход готовится к запуску</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Подключаем вход через Google. Учебные данные доступны только
            участникам группы после персонального подтверждения.
          </p>
        </section>
      )}
    </div>
  );
}
