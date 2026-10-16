if (process.env.NODE_ENV === "test" && (process.env.SV_TEST_ISOLATED !== "1" || !/^\/studentvalue_test_[a-z0-9_]+$/.test(new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname))) {
  throw new Error("Test runtime cannot connect to the working database");
}
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
