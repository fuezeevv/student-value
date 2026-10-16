import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

// No database requests in this check. Other suites use isolated local PostgreSQL.
const target = path.resolve(".test-work", `vercel-runtime-${randomUUID()}`);
fs.mkdirSync(target, { recursive: true });
fs.cpSync(".next-vercel-check", path.join(target, ".next"), {
  recursive: true,
  filter: (source) => !source.startsWith(".next-vercel-check/cache"),
});
fs.symlinkSync(path.resolve("node_modules"), path.join(target, "node_modules"));
fs.copyFileSync("next.config.ts", path.join(target, "next.config.ts"));
const env = {
  ...process.env,
  NODE_ENV: "production",
  VERCEL: "1",
  VERCEL_ENV: "production",
  APP_ORIGIN: "https://studentvalue1984.eu.cc",
  ALLOW_DEV_AUTH: "false",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  DATABASE_URL:
    "postgresql://studentvalue_app:only-a-test@ep-runtime-fixture-pooler.eu-central-1.aws.neon.tech/neondb",
};
for (const key of [
  "NEXT_DIST_DIR",
  "TEST_DATABASE_URL",
  "SV_TEST_ISOLATED",
  "DIRECT_DATABASE_URL",
])
  delete env[key];

async function check(patch, shouldStart) {
  const logFile = path.join(target, `${randomUUID()}.log`);
  const log = fs.openSync(logFile, "w", 0o600);
  const child = spawn(
    process.execPath,
    [
      path.resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3305",
    ],
    { cwd: target, env: { ...env, ...patch }, stdio: ["ignore", log, log] },
  );
  try {
    const started = Date.now();
    while (Date.now() - started < 30000) {
      const text = fs.readFileSync(logFile, "utf8");
      if (child.exitCode !== null) break;
      if (text.includes("Ready in")) {
        // Next 15 can print Ready before the instrumentation promise settles.
        // The security boundary is that no request is served successfully.
        if (!shouldStart) {
          let response;
          try {
            response = await fetch("http://127.0.0.1:3305/api/health/live", {
              signal: AbortSignal.timeout(5000),
            });
          } catch {}
          assert(
            !response || response.status >= 500,
            "Unsafe Vercel runtime served a request",
          );
          assert(
            fs
              .readFileSync(logFile, "utf8")
              .includes("Production configuration:"),
          );
          assert(!fs.readFileSync(logFile, "utf8").includes("only-a-test"));
          return;
        }
        const live = await fetch("http://127.0.0.1:3305/api/health/live");
        assert.equal(live.status, 200);
        const response = await fetch("http://127.0.0.1:3305/", {
          redirect: "manual",
          headers: { cookie: "study_dev_user_id=user-dev-owner" },
        });
        assert.equal(response.status, 307);
        assert.equal(response.headers.get("location"), "/login");
        const login = await fetch("http://127.0.0.1:3305/login");
        assert.equal(login.status, 200);
        assert(!(await login.text()).includes("Локальный вход"));
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(!shouldStart, "Safe Vercel runtime did not start");
    assert.notEqual(child.exitCode, null, "Unsafe runtime did not exit");
    const text = fs.readFileSync(logFile, "utf8");
    assert(text.includes("Production configuration:"));
    assert(!text.includes("only-a-test"));
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
    fs.closeSync(log);
  }
}
await check({}, true);
await check({ VERCEL: "" }, true);
for (const patch of [
  { ALLOW_DEV_AUTH: "true" },
  { VERCEL_ENV: "preview" },
  { DATABASE_URL: "postgresql://u:only-a-test@localhost/app" },
  { NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "" },
  { SV_TEST_ISOLATED: "1" },
  { VERCEL: "", ALLOW_DEV_AUTH: "true" },
  { VERCEL: "", VERCEL_ENV: "" },
])
  await check(patch, false);
console.log(
  "PASS Vercel functions validate runtime without npm start; preview/test/dev configurations fail closed; no DB calls made.",
);
