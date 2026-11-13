import { z } from "zod";
import { publicRuzJson } from "./ruz-public-json";
import { publicGroups } from "@/lib/groups/public-groups";
const institute = z.object({
  id: z.number().int().positive().max(99999),
  name: z.string().max(300),
  abbr: z.string().max(100),
});
const group = z.object({
  id: z.number().int().positive().max(1000000),
  name: z.string().max(100),
  level: z.number().int().min(0).max(12).optional(),
  year: z.number().int().min(1900).max(2200).optional(),
  spec: z.string().max(500).optional(),
});
export async function loadInstitutes() {
  if (process.env.SV_TEST_ISOLATED === "1")
    return [
      {
        id: 125,
        name: "Институт компьютерных наук и кибербезопасности",
        abbr: "ИКНК",
      },
    ];
  return z
    .object({ faculties: z.array(institute).max(80) })
    .parse(await publicRuzJson("faculties")).faculties;
}
export async function loadFacultyGroups(facultyId: number) {
  const institutes = await loadInstitutes();
  if (!institutes.some((x) => x.id === facultyId))
    throw Error("Unknown institute");
  if (process.env.SV_TEST_ISOLATED === "1")
    return publicGroups.map((g) => ({
      id: g.ruzId,
      name: g.code,
      facultyId: 125,
      level: 3,
      year: 2026,
      spec: "",
    }));
  const raw = z
    .object({ faculty: institute, groups: z.array(group).max(3000) })
    .parse(await publicRuzJson(`faculties/${facultyId}/groups`));
  if (raw.faculty.id !== facultyId) throw Error("Institute mismatch");
  return raw.groups.map((g) => ({ ...g, facultyId }));
}
