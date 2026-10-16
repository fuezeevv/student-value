import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { testEnvironment } from "./test-db.mjs";
const root = process.cwd();
const target = path.join(
  root,
  ".test-work",
  `production-artifact-${randomUUID()}`,
);
fs.mkdirSync(target, { recursive: true });
for (const file of ["package.json", "package-lock.json", "next.config.ts"]) {
  fs.copyFileSync(path.join(root, file), path.join(target, file));
}
fs.mkdirSync(path.join(target, "prisma"));
fs.copyFileSync(
  path.join(root, "prisma/schema.prisma"),
  path.join(target, "prisma/schema.prisma"),
);
// Copy compiled code, not symlinks: module resolution must use this clean runtime's dependencies.
fs.cpSync(
  path.join(root, ".next-production-check"),
  path.join(target, ".next"),
  {
    recursive: true,
    filter: (source) =>
      !source.startsWith(path.join(root, ".next-production-check/cache")),
  },
);
const isolated = testEnvironment();
const env = {
  ...isolated,
  NODE_ENV: "production",
  ALLOW_DEV_AUTH: "false",
  NEXT_TELEMETRY_DISABLED: "1",
  PUPPETEER_SKIP_DOWNLOAD: "true",
};
delete env.NEXT_DIST_DIR;
const log = fs.openSync(path.join(target, "runtime.log"), "w");
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: target,
    env,
    stdio: ["ignore", log, log],
  });
  assert.equal(
    result.status,
    0,
    `${command} failed; see ${path.relative(root, target)}/runtime.log`,
  );
}
run("npm", ["ci", "--omit=dev", "--ignore-scripts"]);
run(process.execPath, ["node_modules/prisma/build/index.js", "generate"]);
assert(
  !fs.existsSync(path.join(target, "node_modules/eslint")),
  "No linter in runtime",
);
assert(
  !fs.existsSync(path.join(target, "node_modules/puppeteer")),
  "No test browser in runtime",
);
assert(
  !fs.existsSync(path.join(target, ".env")),
  "No local secrets file in runtime",
);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3304",
  ],
  { cwd: target, env, stdio: ["ignore", log, log] },
);
try {
  const start = Date.now();
  while (true) {
    try {
      if (
        fs
          .readFileSync(path.join(target, "runtime.log"), "utf8")
          .includes("Ready in") &&
        (await fetch("http://127.0.0.1:3304/api/health/live")).ok
      )
        break;
    } catch {}
    if (server.exitCode !== null || Date.now() - start > 30000)
      throw Error("Clean production artifact did not start");
    await new Promise((r) => setTimeout(r, 200));
  }
  const ready = await fetch("http://127.0.0.1:3304/api/health");
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: "ok" });
  const guest = await fetch("http://127.0.0.1:3304/", {
    redirect: "manual",
    headers: { cookie: "study_dev_user_id=user-dev-owner" },
  });
  assert.equal(guest.status, 307);
  assert.equal(guest.headers.get("location"), "/login");
  const login = await (await fetch("http://127.0.0.1:3304/login")).text();
  assert(!login.includes("<form"));
  console.log(
    "PASS clean production dependencies, no .env or development tools: PostgreSQL readiness and closed production login work.",
  );
} finally {
  server.kill("SIGTERM");
  fs.closeSync(log);
}
