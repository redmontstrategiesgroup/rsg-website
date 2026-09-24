# Runbook — purge the 2026-07-27 Supabase backup from rsg-website history

**Status:** deferred. Do this *before* `redmontstrategiesgroup/rsg-website` goes public again.
**Written:** 2026-09-22. **Do not run any of this until Step 0 is confirmed.**

This runbook lives in the *outer* RSG repo on purpose — the repo it rewrites is
`Website/`, and a runbook stored inside the rewrite target is a runbook you lose
mid-procedure.

---

## Why

`supabase/backup-2026-07-27/data.sql` is a row dump of the retired Supabase project
`xnhbrfbuvssxpciikhws`. It was tracked and pushed to a public repo from 2026-07-27
until it was untracked on 2026-09-22 (commit `ed51cca`). Untracking stops future
commits only; the blobs remain reachable in history.

**What is in it** (grepped over all four files, 2026-09-22):

| Item | Count | Table |
|---|---|---|
| `<lead-email>` + `<lead-phone>` | 1 record | `public.leads`, `public.booking_sessions` |
| `<test-email>` | 1 | `public.leads` |
| `josephpoday@gmail.com` | 8 | various |

Everything else is `.example` / `.internal` demo rows and reserved `+1555555xxxx`
fictional numbers. **No credentials of any kind** — no API keys, no JWTs, no
service-role secrets. Nothing needs rotating; this is a privacy cleanup, not an
incident. The `service_role` hits in `security-hardening.sql` are a Postgres role
name in DDL, not a secret.

The one third-party record is a prank contact-form submission from 2026-07-11 under
the name "Ben Dover" / "Dickemdown inc.". It is a real mailbox and a real phone
number, so it is genuine PII — and the crude text in a company repo is an
independent reason to remove it.

---

## Step 0 — precondition (manual, not scriptable)

Make the repo private first. This is the actual mitigation; the rewrite below is
cleanup that lets it safely go public again later.

`redmontstrategiesgroup` is a **separate GitHub user account**, not an org, and the
`josephpoday` token has `push` but **not `admin`** — so this cannot be done from the
CLI with the current credentials.

> Log in to GitHub **as `redmontstrategiesgroup`** →
> `rsg-website` → Settings → General → Danger Zone →
> **Change repository visibility → Make private**

Verify with `gh repo view redmontstrategiesgroup/rsg-website --json visibility`.

As of writing: 0 forks, 0 stars, 0 watchers — so going private closes the practical
exposure completely.

---

## Blast radius (read before starting)

Only one commit ever introduced the file: **`58e38af`** ("WIP snapshot ... restore
point", 2026-07-27). It is the **third commit in the repo** and an ancestor of every
branch, so the purge is not surgical:

- **179 of 182 commits** get new SHAs
- **7 remote branches** across 2 remotes need force-pushing
- **3 open PRs** are affected
- **Vercel** pins production to a commit SHA that will cease to exist on any branch

Blobs to purge (verification targets):

```
eb6bf412e5624bbaef4717194b7b872336ce6f94  data.sql
c0ea18c7da0c4878dad5aca9da9f35304c9bc755  schema.sql
8f9a829c87d0e27232b2b044360b6a55f7a8c3a9  README.md
05b4e306485d26170cc047ade35fcea869a1869a  security-hardening.sql
```

---

## Step 1 — clear the decks

The rewrite refuses a dirty tree or extra worktrees, and force-pushing under a live
PR is what turns a clean procedure into a mess.

1. **Land or close the PRs.**
   - `#2` (`fix/mobile-responsive-pass`) and `#3` (`feat/api-platform`) — your active
     work. Merge them first; rewriting under an open PR orphans review threads.
   - `#1` (`cursor/setup-dev-environment-dd88`) — a draft untouched since
     2026-07-13. Close it rather than carry it through the rewrite.
2. **Commit or stash the working tree.** As of 2026-09-22 `Website/` carries ~212
   modified and ~12 untracked files. `git status --porcelain` must come back empty.
3. **Remove the extra worktree:**

```sh
git worktree remove .claude/worktrees/api-platform
git worktree list          # expect exactly one entry
```

## Step 2 — back up (do not skip)

```sh
cd /c/Users/josep/Desktop/RSG
git clone --mirror Website/.git rsg-website-premirror.git
tar -czf rsg-website-worktree-2026-09-22.tar.gz \
    --exclude=node_modules --exclude=.next Website/
```

Keep both outside `Website/`. They are the only way back if the force-push is wrong.

## Step 3 — install the tool

```sh
pip install git-filter-repo
git filter-repo --version
```

## Step 4 — rewrite

```sh
cd /c/Users/josep/Desktop/RSG/Website
git filter-repo --invert-paths --path supabase/backup-2026-07-27/
```

`filter-repo` rewrites **all refs**, and deliberately **deletes the `origin` and
`new-website` remotes** afterwards so you cannot force-push by reflex. That is a
feature — Step 6 puts them back once you have verified.

Note: the directory is gitignored and untracked as of `ed51cca`, so the files stay
on disk untouched. The rewrite only removes them from history.

## Step 5 — verify before pushing

```sh
# 1. no blob under that path survives anywhere in history — expect NO output
git rev-list --all | while read c; do
  git ls-tree -r "$c" -- supabase/backup-2026-07-27 2>/dev/null
done | sort -u

# 2. none of the four blob SHAs resolve — expect "missing" four times
for b in eb6bf412e5624bbaef4717194b7b872336ce6f94 \
         c0ea18c7da0c4878dad5aca9da9f35304c9bc755 \
         8f9a829c87d0e27232b2b044360b6a55f7a8c3a9 \
         05b4e306485d26170cc047ade35fcea869a1869a; do
  git cat-file -e "$b" 2>/dev/null && echo "STILL PRESENT: $b" || echo "missing: $b"
done

# 3. the PII strings are gone from history — expect no output
#    Set these from the live `public.leads` row before running; do not commit the values.
LEAD_EMAIL_LOCALPART=...   # local-part of <lead-email>
LEAD_PHONE_DIGITS=...      # <lead-phone>, digits only, no leading +
git grep -I -l -e "$LEAD_EMAIL_LOCALPART" -e "$LEAD_PHONE_DIGITS" $(git rev-list --all) 2>/dev/null

# 4. the tree at HEAD is otherwise unchanged — expect no output
git diff --stat HEAD -- . ":!supabase/backup-2026-07-27"
```

**If any check fails, stop.** Restore from the Step 2 mirror; do not push.

## Step 6 — push

```sh
git remote add origin      https://github.com/redmontstrategiesgroup/rsg-website.git
git remote add new-website https://github.com/josephpoday/new-website.git
git push --force --all origin
git push --force --all new-website
```

(No tags exist today, so there is nothing to push with `--tags`.)

## Step 7 — after the push

1. **Redeploy Vercel.** Production is pinned to a commit SHA that no longer exists on
   any branch. Deploy history and rollback targets to pre-rewrite commits are gone —
   expected and unavoidable. Trigger a fresh production deploy and confirm
   `/api/health?ready=1` returns 200.
2. **Ask GitHub to purge cached views.** GitHub keeps unreachable commits viewable by
   SHA until garbage collection. Open a Support ticket naming the repo and asking them
   to run GC / purge the cached commit views. *Until they confirm, the old SHAs are
   still fetchable — so keep the repo private until then.*
3. **Re-verify from outside:**

```sh
gh api "repos/redmontstrategiesgroup/rsg-website/contents/supabase/backup-2026-07-27/data.sql?ref=58e38af"
# expect: HTTP 404
```

4. **Tell anyone with a clone to re-clone.** Existing clones keep the old objects, and
   a plain `git pull` against rewritten history will try to merge them back in.

---

## What this does not reach

Be honest about the residue: the rewrite cannot touch existing clones on other
machines, third-party mirrors, or anything a code-search index already captured
during the ~2 months the repo was public. With 0 forks, 0 stars and 0 watchers, the
realistic likelihood any of those exist is low — but "low" is the honest word, not
"none". If that residual risk is unacceptable, the stronger move is to treat the one
third-party address as deleted at the source as well: confirm the record is gone from
the live project (`dyajmgddsiqcnlehqbhl`) and from `Website/data/leads.json`.
