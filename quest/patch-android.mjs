// Patches the Android project that Bubblewrap generates so it meets the Horizon Store manifest rules.
// Bubblewrap 1.24.1 hard-codes SDK 32 and leaves out several rules (research/store-packaging.md). Safe to run again and again.
// Run: node quest/patch-android.mjs [projectDir]   (default quest/android). Exits 1 when a file does not look as expected.
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ---------------- the rules ---------------- */
// https://developers.meta.com/horizon/resources/publish-mobile-manifest/ (updated 2026-08-31)
export const RULES = {
  sdk: 34, // compileSdk and targetSdk: apps created after 2026-03-01 must target 34
  minSdk: 32, // the Store accepts 29 to 34; 32 is what Meta recommends for the Quest 3 family
  devices: "quest3|quest3s",
};

/* ---------------- app/build.gradle ---------------- */
export function patchGradle(src) {
  let out = src;
  const need = (re, what) => { if (!re.test(out)) throw new Error("app/build.gradle: no " + what + " line. Did the Bubblewrap template change?"); };
  need(/compileSdkVersion\s+\d+/, "compileSdkVersion");
  need(/targetSdkVersion\s+\d+/, "targetSdkVersion");
  need(/minSdkVersion\s+\d+/, "minSdkVersion");
  out = out.replace(/compileSdkVersion\s+\d+/g, "compileSdkVersion " + RULES.sdk);
  out = out.replace(/targetSdkVersion\s+\d+/g, "targetSdkVersion " + RULES.sdk);
  // raise a low minSdk, never lower one that is already inside the Store range
  out = out.replace(/minSdkVersion\s+(\d+)/g, (m, v) => "minSdkVersion " + Math.max(+v, RULES.minSdk));
  return out;
}

/* ---------------- app/src/main/AndroidManifest.xml ---------------- */
// Sets attr="value" on the first tag that matches re, adding the attribute when it is missing.
function setAttr(xml, re, attr, value, what) {
  const m = xml.match(re);
  if (!m) throw new Error("AndroidManifest.xml: no " + what + ". Did the Bubblewrap template change?");
  const tag = m[0];
  const has = new RegExp("\\s" + attr.replace(":", "\\:") + "=\"[^\"]*\"");
  const end = tag.endsWith("/>") ? tag.length - 2 : tag.length - 1;
  // a new attribute goes on its own line, indented like the tag's last line
  const indent = (tag.match(/\n([ \t]+)[^\n]*$/) || [0, "    "])[1];
  const next = has.test(tag) ? tag.replace(has, " " + attr + "=\"" + value + "\"") : tag.slice(0, end).replace(/\s*$/, "") + "\n" + indent + attr + "=\"" + value + "\"" + tag.slice(end);
  return xml.replace(tag, next);
}

export function patchManifest(src) {
  let out = src;
  // installLocation="auto" on the root element
  out = setAttr(out, /<manifest\b[^>]*>/, "android:installLocation", "auto", "<manifest> element");
  // an immersive app needs 6DoF head tracking, so the feature is required
  if (/<uses-feature\b[^>]*"android\.hardware\.vr\.headtracking"[^>]*>/.test(out)) {
    out = setAttr(out, /<uses-feature\b[^>]*"android\.hardware\.vr\.headtracking"[^>]*>/, "android:required", "true", "headtracking feature");
  } else {
    out = out.replace(/(\n\s*)<application\b/, "$1<uses-feature android:name=\"android.hardware.vr.headtracking\" android:required=\"true\" android:version=\"1\" />\n$1<application");
  }
  // the devices we support, as a meta-data element on <application>
  if (/android:name="com\.oculus\.supportedDevices"/.test(out)) {
    out = setAttr(out, /<meta-data\b[^>]*"com\.oculus\.supportedDevices"[^>]*>/, "android:value", RULES.devices, "supportedDevices meta-data");
  } else {
    const app = out.match(/<application\b[^>]*>/);
    if (!app) throw new Error("AndroidManifest.xml: no <application> element.");
    out = out.replace(app[0], app[0] + "\n\n        <meta-data\n            android:name=\"com.oculus.supportedDevices\"\n            android:value=\"" + RULES.devices + "\" />");
  }
  // the launcher activity stays out of the recent apps list
  out = setAttr(out, /<activity\b[^>]*android:name="LauncherActivity"[^>]*>/, "android:excludeFromRecents", "true", "LauncherActivity");
  return out;
}

/* ---------------- checks ---------------- */
// Returns a list of problems (empty when the project meets every rule). build-apk.sh and qa/vr/pwa.mjs use it.
export function check(gradle, manifest) {
  const bad = [];
  const num = (re) => { const m = gradle.match(re); return m ? +m[1] : null; };
  if (num(/compileSdkVersion\s+(\d+)/) !== RULES.sdk) bad.push("compileSdkVersion is not " + RULES.sdk);
  if (num(/targetSdkVersion\s+(\d+)/) !== RULES.sdk) bad.push("targetSdkVersion is not " + RULES.sdk);
  const min = num(/minSdkVersion\s+(\d+)/);
  if (!(min >= 29 && min <= 34)) bad.push("minSdkVersion is not in 29..34");
  if (!/<manifest\b[^>]*android:installLocation="auto"/.test(manifest)) bad.push("installLocation is not auto");
  if (!/<uses-feature\b[^>]*"android\.hardware\.vr\.headtracking"[^>]*android:required="true"/.test(manifest.replace(/\s+/g, " "))) bad.push("headtracking is not required");
  if (!new RegExp("<meta-data\\s+android:name=\"com\\.oculus\\.supportedDevices\"\\s+android:value=\"" + RULES.devices.replace(/\|/g, "\\|") + "\"").test(manifest)) bad.push("supportedDevices is not " + RULES.devices);
  if (!/<activity\b[^>]*android:name="LauncherActivity"[^>]*android:excludeFromRecents="true"/.test(manifest)) bad.push("LauncherActivity does not exclude itself from recents");
  return bad;
}

/* ---------------- run ---------------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] || path.join(HERE, "android"));
  const gradlePath = path.join(dir, "app/build.gradle");
  const manifestPath = path.join(dir, "app/src/main/AndroidManifest.xml");
  try {
    const gradle = patchGradle(await readFile(gradlePath, "utf8"));
    const manifest = patchManifest(await readFile(manifestPath, "utf8"));
    await writeFile(gradlePath, gradle);
    await writeFile(manifestPath, manifest);
    const bad = check(gradle, manifest);
    if (bad.length) throw new Error("after the patch: " + bad.join("; "));
    console.log("patch-android: " + path.relative(process.cwd(), dir) + " meets the Store manifest rules (SDK " + RULES.sdk + ", " + RULES.devices + ")");
  } catch (e) {
    console.error("patch-android: " + e.message);
    process.exit(1);
  }
}
