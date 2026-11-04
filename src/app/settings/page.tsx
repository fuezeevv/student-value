import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { SettingsClient } from "./SettingsClient";
import { LegalLinks } from "@/components/layout/LegalLinks";
import Link from "next/link";

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
      <section className="border-t border-slate-700 mt-9 pt-7 text-sm text-slate-400 space-y-4">
        <p>
          <a
            href="https://t.me/studentvalue"
            className="text-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Канал Student Value · новости и вопросы ↗
          </a>
        </p>
        <h2 className="text-lg text-slate-100">Данные и доступ</h2>
        <p>
          Подключение и отключение Google Calendar — на{" "}
          <Link href="/calendar" className="text-link">
            странице календаря
          </Link>
          . Для запроса удаления данных напишите владельцу:{" "}
          <a className="text-link" href="mailto:fuezeev@gmail.com">
            fuezeev@gmail.com
          </a>
          .
        </p>
        <LegalLinks />
      </section>
    </div>
  );
}
