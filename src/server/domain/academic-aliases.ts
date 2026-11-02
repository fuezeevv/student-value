import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { taskVisibilityWhere } from "./access";

/** Resolve only a single, scoped, active destination; chains and cycles fail closed. */
export async function courseDestination(user: SessionUser, id: string) {
  const source = await prisma.courseOffering.findFirst({
    where: { id, groups: { some: { groupId: user.groupId } } },
    select: { mergedIntoId: true, semesterId: true, status: true },
  });
  if (!source?.mergedIntoId || source.status !== "ARCHIVED") return null;
  const target = await prisma.courseOffering.findFirst({
    where: {
      id: source.mergedIntoId,
      mergedIntoId: null,
      status: "ACTIVE",
      semesterId: source.semesterId,
      groups: { some: { groupId: user.groupId } },
    },
    select: { id: true },
  });
  return target?.id ?? null;
}

export async function taskDestination(user: SessionUser, id: string) {
  const visible = await taskVisibilityWhere(user);
  const source = await prisma.task.findFirst({
    where: {
      AND: [
        { ...visible, status: "ARCHIVED" },
        { id, mergedIntoId: { not: null } },
      ],
    },
    select: { mergedIntoId: true, courseOfferingId: true },
  });
  if (!source?.mergedIntoId) return null;
  const target = await prisma.task.findFirst({
    where: {
      AND: [
        visible,
        {
          id: source.mergedIntoId,
          mergedIntoId: null,
          courseOfferingId: source.courseOfferingId,
        },
      ],
    },
    select: { id: true },
  });
  return target?.id ?? null;
}
