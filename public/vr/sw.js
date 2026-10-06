// In Full Swing service worker: keeps the app shell in Cache Storage so the game starts with no network.
// index.html registers it with scope "./". A plain classic worker (no modules, no importScripts), so every browser runs it.
// VERSION must equal VERSION in js/config.js (qa/vr/pwa.mjs checks it). A new VERSION makes a new cache and drops the old one.

const VERSION = "1.15.0";
const PREFIX = "fullswing-";
const CACHE = PREFIX + VERSION;

/* ---------------- the app shell ---------------- */
// Paths are relative to this file (/vr/). Keep JS in step with the files in js/: pwa.mjs fails when one is missing on
// disk or when a file in js/ is not listed here.
const JS = ["config.js", "main.js", "xr.js", "desktop.js", "mobile.js", "city.js", "physics.js", "cityview.js", "rope.js", "hands.js", "comfort.js", "game.js", "audio.js", "ui.js", "portal.js", "comic.js", "fx.js", "hero.js", "flatcam.js", "target.js", "cutscene.js", "street.js", "streetview.js", "bloom.js", "combat.js", "cars.js", "jobs.js", "actionview.js", "actionhud.js"];
const LIB = ["three.module.min.js", "three.core.min.js", "addons/loaders/GLTFLoader.js", "addons/utils/BufferGeometryUtils.js", "addons/utils/SkeletonUtils.js"];
const PRECACHE = [
  "./index.html",
  "./manifest.webmanifest",
  "./models/cn-tower.glb",
  "./models/cars/muscle.glb",
  "./models/cars/hatchback.glb",
  "./models/cars/van.glb",
  "./privacy.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./fonts/bungee-400.woff2",
  "./fonts/bangers-400.woff2",
  "./fonts/barlow-condensed-500.woff2",
  "./fonts/barlow-condensed-700.woff2",
  "./fonts/barlow-condensed-800.woff2",
  "./art/keyart.webp",
  "./art/sky.webp",
  "./art/windows.webp",
  "./art/words.webp",
  "./art/words.json",
  "./art/cutscene/city.webp",
  "./art/cutscene/king.webp",
  "./art/cutscene/clogs.webp",
  "./art/cutscene/hero.webp",
  "./art/cutscene/swing.webp",
  "./art/cutscene/king-awake.webp",
  "./art/cutscene/finale.webp",
  "./anim/locomotion.json",
  ...JS.map((f) => "./js/" + f),
  ...LIB.map((f) => "./lib/" + f),
  "/wild/models/king.glb",
  "/wild/models/crew5.glb",
];
const INDEX = new URL("./index.html", self.location.href).href;

/* ---------------- install and activate ---------------- */
self.addEventListener("install", (e) => {
  // cache: "reload" skips the HTTP cache, so a new version never precaches stale files
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  // drop only our own old caches: other games on this origin may keep their own
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* ---------------- fetch: stale-while-revalidate ---------------- */
// Same-origin GET only. Cross-origin requests (the IWER emulator on ?emulate) and range requests go to the network untouched.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  const nav = req.mode === "navigate";
  // /vr/ and /vr/?source=pwa both mean index.html
  const key = nav && url.pathname.endsWith("/") ? new URL(url.pathname + "index.html", url).href : req;
  e.respondWith(swr(e, req, key, nav));
});

async function swr(e, req, key, nav) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(key, { ignoreSearch: nav });
  const net = fetch(req).then((res) => {
    // keep only complete same-origin answers; a redirected answer cannot serve a navigation later
    if (res.ok && res.type === "basic" && !res.redirected) return cache.put(key, res.clone()).then(() => res);
    return res;
  });
  if (hit) {
    e.waitUntil(net.catch(() => { /* offline: the cached copy stands */ }));
    return nav ? plain(hit) : hit;
  }
  try {
    return await net;
  } catch (err) {
    // offline and not cached: a page falls back to the game, anything else fails as it would without us
    if (nav) {
      const shell = await cache.match(INDEX);
      if (shell) return plain(shell);
    }
    throw err;
  }
}

// The browser refuses a redirected response for a page load, so copy one (if a host ever redirected index.html) without the flag
function plain(res) {
  return res.redirected ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
}
