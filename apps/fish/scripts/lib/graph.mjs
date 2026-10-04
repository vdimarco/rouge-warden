// Walks the files of a web game from its entry points and finds every file the pages load.
// The build uses it on public/fish to pick the files to copy. The check uses it on www/ to find bad references.
import fs from "node:fs";
import path from "node:path";
import { parseHtml, attr, cssRefs, stripCssComments, jsRefs, isHttp, isRootPath, isSpecial, isBare, webAddress, markupRootPath, NAMESPACE, ASSET_EXT, JS_TYPES } from "./scan.mjs";

// Files the walk reads. HTML, CSS and JavaScript can load more files. SVG and JSON are read for web addresses and root paths.
const TEXT = /\.(?:html?|css|m?js|svg|json)$/i;
const MARKUP = /\.(?:html?|svg)$/i;
const NO_HOST = "The app loads nothing from another host, and the check cannot see how the code uses the string.";
// Root paths of other parts of the web site. A string that starts with one of these is wrong in the app, wherever it is.
export const SITE_ROOTS = /^\/(?:icons|arcade|wild|fish)(?:\/|$)/;

export function walkFiles(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkFiles(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

const posix = path.posix;
const show = (s) => s.replace(/\0/g, "${...}").slice(0, 100);

function cleanSpec(spec) {
  let s = spec.trim().replace(/[?#].*$/, "");
  try { s = decodeURI(s); } catch { /* keep it */ }
  return s;
}

// Resolves a relative spec against a directory inside the root. Returns null when it leaves the root.
function resolveIn(dir, spec) {
  const p = posix.normalize(posix.join(dir, spec));
  if (p.startsWith("../") || p === "..") return null;
  return p.replace(/^\.\//, "");
}

// Files that match a template string, where "\0" stands for any text.
function globTemplate(root, dir, spec) {
  const cut = spec.indexOf("\0");
  const head = spec.slice(0, cut);
  const slash = head.lastIndexOf("/");
  const baseDir = resolveIn(dir, slash >= 0 ? head.slice(0, slash + 1) : "./");
  if (baseDir === null) return { outside: true, matches: [] };
  const rest = spec.slice(slash + 1);
  const re = new RegExp("^" + rest.split("\0").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*") + "$");
  const abs = path.join(root, baseDir);
  const matches = walkFiles(abs).filter((f) => re.test(f)).map((f) => posix.join(baseDir, f).replace(/^\.\//, ""));
  return { outside: false, matches };
}

// Walks from the seed files. Returns the files reached, the import map, and the issues found.
// issue: { level: "error" | "warn" | "info", file, msg }
export function collect(root, seeds, { documentDir = "" } = {}) {
  const files = new Set();
  const issues = [];
  const refs = [];
  const queue = [];
  const importMaps = {};
  const add = (rel) => { if (!files.has(rel)) { files.add(rel); if (TEXT.test(rel)) queue.push(rel); } };
  const exists = (rel) => { try { return fs.statSync(path.join(root, rel)).isFile(); } catch { return false; } };
  const isDir = (rel) => { try { return fs.statSync(path.join(root, rel)).isDirectory(); } catch { return false; } };
  for (const s of seeds) if (exists(s)) add(s);

  const issue = (level, file, msg) => issues.push({ level, file, msg });

  // strong: the page will load it, so a bad or missing target is an error.
  // soft: a missing target is only a warning (a font that falls back to a system font).
  function ref(from, spec, kind, { strong, soft = false, dir, template = false, docDir = documentDir }) {
    if (isSpecial(spec)) return;
    const raw = spec.trim();
    if (isHttp(raw)) {
      if (strong) issue("error", from, `${kind} loads another host: ${show(raw)}`);
      // a web address in any string is an error: the code can load it later through a variable
      else if (!NAMESPACE.test(raw)) issue("error", from, `a string holds a web address: ${show(raw)}. ${NO_HOST}`);
      return;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return;
    if (isRootPath(raw)) {
      if (strong) issue("error", from, `${kind} uses a root path that does not exist in the app: ${raw}`);
      else if (SITE_ROOTS.test(raw)) issue("error", from, `a string names a path of the web site: ${raw}`);
      return;
    }
    if (!strong && !ASSET_EXT.test(cleanSpec(raw))) return;
    const tries = [dir, docDir].filter((d, i, a) => d !== undefined && a.indexOf(d) === i);
    if ((template || raw.includes("\0")) && cleanSpec(raw).includes("\0")) {
      // a template string: copy every file it can name; a weak string also tries the page folder
      let g = { outside: false, matches: [] };
      // a weak template needs a fixed folder in front, or it could name every file of one type
      if (!strong && !cleanSpec(raw).slice(0, cleanSpec(raw).indexOf("\0")).includes("/")) return;
      for (const d of strong ? [dir] : tries) {
        g = globTemplate(root, d, cleanSpec(raw));
        if (g.matches.length) break;
      }
      if (g.outside) { if (strong) issue("error", from, `${kind} points outside the game folder: ${raw.replace(/\0/g, "${...}")}`); return; }
      if (!g.matches.length && strong) issue("warn", from, `${kind} template matches no file: ${raw.replace(/\0/g, "${...}")}`);
      for (const m of g.matches) { add(m); refs.push({ from, spec: raw, kind, to: m }); }
      return;
    }
    let hit = null, inside = false;
    for (const d of tries) {
      const r = resolveIn(d, cleanSpec(raw));
      if (r === null) continue;
      inside = true;
      // a link to a folder opens its index.html
      const page = r === "" || r.endsWith("/") || isDir(r) ? posix.join(r, "index.html") : r;
      if (exists(page)) { hit = page; break; }
    }
    if (hit) { add(hit); refs.push({ from, spec: raw, kind, to: hit }); return; }
    if (!strong) return;
    if (!inside) issue("error", from, `${kind} points outside the game folder: ${raw}`);
    else issue(soft ? "warn" : "error", from, `${kind} names a missing file: ${raw}`);
  }

  function scanJsText(from, text, dir) {
    const { refs: found } = jsRefs(text);
    for (const r of found) {
      // ref() reports a string that starts with a web address. This finds one later in the string, for example in markup.
      const web = !isHttp(r.spec) && webAddress(r.spec);
      if (web) issue("error", from, `a string holds a web address: ${show(web)}. ${NO_HOST}`);
      const rootInMarkup = markupRootPath(r.spec);
      if (rootInMarkup) issue("error", from, `markup in a string uses a root path that does not exist in the app: ${rootInMarkup}`);
      if (r.kind === "import" || r.kind === "dynamic-import") {
        if (r.kind === "dynamic-import" && r.template) { ref(from, r.spec, "import()", { strong: true, dir, template: true }); continue; }
        if (isBare(r.spec) && !isHttp(r.spec)) {
          const target = importMaps[r.spec] ?? Object.entries(importMaps).find(([k]) => k.endsWith("/") && r.spec.startsWith(k))?.[1];
          if (target === undefined) issue("error", from, `import "${r.spec}" has no import map entry`);
          continue; // the import map entry itself is checked where it is defined
        }
        ref(from, r.spec, "import", { strong: true, dir, docDir: dir });
      } else if (r.kind === "meta-url") ref(from, r.spec, "new URL(..., import.meta.url)", { strong: true, dir, docDir: dir, template: r.template });
      else if (r.kind === "fetch" || r.kind === "load") ref(from, r.spec, r.kind, { strong: true, dir: documentDir, template: r.template });
      else if (r.kind === "navigate") ref(from, r.spec, "page navigation", { strong: true, dir: documentDir, template: r.template });
      else ref(from, r.spec, "string", { strong: false, dir, template: r.template });
    }
  }

  function scanCss(from, text, dir) {
    for (const r of cssRefs(text)) ref(from, r.spec, r.kind === "css-import" ? "@import" : r.kind === "font-url" ? "@font-face url()" : "url()", { strong: true, soft: r.kind === "font-url", dir });
    // a web address outside url() and @import, for example in a custom property that a script reads
    const rest = stripCssComments(text).replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)\s]*)\s*\)|@import\s+(?:"[^"]*"|'[^']*')/gi, "");
    const web = webAddress(rest, { relative: false });
    if (web) issue("error", from, `the style sheet holds a web address: ${show(web)}`);
  }

  // Every string in a JSON file: a web address or a path of the web site is an error.
  function scanJson(from, text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { issue("warn", from, `the file is not valid JSON: ${e.message}`); return; }
    const walk = (v) => {
      if (typeof v === "string") {
        const web = webAddress(v);
        if (web) issue("error", from, `a JSON string holds a web address: ${show(web)}`);
        else if (SITE_ROOTS.test(v.trim())) issue("error", from, `a JSON string names a path of the web site: ${v.trim()}`);
      } else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x);
    };
    walk(data);
  }

  while (queue.length) {
    const rel = queue.shift();
    const dir = posix.dirname(rel) === "." ? "" : posix.dirname(rel);
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    if (MARKUP.test(rel)) {
      const { elements } = parseHtml(text);
      for (const el of elements) {
        for (const a of el.attrs) {
          if (a.value === null) continue;
          if (["src", "poster", "data", "action", "formaction", "xlink:href"].includes(a.name)) ref(rel, a.value, `<${el.tag} ${a.name}>`, { strong: true, dir });
          else if (a.name === "href") ref(rel, a.value, `<${el.tag} href>`, { strong: true, dir });
          else if (a.name === "srcset" || a.name === "imagesrcset") for (const part of a.value.split(",")) ref(rel, part.trim().split(/\s+/)[0] || "", `<${el.tag} ${a.name}>`, { strong: true, dir });
          else if (a.name === "style") scanCss(rel, a.value, dir);
          // any other attribute, for example data-src or a meta content: a script can read it and load it
          else if (!/^xmlns(?::|$)/.test(a.name)) {
            const web = webAddress(a.value);
            if (web) issue("error", rel, `<${el.tag} ${a.name}> holds a web address: ${show(web)}`);
          }
        }
        if (el.tag === "style" && el.rawText) scanCss(rel, el.rawText, dir);
        if (el.tag === "script" && el.rawText && attr(el, "src") === null) {
          const type = (attr(el, "type") || "").toLowerCase();
          if (type === "importmap") {
            let map = null;
            try { map = JSON.parse(el.rawText); } catch (e) { issue("error", rel, `the import map is not valid JSON: ${e.message}`); }
            for (const [k, v] of Object.entries(map?.imports || {})) {
              importMaps[k] = v;
              if (isHttp(v)) issue("error", rel, `import map entry "${k}" loads another host: ${v}`);
              else if (isRootPath(v)) issue("error", rel, `import map entry "${k}" uses a root path: ${v}`);
              else if (k.endsWith("/")) { const d = resolveIn(dir, v); if (d === null || !fs.existsSync(path.join(root, d))) issue("error", rel, `import map entry "${k}" names a missing folder: ${v}`); }
              else ref(rel, v, `import map entry "${k}"`, { strong: true, dir });
            }
          } else if (JS_TYPES.has(type)) scanJsText(rel, el.rawText, dir);
          else {
            // a data block (JSON, a shader, plain text) that a script can read
            const web = webAddress(el.rawText, { relative: false });
            if (web) issue("error", rel, `<script type="${type}"> holds a web address: ${show(web)}`);
          }
        }
      }
    } else if (/\.css$/i.test(rel)) scanCss(rel, text, dir);
    else if (/\.json$/i.test(rel)) scanJson(rel, text);
    else scanJsText(rel, text, dir);
  }
  return { files, issues, refs, importMaps };
}
