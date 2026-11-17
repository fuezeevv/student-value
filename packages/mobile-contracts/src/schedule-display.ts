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
        лк: "Лекция",
        лаб: "Лабораторная",
        лб: "Лабораторная",
        пр: "Практика",
        пз: "Практика",
        кпр: "Курсовой проект",
      } as Record<string, string>
    )[key] ?? type
  );
}
