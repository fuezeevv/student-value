import http from "node:http";
import { prepareTestDatabase } from "./test-db.mjs";

async function main() {
  const env = prepareTestDatabase();
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }

  const { NextRequest } = await import("next/server");
  const { handleTimetableRequest } = await import(
    "../src/server/adapters/timetable-v1"
  );

  const port = Number(process.env.PORT || 3000);

  const server = http.createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const url = req.url ?? "/";
    console.log(`[MOBILE_TEST_SERVER] ${method} ${url}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      const fullUrl = `http://127.0.0.1:${port}${url}`;
      const nextReq = new NextRequest(fullUrl, {
        method,
        headers: req.headers as Record<string, string>,
      });

      const nextRes = await handleTimetableRequest(nextReq);
      res.statusCode = nextRes.status;
      for (const [k, v] of nextRes.headers.entries()) {
        res.setHeader(k, v);
      }
      const bodyText = await nextRes.text();
      res.end(bodyText);
    } catch (err: any) {
      console.error("[MOBILE_TEST_SERVER] Request error:", err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ code: "INTERNAL_ERROR", message: err.message }));
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(
      `[MOBILE_TEST_SERVER] Serving timetable v1 on http://0.0.0.0:${port}`,
    );
  });

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      console.log("[MOBILE_TEST_SERVER] Shutting down...");
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
