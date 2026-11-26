// Gloam Downs: the life of a place (gloam-downs-screens-life design.md "Part E"). makeLife(world, meta, o) adds a block of small dabs
// after the place's own splats: moths and halos at the lamps, embers, motes or fireflies, falling leaves, flakes, drips or ash, mist in
// the hollows, swaying tufts and rags, and crows on the walls. Each dab is a row of world.data like the baked ones, moved by a motion
// kind the splat shader already has (rise, fall, bob, sway, flutter, wander, twinkle, flap), so the GPU moves it and the renderer does
// not change. Only what answers the player writes rows: a flock that takes off, a lamp that brightens, a gust, the hush near awake
// foes and the beacon's answer to the cards. Steady play writes none. No DOM, so the Node test builds it from the baked files.
// After GPU Gems ch. 7 and GPU Gems 3 ch. 6 (sway from the foot by height, one CPU value a gust) and Ink Studio's own motion kinds.
import { on as busOn, emit } from './bus.js';
import { mulberry } from '../kit/rng.js';

const TAU = Math.PI * 2;
const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
// the motion kinds life uses (the splat shader's numbers), and the flags of the kind field: 16 no outline, 32 glows
export const K = { still: 0, twinkle: 1, fall: 2, rise: 3, bob: 6, glow: 7, flap: 8, wander: 11, sway: 14, flutter: 15 };
const ND = 16, EM = 32;
// a foe in one of these states is being hit: a flock near it lifts
const HIT = new Set(['stagger', 'stun', 'down']);
export const MAX = 1200;
// no life dab is ever one of these: the fire slots of the tells (design.md "The fire rule")
export const FIRE = [34, 35, 36, 37];
export const LAMP = 46, LAMP_PALE = 47, EMBER = 33;
// the beacon's answer, by the colour of the card's choice
export const ANSWER = { wick: 46, flame: 33, ward: 38, gloam: 39 };
export const RULES = {
  near: 4, // a lamp brightens with the lamplighter within this
  halo: [0.04, 0.07], up: 0.4, down: 1, // the halo's size, and how long it takes to brighten and to fade back
  crowNear: 5, crowFoe: 3, crowHit: 6, fly: 2.5, fade: 1, // when a flock lifts, its flight, and its fade in place with reduced motion
  hush: 8, hushIn: 0.25, hushBack: 2, hushUp: 0.5, // the hush near awake foes
  gust: [9, 20], gustLen: 2, shed: [6, 12], // a gust every 9 to 20 s, 2 s long, and the leaves it sheds
  answerHover: 0.3, answerPick: 0.5, chain: 0.12, chainR: 15, // the beacon's answers, and the chain of lamps on beacon-lit
  eye: [1, 0.5] // what floats hides nearer the drawn eye than the lamplighter less 1 m, and shows again past the lamplighter less 0.5 m
};

/* LIFE: per place, the palette slots of each use (the place's own palette, read off the biome's order in
   games/gloam-downs/biomes/<id>.mjs), with the biome's name of that ramp, so the test checks each slot against the biome. tuftOn: the
   ground ramps a tuft may stand on. Every life dab's colour is one of these, or a shared slot under 34, or 46 and 47 at a lamp */
export const LIFE = {
  gaol: {
    tuft: { name: 'moss', slots: [23, 24], n: 130, h: [0.2, 0.36] }, tuftOn: [9, 10, 11, 12, 13, 23, 24],
    mist: { name: 'fog', slots: [6], n: 80 },
    fall: { name: 'moon', slots: [30], n: 36, kind: K.fall, rg: [1.2, 1.8], sp: [0.4, 0.6], s: 0.016, at: 'hollow' }, // drips in the cells
    // motes that gather in the light: round the lamps and braziers, not spread over the keep like static (Death's Door's dust in the
    // shafts of light)
    mote: { name: 'moon', slots: [30, 31], n: 56, glow: true, at: 'lamp', d: 1.3 },
    ember: { slots: [EMBER], per: 2 }, // two short-lived embers a fire, kept close over it (no warm dab adrift in the middle ground)
    crow: { name: 'ink', slots: [7], flocks: 2 }
  },
  ramparts: {
    tuft: { name: 'grass', slots: [11, 12, 13], n: 120, h: [0.2, 0.34] }, tuftOn: [10, 11, 12, 13, 14],
    rag: { name: 'rag', slots: [29, 30, 31], n: 16 },
    mote: { name: 'chalk', slots: [15, 16, 17], n: 90, glow: false },
    fall: { name: 'grass', slots: [11, 12, 13], n: 110, kind: K.flutter, rg: [1, 1.5], sp: [0.3, 0.6], s: 0.032 },
    crow: { name: 'ink', slots: [8], flocks: 3 }
  },
  fen: {
    tuft: { name: 'moss', slots: [9, 10, 11], n: 120, h: [0.3, 0.55] }, tuftOn: [8, 9, 10, 11, 12, 13, 14],
    firefly: { name: 'lantern', slots: [27], n: 60 },
    mist: { name: 'fog', slots: [5], n: 90 },
    fall: { name: 'straw', slots: [25], n: 40, kind: K.flutter, rg: [1, 1.5], sp: [0.2, 0.4], s: 0.026 }, // reed fluff
    crow: { name: 'ink', slots: [6], flocks: 1 }
  },
  bells: {
    tuft: { name: 'grass', slots: [9, 10, 11], n: 130, h: [0.2, 0.34] }, tuftOn: [8, 9, 10, 11, 12],
    mote: { name: 'lit', slots: [18], n: 90, glow: true },
    fall: { name: 'verd', slots: [27, 28], also: { name: 'rust', slots: [29, 30, 31] }, n: 120, kind: K.flutter, rg: [1, 1.5], sp: [0.3, 0.6], s: 0.03 },
    crow: { name: 'ink', slots: [6], flocks: 1 }
  },
  barrows: {
    tuft: { name: 'grass', slots: [13, 14, 15], n: 120, h: [0.2, 0.34] }, tuftOn: [12, 13, 14, 15, 16],
    mote: { name: 'ghost', slots: [25, 26, 27], n: 80, glow: true, wander: true },
    fall: { name: 'earth', slots: [19], n: 110, kind: K.fall, rg: [2.6, 3.6], sp: [0.2, 0.35], s: 0.022 }, // ash
    rag: { name: 'rag', slots: [30, 31], n: 14 },
    crow: { name: 'ink', slots: [10], flocks: 1 }
  }
};

// one subscription set at a time: a new place's life drops the last one's
let offs = [];

/* makeLife(world, meta, { walk, still, rows, on }): world is the place as world.js loads it (before the pool), meta its JSON, walk the
   walk map (play.js makeWalk), still reduced motion, rows the page's set of changed 512-splat rows, on false for no life. -> { draw,
   test, rows, count, first } */
export function makeLife(world, meta, { walk, still = false, rows = new Set(), on = true } = {}) {
  for (const f of offs) f();
  offs = [];
  const id = meta.id, L = LIFE[id];
  const api = { count: 0, first: world.count, draw() {}, test: () => ({ on: false, count: 0 }), rows: () => [] };
  if (!on || !L || !walk) return api;
  const rnd0 = mulberry((meta.seed || 1) * 7919 + 17), rnd = (a, b) => a + (b - a) * rnd0(), pick = a => a[Math.floor(rnd0() * a.length)];
  const N0 = world.count, D0 = world.data, pal = meta.pal;
  const PK = pal.map(c => ((c >> 16) & 255) + ((c >> 8) & 255) * 256 + (c & 255) * 65536);
  const RGB = pal.map(c => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
  const nearestOf = (col, slots) => { const r = col & 255, g = (col >> 8) & 255, b = (col >> 16) & 255; let best = slots[0], bd = Infinity; for (const s of slots) { const [R, G, B] = RGB[s], d = (R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2; if (d < bd) { bd = d; best = s; } } return best; };
  const nearestSlot = col => nearestOf(col, pal.map((_, i) => i));

  /* ---------------- where life goes, from the place's own data ---------------- */
  const skip = [[meta.bones.first, meta.bones.end], ...meta.beacon.fire, ...meta.wisps.map(w => w.ids)];
  const skipped = i => skip.some(([a, b]) => i >= a && i < b);
  // the lamp anchors: clusters (0.6 m) of the baked rising embers and glows
  const anchors = [];
  for (let i = 0; i < N0; i++) {
    const o = i * 16, k = D0[o + 11] % 16;
    if ((k !== 3 && k !== 7) || skipped(i)) continue;
    const x = D0[o], y = D0[o + 1], z = D0[o + 2];
    let c = anchors.find(c => Math.hypot(c.x - x, c.y - y, c.z - z) < 0.6);
    if (!c) { c = { x, y, z, n: 0, fire: 0 }; anchors.push(c); }
    c.n++; if (k === 3) c.fire++;
  }
  for (const c of anchors) { c.near = 0; c.pulse = []; c.lit = 0; c.lift = 0; }
  // the route as the page knows it: the spawn, the zones in order of distance from it, and the beacon
  const sp = meta.spawn.p, bp = meta.beacon.p;
  const route = [[sp[0], sp[2]], ...(meta.zones || []).map(z => [z.c[0], z.c[2]]).sort((a, b) => Math.hypot(a[0] - sp[0], a[1] - sp[2]) - Math.hypot(b[0] - sp[0], b[1] - sp[2])), [bp[0], bp[2]]];
  const toRoute = (x, z) => {
    let best = Infinity;
    for (let k = 0; k + 1 < route.length; k++) {
      const [ax, az] = route[k], [bx, bz] = route[k + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      best = Math.min(best, Math.hypot(x - ax - dx * u, z - az - dz * u));
    }
    return best;
  };
  // the walk map's cells, every other one (0.5 m): the floor, its slope, whether a roof stands over it
  const { nx, nz, x0, z0, T, G } = walk, step0 = walk.step;
  const H = k => T[k] * 0.01;
  const cell = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i);
  const cells = [];
  for (let j = 2; j < nz - 2; j += 2) for (let i = 2; i < nx - 2; i += 2) {
    const k = cell(i, j), x = x0 + i * step0, z = z0 + j * step0;
    const sx = (H(cell(i + 1, j)) - H(cell(i - 1, j))) / (2 * step0), sz = (H(cell(i, j + 1)) - H(cell(i, j - 1))) / (2 * step0);
    cells.push({ i, j, k, x, z, y: H(k), slope: Math.hypot(sx, sz), roof: G[k] < T[k], d: toRoute(x, z) });
  }
  // the ground's colour: the baked splat nearest the floor in each 0.5 m cell (scenery only, not glowing)
  const ground = new Map();
  for (let i = 0; i < N0; i++) {
    if (i >= meta.bones.first && i < meta.bones.end) continue;
    const o = i * 16, kr = D0[o + 11];
    if (kr % 16 !== 0 || (kr & EM) || D0[o + 3] <= 0) continue;
    const x = D0[o], z = D0[o + 2], ci = Math.floor((x - x0) / 0.5), cj = Math.floor((z - z0) / 0.5);
    const fi = Math.round((x - x0) / step0), fj = Math.round((z - z0) / step0), k = cell(fi, fj);
    if (k < 0) continue;
    const dy = Math.abs(D0[o + 1] - H(k));
    if (dy > 0.3) continue;
    const key = cj * 4096 + ci, was = ground.get(key);
    if (!was || dy < was.dy) ground.set(key, { dy, col: D0[o + 7] });
  }
  const groundAt = (x, z) => ground.get(Math.floor((z - z0) / 0.5) * 4096 + Math.floor((x - x0) / 0.5))?.col;
  const fromSpawn = (x, z) => Math.hypot(x - sp[0], z - sp[2]);
  const flat = cells.filter(c => !c.roof && c.slope < 0.3);
  // hollows: floor cells lower than the mean of the cells 4 m round them by 0.5 m or more
  const R4 = Math.round(4 / step0);
  const hollows = flat.filter(c => {
    if (c.d > 20) return false;
    let s = 0, n = 0;
    for (let a = 0; a < 16; a++) { const k = cell(c.i + Math.round(Math.cos((a / 16) * TAU) * R4), c.j + Math.round(Math.sin((a / 16) * TAU) * R4)); if (k >= 0) { s += H(k); n++; } }
    return n && s / n - c.y >= 0.5;
  });
  // perches: tops 1.5 m or more over the floor beside them (1 m out), flat on top, within 6 m of the route and 8 m of the spawn or more
  const R1 = Math.round(1 / step0);
  const perches = cells.filter(c => {
    if (c.d > 6 || fromSpawn(c.x, c.z) < 8 || c.slope > 0.5) return false;
    let lo = Infinity;
    for (let a = 0; a < 8; a++) { const k = cell(c.i + Math.round(Math.cos((a / 8) * TAU) * R1), c.j + Math.round(Math.sin((a / 8) * TAU) * R1)); if (k >= 0) lo = Math.min(lo, H(k)); }
    return c.y - lo >= 1.5;
  });
  // stones and walls for rags: 1 m over the floor beside them is enough
  const tops = cells.filter(c => {
    if (c.d > 10 || c.slope > 0.5 || fromSpawn(c.x, c.z) < 4) return false;
    let lo = Infinity;
    for (let a = 0; a < 8; a++) { const k = cell(c.i + Math.round(Math.cos((a / 8) * TAU) * R1), c.j + Math.round(Math.sin((a / 8) * TAU) * R1)); if (k >= 0) lo = Math.min(lo, H(k)); }
    return c.y - lo >= 1;
  });
  // a cell near the route, drawn with more weight the nearer it is
  const nearRoute = (list, far) => { const w = list.filter(c => c.d <= far); return w.length ? w : list; };
  const spot = (list, far = 14) => { const l = nearRoute(list, far); for (let t = 0; t < 6; t++) { const c = pick(l); if (rnd0() < 1 - c.d / (far * 1.6)) return c; } return pick(l); };
  // a third of what drifts and falls is near the start, where the player first looks
  const startList = list => { const l = list.filter(c => fromSpawn(c.x, c.z) <= 12 && fromSpawn(c.x, c.z) >= 2); return l.length > 8 ? l : list; };
  const spotStart = (list, far = 14, k = 0) => (k % 3 === 0 ? pick(startList(list)) : spot(list, far));

  /* ---------------- the block ---------------- */
  const dabs = []; // { x, y, z, s, sy?, axis?, d, ci, kind, ph, sp, rg, ex, flags, use, bright, group }
  const add = o => { const d = { flags: ND, ph: 0, sp: 0, rg: 0, ex: -100, bright: false, ...o }; dabs.push(d); return dabs.length - 1; };
  const mot = k => (still ? (k === K.twinkle || k === K.glow ? K.glow : K.still) : k);

  // A: tufts, and the leaves a gust sheds (parked till then)
  const tufts = [];
  if (L.tuft) {
    const on = flat.filter(c => c.d <= 10 && fromSpawn(c.x, c.z) > 1.2 && L.tuftOn.includes(nearestSlot(groundAt(c.x, c.z) ?? 0)));
    for (let t = 0; t < L.tuft.n && on.length; t++) {
      const c = spot(on, 7), x = c.x + rnd(-0.25, 0.25), z = c.z + rnd(-0.25, 0.25), y = walk.top(x, z);
      const col = groundAt(x, z), base = col !== undefined ? nearestOf(col, L.tuft.slots) : L.tuft.slots[0];
      const ci = L.tuft.slots[Math.min(L.tuft.slots.length - 1, L.tuft.slots.indexOf(base) + (rnd0() < 0.5 ? 1 : 0))];
      const h = rnd(...L.tuft.h), lean = rnd(0, TAU), phs = rnd(0, TAU), spd = rnd(1.4, 2.2), rg = rnd(0.04, 0.1);
      // three blades from one foot, leaning out a little; each sways from the foot by its height (kind 14, ex the foot)
      for (let b = 0; b < 3; b++) {
        const a = lean + (b - 1) * 0.9, tilt = rnd(0.12, 0.3), hb = h * rnd(0.7, 1), ax = [Math.sin(a) * tilt, 1, Math.cos(a) * tilt], n = Math.hypot(...ax);
        tufts.push(add({ use: 'tuft', x: x + ax[0] / n * hb * 0.5, y: y + hb * 0.5, z: z + ax[2] / n * hb * 0.5, s: 0.022, len: hb * 0.5, axis: ax.map(v => v / n), d: 2.2, ci, kind: mot(K.sway), ph: phs + b * 0.4, sp: spd, rg, ex: y }));
      }
    }
  }
  const shed = [];
  const fallSlots = L.fall ? [...L.fall.slots, ...(L.fall.also?.slots || [])] : [];
  if (L.fall && !still) for (let t = 0; t < RULES.shed[1]; t++) shed.push(add({ use: 'shed', x: 0, y: -50, z: 0, s: L.fall.s, d: 0, ci: pick(fallSlots), kind: K.flutter }));
  // B: the lamps: halos (4 dabs, one of them pale on a brighten) and moths; then the beacon's 8 dabs of answer
  for (const [ai, c] of anchors.entries()) {
    c.halo = [];
    for (let h = 0; h < 4; h++) {
      const a = (h / 4) * TAU + rnd(-0.4, 0.4), r = rnd(0.12, 0.28);
      c.halo.push(add({ use: 'halo', x: c.x + Math.sin(a) * r, y: c.y + rnd(-0.1, 0.2), z: c.z + Math.cos(a) * r, s: RULES.halo[0], d: 1.6, ci: LAMP, pale: h === 0, kind: mot(K.twinkle), ph: rnd(0, TAU), sp: TAU * rnd(1.5, 3), flags: ND + EM, bright: true, group: ai }));
    }
    for (let m = 0; m < 2; m++) {
      const a = rnd(0, TAU);
      add({ use: 'moth', x: c.x + Math.sin(a) * 0.28, y: c.y + rnd(0, 0.15), z: c.z + Math.cos(a) * 0.28, s: 0.026, d: 2.4, ci: LAMP_PALE, kind: mot(K.wander), ph: rnd(0, TAU), sp: rnd(2.5, 4), rg: rnd(0.12, 0.2), flags: ND + EM, bright: true, group: ai });
    }
  }
  const beacon = [];
  for (let b = 0; b < 8; b++) {
    const a = (b / 8) * TAU;
    beacon.push(add({ use: 'beacon', x: bp[0] + Math.sin(a) * 0.7, y: bp[1] + 0.3 + Math.sin(a * 2) * 0.25, z: bp[2] + Math.cos(a) * 0.7, s: 0.06, d: 0, ci: LAMP, kind: K.still, flags: ND + EM }));
  }
  // C: embers, fireflies, motes, mist, the falling, rags
  if (L.ember) for (const [ai, c] of anchors.entries()) if (c.fire) for (let e = 0; e < L.ember.per; e++)
    add({ use: 'ember', x: c.x + rnd(-0.2, 0.2), y: c.y + rnd(0, 0.2), z: c.z + rnd(-0.2, 0.2), s: 0.03, d: 2.4, ci: EMBER, kind: mot(K.rise), ph: rnd(0, 1), sp: rnd(0.25, 0.5), rg: rnd(0.6, 1.2), ex: 0.4, flags: ND + EM, bright: true, group: ai });
  // what floats stands 2.5 m or more off the route: the follow camera rides the route a few metres behind the lamplighter, and a mote
  // a metre from the eye draws as a big pale ball, not a fleck
  const air = flat.filter(c => c.d <= 14 && c.d >= 2.5);
  if (L.firefly) {
    const over = hollows.filter(c => c.d >= 2.5).length ? hollows.filter(c => c.d >= 2.5) : air;
    for (let t = 0; t < L.firefly.n; t++) { const c = spot(over, 14); add({ use: 'firefly', x: c.x + rnd(-0.3, 0.3), y: c.y + rnd(0.4, 1.6), z: c.z + rnd(-0.3, 0.3), s: 0.03, d: 2.6, ci: L.firefly.slots[0], kind: mot(K.twinkle), ph: rnd(0, TAU), sp: TAU * rnd(0.4, 1.1), flags: ND + EM, bright: true }); }
  }
  // a mote at a lamp: within 1 to 3.5 m of a lamp anchor, off the route by 1.5 m or more, at about the lamp's height
  const lit = anchors.filter(c => toRoute(c.x, c.z) <= 16);
  const atLamp = () => {
    for (let t = 0; t < 8; t++) {
      const c = pick(lit), a = rnd(0, TAU), r = rnd(1, 3.5), x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
      if (toRoute(x, z) >= 1.5) return { x, z, y: Math.max(walk.top(x, z), c.y - 1.2) - 0.6 };
    }
    return null;
  };
  if (L.mote) for (let t = 0; t < L.mote.n; t++) {
    const c = (L.mote.at === 'lamp' && lit.length && atLamp()) || spotStart(air, 14, t), wander = L.mote.wander || rnd0() < 0.5;
    add({ use: 'mote', x: c.x + rnd(-0.3, 0.3), y: c.y + rnd(0.6, 2.4), z: c.z + rnd(-0.3, 0.3), s: rnd(0.016, 0.026), d: L.mote.d ?? (L.mote.glow ? 2 : 1.6), ci: pick(L.mote.slots), kind: mot(wander ? K.wander : K.bob), ph: rnd(0, TAU), sp: wander ? rnd(0.6, 1.3) : rnd(0.9, 1.6), rg: rnd(0.08, 0.15), flags: L.mote.glow ? ND + EM : ND, bright: !!L.mote.glow });
  }
  if (L.mist) {
    const low = hollows.length ? hollows : flat.filter(c => c.d <= 16);
    for (let t = 0; t < L.mist.n; t++) { const c = spot(low, 16); add({ use: 'mist', x: c.x + rnd(-0.3, 0.3), y: c.y + rnd(0.08, 0.45), z: c.z + rnd(-0.3, 0.3), s: rnd(0.1, 0.16), sy: 0.045, d: 0.45, ci: L.mist.slots[0], kind: mot(K.wander), ph: rnd(0, TAU), sp: rnd(0.06, 0.12), rg: 0.3 }); }
  }
  if (L.fall) {
    const src = L.fall.at === 'hollow' && hollows.length ? hollows : air;
    for (let t = 0; t < L.fall.n; t++) {
      const c = src === air ? spotStart(src, 14, t) : spot(src, 14), x = c.x + rnd(-0.3, 0.3), z = c.z + rnd(-0.3, 0.3), y = walk.top(x, z), rg = rnd(...L.fall.rg), long = L.fall.kind === K.fall;
      // with reduced motion a leaf that would fall lies on the ground
      if (still) add({ use: 'fall', x, y: y + 0.02, z, s: L.fall.s, sy: L.fall.s * 0.3, d: 2, ci: pick(fallSlots), kind: K.still });
      else add({ use: 'fall', x, y: y + rg + 0.04, z, s: L.fall.s, d: long ? 1.8 : 2.2, ci: pick(fallSlots), kind: L.fall.kind, ph: rnd(0, 1), sp: rnd(...L.fall.sp), rg, ex: long ? 0 : rnd(0.15, 0.3) });
    }
  }
  if (L.rag && tops.length) for (let t = 0; t < L.rag.n; t++) {
    const c = spot(tops, 10), x = c.x + rnd(-0.15, 0.15), z = c.z + rnd(-0.15, 0.15), y = walk.top(x, z), ci = pick(L.rag.slots), a = rnd(0, TAU), ph = rnd(0, TAU), spd = rnd(1.6, 2.6);
    // a strip tied on top, standing and swaying from its knot
    for (let b = 0; b < 3; b++) add({ use: 'rag', x: x + Math.sin(a) * 0.03 * b, y: y + 0.08 + b * 0.09, z: z + Math.cos(a) * 0.03 * b, s: 0.03, sy: 0.05, d: 2.4, ci, kind: mot(K.sway), ph: ph + b * 0.3, sp: spd, rg: 0.35, ex: y });
  }
  // D: crows, a flock at a time (3 to 5 birds of 12 dabs), each flock on its own perch spread along the route
  const flocks = [];
  if (L.crow && perches.length) {
    const chosen = [];
    const byRoute = perches.slice().sort((a, b) => a.d - b.d);
    for (const c of byRoute) {
      if (chosen.length >= L.crow.flocks) break;
      if (chosen.every(o => Math.hypot(o.x - c.x, o.z - c.z) > 9)) chosen.push(c);
    }
    for (const c of chosen) {
      // the birds sit along the top: other perch cells within 1.5 m, or round the first
      const by = perches.filter(p => Math.hypot(p.x - c.x, p.z - c.z) < 1.6 && Math.abs(p.y - c.y) < 0.4);
      const n = 3 + Math.floor(rnd0() * 3), birds = [];
      for (let b = 0; b < n; b++) {
        const p = by[Math.floor(rnd0() * by.length)] || c, x = p.x + rnd(-0.15, 0.15), z = p.z + rnd(-0.15, 0.15), y = walk.top(x, z) + 0.12, yaw = rnd(0, TAU);
        const bird = { x, y, z, yaw, at: [x, y, z], dabs: [], dir: null };
        for (const part of BIRD) bird.dabs.push(add({ use: 'crow', part, x, y, z, s: part.s * CROW, d: 2.6, ci: L.crow.slots[0], kind: K.still, flags: 0 }));
        birds.push(bird);
      }
      const cx = birds.reduce((s, b) => s + b.x, 0) / n, cz = birds.reduce((s, b) => s + b.z, 0) / n, cy = birds.reduce((s, b) => s + b.y, 0) / n;
      flocks.push({ x: cx, y: cy, z: cz, birds, state: 'perched', t0: 0 });
    }
  }
  if (dabs.length > MAX) dabs.length = MAX;
  const n = dabs.length;

  /* ---------------- into the world's data ---------------- */
  const first = N0, data = new Float32Array((N0 + n) * 16);
  data.set(D0.subarray(0, N0 * 16));
  world.data = data;
  world.count = N0 + n;
  const moving = [];
  for (let i = 0; i < n; i++) if (dabs[i].kind === K.fall || dabs[i].kind === K.rise) moving.push(first + i);
  if (moving.length) { const m = new Int32Array(world.moving.length + moving.length); m.set(world.moving); m.set(moving, world.moving.length); world.moving = m; }
  // the hush groups: each lamp's dabs, and the other bright dabs by 4 m cells
  const groups = anchors.map(c => ({ x: c.x, z: c.z, r: 0.8, h: 1, want: 1, calm: 0, dabs: [] }));
  const cellGroups = new Map();
  for (let i = 0; i < n; i++) {
    const d = dabs[i];
    if (!d.bright) continue;
    if (d.group === undefined) {
      const key = `${Math.floor(d.x / 4)},${Math.floor(d.z / 4)}`;
      if (!cellGroups.has(key)) { cellGroups.set(key, groups.length); groups.push({ x: (Math.floor(d.x / 4) + 0.5) * 4, z: (Math.floor(d.z / 4) + 0.5) * 4, r: 2.9, h: 1, want: 1, calm: 0, dabs: [] }); }
      d.group = cellGroups.get(key);
    }
    groups[d.group].dabs.push(i);
  }
  const touched = new Set(), DIRTY = new Set();
  let enabled = true, written = 0, writes = 0, maxRows = 0, lastT = null, nextGust = null, gust = null, gusts = 0, answer = null, pendingAnswer = null, hushed = 0;
  // the last 240 draws' own times, in a ring
  const times = new Float64Array(240);
  let timeN = 0;
  const D = () => world.data;
  // write dab i from its own values and the answers on it now
  function put(i) {
    const d = dabs[i], o = (first + i) * 16, w = D();
    touched.add((first + i) >> 9);
    if (!enabled || d.parked) { w[o] = 0; w[o + 1] = -50; w[o + 2] = 0; w[o + 3] = 0; w[o + 11] = ND; w[o + 15] = -100; return; }
    let { x, y, z, s } = d, dens = d.d, ci = d.ci, rg = d.rg, ph = d.ph, ex = d.ex, kind = d.kind, sy = d.sy;
    if (d.group !== undefined && groups[d.group]) dens *= groups[d.group].h;
    if (d.use === 'halo') { const c = anchors[d.group], a = Math.max(c.near, c.lit); s = RULES.halo[0] + (RULES.halo[1] - RULES.halo[0]) * a; if (d.pale && a >= 0.5) ci = LAMP_PALE; dens *= 1 + 0.4 * a; }
    if (d.use === 'tuft' && gust) rg *= gust.f;
    if (d.fade !== undefined) dens *= d.fade;
    if (d.eyeHid) dens = 0;
    if (d.use === 'beacon') { if (!answer) dens = 0; else { const u = answer.u; dens = 2.6 * (answer.pick ? 1 - u * u : Math.sin(Math.PI * Math.min(1, u))); s = answer.pick ? 0.06 + 0.06 * Math.sin(Math.PI * Math.min(1, u * 1.4)) : 0.05; ci = answer.ci; } }
    if (d.wx !== undefined) { x = d.wx; y = d.wy; z = d.wz; }
    w[o] = x; w[o + 1] = y; w[o + 2] = z; w[o + 3] = dens;
    if (d.len) {
      // a blade or a wing: long along its axis, thin across
      const [ax, ay, az] = d.waxis || d.axis, l2 = d.len * d.len - s * s, s2 = s * s;
      w[o + 4] = s2 + l2 * ax * ax; w[o + 5] = l2 * ax * ay; w[o + 6] = l2 * ax * az; w[o + 8] = s2 + l2 * ay * ay; w[o + 9] = l2 * ay * az; w[o + 10] = s2 + l2 * az * az;
    } else { const s2 = s * s, y2 = sy ? sy * sy : s2; w[o + 4] = s2; w[o + 5] = 0; w[o + 6] = 0; w[o + 8] = y2; w[o + 9] = 0; w[o + 10] = s2; }
    w[o + 7] = PK[ci]; w[o + 11] = (d.wkind ?? kind) + d.flags; w[o + 12] = ph; w[o + 13] = d.wsp ?? d.sp; w[o + 14] = d.wrg ?? rg; w[o + 15] = d.wex ?? ex;
  }
  // a bird's dabs at its body point (x, y, z) facing yaw, wings out in flight (kind 8 about the body)
  function poseBird(b, x, y, z, yaw, flying) {
    const hx = Math.sin(yaw), hz = Math.cos(yaw), sx = hz, sz = -hx;
    for (const [k, i] of b.dabs.entries()) {
      const d = dabs[i], p = BIRD[k], wing = p.wing && flying;
      const fwd = (wing ? p.f * 0.3 : p.f) * CROW, side = (wing ? p.side * WING : p.side) * CROW, up = (wing ? 0.02 : p.u) * CROW;
      d.wx = x + hx * fwd + sx * side; d.wy = y + up; d.wz = z + hz * fwd + sz * side;
      d.len = p.l * CROW; d.waxis = wing ? unit([sx, 0.12, sz]) : unit([hx, p.tip || 0, hz]);
      if (wing) { d.wkind = still ? K.still : K.flap; d.wsp = 13 + (k % 3); d.wrg = x; d.wex = z; } else { d.wkind = K.still; d.wsp = 0; d.wrg = 0; d.wex = -100; }
    }
  }
  for (const f of flocks) for (const b of f.birds) poseBird(b, b.x, b.y, b.z, b.yaw, false);
  for (let i = 0; i < n; i++) put(i);
  touched.clear();

  /* what floats between the eye and the lamplighter: the cameras ride 8.5 to 15 m behind the lamplighter and the title's drift swings
     them off the route, so a mote or a drip there draws as a big pale square, not a fleck. Life lives at the lamplighter's distance and
     beyond: a floater (and the mist, whose wide dabs do the same) nearer the eye than the lamplighter less 1 m hides, and shows again
     past the lamplighter less 0.5 m. A crossing writes that dab's row on that frame only */
  const floaters = [];
  for (let i = 0; i < n; i++) if (['mote', 'firefly', 'fall', 'shed', 'mist'].includes(dabs[i].use)) floaters.push(i);
  const EYE = [0, 0, 0];
  const eyeOfView = v => { const cp = Math.cos(v.pitch); EYE[0] = v.target[0] + v.dist * Math.sin(v.yaw) * cp; EYE[1] = v.target[1] + v.dist * Math.sin(v.pitch); EYE[2] = v.target[2] + v.dist * Math.cos(v.yaw) * cp; return EYE; };
  let eyeHidden = 0;
  function nearEye(view, dirty) {
    if (!view?.target || !Number.isFinite(view.dist)) return;
    const [ex, ey, ez] = eyeOfView(view), lo = view.dist - RULES.eye[0], hi = view.dist - RULES.eye[1];
    eyeHidden = 0;
    for (const i of floaters) {
      const d = dabs[i], r = Math.hypot(d.x - ex, d.y - ey, d.z - ez), hid = d.eyeHid ? r < hi : r < lo;
      if (hid !== !!d.eyeHid) { d.eyeHid = hid; dirty.add(i); }
      if (hid) eyeHidden++;
    }
  }

  /* ---------------- the answers ---------------- */
  const hear = (name, fn) => offs.push(busOn(name, fn));
  hear('screen-hover', d => { pendingAnswer = { ci: ANSWER[d?.colour] ?? LAMP, pick: false, len: RULES.answerHover }; });
  hear('screen-pick', d => { pendingAnswer = { ci: ANSWER[d?.colour] ?? LAMP, pick: true, len: RULES.answerPick }; });
  hear('spark-take', d => { pendingAnswer = { ci: ANSWER[d?.colour] ?? EMBER, pick: true, len: RULES.answerPick }; });
  let pendingChain = null, pendingKindle = false;
  hear('beacon-lit', () => { pendingChain = true; });
  hear('pattern-kindled', () => { pendingKindle = true; });

  /* ---------------- each frame ---------------- */
  function step(t, body, foes) {
    if (lastT === null) { lastT = t; nextGust = t + rnd(...RULES.gust); }
    const dt = Math.max(0, Math.min(0.5, t - lastT));
    lastT = t;
    const dirty = DIRTY;
    dirty.clear();
    // the lamps near the lamplighter, and their pulses
    if (pendingChain) {
      const near = anchors.map((c, i) => [i, Math.hypot(c.x - bp[0], c.y - bp[1], c.z - bp[2])]).filter(([, r]) => r <= RULES.chainR).sort((a, b) => a[1] - b[1]);
      near.forEach(([i], k) => anchors[i].pulse.push(t + k * RULES.chain));
      pendingChain = null;
    }
    if (pendingKindle && body) {
      anchors.map((c, i) => [i, Math.hypot(c.x - body.x, c.z - body.z)]).sort((a, b) => a[1] - b[1]).slice(0, 3).forEach(([i]) => anchors[i].pulse.push(t));
      pendingKindle = false;
    }
    for (const c of anchors) {
      const want = body && Math.hypot(c.x - body.x, c.z - body.z) <= RULES.near && Math.abs(c.y - body.y) < 3.5 ? 1 : 0;
      const was = c.near;
      if (want && !c.want) emit('life-stir', { kind: 'lamp', x: c.x, y: c.y, z: c.z });
      c.want = want;
      c.near = want ? Math.min(1, c.near + dt / RULES.up) : Math.max(0, c.near - dt / RULES.down);
      let lit = 0;
      if (c.pulse.length) c.pulse = c.pulse.filter(p0 => t - p0 < 0.6);
      for (const p0 of c.pulse) { const u = (t - p0) / 0.6; if (u >= 0) lit = Math.max(lit, Math.sin(Math.PI * u)); }
      const wasLit = c.lit;
      c.lit = lit;
      if (c.near !== was || c.lit !== wasLit) for (const i of c.halo) dirty.add(i);
    }
    // the hush: every bright dab within 8 m of an awake foe fades out in a quarter second, and is back 2 s after the calm there
    hushed = 0;
    for (const g of groups) {
      const near = foes.length > 0 && foes.some(f => Math.hypot(f.x - g.x, f.z - g.z) <= RULES.hush + g.r);
      if (near) { g.calm = 0; g.want = 0; } else { g.calm += dt; if (g.calm >= RULES.hushBack) g.want = 1; }
      const h = g.want ? Math.min(1, g.h + dt / RULES.hushUp) : Math.max(0, g.h - dt / RULES.hushIn);
      if (h !== g.h) { g.h = h; for (const i of g.dabs) dirty.add(i); }
      if (g.h < 1) hushed += g.dabs.length;
    }
    // the flocks: near the lamplighter, a foe, or a hit, they lift and fly off; with reduced motion they fade where they sit
    for (const f of flocks) {
      if (f.state === 'perched') {
        const lamp = body && Math.hypot(f.x - body.x, f.z - body.z) <= RULES.crowNear && Math.abs(f.y - body.y) < 5;
        const foe = foes.length > 0 && foes.some(o => Math.hypot(f.x - o.x, f.z - o.z) <= RULES.crowFoe);
        const hit = foes.length > 0 && foes.some(o => HIT.has(o.state) && Math.hypot(f.x - o.x, f.z - o.z) <= RULES.crowHit);
        if (lamp || foe || hit) {
          f.state = 'flying'; f.t0 = t;
          const from = lamp ? body : (foes.find(o => Math.hypot(f.x - o.x, f.z - o.z) <= RULES.crowHit) || body || { x: f.x - 1, z: f.z });
          for (const b of f.birds) {
            const a = Math.atan2(b.x - from.x, b.z - from.z) + rnd(-0.6, 0.6);
            b.dir = [Math.sin(a), Math.cos(a)]; b.far = rnd(9, 14); b.up = rnd(4, 6.5); b.curl = rnd(-1.6, 1.6); b.delay = rnd(0, 0.25);
          }
          emit('life-stir', { kind: 'crows', x: f.x, y: f.y, z: f.z, n: f.birds.length });
        }
      }
      if (f.state === 'flying') {
        const span = still ? RULES.fade : RULES.fly;
        for (const b of f.birds) {
          const u = Math.max(0, Math.min(1, (t - f.t0 - (still ? 0 : b.delay)) / span));
          if (still) for (const i of b.dabs) dabs[i].fade = 1 - u;
          else {
            const e = u * u * (3 - 2 * u), r = b.far * Math.pow(u, 1.4), side = Math.sin(Math.PI * u) * b.curl;
            const x = b.x + b.dir[0] * r + b.dir[1] * side, z = b.z + b.dir[1] * r - b.dir[0] * side, y = b.y + b.up * Math.pow(e, 1.2);
            poseBird(b, x, y, z, Math.atan2(b.dir[0], b.dir[1]), u > 0);
            for (const i of b.dabs) dabs[i].fade = u > 0.85 ? (1 - u) / 0.15 : 1;
          }
          for (const i of b.dabs) dirty.add(i);
        }
        if (t - f.t0 >= span + 0.25) { f.state = 'gone'; for (const b of f.birds) for (const i of b.dabs) { dabs[i].parked = true; dirty.add(i); } }
      }
    }
    // a gust: the tufts sway twice as far, then ease back, and a few leaves shed; one write a frame while it lasts
    if (t >= nextGust) {
      const k = rnd(0.6, 1);
      gust = { t0: t, k, f: 1 };
      gusts++;
      nextGust = t + RULES.gustLen + rnd(...RULES.gust);
      emit('life-stir', { kind: 'gust', k: +k.toFixed(2) });
      if (shed.length && body) {
        const count = Math.round(rnd(...RULES.shed));
        for (let s = 0; s < count; s++) {
          const d = dabs[shed[s]], a = rnd(0, TAU), r = rnd(1, 7), x = body.x + Math.sin(a) * r, z = body.z + Math.cos(a) * r, rg = rnd(1.2, 1.5), spd = rnd(0.4, 0.6);
          Object.assign(d, { x, z, y: walk.top(x, z) + rg + 0.04, rg, sp: spd, ex: rnd(0.15, 0.3), d: 2.2, parked: false, until: t + rg / spd - 0.05 });
          // the shader's fall loops on fract(t * sp / rg + ph): this phase starts it at the top now
          d.ph = 1 - ((((t * spd) / rg) % 1) + 1) % 1;
          dirty.add(shed[s]);
        }
      }
    }
    if (gust) {
      const u = (t - gust.t0) / RULES.gustLen;
      if (u >= 1) gust = null; else if (!still) gust.f = 1 + gust.k * Math.sin(Math.PI * u);
      if (!still) for (const i of tufts) dirty.add(i);
    }
    for (const i of shed) { const d = dabs[i]; if (!d.parked && d.until !== undefined && t >= d.until) { d.parked = true; dirty.add(i); } }
    // the beacon's answer to the cards
    if (pendingAnswer) { answer = { ...pendingAnswer, t0: t, u: 0 }; pendingAnswer = null; }
    if (answer) {
      answer.u = (t - answer.t0) / answer.len;
      if (answer.u >= 1) answer = null;
      for (const i of beacon) dirty.add(i);
    }
    return dirty;
  }
  for (const i of shed) dabs[i].parked = true;
  for (const i of shed) put(i);
  touched.clear();

  api.count = n;
  api.first = first;
  api.rows = () => { const r = []; for (let k = first >> 9; k <= (first + n - 1) >> 9; k++) r.push(k); return r; };
  api.draw = (view, t, body, foes = []) => {
    if (!enabled || !n) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dirty = step(t, body, foes || []);
    nearEye(view, dirty);
    for (const i of dirty) put(i);
    for (const r of touched) rows.add(r);
    written = touched.size; writes += written; maxRows = Math.max(maxRows, written);
    touched.clear();
    times[timeN++ % 240] = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  };
  const med = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const timesNow = () => times.slice(0, Math.min(timeN, 240));
  /* test(o): o.on turns life on or off (off parks every dab; on puts them back); o.near [x, y, z] and o.r list the dabs there;
     o.reset clears the timing. -> the state */
  api.test = (o = {}) => {
    if (o && typeof o.on === 'boolean' && o.on !== enabled) {
      enabled = o.on;
      for (let i = 0; i < n; i++) put(i);
      for (const r of touched) rows.add(r);
      touched.clear();
    }
    if (o?.reset) { timeN = 0; writes = 0; maxRows = 0; }
    // o.gust: a gust on the next draw (the budget's checks time the frames where life writes rows)
    if (o?.gust) nextGust = -Infinity;
    const kinds = {};
    for (let i = 0; i < n; i++) { const k = D()[(first + i) * 16 + 11] % 16; kinds[k] = (kinds[k] || 0) + 1; }
    const uses = {};
    for (const d of dabs) uses[d.use] = (uses[d.use] || 0) + 1;
    const out = {
      on: enabled, place: id, count: n, first, still, kinds, uses, anchors: anchors.length, gusts, hushed, rows: { last: written, max: maxRows, total: writes }, eyeHidden,
      ms: +med(timesNow()).toFixed(4), p99: +(() => { const a = [...timesNow()].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * 0.99))] : 0; })().toFixed(4), draws: Math.min(timeN, 240),
      halos: anchors.map(c => { const i = c.halo[0], w = D(), q = (first + i) * 16; return { x: c.x, y: c.y, z: c.z, s: +Math.sqrt(w[q + 4]).toFixed(4), pale: PK.indexOf(w[q + 7]), near: +c.near.toFixed(2) }; }),
      flocks: flocks.map(f => ({ x: f.x, y: f.y, z: f.z, n: f.birds.length, state: f.state, shown: f.birds.reduce((s, b) => s + b.dabs.filter(i => D()[(first + i) * 16 + 3] > 0).length, 0) })),
      beacon: { shown: beacon.filter(i => D()[(first + i) * 16 + 3] > 0).length, ci: answer?.ci ?? null, slot: (() => { const c = D()[(first + beacon[0]) * 16 + 7]; return PK.indexOf(c); })() },
      perches: perches.length, hollows: hollows.length
    };
    if (o?.near) {
      const [px, py, pz] = o.near, r = o.r ?? RULES.hush, w = D();
      out.dabs = [];
      for (let i = 0; i < n; i++) {
        const q = (first + i) * 16;
        if (Math.hypot(w[q] - px, w[q + 2] - pz) > r) continue;
        out.dabs.push({ use: dabs[i].use, bright: dabs[i].bright, d: +w[q + 3].toFixed(3), kind: w[q + 11] % 16, y: +w[q + 1].toFixed(2) });
      }
    }
    if (o?.all) out.all = dabs.map((d, i) => { const q = (first + i) * 16, w = D(); return { use: d.use, kind: w[q + 11] % 16, col: w[q + 7], d: w[q + 3], x: w[q], y: w[q + 1], z: w[q + 2], bright: d.bright, group: d.group }; });
    return out;
  };
  return api;
}

/* a crow of 12 dabs, as offsets from its body point along its heading (f), to its right (side) and up (u); s its width, l its half
   length along its axis (heading, tipped by tip). Wings fold along the body when it sits and spread to WING times their side out in
   flight, flapping about the body (kind 8) */
const WING = 4.2, CROW = 1.4;
const BIRD = [
  { f: -0.05, side: 0, u: 0.0, s: 0.05, l: 0.085 }, { f: 0.02, side: 0, u: 0.02, s: 0.055, l: 0.08 }, { f: 0.08, side: 0, u: 0.05, s: 0.04, l: 0.05, tip: 0.6 },
  { f: 0.15, side: 0, u: 0.09, s: 0.035, l: 0.04 }, { f: 0.21, side: 0, u: 0.085, s: 0.012, l: 0.04 }, // head and beak
  { f: -0.17, side: 0, u: -0.01, s: 0.022, l: 0.08, tip: -0.25 }, // tail
  { f: -0.01, side: 0.04, u: 0.035, s: 0.022, l: 0.08, wing: true }, { f: -0.01, side: -0.04, u: 0.035, s: 0.022, l: 0.08, wing: true },
  { f: -0.06, side: 0.06, u: 0.04, s: 0.02, l: 0.07, wing: true }, { f: -0.06, side: -0.06, u: 0.04, s: 0.02, l: 0.07, wing: true },
  { f: -0.1, side: 0.035, u: 0.02, s: 0.02, l: 0.06, wing: true }, { f: -0.1, side: -0.035, u: 0.02, s: 0.02, l: 0.06, wing: true }
];
