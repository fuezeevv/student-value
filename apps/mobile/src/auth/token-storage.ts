import * as Crypto from "expo-crypto";
import { getActiveApiOrigin } from "../api/client";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "sv_session_token";
const USER_KEY = "sv_session_user";

async function storageKey(
  key: string,
  capturedOrigin?: string,
): Promise<string> {
  const origin = new URL(capturedOrigin ?? (await getActiveApiOrigin())).origin;
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    origin,
  );
  return `${key}_${digest}`;
}

export interface MobileSessionUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isSystemAdmin: boolean;
  isOwner: boolean;
  groupId: string;
  permissions: string[];
  isPlatformOwner?: boolean;
  groupName?: string;
  groups?: { id: string; name: string; code: string }[];
}

export async function saveSessionToken(
  token: string,
  origin?: string,
): Promise<void> {
  await SecureStore.setItemAsync(await storageKey(TOKEN_KEY, origin), token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(await storageKey(TOKEN_KEY));
}

export async function deleteSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(await storageKey(TOKEN_KEY));
}

export async function saveSessionUser(
  user: MobileSessionUser,
  origin?: string,
): Promise<void> {
  await SecureStore.setItemAsync(
    await storageKey(USER_KEY, origin),
    JSON.stringify(user),
  );
}

export async function getSessionUser(): Promise<MobileSessionUser | null> {
  const raw = await SecureStore.getItemAsync(await storageKey(USER_KEY));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileSessionUser;
  } catch {
    return null;
  }
}

export async function deleteSessionUser(): Promise<void> {
  await SecureStore.deleteItemAsync(await storageKey(USER_KEY));
}

export async function clearAllAuth(): Promise<void> {
  await deleteSessionToken();
  await deleteSessionUser();
}
