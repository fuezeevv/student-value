import { spawnSync } from "node:child_process";
import { assertVercelEnvironment } from "./lib/production-env.mjs";

let env;
try {
  env = assertVercelEnvironment(
    { ...process.env, NODE_ENV: "production" },
    { database: false },
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
// Never migrate, seed, or open a database in a build. Prisma only needs a syntactic URL.
env.DATABASE_URL = "postgresql://build:build@127.0.0.1:1/build_no_database";
env.SV_DEPLOYMENT_TARGET = "vercel";
delete env.DIRECT_DATABASE_URL;
for (const args of [
  ["node_modules/prisma/build/index.js", "generate"],
  ["node_modules/next/dist/bin/next", "build"],
  ["scripts/check-function-traces.mjs"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
