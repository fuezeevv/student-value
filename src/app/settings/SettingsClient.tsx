"use client";

import React, { useState, useTransition } from "react";
import {
  User,
  Shield,
  Calendar,
  Bell,
  Eye,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  toggleLeaderboardOptInAction,
  updateProfileSettingsAction,
  logoutUserAction,
} from "@/server/actions/user-actions";

export interface SettingsClientProps {
  user: {
    id: string;
    nickname: string;
    bio: string | null;
    avatarUrl: string | null;
    isSystemAdmin: boolean;
    isOwner: boolean;
    identities: Array<{
      provider: string;
      email: string | null;
      providerUserId: string;
    }>;
  };
  gamification: {
    totalXp: number;
    level: number;
    isLeaderboardOptIn: boolean;
  } | null;
  calendarStatus: {
    isConfigured: boolean;
    groupCalendarId: string | null;
    totalSyncedEvents: number;
  };
}

export function SettingsClient({
  user,
  gamification,
  calendarStatus,
}: SettingsClientProps) {
  const [nickname, setNickname] = useState(user.nickname);
  const [bio, setBio] = useState(user.bio || "");
  const [isLeaderboardOptIn, setIsLeaderboardOptIn] = useState(
    gamification?.isLeaderboardOptIn ?? true
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await updateProfileSettingsAction(nickname, bio);
        setStatusMessage("Настройки профиля успешно сохранены!");
      } catch (err: any) {
        setErrorMessage(err.message || "Ошибка при сохранении");
      }
    });
  };

  const handleToggleOptIn = (checked: boolean) => {
    setIsLeaderboardOptIn(checked);
    startTransition(async () => {
      try {
        await toggleLeaderboardOptInAction(checked);
        setStatusMessage(
          checked
            ? "Вы включены в публичную таблицу лидеров"
            : "Ваш профиль в рейтинге скрыт (приватный режим)"
        );
      } catch (err: any) {
        setErrorMessage(err.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Profile Settings */}
      <Card className="glass-panel border-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-400" />
          Профиль пользователя
        </h2>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-4">
            <img
              src={user.avatarUrl || "https://api.dicebear.com/7.x/bottts/svg?seed=user"}
              alt={user.nickname}
              className="w-14 h-14 rounded-full bg-slate-800 border border-cyan-500/30"
            />
            <div className="space-y-0.5">
              <span className="text-xs text-slate-400">Аватар аккаунта</span>
              <div className="text-xs text-slate-500">
                Генерируется на основе никнейма и провайдера авторизации
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Публичный никнейм
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-cyan-400"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Статус / Био
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Студент группы 5130901/40102"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-cyan-400"
              />
            </div>
          </div>

          <Button type="submit" size="sm" variant="primary" disabled={isPending} className="text-xs">
            Сохранить изменения
          </Button>
        </form>
      </Card>

      {/* 2. Privacy & Leaderboard Opt-in */}
      <Card className="glass-panel border-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          Приватность и рейтинг
        </h2>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-white">
              Отображение в таблице лидеров (Leaderboard)
            </div>
            <div className="text-[11px] text-slate-400">
              Если опция выключена, ваше имя и аватар заменяются на «Анонимный студент»
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isLeaderboardOptIn}
              onChange={(e) => handleToggleOptIn(e.target.checked)}
              disabled={isPending}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
          </label>
        </div>
      </Card>

      {/* 3. Connected Identities (Google / Telegram) */}
      <Card className="glass-panel border-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          Привязанные идентификаторы (Multi-Identity Auth)
        </h2>

        <div className="space-y-2.5 text-xs">
          {user.identities.map((id, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-white font-mono">{id.provider}</span>
                <span className="text-slate-400 block">{id.email || id.providerUserId}</span>
              </div>
              <Badge variant="success" className="text-[10px]">
                Подключен
              </Badge>
            </div>
          ))}

          <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/30 flex items-center justify-between text-slate-400">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-300">Telegram Bot Notifications</span>
              <span className="text-[11px] block">Оповещения в личные сообщения Telegram</span>
            </div>
            <Badge variant="muted" className="text-[10px]">
              Скоро
            </Badge>
          </div>
        </div>
      </Card>

      {/* 4. Google Calendar Preferences */}
      <Card className="glass-panel border-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          Синхронизация Google Календаря
        </h2>

        <div className="space-y-2 text-xs text-slate-300">
          <p>
            Интеграция автоматически передает дедлайны группы в Google Calendar.
          </p>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <span>Статус интеграции:</span>
            <Badge variant={calendarStatus.isConfigured ? "success" : "warning"}>
              {calendarStatus.isConfigured ? "Активно" : "Ожидает Google Client ID"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* 5. Session & Logout */}
      <Card className="glass-panel border-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <LogOut className="w-4 h-4 text-rose-400" />
          Сессия и выход из системы
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-white">
              Текущий вход: @{user.nickname}
            </span>
            <div className="text-[11px] text-slate-400">
              Завершить текущий сеанс и вернуться к выбору аккаунта
            </div>
          </div>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              startTransition(async () => {
                await logoutUserAction();
              });
            }}
            disabled={isPending}
            className="text-xs gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти из аккаунта</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
