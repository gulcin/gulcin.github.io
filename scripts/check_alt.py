#!/usr/bin/env python3
"""Accessibility check: fail if any image lacks alt text.

- every <img> (static or in a JS template string) in *.html must have an alt attribute
- every inline <svg> must be aria-hidden="true" or role="img" with an aria-label
- every memories.json item must have a non-empty "alt"
Run: python3 scripts/check_alt.py   (exit code 1 on problems)
"""
import glob, json, os, re, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
bad = []
for f in sorted(glob.glob("*.html") + glob.glob("reading-list/*.html")):
    src = open(f, encoding="utf-8").read()
    for m in re.finditer(r"<img\b[^>]*>", src):
        if not re.search(r"\salt\s*=", m.group(0)):
            bad.append(f"{f}:{src.count(chr(10),0,m.start())+1}: <img> without alt: {m.group(0)[:90]}")
    for m in re.finditer(r"<svg\b[^>]*>", src):
        t = m.group(0)
        if 'aria-hidden="true"' not in t and not ('role="img"' in t and "aria-label=" in t):
            bad.append(f"{f}:{src.count(chr(10),0,m.start())+1}: <svg> needs aria-hidden=\"true\" or role=\"img\"+aria-label")
    if re.search(r"createElement\(\s*['\"]img['\"]\s*\)", src):
        bad.append(f"{f}: uses createElement('img'); build <img> with an alt attribute instead")
if os.path.exists("memories.json"):
    for k, i in enumerate(json.load(open("memories.json", encoding="utf-8")).get("items", [])):
        if not (i.get("alt") or "").strip():
            bad.append(f"memories.json item {k} ({i.get('file')}): missing \"alt\"")
print("\n".join(bad) or "alt-text check: OK")
sys.exit(1 if bad else 0)
