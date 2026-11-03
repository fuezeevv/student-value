import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { taskVisibilityWhere } from "@/server/domain/access";
import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";
import {
  isTrustedAccepted,
  progressEvidenceInclude,
} from "@/server/domain/trust";
import { calculateDeadlineStatus } from "@/server/services/deadline-service";

/** A presentation model. All academic visibility and trust come from the core. */
export async function loadStudyWorkspace(user: SessionUser) {
  const visibleTasks = await taskVisibilityWhere(user);
  const offerings = await prisma.courseOffering.findMany({
    where: {
      status: "ACTIVE",
      mergedIntoId: null,
      semester: { isCurrent: true },
      groups: { some: { groupId: user.groupId } },
    },
    include: {
      courseDefinition: true,
      semester: true,
      tasks: {
        where: visibleTasks,
        orderBy: [{ number: "asc" }, { createdAt: "asc" }],
        include: {
          materials: {
            include: {
              material: {
                select: { id: true, title: true, url: true, type: true },
              },
            },
          },
          deadlines: {
            where: confirmedDeadlineWhere,
            orderBy: { date: "asc" },
          },
          progress: {
            where: { userId: user.id },
            include: progressEvidenceInclude,
          },
        },
      },
    },
    orderBy: { courseDefinition: { shortTitle: "asc" } },
  });
  const now = new Date();
  const tasks = offerings.flatMap((offering) =>
    offering.tasks.map((task) => {
      const progress = task.progress[0];
      const accepted = isTrustedAccepted(progress);
      const deadline = task.deadlines[0] ?? null;
      const completed =
        accepted || ["READY", "SUBMITTED"].includes(progress?.status ?? "");
      return {
        ...task,
        courseId: offering.id,
        courseCode: offering.courseDefinition.code,
        courseShortTitle: offering.courseDefinition.shortTitle,
        courseTitle: offering.courseDefinition.title,
        userProgress: progress,
        accepted,
        completed,
        deadline,
        timing: calculateDeadlineStatus(
          deadline?.date ?? null,
          now,
          completed,
          deadline?.isTimeStrict ?? true,
        ),
      };
    }),
  );
  return { offerings, tasks, now };
}
export type StudyTask = Awaited<
  ReturnType<typeof loadStudyWorkspace>
>["tasks"][number];
export function byDeadline(a: StudyTask, b: StudyTask) {
  return (
    (a.deadline?.date.getTime() ?? Infinity) -
      (b.deadline?.date.getTime() ?? Infinity) ||
    a.title.localeCompare(b.title, "ru")
  );
}
export function progressLabel(
  task: Pick<StudyTask, "accepted" | "userProgress">,
) {
  if (task.userProgress?.status === "ACCEPTED" && !task.accepted)
    return "Результат требует проверки";
  const labels = {
    NOT_STARTED: "Не начато",
    IN_PROGRESS: "В работе",
    READY: "Выполнено",
    SUBMITTED: "Выполнено · отправлено",
    ACCEPTED: "Зачтено",
    NEEDS_FIX: "Нужны правки",
  };
  return labels[task.userProgress?.status ?? "NOT_STARTED"];
}
