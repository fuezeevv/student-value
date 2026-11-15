import { expect, it } from "vitest";
import { parseUniversitySnapshot } from "../src/lib/university/snapshot";
const snapshot = {
  version: 1,
  kind: "recordbook",
  sourceUrl: "https://my.spbstu.ru/science-and-education/recordbook/",
  capturedAt: "2026-01-01T10:00:00Z",
  context: "[TEST] Семестр 1 · строки 1–1",
  columns: ["Дисциплина", "Оценка"],
  rows: [["[TEST] Дисциплина", "[TEST] Результат"]],
};
it("reads bounded selected rows without promoting uploaded results to trusted academic facts", () => {
  expect(parseUniversitySnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  expect(parseUniversitySnapshot(JSON.stringify(snapshot))).not.toHaveProperty(
    "verified",
  );
});
it("rejects external URLs, mixed sources, credentials and malformed tables", () => {
  for (const patch of [
    { sourceUrl: "https://attacker.invalid/recordbook/" },
    { kind: "study-plan" },
    { rows: [["missing cell"]] },
    { columns: ["Пароль", "Куки"] },
    { token: "do-not-store" },
    { capturedAt: "2099-01-01T00:00:00Z" },
    { rows: Array.from({ length: 501 }, () => snapshot.rows[0]) },
  ])
    expect(() =>
      parseUniversitySnapshot(JSON.stringify({ ...snapshot, ...patch })),
    ).toThrow();
});
it("rejects oversized imports before parsing JSON", () => {
  expect(() => parseUniversitySnapshot(" ".repeat(1024 * 1024 + 1))).toThrow(
    "большой",
  );
});
