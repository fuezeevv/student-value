import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import {
  progressLabel,
  type StudyTask,
} from "@/server/queries/study-workspace";

export function StudyTaskRow({
  task,
  showCourse = true,
  showDate = true,
}: {
  task: StudyTask;
  showCourse?: boolean;
  showDate?: boolean;
}) {
  return (
    <Link className="study-row" href={`/tasks/${task.id}`}>
      {showDate && task.deadline && (
        <span className="date-stamp" aria-hidden="true">
          <b>{formatInTimeZone(task.deadline.date, "Europe/Moscow", "dd")}</b>
          <span>
            {formatInTimeZone(task.deadline.date, "Europe/Moscow", "MMM", {
              locale: ru,
            }).replace(".", "")}
          </span>
        </span>
      )}
      <div className="study-row-main">
        <div className="study-row-title">{task.title}</div>
        <div className="study-row-meta">
          {showCourse && <span>{task.courseShortTitle}</span>}
          <span>
            {task.deadline ? task.timing.formattedDate : "Срок не указан"}
          </span>
        </div>
      </div>
      <div
        className={`study-row-end ${task.timing.urgency === "OVERDUE" ? "overdue" : ""}`}
      >
        <strong>{task.timing.badgeLabel}</strong>
        <span>{progressLabel(task)}</span>
      </div>
      <ArrowUpRight size={15} className="shrink-0 text-slate-500" />
    </Link>
  );
}
