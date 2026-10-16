import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Shield, Sparkles, AlertCircle, ArrowRight, User } from "lucide-react";
import { switchDevUserAction } from "@/server/actions/task-actions";

export default async function LoginPage() {
  const user = await getCurrentUser();
  const isDevAuth =
    process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_AUTH === "true";

  // If already logged in and not in dev/demo mode, redirect to dashboard
  if (user && !isDevAuth) {
    redirect("/");
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-10 px-4">
      <Card className="glass-panel border-cyan-500/30 max-w-md w-full p-6 sm:p-8 space-y-6 shadow-[0_0_35px_rgba(0,229,255,0.08)]">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-rose-600/20 border border-cyan-500/40 font-mono font-black text-cyan-300 text-lg mb-1">
            1.984
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Student Value <span className="text-cyan-400 font-mono">1.984</span>
          </h1>
          <p className="text-xs text-slate-400">
            Академическая система группы 5130901/40102 · СПбПУ
          </p>
        </div>

        {/* Primary OAuth Method */}
        <div className="space-y-3 pt-2">
          <Button
            size="lg"
            variant="outline"
            disabled
            className="w-full flex items-center justify-center gap-3 bg-slate-800 text-slate-400 font-semibold text-xs h-11 border-slate-700 opacity-60 cursor-not-allowed shadow-none"
          >
            <svg className="w-4 h-4 opacity-50" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Вход через Google (в разработке)</span>
          </Button>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Google OAuth ожидает регистрации Client ID. Для входа в Beta используйте быстрый вход ниже.
          </p>
        </div>

        {/* Development Switcher (Strictly dev/beta demo mode) */}
        {isDevAuth && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-xs uppercase font-bold tracking-wider text-cyan-400">
                Режим демонстрации / разработки: Быстрый тестовый вход
              </span>
            </div>

            <div className="space-y-2">
              <form action={switchDevUserAction.bind(null, "user-dev-owner")}>
                <button
                  type="submit"
                  className="w-full p-3 rounded-xl border border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-950/40 text-left transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-white block">
                      Батукаев Расул (Староста / Owner)
                    </span>
                    <span className="text-[11px] text-cyan-300">
                      Полный административный доступ, verify_progress, управление
                    </span>
                  </div>
                  <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                </button>
              </form>

              <form action={switchDevUserAction.bind(null, "user-dev-student")}>
                <button
                  type="submit"
                  className="w-full p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-left transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-slate-200 block">
                      Студент [Тестовый аккаунт]
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Стандартный интерфейс студента без прав старосты
                    </span>
                  </div>
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="pt-2 text-center">
          <Link href="/" className="text-xs text-slate-400 hover:text-cyan-300 transition-colors">
            ← Вернуться на главную
          </Link>
        </div>
      </Card>
    </div>
  );
}
