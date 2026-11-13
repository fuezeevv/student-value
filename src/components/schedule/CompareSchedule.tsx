"use client";
import { useEffect, useState } from "react";
import {
  addDays,
  weekStartFor,
  moscowDay,
  type RuzWeek,
} from "@/lib/schedule/ruz";
export function CompareSchedule() {
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [week, setWeek] = useState(weekStartFor(moscowDay())),
    [results, setResults] = useState<
      {
        group: string;
        data: RuzWeek | null;
        state: string;
        fetchedAt?: string;
      }[]
    >([]),
    [teacher, setTeacher] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [searchName, setSearchName] = useState(""),
    [foundTeachers, setFoundTeachers] = useState<
      { id: number; full_name: string }[]
    >([]),
    [selectedTeacher, setSelectedTeacher] = useState<{
      id: number;
      full_name: string;
    } | null>(null),
    [teacherResult, setTeacherResult] = useState<{
      data: RuzWeek | null;
      error?: string;
      state?: string;
    } | null>(null),
    [searchError, setSearchError] = useState("");
  useEffect(() => {
    try {
      const old = JSON.parse(
        localStorage.getItem("sv-compared-groups") || "[]",
      );
      if (Array.isArray(old))
        setSelected(old.filter((x) => typeof x === "string").slice(0, 3));
    } catch {}
    fetch("/api/timetable/groups")
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    setBusy(true);
    Promise.all(
      selected.map(async (name) => {
        const g = groups.find((g) => g.name === name);
        if (!g) return { group: name, data: null, state: "UNAVAILABLE" };
        const slug = name.replace("/", "-");
        try {
          const r = await fetch(
            `/api/timetable?group=${encodeURIComponent(slug)}&id=${g.id}&week=${week}`,
          );
          const result = await r.json();
          return { ...result, group: name };
        } catch {
          return { group: name, data: null, state: "UNAVAILABLE" };
        }
      }),
    ).then((r) => {
      if (active) {
        setResults(r);
        setBusy(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selected, week, groups]);
  useEffect(() => {
    if (!selectedTeacher) {
      setTeacherResult(null);
      return;
    }
    let active = true;
    setTeacherResult(null);
    fetch(`/api/timetable/teachers?id=${selectedTeacher.id}&week=${week}`)
      .then((r) => r.json())
      .then((r) => {
        if (active) setTeacherResult(r);
      })
      .catch(() => {
        if (active) setTeacherResult({ data: null, error: "Нет соединения" });
      });
    return () => {
      active = false;
    };
  }, [selectedTeacher, week]);
  const room = (value: string) =>
    value.replace(/^(\d+)\s*к\.?\s*[·•-]?\s*(\d+.*)$/i, "$1-$2");
  const dateLabel = (value: string) =>
    new Date(value + "T12:00:00+03:00").toLocaleDateString("ru-RU", {
      weekday: "short",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Moscow",
    });
  const teachers = [
    ...new Set(
      results.flatMap(
        (r) =>
          r.data?.days.flatMap((d) => d.lessons.flatMap((l) => l.teachers)) ||
          [],
      ),
    ),
  ].sort();
  return (
    <details className="schedule-compare">
      <summary>Сравнить группы и расписание преподавателя</summary>
      <label>
        Найти преподавателя в РУЗ
        <input
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Фамилия преподавателя"
        />
      </label>
      <button
        onClick={async () => {
          setSearchError("");
          try {
            const r = await fetch(
                "/api/timetable/teachers?q=" + encodeURIComponent(searchName),
              ),
              data = await r.json();
            if (!r.ok) throw Error(data.error);
            setFoundTeachers(data);
          } catch {
            setSearchError(
              "Поиск недоступен. Проверьте соединение и введите не менее трёх букв.",
            );
          }
        }}
      >
        Найти
      </button>
      {searchError && <p role="status">{searchError}</p>}
      {foundTeachers.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            setSelectedTeacher(t);
            setFoundTeachers([]);
          }}
        >
          {t.full_name} +
        </button>
      ))}
      {selectedTeacher && (
        <section>
          <h3>
            {selectedTeacher.full_name}
            <button onClick={() => setSelectedTeacher(null)}> ×</button>
          </h3>
          {teacherResult?.state === "STALE" && (
            <p>Сохранённая копия расписания преподавателя</p>
          )}
          {teacherResult?.data?.days.length === 0 && (
            <p>В РУЗ нет занятий на выбранную неделю.</p>
          )}
          {teacherResult?.data ? (
            teacherResult.data.days.map((d) => (
              <div key={d.date}>
                <h4>{dateLabel(d.date)}</h4>
                {d.lessons.map((l, i) => (
                  <p key={i}>
                    {l.start}–{l.end} · {l.subject}
                    <br />
                    {l.type} · {l.rooms.map(room).join(" / ")}
                    <br />
                    {l.note}
                  </p>
                ))}
              </div>
            ))
          ) : (
            <p>
              {teacherResult?.error || "Получаем расписание преподавателя…"}
            </p>
          )}
        </section>
      )}
      <p>
        До трёх групп института одновременно и полное расписание одного
        преподавателя. Учебные результаты других групп не открываются.
      </p>
      <input
        aria-label="Поиск группы"
        placeholder="Номер нынешней или прежней группы"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        aria-label="Добавить расписание группы"
        value=""
        onChange={(e) =>
          setSelected((v) => {
            const next = v.includes(e.target.value)
              ? v
              : [...v, e.target.value].slice(-3);
            try {
              localStorage.setItem("sv-compared-groups", JSON.stringify(next));
            } catch {}
            return next;
          })
        }
      >
        <option value="">Выберите группу</option>
        {groups
          .filter((g) => g.name.includes(query))
          .map((g) => (
            <option value={g.name} key={g.id}>
              {g.name}
            </option>
          ))}
      </select>
      <div className="flex flex-wrap gap-2">
        {selected.map((g) => (
          <button
            key={g}
            onClick={() =>
              setSelected((v) => {
                const next = v.filter((x) => x !== g);
                try {
                  localStorage.setItem(
                    "sv-compared-groups",
                    JSON.stringify(next),
                  );
                } catch {}
                return next;
              })
            }
          >
            {g} ×
          </button>
        ))}
      </div>
      <nav className="flex justify-between">
        <button onClick={() => setWeek(addDays(week, -7))}>← Неделя</button>
        <input
          type="date"
          aria-label="Неделя сравнения"
          min={addDays(moscowDay(), -176)}
          max={addDays(moscowDay(), 176)}
          value={week}
          onChange={(e) => {
            if (e.target.value) setWeek(weekStartFor(e.target.value));
          }}
        />
        <button onClick={() => setWeek(addDays(week, 7))}>Неделя →</button>
      </nav>
      <select
        aria-label="Преподаватель выбранных групп"
        value={teacher}
        onChange={(e) => setTeacher(e.target.value)}
      >
        <option value="">Все преподаватели</option>
        {teachers.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      {busy && <p role="status">Получаем расписания…</p>}
      {results.map((r) => (
        <section key={r.group}>
          <h3>{r.group}</h3>
          {!r.data ? (
            <p>Не удалось получить расписание. Занятия могут быть.</p>
          ) : (
            <>
              {r.state === "STALE" && <p>Сохранённая копия · {r.fetchedAt}</p>}
              {r.data.days.map((d) => {
                const lessons = d.lessons.filter(
                  (l) => !teacher || l.teachers.includes(teacher),
                );
                return lessons.length ? (
                  <div key={d.date}>
                    <h4>
                      {new Date(d.date + "T12:00:00+03:00").toLocaleDateString(
                        "ru-RU",
                        {
                          weekday: "short",
                          day: "numeric",
                          month: "long",
                          timeZone: "Europe/Moscow",
                        },
                      )}
                    </h4>
                    {lessons.map((l, i) => (
                      <p key={i}>
                        {l.start}–{l.end} · {l.subject}
                        <br />
                        {l.type} · {l.rooms.map(room).join(" / ")}
                        <br />
                        {l.teachers.join(", ")}
                      </p>
                    ))}
                  </div>
                ) : null;
              })}
            </>
          )}
        </section>
      ))}
    </details>
  );
}
