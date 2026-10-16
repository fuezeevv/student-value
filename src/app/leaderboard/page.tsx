import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Trophy,
  Flame,
  Award,
  Sparkles,
  Shield,
  Clock,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";

export default async function LeaderboardPage() {
  const user = await requireCurrentUser();

  // Load all gamification profiles sorted by totalXp descending
  const profiles = await prisma.userGamificationProfile.findMany({
    where: { user: { memberships: { some: { groupId: user.groupId } } }, OR: [{ isLeaderboardOptIn: true }, { userId: user.id }] },
    orderBy: { totalXp: "desc" },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Current user's profile
  const userProfile = user
    ? profiles.find((p) => p.userId === user.id) || null
    : null;

  // All achievements definitions
  const allAchievements = await prisma.achievementDefinition.findMany();

  // User unlocked achievements
  const userAchievements = user
    ? await prisma.userAchievement.findMany({
        where: { userId: user.id },
      })
    : [];

  const unlockedCodes = new Set(userAchievements.map((ua) => ua.achievementCode));

  // User XP Events (Immutable ledger)
  const xpEvents = user
    ? await prisma.xpEvent.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { task: true },
        take: 10,
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-cyan-400" />
          Рейтинг и достижения (Student Value)
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Академический рейтинг и система поощрения учебной активности группы 5130901/40102
        </p>
      </div>

      {/* TOP USER BANNER */}
      {userProfile && (
        <Card className="glass-panel border-cyan-500/40 p-5 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 font-mono text-xl font-black text-cyan-300">
                {userProfile.level}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-white">{user?.nickname}</span>
                  <Badge variant="default" className="text-[10px]">
                    Уровень {userProfile.level}
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-3">
                  <span>Общий опыт: <strong className="text-cyan-300 font-mono">{userProfile.totalXp} XP</strong></span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-rose-400 font-medium">
                    <Flame className="w-3.5 h-3.5 animate-pulse" />
                    Серия активности: {userProfile.currentStreak} дн.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/settings">
                <Badge
                  variant={userProfile.isLeaderboardOptIn ? "success" : "muted"}
                  className="cursor-pointer text-xs"
                >
                  {userProfile.isLeaderboardOptIn ? "✓ Участие в рейтинге активно" : "Приватный режим"}
                </Badge>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* TWO COLUMNS: LEADERBOARD + ACHIEVEMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Opt-In Leaderboard (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-cyan-400" />
              Таблица лидеров семестра
            </h2>
            <span className="text-[11px] text-slate-500">
              * Студенты с выключенным рейтингом скрыты
            </span>
          </div>

          <div className="space-y-2">
            {profiles.filter(profile => profile.isLeaderboardOptIn).map((profile, idx) => {
              const isCurrentUser = user && profile.userId === user.id;
              const isOptedIn = profile.isLeaderboardOptIn;
              const displayName = isOptedIn
                ? profile.user.nickname
                : `Студент #${idx + 1} (приватный)`;

              return (
                <div
                  key={profile.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isCurrentUser
                      ? "bg-cyan-950/20 border-cyan-500/40 shadow-xs"
                      : "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                        idx === 0
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : idx === 1
                          ? "bg-slate-400/20 text-slate-300 border border-slate-500/30"
                          : idx === 2
                          ? "bg-amber-700/20 text-amber-600 border border-amber-700/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <img
                        src={
                          isOptedIn && profile.user.avatarUrl
                            ? profile.user.avatarUrl
                            : "https://api.dicebear.com/7.x/bottts/svg?seed=masked"
                        }
                        alt="Avatar"
                        className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700"
                      />
                      <div>
                        <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                          <span>{displayName}</span>
                          {isCurrentUser && (
                            <Badge variant="default" className="text-[9px] px-1 py-0">
                              Вы
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>Уровень {profile.level}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-rose-400/90">
                            <Flame className="w-3 h-3" />
                            {profile.currentStreak} дн.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="font-mono font-bold text-sm text-cyan-400">
                    {profile.totalXp} XP
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Achievements Showcase (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Award className="w-4 h-4 text-cyan-400" />
            Достижения и награды
          </h2>

          <div className="space-y-2.5">
            {allAchievements.map((ach) => {
              const isUnlocked = unlockedCodes.has(ach.code);
              return (
                <div
                  key={ach.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                    isUnlocked
                      ? "bg-cyan-950/20 border-cyan-500/30 text-white"
                      : "bg-slate-900/40 border-slate-800/80 text-slate-400 opacity-60"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isUnlocked
                        ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {isUnlocked ? <Sparkles className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-100">{ach.title}</span>
                      <span className="text-[10px] font-mono text-cyan-400 font-semibold">
                        +{ach.points} XP
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">{ach.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* XP Ledger History */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              История начислений XP
            </h3>
            {xpEvents.length > 0 ? (
              <div className="space-y-1.5">
                {xpEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2.5 rounded-lg border border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-[11px]"
                  >
                    <div className="space-y-0.5">
                      <span className="font-medium text-slate-200 block">{evt.reason}</span>
                      <span className="text-slate-500 text-[10px]">
                        {new Date(evt.createdAt).toLocaleString("ru-RU")}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-cyan-400">+{evt.points} XP</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Событий XP пока нет.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
