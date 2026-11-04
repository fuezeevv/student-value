// The eight officially verified group codes explicitly opened for guest browsing.
// This is a public catalog, never membership, enrollment, or authentication.
export const publicGroups = [
  { code: "5130901/40101", track: "ИВТ", label: "101", ruzId: 45590 },
  { code: "5130901/40102", track: "ИВТ", label: "102", ruzId: 45591 },
  { code: "5130901/40201", track: "ИВТ", label: "201", ruzId: 45592 },
  { code: "5130901/40202", track: "ИВТ", label: "202", ruzId: 45593 },
  { code: "5130902/40201", track: "ИСиТ", label: "201", ruzId: 45594 },
  { code: "5130902/40202", track: "ИСиТ", label: "202", ruzId: 45595 },
  { code: "5130902/40203", track: "ИСиТ", label: "203", ruzId: 45596 },
  { code: "5130902/40204", track: "ИСиТ", label: "204", ruzId: 45597 },
] as const;
export function publicGroupDefinition(slug: string) {
  return publicGroups.find((group) => group.code.replace("/", "-") === slug);
}
export function browsePath(code: string) {
  return `/browse/${code.replace("/", "-")}`;
}
