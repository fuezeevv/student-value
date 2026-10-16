import { spawn } from "node:child_process";
import { assertProductionEnvironment } from "./lib/production-env.mjs";
let env;
try {
  env = assertProductionEnvironment(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const port = env.PORT ?? "10000";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error("Production configuration: invalid PORT");
  process.exit(1);
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "0.0.0.0",
    "--port",
    port,
  ],
  { env, stdio: "inherit" },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Production server could not start");
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
