export type DailyTask = {
  id: string;
  title: string;
  course: string;
  type: string;
  deadline: string | null;
};
export function planningLabels(task: DailyTask) {
  if (task.type !== "LABORATORY") return ["Поработать над заданием"];
  const range = /(Lab|ЛР)\s*(\d+)\s*[–—-]\s*(?:Lab|ЛР)?\s*(\d+)/i.exec(
    task.title,
  );
  if (range) {
    const start = Number(range[2]),
      end = Number(range[3]);
    if (end >= start && end - start < 20)
      return Array.from(
        { length: (end - start + 1) * 3 },
        (_, i) =>
          `${range[1]}${start + Math.floor(i / 3)} · часть ${(i % 3) + 1}/3`,
      );
  }
  return [
    "Первая часть работы · 1/3",
    "Вторая часть работы · 2/3",
    "Третья часть работы · 3/3",
  ];
}
/** Personal planning units. Recovery dates never replace academic deadlines. */
export function buildDailyPlan(
  tasks: DailyTask[],
  previousSteps: string[],
  now: number,
  starts: Record<string, number> = {},
) {
  const groups = new Map<string, DailyTask[]>();
  for (const t of tasks) {
    if (t.type === "OPTIONAL" || (t.course === "ОТУ" && t.type === "HOMEWORK"))
      continue;
    groups.set(t.course, [...(groups.get(t.course) || []), t]);
  }
  return [...groups.values()].flatMap((items) => {
    const work = items
      .map((task) => {
        const exact = task.deadline ? Date.parse(task.deadline) : NaN,
          estimated = !Number.isFinite(exact) || exact <= now,
          target = estimated ? (starts[task.id] ?? now) + 14 * 86400000 : exact,
          horizon = Math.max(1, Math.ceil((target - now) / 86400000));
        const steps = Array.from(
          { length: planningLabels(task).length },
          (_, stage) => ({
            task,
            stage,
            id: task.id + ":" + stage,
            horizon,
            estimated,
            target,
          }),
        ).filter((s) => !previousSteps.includes(s.id));
        return { steps, horizon, target, id: task.id };
      })
      .sort((a, b) => a.target - b.target || a.id.localeCompare(b.id));
    const quota = Math.ceil(
      work.reduce((sum, t) => sum + t.steps.length / t.horizon, 0),
    );
    return work.flatMap((t) => t.steps).slice(0, quota);
  });
}
