import { configureContainerRuntime } from "./lib/production-env.mjs";
try {
  configureContainerRuntime(process.env);
} catch {
  console.error(
    "Container production configuration is invalid; refusing to start",
  );
  process.exit(1);
}
const port = process.env.PORT || "3000";
if (!/^\d+$/.test(port) || +port < 1 || +port > 65535)
  throw Error("Invalid production port");
process.env.PORT = port;
process.env.HOSTNAME ||= "0.0.0.0";
await import("../server.js");
