// Capture only the isolated E2E server. Never navigate to the working app.
process.env.SV_CAPTURE_SCREENSHOTS = "1";
await import("./verify-ui-e2e.mjs");
