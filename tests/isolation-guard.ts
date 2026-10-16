import { afterAll } from "vitest";
import { prisma } from "../src/lib/db/prisma";
const url = new URL(process.env.DATABASE_URL!);
if (
  process.env.SV_TEST_ISOLATED !== "1" ||
  !/^\/studentvalue_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Tests refused: database is not isolated");
afterAll(() => prisma.$disconnect());
