import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getCalendarIntegrationStatus } from "@/server/services/calendar-service";
import { SettingsClient } from "./SettingsClient";
import { Settings } from "lucide-react";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      identities: true,
      gamificationProfile: true,
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  const calendarStatus = await getCalendarIntegrationStatus(user.groupId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-cyan-400" />
          Настройки аккаунта и системы
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Управление профилем, приватностью, привязанными аккаунтами и уведомлениями
        </p>
      </div>

      <SettingsClient
        user={{
          id: dbUser.id,
          nickname: dbUser.nickname,
          bio: dbUser.bio,
          avatarUrl: dbUser.avatarUrl,
          isSystemAdmin: dbUser.isSystemAdmin,
          isOwner: user.isOwner,
          identities: dbUser.identities.map((id) => ({
            provider: id.provider,
            email: id.email,
            providerUserId: id.providerUserId,
          })),
        }}
        gamification={
          dbUser.gamificationProfile
            ? {
                totalXp: dbUser.gamificationProfile.totalXp,
                level: dbUser.gamificationProfile.level,
                isLeaderboardOptIn: dbUser.gamificationProfile.isLeaderboardOptIn,
              }
            : null
        }
        calendarStatus={{
          isConfigured: calendarStatus.isConfigured,
          groupCalendarId: calendarStatus.groupCalendarId,
          totalSyncedEvents: calendarStatus.totalSyncedEvents,
        }}
      />
    </div>
  );
}
