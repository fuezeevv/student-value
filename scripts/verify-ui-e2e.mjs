import puppeteer from "puppeteer";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prepareTestDatabase, run, loadEnv } from "./test-db.mjs";
import assert from "node:assert/strict";
loadEnv();
const workingUrl = process.env.DATABASE_URL;
const isolatedUrl = new URL(workingUrl);
isolatedUrl.pathname = "/studentvalue_test_e2e";
process.env.TEST_DATABASE_URL = isolatedUrl.href;
const env = prepareTestDatabase();
run("node", ["node_modules/tsx/dist/cli.mjs", "prisma/test-fixtures.ts"], env);
const test = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
const working = new PrismaClient({ datasourceUrl: workingUrl });
async function fingerprint() {
  const rows = await Promise.all(
    [
      "task",
      "deadline",
      "announcement",
      "studentTaskProgress",
      "xpEvent",
      "userAchievement",
      "user",
      "enrollment",
    ].map((name) => working[name].findMany({ orderBy: { id: "asc" } })),
  );
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
const before = await fingerprint();
const privateNote = `[TEST] Мой черновик ${randomUUID()}`;
fs.mkdirSync(".test-work", { recursive: true });
const log = fs.openSync(".test-work/e2e-server.log", "w");
const port = 3301;
const base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...env,
      NODE_ENV: "development",
      ALLOW_DEV_AUTH: "true",
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", log, log],
  },
);
let browser;
const passed = [];
async function scenario(name, fn) {
  await fn();
  passed.push(name);
  console.log(`PASS ${name}`);
}
try {
  const manager = await test.user.upsert({
    where: { id: "test-manager" },
    update: {},
    create: { id: "test-manager", nickname: "test_manager" },
  });
  await test.authIdentity.upsert({
    where: {
      provider_providerUserId: {
        provider: "LOCAL_DEV",
        providerUserId: manager.id,
      },
    },
    update: {},
    create: {
      provider: "LOCAL_DEV",
      providerUserId: manager.id,
      userId: manager.id,
    },
  });
  const member = await test.groupMember.upsert({
    where: { groupId_userId: { groupId: "test-group", userId: manager.id } },
    update: {},
    create: { groupId: "test-group", userId: manager.id },
  });
  const role = await test.role.upsert({
    where: { groupId_name: { groupId: "test-group", name: "Task Editor" } },
    update: {},
    create: { groupId: "test-group", name: "Task Editor" },
  });
  await test.rolePermission.upsert({
    where: {
      roleId_permission: { roleId: role.id, permission: "manage_tasks" },
    },
    update: {},
    create: { roleId: role.id, permission: "manage_tasks" },
  });
  await test.userGroupRole.upsert({
    where: {
      groupMemberId_roleId: { groupMemberId: member.id, roleId: role.id },
    },
    update: {},
    create: { groupMemberId: member.id, roleId: role.id },
  });
  await test.classSession.upsert({
    where: { id: "test-session" },
    update: {},
    create: {
      id: "test-session",
      courseOfferingId: "test-course",
      sessionDate: new Date("2026-10-16T10:00:00+03:00"),
      type: "LECTURE",
      topic: "[TEST] Безопасность транскрипции",
    },
  });
  await test.transcript.upsert({
    where: { id: "test-transcript" },
    update: {},
    create: {
      id: "test-transcript",
      sessionId: "test-session",
      rawText:
        '<img src=x onerror="window.__transcriptExecuted=true"> Текст [ и (.*) <script>window.__transcriptExecuted=true</script>',
    },
  });
  // A dedicated published deadline, with an actual evidence reference.
  const taskId = `e2e-${randomUUID()}`;
  await test.task.create({
    data: {
      id: taskId,
      courseOfferingId: "test-course",
      title: "[TEST] Проверка переноса срока",
      type: "HOMEWORK",
      createdById: "user-dev-owner",
      updatedById: "user-dev-owner",
      audiences: { create: { targetType: "GROUP", groupId: "test-group" } },
    },
  });
  const deadline = await test.deadline.create({
    data: {
      taskId,
      courseOfferingId: "test-course",
      date: new Date("2026-10-16T23:59:59.999+03:00"),
      isTimeStrict: false,
      createdById: "user-dev-owner",
    },
  });
  const evidence = await test.sourceReference.create({
    data: {
      sourceId: "test-teacher-source",
      entityType: "DEADLINE",
      entityId: deadline.id,
      quoteText: "[TEST] Дата изолированного сценария",
      confidence: "CONFIRMED",
    },
  });
  await test.deadline.update({
    where: { id: deadline.id },
    data: { provenance: "TEACHER", sourceReferenceId: evidence.id },
  });
  const start = Date.now();
  while (true) {
    try {
      if (
        !fs
          .readFileSync(".test-work/e2e-server.log", "utf8")
          .includes("Ready in")
      )
        throw new Error("Own test server is not ready");
      const r = await fetch(`${base}/login`);
      if (r.ok) break;
    } catch {}
    if (server.exitCode !== null)
      throw new Error(
        "Isolated Next server exited; see .test-work/e2e-server.log",
      );
    if (Date.now() - start > 60000)
      throw new Error("Isolated Next server did not start");
    await new Promise((r) => setTimeout(r, 300));
  }
  browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const setUser = async (id) => {
    await page.setCookie({ name: "study_dev_user_id", value: id, url: base });
  };
  const go = async (route) =>
    page.goto(base + route, { waitUntil: "networkidle2", timeout: 30000 });
  const body = () => page.evaluate(() => document.body.innerText);
  const clickText = async (text) => {
    const buttons = await page.$$("button");
    for (const b of buttons) {
      if ((await b.evaluate((el) => el.textContent)).includes(text)) {
        await b.click();
        return;
      }
    }
    throw new Error(`Button missing: ${text}`);
  };
  const setInput = async (selector, value) => {
    await page.$eval(
      selector,
      (el, val) => {
        const proto =
          el.tagName === "TEXTAREA"
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      },
      value,
    );
  };
  await scenario("guest cannot use a fallback owner", async () => {
    await go("/");
    assert(page.url().endsWith("/login"));
  });
  await setUser("user-dev-student");
  await scenario("student cannot access admin or private roster", async () => {
    await go("/admin");
    assert((await body()).includes("403 Доступ ограничен"));
    await go("/members");
    assert(!(await body()).includes("PRIVATE user-dev-owner"));
  });
  await scenario(
    "server hides foreign, subgroup, individual and draft tasks",
    async () => {
      for (const id of [
        "test-foreign-task",
        "test-subgroup-task",
        "test-individual-task",
        "test-draft-task",
        "test-no-audience",
      ]) {
        const r = await go(`/tasks/${id}`);
        assert.equal(r.status(), 404, id);
      }
    },
  );
  await scenario(
    "variant is not guessed and self acceptance is unavailable",
    async () => {
      await go("/tasks/task-otu-lab1");
      assert((await body()).includes("Вариант не назначен"));
      assert(!(await body()).includes("Ваш индивидуальный вариант: 99"));
      assert(await page.$eval('option[value="ACCEPTED"]', (el) => el.disabled));
    },
  );
  await scenario(
    "student progress and private notes persist through reload",
    async () => {
      await page.select("select", "IN_PROGRESS");
      await page.waitForFunction(() =>
        document.body.innerText.includes("В работе"),
      );
      await setInput("textarea", privateNote);
      await clickText("Сохранить");
      await page.waitForFunction(() =>
        document.body.innerText.includes("Сохранено"),
      );
      await page.reload({ waitUntil: "networkidle2" });
      assert.equal(await page.$eval("textarea", (el) => el.value), privateNote);
      assert.equal(await page.$eval("select", (el) => el.value), "IN_PROGRESS");
    },
  );
  await scenario(
    "transcript HTML and regex characters are rendered as text",
    async () => {
      await go("/transcripts");
      await page.type("input", "img");
      assert.equal(
        await page.evaluate(() => window.__transcriptExecuted),
        undefined,
      );
      assert.equal((await page.$$eval("mark", (els) => els.length)) > 0, true);
      assert.equal(await page.$$eval("img[onerror]", (els) => els.length), 0);
      assert((await body()).includes("<img"));
      await setInput("input", "[");
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("mark")).some(
          (el) => el.textContent === "[",
        ),
      );
    },
  );
  await scenario(
    "daily navigation works on phone and desktop without horizontal overflow",
    async () => {
      for (const width of [360, 390, 768, 1440]) {
        await page.setViewport({ width, height: 900 });
        for (const route of [
          "/",
          "/courses",
          "/courses/test-course",
          "/tasks/task-otu-lab1",
          "/deadlines",
          "/analytics",
          "/search?q=TEST",
          "/notifications",
          "/settings",
        ]) {
          await go(route);
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${route} overflows at ${width}`,
          );
          assert.equal(
            await page.$$eval("main h1", (nodes) => nodes.length),
            1,
            `${route} has one page heading`,
          );
        }
      }
      await page.setViewport({ width: 390, height: 844 });
      await go("/");
      await page.click('.mobile-nav a[href="/courses"]');
      await page.waitForFunction(() => location.pathname === "/courses");
      await page.click('main a[href="/courses/test-course"]');
      await page.waitForFunction(
        () => location.pathname === "/courses/test-course",
      );
      await page.click('main a[href="/tasks/task-otu-lab1"]');
      await page.waitForSelector('select[aria-label="Мой этап работы"]');
      await page.click('button[aria-label="Открыть меню"]');
      await page.waitForSelector("#account-menu");
      await page.keyboard.press("Escape");
      assert.equal(await page.$("#account-menu"), null);
      await page.setViewport({ width: 1280, height: 900 });
    },
  );
  await setUser("test-manager");
  await scenario(
    "task editor receives no private enrollment payload",
    async () => {
      await go("/admin");
      const html = await page.content();
      assert(!html.includes("PRIVATE user-dev-student"));
      assert(!html.includes("PRIVATE user-dev-owner"));
    },
  );
  await setUser("user-dev-owner");
  await scenario(
    "headman records another student result with an explicit source",
    async () => {
      await go("/tasks/task-otu-lab1");
      await page.click(
        'details:has(select[aria-label="Студент для подтверждения"]) summary',
      );
      await page.select(
        'select[aria-label="Студент для подтверждения"]',
        "test-peer",
      );
      await setInput(
        'input[aria-label="Источник подтверждения"]',
        "[TEST] Преподаватель на защите 16.10.2026",
      );
      await setInput(
        'textarea[aria-label="Основание подтверждения"]',
        "[TEST] Преподаватель сообщил: работа студента test_peer принята.",
      );
      await clickText("Записать результат с источником");
      await page.waitForFunction(() =>
        document.body.innerText.includes(
          "Подтверждение преподавателя записано старостой",
        ),
      );
      const row = await test.studentTaskProgress.findUniqueOrThrow({
        where: {
          taskId_userId: { taskId: "task-otu-lab1", userId: "test-peer" },
        },
        include: { verificationEvidence: true },
      });
      assert.equal(row.status, "ACCEPTED");
      assert.equal(row.verificationSource, "HEADMAN_CONFIRMED");
      assert.equal(row.verifiedById, "user-dev-owner");
      assert(row.verificationEvidence.quoteText.includes("test_peer"));
      await setUser("test-peer");
      await go("/tasks/task-otu-lab1");
      assert(
        (await body()).includes("Результат преподавателя записан старостой"),
      );
      await setUser("user-dev-owner");
    },
  );
  await scenario(
    "deadline UI stores history, date-only time, source and notification",
    async () => {
      await go("/admin");
      await clickText("Дедлайны и сроки");
      await page.waitForSelector(`[data-deadline-id="${deadline.id}"] button`);
      await page.click(`[data-deadline-id="${deadline.id}"] button`);
      await setInput('input[aria-label="Новая дата срока"]', "2026-11-20");
      await setInput(
        'input[aria-label="Основание изменения срока"]',
        "[TEST] Преподаватель перенёс срок; изолированный E2E",
      );
      await clickText("Сохранить");
      await page.waitForFunction(() =>
        document.body.innerText.includes("Срок сдачи успешно изменен!"),
      );
      const old = await test.deadline.findUniqueOrThrow({
        where: { id: deadline.id },
      });
      const next = await test.deadline.findFirstOrThrow({
        where: { originalDeadlineId: deadline.id },
      });
      assert.equal(old.status, "SUPERSEDED");
      assert.equal(next.date.toISOString(), "2026-11-20T20:59:59.999Z");
      assert(next.sourceReferenceId);
      await setUser("user-dev-student");
      await go(`/tasks/${taskId}`);
      assert((await body()).includes("20.11.2026"));
      assert(!(await body()).includes("03:00"));
      assert(
        await test.notification.findFirst({
          where: {
            userId: "user-dev-student",
            type: "DEADLINE_CHANGE",
            link: `/tasks/${taskId}`,
          },
        }),
      );
      const response = await fetch(base + "/api/calendar/export", {
        headers: { cookie: "study_dev_user_id=user-dev-student" },
      });
      assert.equal(response.status, 200);
      const ics = await response.text();
      assert(ics.includes("DTSTART:20261120T205959Z"));
      assert(!ics.includes("test-foreign-task"));
    },
  );
  if (process.env.SV_CAPTURE_SCREENSHOTS) {
    const widths =
      process.env.SV_CAPTURE_SCREENSHOTS === "matrix"
        ? [390, 1280, 1440]
        : [390, 1440];
    for (const width of widths) {
      await page.setViewport({ width, height: 900 });
      for (const [name, route] of [
        ["dashboard", "/"],
        ["course", "/courses/test-course"],
        ["task", "/tasks/task-otu-lab1"],
        ["admin", "/admin"],
        ["deadlines", "/deadlines"],
      ]) {
        await go(route);
        fs.mkdirSync(`.test-work/screenshots/${width}`, { recursive: true });
        await page.screenshot({
          path: `.test-work/screenshots/${width}/${name}.png`,
          fullPage: true,
        });
      }
    }
  }
  await scenario(
    "headman creates an evidenced task through the existing form",
    async () => {
      await setUser("user-dev-owner");
      await go("/");
      await clickText("Новое задание");
      const title = `[TEST] Новая задача ${randomUUID()}`;
      await setInput('input[aria-label="Название задания"]', title);
      await setInput(
        'textarea[aria-label="Источник задания и срока"]',
        "[TEST] Преподаватель выдал задание и указал срок на занятии",
      );
      await setInput('input[type="date"]', "2026-12-01");
      await clickText("Опубликовать задание");
      await page.waitForFunction(
        () => !document.querySelector('input[aria-label="Название задания"]'),
      );
      const task = await test.task.findFirstOrThrow({
        where: { title },
        include: { sourceReference: true, deadlines: true },
      });
      assert.equal(task.sourceReference.confidence, "CONFIRMED");
      assert.equal(
        task.deadlines[0].date.toISOString(),
        "2026-12-01T20:59:59.999Z",
      );
      await setUser("user-dev-student");
      await go(`/tasks/${task.id}`);
      assert((await body()).includes(title));
    },
  );
  assert.deepEqual(errors, []);
  assert.equal(
    await fingerprint(),
    before,
    "Working database changed during isolated E2E",
  );
  fs.writeFileSync(
    ".test-work/e2e-results.json",
    JSON.stringify({ passed, workingDatabaseUnchanged: true }, null, 2),
  );
  console.log(
    `${passed.length} E2E scenarios passed; working database unchanged.`,
  );
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await test.$disconnect();
  await working.$disconnect();
  fs.closeSync(log);
}
