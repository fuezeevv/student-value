import Link from "next/link";
import { googleConfiguration } from "@/lib/auth/google";
export default function JoinPage() {
  const ready = googleConfiguration();
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <p className="eyebrow">Student Value 1.984</p>
      <h1 className="page-title">Присоединиться к группе</h1>
      <p className="page-intro">
        Получите персональный код у старосты. Войдите в тот Google аккаунт, для
        которого выдан код: он связан с конкретной записью в списке группы.
      </p>
      {ready ? (
        <form action="/api/auth/google" method="post" className="space-y-5">
          <label className="block text-sm">
            Персональный код
            <input
              name="invite"
              type="password"
              required
              autoComplete="off"
              maxLength={124}
              className="block w-full mt-2 min-h-14 px-4 rounded-xl border border-[rgba(11,26,45,0.15)] bg-white text-[#0b1a2d] focus:outline-none focus:border-[#962640]"
            />
          </label>
          <button className="action-primary">Подтвердить через Google</button>
        </form>
      ) : (
        <p className="quiet-empty">Внешний вход пока не настроен.</p>
      )}
      <p className="text-sm text-slate-400">
        Если вы уже пользуетесь Student Value, сохранится ваш профиль. Новая
        группа появится в меню; доступ к прежним группам и прогресс не
        сбросятся.
      </p>
      <Link href="/login" className="text-link">
        Обычный вход ↗
      </Link>
    </div>
  );
}
