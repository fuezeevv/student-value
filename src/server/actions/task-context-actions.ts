"use server";
import { kickCalendarUpdates } from "@/server/calendar/background";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth/session";
import { editTask } from "@/server/domain/task-editing";
import { rescheduleDeadline } from "@/server/domain/deadlines";
import { safeFormAction, field } from "./action-result";
export async function editTaskContentAction(form: FormData) {
  return safeFormAction(async () => {
    await editTask(
      await requireCurrentUser(),
      field(form, "taskId"),
      Object.fromEntries(form),
    );
    kickCalendarUpdates();
    revalidatePath("/", "layout");
    return {
      message:
        "Задание обновлено. Предыдущий текст и основание сохранены в истории.",
    };
  });
}
export async function moveTaskDeadlineAction(form: FormData) {
  return safeFormAction(async () => {
    await rescheduleDeadline(
      await requireCurrentUser(),
      field(form, "deadlineId"),
      field(form, "day"),
      undefined,
      field(form, "sourceNote"),
    );
    kickCalendarUpdates();
    revalidatePath("/", "layout");
    return { message: "Срок обновлён. История и уведомления сохранены." };
  });
}
