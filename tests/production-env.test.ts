import { describe, expect, it } from "vitest";
import {
  assertProductionEnvironment,
  assertVercelEnvironment,
  assertNeonMigrationEnvironment,
  configureVercelRuntime,
} from "../scripts/lib/production-env.mjs";
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
  it("requires separate credential encryption and a cron secret only when personal Calendar is enabled", () => {
    const calendar = {
      ...valid,
      GOOGLE_CALENDAR_ENABLED: "true",
      GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
      CALENDAR_TOKEN_KEY: Buffer.alloc(32, 8).toString("base64"),
      CRON_SECRET: "isolated-cron-secret-at-least-32-characters",
    };
    expect(assertProductionEnvironment(calendar).GOOGLE_CALENDAR_ENABLED).toBe(
      "true",
    );
    for (const patch of [
      { CALENDAR_TOKEN_KEY: "" },
      { CALENDAR_TOKEN_KEY: valid.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY },
      { CRON_SECRET: "" },
      { GOOGLE_CLIENT_SECRET: "" },
    ])
      expect(() =>
        assertProductionEnvironment({ ...calendar, ...patch }),
      ).toThrow();
    expect(assertProductionEnvironment(valid).APP_ORIGIN).toBe(
      valid.APP_ORIGIN,
    );
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

const neon = {
  ...valid,
  VERCEL: "1",
  VERCEL_ENV: "production",
  DATABASE_URL:
    "postgresql://studentvalue_app:test-only@ep-fixture-pooler.eu-central-1.aws.neon.tech/neondb",
  DIRECT_DATABASE_URL:
    "postgresql://neondb_owner:migration-test-only@ep-fixture.eu-central-1.aws.neon.tech/neondb",
};
describe("Vercel and Neon boundaries", () => {
  it("can enforce the baked deployment target without optional provider variables", () => {
    expect(() =>
      configureVercelRuntime(
        { ...neon, VERCEL: "", ALLOW_DEV_AUTH: "true" },
        true,
      ),
    ).toThrow("ALLOW_DEV_AUTH");
  });
  it("bounds connections and requires certificate validation even without npm start", () => {
    const env = {
      ...neon,
      DATABASE_URL:
        neon.DATABASE_URL +
        "?sslmode=disable&sslaccept=accept_invalid_certs&connection_limit=999",
    };
    configureVercelRuntime(env);
    const url = new URL(env.DATABASE_URL);
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("sslaccept")).toBe("strict");
    expect(url.searchParams.get("connection_limit")).toBe("3");
    expect(url.searchParams.get("connect_timeout")).toBe("15");
  });
  it("keeps preview/development and test overrides out of the live database", () => {
    for (const patch of [
      { VERCEL_ENV: "preview" },
      { VERCEL_ENV: "development" },
      { APP_ORIGIN: "https://untrusted.vercel.app" },
      { ALLOW_DEV_AUTH: "true" },
      { SV_TEST_ISOLATED: "1" },
      { TEST_DATABASE_URL: neon.DATABASE_URL },
      { NEXT_DIST_DIR: ".next-test" },
      { NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "" },
    ])
      expect(() => assertVercelEnvironment({ ...neon, ...patch })).toThrow(
        "Production configuration:",
      );
  });
  it("rejects non-Neon, unpooled, local, alternative-schema and test runtime URLs", () => {
    for (const url of [
      valid.DATABASE_URL,
      neon.DIRECT_DATABASE_URL,
      neon.DATABASE_URL.replace(".neon.tech", ".neon.tech.attacker.invalid"),
      neon.DATABASE_URL.replace("neondb", "studentvalue_test_core"),
      neon.DATABASE_URL + "?schema=other",
      neon.DATABASE_URL + "?host=/var/run/postgresql",
      neon.DATABASE_URL + "?sslrootcert=untrusted.pem",
      neon.DATABASE_URL.replace("eu-central-1", "us-east-1"),
      "postgresql://u:p@localhost/app",
    ])
      expect(() =>
        assertVercelEnvironment({ ...neon, DATABASE_URL: url }),
      ).toThrow();
  });
  it("requires a matching direct endpoint for migrations; permits a separate migration role", () => {
    const result = assertNeonMigrationEnvironment(neon);
    expect(new URL(result.DATABASE_URL).username).toBe("neondb_owner");
    expect(new URL(result.DATABASE_URL).hostname).not.toContain("pooler");
    for (const direct of [
      undefined,
      neon.DATABASE_URL,
      neon.DIRECT_DATABASE_URL.replace("ep-fixture.", "ep-other."),
      neon.DIRECT_DATABASE_URL.replace(/\/neondb$/, "/other"),
    ])
      expect(() =>
        assertNeonMigrationEnvironment({
          ...neon,
          DIRECT_DATABASE_URL: direct,
        }),
      ).toThrow();
  });
  it("does not need database credentials while building and does not print malformed secrets", () => {
    expect(
      assertVercelEnvironment(
        { ...neon, DATABASE_URL: undefined },
        { database: false },
      ).APP_ORIGIN,
    ).toBe(neon.APP_ORIGIN);
    for (const direct of [
      "secret-not-a-url",
      "postgresql://owner:secret-not-a-url@localhost/app",
    ]) {
      try {
        assertNeonMigrationEnvironment({
          ...neon,
          DIRECT_DATABASE_URL: direct,
        });
      } catch (error) {
        expect(String(error)).not.toContain("secret-not-a-url");
      }
    }
  });
});
