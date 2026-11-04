import { publicGroupDefinition } from "@/lib/groups/public-groups";
import { addDays, requestedWeek } from "@/lib/schedule/ruz";
import { collectRuzSubjects } from "@/lib/schedule/subjects";
import { loadPublicRuzSchedule, type ScheduleResult } from "./ruz";
export async function loadPublicSubjectCatalog(
  slug: string,
  options: {
    week?: string;
    now?: Date;
    loadWeek?: typeof loadPublicRuzSchedule;
  } = {},
) {
  const definition = publicGroupDefinition(slug);
  if (!definition) throw Error("Группа недоступна");
  const now = options.now ?? new Date(),
    start = requestedWeek(options.week, now);
  const requested = [0, 7, 14].map((n) => addDays(start, n));
  const results = await Promise.allSettled(
    requested.map((week) =>
      (options.loadWeek ?? loadPublicRuzSchedule)(slug, week, { now }),
    ),
  );
  const weeks: ScheduleResult[] = results.map((result, i) =>
    result.status === "fulfilled" &&
    result.value.weekStart === requested[i] &&
    (!result.value.data ||
      (result.value.data.groupId === definition.ruzId &&
        result.value.data.groupCode === definition.code &&
        result.value.data.weekStart === requested[i]))
      ? result.value
      : {
          state: "UNAVAILABLE",
          data: null,
          fetchedAt: null,
          subgroup: null,
          weekStart: requested[i],
        },
  );
  return {
    start,
    end: addDays(start, 20),
    weeks,
    subjects: collectRuzSubjects(weeks),
  };
}
export type PublicSubjectCatalog = Awaited<
  ReturnType<typeof loadPublicSubjectCatalog>
>;
