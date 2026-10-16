import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Deployment tools are versioned but never installed in the application's dependencies.
const commands = {
  vercel: { pkg: "vercel@64.4.0", bin: "vercel" },
  neon: { pkg: "neonctl@8.7.2", bin: "neonctl" },
};
const [, , name, ...args] = process.argv;
const command = commands[name];
if (!command || !args.length) {
  console.error("Usage: cloud-cli.mjs vercel|neon <command>");
  process.exit(1);
}
const cliArgs =
  process.versions.node === "24.22.0"
    ? [
        "exec",
        "--yes",
        `--package=${command.pkg}`,
        "--",
        command.bin,
        ...(name === "neon" ? ["--no-analytics"] : []),
        ...args,
      ]
    : [
        "exec",
        "--yes",
        "--package=node@24.22.0",
        "--",
        "node",
        fileURLToPath(import.meta.url),
        name,
        ...args,
      ];
const child = spawn("npm", cliArgs, {
  env: { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" },
  stdio: "inherit",
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Cloud CLI could not start");
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
