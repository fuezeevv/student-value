import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  loadStudyWorkspace,
  byDeadline,
} from "@/server/queries/study-workspace";
import { StudyTaskRow } from "@/components/study/StudyTaskRow";

export default async function CalendarPage() {
  const user = await requireCurrentUser();
  const { tasks } = await loadStudyWorkspace(user);
  const dated = tasks.filter((t) => t.deadline).sort(byDeadline);
  return (
    <>
      <nav className="breadcrumb">
        <Link href="/deadlines">
          <ArrowLeft size={14} />
          Все сроки
        </Link>
      </nav>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Учёба в вашем календаре</p>
          <h1 className="page-title">Календарь сроков</h1>
          <p className="page-intro">
            Скачайте подтверждённые даты и импортируйте файл в свой календарь.
            Все даты — по Москве.
          </p>
        </div>
      </div>
      <div className="workspace-grid">
        <section>
          <div className="section-heading">
            <h2>
              Даты семестра<span className="count">{dated.length}</span>
            </h2>
          </div>
          {dated.map((task) => (
            <StudyTaskRow key={task.id} task={task} />
          ))}
          {!dated.length && (
            <p className="quiet-empty">Подтверждённых дат пока нет.</p>
          )}
        </section>
        <aside className="workspace-aside">
          <section>
            <h2>Сохранить даты</h2>
            <p>
              Файл .ics можно открыть в Apple Calendar, Google Calendar, Outlook
              или другом календаре.
            </p>
            <a
              href="/api/calendar/export"
              download
              className="action-primary mt-5"
            >
              <Download size={16} />
              Скачать .ics
            </a>
            <p className="mt-5">
              Это разовый импорт. Если срок изменится, уведомление придёт здесь,
              а запись в вашем календаре нужно обновить самостоятельно.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
