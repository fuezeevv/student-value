/** Owner-requested display exclusions; original RUZ snapshots remain unchanged. */
export function showStudentScheduleSubject(subject: string): boolean {
  const normalized = subject
    .toLocaleLowerCase("ru-RU")
    .replace(/[^а-яёa-z0-9]/g, "");
  return ![
    "военнаяподготовка",
    "образовательныйфорсайт",
    "научноисследовательскаяработа",
  ].some((prefix) => normalized.startsWith(prefix));
}
export function lessonTypeLabel(type: string): string {
  const key = type.trim().toLocaleLowerCase("ru-RU").replace(/\.$/, "");
  return (
    (
      {
        лек: "Лекция",
        лекция: "Лекция",
        лекции: "Лекция",
        лк: "Лекция",
        лаб: "Лабораторная",
        лабораторные: "Лабораторная",
        лб: "Лабораторная",
        пр: "Практика",
        практ: "Практика",
        пз: "Практика",
        кпр: "Курсовой проект",
      } as Record<string, string>
    )[key] ?? type
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
  const raw = value.trim();
  const prefix = /^(\d+)-(\d[^·•]*)$/.exec(raw);
  const compact = /^(\d+|Гл\.?|ГИ)\s*к\.?(?:\s+|(?=\d))(\d\S*)$/i.exec(raw);
  const split = prefix
    ? [prefix[1] + " к.", prefix[2]]
    : compact
      ? [compact[1] + " к.", compact[2]]
      : raw.split(/\s*[·•]\s*/);
  if (split.length < 2) return raw;
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
  if (/^(?:ГЗ|Гл\.?(?: к\.?)?)$/i.test(building)) building = "Главное здание";
  if (/^ГИ(?: к\.?)?$/i.test(building)) building = "Гуманитарный институт";
  return `${building} · ${/^ауд\.?\s/i.test(room) ? room : "аудитория " + room}`;
}
