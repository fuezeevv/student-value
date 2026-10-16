import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const screenshotsDir = path.resolve("docs/screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function capture() {
  console.log("🚀 Launching Puppeteer browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 });

  // Set development cookie to Rasul (Owner) so all admin and authenticated views are rendered
  await page.setCookie({
    name: "study_dev_user_id",
    value: "user-dev-owner",
    url: "http://localhost:3000",
  });

  const screens = [
    { name: "dashboard.png", url: "http://localhost:3000/" },
    { name: "deadlines.png", url: "http://localhost:3000/deadlines" },
    { name: "admin.png", url: "http://localhost:3000/admin" },
    { name: "transcripts.png", url: "http://localhost:3000/transcripts" },
    { name: "leaderboard.png", url: "http://localhost:3000/leaderboard" },
    { name: "members.png", url: "http://localhost:3000/members" },
    { name: "calendar.png", url: "http://localhost:3000/calendar" },
    { name: "analytics.png", url: "http://localhost:3000/analytics" },
    { name: "search.png", url: "http://localhost:3000/search?q=Simulink" },
    { name: "course_otu.png", url: "http://localhost:3000/courses/offering-otu" },
    { name: "task_lab1.png", url: "http://localhost:3000/tasks/task-otu-lab1" },
  ];

  for (const s of screens) {
    console.log(`📸 Capturing ${s.name} from ${s.url}...`);
    try {
      await page.goto(s.url, { waitUntil: "networkidle0", timeout: 15000 });
      await page.screenshot({ path: path.join(screenshotsDir, s.name), fullPage: true });
    } catch (e) {
      console.warn(`⚠️ Could not capture ${s.name}:`, e.message);
    }
  }

  // Mobile viewport capture
  console.log("📱 Capturing Mobile Dashboard...");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(screenshotsDir, "dashboard_mobile.png"), fullPage: true });

  await browser.close();
  console.log("✅ All Beta screenshots captured and saved to docs/screenshots/");
}

capture().catch((err) => {
  console.error("❌ Screenshot capture failed:", err);
  process.exit(1);
});
