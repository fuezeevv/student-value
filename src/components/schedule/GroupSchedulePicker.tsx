"use client";
import { useEffect, useState } from "react";
import {
  groupParts,
  type CatalogGroup,
  type Institute,
} from "@/lib/schedule/catalog";
export function GroupSchedulePicker({
  onSelect,
}: {
  onSelect: (g: CatalogGroup) => void;
}) {
  const [institutes, setInstitutes] = useState<Institute[]>([]),
    [faculty, setFaculty] = useState("125"),
    [groups, setGroups] = useState<CatalogGroup[]>([]),
    [direction, setDirection] = useState(""),
    [number, setNumber] = useState(""),
    [level, setLevel] = useState(""),
    [archive, setArchive] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/timetable/institutes")
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((v) => {
        if (active) setInstitutes(v);
      })
      .catch(() => {
        if (active) setError("Не удалось получить институты РУЗ");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    setGroups([]);
    fetch("/api/timetable/groups?faculty=" + faculty)
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((v) => {
        if (active) setGroups(v);
      })
      .catch(() => {
        if (active)
          setError("Каталог групп временно недоступен. Проверьте подключение.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [faculty]);
  const parts = groups
    .map((g) => ({ ...g, parts: groupParts(g.name) }))
    .filter((g) => g.parts);
  const directions = [...new Set(parts.map((g) => g.parts!.direction))].sort(),
    levels = [
      ...new Set(parts.map((g) => g.level).filter((x): x is number => !!x)),
    ].sort((a, b) => a - b),
    archives = [...new Set(parts.map((g) => g.parts!.archive).filter(Boolean))]
      .sort()
      .reverse();
  const filtered = parts.filter(
    (g) =>
      (!direction || g.parts!.direction.startsWith(direction)) &&
      (!number || g.parts!.number.includes(number)) &&
      (!level || String(g.level) === level) &&
      (archive === "all" || g.parts!.archive === archive),
  );
  return (
    <div>
      <div className="group-catalog-filters">
        <label>
          Институт
          <select
            aria-label="Институт"
            value={faculty}
            onChange={(e) => {
              setFaculty(e.target.value);
              setDirection("");
              setNumber("");
              setLevel("");
              setArchive("");
            }}
          >
            {!institutes.length && <option value="125">ИКНК</option>}
            {institutes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.abbr} · {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Направление
          <select
            aria-label="Направление"
            value={directions.includes(direction) ? direction : ""}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="">Все направления</option>
            {directions.map((x) => (
              <option key={x} value={x}>
                {x}
                {faculty === "125" && x === "5130901"
                  ? " · ИВТ"
                  : faculty === "125" && x === "5130902"
                    ? " · ИСиТ"
                    : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Курс
          <select
            aria-label="Курс"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">Все курсы</option>
            {levels.map((x) => (
              <option key={x} value={x}>
                {x} курс
              </option>
            ))}
          </select>
        </label>
        <label>
          Учебный год
          <select
            aria-label="Учебный год расписания"
            value={archive}
            onChange={(e) => setArchive(e.target.value)}
          >
            <option value="">Текущие группы</option>
            {archives.map((x) => (
              <option key={x} value={x}>
                Архив · {x}
              </option>
            ))}
            <option value="all">Все годы</option>
          </select>
        </label>
      </div>
      <label>
        Номер группы
        <div className="group-code-fields">
          <input
            aria-label="Код направления"
            placeholder="5130901"
            inputMode="text"
            maxLength={40}
            value={direction}
            onChange={(e) => setDirection(e.target.value.trim())}
          />
          <span aria-hidden="true">/</span>
          <input
            aria-label="Номер группы"
            placeholder="40102"
            inputMode="text"
            maxLength={40}
            value={number}
            onChange={(e) => setNumber(e.target.value.trim())}
          />
        </div>
      </label>
      {busy && <p role="status">Получаем группы…</p>}
      {error && <p role="status">{error}</p>}
      <select
        aria-label="Добавить расписание группы"
        value=""
        disabled={busy}
        onChange={(e) => {
          const g = groups.find((g) => String(g.id) === e.target.value);
          if (g) onSelect(g);
        }}
      >
        <option value="">
          {filtered.length ? "Выберите группу" : "Нет подходящих групп"}
        </option>
        {filtered.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
            {g.level ? ` · ${g.level} курс` : ""}
            {g.parts!.archive ? ` · архив ${g.parts!.archive}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
