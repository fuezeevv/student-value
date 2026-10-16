import fs from "node:fs";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { testEnvironment } from "./test-db.mjs";
const isolated = testEnvironment();
const unavailable = new URL(isolated.DATABASE_URL);
unavailable.port = "59999";
unavailable.username = "health_test_only";
unavailable.password = "DO_NOT_LOG_HEALTH_TEST_PASSWORD";
unavailable.pathname = "/studentvalue_test_unavailable";
unavailable.searchParams.set("connect_timeout", "1");
const common = {
  ...isolated,
  NODE_ENV: "production",
  ALLOW_DEV_AUTH: "false",
  NEXT_DIST_DIR: ".next-production-check",
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: unavailable.href,
};
// The deployment entrypoint must fail before opening a server for an unsafe configuration.
const forbidden = spawnSync(
  process.execPath,
  ["scripts/production-start.mjs"],
  {
    env: {
      ...common,
      ALLOW_DEV_AUTH: "true",
      APP_ORIGIN: "https://studentvalue1984.eu.cc",
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    },
    encoding: "utf8",
  },
);
assert.equal(forbidden.status, 1);
assert(forbidden.stderr.includes("ALLOW_DEV_AUTH"));
assert(!forbidden.stderr.includes(unavailable.password));
fs.mkdirSync(".test-work", { recursive: true });
const log = fs.openSync(".test-work/production-health.log", "w");
// Tests intentionally start the built Next binary on their own port/build directory.
// This is not the deployment entrypoint and does not add an application auth bypass.
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3303",
  ],
  { env: common, stdio: ["ignore", log, log] },
);
try {
  const start = Date.now();
  while (true) {
    try {
      if (
        fs
          .readFileSync(".test-work/production-health.log", "utf8")
          .includes("Ready in") &&
        (await fetch("http://127.0.0.1:3303/api/health/live")).ok
      )
        break;
    } catch {}
    if (server.exitCode !== null || Date.now() - start > 30000)
      throw Error("Own health test server did not start");
    await new Promise((r) => setTimeout(r, 200));
  }
  const ready = await fetch("http://127.0.0.1:3303/api/health");
  assert.equal(ready.status, 503);
  assert.deepEqual(await ready.json(), { status: "unavailable" });
  assert.equal(ready.headers.get("cache-control"), "no-store");
  const live = await fetch("http://127.0.0.1:3303/api/health/live");
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: "ok" });
  console.log(
    "PASS unsafe production startup rejected; readiness 503 is sanitized and liveness remains 200 when isolated database is unavailable.",
  );
} finally {
  server.kill("SIGTERM");
  fs.closeSync(log);
}
