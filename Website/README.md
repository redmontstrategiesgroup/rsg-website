# RSG Website — static mirror (NOT the source)

⚠ **This folder is a static _mirror_ of the live site, not its editable source.**
It is the deployed build output — 30 pre-rendered `index.html` pages plus
`_next/static` chunks/CSS/fonts and brand assets — captured on 2026-07-23 from
**https://redmontstrategiesgroup.com**. There is no `package.json`, no
`app/`/`pages/` source, no config, and no git history here. **Do not edit these
files to change the site, and do not reconstruct a new project from them while
the real source exists** (see below).

## The real, editable source

The site is a **Next.js (App Router) + Tailwind** app **deployed on Vercel**.
The editable source lives in the **Vercel project for
`redmontstrategiesgroup.com` and its linked Git repository** — clone that to
make changes. See [`../docs/plans/website-recovery-findings.md`](../docs/plans/website-recovery-findings.md)
for the recovery steps.

## Serving this mirror locally

It's plain static files with a preserved URL structure — serve with anything:

```bash
python -m http.server 8080
```

…then open <http://127.0.0.1:8080/>. (The portfolio's root `serve.py` also
exposes it at `/Website/`.) The mirror covers only public pages; robots.txt
excludes `/admin`, `/dashboard`, `/portal`, `/api`, `/thank-you` (private app
areas that were never mirrored).

## What's here

- `index.html` + 29 per-route `index.html` files (home, services, process,
  industries, faq, book/*, demos/*, the 12 Plymouth-County SEO landing pages,
  privacy, terms, connect, login shell)
- `_next/static/` — compiled JS/CSS/fonts (minified; not source)
- `sitemap.xml`, `robots.txt`, `brand/`, and OG/icon images
