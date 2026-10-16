if (
  process.env.NODE_ENV === "test" &&
  (process.env.SV_TEST_ISOLATED !== "1" ||
    !/^\/studentvalue_test_[a-z0-9_]+$/.test(
      new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid")
        .pathname,
    ))
) {
  throw new Error("Test runtime cannot connect to the working database");
}
import { PrismaClient } from "@prisma/client";
import { configureVercelRuntime } from "../../../scripts/lib/production-env.mjs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization keeps route collection/build independent of database credentials.
// Validation also happens here so a DB access cannot bypass the instrumentation hook.
let client: PrismaClient | undefined;
function getClient() {
  if (client) return client;
  configureVercelRuntime(
    process.env,
    process.env.SV_DEPLOYMENT_TARGET === "vercel",
  );
  client =
    globalForPrisma.prisma ??
    new PrismaClient({
      log:
        process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const target = getClient();
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
