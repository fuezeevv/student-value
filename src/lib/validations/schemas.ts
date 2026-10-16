import { z } from "zod";
import { TaskType, DeadlineType } from "@prisma/client";

export const CreateTaskSchema = z.object({
  courseOfferingId: z.string().min(1, "Выберите курс"),
  title: z.string().min(3, "Название задания должно быть не менее 3 символов"),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType),
  number: z.number().int().positive().optional().nullable(),
  deadlineDate: z.string().optional().nullable(),
  deadlineType: z.nativeEnum(DeadlineType).default(DeadlineType.HARD),
  isTimeStrict: z.boolean().default(false),
  variantNumber: z.string().optional().nullable(),
  variantTitle: z.string().optional().nullable(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(3, "Заголовок обязателен"),
  content: z.string().min(5, "Содержание объявления обязательно"),
  courseOfferingId: z.string().optional().nullable(),
  isPinned: z.boolean().default(false),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;
