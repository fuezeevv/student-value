/** Fail closed even when ALLOW_DEV_AUTH accidentally reaches a production host. */
export function isDevAuthEnabled(
  env: { NODE_ENV?: string; ALLOW_DEV_AUTH?: string } = process.env,
) {
  return env.NODE_ENV === "development" && env.ALLOW_DEV_AUTH === "true";
}
