import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import {
  googleConfiguration,
  googleAuthorizationUrl,
  makeGoogleFlow,
  GOOGLE_FLOW_COOKIE,
  hashToken,
  equalSecret,
} from "@/lib/auth/google";
import { isDevAuthEnabled } from "@/lib/auth/dev-policy";

export interface MobilePkceState {
  challenge: string;
  state: string;
  redirectUri: string;
  expiresAt: number;
}

export const ALLOWED_REDIRECT_PREFIXES = [
  "cc.eu.studentvalue1984.dev://auth/callback",
  "cc.eu.studentvalue1984://auth/callback",
  "studentvalue://auth/callback",
];

export function isAllowedRedirectUri(uri: string): boolean {
  return ALLOWED_REDIRECT_PREFIXES.some(
    (allowed) => uri === allowed || uri.startsWith(allowed + "?"),
  );
}

export function getMobilePkceCookieName(): string {
  return isDevAuthEnabled() ? "mobile_pkce" : "__Host-mobile-pkce";
}

function getPkceSecret(): string {
  if (process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) {
    return process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;
  }
  return Buffer.alloc(32, 42).toString("base64");
}

function pkceKey(secret: string): Buffer {
  const key = Buffer.from(secret, "base64");
  const validKey = key.length === 32 ? key : Buffer.alloc(32, 42);
  return Buffer.from(
    hkdfSync("sha256", validKey, "studentvalue1984", "mobile-pkce-v1", 32),
  );
}

export function encryptPkceCookie(
  payload: MobilePkceState,
  secret = getPkceSecret(),
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", pkceKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}

export function decryptPkceCookie(
  cookie: string,
  secret = getPkceSecret(),
): MobilePkceState | null {
  try {
    const bytes = Buffer.from(cookie, "base64url");
    if (bytes.length < 29) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      pkceKey(secret),
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(12, 28));
    const decrypted = Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]);
    const payload = JSON.parse(decrypted.toString());
    if (
      typeof payload.challenge !== "string" ||
      typeof payload.state !== "string" ||
      typeof payload.redirectUri !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    return payload as MobilePkceState;
  } catch {
    return null;
  }
}

export async function getMobileSessionUser(
  bearerToken: string,
  activeGroupId?: string,
): Promise<SessionUser | null> {
  const cleanToken = bearerToken.trim();
  if (!/^[a-zA-Z0-9_-]{43}$/.test(cleanToken)) {
    return null;
  }

  const tokenHash = hashToken(cleanToken);
  const dbSession = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!dbSession || dbSession.expiresAt <= new Date()) {
    return null;
  }

  const targetUserId = dbSession.userId;
  const isDevAuth = isDevAuthEnabled();

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      memberships: {
        ...(isDevAuth
          ? {}
          : {
              where: {
                group: {
                  enrollments: {
                    some: {
                      userId: targetUserId,
                      status: { in: ["CLAIMED" as const, "VERIFIED" as const] },
                    },
                  },
                },
              },
            }),
        orderBy: { joinedAt: "asc" },
        include: {
          group: true,
          userRoles: {
            include: {
              role: {
                include: {
                  permissions: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const selected = activeGroupId;
  const defaultMembership =
    user.memberships.find((m) => m.groupId === selected) ?? user.memberships[0];
  if (!isDevAuth && !defaultMembership) return null;

  const isOwner = defaultMembership?.isOwner ?? false;
  const groupId = defaultMembership?.groupId ?? "";

  const permissionsSet = new Set<string>();
  if (defaultMembership) {
    for (const ur of defaultMembership.userRoles) {
      if (ur.role.groupId !== defaultMembership.groupId) continue;
      for (const p of ur.role.permissions) {
        permissionsSet.add(p.permission);
      }
    }
  }

  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isSystemAdmin: user.isSystemAdmin,
    isOwner,
    groupId,
    permissions: Array.from(permissionsSet),
    isPlatformOwner: user.isPlatformOwner,
    groupName: defaultMembership?.group.name,
    groups: user.memberships.map((m) => ({
      id: m.groupId,
      name: m.group.name,
      code: m.group.code,
    })),
  };
}

export async function handleMobileAuthStart(
  request: NextRequest,
): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get("challenge") ?? "";
  const state = searchParams.get("state") ?? "";
  const redirectUri = searchParams.get("redirect_uri") ?? "";

  if (!/^[a-zA-Z0-9_-]{43}$/.test(challenge)) {
    return NextResponse.json(
      {
        error: "INVALID_CHALLENGE",
        message: "Code challenge must be 43-character base64url SHA-256",
      },
      { status: 400 },
    );
  }

  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(state)) {
    return NextResponse.json(
      {
        error: "INVALID_STATE",
        message: "State must be 8-128 characters alphanumeric/URL-safe",
      },
      { status: 400 },
    );
  }

  if (!isAllowedRedirectUri(redirectUri)) {
    return NextResponse.json(
      { error: "INVALID_REDIRECT_URI", message: "Redirect URI is not allowed" },
      { status: 400 },
    );
  }

  const pkcePayload: MobilePkceState = {
    challenge,
    state,
    redirectUri,
    expiresAt: Date.now() + 300_000, // 5 minutes
  };

  const encryptedCookie = encryptPkceCookie(pkcePayload);
  const cookieName = getMobilePkceCookieName();

  const config = googleConfiguration();
  if (config) {
    const { flow, cookie: googleCookie } = makeGoogleFlow(
      "",
      process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ?? getPkceSecret(),
    );
    const googleUrl = googleAuthorizationUrl(config, flow);

    const res = NextResponse.redirect(googleUrl, 303);
    res.headers.set("Cache-Control", "no-store");
    res.cookies.set(cookieName, encryptedCookie, {
      httpOnly: true,
      secure: !isDevAuthEnabled(),
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });
    res.cookies.set(GOOGLE_FLOW_COOKIE, googleCookie, {
      httpOnly: true,
      secure: !isDevAuthEnabled(),
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  }

  if (isDevAuthEnabled()) {
    const devUrl = new URL("/login", request.nextUrl.origin);
    devUrl.searchParams.set("mobile", "1");
    devUrl.searchParams.set("pkce", encryptedCookie);
    const res = NextResponse.redirect(devUrl, 303);
    res.cookies.set(cookieName, encryptedCookie, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });
    return res;
  }

  return NextResponse.json(
    {
      error: "AUTH_UNAVAILABLE",
      message: "Sign-in is currently unavailable",
    },
    { status: 503 },
  );
}

export async function handleMobileExchange(
  request: NextRequest,
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parseResult = z
    .object({
      code: z.string().min(20).max(100),
      verifier: z.string().min(43).max(128),
    })
    .safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", details: parseResult.error.issues },
      { status: 400 },
    );
  }

  const { code, verifier } = parseResult.data;
  const computedChallenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  const codeHash = hashToken(code);

  const exchangeSession = await prisma.session.findUnique({
    where: { tokenHash: codeHash },
  });

  if (!exchangeSession || exchangeSession.expiresAt <= new Date()) {
    return NextResponse.json(
      {
        error: "INVALID_OR_EXPIRED_CODE",
        message: "Authorization code has expired or is invalid",
      },
      { status: 400 },
    );
  }

  if (!exchangeSession.userAgent?.startsWith("exchange:")) {
    return NextResponse.json(
      {
        error: "NOT_AN_EXCHANGE_CODE",
        message: "Provided token is not an authorization exchange code",
      },
      { status: 400 },
    );
  }

  const parts = exchangeSession.userAgent.slice("exchange:".length).split(":");
  const storedChallenge = parts[0];

  if (!equalSecret(computedChallenge, storedChallenge)) {
    // Invalidate single-use code immediately on bad verifier to prevent brute force
    await prisma.session
      .delete({ where: { id: exchangeSession.id } })
      .catch(() => {});
    return NextResponse.json(
      {
        error: "INVALID_VERIFIER",
        message: "PKCE code verifier does not match challenge",
      },
      { status: 400 },
    );
  }

  // Issue real mobile session atomically
  const mobileToken = randomBytes(32).toString("base64url");
  const mobileTokenHash = hashToken(mobileToken);
  const expiresAt = new Date(Date.now() + 30 * 86400 * 1000); // 30 days

  await prisma.$transaction([
    prisma.session.delete({ where: { id: exchangeSession.id } }),
    prisma.session.create({
      data: {
        userId: exchangeSession.userId,
        tokenHash: mobileTokenHash,
        expiresAt,
        userAgent: "StudentValue-Mobile/1.0",
      },
    }),
  ]);

  const user = await getMobileSessionUser(mobileToken);
  if (!user) {
    return NextResponse.json(
      {
        error: "USER_NOT_FOUND",
        message: "User account could not be resolved",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    token: mobileToken,
    expiresAt: expiresAt.toISOString(),
    user,
  });
}

export async function handleMobileLogout(
  request: NextRequest,
): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "MISSING_BEARER_TOKEN" },
      { status: 400 },
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (/^[a-zA-Z0-9_-]{43}$/.test(token)) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  return NextResponse.json({ success: true });
}
