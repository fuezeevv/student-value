import { describe, it, expect } from "vitest";
import { CreateTaskSchema } from "../src/server/actions/task-actions";
import { TaskType, DeadlineType } from "@prisma/client";

describe("Task DTO Validation (Zod Schema)", () => {
  it("validates a complete valid laboratory task", () => {
    const validData = {
      courseOfferingId: "offering-otu",
      title: "ЛР1: Изучение свойств ОУ",
      description: "Построение переходных процессов",
      type: TaskType.LABORATORY,
      number: 1,
      deadlineDate: "2026-10-25T23:59:00.000Z",
      deadlineType: DeadlineType.HARD,
      isTimeStrict: false,
      variantNumber: "Вар. 4",
    };

    const parsed = CreateTaskSchema.parse(validData);
    expect(parsed.title).toBe("ЛР1: Изучение свойств ОУ");
    expect(parsed.type).toBe("LABORATORY");
    expect(parsed.deadlineType).toBe("HARD");
  });

  it("validates task without deadline (deadline is optional)", () => {
    const dataWithoutDeadline = {
      courseOfferingId: "offering-otu",
      title: "ЛР4: Частотный синтез системы управления",
      type: TaskType.LABORATORY,
      number: 4,
    };

    const parsed = CreateTaskSchema.parse(dataWithoutDeadline);
    expect(parsed.deadlineDate).toBeUndefined();
    expect(parsed.number).toBe(4);
  });

  it("fails validation if title is too short or empty", () => {
    const invalidData = {
      courseOfferingId: "offering-otu",
      title: "ЛР",
      type: TaskType.LABORATORY,
    };

    expect(() => CreateTaskSchema.parse(invalidData)).toThrow();
  });

  it("fails validation if courseOfferingId is missing", () => {
    const invalidData = {
      courseOfferingId: "",
      title: "Задание 1",
      type: TaskType.HOMEWORK,
    };

    expect(() => CreateTaskSchema.parse(invalidData)).toThrow();
  });
});
