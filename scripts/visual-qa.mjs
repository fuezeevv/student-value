import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";
const QA_DIR = path.resolve("docs/screenshots/qa");

if (!fs.existsSync(QA_DIR)) {
  fs.mkdirSync(QA_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080, dsf: 1 },
  { name: "1440x900", width: 1440, height: 900, dsf: 2 },
  { name: "1280x800", width: 1280, height: 800, dsf: 2 },
  { name: "390x844", width: 390, height: 844, dsf: 2, isMobile: true, hasTouch: true },
];

const PAGES = [
  { slug: "dashboard", url: "/" },
  { slug: "deadlines", url: "/deadlines" },
  { slug: "calendar", url: "/calendar" },
  { slug: "admin", url: "/admin" },
  { slug: "courses", url: "/courses" },
  { slug: "course_detail", url: "/courses/offering-otu" },
  { slug: "task_detail", url: "/tasks/task-otu-lab1" },
  { slug: "transcripts", url: "/transcripts" },
  { slug: "leaderboard", url: "/leaderboard" },
  { slug: "members", url: "/members" },
  { slug: "analytics", url: "/analytics" },
  { slug: "search", url: "/search?q=Simulink" },
  { slug: "settings", url: "/settings" },
];

async function runVisualQA() {
  console.log("📸 Starting Comprehensive Multi-Viewport Visual QA...\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Set owner session so full data and controls are visible
  await page.setCookie({
    name: "study_dev_user_id",
    value: "user-dev-owner",
    domain: "localhost",
    path: "/",
  });

  const report = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n🖥️ Testing Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.dsf,
      isMobile: vp.isMobile || false,
      hasTouch: vp.hasTouch || false,
    });

    const vpDir = path.join(QA_DIR, vp.name);
    if (!fs.existsSync(vpDir)) fs.mkdirSync(vpDir, { recursive: true });

    for (const p of PAGES) {
      const fullUrl = `${BASE_URL}${p.url}`;
      const screenshotPath = path.join(vpDir, `${p.slug}.png`);
      try {
        await page.goto(fullUrl, { waitUntil: "networkidle0", timeout: 15000 });

        // Check horizontal overflow
        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const hasHScroll = docEl.scrollWidth > docEl.clientWidth || body.scrollWidth > body.clientWidth;
          return {
            hasHorizontalScroll: hasHScroll,
            scrollWidth: Math.max(docEl.scrollWidth, body.scrollWidth),
            clientWidth: docEl.clientWidth,
          };
        });

        await page.screenshot({ path: screenshotPath, fullPage: true });

        const status = overflow.hasHorizontalScroll ? "OVERFLOW_DETECTED" : "OK";
        report.push({
          viewport: vp.name,
          page: p.slug,
          status,
          clientWidth: overflow.clientWidth,
          scrollWidth: overflow.scrollWidth,
          path: screenshotPath,
        });

        if (overflow.hasHorizontalScroll) {
          console.warn(`  ⚠️ [${vp.name}] ${p.slug}: Horizontal scroll detected! (scrollWidth: ${overflow.scrollWidth} > clientWidth: ${overflow.clientWidth})`);
        } else {
          console.log(`  ✓ [${vp.name}] ${p.slug}: Clean render, no horizontal overflow.`);
        }
      } catch (err) {
        console.error(`  ❌ [${vp.name}] ${p.slug} error:`, err.message);
        report.push({
          viewport: vp.name,
          page: p.slug,
          status: "ERROR",
          error: err.message,
        });
      }
    }
  }

  await browser.close();

  const overflowIssues = report.filter((r) => r.status === "OVERFLOW_DETECTED");
  console.log("\n================================================================================");
  console.log("📊 VISUAL QA SUMMARY");
  console.log("================================================================================");
  console.log(`Total screenshots captured: ${report.length}`);
  console.log(`Pages with horizontal overflow: ${overflowIssues.length}`);
  if (overflowIssues.length > 0) {
    console.table(overflowIssues, ["viewport", "page", "clientWidth", "scrollWidth"]);
  } else {
    console.log("🎉 ALL PAGES ACROSS ALL 4 VIEWPORTS PASSED WITH ZERO HORIZONTAL OVERFLOW!");
  }
}

runVisualQA().catch((err) => {
  console.error("Fatal Visual QA error:", err);
  process.exit(1);
});
