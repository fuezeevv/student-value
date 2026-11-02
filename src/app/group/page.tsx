import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/checker";
import { OperationForm } from "@/components/workspace/OperationForm";
import { inputClass } from "@/components/workspace/styles";
import {
  inviteMemberAction,
  reissueHeadmanAction,
  createGroupAction,
  delegateCourseAction,
  addCourseAction,
} from "@/server/actions/group-actions";

export default async function GroupPage() {
  const user = await requireCurrentUser();
  const privateAccess = hasPermission(user, "view_private_member_identity");
  const invite = privateAccess && hasPermission(user, "manage_members");
  const [group, courses, enrollments, members, platformGroups] =
    await Promise.all([
      prisma.studyGroup.findUniqueOrThrow({ where: { id: user.groupId } }),
      prisma.courseOffering.findMany({
        where: {
          status: "ACTIVE",
          mergedIntoId: null,
          groups: { some: { groupId: user.groupId } },
        },
        include: { courseDefinition: true },
      }),
      privateAccess
        ? prisma.enrollment.findMany({
            where: { groupId: user.groupId, status: { not: "ARCHIVED" } },
            select: { id: true, fullName: true, userId: true, status: true },
            orderBy: { fullName: "asc" },
          })
        : [],
      hasPermission(user, "manage_roles")
        ? prisma.groupMember.findMany({
            where: { groupId: user.groupId, isOwner: false },
            include: {
              user: { select: { nickname: true } },
              userRoles: {
                include: { role: { include: { permissions: true } } },
              },
            },
          })
        : [],
      user.isPlatformOwner
        ? prisma.studyGroup.findMany({
            select: {
              id: true,
              name: true,
              code: true,
              _count: { select: { members: true } },
            },
            orderBy: { createdAt: "desc" },
          })
        : [],
    ]);
  return (
    <div className="max-w-4xl mx-auto space-y-9">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Учебное пространство</p>
          <h1 className="page-title">{group.name}</h1>
          <p className="page-intro">
            {group.code} · задания, занятия и права этой группы отделены от
            других пространств.
          </p>
        </div>
      </header>
      <div className="flex flex-wrap gap-5">
        <Link className="text-link" href="/members">
          Участники ↗
        </Link>
        <Link className="text-link" href="/join">
          Присоединиться к другой группе ↗
        </Link>
        <Link className="text-link" href="/exchange">
          Информация соседних групп ↗
        </Link>
      </div>
      {invite && (
        <section className="border-t border-slate-700 pt-7">
          <h2 className="text-xl mb-3">Пригласить студента</h2>
          <p className="text-sm text-slate-400 mb-5">
            Укажите точные ФИО из списка и Google email самого студента. Вход
            через Google свяжет его с этой записью. Код показывается после
            создания, а в базе хранится только его хеш.
          </p>
          <OperationForm
            action={inviteMemberAction}
            label="Подготовить персональный код"
          >
            <label className="block text-sm">
              ФИО из списка
              <input
                className={inputClass}
                name="fullName"
                list="group-roster"
                required
                minLength={2}
                maxLength={160}
              />
              <datalist id="group-roster">
                {enrollments
                  .filter((e) => !e.userId)
                  .map((e) => (
                    <option key={e.id} value={e.fullName} />
                  ))}
              </datalist>
            </label>
            <label className="block text-sm">
              Google email
              <input
                className={inputClass}
                name="email"
                type="email"
                required
                maxLength={254}
              />
            </label>
            <details>
              <summary className="cursor-pointer text-sm min-h-11">
                Подгруппа для новой записи
              </summary>
              <input
                aria-label="Подгруппа"
                className={inputClass}
                type="number"
                name="subgroup"
                min={1}
                max={50}
              />
            </details>
          </OperationForm>
        </section>
      )}
      {hasPermission(user, "manage_roles") && (
        <section className="border-t border-slate-700 pt-7">
          <h2 className="text-xl mb-3">Делегировать предмет</h2>
          <p className="text-sm text-slate-400 mb-5">
            Редактор ведёт работы, занятия и предложения только выбранного
            предмета. Он не получает список с ФИО, права на другие предметы или
            право подтверждать зачёт.
          </p>
          {members.length && courses.length ? (
            <>
              <OperationForm
                action={delegateCourseAction}
                label="Обновить доступ"
              >
                <label className="block text-sm">
                  Участник
                  <select name="memberId" className={inputClass}>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.user.nickname}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Предмет
                  <select name="courseId" className={inputClass}>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.courseDefinition.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Доступ
                  <select name="enabled" className={inputClass}>
                    <option value="true">Разрешить вести предмет</option>
                    <option value="false">Отозвать доступ к предмету</option>
                  </select>
                </label>
              </OperationForm>
              <ul className="mt-5 text-sm text-slate-400">
                {members.flatMap((m) =>
                  m.userRoles.flatMap((r) =>
                    r.role.permissions
                      .filter((p) => p.permission.startsWith("manage_course:"))
                      .map((p) => (
                        <li key={m.id + p.permission}>
                          {m.user.nickname} ·{" "}
                          {courses.find(
                            (c) => `manage_course:${c.id}` === p.permission,
                          )?.courseDefinition.shortTitle ?? "Предмет"}
                        </li>
                      )),
                  ),
                )}
              </ul>
            </>
          ) : (
            <p className="quiet-empty">
              Пригласите участника и добавьте предмет — затем здесь можно
              поручить ему часть работы.
            </p>
          )}
        </section>
      )}
      {hasPermission(user, "manage_courses") && (
        <section className="border-t border-slate-700 pt-7">
          <h2 className="text-xl mb-4">Добавить предмет</h2>
          <OperationForm
            action={addCourseAction}
            label="Добавить предмет"
            reset
          >
            <label className="block text-sm">
              Название
              <input
                name="title"
                className={inputClass}
                required
                minLength={2}
                maxLength={160}
              />
            </label>
            <details>
              <summary className="cursor-pointer min-h-11 text-sm">
                Короткое название и учебный период
              </summary>
              <label className="block text-sm mt-3">
                Короткое название
                <input
                  name="shortTitle"
                  className={inputClass}
                  maxLength={160}
                />
              </label>
              <label className="block text-sm mt-3">
                Название периода
                <input name="semester" className={inputClass} maxLength={160} />
              </label>
              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <label className="text-sm">
                  Начало
                  <input type="date" name="startDay" className={inputClass} />
                </label>
                <label className="text-sm">
                  Конец
                  <input type="date" name="endDay" className={inputClass} />
                </label>
              </div>
            </details>
          </OperationForm>
        </section>
      )}
      {user.isPlatformOwner && (
        <section className="border-t border-slate-700 pt-7">
          <h2 className="text-xl mb-3">Подключить другую группу</h2>
          <p className="text-sm text-slate-400 mb-5">
            Создаётся пустое пространство и персональное приглашение старосте.
            Задания и сроки вашей группы туда не копируются. Староста получает
            права только после Google-входа по своему коду.
          </p>
          <OperationForm
            action={createGroupAction}
            label="Создать пространство группы"
          >
            <label className="block text-sm">
              Код группы
              <input
                name="code"
                className={inputClass}
                required
                minLength={2}
                maxLength={160}
              />
            </label>
            <label className="block text-sm">
              Название группы
              <input
                name="name"
                className={inputClass}
                required
                minLength={2}
                maxLength={160}
              />
            </label>
            <label className="block text-sm">
              ФИО старосты
              <input
                name="headmanName"
                className={inputClass}
                required
                minLength={2}
                maxLength={160}
              />
            </label>
            <label className="block text-sm">
              Google email старосты
              <input
                name="headmanEmail"
                className={inputClass}
                required
                type="email"
                maxLength={254}
              />
            </label>
          </OperationForm>
          <details className="mt-6">
            <summary className="text-link cursor-pointer min-h-11">
              Перевыпустить код старосты
            </summary>
            <OperationForm
              action={reissueHeadmanAction}
              label="Подготовить новый код"
              className="mt-4"
            >
              <label className="block text-sm">
                Группа
                <select name="groupId" className={inputClass}>
                  {platformGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Google email первоначального получателя
                <input
                  name="email"
                  type="email"
                  required
                  className={inputClass}
                />
              </label>
              <p className="text-xs text-slate-400">
                Для истёкшего или потерянного приглашения. Получателя нельзя
                заменить; после первого входа этот путь закрыт.
              </p>
            </OperationForm>
          </details>
          <p className="eyebrow mt-8 mb-3">Подключённые пространства</p>
          <ul className="text-sm space-y-2 text-slate-400">
            {platformGroups.map((g) => (
              <li key={g.id}>
                {g.name} · {g.code} · {g._count.members} участников
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 mt-3">
            Владение платформой не открывает учебные страницы чужой группы или
            личные заметки её студентов.
          </p>
        </section>
      )}
    </div>
  );
}
