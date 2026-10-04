// Copies what the mods reuse into each mod, since a plugin imports only its own files: the shared
// helpers in mods/shared/, the Full Tilt physics and table, the Primordia Lenia core and species,
// the Reel It In species, and the Shore of the Ancients announcer clips with their credits.
//   node mods/sync.mjs           make every copy
//   node mods/sync.mjs --check   change nothing; exit 1 and name each copy that is stale or missing
// Code copies start with one line that names their source. Clips and credits are copied byte for byte.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(MODS);
const CHECK = process.argv.includes("--check");

// the shared helpers each mod uses
const SHARED = {
  announcer: ["checks.ts"],
  "cabinet-spinner": ["checks.ts", "rng.ts"],
  creel: ["checks.ts", "days.ts", "rng.ts"],
  "tilt-sensor": ["checks.ts"],
  "wanted-level": ["checks.ts"],
  "task-breakout": ["cells.ts", "rng.ts"],
  "attract-mode": ["cells.ts", "rng.ts"],
  "full-tilt": ["cells.ts"],
  "photo-booth": ["checks.ts"],
};

// [source, copy], both from the repository root
const COPIES = [];
for (const [mod, files] of Object.entries(SHARED))
  for (const file of files) COPIES.push([`mods/shared/${file}`, `mods/${mod}/hooks/shared/${file}`]);
COPIES.push(
  ["public/lab/tilt/physics.js", "mods/full-tilt/hooks/vendor/physics.js"],
  ["public/lab/tilt/table.js", "mods/full-tilt/hooks/vendor/table.js"],
  ["public/primordia/lenia.js", "mods/attract-mode/hooks/vendor/lenia.js"],
  ["public/primordia/species.js", "mods/attract-mode/hooks/vendor/species.js"],
  ["public/fish/js/species.js", "mods/creel/hooks/vendor/species.js"],
  ["public/tidebreak/audio/CREDITS.md", "mods/announcer/announcer/CREDITS.md"],
);
const CLIPS = "public/tidebreak/audio/announcer";
for (const name of fs.readdirSync(path.join(ROOT, CLIPS)).filter((n) => n.endsWith(".mp3")).sort())
  COPIES.push([`${CLIPS}/${name}`, `mods/announcer/announcer/${name}`]);

const isCode = (file) => /\.(?:[cm]?[jt]sx?)$/.test(file);
const headerOf = (source) => `// Copied from ${source} by mods/sync.mjs. Edit the source there, then run node mods/sync.mjs.\n`;

function wanted(source) {
  const bytes = fs.readFileSync(path.join(ROOT, source));
  return isCode(source) ? Buffer.concat([Buffer.from(headerOf(source)), bytes]) : bytes;
}

const problems = [];
let written = 0;
for (const [source, copy] of COPIES) {
  const want = wanted(source);
  const target = path.join(ROOT, copy);
  const have = fs.existsSync(target) ? fs.readFileSync(target) : null;
  if (have !== null && have.equals(want)) continue;
  if (CHECK) {
    problems.push(`${copy} is ${have === null ? "missing" : "stale"}: run node mods/sync.mjs (source ${source})`);
    continue;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, want);
  written++;
}

// a copy that no source makes any more
const made = new Set(COPIES.map(([, copy]) => copy));
for (const mod of Object.keys(SHARED)) {
  for (const dir of [`mods/${mod}/hooks/shared`, `mods/${mod}/hooks/vendor`]) {
    if (!fs.existsSync(path.join(ROOT, dir))) continue;
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      const copy = `${dir}/${name}`;
      if (made.has(copy)) continue;
      if (CHECK) problems.push(`${copy} has no source: delete it, or add it to mods/sync.mjs`);
      else { fs.rmSync(path.join(ROOT, copy)); written++; }
    }
  }
}

if (CHECK) {
  for (const line of problems) console.log(`  FAIL ${line}`);
  console.log(problems.length ? `${problems.length} of ${COPIES.length} copies need a sync` : `ok: all ${COPIES.length} copies match their sources`);
  process.exit(problems.length ? 1 : 0);
}
console.log(written ? `wrote ${written} of ${COPIES.length} copies` : `all ${COPIES.length} copies were current`);
