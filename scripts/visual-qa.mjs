// Visual matrix uses explicit test fixtures and its own server/database.
process.env.SV_CAPTURE_SCREENSHOTS = "matrix";
await import("./verify-ui-e2e.mjs");
