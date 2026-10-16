"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateProfileSettingsAction,
  toggleLeaderboardOptInAction,
  logoutUserAction,
} from "@/server/actions/user-actions";

export function SettingsClient({
  nickname: initialNickname,
  bio: initialBio,
  leaderboardOptIn,
}: {
  nickname: string;
  bio: string | null;
  leaderboardOptIn: boolean;
}) {
  const [nickname, setNickname] = useState(initialNickname);
  const [bio, setBio] = useState(initialBio ?? "");
  const [optIn, setOptIn] = useState(leaderboardOptIn);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const attempt = (action: () => Promise<unknown>, success: string) =>
    startTransition(async () => {
      setError("");
      setMessage("");
      try {
        await action();
        setMessage(success);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Не удалось сохранить изменения",
        );
      }
    });
  const inputClass =
    "block w-full min-h-12 mt-2 bg-[#142139] border border-slate-600 rounded-xl px-4 text-base text-white";
  return (
    <div className="space-y-9">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          attempt(
            () => updateProfileSettingsAction(nickname, bio),
            "Профиль сохранён",
          );
        }}
        className="space-y-5 border-t border-slate-700 pt-7"
      >
        <label className="block text-sm text-slate-300">
          Публичный никнейм
          <input
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-slate-300">
          О себе
          <input
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Пара слов для группы"
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="action-primary disabled:opacity-50"
        >
          {pending ? "Сохраняю…" : "Сохранить профиль"}
        </button>
      </form>
      <section className="border-t border-slate-700 pt-7">
        <h2 className="text-lg mb-4">Приватность</h2>
        <label className="flex items-start gap-4 text-sm leading-relaxed cursor-pointer">
          <input
            type="checkbox"
            checked={optIn}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked;
              attempt(
                async () => {
                  await toggleLeaderboardOptInAction(next);
                  setOptIn(next);
                },
                next
                  ? "Вы участвуете в рейтинге"
                  : "Ваш профиль скрыт из рейтинга",
              );
            }}
            className="mt-1 w-5 h-5 accent-blue-500 shrink-0"
          />
          <span>
            Показывать меня в рейтинге группы
            <span className="block text-slate-400 text-xs mt-1">
              Если выключить, ваш профиль не попадёт в общую таблицу.
            </span>
          </span>
        </label>
        <Link className="text-link mt-3" href="/leaderboard">
          Посмотреть рейтинг ↗
        </Link>
      </section>
      {message && (
        <p role="status" className="text-blue-200 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-rose-300 text-sm">
          {error}
        </p>
      )}
      <section className="border-t border-slate-700 pt-7 flex justify-between gap-4 items-center">
        <p className="text-sm text-slate-400">
          Текущий вход: {initialNickname}
        </p>
        <button
          disabled={pending}
          className="text-rose-300 text-sm min-h-11 px-4 border border-slate-600 rounded-xl"
          onClick={() =>
            startTransition(async () => {
              await logoutUserAction();
            })
          }
        >
          Выйти
        </button>
      </section>
    </div>
  );
}
