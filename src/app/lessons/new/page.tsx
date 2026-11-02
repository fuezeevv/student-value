import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { canEditCourse } from "@/server/domain/lessons";
import { taskVisibilityWhere } from "@/server/domain/access";
import { LessonForm } from "@/components/workspace/LessonForm";
export default async function NewLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const user = await requireCurrentUser();
  const { course } = await searchParams;
  const courses = (
    await prisma.courseOffering.findMany({
      where: {
        status: "ACTIVE",
        mergedIntoId: null,
        groups: { some: { groupId: user.groupId } },
      },
      include: { courseDefinition: true },
    })
  ).filter((c) => canEditCourse(user, c.id));
  const selected = courses.find((c) => c.id === course);
  if (course && !selected) notFound();
  const tasks = selected
    ? await prisma.task.findMany({
        where: {
          AND: [
            await taskVisibilityWhere(user),
            { courseOfferingId: selected.id },
          ],
        },
        select: { id: true, title: true },
      })
    : [];
  return (
    <div className="max-w-2xl mx-auto space-y-7">
      <Link className="text-link" href="/lessons">
        ← Занятия
      </Link>
      <div>
        <p className="eyebrow">
          {selected?.courseDefinition.shortTitle ?? user.groupName}
        </p>
        <h1 className="page-title">Добавить занятие</h1>
      </div>
      {selected ? (
        <LessonForm courseId={selected.id} tasks={tasks} />
      ) : courses.length ? (
        <form className="space-y-5">
          <label className="block text-sm">
            Выберите предмет
            <select
              name="course"
              className="block w-full mt-3 min-h-12 bg-[#142139] rounded-xl px-4 border border-slate-600"
            >
              {courses.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.courseDefinition.title}
                </option>
              ))}
            </select>
          </label>
          <button className="action-primary">Далее</button>
        </form>
      ) : (
        <p className="quiet-empty">
          Нет предметов, которые вы можете редактировать. Староста может
          добавить предмет в{" "}
          <Link className="text-link" href="/group">
            пространстве группы
          </Link>
          .
        </p>
      )}
    </div>
  );
}
