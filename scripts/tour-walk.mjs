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
const STEP_SETTLE_MS = 1600; // > effects x 500 ms stagger for the longest step

/**
 * Layout faults that a "the caption is visible" check sails past but a
 * visitor sees immediately. Each one shipped at least once, so each is
 * asserted here rather than left to a screenshot nobody opens.
 */
async function layoutFaults(page) {
  return page.evaluate(() => {
    const faults = [];

    // The caption is sticky inside the demo pane. Any gap means it is being
    // held below the scrollport and the board scrolls up into the band.
    const cap = document.querySelector("[data-tour-caption]");
    const pane = document.querySelector("[data-demo-pane]");
    if (cap && pane) {
      const gap = Math.round(cap.getBoundingClientRect().top - pane.getBoundingClientRect().top);
      if (gap > 2) faults.push(`tour caption sits ${gap}px below the pane top`);
    }

    // The "Just now" pill floats in a card's top-right corner, which is also
    // where hot/warm badges live. Callers opt out and place it in flow.
    for (const pill of document.querySelectorAll(".demo-spotlight__pill")) {
      const card = pill.closest(".demo-spotlight");
      if (!card) continue;
      const p = pill.getBoundingClientRect();
      for (const el of card.querySelectorAll("span,button,select")) {
        if (el === pill || pill.contains(el) || el.contains(pill)) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (p.left < r.right - 1 && p.right > r.left + 1 && p.top < r.bottom - 1 && p.bottom > r.top + 1) {
          faults.push(`"Just now" pill covers "${el.textContent.trim().slice(0, 24)}"`);
        }
      }
    }

    // A <select> clamped by max-width renders its label past its own border
    // unless it is told to ellipsize.
    for (const sel of document.querySelectorAll("select")) {
      if (sel.scrollWidth > sel.clientWidth + 1 && getComputedStyle(sel).textOverflow !== "ellipsis") {
        faults.push(`select #${sel.id || "?"} overflows its box`);
      }
    }

    // A rail's prev/next button overlays the rail's edge, so the edge fade has
    // to be at least as wide as the button or it lands on opaque content.
    for (const btn of document.querySelectorAll('button[aria-label="Scroll right"],button[aria-label="Scroll left"]')) {
      const rail = btn.parentElement?.firstElementChild;
      if (!rail) continue;
      const mask = getComputedStyle(rail).maskImage || "";
      const stops = [...mask.matchAll(/(?:black|rgb\(0, 0, 0\)) (\d+)px/g)].map((m) => +m[1]);
      const fade = stops.length ? Math.max(...stops) : 0;
      const w = Math.round(btn.getBoundingClientRect().width);
      if (fade < w) faults.push(`${btn.getAttribute("aria-label")} button (${w}px) sits on a ${fade}px fade`);
    }

    return [...new Set(faults)];
  });
}

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
      // The final step of every tour is narration-only by design ("Now try it
      // yourself") — it has no entity effects, so it earns no chip and no spotlight.
      if (step < total) {
        if ((await caption.locator("li").count()) === 0) problems.push("no chips");
        const freshVisible = await page.locator('[data-fresh="true"]:visible').count();
        if (freshVisible === 0) problems.push("no spotlighted element on the visible tab");
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) problems.push("horizontal page overflow");
      problems.push(...(await layoutFaults(page)));
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
