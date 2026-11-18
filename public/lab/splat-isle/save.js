// Splat Isle's saved game: what a fresh game holds, and a strict check on a save read back from the browser.
// Every arcade page shares one origin and one localStorage, so a save may be old, broken or written by something
// else. clean() keeps only the fields and types the game uses, in their ranges, and falls back to a fresh game for
// anything else, so a bad save can neither stop the page from loading nor put markup into it.
// Pure JavaScript with no imports from the page, so node can test it: qa/lab/splat-isle.test.mjs.

export const SAVE_KEY = 'splat-isle.save.v3';
const ISLES = ['home', 'orchard', 'bell', 'wreck', 'light'];
const ITEMS = ['shell', 'fruit', 'stone', 'rope', 'oil', 'water'];
const FLAGS = ['sawSleeper', 'bellAsked', 'thornsAsked', 'gardenerOk', 'clapper', 'bell', 'oilAsked', 'ropeAsked', 'oil', 'lit'];
const AGAIN = ['dawn', 'never'];
const ID = /^[a-z][a-z0-9-]{0,31}$/;   // the ids scene.js gives things: crate0, thorn3, sprout-12-1
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);

export const fresh = sprouts => ({ island: 'home', day: 1, time: 0.12, inv: { shell: 0, fruit: 0, stone: 0, rope: 0, oil: 0, water: 0 }, flags: {}, broken: {}, taken: {}, picked: {}, sprouts, bloom: { health: 3, watered: 0 }, goat: { trust: 0 }, intro: false, riding: false });

// A save as the game may use it, or null when there is nothing worth keeping.
export function clean(got, sprouts = []) {
  if (!isObj(got) || !isObj(got.inv)) return null;
  const s = fresh(sprouts);
  if (ISLES.includes(got.island)) s.island = got.island;
  s.day = int(got.day, 1, 1e6, 1);
  if (typeof got.time === 'number' && got.time >= 0 && got.time < 1) s.time = got.time;
  for (const k of ITEMS) if (own(got.inv, k)) s.inv[k] = int(got.inv[k], 0, k === 'water' ? 1 : 999, 0);
  if (isObj(got.flags)) {
    for (const k of FLAGS) if (got.flags[k] === true) s.flags[k] = true;
    if (isObj(got.flags.visited)) { s.flags.visited = {}; for (const k of ISLES) if (got.flags.visited[k]) s.flags.visited[k] = 1; }
  }
  if (isObj(got.broken)) for (const isle of ISLES) if (isObj(got.broken[isle])) { const b = {}; for (const [k, v] of Object.entries(got.broken[isle])) if (ID.test(k) && AGAIN.includes(v)) b[k] = v; s.broken[isle] = b; }
  const key = k => { const [isle, id] = k.split(':'); return ISLES.includes(isle) && ID.test(id || ''); };
  if (isObj(got.taken)) for (const k of Object.keys(got.taken)) if (key(k)) s.taken[k] = 1;
  if (isObj(got.picked)) for (const [k, v] of Object.entries(got.picked)) if (key(k) && Number.isInteger(v)) s.picked[k] = v;
  if (Array.isArray(got.sprouts)) s.sprouts = got.sprouts.filter(e => Array.isArray(e) && ID.test(e[0]) && Number.isInteger(e[1])).slice(0, 12).map(([id, born]) => [id, born]);
  if (isObj(got.bloom)) s.bloom = { health: int(got.bloom.health, 0, 3, 3), watered: int(got.bloom.watered, 0, 1e6, 0) };
  if (isObj(got.goat)) s.goat = { trust: int(got.goat.trust, 0, 5, 0) };
  s.intro = got.intro === true; s.riding = got.riding === true && s.goat.trust >= 5;
  return s;
}
