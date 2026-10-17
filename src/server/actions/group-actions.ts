"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { activeGroupCookie, requireCurrentUser } from "@/lib/auth/session";
import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import {
  createGroupWorkspace,
  reissueHeadmanInvitation,
  inviteGroupMember,
  delegateCourse,
  addGroupCourse,
} from "@/server/domain/group-workspace";
import { safeFormAction, field } from "./action-result";
export async function switchGroupAction(groupId: string) {
  const user = await requireCurrentUser();
  if (!user.groups?.some((g) => g.id === groupId))
    throw Error("Нет доступа к этой группе");
  (await cookies()).set(activeGroupCookie(), groupId, {
    path: "/",
    httpOnly: true,
    secure: !isDevAuthEnabled(),
    sameSite: "lax",
    maxAge: 14 * 86400,
  });
  revalidatePath("/", "layout");
}
export async function createGroupAction(form: FormData) {
  return safeFormAction(async () => {
    const result = await createGroupWorkspace(
      await requireCurrentUser(),
      Object.fromEntries(form),
    );
    revalidatePath("/group");
    return {
      code: result.code,
      message: "Группа создана. Передайте код её старосте.",
    };
  });
}
export async function inviteMemberAction(form: FormData) {
  return safeFormAction(async () => {
    const result = await inviteGroupMember(await requireCurrentUser(), {
      ...Object.fromEntries(form),
      enrollmentId: field(form, "enrollmentId") || undefined,
      subgroup: field(form, "subgroup")
        ? Number(field(form, "subgroup"))
        : undefined,
    });
    revalidatePath("/group");
    return { code: result.code, message: "Приглашение подготовлено." };
  });
}
export async function delegateCourseAction(form: FormData) {
  return safeFormAction(async () => {
    await delegateCourse(
      await requireCurrentUser(),
      field(form, "memberId"),
      field(form, "courseId"),
      field(form, "enabled") === "true",
    );
    revalidatePath("/", "layout");
    return { message: "Права на предмет обновлены." };
  });
}
export async function addCourseAction(form: FormData) {
  return safeFormAction(async () => {
    const id = await addGroupCourse(await requireCurrentUser(), {
      title: field(form, "title"),
      shortTitle: field(form, "shortTitle") || undefined,
      semester: field(form, "semester") || undefined,
      startDay: field(form, "startDay") || undefined,
      endDay: field(form, "endDay") || undefined,
    });
    revalidatePath("/", "layout");
    return {
      message: "Предмет добавлен в вашу группу.",
      href: `/courses/${id}`,
    };
  });
}

export async function reissueHeadmanAction(form: FormData) {
  return safeFormAction(async () => {
    const result = await reissueHeadmanInvitation(
      await requireCurrentUser(),
      field(form, "groupId"),
      field(form, "email"),
    );
    revalidatePath("/group");
    return {
      code: result.code,
      message:
        "Новый код подготовлен для прежнего получателя. Старый код больше не действует.",
    };
  });
}
