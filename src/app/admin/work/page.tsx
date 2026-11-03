import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/checker";
import { prisma } from "@/lib/db/prisma";
import { taskVisibilityWhere } from "@/server/domain/access";
import { OperationForm } from "@/components/workspace/OperationForm";
import { archiveTaskAction } from "@/server/actions/task-context-actions";
import { inputClass } from "@/components/workspace/styles";
export default async function WorkArchive() {
  const user = await requireCurrentUser();
  if (!hasPermission(user, "manage_tasks")) notFound();
  const tasks = await prisma.task.findMany({
    where: {
      ...(await taskVisibilityWhere(user)),
      status: "ARCHIVED",
      mergedIntoId: null,
    },
    include: { courseOffering: { include: { courseDefinition: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-7 max-w-3xl">
      <Link href="/admin" className="text-link">
        ← Панель старосты
      </Link>
      <h1 className="page-title">Архив работ</h1>
      <p className="page-intro">
        Отметки студентов и история сохраняются. После восстановления срок снова
        попадёт в календарь.
      </p>
      {tasks.map((t) => (
        <section className="border-t border-slate-600 pt-5" key={t.id}>
          <h2>
            {t.courseOffering.courseDefinition.shortTitle} · {t.title}
          </h2>
          <OperationForm
            action={archiveTaskAction}
            label="Восстановить работу"
            className="mt-4"
          >
            <input type="hidden" name="taskId" value={t.id} />
            <input type="hidden" name="restore" value="true" />
            <input
              name="reason"
              aria-label="Причина восстановления"
              required
              minLength={5}
              defaultValue="Возвращаю работу в учебный список"
              className={inputClass}
            />
          </OperationForm>
        </section>
      ))}
      {!tasks.length && (
        <p>Архив пуст. Убрать ошибочную работу можно на её странице.</p>
      )}
    </div>
  );
}
