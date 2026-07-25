# Website Recovery — Phase 5 (D1) findings

**Verdict: the editable source is NOT lost. `RSG\Website` was always a static *mirror*, not the source — the real Next.js source lives in the Vercel project (and its linked Git repo) for `redmontstrategiesgroup.com`. Recover it from there; do NOT reconstruct.**

## What the investigation found

- **On disk:** `RSG\Website` contains only a deployed build — 30 rendered `index.html` pages + `_next/static` chunks/css/media + sitemap/robots/brand assets. **No source, no config, no git, no source maps** (verified: no `package.json`/`next.config`/`tsconfig`/`tailwind.config`, no `app/`/`pages/`, no `.git`, no `.map`). A full-machine search found **no Next.js project** anywhere (`package.json` referencing `next` → none; `next.config` → none; `(marketing)` source dir → none).
- **The decisive evidence** — a prior Claude "Website" session left project memory (`C:\Users\josep\.claude\projects\C--Users-josep-Desktop-RSG-Website\memory\`) stating plainly:
  > "The live website is **https://redmontstrategiesgroup.com**, a Next.js app (deployed on Vercel). On 2026-07-23 a **static mirror** of the public site (30 pages + assets, ~4.2 MB) was saved to `C:\Users\josep\Desktop\RSG\Website`, preserving URL structure so it can be served with any static file server."
- So the local folder is a **deliberate mirror**, and the source is the live Vercel deployment — which, because the site is live, still exists.

## Recovery (the right path — a user action; I cannot reach external accounts)

1. **Vercel dashboard → the `redmontstrategiesgroup.com` project → Settings → Git.** It names the connected repository (GitHub/GitLab/Bitbucket). `git clone` that repo — that *is* the editable source (App Router + Tailwind, buildId `PyoYSE3uLfurL9cEJLj4U`).
2. If the project isn't linked to Git, run `vercel pull` / `vercel link` against it, or download the source from the Vercel project, to get the working tree locally.
3. Once cloned locally (e.g. `RSG\website-src\`), it's fully editable and re-deployable — no reconstruction needed.

## Why reconstruction (Phase 6 / D2) is NOT recommended now

Rebuilding a fresh Next.js project from the 30 rendered pages would produce a **lower-fidelity copy** (all form/auth/server logic was lost to minification and would be rewritten from scratch, likely behaving differently) of a source that **still exists**. That is wasteful and risky. Phase 6 is on standby **only if** Joseph confirms the Vercel project and its Git repo are genuinely unrecoverable — an outcome the evidence makes unlikely.

## What was done here (safe, proportionate)

- This findings doc.
- `RSG\Website\README.md` — labels the folder as a static mirror (not source), documents how to serve it, and points to the Vercel/Git source — so no future session mistakes the mirror for editable source and starts reconstructing.

## If reconstruction ever IS needed

The mirror is a high-quality *content* source to rebuild **from** (see the plan's Phase 6): ~90% of copy/meta/JSON-LD is scrapable from the 30 HTML files, the 12 SEO landing pages share one data-driven template, and the theme (crimson + 3 fonts, Tailwind) is derivable from the compiled CSS. Only the backend/interactive logic must be rebuilt anew.
