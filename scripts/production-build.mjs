import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assertProductionEnvironment } from "./lib/production-env.mjs";
let env;
try {
  env = assertProductionEnvironment(
    { ...process.env, NODE_ENV: "production" },
    { database: false },
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
// Compilation does not run migrations, seed, integration tests, or connect to the database.
env.DATABASE_URL = "postgresql://build:build@127.0.0.1:1/build_no_database";
delete env.DIRECT_DATABASE_URL;
for (const args of [
  ["node_modules/prisma/build/index.js", "generate"],
  ["node_modules/next/dist/bin/next", "build"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (env.SV_DEPLOYMENT_TARGET === "container") {
  const dist = env.NEXT_DIST_DIR || ".next";
  if (!/^\.next(?:-[a-z0-9-]+)?$/.test(dist))
    throw Error("Unexpected standalone output directory");
  const standalone = path.resolve(dist, "standalone");
  // Next explicitly copies loaded dotenv files independently of file tracing.
  // Remove only the generated duplicates inside this artifact, never the working env files.
  for (const item of fs.readdirSync(standalone, { withFileTypes: true })) {
    if (item.isFile() && /^\.env(?:\.|$)/.test(item.name))
      fs.unlinkSync(path.join(standalone, item.name));
  }
  for (const forbidden of [
    ".env",
    ".env.production",
    "secrets",
    "backups",
    ".test-work",
    "tests",
    "prisma/test-fixtures.ts",
  ])
    if (fs.existsSync(path.join(standalone, forbidden)))
      throw Error("Forbidden input in standalone output");
  console.log(
    "PASS standalone artifact excludes copied dotenv, private source trees and test fixtures",
  );
}
