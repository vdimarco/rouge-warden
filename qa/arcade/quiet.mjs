// Checks that every page with sound goes silent when it is hidden, and comes back when it is visible again.
//   cd public && python3 -m http.server 8912 &      (any port: set QUIET_URL=http://localhost:8912)
//   NODE_PATH=/opt/node22/lib/node_modules node qa/arcade/quiet.mjs [--old] [--only=echo,fall] [--skip=scan,unit,pages,silent]
// 1. scan: a page under public/ that makes sound must load /arcade/quiet.js as its first script (vr is on an allow-list).
// 2. unit: public/arcade/quiet.js on small test pages: the contexts it suspends and resumes, a game that suspends its own, a
//    context made while hidden, a hide and show in one tick, pagehide and pageshow, <audio>, SoundCloud, no AudioContext at all.
// 3. pages: every game page, started the way a player starts it. Sound must be running, then silent while hidden (even when the
//    page pokes at its sound, and after 3 s), then running again. Run with the autoplay policy open, and with the normal policy
//    and a real tap. Hidden how: "emulate" (document.hidden and visibilityState overridden, plus a visibilitychange event) and
//    "pagehide" (pagehide, then pageshow with persisted: true) in Playwright; "real" (another tab on top) and "freeze"
//    (Page.setWebLifecycleState) in plain Chromium over CDP. Playwright keeps every page visible, so it cannot do the real ones.
// Options: --old stubs out /arcade/quiet.js, to show which pages are loud today (the exit code is 0 then). --only=echo,fall runs only
// those pages. --skip=scan,unit,pages,silent leaves a part out. --modes=emulate,pagehide,tap,real,freeze picks the ways to hide.
// Environment: QUIET_URL (default http://localhost:8912), QUIET_ROOT (the folder that holds public/, for the scan), QUIET_JS (try
// another copy of quiet.js), QUIET_SC_API (run SoundCloud's real api.js against the stand-in player), VERBOSE=1 (show every detail).
// The exit code is 1 when a check fails.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { execFileSync, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = path.join(process.env.QUIET_ROOT || ROOT, "public");
const BASE = (process.env.QUIET_URL || "http://localhost:8912").replace(/\/$/, "");
const args = process.argv.slice(2);
const OLD = args.includes("--old");
const opt = (name) => { const a = args.find((x) => x.startsWith("--" + name + "=")); return a ? a.split("=")[1].split(",") : null; };
const ONLY = opt("only"), SKIP = opt("skip") || [];
const MODES = opt("modes") || ["emulate", "pagehide", "tap", "real", "freeze"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let section = "";
function check(name, ok, detail = "") {
  results.push({ section, name, ok: !!ok, detail });
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail && (!ok || process.env.VERBOSE) ? "  (" + detail + ")" : ""}`);
}

/* ------------------------------------------------------------------ 1. the scan */
// pages that make sound but must not load quiet.js, with the reason
const ALLOW = {
  "vr/index.html": "In Full Swing has its own sound control: audio.suspend() when the XR session is hidden, and (on the phone, outside a headset session) when the page is hidden. quiet.js could suspend it in an immersive session, where some headset browsers report the page as hidden.",
};
const AUDIO = /\b(?:webkit)?AudioContext\b|new\s+Audio\s*\(|<audio\b|createElement\(\s*["']audio["']\s*\)|<video\b(?![^>]*\bmuted)|speechSynthesis|w\.soundcloud\.com/;
function pagesUnder(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") out.push(...pagesUnder(p)); } else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}
// every script a page loads or imports (relative and absolute paths), not the third-party code under lib/
function scriptsOf(htmlPath) {
  const seen = new Set(), todo = [], html = fs.readFileSync(htmlPath, "utf8");
  const resolve = (spec, from, page = false) => {
    if (/^(https?:)?\/\//.test(spec) || (!page && !/^[./]/.test(spec))) return null;
    const file = spec.startsWith("/") ? path.join(PUBLIC, spec.split(/[?#]/)[0]) : path.resolve(path.dirname(from), spec.split(/[?#]/)[0]);
    return file.includes(path.sep + "lib" + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory() ? null : file;
  };
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) { const f = resolve(m[1], htmlPath, true); if (f) todo.push(f); }
  const texts = [html];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, "utf8");
    texts.push(src);
    for (const m of src.matchAll(/(?:\bimport\s*(?:[^'"()]*?\sfrom\s*)?|\bexport\s[^'"()]*?\sfrom\s*|\bimport\s*\(\s*)["']([^"'`$]+)["']/g)) { const g = resolve(m[1], f); if (g) todo.push(g); }
  }
  return { html, texts };
}
function scan() {
  section = "scan";
  console.log("\n== scan: pages that make sound load /arcade/quiet.js first");
  check("quiet.js exists", fs.existsSync(path.join(PUBLIC, "arcade/quiet.js")));
  for (const p of pagesUnder(PUBLIC).sort()) {
    const rel = path.relative(PUBLIC, p).split(path.sep).join("/");
    const { html, texts } = scriptsOf(p);
    if (!texts.some((t) => AUDIO.test(t))) continue;
    const first = /<script\b[^>]*>/.exec(html), head = html.indexOf("</head>");
    const quietFirst = !!first && /\bsrc="\/arcade\/quiet\.js"/.test(first[0]) && (head < 0 || first.index < head);
    if (ALLOW[rel]) { check(`${rel} is on the allow-list`, !quietFirst, "quiet.js is there now: take it off the allow-list"); continue; }
    check(`${rel} loads /arcade/quiet.js as its first script`, quietFirst, first ? "first script: " + first[0].slice(0, 80) : "no script");
  }
}

/* ------------------------------------------------------------------ the page side: a tracker, written by the test */
// Runs before the page's scripts, below quiet.js: it only watches. It never touches suspend or resume.
function tracker() {
  const Q = (window.__qa = { ctxs: [], media: new Set(), nodes: 0, scs: new Map() });
  for (const k of ["AudioContext", "webkitAudioContext"]) {
    const N = window[k];
    if (!N) continue;
    const T = class extends N { constructor(...a) { super(...a); Q.ctxs.push(this); } };
    Object.defineProperty(T, "name", { value: N.name });
    window[k] = T;
  }
  if (window.BaseAudioContext) for (const m of ["createOscillator", "createBufferSource"]) {
    const o = BaseAudioContext.prototype[m];
    BaseAudioContext.prototype[m] = function (...a) { Q.nodes++; return o.apply(this, a); };
  }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) { Q.media.add(this); return play.apply(this, a); };
  // the SoundCloud stand-in tells the page when it plays or pauses
  addEventListener("message", (e) => { try { const m = JSON.parse(e.data); if (m && m.qa) Q.scs.set(e.source, m.qa.playing); } catch (x) { /* not ours */ } });
  Object.defineProperty(Q, "sc", { get: () => (Q.scs.size ? [...Q.scs.values()].some(Boolean) : null) });
  window.__qaState = () => ({
    quiet: !!window.__quiet,
    ctxs: Q.ctxs.map((c) => c.state),
    times: Q.ctxs.map((c) => c.currentTime),
    playing: [...Q.media, ...document.querySelectorAll("audio, video")].filter((m) => !m.paused && !m.ended && !m.muted && m.volume > 0).length,
    sc: Q.sc, nodes: Q.nodes,
    hidden: document.hidden, vis: document.visibilityState,
  });
  // hide or show the page without a browser that can: the same two properties and the same event
  window.__qaHide = (hide) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hide });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hide ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  };
  window.__qaPage = (persisted, hide) => {
    const E = hide ? "pagehide" : "pageshow";
    window.dispatchEvent(new PageTransitionEvent(E, { persisted }));
  };
  // what a game might do while hidden: a tap, a key, a click, the page asking for its sound
  window.__qaPoke = () => {
    for (const t of ["pointerdown", "pointerup", "touchend", "mousedown", "click", "keydown", "keyup"]) {
      const ev = t.startsWith("pointer") ? new PointerEvent(t, { bubbles: true }) : t === "touchend" ? new TouchEvent(t, { bubbles: true, touches: [], changedTouches: [] }) : t.startsWith("key") ? new KeyboardEvent(t, { key: "Shift", code: "ShiftLeft", bubbles: true }) : new Event(t, { bubbles: true });
      document.body.dispatchEvent(ev);
    }
    for (const c of Q.ctxs) try { c.resume(); } catch (x) { /* closed */ }
  };
}

/* ------------------------------------------------------------------ the SoundCloud stand-in */
// SC.Widget(iframe) as SoundCloud's api.js does it (same messages, the same widget for the same iframe), and an iframe page that
// plays and pauses. Set QUIET_SC_API=/path/to/api.js to run the real api.js against the stand-in page instead.
const SC_API = `
(function () {
  var widgets = [], ready = [];
  window.addEventListener("message", function (e) {
    var m; try { m = JSON.parse(e.data); } catch (x) { return; }
    for (var i = 0; i < widgets.length; i++) {
      var w = widgets[i];
      if (w.el.contentWindow !== e.source) continue;
      if (m.method === "ready") { w.isReady = true; (w.late || []).splice(0).forEach(function (f) { f(); }); }
      (w.cb[m.method] || []).splice(0).forEach(function (f) { f.call(w.api, m.value); });
      if (w.ev[m.method]) w.ev[m.method].forEach(function (f) { f.call(w.api, m.value); });
      return;
    }
    if (m.method === "ready") ready.push(e.source);
  });
  function post(w, method, value) { w.el.contentWindow.postMessage(JSON.stringify({ method: method, value: value === undefined ? null : value }), "https://w.soundcloud.com"); }
  function Widget(el) {
    if (typeof el === "string") el = document.getElementById(el);
    if (!el || el.nodeName !== "IFRAME") throw new Error("SC.Widget needs an iframe");
    for (var i = 0; i < widgets.length; i++) if (widgets[i].el === el) return widgets[i].api;
    var w = { el: el, cb: {}, ev: {}, isReady: ready.indexOf(el.contentWindow) >= 0, late: [] }, api = {};
    w.api = api; widgets.push(w);
    ["play", "pause", "toggle", "seekTo", "setVolume", "next", "prev", "skip"].forEach(function (n) { api[n] = function (v) { post(w, n, v); return api; }; });
    ["getVolume", "getDuration", "getPosition", "getSounds", "getCurrentSound", "getCurrentSoundIndex", "isPaused"].forEach(function (n) {
      api[n] = function (f) { (w.cb[n] = w.cb[n] || []).push(f); post(w, n); return api; };
    });
    api.bind = function (name, f) {
      var go = function () { if (name === "ready") { setTimeout(f, 1); return; } (w.ev[name] = w.ev[name] || []).push(f); post(w, "addEventListener", name); };
      if (w.isReady) go(); else w.late.push(function () { api.bind(name, f); });
      return api;
    };
    api.load = function (url, o) { w.isReady = false; var base = el.src.split("?")[0]; el.src = base + "?url=" + encodeURIComponent(url) + "&auto_play=" + !!(o && o.auto_play); if (o && o.callback) api.bind("ready", o.callback); };
    return api;
  }
  Widget.Events = { READY: "ready", PLAY: "play", PAUSE: "pause", FINISH: "finish", SEEK: "seek", PLAY_PROGRESS: "playProgress", LOAD_PROGRESS: "loadProgress", ERROR: "error" };
  window.SC = window.SC || {}; window.SC.Widget = Widget;
})();`;
const SC_PAGE = `<!doctype html><meta charset="utf-8"><body><script>
var paused = true, ev = {};
function post(o) { parent.postMessage(JSON.stringify(o), "*"); }
function set(p) { if (p === paused) return; paused = p; post({ qa: { playing: !paused } }); if (ev[paused ? "pause" : "play"]) post({ method: paused ? "pause" : "play", value: { currentPosition: 0 } }); }
addEventListener("message", function (e) {
  var m; try { m = JSON.parse(e.data); } catch (x) { return; }
  if (m.method === "play") set(false);
  else if (m.method === "pause") set(true);
  else if (m.method === "toggle") set(!paused);
  else if (m.method === "isPaused") post({ method: "isPaused", value: paused });
  else if (m.method === "addEventListener") ev[m.value] = true;
  else if (m.method === "getCurrentSound") post({ method: "getCurrentSound", value: { title: "Stand-in", user: { username: "qa" }, permalink_url: "https://soundcloud.com/qa" } });
});
post({ qa: { playing: false } });
post({ method: "ready" });
if (/[?&]auto_play=true/.test(location.search)) set(false);
</script>`;
// A file from a CDN, kept in the temp folder: a stalled CDN request is the one thing that makes the heavy pages flaky.
function cdnFile(url) {
  const f = path.join(os.tmpdir(), "quiet-qa-cdn", url.replace(/[^A-Za-z0-9._-]/g, "_"));
  if (fs.existsSync(f)) return f;
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    execFileSync("curl", ["-sS", "-f", "-m", "30", "--retry", "4", "--retry-all-errors", "-o", f + ".part", url], { stdio: "ignore" });
    fs.renameSync(f + ".part", f);
    return f;
  } catch (e) { return null; }
}
// requests the tests answer themselves: [url glob, handler]. A handler returns { type, body } or null to let the request go on.
const ROUTES = [
  ["https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js", () => ({ type: "application/javascript", body: fs.readFileSync(path.join(ROOT, "public/crimson/lib/three.module.min.js")) })],
  ["https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/**", (u) => {
    // the add-ons Crimson Rogue keeps in its own lib folder, and the others from the CDN
    const f = path.join(ROOT, "public/crimson/lib/addons", u.split("/examples/jsm/")[1].split("?")[0]);
    const g = fs.existsSync(f) ? f : cdnFile(u.split("?")[0]);
    return g ? { type: "application/javascript", body: fs.readFileSync(g) } : null;
  }],
  ["https://cdnjs.cloudflare.com/ajax/libs/phaser/**", (u) => { const g = cdnFile(u.split("?")[0]); return g ? { type: "application/javascript", body: fs.readFileSync(g) } : null; }],
  ["https://fonts.googleapis.com/**", () => ({ type: "text/css", body: "" })],
  ["https://w.soundcloud.com/player/api.js**", () => ({ type: "application/javascript", body: process.env.QUIET_SC_API ? fs.readFileSync(process.env.QUIET_SC_API) : SC_API })],
  ["https://w.soundcloud.com/player/?**", () => ({ type: "text/html", body: SC_PAGE })],
  // --old stubs quiet.js out. QUIET_JS=/path/to/quiet.js tries another copy of it.
  ["**/arcade/quiet.js", () => (OLD ? { type: "application/javascript", body: "/* quiet.js stubbed out by --old */" } : process.env.QUIET_JS ? { type: "application/javascript", body: fs.readFileSync(process.env.QUIET_JS) } : null)],
];
// a glob as the browser's fetch interception takes it: only * is a wildcard
const fetchGlob = (g) => g.replace(/\*\*/g, "*");
const globRe = (g) => new RegExp("^" + g.split("**").map((s) => s.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")).join(".*") + "$");
const answer = (url) => { for (const [g, h] of ROUTES) if (globRe(g).test(url)) { const r = h(url); if (r) return r; } return null; };

/* ------------------------------------------------------------------ two ways to drive a page: Playwright, and plain CDP */
// Both give a Tab: reload(), eval(fn, arg), until(fn, arg, ms), tapEl(selector), tap(x, y), key(name), hide(mode), show(mode), close().
class PwTab {
  constructor(page, errors) { this.page = page; this.errors = errors; this.backend = "pw"; }
  static async launch({ open }) {
    const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", ...(open ? ["--autoplay-policy=no-user-gesture-required"] : [])] });
    return {
      newTab: async (url, { init = [] } = {}) => {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
        const page = await ctx.newPage();
        page.setDefaultTimeout(60000);
        const errors = [];
        page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
        page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_|favicon/.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
        await page.addInitScript(tracker);
        for (const s of init) await page.addInitScript(s);
        for (const [g] of ROUTES) await page.route(g, (route) => { const r = answer(route.request().url()); if (r) route.fulfill({ status: 200, contentType: r.type, body: r.body }); else route.continue(); });
        const t = new PwTab(page, errors);
        t.ctx = ctx;
        if (url) await page.goto(url, { waitUntil: "domcontentloaded" });
        return t;
      },
      close: () => browser.close(),
    };
  }
  reload() { return this.page.reload({ waitUntil: "domcontentloaded" }); }
  eval(fn, arg) { return this.page.evaluate(fn, arg); }
  async until(fn, arg, ms = 60000) { await this.page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); }
  tapEl(sel) { return this.page.click(sel, { timeout: 30000 }); }
  tap(x, y) { return this.page.mouse.click(x, y); }
  key(k) { return this.page.keyboard.press(k); }
  async hide(mode) { if (mode === "pagehide") await this.eval(() => window.__qaPage(true, true)); else await this.eval(() => window.__qaHide(true)); }
  async show(mode) { if (mode === "pagehide") await this.eval(() => window.__qaPage(true, false)); else await this.eval(() => window.__qaHide(false)); }
  close() { return this.ctx.close(); }
}

const KEYS = { Enter: [13, "\r"], " ": [32, " "], Escape: [27, ""] };
class CdpTab {
  constructor(b, targetId, sessionId) { this.b = b; this.targetId = targetId; this.sessionId = sessionId; this.errors = []; this.backend = "cdp"; }
  static async launch({ open }) {
    const port = 9400 + Math.floor(Math.random() * 400), dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-cdp-"));
    const proc = spawn(chromium.executablePath(), ["--headless=new", "--no-sandbox", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--window-size=1280,800", "--ignore-certificate-errors", "--no-first-run", "--disable-background-networking", "--disable-sync", "--disable-component-update", "--disable-default-apps",
      "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", ...(open ? ["--autoplay-policy=no-user-gesture-required"] : []), "about:blank"], { stdio: "ignore" });
    let info = null;
    for (let i = 0; i < 100 && !info; i++) { await sleep(150); try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch (e) { /* not up yet */ } }
    if (!info) { proc.kill(); throw new Error("Chromium did not start for CDP"); }
    const ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    const b = { proc, ws, id: 0, pend: new Map(), on: [], dir };
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && b.pend.has(d.id)) { const [res, rej] = b.pend.get(d.id); b.pend.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else b.on.forEach((f) => f(d)); };
    b.send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++b.id; b.pend.set(id, [res, rej]); ws.send(JSON.stringify({ id, method, params, sessionId })); });
    // a blank tab to put on top of the page
    b.blank = (await b.send("Target.createTarget", { url: "about:blank" })).targetId;
    return {
      newTab: async (url, { init = [] } = {}) => {
        const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
        const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
        const t = new CdpTab(b, targetId, sessionId);
        const s = (m, p) => b.send(m, p, sessionId);
        await s("Page.enable"); await s("Runtime.enable");
        await s("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
        await s("Page.addScriptToEvaluateOnNewDocument", { source: `(${tracker})()` });
        for (const src of init) await s("Page.addScriptToEvaluateOnNewDocument", { source: src });
        await s("Fetch.enable", { patterns: ROUTES.map(([g]) => ({ urlPattern: fetchGlob(g) })) });
        b.on.push((d) => {
          if (d.sessionId !== sessionId) return;
          if (d.method === "Runtime.exceptionThrown") t.errors.push("pageerror: " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split("\n")[0]);
          if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") { const x = d.params.args.map((a) => a.value ?? a.description ?? "").join(" "); if (!/Failed to load resource|ERR_|favicon/.test(x)) t.errors.push("console: " + x.slice(0, 200)); }
          if (d.method === "Fetch.requestPaused") {
            const r = answer(d.params.request.url), id = d.params.requestId;
            if (r) s("Fetch.fulfillRequest", { requestId: id, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: r.type }, { name: "Access-Control-Allow-Origin", value: "*" }], body: Buffer.from(r.body).toString("base64") }).catch(() => {});
            else s("Fetch.continueRequest", { requestId: id }).catch(() => {});
          }
        });
        if (url) await s("Page.navigate", { url });
        return t;
      },
      close: async () => { try { ws.close(); } catch (e) { /* closed */ } proc.kill("SIGKILL"); await sleep(200); fs.rmSync(dir, { recursive: true, force: true }); },
    };
  }
  send(m, p) { return this.b.send(m, p, this.sessionId); }
  reload() { return this.send("Page.reload"); }
  async eval(fn, arg) {
    const r = await this.send("Runtime.evaluate", { expression: `(${fn})(${JSON.stringify(arg === undefined ? null : arg)})`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async until(fn, arg, ms = 60000) {
    const end = Date.now() + ms;
    for (;;) { try { if (await this.eval(fn, arg)) return; } catch (e) { /* the page is loading */ } if (Date.now() > end) throw new Error("timeout waiting for " + String(fn).slice(0, 80)); await sleep(100); }
  }
  async tap(x, y) {
    const p = { x, y, button: "left", clickCount: 1 };
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", ...p });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...p });
  }
  async tapEl(sel) {
    await this.until((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel, 30000);
    const [x, y] = await this.eval((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
    await this.tap(x, y);
  }
  async key(k) {
    const [code, text] = KEYS[k] || [k.toUpperCase().charCodeAt(0), k];
    const p = { key: k, code: k.length === 1 ? "Key" + k.toUpperCase() : k, windowsVirtualKeyCode: code };
    await this.send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", text, ...p });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", ...p });
  }
  // real: another tab on top (the page goes hidden, as when you switch tabs or apps). freeze: the page lifecycle (hidden, freeze, resume).
  async hide(mode) {
    if (mode === "freeze") { await this.send("Page.setWebLifecycleState", { state: "frozen" }); return; }
    await this.b.send("Target.activateTarget", { targetId: this.b.blank });
    await this.until(() => document.visibilityState === "hidden", null, 10000);
  }
  async show(mode) {
    if (mode === "freeze") { // the page wakes up but stays hidden until its tab is brought to the front again
      await this.send("Page.setWebLifecycleState", { state: "active" });
      await sleep(300);
      await this.b.send("Target.activateTarget", { targetId: this.b.blank });
      await sleep(300);
    }
    await this.b.send("Target.activateTarget", { targetId: this.targetId });
    await this.until(() => document.visibilityState === "visible", null, 10000);
  }
  async close() { try { await this.b.send("Target.closeTarget", { targetId: this.targetId }); } catch (e) { /* gone */ } }
}

/* ------------------------------------------------------------------ 3. the game pages */
// start(t) does what a player does. sound is what to wait for: "ctx" (a context runs), "song" (also a SoundCloud song plays).
// music is for pages with a song of their own made with chip.js or a scheduler: nothing new is scheduled while hidden.
const click = (sel) => (t) => t.tapEl(sel);
const PAGES = [
  { id: "arcade", path: "/", start: (t) => t.tap(5, 5), sound: "ctx", music: true },
  { id: "fall", path: "/fall/", start: (t) => t.key("Enter"), sound: "ctx", music: true },
  { id: "wild", path: "/wild/", boot: () => document.querySelector("#title") && !document.querySelector("#title").hidden && !document.querySelector("#tpress").hidden, start: (t) => t.key("Enter"), sound: "ctx", music: true, slow: true },
  // Game is a top-level const, and asking for it too soon is an error
  { id: "plungerd", path: "/plungerd/", boot: () => { try { return typeof Game !== "undefined"; } catch (e) { return false; } }, start: (t) => t.tap(640, 400), again: true, sound: "song", music: true, slow: true },
  { id: "crimson", path: "/crimson/", boot: () => !!document.querySelector("#title") && !document.querySelector("#title").classList.contains("hidden"), start: (t) => t.key("Enter"), again: true, sound: "song", slow: true },
  { id: "fish", path: "/fish/", boot: () => !!document.querySelector("#title") && !document.querySelector("#title").hidden, start: click("#freeBtn"), sound: "ctx", slow: true },
  { id: "brawl", path: "/brawl/", start: click("#enter-game"), sound: "ctx" },
  { id: "echo", path: "/echo/", start: click("#start"), sound: "ctx" },
  { id: "lab/plunge", path: "/lab/plunge/", start: click(".card.start .go"), sound: "ctx" },
  { id: "lab/creek", path: "/lab/creek/", start: click(".card.start .go"), sound: "ctx" },
  { id: "lab/tilt", path: "/lab/tilt/", start: click("#play-button"), sound: "ctx" },
  { id: "lab/rules", path: "/lab/rules/", start: click(".card.start .go"), sound: "ctx" },
  { id: "lab/worlds", path: "/lab/worlds/", start: click("#start-button"), sound: "ctx" },
  { id: "moonwell", path: "/moonwell/", start: click("#launch"), sound: "ctx" },
  { id: "neon", path: "/neon/", boot: () => !!document.querySelector("#start"), start: click("#start"), sound: "ctx" },
  { id: "primordia", path: "/primordia/", start: click("#playBtn"), sound: "ctx" },
  { id: "olympus", path: "/olympus/", start: click('button[aria-label="Enable audio"]'), sound: "ctx" },
  { id: "tellme", path: "/tellme/", start: click("#start-btn"), sound: "ctx" },
  // In Full Swing does not load quiet.js. Its own code stops the sound on visibilitychange when it is played flat on a phone (not on pagehide, not in a headset).
  { id: "vr", path: "/vr/", start: click("#playFlat"), sound: "ctx", slow: true, own: true, only: ["emulate", "real"] },
  { id: "tidebreak", path: "/tidebreak/", boot: () => { const b = document.querySelector("#play"); return b && !b.disabled; }, start: click("#play"), sound: "ctx" },
];
// pages that make no sound at all (and so do not load quiet.js): they must never make a context or play anything
const SILENT = [["breakthrough", "/breakthrough/"], ["breakthrough2", "/breakthrough2/"], ["lab", "/lab/"], ["creatures", "/arcade/creatures/"]];

const running = (s) => s.ctxs.filter((x) => x === "running").length;
const quiet = (s) => s.ctxs.every((x) => x !== "running") && s.playing === 0 && s.sc !== true;
const loud = (s) => running(s) > 0 || s.playing > 0 || s.sc === true;
async function waitFor(t, pred, ms) {
  const end = Date.now() + ms;
  let s;
  for (;;) { s = await t.eval(() => window.__qaState()); if (pred(s)) return [true, s]; if (Date.now() > end) return [false, s]; await sleep(100); }
}
const brief = (s) => `ctx [${s.ctxs.join(",")}] media ${s.playing} song ${s.sc}`;

// one page, started once, then hidden and shown the ways in `modes`
async function cycle(P, driver, { policy, modes }) {
  const label = `${P.id} [${driver.name}, ${policy === "open" ? "autoplay allowed" : "normal policy, real tap"}, ${modes.join("+")}]`;
  console.log(`\n-- ${label}`);
  const t = await driver.l.newTab(BASE + P.path);
  const c = (name, ok, detail) => check(`${P.id}: ${name}`, ok, detail);
  const state = () => t.eval(() => window.__qaState());
  try {
    await t.until(() => document.readyState !== "loading", null, 30000);
    // the heavy pages load three.js add-ons from a CDN: if one stalls, load the page again (up to twice)
    if (P.boot) for (let i = 0; ; i++) {
      try { await t.until(P.boot, null, P.slow ? 60000 : 150000); break; }
      catch (e) { if (!P.slow || i >= 2) throw e; console.log("   (the page did not finish loading in 60 s: loading it again)"); await t.reload(); }
    }
    await sleep(P.slow ? 2500 : 800);
    await P.start(t);
    // a song in a SoundCloud player needs the page's own timer (Get Plunger'd waits a second after the first tap)
    const want = P.sound === "song" ? (s) => running(s) > 0 && s.sc === true : loud;
    let [started, s0] = await waitFor(t, want, 12000);
    // a game that was not ready for the first key gets it again, until it makes a context
    for (let i = 0; !started && P.again && s0.ctxs.length === 0 && i < 6; i++) { await P.start(t); [started, s0] = await waitFor(t, want, 6000); }
    c("sound starts", started, brief(s0) + (t.errors.length ? " | " + t.errors.join(" | ") : ""));
    if (!started) return;
    if (!OLD && !P.own) c("quiet.js is loaded", (await state()).quiet, "window.__quiet is missing");
    let first = true;
    for (const mode of modes) {
      const tag = modes.length > 1 ? ` (${mode})` : "";
      const had = await state();
      const was = { ctx: had.ctxs.map((x) => x === "running"), media: had.playing, song: had.sc === true };
      const back = (s) => s.ctxs.every((x, i) => !was.ctx[i] || x === "running") && (!was.media || s.playing > 0) && (!was.song || s.sc === true);
      await t.hide(mode);
      if (mode === "freeze") {
        // a frozen page cannot be asked anything: look after it wakes
        await sleep(800);
        await t.show(mode);
        const [ok, s] = await waitFor(t, back, 8000);
        c("sound is back after the page wakes" + tag, ok, brief(s));
        continue;
      }
      const [silent, s1] = await waitFor(t, quiet, 5000);
      c("silent when hidden" + tag, silent, brief(s1));
      // a page with its own sound control (own: true) is not poked: it has no guard that blocks a raw resume() from outside
      if (!P.own) await t.eval(() => window.__qaPoke());
      await sleep(3000);
      const [still, s2] = await waitFor(t, quiet, 500);
      c((P.own ? "still silent after 3 s" : "still silent after a poke and 3 s") + tag, still, brief(s2));
      if (P.music && first) {
        const a = await state();
        await sleep(2000);
        const b = await state();
        c("no notes are scheduled while hidden" + tag, b.nodes === a.nodes, `${b.nodes - a.nodes} new nodes in 2 s, clock ${b.times.map((x) => x.toFixed(2))}`);
      }
      await t.show(mode);
      const [ok1, s3] = await waitFor(t, back, 8000);
      c("sound is back when visible" + tag, ok1, brief(s3));
      // hide and show in one tick must leave the sound running; show and hide in one tick must leave it silent
      if (mode === "emulate" || mode === "pagehide") {
        const flip = (seq) => t.eval(([m, seq]) => { for (const hide of seq) m === "pagehide" ? window.__qaPage(true, hide) : window.__qaHide(hide); }, [mode, seq]);
        await flip([true, false]);
        await sleep(1200);
        const [ok2, s4] = await waitFor(t, back, 8000);
        c("hide then show in one tick: running" + tag, ok2, brief(s4));
        await flip([true, false, true]);
        const [ok3, s5] = await waitFor(t, quiet, 5000);
        c("hide, show, hide in one tick: silent" + tag, ok3, brief(s5));
        await t.show(mode);
        const [ok4, s6] = await waitFor(t, back, 8000);
        c("and running when shown again" + tag, ok4, brief(s6));
      }
      first = false;
    }
    c("no page errors", t.errors.length === 0, t.errors.join(" | "));
  } catch (e) {
    c("ran to the end", false, e.message.split("\n")[0]);
  } finally {
    await t.close().catch(() => {});
  }
}

async function pages() {
  section = "pages";
  const todo = PAGES.filter((p) => !ONLY || ONLY.includes(p.id));
  // "open" policy: contexts start running by themselves. "normal": they wait for the real tap that start() makes.
  const runs = [];
  const emu = MODES.filter((m) => m === "emulate" || m === "pagehide");
  if (emu.length) runs.push({ driver: "pw", policy: "open", modes: emu });
  if (MODES.includes("tap")) runs.push({ driver: "pw", policy: "normal", modes: ["emulate"] });
  const cdp = MODES.filter((m) => m === "real" || m === "freeze");
  if (cdp.length) runs.push({ driver: "cdp", policy: "normal", modes: cdp });
  const launched = {};
  for (const r of runs) {
    const key = r.driver + r.policy;
    if (launched[key] === undefined) {
      try { launched[key] = { name: r.driver === "pw" ? "playwright" : "cdp", l: await (r.driver === "pw" ? PwTab : CdpTab).launch({ open: r.policy === "open" }) }; }
      catch (e) { check(`the ${r.driver} browser starts`, false, e.message.split("\n")[0]); launched[key] = null; }
    }
  }
  console.log("\n== pages: sound, hidden, visible again");
  try {
    if (!SKIP.includes("pages")) for (const P of todo) for (const r of runs) {
      const modes = P.only ? r.modes.filter((m) => P.only.includes(m)) : r.modes; // a page can be tested in only some of the ways
      if (modes.length && launched[r.driver + r.policy]) await cycle(P, launched[r.driver + r.policy], { ...r, modes });
    }
    // pages that never make sound
    if (!ONLY && !SKIP.includes("silent")) for (const [id, p] of SILENT) {
      const drv = launched["pwopen"] || Object.values(launched).find(Boolean);
      if (!drv) break;
      const t = await drv.l.newTab(BASE + p);
      try {
        await sleep(1500); await t.tap(5, 5); await sleep(500);
        await t.hide("emulate"); await sleep(300); await t.show("emulate");
        const s = await t.eval(() => window.__qaState());
        check(`${id}: a page with no sound makes no context and plays nothing`, s.ctxs.length === 0 && s.playing === 0, brief(s));
      } catch (e) { check(`${id}: ran to the end`, false, e.message.split("\n")[0]); } finally { await t.close().catch(() => {}); }
    }
  } finally {
    for (const k of Object.keys(launched)) if (launched[k]) await launched[k].l.close().catch(() => {});
  }
}

/* ------------------------------------------------------------------ 2. quiet.js on small test pages */
const UNIT_HTML = (n = 1) => `<!doctype html><html><head><meta charset="utf-8">${'<script src="/arcade/quiet.js"></script>'.repeat(n)}<title>quiet</title></head><body>quiet unit page</body></html>`;
// helpers that run in the unit pages
function unitPrelude() {
  window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await __sleep(25); } return !!fn(); };
  window.__wav = () => { // half a second of A440 as a WAV data URL
    const n = 22050, b = new DataView(new ArrayBuffer(44 + n * 2));
    const w = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); b.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
    b.setUint32(24, 44100, true); b.setUint32(28, 88200, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, "data"); b.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) b.setInt16(44 + i * 2, Math.sin(i / 44100 * 2 * Math.PI * 440) * 8000, true);
    let s = ""; new Uint8Array(b.buffer).forEach((x) => (s += String.fromCharCode(x)));
    return "data:audio/wav;base64," + btoa(s);
  };
}
const UNITS = [
  { name: "a context is suspended when hidden, resumed when visible, and resume() waits", init: () => { window.__resumes = 0; let P = AudioContext.prototype; while (!Object.prototype.hasOwnProperty.call(P, "resume")) P = Object.getPrototypeOf(P); const r = P.resume; P.resume = function (...a) { window.__resumes++; return r.apply(this, a); }; }, run: async () => {
    const out = [], ctx = new AudioContext({ sampleRate: 44100 }), o = ctx.createOscillator(); o.connect(ctx.destination); o.start();
    await ctx.resume();
    out.push(["new AudioContext(options) works and runs", ctx.state === "running" && ctx.sampleRate === 44100, ctx.state]);
    out.push(["instanceof AudioContext and BaseAudioContext", ctx instanceof AudioContext && ctx instanceof BaseAudioContext, ""]);
    out.push(["the class keeps its name", AudioContext.name === "AudioContext", AudioContext.name]);
    __qaHide(true);
    out.push(["suspended when hidden", await __until(() => ctx.state === "suspended"), ctx.state]);
    out.push(["quiet says it did it", __quiet.contexts()[0].suspendedByQuiet === true, JSON.stringify(__quiet.contexts())]);
    const calls = window.__resumes;
    const p = ctx.resume();
    out.push(["resume() while hidden returns a promise", p instanceof Promise, ""]);
    await p; await __sleep(300);
    out.push(["resume() while hidden does nothing", ctx.state === "suspended" && window.__resumes === calls, `${ctx.state}, ${window.__resumes - calls} calls reached the browser`]);
    __qaHide(false);
    out.push(["running again when visible", await __until(() => ctx.state === "running"), ctx.state]);
    out.push(["quiet let go of it", __quiet.contexts()[0].suspendedByQuiet === false, ""]);
    return out;
  } },
  { name: "a context the page suspended itself is left alone", run: async () => {
    const out = [], mine = new AudioContext(), game = new AudioContext();
    await mine.resume(); await game.resume(); await game.suspend();
    __qaHide(true); await __sleep(300); __qaHide(false); await __sleep(600);
    out.push(["the quiet one is running again", mine.state === "running", mine.state]);
    out.push(["the page's own suspended one stays suspended", game.state === "suspended", game.state]);
    // the page suspends on hide itself (Reel It In, the Lab): it decides when the sound comes back
    const self = new AudioContext(); await self.resume();
    document.addEventListener("visibilitychange", () => { if (document.hidden) self.suspend(); });
    __qaHide(true); await __sleep(400); __qaHide(false); await __sleep(600);
    out.push(["a context the page suspends on hide stays suspended (the page resumes it)", self.state === "suspended", self.state]);
    await self.resume();
    out.push(["and resume() works once visible", self.state === "running", self.state]);
    return out;
  } },
  { name: "a context made, or resumed, while hidden", run: async () => {
    const out = [];
    __qaHide(true);
    const c = new AudioContext(); const o = c.createOscillator(); o.connect(c.destination); o.start();
    await c.resume(); await __sleep(800);
    out.push(["a context made while hidden does not run", c.state !== "running", c.state]);
    __qaHide(false);
    out.push(["it runs when visible", await __until(() => c.state === "running"), c.state]);
    return out;
  } },
  { name: "hide and show in one tick, and a resume that ends after the hide", run: async () => {
    const out = [], c = new AudioContext(); await c.resume();
    __qaHide(true); __qaHide(false);
    await __sleep(800);
    out.push(["hide then show: running", c.state === "running", c.state]);
    __qaHide(true); __qaHide(false); __qaHide(true);
    await __sleep(800);
    out.push(["hide, show, hide: suspended", c.state === "suspended", c.state]);
    __qaHide(false); await __until(() => c.state === "running");
    for (let i = 0; i < 6; i++) { __qaHide(true); await __sleep(i * 7); __qaHide(false); await __sleep(i * 5); }
    out.push(["six quick toggles end running", await __until(() => c.state === "running", 3000), c.state]);
    // a page that calls resume() just before the hide: it must not end up running
    const d = new AudioContext(); await d.suspend();
    const r = d.resume(); __qaHide(true); await r; await __sleep(600);
    out.push(["a resume that ends after the hide is put back to sleep", d.state === "suspended", d.state]);
    __qaHide(false);
    out.push(["and it runs when visible (the page asked for it)", await __until(() => d.state === "running"), d.state]);
    return out;
  } },
  { name: "a context the game suspended stays suspended when the page returns, and resume() is held while hidden", run: async () => {
    const out = [], c = new AudioContext(), d = new AudioContext();
    await c.resume(); await d.resume(); await c.suspend(); // the game put c to sleep itself
    __qaHide(true); await __sleep(300);
    await c.resume(); await d.resume(); await __sleep(300); // the game asks for sound while hidden
    out.push(["resume() while hidden changes nothing", c.state === "suspended" && d.state === "suspended", c.state + "," + d.state]);
    __qaHide(false); await __sleep(600);
    out.push(["after the return the one quiet stopped runs", d.state === "running", d.state]);
    out.push(["the one the game stopped stays stopped", c.state === "suspended", c.state]);
    return out;
  } },
  { name: "many short-lived contexts", run: async () => {
    const out = [];
    for (let i = 0; i < 40; i++) { const c = new AudioContext(); const o = c.createOscillator(); o.connect(c.destination); o.start(); o.stop(c.currentTime + 0.01); await c.close(); }
    // tracked is read before contexts(), which prunes the closed ones itself
    out.push(["closed contexts are forgotten", __quiet.tracked <= 33, String(__quiet.tracked)]);
    const keep = [new AudioContext(), new AudioContext()];
    await Promise.all(keep.map((c) => c.resume()));
    __qaHide(true); await __sleep(400);
    out.push(["both live ones are suspended", keep.every((c) => c.state === "suspended"), keep.map((c) => c.state).join()]);
    __qaHide(false); await __sleep(600);
    out.push(["and running again", keep.every((c) => c.state === "running"), keep.map((c) => c.state).join()]);
    const off = new OfflineAudioContext(1, 4410, 44100), b = await off.startRendering();
    out.push(["OfflineAudioContext is untouched", b.length === 4410, ""]);
    return out;
  } },
  { name: "pagehide and pageshow, freeze and resume", run: async () => {
    const out = [], c = new AudioContext(); await c.resume();
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    out.push(["suspended on pagehide", await __until(() => c.state === "suspended"), c.state]);
    out.push(["__quiet.hidden is true", __quiet.hidden === true, ""]);
    await c.resume(); await __sleep(200);
    out.push(["resume() after pagehide does nothing", c.state === "suspended", c.state]);
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    out.push(["running on pageshow (persisted)", await __until(() => c.state === "running"), c.state]);
    document.dispatchEvent(new Event("freeze"));
    out.push(["suspended on freeze", await __until(() => c.state === "suspended"), c.state]);
    document.dispatchEvent(new Event("resume"));
    out.push(["running on resume", await __until(() => c.state === "running"), c.state]);
    // pagehide, then the tab becomes visible with no pageshow: the visibilitychange brings it back
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    await __until(() => c.state === "suspended");
    document.dispatchEvent(new Event("visibilitychange"));
    out.push(["a visible page is not stuck hidden", await __until(() => c.state === "running"), c.state]);
    return out;
  } },
  { name: "<audio> and new Audio()", run: async () => {
    const out = [], url = __wav(), a = new Audio(url), muted = new Audio(url), paged = new Audio(url);
    a.loop = muted.loop = paged.loop = true; muted.muted = true;
    await a.play(); await muted.play(); await paged.play();
    __qaHide(true); await __sleep(200);
    out.push(["the audible one is paused when hidden", a.paused && paged.paused, `${a.paused} ${paged.paused}`]);
    out.push(["a muted one is left alone", !muted.paused, ""]);
    const p = a.play();
    out.push(["play() while hidden returns a promise", p instanceof Promise, ""]);
    await p; await __sleep(200);
    out.push(["and does not play", a.paused, ""]);
    paged.pause(); // the page stops it while hidden
    __qaHide(false); await __sleep(400);
    out.push(["it plays when visible", !a.paused, ""]);
    out.push(["one the page paused stays paused", paged.paused, ""]);
    out.push(["media() lists the elements", Array.isArray(__quiet.media()) && __quiet.media().length >= 3, JSON.stringify(__quiet.media())]);
    const el = document.createElement("audio"); el.src = url; el.loop = true; document.body.append(el);
    await el.play(); __qaHide(true); await __sleep(200);
    out.push(["an <audio> in the page is paused too", el.paused, ""]);
    __qaHide(false); await __sleep(300);
    out.push(["and plays again", !el.paused, ""]);
    return out;
  } },
  { name: "speechSynthesis is cancelled when hidden", run: async () => {
    let cancelled = 0;
    Object.defineProperty(speechSynthesis, "speaking", { configurable: true, get: () => true });
    speechSynthesis.cancel = () => { cancelled++; };
    __qaHide(true); await __sleep(100);
    return [["cancel() was called", cancelled === 1, String(cancelled)]];
  } },
  { name: "an interrupted context (iOS) is resumed when visible", init: () => { window.__resumes = 0; let P = AudioContext.prototype; while (!Object.prototype.hasOwnProperty.call(P, "resume")) P = Object.getPrototypeOf(P); const r = P.resume; P.resume = function (...a) { window.__resumes++; return r.apply(this, a); }; }, run: async () => {
    const c = new AudioContext(); await c.resume();
    const before = window.__resumes;
    Object.defineProperty(c, "state", { configurable: true, get: () => "interrupted" });
    __qaHide(false);
    await __sleep(200);
    return [["resume() is called for an interrupted context", window.__resumes > before, `${window.__resumes - before} calls`]];
  } },
  { name: "no AudioContext at all", init: () => { delete window.AudioContext; delete window.webkitAudioContext; }, run: async () => {
    __qaHide(true); __qaHide(false);
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })); window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    return [["quiet.js loads and nothing throws", !!window.__quiet && typeof AudioContext === "undefined", ""], ["contexts() is empty", __quiet.contexts().length === 0, ""]];
  } },
  { name: "included twice", html: UNIT_HTML(2), run: async () => {
    const c = new AudioContext(); await c.resume();
    return [["a context is known once", __quiet.contexts().length === 1, String(__quiet.contexts().length)], ["__quiet is read-only", (() => { try { window.__quiet = 1; } catch (e) { /* strict */ } return typeof __quiet === "object"; })(), ""]];
  } },
  { name: "SoundCloud players are paused and played", html: UNIT_HTML().replace("<body>", `<body><iframe id="song" title="song" src="https://w.soundcloud.com/player/?url=x&auto_play=true"></iframe><iframe id="other" title="other" src="https://w.soundcloud.com/player/?url=y"></iframe><script src="https://w.soundcloud.com/player/api.js"></script>`), run: async () => {
    const out = [], w = SC.Widget(document.getElementById("song"));
    const playing = () => __qa.sc;
    out.push(["the song plays", await __until(() => playing() === true, 6000), String(playing())]);
    // a widget the page made, and one it did not: the same instance comes back
    out.push(["SC.Widget gives the page's widget back", SC.Widget(document.getElementById("song")) === w, ""]);
    __qaHide(true);
    out.push(["paused when hidden", await __until(() => playing() === false, 6000), String(playing())]);
    __qaHide(false);
    out.push(["plays when visible", await __until(() => playing() === true, 6000), String(playing())]);
    // a game that starts its song again while hidden (it changes song) is stopped again
    __qaHide(true); await __until(() => playing() === false, 6000);
    w.play();
    out.push(["a song started while hidden is paused again", await __until(() => playing() === false, 6000) && (await __sleep(2300), playing() === false), String(playing())]);
    __qaHide(false);
    out.push(["and plays when visible", await __until(() => playing() === true, 6000), String(playing())]);
    // a song the visitor paused stays paused
    w.pause(); await __until(() => playing() === false);
    __qaHide(true); await __sleep(400); __qaHide(false); await __sleep(600);
    out.push(["a song the visitor paused stays paused", playing() === false, String(playing())]);
    return out;
  } },
  { name: "a SoundCloud script that loads after the page is hidden", html: UNIT_HTML().replace("<body>", `<body><iframe id="song" title="song" src="https://w.soundcloud.com/player/?url=x&auto_play=true"></iframe>`), run: async () => {
    const out = [];
    out.push(["the song plays", await __until(() => __qa.sc === true, 6000), String(__qa.sc)]);
    __qaHide(true);
    // on a slow phone SoundCloud's script arrives after the page was hidden: nothing could be paused at the hide
    await __sleep(800);
    const s = document.createElement("script"); s.src = "https://w.soundcloud.com/player/api.js"; document.head.append(s);
    out.push(["the song is paused once the script has loaded", await __until(() => __qa.sc === false, 8000), String(__qa.sc)]);
    __qaHide(false);
    out.push(["and plays when visible", await __until(() => __qa.sc === true, 6000), String(__qa.sc)]);
    return out;
  } },
];
async function unit() {
  section = "unit";
  console.log("\n== unit: public/arcade/quiet.js on small pages");
  const launched = await PwTab.launch({ open: true });
  try {
    for (const u of UNITS) {
      console.log(`-- ${u.name}`);
      const t = await launched.newTab(null, { init: [`(${unitPrelude})()`, ...(u.init ? [`(${u.init})()`] : [])] });
      await t.page.route("**/__quiet/unit.html", (r) => r.fulfill({ status: 200, contentType: "text/html", body: u.html || UNIT_HTML() }));
      try {
        await t.page.goto(BASE + "/__quiet/unit.html");
        const rows = await t.eval(u.run);
        for (const [name, ok, detail] of rows) check(name, ok, detail);
        check("no page errors", t.errors.length === 0, t.errors.join(" | "));
      } catch (e) { check("ran to the end", false, e.message.split("\n")[0]); } finally { await t.close().catch(() => {}); }
    }
  } finally { await launched.close(); }
}

/* ------------------------------------------------------------------ run */
let code = 0;
try {
  if (!OLD && !SKIP.includes("scan") && !ONLY) scan();
  if (!OLD && !SKIP.includes("unit") && !ONLY) await unit();
  if (!SKIP.includes("pages") || !SKIP.includes("silent")) await pages();
} catch (e) {
  console.error(e);
  code = 1;
}
const failed = results.filter((r) => !r.ok);
console.log(`\nquiet: ${results.length - failed.length} of ${results.length} checks passed${OLD ? " (--old: quiet.js stubbed out)" : ""}`);
if (failed.length) {
  console.log("failed:");
  for (const sct of ["scan", "unit", "pages"]) {
    const f = failed.filter((r) => r.section === sct);
    if (f.length) console.log(`  ${sct}: ${f.length}\n` + f.map((r) => "    " + r.name + (r.detail ? "  (" + r.detail + ")" : "")).join("\n"));
  }
}
process.exit(OLD ? 0 : failed.length || code ? 1 : 0);
