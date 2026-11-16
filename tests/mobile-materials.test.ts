import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { testEnvironment } from "../scripts/test-db.mjs";
import { NextRequest } from "next/server";

const env = testEnvironment();
for (const [k, v] of Object.entries(env)) {
  process.env[k] = v;
}

describe("Mobile Material Download & Integrity (Stage C)", () => {
  let prisma: any;
  let handleMobileMaterialMetadata: any;
  let handleMobileMaterialFile: any;
  let hashToken: any;

  const validToken = randomBytes(32).toString("base64url");
  const testUserId = `test-user-mat-${randomBytes(4).toString("hex")}`;
  const foreignUserId = `test-user-foreign-${randomBytes(4).toString("hex")}`;
  const foreignToken = randomBytes(32).toString("base64url");

  const testMaterialId = `mat-${randomBytes(4).toString("hex")}`;
  const sampleContent = Buffer.from(
    "Лабораторная работа №1: Знакомство со средой SystemVerilog\n" +
      "Предмет: Синтез и моделирование аппаратных средств (ОТУ)\n" +
      "Цель: изучить синтаксис SystemVerilog и построить сдвиговый регистр.",
    "utf8",
  );
  const sampleSha256 = createHash("sha256").update(sampleContent).digest("hex");

  beforeAll(async () => {
    const dbModule = await import("../src/lib/db/prisma");
    prisma = dbModule.prisma;
    const authModule = await import("../src/lib/auth/google");
    hashToken = authModule.hashToken;

    const materialsAdapter = await import(
      "../src/server/adapters/mobile-materials"
    );
    handleMobileMaterialMetadata = materialsAdapter.handleMobileMaterialMetadata;
    handleMobileMaterialFile = materialsAdapter.handleMobileMaterialFile;

    // 1. Create test user and group membership in test-group
    await prisma.user.create({
      data: {
        id: testUserId,
        nickname: `MatTester_${testUserId}`,
      },
    });

    await prisma.session.create({
      data: {
        userId: testUserId,
        tokenHash: hashToken(validToken),
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });

    await prisma.groupMember.create({
      data: {
        groupId: "test-group",
        userId: testUserId,
        isOwner: false,
      },
    });

    await prisma.enrollment.create({
      data: {
        groupId: "test-group",
        userId: testUserId,
        fullName: `[TEST] Mat Student ${testUserId}`,
        status: "VERIFIED",
      },
    });

    // 2. Create foreign group and foreign user
    const foreignGroupId = `grp-foreign-${randomBytes(4).toString("hex")}`;
    await prisma.studyGroup.create({
      data: {
        id: foreignGroupId,
        code: `5130901/${Math.floor(10000 + Math.random() * 89999)}`,
        name: "Инородная группа",
      },
    });

    await prisma.user.create({
      data: {
        id: foreignUserId,
        nickname: `Foreign_${foreignUserId}`,
      },
    });

    await prisma.session.create({
      data: {
        userId: foreignUserId,
        tokenHash: hashToken(foreignToken),
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });

    await prisma.groupMember.create({
      data: {
        groupId: foreignGroupId,
        userId: foreignUserId,
        isOwner: false,
      },
    });

    await prisma.enrollment.create({
      data: {
        groupId: foreignGroupId,
        userId: foreignUserId,
        fullName: `[TEST] Foreign Student ${foreignUserId}`,
        status: "VERIFIED",
      },
    });

    // 3. Create material attached to test-course (which belongs to test-group)
    await prisma.courseMaterial.create({
      data: {
        id: testMaterialId,
        courseOfferingId: "test-course",
        title: "Методические указания к Лаб 1",
        type: "METHODOLOGY",
        url: `/api/v1/materials/${testMaterialId}/file`,
        sourceNote: "Официальное пособие",
        file: {
          create: {
            filename: "Lab1_Guide.txt",
            mimeType: "text/plain",
            byteSize: sampleContent.byteLength,
            sha256: sampleSha256,
            content: sampleContent,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unauthenticated metadata request with 401", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/v1/materials/${testMaterialId}/metadata`,
    );
    const res = await handleMobileMaterialMetadata(req, testMaterialId);
    expect(res.status).toBe(401);
  });

  it("rejects request from a user in a different group with 404 (isolation)", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/v1/materials/${testMaterialId}/metadata`,
      {
        headers: { authorization: `Bearer ${foreignToken}` },
      },
    );
    const res = await handleMobileMaterialMetadata(req, testMaterialId);
    expect(res.status).toBe(404);
  });

  it("returns metadata with exact byte size and SHA-256 for permitted student", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/v1/materials/${testMaterialId}/metadata`,
      {
        headers: { authorization: `Bearer ${validToken}` },
      },
    );
    const res = await handleMobileMaterialMetadata(req, testMaterialId);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(testMaterialId);
    expect(body.filename).toBe("Lab1_Guide.txt");
    expect(body.mimeType).toBe("text/plain");
    expect(body.byteSize).toBe(sampleContent.byteLength);
    expect(body.sha256).toBe(sampleSha256);
  });

  it("downloads file content and verifies client integrity matches sha256 and byteSize", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/v1/materials/${testMaterialId}/file?chunk=0`,
      {
        headers: { authorization: `Bearer ${validToken}` },
      },
    );
    const res = await handleMobileMaterialFile(req, testMaterialId);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-material-sha256")).toBe(sampleSha256);
    expect(res.headers.get("x-material-size")).toBe(
      String(sampleContent.byteLength),
    );

    const arrayBuffer = await res.arrayBuffer();
    const downloadedBuffer = Buffer.from(arrayBuffer);
    expect(downloadedBuffer.byteLength).toBe(sampleContent.byteLength);

    const computedSha = createHash("sha256")
      .update(downloadedBuffer)
      .digest("hex");
    expect(computedSha).toBe(sampleSha256);
    expect(downloadedBuffer.toString("utf8")).toBe(sampleContent.toString("utf8"));
  });

  it("rejects out-of-bounds chunk requests with 400", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/v1/materials/${testMaterialId}/file?chunk=999`,
      {
        headers: { authorization: `Bearer ${validToken}` },
      },
    );
    const res = await handleMobileMaterialFile(req, testMaterialId);
    expect(res.status).toBe(400);
  });

  it("stores downloaded material in SQLite, retrieves it offline, and purges on logout", async () => {
    const { TimetableSqliteRepository } = await import(
      "../packages/mobile-contracts/src/sqlite/repository"
    );
    const { NodeSqliteAdapter } = await import(
      "../packages/mobile-contracts/src/sqlite/node-adapter"
    );

    const memDb = NodeSqliteAdapter.openInMemory();
    const repo = new TimetableSqliteRepository(memDb);
    await repo.init();

    const downloadedMat = {
      materialId: testMaterialId,
      userId: testUserId,
      filename: "Lab1_Guide.txt",
      mimeType: "text/plain",
      byteSize: sampleContent.byteLength,
      sha256: sampleSha256,
      localPath: `/data/user/0/cc.eu.studentvalue1984.dev/files/materials/${testUserId}/${testMaterialId}/Lab1_Guide.txt`,
      downloadedAt: new Date().toISOString(),
    };

    await repo.saveDownloadedMaterial(downloadedMat);

    const retrieved = await repo.getDownloadedMaterial(testUserId, testMaterialId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.materialId).toBe(testMaterialId);
    expect(retrieved?.filename).toBe("Lab1_Guide.txt");
    expect(retrieved?.sha256).toBe(sampleSha256);
    expect(retrieved?.byteSize).toBe(sampleContent.byteLength);

    // Verify scheduled notification persistence
    const sampleNotif = {
      id: `notif-${randomBytes(4).toString("hex")}`,
      userId: testUserId,
      taskId: "task-otu-lab1",
      deadlineId: "dl-otu-lab1",
      notificationType: "DEADLINE_REMINDER" as const,
      triggerTime: new Date(Date.now() + 86400 * 1000).toISOString(),
      title: "Дедлайн приближается",
      body: "Лабораторная работа 1: SystemVerilog сдаётся завтра в 23:59",
      status: "SCHEDULED" as const,
      createdAt: new Date().toISOString(),
    };

    await repo.saveScheduledNotification(sampleNotif);
    const notifs = await repo.getScheduledNotificationsForTask(testUserId, "task-otu-lab1");
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe("Дедлайн приближается");

    // Purge on logout
    await repo.clearUserData(testUserId);

    const afterLogoutMat = await repo.getDownloadedMaterial(testUserId, testMaterialId);
    expect(afterLogoutMat).toBeNull();

    const afterLogoutNotifs = await repo.getScheduledNotificationsForTask(testUserId, "task-otu-lab1");
    expect(afterLogoutNotifs).toHaveLength(0);
  });
});
