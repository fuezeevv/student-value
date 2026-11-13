/** Activity length confirmed by the group owner; original RUZ slots remain unchanged. */
export function lessonActivity(start: string, now: string) {
  const minutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  const elapsed = minutes(now) - minutes(start);
  const end = minutes(start) + 90;
  return {
    active: elapsed >= 0 && elapsed < 90,
    progress: Math.max(0, Math.min(100, (elapsed / 90) * 100)),
    end: `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
  };
}
export function lessonType(value: string) {
  return (
    (
      {
        лек: "Лекция",
        лекция: "Лекция",
        лекции: "Лекция",
        лаб: "Лабораторная",
        лабораторные: "Лабораторная",
        пр: "Практика",
        практ: "Практика",
      } as Record<string, string>
    )[value.toLowerCase().replace(/\.$/, "")] || value
  );
}
const ordinals = [
  "",
  "Первый",
  "Второй",
  "Третий",
  "Четвёртый",
  "Пятый",
  "Шестой",
  "Седьмой",
  "Восьмой",
  "Девятый",
  "Десятый",
  "Одиннадцатый",
  "Двенадцатый",
  "Тринадцатый",
  "Четырнадцатый",
  "Пятнадцатый",
];
export function teachingRoom(value: string) {
  const prefix = /^(\d+)-(\d[^·•]*)$/.exec(value);
  const split = prefix
    ? [prefix[1] + " к.", prefix[2]]
    : value.split(/\s*[·•]\s*/);
  if (split.length < 2) return value;
  let building = split.shift()!;
  let room = split.join(" · ");
  const numeric = /^(\d+)\s*(?:к\.?|(?:-й)?\s*(?:учебный\s+)?корпус)$/i.exec(
    building,
  );
  if (numeric) {
    const n = Number(numeric[1]);
    building = ordinals[n] ? `${ordinals[n]} корпус` : `${n}-й корпус`;
    room = room.replace(new RegExp(`^${n}-`), "");
  }
  if (/^ГЗ$/i.test(building)) building = "Главное здание";
  return `${building} · ${/^ауд\.?\s/i.test(room) ? room : "аудитория " + room}`;
}
