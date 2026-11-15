/** Validate deployment inputs without ever printing their values or loading a local .env. */
export function assertProductionEnvironment(env, { database = true } = {}) {
  const fail = (message) => {
    throw new Error(`Production configuration: ${message}`);
  };
  if (env.NODE_ENV !== "production") fail("NODE_ENV must be production");
  if (env.ALLOW_DEV_AUTH && env.ALLOW_DEV_AUTH !== "false")
    fail("ALLOW_DEV_AUTH must be false or absent");
  if (
    env.SV_TEST_ISOLATED ||
    env.TEST_DATABASE_URL ||
    (database && env.NEXT_DIST_DIR)
  )
    fail("test/development overrides must be absent");
  let origin;
  try {
    origin = new URL(env.APP_ORIGIN);
  } catch {
    fail("APP_ORIGIN must be an absolute HTTPS origin");
  }
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    (origin.port && origin.port !== "443") ||
    isLocalHost(origin.hostname)
  )
    fail(
      "APP_ORIGIN must be a public HTTPS origin without path or credentials",
    );
  const key = env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ?? "";
  if (
    Buffer.from(key, "base64").length !== 32 ||
    Buffer.from(key, "base64").toString("base64") !== key
  )
    fail(
      "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY must be a persistent 32-byte base64 key",
    );
  if (
    env.GOOGLE_CALENDAR_ENABLED &&
    !["true", "false"].includes(env.GOOGLE_CALENDAR_ENABLED)
  )
    fail("GOOGLE_CALENDAR_ENABLED must be true or false");
  if (env.GOOGLE_CALENDAR_ENABLED === "true") {
    const calendarKey = env.CALENDAR_TOKEN_KEY ?? "";
    if (
      Buffer.from(calendarKey, "base64").length !== 32 ||
      Buffer.from(calendarKey, "base64").toString("base64") !== calendarKey
    )
      fail(
        "CALENDAR_TOKEN_KEY must be a separate persistent 32-byte base64 key",
      );
    if (calendarKey === key)
      fail("Calendar credential encryption must use a separate key");
    if ((env.CRON_SECRET ?? "").length < 32)
      fail("CRON_SECRET must be at least 32 characters");
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
      fail("Google Calendar requires Google OAuth credentials");
  }
  const result = {
    ...env,
    APP_ORIGIN: origin.origin,
    TZ: "Europe/Moscow",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  if (database) {
    let url;
    try {
      url = new URL(env.DATABASE_URL);
    } catch {
      fail("DATABASE_URL must be a PostgreSQL URL");
    }
    let databaseName;
    try {
      databaseName = decodeURIComponent(url.pathname.slice(1));
    } catch {
      fail("DATABASE_URL contains an invalid database name");
    }
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.username ||
      !url.password ||
      isLocalHost(url.hostname) ||
      !databaseName ||
      /(^|[_-])(test|demo)([_-]|$)/i.test(databaseName)
    )
      fail(
        "DATABASE_URL must target a remote, non-test PostgreSQL database with credentials",
      );
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("sslaccept", "strict");
    url.searchParams.set("connection_limit", "5");
    url.searchParams.set("connect_timeout", "3");
    url.searchParams.set("pool_timeout", "3");
    result.DATABASE_URL = url.href;
  }
  return result;
}

/** Vercel has no `npm start` hook. Shared by its build, runtime and release tooling. */
export function assertVercelEnvironment(env, { database = true } = {}) {
  if (env.VERCEL_ENV !== "production")
    throw new Error(
      "Production configuration: only the Vercel production environment is enabled",
    );
  const result = assertProductionEnvironment(env, { database });
  if (result.APP_ORIGIN !== "https://studentvalue1984.eu.cc")
    throw new Error(
      "Production configuration: APP_ORIGIN must be the canonical Student Value origin",
    );
  if (database) result.DATABASE_URL = neonUrl(result.DATABASE_URL, true);
  return result;
}

export function assertNeonMigrationEnvironment(env) {
  const runtime = assertVercelEnvironment(env);
  const direct = neonUrl(env.DIRECT_DATABASE_URL, false);
  const a = new URL(runtime.DATABASE_URL);
  const b = new URL(direct);
  if (
    a.hostname.replace("-pooler.", ".") !== b.hostname ||
    a.pathname !== b.pathname
  )
    throw new Error(
      "Production configuration: migration and runtime must target the same Neon endpoint and database",
    );
  return { ...runtime, DATABASE_URL: direct };
}

function neonUrl(value, pooled) {
  const fail = () => {
    throw new Error(
      `Production configuration: ${pooled ? "DATABASE_URL must be a pooled" : "DIRECT_DATABASE_URL must be an unpooled"} Neon PostgreSQL URL`,
    );
  };
  let url;
  try {
    url = new URL(value);
  } catch {
    fail();
  }
  let databaseName;
  try {
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    fail();
  }
  const allowed = new Set([
    "schema",
    "sslmode",
    "sslaccept",
    "connection_limit",
    "connect_timeout",
    "pool_timeout",
    "channel_binding",
    "application_name",
  ]);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.username ||
    !url.password ||
    !url.hostname.endsWith(".eu-central-1.aws.neon.tech") ||
    !/^ep-[a-z0-9-]+\./.test(url.hostname) ||
    url.hostname.split(".")[0].endsWith("-pooler") !== pooled ||
    (url.port && url.port !== "5432") ||
    !databaseName ||
    /(^|[_-])(test|demo)([_-]|$)/i.test(databaseName) ||
    url.hash ||
    [...url.searchParams.keys()].some((key) => !allowed.has(key)) ||
    (url.searchParams.has("schema") &&
      url.searchParams.get("schema") !== "public")
  )
    fail();
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("sslaccept", "strict");
  url.searchParams.set("connection_limit", pooled ? "3" : "1");
  url.searchParams.set("connect_timeout", "15");
  url.searchParams.set("pool_timeout", "15");
  return url.href;
}

export function configureVercelRuntime(env, required = false) {
  if (!required && env.VERCEL !== "1") return;
  const configured = assertVercelEnvironment(env);
  // Only publish normalized runtime settings; never copy arbitrary secrets into logs.
  env.DATABASE_URL = configured.DATABASE_URL;
  env.APP_ORIGIN = configured.APP_ORIGIN;
  env.TZ = configured.TZ;
}

/** Standalone has no npm-start hook either. Fail closed before any DB access. */
export function configureContainerRuntime(env) {
  const configured = assertProductionEnvironment(env);
  if (configured.APP_ORIGIN !== "https://studentvalue1984.eu.cc")
    throw new Error(
      "Production configuration: container requires the canonical origin",
    );
  const url = new URL(configured.DATABASE_URL);
  if (
    (url.port && url.port !== "5432") ||
    url.hash ||
    url.hostname !== "db" ||
    url.pathname !== "/studentvalue1984" ||
    url.username !== "studentvalue_app" ||
    url.searchParams.get("sslcert") !== "/run/tls/ca.crt" ||
    [...url.searchParams.keys()].some(
      (key) =>
        ![
          "sslcert",
          "sslmode",
          "sslaccept",
          "schema",
          "connection_limit",
          "connect_timeout",
          "pool_timeout",
        ].includes(key),
    ) ||
    (url.searchParams.has("schema") &&
      url.searchParams.get("schema") !== "public")
  )
    throw new Error(
      "Production configuration: container requires its private TLS database and app role",
    );
  env.DATABASE_URL = configured.DATABASE_URL;
  env.APP_ORIGIN = configured.APP_ORIGIN;
  env.TZ = configured.TZ;
}
function isLocalHost(host) {
  return (
    ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(host) ||
    /^127\./.test(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  );
}
