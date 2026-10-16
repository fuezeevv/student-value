import { prepareTestDatabase, run, loadEnv } from "./test-db.mjs";
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
loadEnv();
const workingUrl = process.env.DATABASE_URL;
const url = new URL(workingUrl);
url.pathname = process.argv.includes("--fresh")
  ? `/studentvalue_test_migrations_${Date.now()}`
  : "/studentvalue_test_migrations";
process.env.TEST_DATABASE_URL = url.href;
const env = prepareTestDatabase();
run(
  "node",
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "diff",
    "--from-schema-datasource",
    "prisma/schema.prisma",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--exit-code",
  ],
  env,
);
const fresh = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
const working = new PrismaClient({ datasourceUrl: workingUrl });
async function signature(p) {
  const columns = await p.$queryRawUnsafe(
    `SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name`,
  );
  const constraints = await p.$queryRawUnsafe(
    `SELECT rel.relname AS table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition,c.convalidated FROM pg_constraint c JOIN pg_class rel ON rel.oid=c.conrelid JOIN pg_namespace n ON n.oid=rel.relnamespace WHERE n.nspname='public' ORDER BY rel.relname,c.conname`,
  );
  const enums = await p.$queryRawUnsafe(
    `SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
  );
  return { columns, constraints, enums };
}
try {
  assert.equal(
    JSON.stringify(await signature(fresh)),
    JSON.stringify(await signature(working)),
    "PostgreSQL catalog differs (logical columns, constraints, enum values)",
  );
  console.log(
    "PASS fresh migrations, Prisma schema, and working PostgreSQL catalog (including CHECK validation) match.",
  );
} finally {
  await fresh.$disconnect();
  await working.$disconnect();
}
