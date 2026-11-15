import { z } from "zod";

export const universitySnapshotSchema = z
  .object({
    version: z.literal(1),
    kind: z.enum(["recordbook", "study-plan"]),
    sourceUrl: z.enum([
      "https://my.spbstu.ru/science-and-education/recordbook/",
      "https://my.spbstu.ru/science-and-education/study_plan/",
    ]),
    capturedAt: z.string().datetime({ offset: true }),
    context: z.string().trim().max(1000),
    columns: z.array(z.string().trim().min(1).max(100)).min(2).max(16),
    rows: z
      .array(z.array(z.string().trim().max(1500)).min(2).max(16))
      .min(1)
      .max(500),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    if (snapshot.rows.some((row) => row.length !== snapshot.columns.length))
      ctx.addIssue({
        code: "custom",
        message: "Количество ячеек не совпадает с заголовком",
      });
    const expected =
      snapshot.kind === "recordbook" ? "recordbook/" : "study_plan/";
    if (!snapshot.sourceUrl.endsWith(expected))
      ctx.addIssue({
        code: "custom",
        message: "Источник не соответствует разделу",
      });
    if (!snapshot.columns.some((column) => /дисциплин/i.test(column)))
      ctx.addIssue({ code: "custom", message: "Нет столбца дисциплины" });
  });
export type UniversitySnapshot = z.infer<typeof universitySnapshotSchema>;
export const MAX_UNIVERSITY_FILE_BYTES = 1024 * 1024;

export function parseUniversitySnapshot(text: string): UniversitySnapshot {
  if (new TextEncoder().encode(text).byteLength > MAX_UNIVERSITY_FILE_BYTES)
    throw new Error("Файл слишком большой");
  const snapshot = universitySnapshotSchema.parse(JSON.parse(text));
  if (new Date(snapshot.capturedAt).getTime() > Date.now() + 300000)
    throw new Error("Время копии находится в будущем");
  return snapshot;
}
