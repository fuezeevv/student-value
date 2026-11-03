import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";

export const MATERIAL_CHUNK_SIZE = 1024 * 1024;
export async function visibleMaterialFile(
  user: SessionUser,
  materialId: string,
) {
  return prisma.materialFile.findFirst({
    where: {
      materialId,
      material: {
        courseOffering: {
          status: "ACTIVE",
          mergedIntoId: null,
          groups: { some: { groupId: user.groupId } },
        },
        OR: [
          { sessions: { none: {} } },
          { sessions: { some: { session: { status: "PUBLISHED" } } } },
        ],
      },
    },
    select: {
      materialId: true,
      filename: true,
      mimeType: true,
      byteSize: true,
      sha256: true,
      material: {
        select: { title: true, sourceNote: true, courseOfferingId: true },
      },
    },
  });
}
export async function materialFileChunk(
  user: SessionUser,
  id: string,
  chunk: number,
) {
  const file = await visibleMaterialFile(user, id);
  if (
    !file ||
    !Number.isSafeInteger(chunk) ||
    chunk < 0 ||
    chunk * MATERIAL_CHUNK_SIZE >= file.byteSize
  )
    return null;
  // PostgreSQL returns only the requested piece, never the complete document body.
  const rows = await prisma.$queryRaw<{ content: Uint8Array }[]>`
    SELECT substring("content" from ${chunk * MATERIAL_CHUNK_SIZE + 1}::integer for ${MATERIAL_CHUNK_SIZE}::integer) AS content
    FROM "MaterialFile" WHERE "materialId" = ${id}`;
  return rows[0]?.content ?? null;
}

/** Separate read-only exchange scope; never broadens ordinary student/group access. */
export async function visibleSharedMaterialFile(user: SessionUser, id: string) {
  const { requireHeadmanExchange, sharedCourseWhere, sharedTaskWhere } =
    await import("./platform-workspace");
  try {
    await requireHeadmanExchange(user);
  } catch {
    return null;
  }
  const material = await prisma.courseMaterial.findFirst({
    where: { id, courseOffering: sharedCourseWhere },
    select: {
      courseOfferingId: true,
      courseOffering: { select: { groups: { select: { groupId: true } } } },
    },
  });
  if (!material || material.courseOffering.groups.length !== 1) return null;
  const taskWhere = sharedTaskWhere(material.courseOffering.groups[0].groupId);
  if (
    !(await prisma.task.count({
      where: {
        ...taskWhere,
        courseOfferingId: material.courseOfferingId,
        materials: { some: { materialId: id } },
      },
    }))
  )
    return null;
  return prisma.materialFile.findUnique({
    where: { materialId: id },
    select: {
      materialId: true,
      filename: true,
      mimeType: true,
      byteSize: true,
      sha256: true,
      material: {
        select: { title: true, sourceNote: true, courseOfferingId: true },
      },
    },
  });
}
export async function sharedMaterialFileChunk(
  user: SessionUser,
  id: string,
  chunk: number,
) {
  const file = await visibleSharedMaterialFile(user, id);
  if (
    !file ||
    !Number.isSafeInteger(chunk) ||
    chunk < 0 ||
    chunk * MATERIAL_CHUNK_SIZE >= file.byteSize
  )
    return null;
  const rows = await prisma.$queryRaw<
    { content: Uint8Array }[]
  >`SELECT substring("content" from ${chunk * MATERIAL_CHUNK_SIZE + 1}::integer for ${MATERIAL_CHUNK_SIZE}::integer) AS content FROM "MaterialFile" WHERE "materialId" = ${id}`;
  return rows[0]?.content ?? null;
}
