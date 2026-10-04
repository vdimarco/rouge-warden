// The version that players and the stores see, in each file that holds it. native-check.mjs fails when they differ.
// Settings > About shows VERSION from js/version.js. The copy in www/ comes from the last npm run build:www.
import fs from "node:fs";
import path from "node:path";

const read = (file) => { try { return fs.readFileSync(file, "utf8"); } catch { return null; } };
const jsVersion = (t) => [...t.matchAll(/export\s+const\s+VERSION\s*=\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
const pkgVersion = (t) => { try { const v = JSON.parse(t).version; return typeof v === "string" ? [v] : []; } catch { return []; } };
const gradleVersion = (t) => [...t.matchAll(/^\s*versionName\s*=?\s*["']([^"']+)["']/gm)].map((m) => m[1]);
const pbxVersion = (t) => [...t.matchAll(/MARKETING_VERSION = "?([^";]+)"?;/g)].map((m) => m[1].trim());

// app: apps/fish. game: public/fish. Returns a list of problems (empty when all the versions are the same).
// A file that must be there: the game's version.js and package.json. The others are checked when they are there.
export function versionProblems(app, game) {
  const files = [
    { name: "public/fish/js/version.js VERSION", file: path.join(game, "js/version.js"), find: jsVersion, need: true },
    { name: "www/js/version.js VERSION", file: path.join(app, "www/js/version.js"), find: jsVersion },
    { name: "package.json version", file: path.join(app, "package.json"), find: pkgVersion, need: true },
    { name: "android/app/build.gradle versionName", file: path.join(app, "android/app/build.gradle"), find: gradleVersion },
    { name: "project.pbxproj MARKETING_VERSION", file: path.join(app, "ios/App/App.xcodeproj/project.pbxproj"), find: pbxVersion },
  ];
  const problems = [], found = [], all = new Set();
  for (const f of files) {
    const text = read(f.file);
    if (text === null) { if (f.need) problems.push(`${f.name}: the file is missing`); continue; }
    const values = f.find(text);
    if (!values.length) { problems.push(`${f.name}: no version found`); continue; }
    found.push(`${f.name} ${values.join(", ")}`);
    for (const v of values) all.add(v);
  }
  if (all.size > 1) problems.push(`the versions differ: ${found.join("; ")}. Use the same version in each file, then run npm run build:www`);
  return problems;
}
