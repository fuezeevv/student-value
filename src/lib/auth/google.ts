import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const GOOGLE_FLOW_COOKIE = "__Host-google-flow";
export const SESSION_COOKIE = "__Host-session";
export const APP_GROUP_CODE = "5130901/40102";
export const secureCookie = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};
const FLOW_SECONDS = 600;
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 5000 },
);

export function googleConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  const id = env.GOOGLE_CLIENT_ID;
  const secret = env.GOOGLE_CLIENT_SECRET;
  if (!id && !secret) return null;
  if (
    !id ||
    !/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(id) ||
    !secret ||
    secret.length < 16
  )
    throw Error("Google sign-in configuration is incomplete");
  if (env.APP_ORIGIN !== "https://studentvalue1984.eu.cc")
    throw Error("Invalid Google callback origin");
  return { id, secret, callback: env.APP_ORIGIN + "/api/auth/google/callback" };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function equalSecret(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export interface GoogleFlow {
  state: string;
  nonce: string;
  verifier: string;
  expires: number;
  invite: string;
}
function flowKey(secret: string) {
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32 || key.toString("base64") !== secret)
    throw Error("Invalid sign-in encryption key");
  return Buffer.from(
    hkdfSync("sha256", key, "studentvalue1984", "google-flow-v1", 32),
  );
}
export function makeGoogleFlow(
  invite: string,
  secret: string,
  now = Date.now(),
) {
  if (invite && !/^[a-zA-Z0-9_-]{1,80}\.[a-zA-Z0-9_-]{43}$/.test(invite))
    throw Error("Invalid invitation");
  const flow: GoogleFlow = {
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
    expires: now + FLOW_SECONDS * 1000,
    invite,
  };
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", flowKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(flow)),
    cipher.final(),
  ]);
  return {
    flow,
    cookie: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      "base64url",
    ),
  };
}
export function readGoogleFlow(
  cookie: string,
  state: string,
  secret: string,
  now = Date.now(),
): GoogleFlow {
  if (!cookie || cookie.length > 2000 || !/^[a-zA-Z0-9_-]{43}$/.test(state))
    throw Error("Invalid sign-in state");
  try {
    const bytes = Buffer.from(cookie, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      flowKey(secret),
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(12, 28));
    const flow: GoogleFlow = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
    if (
      !equalSecret(flow.state, state) ||
      flow.expires <= now ||
      flow.expires > now + FLOW_SECONDS * 1000 ||
      !/^[a-zA-Z0-9_-]{43}$/.test(flow.nonce) ||
      !/^[a-zA-Z0-9_-]{43}$/.test(flow.verifier) ||
      typeof flow.invite !== "string"
    )
      throw Error("invalid");
    return flow;
  } catch {
    throw Error("Invalid or expired sign-in state");
  }
}
export function googleAuthorizationUrl(
  config: NonNullable<ReturnType<typeof googleConfiguration>>,
  flow: GoogleFlow,
) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.id,
    redirect_uri: config.callback,
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256")
      .update(flow.verifier)
      .digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "online",
  }).toString();
  return url;
}
export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}
export async function verifyGoogleIdentity(
  token: string,
  clientId: string,
  nonce: string,
  key: JWTVerifyGetKey = jwks,
): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(token, key, {
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    algorithms: ["RS256"],
    maxTokenAge: "10m",
    clockTolerance: 30,
    requiredClaims: ["sub", "exp", "iat", "nonce", "email", "email_verified"],
  });
  if (
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.length > 255 ||
    typeof payload.nonce !== "string" ||
    !equalSecret(payload.nonce, nonce) ||
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
    payload.email.length > 254 ||
    (payload.azp !== undefined && payload.azp !== clientId) ||
    (Array.isArray(payload.aud) &&
      payload.aud.length > 1 &&
      payload.azp !== clientId)
  )
    throw Error("Invalid Google identity");
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name:
      typeof payload.given_name === "string"
        ? payload.given_name.slice(0, 40)
        : "Студент",
  };
}
export async function exchangeGoogleCode(
  code: string,
  flow: GoogleFlow,
  config: NonNullable<ReturnType<typeof googleConfiguration>>,
) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: flow.verifier,
      client_id: config.id,
      client_secret: config.secret,
      redirect_uri: config.callback,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw Error("Google sign-in exchange failed");
  const body = await response.json();
  if (typeof body.id_token !== "string" || body.id_token.length > 20000)
    throw Error("Missing Google identity");
  // Access/refresh tokens are never persisted. No Drive/Calendar/offline scopes.
  return verifyGoogleIdentity(body.id_token, config.id, flow.nonce);
}
