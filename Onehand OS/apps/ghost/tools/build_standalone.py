#!/usr/bin/env python3
"""Inline GHOST's linked CSS/JS into a single self-contained ghost.html.

Run from anywhere:  python tools/build_standalone.py
Reads styles/*.css + js/*.js + index.html, writes ghost.html at the repo root.
"""
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

CSS_FILES = ["styles/core.css", "styles/app.css"]
JS_FILES = ["js/lib.js", "js/data.js", "js/engine.js", "js/viz.js", "js/ui.js", "js/app.js"]

FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'"
    "%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%91%BB%3C/text%3E%3C/svg%3E"
)


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def main():
    index = read("index.html")

    # body inner, minus the external <script src> tags and their comment
    body_inner = re.search(r"<body>(.*)</body>", index, re.S).group(1)
    body_inner = re.sub(r'\s*<script src="js/[^"]+"></script>', "", body_inner)
    body_inner = re.sub(r"<!-- Classic scripts.*?-->", "", body_inner, flags=re.S)

    styles = "\n".join(f"<style>\n{read(f)}\n</style>" for f in CSS_FILES)
    scripts = "\n".join(f"<script>\n{read(f)}\n</script>" for f in JS_FILES)

    standalone = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>GHOST // Command Center</title>
<meta name="description" content="GHOST — a cinematic AI command center." />
<link rel="icon" href="{FAVICON}" />
{styles}
</head>
<body>
{body_inner}
{scripts}
</body>
</html>
"""
    out = ROOT / "ghost.html"
    out.write_text(standalone, encoding="utf-8")
    print(f"wrote {out}  ({len(standalone):,} bytes)")


if __name__ == "__main__":
    main()
