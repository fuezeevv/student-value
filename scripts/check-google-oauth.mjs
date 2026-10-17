import fs from "node:fs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { testEnvironment } from "./test-db.mjs";

const isolated = testEnvironment();
const p = new PrismaClient({ datasourceUrl: isolated.DATABASE_URL });
const env = {
  ...isolated,
  NODE_ENV: "production",
  ALLOW_DEV_AUTH: "true",
  APP_ORIGIN: "https://studentvalue1984.eu.cc",
  NEXT_DIST_DIR: ".next-production-check",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  GOOGLE_CALENDAR_ENABLED: "true",
  CALENDAR_TOKEN_KEY: randomBytes(32).toString("base64"),
  CRON_SECRET: randomBytes(32).toString("base64url"),
  GOOGLE_CLIENT_ID: "12345-test.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "isolated-test-client-secret",
};
delete env.VERCEL;
fs.mkdirSync(".test-work", { recursive: true });
const log = fs.openSync(".test-work/google-oauth-http.log", "w", 0o600);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3306",
  ],
  { env, stdio: ["ignore", log, log] },
);
const base = "http://127.0.0.1:3306";
try {
  const start = Date.now();
  while (true) {
    try {
      if ((await fetch(base + "/login")).ok) break;
    } catch {}
    if (server.exitCode !== null || Date.now() - start > 30000)
      throw Error("Own OAuth test server unavailable");
    await new Promise((r) => setTimeout(r, 100));
  }
  const html = await (await fetch(base + "/login")).text();
  assert(html.includes("Войти через Google"));
  assert(!html.includes("Локальный вход"));
  assert(!html.includes(env.GOOGLE_CLIENT_SECRET));
  for (const [path, heading] of [
    ["/privacy", "Конфиденциальность"],
    ["/terms", "Условия использования"],
  ]) {
    const response = await fetch(base + path, { redirect: "manual" });
    assert.equal(response.status, 200, `${path} must be public`);
    const content = await response.text();
    assert(content.includes(heading));
    assert(content.includes(`https://studentvalue1984.eu.cc${path}`));
    assert(
      content.includes('href="/privacy"') && content.includes('href="/terms"'),
    );
    assert(!content.includes(env.GOOGLE_CLIENT_SECRET));
    assert(
      html.includes(`href="${path}"`),
      "Legal links must be available at sign-in",
    );
  }
  for (const origin of ["https://evil.invalid", ""]) {
    const denied = await fetch(base + "/api/auth/google", {
      method: "POST",
      headers: { origin },
      body: new URLSearchParams(),
      redirect: "manual",
    });
    assert.equal(denied.status, 403);
    assert(!denied.headers.get("set-cookie"));
  }
  const begun = await fetch(base + "/api/auth/google", {
    method: "POST",
    headers: { origin: env.APP_ORIGIN },
    body: new URLSearchParams(),
    redirect: "manual",
  });
  assert.equal(begun.status, 303);
  const google = new URL(begun.headers.get("location"));
  assert.equal(google.origin, "https://accounts.google.com");
  assert.equal(
    google.searchParams.get("redirect_uri"),
    env.APP_ORIGIN + "/api/auth/google/callback",
  );
  assert.equal(google.searchParams.get("scope"), "openid email profile");
  assert.equal(google.searchParams.get("code_challenge_method"), "S256");
  const cookie = begun.headers.get("set-cookie");
  for (const attribute of [
    "__Host-google-flow=",
    "HttpOnly",
    "Secure",
    "SameSite=lax",
    "Path=/",
  ])
    assert(cookie.includes(attribute));
  const flowCookie = cookie.split(";")[0];
  // Wrong state fails before token exchange. These checks make no requests to Google.
  const bad = await fetch(
    base +
      "/api/auth/google/callback?code=never-exchanged&state=" +
      randomBytes(32).toString("base64url"),
    { headers: { cookie: flowCookie }, redirect: "manual" },
  );
  assert.equal(bad.status, 303);
  assert.equal(
    bad.headers.get("location"),
    env.APP_ORIGIN + "/login?error=signin",
  );
  assert(bad.headers.get("set-cookie").includes("Max-Age=0"));
  assert(!bad.headers.get("set-cookie").includes("__Host-session="));

  // Fixture session only in the isolated local DB: proves the real production reader,
  // membership scope and revocation, without adding a test login endpoint or provider override.
  const group = await p.studyGroup.upsert({
    where: { code: "5130901/40102" },
    update: {},
    create: { code: "5130901/40102", name: "[TEST] OAuth HTTP group" },
  });
  const user = await p.user.create({
    data: { nickname: "[TEST] http-" + randomUUID() },
  });
  await p.groupMember.create({ data: { groupId: group.id, userId: user.id } });
  const enrollment = await p.enrollment.create({
    data: {
      groupId: group.id,
      userId: user.id,
      status: "CLAIMED",
      fullName: "[TEST] HTTP " + randomUUID(),
    },
  });
  const token = randomBytes(32).toString("base64url");
  const session = await p.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const request = () =>
    fetch(base + "/", {
      headers: { cookie: "__Host-session=" + token },
      redirect: "manual",
    });
  assert.equal((await request()).status, 200);
  const calendarHtml = await (
    await fetch(base + "/calendar", {
      headers: { cookie: "__Host-session=" + token },
    })
  ).text();
  assert(calendarHtml.includes("Подключить Google Calendar"));
  assert(!calendarHtml.includes(env.CALENDAR_TOKEN_KEY));
  assert(!calendarHtml.includes(env.GOOGLE_CLIENT_SECRET));
  assert.equal(
    (
      await fetch(base + "/api/calendar/connect", {
        method: "POST",
        headers: { origin: env.APP_ORIGIN },
        redirect: "manual",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(base + "/api/calendar/connect", {
        method: "POST",
        headers: {
          origin: "https://evil.invalid",
          cookie: "__Host-session=" + token,
        },
        redirect: "manual",
      })
    ).status,
    403,
  );
  assert.equal((await fetch(base + "/api/calendar/cron")).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/calendar/cron", {
        headers: { authorization: "Bearer wrong" },
      })
    ).status,
    401,
  );
  const calendarStart = await fetch(base + "/api/calendar/connect", {
    method: "POST",
    headers: { origin: env.APP_ORIGIN, cookie: "__Host-session=" + token },
    redirect: "manual",
  });
  assert.equal(calendarStart.status, 303);
  const calendarUrl = new URL(calendarStart.headers.get("location"));
  assert.equal(
    calendarUrl.searchParams.get("scope"),
    "openid email profile https://www.googleapis.com/auth/calendar.app.created",
  );
  assert.equal(calendarUrl.searchParams.get("access_type"), "offline");
  assert.equal(
    calendarUrl.searchParams.get("redirect_uri"),
    env.APP_ORIGIN + "/api/auth/google/callback",
  );
  assert.equal(calendarUrl.searchParams.get("code_challenge_method"), "S256");
  const calendarCookie = calendarStart.headers.get("set-cookie");
  assert(calendarCookie.includes("__Host-calendar-flow="));
  assert(calendarCookie.includes("Secure"));
  assert(calendarCookie.includes("HttpOnly"));
  assert(!calendarCookie.includes("__Host-session="));
  // Consent denial has correct state but never exchanges a code or changes the sign-in session.
  const deniedCalendar = await fetch(
    base +
      "/api/auth/google/callback?error=access_denied&state=" +
      calendarUrl.searchParams.get("state"),
    {
      headers: {
        cookie: "__Host-session=" + token + "; " + calendarCookie.split(";")[0],
      },
      redirect: "manual",
    },
  );
  assert.equal(deniedCalendar.status, 303);
  assert.equal(
    deniedCalendar.headers.get("location"),
    env.APP_ORIGIN + "/calendar?error=connect",
  );
  assert(!deniedCalendar.headers.get("set-cookie").includes("__Host-session="));
  assert.equal((await request()).status, 200);

  const second = await p.studyGroup.create({
    data: {
      code: "TEST-MULTI-" + randomUUID(),
      name: "[TEST] Second independent group",
    },
  });
  await p.groupMember.create({
    data: { groupId: second.id, userId: user.id, isOwner: false },
  });
  const secondEnrollment = await p.enrollment.create({
    data: {
      groupId: second.id,
      userId: user.id,
      status: "CLAIMED",
      fullName: "[TEST] Secret second roster name",
    },
  });
  const selectGroup = async (id) =>
    fetch(base + "/group", {
      headers: {
        cookie: "__Host-session=" + token + "; __Host-sv-group=" + id,
      },
      redirect: "manual",
    });
  const selected = await selectGroup(second.id);
  assert.equal(selected.status, 200);
  const secondHtml = await selected.text();
  assert(secondHtml.includes(second.name));
  assert(!secondHtml.includes(secondEnrollment.fullName));
  const forged = await selectGroup(randomUUID());
  assert.equal(forged.status, 200);
  assert((await forged.text()).includes(group.name));
  await p.enrollment.update({
    where: { id: secondEnrollment.id },
    data: { status: "ARCHIVED" },
  });
  const archived = await selectGroup(second.id);
  assert.equal(archived.status, 200);
  assert((await archived.text()).includes(group.name));
  await p.enrollment.update({
    where: { id: enrollment.id },
    data: { status: "ARCHIVED" },
  });
  assert.equal((await request()).status, 307);
  await p.enrollment.update({
    where: { id: enrollment.id },
    data: { status: "CLAIMED" },
  });
  await p.session.update({
    where: { id: session.id },
    data: { expiresAt: new Date(0) },
  });
  assert.equal((await request()).status, 307);
  console.log(
    "PASS production OAuth POST/state/cookie/callback guards; hashed sessions select only active enrolled groups, reject unowned/archived group cookies and expire. Calendar consent/denial/CSRF/cron guards preserve login. All data isolated; no Google calls.",
  );
} finally {
  server.kill("SIGTERM");
  fs.closeSync(log);
  await p.$disconnect();
}
