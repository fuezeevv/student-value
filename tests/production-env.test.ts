import { describe, expect, it } from "vitest";
import { assertProductionEnvironment } from "../scripts/lib/production-env.mjs";
const valid = {
  NODE_ENV: "production",
  ALLOW_DEV_AUTH: "false",
  APP_ORIGIN: "https://studentvalue1984.eu.cc",
  DATABASE_URL:
    "postgresql://app:secret_for_test_only@private-db.example.invalid/studentvalue1984",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};
describe("production deployment safety", () => {
  it("requires explicit production mode and rejects a dev opt-in", () => {
    expect(() =>
      assertProductionEnvironment({ ...valid, NODE_ENV: "development" }),
    ).toThrow("NODE_ENV");
    expect(() =>
      assertProductionEnvironment({ ...valid, ALLOW_DEV_AUTH: "true" }),
    ).toThrow("ALLOW_DEV_AUTH");
    expect(() =>
      assertProductionEnvironment({ ...valid, SV_TEST_ISOLATED: "1" }),
    ).toThrow("overrides");
    expect(() =>
      assertProductionEnvironment({
        ...valid,
        TEST_DATABASE_URL: valid.DATABASE_URL,
      }),
    ).toThrow("overrides");
  });
  it("refuses local or test databases before starting a process", () => {
    for (const database of [
      "postgresql://u:p@localhost/app",
      "postgresql://u:p@127.0.0.2/app",
      "postgresql://u:p@[::1]/app",
      "postgresql://u:p@db.example.invalid/studentvalue_test_core",
      "postgresql://u:p@db.example.invalid/demo_db",
    ]) {
      expect(() =>
        assertProductionEnvironment({ ...valid, DATABASE_URL: database }),
      ).toThrow("DATABASE_URL");
    }
  });
  it("requires an HTTPS origin and a canonical persistent action key", () => {
    for (const origin of [
      "http://studentvalue1984.eu.cc",
      "https://localhost",
      "https://studentvalue1984.eu.cc/path",
      "https://u:p@studentvalue1984.eu.cc",
    ]) {
      expect(() =>
        assertProductionEnvironment({ ...valid, APP_ORIGIN: origin }),
      ).toThrow("APP_ORIGIN");
    }
    for (const key of ["", "placeholder", Buffer.alloc(16).toString("base64")])
      expect(() =>
        assertProductionEnvironment({
          ...valid,
          NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: key,
        }),
      ).toThrow("ENCRYPTION_KEY");
  });
  it("enforces encrypted, bounded database connections without changing credentials", () => {
    const result = assertProductionEnvironment({
      ...valid,
      DATABASE_URL:
        valid.DATABASE_URL +
        "?sslmode=disable&connection_limit=100&schema=public",
    });
    const url = new URL(result.DATABASE_URL!);
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("connection_limit")).toBe("5");
    expect(url.searchParams.get("schema")).toBe("public");
    expect(url.password).toBe("secret_for_test_only");
    expect(result.TZ).toBe("Europe/Moscow");
  });
  it("never includes a rejected secret or connection URL in an error", () => {
    const secret = "SENSITIVE_DO_NOT_LOG";
    try {
      assertProductionEnvironment({
        ...valid,
        DATABASE_URL: `postgresql://u:${secret}@localhost/app`,
      });
      throw Error("Did not reject");
    } catch (e) {
      expect(String(e)).not.toContain(secret);
      expect(String(e)).not.toContain("postgresql://");
    }
  });
  it("compiles without database credentials, but requires them to start", () => {
    expect(
      assertProductionEnvironment(
        { ...valid, DATABASE_URL: undefined },
        { database: false },
      ).APP_ORIGIN,
    ).toBe(valid.APP_ORIGIN);
    expect(() =>
      assertProductionEnvironment({ ...valid, DATABASE_URL: undefined }),
    ).toThrow("DATABASE_URL");
  });
});
