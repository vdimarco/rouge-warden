// Stamps public/fish/sw.js with a version that follows the cached files.
// VERSION in sw.js is "<app version>+<first 10 hex of a SHA-256>". The hash covers every file in PRECACHE and OPTIONAL (sorted by path,
// each with its path and its bytes). Change any of those files, and the hash changes, so the service worker builds a new cache and
// drops the old one. The first number (the app version) is yours: change it by hand when you ship a new build.
// Run from the repo root: node play/fish/stamp-sw.mjs            rewrites the VERSION line of sw.js
//                         node play/fish/stamp-sw.mjs --check    changes nothing; exits 1 when the VERSION line is old
//                         --public=<dir> uses another copy of public/ (the tests use it)
// qa/fish/pwa.mjs imports stampOf() and fails with "run node play/fish/stamp-sw.mjs" when the line is old.
import { createHash } from "crypto";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import vm from "vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LINE = /^const VERSION = "([^"+]*)(?:\+([0-9a-f]*))?";$/m;

// What sw.js says: its VERSION and the files it caches, read by running it in a sandbox with a stub worker scope.
export async function readWorker(publicDir = path.join(ROOT, "public")) {
  const file = path.join(publicDir, "fish/sw.js"), src = await readFile(file, "utf8");
  const box = { self: { location: { href: "https://host.test/fish/sw.js", origin: "https://host.test" }, addEventListener() {}, skipWaiting() {} }, URL, Request: class {} };
  vm.createContext(box);
  vm.runInContext(src + "\n;globalThis.__sw = { VERSION, PREFIX, PRECACHE, OPTIONAL };", box);
  const { VERSION, PREFIX, PRECACHE, OPTIONAL } = box.__sw;
  const sitePath = (u) => new URL(u, "https://host.test/fish/sw.js").pathname;
  return { file, src, VERSION, PREFIX, PRECACHE, OPTIONAL, required: PRECACHE.map(sitePath), optional: OPTIONAL.map(sitePath), diskPath: (p) => path.join(publicDir, decodeURIComponent(p)) };
}

// The hash of the cached files, and the VERSION that sw.js should have.
export async function stampOf(publicDir = path.join(ROOT, "public")) {
  const w = await readWorker(publicDir);
  const paths = [...new Set([...w.required, ...w.optional])].sort();
  const h = createHash("sha256"), missing = [];
  for (const p of paths) {
    // a missing file is not an error here: qa/fish/pwa.mjs says which one, and the stamp below refuses to write
    const bytes = await readFile(w.diskPath(p)).catch(() => (missing.push(p), Buffer.alloc(0)));
    h.update(p + "\n" + bytes.length + "\n");
    h.update(bytes);
  }
  const hash = h.digest("hex").slice(0, 10);
  const m = LINE.exec(w.src);
  if (!m) throw new Error('sw.js has no line like: const VERSION = "1.0.0+0123456789";');
  return { hash, app: m[1], current: m[1] + (m[2] ? "+" + m[2] : ""), want: m[1] + "+" + hash, paths, missing, worker: w };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.find((a) => a.startsWith("--public="));
  const pub = arg ? path.resolve(arg.slice(9)) : path.join(ROOT, "public");
  const s = await stampOf(pub);
  if (s.missing.length) { console.error("sw.js lists files that are not on disk: " + s.missing.join(", ")); process.exit(1); }
  if (process.argv.includes("--check")) {
    if (s.current === s.want) console.log("sw.js VERSION " + s.current + " is current (" + s.paths.length + " files)");
    else { console.error("sw.js VERSION is " + s.current + ", the files give " + s.want + ". Run: node play/fish/stamp-sw.mjs"); process.exitCode = 1; }
  } else {
    await writeFile(s.worker.file, s.worker.src.replace(LINE, 'const VERSION = "' + s.want + '";'));
    console.log("sw.js VERSION " + s.current + " -> " + s.want + " (" + s.paths.length + " files)");
  }
}
