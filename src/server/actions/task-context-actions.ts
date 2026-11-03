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

export async function cancelTaskDeadlineAction(form: FormData) {
  return safeFormAction(async () => {
    const { setDeadlineCancelled } =
      await import("@/server/domain/work-lifecycle");
    await setDeadlineCancelled(
      await requireCurrentUser(),
      field(form, "deadlineId"),
      field(form, "restore") !== "true",
      field(form, "reason"),
    );
    kickCalendarUpdates();
    revalidatePath("/", "layout");
    return { message: "Срок обновлён. Работа и её результаты сохранены." };
  });
}
export async function archiveTaskAction(form: FormData) {
  return safeFormAction(async () => {
    const { setTaskArchived } = await import("@/server/domain/work-lifecycle");
    await setTaskArchived(
      await requireCurrentUser(),
      field(form, "taskId"),
      field(form, "restore") !== "true",
      field(form, "reason"),
    );
    kickCalendarUpdates();
    revalidatePath("/", "layout");
    return {
      message: "Готово. Архивные работы можно восстановить в панели старосты.",
      href: "/admin/work",
    };
  });
}
export async function reviewCompletionAction(form: FormData) {
  return safeFormAction(async () => {
    const { reviewCompletion } = await import("@/server/domain/progress");
    await reviewCompletion(
      await requireCurrentUser(),
      field(form, "taskId"),
      field(form, "userId"),
      field(form, "approve") === "true",
    );
    kickCalendarUpdates();
    revalidatePath("/", "layout");
    return { message: "Отметка выполнения обновлена." };
  });
}
