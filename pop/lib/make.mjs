// Makes a delivery for a Pay on Proof job, in the shapes the contract checks.
// `faulty` makes a real fault of the kind a careless agent makes. The contract finds it; nothing here marks it.
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

export const SCALES = { "C major": [0, 2, 4, 5, 7, 9, 11], "A minor": [9, 11, 0, 2, 4, 5, 7], "G major": [7, 9, 11, 0, 2, 4, 6], "E minor": [4, 6, 7, 9, 11, 0, 2] };
const CRITTERS = [["Mosquito swarm", 1], ["Raccoon", 2], ["Loon", 2], ["Goose", 3], ["Beaver", 3], ["Snapping turtle", 4], ["Black bear", 5]];

export function make(kind, spec, { seed = Date.now(), faulty = false } = {}) {
  const r = rng(seed);
  if (kind === "map") {
    const k = (p) => p.join(",");
    const start = [0, Math.floor(r() * spec.rows)], rooms = [start], links = [], seen = new Set([k(start)]);
    for (let guard = 0; rooms.length < spec.rooms && guard < 5000; guard++) {
      const from = pick(r, rooms), d = pick(r, [[1, 0], [-1, 0], [0, 1], [0, -1]]), n = [from[0] + d[0], from[1] + d[1]];
      if (n[0] < 0 || n[1] < 0 || n[0] >= spec.cols || n[1] >= spec.rows || seen.has(k(n))) continue;
      seen.add(k(n)); rooms.push(n); links.push([from, n]);
    }
    let exit = rooms.reduce((b, x) => (x[0] > b[0] ? x : b), rooms[0]);
    if (faulty) {
      if (r() < 0.7) { const cut = rooms[rooms.length - 1]; for (let i = links.length - 1; i >= 0; i--) if (links[i].some((p) => k(p) === k(cut))) links.splice(i, 1); }
      else exit = null;
    }
    return { rooms, links, entry: start, exit };
  }
  if (kind === "roster") {
    const inBand = (l) => { const s = l.reduce((a, c) => a + c[1], 0); return s >= spec.lo && s <= spec.hi; };
    let list = [];
    for (let i = 0; i < 2000; i++) {
      list = Array.from({ length: spec.size }, () => pick(r, CRITTERS));
      if (inBand(list) !== faulty) break;
    }
    return { critters: list.map(([name, threat]) => ({ name, threat })) };
  }
  if (kind === "paint") {
    const h = r() * 360;
    const floor = hsl(h, 30 + r() * 20, faulty ? 44 + r() * 8 : 14 + r() * 10);
    const wall = hsl(h + 15, 25 + r() * 20, faulty ? 50 + r() * 8 : 70 + r() * 12);
    return { floor, wall, accent: hsl(h + 180, 70, 55) };
  }
  if (kind === "tune") {
    const sc = SCALES[spec.key];
    const notes = Array.from({ length: spec.bars * 4 }, () => 60 + pick(r, sc) + (r() < 0.2 ? 12 : 0));
    if (faulty) for (let i = 0; i < 2; i++) { let n; do n = 60 + Math.floor(r() * 12); while (sc.includes(n % 12)); notes[Math.floor(r() * notes.length)] = n; }
    return { bars: spec.bars, beats: 4, notes };
  }
  throw new Error("unknown kind " + kind);
}

function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const f = (n) => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// Specs the Warden posts, by kind.
export function specFor(kind, r) {
  if (kind === "map") return { rooms: 5 + Math.floor(r() * 5), cols: 5, rows: 4 };
  if (kind === "roster") { const size = 3 + Math.floor(r() * 2), lo = size * 2 + Math.floor(r() * 3); return { lo, hi: lo + 3, size }; }
  if (kind === "paint") return { contrast_x100: 300 + Math.floor(r() * 3) * 50 };
  return { bars: pick(r, [4, 8]), key: pick(r, Object.keys(SCALES)) };
}
