// Gloam Downs: what the seed of a run changes. The foe mix of each zone, the zone the place's elite stands in, the order of the
// middle places from Ember 1, and the guard's second wave; and the seed as a code of six letters to share. Each choice draws from its
// own stream of the seed (run.js stream), so one choice never moves another: 'mix/<place>', 'elite/<place>' and 'route'. The rules
// of the zones (fits, the cap of 6) are foes.js's own, so the page, the zone check and the bot agree. No DOM.
// After Slay the Spire's seed codes and Dead Cells' runs whose order of places changes (both cited from memory).
import { stream, routeFor } from './run.js';
import { ORDER } from './save.js';
import { fits, foesOf, poolCounts } from './foes.js';

/* ---------------- the places ----------------
   The newest foe type of each place (the one it brings in: it weighs 3 in the draw, the others 1, and the mix keeps it in at least one
   zone), and the elite's type (design.md "Elites") */
export const NEWEST = { gaol: 'S', ramparts: 'P', fen: 'M', bells: 'I', barrows: 'I' };
export const ELITE = { gaol: 'S', ramparts: 'P', fen: 'M', bells: 'I', barrows: 'S' };
export const MIX = { tries: 20, near: 20, weightNew: 3, extraFrom: 3, routeFrom: 1 };

const dist = (a, b) => Math.hypot(a.c[0] - b.c[0], a.c[2] - b.c[2]);
// zones the mix may change: not a guard, not the arena, and not the Gaol's G1 (its one Snuffer teaches the fight). The elite never
// stands in a place's first zone
const mixable = (z, i, place) => !z.guard && !z.boss && !(place === 'gaol' && i === 0);

/* the zones of a place once mixed, as copies of meta.zones with foes redrawn and `baked` kept, and the elite's zone marked with
   `elite` (the index of the elite in its foes). opts: { ember } (from Ember 3 a zone that may change has one foe more, when the pool
   and the cap allow). Each draw is kept only when every zone fits the pool alone, every two zones that are not guards or the arena
   and stand within 20 m fit together, the newest type is in a zone and the elite has a zone; else it draws again, up to 20 times, and then keeps the
   baked foes */
export function mixZones(place, zones = [], slots = '', seed = 1, { ember = 0 } = {}) {
  const pool = typeof slots === 'string' ? poolCounts(slots) : slots;
  const types = Object.keys(pool).filter(t => 'SPMI'.includes(t));
  const copy = zones.map(z => ({ ...z, c: z.c.slice(), baked: z.baked ?? z.foes }));
  if (!types.length) return copy;
  const rnd = stream(seed, `mix/${place}`), newest = NEWEST[place];
  // a zone's foes, drawn from the pool's slots without putting them back (so a zone alone never asks for more than the pool holds),
  // each free slot weighing 1, or 3 for the newest type
  const zoneOf = k => {
    const left = { ...pool }, out = [];
    for (let j = 0; j < k; j++) {
      const ws = types.map(t => (left[t] > 0 ? left[t] * (t === newest ? MIX.weightNew : 1) : 0)), total = ws.reduce((a, b) => a + b, 0);
      if (!total) break;
      let r = rnd() * total, t = types.at(-1);
      for (let i = 0; i < types.length; i++) { r -= ws[i]; if (r < 0) { t = types[i]; break; } }
      left[t]--; out.push(t);
    }
    return out.join('');
  };
  const extra = ember >= MIX.extraFrom ? 1 : 0;
  // Ember 3's foe more, one zone at a time, where the rules still hold (and the elite still has a zone, when it had one)
  const addExtra = zones => {
    const need = eliteChoices(place, zones, pool).length > 0;
    for (const [i, z] of zones.entries()) {
      if (!mixable(z, i, place)) continue;
      const more = { ...z, foes: z.foes + (newest && pool[newest] ? newest : types[0]) };
      const trial = zones.map(q => (q === z ? more : q));
      if (keep(place, trial, pool, need)) zones[i] = more;
    }
    return zones;
  };
  // the draws: with Ember 3's foe more first; when 20 of those fail, 20 without it, and the foe more added after where it fits
  for (const ex of extra ? [1, 0] : [0]) for (let tries = 0; tries < MIX.tries; tries++) {
    const draw = copy.map((z, i) => (mixable(z, i, place) ? { ...z, foes: zoneOf(foesOf({ foes: z.baked }).length + ex) } : { ...z }));
    if (keep(place, draw, pool)) return withElite(place, extra && !ex ? addExtra(draw) : draw, pool, seed);
  }
  // the baked foes, with Ember 3's foe more where it fits
  const baked = copy.map(z => ({ ...z, foes: z.baked }));
  return withElite(place, extra ? addExtra(baked) : baked, pool, seed);
}
// every two zones that are not guards or the arena (the first zone too, as it stands) within 20 m fit together
function pairsFit(zones, pool) {
  const free = zones.filter(z => !z.guard && !z.boss);
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++)
    if (dist(free[i], free[j]) <= MIX.near && !fits(free[i], [free[j]], pool)) return false;
  return true;
}
function keep(place, zones, pool, needElite = true) {
  if (!zones.every(z => z.boss || fits(z, [], pool))) return false;
  if (!pairsFit(zones, pool)) return false;
  const newest = NEWEST[place];
  if (newest && pool[newest] && !zones.some(z => !z.boss && foesOf(z).includes(newest))) return false;
  return !needElite || eliteChoices(place, zones, pool).length > 0;
}
// the zones the elite may stand in: one that may change and holds a foe of the elite's type, or has room for one more under the rules
function eliteChoices(place, zones, pool) {
  const type = ELITE[place];
  if (!type || !pool[type]) return [];
  const out = [];
  zones.forEach((z, i) => {
    if (i === 0 || !mixable(z, i, place)) return;
    if (foesOf(z).includes(type)) { out.push({ i, k: foesOf(z).indexOf(type), add: false }); return; }
    const more = { ...z, foes: z.foes + type };
    if (fits(more, [], pool) && pairsFit(zones.map(q => (q === z ? more : q)), pool)) out.push({ i, k: foesOf(z).length, add: true });
  });
  return out;
}
function withElite(place, zones, pool, seed) {
  const list = eliteChoices(place, zones, pool);
  for (const z of zones) delete z.elite;
  if (!list.length) return zones;
  const r = stream(seed, `elite/${place}`), c = list[Math.floor(r() * list.length)], z = zones[c.i];
  if (c.add) z.foes += ELITE[place];
  z.elite = c.k;
  return zones;
}
// the id of the elite's zone in mixed zones, or null
export const eliteZone = zones => zones.find(z => Number.isInteger(z.elite))?.id ?? null;

/* ---------------- the route ----------------
   From Ember 1 the seed orders places II to IV; the Gaol stays first and Barrow Crown last. Below Ember 1 the order is as it was */
export const routeOf = (seed = 1, ember = 0) => routeFor(seed, ember); // one rule with run.js, which the run keeps in run.route
  return [ORDER[0], ...mid, ORDER.at(-1)];
}

/* ---------------- the guard's second wave ----------------
   When every foe of a guard zone is put out, a second wave rises 1.5 s later at the same spots: the guard's baked foes less the first
   one, at least one. The arena has none, and a zone has one wave only. -> the wave's foes, or '' */
export const WAVE = { wait: 90 };
export function mixWave(Z) {
  if (!Z || !Z.guard || Z.boss || Z.spawned || Z.waved) return '';
  const b = foesOf({ foes: Z.baked ?? Z.foes });
  return (b.length > 1 ? b.slice(1) : b).join('');
}

/* ---------------- the seed code ----------------
   A seed as letters of Crockford's base 32 (no I, L, O or U, so it reads aloud), six of them for a seed under 2^30 (the page draws its
   seeds that small), more for a larger one. ?seed= takes the code or the number: six characters are always a code (a code may be
   all digits), any other run of digits is the number */
const ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SEED_BITS = 30;
export const smallSeed = n => ((n >>> 0) % (2 ** SEED_BITS)) || 1;
export function seedCode(n) {
  let v = n >>> 0, s = '';
  do { s = ABC[v % 32] + s; v = Math.floor(v / 32); } while (v > 0);
  return s.padStart(6, '0');
}
// a number or a code -> the seed, or null when it is neither
export function parseSeed(text) {
  const t = String(text ?? '').trim().toUpperCase();
  if (!t) return null;
  if (/^\d+$/.test(t) && t.length !== 6) { const n = Number(t) >>> 0; return n || null; }
  const c = t.replace(/[IL]/g, '1').replace(/O/g, '0').replace(/-/g, '');
  if (!/^[0-9A-HJKMNP-TV-Z]{1,7}$/.test(c)) return null;
  let v = 0;
  for (const ch of c) v = v * 32 + ABC.indexOf(ch);
  return v > 0 && v < 2 ** 32 ? v : null;
}
