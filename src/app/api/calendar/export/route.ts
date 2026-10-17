import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";
import { getCurrentUser } from "@/lib/auth/session";
import { taskVisibilityWhere } from "@/server/domain/access";
import { effectiveDeadline } from "@/server/domain/deadline-date";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.groupId)
    return NextResponse.json({ error: "Необходимо войти" }, { status: 401 });
  const deadlines = await prisma.deadline.findMany({
    where: { ...confirmedDeadlineWhere, task: await taskVisibilityWhere(user) },
    include: {
      task: {
        include: {
          courseOffering: {
            include: { courseDefinition: true },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const nowStr =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Student Value 1.984//Study deadlines//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Student Value · ${(user.groupName ?? "Учебная группа").replace(/[\r\n,;]/g, " ")} · Сроки`,
    "X-WR-TIMEZONE:Europe/Moscow",
  ];

  for (const dl of deadlines) {
    const course = dl.task.courseOffering.courseDefinition;
    const deadlineDate = effectiveDeadline(dl.date, dl.isTimeStrict);
    const dtstart =
      deadlineDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    // 1-hour window for the event
    const endDate = new Date(deadlineDate.getTime() + 60 * 60 * 1000);
    const dtend =
      endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const title = `[${course.shortTitle}] ${dl.task.title}`;
    const desc = `${dl.title || "Контрольный срок сдачи"} (${dl.type === "HARD" ? "Жесткий" : "Рекомендуемый"}). Дисциплина: ${course.title}.`;

    icsContent.push(
      "BEGIN:VEVENT",
      `UID:task-${dl.taskId}@studentvalue1984.eu.cc`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${title.replace(/[\r\n,;]/g, " ")}`,
      `DESCRIPTION:${desc.replace(/[\r\n,;]/g, " ")}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  icsContent.push("END:VCALENDAR");

  return new NextResponse(icsContent.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="studentvalue-deadlines.ics"',
    },
  });
}
