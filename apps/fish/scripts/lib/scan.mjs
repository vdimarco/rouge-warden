// Small scanners for the app bundle: HTML, CSS and JavaScript. They find the URLs a page loads, and the text a player can see.
// They are not full parsers. They know enough of each language to skip comments, strings and regular expressions,
// so a URL in a comment or a quote mark in a regular expression does not confuse them.

// ---------- HTML ----------

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "textarea", "title"]);

// Attributes of one start tag. Offsets are relative to the start of the tag text.
export function parseAttrs(tag) {
  const attrs = [];
  const head = /^<[a-zA-Z][\w:-]*/.exec(tag);
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  re.lastIndex = head ? head[0].length : 1;
  let m;
  while ((m = re.exec(tag))) {
    if (m.index >= tag.length - 1) break;
    attrs.push({ name: m[1].toLowerCase(), value: m[2] ?? m[3] ?? m[4] ?? null, start: m.index, end: m.index + m[0].length });
  }
  return attrs;
}

export function attr(el, name) {
  const a = el.attrs.find((x) => x.name === name);
  return a ? (a.value ?? "") : null;
}

// Builds a light element tree. Each element: { tag, attrs, start, openEnd, closeStart, end, parent, children, rawText }.
// Text nodes: { text, start, end, parent }.
export function parseHtml(html) {
  const root = { tag: "#root", attrs: [], start: 0, openEnd: 0, closeStart: html.length, end: html.length, parent: null, children: [] };
  const elements = [], texts = [];
  const stack = [root];
  let i = 0;
  const top = () => stack[stack.length - 1];
  const pushText = (s, e) => { if (e > s) { const t = { text: html.slice(s, e), start: s, end: e, parent: top() }; texts.push(t); top().children.push(t); } };
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) { pushText(i, html.length); break; }
    pushText(i, lt);
    if (html.startsWith("<!--", lt)) { const e = html.indexOf("-->", lt + 4); i = e < 0 ? html.length : e + 3; continue; }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") { const e = html.indexOf(">", lt); i = e < 0 ? html.length : e + 1; continue; }
    const close = /^<\/([a-zA-Z][\w:-]*)\s*>/.exec(html.slice(lt, lt + 80));
    if (close) {
      const name = close[1].toLowerCase();
      const at = stack.map((x) => x.tag).lastIndexOf(name);
      if (at > 0) {
        while (stack.length > at) { const el = stack.pop(); el.closeStart = lt; el.end = lt + close[0].length; }
      }
      i = lt + close[0].length;
      continue;
    }
    const open = /^<([a-zA-Z][\w:-]*)/.exec(html.slice(lt, lt + 80));
    if (!open) { pushText(lt, lt + 1); i = lt + 1; continue; }
    // find the end of the start tag, skipping quoted attribute values
    let j = lt + open[0].length, q = null;
    for (; j < html.length; j++) {
      const c = html[j];
      if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === ">") break;
    }
    const tagText = html.slice(lt, j + 1);
    const name = open[1].toLowerCase();
    const el = { tag: name, attrs: parseAttrs(tagText), start: lt, openEnd: j + 1, closeStart: j + 1, end: j + 1, parent: top(), children: [] };
    elements.push(el);
    top().children.push(el);
    i = j + 1;
    if (VOID.has(name) || tagText.endsWith("/>")) continue;
    if (RAW.has(name)) {
      const endRe = new RegExp("</" + name + "\\s*>", "ig");
      endRe.lastIndex = i;
      const m = endRe.exec(html);
      const stop = m ? m.index : html.length;
      el.rawText = html.slice(i, stop);
      el.rawStart = i;
      el.closeStart = stop;
      el.end = m ? stop + m[0].length : html.length;
      i = el.end;
      continue;
    }
    stack.push(el);
  }
  return { root, elements, texts };
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", middot: "·", mdash: "—", ndash: "–", hellip: "…", copy: "©" };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? m;
  });
}

// Elements that a store build never shows: markup that never renders, and the parts that the store CSS
// always hides ([data-switch], [data-fullscreen], #arcadeRow, [data-store-hidden]).
// The plain hidden attribute does not count, because the game shows and hides its screens with it.
const NEVER_SHOWN = new Set(["head", "script", "style", "template", "noscript", "title"]);
export const STORE_HIDDEN_SELECTOR = "[data-switch], [data-fullscreen], #arcadeRow, [data-store-hidden]";
export function isHiddenInStore(el) {
  for (let e = el; e && e.tag !== "#root"; e = e.parent) {
    if (NEVER_SHOWN.has(e.tag)) return true;
    if (attr(e, "data-switch") !== null || attr(e, "data-fullscreen") !== null || attr(e, "data-store-hidden") !== null) return true;
    if (attr(e, "id") === "arcadeRow") return true;
  }
  return false;
}

// ---------- CSS ----------

export function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

// URLs in a style sheet or a style attribute: url(...) and @import.
export function cssRefs(css) {
  const out = [];
  const src = stripCssComments(css);
  const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)|@import\s+(?:"([^"]*)"|'([^']*)')/gi;
  // url() inside @font-face: a missing font falls back to a system font, so callers may treat it more softly
  const faces = [];
  for (const f of src.matchAll(/@font-face\s*\{[^}]*\}/gi)) faces.push([f.index, f.index + f[0].length]);
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "";
    const inFace = faces.some(([a, b]) => m.index > a && m.index < b);
    out.push({ spec, kind: m[0].startsWith("@") ? "css-import" : inFace ? "font-url" : "css-url", at: m.index });
  }
  return out;
}

// ---------- JavaScript ----------

const REGEX_AFTER_WORD = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);

// Splits a script into code with the comments blanked out, plus the string literals in it.
// A template literal comes back with each ${...} part replaced by "\0", so callers can treat it as a wildcard.
export function scanJs(src) {
  const out = src.split("");
  const strings = [];
  const n = src.length;
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " "; };
  let lastSig = "", lastWord = "";

  function readString(i, q) {
    let j = i + 1, val = "";
    for (; j < n; j++) {
      const c = src[j];
      if (c === "\\") { val += src[j + 1] ?? ""; j++; continue; }
      if (c === q || c === "\n") break;
      val += c;
    }
    strings.push({ start: i, end: j + 1, quote: q, value: val });
    return j + 1;
  }
  function readTemplate(i) {
    let j = i + 1, val = "";
    while (j < n) {
      const c = src[j];
      if (c === "\\") { val += src[j + 1] ?? ""; j += 2; continue; }
      if (c === "`") { j++; break; }
      if (c === "$" && src[j + 1] === "{") { val += "\0"; j = readCode(j + 2, true); continue; }
      val += c; j++;
    }
    strings.push({ start: i, end: j, quote: "`", value: val });
    return j;
  }
  function readRegex(i) {
    let j = i + 1, inClass = false;
    for (; j < n; j++) {
      const c = src[j];
      if (c === "\\") { j++; continue; }
      if (c === "\n") break;
      if (inClass) { if (c === "]") inClass = false; continue; }
      if (c === "[") inClass = true;
      else if (c === "/") { j++; break; }
    }
    while (j < n && /[a-z]/i.test(src[j])) j++;
    return j;
  }
  // Reads code from i. With inBraces, it stops after the "}" that closes a ${ in a template.
  function readCode(i, inBraces) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === "/" && src[i + 1] === "/") { const e = src.indexOf("\n", i); const stop = e < 0 ? n : e; blank(i, stop); i = stop; continue; }
      if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); const stop = e < 0 ? n : e + 2; blank(i, stop); i = stop; continue; }
      if (c === '"' || c === "'") { i = readString(i, c); lastSig = c; lastWord = ""; continue; }
      if (c === "`") { i = readTemplate(i); lastSig = "`"; lastWord = ""; continue; }
      if (c === "/") {
        const isRegex = !lastSig || "(,=:[!&|?{};~+-*%<>^".includes(lastSig) || REGEX_AFTER_WORD.has(lastWord);
        if (isRegex) { i = readRegex(i); lastSig = "/"; lastWord = ""; continue; }
      }
      if (inBraces) {
        if (c === "{") depth++;
        else if (c === "}") { if (depth === 0) return i + 1; depth--; }
      }
      if (/[A-Za-z_$0-9]/.test(c)) {
        let j = i;
        while (j < n && /[A-Za-z_$0-9]/.test(src[j])) j++;
        lastWord = src.slice(i, j);
        lastSig = src[j - 1];
        i = j;
        continue;
      }
      if (!/\s/.test(c)) { lastSig = c; lastWord = ""; }
      i++;
    }
    return i;
  }
  readCode(0, false);
  return { code: out.join(""), strings };
}

// URL-like references in a script. kind tells how the page uses the string:
// import, dynamic-import, meta-url (new URL(x, import.meta.url)), fetch, load (src/href assignment, Worker, Audio, loader.load),
// navigate (location, history.pushState, window.open), or string.
export function jsRefs(src) {
  const { code, strings } = scanJs(src);
  const out = [];
  for (const s of strings) {
    const before = code.slice(Math.max(0, s.start - 120), s.start);
    const after = code.slice(s.end, s.end + 40);
    let kind = "string";
    if (/(?:\bfrom|\bimport)\s*$/.test(before)) kind = "import";
    else if (/\bimport\s*\(\s*$/.test(before)) kind = "dynamic-import";
    else if (/\bnew\s+URL\s*\(\s*$/.test(before) && /^\s*,\s*import\.meta\.url/.test(after)) kind = "meta-url";
    else if (/\bfetch\s*\(\s*$/.test(before)) kind = "fetch";
    else if (/(?:\bnew\s+(?:Worker|SharedWorker|Audio|EventSource|WebSocket)\s*\(|\bimportScripts\s*\(|\.(?:src|href|poster|srcset)\s*=|\.load(?:Async)?\s*\(|\.open\s*\(\s*["'][A-Z]+["']\s*,|\bsetAttribute\s*\(\s*["'](?:src|href|poster)["']\s*,)\s*$/.test(before)) kind = "load";
    // a page navigation: location = x, location.assign(x), location.replace(x), history.pushState(s, t, x), window.open(x)
    else if (/(?:\blocation\s*=|\blocation\.(?:pathname\s*=|assign\s*\(|replace\s*\()|\b(?:pushState|replaceState)\s*\((?:[^()]|\([^()]*\))*,|\b(?:window|self|top|parent|globalThis)\.open\s*\()\s*$/.test(before)) kind = "navigate";
    out.push({ spec: s.value, kind, template: s.quote === "`" && s.value.includes("\0"), at: s.start });
  }
  return { refs: out, code };
}

// ---------- shared helpers ----------

// A web address: http://, https://, ws://, wss://, or a protocol-relative //host.name/ (not a "// comment" inside a shader string).
export const isHttp = (spec) => /^(?:(?:https?|wss?):\/\/|\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[\/:?#]|$))/i.test(spec.trim());
// XML namespace names look like web addresses, but nothing loads them (three.js has "http://www.w3.org/1999/xhtml").
export const NAMESPACE = /^https?:\/\/(?:www\.w3\.org|purl\.org|creativecommons\.org|ns\.adobe\.com|www\.inkscape\.org|sodipodi\.sourceforge\.net)\//i;
// The first web address in a text that is not a namespace name, or null. It finds http(s):// and ws(s):// anywhere
// in the text. With relative (for one string value), it also finds a protocol-relative //host.name at the start;
// it never looks for one later in the text, because "//" in a string is often a shader comment.
export function webAddress(text, { relative = true } = {}) {
  const t = text.trim();
  if (relative && /^\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[\/:?#]|$)/i.test(t)) return t.slice(0, 100);
  for (const m of text.matchAll(/(?:https?|wss?):\/\/[^\s"'`<>()\\]*/gi)) if (!NAMESPACE.test(m[0])) return m[0].slice(0, 100);
  return null;
}
// A root path inside markup that a script holds as a string, for example '<a href="/">'.
export function markupRootPath(text) {
  const m = /\b(?:href|src|action|formaction|poster)\s*=\s*["']?(\/(?!\/)[^"'\s>]*)/i.exec(text);
  return m ? m[1] : null;
}
export const isRootPath = (spec) => /^\/(?!\/)/.test(spec.trim());
export const isSpecial = (spec) => /^(?:data|blob|about|mailto|tel|javascript|capacitor|#)/i.test(spec.trim()) || spec.trim().startsWith("#") || spec.trim() === "";
export const isBare = (spec) => !/^(?:\.{0,2}\/|[a-z][a-z0-9+.-]*:)/i.test(spec);

// The <script> types that hold JavaScript.
export const JS_TYPES = new Set(["", "module", "text/javascript", "application/javascript"]);

// Asset-looking strings: a relative path that ends in a file type the game can load.
export const ASSET_EXT = /\.(?:js|mjs|css|html|json|webp|png|jpe?g|gif|svg|avif|glb|gltf|bin|ktx2|mp4|webm|m4a|mp3|ogg|wav|woff2?|ttf|otf|txt|wasm)$/i;
