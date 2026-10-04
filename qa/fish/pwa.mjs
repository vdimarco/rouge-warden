// Checks what makes Reel It In an app: the web manifest and icons, the cached files and the service worker (version, offline start,
// Range answers, an update), app mode (no link to the arcade), the Back button, Reset progress, the privacy page and card, and that
// nothing in public/fish loads from another origin. Self-contained: it serves public/ itself on a random port (with Range support,
// which `python3 -m http.server` lacks) and does not use lib.mjs.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/fish/pwa.mjs [--static]
//   --static: only the checks that need no browser (CI runs this one: node, nothing else).
//   PWA_PUBLIC=<dir> checks another copy of public/ instead. PWA_ONLY=<regex> runs only the checks whose names match (the service worker
//   checks need each other: use "sw.js registers|offline" together).
// Playwright's goBack() cannot prove the Back button on a phone: Chrome's history rule (it skips entries a page adds with no tap) is not
// applied there. The Back checks send popstate events, and one check uses a real goBack(). Real Back on a device is a DEVICE item.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { readFile, readdir, stat } from "fs/promises";
import { createHash } from "crypto";
import http from "http";
import path from "path";
import { stampOf } from "../../play/fish/stamp-sw.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUB = process.env.PWA_PUBLIC ? path.resolve(process.env.PWA_PUBLIC) : path.join(ROOT, "public");
const STATIC_ONLY = process.argv.includes("--static");
const ONLY = process.env.PWA_ONLY ? new RegExp(process.env.PWA_ONLY, "i") : null;
const FISH = path.join(PUB, "fish");
const HOST = "warden-alpha-wheat.vercel.app"; // only the og: tags of index.html name it

let fails = 0;
const pass = (name) => console.log("PASS: " + name);
const info = (msg) => console.log("INFO: " + msg);
async function test(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const bad = [];
  try { await fn((ok, msg) => { if (!ok) bad.push(msg); }); } catch (e) { bad.push("threw " + (e.stack || e)); }
  if (bad.length) { fails++; console.log("FAIL " + name + ":\n  " + bad.join("\n  ")); } else pass(name);
}
const exists = async (p) => { try { return (await stat(p)).isFile(); } catch (e) { return false; } };
const read = (p) => readFile(p, "utf8");
const readJSON = async (p) => JSON.parse(await read(p));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])))).flat();
const site = (f) => "/" + path.relative(PUB, f).split(path.sep).join("/");
// PNG width and height from the IHDR chunk
const pngSize = (buf) => (buf.slice(1, 4).toString() === "PNG" ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const indexSrc = await read(path.join(FISH, "index.html"));
const head = indexSrc.slice(indexSrc.indexOf("<head>"), indexSrc.indexOf("</head>"));
const manifest = await readJSON(path.join(FISH, "manifest.webmanifest"));
const MURL = "https://" + HOST + "/fish/manifest.webmanifest";
// sw.js runs in a stub worker scope; a syntax error or an import in it stops here with a plain message
let stamp;
try { stamp = await stampOf(PUB); } catch (e) { console.log("FAIL sw.js cannot be read as a classic worker: " + e.message); process.exit(1); }

/* ================= static part: no browser ================= */

/* ---------------- web manifest and icons ---------------- */
await test("manifest fields", async (ok) => {
  ok(manifest.id === "/fish/", "id is " + manifest.id);
  ok(manifest.name === "Reel It In", "name is " + manifest.name);
  ok(manifest.short_name === "Reel It In" && manifest.short_name.length <= 12, "short_name is " + manifest.short_name);
  ok(typeof manifest.description === "string" && manifest.description.length > 40 && !/in your browser/i.test(manifest.description), "description is " + manifest.description);
  ok(manifest.lang === "en", "lang is " + manifest.lang);
  ok(manifest.start_url === "/fish/?source=pwa", "start_url is " + manifest.start_url);
  ok(manifest.scope === "/fish/", "scope is " + manifest.scope);
  const start = new URL(manifest.start_url, MURL), scope = new URL(manifest.scope, MURL);
  ok(start.origin === scope.origin && start.pathname.startsWith(scope.pathname), "start_url is outside the scope");
  ok(manifest.display === "standalone", "display is " + manifest.display);
  ok(manifest.orientation === "portrait", "orientation is " + manifest.orientation);
  ok(manifest.background_color === "#0d2f38", "background_color is " + manifest.background_color);
  ok(manifest.theme_color === "#0d2f38", "theme_color is " + manifest.theme_color);
  ok(JSON.stringify(manifest.categories) === '["games"]', "categories is " + JSON.stringify(manifest.categories));
  ok(manifest.prefer_related_applications === false, "prefer_related_applications is " + manifest.prefer_related_applications);
  ok(new URL(manifest.id, MURL).pathname.startsWith(scope.pathname), "id is outside the scope");
  ok(/<meta name="theme-color" content="#0d2f38">/.test(indexSrc), "index.html theme-color is not #0d2f38");
  ok(/<link rel="manifest" href="manifest\.webmanifest">/.test(head), "index.html has no <link rel=\"manifest\">");
  ok(!/in your browser/i.test(indexSrc.match(/<meta name="description" content="([^"]*)"/)?.[1] || ""), "the page description still says \"in your browser\"");
});
await test("manifest icons and favicons", async (ok) => {
  const icons = manifest.icons || [];
  for (const [sizes, purpose] of [["192x192", "any"], ["512x512", "any"], ["512x512", "maskable"]]) ok(icons.some((i) => i.sizes === sizes && (i.purpose || "any").split(" ").includes(purpose)), "no " + sizes + " " + purpose + " icon");
  for (const ic of icons) {
    const u = new URL(ic.src, MURL);
    ok(u.origin === "https://" + HOST && u.pathname.startsWith("/fish/icons/"), ic.src + " is not under /fish/icons/");
    ok(ic.type === "image/png", ic.src + " type is " + ic.type);
    const file = path.join(PUB, decodeURIComponent(u.pathname));
    if (!(await exists(file))) { ok(false, ic.src + " is missing on disk"); continue; }
    const size = pngSize(await readFile(file));
    ok(size && size.w + "x" + size.h === ic.sizes, ic.src + " is " + (size ? size.w + "x" + size.h : "not a PNG") + ", the manifest says " + ic.sizes);
  }
  for (const [f, px] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180]]) {
    const buf = (await exists(path.join(FISH, "icons", f))) ? await readFile(path.join(FISH, "icons", f)) : null;
    const size = buf && pngSize(buf);
    ok(size && size.w === px && size.h === px, "icons/" + f + " is " + (size ? size.w + "x" + size.h : "missing") + ", want " + px + "x" + px);
  }
  ok(await exists(path.join(FISH, "icons/favicon.svg")), "icons/favicon.svg is missing");
  for (const re of [/<link rel="icon" href="icons\/favicon\.svg"/, /<link rel="icon" href="icons\/favicon-32\.png"/, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/]) ok(re.test(head), "index.html head lacks " + re);
  ok(!/href="\/icons\//.test(head), "index.html still links an arcade icon from /icons/");
});

/* ---------------- the first script, app mode and self-contained assets ---------------- */
await test("scripts in the head, app-mode marks", async (ok) => {
  const scripts = [...head.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  ok(scripts[0] === '<script src="/arcade/quiet.js">', "the first script in <head> is " + scripts[0] + " (qa/arcade/quiet.mjs wants /arcade/quiet.js first)");
  const second = head.slice(head.indexOf(scripts[0]) + scripts[0].length).replace(/^<\/script>/, "").trim();
  ok(/^<script>[\s\S]*dataset\.app/.test(second), "the app-mode script does not follow quiet.js");
  for (const need of ["source", "play", "pwa", "display-mode: standalone", "display-mode: fullscreen", "display-mode: minimal-ui", "android-app://", '"app"', "sessionStorage"]) ok(second.slice(0, 1500).includes(need), "the app-mode script lacks " + need);
  ok(!/localStorage/.test(second.slice(0, second.indexOf("</script>")).replace(/^\s*\/\/.*$/gm, "")), "the app-mode script uses localStorage (the website shares it with the app)");
  // every control that leaves the game carries arcade-only, so app mode can hide it
  // (the Switch game button and the arcade link on the title sit in one row, and the row has the class)
  const tags = [...indexSrc.replace(/<div class="row2 arcade-only">[\s\S]*?<\/div>/, "").matchAll(/<(button|a)\b[^>]*>/g)].map((m) => m[0]);
  const leaving = tags.filter((t) => /data-switch|data-fullscreen|href="\/"/.test(t));
  ok(leaving.length === 3, "found " + leaving.length + " more controls with data-switch, data-fullscreen or href=\"/\", want 3");
  for (const t of leaving) ok(/class="[^"]*\barcade-only\b/.test(t), t + " lacks the arcade-only class");
  ok(/html\[data-app\] \.arcade-only \{ display: none !important; \}/.test(indexSrc), "no CSS rule hides .arcade-only in app mode");
  ok(/class="row2 arcade-only"><button[^>]*data-switch[^>]*>[^<]*<\/button><a[^>]*href="\/"/.test(indexSrc), "the Switch game and arcade row on the title lacks arcade-only");
  ok(!/<script src="\/arcade\/switch\.js">/.test(indexSrc) && /dataset\.app\) \(function \(\) \{[^}]*\/arcade\/switch\.js/.test(indexSrc), "switch.js is not loaded only outside app mode");
});
await test("fonts, import map and three.js are in the folder", async (ok) => {
  const style = indexSrc.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
  const faces = [...style.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const want = [["Alfa Slab One", "400"], ["Nunito", "600"], ["Nunito", "800"], ["Nunito", "900"]];
  for (const [fam, w] of want) {
    const f = faces.find((x) => x.includes('"' + fam + '"') && new RegExp("font-weight:\\s*" + w + "\\b").test(x));
    ok(f, "the first <style> has no @font-face for " + fam + " " + w);
    if (!f) continue;
    ok(/font-display:\s*swap/.test(f), fam + " " + w + " has no font-display: swap");
    const file = /url\("\.\/(fonts\/[^"]+\.woff2)"\)/.exec(f)?.[1];
    ok(file, fam + " " + w + " does not point at a file in fonts/");
    if (file) ok((await exists(path.join(FISH, file))) && (await readFile(path.join(FISH, file))).slice(0, 4).toString() === "wOF2", file + " is missing or not a woff2 file");
  }
  ok(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="fonts\/nunito-var-latin\.woff2">/.test(head), "no preload link for the Nunito file");
  for (const f of ["OFL-Nunito.txt", "OFL-AlfaSlabOne.txt"]) ok(/SIL OPEN FONT LICENSE/i.test(await read(path.join(FISH, "fonts", f)).catch(() => "")), "fonts/" + f + " is missing or is no OFL text");
  const map = /<script type="importmap">([\s\S]*?)<\/script>/.exec(indexSrc);
  ok(map && JSON.stringify(JSON.parse(map[1])) === '{"imports":{"three":"./lib/three.module.min.js"}}', "the import map is " + (map && map[1]));
  const three = await readFile(path.join(FISH, "lib/three.module.min.js"));
  ok(sha256(three) === "08fd7545d13d2c7fb65ab691530a802dafefd638596501854f267d0fb13c39e7", "lib/three.module.min.js is not three.js r170 (sha256 " + sha256(three) + ")");
  ok(/^\/\*\*\s*\*\s*@license[\s\S]{0,120}SPDX-License-Identifier: MIT/.test(three.slice(0, 300).toString()) && three.slice(0, 600).toString().includes('const t="170"'), "lib/three.module.min.js has no r170 header");
  ok(/Permission is hereby granted, free of charge/.test(await read(path.join(FISH, "lib/LICENSE")).catch(() => "")), "lib/LICENSE is missing or is no MIT text");
});

// Nothing in public/fish may load from another origin. The og: tags are page metadata: nothing loads them.
const ALLOW = [
  { file: "index.html", re: /<meta property="og:(url|image)" content="https:\/\/warden-alpha-wheat\.vercel\.app\//, why: "page metadata for link previews; no request is made for it" },
];
await test("nothing loads from another origin", async (ok) => {
  const files = [path.join(FISH, "index.html"), path.join(FISH, "privacy.html"), path.join(FISH, "style.css"), path.join(FISH, "guide.css"), path.join(FISH, "sw.js"), path.join(FISH, "manifest.webmanifest"), ...(await walk(path.join(FISH, "js")))];
  let allowed = 0;
  for (const f of files) {
    const rel = path.relative(FISH, f).split(path.sep).join("/");
    (await read(f)).split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/https?:\/\/[^\s"'`)<>]+|(?:src|href)=["']\/\/|url\(\s*["']?\/\/|@import\s+["']?\/\/|\bfrom\s+["']\/\//g)) {
        if (ALLOW.some((a) => a.file === rel && a.re.test(line))) { allowed++; continue; }
        ok(false, rel + ":" + (i + 1) + " names another origin: " + m[0].slice(0, 80));
      }
    });
  }
  ok(!/googleapis|gstatic|jsdelivr|unpkg|cdnjs/.test(indexSrc), "index.html still names a CDN");
  ok(allowed === 2, allowed + " metadata lines are allowed, want 2 (og:url, og:image)");
  // the host sits in one place per file type: the og: tags of index.html
  ok((indexSrc.match(new RegExp(HOST.replace(/\./g, "\\."), "g")) || []).length === 2, "index.html names the host more than in og:url and og:image");
});

/* ---------------- the service worker and its list of files ---------------- */
await test("sw.js is a classic worker with the right names", async (ok) => {
  const w = stamp.worker;
  ok(w.PREFIX === "reelitin-", "PREFIX is " + w.PREFIX);
  ok(/^\d+\.\d+\.\d+\+[0-9a-f]{10}$/.test(w.VERSION), "VERSION is " + w.VERSION + ", want <app version>+<10 hex>");
  ok(!/\bimportScripts\s*\(|^\s*import\s/m.test(w.src), "sw.js must stay a classic worker (no import, no importScripts)");
  ok(!/skipWaiting/.test(w.src.replace(/^\s*\/\/.*$/gm, "")), "sw.js calls skipWaiting: a new version must wait for the next launch");
  ok(/const CACHE = PREFIX \+ VERSION;/.test(w.src), "the cache name is not PREFIX + VERSION");
  ok(/k\.startsWith\(PREFIX\) && k !== CACHE/.test(w.src), "activate must delete only caches that start with PREFIX and are not current");
  ok(/res\.status === 200 && res\.type === "basic" && !res\.redirected/.test(w.src), "sw.js must cache only a 200, basic, not redirected answer");
  ok(/range/i.test(w.src) && /status: 206/.test(w.src), "sw.js does not answer Range requests with a 206");
  ok(/if \(req\.method !== "GET"/.test(w.src) && /url\.origin !== self\.location\.origin\) return/.test(w.src), "sw.js must leave other origins and other methods alone");
  ok(/ignoreSearch: nav/.test(w.src), "navigations are not matched without their query");
  ok(/if \(!old\.length\) await self\.clients\.claim\(\)/.test(w.src), "clients.claim must run on the first install only");
  ok(/const fresh = !\(await caches\.has\(CACHE\)\);/.test(w.src) && /if \(fresh\) await caches\.delete\(CACHE\)/.test(w.src), "a failed install must delete only a cache that it made (a changed sw.js with the same VERSION would delete the cache that is in use)");
});
await test("the cached files equal the files on disk", async (ok) => {
  const w = stamp.worker, req = w.required, opt = w.optional, all = [...req, ...opt];
  ok(new Set(all).size === all.length, "the list has duplicates");
  for (const p of all) ok(await exists(w.diskPath(p)), p + " is listed in sw.js but missing on disk");
  ok(stamp.missing.length === 0, "the stamp cannot cover " + stamp.missing.join(", "));
  // everything the page can load from these folders must be cached, or the game cannot start offline
  for (const sub of ["js", "lib", "fonts", "icons"]) for (const f of await walk(path.join(FISH, sub))) ok(req.includes(site(f)), site(f) + " is on disk but not in the required list of sw.js");
  for (const p of ["/fish/index.html", "/fish/style.css", "/fish/guide.css", "/fish/manifest.webmanifest", "/fish/privacy.html", "/fish/js/main.js", "/fish/lib/three.module.min.js", "/arcade/quiet.js"]) ok(req.includes(p), p + " is not in the required list");
  for (const ic of manifest.icons) ok(req.includes(new URL(ic.src, MURL).pathname), ic.src + " is not in the required list");
  // the art and the clips that the code names
  const srcFiles = [path.join(FISH, "index.html"), path.join(FISH, "style.css"), path.join(FISH, "guide.css"), ...(await walk(path.join(FISH, "js")))];
  const art = new Set(), clips = new Set();
  for (const f of srcFiles) for (const m of (await read(f)).matchAll(/\b(art|clips)\/([A-Za-z0-9_.-]+\.(?:webp|glb|mp4|png|jpg))/g)) (m[1] === "art" ? art : clips).add("/fish/" + m[1] + "/" + m[2]);
  // guide.js builds the name of its clip from the mode ("motion" or "touch")
  if (/clips\/guide-\$\{mode\}\.mp4/.test(await read(path.join(FISH, "js/guide.js")))) for (const m of ["motion", "touch"]) clips.add("/fish/clips/guide-" + m + ".mp4");
  ok(art.size >= 5 && clips.size >= 4, "found only " + art.size + " art files and " + clips.size + " clips in the code");
  for (const p of art) ok(req.includes(p), p + " is loaded by the code but not in the required list");
  for (const p of clips) ok(opt.includes(p), p + " is loaded by the code but not in the best-effort list");
  for (const p of opt) ok(p.startsWith("/fish/clips/"), p + " in the best-effort list is not a clip");
  // the idle art stays out
  for (const p of ["/fish/art/ghibli-lake.webp", "/fish/art/painted-water.webp", "/fish/art/README.md"]) ok(!all.includes(p), p + " is not used by the game and must not be cached");
  // the sw is not in its own list; its registration is in index.html, after the title shows, and ?nosw skips it
  ok(!all.includes("/fish/sw.js"), "sw.js lists itself");
  ok(/serviceWorker\.register\("sw\.js", \{ scope: "\.\/" \}\)/.test(indexSrc) && /nosw/.test(indexSrc) && /attributeFilter: \["hidden"\]/.test(indexSrc), "index.html does not register sw.js after the title shows, or has no ?nosw switch");
  ok(indexSrc.indexOf("serviceWorker.register") > indexSrc.indexOf('src="/arcade/quiet.js"'), "the registration comes before quiet.js");
});
await test("VERSION follows the cached files", async (ok) => {
  ok(stamp.current === stamp.want, "sw.js VERSION is " + stamp.current + " but the cached files give " + stamp.want + ": run node play/fish/stamp-sw.mjs");
});

/* ---------------- the privacy page, the workflow ---------------- */
let contactPlaceholder = false;
await test("privacy.html", async (ok) => {
  const html = await read(path.join(FISH, "privacy.html"));
  const text = html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");
  ok(/<h1>[^<]*privacy[^<]*<\/h1>/i.test(html), "no privacy heading");
  ok(text.split(/\s+/).filter(Boolean).length > 250, "fewer than 250 words");
  for (const w of ["Vercel", "IP address", "user agent", "browser storage", "Reset progress", "motion sensors", "no accounts", "no ads", "analytics", "buzz", "screen on", "microphone", "camera", "location", "site data", "under 13", "never leaves", "sends them to nobody"]) ok(text.toLowerCase().includes(w.toLowerCase()), "does not mention \"" + w + "\"");
  ok(!/—/.test(html), "has an em dash (STE)");
  ok(!/href="\/(?:[#?"]|$)|arcade/i.test(html.replace(/<style[\s\S]*?<\/style>/g, "")), "links to the arcade");
  ok(!/https?:\/\//.test(html), "names another origin");
  contactPlaceholder = html.includes("OWNER_CONTACT_EMAIL");
  ok(contactPlaceholder || /mailto:[^"@\s]+@[^"@\s]+\.[a-z]{2,}/i.test(html), "no contact line (an email address, or OWNER_CONTACT_EMAIL for the owner to replace)");
  for (const f of ["index.html", "privacy.html", "manifest.webmanifest", "style.css", "guide.css", "sw.js"]) ok(!/—/.test(await read(path.join(FISH, f))), f + " has an em dash");
  for (const f of await walk(path.join(FISH, "js"))) ok(!/—/.test(await read(f)), site(f) + " has an em dash");
  ok(/<a href="privacy\.html">Privacy<\/a>/.test(indexSrc), "the title has no link to privacy.html");
  ok((indexSrc.match(/privacy\.html/g) || []).length === 1, "privacy.html is linked from more than the title (a link in a menu loses a fight)");
});
await test("fish-app.yml", async (ok) => {
  const yml = await read(path.join(ROOT, ".github/workflows/fish-app.yml")).catch(() => "");
  ok(yml.includes("node qa/fish/pwa.mjs --static"), "the workflow does not run node qa/fish/pwa.mjs --static");
  for (const p of ["public/fish/**", "play/fish/**", "qa/fish/pwa.mjs"]) ok(yml.includes(p), "the workflow does not watch " + p);
  ok(/pull_request:/.test(yml) && /push:/.test(yml) && /branches: \[main\]/.test(yml), "the workflow must run on pull_request and on push to main");
  ok(/ubuntu-latest/.test(yml) && /node-version: '?22'?/.test(yml), "the workflow must use ubuntu-latest and Node 22");
  ok(!/playwright|npm ci/.test(yml), "the static check must need no browser and no install");
});
if (contactPlaceholder) console.log("WARNING: public/fish/privacy.html still has OWNER_CONTACT_EMAIL. The owner must put in a real email address before the first upload.");

/* ================= browser part ================= */
if (STATIC_ONLY) {
  if (fails) { console.log("FAIL: pwa --static (" + fails + " failed)"); process.exit(1); }
  pass("pwa --static");
  process.exit(0);
}

const { chromium } = createRequire(import.meta.url)("playwright");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".mp4": "video/mp4", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".css": "text/css", ".ico": "image/x-icon", ".md": "text/plain", ".txt": "text/plain" };
// a static server with Range support. override: site path to a Buffer, so a test can serve a changed file. fail: site paths that answer 503.
// log: every request.
const override = new Map(), fail = new Set(), log = [];
const sockets = new Set();
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  log.push(req.method + " " + p + (req.headers.range ? " " + req.headers.range : ""));
  let file = path.join(PUB, p.endsWith("/") ? p + "index.html" : p);
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  if (fail.has(p)) { res.writeHead(503); return res.end("down"); }
  try {
    let body = override.get(p.endsWith("/") ? p + "index.html" : p);
    if (!body) body = await readFile(file);
    const head = { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "public, max-age=0, must-revalidate", "accept-ranges": "bytes" };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (m && (m[1] || m[2])) {
      const start = m[1] === "" ? Math.max(0, body.length - Number(m[2])) : Number(m[1]), end = m[1] === "" || m[2] === "" ? body.length - 1 : Math.min(Number(m[2]), body.length - 1);
      if (start >= body.length) { res.writeHead(416, { "content-range": "bytes */" + body.length }); return res.end(); }
      res.writeHead(206, { ...head, "content-range": "bytes " + start + "-" + end + "/" + body.length, "content-length": end - start + 1 });
      return res.end(req.method === "HEAD" ? undefined : body.subarray(start, end + 1));
    }
    res.writeHead(200, { ...head, "content-length": body.length });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (e) { res.writeHead(404); res.end("not found"); }
});
server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
const listen = (port = 0) => new Promise((r) => server.listen(port, "127.0.0.1", r));
await listen();
const PORT = server.address().port, BASE = "http://127.0.0.1:" + PORT;
const stopServer = () => new Promise((r) => { server.close(r); for (const s of sockets) s.destroy(); });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const contexts = [];
const newContext = async (opts = {}) => { const c = await browser.newContext({ ...PHONE, serviceWorkers: "block", ...opts }); contexts.push(c); return c; };
// a page with its errors collected. wait: "title" (the game is up), "dom" (the head scripts ran), or null
async function openPage(ctx, url, { wait = "title", init = null } = {}) {
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  page.setDefaultNavigationTimeout(180000);
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_ABORTED/.test(m.text())) page.errors.push("console: " + m.text()); });
  if (init) await page.addInitScript(init);
  await page.goto(BASE + url, { waitUntil: wait === "dom" ? "domcontentloaded" : "load" });
  if (wait === "title") await page.waitForSelector("#title:not([hidden])");
  return page;
}
const until = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 50 });
const tap = async (page, sel) => { await sleep(380); await page.click(sel); };  // the double-tap guard ignores a click in the first 300 ms of a screen
const vis = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0; }, sel);
const shown = (page) => page.evaluate(() => [...document.querySelectorAll(".screen")].filter((s) => !s.hidden).map((s) => s.id));
const toastText = (page) => page.evaluate(() => { const t = document.querySelector("#toast"); return t.classList.contains("on") ? t.textContent : ""; });
// to the first cast screen with touch
async function playTouch(page, mode = "free") {
  await tap(page, mode === "free" ? "#freeBtn" : "#derbyBtn");
  // the first time the game asks "motion or touch"; after that it remembers
  await until(page, () => !document.querySelector("#setup").hidden || FISH.G.phase === "cast");
  if (await vis(page, "#setup")) await tap(page, "#useTouch");
  await until(page, () => FISH.G.phase === "cast");
}

try {
  /* ---------------- app mode on and off ---------------- */
  const PLAIN_KICK = "GET PLUNGER'D · LOON LAKE";
  await test("plain page: arcade controls show, the switcher loads, the kicker is unchanged", async (ok) => {
    const ctx = await newContext();
    const page = await openPage(ctx, "/fish/?nosw");
    ok(await page.evaluate(() => !document.documentElement.dataset.app), "data-app is set on the plain page");
    for (const sel of ["#title .row2.arcade-only", '#title a[href="/"]', "#title [data-switch]"]) ok(await vis(page, sel), sel + " is hidden on the plain page");
    ok((await page.textContent("#tkick")) === PLAIN_KICK, "kicker is " + (await page.textContent("#tkick")));
    await until(page, () => !!window.GameSwitch, null, 20000).catch(() => {});
    ok(await page.evaluate(() => !!window.GameSwitch), "switch.js did not load on the plain page");
    ok(await page.evaluate(() => sessionStorage.getItem("fish.app") === null), "the plain page set the app flag");
    ok(page.errors.length === 0, "page errors: " + page.errors.join(" | "));
    await ctx.close();
  });
  await test("?app=1: no arcade control, no switcher, the place name alone", async (ok) => {
    const ctx = await newContext();
    log.length = 0;
    const page = await openPage(ctx, "/fish/?app=1&nosw");
    ok((await page.evaluate(() => document.documentElement.dataset.app)) === "1", "data-app is not 1");
    const r = await page.evaluate(() => {
      // show every control the game can hide, then see what the page still shows
      for (const b of document.querySelectorAll("[data-fullscreen]")) b.hidden = false;
      const marked = [...document.querySelectorAll(".arcade-only")];
      return { n: marked.length, shown: marked.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.outerHTML.slice(0, 60)), links: [...document.querySelectorAll('a[href="/"], [data-switch], [data-fullscreen]')].filter((e) => e.getClientRects().length > 0).length };
    });
    ok(r.n === 4, r.n + " arcade-only elements, want 4 (the title row, the pause Switch game, two Fullscreen buttons)");
    ok(r.shown.length === 0, "arcade-only elements still show: " + r.shown.join(", "));
    ok(r.links === 0, r.links + " arcade controls are still on screen");
    ok((await page.textContent("#tkick")) === "LOON LAKE", "kicker is " + (await page.textContent("#tkick")));
    ok(await page.evaluate(() => typeof window.GameSwitch === "undefined"), "switch.js loaded in app mode");
    ok(!log.some((l) => /arcade\/switch\.js/.test(l)), "the page asked for /arcade/switch.js in app mode");
    ok(await page.evaluate(() => sessionStorage.getItem("fish.app") === "1" && !Object.keys(localStorage).some((k) => /app/i.test(k))), "the flag must be in sessionStorage and never in localStorage");
    // the pause menu and the settings, too
    await playTouch(page);
    await page.evaluate(() => document.querySelector("#pauseBtn").click());
    await until(page, () => !document.querySelector("#pause").hidden);
    ok(!(await vis(page, "#pause [data-switch]")) && !(await vis(page, "#pause [data-fullscreen]")), "the pause menu shows Switch game or Fullscreen in app mode");
    ok(page.errors.length === 0, "page errors: " + page.errors.join(" | "));
    await ctx.close();
  });
  await test("how the app is found: source, app=0, a sticky session, display mode, the Android referrer", async (ok) => {
    const ctx = await newContext();
    const on = (page) => page.evaluate(() => document.documentElement.dataset.app === "1");
    for (const [url, want] of [["/fish/?source=play", true], ["/fish/?source=pwa", true], ["/fish/?source=twa", false], ["/fish/?source=play&app=0", false], ["/fish/?app=1&app=0", true], ["/fish/?app=0", false], ["/fish/", false]]) {
      const page = await openPage(ctx, url + (url.includes("?") ? "&" : "?") + "nosw", { wait: "dom" });
      ok((await on(page)) === want, url + ": app mode is " + !want + ", want " + want);
      await page.close();
    }
    // one tab: ?app=1 sticks for the session, ?app=0 ends it
    const page = await openPage(ctx, "/fish/?app=1&nosw", { wait: "dom" });
    await page.goto(BASE + "/fish/?nosw", { waitUntil: "domcontentloaded" });
    ok(await on(page), "the next load in the same tab (no query) lost app mode");
    await page.goto(BASE + "/fish/?app=0&nosw", { waitUntil: "domcontentloaded" });
    ok(!(await on(page)), "?app=0 did not turn app mode off");
    await page.goto(BASE + "/fish/?nosw", { waitUntil: "domcontentloaded" });
    ok(!(await on(page)), "app mode came back after ?app=0");
    await page.close();
    // a new tab has no flag
    const tab2 = await openPage(ctx, "/fish/?nosw", { wait: "dom" });
    ok(!(await on(tab2)), "a new tab started in app mode");
    await tab2.close();
    // display mode: the window is an app window
    const dm = await openPage(ctx, "/fish/?nosw", { wait: "dom", init: () => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode: (standalone|fullscreen|minimal-ui)/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); } });
    ok(await on(dm), "a standalone display mode did not turn app mode on");
    await dm.close();
    const dm0 = await openPage(ctx, "/fish/?nosw&app=0", { wait: "dom", init: () => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q)); } });
    ok(!(await on(dm0)), "?app=0 did not win over a standalone display mode");
    await dm0.close();
    // opened from Android
    const ref = await openPage(ctx, "/fish/?nosw", { wait: "dom", init: () => Object.defineProperty(document, "referrer", { get: () => "android-app://com.cottagearcade.reelitin" }) });
    ok(await on(ref), "an android-app:// referrer did not turn app mode on");
    await ref.close();
    await ctx.close();
  });
  await test("app words: sensors denied, buzz, rotation, WebGL failure", async (ok) => {
    const PLAIN = {
      denied: "The motion sensors are off for this page. On an iPhone, close Safari fully (swipe it away), then open this page again and tap Allow. On Android, allow Motion sensors in the site settings. You can play with touch now.",
      buzz: "This browser cannot buzz.", turned: "The screen turned. Turn on the rotation lock.",
      gl: "This browser cannot draw the lake (WebGL is off).",
    };
    for (const app of [false, true]) {
      const label = app ? "app mode" : "plain page";
      const ctx = await newContext();
      const page = await openPage(ctx, "/fish/?nosw" + (app ? "&app=1" : ""));
      // 1. the sensors are off
      await page.evaluate(() => { FISH.Motion.request = async () => "denied"; });
      await tap(page, "#derbyBtn");
      await page.waitForSelector("#setup:not([hidden])");
      await tap(page, "#useMotion");
      await until(page, () => !document.querySelector("#setupNote").hidden);
      const denied = await page.textContent("#setupNote");
      if (app) {
        ok(/touch and hold the app icon/i.test(denied) && /App info/.test(denied) && /Manage space/.test(denied) && /allow Motion sensors/.test(denied) && !/iPhone|Safari|browser|this page/i.test(denied), "app text for denied sensors is: " + denied);
      } else ok(denied === PLAIN.denied, "plain text for denied sensors changed: " + denied);
      await tap(page, "#useTouch");
      await until(page, () => FISH.G.phase === "cast");
      // 2. the buzz note
      await page.evaluate(() => FISH.Haptics._forcePlatform("none"));
      await page.evaluate(() => document.querySelector("#pauseBtn").click());
      await until(page, () => !document.querySelector("#pause").hidden);
      await tap(page, "#pSet");
      await until(page, () => !document.querySelector("#settings").hidden);
      const buzz = await page.textContent("#hapticNote");
      ok(buzz === (app ? "This phone cannot buzz." : PLAIN.buzz), label + ": buzz note is " + buzz);
      await page.evaluate(() => document.querySelector("#settings [data-close]").click());
      await page.evaluate(() => document.querySelector("#resumeBtn").click());
      await until(page, () => !FISH.G.paused);
      // 3. the line slips because the touch was cut off
      await page.evaluate(() => { FISH.pinLine({ id: 1, x: 100, y: 100, t: performance.now() }); FISH.unpinLine({ id: 1, cancel: true }); });
      const turned = await toastText(page);
      ok(turned === (app ? "The touch was cut off. Try the cast again." : PLAIN.turned), label + ": the cut-off touch says: " + turned);
      ok(page.errors.length === 0, label + ": page errors: " + page.errors.join(" | "));
      await ctx.close();
      // 4. the lake cannot be drawn
      const ctx2 = await newContext();
      const gl = await openPage(ctx2, "/fish/?nosw" + (app ? "&app=1" : ""), { wait: null, init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); }; } });
      await gl.waitForFunction(() => /cannot draw the lake/.test(document.body.innerText), null, { timeout: 60000 });
      const text = await gl.evaluate(() => document.body.innerText);
      if (app) {
        ok(text.includes("This phone cannot draw the lake.") && !/WebGL|browser/.test(text), "app text for WebGL failure is: " + text.trim());
        ok(await vis(gl, "#retryBtn"), "no Try again button");
        const nav = gl.waitForNavigation({ timeout: 30000 }).then(() => true, () => false);
        await gl.click("#retryBtn");
        ok(await nav, "Try again did not load the page again");
      } else {
        ok(text.includes(PLAIN.gl), "plain text for WebGL failure changed: " + text.trim());
        ok(!(await gl.$("#retryBtn")), "the plain page has a retry button");
      }
      await ctx2.close();
    }
  });

  /* ---------------- the Back button ---------------- */
  await test("Back button state machine (app mode)", async (ok) => {
    const ctx = await newContext();
    const page = await openPage(ctx, "/fish/?app=1&nosw&open", { init: () => { window.__persist = 0; if (navigator.storage) { const p = navigator.storage.persist.bind(navigator.storage); navigator.storage.persist = () => { window.__persist++; return p(); }; } } });
    const hist = () => page.evaluate(() => ({ n: history.length, fish: !!(history.state && history.state.fish) }));
    const pop = () => page.evaluate(() => dispatchEvent(new PopStateEvent("popstate", { state: null })));
    const stage = (patch) => page.evaluate((patch) => {
      const G = FISH.G;
      if (!G.sim || !G.sim.fake) {
        G.lastEvent = {}; G.walk = false; G.thrownBy = "";
        G.sim = { fake: true, events: [], step() {}, state: { phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.3, slip: 0, dragN: 18, breakN: 45, lineOut: 20, slack: false, bend: 0.3, fish: { id: "walleye", kg: 2, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move: "swim", jump: 0, near: 0.5, known: true } } };
        G.bail = "closed";
        FISH.enterReel();
      }
      Object.assign(G.sim.state, patch);
    }, patch);
    const h0 = await hist();
    // 1. before the first tap there is no entry to use up
    await pop();
    ok((await toastText(page)) === "" && (await hist()).n === h0.n && (await vis(page, "#title")), "a Back before any tap changed something");
    ok((await page.evaluate(() => window.__persist)) === 0, "storage.persist() ran before the first tap");
    // 2. the first tap puts one entry in, and asks to keep the storage, once
    await page.touchscreen.tap(195, 60);
    let h = await hist();
    ok(h.n === h0.n + 1 && h.fish, "the first tap did not push one history entry (length " + h0.n + " -> " + h.n + ")");
    await page.touchscreen.tap(195, 70);
    ok((await hist()).n === h0.n + 1, "a second tap pushed another entry");
    ok((await page.evaluate(() => window.__persist)) === 1, "storage.persist() ran " + (await page.evaluate(() => window.__persist)) + " times, want 1");
    // 3. on the title: the first Back warns and leaves no entry, so the second Back reaches the system and closes the app
    await pop();
    ok((await toastText(page)) === "Press Back again to leave", "title: the first Back says: " + (await toastText(page)));
    ok((await hist()).n === h0.n + 1, "title: the first Back put an entry back, so a second Back would not close the app");
    await pop();
    ok((await hist()).n === h0.n + 1, "title: a Back with no entry left did something");
    // the entry returns 2.4 s after the warning; a busy page (SwiftShader) can run its timer late, so poll instead of a fixed sleep
    await page.waitForFunction((n) => history.length === n, h0.n + 2, { timeout: 9000, polling: 100 }).catch(() => {});
    ok((await hist()).n === h0.n + 2, "title: the entry did not come back after the warning");
    await pop();
    ok((await toastText(page)) === "Press Back again to leave" && (await hist()).n === h0.n + 2, "title: a late Back did not warn again");
    await page.touchscreen.tap(195, 60);
    h = await hist();
    ok(h.n === h0.n + 3, "title: a tap after the warning did not put the entry back");
    // 4. a card over the title closes; the entry comes back
    for (const [btn, id] of [["#helpBtn", "help"], ["#journalBtn", "journal"], ["#placesBtn", "places"], ["#setBtn", "settings"]]) {
      await tap(page, btn);
      await until(page, (id) => !document.querySelector("#" + id).hidden, id);
      const n = (await hist()).n;
      await pop();
      ok((await shown(page)).join() === "title" && (await hist()).n === n + 1, "Back on " + id + " did not close it and put the entry back: " + (await shown(page)).join());
    }
    await tap(page, "#setBtn");
    await tap(page, "#privacyBtn");
    await until(page, () => !document.querySelector("#privacy").hidden);
    await pop();
    ok((await shown(page)).join() === "settings", "Back on the privacy card did not go to Settings: " + (await shown(page)).join());
    await pop();
    ok((await shown(page)).join() === "title", "Back on Settings did not go to the title");
    // the motion setup card
    await tap(page, "#freeBtn");
    await page.waitForSelector("#setup:not([hidden])");
    await pop();
    ok((await shown(page)).join() === "title" && (await page.evaluate(() => FISH.G.phase)) === "title", "Back on the motion setup did not go to the title: " + (await shown(page)).join());
    // 5. in play: pause, resume, and a card over the pause menu
    await playTouch(page);
    let n = (await hist()).n;
    await pop();
    ok(await page.evaluate(() => FISH.G.paused && !document.querySelector("#pause").hidden), "a cast: Back did not pause");
    ok((await hist()).n === n + 1, "a cast: the entry did not come back");
    await tap(page, "#pSet");
    await pop();
    ok((await shown(page)).join() === "pause" && (await page.evaluate(() => FISH.G.paused)), "Back on Settings over the pause menu did not return to the pause menu: " + (await shown(page)).join());
    await pop();
    ok(await page.evaluate(() => !FISH.G.paused && document.querySelector("#pause").hidden), "Back on the pause menu did not resume");
    // 6. a fight: pause keeps it, resume goes on with the same fish
    await stage({});
    await until(page, () => FISH.G.phase === "reel" && !FISH.G.paused);
    n = (await hist()).n;
    await pop();
    ok(await page.evaluate(() => FISH.G.paused && FISH.G.phase === "reel" && FISH.G.sim && FISH.G.sim.fake), "a fight: Back did not pause it");
    await pop();
    ok(await page.evaluate(() => !FISH.G.paused && FISH.G.phase === "reel" && FISH.G.sim && FISH.G.sim.fake && FISH.G.sim.state.fish.id === "walleye"), "a fight: Back did not resume the same fight");
    ok((await hist()).n === n + 2, "a fight: the entry did not come back each time");
    // 7. the catch card: Back is ignored
    await stage({ phase: "caught", catch: { id: "perch", kg: 0.35, cm: 22 }, fish: null });
    await until(page, () => !document.querySelector("#catch").hidden);
    n = (await hist()).n;
    await pop();
    ok(await page.evaluate(() => !document.querySelector("#catch").hidden && !FISH.G.paused && FISH.G.phase === "catch"), "the catch card: Back was not ignored");
    ok((await hist()).n === n + 1, "the catch card: the entry did not come back");
    // 8. the results go to the title
    await tap(page, "#catchGo");
    await until(page, () => FISH.G.phase === "cast");
    await page.evaluate(() => { FISH.toTitle(); });
    await playTouch(page, "derby");
    await page.evaluate(() => { FISH.G.castsLeft = 0; });
    await stage({ phase: "home" });
    await until(page, () => FISH.G.phase === "results", null, 30000);
    await pop();
    ok((await shown(page)).join() === "title" && (await page.evaluate(() => FISH.G.phase)) === "title", "the results: Back did not go to the title: " + (await shown(page)).join());
    // 9. a trip to another place: Back is ignored on the travel card and on the arrival card
    await tap(page, "#placesBtn");
    await until(page, () => !!document.querySelector('#plist [data-place="stumps"] button:not([disabled])'));
    // the card shows for 1.2 s, but the page is busy with the new place: a poll would miss it. So the Back press comes from inside the page,
    // the moment the travel card shows
    await page.evaluate(() => {
      window.__trip = null;
      const t = document.querySelector("#travel");
      new MutationObserver(() => {
        if (t.hidden || window.__trip) return;
        const before = history.length;
        dispatchEvent(new PopStateEvent("popstate", { state: null }));
        window.__trip = { screen: document.body.dataset.screen, still: !t.hidden, pushed: history.length - before };
      }).observe(t, { attributes: true, attributeFilter: ["hidden"] });
    });
    await tap(page, '#plist [data-place="stumps"] button');
    await until(page, () => !!window.__trip, null, 90000);
    const trip = await page.evaluate(() => window.__trip);
    ok(trip.screen === "travel" && trip.still && trip.pushed === 1, "the trip: Back was not ignored: " + JSON.stringify(trip));
    await until(page, () => !document.querySelector("#arrive").hidden, null, 90000);
    await pop();
    ok((await shown(page)).join() === "arrive", "the arrival card: Back was not ignored: " + (await shown(page)).join());
    // 10. one real Back, from a real tap: the title warns and the entry is used up
    await tap(page, "#aStart");
    await until(page, () => !document.querySelector("#title").hidden);
    await page.touchscreen.tap(195, 60);
    await sleep(100);
    const before = await hist();
    await page.goBack();
    await until(page, () => document.querySelector("#toast").classList.contains("on"), null, 10000);
    ok((await toastText(page)) === "Press Back again to leave", "a real Back on the title says: " + (await toastText(page)));
    ok(page.url().includes("/fish/") && (await hist()).n === before.n, "a real Back changed the length or the page");
    ok(page.errors.length === 0, "page errors: " + page.errors.join(" | "));
    await ctx.close();
  });
  await test("Back button: the plain page does not touch history, and asks for no storage", async (ok) => {
    const ctx = await newContext();
    const page = await openPage(ctx, "/fish/?nosw", { init: () => { window.__persist = 0; if (navigator.storage) { const p = navigator.storage.persist.bind(navigator.storage); navigator.storage.persist = () => { window.__persist++; return p(); }; } } });
    const n0 = await page.evaluate(() => history.length);
    await page.touchscreen.tap(195, 60);
    await page.evaluate(() => dispatchEvent(new PopStateEvent("popstate", { state: null })));
    ok((await page.evaluate(() => history.length)) === n0, "the plain page pushed a history entry");
    ok((await page.evaluate(() => window.__persist)) === 0, "the plain page asked for persistent storage");
    ok((await toastText(page)) === "", "the plain page answered Back");
    await ctx.close();
  });

  /* ---------------- Reset progress and the privacy card ---------------- */
  await test("Reset progress asks first, then clears the progress and keeps the sound switch", async (ok) => {
    const ctx = await newContext();
    const page = await openPage(ctx, "/fish/?nosw", { init: () => {
      const rm = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (k) { if (this === localStorage) { const a = JSON.parse(sessionStorage.getItem("qa-removed") || "[]"); a.push(k); sessionStorage.setItem("qa-removed", JSON.stringify(a)); } return rm.call(this, k); };
      if (!sessionStorage.getItem("qa-seeded")) {
        sessionStorage.setItem("qa-seeded", "1");
        localStorage.setItem("fish.v1", JSON.stringify({ v: 1, casts: 42, caught: 7, longest: 33.3, place: "loon", input: "touch", artStyle: "original" }));
        localStorage.setItem("fish.haptics", "false");
        localStorage.setItem("reel-it-in-guide-v1", "shown");
        localStorage.setItem("arcade.sound", "false");
      }
    } });
    ok((await page.evaluate(() => FISH.save.casts)) === 42, "the seeded save did not load");
    await tap(page, "#setBtn");
    await until(page, () => !document.querySelector("#settings").hidden);
    ok((await vis(page, "#resetBtn")) && !(await vis(page, "#resetAsk")), "Settings: Reset progress is not on its own at first");
    await tap(page, "#resetBtn");   // tap(): the double-tap guard swallows a click in the first 300 ms of a screen
    ok((await vis(page, "#resetAsk")) && !(await vis(page, "#resetBtn")), "Settings: the question did not appear");
    ok(/cannot undo/i.test(await page.textContent("#resetAsk")), "the question does not say that it cannot be undone");
    await page.click("#resetNo");
    ok(!(await vis(page, "#resetAsk")) && (await vis(page, "#resetBtn")), "Keep them did not close the question");
    ok(await page.evaluate(() => ["fish.v1", "fish.haptics", "reel-it-in-guide-v1", "arcade.sound"].every((k) => localStorage.getItem(k) !== null)), "Keep them removed something");
    ok((await page.evaluate(() => JSON.parse(sessionStorage.getItem("qa-removed") || "[]"))).length === 0, "something was removed before the player said yes");
    // Delete: the page loads again, at the title, with a new save
    const reloaded = page.waitForNavigation({ timeout: 60000 });
    await page.click("#resetBtn");
    await page.click("#resetYes");
    await reloaded;
    await page.waitForSelector("#title:not([hidden])");
    const r = await page.evaluate(() => ({ removed: JSON.parse(sessionStorage.getItem("qa-removed") || "[]"), casts: FISH.save.casts, caught: FISH.save.caught, longest: FISH.save.longest, art: FISH.save.artStyle, place: FISH.G.place.id, sound: localStorage.getItem("arcade.sound"), haptics: localStorage.getItem("fish.haptics"), guide: localStorage.getItem("reel-it-in-guide-v1"), saved: JSON.parse(localStorage.getItem("fish.v1") || "null"), screen: document.body.dataset.screen }));
    ok(JSON.stringify([...r.removed].sort()) === JSON.stringify(["fish.haptics", "fish.v1", "reel-it-in-guide-v1"]), "Delete removed " + JSON.stringify(r.removed));
    ok(r.casts === 0 && r.caught === 0 && r.longest === 0 && r.art === "ghibli" && r.place === "loon", "the game started with old progress: " + JSON.stringify({ casts: r.casts, art: r.art }));
    ok(r.sound === "false", "arcade.sound was removed (the whole arcade shares it): " + r.sound);
    ok(r.haptics === null && r.guide === null, "the buzz or the guide switch was kept: " + r.haptics + " " + r.guide);
    ok(!r.saved || r.saved.casts === 0, "the old save was written back");
    ok(r.screen === "title", "the player did not land on the title: " + r.screen);
    ok(page.errors.length === 0, "page errors: " + page.errors.join(" | "));
    await ctx.close();
  });
  await test("the privacy card opens in the game; the full page is linked from the title only", async (ok) => {
    const ctx = await newContext();
    const page = await openPage(ctx, "/fish/?nosw");
    let navs = 0;
    page.on("framenavigated", () => navs++);
    ok(await page.evaluate(() => document.querySelectorAll('a[href*="privacy"]').length === 1 && !!document.querySelector('#title a[href="privacy.html"]')), "the link to privacy.html is not only on the title");
    await playTouch(page);
    await page.evaluate(() => document.querySelector("#pauseBtn").click());
    await until(page, () => !document.querySelector("#pause").hidden);
    await tap(page, "#pSet");
    await tap(page, "#privacyBtn");
    await until(page, () => !document.querySelector("#privacy").hidden);
    const text = await page.textContent("#privacy");
    for (const w of ["no account", "no ads", "no analytics", "stay on this phone", "motion sensors", "Never leaves", "buzz", "screen on", "IP address", "Reset progress", "title screen"]) ok(text.toLowerCase().includes(w.toLowerCase()), "the card does not say \"" + w + "\"");
    ok(!/—/.test(text), "the card has an em dash");
    ok((await page.$$("#privacy a")).length === 0, "the card links away (a fight would be lost)");
    await tap(page, "#privacyDone");
    ok((await shown(page)).join() === "settings", "Done did not return to Settings: " + (await shown(page)).join());
    await tap(page, "#privacyBtn");
    await page.keyboard.press("Escape");
    ok((await shown(page)).join() === "settings", "Escape on the card did not return to Settings: " + (await shown(page)).join());
    await page.evaluate(() => document.querySelector("#settings [data-close]").click());
    ok(await page.evaluate(() => FISH.G.paused && !document.querySelector("#pause").hidden), "after the card and Settings, the game is not on the pause menu");
    await page.evaluate(() => document.querySelector("#resumeBtn").click());
    await until(page, () => !FISH.G.paused && FISH.G.phase === "cast");
    ok(navs === 0, "the page navigated " + navs + " times while the card was open");
    // the full page from the title
    await page.evaluate(() => FISH.toTitle());
    await until(page, () => !document.querySelector("#title").hidden);
    await tap(page, '#title .legal a');
    await page.waitForURL("**/fish/privacy.html");
    ok((await page.textContent("h1")).toLowerCase().includes("privacy"), "privacy.html has no heading");
    ok(page.errors.length === 0, "page errors: " + page.errors.join(" | "));
    await ctx.close();
  });

  /* ---------------- the service worker: control, offline, Range, update ---------------- */
  // ?nosw: the other tests block workers, so this is the one place that can see a registration that should not happen
  await test("?nosw: the page registers no worker and does not ask for sw.js", async (ok) => {
    const ctx = await newContext({ serviceWorkers: "allow" });
    log.length = 0;
    const page = await openPage(ctx, "/fish/?nosw");
    await sleep(2000);
    const regs = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
    ok(regs === 0, regs + " service workers are registered on a ?nosw page");
    ok(!log.some((l) => l === "GET /fish/sw.js"), "a ?nosw page asked for sw.js");
    await ctx.close();
  });
  // 1. one context for control and offline. Another game's cache stays; ours is the only one with the prefix.
  const swctx = await newContext({ serviceWorkers: "allow" });
  const swpage = await openPage(swctx, "/fish/privacy.html", { wait: null });
  await swpage.evaluate(async () => { await (await caches.open("other-game")).put("/x", new Response("x")); });
  let controlled = false;
  await test("sw.js registers after the title shows and takes control on the first visit", async (ok) => {
    log.length = 0;
    await swpage.goto(BASE + "/fish/?source=pwa");
    await swpage.waitForSelector("#title:not([hidden])");
    const state = await swpage.evaluate(() => new Promise((done) => {
      const t = setTimeout(() => done("no control after 120 s"), 120000);
      const check = () => { if (navigator.serviceWorker.controller) { clearTimeout(t); done("controlled"); } };
      navigator.serviceWorker.addEventListener("controllerchange", check);
      check();
    }));
    ok(state === "controlled", state);
    if (state !== "controlled") return;
    controlled = true;
    const r = await swpage.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const keys = await caches.keys();
      const mine = keys.filter((k) => k.startsWith("reelitin-"));
      const cached = mine.length === 1 ? (await (await caches.open(mine[0])).keys()).map((q) => new URL(q.url).pathname) : [];
      return { scope: reg && new URL(reg.scope).pathname, script: reg && reg.active && new URL(reg.active.scriptURL).pathname, keys, mine, cached };
    });
    ok(r.scope === "/fish/", "scope is " + r.scope);
    ok(r.script === "/fish/sw.js", "script is " + r.script);
    ok(r.mine.length === 1 && r.mine[0] === "reelitin-" + stamp.current, "our caches are " + JSON.stringify(r.mine) + ", want [reelitin-" + stamp.current + "]");
    ok(r.keys.includes("other-game"), "activate deleted another page's cache");
    for (const p of stamp.worker.required) ok(r.cached.includes(p), p + " is not in the cache");
    const clips = stamp.worker.optional.filter((p) => !r.cached.includes(p));
    ok(clips.length === 0, "clips missing from the cache: " + clips.join(", "));
    ok(r.cached.length === stamp.paths.length, r.cached.length + " files cached, want " + stamp.paths.length);
    // the registration waited for the title: the request for sw.js came after the game's own files
    const iSw = log.findIndex((l) => l === "GET /fish/sw.js"), iMain = log.findIndex((l) => l === "GET /fish/js/main.js"), iArt = log.findIndex((l) => /GET \/fish\/art\/painted-forest\.webp/.test(l));
    ok(iSw > iMain && iSw > iArt, "sw.js was requested before the game was up (main.js at " + iMain + ", art at " + iArt + ", sw.js at " + iSw + ")");
    // a ?nosw page registers nothing new and the manifest answers
    const mf = await swpage.evaluate(async () => { const r = await fetch("manifest.webmanifest"); return { s: r.status, t: r.headers.get("content-type") }; });
    ok(mf.s === 200, "manifest status " + mf.s);
  });
  await test("offline start: reload, the PWA start URL, privacy.html, an unknown page; then play to the first cast", async (ok) => {
    if (!controlled) return ok(false, "the service worker is not in control, so the game cannot start offline");
    // cut the network two ways: the browser goes offline, and the server stops, so only the cache can answer
    await swctx.setOffline(true);
    await stopServer();
    const failed = [], bad = [], fromSw = new Set();
    // ERR_ABORTED is a page that left while a low-priority request (the manifest) was on its way: not a network failure
    swpage.on("requestfailed", (q) => { if (q.url().startsWith(BASE) && !/ERR_ABORTED/.test((q.failure() || {}).errorText || "")) failed.push(new URL(q.url()).pathname + " " + (q.failure() || {}).errorText); });
    swpage.on("response", (r) => { if (r.url().startsWith(BASE)) { if (r.status() >= 400) bad.push(r.status() + " " + new URL(r.url()).pathname); if (r.fromServiceWorker()) fromSw.add(new URL(r.url()).pathname); } });
    const e0 = swpage.errors.length;
    for (const [url, what] of [["/fish/", "a reload of /fish/"], ["/fish/?source=pwa", "the PWA start URL"], ["/fish/?source=play", "the Play start URL"], ["/fish/privacy.html", "privacy.html"], ["/fish/privacy.html?from=settings", "privacy.html with a query"], ["/fish/index.html?source=pwa", "index.html with a query"], ["/fish/no-such-page.html", "an unknown page (falls back to the game)"]]) {
      const res = url === "/fish/" ? await swpage.reload({ waitUntil: "domcontentloaded" }) : await swpage.goto(BASE + url, { waitUntil: "domcontentloaded" });
      ok(res && res.status() === 200, what + ": status " + (res && res.status()));
      ok(res && res.fromServiceWorker(), what + ": not served by the service worker");
      const title = await swpage.title();
      ok(url.includes("privacy") ? /privacy/i.test(title) : title === "Reel It In", what + ": title is \"" + title + "\"");
      if (url.includes("privacy")) { ok(/Vercel/.test(await swpage.textContent("body")), what + ": the page is not the privacy page"); continue; }
      await swpage.waitForSelector("#title:not([hidden])", { timeout: 120000 });
      ok((await swpage.evaluate(() => document.documentElement.dataset.app)) === "1", what + ": not in app mode");
      if (url.includes("source=play")) {
        // the real start: then play offline to the first cast screen
        await swpage.evaluate(() => document.fonts.ready);
        await tap(swpage, "#helpBtn");
        await swpage.waitForSelector("#help:not([hidden])");
        const fonts = await swpage.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family + " " + f.weight); });
        ok(fonts.some((f) => /Alfa Slab One/.test(f)) && fonts.some((f) => /Nunito/.test(f)), "the fonts did not load offline: " + fonts.join(", "));
        await swpage.keyboard.press("Escape");
        await swpage.waitForFunction(() => document.querySelector("#help").hidden);
        await playTouch(swpage, "derby");
        await sleep(2500);
        ok(await swpage.evaluate(() => FISH.G.phase === "cast" && !!FISH.world && typeof FISH.world.info === "function"), "the game did not reach the first cast screen offline");
        const textures = await swpage.evaluate(() => { try { return JSON.stringify(FISH.world.info()); } catch (e) { return String(e); } });
        info("offline world: " + textures.slice(0, 160));
      }
    }
    // every file the page and the manifest name answers 200 from the cache, one by one (the manifest and the icons are fetched late by the browser)
    const names = ["/fish/manifest.webmanifest", ...manifest.icons.map((i) => i.src), "/fish/icons/favicon.svg", "/fish/icons/favicon-32.png", "/fish/icons/apple-touch-icon.png", "/fish/privacy.html", "/fish/clips/pull-back-demo.mp4", "/fish/clips/pull-back-poster.webp", "/fish/art/film-lake.webp", "/fish/art/ghibli-sky.webp"];
    const probe = await swpage.evaluate((names) => Promise.all(names.map(async (p) => { try { return p + " " + (await fetch(p)).status; } catch (e) { return p + " " + e.message; } })), names);
    ok(probe.every((x) => x.endsWith(" 200")), "offline fetches: " + probe.filter((x) => !x.endsWith(" 200")).join(", "));
    ok(failed.length === 0, "same-origin requests failed offline (not cached?): " + failed.join(", "));
    ok(bad.length === 0, "answers with an error status offline: " + bad.join(", "));
    for (const p of ["/fish/js/main.js", "/fish/lib/three.module.min.js", "/fish/art/cartoon-models.glb", "/fish/art/painted-forest.webp", "/fish/fonts/nunito-var-latin.woff2", "/arcade/quiet.js"]) ok(fromSw.has(p), p + " was not answered by the service worker offline");
    ok(![...fromSw].some((p) => /arcade\/switch\.js/.test(p)), "switch.js was fetched in app mode");
    const net = swpage.errors.slice(e0).filter((m) => /fetch|import|network|ERR_INTERNET|Failed to load|WebGL|texture/i.test(m));
    ok(net.length === 0, "network errors offline: " + net.join(" | "));
    const other = swpage.errors.slice(e0).filter((m) => !net.includes(m));
    if (other.length) info("other page errors while offline (not about caching): " + other.slice(0, 3).join(" | "));
  });
  await test("offline: a video asks for a Range and gets a 206 from the cache", async (ok) => {
    if (!controlled) return ok(false, "the service worker is not in control");
    const file = await readFile(path.join(FISH, "clips/guide-motion.mp4"));
    const ask = (range) => swpage.evaluate(async (range) => {
      const r = await fetch("/fish/clips/guide-motion.mp4", range ? { headers: { Range: range } } : {});
      const buf = new Uint8Array(await r.arrayBuffer());
      let h = 0; for (const b of buf) h = (h * 31 + b) >>> 0;
      return { s: r.status, cr: r.headers.get("content-range"), cl: r.headers.get("content-length"), ct: r.headers.get("content-type"), ar: r.headers.get("accept-ranges"), len: buf.length, h };
    }, range);
    const hash = (b) => { let h = 0; for (const x of b) h = (h * 31 + x) >>> 0; return h; };
    const size = file.length;
    let r = await ask("bytes=0-99");
    ok(r.s === 206 && r.cr === "bytes 0-99/" + size && r.len === 100 && r.cl === "100" && r.ct === "video/mp4" && r.ar === "bytes", "bytes=0-99 gave " + JSON.stringify({ ...r, h: undefined }));
    ok(r.h === hash(file.subarray(0, 100)), "bytes=0-99 gave the wrong bytes");
    r = await ask("bytes=1000-2999");
    ok(r.s === 206 && r.cr === "bytes 1000-2999/" + size && r.len === 2000 && r.h === hash(file.subarray(1000, 3000)), "bytes=1000-2999 gave " + JSON.stringify({ ...r, h: undefined }));
    r = await ask("bytes=0-");
    ok(r.s === 206 && r.cr === "bytes 0-" + (size - 1) + "/" + size && r.len === size && r.h === hash(file), "bytes=0- (the first request of a video) gave " + JSON.stringify({ ...r, h: undefined }));
    r = await ask("bytes=-50");
    ok(r.s === 206 && r.cr === "bytes " + (size - 50) + "-" + (size - 1) + "/" + size && r.len === 50 && r.h === hash(file.subarray(size - 50)), "bytes=-50 gave " + JSON.stringify({ ...r, h: undefined }));
    r = await ask("bytes=" + (size - 10) + "-999999999");
    ok(r.s === 206 && r.len === 10 && r.cr === "bytes " + (size - 10) + "-" + (size - 1) + "/" + size, "an end past the file gave " + JSON.stringify({ ...r, h: undefined }));
    r = await ask("bytes=999999999-");
    ok(r.s === 416 && r.cr === "bytes */" + size, "a start past the file gave " + JSON.stringify({ ...r, h: undefined }));
    r = await ask(null);
    ok(r.s === 200 && r.len === size && r.h === hash(file), "no Range gave " + JSON.stringify({ ...r, h: undefined }));
    // the 206 is never stored: the cache holds the whole file, once
    const n = await swpage.evaluate(async () => { const c = await caches.open((await caches.keys()).find((k) => k.startsWith("reelitin-"))); return (await c.matchAll("/fish/clips/guide-motion.mp4")).map((x) => x.status); });
    ok(n.length === 1 && n[0] === 200, "the cache holds " + JSON.stringify(n) + " for the clip");
  });
  await swctx.close();

  // 2. a new version: it waits, takes over on the next launch, and its cache replaces the old one
  if (!server.listening) await listen(PORT);
  await test("a new VERSION waits for the next launch, then replaces the old cache", async (ok) => {
    override.clear();
    const ctx = await newContext({ serviceWorkers: "allow" });
    let page = await openPage(ctx, "/fish/privacy.html", { wait: null });
    await page.evaluate(async () => { await (await caches.open("other-game")).put("/x", new Response("x")); });
    await page.goto(BASE + "/fish/?source=pwa");
    await page.waitForSelector("#title:not([hidden])");
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120000 });
    const v1 = "reelitin-" + stamp.current;
    ok((await page.evaluate(() => caches.keys())).includes(v1), "the first version's cache is missing");
    // the server now has version 2: a new sw.js and a changed privacy.html
    const sw2 = (await readFile(path.join(FISH, "sw.js"), "utf8")).replace(/const VERSION = "[^"]*";/, 'const VERSION = "1.0.1+aaaaaaaaaa";');
    override.set("/fish/sw.js", Buffer.from(sw2));
    override.set("/fish/privacy.html", Buffer.from((await readFile(path.join(FISH, "privacy.html"), "utf8")).replace("<h1>Reel It In: privacy policy</h1>", "<h1>Reel It In: privacy policy (version two)</h1>")));
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg.update();
      for (let i = 0; i < 200 && !reg.waiting; i++) await new Promise((r) => setTimeout(r, 100));
      return { waiting: !!reg.waiting, activeUrl: reg.active && reg.active.scriptURL, controller: !!navigator.serviceWorker.controller, keys: await caches.keys() };
    });
    ok(state.waiting, "the new worker did not install and wait");
    ok(state.keys.includes(v1) && state.keys.includes("reelitin-1.0.1+aaaaaaaaaa") && state.keys.includes("other-game"), "caches while the new worker waits: " + JSON.stringify(state.keys));
    ok(state.controller, "the page lost its controller during the update");
    // while the page is open, the old worker still answers
    const old = await page.evaluate(async () => (await (await fetch("/fish/privacy.html")).text()).includes("(version two)"));
    ok(!old, "the old worker served version two: a launch would mix old and new files");
    await page.close();
    await sleep(1500); // the waiting worker activates when the last page has gone
    // the next launch: the new worker is active, the old cache is gone, other caches stay
    page = await openPage(ctx, "/fish/privacy.html", { wait: null });
    ok((await page.textContent("h1")).includes("(version two)"), "the next launch did not show version two: " + (await page.textContent("h1")));
    const after = await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); return { keys: await caches.keys(), active: reg.active && reg.active.scriptURL, waiting: !!reg.waiting }; });
    ok(JSON.stringify(after.keys.sort()) === JSON.stringify(["other-game", "reelitin-1.0.1+aaaaaaaaaa"]), "caches after the next launch: " + JSON.stringify(after.keys));
    ok(!after.waiting, "a worker is still waiting");
    override.clear();
    await ctx.close();
  });
  await test("a failed update install keeps the cache that is in use", async (ok) => {
    override.clear(); fail.clear();
    const ctx = await newContext({ serviceWorkers: "allow" });
    const page = await openPage(ctx, "/fish/?source=pwa");
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120000 });
    const v1 = "reelitin-" + stamp.current;
    const size = () => page.evaluate(async (k) => ((await caches.has(k)) ? (await (await caches.open(k)).keys()).length : -1), v1);
    const before = await size();
    ok(before === stamp.paths.length, "the first install cached " + before + " files, want " + stamp.paths.length);
    // sw.js changes but VERSION stays (nothing it caches changed), and the server cannot send one cached file
    override.set("/fish/sw.js", Buffer.from((await readFile(path.join(FISH, "sw.js"), "utf8")) + "\n// changed, same VERSION\n"));
    fail.add("/fish/js/pull.js");
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const done = new Promise((res) => reg.addEventListener("updatefound", () => { const w = reg.installing; w.addEventListener("statechange", () => { if (w.state === "redundant" || w.state === "installed") res(w.state); }); }));
      await reg.update().catch(() => {});
      return Promise.race([done, new Promise((r) => setTimeout(() => r("no install in 30 s"), 30000))]);
    });
    ok(state === "redundant", "the new worker's install ended as " + state + ", want redundant (a file failed)");
    ok((await size()) === before, "the cache in use holds " + (await size()) + " files after the failed install, want " + before);
    const served = await page.evaluate(async () => (await fetch("/fish/js/pull.js")).status);
    ok(served === 200, "the old worker could not serve /fish/js/pull.js after the failed install (status " + served + "): the game would not start offline");
    fail.clear(); override.clear();
    await ctx.close();
  });
} finally {
  await browser.close();
  if (server.listening) await stopServer();
}

if (fails) { console.log("FAIL: pwa (" + fails + " failed)"); process.exit(1); }
pass("pwa");
