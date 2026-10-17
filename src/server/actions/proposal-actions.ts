"use server";
import { kickCalendarUpdates } from "@/server/calendar/background";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  proposeChange,
  reviewProposal,
  shareBrief,
  archiveSharedBrief,
  suggestTranscriptNotes,
} from "@/server/domain/proposals";
import { safeFormAction, field } from "./action-result";
export async function proposeChangeAction(form: FormData) {
  return safeFormAction(async () => {
    await proposeChange(await requireCurrentUser(), {
      ...Object.fromEntries(form),
      sourceUrl: field(form, "sourceUrl") || null,
      taskId: field(form, "taskId") || undefined,
      sessionId: field(form, "sessionId") || undefined,
      proposedDay: field(form, "proposedDay") || undefined,
      sharedBriefId: field(form, "sharedBriefId") || undefined,
    });
    revalidatePath("/proposals");
    return {
      message: "Отправлено на проверку. Учебные сведения пока не изменились.",
      href: "/proposals",
    };
  });
}
export async function reviewProposalAction(form: FormData) {
  return safeFormAction(async () => {
    await reviewProposal(await requireCurrentUser(), field(form, "id"), {
      decision: field(form, "decision"),
      deadlineType: field(form, "deadlineType") || undefined,
      reviewNote: field(form, "reviewNote"),
      content: field(form, "content") || undefined,
      kind: field(form, "kind") || undefined,
      taskId: field(form, "taskId") || undefined,
      proposedDay: field(form, "proposedDay") || undefined,
    });
    kickCalendarUpdates();
    revalidatePath("/", "layout");
    return { message: "Решение сохранено. Принятые изменения опубликованы." };
  });
}
export async function shareBriefAction(form: FormData) {
  return safeFormAction(async () => {
    await shareBrief(await requireCurrentUser(), {
      ...Object.fromEntries(form),
      sourceUrl: field(form, "sourceUrl") || null,
    });
    revalidatePath("/exchange");
    return {
      message:
        "Сведения предложены другим группам. Их учебные данные не меняются.",
      href: "/exchange",
    };
  });
}
export async function transcriptNotesAction(form: FormData) {
  return safeFormAction(async () => {
    const count = await suggestTranscriptNotes(
      await requireCurrentUser(),
      field(form, "sessionId"),
    );
    revalidatePath("/proposals");
    return {
      message: count
        ? `Подготовлено фраз для проверки: ${count}. Смысл и сроки требуют проверки.`
        : "Новых подходящих фраз нет. Можно предложить уточнение вручную.",
      href: "/proposals",
    };
  });
}

export async function archiveSharedBriefAction(form: FormData) {
  return safeFormAction(async () => {
    await archiveSharedBrief(await requireCurrentUser(), field(form, "id"));
    revalidatePath("/exchange");
    return {
      message:
        "Сведения отозваны из общего обмена. Ранее принятые решения других групп сохранены в их истории.",
    };
  });
}
