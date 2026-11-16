import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import type { DownloadedMaterial } from "@studentvalue/mobile-contracts";
import { getTimetableRepository } from "../storage/repository";
import { getActiveApiOrigin } from "../api/client";
import { getSessionUser, getSessionToken } from "../auth/token-storage";

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

function getUserMaterialsDir(userId: string): string {
  const base = FileSystem.documentDirectory ?? "";
  return `${base}materials/${userId}/`;
}

function getMaterialFilePath(userId: string, materialId: string, filename: string): string {
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
  const targetDir = `${getUserMaterialsDir(sessionUser.id)}${materialId}/`;
  await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });

  const targetPath = getMaterialFilePath(sessionUser.id, materialId, metadata.filename);

  const origin = await getActiveApiOrigin();
  const fileUrl = `${origin}/api/v1/materials/${materialId}/file?chunk=0`;

  // Download file content via FileSystem
  const downloadRes = await FileSystem.downloadAsync(fileUrl, targetPath, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (downloadRes.status !== 200) {
    await FileSystem.deleteAsync(targetPath, { idempotent: true });
    throw new Error(`Не удалось скачать файл: HTTP ${downloadRes.status}`);
  }

  // Integrity Check 1: File size verification
  const fileInfo = await FileSystem.getInfoAsync(targetPath);
  if (!fileInfo.exists) {
    throw new Error("Файл не был сохранён на диск");
  }

  if (fileInfo.size !== metadata.byteSize) {
    await FileSystem.deleteAsync(targetPath, { idempotent: true });
    throw new Error(
      `Нарушение целостности: размер файла (${fileInfo.size} байт) не совпадает с ожидаемым (${metadata.byteSize} байт)`,
    );
  }

  // Integrity Check 2: Cryptographic SHA-256 hash verification
  const fileContent = await FileSystem.readAsStringAsync(targetPath, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const computedHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fileContent,
  );

  if (computedHash.toLowerCase() !== metadata.sha256.toLowerCase()) {
    await FileSystem.deleteAsync(targetPath, { idempotent: true });
    throw new Error(
      `Контрольная сумма SHA-256 не совпадает! Ожидалось: ${metadata.sha256}, получено: ${computedHash}`,
    );
  }

  // Save to SQLite registry
  const repo = getTimetableRepository();
  const downloadedRecord: DownloadedMaterial = {
    materialId,
    userId: sessionUser.id,
    filename: metadata.filename,
    mimeType: metadata.mimeType,
    byteSize: fileInfo.size,
    sha256: computedHash,
    localPath: targetPath,
    downloadedAt: new Date().toISOString(),
  };

  await repo.saveDownloadedMaterial(downloadedRecord);
  return downloadedRecord;
}

export async function readLocalMaterialContent(
  userId: string,
  materialId: string,
): Promise<string> {
  const repo = getTimetableRepository();
  const record = await repo.getDownloadedMaterial(userId, materialId);
  if (!record) {
    throw new Error("Материал не найден в локальном хранилище");
  }

  const info = await FileSystem.getInfoAsync(record.localPath);
  if (!info.exists) {
    throw new Error("Файл отсутствует на диске устройства");
  }

  return FileSystem.readAsStringAsync(record.localPath, {
    encoding: FileSystem.EncodingType.UTF8,
  });
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
    console.warn("Failed to delete user materials directory:", err);
  }

  const repo = getTimetableRepository();
  await repo.clearUserData(userId);
}
