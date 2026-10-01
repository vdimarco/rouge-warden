// The trail of places: the order they open in, the goal that opens the next one, the clock, the derby ranks, and the
// words for each place. Data and small pure helpers only (no DOM, no three.js), so node can test it.
// places.js holds the maps, fishing.js the fish and gear of each place, save.js what the player has done.
//
// name: the place's name. short: its journal chip (10 characters or fewer). level: how hard it is.
// goalKg: land one fish this heavy here to open the next place (null at the last place).
// bigKg: a fish this heavy gets "Big fish on!" in the fight.
// clock: the hour free fishing and the derby start, the hour the day ends, and the hour the clock wraps to.
// when: when the legend's gold ring shows, for the journal hint. kick: the title kicker. newDay: the toast when the
//   clock wraps.
// ranks: [kg, name] derby ranks, lowest first. The thresholds are 0.01 / 0.33 / 0.82 / 1.5 / 2.3 × a good player's
//   median derby here (Loon Lake 11.4, Stump Bay 16.8, Cedar River 20.9, Gull Rock 24.1 kg). journey.sim pins them.
// blurb, gear, tip: the places card and the arrival card (tip "" = no tip).
// hints: the journal's legend row for steps 0 to 2: a rumor, null (step 1 is built from the ring in fishing.js),
//   and a fight tip.
import { SPECIES, JUNK } from "./species.js";
import { fishingOf, ecology, placeSpecies } from "./fishing.js";

// the trail order: each place opens the next one
export const ORDER = ["loon", "stumps", "river", "sea"];
export const JOURNEY = {
  loon: { name: "Loon Lake", short: "Loon", level: "Easy", goalKg: 3.5, bigKg: 3.5,
    clock: { free: 6.2, derby: 18.3, end: 21, wrap: 5 }, when: "at dawn or dusk", kick: "LOON LAKE", newDay: "A new day on Loon Lake.",
    ranks: [[0, "SKUNKED"], [0.01, "DOCK ROOKIE"], [4, "WEEKEND ANGLER"], [9, "COTTAGE REGULAR"], [17, "LAKE PRO"], [26, "LOON LAKE CHAMPION"]],
    blurb: "A calm lake at the cottage. Good for learning.", gear: "A light rod and 10 lb line.", tip: "",
    hints: ["People say a gold bass lives in Loon Lake.", null, "It jumps a lot. Lower the rod when it jumps."] },
  stumps: { name: "Stump Bay", short: "Stumps", level: "Medium", goalKg: 6, bigKg: 6,
    clock: { free: 19, derby: 20, end: 24, wrap: 19 }, when: "late at night", kick: "STUMP BAY", newDay: "A new night on Stump Bay.",
    ranks: [[0, "SKUNKED"], [0.01, "STUMP ROOKIE"], [5.5, "SWAMP WADER"], [14, "SNAG DODGER"], [25, "CATFISH PRO"], [38, "STUMP BAY CHAMPION"]],
    blurb: "Dead trees stand in the water. Steer your fish around them. Catfish bite at night.", gear: "A heavy rod and 20 lb braid.",
    tip: "Fish run for the stumps. Steer them out.",
    hints: ["People say a giant catfish lives in the old creek bed.", null, "It pulls for the stumps. Steer it out. Do not rush it."] },
  river: { name: "Cedar River", short: "River", level: "Hard", goalKg: 8, bigKg: 8,
    clock: { free: 5.2, derby: 6, end: 21, wrap: 5 }, when: "at dawn", kick: "CEDAR RIVER", newDay: "A new day on Cedar River.",
    ranks: [[0, "SKUNKED"], [0.01, "RIVER ROOKIE"], [7, "BANK WALKER"], [17, "POOL READER"], [31, "RIVER PRO"], [48, "CEDAR RIVER CHAMPION"]],
    blurb: "Fast water. The current takes your lure. Salmon run down the river.", gear: "A long rod and 20 lb line.",
    tip: "The current swings your lure. Fish take it at the end of the swing.",
    hints: ["People say an old salmon with a hooked jaw holds in the deep pool.", null, "It runs down the river. Let it go, then pump it back."] },
  sea: { name: "Gull Rock", short: "Sea", level: "Very hard", goalKg: null, bigKg: 10,
    clock: { free: 5.5, derby: 18, end: 21, wrap: 5 }, when: "at dawn or dusk", kick: "GULL ROCK", newDay: "A new day at Gull Rock.",
    ranks: [[0, "SKUNKED"], [0.01, "SEA ROOKIE"], [8, "ROCK HOPPER"], [20, "TIDE READER"], [36, "SEA PRO"], [55, "GULL ROCK CHAMPION"]],
    blurb: "The open sea, from the end of a stone wall. Big fish, long runs, rocks at your feet.", gear: "A sea rod and 30 lb line.",
    tip: "Sea fish run far. When the spool is almost empty, tighten the drag.",
    hints: ["People talk of a tuna as big as a man, far out past the rock.", null, "It runs a long way. Do not let the spool go empty."] },
};
// an unknown id (an old or broken save) gives Loon Lake
export const journeyOf = (id) => JOURNEY[id] || JOURNEY.loon;
export const nextPlace = (id) => { const i = ORDER.indexOf(id); return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null; };
export const prevPlace = (id) => { const i = ORDER.indexOf(id); return i > 0 ? ORDER[i - 1] : null; };
// Loon Lake is always open; the others once the save says so. all: the ?open test switch (never saved)
export const isOpen = (save, id, all = false) => id === "loon" || (ORDER.includes(id) && (all || !!(save && save.places && save.places[id] && save.places[id].open)));

// the same weight text as the rest of the game: 0.41 kg, 3.6 kg
export const fmtKg = (kg) => (kg < 1 ? kg.toFixed(2) : kg.toFixed(1)) + " kg";

/* ---------------- the clock ---------------- */
// seconds of play per hour of the day
export const HOUR_S = { free: 75, derby: 400 };
export const startHour = (id, mode) => { const c = journeyOf(id).clock; return mode === "derby" ? c.derby : c.free; };
// the clock dt seconds later. At the end of the day it wraps (wrapped: show the newDay toast)
export function stepHour(id, hour, dt, mode) {
  const c = journeyOf(id).clock, h = hour + dt / (mode === "derby" ? HOUR_S.derby : HOUR_S.free);
  return h >= c.end ? { hour: c.wrap, wrapped: true } : { hour: h, wrapped: false };
}

/* ---------------- the derby and the goal ---------------- */
// the rank a derby total earns here
export function rankFor(id, kg) {
  const R = journeyOf(id).ranks;
  let rank = R[0][1];
  for (const [k, name] of R) if (kg >= k) rank = name;
  return rank;
}
// The goal of this place, in words. "" at the last place, which opens nothing.
// kind: "title" (the start screen), "remind" (the toast at mode start and the pause summary), "close" (a fish of 70% to
// 100% of the goal), "card" (the locked card of the next place).
export function goalText(id, kind = "title") {
  const J = journeyOf(id), nx = nextPlace(id);
  if (J.goalKg == null || !nx) return "";
  const kg = J.goalKg + " kg", to = JOURNEY[nx].name;
  if (kind === "remind") return "Goal: land a fish of " + kg + " or more. It opens " + to + ".";
  if (kind === "close") return "Close! Land a fish of " + kg + " or more to open " + to + ".";
  if (kind === "card") return "To open: land a fish of " + kg + " or more at " + J.name + ".";
  return "Land a fish of " + kg + " or more here to open " + to + ".";
}
// the fish that opened place id. kind: "toast" (an old save, on the first load) or "results" (the derby results card)
export function openedText(id, kg, name, kind = "toast") {
  const to = journeyOf(id).name;
  return "Your " + fmtKg(kg) + " " + name + (kind === "results" ? " opened " + to + "." : " opened a new place: " + to + ".");
}
// "Big fish on!": heavy for this place, or big for its kind (rank: sizeRank from fish.js)
export const isBigFish = (id, kg, rank) => kg >= journeyOf(id).bigKg || rank >= 0.9;

/* ---------------- the legend ---------------- */
// the step words on the places card: "Legend: seen"
export const LEGEND_STEPS = ["not seen", "seen", "hooked once", "landed"];
// the journal's legend row for steps 0 to 2. Step 3 (landed) shows the record instead, so it gives null
export function legendHint(id, step) {
  const J = journeyOf(id), ring = fishingOf(id).legend.ring;
  if (step <= 0) return J.hints[0];
  if (step === 1) return "Look for a gold ring " + J.when + ", " + ring[0] + " to " + ring[1] + " m out. Cast right into it.";
  if (step === 2) return J.hints[2];
  return null;
}
// how many of the four legends are in the journal
export const legendsLanded = (save) => ORDER.filter((id) => { const j = save.journal[fishingOf(id).legend.id]; return !!(j && j.n > 0); }).length;

/* ---------------- the places card and the journal ---------------- */
// the place's biggest kind of fish (the top of its usual range, the legend left out): "Top fish: Channel Catfish"
export const topFish = (id) => ecology(id).map(([s]) => s).reduce((a, s) => (s.kg[1] > a.kg[1] ? s : a));
// how many of the place's fish, legend and junk are in the journal: "3 of 8 found"
export function foundHere(save, id) {
  const ids = placeSpecies(id);
  return { n: ids.filter((s) => save.journal[s] && save.journal[s].n > 0).length, m: ids.length };
}
// the same for every fish and junk in the game: "11 of 29 in all"
export function foundAll(save) {
  const all = [...SPECIES, ...JUNK];
  return { n: all.filter((s) => save.journal[s.id] && save.journal[s.id].n > 0).length, m: all.length };
}
// open places the player has not been to yet (the NEW badge on Places). The ?open switch does not count
export const newPlaces = (save) => ORDER.filter((id) => id !== "loon" && isOpen(save, id) && !save.seen["at." + id]);
// open places whose unlock the player has not been told about yet (an old save, on the first load)
export const untoldOpens = (save) => ORDER.filter((id) => id !== "loon" && isOpen(save, id) && !save.seen["opened." + id]);

/* ---------------- the catch card ---------------- */
// the line under the weight, from sizeRank (fish.js). A rank of 0.95 or more also gets the TROPHY badge
export const TROPHY_RANK = 0.95;
const SIZE_LINES = [[0.99, "Bigger than 99 in 100 of its kind."], [0.95, "Bigger than 19 in 20 of its kind."], [0.9, "Bigger than 9 in 10 of its kind."], [0.75, "Bigger than 3 in 4 of its kind."]];
export function sizeLine(rank) {
  for (const [r, t] of SIZE_LINES) if (rank >= r) return t;
  return "";
}
// the toast when the fish first shows: "It is an Atlantic Cod!", "It is a huge Walleye!", "It is the Golden Loon Bass!"
export function revealText(sp, big = false) {
  if (sp.legend) return "It is " + (sp.article ? sp.article + " " : "") + sp.name + "!";
  if (big) return "It is a huge " + sp.name + "!";
  return "It is " + (/^[aeiou]/i.test(sp.name) ? "an " : "a ") + sp.name + "!";
}
