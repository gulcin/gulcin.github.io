// Overlap and horizontal-overflow check for the home page, Speaking, Community, About, and Albums.
//
// From the repo root, with the playwright package available:
//   npm install --no-save playwright
//   node tests/ui-check.mjs
//
// Uses CHROME_PATH, or /usr/bin/google-chrome when that exists, otherwise
// Playwright's Chromium. Set BASE_URL to reuse a server. Screenshots go to
// SCREENSHOT_DIR (default: /tmp/ui-check). Exits 1 on any failure.

import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WIDTHS = [390, 768, 1024, 1280];
const MIN_GAP = 12;
const SHOTS = process.env.SCREENSHOT_DIR || "/tmp/ui-check";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

const PAGES = [
  { name: "home", path: "/index.html", ready: "#talks .hcard" },
  { name: "speaking", path: "/events.html", ready: "#up .up" },
  { name: "community", path: "/community.html", ready: ".ctl .window" },
  { name: "about", path: "/about.html", ready: "h1.cmd" },
  { name: "albums", path: "/albums.html#pgconfeu-2026", ready: ".agallery .ph" },
  { name: "codedive", path: "/albums.html#codedive-2026", ready: ".agallery .ph" }
];

// Section peers: headings, cards, and the links that sit beside them.
// Nested text is skipped by ignoring an ancestor/descendant pair.
const PEERS = [
  "header.site",
  "a.brand",
  "nav.nav",
  "nav.nav a",
  "nav.subnav",
  "nav.subnav a",
  "h1",
  "h2",
  "h3",
  ".hcard",
  "a.more",
  ".up",
  ".invite",
  "li.sr",
  "li.yh",
  ".acard",
  ".agallery .ph",
  ".sessions li",
  ".mrow",
  ".coffeeline",
  ".coffee",
  ".ahead",
  ".copen",
  ".ctl .window",
  ".ctl .roles li"
].join(",");

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      let name = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      if (name === "" || name.endsWith("/")) name += "index.html";
      const file = path.resolve(ROOT, name);
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (existsSync("/usr/bin/google-chrome")) return "/usr/bin/google-chrome";
  return undefined;
}

async function inspect(page) {
  return page.evaluate(({ peers, minGap }) => {
    const issues = [];
    const vw = document.documentElement.clientWidth;
    const label = (el) => {
      const t = (el.innerText || el.getAttribute("aria-label") || el.tagName).replace(/\s+/g, " ").trim().slice(0, 60);
      const id = el.id ? "#" + el.id : "";
      const cls = el.classList.length ? "." + [...el.classList].slice(0, 3).join(".") : "";
      return `${el.tagName.toLowerCase()}${id}${cls} “${t}”`;
    };
    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return false;
      const r = el.getBoundingClientRect();
      return r.width >= 1 && r.height >= 1;
    };
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top + window.scrollY, right: r.right, bottom: r.bottom + window.scrollY, width: r.width, height: r.height };
    };
    const hit = (a, b) => {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return w > 1 && h > 1;
    };

    if (document.documentElement.scrollWidth > vw + 1) {
      issues.push(`page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`);
    }

    const all = [...document.body.querySelectorAll("*")].filter(visible);
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > vw + 1) {
        issues.push(`overflow ${label(el)} left ${r.left.toFixed(1)} right ${r.right.toFixed(1)} viewport ${vw}`);
      }
    }

    const nodes = [...document.querySelectorAll(peers)].filter(visible).map((el) => ({ el, box: box(el), label: label(el) }));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (hit(a.box, b.box)) issues.push(`overlap ${a.label} × ${b.label}`);
      }
    }

    for (const link of document.querySelectorAll("a.more")) {
      const prev = link.previousElementSibling;
      if (!prev || !visible(link) || !visible(prev)) continue;
      const gap = box(link).top - box(prev).bottom;
      if (gap < minGap) issues.push(`“${link.textContent.trim()}” is ${gap.toFixed(1)}px under ${label(prev)} (need ${minGap}px)`);
    }
    return issues;
  }, { peers: PEERS, minGap: MIN_GAP });
}

async function checkAbstractToggle(page) {
  const btn = page.locator("#up .up", { hasText: "CERN PGDay 2027" }).locator("button.absmore");
  await btn.waitFor({ state: "visible" });
  const before = await page.evaluate(() => {
    const issues = [];
    const cards = [...document.querySelectorAll("#up .up")];
    const cern = cards.find(el => (el.innerText || "").includes("CERN PGDay 2027"));
    const button = cern && cern.querySelector("button.absmore");
    if (!button) return ["CERN card has no Read more button"];
    if (button.getAttribute("aria-expanded") !== "false") issues.push("CERN toggle should start collapsed");
    if (button.textContent.trim() !== "Read more") issues.push(`CERN toggle label is “${button.textContent.trim()}”`);
    const body = cern.querySelector(".absbody");
    if (!body || !body.classList.contains("clamp")) issues.push("CERN abstract is not clamped");
    else if (body.scrollHeight <= body.clientHeight + 1) issues.push("CERN clamp is not hiding any text");
    let toggles = 0;
    for (const card of cards) {
      const b = card.querySelector("button.absmore");
      const bd = card.querySelector(".absbody");
      if (!bd && b) issues.push("Read more on a card with no abstract");
      if (!bd) continue;
      if (b) toggles++;
      if (!b && bd.scrollHeight > bd.clientHeight + 1) issues.push("overflowing abstract has no Read more button");
      if (b && b.getAttribute("aria-expanded") === "false" && !bd.classList.contains("clamp")) issues.push("collapsed button on an unclamped abstract");
    }
    if (toggles < 2) issues.push(`expected every long abstract to toggle, found ${toggles}`);
    return issues;
  });
  await btn.focus();
  await page.keyboard.press("Enter");
  const opened = await page.evaluate(() => {
    const cern = [...document.querySelectorAll("#up .up")].find(el => (el.innerText || "").includes("CERN PGDay 2027"));
    const button = cern.querySelector("button.absmore");
    const body = cern.querySelector(".absbody");
    const issues = [];
    if (button.getAttribute("aria-expanded") !== "true") issues.push("Enter did not set aria-expanded");
    if (button.textContent.trim() !== "Show less") issues.push("expanded label is not Show less");
    if (body.classList.contains("clamp")) issues.push("abstract stayed clamped after Read more");
    if (!body.innerText.includes("This talk shows an open-source workflow")) issues.push("expanded abstract is missing the second paragraph");
    return issues;
  });
  const expandedLayout = await inspect(page);
  await page.keyboard.press("Enter");
  const closed = await page.evaluate(() => {
    const cern = [...document.querySelectorAll("#up .up")].find(el => (el.innerText || "").includes("CERN PGDay 2027"));
    const button = cern.querySelector("button.absmore");
    const issues = [];
    if (button.getAttribute("aria-expanded") !== "false") issues.push("second Enter did not collapse");
    if (button.textContent.trim() !== "Read more") issues.push("collapsed label did not return to Read more");
    if (!cern.querySelector(".absbody").classList.contains("clamp")) issues.push("abstract did not clamp again");
    return issues;
  });
  return [...before, ...opened, ...expandedLayout.map(issue => `expanded: ${issue}`), ...closed];
}

const server = process.env.BASE_URL ? null : await startServer();
const base = process.env.BASE_URL || `http://127.0.0.1:${server.address().port}`;
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  headless: true
});

let failed = 0;
try {
  const page = await browser.newPage();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const item of PAGES) {
      const where = `${item.name} @ ${width}px`;
      await page.goto(base + item.path, { waitUntil: "networkidle" });
      await page.waitForSelector(item.ready);
      await page.evaluate(() => document.fonts.ready);
      const issues = await inspect(page);
      if (item.name === "speaking") issues.push(...await checkAbstractToggle(page));
      const file = path.join(SHOTS, `${item.name}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      if (issues.length) {
        failed += issues.length;
        console.log(`FAIL ${where}`);
        for (const issue of issues) console.log("  " + issue);
      } else {
        console.log(`ok   ${where}`);
      }
    }
  }
} finally {
  await browser.close();
  if (server) server.close();
}

if (failed) {
  console.error(`\n${failed} layout problem${failed === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log("\nno overlap, no horizontal overflow");
