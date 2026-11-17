import http from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { prepareTestDatabase } from "./test-db.mjs";

async function main() {
  // This server issues synthetic identities and seeds fixtures. It must never
  // use the academic working database, even during a physical-device demo.
  const env = prepareTestDatabase();
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }
  process.env.ALLOW_DEV_AUTH = "true";
  (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ||= Buffer.alloc(32, 1).toString("base64");

  const { NextRequest } = await import("next/server");
  const { handleTimetableRequest } = await import(
    "../src/server/adapters/timetable-v1"
  );
  const {
    handleMobileAuthStart,
    handleMobileExchange,
    handleMobileLogout,
    decryptPkceCookie,
    getMobilePkceCookieName,
  } = await import("../src/server/adapters/mobile-auth");
  const {
    handleMobileProgress,
    handleGetMobileProgress,
  } = await import("../src/server/adapters/mobile-progress");
  const {
    handleMobileMaterialMetadata,
    handleMobileMaterialFile,
  } = await import("../src/server/adapters/mobile-materials");
  const { handleGetMobileTasks } = await import(
    "../src/server/adapters/mobile-tasks"
  );
  const { prisma } = await import("../src/lib/db/prisma");
  const { hashToken } = await import("../src/lib/auth/google");

  // Ensure test user has enrollment in an available group
  let testUser: any = null;
  const testGroup = await prisma.studyGroup.findFirst({
    where: {
      id: "test-group",
    },
  });

  if (testGroup) {
    testUser = await prisma.user.upsert({
      where: { id: "test-user-rasool" },
      update: {},
      create: {
        id: "test-user-rasool",
        nickname: "Rasool",
      },
    });

    await prisma.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId: testGroup.id,
          userId: testUser.id,
        },
      },
      update: {},
      create: {
        groupId: testGroup.id,
        userId: testUser.id,
        isOwner: false,
      },
    });

    await prisma.enrollment.upsert({
      where: {
        groupId_userId: {
          groupId: testGroup.id,
          userId: testUser.id,
        },
      },
      update: {},
      create: {
        groupId: testGroup.id,
        userId: testUser.id,
        fullName: "Rasool Student",
        status: "VERIFIED",
      },
    });
  }

  // Stage C: Seed course material for test-course or offering-otu and task-otu-lab1
  const otuOffering = await prisma.courseOffering.findFirst({
    where: { OR: [{ id: "offering-otu" }, { id: "test-course" }] },
  });

  if (otuOffering) {
    const sampleGuide = Buffer.from(
      "Лабораторная работа №1: Знакомство со средой SystemVerilog\n" +
        "Предмет: Синтез и моделирование аппаратных средств (ОТУ)\n" +
        "Группа: 5130901/40102\n\n" +
        "Цель работы:\n" +
        "1. Освоить базовый синтаксис языка описания аппаратуры SystemVerilog.\n" +
        "2. Реализовать параметризованный модуль сдвигового регистра.\n" +
        "3. Провести функциональное моделирование в ModelSim / QuestaSim.\n\n" +
        "Требования к отчёту:\n" +
        "- Исходный код модуля и testbench.\n" +
        "- Временные диаграммы симуляции.\n" +
        "- Выводы по выполненной работе.",
      "utf8",
    );
    const sampleSha = createHash("sha256").update(sampleGuide).digest("hex");

    await prisma.courseMaterial.upsert({
      where: { id: "material-otu-lab1" },
      update: {
        title: "Методические указания: SystemVerilog Lab1",
        url: "/api/v1/materials/material-otu-lab1/file",
        type: "METHODOLOGY",
        sourceNote: "[TEST] Synthetic fixture; not an academic source",
      },
      create: {
        id: "material-otu-lab1",
        courseOfferingId: otuOffering.id,
        title: "Методические указания: SystemVerilog Lab1",
        type: "METHODOLOGY",
        url: "/api/v1/materials/material-otu-lab1/file",
        sourceNote: "[TEST] Synthetic fixture; not an academic source",
      },
    });

    await prisma.materialFile.upsert({
      where: { materialId: "material-otu-lab1" },
      update: {
        filename: "SystemVerilog_Lab1_Guide.txt",
        mimeType: "text/plain",
        byteSize: sampleGuide.byteLength,
        sha256: sampleSha,
        content: sampleGuide,
      },
      create: {
        materialId: "material-otu-lab1",
        filename: "SystemVerilog_Lab1_Guide.txt",
        mimeType: "text/plain",
        byteSize: sampleGuide.byteLength,
        sha256: sampleSha,
        content: sampleGuide,
      },
    });

    await prisma.taskMaterial.upsert({
      where: {
        taskId_materialId: {
          taskId: "task-otu-lab1",
          materialId: "material-otu-lab1",
        },
      },
      update: {},
      create: {
        taskId: "task-otu-lab1",
        materialId: "material-otu-lab1",
      },
    });
  }

  // Seed multi-chunk binary file (> 1 MiB) for testing chunked download & binary SHA-256
  const binarySize = 1_500_000; // ~1.43 MiB (2 chunks)
  const binaryContent = Buffer.alloc(binarySize);
  // Write PDF magic bytes header
  binaryContent.write("%PDF-1.4\n%Binary test material for Student Value Stage C\n", 0);
  for (let i = 60; i < binarySize; i++) {
    binaryContent[i] = (i * 31 + 17) % 256;
  }
  const binarySha = createHash("sha256").update(binaryContent).digest("hex");

  if (otuOffering) {
    await prisma.courseMaterial.upsert({
      where: { id: "material-binary-guide" },
      update: {
        title: "Руководство к выполнению (PDF, 1.4 МБ)",
        url: "/api/v1/materials/material-binary-guide/file",
        type: "METHODOLOGY",
        sourceNote: "[TEST] Synthetic PDF fixture; not an academic source",
      },
      create: {
        id: "material-binary-guide",
        courseOfferingId: otuOffering.id,
        title: "Руководство к выполнению (PDF, 1.4 МБ)",
        type: "METHODOLOGY",
        url: "/api/v1/materials/material-binary-guide/file",
        sourceNote: "[TEST] Synthetic PDF fixture; not an academic source",
      },
    });

    await prisma.materialFile.upsert({
      where: { materialId: "material-binary-guide" },
      update: {
        filename: "SystemVerilog_Advanced_Reference.pdf",
        mimeType: "application/pdf",
        byteSize: binaryContent.byteLength,
        sha256: binarySha,
        content: binaryContent,
      },
      create: {
        materialId: "material-binary-guide",
        filename: "SystemVerilog_Advanced_Reference.pdf",
        mimeType: "application/pdf",
        byteSize: binaryContent.byteLength,
        sha256: binarySha,
        content: binaryContent,
      },
    });
  }

  const port = Number(process.env.PORT || 3000);

  const server = http.createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const rawUrl = req.url ?? "/";
    const urlObj = new URL(rawUrl, `http://127.0.0.1:${port}`);
    const pathname = urlObj.pathname;

    console.log(`[MOBILE_TEST_SERVER] ${method} ${pathname}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Authorization",
    );

    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      // 1. Mobile auth approval page in browser Custom Tab
      if (pathname === "/login" && urlObj.searchParams.get("mobile") === "1") {
        const pkceCookieName = getMobilePkceCookieName();
        const pkceFromQuery = urlObj.searchParams.get("pkce");
        const cookieHeader = req.headers.cookie || "";
        const match = cookieHeader.match(new RegExp(`${pkceCookieName}=([^;]+)`));
        const pkceRaw = pkceFromQuery || (match ? match[1] : "");
        const pkce = decryptPkceCookie(pkceRaw);

        if (req.method === "POST") {
          // User clicked "Войти" in the browser
          if (!pkce) {
            res.statusCode = 400;
            res.end("Expired PKCE session");
            return;
          }

          const exchangeCode = randomBytes(32).toString("base64url");
          await prisma.session.create({
            data: {
              userId: testUser.id,
              tokenHash: hashToken(exchangeCode),
              expiresAt: new Date(Date.now() + 60_000), // 60s
              userAgent: `exchange:${pkce.challenge}:${pkce.redirectUri}`,
            },
          });

          const redirectUrl = new URL(pkce.redirectUri);
          redirectUrl.searchParams.set("code", exchangeCode);
          redirectUrl.searchParams.set("state", pkce.state);

          res.statusCode = 303;
          res.setHeader("Location", redirectUrl.href);
          res.end();
          return;
        }

        // Render HTML confirmation in system browser
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Вход · Student Value</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #0b1424;
                  color: #f0f4f8;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  padding: 20px;
                  box-sizing: border-box;
                }
                .card {
                  background: #16253d;
                  border: 1px solid #223554;
                  border-radius: 20px;
                  padding: 28px;
                  width: 100%;
                  max-width: 380px;
                  text-align: center;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                }
                .avatar {
                  width: 64px;
                  height: 64px;
                  border-radius: 32px;
                  background: #2563eb;
                  color: #fff;
                  font-size: 28px;
                  font-weight: bold;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 16px;
                }
                h2 { margin: 0 0 6px; font-size: 20px; }
                p { color: #8a9bb5; font-size: 14px; margin: 0 0 24px; }
                button {
                  width: 100%;
                  background: #2563eb;
                  color: #fff;
                  border: none;
                  border-radius: 12px;
                  padding: 14px;
                  font-size: 16px;
                  font-weight: 600;
                  cursor: pointer;
                }
                .note {
                  font-size: 12px;
                  color: #6b7d96;
                  margin-top: 16px;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="avatar">R</div>
                <h2>Авторизация в приложении</h2>
                <p>Войти как <strong>Rasool</strong> (группа 5130901/40102)</p>
                <form method="POST" action="/login?mobile=1&pkce=${encodeURIComponent(pkceRaw)}">
                  <button type="submit">Подтвердить вход</button>
                </form>
                <div class="note">OAuth 2.0 PKCE · Перенаправление в Student Value</div>
              </div>
            </body>
          </html>
        `);
        return;
      }

      // Read request body if present
      let bodyBuffer: Buffer | null = null;
      if (method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        bodyBuffer = Buffer.concat(chunks);
      }

      const host = req.headers.host || `127.0.0.1:${port}`;
      const fullUrl = `http://${host}${rawUrl}`;
      const nextReq = new NextRequest(fullUrl, {
        method,
        headers: req.headers as Record<string, string>,
        body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
      });

      const matMetaMatch = pathname.match(
        /^\/api\/v1\/materials\/([^/]+)\/metadata$/,
      );
      const matFileMatch = pathname.match(
        /^\/api\/v1\/materials\/([^/]+)\/file$/,
      );

      let nextRes;
      if (matMetaMatch) {
        nextRes = await handleMobileMaterialMetadata(nextReq, matMetaMatch[1]);
      } else if (matFileMatch) {
        nextRes = await handleMobileMaterialFile(nextReq, matFileMatch[1]);
      } else if (pathname === "/api/v1/timetable") {
        nextRes = await handleTimetableRequest(nextReq);
      } else if (pathname === "/api/v1/auth/mobile/start") {
        nextRes = await handleMobileAuthStart(nextReq);
      } else if (pathname === "/api/v1/auth/mobile/exchange") {
        nextRes = await handleMobileExchange(nextReq);
      } else if (pathname === "/api/v1/auth/mobile/logout") {
        nextRes = await handleMobileLogout(nextReq);
      } else if (pathname === "/api/v1/tasks") {
        nextRes = await handleGetMobileTasks(nextReq);
      } else if (pathname === "/api/v1/progress") {
        if (method === "POST") {
          nextRes = await handleMobileProgress(nextReq);
          console.log("[MOBILE_TEST_SERVER] progress response status:", nextRes.status);
          const clone = nextRes.clone();
          console.log("[MOBILE_TEST_SERVER] progress response body:", await clone.text());
        } else {
          nextRes = await handleGetMobileProgress(nextReq);
        }
      } else {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ code: "NOT_FOUND", message: "Endpoint not found" }));
        return;
      }

      res.statusCode = nextRes.status;
      for (const [k, v] of nextRes.headers.entries()) {
        if (k.toLowerCase() === "set-cookie") continue;
        res.setHeader(k, v);
      }
      if (typeof nextRes.headers.getSetCookie === "function") {
        const cookies = nextRes.headers.getSetCookie();
        if (cookies.length > 0) {
          res.setHeader("Set-Cookie", cookies);
        }
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
      `[MOBILE_TEST_SERVER] Serving API v1 (auth, timetable, progress) on http://0.0.0.0:${port}`,
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
