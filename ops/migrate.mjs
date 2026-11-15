import { spawnSync } from "node:child_process";
const url = new URL(process.env.DATABASE_URL ?? "https://invalid.invalid");
if (
  process.env.NODE_ENV !== "production" ||
  !["postgresql:", "postgres:"].includes(url.protocol) ||
  url.hostname !== "db" ||
  url.pathname !== "/studentvalue1984" ||
  url.username !== "studentvalue_migrate" ||
  !url.password ||
  url.searchParams.get("sslmode") !== "require" ||
  url.searchParams.get("sslaccept") !== "strict" ||
  url.searchParams.get("sslcert") !== "/run/tls/ca.crt" ||
  [...url.searchParams.keys()].some(
    (key) =>
      !["sslmode", "sslaccept", "sslcert", "connection_limit"].includes(key),
  )
) {
  console.error(
    "Refusing migration: expected the private production database and migration role",
  );
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    env: { ...process.env, ALLOW_DEV_AUTH: "false" },
    stdio: "inherit",
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
// Default privileges cover future application tables, but never the migration ledger.
const revoke = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "db",
    "execute",
    "--schema",
    "prisma/schema.prisma",
    "--stdin",
  ],
  {
    env: process.env,
    input:
      'REVOKE ALL ON TABLE public."_prisma_migrations" FROM studentvalue_app;',
    stdio: ["pipe", "inherit", "inherit"],
  },
);
process.exit(revoke.status ?? 1);
