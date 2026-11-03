import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/session";
import { loadStudyWorkspace } from "@/server/queries/study-workspace";
import { isTrustedAccepted } from "@/server/domain/trust";
import { StudyTaskRow } from "@/components/study/StudyTaskRow";

export default async function ProgressPage() {
  const user = await requireCurrentUser();
  const { offerings, tasks } = await loadStudyWorkspace(user);
  const completed = tasks.filter((t) => t.completed).length;
  const accepted = tasks.filter((t) => t.accepted).length;
  const waiting = tasks.filter((t) => t.userProgress?.status === "SUBMITTED");
  const active = tasks.filter((t) =>
    ["IN_PROGRESS", "NEEDS_FIX"].includes(t.userProgress?.status ?? ""),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Личный темп</p>
          <h1 className="page-title">Мой прогресс</h1>
          <p className="page-intro">
            По опубликованным и доступным вам работам. Это не полный учебный
            план.
          </p>
        </div>
      </div>
      <div className="progress-summary !mt-0 !mb-10 !gap-10 border-b border-slate-700 pb-7">
        <div>
          <strong>
            {completed}
            <span>выполнено из {tasks.length}</span>
          </strong>
        </div>
        <div>
          <strong>
            {active.length}
            <span>в работе</span>
          </strong>
        </div>
        <div>
          <strong>
            {waiting.length}
            <span>на проверке</span>
          </strong>
        </div>
      </div>
      <div className="workspace-grid">
        <section>
          <div className="section-heading">
            <h2>По предметам</h2>
          </div>
          {offerings.map((o) => {
            const done = o.tasks.filter(
              (t) =>
                ["READY", "SUBMITTED"].includes(t.progress[0]?.status ?? "") ||
                isTrustedAccepted(t.progress[0]),
            ).length;
            return (
              <Link
                key={o.id}
                href={`/courses/${o.id}`}
                className="course-line compact"
              >
                <span className="course-code">
                  {o.courseDefinition.shortTitle}
                </span>
                <div className="course-name">
                  {o.tasks.length
                    ? `${done} из ${o.tasks.length} выполнено`
                    : "Нет опубликованных работ"}
                  {o.tasks.length > 0 && (
                    <div className="course-progress" aria-hidden="true">
                      {o.tasks.map((t) => (
                        <span
                          key={t.id}
                          className={
                            ["READY", "SUBMITTED"].includes(
                              t.progress[0]?.status ?? "",
                            ) || isTrustedAccepted(t.progress[0])
                              ? "done"
                              : ""
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
                <ArrowUpRight size={16} />
              </Link>
            );
          })}
        </section>
        <aside className="workspace-aside">
          <section>
            <h2>Как считается прогресс</h2>
            <p>
              Вы сами отмечаете выполненные работы; они сразу учитываются в
              прогрессе. Староста может подтвердить отметку или вернуть работу к
              выполнению.
            </p>
            <p className="mt-3">
              Отдельно записано зачётов преподавателя: {accepted}. Для них
              по-прежнему нужны независимое подтверждение и источник результата.
            </p>
          </section>
        </aside>
      </div>
      {waiting.length > 0 && (
        <section className="deadline-group">
          <h2>Ожидают проверки</h2>
          {waiting.map((t) => (
            <StudyTaskRow key={t.id} task={t} />
          ))}
        </section>
      )}
      {active.length > 0 && (
        <section className="deadline-group">
          <h2>В работе</h2>
          {active.map((t) => (
            <StudyTaskRow key={t.id} task={t} />
          ))}
        </section>
      )}
    </>
  );
}
