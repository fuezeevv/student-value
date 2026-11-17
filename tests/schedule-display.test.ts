import { describe,it,expect } from "vitest";
import { showStudentScheduleSubject,lessonTypeLabel } from "../packages/mobile-contracts/src/schedule-display";
describe("native student schedule projection",()=>{
  it("uses the same requested exclusions as web without changing original snapshots",()=>{
    for(const title of ["Военная подготовка","Образовательный форсайт","Научно-исследовательская работа (НИР)"])expect(showStudentScheduleSubject(title)).toBe(false);
    expect(showStudentScheduleSubject("Статистическая обработка больших данных")).toBe(true);
    expect(showStudentScheduleSubject("Основы теории управления")).toBe(true);
  });
  it("expands known lesson types and preserves unknown source labels",()=>{
    expect(lessonTypeLabel("Лек")).toBe("Лекция");expect(lessonTypeLabel("Лаб")).toBe("Лабораторная");expect(lessonTypeLabel("Пр")).toBe("Практика");expect(lessonTypeLabel("Неизвестный формат")).toBe("Неизвестный формат");
  });
});
