/**
 * Drives each demo's guided tour step by step and checks that every step is
 * legible: the in-window caption is visible, it lists at least one chip, and
 * at least one spotlighted element is on the visible tab. Screenshots land in
 * .tour-shots/<slug>-<width>-<step>.png.
 *
 * Usage: node scripts/tour-walk.mjs [--url=http://localhost:3000] [--slugs=contractors]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("url", "http://localhost:3000").replace(/\/$/, "");
const SLUGS = arg("slugs", "healthwellness,contractors,realestate").split(",");
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];
const STEP_SETTLE_MS = 1600; // > effects × 500 ms stagger for the longest step

mkdirSync(".tour-shots", { recursive: true });
const browser = await chromium.launch();
let failures = 0;

for (const vp of VIEWPORTS) {
  for (const slug of SLUGS) {
    const page = await browser.newPage({ viewport: vp, reducedMotion: "no-preference" });
    await page.goto(`${BASE}/demos/${slug}`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Explore on my own" }).click();
    await page.getByRole("button", { name: "Start guided tour" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Pause tour" }).first().click();

    const total = await page.locator('[aria-label="Guided tour progress"] li').count();
    for (let step = 1; step <= total; step += 1) {
      await page.waitForTimeout(STEP_SETTLE_MS);
      const caption = page.locator("[data-tour-caption]");
      const problems = [];
      if (!(await caption.isVisible())) problems.push("caption not visible");
      if ((await caption.locator("li").count()) === 0) problems.push("no chips");
      const freshVisible = await page.locator('[data-fresh="true"]:visible').count();
      if (freshVisible === 0) problems.push("no spotlighted element on the visible tab");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) problems.push("horizontal page overflow");
      await page.screenshot({ path: `.tour-shots/${slug}-${vp.width}-${String(step).padStart(2, "0")}.png`, fullPage: false });
      const title = await caption.locator("p").nth(1).textContent().catch(() => "?");
      if (problems.length) { failures += 1; console.log(`FAIL ${slug} @${vp.width} step ${step} "${title}": ${problems.join("; ")}`); }
      else console.log(`ok   ${slug} @${vp.width} step ${step} "${title}"`);
      if (step < total) {
        const next = page.locator('[data-tour-caption] button[aria-label="Next tour step"]');
        await next.click();
      }
    }
    await page.close();
  }
}
await browser.close();
console.log(failures ? `\n${failures} step(s) failed` : "\nAll tour steps legible on both viewports");
process.exit(failures ? 1 : 0);
