import { spawnSync } from "node:child_process";
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
for (const args of [
  ["node_modules/prisma/build/index.js", "generate"],
  ["node_modules/next/dist/bin/next", "build"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
