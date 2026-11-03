/** Pick an actionable next step without letting an old overdue date dominate every visit. */
export interface PrioritizableWork {
  accepted: boolean;
  deadline: { date: Date } | null;
  userProgress?: { status: string } | null;
  timing: { urgency: string; daysRemaining: number | null };
}
export function chooseFocus<T extends PrioritizableWork>(
  tasks: T[],
): T | undefined {
  const open = tasks.filter(
    (t) =>
      !t.accepted &&
      !["READY", "SUBMITTED"].includes(t.userProgress?.status ?? ""),
  );
  const byDate = (a: T, b: T) =>
    (a.deadline?.date.getTime() ?? Infinity) -
    (b.deadline?.date.getTime() ?? Infinity);
  const upcoming = open
    .filter((t) => t.deadline && t.timing.urgency !== "OVERDUE")
    .sort(byDate);
  const urgent = upcoming.find(
    (t) => (t.timing.daysRemaining ?? Infinity) <= 7,
  );
  const fixes = open
    .filter((t) => t.userProgress?.status === "NEEDS_FIX")
    .sort(byDate);
  const active = open
    .filter((t) =>
      ["IN_PROGRESS", "READY"].includes(t.userProgress?.status ?? ""),
    )
    .sort(byDate);
  const overdue = open
    .filter((t) => t.timing.urgency === "OVERDUE")
    .sort((a, b) => byDate(b, a));
  return (
    urgent ?? fixes[0] ?? active[0] ?? upcoming[0] ?? overdue[0] ?? open[0]
  );
}
