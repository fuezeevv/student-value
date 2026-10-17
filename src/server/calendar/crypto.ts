import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { equalSecret } from "@/lib/auth/google";
export const CALENDAR_FLOW_COOKIE = "__Host-calendar-flow";
export const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.app.created";
function key(value: string) {
  const k = Buffer.from(value, "base64");
  if (k.length !== 32 || k.toString("base64") !== value)
    throw Error("Calendar encryption is unavailable");
  return k;
}
export function sealCalendarValue(
  value: string,
  secret: string,
  userId: string,
  purpose = "refresh",
) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(`sv-calendar-v1:${purpose}:${userId}`));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return (
    "v1." +
    Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")
  );
}
export function openCalendarValue(
  value: string,
  secret: string,
  userId: string,
  purpose = "refresh",
) {
  if (!value.startsWith("v1.") || value.length > 30000)
    throw Error("Invalid calendar ciphertext");
  const bytes = Buffer.from(value.slice(3), "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    bytes.subarray(0, 12),
  );
  decipher.setAAD(Buffer.from(`sv-calendar-v1:${purpose}:${userId}`));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
const flowSchema = z.object({
  userId: z.string(),
  state: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
  nonce: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
  verifier: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
  expires: z.number(),
});
export function makeCalendarFlow(
  userId: string,
  secret: string,
  now = Date.now(),
) {
  const flow = {
    userId,
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
    expires: now + 600000,
  };
  return {
    flow,
    cookie: sealCalendarValue(
      JSON.stringify(flow),
      secret,
      userId,
      "oauth-flow",
    ),
  };
}
export function readCalendarFlow(
  cookie: string,
  state: string,
  userId: string,
  secret: string,
  now = Date.now(),
) {
  const flow = flowSchema.parse(
    JSON.parse(openCalendarValue(cookie, secret, userId, "oauth-flow")),
  );
  if (
    flow.userId !== userId ||
    !equalSecret(state, flow.state) ||
    flow.expires <= now ||
    flow.expires > now + 600000
  )
    throw Error("Invalid calendar consent state");
  return flow;
}
export function calendarEnabled() {
  if (process.env.GOOGLE_CALENDAR_ENABLED !== "true") return false;
  try {
    key(process.env.CALENDAR_TOKEN_KEY ?? "");
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    );
  } catch {
    return false;
  }
}
export type CalendarFlow = ReturnType<typeof makeCalendarFlow>["flow"];
