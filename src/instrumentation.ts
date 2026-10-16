/** Vercel starts functions directly, without scripts/production-start.mjs. */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    (process.env.SV_DEPLOYMENT_TARGET === "vercel" ||
      process.env.VERCEL === "1")
  ) {
    const { configureVercelRuntime } =
      await import("../scripts/lib/production-env.mjs");
    configureVercelRuntime(process.env, true);
  }
}
