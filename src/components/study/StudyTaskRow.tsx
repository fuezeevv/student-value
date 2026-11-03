import Link from "next/link";
import { ArrowUpRight, FileDown } from "lucide-react";
import {
  progressLabel,
  type StudyTask,
} from "@/server/queries/study-workspace";
import { CompleteWorkButton } from "@/components/task/CompleteWorkButton";
export function StudyTaskRow({
  task,
  showCourse = true,
  showDate = true,
}: {
  task: StudyTask;
  showCourse?: boolean;
  showDate?: boolean;
}) {
  const files = task.materials.slice(0, 2);
  return (
    <article
      className={`work-item ${task.completed ? "work-item-complete" : ""}`}
    >
      <div className="work-item-body">
        {showCourse && (
          <Link className="work-subject" href={`/courses/${task.courseId}`}>
            {task.courseShortTitle}
          </Link>
        )}
        <Link href={`/tasks/${task.id}`} className="work-title">
          {task.title}
          <ArrowUpRight size={16} />
        </Link>
        <div className="work-facts">
          {showDate && (
            <span
              className={
                !task.completed && task.timing.urgency === "OVERDUE"
                  ? "text-rose-200"
                  : "text-slate-200"
              }
            >
              {task.deadline
                ? `${task.deadline.title ? task.deadline.title + ": " : "Сдать до: "}${task.timing.formattedDate}`
                : "Срок не указан · можно приступать"}
            </span>
          )}
          <span>
            {task.userProgress?.completionReviewedAt
              ? "Выполнение подтверждено старостой"
              : progressLabel(task)}
          </span>
        </div>
        {files.length > 0 && (
          <div className="work-files">
            {files.map(({ material: m }) => (
              <a
                key={m.id}
                href={m.url}
                className="work-file"
                {...(m.url.startsWith("https:")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <FileDown size={16} />
                <span>{m.title}</span>
              </a>
            ))}
          </div>
        )}
      </div>
      <CompleteWorkButton
        taskId={task.id}
        complete={task.completed}
        accepted={task.accepted}
      />
    </article>
  );
}
