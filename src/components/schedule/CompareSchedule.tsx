"use client";
import { useEffect, useState } from "react";
import { GroupSchedulePicker } from "./GroupSchedulePicker";
import { groupParts, type CatalogGroup } from "@/lib/schedule/catalog";
import { teachingRoom, lessonType } from "@/lib/schedule/presentation";
import {
  validDay,
  addDays,
  weekStartFor,
  moscowDay,
  type RuzWeek,
} from "@/lib/schedule/ruz";
export function CompareSchedule() {
  const [selected, setSelected] = useState<CatalogGroup[]>([]),
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
    let active = true;
    try {
      const saved = JSON.parse(
        localStorage.getItem("sv-compared-groups-v2") || "null",
      );
      if (Array.isArray(saved)) {
        setSelected(
          saved
            .filter(
              (g) =>
                Number.isSafeInteger(g?.id) &&
                Number.isSafeInteger(g?.facultyId) &&
                typeof g?.name === "string" &&
                !!groupParts(g.name),
            )
            .slice(0, 3),
        );
      } else {
        const old = JSON.parse(
          localStorage.getItem("sv-compared-groups") || "[]",
        );
        if (Array.isArray(old) && old.length)
          fetch("/api/timetable/groups")
            .then((r) => r.json())
            .then((groups: CatalogGroup[]) => {
              if (active && Array.isArray(groups))
                setSelected(
                  groups.filter((g) => old.includes(g.name)).slice(0, 3),
                );
            })
            .catch(() => {});
      }
    } catch {}
    return () => {
      active = false;
    };
  }, []);
  const saveSelected = (next: CatalogGroup[]) => {
    setSelected(next);
    try {
      localStorage.setItem("sv-compared-groups-v2", JSON.stringify(next));
    } catch {}
  };
  useEffect(() => {
    let active = true;
    setBusy(true);
    Promise.all(
      selected.map(async (g) => {
        const name = g.name;
        const slug = name;
        try {
          const r = await fetch(
            `/api/timetable?group=${encodeURIComponent(slug)}&id=${g.id}&faculty=${g.facultyId}&week=${week}`,
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
  }, [selected, week]);
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
      <p>
        До трёх групп одновременно и полное расписание одного преподавателя.
        Учебные результаты других групп не открываются.
      </p>
      <GroupSchedulePicker
        onSelect={(g) => {
          if (selected.some((x) => x.id === g.id)) return;
          if (!selected.length) {
            const archive = groupParts(g.name)?.archive;
            if (archive) {
              const day = archive + moscowDay().slice(4);
              setWeek(weekStartFor(validDay(day) ? day : archive + "-03-01"));
            }
          }
          saveSelected([...selected, g].slice(-3));
        }}
      />
      <div className="flex flex-wrap gap-2">
        {selected.map((g) => (
          <button
            key={g.id}
            onClick={() => saveSelected(selected.filter((x) => x.id !== g.id))}
          >
            {g.name} ×
          </button>
        ))}
      </div>
      <nav className="flex justify-between">
        <button onClick={() => setWeek(addDays(week, -7))}>← Неделя</button>
        <input
          type="date"
          aria-label="Неделя сравнения"
          min={addDays(moscowDay(), -1823)}
          max={addDays(moscowDay(), 176)}
          value={week}
          onChange={(e) => {
            if (e.target.value) setWeek(weekStartFor(e.target.value));
          }}
        />
        <button onClick={() => setWeek(addDays(week, 7))}>Неделя →</button>
      </nav>
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
                    {lessonType(l.type)} ·{" "}
                    {l.rooms.map(teachingRoom).join(" / ")}
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
              {r.data.days.every((d) => !d.lessons.length) && (
                <p>В РУЗ нет занятий на эту неделю. Выберите другую дату.</p>
              )}
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
                        {lessonType(l.type)} ·{" "}
                        {l.rooms.map(teachingRoom).join(" / ")}
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
