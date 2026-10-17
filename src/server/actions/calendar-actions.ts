"use server";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { safeFormAction, field } from "./action-result";
import {
  saveCalendarReminders,
  disconnectPersonalCalendar,
  recoverPersonalCalendar,
} from "@/server/calendar/connections";
import { enqueuePersonalCalendar } from "@/server/calendar/queue";
import { syncPersonalCalendar } from "@/server/calendar/sync";
import { kickCalendarUpdates } from "@/server/calendar/background";
export async function saveCalendarRemindersAction(form: FormData) {
  return safeFormAction(async () => {
    const user = await requireCurrentUser();
    await saveCalendarReminders(user.id, form.getAll("reminder").map(Number));
    kickCalendarUpdates(user.id);
    revalidatePath("/calendar");
    return {
      message: "Настройки сохранены. Напоминания в Google обновляются.",
    };
  });
}
export async function syncCalendarNowAction() {
  return safeFormAction(async () => {
    const user = await requireCurrentUser();
    const connection = await prisma.personalCalendarConnection.findUnique({
      where: { userId: user.id },
      select: { lastErrorCode: true, retryAt: true, state: true },
    });
    if (
      connection?.lastErrorCode === "TEMPORARY" &&
      connection.retryAt > new Date()
    )
      return {
        error:
          "Повторная попытка уже запланирована. Google попросил подождать; попробуйте позже.",
      };
    await enqueuePersonalCalendar(prisma, user.id);
    const result = await syncPersonalCalendar(user.id, { budgetMs: 12000 });
    revalidatePath("/calendar");
    return result.state === "SYNCED"
      ? { message: "Google Calendar обновлён по текущим учебным сведениям." }
      : result.state === "FAILED"
        ? {
            error:
              "Обновление не завершено. Причина показана в состоянии подключения.",
          }
        : {
            message:
              "Обновление ещё выполняется. Неподтверждённый результат не считается синхронизацией.",
          };
  });
}
export async function disconnectCalendarAction() {
  return safeFormAction(async () => {
    const user = await requireCurrentUser();
    const result = await disconnectPersonalCalendar(user.id);
    revalidatePath("/calendar");
    return {
      message:
        result.remindersMuted && result.revoked
          ? "Синхронизация отключена, напоминания Student Value сняты. Учебные данные сохранены."
          : "Доступ Student Value удалён локально. Google не подтвердил полное отключение: выключите напоминания календаря Student Value в Google Calendar и проверьте доступ в Google Account.",
    };
  });
}
export async function recoverCalendarAction(form: FormData) {
  return safeFormAction(async () => {
    await recoverPersonalCalendar(
      (await requireCurrentUser()).id,
      field(form, "calendarId"),
    );
    kickCalendarUpdates();
    revalidatePath("/calendar");
    return {
      message:
        "Найден первоначальный календарь Student Value. Создавать дубликат не потребовалось.",
    };
  });
}
export async function retryCalendarCreationAction(form: FormData) {
  return safeFormAction(async () => {
    const { retryCalendarCreationAfterReview } =
      await import("@/server/calendar/connections");
    await retryCalendarCreationAfterReview(
      (await requireCurrentUser()).id,
      field(form, "checked") === "yes",
    );
    kickCalendarUpdates();
    revalidatePath("/calendar");
    return {
      message:
        "Повторное создание запрошено после вашей проверки Google Calendar.",
    };
  });
}
export async function replaceDeletedCalendarAction() {
  return safeFormAction(async () => {
    const { replaceDeletedPersonalCalendar } =
      await import("@/server/calendar/connections");
    await replaceDeletedPersonalCalendar((await requireCurrentUser()).id);
    kickCalendarUpdates();
    revalidatePath("/calendar");
    return {
      message:
        "Google подтвердил удаление прежнего календаря. Запрошена замена.",
    };
  });
}
