#!/usr/bin/env node
// Builds the app's web bundle: apps/fish/www, from the web game in public/fish.
// It copies only the files that the pages load, sets the store build flag, removes the web arcade parts,
// and then runs the bundle check (scripts/check-www.mjs). Never edit www/ by hand: it is made again on each build.
// Usage: node scripts/build-www.mjs [--strict]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHtml, attr, isHttp, STORE_HIDDEN_SELECTOR } from "./lib/scan.mjs";
import { collect, walkFiles } from "./lib/graph.mjs";
import { checkWww, ALWAYS, APP_DIR } from "./check-www.mjs";

const REPO = path.resolve(APP_DIR, "../..");
// FISH_SRC and FISH_WWW are for tests: build from another copy of the game, or into another folder.
const SRC = process.env.FISH_SRC ? path.resolve(process.env.FISH_SRC) : path.join(REPO, "public/fish");
const OUT = process.env.FISH_WWW ? path.resolve(process.env.FISH_WWW) : path.join(APP_DIR, "www");
const APP_PAGES = path.join(APP_DIR, "web");
const THREE_LOCAL = "lib/three.module.min.js";
const THREE_FALLBACK = path.join(REPO, "public/crimson/lib/three.module.min.js");
const SKIP = [/(^|\/)README\.md$/i, /(^|\/)\.DS_Store$/];

const strict = process.argv.includes("--strict") || process.env.WWW_STRICT === "1";
const notes = [];
const warn = (msg) => { notes.push(msg); console.log("warning: " + msg); };

// 1. Pick the files: the pages, js/, lib/ and fonts/, and every file they load.
const srcAll = walkFiles(SRC).filter((f) => !SKIP.some((re) => re.test(f)));
const seeds = ["index.html", ...srcAll.filter((f) => f !== "index.html" && ALWAYS.some((re) => re.test(f)))];
const graph = collect(SRC, seeds);
const picked = [...graph.files].filter((f) => !SKIP.some((re) => re.test(f))).sort();
const left = srcAll.filter((f) => !graph.files.has(f));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of picked) {
  fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true });
  fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
}

// 2. three.js ships with the game. Until public/fish/lib has it, borrow the same r170 file from Crimson.
if (!fs.existsSync(path.join(SRC, THREE_LOCAL))) {
  fs.mkdirSync(path.join(OUT, "lib"), { recursive: true });
  fs.copyFileSync(THREE_FALLBACK, path.join(OUT, THREE_LOCAL));
  warn(`public/fish/${THREE_LOCAL} is missing, so the build copied public/crimson/lib/three.module.min.js (r170). Ship it in public/fish/lib.`);
}
if (!fs.existsSync(path.join(SRC, "fonts"))) warn("public/fish/fonts/ is missing, so the app uses the system fonts.");
if (!fs.existsSync(path.join(SRC, "js/native.js"))) warn("public/fish/js/native.js is missing, so the app has no native bridge (back button, haptics, save mirror).");
if (!fs.existsSync(path.join(SRC, "privacy.html"))) warn("public/fish/privacy.html is missing.");

// 3. Pages that only the app uses (the page Capacitor shows when the Android WebView is too old).
for (const f of walkFiles(APP_PAGES)) fs.copyFileSync(path.join(APP_PAGES, f), path.join(OUT, f));

// 4. Rewrite index.html for the store build.
const indexPath = path.join(OUT, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
const done = [];
// Edits by offset, applied from the end of the file so the offsets stay true.
function rewrite(fn) {
  const { elements } = parseHtml(html);
  const edits = [];
  fn(elements, (start, end, text, why) => { edits.push({ start, end, text }); if (why) done.push(why); });
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) html = html.slice(0, e.start) + e.text + html.slice(e.end);
}
// Removes a whole element and the line break after it.
const cut = (el) => [el.start, html[el.end] === "\n" ? el.end + 1 : el.end];
// A start tag with attributes added or removed.
function startTag(el, { set = {}, drop = [] } = {}) {
  const tagText = html.slice(el.start, el.openEnd);
  const name = /^<([a-zA-Z][\w:-]*)/.exec(tagText)[1];
  const kept = el.attrs.filter((a) => !drop.includes(a.name) && !(a.name in set)).map((a) => tagText.slice(a.start, a.end));
  const added = Object.entries(set).map(([k, v]) => (v === true ? k : `${k}="${v}"`));
  return `<${name}${[...kept, ...added].map((s) => " " + s).join("")}${tagText.endsWith("/>") ? " /" : ""}>`;
}

rewrite((els, edit) => {
  for (const el of els) {
    const href = attr(el, "href"), src = attr(el, "src"), prop = attr(el, "property") || "", name = attr(el, "name") || "";
    if (el.tag === "html") edit(el.start, el.openEnd, startTag(el, { set: { "data-build": "store" } }), 'set data-build="store" on <html>');
    else if (el.tag === "script" && src && src.startsWith("/arcade/")) edit(...cut(el), "", `removed the ${src} script`);
    // a small inline script that adds the arcade switcher on the web only
    else if (el.tag === "script" && !src && el.rawText && /["'`]\/arcade\//.test(el.rawText) && !/^(?:importmap|module)$/i.test(attr(el, "type") || "")) edit(...cut(el), "", "removed the inline script that loads the arcade switcher");
    else if (el.tag === "meta" && (/^og:/i.test(prop) || /^twitter:/i.test(name))) edit(...cut(el), "", "removed the og: and twitter: meta tags");
    else if (el.tag === "meta" && name === "description") {
      const v = attr(el, "content") || "";
      const plain = v.replace(/\s*Free in your browser\.?/i, "");
      if (plain !== v) edit(el.start, el.openEnd, startTag(el, { set: { content: plain } }), 'removed "Free in your browser." from the description');
    } else if (el.tag === "link" && href && href.startsWith("/icons/")) edit(...cut(el), "", "removed the /icons links");
    else if (el.tag === "link" && href && /^(?:https?:)?\/\/fonts\.(?:googleapis|gstatic)\.com/i.test(href)) edit(...cut(el), "", "removed the Google Fonts links");
    else if (el.tag === "script" && (attr(el, "type") || "").toLowerCase() === "importmap" && el.rawText) {
      const map = JSON.parse(el.rawText);
      const imports = map.imports || (map.imports = {});
      const before = JSON.stringify(imports);
      imports.three = "./" + THREE_LOCAL;
      for (const [k, v] of Object.entries(imports)) if (isHttp(v)) { delete imports[k]; done.push(`dropped the import map entry "${k}" (${v})`); }
      if (JSON.stringify(imports) !== before) edit(el.rawStart, el.closeStart, JSON.stringify(map), `the import map sends "three" to ./${THREE_LOCAL}`);
    }
    // The web arcade parts stay in the page, so the game's scripts still find them, but the store build never shows them.
    else if (el.tag === "a" && href === "/") edit(el.start, el.openEnd, startTag(el, { set: { hidden: true, "data-store-hidden": true }, drop: ["href"] }), 'hid the "Back to the arcade" link');
    else if (attr(el, "data-switch") !== null && attr(el, "hidden") === null) edit(el.start, el.openEnd, startTag(el, { set: { hidden: true } }), 'hid the "Switch game" buttons');
  }
});
// A row that holds only arcade parts is hidden as well.
rewrite((els, edit) => {
  for (const el of els) {
    const kids = el.children.filter((c) => c.tag || (c.text && c.text.trim()));
    if (!kids.length || attr(el, "data-store-hidden") !== null || el.tag === "#root") continue;
    if (kids.every((c) => c.tag && (attr(c, "data-switch") !== null || attr(c, "data-store-hidden") !== null)) && el.tag !== "body" && attr(el, "id") !== "game") {
      edit(el.start, el.openEnd, startTag(el, { set: { hidden: true, "data-store-hidden": true } }), "hid the arcade row");
    }
  }
});
// The title kicker names the arcade on the web. The store build shows the place name alone.
rewrite((els, edit) => {
  const k = els.find((e) => attr(e, "id") === "tkick");
  if (!k) return;
  const inner = html.slice(k.openEnd, k.closeStart);
  const plain = inner.replace(/GET\s+PLUNGER(?:'|’|&#39;|&apos;|&rsquo;)D\s*(?:·|&middot;|&#183;|-|\|)\s*/i, "");
  if (plain !== inner) edit(k.openEnd, k.closeStart, plain, "removed GET PLUNGER'D from the title kicker");
});
// Safe areas: Capacitor puts --safe-area-inset-* on the page for Android WebView versions where env() is wrong.
const safeBefore = html;
html = html.replace(/(?<!var\(--safe-area-inset-(?:top|right|bottom|left),\s*)env\(safe-area-inset-(top|right|bottom|left)(\s*,\s*[^()]*(?:\([^()]*\))?[^()]*)?\)/g,
  (m, side) => `var(--safe-area-inset-${side}, ${m})`);
if (html !== safeBefore) done.push("safe areas read Capacitor's --safe-area-inset-* first");
// The store CSS: the arcade parts and the Fullscreen buttons never show in the app.
if (!html.includes('id="store-build"')) {
  html = html.replace("</head>", `<style id="store-build">html[data-build="store"] :is(${STORE_HIDDEN_SELECTOR}) { display: none !important; }</style>\n</head>`);
  done.push("added the store CSS that hides the arcade parts and the Fullscreen buttons");
}
fs.writeFileSync(indexPath, html);

// 5. Report, then check the bundle.
const show = (p) => { const r = path.relative(REPO, p); return r.startsWith("..") ? p : r; };
console.log(`build:www: copied ${picked.length} files from ${show(SRC)} to ${show(OUT)}`);
for (const d of [...new Set(done)]) console.log("  index.html: " + d);
if (left.length) console.log(`  left out ${left.length} files that nothing loads: ${left.join(", ")}`);
const res = checkWww(OUT, { strict });
if (notes.length) console.log(`\n${notes.length} build warning${notes.length === 1 ? "" : "s"} above. They clear when the missing files land in public/fish.`);
process.exit(res.ok ? 0 : 1);
