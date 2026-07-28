#!/usr/bin/env python3
"""Enforce the RSG portfolio's architecture boundaries (see docs/architecture/boundaries.md).

    python scripts/check_boundaries.py            # check, exit 1 on violation
    python scripts/check_boundaries.py --report   # print the graph, always exit 0

This portfolio is not an npm workspace. The five browser apps are plain HTML +
<script> tags and the dependency graph lives in relative paths ("../shared/x.js"),
not in package.json. So the graph is built from what the files actually reference,
which is also the only thing a browser will honour at runtime.

Seven checks, each one a failure mode this repo has already hit or is one careless
copy away from hitting:

  1  app -> app          two apps coupled; the shell is the only thing allowed to
                         know all of them, and only by URL
  2  vendored copy       an app carrying a fork of another app inside itself
  3  layer direction     a lower layer reaching up into a higher one
  4  broken reference    a "../shared/x.js" that resolves to nothing on disk —
                         a 404 the browser reports only in the console
  5  synced-file drift   a hand-copied SQL migration that no longer matches source
  6  generated edits     hand-edits to committed build output
  7  cycles              among units, always a defect

Existing violations go in boundaries.json "allow" with a reason and an owner, so
the mess is a finite list rather than an invisible one.
"""

import argparse
import fnmatch
import hashlib
import json
import os
import re
import subprocess
import sys
from collections import defaultdict

SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", "coverage",
             "__pycache__", ".venv", "venv", "vendor", "_next"}
# Prose is deliberately excluded: a README naming another app is documentation,
# not a dependency. Only files a runtime actually follows are scanned.
READ_EXT = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".html", ".json"}

# "../GHOST/", "../shared/rsg-supabase.js", "/apps/observatory/index.html".
# Spaces are allowed inside the path because two units are named "The forge" and
# "Onehand OS"; a quote, newline or tag close ends the match.
REL_REF = re.compile(r"""\.\./([^"'`\n)>;]+)""")
ABS_REF = re.compile(r"""["'`(](/[A-Za-z0-9_\-./%]+\.(?:html|js|css|json))""")


def unquote(s):
    """URL-decode just enough for '%20' in 'Onehand%20OS'."""
    return re.sub(r"%([0-9A-Fa-f]{2})", lambda m: chr(int(m.group(1), 16)), s)


def norm(p):
    return p.replace("\\", "/").strip("/")


class Model:
    """boundaries.json, resolved into lookups the checks can use."""

    def __init__(self, cfg, root):
        self.root = root
        self.cfg = cfg
        self.rank = {name: i for i, name in enumerate(cfg["layers"])}
        self.units = cfg["units"]
        self.generated = cfg.get("generated", {})

        self.dir_owner = {}    # top-level-ish dir -> unit
        self.file_owner = {}   # exact file path -> unit
        self.alias = {}        # lowercase alias/dir-name -> unit
        for name, u in self.units.items():
            for d in u.get("dirs", []):
                self.dir_owner[norm(d)] = name
                self.alias[norm(d).lower()] = name
            for f in u.get("files", []):
                self.file_owner[norm(f)] = name
            for a in u.get("aliases", []):
                self.alias[a.lower()] = name
            self.alias[name.lower()] = name
        for name, g in self.generated.items():
            for d in g.get("dirs", []):
                self.dir_owner[norm(d)] = name

    def owner_of(self, relpath):
        """Which unit does this file belong to? Longest prefix wins."""
        p = norm(relpath)
        if p in self.file_owner:
            return self.file_owner[p]
        best, best_len = None, -1
        for d, unit in self.dir_owner.items():
            if (p == d or p.startswith(d + "/")) and len(d) > best_len:
                best, best_len = unit, len(d)
        return best

    def layer_of(self, unit):
        u = self.units.get(unit)
        return u["layer"] if u else None

    def files(self):
        for dirpath, dirnames, filenames in os.walk(self.root):
            dirnames[:] = [d for d in dirnames
                           if d not in SKIP_DIRS and not d.startswith(".")]
            for fn in filenames:
                if os.path.splitext(fn)[1].lower() not in READ_EXT:
                    continue
                full = os.path.join(dirpath, fn)
                yield norm(os.path.relpath(full, self.root)), full


def read(path):
    try:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            return fh.read()
    except OSError:
        return ""


def references(text):
    """Every path-ish reference in a file, as ('../x/y', 'x/y') pairs."""
    out = []
    for m in REL_REF.finditer(text):
        out.append(unquote(m.group(1)))
    for m in ABS_REF.finditer(text):
        out.append(unquote(m.group(1).lstrip("/")))
    return out


def allowed(cfg, kind, where, what):
    for entry in cfg.get("allow", []):
        if entry.get("kind") not in (None, kind):
            continue
        if fnmatch.fnmatch(where, entry.get("where", "*")) and \
           fnmatch.fnmatch(what, entry.get("what", "*")):
            return True
    return False


def check(model, report=False):
    cfg, root = model.cfg, model.root
    violations = []
    edges = defaultdict(set)

    def flag(kind, where, what, msg):
        if not allowed(cfg, kind, where, what):
            violations.append((kind, where, msg))

    catalog = set()
    for u in model.units.values():
        for f in u.get("catalog_files", []):
            catalog.add(norm(f))

    # ---- 1, 3, 4: reference-level checks ------------------------------------
    for rel, full in model.files():
        src_unit = model.owner_of(rel)
        if src_unit is None or src_unit in model.generated:
            continue
        src_layer = model.layer_of(src_unit)
        if src_layer is None:
            continue
        here = os.path.dirname(rel)
        text = read(full)

        for ref in references(text):
            head = ref.split("/")[0].lower()
            dst_unit = model.alias.get(head)

            # 4 — a ../shared/* reference that does not resolve on disk.
            #
            # Only checked in HTML, where the browser resolves src/href against
            # the page's own directory and the answer is unambiguous. The same
            # string inside a .js file is usually a comment quoting the <script>
            # tag the page must carry, and is relative to that page, not to the
            # script — resolving it from here would be wrong every time.
            if head == "shared" and rel.lower().endswith(".html"):
                target = norm(os.path.normpath(os.path.join(here, "..", ref)))
                if not os.path.exists(os.path.join(root, target)):
                    flag("broken-reference", rel, ref,
                         "references %r, which resolves to %s — that file does "
                         "not exist" % (ref, target or "(repo root)"))
                    continue

            if dst_unit is None or dst_unit == src_unit:
                continue
            if dst_unit in model.generated:
                continue
            dst_layer = model.layer_of(dst_unit)
            if dst_layer is None:
                continue
            edges[src_unit].add(dst_unit)

            # the shell is allowed to name apps, but only in its catalog
            if src_layer == "shell" and model.rank[dst_layer] < model.rank[src_layer]:
                if rel not in catalog:
                    flag("shell-reference", rel, dst_unit,
                         "names app %r outside a declared catalog file — the "
                         "shell may launch apps by URL, not reference their "
                         "source" % dst_unit)
                continue

            # 1 — two units at the same layer
            if model.rank[dst_layer] == model.rank[src_layer]:
                flag("app-to-app", rel, dst_unit,
                     "%s (%s) references %s (%s) — units at the same layer must "
                     "not know about each other; shared code belongs in a "
                     "capability or platform unit"
                     % (src_unit, src_layer, dst_unit, dst_layer))
            # 3 — pointing upward
            elif model.rank[dst_layer] > model.rank[src_layer]:
                flag("layer-direction", rel, dst_unit,
                     "%s (%s) references %s (%s) — dependencies point downward "
                     "only" % (src_unit, src_layer, dst_unit, dst_layer))

    # ---- 3b: a capability unit must not use a platform global ---------------
    plat_globals = {}
    for name, u in model.units.items():
        if u["layer"] == "platform":
            for g in u.get("globals", []):
                plat_globals[g] = name
    for name, u in model.units.items():
        if u["layer"] != "capability":
            continue
        for f in u.get("files", []):
            text = read(os.path.join(root, f))
            for g, owner in plat_globals.items():
                if re.search(r"\b%s\b" % re.escape(g), text):
                    flag("layer-direction", norm(f), owner,
                         "capability unit %s uses %s, owned by platform unit %s "
                         "— capability code must stay free of I/O"
                         % (name, g, owner))

    # ---- 2: an app carrying a copy of another app --------------------------
    #
    # A directory named after another unit proves nothing — the website legitimately
    # has app/portal/observatory routes that talk to Observatory without containing
    # it. What proves a fork is content: files whose bytes match the real unit's.
    fingerprints = {}
    for name, u in model.units.items():
        seen = {}
        for d in u.get("dirs", []):
            for dirpath, dirnames, filenames in os.walk(os.path.join(root, d)):
                dirnames[:] = [x for x in dirnames
                               if x not in SKIP_DIRS and not x.startswith(".")]
                for fn in filenames:
                    try:
                        with open(os.path.join(dirpath, fn), "rb") as fh:
                            seen[(fn.lower(), hashlib.md5(fh.read()).hexdigest())] = True
                    except OSError:
                        pass
        fingerprints[name] = set(seen)

    COPY_EVIDENCE = 2   # identical files needed before calling it a fork

    for name, u in model.units.items():
        for d in u.get("dirs", []):
            for dirpath, dirnames, _ in os.walk(os.path.join(root, d)):
                dirnames[:] = [x for x in dirnames
                               if x not in SKIP_DIRS and not x.startswith(".")]
                for sub in dirnames:
                    other = model.alias.get(sub.lower())
                    if not other or other == name or other in model.generated:
                        continue
                    cand = os.path.join(dirpath, sub)
                    rel = norm(os.path.relpath(cand, root))
                    matches = 0
                    for cdir, cdirs, cfiles in os.walk(cand):
                        cdirs[:] = [x for x in cdirs
                                    if x not in SKIP_DIRS and not x.startswith(".")]
                        for fn in cfiles:
                            try:
                                with open(os.path.join(cdir, fn), "rb") as fh:
                                    h = hashlib.md5(fh.read()).hexdigest()
                            except OSError:
                                continue
                            if (fn.lower(), h) in fingerprints.get(other, ()):
                                matches += 1
                    if matches >= COPY_EVIDENCE:
                        flag("vendored-copy", rel, other,
                             "%s contains a copy of %s at %s (%d files byte-identical "
                             "to the real app) — a fork that will drift; mount the "
                             "real app or extract what is genuinely shared"
                             % (name, other, rel, matches))

    # ---- 5: hand-copied files that must stay byte-identical -----------------
    for spec in cfg.get("synced_files", []):
        src = os.path.join(root, spec["source"])
        if not os.path.exists(src):
            continue
        want = hashlib.md5(open(src, "rb").read()).hexdigest()
        pattern = spec["copies"]
        for name, u in model.units.items():
            for d in u.get("dirs", []):
                cand = norm(pattern.replace("*", d, 1))
                path = os.path.join(root, cand)
                if not os.path.exists(path):
                    continue
                got = hashlib.md5(open(path, "rb").read()).hexdigest()
                if got != want:
                    flag("synced-drift", cand, spec["source"],
                         "%s has drifted from %s — regenerate it rather than "
                         "editing the copy" % (cand, spec["source"]))

    # ---- 6: hand-edits to committed build output ---------------------------
    for name, g in model.generated.items():
        for d in g.get("dirs", []):
            try:
                out = subprocess.run(
                    ["git", "status", "--porcelain", "--", d],
                    cwd=root, capture_output=True, text=True, timeout=60).stdout
            except (OSError, subprocess.SubprocessError):
                continue
            changed = [ln for ln in out.splitlines() if ln.strip()]
            if changed:
                flag("generated-edit", d, name,
                     "%d uncommitted change(s) under %s, which is generated "
                     "output. %s" % (len(changed), d, g.get("reason", "")))

    # ---- 7: cycles among units ---------------------------------------------
    colour, cycles = {}, []

    def walk(n, stack):
        colour[n] = 1
        for m in sorted(edges.get(n, ())):
            if colour.get(m) == 1:
                cycles.append(stack[stack.index(m):] + [m] if m in stack
                              else [n, m])
            elif colour.get(m, 0) == 0:
                walk(m, stack + [m])
        colour[n] = 2

    for n in sorted(set(list(edges) + list(model.units))):
        if colour.get(n, 0) == 0:
            walk(n, [n])
    for c in cycles:
        flag("cycle", " -> ".join(c), "cycle",
             "cycle among units: %s" % " -> ".join(c))

    if report:
        print("RSG BOUNDARIES  (%d units)\n" % len(model.units) + "=" * 70)
        for layer in cfg["layers"]:
            names = [n for n, u in model.units.items() if u["layer"] == layer]
            if names:
                print("\n  %-11s %s" % (layer + "/", ", ".join(sorted(names))))
        print("\n  edges actually present in the source:")
        for s in sorted(edges):
            print("    %-16s -> %s" % (s, ", ".join(sorted(edges[s]))))
        print()

    return violations


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--config", default=None)
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    root = os.path.abspath(args.root)
    cfg_path = args.config or os.path.join(root, "boundaries.json")
    with open(cfg_path, encoding="utf-8") as fh:
        cfg = json.load(fh)

    violations = check(Model(cfg, root), report=args.report)

    if not violations:
        print("boundaries: OK")
        return 0

    by_kind = defaultdict(list)
    for kind, where, msg in violations:
        by_kind[kind].append((where, msg))
    print("BOUNDARY VIOLATIONS (%d)\n" % len(violations) + "=" * 70)
    for kind in sorted(by_kind):
        print("\n%s" % kind)
        for where, msg in sorted(by_kind[kind]):
            print("  %s\n      %s" % (where, msg))
    print("\nFix, or add an entry to \"allow\" in boundaries.json with a reason "
          "and an owner.")
    return 0 if args.report else 1


if __name__ == "__main__":
    sys.exit(main())
