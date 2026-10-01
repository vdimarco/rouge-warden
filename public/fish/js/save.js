// The save file (localStorage key fish.v1). Pure functions (no DOM, no storage), so node can test them:
// node qa/fish/save.test.mjs. main.js reads the text from storage, gives it to loadSave, and writes JSON.stringify(save).
//
// A save: journal { id: { n, kg, cm } }, casts, longest, derbyBest, biggest { id, kg } or null, input, assist, quality, artStyle, reelSide,
//   seen { flag: 1 }, caught, and for the places: place (where the player is) and places { id: record }.
// A place record: { open: 0|1, d: best derby kg here, kg: biggest fish here, id: its species or null,
//   n: fish landed here, lg: the legend step 0..3 (0 not seen, 1 its gold ring seen, 2 hooked, 3 landed) }.
// derbyBest stays the Loon Lake best (the arcade cabinet reads it). biggest is the biggest fish anywhere. The journal
// stays keyed by species id, so a fish that lives at two places has one record.
// One-time flags live in seen: "at.<id>" (the arrival card), "opened.<id>" (the unlock toast), "river.swing".
import { JUNK, byId } from "./species.js";
import { fishingOf } from "./fishing.js";
import { ORDER, JOURNEY, nextPlace, isOpen } from "./journey.js";

export const SAVE_KEY = "fish.v1";
export const blank = () => ({ v: 1, journal: {}, casts: 0, longest: 0, derbyBest: 0, biggest: null, input: null, assist: true, quality: "auto", artStyle: "ghibli", reelSide: "right", seen: {}, caught: 0, place: "loon", places: {} });
export const blankPlace = () => ({ open: 0, d: 0, kg: 0, id: null, n: 0, lg: 0 });

const fin = (v) => typeof v === "number" && Number.isFinite(v);
const isJunk = (id) => JUNK.some((j) => j.id === id);
// a place record with only well-formed values: numbers finite and 0 or more, id a real fish, lg a whole step
const cleanPlace = (e) => ({
  open: e.open === 1 || e.open === true ? 1 : 0,
  d: fin(e.d) && e.d > 0 ? e.d : 0,
  kg: fin(e.kg) && e.kg > 0 ? e.kg : 0,
  id: typeof e.id === "string" && byId(e.id) && !isJunk(e.id) ? e.id : null,
  n: fin(e.n) ? Math.max(0, Math.floor(e.n)) : 0,
  lg: Number.isInteger(e.lg) && e.lg >= 0 && e.lg <= 3 ? e.lg : 0,
});

// raw: what storage holds for SAVE_KEY (the JSON text, or null), or a value already parsed.
// Anything broken gives a new save. The input is never changed.
export function loadSave(raw) {
  let s = raw;
  if (typeof raw === "string") { try { s = JSON.parse(raw); } catch (e) { s = null; } }
  const save = blank();
  // 1. today's loader: copy only the keys a new save has, and only with the same type
  if (s && typeof s === "object") for (const k of Object.keys(save)) if (k in s && typeof s[k] === typeof save[k]) save[k] = s[k];
  // input starts as null, so the type check above never copies it
  if (s && (s.input === "motion" || s.input === "touch")) save.input = s.input;
  if (!save.journal || typeof save.journal !== "object" || Array.isArray(save.journal)) save.journal = {};
  if (!save.seen || typeof save.seen !== "object") save.seen = {};
  if (save.input !== "motion" && save.input !== "touch") save.input = null;
  // nested values are trusted nowhere else: keep only well-formed ones
  const J = {};
  for (const [id, e] of Object.entries(save.journal)) if (byId(id) && e && typeof e === "object") J[id] = { n: fin(e.n) ? Math.max(0, Math.floor(e.n)) : 0, kg: fin(e.kg) ? e.kg : 0, cm: fin(e.cm) ? e.cm : 0 };
  save.journal = J;
  const b = save.biggest;
  save.biggest = b && typeof b === "object" && byId(b.id) && fin(b.kg) && b.kg > 0 ? { id: b.id, kg: b.kg } : null;
  for (const k of ["casts", "longest", "derbyBest", "caught"]) if (!fin(save[k]) || save[k] < 0) save[k] = 0;
  if (!["auto", "high", "low"].includes(save.quality)) save.quality = "auto";
  if (!["original", "ghibli"].includes(save.artStyle)) save.artStyle = "ghibli";
  if (save.reelSide !== "left") save.reelSide = "right";
  // a copy, so the new save shares nothing with what it was read from
  if (!Array.isArray(save.seen)) save.seen = { ...save.seen };

  // 2. the place records: known places only, each value well-formed
  const P = {}, old = save.places;
  if (old && typeof old === "object" && !Array.isArray(old)) for (const id of ORDER) { const e = old[id]; if (e && typeof e === "object" && !Array.isArray(e)) P[id] = cleanPlace(e); }
  // 3. a save from before the places: everything in it happened at Loon Lake
  if (!P.loon) P.loon = cleanPlace({ d: save.derbyBest, kg: save.biggest ? save.biggest.kg : 0, id: save.biggest && save.biggest.id, n: save.caught });
  P.loon.open = 1;
  P.loon.d = Math.max(P.loon.d, save.derbyBest);
  // 4. a legend in the journal was landed; a goal fish opens the next place (in trail order, so one load can open several)
  for (const id of ORDER) {
    const e = P[id], nx = nextPlace(id), goal = JOURNEY[id].goalKg;
    if (!e) continue;
    const j = save.journal[fishingOf(id).legend.id];
    if (j && j.n > 0) e.lg = 3;
    if (nx && goal != null && e.kg >= goal) (P[nx] ||= blankPlace()).open = 1;
  }
  // in trail order, so a load, save and load writes the same text
  save.places = {};
  for (const id of ORDER) if (P[id]) save.places[id] = P[id];
  // 5. the player stands at an open place
  if (!ORDER.includes(save.place) || !(save.places[save.place] && save.places[save.place].open)) save.place = "loon";
  return save;
}

// The record of a place that is open in the save, or null. A place opened only by the ?open test switch has none,
// so a test page never opens a place for real. Loon Lake always has one.
export function placeRec(save, id) {
  if (id === "loon" && !save.places.loon) save.places.loon = Object.assign(blankPlace(), { open: 1 });
  const e = ORDER.includes(id) ? save.places[id] : null;
  return e && e.open ? e : null;
}

// A fish or a piece of junk landed at place `at`. c: { id, kg, cm, junk }.
// It updates the journal, the fish count and the biggest fish anywhere, and this place's record: fish landed, biggest
// fish, legend step, and the next place's lock. Only fish landed at this place count toward its goal.
// Returns what the catch card needs: { junk, isNew, record: a new best for its kind, oldKg: the best before,
//   opened: the place this fish opened (or null), close: 70% to 100% of the goal, and the next place still locked }.
export function recordCatch(save, at, c) {
  const junk = !!c.junk || isJunk(c.id);
  const j = save.journal[c.id] || { n: 0, kg: 0, cm: 0 };
  const isNew = j.n === 0, oldKg = j.kg;
  const record = !junk && !isNew && c.kg > j.kg;
  j.n++;
  if (c.kg > j.kg) { j.kg = c.kg; j.cm = c.cm || 0; }
  save.journal[c.id] = j;
  let opened = null, close = false;
  if (!junk) {
    save.caught++;
    if (!save.biggest || c.kg > save.biggest.kg) save.biggest = { id: c.id, kg: c.kg };
    const e = placeRec(save, at);
    if (e) {
      e.n++;
      if (c.kg > e.kg) { e.kg = c.kg; e.id = c.id; }
      if (c.id === fishingOf(at).legend.id) e.lg = 3;
      const nx = nextPlace(at), goal = JOURNEY[at].goalKg;
      if (nx && goal != null && !isOpen(save, nx)) {
        if (c.kg >= goal) { (save.places[nx] ||= blankPlace()).open = 1; opened = nx; }
        else close = c.kg >= 0.7 * goal;
      }
    }
  }
  return { junk, isNew, record, oldKg, opened, close };
}

// The legend of place `at` moved on: 1 its gold ring showed, 2 it was hooked (3, landed, comes with recordCatch).
// A step never goes back. Returns true when it moved.
export function legendStep(save, at, step) {
  const e = placeRec(save, at);
  if (!e || !Number.isInteger(step) || step <= e.lg || step > 3) return false;
  e.lg = step;
  return true;
}

// A derby ended at place `at` with this total. Returns { best: a new best here, old: the best before }.
// At Loon Lake derbyBest moves too (the arcade cabinet reads it).
export function recordDerby(save, at, total) {
  const e = placeRec(save, at), old = e ? e.d : 0;
  const best = !!e && total > old;
  if (best) e.d = total;
  if (at === "loon" && total > save.derbyBest) save.derbyBest = total;
  return { best, old };
}
