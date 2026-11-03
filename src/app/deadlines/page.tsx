import Link from "next/link";
import { ArrowUpRight, Download } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  loadStudyWorkspace,
  byDeadline,
} from "@/server/queries/study-workspace";
import { StudyTaskRow } from "@/components/study/StudyTaskRow";

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<{
    course?: string;
    type?: string;
    hideCompleted?: string;
  }>;
}) {
  const user = await requireCurrentUser();
  const { offerings, tasks } = await loadStudyWorkspace(user);
  const params = await searchParams;
  const items = tasks
    .filter(
      (t) =>
        (!params.course || t.courseCode === params.course) &&
        (!params.type || t.deadline?.type === params.type) &&
        (!(params.hideCompleted === "true") || !t.completed),
    )
    .sort(byDeadline);
  const sections = [
    {
      id: "upcoming",
      title: "Ближайшие и предстоящие",
      items: items.filter(
        (t) => t.deadline && !t.completed && t.timing.urgency !== "OVERDUE",
      ),
    },
    {
      id: "overdue",
      title: "Срок прошёл",
      items: items.filter(
        (t) => !t.completed && t.timing.urgency === "OVERDUE",
      ),
    },
    {
      id: "undated",
      title: "Без указанного срока",
      items: items.filter((t) => !t.deadline && !t.completed),
    },
    {
      id: "completed",
      title: "Выполнено",
      items: items.filter((t) => t.completed),
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Всё, что нужно сделать</p>
          <h1 className="page-title">Работы и сроки</h1>
          <p className="page-intro">
            Лабораторные, расчётные и домашние задания. Отмечайте выполненное —
            ждать подтверждения старосты не нужно.
          </p>
        </div>
        <Link className="text-link hidden sm:flex" href="/calendar">
          Календарь
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <form className="filter-bar" action="/deadlines">
        <label>
          Предмет
          <select name="course" defaultValue={params.course ?? ""}>
            <option value="">Все предметы</option>
            {offerings.map((o) => (
              <option key={o.id} value={o.courseDefinition.code}>
                {o.courseDefinition.shortTitle}
              </option>
            ))}
          </select>
        </label>
        <label>
          Тип срока
          <select name="type" defaultValue={params.type ?? ""}>
            <option value="">Все сроки</option>
            <option value="HARD">Окончательные</option>
            <option value="SOFT">Рекомендуемые</option>
          </select>
        </label>
        <label>
          Выполненные работы
          <select
            name="hideCompleted"
            defaultValue={params.hideCompleted ?? "false"}
          >
            <option value="false">Показывать</option>
            <option value="true">Скрыть</option>
          </select>
        </label>
        <button className="action-primary" type="submit">
          Показать
        </button>
        <a
          className="text-link sm:ml-auto"
          href="/api/calendar/export"
          download
        >
          <Download size={15} />
          Скачать .ics
        </a>
      </form>
      {sections.map(
        (section) =>
          section.items.length > 0 && (
            <section
              key={section.id}
              id={section.id}
              className="deadline-group"
            >
              <h2 className={section.id === "overdue" ? "text-rose-300" : ""}>
                {section.title}
                <span>{section.items.length}</span>
              </h2>
              {section.id === "overdue" && (
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Эти работы ещё не отмечены выполненными. Если уже сделали —
                  поставьте отметку рядом с заданием.
                </p>
              )}
              <div className="space-y-2.5 mt-3">
                {section.items.map((task) => (
                  <StudyTaskRow key={task.id} task={task} />
                ))}
              </div>
            </section>
          ),
      )}
      {!items.length && (
        <div className="quiet-empty">
          По этим фильтрам работ нет.{" "}
          <Link className="text-link" href="/deadlines">
            Сбросить фильтры
          </Link>
        </div>
      )}
    </>
  );
}
