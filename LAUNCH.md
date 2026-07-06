# RSG Website — Launch Runbook

Follow these phases in order. Phase 1 gets the site live; Phases 2–3 make the
lead funnel real; Phase 4 is final verification. The production build is
already verified passing.

---

## Phase 1 — Get the site live (~30 minutes)

### 1.1 Push the code to GitHub

The project is not in git yet. Open PowerShell in the project folder and run:

```powershell
cd "C:\Users\josep\OneDrive\Desktop\basic website"
git init
git add .
git commit -m "RSG website"
```

Then:

1. Go to https://github.com/new (sign in or create an account).
2. Repository name: `rsg-website`. Visibility: **Private**. Do NOT check
   "Add a README". Click **Create repository**.
3. Back in PowerShell (replace YOUR-USERNAME):

```powershell
git remote add origin https://github.com/YOUR-USERNAME/rsg-website.git
git branch -M main
git push -u origin main
```

Windows will pop up a browser sign-in the first time (Git Credential Manager).

> Note: `.gitignore` already excludes `data/` and `.env*` — no secrets or
> lead data are committed.

### 1.2 Deploy on Vercel

1. Go to https://vercel.com → **Sign Up** → "Continue with GitHub".
2. Click **Add New… → Project**.
3. Find `rsg-website` in the list → **Import**.
4. Framework preset auto-detects **Next.js** — change nothing.
5. Open the **Environment Variables** accordion and add the two mandatory
   ones now (see 1.3).
6. Click **Deploy**. ~2 minutes later you get a live URL like
   `rsg-website.vercel.app`.

### 1.3 Mandatory environment variables

Generate a session secret — in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Name | Value |
|---|---|
| `AUTH_SECRET` | the 96-character string from the command above |
| `ADMIN_EMAIL` | the email you'll use to log into /admin |
| `ADMIN_PASSWORD` | a strong password, 8+ characters |

Without these, the marketing site works but /admin and /portal logins fail
closed (by design — there are no default credentials).

> Any time you add or change env vars later: Vercel → your project →
> **Deployments** → ⋯ menu on the latest → **Redeploy**. Env changes only
> apply on a new deployment.

---

## Phase 2 — Turn on the lead funnel (~1 hour)

### 2.1 Supabase (durable lead storage — effectively required)

Vercel's filesystem is read-only, so the local `data/*.json` files don't work
in production. Supabase is where production leads live.

1. Go to https://supabase.com/dashboard and sign in.
2. Open the **Redmont Client Portal** project (or whichever you prefer —
   all your projects are currently paused). Click **Restore project** and
   wait a few minutes.
3. Left sidebar → **SQL Editor** → **New query**.
4. Open `supabase/migrations/001_create_leads.sql` from this project, paste
   the whole file, click **Run**. You should see "Success".
5. Left sidebar → **Table Editor** → confirm a `leads` table exists.
6. Get the credentials: **Project Settings (gear) → API**:
   - "Project URL" → env var `SUPABASE_URL`
   - Under "Project API keys", reveal the **service_role** key → env var
     `SUPABASE_SERVICE_ROLE_KEY`
7. Add both in Vercel → Settings → Environment Variables → Redeploy.

⚠️ The service_role key bypasses all security rules. It lives ONLY in Vercel
env vars — never in code, never in the browser, never in git.

### 2.2 Resend (lead notification emails + auto-replies)

1. Go to https://resend.com → sign up (free tier: 100 emails/day).
2. **Domains → Add Domain** → enter your domain (e.g.
   `redmontstrategies.com`).
3. Resend shows 2–3 DNS records (DKIM/SPF). Add them wherever your domain's
   DNS is managed (registrar dashboard → DNS settings → add record, copy
   type/name/value exactly). Click **Verify** in Resend — can take up to an
   hour.
4. **API Keys → Create API Key** (full access) → env var `RESEND_API_KEY`.
5. Set two more env vars:
   - `CONTACT_TO_EMAIL` — where lead notifications go (your inbox)
   - `CONTACT_FROM_EMAIL` — e.g. `RSG <leads@redmontstrategies.com>`
     (must use the verified domain)
6. Redeploy.

> You can skip domain verification temporarily: without
> `CONTACT_FROM_EMAIL`, the code falls back to Resend's test sender, which
> can only deliver to the email you signed up with. Fine for testing, not
> for launch.

### 2.3 Anthropic API key (chatbot)

1. Go to https://platform.claude.com → sign in → **Settings → API Keys →
   Create Key**.
2. Add billing under Settings → Billing (buy a small credit block, e.g. $20
   — chat runs on Claude Sonnet 5 and light traffic costs dollars/month;
   there's a 20-messages-per-5-minutes rate limit per visitor).
3. Env var `ANTHROPIC_API_KEY` → Redeploy.
4. **Tell Claude Code the key is set** — the ten scripted persona
   conversations still need to be run against the live model and tuned.

### 2.4 Booking link (activates every "Book a Strategy Call" CTA)

1. Create a free account at https://calendly.com (or https://cal.com).
2. Create an event type: "Strategy Call", 30 min, add your availability.
3. Copy the scheduling link (e.g. `https://calendly.com/yourname/strategy-call`).
4. Set BOTH env vars to that link:
   - `BOOKING_URL` (used in the auto-reply email + given to the chatbot)
   - `NEXT_PUBLIC_BOOKING_URL` (thank-you page button, footer CTA, chat
     footer link)
5. Redeploy.

### 2.5 Cloudflare Turnstile (spam protection on the form)

1. Go to https://dash.cloudflare.com → sign up → **Turnstile** in the left
   sidebar → **Add site**.
2. Site name: RSG. Hostnames: your domain AND `rsg-website.vercel.app`.
   Widget mode: **Managed**.
3. Copy the **Site Key** → env var `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
4. Copy the **Secret Key** → env var `TURNSTILE_SECRET_KEY`.
5. Redeploy. A dark verification widget now appears above the form's submit
   button, verified server-side.

---

## Phase 3 — Domain + analytics (~30 minutes + DNS wait)

### 3.1 Custom domain

1. If you don't own one yet: buy at Cloudflare Registrar or Namecheap
   (~$10–15/year).
2. Vercel → your project → **Settings → Domains** → **Add** → enter
   `redmontstrategies.com` (and add `www.redmontstrategies.com`; set the
   apex as primary redirect target).
3. Vercel shows you exactly what to add at your DNS provider — typically:
   - `A` record, name `@`, value `76.76.21.21`
   - `CNAME` record, name `www`, value `cname.vercel-dns.com`
4. Wait for the checkmarks (minutes to hours). HTTPS is automatic.
5. If your live domain is NOT redmontstrategies.com, ask Claude Code to
   update `metadataBase` in `app/layout.tsx` (one line).

### 3.2 Analytics provider

The site fires 7 conversion events (`book_strategy_call_click`,
`business_systems_audit_click`, `contact_form_start`, `contact_form_submit`,
`chatbot_open`, `chatbot_qualified_lead`, `thank_you_page_view`) through a
provider-agnostic dispatcher. Pick ONE provider, then ask Claude Code to add
its snippet — events flow with no other changes:

- **Plausible** (simple, private, ~$9/mo)
- **GA4** (free) — create a property at https://analytics.google.com, note
  the `G-XXXXXXX` id
- **PostHog** (free tier, deepest funnels)

---

## Phase 4 — Launch-day verification checklist

On the LIVE site (not localhost):

- [ ] Submit the contact form with your real email. Confirm within a minute:
  - [ ] "New RSG Strategy Call Lead" email arrives at CONTACT_TO_EMAIL
        (with lead score, timeline, attribution)
  - [ ] Auto-reply arrives at the address you submitted
  - [ ] Row appears in Supabase → Table Editor → `leads`
  - [ ] You were redirected to /thank-you with the booking button
- [ ] Visit `yourdomain.com/?utm_source=launchtest`, submit the form again,
      confirm `utm_source = launchtest` on the Supabase row.
- [ ] Turnstile widget shows on the form and submission passes.
- [ ] Open the chat, ask "What does RSG do?" — streamed answer arrives.
- [ ] In chat, describe a fake business problem and share a name + email —
      confirm the lead lands in Supabase with source `website_chat`.
- [ ] Log into `/admin/login` with ADMIN_EMAIL/ADMIN_PASSWORD.
- [ ] Log into `/login` — NOTE: demo portal accounts do not exist in
      production (file-based, dev-only). Expected.
- [ ] Accept the cookie banner, click around, confirm your analytics
      provider shows events.
- [ ] Check the site on your phone.

---

## Known production limitations (all have fixes when you want them)

1. **Admin console tabs (Leads / Subscribers / Analytics) are empty in
   production** — they read the local file store. Real data: leads in
   Supabase + email; analytics in your provider. Fix: point the admin
   console at Supabase (ask Claude Code).
2. **Email-popup subscribers are NOT durably stored in production** — the
   subscribe endpoint currently writes only to the file store. Fix before
   promoting the popup: add a `subscribers` table + Supabase write
   (~10 minutes for Claude Code), or wire it to an email platform.
3. **The client portal has no accounts in production** — demo data is
   file-based and gitignored. It's a dev/demo feature until the portal store
   moves to Supabase.
4. **Chatbot persona tests not yet run against the live model** — run them
   right after the API key is set, before driving traffic.
5. **Homepage upgrade is half-built** — Audit + Revenue Leaks sections exist
   in code but are not on the page yet. Launch with the current homepage or
   finish the upgrade first.

## Rough monthly costs

| Item | Cost |
|---|---|
| Vercel Pro (commercial use) | $20/mo (Hobby is fine while testing) |
| Domain | ~$1/mo |
| Supabase | Free tier |
| Resend | Free to 100 emails/day |
| Anthropic API (chat) | Usage-based; light traffic ≈ $5–20/mo |
| Turnstile | Free |
| Calendly | Free tier |
| GA4 / PostHog free tier | Free |
