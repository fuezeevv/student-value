import { it, expect } from "vitest";
import {
  lessonActivity,
  lessonType,
  teachingRoom,
} from "../src/lib/schedule/presentation";
import { groupParts, comparisonWeek } from "../src/lib/schedule/catalog";
it("ends activity after 90 minutes even when the RUZ slot includes a longer interval", () => {
  expect(lessonActivity("10:00", "10:45")).toMatchObject({
    active: true,
    progress: 50,
    end: "11:30",
  });
  expect(lessonActivity("10:00", "11:30").active).toBe(false);
  expect(lessonActivity("10:00", "09:59")).toMatchObject({
    active: false,
    progress: 0,
  });
});
it("shows full formats and building names without repeating the building inside the room", () => {
  expect(lessonType("Лек")).toBe("Лекция");
  expect(lessonType("Лаб")).toBe("Лабораторная");
  expect(teachingRoom("3-507")).toBe("Третий корпус · аудитория 507");
  expect(teachingRoom("3 к. · 3-507")).toBe("Третий корпус · аудитория 507");
  expect(teachingRoom("3 к. 3-507")).toBe("Третий корпус · аудитория 507");
  expect(teachingRoom("3-й учебный корпус · 507")).toBe(
    "Третий корпус · аудитория 507",
  );
  expect(teachingRoom("ГЗ · 349")).toBe("Главное здание · аудитория 349");
  expect(teachingRoom("Гидрокорпус · 21")).toBe("Гидрокорпус · аудитория 21");
});
it("keeps the archive suffix separate from the two numeric search fields", () => {
  expect(groupParts("5130901/40001_2025")).toEqual({
    direction: "5130901",
    number: "40001",
    archive: "2025",
  });
  expect(groupParts("5130901/40102")).toMatchObject({ archive: "" });
  expect(groupParts("https://evil.invalid")).toBeNull();
  expect(groupParts("з5130902/40002_2025")).toMatchObject({
    direction: "з5130902",
    number: "40002",
    archive: "2025",
  });
});
it("allows the previous academic year only in bounded read-only comparison", () => {
  expect(comparisonWeek("2025-11-13", new Date("2026-11-13T12:00:00Z"))).toBe(
    "2025-11-10",
  );
  expect(() =>
    comparisonWeek("2019-11-13", new Date("2026-11-13T12:00:00Z")),
  ).toThrow();
  expect(() => comparisonWeek("2026-02-30")).toThrow();
});
