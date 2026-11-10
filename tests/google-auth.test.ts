import { beforeAll, describe, expect, it } from "vitest";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from "jose";
import {
  googleAuthorizationUrl,
  googleConfiguration,
  makeGoogleFlow,
  readGoogleFlow,
  verifyGoogleIdentity,
} from "../src/lib/auth/google";
import {
  createEnrollmentGrant,
  checkEnrollmentGrant,
} from "../src/server/domain/google-login";
const secret = Buffer.alloc(32, 41).toString("base64");
const id = "12345-test.apps.googleusercontent.com";
const config = {
  id,
  secret: "test-secret-not-real",
  callback: "https://studentvalue1984.eu.cc/api/auth/google/callback",
};

describe("OAuth browser binding", () => {
  it("encrypts state, nonce, PKCE and invitation; rejects a different browser and tampering", () => {
    const invite = createEnrollmentGrant(
      "test-enrollment",
      "student@example.invalid",
      null,
    ).code;
    const { flow, cookie } = makeGoogleFlow(invite, secret);
    expect(cookie).not.toContain(invite);
    expect(readGoogleFlow(cookie, flow.state, secret)).toEqual(flow);
    expect(() =>
      readGoogleFlow(cookie, makeGoogleFlow("", secret).flow.state, secret),
    ).toThrow();
    expect(() =>
      readGoogleFlow(
        (cookie[0] === "X" ? "Y" : "X") + cookie.slice(1),
        flow.state,
        secret,
      ),
    ).toThrow();
    expect(() =>
      readGoogleFlow(
        cookie,
        flow.state,
        Buffer.alloc(32, 42).toString("base64"),
      ),
    ).toThrow();
    expect(() =>
      readGoogleFlow(cookie, flow.state, secret, flow.expires),
    ).toThrow();
  });
  it("requests only login scopes and binds the exact canonical callback", () => {
    const { flow } = makeGoogleFlow("", secret);
    const url = googleAuthorizationUrl(config, flow);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("redirect_uri")).toBe(config.callback);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).not.toBe(flow.verifier);
    expect(url.searchParams.get("nonce")).toBe(flow.nonce);
    expect(url.searchParams.get("access_type")).toBe("online");
  });
  it("fails closed on partial configuration or a noncanonical callback origin", () => {
    expect(googleConfiguration({})).toBeNull();
    for (const env of [
      { GOOGLE_CLIENT_ID: id },
      { GOOGLE_CLIENT_SECRET: config.secret },
      {
        GOOGLE_CLIENT_ID: id,
        GOOGLE_CLIENT_SECRET: config.secret,
        APP_ORIGIN: "https://evil.invalid",
      },
    ])
      expect(() => googleConfiguration(env)).toThrow();
  });
});

describe("signed Google identity", () => {
  let keys: Awaited<ReturnType<typeof generateKeyPair>>;
  let resolver: ReturnType<typeof createLocalJWKSet>;
  beforeAll(async () => {
    keys = await generateKeyPair("RS256");
    resolver = createLocalJWKSet({
      keys: [
        { ...(await exportJWK(keys.publicKey)), kid: "test-key", alg: "RS256" },
      ],
    });
  });
  async function jwt(patch: JWTPayload = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      sub: "verified-subject",
      aud: id,
      iss: "https://accounts.google.com",
      iat: now,
      exp: now + 300,
      nonce: "nonce-for-this-browser",
      email: "Student@example.invalid",
      email_verified: true,
      ...patch,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .sign(keys.privateKey);
  }
  it("accepts a valid signature, audience, issuer, nonce and verified email", async () => {
    expect(
      await verifyGoogleIdentity(
        await jwt(),
        id,
        "nonce-for-this-browser",
        resolver,
      ),
    ).toMatchObject({
      sub: "verified-subject",
      email: "student@example.invalid",
    });
  });
  for (const [name, patch] of Object.entries({
    issuer: { iss: "https://attacker.invalid" },
    audience: { aud: "other" },
    expiry: { exp: 1 },
    missingExpiry: { exp: undefined },
    missingIssuedAt: { iat: undefined },
    oldToken: { iat: 1 },
    unverifiedEmail: { email_verified: false },
    wrongEmailType: { email_verified: "true" },
    missingSubject: { sub: "" },
    nonce: { nonce: "other-browser" },
    authorizedParty: { azp: "other" },
    multipleAudiences: { aud: [id, "another-client"] },
  })) {
    it(`rejects invalid ${name}`, async () => {
      await expect(
        verifyGoogleIdentity(
          await jwt(patch),
          id,
          "nonce-for-this-browser",
          resolver,
        ),
      ).rejects.toThrow();
    });
  }
  it("rejects tokens signed by an unknown key", async () => {
    const other = await generateKeyPair("RS256");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .sign(other.privateKey);
    await expect(
      verifyGoogleIdentity(token, id, "nonce-for-this-browser", resolver),
    ).rejects.toThrow();
  });
});

describe("recipient-bound enrollment grant", () => {
  it("stores only hashes and binds recipient, enrollment's current user and expiry", () => {
    const grant = createEnrollmentGrant(
      "enrollment",
      "Student@example.invalid",
      null,
      1000,
    );
    expect(grant.stored).not.toContain(grant.code.split(".")[1]);
    expect(grant.stored).not.toContain("student@example.invalid");
    expect(
      checkEnrollmentGrant(
        grant.code.replace("enrollment.", "other."),
        grant.stored,
        "student@example.invalid",
        null,
        2000,
      ),
    ).toBe(false);
    expect(
      checkEnrollmentGrant(
        grant.code,
        grant.stored,
        "student@example.invalid",
        null,
        2000,
      ),
    ).toBe(true);
    expect(
      checkEnrollmentGrant(
        grant.code,
        grant.stored,
        "other@example.invalid",
        null,
        2000,
      ),
    ).toBe(false);
    expect(
      checkEnrollmentGrant(
        grant.code,
        grant.stored,
        "student@example.invalid",
        "changed-user",
        2000,
      ),
    ).toBe(false);
    expect(
      checkEnrollmentGrant(
        grant.code,
        grant.stored,
        "student@example.invalid",
        null,
        1000 + 72 * 3600 * 1000,
      ),
    ).toBe(false);
    expect(
      checkEnrollmentGrant(
        grant.code,
        "legacy-plaintext-token",
        "student@example.invalid",
        null,
      ),
    ).toBe(false);
  });
});
