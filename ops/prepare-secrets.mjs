import fs from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { configureContainerRuntime } from "../scripts/lib/production-env.mjs";
// Run locally from the repository. Source files are read only; generated files are ignored.
const read = (file) => parseEnv(fs.readFileSync(file, "utf8"));
const original = {
  ...read("secrets/production.env"),
  ...read("secrets/google-oauth.env"),
  ...read("secrets/calendar-production.env"),
};
const destination = `secrets/ru-vps-${Date.now()}`;
const appPassword = randomBytes(32).toString("base64url");
const migrationPassword = randomBytes(32).toString("base64url");
const adminPassword = randomBytes(32).toString("base64url");
const databaseUrl = (role, password) =>
  `postgresql://${role}:${password}@db:5432/studentvalue1984?sslmode=require&sslaccept=strict&sslcert=%2Frun%2Ftls%2Fca.crt`;
const app = {
  NODE_ENV: "production",
  ALLOW_DEV_AUTH: "false",
  APP_ORIGIN: "https://studentvalue1984.eu.cc",
  SV_DEPLOYMENT_TARGET: "container",
  TZ: "Europe/Moscow",
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: databaseUrl("studentvalue_app", appPassword),
  ...Object.fromEntries(
    [
      "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_CALENDAR_ENABLED",
      "CALENDAR_TOKEN_KEY",
      "CRON_SECRET",
    ].map((name) => [name, original[name] ?? ""]),
  ),
};
configureContainerRuntime(app);
if (!app.GOOGLE_CLIENT_ID || !app.GOOGLE_CLIENT_SECRET)
  throw Error("Existing Google login credentials are missing");
fs.mkdirSync(destination, { mode: 0o700 });
const write = (name, value) =>
  fs.writeFileSync(`${destination}/${name}`, value, {
    mode: 0o600,
    flag: "wx",
  });
const env = (name, values) =>
  write(
    name,
    Object.entries(values)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n") + "\n",
  );
env("app.env", app);
env("db.env", {
  POSTGRES_DB: "studentvalue1984",
  POSTGRES_USER: "postgres",
  POSTGRES_PASSWORD: adminPassword,
  APP_DATABASE_PASSWORD: appPassword,
  MIGRATION_DATABASE_PASSWORD: migrationPassword,
  POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=scram-sha-256",
});
env("migration.env", {
  NODE_ENV: "production",
  DATABASE_URL: databaseUrl("studentvalue_migrate", migrationPassword),
});
env("backup.env", {
  PGPASSWORD: adminPassword,
  PGSSLMODE: "verify-full",
  PGSSLROOTCERT: "/run/tls/ca.crt",
});
write("action-key.base64", app.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY + "\n");
write("backup-key.base64", randomBytes(32).toString("base64") + "\n");
// Image tags are filled only after the exact checked commit is built.
write(
  "release.env",
  "# Fill APP_IMAGE and MIGRATION_IMAGE with the checked commit; no latest tags.\nACME_EMAIL=fuezeev@gmail.com\n",
);
console.log(
  `Prepared private VPS secret files in ${destination}; existing production keys and OAuth credentials preserved`,
);
