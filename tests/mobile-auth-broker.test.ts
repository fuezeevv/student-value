import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db/prisma";
import { hashToken } from "../src/lib/auth/google";
import {
  handleMobileAuthStart,
  handleMobileExchange,
  handleMobileLogout,
  getMobileSessionUser,
  decryptPkceCookie,
  getMobilePkceCookieName,
} from "../src/server/adapters/mobile-auth";

function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

describe("Mobile Auth Broker (RFC 7636 PKCE & Revocable Mobile Sessions)", () => {
  it("rejects invalid PKCE challenge, state, and unauthorized redirect URIs", async () => {
    // Invalid challenge (too short)
    const req1 = new NextRequest(
      "http://localhost:3000/api/v1/auth/mobile/start?challenge=short&state=validstate1234&redirect_uri=studentvalue://auth/callback",
    );
    const res1 = await handleMobileAuthStart(req1);
    expect(res1.status).toBe(400);
    const json1 = await res1.json();
    expect(json1.error).toBe("INVALID_CHALLENGE");

    // Invalid state (non-alphanumeric/invalid characters)
    const { challenge } = createPkcePair();
    const req2 = new NextRequest(
      `http://localhost:3000/api/v1/auth/mobile/start?challenge=${challenge}&state=bad%20state&redirect_uri=studentvalue://auth/callback`,
    );
    const res2 = await handleMobileAuthStart(req2);
    expect(res2.status).toBe(400);
    const json2 = await res2.json();
    expect(json2.error).toBe("INVALID_STATE");

    // Unauthorized redirect URI (not in allowlist)
    const req3 = new NextRequest(
      `http://localhost:3000/api/v1/auth/mobile/start?challenge=${challenge}&state=validstate1234&redirect_uri=https://evil.com/callback`,
    );
    const res3 = await handleMobileAuthStart(req3);
    expect(res3.status).toBe(400);
    const json3 = await res3.json();
    expect(json3.error).toBe("INVALID_REDIRECT_URI");
  });

  it("accepts valid parameters and sets encrypted PKCE broker cookie", async () => {
    const { challenge, state } = createPkcePair();
    const redirectUri = "studentvalue://auth/callback";
    const req = new NextRequest(
      `http://localhost:3000/api/v1/auth/mobile/start?challenge=${challenge}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    );
    const res = await handleMobileAuthStart(req);
    expect([302, 303]).toContain(res.status);

    const cookieName = getMobilePkceCookieName();
    const cookieHeader = res.headers.get("set-cookie") || "";
    expect(cookieHeader).toContain(cookieName);

    // Extract cookie value and decrypt
    const match = cookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
    expect(match).toBeTruthy();
    const decrypted = decryptPkceCookie(match![1]);
    expect(decrypted).not.toBeNull();
    expect(decrypted?.challenge).toBe(challenge);
    expect(decrypted?.state).toBe(state);
    expect(decrypted?.redirectUri).toBe(redirectUri);
    expect(decrypted?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects exchange with non-existent or expired exchange code", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/mobile/exchange",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: randomBytes(32).toString("base64url"),
          verifier: randomBytes(32).toString("base64url"),
        }),
      },
    );
    const res = await handleMobileExchange(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_OR_EXPIRED_CODE");
  });

  it("rejects verifier mismatch, invalidates code, and protects against replay", async () => {
    const user = await prisma.user.create({
      data: { nickname: "[TEST] pkce-student-" + randomBytes(4).toString("hex") },
    });
    const pairA = createPkcePair();
    const pairB = createPkcePair();

    const exchangeCode = randomBytes(32).toString("base64url");
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(exchangeCode),
        expiresAt: new Date(Date.now() + 60_000),
        userAgent: `exchange:${pairA.challenge}:studentvalue://auth/callback`,
      },
    });

    // Attempt exchange with wrong verifier (pairB instead of pairA)
    const reqWrong = new NextRequest(
      "http://localhost:3000/api/v1/auth/mobile/exchange",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: exchangeCode,
          verifier: pairB.verifier,
        }),
      },
    );
    const resWrong = await handleMobileExchange(reqWrong);
    expect(resWrong.status).toBe(400);
    const jsonWrong = await resWrong.json();
    expect(jsonWrong.error).toBe("INVALID_VERIFIER");

    // The code must have been burned/invalidated immediately to prevent brute force
    const rowAfter = await prisma.session.findUnique({
      where: { tokenHash: hashToken(exchangeCode) },
    });
    expect(rowAfter).toBeNull();
  });

  it("exchanges code atomically, burns code (single-use), and enables mobile session & logout", async () => {
    const suffix = randomBytes(4).toString("hex");
    const user = await prisma.user.create({
      data: { nickname: `[TEST] pkce-valid-${suffix}` },
    });
    await prisma.groupMember.create({
      data: { userId: user.id, groupId: "test-group", isOwner: false },
    });
    await prisma.enrollment.create({
      data: {
        groupId: "test-group",
        userId: user.id,
        fullName: `[TEST] PKCE Student ${suffix}`,
        status: "VERIFIED",
      },
    });

    const { verifier, challenge } = createPkcePair();
    const exchangeCode = randomBytes(32).toString("base64url");

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(exchangeCode),
        expiresAt: new Date(Date.now() + 60_000),
        userAgent: `exchange:${challenge}:studentvalue://auth/callback`,
      },
    });

    // Valid exchange
    const reqValid = new NextRequest(
      "http://localhost:3000/api/v1/auth/mobile/exchange",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: exchangeCode,
          verifier,
        }),
      },
    );
    const resValid = await handleMobileExchange(reqValid);
    expect(resValid.status).toBe(200);
    const jsonValid = await resValid.json();
    expect(jsonValid.token).toBeDefined();
    expect(jsonValid.user.id).toBe(user.id);

    // Single-use check: Trying to exchange again must fail
    const reqReplay = new NextRequest(
      "http://localhost:3000/api/v1/auth/mobile/exchange",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: exchangeCode,
          verifier,
        }),
      },
    );
    const resReplay = await handleMobileExchange(reqReplay);
    expect(resReplay.status).toBe(400);
    const jsonReplay = await resReplay.json();
    expect(jsonReplay.error).toBe("INVALID_OR_EXPIRED_CODE");

    // Verify bearer session resolves correctly
    const sessionUser = await getMobileSessionUser(jsonValid.token, "test-group");
    expect(sessionUser).not.toBeNull();
    expect(sessionUser?.id).toBe(user.id);
    expect(sessionUser?.groupId).toBe("test-group");

    // Test revocable logout
    const reqLogout = new NextRequest(
      "http://localhost:3000/api/v1/auth/mobile/logout",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jsonValid.token}`,
        },
      },
    );
    const resLogout = await handleMobileLogout(reqLogout);
    expect(resLogout.status).toBe(200);

    // After logout, session is revoked
    const afterLogoutUser = await getMobileSessionUser(jsonValid.token);
    expect(afterLogoutUser).toBeNull();
  });
});
