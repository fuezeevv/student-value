import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "sv_session_token";
const USER_KEY = "sv_session_user";

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

export async function saveSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveSessionUser(user: MobileSessionUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getSessionUser(): Promise<MobileSessionUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileSessionUser;
  } catch {
    return null;
  }
}

export async function deleteSessionUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function clearAllAuth(): Promise<void> {
  await deleteSessionToken();
  await deleteSessionUser();
}
