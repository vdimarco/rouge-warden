#!/usr/bin/env node
// Tests for the version rule of the native check (lib/versions.mjs). Each case writes the files that hold the version
// to a temp folder and checks what the rule reports. The last case reads the real tree.
// Usage: node scripts/native-check.test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { versionProblems } from "./lib/versions.mjs";

let failed = 0, passed = 0;
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = (v) => `// The version of the game.\nexport const VERSION = "${v}";\n`;
const pkg = (v) => JSON.stringify({ name: "reel-it-in-app", version: v, private: true }, null, 2);
const gradle = (v) => `android {\n    defaultConfig {\n        versionCode 1\n        versionName "${v}"\n    }\n}\n`;
const pbx = (a, b = a) => `\t\t\t\tCURRENT_PROJECT_VERSION = 1;\n\t\t\t\tMARKETING_VERSION = ${a};\n\t\t\t};\n\t\t\t\tMARKETING_VERSION = ${b};\n`;
const SAME = {
  "public/fish/js/version.js": js("1.0.0"),
  "apps/fish/www/js/version.js": js("1.0.0"),
  "apps/fish/package.json": pkg("1.0.0"),
  "apps/fish/android/app/build.gradle": gradle("1.0.0"),
  "apps/fish/ios/App/App.xcodeproj/project.pbxproj": pbx("1.0.0"),
};

function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "native-check-"));
  for (const [f, text] of Object.entries({ ...SAME, ...files })) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  }
  return dir;
}

function report(name, problems, want) {
  const bad = want ? !problems.some((p) => want.test(p)) : problems.length > 0;
  if (bad) { failed++; console.log(`FAIL ${name}: ${want ? `no problem matched ${want}` : "wanted no problems"}`); for (const p of problems) console.log(`     ${p}`); }
  else { passed++; console.log(`ok   ${name}`); }
}

function expect(name, files, want = null) {
  const dir = tree(files);
  const problems = versionProblems(path.join(dir, "apps/fish"), path.join(dir, "public/fish"));
  fs.rmSync(dir, { recursive: true, force: true });
  report(name, problems, want);
}

expect("the same version in every file passes", {});
expect("no www and no native projects: the game and package.json alone pass", { "apps/fish/www/js/version.js": null, "apps/fish/android/app/build.gradle": null, "apps/fish/ios/App/App.xcodeproj/project.pbxproj": null });
expect("an Android versionName of 1.0 fails", { "apps/fish/android/app/build.gradle": gradle("1.0") }, /versions differ: .*build\.gradle versionName 1\.0;/);
expect("one iOS MARKETING_VERSION of 1.0 fails", { "apps/fish/ios/App/App.xcodeproj/project.pbxproj": pbx("1.0.0", "1.0") }, /versions differ: .*MARKETING_VERSION 1\.0\.0, 1\.0\./);
expect("a new version in the game only fails", { "public/fish/js/version.js": js("1.0.1") }, /versions differ: public\/fish\/js\/version\.js VERSION 1\.0\.1;/);
expect("an old www copy fails and names the build", { "apps/fish/www/js/version.js": js("0.9.0") }, /www\/js\/version\.js VERSION 0\.9\.0;.*npm run build:www/);
expect("a package.json version that differs fails", { "apps/fish/package.json": pkg("1.1.0") }, /package\.json version 1\.1\.0;/);
expect("a missing js/version.js fails", { "public/fish/js/version.js": null }, /public\/fish\/js\/version\.js VERSION: the file is missing/);
expect("a version.js with no VERSION fails", { "public/fish/js/version.js": "export const NAME = \"Reel It In\";\n" }, /public\/fish\/js\/version\.js VERSION: no version found/);
expect("a build.gradle with no versionName fails", { "apps/fish/android/app/build.gradle": "android {\n}\n" }, /build\.gradle versionName: no version found/);
expect('versionName = "1.0.0" and a quoted MARKETING_VERSION pass', { "apps/fish/android/app/build.gradle": gradle("1.0.0").replace("versionName ", "versionName = "), "apps/fish/ios/App/App.xcodeproj/project.pbxproj": pbx('"1.0.0"') });
report("the real tree has one version", versionProblems(APP, path.resolve(APP, "../../public/fish")));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
