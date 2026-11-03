import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { loadPlatformDirectory } from "@/server/domain/platform-workspace";
import { OperationForm } from "@/components/workspace/OperationForm";
import { inputClass } from "@/components/workspace/styles";
import {
  createEmptyGroupAction,
  setGroupSharingAction,
  inviteFirstHeadmanAction,
} from "@/server/actions/platform-actions";
export default async function PlatformPage() {
  const user = await requireCurrentUser();
  if (!user.isPlatformOwner) notFound();
  const groups = await loadPlatformDirectory(user);
  const accounts = new Set(
    groups.flatMap((g) => g.members.map((m) => m.user.id)),
  );
  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <p className="eyebrow">Управление сайтом</p>
        <h1 className="page-title">Группы и аккаунты</h1>
        <p className="page-intro">
          {groups.length} групп · {accounts.size} активированных аккаунтов.
          Запись в списке группы и регистрация на сайте — разные этапы.
        </p>
      </header>
      <div className="flex gap-5 flex-wrap">
        <Link className="text-link" href="/exchange">
          Работы соседних групп ↗
        </Link>
        <Link className="text-link" href="/group">
          Приглашения и назначение старост ↗
        </Link>
      </div>
      {groups.map((g) => (
        <section
          key={g.id}
          className="border-t border-slate-600 pt-6 space-y-4"
        >
          <h2 className="text-xl">
            {g.name} <span className="text-sm text-slate-300">{g.code}</span>
          </h2>
          <p className="text-sm text-slate-300">
            В списке: {g._count.enrollments} · Вошли на сайт: {g.members.length}{" "}
            · Предметов: {g._count.courses}
          </p>
          {g.members.length ? (
            <ul className="space-y-3">
              {g.members.map((m) => (
                <li key={m.user.id} className="flex flex-wrap gap-3 text-sm">
                  <strong>
                    {m.user.enrollments.find((e) => e.groupId === g.id)
                      ?.fullName ?? m.user.nickname}
                  </strong>
                  <span className="text-slate-300">{m.user.nickname}</span>
                  <span>{m.isOwner ? "Староста" : "Студент"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-300">
              Участники ещё не присоединились.
            </p>
          )}
          <details>
            <summary className="text-link cursor-pointer min-h-11">
              Обмен учебными материалами:{" "}
              {g.shareStudyContent ? "включён" : "выключен"}
            </summary>
            <OperationForm
              action={setGroupSharingAction}
              label={g.shareStudyContent ? "Отключить обмен" : "Включить обмен"}
            >
              <input type="hidden" name="groupId" value={g.id} />
              <input
                type="hidden"
                name="shared"
                value={String(!g.shareStudyContent)}
              />
              <p className="text-sm text-slate-300">
                Старосты смогут читать опубликованные задания всей группы, их
                сроки и приложенные материалы. Личные заметки, результаты,
                состав группы и индивидуальные задания в обмен не входят.
              </p>
            </OperationForm>
          </details>
          {!g.members.length && !g._count.enrollments && (
            <details>
              <summary className="text-link cursor-pointer min-h-11">
                Пригласить старосту
              </summary>
              <OperationForm
                action={inviteFirstHeadmanAction}
                label="Создать персональное приглашение"
              >
                <input type="hidden" name="groupId" value={g.id} />
                <label className="block">
                  ФИО старосты
                  <input name="fullName" required className={inputClass} />
                </label>
                <label className="block">
                  Google email старосты
                  <input
                    name="email"
                    type="email"
                    required
                    className={inputClass}
                  />
                </label>
              </OperationForm>
            </details>
          )}
        </section>
      ))}
      <details className="border-t border-slate-600 pt-5">
        <summary className="text-link cursor-pointer min-h-11">
          Добавить группу без приглашения старосты
        </summary>
        <OperationForm
          action={createEmptyGroupAction}
          label="Создать группу"
          className="mt-4"
        >
          <label className="block">
            Полный номер
            <input
              name="code"
              required
              className={inputClass}
              placeholder="5130901/40201"
            />
          </label>
          <label className="block">
            Название
            <input
              name="name"
              required
              className={inputClass}
              placeholder="201"
            />
          </label>
        </OperationForm>
      </details>
    </div>
  );
}
