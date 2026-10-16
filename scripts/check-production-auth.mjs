import fs from "node:fs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { testEnvironment } from "./test-db.mjs";
const env = {
  ...testEnvironment(),
  NODE_ENV: "production",
  ALLOW_DEV_AUTH: "true",
  NEXT_DIST_DIR: ".next-production-check",
  NEXT_TELEMETRY_DISABLED: "1",
};
fs.mkdirSync(".test-work", { recursive: true });
const log = fs.openSync(".test-work/production-auth.log", "w");
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3302",
  ],
  { env, stdio: ["ignore", log, log] },
);
const base = "http://127.0.0.1:3302";
try {
  const start = Date.now();
  while (true) {
    try {
      if (
        fs
          .readFileSync(".test-work/production-auth.log", "utf8")
          .includes("Ready in") &&
        (await fetch(base + "/login")).ok
      )
        break;
    } catch {}
    if (server.exitCode !== null || Date.now() - start > 30000)
      throw new Error("Production server unavailable");
    await new Promise((r) => setTimeout(r, 200));
  }
  const live = await fetch(base + "/api/health/live");
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: "ok" });
  const ready = await fetch(base + "/api/health");
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: "ok" });
  assert.equal(ready.headers.get("cache-control"), "no-store");
  assert.equal(ready.headers.get("x-content-type-options"), "nosniff");
  assert.equal(ready.headers.get("x-frame-options"), "DENY");
  assert.equal(
    ready.headers.get("strict-transport-security"),
    "max-age=31536000",
  );
  assert.equal(ready.headers.get("x-powered-by"), null);
  for (const cookie of [
    "",
    "study_dev_user_id=user-dev-owner",
    "study_dev_user_id=user-dev-student",
    "study_dev_user_id=user-dev-owner; __Host-session=forged-token",
  ]) {
    for (const route of [
      "/",
      "/admin",
      "/courses",
      "/tasks/task-otu-lab1",
      "/deadlines",
      "/calendar",
      "/members",
      "/search?q=test",
      "/transcripts",
      "/analytics",
      "/settings",
      "/notifications",
      "/leaderboard",
    ]) {
      const r = await fetch(base + route, {
        headers: { cookie },
        redirect: "manual",
      });
      assert([307, 308].includes(r.status), route);
      assert.equal(r.headers.get("location"), "/login");
    }
    const r = await fetch(base + "/api/calendar/export", {
      headers: { cookie },
    });
    assert.equal(r.status, 401);
  }
  const text = await (await fetch(base + "/login")).text();
  assert(!text.includes("Локальный вход"));
  assert(!text.includes("<form"), "No local login forms in production");
  console.log(
    "PASS production liveness, database readiness, cache policy and security headers.",
  );
  console.log(
    "PASS production runtime rejects absent/forged sessions and dev cookies with ALLOW_DEV_AUTH=true (56 requests).",
  );
} finally {
  server.kill("SIGTERM");
  fs.closeSync(log);
}
