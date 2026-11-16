import { NextResponse } from "next/server";
import { getMobileSessionUser } from "./mobile-auth";
import {
  visibleMaterialFile,
  materialFileChunk,
  MATERIAL_CHUNK_SIZE,
} from "@/server/domain/material-files";

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

export async function handleMobileMaterialMetadata(
  request: Request,
  materialId: string,
): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Bearer token required" },
      { status: 401 },
    );
  }

  const user = await getMobileSessionUser(token);
  if (!user || !user.groupId) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid or expired session" },
      { status: 401 },
    );
  }

  const file = await visibleMaterialFile(user, materialId);
  if (!file) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: "Материал не найден или недоступен для вашей группы",
      },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      id: file.materialId,
      filename: file.filename,
      mimeType: file.mimeType,
      byteSize: file.byteSize,
      sha256: file.sha256,
      title: file.material.title,
      courseOfferingId: file.material.courseOfferingId,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export async function handleMobileMaterialFile(
  request: Request,
  materialId: string,
): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Bearer token required" },
      { status: 401 },
    );
  }

  const user = await getMobileSessionUser(token);
  if (!user || !user.groupId) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid or expired session" },
      { status: 401 },
    );
  }

  const file = await visibleMaterialFile(user, materialId);
  if (!file) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: "Материал не найден или недоступен для вашей группы",
      },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const chunkParam = url.searchParams.get("chunk") ?? "0";
  if (!/^(0|[1-9]\d{0,3})$/.test(chunkParam)) {
    return NextResponse.json({ error: "INVALID_CHUNK" }, { status: 400 });
  }

  const chunkIndex = Number(chunkParam);
  if (chunkIndex * MATERIAL_CHUNK_SIZE >= file.byteSize) {
    return NextResponse.json(
      { error: "CHUNK_OUT_OF_BOUNDS" },
      { status: 400 },
    );
  }

  const data = await materialFileChunk(user, materialId, chunkIndex);
  if (!data) {
    return NextResponse.json({ error: "CHUNK_NOT_FOUND" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/octet-stream");
  headers.set("Content-Length", String(data.byteLength));
  headers.set("X-Material-Size", String(file.byteSize));
  headers.set("X-Material-SHA256", file.sha256);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(new Uint8Array(data), {
    status: 200,
    headers,
  });
}
