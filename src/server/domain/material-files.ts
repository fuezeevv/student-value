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
