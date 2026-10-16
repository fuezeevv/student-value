import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      nickname: true,
      bio: true,
      gamificationProfile: { select: { isLeaderboardOptIn: true } },
    },
  });
  if (!profile) redirect("/login");
  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Ваше пространство</p>
          <h1 className="page-title">Профиль</h1>
          <p className="page-intro">
            Как вас видит группа и что вы показываете в рейтинге.
          </p>
        </div>
      </div>
      <SettingsClient
        nickname={profile.nickname}
        bio={profile.bio}
        leaderboardOptIn={
          profile.gamificationProfile?.isLeaderboardOptIn ?? true
        }
      />
    </div>
  );
}
