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
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. Dashboard
  console.log("📸 Capturing Dashboard...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(screenshotsDir, "dashboard.png"), fullPage: true });

  // 2. Course Page: OTU
  console.log("📸 Capturing Course Page (OTU)...");
  await page.goto("http://localhost:3000/courses/offering-otu", { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(screenshotsDir, "course_otu.png"), fullPage: true });

  // 3. Task Page: Lab 1
  console.log("📸 Capturing Task Page (Lab 1)...");
  await page.goto("http://localhost:3000/tasks/task-otu-lab1", { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(screenshotsDir, "task_lab1.png"), fullPage: true });

  await browser.close();
  console.log("✅ All screenshots saved to docs/screenshots/");
}

capture().catch((err) => {
  console.error("❌ Screenshot capture failed:", err);
  process.exit(1);
});
