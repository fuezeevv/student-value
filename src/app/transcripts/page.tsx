import React from "react";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { TranscriptViewer } from "./TranscriptViewer";
import { formatInTimeZone } from "date-fns-tz";
export default async function TranscriptsPage() {
  const user = await requireCurrentUser();
  const items = await prisma.transcript.findMany({
    where: {
      session: {
        courseOffering: { groups: { some: { groupId: user.groupId } } },
      },
    },
    include: {
      session: {
        include: {
          teacher: true,
          courseOffering: { include: { courseDefinition: true } },
        },
      },
    },
    orderBy: { session: { sessionDate: "desc" } },
    take: 50,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Транскрипции занятий и материалы</h1>
      {items.length ? (
        <TranscriptViewer
          transcripts={items.map((t) => ({
            id: t.id,
            course: t.session.courseOffering.courseDefinition.shortTitle,
            title: t.session.topic ?? "Запись занятия",
            date: formatInTimeZone(
              t.session.sessionDate,
              "Europe/Moscow",
              "dd.MM.yyyy",
            ),
            teacher: t.session.teacher?.fullName ?? "Преподаватель уточняется",
            excerpt: t.rawText.slice(0, 300),
            fullText: t.rawText,
            extractedFacts: [],
          }))}
        />
      ) : (
        <p className="text-slate-400">
          Транскрипции ещё не добавлены. Локальный академический корпус хранится
          отдельно от приложения.
        </p>
      )}
    </div>
  );
}
