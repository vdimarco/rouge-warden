// Reel It In service worker: keeps the game in Cache Storage, so it starts with no network.
// index.html registers it with scope "./" once the title shows. A plain classic worker (no modules, no importScripts).
// VERSION is "<app version>+<hash of the cached files>". After you change any cached file, run: node play/fish/stamp-sw.mjs
// It rewrites the hash. qa/fish/pwa.mjs fails when the hash is old. A new VERSION makes a new cache, and the old one goes on the next launch.

const VERSION = "1.0.0+00fbe23571";
const PREFIX = "reelitin-";
const CACHE = PREFIX + VERSION;

/* ---------------- the files ---------------- */
// Paths are relative to this file (/fish/), and "/arcade/quiet.js" is the one file from outside it.
// pwa.mjs fails when a file here is missing on disk, or when a file in js/, lib/, fonts/ or icons/ is not listed.
const JS = ["art-style", "audio", "cartoon-models", "cast", "fish", "fishing", "guide", "haptics", "journey", "lake", "line-motion", "main", "motion", "painted-forest", "places", "pull", "reel", "rod-cues", "save", "species", "world-env", "world-fish", "world-fx", "world-gear", "world-look", "world", "places/loon", "places/river", "places/sea", "places/stumps", "places/util"];
// The install fails if one of these cannot be loaded: the game cannot start offline without all of them.
const PRECACHE = [
  "index.html",
  "style.css",
  "guide.css",
  "manifest.webmanifest",
  "privacy.html",
  ...JS.map((f) => "js/" + f + ".js"),
  "lib/three.module.min.js",
  "lib/LICENSE",
  "fonts/alfa-slab-one-400-latin.woff2",
  "fonts/nunito-var-latin.woff2",
  "fonts/OFL-AlfaSlabOne.txt",
  "fonts/OFL-Nunito.txt",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/favicon.svg",
  "icons/favicon-32.png",
  "icons/apple-touch-icon.png",
  "art/cartoon-models.glb",
  "art/painted-forest.webp",
  "art/fal-lake-water.webp",
  "art/ghibli-sky.webp",
  "art/film-lake.webp",
  "/arcade/quiet.js",
];
// The clips are best effort: a clip that fails to load must not stop the install. The guide shows an animation if a clip is missing.
const OPTIONAL = ["clips/guide-motion.mp4", "clips/guide-touch.mp4", "clips/pull-back-demo.mp4", "clips/pull-back-poster.webp"];

const BASE = new URL("./", self.location.href); // the folder of this file, /fish/
const SCOPE = BASE.pathname;
const KNOWN = new Set([...PRECACHE, ...OPTIONAL].map((u) => new URL(u, BASE).pathname));

/* ---------------- install and activate ---------------- */
self.addEventListener("install", (e) => {
  // no-cache: ask the server if the copy in the browser's own cache is current, so a new version never keeps a stale file
  const req = (u) => new Request(u, { cache: "no-cache" });
  e.waitUntil((async () => {
    // a changed sw.js can keep the same VERSION: then this cache is the one that the running worker serves, and a failed install must not delete it
    const fresh = !(await caches.has(CACHE));
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(PRECACHE.map(req));
    } catch (err) {
      if (fresh) await caches.delete(CACHE); // all or nothing: a half-filled cache must never serve the game
      throw err;
    }
    await Promise.all(OPTIONAL.map((u) => cache.add(req(u)).catch(() => { /* best effort */ })));
  })());
  // No skipWaiting: a new version waits until the app closes, so one launch never mixes old and new files.
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // drop only our own old caches: other pages on this origin may keep their own
    const old = (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== CACHE);
    await Promise.all(old.map((k) => caches.delete(k)));
    // the first install takes over the page that registered it. An update takes over on the next launch.
    if (!old.length) await self.clients.claim();
  })());
});

/* ---------------- fetch: the cache first ---------------- */
// Same-origin GET only. Other origins and other methods go to the network untouched. So does any file outside /fish/ that is not listed above.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || (req.cache === "only-if-cached" && req.mode !== "same-origin")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE) && !KNOWN.has(url.pathname)) return;
  e.respondWith(answer(req, url));
});

async function answer(req, url) {
  const cache = await caches.open(CACHE);
  const nav = req.mode === "navigate";
  // /fish/ and /fish/?source=play both mean index.html; a page is found without its query
  const key = nav && url.pathname.endsWith("/") ? new URL(url.pathname + "index.html", url).href : req.url;
  const hit = await cache.match(key, { ignoreSearch: nav });
  if (hit) return req.headers.has("range") ? slice(hit, req.headers.get("range")) : nav ? plain(hit) : hit;
  try {
    const res = await fetch(req);
    // keep only a complete answer from this origin: never a 206, and not a redirected one (it cannot serve a page load later)
    if (res.status === 200 && res.type === "basic" && !res.redirected && url.pathname.startsWith(SCOPE) && !req.headers.has("range")) await cache.put(key, res.clone());
    return res;
  } catch (err) {
    // offline and not cached: a page falls back to the game, anything else fails as it would without us
    if (nav) {
      const shell = await cache.match(new URL("index.html", BASE).href);
      if (shell) return plain(shell);
    }
    throw err;
  }
}

// A video asks for a part of the file (Range). Answer from the cached whole file, with the 206 that a server sends.
async function slice(res, header) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === "" && m[2] === "")) return res; // not a single range: the whole file is a valid answer
  const all = await res.clone().arrayBuffer(), size = all.byteLength;
  const start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] === "" || m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
  const body = all.slice(start, end + 1);
  return new Response(body, {
    status: 206,
    statusText: "Partial Content",
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/octet-stream", "Content-Range": "bytes " + start + "-" + end + "/" + size, "Content-Length": String(body.byteLength), "Accept-Ranges": "bytes" },
  });
}

// The browser refuses a redirected response for a page load, so copy one (if a host ever redirected index.html) without the flag
function plain(res) {
  return res.redirected ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
}
