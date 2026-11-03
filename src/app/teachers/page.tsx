import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
export default async function Teachers() {
  const user = await requireCurrentUser();
  const courses = await prisma.courseOffering.findMany({
    where: {
      status: "ACTIVE",
      mergedIntoId: null,
      groups: { some: { groupId: user.groupId } },
      semester: { isCurrent: true },
    },
    include: {
      courseDefinition: true,
      teachers: { include: { teacher: true } },
    },
    orderBy: { courseDefinition: { title: "asc" } },
  });
  return (
    <div className="space-y-7 max-w-4xl">
      <header>
        <p className="eyebrow">Связь по учёбе</p>
        <h1 className="page-title">Преподаватели</h1>
        <p className="page-intro">
          Кто ведёт лекции, практики и лабораторные вашей группы.
        </p>
      </header>
      {courses.map((c) => (
        <section
          key={c.id}
          className="border-t border-slate-600 pt-5 space-y-3"
        >
          <Link className="text-link text-lg" href={`/courses/${c.id}`}>
            {c.courseDefinition.title} ↗
          </Link>
          {c.teachers.map((r) => (
            <div key={r.id} className="py-2">
              <h2 className="text-lg text-slate-100">{r.teacher.fullName}</h2>
              <p className="text-sm text-slate-200">{r.role}</p>
              {r.teacher.email && (
                <a
                  className="text-link block mt-2"
                  href={`mailto:${r.teacher.email}`}
                >
                  {r.teacher.email}
                </a>
              )}
              {r.teacher.telegram && (
                <p className="text-sm mt-2">Telegram: {r.teacher.telegram}</p>
              )}
              {r.status !== "CONFIRMED" && (
                <p className="text-sm text-amber-200">
                  Участие в занятиях вашей группы уточняется.
                </p>
              )}
              {r.teacher.notes && (
                <details className="text-sm text-slate-300 mt-2">
                  <summary className="cursor-pointer">
                    Контакты и источник
                  </summary>
                  <p className="whitespace-pre-wrap mt-2">{r.teacher.notes}</p>
                </details>
              )}
            </div>
          ))}
          {!c.teachers.length && (
            <p className="text-slate-300">Преподаватель ещё не указан.</p>
          )}
        </section>
      ))}
    </div>
  );
}
