import Link from "next/link";
import { ArrowUpRight, Paperclip } from "lucide-react";
import { calculateDeadlineStatus } from "@/server/services/deadline-service";
import type { PublicTask } from "@/server/queries/public-workspace";
export function PublicTaskRow({
  task,
  base,
}: {
  task: PublicTask;
  base: string;
}) {
  const deadline = task.deadlines[0];
  const timing = calculateDeadlineStatus(
    deadline?.date ?? null,
    new Date(),
    false,
    deadline?.isTimeStrict ?? true,
  );
  return (
    <article className="work-item preview-work">
      <div className="work-item-body">
        <Link
          href={`${base}/courses/${task.courseId}`}
          className="work-subject"
        >
          {task.courseTitle}
        </Link>
        <Link href={`${base}/tasks/${task.id}`} className="work-title">
          {task.title}
          <ArrowUpRight size={16} />
        </Link>
        <p
          className={`work-facts ${timing.urgency === "OVERDUE" ? "!text-[var(--wine)] font-bold" : ""}`}
        >
          {deadline
            ? `${deadline.title || "Сдать до"}: ${timing.formattedDate}`
            : "Срок не указан · работа опубликована"}
        </p>
        {task.materials.length > 0 && (
          <p className="preview-file-count">
            <Paperclip size={14} />
            Файлов и ссылок: {task.materials.length} · после входа
          </p>
        )}
      </div>
    </article>
  );
}
