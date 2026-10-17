import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { canEditCourse } from "@/server/domain/lessons";
import { OperationForm } from "@/components/workspace/OperationForm";
import { inputClass } from "@/components/workspace/styles";
import {
  shareBriefAction,
  archiveSharedBriefAction,
  proposeChangeAction,
} from "@/server/actions/proposal-actions";
export default async function ExchangePage() {
  const user = await requireCurrentUser();
  const [briefs, courses] = await Promise.all([
    prisma.sharedBrief.findMany({
      where: { archivedAt: null },
      include: { group: { select: { name: true, code: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.courseOffering.findMany({
      where: { groups: { some: { groupId: user.groupId } } },
      include: { courseDefinition: true },
    }),
  ]);
  const editable = courses.filter((c) =>
    canEditCourse(user, c.id, "review_proposals"),
  );
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href="/proposals" className="text-link">
        ← Предложения
      </Link>
      <header>
        <p className="eyebrow">Обмен контекстом</p>
        <h1 className="page-title">Информация соседних групп</h1>
        <p className="page-intro">
          Здесь только сведения, которыми редакторы явно решили поделиться. Это
          повод сверить требования, а не готовое правило для вашей группы.
        </p>
      </header>
      {briefs.length ? (
        briefs.map((b) => (
          <article
            className="border-t border-slate-700 pt-6 space-y-4"
            key={b.id}
          >
            <p className="eyebrow !tracking-normal">
              {b.group.name} · {b.subject}
            </p>
            <h2 className="text-xl">{b.title}</h2>
            <p className="whitespace-pre-wrap text-slate-300">{b.content}</p>
            <p className="text-sm text-slate-400 whitespace-pre-wrap">
              Источник: {b.sourceNote}
            </p>
            {b.sourceUrl && (
              <a
                className="text-link"
                href={b.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть источник ↗
              </a>
            )}
            {b.groupId === user.groupId && editable.length > 0 && (
              <details>
                <summary className="text-link min-h-11 cursor-pointer">
                  Отозвать сведения из обмена
                </summary>
                <OperationForm
                  action={archiveSharedBriefAction}
                  label="Отозвать из обмена"
                >
                  <input type="hidden" name="id" value={b.id} />
                  <p className="text-xs text-slate-400">
                    Новые группы не смогут использовать эти сведения. История
                    уже принятых решений останется.
                  </p>
                </OperationForm>
              </details>
            )}
            {b.groupId !== user.groupId && courses.length > 0 && (
              <details>
                <summary className="text-link min-h-11 cursor-pointer">
                  Предложить проверить для нашей группы
                </summary>
                <OperationForm
                  action={proposeChangeAction}
                  label="Отправить на проверку"
                  className="mt-4"
                >
                  <input type="hidden" name="kind" value="NOTE" />
                  <input type="hidden" name="sharedBriefId" value={b.id} />
                  <input type="hidden" name="title" value={b.title} />
                  <input type="hidden" name="content" value={b.content} />
                  <input type="hidden" name="sourceNote" value={b.sourceNote} />
                  <label className="block text-sm">
                    К какому нашему предмету относится
                    <select name="courseOfferingId" className={inputClass}>
                      {courses.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.courseDefinition.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-slate-400">
                    Будет создано предложение. Задания и сроки изменятся только
                    после подтверждения применимости вашим редактором.
                  </p>
                </OperationForm>
              </details>
            )}
          </article>
        ))
      ) : (
        <p className="quiet-empty">
          Другие группы ещё не поделились сведениями. Чужие приватные занятия и
          списки участников здесь не показываются.
        </p>
      )}
      {editable.length > 0 && (
        <details className="border-t border-slate-700 pt-6">
          <summary className="text-link min-h-11 cursor-pointer">
            Поделиться сведениями с другими группами
          </summary>
          <OperationForm
            action={shareBriefAction}
            label="Предложить другим группам"
            className="mt-5"
            reset
          >
            <p className="text-sm text-slate-400">
              Эта формулировка будет видна всем подключённым группам. Не
              включайте личные данные, частные заметки или закрытые обсуждения.
              Чужие учебные сведения автоматически не меняются.
            </p>
            <label className="block text-sm">
              Предмет
              <select name="courseOfferingId" className={inputClass}>
                {editable.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.courseDefinition.title}
                  </option>
                ))}
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
                minLength={10}
                maxLength={5000}
                rows={5}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              Источник
              <textarea
                name="sourceNote"
                required
                minLength={8}
                maxLength={4000}
                rows={3}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              Ссылка
              <input name="sourceUrl" type="url" className={inputClass} />
            </label>
          </OperationForm>
        </details>
      )}
    </div>
  );
}
