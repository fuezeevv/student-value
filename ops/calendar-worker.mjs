import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
const env = parseEnv(readFileSync("/srv/studentvalue/secrets/app.env", "utf8"));
if (env.GOOGLE_CALENDAR_ENABLED !== "true") process.exit(0);
if ((env.CRON_SECRET ?? "").length < 32)
  throw new Error("Calendar scheduler is not configured");
// Public canonical HTTPS only; never log the token, response bodies or user IDs.
try {
  const response = await fetch(
    "https://studentvalue1984.eu.cc/api/calendar/cron",
    {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      signal: AbortSignal.timeout(260000),
      redirect: "error",
    },
  );
  if (!response.ok) process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
console.log(
  process.exitCode
    ? "Calendar reconciliation failed"
    : "Calendar reconciliation completed",
);
