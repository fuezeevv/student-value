import { spawnSync } from "node:child_process";
import { assertProductionEnvironment } from "./lib/production-env.mjs";
let env;
try {
  env = assertProductionEnvironment(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
// Never seed or reset a production database. Prisma's migration lock serializes deployment.
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
