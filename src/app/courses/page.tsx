import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/session";
import { loadStudyWorkspace } from "@/server/queries/study-workspace";
import { isTrustedAccepted } from "@/server/domain/trust";

export default async function CoursesPage() {
  const user = await requireCurrentUser();
  const { offerings } = await loadStudyWorkspace(user);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {offerings[0]?.semester.name ?? "Ваше учебное пространство"}
          </p>
          <h1 className="page-title">Предметы</h1>
          <p className="page-intro">
            Работы, материалы и ваш прогресс — внутри каждого предмета.
          </p>
        </div>
        <span className="text-slate-400 text-sm hidden sm:inline">
          {offerings.length} в семестре
        </span>
      </div>
      <div>
        {offerings.map((o, index) => {
          const done = o.tasks.filter(
            (t) =>
              ["READY", "SUBMITTED"].includes(t.progress[0]?.status ?? "") ||
              isTrustedAccepted(t.progress[0]),
          ).length;
          return (
            <Link className="course-line" key={o.id} href={`/courses/${o.id}`}>
              <span className="course-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="course-code">
                {o.courseDefinition.shortTitle}
              </span>
              <span className="course-name">
                {o.courseDefinition.title}
                <span className="sm:hidden block text-slate-400 mt-1">
                  {o.tasks.length
                    ? `${done} из ${o.tasks.length} выполнено`
                    : "Без опубликованных заданий"}
                </span>
              </span>
              <span className="course-state">
                {o.tasks.length
                  ? `${done} / ${o.tasks.length} выполнено`
                  : "Заданий пока нет"}
              </span>
              <ArrowUpRight size={18} />
            </Link>
          );
        })}
      </div>
      {!offerings.length && (
        <p className="quiet-empty">
          Предметы текущего семестра ещё не добавлены.
        </p>
      )}
    </>
  );
}
