import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { parseLessonEvidence } from "@/lib/study/lesson-context";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!user?.groupId) return new Response(null, { status: 401, headers });
  const lesson = await prisma.classSession.findFirst({
    where: {
      id: (await params).id,
      status: "PUBLISHED",
      courseOffering: {
        status: "ACTIVE",
        mergedIntoId: null,
        groups: { some: { groupId: user.groupId } },
      },
    },
    include: { context: true },
  });
  if (!lesson?.context?.guideText)
    return new Response(null, { status: 404, headers });
  const content = [
    lesson.topic,
    "Учебная памятка Student Value. Составлена по источникам; не является документом преподавателя.",
    lesson.context.guideText,
    "Что делать после занятия",
    lesson.context.assignmentNotes,
    "Источники",
    ...parseLessonEvidence(lesson.context.evidence).map((e) =>
      [e.label, e.location, e.url, e.quote].filter(Boolean).join("\n"),
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
  return new Response(content, {
    headers: {
      ...headers,
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="studentvalue-lesson-guide.txt"',
    },
  });
}
