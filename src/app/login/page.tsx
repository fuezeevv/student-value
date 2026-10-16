import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { switchDevUserAction } from "@/server/actions/task-actions";
import { BrandMark } from "@/components/ui/Logo";

export default async function LoginPage() {
  const user = await getCurrentUser();
  const dev = isDevAuthEnabled();
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
      ) : (
        <section className="mt-10 border-t border-slate-600 pt-7">
          <h2 className="text-lg mb-3">Вход ещё не подключён</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Сервис пока готовится к запуску. Авторизация Google OAuth ещё не
            реализована.
          </p>
        </section>
      )}
    </div>
  );
}
