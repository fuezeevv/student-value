import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { taskVisibilityWhere } from "@/server/domain/access";
import { OperationForm } from "@/components/workspace/OperationForm";
import { inputClass } from "@/components/workspace/styles";
import { proposeChangeAction } from "@/server/actions/proposal-actions";
export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; task?: string; lesson?: string }>;
}) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const courses = await prisma.courseOffering.findMany({
    where: { groups: { some: { groupId: user.groupId } }, status: "ACTIVE" },
    include: { courseDefinition: true },
  });
  const selected = courses.find((c) => c.id === params.course);
  if (params.course && !selected) notFound();
  const [tasks, lessons] = selected
    ? await Promise.all([
        prisma.task.findMany({
          where: {
            AND: [
              await taskVisibilityWhere(user),
              { courseOfferingId: selected.id },
            ],
          },
          select: { id: true, title: true },
        }),
        prisma.classSession.findMany({
          where: { courseOfferingId: selected.id, status: "PUBLISHED" },
          select: { id: true, topic: true },
          orderBy: { sessionDate: "desc" },
          take: 100,
        }),
      ])
    : [[], []];
  return (
    <div className="max-w-2xl mx-auto space-y-7">
      <Link href="/proposals" className="text-link">
        ← Предложения
      </Link>
      <header>
        <p className="eyebrow">
          {selected?.courseDefinition.shortTitle ?? user.groupName}
        </p>
        <h1 className="page-title">Предложить уточнение</h1>
        <p className="page-intro">
          Сообщите итог и откуда он известен. После проверки информация появится
          в нужном месте, а не в длинном обсуждении.
        </p>
      </header>
      {!selected ? (
        <form className="space-y-5">
          <label className="block text-sm">
            Предмет
            <select className={inputClass} name="course" required>
              <option value="">Выберите предмет</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseDefinition.title}
                </option>
              ))}
            </select>
          </label>
          <button className="action-primary">Далее</button>
        </form>
      ) : (
        <OperationForm
          action={proposeChangeAction}
          label="Отправить на проверку"
        >
          <input type="hidden" name="courseOfferingId" value={selected.id} />
          <label className="block text-sm">
            Что уточняем
            <select
              name="kind"
              className={inputClass}
              defaultValue={params.task ? "TASK_REQUIREMENT" : "NOTE"}
            >
              <option value="NOTE">Уточнение или объявление</option>
              <option value="TASK_REQUIREMENT">Требование к работе</option>
              <option value="DEADLINE">Срок сдачи</option>
              <option value="MATERIAL">Материал или полезная ссылка</option>
              <option value="LESSON_SUMMARY">Краткий итог занятия</option>
            </select>
          </label>
          <label className="block text-sm">
            Коротко
            <input
              name="title"
              required
              minLength={3}
              maxLength={240}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            Что стало известно
            <textarea
              name="content"
              required
              minLength={8}
              maxLength={10000}
              rows={5}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            Откуда известно
            <textarea
              name="sourceNote"
              required
              minLength={8}
              maxLength={4000}
              rows={3}
              className={inputClass}
              placeholder="Кто и на каком занятии сказал; точная цитата или документ"
            />
          </label>
          <label className="block text-sm">
            Ссылка на источник или материал
            <input
              type="url"
              name="sourceUrl"
              className={inputClass}
              placeholder="https://…"
            />
          </label>
          <details open={Boolean(params.task || params.lesson)}>
            <summary className="min-h-11 cursor-pointer text-sm">
              Связать с работой или занятием · дата срока
            </summary>
            <label className="block text-sm mt-3">
              Работа
              <select
                name="taskId"
                defaultValue={params.task ?? ""}
                className={inputClass}
              >
                <option value="">Без конкретной работы</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm mt-3">
              Занятие
              <select
                name="sessionId"
                defaultValue={params.lesson ?? ""}
                className={inputClass}
              >
                <option value="">Без конкретного занятия</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.topic ?? "Занятие"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm mt-3">
              Предлагаемая дата срока
              <input type="date" name="proposedDay" className={inputClass} />
            </label>
            <p className="text-xs text-slate-400 mt-2">
              Заполняйте только известную дату. Она не станет общим сроком без
              проверки.
            </p>
          </details>
        </OperationForm>
      )}
    </div>
  );
}
