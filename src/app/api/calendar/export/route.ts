import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const deadlines = await prisma.deadline.findMany({
    where: { status: "ACTIVE" },
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

  const nowStr = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Student Value 1.984//SPbPU 5130901/40102//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:СПбПУ 40102 - Дедлайны",
    "X-WR-TIMEZONE:Europe/Moscow",
  ];

  for (const dl of deadlines) {
    const course = dl.task.courseOffering.courseDefinition;
    const deadlineDate = new Date(dl.date);
    const dtstart = deadlineDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    
    // 1-hour window for the event
    const endDate = new Date(deadlineDate.getTime() + 60 * 60 * 1000);
    const dtend = endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const title = `[${course.shortTitle}] ${dl.task.title}`;
    const desc = `${dl.title || "Контрольный срок сдачи"} (${dl.type === "HARD" ? "Жесткий" : "Рекомендуемый"}). Дисциплина: ${course.title}.`;

    icsContent.push(
      "BEGIN:VEVENT",
      `UID:dl-${dl.id}@student-value-1984.spbstu.ru`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${title.replace(/[,;]/g, " ")}`,
      `DESCRIPTION:${desc.replace(/[,;]/g, " ")}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  }

  icsContent.push("END:VCALENDAR");

  return new NextResponse(icsContent.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="spbpu-40102-deadlines.ics"',
    },
  });
}
