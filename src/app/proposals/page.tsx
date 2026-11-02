import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { permissionForProposalKind } from "@/server/domain/proposals";
import { canEditCourse } from "@/server/domain/lessons";
import { taskVisibilityWhere } from "@/server/domain/access";
import { OperationForm } from "@/components/workspace/OperationForm";
import { inputClass } from "@/components/workspace/styles";
import { reviewProposalAction } from "@/server/actions/proposal-actions";
const kinds = {
  NOTE: "Уточнение",
  MATERIAL: "Материал",
  TASK_REQUIREMENT: "Требование к работе",
  DEADLINE: "Срок сдачи",
  LESSON_SUMMARY: "Итог занятия",
};
export default async function ProposalsPage() {
  const user = await requireCurrentUser();
  const courses = await prisma.courseOffering.findMany({
    where: {
      status: "ACTIVE",
      mergedIntoId: null,
      groups: { some: { groupId: user.groupId } },
    },
    include: { courseDefinition: true },
  });
  const editable = courses
    .filter(
      (c) =>
        canEditCourse(user, c.id, "review_proposals") ||
        canEditCourse(user, c.id, "manage_deadlines") ||
        canEditCourse(user, c.id, "manage_materials") ||
        canEditCourse(user, c.id, "manage_sessions"),
    )
    .map((c) => c.id);
  const [items, tasks] = await Promise.all([
    prisma.changeProposal.findMany({
      where: {
        groupId: user.groupId,
        OR: [{ authorId: user.id }, { courseOfferingId: { in: editable } }],
      },
      include: {
        author: { select: { nickname: true } },
        reviewer: { select: { nickname: true } },
        sharedBrief: { include: { group: { select: { name: true } } } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.task.findMany({
      where: await taskVisibilityWhere(user),
      select: { id: true, title: true, courseOfferingId: true },
    }),
  ]);
  const visibleTaskIds = new Set(tasks.map((t) => t.id));
  const visibleItems = items.filter(
    (p) =>
      p.authorId === user.id ||
      (canEditCourse(
        user,
        p.courseOfferingId,
        permissionForProposalKind(p.kind),
      ) &&
        (!p.taskId || visibleTaskIds.has(p.taskId))),
  );
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Участие без лишнего чата</p>
          <h1 className="page-title">Предложения и уточнения</h1>
          <p className="page-intro">
            Здесь видно, что предложено, что проверено и какой итог опубликован.
          </p>
        </div>
        <Link className="action-primary" href="/proposals/new">
          Предложить информацию
        </Link>
      </header>
      <div className="flex flex-wrap gap-5">
        <Link className="text-link" href="/exchange">
          Информация соседних групп ↗
        </Link>
        <Link className="text-link" href="/lessons">
          Занятия и записи ↗
        </Link>
      </div>
      {!visibleItems.length ? (
        <p className="quiet-empty">
          Пока нет предложений. Можно сообщить уточнение задания, приложить
          полезный материал или разобрать фразы в тексте занятия. До проверки
          учебные данные останутся прежними.
        </p>
      ) : (
        visibleItems.map((p) => {
          const review =
            canEditCourse(
              user,
              p.courseOfferingId,
              permissionForProposalKind(p.kind),
            ) &&
            (!p.taskId || visibleTaskIds.has(p.taskId)) &&
            p.status === "PENDING";
          const course = courses.find((c) => c.id === p.courseOfferingId);
          const target =
            p.appliedKind === "TASK_REQUIREMENT" || p.appliedKind === "DEADLINE"
              ? p.taskId
                ? `/tasks/${p.taskId}`
                : null
              : p.appliedKind === "LESSON_SUMMARY"
                ? `/lessons/${p.sessionId}`
                : `/courses/${p.courseOfferingId}`;
          return (
            <article
              key={p.id}
              className="border-t border-slate-700 pt-6 space-y-4"
            >
              <p className="eyebrow !tracking-normal">
                {course?.courseDefinition.shortTitle} · {kinds[p.kind]} ·{" "}
                {p.status === "PENDING"
                  ? "Ожидает проверки"
                  : p.status === "APPROVED"
                    ? "Принято и опубликовано"
                    : p.status === "NEEDS_CLARIFICATION"
                      ? "Нужно уточнить"
                      : "Отклонено"}
              </p>
              <h2 className="text-xl">{p.title}</h2>
              <p className="text-xs text-slate-500">
                {p.author.nickname} ·{" "}
                {formatInTimeZone(
                  p.createdAt,
                  "Europe/Moscow",
                  "dd.MM.yyyy HH:mm",
                )}
              </p>
              {p.sharedBrief && (
                <p className="text-sm text-blue-200">
                  Из группы «{p.sharedBrief.group.name}». Применимость к вашей
                  группе требует отдельного решения.
                </p>
              )}
              {p.sharedBrief?.archivedAt && (
                <p className="text-sm text-rose-200">
                  Исходная группа отозвала эти сведения. Для публикации получите
                  актуальное подтверждение и отправьте новое предложение.
                </p>
              )}
              <p className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                {p.content}
              </p>
              <details>
                <summary className="text-link cursor-pointer min-h-11">
                  Источник
                  {p.transcriptId ? " · точная цитата из текста занятия" : ""}
                </summary>
                <blockquote className="whitespace-pre-wrap text-sm text-slate-400 border-l border-slate-600 pl-4 mt-3">
                  {p.sourceNote}
                </blockquote>
                {p.sourceUrl && (
                  <a
                    className="text-link mt-3"
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть источник ↗
                  </a>
                )}
                {p.sessionId && (
                  <Link
                    className="text-link block mt-3"
                    href={`/lessons/${p.sessionId}`}
                  >
                    Занятие и запись ↗
                  </Link>
                )}
              </details>
              {p.reviewNote && (
                <div className="border-l-2 border-blue-400/50 pl-4">
                  <p className="text-sm text-slate-200">
                    {p.reviewer?.nickname ?? "Редактор"}: {p.reviewNote}
                  </p>
                  {p.status === "NEEDS_CLARIFICATION" &&
                    p.authorId === user.id && (
                      <Link
                        className="text-link mt-3"
                        href={`/proposals/new?course=${p.courseOfferingId}${p.taskId ? `&task=${p.taskId}` : ""}${p.sessionId ? `&lesson=${p.sessionId}` : ""}`}
                      >
                        Отправить уточнённую информацию ↗
                      </Link>
                    )}
                  {p.status === "APPROVED" && target && (
                    <Link className="text-link mt-3" href={target}>
                      Опубликованный итог ↗
                    </Link>
                  )}
                </div>
              )}
              {review && (
                <details>
                  <summary className="text-link min-h-11 cursor-pointer">
                    Рассмотреть предложение
                  </summary>
                  <OperationForm
                    action={reviewProposalAction}
                    label="Сохранить решение"
                    className="mt-5"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <label className="block text-sm">
                      Решение
                      <select name="decision" className={inputClass}>
                        <option value="APPROVE">
                          Подтвердить и опубликовать
                        </option>
                        <option value="CLARIFY">Попросить уточнение</option>
                        <option value="REJECT">Не публиковать</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      Куда применить
                      <select
                        name="kind"
                        defaultValue={p.kind}
                        className={inputClass}
                      >
                        {Object.entries(kinds)
                          .filter(([id]) =>
                            canEditCourse(
                              user,
                              p.courseOfferingId,
                              permissionForProposalKind(
                                id as keyof typeof kinds,
                              ),
                            ),
                          )
                          .map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      Итоговая формулировка
                      <textarea
                        name="content"
                        defaultValue={p.content}
                        maxLength={10000}
                        rows={5}
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-sm">
                      Работа · для требования или срока
                      <select
                        name="taskId"
                        defaultValue={p.taskId ?? ""}
                        className={inputClass}
                      >
                        <option value="">Без работы</option>
                        {tasks
                          .filter(
                            (t) => t.courseOfferingId === p.courseOfferingId,
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      Дата срока · только если подтверждаете срок
                      <input
                        type="date"
                        name="proposedDay"
                        defaultValue={p.proposedDay ?? ""}
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-sm">
                      Характер срока · только если подтверждаете срок
                      <select
                        name="deadlineType"
                        className={inputClass}
                        defaultValue=""
                      >
                        <option value="">
                          Сохранить существующий · для нового срок не уточнён
                        </option>
                        <option value="SOFT">
                          Ориентир, допускает уточнение
                        </option>
                        <option value="HARD">
                          Строгий срок · подтверждён преподавателем
                        </option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      Что проверено или что нужно уточнить
                      <textarea
                        required
                        minLength={8}
                        maxLength={4000}
                        rows={3}
                        name="reviewNote"
                        className={inputClass}
                      />
                    </label>
                    <p className="text-xs text-slate-400">
                      Подтверждение изменит выбранный объект и сохранит автора
                      решения, основание и историю. Зачёт студенту здесь не
                      выставляется.
                    </p>
                  </OperationForm>
                </details>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}
