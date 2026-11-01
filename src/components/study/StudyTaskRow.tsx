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
  const isOverdue = task.timing.urgency === "OVERDUE";
  const isImminent =
    task.timing.urgency === "DUE_TODAY" ||
    task.timing.urgency === "DUE_TOMORROW";

  return (
    <Link
      className="group relative flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-[#111c30]/60 hover:bg-[#15243e]/90 border border-white/[0.08] hover:border-blue-400/35 transition-all duration-200 hover:-translate-y-0.5 shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] active:scale-[0.985]"
      href={`/tasks/${task.id}`}
    >
      {showDate &&
        (task.deadline ? (
          <span
            className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col items-center justify-center text-center shrink-0 shadow-inner group-hover:border-blue-400/30 transition-colors"
            aria-hidden="true"
          >
            <b className="text-base font-bold text-slate-100 leading-none">
              {formatInTimeZone(task.deadline.date, "Europe/Moscow", "dd")}
            </b>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mt-0.5">
              {formatInTimeZone(task.deadline.date, "Europe/Moscow", "MMM", {
                locale: ru,
              }).replace(".", "")}
            </span>
          </span>
        ) : (
          <span
            className="w-12 h-12 rounded-xl bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center text-slate-500 shrink-0 text-xs"
            aria-hidden="true"
          >
            —
          </span>
        ))}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {showCourse && (
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-400/25 text-[11px] font-semibold text-blue-300 tracking-wide shrink-0">
              {task.courseShortTitle}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {task.deadline ? task.timing.formattedDate : "Срок не указан"}
          </span>
        </div>
        <div className="text-sm sm:text-base font-medium text-slate-100 group-hover:text-blue-200 transition-colors truncate">
          {task.title}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0 ml-auto text-right">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
            isOverdue
              ? "bg-rose-500/15 border-rose-500/30 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]"
              : isImminent
                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                : "bg-blue-500/10 border-blue-400/20 text-blue-300"
          }`}
        >
          {task.timing.badgeLabel}
        </span>
        <span className="text-[11px] text-slate-400">{progressLabel(task)}</span>
      </div>

      <ArrowUpRight
        size={15}
        className="shrink-0 text-slate-500 group-hover:text-blue-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
      />
    </Link>
  );
}
