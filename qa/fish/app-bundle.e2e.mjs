// The app bundle in a browser, with no network: builds apps/fish/www, serves it at the root of its own origin
// (like https://localhost in the app), blocks every request to another origin, and opens it at 390x844 with a fake
// window.Capacitor that says "native Android" and records every plugin call.
// Checks: the title shows, <html data-build="store">, no Switch game button, arcade link or arcade text (Switch game,
// Back to the arcade, GET PLUNGER'D) is visible, no request leaves the origin, and no file is missing.
// It also checks the native bridge (js/native.js loads, the splash hides, the back button has a listener) and the game
// fonts. Then it opens the bundle as the iOS app on an iPad and on a Mac (820x1180): the title fits, an iPad gets the
// touch controls, and a Mac gets the mouse and keys with no motion play. Each check fails the run when it does not hold.
//
// Usage: NODE_PATH=qa/browser/node_modules node qa/fish/app-bundle.e2e.mjs   (SHOTS=dir saves a screenshot,
// PORT=n serves the bundle on that port; the default is a free port). No other server is needed.
// Exit code 1 on any failed check.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP = path.join(ROOT, "apps/fish");
const WWW = path.join(APP, "www");
const SHOTS = process.env.SHOTS || "";

const results = [];
const ok = (name) => results.push({ s: "ok", name });
const fail = (name, why) => results.push({ s: "FAIL", name, why });
const check = (name, pass, why) => (pass ? ok(name) : fail(name, why));

// 1. Build the bundle (it runs the bundle check too).
try {
  const out = execFileSync(process.execPath, [path.join(APP, "scripts/build-www.mjs")], { cwd: APP, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const tail = out.trim().split("\n").filter((l) => /^www:|check:www|^warning:/.test(l));
  for (const l of tail) console.log("  build: " + l);
  ok("build:www and check:www pass");
} catch (e) {
  console.log(String(e.stdout || "") + String(e.stderr || ""));
  fail("build:www and check:www pass", "the build or the bundle check failed (see above)");
  report();
}

// What the bundle holds decides which checks can run yet.
const has = (rel) => fs.existsSync(path.join(WWW, rel));
const hasNative = has("js/native.js");
const fontFiles = has("fonts") ? fs.readdirSync(path.join(WWW, "fonts")).filter((f) => f.endsWith(".woff2")) : [];

// 2. Serve www/ at the root of an origin.
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".mp4": "video/mp4", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
const served = [];
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(WWW, path.normalize(rel).replace(/^([/\\])+/, ""));
  if (!file.startsWith(WWW) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { served.push({ rel, status: 404 }); res.writeHead(404); res.end("not found"); return; }
  served.push({ rel, status: 200 });
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(Number(process.env.PORT) || 0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

// 3. The fake Capacitor bridge. It runs before any page script, like the one the native app puts in.
function fakeCapacitor(platform) {
  const calls = (window.__capCalls = []);
  const listeners = (window.__capListeners = []);
  const answers = { get: { value: null }, keys: { keys: [] }, isSupported: { isSupported: true }, isKeptAwake: { isKeptAwake: false }, getInfo: { name: "Reel It In", id: "systems.uptick.reelitin", version: "1.0", build: "1" }, getState: { isActive: true } };
  const plugin = (name, methods) => {
    const p = {};
    for (const m of methods) p[m] = (...args) => { calls.push({ plugin: name, method: m, args: JSON.parse(JSON.stringify(args.filter((a) => typeof a !== "function"))) }); return Promise.resolve(answers[m]); };
    p.addListener = (event, fn) => { calls.push({ plugin: name, method: "addListener", args: [event] }); listeners.push({ plugin: name, event, fn }); return Promise.resolve({ remove: () => Promise.resolve() }); };
    p.removeAllListeners = () => Promise.resolve();
    return p;
  };
  const Plugins = {
    App: plugin("App", ["minimizeApp", "exitApp", "getInfo", "getState", "getLaunchUrl"]),
    Haptics: plugin("Haptics", ["impact", "notification", "vibrate", "selectionStart", "selectionChanged", "selectionEnd"]),
    SplashScreen: plugin("SplashScreen", ["hide", "show"]),
    SystemBars: plugin("SystemBars", ["hide", "show", "setStyle", "setAnimation"]),
    KeepAwake: plugin("KeepAwake", ["keepAwake", "allowSleep", "isSupported", "isKeptAwake"]),
    Preferences: plugin("Preferences", ["get", "set", "remove", "keys", "clear", "configure"]),
  };
  window.Capacitor = {
    platform, isNative: true, Plugins,
    isNativePlatform: () => true,
    getPlatform: () => platform,
    isPluginAvailable: (name) => name in Plugins,
    registerPlugin: (name) => Plugins[name] || plugin(name, []),
    convertFileSrc: (u) => u,
  };
}

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const offOrigin = [];
await ctx.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith(ORIGIN + "/") || url === ORIGIN) return route.continue();
  offOrigin.push(url);
  return route.abort("blockedbyclient");
});
await ctx.addInitScript(fakeCapacitor, "android");
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });

// 4. Open the page and wait for the title.
await page.goto(ORIGIN + "/");
let titleShown = true;
try { await page.waitForSelector("#title:not([hidden])", { timeout: 60000 }); } catch { titleShown = false; }
check("the title shows (within 60 s on SwiftShader)", titleShown, "the title did not show");
await page.waitForTimeout(1500);
if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "app-bundle-title.png") }); }

// the painted style draws the title in Georgia, so ask for the game fonts by name to see that they load
const fontsAsked = await page.evaluate(async () => {
  if (!document.fonts) return [];
  const faces = [...(await document.fonts.load('40px "Alfa Slab One"')), ...(await document.fonts.load('800 16px "Nunito"'))];
  return faces.map((f) => `${f.family.replace(/"/g, "")}:${f.status}`);
});
const state = await page.evaluate(() => {
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0; };
  const text = document.body.innerText || "";
  return {
    build: document.documentElement.dataset.build || null,
    switchVisible: [...document.querySelectorAll("[data-switch]")].filter(visible).length,
    arcadeLinkVisible: [...document.querySelectorAll('a[href="/"], [data-store-hidden]')].filter(visible).length,
    fullscreenVisible: [...document.querySelectorAll("[data-fullscreen]")].filter(visible).length,
    arcadeText: (text.match(/Switch game|Back to the arcade|PLUNGER['’]D/gi) || []).join(", "),
    kicker: document.querySelector("#tkick")?.textContent || "",
    calls: window.__capCalls || [],
    secure: window.isSecureContext,
  };
});

check('<html> has data-build="store"', state.build === "store", `data-build is ${state.build}`);
check("no Switch game button is visible", state.switchVisible === 0, `${state.switchVisible} visible`);
check("no link to the arcade is visible", state.arcadeLinkVisible === 0, `${state.arcadeLinkVisible} visible`);
check("no arcade words in the visible text (Switch game, Back to the arcade, PLUNGER'D)", !state.arcadeText,
  `the page shows "${state.arcadeText}"; the title kicker says "${state.kicker}". A store build must hide it (main.js writes the kicker: it must check the store flag).`);
check("no Fullscreen button is visible", state.fullscreenVisible === 0, `${state.fullscreenVisible} visible`);
check("no request left the origin", offOrigin.length === 0, offOrigin.slice(0, 5).join(", "));
const missing = served.filter((s) => s.status === 404 && s.rel !== "/favicon.ico");
check("no request got a missing file", missing.length === 0, missing.map((m) => m.rel).join(", "));
check("the page is a secure context (motion needs it)", state.secure, "isSecureContext is false");
check("no script errors", errors.length === 0, errors.slice(0, 3).join(" | "));

// 5. The native bridge and the fonts.
const native = (name, pass, why) => (pass ? ok(name) : fail(name, hasNative ? why : "public/fish/js/native.js is not in the bundle"));
native("js/native.js loads", served.some((s) => s.rel === "/js/native.js" && s.status === 200), "js/native.js was not requested");
const hides = state.calls.filter((c) => c.plugin === "SplashScreen" && c.method === "hide").length;
native("the splash screen hides once the title is ready", hides >= 1, `SplashScreen.hide was called ${hides} times`);
native("the game listens for the Android back button", state.calls.some((c) => c.plugin === "App" && c.method === "addListener" && c.args[0] === "backButton"), "no App backButton listener");
const fontServed = served.filter((s) => s.rel.startsWith("/fonts/") && s.status === 200).map((s) => s.rel);
check("the game fonts load from fonts/", fontFiles.length > 0 && fontsAsked.includes("Alfa Slab One:loaded") && fontsAsked.includes("Nunito:loaded") && fontServed.length > 0, `fonts: ${fontsAsked.join(", ") || "none"}; served: ${fontServed.join(", ") || "none"}`);

// 6. The same bundle in the iOS app on an iPad and on a Mac ("Designed for iPad"), at the iPad portrait size.
// The Mac run reports touch points too, as the Mac web view can: only the flag that MainViewController sets on a Mac
// (window.__reelItInMac) may turn on the computer controls.
async function appleRun(name, { mac }) {
  const c = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: !mac, hasTouch: true });
  await c.route("**/*", (route) => (route.request().url().startsWith(ORIGIN + "/") ? route.continue() : route.abort("blockedbyclient")));
  await c.addInitScript(fakeCapacitor, "ios");
  if (mac) await c.addInitScript(() => { window.__reelItInMac = true; });
  const p = await c.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("console: " + m.text()); });
  await p.goto(ORIGIN + "/");
  let shown = true;
  try { await p.waitForSelector("#title:not([hidden])", { timeout: 60000 }); } catch { shown = false; }
  check(`${name}: the title shows`, shown, "the title did not show");
  await p.waitForTimeout(1000);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `app-bundle-${mac ? "mac" : "ipad"}-title.png`) });
  const fit = await p.evaluate(() => {
    const W = innerWidth, H = innerHeight, out = [];
    for (const el of document.querySelectorAll("#title button, #title h1")) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)) out.push(el.id || el.textContent.trim().slice(0, 20));
    }
    return out;
  });
  check(`${name}: the title buttons are inside the screen`, fit.length === 0, fit.join(", "));
  if (shown) { await p.click("#setBtn"); await p.waitForTimeout(300); }
  const st = await p.evaluate(() => ({
    tab: document.querySelector("#tabT")?.textContent || "",
    inputOff: document.querySelector("#optInput")?.disabled,
    buzz: document.querySelector("#hapticNote")?.textContent || "",
    help: document.querySelector("#helpT")?.textContent || "",
  }));
  if (mac) {
    check(`${name}: the help names the mouse`, st.tab === "Touch and mouse" && /mouse/i.test(st.help), `tab "${st.tab}"`);
    check(`${name}: motion play is off`, st.inputOff === true, "the Controls list can pick Motion");
    check(`${name}: Settings says a Mac cannot buzz`, st.buzz === "This Mac cannot buzz.", `"${st.buzz}"`);
  } else {
    check(`${name}: the help says Touch`, st.tab === "Touch", `tab "${st.tab}"`);
    check(`${name}: the help has no mouse words`, !/mouse/i.test(st.help), "the touch help names the mouse");
  }
  check(`${name}: no script errors`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await c.close();
}
await appleRun("iPad", { mac: false });
await appleRun("Mac", { mac: true });

await browser.close();
server.close();
report();

function report() {
  console.log("");
  for (const r of results) console.log(`${r.s.padEnd(8)} ${r.name}${r.why ? "  -- " + r.why : ""}`);
  const n = (s) => results.filter((r) => r.s === s).length;
  console.log(`\napp-bundle: ${n("ok")} ok, ${n("FAIL")} failed`);
  process.exit(n("FAIL") ? 1 : 0);
}
