#!/usr/bin/env node
// Checks the app's web bundle (apps/fish/www) before it goes into the native projects.
// It fails when a file loads another host, holds a web address in its code (a string, an attribute, a style sheet,
// a JSON or SVG file), uses a root path of the web site in a load, a link or a page navigation, names a missing file,
// or shows arcade text in the HTML of the store build. It warns about "ghibli" and about arcade text in a script
// (both errors with --strict or WWW_STRICT=1), and about files that nothing loads. With --release (or WWW_RELEASE=1), for a
// store upload, it is strict and it also fails when privacy.html is missing or a page still holds a placeholder that the
// owner must fill in (an element with data-placeholder, such as the support email).
// The check reads the files. It cannot see a web address that the code builds at run time from parts:
// qa/fish/app-bundle.e2e.mjs blocks and counts every request that leaves the origin.
// Usage: node scripts/check-www.mjs [--strict] [--release] [path/to/www]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHtml, attr, decodeEntities, isHiddenInStore, scanJs, webAddress, JS_TYPES } from "./lib/scan.mjs";
import { collect, walkFiles } from "./lib/graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.resolve(HERE, "..");

// The files that the build always copies, whether or not a page names them.
export const ALWAYS = [/^index\.html$/, /^privacy\.html$/, /^webview-update\.html$/, /^js\//, /^lib\//, /^fonts\//];
// Text that belongs to the web arcade. A player must never see it in the app.
const ARCADE_TEXT = [/GET\s+PLUNGER['’]?D/i, /PLUNGER['’]D/i, /Switch\s+game/i, /Back\s+to\s+the\s+arcade/i];
// Web copy that reads wrong in an app. A warning only: the game's copy table decides this.
const WEB_TEXT = /\b(?:in your browser|this browser|Safari|site settings|this page)\b/i;
const TEXT_FILE = /\.(?:html?|css|m?js|json|txt|md|svg|xml|webmanifest)$/i;
// The files the graph reads (see lib/graph.mjs).
const SCANNED = /\.(?:html?|css|m?js|svg|json)$/i;
// A line with this mark holds arcade text that the code shows on the web only (it checks the store flag first).
const WEB_ONLY = /\bweb[- ]only\b/i;

function fmtBytes(n) {
  return n >= 1048576 ? (n / 1048576).toFixed(2) + " MB" : n >= 1024 ? (n / 1024).toFixed(1) + " KB" : n + " B";
}

// Visible text and labels in one HTML file that match a pattern, outside the markup the store build hides.
function visibleMatches(html, patterns) {
  const { elements, texts } = parseHtml(html);
  const hits = [];
  for (const t of texts) {
    if (isHiddenInStore(t.parent)) continue;
    const s = decodeEntities(t.text).replace(/\s+/g, " ").trim();
    if (s && patterns.some((p) => p.test(s))) hits.push({ where: `<${t.parent.tag}${attr(t.parent, "id") ? "#" + attr(t.parent, "id") : ""}>`, text: s.slice(0, 80) });
  }
  for (const el of elements) {
    if (isHiddenInStore(el)) continue;
    for (const name of ["aria-label", "title", "alt", "placeholder", "value", "aria-description"]) {
      const v = attr(el, name);
      if (v && patterns.some((p) => p.test(decodeEntities(v)))) hits.push({ where: `<${el.tag} ${name}>`, text: decodeEntities(v).slice(0, 80) });
    }
  }
  return hits;
}

// Arcade text in the string literals of a script, outside comments. The check cannot tell if the code shows the string,
// so the browser test (qa/fish/app-bundle.e2e.mjs) checks the page itself.
function scriptArcadeText(src, lineOffset = 0) {
  const hits = [];
  const lines = src.split("\n");
  for (const s of scanJs(src).strings) {
    if (!ARCADE_TEXT.some((p) => p.test(s.value))) continue;
    const line = src.slice(0, s.start).split("\n").length;
    if (WEB_ONLY.test(lines[line - 1] || "")) continue;
    hits.push({ line: line + lineOffset, text: s.value.replace(/\0/g, "${...}").slice(0, 60) });
  }
  return hits;
}

export function checkWww(www, { strict = false, release = false, quiet = false } = {}) {
  if (release) strict = true;
  const issues = [];
  const add = (level, file, msg) => issues.push({ level, file, msg });
  if (!fs.existsSync(path.join(www, "index.html"))) {
    add("error", "index.html", "www has no index.html. Run npm run build:www first.");
    return report(www, issues, [], { quiet });
  }
  const all = walkFiles(www);
  const seeds = ["index.html", ...all.filter((f) => f !== "index.html" && ALWAYS.some((re) => re.test(f)))];
  const graph = collect(www, seeds);
  issues.push(...graph.issues);
  // Files that nothing loads still ship in the app, so read them for web addresses and root paths as well.
  const unread = all.filter((f) => SCANNED.test(f) && !graph.files.has(f));
  if (unread.length) {
    const seen = new Set(issues.map((i) => `${i.level} ${i.file} ${i.msg}`));
    for (const i of collect(www, unread).issues) if (!seen.has(`${i.level} ${i.file} ${i.msg}`)) issues.push(i);
  }

  // the store flag must be on <html> from the first frame
  const indexHtml = fs.readFileSync(path.join(www, "index.html"), "utf8");
  const htmlEl = parseHtml(indexHtml).elements.find((e) => e.tag === "html");
  if (!htmlEl || attr(htmlEl, "data-build") !== "store") add("error", "index.html", '<html> has no data-build="store".');
  if (!graph.importMaps.three) add("error", "index.html", 'the import map has no "three" entry.');
  else if (graph.importMaps.three !== "./lib/three.module.min.js") add("warn", "index.html", `the import map sends "three" to ${graph.importMaps.three}, not ./lib/three.module.min.js.`);
  if (release && !all.includes("privacy.html")) add("error", "privacy.html", "the release has no privacy policy page.");

  for (const f of all) {
    if (/ghibli/i.test(f)) add(strict ? "error" : "warn", f, 'the file name has "ghibli" in it.');
    if (!TEXT_FILE.test(f)) continue;
    const text = fs.readFileSync(path.join(www, f), "utf8");
    if (/ghibli/i.test(text)) {
      const n = (text.match(/ghibli/gi) || []).length;
      add(strict ? "error" : "warn", f, `the text has "ghibli" in it ${n} time${n === 1 ? "" : "s"}.`);
    }
    const scriptText = (hits) => {
      for (const h of hits) add(strict ? "error" : "warn", f, `line ${h.line}: a script holds arcade text "${h.text}". If a player can see it in the app, hide it in a store build. When the code shows it on the web only, put "// web only" on that line.`);
    };
    if (/\.html?$/i.test(f)) {
      // a placeholder for the owner (data-placeholder): a warning in a test build, an error in a release
      for (const el of parseHtml(text).elements) {
        const ph = attr(el, "data-placeholder");
        if (ph !== null) add(release ? "error" : "warn", f, `a placeholder is still in the page (data-placeholder="${ph}"): "${decodeEntities(text.slice(el.openEnd, el.closeStart)).replace(/\s+/g, " ").trim().slice(0, 80)}". Put the real text in before a store upload.`);
      }
      for (const h of visibleMatches(text, ARCADE_TEXT)) add("error", f, `a player can see arcade text in ${h.where}: "${h.text}"`);
      // the privacy page serves the web and the app, so it talks about both, and it may show a web address as text
      if (f !== "privacy.html") {
        for (const h of visibleMatches(text, [WEB_TEXT])) add("warn", f, `web copy in ${h.where}: "${h.text}"`);
        for (const h of visibleMatches(text, [{ test: (s) => webAddress(s, { relative: false }) !== null }])) add("warn", f, `a page shows a web address in ${h.where}: "${h.text}"`);
      }
      for (const el of parseHtml(text).elements) {
        if (el.tag !== "script" || !el.rawText || attr(el, "src") !== null) continue;
        const type = (attr(el, "type") || "").toLowerCase();
        if (JS_TYPES.has(type)) scriptText(scriptArcadeText(el.rawText, text.slice(0, el.rawStart).split("\n").length - 1));
      }
    } else if (/\.m?js$/i.test(f)) scriptText(scriptArcadeText(text));
  }
  for (const f of all) {
    if (!graph.files.has(f) && !ALWAYS.some((re) => re.test(f))) add("warn", f, "nothing loads this file.");
  }
  return report(www, issues, all, { quiet });
}

function report(www, issues, all, { quiet }) {
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  const infos = issues.filter((i) => i.level === "info");
  if (!quiet) {
    // size summary, by top folder
    const sizes = all.map((f) => ({ f, n: fs.statSync(path.join(www, f)).size }));
    const total = sizes.reduce((a, b) => a + b.n, 0);
    const groups = new Map();
    for (const s of sizes) { const g = s.f.includes("/") ? s.f.split("/")[0] + "/" : "(top)"; const v = groups.get(g) || { n: 0, c: 0 }; v.n += s.n; v.c++; groups.set(g, v); }
    const rel = path.relative(process.cwd(), www);
    console.log(`\nwww: ${all.length} files, ${fmtBytes(total)}  (${!rel || rel.startsWith("..") ? www : rel})`);
    for (const [g, v] of [...groups].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${g.padEnd(10)} ${String(v.c).padStart(3)} files  ${fmtBytes(v.n).padStart(9)}`);
    console.log("  largest:");
    for (const s of sizes.sort((a, b) => b.n - a.n).slice(0, 6)) console.log(`    ${fmtBytes(s.n).padStart(9)}  ${s.f}`);
    const byKey = (list) => { const m = new Map(); for (const i of list) { const k = i.file + ": " + i.msg; m.set(k, (m.get(k) || 0) + 1); } return [...m].map(([k, c]) => (c > 1 ? `${k} (x${c})` : k)); };
    if (infos.length) { console.log(`\ninfo (${infos.length}):`); for (const k of byKey(infos).slice(0, 8)) console.log("  " + k); }
    if (warns.length) { console.log(`\nwarnings (${warns.length}):`); for (const k of byKey(warns)) console.log("  " + k); }
    if (errors.length) { console.log(`\nERRORS (${errors.length}):`); for (const k of byKey(errors)) console.log("  " + k); }
    console.log(errors.length ? "\ncheck:www FAILED" : "\ncheck:www passed");
  }
  return { ok: errors.length === 0, errors, warns, infos };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict") || process.env.WWW_STRICT === "1";
  const release = args.includes("--release") || process.env.WWW_RELEASE === "1";
  const dir = args.find((a) => !a.startsWith("--"));
  const res = checkWww(dir ? path.resolve(dir) : path.join(APP_DIR, "www"), { strict, release });
  process.exit(res.ok ? 0 : 1);
}
