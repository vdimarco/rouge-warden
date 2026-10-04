// The save file (localStorage key fish.v1). Pure functions (no DOM, no storage), so node can test them:
// node qa/fish/save.test.mjs. main.js reads the text from storage, gives it to loadSave, and writes JSON.stringify(save).
//
// A save: journal { id: { n, kg, cm } }, casts, longest, derbyBest, biggest { id, kg } or null, input, assist, quality, artStyle, reelSide,
//   seen { flag: 1 }, caught, and for the places: place (where the player is) and places { id: record }.
//   The goals (goals.js): today { d: the day "YYYY-MM-DD" or "", k: today's goal (its number in DAILY), n: how far it got,
//   done: 0|1 }, days { n: days whose goal was done, run: days in a row, best: the longest run, last: the last day done
//   or "" }, and bestRun: the most sweet casts in a row.
// A place record: { open: 0|1, d: best derby kg here, kg: biggest fish here, id: its species or null,
//   n: fish landed here, lg: the legend step 0..3 (0 not seen, 1 its gold ring seen, 2 hooked, 3 landed),
//   g: its goals done, bit i for goal i of PLACE_GOALS (0..63) }.
// derbyBest stays the Loon Lake best (the arcade cabinet reads it). biggest is the biggest fish anywhere. The journal
// stays keyed by species id, so a fish that lives at two places has one record.
// One-time flags live in seen: "at.<id>" (the arrival card), "opened.<id>" (the unlock toast), "river.swing", "ring.tip".
// The cutscenes seen live in cuts { id: 1 } (cutscenes.js plays them, CUTS lists the ids). A save from before them gets the
//   ones its progress has passed, so a long-time player is not stopped for them.
import { JUNK, byId } from "./species.js";
import { fishingOf } from "./fishing.js";
import { ORDER, JOURNEY, nextPlace, isOpen } from "./journey.js";
import { DAILY, isDay, prevDay } from "./goals.js";

export const SAVE_KEY = "fish.v1";
const blankToday = () => ({ d: "", k: 0, n: 0, done: 0 });
const blankDays = () => ({ n: 0, run: 0, best: 0, last: "" });
export const blank = () => ({ v: 1, journal: {}, casts: 0, longest: 0, derbyBest: 0, biggest: null, input: null, assist: true, quality: "auto", artStyle: "painted", reelSide: "right", seen: {}, caught: 0, place: "loon", places: {}, today: blankToday(), days: blankDays(), bestRun: 0 });
export const blankPlace = () => ({ open: 0, d: 0, kg: 0, id: null, n: 0, lg: 0, g: 0 });

const fin = (v) => typeof v === "number" && Number.isFinite(v);
// a count: a whole number from 0, at most a million (more is a broken save, not a player)
const whole = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(v, 1e6) : 0);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isJunk = (id) => JUNK.some((j) => j.id === id);
// a place record with only well-formed values: numbers finite and 0 or more, id a real fish, lg a whole step,
// g a whole number from 0 to 63 (six goals)
const cleanPlace = (e) => ({
  open: e.open === 1 || e.open === true ? 1 : 0,
  d: fin(e.d) && e.d > 0 ? e.d : 0,
  kg: fin(e.kg) && e.kg > 0 ? e.kg : 0,
  id: typeof e.id === "string" && byId(e.id) && !isJunk(e.id) ? e.id : null,
  n: fin(e.n) ? Math.max(0, Math.floor(e.n)) : 0,
  lg: Number.isInteger(e.lg) && e.lg >= 0 && e.lg <= 3 ? e.lg : 0,
  g: Number.isInteger(e.g) && e.g >= 0 && e.g <= 63 ? e.g : 0,
});
// Today's goal: a real day and a goal of the list at a place open in the save, or none. Its progress is no more than the
// goal: all of it when done, short of it when not
function cleanToday(t, save) {
  const g = isObj(t) && isDay(t.d) && Number.isInteger(t.k) ? DAILY[t.k] : null;
  if (!g || !isOpen(save, g.at)) return blankToday();
  const done = t.done === 1 || t.done === true ? 1 : 0;
  return { d: t.d, k: t.k, n: done ? g.n : Math.min(whole(t.n), g.n - 1), done };
}
// the run of days: whole counts, the best run at least the run, the days done at least the best run, the last day a
// real day or ""
function cleanDays(d) {
  if (!isObj(d)) return blankDays();
  const run = whole(d.run), best = Math.max(whole(d.best), run);
  return { n: Math.max(whole(d.n), best), run, best, last: isDay(d.last) ? d.last : "" };
}

// The cutscenes, once each: "open" (the opening at Loon Lake, which is its arrival), "arrive.<id>" (the fly-in at a new
// place), "reveal.<id>" (the first gold ring of its legend), "landed.<id>" (its legend landed), "finale" (all four landed)
export const CUTS = ["open", ...ORDER.slice(1).map((id) => "arrive." + id), ...ORDER.map((id) => "reveal." + id), ...ORDER.map((id) => "landed." + id), "finale"];
// The cutscenes seen: the known ids set to 1. A save with no cuts object (from before the cutscenes, or broken there) gets
// the ones its progress has passed: the opening once it has cast, the arrival of each place open, the reveal of each legend
// whose gold ring it saw, each legend landed, and the finale with all four
function cleanCuts(c, save) {
  let seen = c;
  if (!isObj(c)) {
    seen = {};
    if (save.casts > 0 || save.caught > 0) seen.open = 1;
    let all = true;
    for (const id of ORDER) {
      const e = save.places[id], j = save.journal[fishingOf(id).legend.id], landed = !!(j && j.n > 0);
      if (id !== "loon" && e && e.open) seen["arrive." + id] = 1;
      if (landed || (e && e.lg >= 1)) seen["reveal." + id] = 1;
      if (landed) seen["landed." + id] = 1; else all = false;
    }
    if (all) seen.finale = 1;
  }
  // in the order of CUTS, so a load, save and load writes the same text
  const out = {};
  for (const k of CUTS) if (seen[k] === 1 || seen[k] === true) out[k] = 1;
  return out;
}

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
  // the painted style (the default) is any value but "original": an old save keeps its look under the style's old name
  if (save.artStyle !== "original") save.artStyle = "painted";
  if (save.reelSide !== "left") save.reelSide = "right";
  // a copy, so the new save shares nothing with what it was read from (an array of flags is no flags)
  save.seen = Array.isArray(save.seen) ? {} : { ...save.seen };
  save.days = cleanDays(save.days);
  save.bestRun = whole(save.bestRun);

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
  // 6. today's goal, once the places are known
  save.today = cleanToday(save.today, save);
  // 7. the cutscenes seen, once the progress is known
  save.cuts = cleanCuts(s && typeof s === "object" ? s.cuts : null, save);
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

// Goal i of place `at` (PLACE_GOALS in goals.js) is done. Only at a place open in the save (not by ?open).
// Returns true when it was not done before.
export function recordGoal(save, at, i) {
  const e = placeRec(save, at);
  if (!e || !Number.isInteger(i) || i < 0 || i > 5 || ((e.g || 0) >> i) & 1) return false;
  e.g = (e.g || 0) | (1 << i);
  return true;
}

// A fish landed on `day` ("YYYY-MM-DD"): today's goal moves on. goal: dailyGoal(day, save) (goals.js), taken before the
// catch, so a place this fish opens does not change the goal of the day. hit: the fish counts toward it (dayHit).
// A new day starts its goal from 0 (so does a save that holds another goal for the day). A goal done adds a day to the
// run when yesterday's goal was done too, and starts the run again at 1 when it was not: a missed day ends the run and
// takes nothing else.
// Returns { first: the first fish of the day, done: this fish did the goal, run: days in a row }
export function recordDay(save, day, goal, hit) {
  const first = save.today.d !== day;
  if (first || save.today.k !== goal.k) save.today = { d: day, k: goal.k, n: 0, done: 0 };
  const t = save.today, D = save.days;
  let done = false;
  if (hit && !t.done) {
    t.n++;
    if (t.n >= goal.n) {
      t.done = 1; done = true;
      D.n++;
      D.run = D.last === prevDay(day) ? D.run + 1 : 1;
      D.best = Math.max(D.best, D.run);
      D.last = day;
    }
  }
  return { first, done, run: D.run };
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
