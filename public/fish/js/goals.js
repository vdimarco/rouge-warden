// Goals: the six goals of each place, today's goal, the next thing to aim for, and the help on the way. Data and small
// pure helpers only (no DOM, no three.js), so node can test them: node qa/fish/save.test.mjs.
// journey.js holds the trail and its words; save.js keeps what the player has done (places[id].g, today, days, bestRun).
import { byId } from "./species.js";
import { fishingOf, ecology } from "./fishing.js";
import { ORDER, JOURNEY, journeyOf, prevPlace, isOpen, goalText, nextRank, foundHere } from "./journey.js";

/* ---------------- the goals of each place ---------------- */
// Six for each place, 32 characters or fewer. on: "cast" (a cast landed in the water) or "catch" (a fish landed; junk
// counts only for a goal marked junk). test(c) reads what just happened. A cast: dist (m). A catch: id, kg, hour,
// dist (the cast that hooked it), ring (it came from a rising ring), feather (that cast was stopped short), and the
// fight: turned (the kinds of cover it was turned from, "" when unknown), jumps, walk (a tail walk), unstuck (it was
// pumped up off the bottom), lastrun (it made its last run).
// The save keeps them as one number for each place: bit i is goal i (save.js recordGoal). Never reorder a list.
export const PLACE_GOALS = {
  loon: [
    { text: "Cast 40 m.", on: "cast", test: (c) => c.dist >= 40 },
    { text: "Land a fish from a rising ring.", on: "catch", test: (c) => c.ring },
    { text: "Stop a cast short. Land a fish.", on: "catch", test: (c) => c.feather },
    { text: "Land a Smallmouth that jumps.", on: "catch", test: (c) => c.id === "smallmouth" && c.jumps > 0 },
    { text: "Turn a fish away from cover.", on: "catch", test: (c) => c.turned.length > 0 },
    { text: "Find the King's Plunger.", on: "catch", junk: true, test: (c) => c.id === "plunger" },
  ],
  stumps: [
    { text: "Turn a fish from the stumps.", on: "catch", test: (c) => c.turned.includes("stumps") },
    { text: "Land a fish after dark.", on: "catch", test: (c) => c.hour >= 21 || c.hour < 5 },
    { text: "Pump a catfish off the bottom.", on: "catch", test: (c) => c.id === "catfish" && c.unstuck },
    { text: "Land a Longnose Gar that jumps.", on: "catch", test: (c) => c.id === "gar" && c.jumps > 0 },
    { text: "Land a fish after its last run.", on: "catch", test: (c) => c.lastrun },
    { text: "Land a fish from a rising ring.", on: "catch", test: (c) => c.ring },
  ],
  river: [
    { text: "Turn a fish from the logs.", on: "catch", test: (c) => c.turned.includes("logs") },
    { text: "Land a fish after a tail walk.", on: "catch", test: (c) => c.walk },
    { text: "Pump a fish off the bottom.", on: "catch", test: (c) => c.unstuck },
    { text: "Land a Brown Trout at dawn.", on: "catch", test: (c) => c.id === "browntrout" && c.hour < 8 },
    { text: "Land a 10 kg Chinook Salmon.", on: "catch", test: (c) => c.id === "chinook" && c.kg >= 10 },
    { text: "Land a fish from 40 m out.", on: "catch", test: (c) => c.dist >= 40 },
  ],
  sea: [
    { text: "Turn a fish from the wall.", on: "catch", test: (c) => c.turned.includes("wall") },
    { text: "Pump a cod off the bottom.", on: "catch", test: (c) => c.id === "cod" && c.unstuck },
    { text: "Land a Bluefish in the morning.", on: "catch", test: (c) => c.id === "bluefish" && c.hour < 11 },
    { text: "Land a Striped Bass at dusk.", on: "catch", test: (c) => c.id === "striper" && c.hour >= 18 },
    { text: "Land a fish of 10 kg or more.", on: "catch", test: (c) => c.kg >= 10 },
    { text: "Land a fish after its last run.", on: "catch", test: (c) => c.lastrun },
  ],
};
// what a catch context holds when nothing happened in the fight
const NONE = { id: "", kg: 0, hour: 12, dist: 0, ring: false, feather: false, turned: [], jumps: 0, walk: false, unstuck: false, lastrun: false };
// does ctx (kind "cast" or "catch", and the values above) meet this goal?
export function goalMet(goal, ctx) {
  if (!goal || !ctx || goal.on !== ctx.kind) return false;
  if (ctx.kind === "catch" && !ctx.junk !== !goal.junk) return false;
  return !!goal.test({ ...NONE, ...ctx });
}
// the numbers of the goals of place id that ctx meets
export const goalsMet = (id, ctx) => (PLACE_GOALS[id] || []).flatMap((g, i) => (goalMet(g, ctx) ? [i] : []));
// how many goals a place's number holds: "Goals: 3 of 6"
export function goalCount(g) {
  let n = 0;
  for (let i = 0; i < 6; i++) n += (g >> i) & 1;
  return n;
}

/* ---------------- the next thing to aim for ---------------- */
// The title and the pause card: the goal that opens the next place; then a legend not landed yet (this place's first,
// then the others in trail order) and when its gold ring shows; then this place's next goal; then the next derby rank
// here; then the fish here that are not in the journal. "" when all of that is done. all: the ?open test switch
export function nextGoal(save, id, all = false) {
  const lock = ORDER.find((p) => !isOpen(save, p, all)), from = lock && prevPlace(lock);
  if (lock) return from === id ? goalText(id, "title") : goalText(from, "next");
  const landed = (p) => { const j = save.journal[fishingOf(p).legend.id]; return !!(j && j.n > 0); };
  const leg = [id, ...ORDER.filter((p) => p !== id)].find((p) => JOURNEY[p] && !landed(p));
  if (leg) return "Next: the legend of " + JOURNEY[leg].name + ". Look for a gold ring " + JOURNEY[leg].when + ".";
  const rec = (save.places && save.places[id]) || {}, g = rec.g || 0, i = (PLACE_GOALS[id] || []).findIndex((x, k) => !((g >> k) & 1));
  if (i >= 0) return "Next goal here: " + PLACE_GOALS[id][i].text;
  const nr = nextRank(id, rec.d || 0);
  if (nr) return "Next rank here: " + nr.name + " at " + nr.kg + " kg.";
  const f = foundHere(save, id), left = f.m - f.n;
  if (left > 0) return left + (left === 1 ? " fish here is" : " fish here are") + " not in your journal.";
  return "";
}

/* ---------------- today's goal ---------------- */
// One goal for each local day, picked from the date over the goals of the open places. kind: "fish" (land n of one
// kind), "count" (land n fish), "kg" (land a fish of kg or more), "ring" (land a fish from a rising ring). Each fish named
// lives at its place and bites in the hours its clock runs (save.test checks it); journey.sim checks that a beginner can
// do each one in about 10 minutes. Never reorder this list: the save keeps the number of today's goal (today.k)
export const DAILY = [
  { at: "loon", kind: "fish", id: "perch", n: 1 },
  { at: "loon", kind: "fish", id: "smallmouth", n: 1 },
  { at: "loon", kind: "count", n: 5 },
  { at: "loon", kind: "kg", kg: 2.5, n: 1 },
  { at: "loon", kind: "ring", n: 1 },
  { at: "stumps", kind: "fish", id: "crappie", n: 1 },
  { at: "stumps", kind: "fish", id: "catfish", n: 2 },
  { at: "stumps", kind: "count", n: 5 },
  { at: "stumps", kind: "kg", kg: 4, n: 1 },
  { at: "stumps", kind: "ring", n: 1 },
  { at: "river", kind: "fish", id: "steelhead", n: 2 },
  { at: "river", kind: "fish", id: "brooktrout", n: 1 },
  { at: "river", kind: "count", n: 5 },
  { at: "river", kind: "kg", kg: 5, n: 1 },
  { at: "river", kind: "ring", n: 1 },
  { at: "sea", kind: "fish", id: "mackerel", n: 1 },
  { at: "sea", kind: "fish", id: "striper", n: 1 },
  { at: "sea", kind: "count", n: 5 },
  { at: "sea", kind: "kg", kg: 6, n: 1 },
  { at: "sea", kind: "ring", n: 1 },
];
// a day is a local date as text: "2026-10-03"
export function isDay(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === s;
}
const dayNum = (s) => { const [y, m, d] = s.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
// the day of a date, by the phone's own clock
export const dayOf = (date = new Date()) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
export const prevDay = (s) => new Date((dayNum(s) - 1) * 864e5).toISOString().slice(0, 10);
// a run of days as long as the list goes through the list in a shuffled order, so a goal never comes two days in a row
function shuffled(open, block) {
  let s = (Math.imul(block, 2654435761) + open.length * 97) >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const o = open.slice();
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
// The goal of the day (YYYY-MM-DD): the one the save holds for that day, or the day's pick from the open places.
// Returns the goal with k, its number in DAILY.
export function dailyGoal(day, save) {
  const t = save && save.today;
  if (t && t.d === day && DAILY[t.k] && isOpen(save, DAILY[t.k].at)) return { ...DAILY[t.k], k: t.k };
  const open = DAILY.map((g, k) => k).filter((k) => isOpen(save, DAILY[k].at));
  if (!isDay(day)) return { ...DAILY[open[0]], k: open[0] };
  const n = dayNum(day), L = open.length, block = Math.floor(n / L), o = shuffled(open, block);
  // the first day of a run is never the last day of the run before
  if (L >= 3 && o[0] === shuffled(open, block - 1)[L - 1]) [o[0], o[1]] = [o[1], o[0]];
  const k = o[n - block * L];
  return { ...DAILY[k], k };
}
// "land 3 Yellow Perch at Loon Lake."
export function dailyText(g) {
  const at = journeyOf(g.at).name;
  if (g.kind === "fish") { const sp = byId(g.id); return "land " + (g.n > 1 ? g.n + " " : /^[aeiou]/i.test(sp.name) ? "an " : "a ") + sp.name + " at " + at + "."; }
  if (g.kind === "count") return "land " + g.n + " fish at " + at + ".";
  if (g.kind === "kg") return "land a fish of " + g.kg + " kg or more at " + at + ".";
  return "land a fish from a rising ring at " + at + ".";
}
// does this catch (goalMet's context, with at: the place) count toward the goal? Junk never does
export function dayHit(g, c) {
  if (!g || !c || c.junk || c.at !== g.at) return false;
  if (g.kind === "fish") return c.id === g.id;
  if (g.kind === "kg") return c.kg >= g.kg;
  if (g.kind === "ring") return !!c.ring;
  return true;
}
// the toast when the goal is done: "Today's goal is done. 2 days in a row."
export const dayDoneText = (run) => "Today's goal is done." + (run >= 2 ? " " + run + " days in a row." : "");
// the title line: "Today: land 3 Yellow Perch at Loon Lake. 1 of 3."
export function todayLine(save, day) {
  const g = dailyGoal(day, save), t = save.today, mine = !!t && t.d === day && t.k === g.k;
  if (mine && t.done) return dayDoneText(save.days.last === day ? save.days.run : 0);
  return "Today: " + dailyText(g) + (g.n > 1 ? " " + (mine ? t.n : 0) + " of " + g.n + "." : "");
}

/* ---------------- help on the way ---------------- */
// Three sweet casts in a row in free fishing light up the report (text), and the next cast in the water gets this much
// more weight boost (LakeSim opts.boost, see rollWeight in fish.js)
export const STREAK = { n: 3, boost: 0.4, text: "Three sweet casts! A big fish is near." };
// The help for a short caster: after `casts` casts in the water here in free fishing while the goal that opens the next
// place is not met, the next ring that rises within `reach` m carries a feeding big fish (a sure bite, with this boost).
// That ring stays up at least `ttl` s. The help goes on, one big ring at a time, until a big ring's fish is landed
export const ASSIST = { casts: 20, reach: 25, boost: 1, ttl: 90 };
// a cast shorter than this, while that goal is open, is a short cast
export const SHORT_M = 22;
// the fish of the big ring: the most common kind here whose usual range goes past the goal (null at the last place)
export function assistFish(id) {
  const goal = journeyOf(id).goalKg;
  if (goal == null) return null;
  const big = ecology(id).filter(([s]) => s.kg[1] > goal).sort((a, b) => b[1].rarity - a[1].rarity);
  return big.length ? big[0][0].id : null;
}
// The line this file adds under a cast's verdict, or "". streak: sweet casts in a row (free fishing); dist: m;
// goalOpen: the goal that opens the next place is not met; castN: the short casts so far while it is open, this one too.
// The hint comes on the first short cast and on every fifth one after it
export function progressNote({ streak = 0, dist = 0, goalOpen = false, castN = 0 } = {}) {
  if (streak >= STREAK.n && streak % STREAK.n === 0) return STREAK.text;
  if (goalOpen && dist < SHORT_M && castN % 5 === 1) return "Big fish live far out.";
  return "";
}
