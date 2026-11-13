import { moscowDay, weekStartFor } from "./ruz";
export type CatalogGroup = {
  id: number;
  name: string;
  facultyId: number;
  level?: number;
  year?: number;
  spec?: string;
};
export type Institute = { id: number; name: string; abbr: string };
export function groupParts(name: string) {
  const m = /^([^/\s]{1,40})\/([^/_\s]{1,40})(?:_(\d{4}))?$/.exec(name);
  return m ? { direction: m[1], number: m[2], archive: m[3] || "" } : null;
}
/** Comparison is read-only and includes the previous five years; normal workspace limits stay unchanged. */
export function comparisonWeek(raw?: string, now = new Date()) {
  const today = moscowDay(now),
    week = weekStartFor(raw || today),
    diff = (Date.parse(week) - Date.parse(today)) / 86400000;
  if (diff < -1830 || diff > 183) throw Error("Week outside comparison period");
  return week;
}
