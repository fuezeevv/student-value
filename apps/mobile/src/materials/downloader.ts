import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import type { DownloadedMaterial } from "@studentvalue/mobile-contracts";
import { getTimetableRepository } from "../storage/repository";
import { getActiveApiOrigin } from "../api/client";
import { getSessionUser, getSessionToken } from "../auth/token-storage";

export const MATERIAL_CHUNK_SIZE = 1024 * 1024; // 1 MiB chunks
export const MAX_ALLOWED_MATERIAL_SIZE = 50 * 1024 * 1024; // 50 MiB limit

export interface MaterialMetadata {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  title: string;
  courseOfferingId: string;
}

export type DownloadProgressCallback = (progress: {
  downloadedBytes: number;
  totalBytes: number;
}) => void;

export interface LocalMaterialReadResult {
  isBinary: boolean;
  content: string | null;
  filename: string;
  byteSize: number;
  mimeType: string;
  localPath: string;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getUserMaterialsDir(userId: string): string {
  const base = FileSystem.documentDirectory ?? "";
  return `${base}materials/${userId}/`;
}

function getMaterialFilePath(
  userId: string,
  materialId: string,
  filename: string,
): string {
  return `${getUserMaterialsDir(userId)}${materialId}/${filename}`;
}

export async function fetchMaterialMetadata(
  materialId: string,
): Promise<MaterialMetadata> {
  const sessionUser = await getSessionUser();
  const token = await getSessionToken();
  if (!sessionUser || !token) {
    throw new Error("Требуется авторизация для загрузки материалов");
  }

  const origin = await getActiveApiOrigin();
  const res = await fetch(`${origin}/api/v1/materials/${materialId}/metadata`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    throw new Error("Сессия истекла. Войдите снова.");
  }
  if (res.status === 404) {
    throw new Error("Материал не найден или недоступен для вашей группы");
  }
  if (!res.ok) {
    throw new Error(`Ошибка сервера: HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Downloads a course material file with:
 * 1. Multi-chunk sequential fetching for files > 1 MiB
 * 2. 50 MiB file size safety ceiling
 * 3. Atomic download via a temporary file (.tmp)
 * 4. True binary SHA-256 cryptographic hash verification
 * 5. Atomic move to target path on success
 */
export async function downloadMaterial(
  materialId: string,
  onProgress?: DownloadProgressCallback,
): Promise<DownloadedMaterial> {
  const sessionUser = await getSessionUser();
  const token = await getSessionToken();
  if (!sessionUser || !token) {
    throw new Error("Требуется авторизация для загрузки материалов");
  }

  const metadata = await fetchMaterialMetadata(materialId);

  if (metadata.byteSize > MAX_ALLOWED_MATERIAL_SIZE) {
    throw new Error(
      `Размер файла (${metadata.byteSize} байт) превышает допустимый предел 50 МБ`,
    );
  }

  const targetDir = `${getUserMaterialsDir(sessionUser.id)}${materialId}/`;
  await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });

  const finalPath = getMaterialFilePath(sessionUser.id, materialId, metadata.filename);
  const tempPath = `${targetDir}temp_${Date.now()}_${metadata.filename}`;

  // Clean any stale temp file at tempPath
  await FileSystem.deleteAsync(tempPath, { idempotent: true });

  const totalChunks = Math.max(
    1,
    Math.ceil(metadata.byteSize / MATERIAL_CHUNK_SIZE),
  );
  const origin = await getActiveApiOrigin();

  let downloadedBytes = 0;

  for (let chunk = 0; chunk < totalChunks; chunk++) {
    const chunkUrl = `${origin}/api/v1/materials/${materialId}/file?chunk=${chunk}`;
    const res = await fetch(chunkUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
      throw new Error(`Ошибка скачивания чанка ${chunk}: HTTP ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    downloadedBytes += uint8Array.byteLength;

    // Convert binary chunk to base64
    const base64Chunk = uint8ArrayToBase64(uint8Array);

    // Append chunk to temp file
    await FileSystem.writeAsStringAsync(tempPath, base64Chunk, {
      encoding: FileSystem.EncodingType.Base64,
      append: chunk > 0,
    });

    if (onProgress) {
      onProgress({
        downloadedBytes,
        totalBytes: metadata.byteSize,
      });
    }
  }

  // Integrity Check 1: File size verification on disk
  const fileInfo = await FileSystem.getInfoAsync(tempPath);
  if (!fileInfo.exists) {
    throw new Error("Файл не был сохранён на диск");
  }

  if (fileInfo.size !== metadata.byteSize) {
    await FileSystem.deleteAsync(tempPath, { idempotent: true });
    throw new Error(
      `Нарушение целостности: размер файла (${fileInfo.size} байт) не совпадает с ожидаемым (${metadata.byteSize} байт)`,
    );
  }

  // Integrity Check 2: Cryptographic SHA-256 hash verification of raw binary bytes
  const base64Full = await FileSystem.readAsStringAsync(tempPath, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const fullBytes = base64ToUint8Array(base64Full);

  const digestBuffer = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fullBytes.buffer as ArrayBuffer,
  );
  const computedHash = Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedHash.toLowerCase() !== metadata.sha256.toLowerCase()) {
    await FileSystem.deleteAsync(tempPath, { idempotent: true });
    throw new Error(
      `Контрольная сумма SHA-256 не совпадает! Ожидалось: ${metadata.sha256}, получено: ${computedHash}`,
    );
  }

  // Atomic move: place verified temp file at final destination
  await FileSystem.deleteAsync(finalPath, { idempotent: true });
  await FileSystem.moveAsync({
    from: tempPath,
    to: finalPath,
  });

  // Save to SQLite registry
  const repo = getTimetableRepository();
  const downloadedRecord: DownloadedMaterial = {
    materialId,
    userId: sessionUser.id,
    filename: metadata.filename,
    mimeType: metadata.mimeType,
    byteSize: fileInfo.size,
    sha256: computedHash,
    localPath: finalPath,
    downloadedAt: new Date().toISOString(),
  };

  await repo.saveDownloadedMaterial(downloadedRecord);
  return downloadedRecord;
}

export async function readLocalMaterialContent(
  userId: string,
  materialId: string,
): Promise<LocalMaterialReadResult> {
  const repo = getTimetableRepository();
  const record = await repo.getDownloadedMaterial(userId, materialId);
  if (!record) {
    throw new Error("Материал не найден в локальном хранилище");
  }

  const info = await FileSystem.getInfoAsync(record.localPath);
  if (!info.exists) {
    throw new Error("Файл отсутствует на диске устройства");
  }

  const isText =
    record.mimeType.startsWith("text/") ||
    record.filename.endsWith(".txt") ||
    record.filename.endsWith(".md") ||
    record.filename.endsWith(".sv") ||
    record.filename.endsWith(".v") ||
    record.filename.endsWith(".json");

  if (isText) {
    const text = await FileSystem.readAsStringAsync(record.localPath, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return {
      isBinary: false,
      content: text,
      filename: record.filename,
      byteSize: record.byteSize,
      mimeType: record.mimeType,
      localPath: record.localPath,
    };
  }

  // Binary (PDF, ZIP, DOCX, etc.): do not decode as raw UTF-8 string
  return {
    isBinary: true,
    content: null,
    filename: record.filename,
    byteSize: record.byteSize,
    mimeType: record.mimeType,
    localPath: record.localPath,
  };
}

export async function deleteLocalMaterial(
  userId: string,
  materialId: string,
): Promise<void> {
  const repo = getTimetableRepository();
  const record = await repo.getDownloadedMaterial(userId, materialId);
  if (record) {
    await FileSystem.deleteAsync(record.localPath, { idempotent: true });
    await repo.deleteDownloadedMaterial(userId, materialId);
  }
}

export async function purgeAllUserMaterials(userId: string): Promise<void> {
  const userDir = getUserMaterialsDir(userId);
  try {
    const info = await FileSystem.getInfoAsync(userDir);
    if (info.exists) {
      await FileSystem.deleteAsync(userDir, { idempotent: true });
    }
  } catch (err) {
    console.warn("Could not delete user materials directory:", err);
  }

  // Clear SQLite
  const repo = getTimetableRepository();
  await repo.clearUserData(userId);
}
