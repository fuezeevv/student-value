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
    // Render's private PostgreSQL endpoint supports TLS with self-signed certificates.
    // sslmode=require encrypts traffic; access is additionally confined to the private network.
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("connection_limit", "5");
    url.searchParams.set("connect_timeout", "3");
    url.searchParams.set("pool_timeout", "3");
    result.DATABASE_URL = url.href;
  }
  return result;
}
function isLocalHost(host) {
  return (
    ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(host) ||
    /^127\./.test(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  );
}
