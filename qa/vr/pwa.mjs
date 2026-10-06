// Checks what installs and ships In Full Swing: the web manifest and its icons, the service worker (version, precache
// list, control, offline start), privacy.html, assetlinks.json and its Vercel header, quest/twa-manifest.json and the
// Android patch. Self-contained: it serves public/ itself on a random port and does not use lib.mjs.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/pwa.mjs
// PWA_PUBLIC=<dir> serves and checks another copy of public/ instead.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { readFile, readdir, stat } from "fs/promises";
import http from "http";
import path from "path";
import vm from "vm";
import { VERSION, PACKAGE_ID } from "../../public/vr/js/config.js";
import { patchGradle, patchManifest, check as checkAndroid } from "../../quest/patch-android.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUB = process.env.PWA_PUBLIC ? path.resolve(process.env.PWA_PUBLIC) : path.join(ROOT, "public");
const HOST = "arcade.uptick.systems";

let fails = 0;
const pass = (name) => console.log("PASS: " + name);
const info = (msg) => console.log("INFO: " + msg);
async function test(name, fn) {
  const bad = [];
  try { await fn((ok, msg) => { if (!ok) bad.push(msg); }); } catch (e) { bad.push("threw " + (e.stack || e)); }
  if (bad.length) { fails++; console.log("FAIL " + name + ":\n  " + bad.join("\n  ")); } else pass(name);
}
const exists = async (p) => { try { return (await stat(p)).isFile(); } catch (e) { return false; } };
const readJSON = async (p) => JSON.parse(await readFile(p, "utf8"));
// PNG width and height from the IHDR chunk
const pngSize = (buf) => (buf.slice(1, 4).toString() === "PNG" ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : null);
// a site path ("/vr/icons/x.png") to the file under public/
const onDisk = (p) => path.join(PUB, decodeURIComponent(p));

/* ---------------- web manifest and icons ---------------- */
const manifest = await readJSON(path.join(PUB, "vr/manifest.webmanifest"));
const MURL = "https://" + HOST + "/vr/manifest.webmanifest";
await test("manifest fields", async (ok) => {
  ok(manifest.name === "In Full Swing", "name is " + manifest.name);
  ok(manifest.short_name === "Full Swing" && manifest.short_name.length <= 12, "short_name is " + manifest.short_name);
  ok(manifest.start_url === "/vr/?source=pwa", "start_url is " + manifest.start_url);
  ok(manifest.scope === "/vr/", "scope is " + manifest.scope);
  const start = new URL(manifest.start_url, MURL), scope = new URL(manifest.scope, MURL);
  ok(start.origin === scope.origin && start.pathname.startsWith(scope.pathname), "start_url is outside the scope");
  ok(manifest.display === "standalone", "display is " + manifest.display);
  ok(manifest.background_color === "#1a1020", "background_color is " + manifest.background_color);
  ok(manifest.theme_color === "#e0482c", "theme_color is " + manifest.theme_color);
  ok(Array.isArray(manifest.categories) && manifest.categories.includes("games"), "categories has no games");
  if (manifest.id) ok(new URL(manifest.id, MURL).pathname.startsWith(scope.pathname), "id is outside the scope");
});
await test("manifest icons", async (ok) => {
  const icons = manifest.icons || [];
  const want = [["192x192", "any"], ["512x512", "any"], ["512x512", "maskable"]];
  for (const [sizes, purpose] of want) ok(icons.some((i) => i.sizes === sizes && (i.purpose || "any").split(" ").includes(purpose)), "no " + sizes + " " + purpose + " icon");
  for (const ic of icons) {
    const u = new URL(ic.src, MURL);
    ok(u.origin === "https://" + HOST && u.pathname.startsWith("/vr/"), ic.src + " is not under /vr/");
    ok(ic.type === "image/png", ic.src + " type is " + ic.type);
    const file = onDisk(u.pathname);
    if (!(await exists(file))) { ok(false, ic.src + " is missing on disk"); continue; }
    const size = pngSize(await readFile(file));
    ok(size && size.w + "x" + size.h === ic.sizes, ic.src + " is " + (size ? size.w + "x" + size.h : "not a PNG") + ", the manifest says " + ic.sizes);
  }
});

/* ---------------- service worker, read in Node ---------------- */
const swSrc = await readFile(path.join(PUB, "vr/sw.js"), "utf8");
// run sw.js in a sandbox with a stub worker scope, then read its constants
const sandbox = { self: { location: { href: "https://" + HOST + "/vr/sw.js", origin: "https://" + HOST }, addEventListener() {} }, URL, Request: class {} };
vm.createContext(sandbox);
vm.runInContext(swSrc + "\n;globalThis.__sw = { VERSION, CACHE, PRECACHE };", sandbox);
const SW = sandbox.__sw;
const precachePaths = SW.PRECACHE.map((u) => new URL(u, "https://" + HOST + "/vr/sw.js").pathname);
await test("sw.js version and cache name", async (ok) => {
  ok(SW.VERSION === VERSION, "sw.js VERSION " + SW.VERSION + " is not config VERSION " + VERSION);
  ok(SW.CACHE.includes(VERSION), "cache name " + SW.CACHE + " does not include the version");
  ok(!/\bimportScripts\s*\(|^\s*import\s/m.test(swSrc), "sw.js must stay a classic worker (no import, no importScripts)");
});
await test("sw.js precache list", async (ok) => {
  for (const p of precachePaths) ok(await exists(onDisk(p)), "precache URL " + p + " is missing on disk");
  ok(new Set(precachePaths).size === precachePaths.length, "the precache list has duplicates");
  for (const p of ["/vr/index.html", "/vr/manifest.webmanifest", "/vr/privacy.html", "/wild/models/king.glb"]) ok(precachePaths.includes(p), p + " is not precached");
  for (const ic of manifest.icons) ok(precachePaths.includes(new URL(ic.src, MURL).pathname), ic.src + " is not precached");
  // every script the page can load must be precached, or the game cannot start offline
  const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])))).flat();
  for (const sub of ["vr/js", "vr/lib"]) {
    for (const f of await walk(path.join(PUB, sub))) {
      if (!f.endsWith(".js")) continue;
      const p = "/" + path.relative(PUB, f).split(path.sep).join("/");
      ok(precachePaths.includes(p), p + " is on disk but not in the sw.js precache list");
    }
  }
});

/* ---------------- privacy, assetlinks, vercel.json ---------------- */
await test("assetlinks.json", async (ok) => {
  const links = await readJSON(path.join(PUB, ".well-known/assetlinks.json"));
  ok(Array.isArray(links) && links.length >= 1, "not a non-empty array");
  const e = (links || []).find((x) => x && x.target && x.target.package_name === PACKAGE_ID);
  ok(e, "no entry for " + PACKAGE_ID);
  if (!e) return;
  ok(Array.isArray(e.relation) && e.relation.includes("delegate_permission/common.handle_all_urls"), "relation lacks handle_all_urls");
  ok(e.target.namespace === "android_app", "namespace is " + e.target.namespace);
  const fp = e.target.sha256_cert_fingerprints;
  ok(Array.isArray(fp) && fp.length >= 1, "no fingerprints");
  for (const f of fp || []) ok(f === "REPLACE_WITH_YOUR_SHA256_FINGERPRINT" || /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f), "bad fingerprint " + f);
  if ((fp || []).includes("REPLACE_WITH_YOUR_SHA256_FINGERPRINT")) info("assetlinks.json still has the fingerprint placeholder (see quest/README.md)");
});
await test("vercel.json", async (ok) => {
  const v = await readJSON(path.join(ROOT, "vercel.json"));
  ok(v.outputDirectory === "public" && v.framework === null, "outputDirectory or framework changed");
  const rule = (v.headers || []).find((h) => h.source === "/.well-known/assetlinks.json");
  ok(rule && rule.headers.some((h) => h.key.toLowerCase() === "content-type" && h.value === "application/json"), "no Content-Type application/json header for assetlinks.json");
});

/* ---------------- quest/twa-manifest.json ---------------- */
// every field bubblewrap-core 1.24.1 reads (TwaManifest constructor) or writes (toJson), so a typo shows up here
const TWA_KEYS = ["packageId", "applicationId", "host", "name", "launcherName", "display", "themeColor", "themeColorDark", "navigationColor", "navigationColorDark", "navigationDividerColor", "navigationDividerColorDark", "backgroundColor", "enableNotifications", "enableMicrophone", "enableXRScene", "startUrl", "iconUrl", "maskableIconUrl", "monochromeIconUrl", "splashScreenFadeOutDuration", "signingKey", "appVersion", "appVersionName", "appVersionCode", "shortcuts", "generatorApp", "webManifestUrl", "fallbackType", "features", "alphaDependencies", "enableSiteSettingsShortcut", "isChromeOSOnly", "isMetaQuest", "horizonOSAppMode", "fullScopeUrl", "minSdkVersion", "shareTarget", "orientation", "fingerprints", "serviceAccountJsonFile", "additionalTrustedOrigins", "retainedBundles", "protocolHandlers", "fileHandlers", "launchHandlerClientMode", "displayOverride"];
await test("twa-manifest.json", async (ok) => {
  const t = await readJSON(path.join(ROOT, "quest/twa-manifest.json"));
  for (const k of Object.keys(t)) ok(TWA_KEYS.includes(k), "unknown field " + k);
  ok(t.packageId === PACKAGE_ID, "packageId is " + t.packageId);
  ok(t.packageId.split(".").length >= 2 && t.packageId.split(".").every((s) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)), "packageId is not a valid Android package");
  ok(t.host === HOST, "host is " + t.host);
  ok(t.name === manifest.name && t.name.length <= 50, "name is " + t.name);
  ok(t.launcherName === "Full Swing" && t.launcherName.length <= 12, "launcherName is " + t.launcherName);
  ok(t.startUrl === manifest.start_url, "startUrl " + t.startUrl + " is not the web manifest start_url");
  ok(t.fullScopeUrl === "https://" + HOST + manifest.scope, "fullScopeUrl is " + t.fullScopeUrl);
  ok(t.display === "standalone" && t.isMetaQuest === true && t.horizonOSAppMode === "immersive", "not an immersive Meta Quest app");
  ok(t.enableXRScene === true, "XR scene (USE_SCENE) is off: the mixed-reality opening needs planes and meshes");
  ok(t.enableMicrophone === false && t.enableNotifications === false, "asks for the microphone or notifications");
  ok(!(t.features && t.features.horizonBilling && t.features.horizonBilling.enabled), "Horizon Billing is on");
  ok(t.features && t.features.horizonPlatformSDK && t.features.horizonPlatformSDK.enabled === true, "horizonPlatformSDK is off (init --metaquest turns it on)");
  ok(t.appVersion === VERSION && t.appVersionName === VERSION, "app version is " + t.appVersion + ", config VERSION is " + VERSION);
  ok(Number.isInteger(t.appVersionCode) && t.appVersionCode >= 1, "appVersionCode is " + t.appVersionCode);
  ok(t.minSdkVersion >= 29 && t.minSdkVersion <= 34, "minSdkVersion " + t.minSdkVersion + " is outside the Store range 29..34");
  ok(t.themeColor.toLowerCase() === manifest.theme_color && t.backgroundColor.toLowerCase() === manifest.background_color, "colours differ from the web manifest");
  ok(t.signingKey && t.signingKey.alias, "no signing key alias");
  for (const k of ["iconUrl", "maskableIconUrl", "webManifestUrl"]) {
    const u = new URL(t[k]);
    ok(u.protocol === "https:" && u.host === HOST, k + " is not on https://" + HOST);
    ok(await exists(onDisk(u.pathname)), k + " " + u.pathname + " is missing on disk");
  }
  const big = pngSize(await readFile(onDisk(new URL(t.iconUrl).pathname)));
  ok(big && big.w >= 512, "iconUrl is smaller than the 512 px Bubblewrap needs");
});

/* ---------------- quest/patch-android.mjs ---------------- */
// Fixtures in the shape Bubblewrap 1.24.1 generates for an immersive Meta Quest app (template_project, isMetaQuest)
const GRADLE = `android {
        compileSdkVersion 32
    namespace "com.cottagearcade.fullswing"
    defaultConfig {
        applicationId "com.cottagearcade.fullswing"
        minSdkVersion 23
            targetSdkVersion 32
        versionCode 1
        versionName "1.0.0"
    }
}`;
const MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.cottagearcade.fullswing">
    <uses-permission android:name="com.oculus.permission.USE_SCENE"/>
    <uses-permission android:name="com.oculus.permission.HAND_TRACKING" />
    <uses-feature
        android:name="android.hardware.vr.headtracking"
        android:required="false"
        android:version="1" />
    <uses-feature
        android:name="oculus.software.handtracking"
        android:required="false" />
    <application
        android:name="Application"
        android:label="@string/appName"
        android:theme="@android:style/Theme.Translucent.NoTitleBar">
        <activity android:name="com.meta.androidbrowserhelper.trusted.ManageDataLauncherActivity"
            android:exported="false"
            android:excludeFromRecents="true">
        </activity>
        <activity android:name="LauncherActivity"
            android:alwaysRetainTaskState="true"
            android:label="@string/launcherName"
            android:exported="true">
            <meta-data android:name="horizonos.pwa.APP_MODE" android:value="@string/horizonOSAppMode" />
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <category android:name="com.oculus.intent.category.VR" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;
await test("patch-android", async (ok) => {
  const g1 = patchGradle(GRADLE), m1 = patchManifest(MANIFEST);
  ok(checkAndroid(g1, m1).length === 0, "after one patch: " + checkAndroid(g1, m1).join("; "));
  ok(checkAndroid(GRADLE, MANIFEST).length >= 6, "the check does not see the unpatched problems");
  ok(patchGradle(g1) === g1 && patchManifest(m1) === m1, "a second patch changes the files (not idempotent)");
  ok(/<uses-feature\s+android:name="oculus\.software\.handtracking"\s+android:required="false"/.test(m1), "the patch touched the handtracking feature");
  ok(/ManageDataLauncherActivity"[\s\S]*?excludeFromRecents="true"[\s\S]*?LauncherActivity"[^>]*excludeFromRecents="true"/.test(m1), "LauncherActivity has no excludeFromRecents");
  ok(/minSdkVersion 32/.test(g1) && !/SdkVersion 32\b/.test(g1.replace("minSdkVersion 32", "")), "SDK levels: " + g1.match(/\w+SdkVersion \d+/g));
  // a project that already has other values: supportedDevices is rewritten, a missing headtracking feature is added
  const m2 = patchManifest(MANIFEST.replace(/<uses-feature\s+android:name="android\.hardware\.vr\.headtracking"[^>]*>/, "").replace("<application\n", "<application\n        android:icon=\"@mipmap/ic_launcher\"\n").replace("android:theme=\"@android:style/Theme.Translucent.NoTitleBar\">", "android:theme=\"@android:style/Theme.Translucent.NoTitleBar\">\n        <meta-data android:name=\"com.oculus.supportedDevices\" android:value=\"quest2\" />"));
  ok(checkAndroid(g1, m2).length === 0, "variant: " + checkAndroid(g1, m2).join("; "));
  ok((m2.match(/com\.oculus\.supportedDevices/g) || []).length === 1, "variant: supportedDevices appears more than once");
  // a real generated project, when build-apk.sh has made one
  const proj = process.env.QUEST_PROJECT || path.join(ROOT, "quest/android");
  if (await exists(path.join(proj, "app/build.gradle"))) {
    const bad = checkAndroid(await readFile(path.join(proj, "app/build.gradle"), "utf8"), await readFile(path.join(proj, "app/src/main/AndroidManifest.xml"), "utf8"));
    ok(bad.length === 0, proj + ": " + bad.join("; "));
    info("checked the generated project in " + proj);
  }
});

/* ---------------- in the browser ---------------- */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".css": "text/css", ".ico": "image/x-icon", ".md": "text/plain" };
const sockets = new Set();
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(PUB, p);
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (e) { res.writeHead(404); res.end("not found"); }
});
server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + server.address().port;
const stopServer = () => new Promise((r) => { server.close(r); for (const s of sockets) s.destroy(); });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, serviceWorkers: "allow" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  page.setDefaultNavigationTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const indexSrc = await readFile(path.join(PUB, "vr/index.html"), "utf8");
  const indexTitle = (indexSrc.match(/<title>([^<]*)<\/title>/) || [])[1] || "";

  await test("privacy.html loads", async (ok) => {
    const res = await page.goto(BASE + "/vr/privacy.html");
    ok(res && res.status() === 200, "status " + (res && res.status()));
    const r = await page.evaluate(() => ({ h1: document.querySelector("h1")?.textContent || "", contact: !!document.querySelector('a[href="https://github.com/vdimarco/rouge-warden/issues"]'), words: document.body.innerText.split(/\s+/).length, text: document.body.innerText }));
    ok(/privacy/i.test(r.h1), "no privacy heading");
    ok(r.contact, "no contact link to the GitHub issues");
    ok(r.words > 250, "only " + r.words + " words");
    for (const w of ["Vercel", "IP address", "browser storage", "Reset progress", "site data", "uninstall", "hands", "walls"]) ok(r.text.includes(w), "does not mention " + w);
    ok(!/\u2014/.test(r.text), "has an em dash (STE)");
  });

  let controlled = false;
  await test("sw.js registers and takes control", async (ok) => {
    // an old cache of ours must go on activate, and a cache of another game must stay. Plant them on privacy.html,
    // which registers no worker, so the game page cannot activate the worker before the caches exist.
    await page.goto(BASE + "/vr/privacy.html");
    await page.evaluate(async () => { await (await caches.open("fullswing-0.0.0-old")).put("/old", new Response("old")); await (await caches.open("other-game")).put("/x", new Response("x")); });
    await page.goto(BASE + "/vr/");
    if (/serviceWorker\.register\(/.test(indexSrc)) {
      ok(/<link[^>]+rel="manifest"[^>]+href="\.?\/?(vr\/)?manifest\.webmanifest"/.test(indexSrc) || /<link[^>]+href="\.?\/?(vr\/)?manifest\.webmanifest"[^>]+rel="manifest"/.test(indexSrc), "index.html registers sw.js but has no <link rel=\"manifest\">");
      ok(/serviceWorker\.register\(\s*["']\.\/sw\.js["']/.test(indexSrc), "index.html does not register ./sw.js");
    } else info("index.html does not register sw.js yet, so the test registers it");
    // registering the same script and scope again returns the page's own registration, so this is safe either way
    const state = await page.evaluate(() => new Promise((done) => {
      setTimeout(() => done("no control after 90 s"), 90000);
      navigator.serviceWorker.addEventListener("controllerchange", () => done("controlled"));
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).then((reg) => {
        if (navigator.serviceWorker.controller) return done("controlled");
        const w = reg.installing || reg.waiting || reg.active;
        if (w) w.addEventListener("statechange", () => { if (w.state === "redundant") done("the worker went redundant: install failed (is a precache URL missing?)"); });
      }, (e) => done("register failed: " + e.message));
    }));
    ok(state === "controlled", state);
    if (state !== "controlled") return;
    controlled = true;
    const r = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const keys = await caches.keys();
      const mine = keys.filter((k) => k.startsWith("fullswing-"));
      const cached = mine.length === 1 ? (await (await caches.open(mine[0])).keys()).map((q) => new URL(q.url).pathname) : [];
      return { scope: reg && new URL(reg.scope).pathname, script: reg && reg.active && new URL(reg.active.scriptURL).pathname, keys, mine, cached };
    });
    ok(r.scope === "/vr/", "scope is " + r.scope);
    ok(r.script === "/vr/sw.js", "script is " + r.script);
    ok(r.mine.length === 1 && r.mine[0] === SW.CACHE, "our caches are " + JSON.stringify(r.mine) + ", want [" + SW.CACHE + "]");
    ok(r.keys.includes("other-game"), "activate deleted another game's cache");
    for (const p of precachePaths) ok(r.cached.includes(p), p + " is not in the cache");
  });

  await test("offline start", async (ok) => {
    if (!controlled) return ok(false, "the service worker is not in control, so the game cannot start offline");
    // cut the network two ways: the browser goes offline, and the server stops, so only the cache can answer
    await ctx.setOffline(true);
    await stopServer();
    const failed = [];
    page.on("requestfailed", (q) => { if (q.url().startsWith(BASE)) failed.push(new URL(q.url()).pathname + " " + (q.failure() || {}).errorText); });
    const e0 = errors.length;
    for (const [url, what] of [["/vr/", "a reload of /vr/"], ["/vr/?source=pwa", "the PWA start URL"], ["/vr/privacy.html", "privacy.html"], ["/vr/no-such-page.html", "an unknown page (falls back to the game)"]]) {
      const res = url === "/vr/" ? await page.reload({ waitUntil: "domcontentloaded" }) : await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
      ok(res && res.status() === 200, what + ": status " + (res && res.status()));
      ok(res && res.fromServiceWorker(), what + ": not served by the service worker");
      const title = await page.title();
      const want = url.includes("privacy") ? /privacy/i : new RegExp("^" + indexTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$");
      ok(want.test(title), what + ": title is \"" + title + "\"");
      await page.waitForTimeout(1500); // let module scripts and the first fetches run
    }
    ok(failed.length === 0, "same-origin requests failed offline (not precached?): " + failed.join(", "));
    const net = errors.slice(e0).filter((m) => /fetch|import|network|ERR_INTERNET/i.test(m));
    ok(net.length === 0, "network errors offline: " + net.join(" | "));
    const other = errors.slice(e0).filter((m) => !net.includes(m));
    if (other.length) info("other page errors while offline (not about caching): " + other.slice(0, 3).join(" | "));
  });
} finally {
  await browser.close();
  if (server.listening) await stopServer();
}

if (fails) { console.log("FAIL: pwa (" + fails + " failed)"); process.exit(1); }
pass("pwa");
