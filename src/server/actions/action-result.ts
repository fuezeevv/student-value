import { z } from "zod";
import { ForbiddenError } from "@/lib/permissions/checker";
export type FormResult = {
  message?: string;
  error?: string;
  code?: string;
  href?: string;
};
export async function safeFormAction(
  work: () => Promise<FormResult>,
): Promise<FormResult> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof z.ZodError)
      return { error: error.issues[0]?.message ?? "Проверьте поля формы" };
    if (error instanceof ForbiddenError) return { error: error.message };
    return {
      error:
        "Не удалось сохранить. Проверьте данные и обновите страницу: запись могла измениться.",
    };
  }
}
export const field = (form: FormData, key: string) =>
  typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
