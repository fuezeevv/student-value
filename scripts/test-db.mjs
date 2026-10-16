import fs from "node:fs";
import { spawnSync } from "node:child_process";
export function loadEnv() {
  if (fs.existsSync(".env")) process.loadEnvFile(".env");
}
export function testEnvironment() {
  loadEnv();
  const working = new URL(process.env.DATABASE_URL);
  const test = new URL(
    process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  );
  if (!process.env.TEST_DATABASE_URL) test.pathname = "/studentvalue_test_core";
  if (
    !/^\/studentvalue_test_[a-z0-9_]+$/.test(test.pathname) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(test.hostname)
  )
    throw new Error("Tests require a local studentvalue_test_* database");
  if (
    test.host === working.host &&
    test.pathname === working.pathname &&
    process.env.SV_TEST_ISOLATED !== "1"
  )
    throw new Error("Refusing to use the working database for tests");
  return {
    ...process.env,
    DATABASE_URL: test.href,
    TEST_DATABASE_URL: test.href,
    SV_TEST_ISOLATED: "1",
    TZ: "UTC",
  };
}
export function run(command, args, env, options = {}) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status})`);
}
export function prepareTestDatabase() {
  const env = testEnvironment();
  const url = new URL(env.DATABASE_URL);
  const pg = {
    ...env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: "postgres",
  };
  const name = url.pathname.slice(1);
  const check = spawnSync(
    process.env.PSQL_BIN || "psql",
    ["-tAc", `SELECT 1 FROM pg_database WHERE datname='${name}'`],
    { env: pg, encoding: "utf8" },
  );
  if (check.status !== 0) throw new Error("Cannot inspect local test database");
  if (check.stdout.trim() !== "1")
    run(process.env.CREATEDB_BIN || "createdb", [name], pg);
  run("node", ["node_modules/prisma/build/index.js", "migrate", "deploy"], env);
  return env;
}
