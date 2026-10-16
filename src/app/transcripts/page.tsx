import React from "react";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { TranscriptViewer } from "./TranscriptViewer";
import { formatInTimeZone } from "date-fns-tz";
export default async function TranscriptsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course } = await searchParams;
  const user = await requireCurrentUser();
  const items = await prisma.transcript.findMany({
    where: {
      session: {
        courseOffering: {
          groups: { some: { groupId: user.groupId } },
          ...(course ? { courseDefinition: { code: course } } : {}),
        },
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
      <div className="page-heading">
        <div>
          <p className="eyebrow">Записи и содержание занятий</p>
          <h1 className="page-title">Стенограммы</h1>
          <p className="page-intro">
            {course
              ? "Записи по выбранному предмету."
              : "Ищите по тексту добавленных занятий вашей группы."}
          </p>
        </div>
      </div>
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
          Записи занятий пока не добавлены. Когда они появятся, здесь можно
          будет найти нужную тему и прочитать текст.
        </p>
      )}
    </div>
  );
}
