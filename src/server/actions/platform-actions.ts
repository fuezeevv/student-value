"use server";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  createEmptyGroup,
  setGroupSharing,
  inviteFirstHeadman,
} from "@/server/domain/platform-workspace";
import { safeFormAction, field } from "./action-result";
export async function inviteFirstHeadmanAction(form: FormData) {
  return safeFormAction(async () => {
    const result = await inviteFirstHeadman(
      await requireCurrentUser(),
      Object.fromEntries(form),
    );
    revalidatePath("/platform");
    revalidatePath("/group");
    return {
      ...result,
      message:
        "Передайте персональный код старосте. Права появятся после его входа через указанный Google аккаунт.",
    };
  });
}
export async function createEmptyGroupAction(form: FormData) {
  return safeFormAction(async () => {
    await createEmptyGroup(
      await requireCurrentUser(),
      Object.fromEntries(form),
    );
    revalidatePath("/platform");
    return {
      message:
        "Группа создана. Старосту можно пригласить отдельно; учебные данные не копируются автоматически.",
    };
  });
}
export async function setGroupSharingAction(form: FormData) {
  return safeFormAction(async () => {
    await setGroupSharing(
      await requireCurrentUser(),
      field(form, "groupId"),
      field(form, "shared") === "true",
    );
    revalidatePath("/", "layout");
    return { message: "Доступ к общим учебным материалам обновлён." };
  });
}
