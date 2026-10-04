// Patches the Android project that Bubblewrap 1.25.0 generates, so that Reel It In meets the Google Play rules.
// Bubblewrap 1.25.0 already sets compileSdk and targetSdk 36 and puts no permission in the manifest. It leaves out
// android:appCategory (Android 16 then ignores the portrait lock on tablets) and keeps android:allowBackup on.
// Safe to run again and again.
// Run: node play/fish/patch-android.mjs [projectDir]   (default play/fish/android). Exits 1 when a file does not look as expected.
//      node play/fish/patch-android.mjs --target-sdk   prints the SDK level that the build must target
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ---------------- the rules ---------------- */
// https://developer.android.com/google/play/requirements/target-sdk: since 2026-08-31 new apps and updates target API 36
export const RULES = {
  sdk: 36, // compileSdk and targetSdk; the build fails when Bubblewrap does not generate this value
};

/* ---------------- app/build.gradle ---------------- */
// Fails when Bubblewrap does not generate SDK 36. It never lowers or raises a value: a wrong SDK must stop the build.
export function assertGradle(src) {
  const bad = [];
  for (const key of ["compileSdkVersion", "targetSdkVersion"]) {
    const m = src.match(new RegExp(key + "\\s+(\\d+)"));
    if (!m) bad.push("app/build.gradle: no " + key + " line. Did the Bubblewrap template change?");
    else if (+m[1] !== RULES.sdk) bad.push("app/build.gradle: " + key + " is " + m[1] + ", Google Play needs " + RULES.sdk + ".");
  }
  if (bad.length) throw new Error(bad.join(" "));
  return src;
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
  // a game keeps its portrait lock on screens of 600 dp or more at target 36 (Android 16 behaviour changes)
  out = setAttr(out, /<application\b[^>]*>/, "android:appCategory", "game", "<application> element");
  // the app keeps no data of its own: the game saves in Chrome's storage
  out = setAttr(out, /<application\b[^>]*>/, "android:allowBackup", "false", "<application> element");
  return out;
}

/* ---------------- checks ---------------- */
// Returns a list of problems (empty when the project meets every rule). build-aab.sh and qa/fish/play.mjs use it.
export function check(gradle, manifest) {
  const bad = [];
  const num = (re) => { const m = gradle.match(re); return m ? +m[1] : null; };
  if (num(/compileSdkVersion\s+(\d+)/) !== RULES.sdk) bad.push("compileSdkVersion is not " + RULES.sdk);
  if (num(/targetSdkVersion\s+(\d+)/) !== RULES.sdk) bad.push("targetSdkVersion is not " + RULES.sdk);
  const app = (manifest.match(/<application\b[^>]*>/) || [""])[0];
  if (!/android:appCategory="game"/.test(app)) bad.push("<application> has no android:appCategory=\"game\"");
  if (!/android:allowBackup="false"/.test(app)) bad.push("<application> does not set android:allowBackup=\"false\"");
  // the game needs no permission: Chrome owns the sensors, the vibration and the wake lock
  for (const m of manifest.matchAll(/<uses-permission(?:-sdk-23)?\b[^>]*android:name="([^"]*)"/g)) bad.push("the manifest asks for the permission " + m[1]);
  return bad;
}

/* ---------------- run ---------------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--target-sdk") {
    console.log(RULES.sdk);
  } else {
    const dir = path.resolve(process.argv[2] || path.join(HERE, "android"));
    const gradlePath = path.join(dir, "app/build.gradle");
    const manifestPath = path.join(dir, "app/src/main/AndroidManifest.xml");
    try {
      const gradle = assertGradle(await readFile(gradlePath, "utf8"));
      const manifest = patchManifest(await readFile(manifestPath, "utf8"));
      await writeFile(manifestPath, manifest);
      const bad = check(gradle, manifest);
      if (bad.length) throw new Error("after the patch: " + bad.join("; "));
      console.log("patch-android: " + path.relative(process.cwd(), dir) + " meets the Google Play rules (SDK " + RULES.sdk + ", appCategory game, backup off, no permission)");
    } catch (e) {
      console.error("patch-android: " + e.message);
      process.exit(1);
    }
  }
}
