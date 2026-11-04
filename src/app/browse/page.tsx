import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { browsePath } from "@/lib/groups/public-groups";
import { loadPublicGroups } from "@/server/queries/public-workspace";
export default async function BrowsePage() {
  const groups = await loadPublicGroups();
  return (
    <div className="preview-landing">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Student Value 1.984 · СПбПУ</p>
          <h1 className="page-title">Выберите группу</h1>
          <p className="page-intro">
            Выберите группу — её общие работы, сроки и расписание откроются
            сразу. Без Google и кода приглашения.
          </p>
        </div>
      </div>
      {(["ИВТ", "ИСиТ"] as const).map((track) => (
        <section className="preview-track" key={track}>
          <h2>{track}</h2>
          <div className="preview-group-list">
            {groups
              .filter((g) => g.track === track)
              .map((group) => (
                <Link
                  className="preview-group"
                  key={group.code}
                  href={browsePath(group.code)}
                >
                  <strong>{group.label}</strong>
                  <span>{group.code}</span>
                  <ArrowUpRight size={20} />
                </Link>
              ))}
          </div>
        </section>
      ))}
      <p className="preview-explainer">
        Это гостевой просмотр. Он не создаёт аккаунт, не начисляет XP и не
        сохраняет отметки о выполнении. Для личного прогресса, файлов и Google
        Calendar — <Link href="/login">войдите в свою группу</Link>.
      </p>
      {!groups.length && (
        <p className="quiet-empty">Список групп пока недоступен.</p>
      )}
    </div>
  );
}
