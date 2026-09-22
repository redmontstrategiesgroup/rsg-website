/**
 * Responsive / touch-usability detector.
 *
 * Why this exists: `app/globals.css` sets `body { overflow-x: clip }`, which
 * means anything wider than the viewport is silently CLIPPED rather than made
 * scrollable. The usual `document.scrollWidth > innerWidth` check therefore
 * reports a clean page while content sits unreachable off the right edge. This
 * walks the DOM element-by-element instead, so the bugs actually surface.
 *
 * Usage:
 *   node scripts/audit-responsive.mjs                  # public routes
 *   node scripts/audit-responsive.mjs --url=http://localhost:3000
 *   node scripts/audit-responsive.mjs --json=out.json
 *   node scripts/audit-responsive.mjs --routes=/,/book # only these
 *
 * Gated routes (/portal/*, /admin, /dashboard) are skipped unless a real
 * session cookie is supplied, because the portal resolves the signed cookie
 * against a live client row — a self-minted token is not enough:
 *   AUDIT_SESSION_COOKIE=<rsg_session value>  (client portal)
 *   AUDIT_ADMIN_COOKIE=<rsg_admin value>      (admin console)
 * Copy them out of DevTools > Application > Cookies on a signed-in session.
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = arg("url", "http://localhost:3000").replace(/\/$/, "");
const JSON_OUT = arg("json", null);

/** Minimum comfortable touch target. WCAG 2.5.8 is 24px; Apple/Google say 44. */
const TAP_MIN = 44;

/**
 * Viewports. The landscape entry matters most: a 430px-tall phone is where
 * vertically-centred modals with no max-height become unusable, and it is the
 * case desktop-first QA never looks at.
 */
const VIEWPORTS = [
  { name: "375x667 (iPhone SE)", width: 375, height: 667 },
  { name: "390x844 (iPhone 14)", width: 390, height: 844 },
  { name: "414x896 (Plus/Max)", width: 414, height: 896 },
  { name: "932x430 (landscape)", width: 932, height: 430 },
  { name: "768x1024 (iPad)", width: 768, height: 1024 },
];

/** Public, indexable routes — mirrors app/sitemap.ts. */
const PUBLIC_ROUTES = [
  "/",
  "/services",
  "/services/customprivateaisystems",
  "/security",
  "/process",
  "/industries",
  "/industries/homeservices",
  "/industries/healthwellness",
  "/industries/realestate",
  "/book",
  "/book/consultation",
  "/book/strategy",
  "/connect",
  "/faq",
  "/demos",
  "/demos/healthwellness",
  "/demos/contractors",
  "/demos/realestate",
  "/businessconsulting",
  "/systemsaudit",
  "/aistrategy",
  "/aiautomation",
  "/operationsconsulting",
  "/webdevelopment",
  "/crmsystems",
  "/servicearea",
  "/privacy",
  "/terms",
  // Needs API_PLATFORM_ENABLED=true on the target server; 404s otherwise.
  "/developers",
  // Live but absent from the sitemap:
  "/start",
  "/thankyou",
  "/booking/review",
  "/booking/noteligible",
];

/** Reachable only with a session cookie. */
const PORTAL_ROUTES = [
  "/portal",
  "/portal/project",
  "/portal/workspace",
  "/portal/support",
  "/portal/training",
  "/portal/reports",
  "/portal/roadmap",
  "/portal/billing",
  "/portal/team",
  "/portal/developers",
];

const ADMIN_ROUTES = ["/admin", "/dashboard"];

/**
 * Interactive surfaces render most of their UI behind tabs. For routes
 * matching a prefix, click each element the selector finds (re-queried each
 * time, since a click re-renders) and measure again, so Pipeline,
 * Conversations and Settings get audited and not just the Overview tab.
 */
const TAB_WALKS = [
  { prefix: "/demos/", selector: 'nav[aria-label$="sections"] button' },
  { prefix: "/portal", selector: '[role="tablist"] [role="tab"]' },
  { prefix: "/admin", selector: '[role="tablist"] [role="tab"], nav[aria-label="Admin sections"] button' },
  // The dashboard's views sit behind a sidebar that is a drawer on phones;
  // `open` is clicked first when it is visible so the nav buttons are reachable.
  {
    prefix: "/dashboard",
    selector: 'nav[aria-label="Dashboard navigation"] button',
    open: 'button[aria-label="Open navigation"]',
  },
];

/**
 * Runs inside the page. Returns plain data only — nothing here may reference
 * Node scope.
 */
function collectFindings(tapMin) {
  const out = { overflow: [], clipped: [], tap: [], rails: [], offscreen: [] };
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  /** A stable-ish CSS-path label so a finding can be found again in source. */
  const label = (el) => {
    const parts = [];
    let node = el;
    for (let depth = 0; node && node.nodeType === 1 && depth < 4; depth += 1) {
      let seg = node.tagName.toLowerCase();
      if (node.id) {
        seg += `#${node.id}`;
        parts.unshift(seg);
        break;
      }
      const cls = (node.getAttribute("class") || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 6)
        .join(".");
      if (cls) seg += `.${cls}`;
      parts.unshift(seg);
      node = node.parentElement;
      depth += 1;
    }
    return parts.join(" > ").slice(0, 220);
  };

  const visible = (el, rect) => {
    if (rect.width === 0 && rect.height === 0) return false;
    // Screen-reader-only content (Tailwind `sr-only`) is clipped to 1px and is
    // meant to be invisible until focused — not a layout or tap-target defect.
    if (rect.width <= 1 || rect.height <= 1) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (cs.opacity === "0") return false;
    if (cs.clipPath === "inset(50%)" || cs.clip === "rect(0px, 0px, 0px, 0px)") return false;
    // An ancestor may be the thing that is hidden.
    return el.offsetParent !== null || cs.position === "fixed";
  };

  const all = document.body.querySelectorAll("*");

  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (!visible(el, rect)) continue;

    const cs = getComputedStyle(el);

    /* --- 1. Horizontal overflow past the viewport ------------------------ */
    // getBoundingClientRect() is the layout box and ignores clipping, so walk
    // up: a scrollable ancestor means the element is meant to extend (rails
    // are reported separately); a clipping ancestor bounds what is visible.
    // A decorative blur inside an overflow-hidden hero is therefore not an
    // overflow. Real content cut off by a clipping ancestor narrower than it
    // is a different defect and lands in `clipped`.
    let scrollableAncestor = false;
    let visibleRight = rect.right;
    let clipper = null;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      const ov = pcs.overflowX;
      if (ov === "auto" || ov === "scroll") {
        scrollableAncestor = true;
        break;
      }
      if (ov === "hidden" || ov === "clip") {
        const pr = p.getBoundingClientRect();
        if (pr.right < visibleRight) {
          visibleRight = pr.right;
          clipper = clipper ?? p;
        }
      }
    }
    if (!scrollableAncestor && rect.width <= vw * 3) {
      if (visibleRight > vw + 1) {
        out.overflow.push({
          el: label(el),
          right: Math.round(rect.right),
          overhang: Math.round(visibleRight - vw),
          width: Math.round(rect.width),
        });
      } else if (clipper && rect.right > visibleRight + 1) {
        // Only content matters here; a blur or gradient with no text is meant
        // to be clipped.
        const hasText = (el.textContent || "").trim().length > 0;
        const ownText = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 0
        );
        if (hasText && (ownText || el.children.length === 0)) {
          out.clipped.push({
            el: label(el),
            cutBy: Math.round(rect.right - visibleRight),
            by: label(clipper),
            text: (el.textContent || "").trim().slice(0, 40),
          });
        }
      }
    }

    /* --- 2. Sub-44px interactive targets --------------------------------- */
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    const interactive =
      tag === "button" ||
      (tag === "a" && el.hasAttribute("href")) ||
      tag === "select" ||
      tag === "textarea" ||
      (tag === "input" && el.type !== "hidden") ||
      role === "button" ||
      role === "tab" ||
      role === "link";
    if (interactive) {
      // A small control inside a large <label> is fine — the label is the target.
      const wrappingLabel = el.closest("label");
      const effective =
        wrappingLabel && wrappingLabel !== el
          ? wrappingLabel.getBoundingClientRect()
          : rect;
      const w = Math.round(effective.width);
      const h = Math.round(effective.height);
      const text = (el.textContent || "").trim();
      // Height is what matters for a text link in a stacked list: a short word
      // like "Email" is legitimately narrow, and flagging its width would bury
      // the real defects. Width only counts against icon-only controls, where
      // a narrow box genuinely means a small target.
      const isField = tag === "input" || tag === "select" || tag === "textarea";
      const iconOnly = text.length === 0 && !isField;
      const tooShort = h > 0 && h < tapMin;
      const tooNarrow = iconOnly && w > 0 && w < tapMin;
      if (tooShort || tooNarrow) {
        out.tap.push({
          el: label(el),
          w,
          h,
          iconOnly,
          text: (text || el.getAttribute("aria-label") || "").slice(0, 40),
        });
      }
    }

    /* --- 3. Scroll rails with no snap ------------------------------------ */
    if (
      (cs.overflowX === "auto" || cs.overflowX === "scroll") &&
      el.scrollWidth > el.clientWidth + 4
    ) {
      const snap = cs.scrollSnapType && cs.scrollSnapType !== "none";
      // A wide table scrolls freely by design; snap points make no sense
      // for columns. Only card/tab rails are expected to snap.
      const isTable = !!el.querySelector(":scope > table");
      if (!snap && !isTable) {
        out.rails.push({
          el: label(el),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowBy: el.scrollWidth - el.clientWidth,
        });
      }
    }
  }

  /* --- 4. Fixed/sticky content extending below the visual viewport ------- */
  for (const el of document.querySelectorAll(
    '[class*="fixed"],[class*="sticky"]'
  )) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) continue;
    if (rect.bottom > vh + 1 && cs.overflowY !== "auto" && cs.overflowY !== "scroll") {
      out.offscreen.push({
        el: label(el),
        bottom: Math.round(rect.bottom),
        below: Math.round(rect.bottom - vh),
      });
    }
  }

  return out;
}

async function main() {
  const routesArg = arg("routes", null);
  const sessionCookie = process.env.AUDIT_SESSION_COOKIE;
  const adminCookie = process.env.AUDIT_ADMIN_COOKIE;

  let routes = PUBLIC_ROUTES.slice();
  if (sessionCookie) routes = routes.concat(PORTAL_ROUTES);
  if (adminCookie) routes = routes.concat(ADMIN_ROUTES);
  if (routesArg) routes = routesArg.split(",").map((r) => r.trim());

  const skipped = [];
  if (!sessionCookie && !routesArg) skipped.push(`${PORTAL_ROUTES.length} portal routes (set AUDIT_SESSION_COOKIE)`);
  if (!adminCookie && !routesArg) skipped.push(`${ADMIN_ROUTES.length} admin routes (set AUDIT_ADMIN_COOKIE)`);

  const browser = await chromium.launch();
  const results = [];
  let totalOverflow = 0;
  let totalClipped = 0;
  let totalTap = 0;
  let totalRails = 0;
  let totalOffscreen = 0;

  const origin = new URL(BASE).hostname;

  for (const vp of VIEWPORTS) {
    // Every viewport here is a touch device — a phone in landscape is still
    // a phone — so `hasTouch` is always on. That is what makes Chromium
    // report (hover: none) and (pointer: coarse), which the touch-target
    // floor in globals.css keys on. isMobile only changes viewport-meta
    // handling and is kept for the phone widths.
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.width < 768,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });

    const cookies = [];
    if (sessionCookie)
      cookies.push({ name: "rsg_session", value: sessionCookie, domain: origin, path: "/" });
    if (adminCookie)
      cookies.push({ name: "rsg_admin", value: adminCookie, domain: origin, path: "/" });
    if (cookies.length) await context.addCookies(cookies);

    const page = await context.newPage();

    for (const route of routes) {
      const url = `${BASE}${route}`;
      let status = 0;
      try {
        const res = await page.goto(url, {
          waitUntil: "load",
          timeout: 60000,
        });
        status = res ? res.status() : 0;

        // Measuring before the stylesheet applies produces garbage: every
        // `hidden` desktop element reports as visible and `sr-only` links
        // measure at full size. Wait for Tailwind's base layer to land (body
        // gets an opaque themed background) before trusting any geometry.
        await page.waitForFunction(
          () => {
            const bg = getComputedStyle(document.body).backgroundColor;
            return bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
          },
          null,
          { timeout: 20000 }
        );
        await page.evaluate(() => document.fonts?.ready);
        // Reveal/observer JS and any layout shift it causes.
        await page.waitForTimeout(500);
      } catch (err) {
        results.push({
          viewport: vp.name,
          route,
          error: String(err).slice(0, 160),
        });
        continue;
      }

      if (status >= 400) {
        results.push({ viewport: vp.name, route, status, error: `HTTP ${status}` });
        continue;
      }
      // A gated route without a valid cookie redirects to /login — do not
      // report the login page's findings under the portal route's name.
      const landed = new URL(page.url()).pathname;
      if (landed !== route && (landed === "/login" || landed === "/admin/login")) {
        results.push({ viewport: vp.name, route, skipped: `redirected to ${landed}` });
        continue;
      }

      const found = await page.evaluate(collectFindings, TAP_MIN);

      // Tab walk: merge findings from each tab state, tagged with the tab.
      const walk = TAB_WALKS.find((w) => route.startsWith(w.prefix));
      if (walk) {
        // An intro dialog (demo OS) sits over the tabs on first load; Escape it.
        if (await page.locator('[role="dialog"]').count()) {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(250);
        }
        const count = await page.locator(walk.selector).count();
        found.tabsWalked = count;
        for (let i = 0; i < count; i += 1) {
          const tabEl = page.locator(walk.selector).nth(i);
          let name = "";
          try {
            name = ((await tabEl.textContent()) || "").trim().slice(0, 24);
            if (walk.open) {
              const opener = page.locator(walk.open).first();
              if (await opener.isVisible().catch(() => false)) {
                await opener.click({ timeout: 2000 });
                await page.waitForTimeout(250);
              }
            }
            await tabEl.click({ timeout: 3000 });
            await page.waitForTimeout(350);
          } catch {
            continue;
          }
          const more = await page.evaluate(collectFindings, TAP_MIN);
          for (const key of ["overflow", "clipped", "tap", "rails", "offscreen"]) {
            for (const f of more[key]) {
              // De-duplicate against what the base state already reported.
              const sig = JSON.stringify({ ...f, tab: undefined });
              if (found[key].some((g) => JSON.stringify({ ...g, tab: undefined }) === sig)) continue;
              found[key].push({ ...f, tab: name });
            }
          }
        }
      }

      totalOverflow += found.overflow.length;
      totalClipped += found.clipped.length;
      totalTap += found.tap.length;
      totalRails += found.rails.length;
      totalOffscreen += found.offscreen.length;

      if (
        found.tabsWalked ||
        found.overflow.length ||
        found.clipped.length ||
        found.tap.length ||
        found.rails.length ||
        found.offscreen.length
      ) {
        results.push({ viewport: vp.name, route, ...found });
      }
    }

    await context.close();
  }

  await browser.close();

  /* ------------------------------ Report ------------------------------- */
  const line = "-".repeat(78);
  console.log(`\n${line}\nRESPONSIVE AUDIT  ${BASE}\n${line}`);

  for (const r of results) {
    if (r.error) {
      console.log(`\n[${r.viewport}] ${r.route}\n  ERROR: ${r.error}`);
      continue;
    }
    if (r.skipped) {
      continue;
    }
    console.log(`
[${r.viewport}] ${r.route}${r.tabsWalked ? `  (walked ${r.tabsWalked} tabs)` : ""}`);
    if (r.overflow?.length) {
      console.log(`  OVERFLOW (${r.overflow.length}) — clipped off the right edge:`);
      for (const o of r.overflow.slice(0, 8)) {
        console.log(`    +${o.overhang}px  w=${o.width}  ${o.el}${o.tab ? `  [tab: ${o.tab}]` : ""}`);
      }
      if (r.overflow.length > 8) console.log(`    … ${r.overflow.length - 8} more`);
    }
    if (r.clipped?.length) {
      console.log(`  CLIPPED CONTENT (${r.clipped.length}) — cut off by a container:`);
      for (const c of r.clipped.slice(0, 6)) {
        console.log(`    -${c.cutBy}px  "${c.text}"  ${c.el}${c.tab ? `  [tab: ${c.tab}]` : ""}
           by ${c.by}`);
      }
      if (r.clipped.length > 6) console.log(`    … ${r.clipped.length - 6} more`);
    }
    if (r.tap?.length) {
      console.log(`  TAP TARGETS < ${TAP_MIN}px (${r.tap.length}):`);
      for (const t of r.tap.slice(0, 8)) {
        console.log(`    ${t.w}x${t.h}  "${t.text}"  ${t.el}${t.tab ? `  [tab: ${t.tab}]` : ""}`);
      }
      if (r.tap.length > 8) console.log(`    … ${r.tap.length - 8} more`);
    }
    if (r.rails?.length) {
      console.log(`  SCROLL RAILS WITHOUT SNAP (${r.rails.length}):`);
      for (const s of r.rails.slice(0, 6)) {
        console.log(`    scrolls ${s.overflowBy}px  ${s.el}${s.tab ? `  [tab: ${s.tab}]` : ""}`);
      }
      if (r.rails.length > 6) console.log(`    … ${r.rails.length - 6} more`);
    }
    if (r.offscreen?.length) {
      console.log(`  FIXED/STICKY BELOW VIEWPORT (${r.offscreen.length}):`);
      for (const f of r.offscreen.slice(0, 5)) {
        console.log(`    ${f.below}px below  ${f.el}`);
      }
    }
  }

  console.log(`\n${line}`);
  console.log(
    `TOTALS   overflow=${totalOverflow}  clipped=${totalClipped}  tap<${TAP_MIN}px=${totalTap}  ` +
      `rails-no-snap=${totalRails}  fixed-below-fold=${totalOffscreen}`
  );
  console.log(`Routes: ${routes.length}   Viewports: ${VIEWPORTS.length}`);
  if (skipped.length) console.log(`Skipped: ${skipped.join("; ")}`);
  console.log(line);

  if (JSON_OUT) {
    writeFileSync(
      JSON_OUT,
      JSON.stringify(
        { base: BASE, tapMin: TAP_MIN, totals: { totalOverflow, totalClipped, totalTap, totalRails, totalOffscreen }, results },
        null,
        2
      )
    );
    console.log(`JSON written to ${JSON_OUT}`);
  }

  // Overflow, clipped content and undersized targets are hard failures;
  // snap-less rails are advisory.
  process.exit(totalOverflow + totalClipped + totalTap > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
