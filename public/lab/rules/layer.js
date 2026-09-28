// House Rules: one Down the Drain layer as data, as a link, and as ground. The editor (public/lab/rules/) and Down the
// Drain itself (public/fall/, through play.js) both use this file, so a layer looks the same in both. No DOM here:
// the tests in qa/lab/ import it. Only integer math and + - * / touch the ground, so every browser builds the
// same layer from the same link.
//
// A layer is: a look (theme), a seed for the plain ground, a name, brush strokes (dig, earth, rock, sand, wood,
// water, oil, lava, acid, gas, gold), the two drains, critters and propane tanks. The link holds exactly that:
// /fall/#L=<code>, where code is the bytes below in base64url, deflated when that is shorter.
import { Writer, Reader, toB64u, fromB64u, fnv1a, hash01 } from "../kit/rng.js";

// the world of Down the Drain (public/fall/index.html: W, H, TOP, BOT). The layer owns the rows from TOP down;
// the game keeps the outhouse and the sky above them.
export const W = 1024, H = 720, TOP = 44, BOT = 48;
// material ids, as in public/fall/index.html
export const M = { EMPTY: 0, BEDROCK: 1, ROCK: 2, EARTH: 3, SAND: 4, BONE: 5, WOOD: 6, OBSIDIAN: 9, GOLD: 10, WATER: 12, OIL: 13, LAVA: 14, ACID: 15, MIASMA: 22, METAL: 24 };
// What the brush paints, in link order. Never reorder these, or old links change.
export const PAINTS = [
  { id: "dig", m: M.EMPTY, name: "Dig" },
  { id: "earth", m: M.EARTH, name: "Earth" },
  { id: "rock", m: M.ROCK, name: "Rock" },
  { id: "sand", m: M.SAND, name: "Sand" },
  { id: "wood", m: M.WOOD, name: "Wood" },
  { id: "water", m: M.WATER, name: "Water" },
  { id: "oil", m: M.OIL, name: "Oil" },
  { id: "lava", m: M.LAVA, name: "Lava" },
  { id: "acid", m: M.ACID, name: "Acid" },
  { id: "gas", m: M.MIASMA, name: "Swamp gas" },
  { id: "gold", m: M.GOLD, name: "Gold" },
];
export const SIZES = [3, 6, 11, 18];   // brush radii in pixels
// critters, in link order, with their size in pixels (FOES in public/fall/index.html)
export const CRITTERS = [
  { id: "raccoon", name: "Raccoon", w: 8, h: 6 },
  { id: "hornet", name: "Hornets", w: 5, h: 4 },
  { id: "gull", name: "Seagull", w: 6, h: 7 },
  { id: "bat", name: "Bat", w: 6, h: 5 },
  { id: "skunk", name: "Skunk", w: 7, h: 5 },
  { id: "moose", name: "Moose", w: 10, h: 12 },
  { id: "goose", name: "Goose", w: 6, h: 8 },
];
export const THEMES = ["crypt", "cistern", "garden", "forge"];
export const THEME_NAMES = ["The cellar", "The septic tank", "The crawlspace", "Under the sauna"];
export const LIMIT = 2000;             // the longest code a link may carry, in characters
const MAX = { strokes: 400, pts: 600, critters: 60, tanks: 24, name: 24 };
const VERSION = 1;

export function blank(seed = 1) {
  return { theme: 0, seed: seed >>> 0, name: "", drains: [W / 2 - 150, W / 2 + 150], strokes: [], critters: [], tanks: [] };
}

/* ---------------- the link ---------------- */
function pack(L) {
  const w = new Writer();
  w.u8(VERSION).uvar(L.theme).u32(L.seed).str(L.name, MAX.name);
  w.uvar(L.drains[0]).uvar(L.drains[1]);
  w.uvar(L.strokes.length);
  for (const s of L.strokes) {
    w.u8(s.p * 4 + s.r).uvar(s.pts.length);
    let px = 0, py = 0;
    s.pts.forEach(([x, y], i) => { if (i === 0) w.uvar(x).uvar(y); else w.svar(x - px).svar(y - py); px = x; py = y; });
  }
  w.uvar(L.critters.length);
  for (const c of L.critters) w.u8(c.k).uvar(c.x).uvar(c.y);
  w.uvar(L.tanks.length);
  for (const t of L.tanks) w.uvar(t.x).uvar(t.y);
  return w.bytes();
}
const inX = (x) => Number.isInteger(x) && x >= 0 && x < W, inY = (y) => Number.isInteger(y) && y >= 0 && y < H;
function unpack(b) {
  const r = new Reader(b);
  if (r.u8() !== VERSION) return null;
  const L = { theme: r.uvar(), seed: r.u32(), name: r.str(MAX.name), drains: [r.uvar(), r.uvar()], strokes: [], critters: [], tanks: [] };
  if (r.bad || L.theme >= THEMES.length || !L.drains.every((x) => x >= 34 && x <= W - 34)) return null;
  const ns = r.uvar();
  if (ns > MAX.strokes) return null;
  for (let k = 0; k < ns && !r.bad; k++) {
    const pr = r.u8(), p = pr >> 2, sz = pr & 3, n = r.uvar();
    if (p >= PAINTS.length || n < 1 || n > MAX.pts) return null;
    const pts = [];
    let x = r.uvar(), y = r.uvar();
    pts.push([x, y]);
    for (let i = 1; i < n; i++) { x += r.svar(); y += r.svar(); pts.push([x, y]); }
    if (!pts.every(([x, y]) => inX(x) && inY(y))) return null;
    L.strokes.push({ p, r: sz, pts });
  }
  const nc = r.uvar();
  if (nc > MAX.critters) return null;
  for (let k = 0; k < nc && !r.bad; k++) { const c = { k: r.u8(), x: r.uvar(), y: r.uvar() }; if (c.k >= CRITTERS.length || !inX(c.x) || !inY(c.y)) return null; L.critters.push(c); }
  const nt = r.uvar();
  if (nt > MAX.tanks) return null;
  for (let k = 0; k < nt && !r.bad; k++) { const t = { x: r.uvar(), y: r.uvar() }; if (!inX(t.x) || !inY(t.y)) return null; L.tanks.push(t); }
  return r.bad || !r.done ? null : L;
}
// deflate where the browser can; null where it cannot
async function squeeze(bytes, how) {
  try {
    const S = how === "in" ? globalThis.CompressionStream : globalThis.DecompressionStream;
    if (!S) return null;
    const out = await new Response(new Blob([bytes]).stream().pipeThrough(new S("deflate-raw"))).arrayBuffer();
    return new Uint8Array(out);
  } catch (e) { return null; }
}
// The code for a link. The first byte says how the rest is stored: 0 plain, 1 deflated.
export async function encode(L) {
  const raw = pack(L), z = await squeeze(raw, "in");
  const body = z && z.length < raw.length ? z : raw;
  const out = new Uint8Array(body.length + 1);
  out[0] = body === raw ? 0 : 1;
  out.set(body, 1);
  return toB64u(out);
}
// The layer in a code, or null. Junk of any kind gives null, never an error.
export async function decode(code) {
  const b = fromB64u(code);
  if (!b || b.length < 2 || b.length > 4 * LIMIT) return null;
  let body = b.subarray(1);
  if (b[0] === 1) { body = await squeeze(body, "out"); if (!body) return null; }
  else if (b[0] !== 0) return null;
  try { return unpack(body); } catch (e) { return null; }
}

/* ---------------- clearing your own layer ---------------- */
// A stamp says the maker reached a drain, and how fast. It is a checksum, not a lock: with no server, a cheat can
// forge one. It catches a link that got cut short or changed by accident.
export const stampFor = (code, secs) => { secs = Math.max(0, Math.round(secs)); return secs + "-" + fnv1a("house-rules:" + code + ":" + secs).toString(36); };
export function checkStamp(code, stamp) {
  const m = /^(\d{1,6})-([0-9a-z]{1,7})$/.exec(String(stamp || ""));
  return m && stampFor(code, +m[1]) === stamp ? +m[1] : null;
}
// your own clears, in this browser: the editor unlocks Share for a code you cleared
const CLEARS = "lab.rules.clears";
const keyOf = (code) => fnv1a(code).toString(36) + code.length.toString(36);
function readClears() { try { return JSON.parse(localStorage.getItem(CLEARS) || "{}") || {}; } catch (e) { return {}; } }
export function recordClear(code, secs) {
  const all = readClears(), k = keyOf(code);
  if (all[k] == null || secs < all[k]) all[k] = Math.round(secs);
  try { localStorage.setItem(CLEARS, JSON.stringify(all)); } catch (e) { /* storage off */ }
  return all[k];
}
export const clearOf = (code) => { const v = readClears()[keyOf(code)]; return v == null ? null : v; };
export const fmtSecs = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;

/* ---------------- the ground ---------------- */
// value noise on the kit's integer hash: the same numbers everywhere
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash01(ix, iy, s), b = hash01(ix + 1, iy, s), c = hash01(ix, iy + 1, s), d = hash01(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// every pixel within r of the segment a-b
function capsule(mat, ax, ay, bx, by, r, m) {
  const x0 = Math.max(2, Math.floor(Math.min(ax, bx) - r)), x1 = Math.min(W - 3, Math.ceil(Math.max(ax, bx) + r));
  const y0 = Math.max(TOP, Math.floor(Math.min(ay, by) - r)), y1 = Math.min(H - 3, Math.ceil(Math.max(ay, by) + r));
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, rr = r * r + r;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let t = L2 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = x - ax - t * dx, ey = y - ay - t * dy;
    if (ex * ex + ey * ey <= rr) mat[y * W + x] = m;
  }
}
export function paintStroke(mat, s) {
  const r = SIZES[s.r], m = PAINTS[s.p].m, p = s.pts;
  if (p.length === 1) capsule(mat, p[0][0], p[0][1], p[0][0], p[0][1], r, m);
  for (let i = 1; i < p.length; i++) capsule(mat, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], r, m);
}
// the plain ground a layer starts from: earth with rock in it, and a touch of the look
export function baseGround(L, mat = new Uint8Array(W * H)) {
  const s = L.seed | 0, th = THEMES[L.theme];
  for (let y = TOP; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (y >= H - BOT) { mat[i] = y > H - 14 ? M.OBSIDIAN : M.ROCK; continue; }
    let m = vnoise(x / 9, y / 9, s + 21) > 0.74 ? M.ROCK : M.EARTH;
    if (th === "crypt" && m === M.EARTH && vnoise(x / 7, y / 7, s + 51) > 0.86) m = M.BONE;
    if (th === "forge" && m === M.ROCK && vnoise(x / 6, y / 6, s + 52) > 0.7) m = M.OBSIDIAN;
    if (th === "garden" && m === M.EARTH && Math.abs(vnoise(x / 3, y / 24, s + 53) - 0.5) < 0.04) m = M.WOOD;
    mat[i] = m;
  }
  return mat;
}
// the hole under the outhouse goes on a little way into the ground
function funnel(mat) { for (let k = 0; k < 16; k++) capsule(mat, W / 2, TOP + k, W / 2, TOP + k, Math.max(5, 9 - k * 0.3), M.EMPTY); }
export function drainHollows(mat, drains) {
  for (const ex of drains) for (let y = H - BOT - 6; y < H - 14; y++) for (let x = ex - 26; x <= ex + 26; x++) {
    const dx = (x - ex) / 26, dy = (y - (H - 22)) / 26;
    if (dx * dx + dy * dy < 1) mat[y * W + x] = M.EMPTY;
  }
}
// where a critter stands: its box, with its feet on (x, y)
export const critterBox = (c) => { const d = CRITTERS[c.k]; return { x: c.x - (d.w >> 1), y: c.y - d.h, w: d.w, h: d.h }; };
export function frame(mat) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) mat[y * W + x] = M.BEDROCK;
}
// The whole layer, rows TOP and down (the rows above stay empty). Strokes go down in order, then the drains, the
// hole at the top, room for each critter, and the tanks.
export function build(L, mat = new Uint8Array(W * H)) {
  baseGround(L, mat);
  for (const s of L.strokes) paintStroke(mat, s);
  finish(L, mat);
  return mat;
}
export function finish(L, mat) {
  drainHollows(mat, L.drains);
  funnel(mat);
  for (const c of L.critters) {
    const b = critterBox(c);
    for (let y = Math.max(TOP, b.y - 1); y < Math.min(H - 2, b.y + b.h); y++) for (let x = Math.max(2, b.x - 1); x < Math.min(W - 2, b.x + b.w + 1); x++) mat[y * W + x] = M.EMPTY;
  }
  for (const t of L.tanks) for (let y = t.y - 7; y < t.y; y++) for (let x = t.x - 2; x <= t.x + 2; x++) if (y >= TOP && x >= 2 && x < W - 2) mat[y * W + x] = M.METAL;
  frame(mat);
  return mat;
}
// how shut in each open pixel is (the back wall's shading in Down the Drain; the same sums as its shadeWall)
export function shade(mat, ao, blocks) {
  const I = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let run = 0; for (let x = 0; x < W; x++) { run += blocks(mat[y * W + x]) ? 1 : 0; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + run; } }
  const R2 = 5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.max(0, x - R2), x1 = Math.min(W, x + R2 + 1), y0 = Math.max(0, y - R2), y1 = Math.min(H, y + R2 + 1);
    const c = I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0];
    const f = c / ((x1 - x0) * (y1 - y0));
    ao[y * W + x] = f < 0.18 ? 0 : f < 0.36 ? 1 : f < 0.55 ? 2 : 3;
  }
}
