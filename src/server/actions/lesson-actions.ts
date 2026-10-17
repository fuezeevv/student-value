"use server";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth/session";
import { saveLesson, addMaterial } from "@/server/domain/lessons";
import { safeFormAction, field } from "./action-result";
export async function saveLessonAction(form: FormData) {
  return safeFormAction(async () => {
    const id = await saveLesson(
      await requireCurrentUser(),
      {
        courseOfferingId: field(form, "courseOfferingId"),
        topic: field(form, "topic"),
        day: field(form, "day"),
        time: field(form, "time") || undefined,
        endTime: field(form, "endTime") || undefined,
        type: field(form, "type"),
        taughtBy: field(form, "taughtBy"),
        room: field(form, "room"),
        summary: field(form, "summary"),
        notes: field(form, "notes"),
        recordingUrl: field(form, "recordingUrl") || null,
        sourceNote: field(form, "sourceNote"),
        transcriptText: field(form, "transcriptText") || undefined,
        taskIds: form.getAll("taskIds").map(String),
        status: field(form, "status") || "PUBLISHED",
      },
      field(form, "id") || undefined,
      field(form, "version") ? Number(field(form, "version")) : undefined,
    );
    revalidatePath("/", "layout");
    return { message: "Занятие сохранено.", href: `/lessons/${id}` };
  });
}
export async function addMaterialAction(form: FormData) {
  return safeFormAction(async () => {
    const data = Object.fromEntries(form);
    await addMaterial(await requireCurrentUser(), {
      ...data,
      sessionId: field(form, "sessionId") || undefined,
    });
    revalidatePath("/", "layout");
    return { message: "Материал добавлен." };
  });
}
