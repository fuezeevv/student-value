import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { loadSharedCourse } from "@/server/domain/platform-workspace";
import { formatInTimeZone } from "date-fns-tz";
export default async function SharedCourse({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCurrentUser();
  const c = await loadSharedCourse(user, (await params).id).catch(() => null);
  if (!c) notFound();
  return (
    <div className="space-y-7 max-w-4xl">
      <Link className="text-link" href="/exchange">
        ← Соседние группы
      </Link>
      <header>
        <p className="eyebrow">{c.groups[0].group.name}</p>
        <h1 className="page-title">{c.courseDefinition.title}</h1>
        <p className="page-intro">
          Общие задания этой группы. Сроки и варианты своей группы проверяйте
          отдельно.
        </p>
      </header>
      {c.tasks.map((t) => (
        <article className="work-item" key={t.id}>
          <div className="work-item-body">
            <h2 className="work-title">{t.title}</h2>
            {t.deadlines.map((d, i) => (
              <p key={i} className="mt-2 text-sm text-blue-100">
                {d.title ?? "Срок"}:{" "}
                {formatInTimeZone(d.date, "Europe/Moscow", "dd.MM.yyyy")}
              </p>
            ))}
            <p className="text-slate-200 whitespace-pre-wrap text-sm leading-7 mt-3">
              {t.description}
            </p>
            <div className="work-files">
              {t.materials.map(({ material: m }) => (
                <a
                  key={m.id}
                  className="work-file"
                  href={
                    m.url.startsWith("/materials/")
                      ? `/exchange/materials/${m.id}`
                      : m.url
                  }
                >
                  {m.title} ↗
                </a>
              ))}
            </div>
          </div>
        </article>
      ))}
      {!c.tasks.length && <p>Общие работы пока не опубликованы.</p>}
    </div>
  );
}
