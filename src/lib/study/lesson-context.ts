import { z } from "zod";

export const lessonTypes: Record<string, string> = {
  LECTURE: "Лекция",
  PRACTICE: "Практика",
  LAB: "Лабораторная",
  ORGANIZATIONAL: "Организационное занятие",
  OTHER: "Занятие",
};
export const coverageLabels: Record<string, string> = {
  SCHEDULE_ONLY: "Пока только расписание",
  MATERIALS: "Есть материалы",
  TRANSCRIPT: "Есть текст занятия",
  RECONSTRUCTED: "Есть разбор занятия",
};
export const LessonEvidence = z.object({
  kind: z
    .enum(["OFFICIAL_DOCUMENT", "HEADMAN_RECORD", "CLASS_SESSION"])
    .optional(),
  label: z.string().min(1).max(300),
  url: z.string().url().startsWith("https://").optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  quote: z.string().max(4000).optional(),
  location: z.string().max(300).optional(),
  relation: z.enum(["DIRECT", "RELATED", "INFERRED"]),
});
export function parseLessonEvidence(value: unknown) {
  const parsed = z.array(LessonEvidence).max(80).safeParse(value);
  return parsed.success ? parsed.data : [];
}
