import * as WebBrowser from "expo-web-browser";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from "./pkce";
import {
  saveSessionToken,
  saveSessionUser,
  deleteSessionToken,
  deleteSessionUser,
  getSessionToken,
  type MobileSessionUser,
} from "./token-storage";
import { getActiveApiOrigin } from "../api/client";

WebBrowser.maybeCompleteAuthSession();

export const REDIRECT_URI = "studentvalue://auth/callback";

export type AuthResult =
  | { kind: "SUCCESS"; user: MobileSessionUser; token: string }
  | { kind: "CANCELLED" }
  | { kind: "ERROR"; message: string };

export async function startMobileGoogleLogin(): Promise<AuthResult> {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = await generateState();

  const baseUrl = await getActiveApiOrigin();
  const startUrl = `${baseUrl}/api/v1/auth/mobile/start?challenge=${encodeURIComponent(
    challenge,
  )}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI,
  )}`;

  try {
    const result = await WebBrowser.openAuthSessionAsync(
      startUrl,
      REDIRECT_URI,
      {
        showInRecents: true,
      },
    );

    if (result.type !== "success" || !result.url) {
      return { kind: "CANCELLED" };
    }

    const url = new URL(result.url);
    const returnedCode = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const returnedError = url.searchParams.get("error");

    if (returnedError) {
      return { kind: "ERROR", message: `Ошибка авторизации: ${returnedError}` };
    }

    if (!returnedCode) {
      return { kind: "ERROR", message: "Сервер не вернул код авторизации" };
    }

    if (returnedState !== state) {
      return {
        kind: "ERROR",
        message: "Несовпадение state (возможна CSRF-атака)",
      };
    }

    const exchangeRes = await fetch(`${baseUrl}/api/v1/auth/mobile/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: returnedCode,
        verifier,
      }),
    });

    if (!exchangeRes.ok) {
      const errJson = await exchangeRes.json().catch(() => ({}));
      return {
        kind: "ERROR",
        message: errJson.message || `Сбой обмена: HTTP ${exchangeRes.status}`,
      };
    }

    const data = await exchangeRes.json();
    await saveSessionToken(data.token);
    await saveSessionUser(data.user);

    return {
      kind: "SUCCESS",
      user: data.user,
      token: data.token,
    };
  } catch (err: any) {
    return {
      kind: "ERROR",
      message: err.message || "Ошибка подключения к серверу",
    };
  }
}

export async function logoutMobile(
  onCleanCache?: () => Promise<void>,
): Promise<void> {
  const token = await getSessionToken();
  const baseUrl = await getActiveApiOrigin();

  if (token) {
    try {
      await fetch(`${baseUrl}/api/v1/auth/mobile/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Best-effort remote revocation
    }
  }

  await deleteSessionToken();
  await deleteSessionUser();

  if (onCleanCache) {
    await onCleanCache();
  }
}
