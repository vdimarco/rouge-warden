// Checks what build-aab.sh built against play/fish/twa-manifest.json: the APK's badging (aapt2 dump badging), its resources
// (aapt2 dump resources) and the manifest inside the bundle.
// Run: node play/fish/verify-output.mjs <badging.txt> <resources.txt> <aab-manifest.bin> --twa twa-manifest.json --target-sdk 36
// Exits 1 and says what is wrong; otherwise prints what it found. qa/fish/play.mjs tests the checks on fixtures.
// The bundle keeps its manifest as protobuf (base/manifest/AndroidManifest.xml). parseManifest reads it with a small
// protobuf reader, for the messages XmlNode, XmlElement and XmlAttribute of aapt2's Resources.proto.
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

// The one permission that AndroidX adds to every app that uses a receiver: it is internal and asks the user for nothing.
export const ANDROIDX_INTERNAL = /\.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION$/;

/* ---------------- the protobuf manifest ---------------- */
function varint(b, p) {
  let v = 0, s = 0;
  for (;;) { const c = b[p++]; v += (c & 127) * 2 ** s; if (!(c & 128)) return [v, p]; s += 7; }
}
function fields(b) {
  const out = [];
  for (let p = 0; p < b.length;) {
    let key, v; [key, p] = varint(b, p);
    const wire = key & 7;
    if (wire === 0) [v, p] = varint(b, p);
    else if (wire === 2) { let len; [len, p] = varint(b, p); v = b.subarray(p, p + len); p += len; }
    else if (wire === 1 || wire === 5) { const len = wire === 1 ? 8 : 4; v = b.subarray(p, p + len); p += len; }
    else throw new Error("not a protobuf manifest (wire type " + wire + ")");
    out.push({ n: key >> 3, v });
  }
  return out;
}
const text = (f, n) => { const x = f.find((y) => y.n === n); return x ? x.v.toString("utf8") : ""; };
// Returns { name, attrs: { name: value }, children: [...] } for the root element.
export function parseManifest(bytes) {
  const node = (b) => {
    const el = fields(b).find((x) => x.n === 1);
    if (!el) return null; // a text node
    const e = fields(el.v);
    const attrs = {};
    for (const a of e.filter((x) => x.n === 4)) { const g = fields(a.v); attrs[text(g, 2)] = text(g, 3); }
    return { name: text(e, 3), attrs, children: e.filter((x) => x.n === 5).map((c) => node(c.v)).filter(Boolean) };
  };
  const root = node(Buffer.from(bytes));
  if (!root || root.name !== "manifest") throw new Error("the file is not an Android manifest");
  return root;
}

/* ---------------- the checks ---------------- */
function permissionProblems(permissions, packageId, who) {
  return permissions.filter((p) => !(ANDROIDX_INTERNAL.test(p) && p.startsWith(packageId + "."))).map((p) => who + " asks for the permission " + p);
}
const describePermissions = (list) => (list.length ? "permissions " + list.join(", ") + (list.every((p) => ANDROIDX_INTERNAL.test(p)) ? " (AndroidX internal, asks the user for nothing)" : "") : "no permission");

// badging: the text of `aapt2 dump badging app.apk`. want: { packageId, versionCode, versionName, minSdk, targetSdk }.
// Returns { problems, facts, permissions }.
export function checkBadging(badging, want) {
  const problems = [], facts = [];
  const pkg = badging.match(/^package: name='([^']*)' versionCode='([^']*)' versionName='([^']*)'/m);
  if (!pkg) problems.push("the badging has no package line");
  else {
    if (pkg[1] !== want.packageId) problems.push("the APK package id is " + pkg[1] + ", not " + want.packageId);
    if (pkg[2] !== String(want.versionCode)) problems.push("the APK versionCode is " + pkg[2] + ", not " + want.versionCode);
    if (pkg[3] !== String(want.versionName)) problems.push("the APK versionName is " + pkg[3] + ", not " + want.versionName);
    facts.push("APK: package " + pkg[1] + ", versionCode " + pkg[2] + ", versionName " + pkg[3]);
  }
  const num = (re) => { const m = badging.match(re); return m ? m[1] : null; };
  const min = num(/^(?:minSdkVersion|sdkVersion):'(\d+)'/m), target = num(/^targetSdkVersion:'(\d+)'/m);
  if (min !== String(want.minSdk)) problems.push("the APK minSdkVersion is " + min + ", not " + want.minSdk);
  if (target !== String(want.targetSdk)) problems.push("the APK targetSdkVersion is " + target + ", not " + want.targetSdk);
  facts.push("APK: minSdkVersion " + min + ", targetSdkVersion " + target);
  const permissions = [...badging.matchAll(/^uses-permission(?:-sdk-23)?: name='([^']*)'/gm)].map((m) => m[1]);
  problems.push(...permissionProblems(permissions, want.packageId, "the APK"));
  facts.push("APK: " + describePermissions(permissions));
  const label = num(/^application-label:'([^']*)'/m);
  if (label !== "Reel It In") problems.push("the APK label is " + label + ", not Reel It In");
  return { problems, facts, permissions };
}

// bytes: base/manifest/AndroidManifest.xml of the bundle. apkPermissions: the permissions of the APK, which must be the same.
// Returns { problems, facts }.
export function checkBundleManifest(bytes, want, apkPermissions = []) {
  const problems = [], facts = [];
  const m = parseManifest(bytes), kids = (n, of = m) => of.children.filter((c) => c.name === n);
  const a = m.attrs;
  if (a.package !== want.packageId) problems.push("the bundle package id is " + a.package + ", not " + want.packageId);
  if (a.versionCode !== String(want.versionCode)) problems.push("the bundle versionCode is " + a.versionCode + ", not " + want.versionCode);
  if (a.versionName !== String(want.versionName)) problems.push("the bundle versionName is " + a.versionName + ", not " + want.versionName);
  facts.push("bundle: package " + a.package + ", versionCode " + a.versionCode + ", versionName " + a.versionName);
  const sdk = (kids("uses-sdk")[0] || { attrs: {} }).attrs;
  if (sdk.minSdkVersion !== String(want.minSdk)) problems.push("the bundle minSdkVersion is " + sdk.minSdkVersion + ", not " + want.minSdk);
  if (sdk.targetSdkVersion !== String(want.targetSdk)) problems.push("the bundle targetSdkVersion is " + sdk.targetSdkVersion + ", not " + want.targetSdk);
  facts.push("bundle: minSdkVersion " + sdk.minSdkVersion + ", targetSdkVersion " + sdk.targetSdkVersion);
  const permissions = kids("uses-permission").map((p) => p.attrs.name);
  problems.push(...permissionProblems(permissions, want.packageId, "the bundle"));
  if ([...permissions].sort().join() !== [...apkPermissions].sort().join()) problems.push("the bundle and the APK ask for different permissions");
  facts.push("bundle: " + describePermissions(permissions));
  const app = kids("application")[0] || { attrs: {}, children: [] };
  if (app.attrs.appCategory !== "game") problems.push("the bundle has no android:appCategory=\"game\" (Android 16 then ignores the portrait lock on tablets)");
  if (app.attrs.allowBackup !== "false") problems.push("the bundle does not set android:allowBackup=\"false\"");
  facts.push("bundle: appCategory " + app.attrs.appCategory + ", allowBackup " + app.attrs.allowBackup);
  // The app must open links to its own scope only. The autoVerify filter says which links these are.
  const filters = kids("activity", app).flatMap((act) => kids("intent-filter", act)).filter((f) => f.attrs.autoVerify === "true");
  const paths = filters.flatMap((f) => kids("data", f).map((d) => d.attrs.pathPrefix || d.attrs.path || d.attrs.pathPattern || ""));
  if (want.scopePath) {
    if (!paths.length || paths.some((p) => p !== want.scopePath)) problems.push("the app link filter opens " + (paths.join(", ") || "the whole host") + ", not only " + want.scopePath);
    facts.push("bundle: app links open " + (paths.join(", ") || "the whole host"));
  }
  return { problems, facts };
}

// What the built app must hold, from twa-manifest.json (twa) and the SDK level that patch-android.mjs requires.
export function wantFromTwa(twa, targetSdk) {
  return {
    packageId: twa.packageId, versionCode: twa.appVersionCode, versionName: twa.appVersionName, minSdk: twa.minSdkVersion, targetSdk,
    scopePath: new URL(twa.fullScopeUrl).pathname, host: twa.host, launchUrl: new URL(twa.startUrl, "https://" + twa.host).href,
    orientation: twa.orientation, webManifestUrl: twa.webManifestUrl, fullScopeUrl: twa.fullScopeUrl, fallbackType: twa.fallbackType,
    enableNotifications: twa.enableNotifications,
  };
}

// resources: the text of `aapt2 dump resources app.apk`. The app opens the launch URL that twa-manifest.json names, in the
// orientation that it names, and the web manifest URL points at the live host even when the build used --local.
export function checkResources(resources, want) {
  const problems = [], facts = [], value = {};
  for (const m of resources.matchAll(/resource 0x[0-9a-f]+ (?:string|bool)\/(\w+)\n\s+\(\) (.*)/g)) value[m[1]] = m[2].replace(/^"([\s\S]*)"$/, "$1");
  const expect = (key, wanted, label) => { if (value[key] !== String(wanted)) problems.push("the APK has " + label + " " + value[key] + ", twa-manifest.json says " + wanted); };
  expect("launchUrl", want.launchUrl, "the launch URL");
  expect("hostName", want.host, "the host");
  expect("fullScopeUrl", want.fullScopeUrl, "the scope URL");
  expect("webManifestUrl", want.webManifestUrl, "the web manifest URL");
  expect("orientation", want.orientation, "the orientation");
  expect("fallbackType", want.fallbackType, "the fallback type");
  expect("enableNotification", want.enableNotifications, "enableNotification");
  facts.push("APK opens " + value.launchUrl + ", orientation " + value.orientation + ", fallback " + value.fallbackType);
  return { problems, facts };
}

/* ---------------- run ---------------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), files = [], opt = {};
  for (let i = 0; i < args.length; i++) { if (args[i].startsWith("--")) opt[args[i].slice(2)] = args[++i]; else files.push(args[i]); }
  if (files.length !== 3 || !opt.twa || !opt["target-sdk"]) {
    console.error("usage: verify-output.mjs <badging.txt> <resources.txt> <aab-manifest.bin> --twa twa-manifest.json --target-sdk 36");
    process.exit(2);
  }
  try {
    const want = wantFromTwa(JSON.parse(await readFile(opt.twa, "utf8")), opt["target-sdk"]);
    const a = checkBadging(await readFile(files[0], "utf8"), want);
    const r = checkResources(await readFile(files[1], "utf8"), want);
    const b = checkBundleManifest(await readFile(files[2]), want, a.permissions);
    for (const f of [...a.facts, ...r.facts, ...b.facts]) console.log("  " + f);
    const problems = [...a.problems, ...r.problems, ...b.problems];
    if (problems.length) { console.error("verify-output: " + problems.join("\nverify-output: ")); process.exit(1); }
    console.log("The APK and the bundle match twa-manifest.json: target SDK " + want.targetSdk + ", no permission that asks the user for anything.");
  } catch (e) {
    console.error("verify-output: " + e.message);
    process.exit(1);
  }
}
