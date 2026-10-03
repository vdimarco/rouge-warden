// Checks the Android side of Reel It In on Google Play, in node only (no network, no browser, no Android tools):
//   play/fish/twa-manifest.json (fields, one host, scope, versions, no Meta-only field) against public/fish/manifest.webmanifest
//   play/fish/patch-android.mjs on a fixture of the project that Bubblewrap 1.25.0 generates
//   play/fish/verify-output.mjs on fixtures of the APK badging, the APK resources and the bundle manifest (protobuf)
//   play/fish/assetlinks.mjs (unit tests and the command line, on a scratch copy of the file) and public/.well-known/assetlinks.json
//   play/fish/build-aab.sh (bash -n, --help, the key rules, the pins, no password in any output)
//   .github/workflows/play-aab.yml (read with a small YAML reader), play/.gitignore, the guide, the README and the OpenSpec change
// Every check also runs on a broken input and must say so. This does not run Gradle: see play/fish/README.md for the build.
// Run from the repo root: node qa/fish/play.mjs
import { readFile, readdir, stat, mkdtemp, copyFile, writeFile, mkdir, symlink, rm } from "fs/promises";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import os from "os";
import path from "path";
import * as AL from "../../play/fish/assetlinks.mjs";
import * as PATCH from "../../play/fish/patch-android.mjs";
import * as VER from "../../play/fish/verify-output.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PLAY = path.join(ROOT, "play/fish");
const FULLSWING = "com.cottagearcade.fullswing";
const PLACEHOLDER = "REPLACE_WITH_YOUR_SHA256_FINGERPRINT";
const FP1 = "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";
const FP2 = "3D:7A:12:23:01:9A:A3:9D:9E:A0:E3:43:6A:B7:C0:89:6B:FB:4F:B6:79:F4:DE:5F:E7:C2:3F:32:6C:8F:99:4A";
const FP3 = "F0:FD:6C:5B:41:0F:25:CB:25:C3:B5:33:46:C8:97:2F:AE:30:F8:EE:74:11:DF:91:04:80:AD:6B:2D:60:DB:83";

let fails = 0;
const pass = (name) => console.log("PASS: " + name);
const info = (msg) => console.log("INFO: " + msg);
const warn = (msg) => console.log("WARNING: " + msg);
async function test(name, fn) {
  const bad = [];
  try { await fn((ok, msg) => { if (!ok) bad.push(msg); }); } catch (e) { bad.push("threw " + (e.stack || e)); }
  if (bad.length) { fails++; console.log("FAIL " + name + ":\n  " + bad.join("\n  ")); } else pass(name);
}
const exists = async (p) => { try { return (await stat(p)).isFile(); } catch (e) { return false; } };
const read = (p) => readFile(path.join(ROOT, p), "utf8");
const readJSON = async (p) => JSON.parse(await read(p));
const clone = (x) => structuredClone(x);
const pngSize = (buf) => (buf.slice(1, 4).toString() === "PNG" ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : null);
// A check must fail on a broken input: the list of problems must hold one that matches re.
const caught = (ok, label, problems, re) => ok(problems.some((p) => re.test(p)), "the broken input \"" + label + "\" was not caught. Problems: " + (problems.join(" | ") || "none"));
const run = (cmd, args, opt = {}) => spawnSync(cmd, args, { encoding: "utf8", timeout: 60000, ...opt });

const SCRATCH = await mkdtemp(path.join(os.tmpdir(), "play-test-"));

/* ---------------- twa-manifest.json ---------------- */
// every field that @bubblewrap/core 1.25.0 reads in the TwaManifest constructor, plus appVersionName (toJson writes it)
const TWA_KEYS = ["packageId", "host", "name", "launcherName", "display", "themeColor", "themeColorDark", "navigationColor", "navigationColorDark", "navigationDividerColor", "navigationDividerColorDark", "backgroundColor", "enableNotifications", "startUrl", "iconUrl", "maskableIconUrl", "monochromeIconUrl", "splashScreenFadeOutDuration", "signingKey", "appVersion", "appVersionName", "appVersionCode", "shortcuts", "generatorApp", "webManifestUrl", "fallbackType", "features", "alphaDependencies", "enableSiteSettingsShortcut", "isChromeOSOnly", "fullScopeUrl", "minSdkVersion", "shareTarget", "orientation", "fingerprints", "serviceAccountJsonFile", "additionalTrustedOrigins", "retainedBundles", "protocolHandlers", "fileHandlers", "launchHandlerClientMode", "displayOverride"];
// fields that only Meta's fork of Bubblewrap (or the Quest app) uses
const META_ONLY = ["isMetaQuest", "horizonOSAppMode", "enableXRScene", "enableMicrophone", "applicationId"];
const DISPLAYS = ["standalone", "minimal-ui", "fullscreen", "fullscreen-sticky"];
const ORIENTATIONS = ["default", "any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"];
const COLOUR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

// Returns the problems of a twa-manifest.json. web is the web manifest (public/fish/manifest.webmanifest) or null.
function checkTwa(t, web) {
  const bad = [];
  for (const k of Object.keys(t)) {
    if (META_ONLY.includes(k)) bad.push("Meta-only field " + k + " (it belongs to the Quest app, not to Google Play)");
    else if (!TWA_KEYS.includes(k)) bad.push("unknown field " + k + " (Bubblewrap 1.25.0 ignores it)");
  }
  for (const k of Object.keys(t.features || {})) bad.push((/^horizon/.test(k) ? "Meta-only feature " : "feature ") + k + ": the app uses no feature");
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(t.packageId || "")) bad.push("packageId " + t.packageId + " is not a valid Android package id (lower case, dots)");
  if (t.packageId === FULLSWING) bad.push("packageId is the Quest app's");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(t.host || "") || /^\d+\.\d+\.\d+\.\d+$/.test(t.host)) bad.push("host " + t.host + " is not a host name");
  if (!t.name || t.name.length > 30) bad.push("name must have 1 to 30 characters (the Play limit)");
  if (!t.launcherName || t.launcherName.length > 12) bad.push("launcherName must have 1 to 12 characters");
  // one host in every URL
  for (const k of ["fullScopeUrl", "webManifestUrl", "iconUrl", "maskableIconUrl"]) {
    let u;
    try { u = new URL(t[k]); } catch (e) { bad.push(k + " is not a URL"); continue; }
    if (u.protocol !== "https:") bad.push(k + " is not https");
    if (u.host !== t.host) bad.push(k + " is on " + u.host + ", but host is " + t.host);
  }
  // scope and start URL
  let scope = null;
  try { scope = new URL(t.fullScopeUrl); } catch (e) { /* reported above */ }
  if (scope && scope.pathname !== "/fish/") bad.push("fullScopeUrl path is " + scope.pathname + ", not /fish/ (the app must not reach the rest of the arcade)");
  if (typeof t.startUrl !== "string" || !t.startUrl.startsWith("/")) bad.push("startUrl must be a path that starts with /");
  else if (scope) {
    const start = new URL(t.startUrl, "https://" + t.host);
    if (!start.pathname.startsWith(scope.pathname)) bad.push("startUrl " + t.startUrl + " is outside the scope " + scope.pathname);
    if (start.searchParams.get("source") !== "play") bad.push("startUrl has no source=play (the game uses it to switch to app mode)");
  }
  if (new URL(t.webManifestUrl || "https://x/").pathname !== "/fish/manifest.webmanifest") bad.push("webManifestUrl path is not /fish/manifest.webmanifest");
  if (!DISPLAYS.includes(t.display)) bad.push("display " + t.display + " is not one that Bubblewrap knows");
  if (!ORIENTATIONS.includes(t.orientation)) bad.push("orientation " + t.orientation + " is not one that Bubblewrap knows");
  for (const k of ["themeColor", "themeColorDark", "navigationColor", "navigationColorDark", "navigationDividerColor", "navigationDividerColorDark", "backgroundColor"]) if (!COLOUR.test(t[k] || "")) bad.push(k + " " + t[k] + " is not a colour");
  if (!Number.isInteger(t.splashScreenFadeOutDuration) || t.splashScreenFadeOutDuration < 0 || t.splashScreenFadeOutDuration > 2000) bad.push("splashScreenFadeOutDuration must be a whole number from 0 to 2000");
  // versions
  if (!Number.isInteger(t.appVersionCode) || t.appVersionCode < 1 || t.appVersionCode > 2100000000) bad.push("appVersionCode " + JSON.stringify(t.appVersionCode) + " must be a whole number from 1 to 2100000000");
  if (!/^\d+\.\d+\.\d+$/.test(t.appVersionName || "")) bad.push("appVersionName " + t.appVersionName + " must look like 1.0.0");
  if (t.appVersion !== t.appVersionName) bad.push("appVersion " + t.appVersion + " and appVersionName " + t.appVersionName + " differ");
  if (!Number.isInteger(t.minSdkVersion) || t.minSdkVersion < 21 || t.minSdkVersion > 36) bad.push("minSdkVersion " + JSON.stringify(t.minSdkVersion) + " must be a whole number from 21 to 36");
  // no permission and no extra code: notifications, billing, location and the web view all add a permission or a service
  if (t.enableNotifications !== false) bad.push("enableNotifications must be false (it adds POST_NOTIFICATIONS and a service)");
  if (t.fallbackType !== "customtabs") bad.push("fallbackType must be customtabs (webview adds the INTERNET permission)");
  if (t.isChromeOSOnly !== false) bad.push("isChromeOSOnly must be false");
  if (t.alphaDependencies && t.alphaDependencies.enabled) bad.push("alphaDependencies must be off");
  if ((t.additionalTrustedOrigins || []).length) bad.push("additionalTrustedOrigins must be empty (the app trusts one host)");
  if ((t.shortcuts || []).length) bad.push("the app has no shortcuts");
  // the signing key stays out of the repository
  const sk = t.signingKey || {};
  if (!sk.alias || !/^[A-Za-z0-9_.-]+$/.test(sk.alias)) bad.push("signingKey.alias is missing or has odd characters");
  if (!sk.path || !(sk.path.startsWith("~/") || path.isAbsolute(sk.path)) || path.resolve(sk.path.replace(/^~/, os.homedir())).startsWith(ROOT + path.sep)) bad.push("signingKey.path " + sk.path + " must be outside the repository");
  // the web manifest
  if (web) {
    const wu = new URL(t.webManifestUrl || "https://x/fish/manifest.webmanifest");
    if (new URL(web.scope || "/", wu).pathname !== (scope && scope.pathname)) bad.push("the web manifest scope " + web.scope + " is not the TWA scope " + (scope && scope.pathname));
    if (scope && !new URL(web.start_url || "/", wu).pathname.startsWith(scope.pathname)) bad.push("the web manifest start_url is outside the scope");
    if ((web.theme_color || "").toLowerCase() !== (t.themeColor || "").toLowerCase()) bad.push("themeColor differs from the web manifest theme_color");
    if ((web.background_color || "").toLowerCase() !== (t.backgroundColor || "").toLowerCase()) bad.push("backgroundColor differs from the web manifest background_color");
    if (web.orientation && web.orientation !== t.orientation) bad.push("orientation " + t.orientation + " differs from the web manifest orientation " + web.orientation);
    const icons = (web.icons || []).map((i) => new URL(i.src, wu).pathname);
    for (const k of ["iconUrl", "maskableIconUrl"]) { let p; try { p = new URL(t[k]).pathname; } catch (e) { continue; } if (!icons.includes(p)) bad.push(k + " " + p + " is not an icon of the web manifest"); }
  }
  return bad;
}

const twa = await readJSON("play/fish/twa-manifest.json");
const webPath = path.join(ROOT, "public/fish/manifest.webmanifest");
const webReal = (await exists(webPath)) ? JSON.parse(await readFile(webPath, "utf8")) : null;
// a web manifest in the shape that the web side makes, for the checks that need one when the real one is not in the tree
const WEB = { name: "Reel It In", scope: "/fish/", start_url: "/fish/?source=pwa", display: "standalone", orientation: "portrait", theme_color: "#0d2f38", background_color: "#0d2f38",
  icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };

await test("twa-manifest.json", async (ok) => {
  for (const p of checkTwa(twa, null)) ok(false, p);
  if (webReal) {
    for (const p of checkTwa(twa, webReal)) ok(false, "against public/fish/manifest.webmanifest: " + p);
    for (const k of ["iconUrl", "maskableIconUrl"]) {
      const file = path.join(ROOT, "public", new URL(twa[k]).pathname);
      if (await exists(file)) { const s = pngSize(await readFile(file)); ok(s && s.w >= 512 && s.h >= 512, k + " is smaller than the 512 px that Bubblewrap needs"); }
      else ok(false, k + " " + new URL(twa[k]).pathname + " is missing on disk");
    }
  } else info("public/fish/manifest.webmanifest is not in this tree (the web side makes it): the checks against it ran on a stand-in, and the icon files were not checked");
});
await test("twa-manifest.json checks can fail", async (ok) => {
  for (const p of checkTwa(twa, WEB)) ok(false, "the stand-in web manifest differs from twa-manifest.json: " + p);
  const cases = [
    ["unknown field", (t) => { t.colour = 1; }, /unknown field colour/],
    ["isMetaQuest", (t) => { t.isMetaQuest = false; }, /Meta-only field isMetaQuest/],
    ["horizonOSAppMode", (t) => { t.horizonOSAppMode = "immersive"; }, /Meta-only field horizonOSAppMode/],
    ["enableXRScene", (t) => { t.enableXRScene = false; }, /Meta-only field enableXRScene/],
    ["horizonPlatformSDK", (t) => { t.features = { horizonPlatformSDK: { enabled: true } }; }, /Meta-only feature horizonPlatformSDK/],
    ["playBilling", (t) => { t.features = { playBilling: { enabled: true } }; }, /feature playBilling/],
    ["package id in capitals", (t) => { t.packageId = "Com.Example"; }, /packageId/],
    ["the Quest package id", (t) => { t.packageId = FULLSWING; }, /Quest app/],
    ["host with a scheme", (t) => { t.host = "https://example.com"; }, /host .* not a host name/],
    ["icon on another host", (t) => { t.iconUrl = "https://example.com/fish/icons/icon-512.png"; }, /iconUrl is on example.com/],
    ["web manifest on http", (t) => { t.webManifestUrl = "http://" + t.host + "/fish/manifest.webmanifest"; }, /webManifestUrl is not https/],
    ["scope of the whole host", (t) => { t.fullScopeUrl = "https://" + t.host + "/"; }, /not \/fish\//],
    ["start URL outside the scope", (t) => { t.startUrl = "/?source=play"; }, /outside the scope/],
    ["start URL without source=play", (t) => { t.startUrl = "/fish/"; }, /source=play/],
    ["start URL with a host", (t) => { t.startUrl = "https://example.com/fish/?source=play"; }, /startUrl must be a path/],
    ["unknown display", (t) => { t.display = "windowed"; }, /display/],
    ["unknown orientation", (t) => { t.orientation = "sideways"; }, /orientation/],
    ["bad colour", (t) => { t.themeColor = "teal"; }, /themeColor/],
    ["name over 30 characters", (t) => { t.name = "R".repeat(31); }, /name must have/],
    ["version code as text", (t) => { t.appVersionCode = "1"; }, /appVersionCode/],
    ["version code 0", (t) => { t.appVersionCode = 0; }, /appVersionCode/],
    ["versions that differ", (t) => { t.appVersion = "1.0.1"; }, /differ/],
    ["version name with a letter", (t) => { t.appVersionName = t.appVersion = "1.0.x"; }, /appVersionName/],
    ["min SDK as text", (t) => { t.minSdkVersion = "24"; }, /minSdkVersion/],
    ["notifications on", (t) => { t.enableNotifications = true; }, /enableNotifications/],
    ["web view fallback", (t) => { t.fallbackType = "webview"; }, /fallbackType/],
    ["extra trusted origin", (t) => { t.additionalTrustedOrigins = ["example.com"]; }, /additionalTrustedOrigins/],
    ["keystore inside the repo", (t) => { t.signingKey.path = path.join(ROOT, "play/fish/x.keystore"); }, /outside the repository/],
    ["keystore beside the manifest", (t) => { t.signingKey.path = "./reelitin.keystore"; }, /outside the repository/],
    ["no key alias", (t) => { t.signingKey.alias = ""; }, /alias/],
  ];
  for (const [label, mutate, re] of cases) { const t = clone(twa); mutate(t); caught(ok, label, checkTwa(t, null), re); }
  // against the web manifest
  const webCases = [
    ["web scope", (w) => { w.scope = "/"; }, /web manifest scope/],
    ["web start_url", (w) => { w.start_url = "/?source=pwa"; }, /start_url is outside/],
    ["web theme colour", (w) => { w.theme_color = "#ffffff"; }, /themeColor differs/],
    ["web background colour", (w) => { w.background_color = "#ffffff"; }, /backgroundColor differs/],
    ["web orientation", (w) => { w.orientation = "landscape"; }, /orientation portrait differs/],
    ["web icons", (w) => { w.icons = [w.icons[0]]; }, /is not an icon of the web manifest/],
  ];
  for (const [label, mutate, re] of webCases) { const w = clone(WEB); mutate(w); caught(ok, label, checkTwa(twa, w), re); }
});

/* ---------------- patch-android.mjs ---------------- */
// the shape of the project that Bubblewrap 1.25.0 generates (template_project), trimmed
const GRADLE = `android {
    compileSdkVersion 36
    namespace "com.cottagearcade.reelitin"
    defaultConfig {
        applicationId "com.cottagearcade.reelitin"
        minSdkVersion 24
        targetSdkVersion 36
        versionCode 1
        versionName "1.0.0"
    }
}`;
const MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.cottagearcade.reelitin">

    <application
        android:name="Application"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/appName"

        android:supportsRtl="true"
        android:theme="@android:style/Theme.Translucent.NoTitleBar">

        <activity android:name="LauncherActivity"
            android:alwaysRetainTaskState="true"
            android:exported="true">
        </activity>
    </application>
</manifest>`;
await test("patch-android", async (ok) => {
  const m1 = PATCH.patchManifest(MANIFEST);
  ok(PATCH.check(PATCH.assertGradle(GRADLE), m1).length === 0, "after one patch: " + PATCH.check(GRADLE, m1).join("; "));
  ok(/android:appCategory="game"/.test(m1) && /android:allowBackup="false"/.test(m1) && !/allowBackup="true"/.test(m1), "the patch did not set appCategory and allowBackup");
  ok((m1.match(/android:allowBackup/g) || []).length === 1 && (m1.match(/android:appCategory/g) || []).length === 1, "an attribute appears twice");
  ok(PATCH.patchManifest(m1) === m1, "a second patch changes the manifest (not idempotent)");
  ok(PATCH.assertGradle(GRADLE) === GRADLE, "the Gradle file must stay as Bubblewrap made it (no downgrade of the SDK)");
  ok(PATCH.RULES.sdk === 36, "the required SDK is " + PATCH.RULES.sdk + ", not 36");
  ok(PATCH.check(GRADLE, MANIFEST).length >= 2, "the check does not see the unpatched manifest");
  // a manifest that already has the attributes, or has none of allowBackup
  const m2 = PATCH.patchManifest(MANIFEST.replace('android:allowBackup="true"\n        ', "").replace('android:name="Application"', 'android:name="Application"\n        android:appCategory="productivity"'));
  ok(PATCH.check(GRADLE, m2).length === 0 && /appCategory="game"/.test(m2) && !/productivity/.test(m2), "variant: " + PATCH.check(GRADLE, m2).join("; "));
  // checks that must fail
  const g = (n) => GRADLE.replace(/compileSdkVersion 36/, "compileSdkVersion " + n);
  const gt = (n) => GRADLE.replace(/targetSdkVersion 36/, "targetSdkVersion " + n);
  for (const [label, fn, re] of [
    ["compileSdk 34", () => PATCH.assertGradle(g(34)), /compileSdkVersion is 34/],
    ["targetSdk 35", () => PATCH.assertGradle(gt(35)), /targetSdkVersion is 35/],
    ["targetSdk 34 (the Quest value)", () => PATCH.assertGradle(gt(34)), /targetSdkVersion is 34/],
    ["no targetSdk line", () => PATCH.assertGradle(GRADLE.replace(/targetSdkVersion 36/, "")), /no targetSdkVersion line/],
    ["no <application>", () => PATCH.patchManifest("<manifest></manifest>"), /no <application>/],
  ]) { let msg = ""; try { fn(); } catch (e) { msg = e.message; } ok(re.test(msg), "the broken input \"" + label + "\" did not throw the right error: " + msg); }
  caught(ok, "targetSdk 35 in check()", PATCH.check(gt(35), m1), /targetSdkVersion is not 36/);
  caught(ok, "a permission", PATCH.check(GRADLE, m1.replace("<application", '<uses-permission android:name="android.permission.INTERNET" />\n<application')), /permission android\.permission\.INTERNET/);
  caught(ok, "allowBackup true", PATCH.check(GRADLE, m1.replace('allowBackup="false"', 'allowBackup="true"')), /allowBackup/);
  caught(ok, "no appCategory", PATCH.check(GRADLE, m1.replace(/\s*android:appCategory="game"/, "")), /appCategory/);
  // the command line, on a scratch project
  const dir = path.join(SCRATCH, "project");
  await mkdir(path.join(dir, "app/src/main"), { recursive: true });
  const put = async (gradle, manifest) => { await writeFile(path.join(dir, "app/build.gradle"), gradle); await writeFile(path.join(dir, "app/src/main/AndroidManifest.xml"), manifest); };
  const cli = (...a) => run("node", [path.join(PLAY, "patch-android.mjs"), ...a]);
  await put(GRADLE, MANIFEST);
  let r = cli(dir);
  ok(r.status === 0 && /meets the Google Play rules/.test(r.stdout), "the command failed on a good project: " + r.stderr);
  ok((await readFile(path.join(dir, "app/src/main/AndroidManifest.xml"), "utf8")) === m1, "the command wrote another manifest than patchManifest");
  await put(g(35), MANIFEST);
  r = cli(dir);
  ok(r.status === 1 && /compileSdkVersion is 35/.test(r.stderr), "the command did not stop at compileSdk 35: " + r.status + " " + r.stderr);
  ok((await readFile(path.join(dir, "app/src/main/AndroidManifest.xml"), "utf8")) === MANIFEST, "the command changed the manifest although the SDK was wrong");
  r = cli("--target-sdk");
  ok(r.status === 0 && r.stdout.trim() === "36", "--target-sdk printed " + r.stdout);
  // a real generated project, when build-aab.sh has made one
  const proj = process.env.PLAY_PROJECT || path.join(PLAY, "android");
  if (await exists(path.join(proj, "app/build.gradle"))) {
    const bad = PATCH.check(await readFile(path.join(proj, "app/build.gradle"), "utf8"), await readFile(path.join(proj, "app/src/main/AndroidManifest.xml"), "utf8"));
    ok(bad.length === 0, proj + ": " + bad.join("; "));
    info("checked the generated project in " + proj);
  }
});

/* ---------------- verify-output.mjs ---------------- */
// A protobuf encoder for the messages XmlNode, XmlElement and XmlAttribute, to build a bundle manifest as aapt2 writes it.
const varint = (n) => { const out = []; while (n > 127) { out.push((n & 127) | 128); n = Math.floor(n / 128); } out.push(n); return Buffer.from(out); };
const lenField = (num, buf) => Buffer.concat([varint(num * 8 + 2), varint(buf.length), buf]);
const strField = (num, s) => lenField(num, Buffer.from(s, "utf8"));
function xmlNode(name, attrs = {}, children = []) {
  const el = Buffer.concat([strField(3, name), ...Object.entries(attrs).map(([k, v]) => lenField(4, Buffer.concat([strField(2, k), strField(3, v)]))), ...children.map((c) => lenField(5, c))]);
  return lenField(1, el);
}
const PKG = "com.cottagearcade.reelitin";
const INTERNAL = PKG + ".DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION";
function bundleManifest({ target = "36", min = "24", code = "1", name = "1.0.0", permissions = [INTERNAL], appCategory = "game", allowBackup = "false", path: scopePath = "/fish/", dump = true } = {}) {
  const link = xmlNode("intent-filter", { autoVerify: "true" }, [xmlNode("action", { name: "android.intent.action.VIEW" }), xmlNode("data", { scheme: "https", host: "@string/hostName", pathPrefix: scopePath })]);
  const receiver = xmlNode("receiver", dump ? { name: "androidx.profileinstaller.ProfileInstallReceiver", permission: "android.permission.DUMP" } : { name: "x" });
  return xmlNode("manifest", { package: PKG, versionCode: code, versionName: name }, [
    xmlNode("uses-sdk", { minSdkVersion: min, targetSdkVersion: target }),
    xmlNode("permission", { name: INTERNAL, protectionLevel: "signature" }),
    ...permissions.map((p) => xmlNode("uses-permission", { name: p })),
    xmlNode("application", { appCategory, allowBackup }, [xmlNode("activity", { name: PKG + ".LauncherActivity" }, [link]), receiver]),
  ]);
}
const BADGING = (o = {}) => `package: name='${o.pkg || PKG}' versionCode='${o.code || 1}' versionName='1.0.0' platformBuildVersionName='16' platformBuildVersionCode='36' compileSdkVersion='36' compileSdkVersionCodename='16'
minSdkVersion:'${o.min || 24}'
targetSdkVersion:'${o.target || 36}'
${(o.permissions || [INTERNAL]).map((p) => `uses-permission: name='${p}'`).join("\n")}
application-label:'${o.label || "Reel It In"}'
application-label-de:'Reel It In'
`;
const RESOURCES = (o = {}) => `    resource 0x7f040002 bool/enableNotification
      () ${o.notify || "false"}
    resource 0x7f0e002b string/fullScopeUrl
      () "https://warden-alpha-wheat.vercel.app/fish/"
    resource 0x7f0e002d string/hostName
      () "${o.host || "warden-alpha-wheat.vercel.app"}"
    resource 0x7f0e002e string/launchUrl
      () "${o.launch || "https://warden-alpha-wheat.vercel.app/fish/?source=play"}"
    resource 0x7f0e0033 string/orientation
      () "${o.orientation || "portrait"}"
    resource 0x7f0e0027 string/fallbackType
      () "customtabs"
    resource 0x7f0e0038 string/webManifestUrl
      () "${o.web || "https://warden-alpha-wheat.vercel.app/fish/manifest.webmanifest"}"
`;
await test("verify-output", async (ok) => {
  const want = VER.wantFromTwa(twa, "36");
  const all = (b = {}, a = {}, r = {}) => {
    const badging = VER.checkBadging(BADGING(a), want);
    return [...badging.problems, ...VER.checkResources(RESOURCES(r), want).problems, ...VER.checkBundleManifest(bundleManifest(b), want, badging.permissions).problems];
  };
  ok(all().length === 0, "good fixtures: " + all().join("; "));
  ok(VER.parseManifest(bundleManifest()).attrs.package === PKG, "parseManifest cannot read the fixture");
  // the receiver's android:permission="android.permission.DUMP" is a guard, not a request: it must not count
  ok(all({ dump: true }).length === 0, "a receiver guarded by android.permission.DUMP was counted as a permission");
  const cases = [
    ["target SDK 35 in the bundle", all({ target: "35" }), /bundle targetSdkVersion is 35/],
    ["target SDK 35 in the APK", all({}, { target: 35 }), /APK targetSdkVersion is 35/],
    ["min SDK 21 in the bundle", all({ min: "21" }), /bundle minSdkVersion is 21/],
    ["min SDK 23 in the APK", all({}, { min: 23 }), /APK minSdkVersion is 23/],
    ["another version code", all({ code: "2" }), /bundle versionCode is 2/],
    ["another version code in the APK", all({}, { code: 2 }), /APK versionCode is 2/],
    ["another package in the APK", all({}, { pkg: "com.example.x" }), /APK package id is com.example.x/],
    ["INTERNET in the bundle", all({ permissions: [INTERNAL, "android.permission.INTERNET"] }), /bundle asks for the permission android.permission.INTERNET/],
    ["VIBRATE in the APK", all({}, { permissions: [INTERNAL, "android.permission.VIBRATE"] }), /APK asks for the permission android.permission.VIBRATE/],
    ["a permission of another app", all({ permissions: ["com.example.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"] }, { permissions: ["com.example.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"] }), /asks for the permission com.example/],
    ["bundle and APK with other permissions", all({ permissions: [] }), /different permissions/],
    ["no appCategory", all({ appCategory: "" }), /appCategory/],
    ["backup on", all({ allowBackup: "true" }), /allowBackup/],
    ["links for the whole host", all({ path: "/" }), /app link filter opens \/, not only \/fish\//],
    ["another launch URL", all({}, {}, { launch: "https://warden-alpha-wheat.vercel.app/?source=play" }), /launch URL/],
    ["a local web manifest URL", all({}, {}, { web: "http://127.0.0.1:35543/fish/manifest.webmanifest" }), /web manifest URL http:\/\/127/],
    ["another orientation", all({}, {}, { orientation: "default" }), /orientation default/],
    ["notifications on", all({}, {}, { notify: "true" }), /enableNotification true/],
    ["another host", all({}, {}, { host: "example.com" }), /the host example.com/],
    ["another label", all({}, { label: "Full Swing" }), /APK label is Full Swing/],
  ];
  for (const [label, problems, re] of cases) caught(ok, label, problems, re);
  let msg = "";
  try { VER.parseManifest(Buffer.from("not a manifest")); } catch (e) { msg = e.message; }
  ok(/protobuf|manifest/.test(msg), "parseManifest accepted junk");
  // the command line
  const files = { b: path.join(SCRATCH, "badging.txt"), r: path.join(SCRATCH, "resources.txt"), m: path.join(SCRATCH, "manifest.bin") };
  await writeFile(files.b, BADGING()); await writeFile(files.r, RESOURCES()); await writeFile(files.m, bundleManifest());
  const cli = (extra = []) => run("node", [path.join(PLAY, "verify-output.mjs"), files.b, files.r, files.m, "--twa", path.join(PLAY, "twa-manifest.json"), "--target-sdk", "36", ...extra]);
  let r = cli();
  ok(r.status === 0 && /match twa-manifest.json/.test(r.stdout), "the command failed on good files: " + r.stderr);
  await writeFile(files.m, bundleManifest({ permissions: [INTERNAL, "android.permission.INTERNET"] }));
  r = cli();
  ok(r.status === 1 && /android.permission.INTERNET/.test(r.stderr), "the command did not fail on a permission: " + r.status + r.stderr);
  ok(run("node", [path.join(PLAY, "verify-output.mjs")]).status === 2, "the command needs its arguments");
  // the real bundle, when build-aab.sh has left its manifest in the project: nothing to read without unzip, so only note it
});

/* ---------------- assetlinks.mjs ---------------- */
const linksText = await read("public/.well-known/assetlinks.json");
const entry = (pkg, fps) => ({ relation: [AL.RELATION], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fps } });
await test("assetlinks.json (the file in the tree)", async (ok) => {
  let links;
  try { links = AL.parse(linksText); } catch (e) { ok(false, e.message); return; }
  ok(links.length >= 1, "the file has no entry");
  ok(AL.format(links) + "\n" === linksText, "the file is not in the style that assetlinks.mjs writes (2 spaces, short lists on one line): the tool would reformat other entries");
  const seen = new Set();
  for (const e of links) {
    ok(Array.isArray(e.relation) && e.relation.includes(AL.RELATION), "an entry lacks " + AL.RELATION);
    const t = e.target || {};
    ok(t.namespace === "android_app", "an entry has namespace " + t.namespace);
    ok(!seen.has(t.package_name), "two entries for " + t.package_name);
    seen.add(t.package_name);
    const fps = t.sha256_cert_fingerprints;
    ok(Array.isArray(fps) && fps.length >= 1, "the entry for " + t.package_name + " has no fingerprint");
    ok(new Set(fps).size === (fps || []).length, "the entry for " + t.package_name + " lists a fingerprint twice");
    for (const f of fps || []) {
      if (t.package_name === FULLSWING && f === PLACEHOLDER) continue; // the known placeholder: see the warning below
      ok(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f), "the entry for " + t.package_name + " has the malformed fingerprint " + f);
    }
  }
  ok(links.some((e) => e.target.package_name === FULLSWING), "the entry for " + FULLSWING + " is gone (qa/vr/pwa.mjs needs it)");
  const mine = AL.entriesFor(links, twa.packageId);
  ok(mine.length <= 1, "more than one entry for " + twa.packageId);
  ok(!mine.some((e) => e.target.sha256_cert_fingerprints.some((f) => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f))), "the entry for " + twa.packageId + " has a fingerprint that is not valid: it would make the whole file invalid");
  if (!mine.length) info("no entry for " + twa.packageId + " yet: add one with  node play/fish/assetlinks.mjs --upload <SHA-256>  after the first build");
  for (const w of AL.warnings(links)) warn(w);
  if (AL.warnings(links).length) warn("Until that is fixed, Google reads NO statement from this host: " + twa.packageId + " would open its site with a URL bar. Run  node play/fish/assetlinks.mjs --check  to see Google's answer.");
});
await test("assetlinks.json checks can fail", async (ok) => {
  // the same checks as above, on a broken file: warnings() is the check that the tool and this test share
  caught(ok, "the Full Swing placeholder", AL.warnings([entry(FULLSWING, [PLACEHOLDER])]), /Google rejects the WHOLE file/);
  caught(ok, "lower case", AL.warnings([entry("a.b", [FP1.toLowerCase()])]), /malformed/);
  caught(ok, "31 pairs", AL.warnings([entry("a.b", [FP1.slice(0, -3)])]), /malformed/);
  caught(ok, "no fingerprint", AL.warnings([entry("a.b", [])]), /no fingerprint/);
  ok(AL.warnings([entry("a.b", [FP1])]).length === 0, "a good entry was flagged");
  let msg = "";
  try { AL.parse("{}"); } catch (e) { msg = e.message; }
  ok(/list/.test(msg), "a file that is not a list was accepted");
  msg = "";
  try { AL.parse("[1,"); } catch (e) { msg = e.message; }
  ok(/not valid JSON/.test(msg), "broken JSON was accepted");
});
await test("assetlinks.mjs functions", async (ok) => {
  const t = (fn) => { try { fn(); return ""; } catch (e) { return e.message; } };
  // fingerprints
  ok(AL.normalizeFingerprint(FP1) === FP1, "a good fingerprint changed");
  ok(AL.normalizeFingerprint(FP1.toLowerCase()) === FP1, "lower case was not made upper case");
  ok(AL.normalizeFingerprint(FP1.replace(/:/g, " ")) === FP1 && AL.normalizeFingerprint(FP1.replace(/:/g, "")) === FP1, "a fingerprint without colons was not read");
  for (const [label, v, re] of [
    ["the placeholder", PLACEHOLDER, /placeholder/], ["a short value", "AA:BB", /not a SHA-256/], ["non-hex", "ZZ" + FP1.slice(2), /not a SHA-256/], ["empty", "", /No fingerprint/],
    ["a SHA-1 fingerprint", "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD", /not a SHA-256/],
    ["all zeros", Array(32).fill("00").join(":"), /made-up/], ["a repeated pattern", Array(8).fill("AA:BB:CC:DD").join(":"), /made-up/],
  ]) ok(re.test(t(() => AL.normalizeFingerprint(v))), "the broken value \"" + label + "\" was not refused: " + t(() => AL.normalizeFingerprint(v)));
  // adding
  const other = entry(FULLSWING, [FP3]);
  const a = AL.addFingerprint([other], twa.packageId, FP1, "upload");
  ok(a.links.length === 2 && a.links[0] === other, "the other entry changed or moved");
  ok(JSON.stringify(a.links[1]) === JSON.stringify(entry(twa.packageId, [FP1])), "the new entry has the wrong shape: " + JSON.stringify(a.links[1]));
  const b = AL.addFingerprint(a.links, twa.packageId, FP2, "play");
  ok(b.links.length === 2 && JSON.stringify(b.links[1].target.sha256_cert_fingerprints) === JSON.stringify([FP1, FP2]), "upload and play are not in one entry, upload first: " + JSON.stringify(b.links[1]));
  const c = AL.addFingerprint([entry(twa.packageId, [FP2])], twa.packageId, FP1, "upload");
  ok(JSON.stringify(c.links[0].target.sha256_cert_fingerprints) === JSON.stringify([FP1, FP2]), "--upload did not go first");
  ok(/already in the entry/.test(t(() => AL.addFingerprint(b.links, twa.packageId, FP1, "upload"))), "a duplicate was not refused");
  ok(/already in the entry/.test(t(() => AL.addFingerprint(b.links, twa.packageId, FP2.toLowerCase(), "play"))), "a duplicate in lower case was not refused");
  ok(/placeholder/.test(t(() => AL.addFingerprint([other], twa.packageId, PLACEHOLDER, "upload"))), "a placeholder was accepted");
  ok(/2 entries/.test(t(() => AL.addFingerprint([entry(twa.packageId, [FP1]), entry(twa.packageId, [FP2])], twa.packageId, FP3, "play"))), "two entries for the package were accepted");
  // the placeholder of another app stays; our own malformed value is dropped
  const d = AL.addFingerprint([entry(FULLSWING, [PLACEHOLDER])], twa.packageId, FP1, "upload");
  ok(d.links[0].target.sha256_cert_fingerprints[0] === PLACEHOLDER, "the other app's placeholder was changed");
  const e = AL.addFingerprint([entry(FULLSWING, [PLACEHOLDER])], FULLSWING, FP1, "upload");
  ok(JSON.stringify(e.links[0].target.sha256_cert_fingerprints) === JSON.stringify([FP1]) && AL.warnings(e.links).length === 0, "--package could not replace a placeholder: " + JSON.stringify(e.links));
  // removing
  const f = AL.removeFingerprint(b.links, twa.packageId, FP1);
  ok(JSON.stringify(f.links[1].target.sha256_cert_fingerprints) === JSON.stringify([FP2]), "--remove did not remove");
  ok(AL.removeFingerprint(f.links, twa.packageId, FP2).links.length === 1, "--remove did not drop an empty entry");
  ok(/not in the entry/.test(t(() => AL.removeFingerprint(f.links, twa.packageId, FP3))), "removing an unknown fingerprint was accepted");
  ok(/no entry/.test(t(() => AL.removeFingerprint([other], twa.packageId, FP1))), "removing from a missing entry was accepted");
  // formatting
  ok(AL.format(JSON.parse(linksText)) + "\n" === linksText, "format does not give the file back");
  ok(JSON.stringify(JSON.parse(AL.format(b.links))) === JSON.stringify(b.links), "format changes the data");
  ok(AL.format([]) === "[]", "format of an empty list");
  // Google's answer
  const stmt = (pkg, fp) => ({ source: { web: { site: "https://x." } }, relation: AL.RELATION, target: { androidApp: { packageName: pkg, certificate: { sha256Fingerprint: fp } } } });
  const good = AL.readStatements({ maxAge: "599.9s", statements: [stmt(twa.packageId, FP1), stmt(FULLSWING, FP3)] }, twa.packageId);
  ok(good.ok && good.fingerprints.join() === FP1 && good.lines.some((l) => /<- this app/.test(l)), "a good answer was not read: " + good.lines.join(" | "));
  const malformed = AL.readStatements({ maxAge: "599s", debugString: "*** ERRORS ***\n* Error: invalid_argument: Invalid android app asset descriptor (malformed cert fingerprint): REPLACE [0]\n", errorCode: ["ERROR_CODE_MALFORMED_CONTENT"] }, twa.packageId);
  ok(!malformed.ok && malformed.lines.some((l) => /ERROR_CODE_MALFORMED_CONTENT/.test(l)) && malformed.lines.some((l) => /malformed cert fingerprint/.test(l)), "an error answer was not shown: " + malformed.lines.join(" | "));
  ok(!AL.readStatements({ statements: [stmt(FULLSWING, FP3)] }, twa.packageId).ok, "an answer without this app passed");
  ok(!AL.readStatements({ error: { code: 400, message: "Invalid statement query received.", details: [{ fieldViolations: [{ field: "source", description: "Invalid site" }] }] } }, twa.packageId).ok, "an error object passed");
});
await test("assetlinks.mjs --check", async (ok) => {
  const reply = (status, headers, body) => ({ status, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, json: async () => body });
  const site = reply(200, { "content-type": "application/json; charset=utf-8" }, null);
  const stmt = (pkg, fp) => ({ target: { androidApp: { packageName: pkg, certificate: { sha256Fingerprint: fp } } } });
  const fetcher = (fileReply, answer) => async (url) => (url.includes("digitalassetlinks") ? reply(200, {}, answer) : fileReply);
  const host = "example.test";
  let r = await AL.check(host, twa.packageId, [FP1], fetcher(site, { statements: [stmt(twa.packageId, FP1)] }));
  ok(r.ok && /^OK/.test(r.lines.at(-1)), "a good site failed: " + r.lines.join(" | "));
  r = await AL.check(host, twa.packageId, [FP1, FP2], fetcher(site, { statements: [stmt(twa.packageId, FP1)] }));
  ok(!r.ok && r.lines.some((l) => l.includes(FP2) && /does not read it yet/.test(l)), "a missing fingerprint was not reported: " + r.lines.join(" | "));
  r = await AL.check(host, twa.packageId, [], fetcher(site, { errorCode: ["ERROR_CODE_MALFORMED_CONTENT"], debugString: "x" }));
  ok(!r.ok && r.lines.some((l) => /ERROR_CODE_MALFORMED_CONTENT/.test(l)) && /^FAIL/.test(r.lines.at(-1)), "an error code was not reported: " + r.lines.join(" | "));
  r = await AL.check(host, twa.packageId, [], fetcher(reply(301, { "content-type": "text/html" }, null), { statements: [stmt(twa.packageId, FP1)] }));
  ok(!r.ok && r.lines.some((l) => /HTTP 301/.test(l)), "a redirect was accepted: " + r.lines.join(" | "));
  r = await AL.check(host, twa.packageId, [], fetcher(reply(200, { "content-type": "text/plain" }, null), { statements: [stmt(twa.packageId, FP1)] }));
  ok(!r.ok && r.lines.some((l) => /application\/json/.test(l)), "a wrong content type was accepted: " + r.lines.join(" | "));
  r = await AL.check(host, twa.packageId, [], async () => { throw Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } }); });
  ok(!r.ok && r.lines.some((l) => /ENOTFOUND/.test(l)), "a network error was not reported: " + r.lines.join(" | "));
});
await test("assetlinks.mjs command line", async (ok) => {
  const file = path.join(SCRATCH, "assetlinks.json");
  await copyFile(path.join(ROOT, "public/.well-known/assetlinks.json"), file);
  const original = await readFile(file, "utf8");
  const cli = (...a) => run("node", [path.join(PLAY, "assetlinks.mjs"), "--file", file, ...a]);
  let r = cli("--print");
  const hadEntry = AL.entriesFor(AL.parse(original), twa.packageId).length > 0;
  ok(hadEntry ? r.status === 0 : r.status === 1, "--print exit code is " + r.status);
  if (hadEntry) await writeFile(file, AL.format(AL.parse(original).filter((e) => e.target.package_name !== twa.packageId)) + "\n");
  const base = await readFile(file, "utf8");
  r = cli("--upload", FP1);
  ok(r.status === 0 && /Added an entry/.test(r.stdout), "--upload failed: " + r.stderr + r.stdout);
  ok(/WARNING/.test(r.stderr) === base.includes(PLACEHOLDER), "the warning about the placeholder is missing or wrong: " + r.stderr);
  if (base.includes(PLACEHOLDER)) ok(/Google rejects the WHOLE file/.test(r.stderr) && /Quest|fullswing/.test(r.stderr), "the warning does not explain the problem: " + r.stderr);
  let after = await readFile(file, "utf8");
  ok(after.startsWith(base.slice(0, base.lastIndexOf("}") + 1)), "the other entries changed (not byte for byte the same)");
  ok(JSON.parse(after).length === JSON.parse(base).length + 1, "the file does not hold one more entry");
  r = cli("--play", FP2);
  ok(r.status === 0, "--play failed: " + r.stderr);
  after = await readFile(file, "utf8");
  const mine = AL.entriesFor(JSON.parse(after), twa.packageId);
  ok(mine.length === 1 && JSON.stringify(mine[0].target.sha256_cert_fingerprints) === JSON.stringify([FP1, FP2]), "upload and play are not in one entry: " + after);
  ok(Array.isArray(JSON.parse(after)) && after.endsWith("]\n"), "the file is not a JSON list with a final line break");
  const before = after;
  for (const [label, args, re] of [["a duplicate", ["--play", FP2.toLowerCase()], /already in the entry/], ["a placeholder", ["--play", PLACEHOLDER], /placeholder/], ["a short value", ["--upload", "AA:BB"], /not a SHA-256/], ["no value", ["--upload"], /needs a SHA-256/]]) {
    r = cli(...args);
    ok(r.status === 1 && re.test(r.stderr), "\"" + label + "\" was not refused: " + r.status + " " + r.stderr);
    ok((await readFile(file, "utf8")) === before, "\"" + label + "\" changed the file");
  }
  r = cli("--print");
  ok(r.status === 0 && r.stdout.includes(FP1) && r.stdout.includes(FP2), "--print does not show both fingerprints: " + r.stdout);
  r = cli("--remove", FP1);
  ok(r.status === 0 && JSON.stringify(AL.entriesFor(JSON.parse(await readFile(file, "utf8")), twa.packageId)[0].target.sha256_cert_fingerprints) === JSON.stringify([FP2]), "--remove failed: " + r.stderr);
  // the Quest owner can replace the placeholder with the same tool
  if (base.includes(PLACEHOLDER)) {
    r = cli("--package", FULLSWING, "--upload", FP3);
    const links = JSON.parse(await readFile(file, "utf8"));
    ok(r.status === 0 && AL.entriesFor(links, FULLSWING)[0].target.sha256_cert_fingerprints.join() === FP3 && AL.warnings(links).length === 0, "--package could not replace the Full Swing placeholder: " + r.stderr);
  }
  ok(run("node", [path.join(PLAY, "assetlinks.mjs")]).status === 1, "no command did not fail");
  ok(run("node", [path.join(PLAY, "assetlinks.mjs"), "--upload", FP1, "--play", FP2]).status === 1, "two commands did not fail");
  ok(/--upload/.test(run("node", [path.join(PLAY, "assetlinks.mjs"), "--help"]).stdout), "--help prints nothing");
  // the real file is untouched by all of this
  ok((await read("public/.well-known/assetlinks.json")) === linksText, "the tests changed public/.well-known/assetlinks.json");
});

/* ---------------- build-aab.sh ---------------- */
const SH = path.join(PLAY, "build-aab.sh");
const sh = await readFile(SH, "utf8");
// Returns the problems of the script text: the pins, the key rules and the secret rules.
function checkScript(text) {
  const bad = [];
  const need = (re, what) => { if (!re.test(text)) bad.push("the script lacks " + what); };
  need(/^CLI_VERSION="1\.25\.0"$/m, "the pin CLI_VERSION=\"1.25.0\"");
  need(/^JDK_TAG="jdk-17\.0\.11\+9"/m, "the pin JDK_TAG=\"jdk-17.0.11+9\"");
  need(/^CMDLINE_TOOLS="11076708"/m, "the pin CMDLINE_TOOLS=\"11076708\"");
  need(/^BUILD_TOOLS="36\.1\.0"/m, "the pin BUILD_TOOLS=\"36.1.0\"");
  need(/^BUILD_TOOLS_AGP="35\.0\.0"/m, "the pin BUILD_TOOLS_AGP=\"35.0.0\"");
  need(/^PLATFORM="android-36"/m, "the pin PLATFORM=\"android-36\"");
  need(/"platform-tools"/, "the platform-tools package");
  need(/@bubblewrap\/cli/, "the upstream Bubblewrap package");
  if (/meta-quest|horizon|oculus/i.test(text)) bad.push("the script mentions the Meta fork or Horizon");
  need(/inside the repository/, "the refusal of a keystore inside the repository");
  need(/\$HOME\/\.android\/reelitin-upload\.keystore/, "the default upload keystore ~/.android/reelitin-upload.keystore");
  need(/KEY_ALIAS="\$\{BUBBLEWRAP_KEY_ALIAS:-reelitin\}"/, "the default alias reelitin");
  need(/chmod 600/, "chmod 600 on a new keystore");
  need(/NEVER be uploaded to Google Play/, "the line that a debug-key bundle can never be uploaded");
  need(/DEBUGKEY/, "DEBUGKEY in the name of a debug-key bundle");
  need(/PLAY_TOOLS:-\$REPO\/play\/\.tools/, "the tools folder play/.tools (PLAY_TOOLS)");
  need(/JAVA17_HOME/, "JAVA17_HOME");
  need(/ACCEPT_ANDROID_SDK_LICENSES/, "ACCEPT_ANDROID_SDK_LICENSES");
  if (/--licenses/.test(text.replace(/^#.*$/gm, ""))) bad.push("the script accepts all SDK licenses (--licenses), not only those of the packages it installs");
  need(/-storepass:env/, "-storepass:env (a password must not be on a command line)");
  need(/-keypass:env/, "-keypass:env");
  need(/aapt2.*dump badging/, "aapt2 dump badging");
  need(/apksigner.*verify.*--min-sdk-version/s, "apksigner verify --min-sdk-version");
  need(/jarsigner.*-verify/, "jarsigner -verify");
  need(/keytool.*-printcert -jarfile/s, "keytool -printcert -jarfile (the key of the bundle)");
  need(/--debug-key/, "--debug-key");
  need(/--local/, "--local");
  need(/--out/, "--out");
  need(/\.fingerprint\.txt/, "the fingerprint file");
  if (/(^|\s)set -[a-z]*x/m.test(text) || /bash -x/.test(text)) bad.push("the script traces its commands (set -x), which prints passwords");
  if (/-(storepass|keypass)[ =]+["'$]/.test(text)) bad.push("a keytool password on the command line");
  // Nothing that prints may expand a password: look at what follows echo, printf, say, die and cat, and at heredoc text.
  const expands = /\$\{?!?[A-Za-z_]*(PASSWORD|AGAIN)\b/;
  let heredoc = null;
  text.split("\n").forEach((line, i) => {
    if (heredoc) { if (line.trim() === heredoc) heredoc = null; else if (expands.test(line)) bad.push("line " + (i + 1) + " prints a password: " + line.trim()); return; }
    const code = line.replace(/^\s*#.*/, "");
    const here = code.match(/<<-?\s*'?"?(\w+)'?"?/);
    if (here) heredoc = here[1];
    const out = code.match(/(?:^|[;&|(]\s*|\|\|\s*|&&\s*)(?:echo|printf|say|die|cat)\b(.*)$/);
    if ((out && expands.test(out[1])) || (/>&2/.test(code) && expands.test(code))) bad.push("line " + (i + 1) + " may print a password: " + line.trim());
  });
  return bad;
}
await test("build-aab.sh", async (ok) => {
  let r = run("bash", ["-n", SH]);
  ok(r.status === 0, "bash -n: " + r.stderr);
  r = run("bash", [SH, "--help"]);
  ok(r.status === 0 && /Usage: play\/fish\/build-aab\.sh/.test(r.stdout) && /--debug-key/.test(r.stdout) && /--local/.test(r.stdout) && /--out DIR/.test(r.stdout), "--help: " + r.status + " " + r.stdout.slice(0, 200));
  ok(/NEVER be uploaded/.test(r.stdout) && /ACCEPT_ANDROID_SDK_LICENSES/.test(r.stdout) && /BUBBLEWRAP_KEYSTORE /.test(r.stdout), "--help does not explain the debug key, the key file and the licenses");
  r = run("bash", [SH, "--nonsense"]);
  ok(r.status === 2 && /Unknown option/.test(r.stderr), "an unknown option: " + r.status);
  r = run("bash", [SH, "--out"]);
  ok(r.status === 2, "--out without a folder: " + r.status);
  for (const p of checkScript(sh)) ok(false, p);
  // a keystore inside the repository is refused before anything is downloaded (the run has 20 s and an empty tools folder)
  const env = { ...process.env, PLAY_TOOLS: path.join(SCRATCH, "tools"), BUBBLEWRAP_KEYSTORE_PASSWORD: "secret-for-test" };
  r = run("bash", [SH], { env: { ...env, BUBBLEWRAP_KEYSTORE: path.join(ROOT, "play/fish/inside.keystore") }, timeout: 20000, input: "" });
  ok(r.status === 1 && /inside the repository/.test(r.stderr), "a keystore inside the repo was not refused: " + r.status + " " + r.stderr.slice(0, 200));
  r = run("bash", [SH], { env: { ...env, BUBBLEWRAP_KEYSTORE: "play/fish/relative.keystore" }, cwd: ROOT, timeout: 20000, input: "" });
  ok(r.status === 1 && /inside the repository/.test(r.stderr), "a relative keystore path inside the repo was not refused: " + r.status + " " + r.stderr.slice(0, 200));
  await symlink(path.join(ROOT, "play"), path.join(SCRATCH, "link-into-repo"));
  r = run("bash", [SH], { env: { ...env, BUBBLEWRAP_KEYSTORE: path.join(SCRATCH, "link-into-repo/linked.keystore") }, timeout: 20000, input: "" });
  ok(r.status === 1 && /inside the repository/.test(r.stderr), "a keystore behind a symlink into the repo was not refused: " + r.status + " " + r.stderr.slice(0, 200));
  r = run("bash", [SH], { env: { ...env, BUBBLEWRAP_KEYSTORE: path.join(SCRATCH, 'we"ird.keystore') }, timeout: 20000, input: "" });
  ok(r.status === 1 && /must not contain/.test(r.stderr), "a keystore path with a quote was not refused: " + r.status + " " + r.stderr.slice(0, 200));
  ok(!r.stdout.includes("secret-for-test") && !r.stderr.includes("secret-for-test"), "the password was printed");
  ok(!(await exists(path.join(SCRATCH, "tools/jdk17.tar.gz"))), "the script started a download before it refused the key");
});
await test("build-aab.sh checks can fail", async (ok) => {
  ok(checkScript(sh).length === 0, "the real script: " + checkScript(sh).join("; "));
  const cases = [
    ["Bubblewrap 1.24.1", sh.replace('CLI_VERSION="1.25.0"', 'CLI_VERSION="1.24.1"'), /CLI_VERSION/],
    ["JDK 21", sh.replace("jdk-17.0.11+9", "jdk-21.0.4+7"), /JDK_TAG/],
    ["SDK 34", sh.replace('PLATFORM="android-36"', 'PLATFORM="android-34"'), /PLATFORM/],
    ["build tools 34", sh.replace('BUILD_TOOLS="36.1.0"', 'BUILD_TOOLS="34.0.0"'), /BUILD_TOOLS=/],
    ["the Meta fork", sh + '\nnpm install "@meta-quest/bubblewrap-cli"\n', /Meta fork/],
    ["no repo refusal", sh.replace(/inside the repository/g, "somewhere"), /refusal of a keystore/],
    ["no chmod", sh.replace(/chmod 600/g, "chmod 644"), /chmod 600/],
    ["no loud debug line", sh.replace(/NEVER be uploaded to Google Play/g, "should not be uploaded"), /never be uploaded/],
    ["all licenses", sh + '\n"$SDKMANAGER" --licenses\n', /--licenses/],
    ["a password on the command line", sh + '\nkeytool -list -storepass "$X"\n', /command line/],
    ["a printed password", sh + '\necho "the password is $BUBBLEWRAP_KEYSTORE_PASSWORD"\n', /may print a password/],
    ["a printed key password", sh + '\nsay "key: ${BUBBLEWRAP_KEY_PASSWORD}"\n', /may print a password/],
    ["set -x", sh.replace("set -euo pipefail", "set -euxo pipefail"), /set -x/],
    ["no jarsigner check", sh.replace(/jarsigner/g, "jarsignerx").replace(/jarsignerx.*-verify/g, "true"), /jarsigner/],
  ];
  for (const [label, text, re] of cases) caught(ok, label, checkScript(text), re);
});

/* ---------------- the workflow ---------------- */
// A small YAML reader for the part of YAML that the workflow uses: mappings, lists, quoted and plain scalars, and | blocks.
function parseYaml(text) {
  const raw = text.replace(/\r/g, "").split("\n");
  raw.forEach((l, k) => { if (/^ *\t/.test(l)) throw new Error("line " + (k + 1) + ": a tab in the indentation"); });
  const indentOf = (l) => l.match(/^ */)[0].length;
  let pos = 0;
  const peek = () => { while (pos < raw.length && (!raw[pos].trim() || raw[pos].trim().startsWith("#"))) pos++; return pos < raw.length ? raw[pos] : null; };
  const isItem = (l) => l.trim() === "-" || l.trim().startsWith("- ");
  const scalar = (s, n) => {
    s = s.trim();
    if (s[0] === "'") { if (!/^'(?:[^']|'')*'$/.test(s)) throw new Error("line " + n + ": bad quoted text"); return s.slice(1, -1).replace(/''/g, "'"); }
    if (s[0] === '"') { try { return JSON.parse(s); } catch (e) { throw new Error("line " + n + ": bad quoted text"); } }
    if (s[0] === "[" || s[0] === "{") throw new Error("line " + n + ": flow collections are not supported by this reader");
    if (/ #/.test(s)) s = s.slice(0, s.indexOf(" #")).trim();
    return s === "true" ? true : s === "false" ? false : s;
  };
  function block(minIndent) {
    const l = peek();
    if (l === null || indentOf(l) < minIndent) return null;
    return isItem(l) ? seq(indentOf(l)) : map(indentOf(l));
  }
  function blockScalar(parentIndent) {
    const out = [];
    while (pos < raw.length && !(raw[pos].trim() && indentOf(raw[pos]) <= parentIndent)) out.push(raw[pos++]);
    while (out.length && !out[out.length - 1].trim()) out.pop();
    const pad = Math.min(...out.filter((x) => x.trim()).map(indentOf));
    return out.map((x) => x.slice(Math.min(pad, indentOf(x)))).join("\n") + "\n";
  }
  // the key and value on one line (n is the line number); indent is the indent of the mapping that owns the key
  function entry(textLine, indent, n, into) {
    const m = textLine.match(/^([A-Za-z0-9_.-]+|'[^']*'|"[^"]*"):(?:\s+(.*))?$/);
    if (!m) throw new Error("line " + n + ": not a key: " + textLine);
    const key = m[1].replace(/^['"]|['"]$/g, ""), rest = (m[2] || "").trim();
    if (key in into) throw new Error("line " + n + ": the key " + key + " appears twice");
    if (/^[|>][+-]?$/.test(rest)) into[key] = blockScalar(indent);
    else if (rest !== "") into[key] = scalar(rest, n);
    else { const l = peek(); into[key] = l !== null && (indentOf(l) > indent || (indentOf(l) === indent && isItem(l))) ? block(indentOf(l)) : null; }
  }
  function map(indent, out = {}) {
    for (let l = peek(); l !== null && indentOf(l) >= indent; l = peek()) {
      if (indentOf(l) > indent) throw new Error("line " + (pos + 1) + ": bad indentation");
      if (isItem(l)) break;
      pos++;
      entry(l.trim(), indent, pos, out);
    }
    return out;
  }
  function seq(indent) {
    const out = [];
    for (let l = peek(); l !== null && indentOf(l) === indent && isItem(l); l = peek()) {
      pos++;
      const body = l.trim().slice(2);
      if (/^([A-Za-z0-9_.-]+|'[^']*'|"[^"]*"):(\s|$)/.test(body)) {
        // a mapping whose first key is on the "- " line: its other keys sit at indent + 2
        const item = {};
        entry(body, indent + 2, pos, item);
        out.push(map(indent + 2, item));
      } else out.push(scalar(body, pos));
    }
    return out;
  }
  const root = block(0);
  if (peek() !== null) throw new Error("line " + (pos + 1) + ": unexpected text");
  return root;
}

const SECRETS = ["PLAY_UPLOAD_KEYSTORE_BASE64", "PLAY_UPLOAD_KEYSTORE_PASSWORD", "PLAY_UPLOAD_KEY_PASSWORD"];
// Returns the problems of the workflow text.
function checkWorkflow(text) {
  const bad = [];
  let wf;
  try { wf = parseYaml(text); } catch (e) { return ["the workflow is not valid YAML: " + e.message]; }
  const on = wf.on || {};
  if (Object.keys(on).join() !== "workflow_dispatch") bad.push("the workflow must run only on workflow_dispatch (it has " + Object.keys(on).join(", ") + ")");
  if (!on.workflow_dispatch || !on.workflow_dispatch.inputs || !on.workflow_dispatch.inputs.note) bad.push("the workflow has no input \"note\"");
  if (JSON.stringify(wf.permissions) !== JSON.stringify({ contents: "read" })) bad.push("permissions must be contents: read and nothing else");
  const job = Object.values(wf.jobs || {})[0] || {};
  const steps = job.steps || [];
  if (!steps.length) bad.push("the job has no steps");
  if (!(job["timeout-minutes"] > 0)) bad.push("the job has no timeout");
  for (const s of steps) {
    if (s.uses && !/^[\w.-]+\/[\w.-]+@v\d+$/.test(s.uses)) bad.push("the action " + s.uses + " is not pinned to a major version tag (owner/name@vN)");
    if (s.run && /\$\{\{/.test(s.run)) bad.push("a run step uses a ${{ }} expression (put it in env: instead)");
    for (const [where, value] of Object.entries({ run: s.run, name: s.name, with: JSON.stringify(s.with || {}), if: s.if })) if (value && /secrets\./.test(value)) bad.push("a secret is used in " + where + " of the step \"" + (s.name || s.uses) + "\"; use env:");
  }
  const used = new Set([...text.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]));
  for (const s of SECRETS) if (!used.has(s)) bad.push("the secret " + s + " is not used");
  for (const s of used) if (!SECRETS.includes(s)) bad.push("the secret " + s + " is not one of the three that the guide names");
  for (const line of text.split("\n")) {
    if (/\becho\b/.test(line) && /(secrets\.|KEYSTORE_B64|PASSWORD|BUBBLEWRAP_KEY)/.test(line)) bad.push("a line may print a secret: " + line.trim());
    if (/\bset -[a-z]*x\b|bash -x|ACTIONS_STEP_DEBUG|ACTIONS_RUNNER_DEBUG/.test(line)) bad.push("tracing may print a secret: " + line.trim());
    if (/\$\{\{\s*secrets\./.test(line) && !/^\s+[A-Z][A-Z0-9_]*: \$\{\{ secrets\.\w+ \}\}\s*$/.test(line)) bad.push("a secret is used outside an env value: " + line.trim());
  }
  const find = (re) => steps.find((s) => re.test(s.uses || ""));
  const node = find(/^actions\/setup-node@/), java = find(/^actions\/setup-java@/), up = find(/^actions\/upload-artifact@/);
  if (!node || String(node.with["node-version"]) !== "22") bad.push("Node 22 is not set up");
  if (!java || java.with.distribution !== "temurin" || String(java.with["java-version"]) !== "17") bad.push("Temurin 17 is not set up");
  const checkout = find(/^actions\/checkout@/);
  if (!checkout) bad.push("no checkout");
  else if (!checkout.with || checkout.with["persist-credentials"] !== false) bad.push("checkout must set persist-credentials: false (the token stays out of .git/config)");
  const write = steps.find((s) => s.run && /base64 -d/.test(s.run));
  if (!write) bad.push("no step writes the keystore from the secret");
  else {
    if (!/\$RUNNER_TEMP/.test(write.run) || /GITHUB_WORKSPACE|github\.workspace/.test(write.run)) bad.push("the keystore must go to $RUNNER_TEMP, outside the workspace");
    if (!/umask 077/.test(write.run)) bad.push("the keystore is not written with umask 077");
  }
  const build = steps.find((s) => s.run && /play\/fish\/build-aab\.sh/.test(s.run));
  if (!build) bad.push("no step runs play/fish/build-aab.sh");
  else {
    const env = build.env || {};
    if (env.ACCEPT_ANDROID_SDK_LICENSES !== "yes") bad.push("the build step does not set ACCEPT_ANDROID_SDK_LICENSES: 'yes'");
    if (!/secrets\.PLAY_UPLOAD_KEYSTORE_PASSWORD/.test(env.BUBBLEWRAP_KEYSTORE_PASSWORD || "")) bad.push("BUBBLEWRAP_KEYSTORE_PASSWORD does not come from the secret");
    if (!/secrets\.PLAY_UPLOAD_KEY_PASSWORD/.test(env.BUBBLEWRAP_KEY_PASSWORD || "")) bad.push("BUBBLEWRAP_KEY_PASSWORD does not come from the optional secret");
    if (/--debug-key/.test(build.run)) bad.push("the workflow builds with the debug key");
    if (!/--out "?\$RUNNER_TEMP/.test(build.run)) bad.push("the bundle must go to a folder in $RUNNER_TEMP");
  }
  if (!up) bad.push("no artifact upload");
  else {
    const days = Number(up.with["retention-days"]);
    if (!(days >= 1 && days <= 14)) bad.push("retention-days must be 1 to 14 (it is " + up.with["retention-days"] + ")");
    if (!/\.aab/.test(up.with.path) || !/fingerprint\.txt/.test(up.with.path)) bad.push("the artifact must hold the .aab and the fingerprint file");
    if (/\.keystore|\.apk/.test(up.with.path)) bad.push("the artifact must not hold a keystore or an APK");
  }
  const last = steps[steps.length - 1] || {};
  if (!(last.if === "always()" && /rm -f/.test(last.run || "") && /reelitin-upload\.keystore/.test(last.run || ""))) bad.push("the last step must delete the keystore and run always()");
  if (!steps.some((s) => /qa\/fish\/play\.mjs/.test(s.run || ""))) bad.push("the workflow does not run qa/fish/play.mjs first");
  return bad;
}
const wfText = await read(".github/workflows/play-aab.yml");
await test("play-aab.yml", async (ok) => {
  for (const p of checkWorkflow(wfText)) ok(false, p);
  ok(!/\becho\b/.test(wfText), "the workflow uses echo (use printf, which cannot print a secret by accident)");
});
await test("play-aab.yml checks can fail", async (ok) => {
  ok(checkWorkflow(wfText).length === 0, "the real workflow: " + checkWorkflow(wfText).join("; "));
  const sub = (a, b) => { if (!wfText.includes(a)) throw new Error("fixture text not found: " + a); return wfText.replace(a, b); };
  const cases = [
    ["not YAML", wfText.replace("jobs:", "jobs\n  :"), /not valid YAML/],
    ["a tab", wfText.replace("  bundle:", "\tbundle:"), /not valid YAML|tab/],
    ["a push trigger", sub("on:\n  workflow_dispatch:", "on:\n  push:\n    branches: [main]\n  workflow_dispatch:"), /not valid YAML|only on workflow_dispatch/],
    ["a push trigger in block form", sub("on:\n  workflow_dispatch:", "on:\n  push:\n    branches:\n      - main\n  workflow_dispatch:"), /only on workflow_dispatch/],
    ["write permission", sub("contents: read", "contents: write"), /permissions/],
    ["an action on a branch", sub("actions/checkout@v7", "actions/checkout@main"), /not pinned/],
    ["an action on a full tag", sub("actions/checkout@v7", "actions/checkout@v7.0.1"), /not pinned/],
    ["checkout keeps the token", sub("persist-credentials: false", "persist-credentials: true"), /persist-credentials/],
    ["echo of a secret", sub("run: rm -f", 'run: echo "$BUBBLEWRAP_KEYSTORE_PASSWORD"; rm -f'), /may print a secret/],
    ["echo of a secret expression", sub("      - name: Delete the upload keystore", '      - run: echo ${{ secrets.PLAY_UPLOAD_KEYSTORE_PASSWORD }}\n      - name: Delete the upload keystore'), /may print a secret|secret is used/],
    ["a secret in a run step", sub('printf \'%s\' "$KEYSTORE_B64"', "printf '%s' \"${{ secrets.PLAY_UPLOAD_KEYSTORE_BASE64 }}\""), /secret is used|expression/],
    ["set -x", sub("umask 077", "set -x\n          umask 077"), /tracing/],
    ["a keystore in the workspace", sub('KEYSTORE="$RUNNER_TEMP/reelitin-upload.keystore"\n          printf', 'KEYSTORE="$GITHUB_WORKSPACE/reelitin-upload.keystore"\n          printf'), /outside the workspace|RUNNER_TEMP/],
    ["no umask", sub("umask 077\n", ""), /umask/],
    ["long retention", sub("retention-days: 7", "retention-days: 90"), /retention-days/],
    ["a keystore in the artifact", sub("${{ runner.temp }}/play-out/*.aab", "${{ runner.temp }}/*.keystore"), /must (hold|not hold)/],
    ["no cleanup", sub("if: always()", "if: success()"), /delete the keystore/],
    ["no licence flag", sub("ACCEPT_ANDROID_SDK_LICENSES: 'yes'", "FOO: 'yes'"), /ACCEPT_ANDROID_SDK_LICENSES/],
    ["the debug key", sub("build-aab.sh --local", "build-aab.sh --debug-key --local"), /debug key/],
    ["Node 20", sub("node-version: '22'", "node-version: '20'"), /Node 22/],
    ["JDK 21", sub("java-version: '17'", "java-version: '21'"), /Temurin 17/],
    ["an unknown secret", sub("secrets.PLAY_UPLOAD_KEY_PASSWORD", "secrets.OTHER_PASSWORD"), /secret/],
    ["a tests step missing", sub("node qa/fish/play.mjs", "true"), /qa\/fish\/play\.mjs/],
  ];
  for (const [label, text, re] of cases) caught(ok, label, checkWorkflow(text), re);
  // the reader itself
  const y = parseYaml("a: 1\nb:\n  - x: 'it''s'\n    y: |\n      line1\n      line2\n  - z\nc: \"q\"\n");
  ok(y.a === "1" && y.b[0].x === "it's" && y.b[0].y === "line1\nline2\n" && y.b[1] === "z" && y.c === "q", "the YAML reader gives " + JSON.stringify(y));
  ok((() => { try { parseYaml("a: 1\n a: 2\n"); } catch (e) { return true; } return false; })(), "the YAML reader accepted a bad indent");
  ok((() => { try { parseYaml("a: 1\na: 2\n"); } catch (e) { return true; } return false; })(), "the YAML reader accepted a repeated key");
});

/* ---------------- the repository: ignore rules, the guide, the README, the OpenSpec change ---------------- */
const hasEmDash = (text) => text.includes("\u2014");
const IGNORED = [".tools/", "android/", "build/", "dist/", ".gradle/", "manifest-checksum.txt", "local.properties", "*.keystore", "*.jks", "*.p12", "*.apk", "*.aab", "*.idsig"];
const checkIgnore = (text) => IGNORED.filter((p) => !text.split("\n").map((l) => l.trim()).includes(p)).map((p) => "play/.gitignore does not list " + p);
await test("play/.gitignore", async (ok) => {
  for (const p of checkIgnore(await read("play/.gitignore"))) ok(false, p);
  caught(ok, "no *.keystore", checkIgnore("*.jks\n"), /\*\.keystore/);
  const git = run("git", ["--version"]);
  if (git.status !== 0) { info("git is not installed: the git check-ignore checks were skipped"); return; }
  for (const f of ["play/.tools/x", "play/fish/android/app/x", "play/fish/dist/reelitin-1.0.0-1.aab", "play/fish/upload.keystore", "play/fish/x.jks", "play/fish/x.p12", "play/fish/x.apk", "play/fish/x.aab"]) {
    ok(run("git", ["check-ignore", "-q", f], { cwd: ROOT }).status === 0, f + " is not ignored by git");
  }
  ok(run("git", ["check-ignore", "-q", "play/fish/build-aab.sh"], { cwd: ROOT }).status === 1, "play/fish/build-aab.sh is ignored by git");
  const tracked = run("git", ["ls-files", "play", ".github/workflows/play-aab.yml"], { cwd: ROOT }).stdout.split("\n").filter(Boolean);
  for (const f of tracked) ok(!/\.(keystore|jks|p12|apk|aab|idsig)$/.test(f) && !/\/(\.tools|android|dist)\//.test(f), f + " is tracked, but must stay out of git");
});
await test("the guide, the README and the OpenSpec change", async (ok) => {
  const guide = await read("play/fish/README.md");
  const files = (await readdir(PLAY)).filter((f) => !["android", "dist", "README.md"].includes(f)).sort();
  for (const f of files) ok(guide.includes("`" + f + "`"), "play/fish/README.md does not describe " + f);
  for (const s of ["UNCONFIRMED", "DEVICE", "privacy.html", "PLAY_UPLOAD_KEYSTORE_BASE64", "assetlinks.mjs --play", "assetlinks.mjs --check", "12 testers"]) ok(guide.includes(s), "play/fish/README.md lacks \"" + s + "\"");
  const readme = await read("README.md");
  ok((readme.match(/^## Reel It In on Google Play$/gm) || []).length === 1, "README.md needs exactly one section \"Reel It In on Google Play\"");
  ok(/play\/fish\/README\.md/.test(readme.split("## Reel It In on Google Play")[1] || ""), "the README section does not point at play/fish/README.md");
  ok(/\| `qa\/fish\/play\.mjs` \|/.test(readme), "README.md has no row for qa/fish/play.mjs in the test table");
  const dir = "openspec/changes/fish-play-store-android/";
  for (const f of ["proposal.md", "design.md", "tasks.md", "specs/fish-play-app/spec.md"]) ok(await exists(path.join(ROOT, dir, f)), dir + f + " is missing");
  const spec = await read(dir + "specs/fish-play-app/spec.md");
  ok(/^## ADDED Requirements$/m.test(spec), "the spec lacks \"## ADDED Requirements\"");
  const reqs = spec.split(/^### Requirement: /m).slice(1);
  ok(reqs.length >= 6, "the spec has only " + reqs.length + " requirements");
  for (const r of reqs) {
    const title = r.split("\n")[0];
    ok(/\b(SHALL|SHALL NOT)\b/.test(r.split("#### Scenario:")[0]), "the requirement \"" + title + "\" has no SHALL");
    const scenarios = r.split(/^#### Scenario: /m).slice(1);
    ok(scenarios.length >= 1, "the requirement \"" + title + "\" has no scenario");
    for (const s of scenarios) ok(/\*\*WHEN\*\*/.test(s) && /\*\*THEN\*\*/.test(s), "a scenario of \"" + title + "\" lacks WHEN or THEN");
  }
  const tasks = await read(dir + "tasks.md");
  ok(/^- \[[ x]\] /m.test(tasks), "tasks.md has no checklist");
  ok(/OpenSpec CLI/i.test(tasks + (await read(dir + "design.md"))), "the change does not say that the OpenSpec CLI did not run");
  // style: no em dash in any file of this package
  const mine = ["play/fish/README.md", "play/fish/build-aab.sh", "play/fish/assetlinks.mjs", "play/fish/patch-android.mjs", "play/fish/verify-output.mjs", "play/fish/twa-manifest.json", "play/.gitignore", ".github/workflows/play-aab.yml", "qa/fish/play.mjs", dir + "proposal.md", dir + "design.md", dir + "tasks.md", dir + "specs/fish-play-app/spec.md"];
  for (const f of mine) ok(!hasEmDash(await read(f)), f + " has an em dash");
  const section = readme.split("## Reel It In on Google Play")[1].split(/\n## /)[0];
  ok(!hasEmDash(section), "the README section has an em dash");
  ok(hasEmDash("a \u2014 b") && !hasEmDash("a - b"), "the em dash check cannot fail");
});

await rm(SCRATCH, { recursive: true, force: true });
if (fails) { console.log("FAIL: play (" + fails + " failed)"); process.exit(1); }
pass("play");
