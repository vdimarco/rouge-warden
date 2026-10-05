// The trail of places: the order they open in, the goal that opens the next one, the clock, the derby ranks, and the
// words for each place. Data and small pure helpers only (no DOM, no three.js), so node can test it.
// places.js holds the maps, fishing.js the fish and gear of each place, goals.js the goals, save.js what the player has done.
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
import { getPlace } from "./places.js";

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
    tip: "The current runs left, toward the logjam. Cast to the right.",
    hints: ["People say an old salmon with a hooked jaw holds in the deep pool.", null, "It runs down the river. Let it go, then pump it back."] },
  sea: { name: "Gull Rock", short: "Sea", level: "Very hard", goalKg: null, bigKg: 10,
    clock: { free: 5.5, derby: 18, end: 21, wrap: 5 }, when: "at dawn or dusk", kick: "GULL ROCK", newDay: "A new day at Gull Rock.",
    ranks: [[0, "SKUNKED"], [0.01, "SEA ROOKIE"], [8, "ROCK HOPPER"], [20, "TIDE READER"], [36, "SEA PRO"], [55, "GULL ROCK CHAMPION"]],
    blurb: "The open sea, from the end of a stone wall. Big fish, long runs, rocks at your feet.", gear: "A sea rod and 30 lb line.",
    tip: "Some fish dive for the rocks at your feet. Hold the rod up. A giant tuna can empty your spool.",
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
// the next rank above a derby total here: { name, kg }, or null at the top rank. The rank for any fish at all is never
// the next one, so a skunked derby points at the first real rank: "Next rank: WEEKEND ANGLER at 4 kg."
export function nextRank(id, kg) {
  for (const [k, name] of journeyOf(id).ranks.slice(2)) if (kg < k) return { name, kg: k };
  return null;
}
// The goal of this place, in words. "" at the last place, which opens nothing.
// kind: "title" (the start screen), "remind" (the toast at mode start and the pause summary), "close" (a fish of 70% to
// 100% of the goal), "card" (the locked card of the next place), "next" (the start screen, when the goal is at another
// place than the one you are at).
export function goalText(id, kind = "title") {
  const J = journeyOf(id), nx = nextPlace(id);
  if (J.goalKg == null || !nx) return "";
  const kg = J.goalKg + " kg", to = JOURNEY[nx].name;
  if (kind === "remind") return "Goal: land a fish of " + kg + " or more. It opens " + to + ".";
  if (kind === "close") return "Close! Land a fish of " + kg + " or more to open " + to + ".";
  if (kind === "card") return "To open: land a fish of " + kg + " or more at " + J.name + ".";
  if (kind === "next") return "Next: land " + kg + " or more at " + J.name + " to open " + to + ".";
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
// Where and when a fish bites at place pid, from that place's own table: "Try the rocky point at dusk." The time comes
// from its best hours, cut to the hours the place's clock runs (Stump Bay only runs 19:00 to 24:00): a window that starts
// at 20:30 or later is night; else by its middle, before 11:00 morning, from 16:30 dusk, and midday between.
// "" for a fish that does not live there
export function zoneHint(sp, pid) {
  const eco = ecology(pid).find(([s]) => s.id === (sp && sp.id)), E = eco && eco[1];
  if (!E) return "";
  const z = Object.entries(E.zones || {}).sort((a, b) => b[1] - a[1])[0];
  const c = journeyOf(pid).clock, lo = Math.min(c.free, c.derby, c.wrap);
  const best = (E.hours || []).filter((h) => h[1] > lo && h[0] < c.end).reduce((a, h) => (h[2] > (a ? a[2] : 1) ? h : a), null);
  const a = best ? Math.max(best[0], lo) : 0, mid = best ? (a + Math.min(best[1], c.end)) / 2 : 0;
  const when = !best ? "" : a >= 20.5 ? " at night" : mid < 11 ? " in the morning" : mid >= 16.5 ? " at dusk" : " at midday";
  return z ? "Try " + (getPlace(pid).zoneNames[z[0]] || z[0]).toLowerCase() + when + "." : "";
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

/* ---------------- the loss lines ---------------- */
// what went wrong, and the one move that would have saved the fish: [headline, tip]. reason: the sim's state.reason.
// o: input ("motion" | "touch" | "mouse" | "keys"), by (how it threw the hook: "jump" | "thrash" | "shake" | "charge" | "slack"),
//   cause (why the line snapped: fish.js state.cause), hook (the hook-set words, guide.js MOVE_WORDS: "Snap it up!"),
//   turn (the steer words of the input, guide.js MOVE_WORDS: "Hold A or D."),
//   legend (the place id when the fish was the place's legend: it gets its own line, and when to look for it again)
const SNAP_TIP = { grind: "Stop reeling when the drag slips.", rodlow: "Keep the rod up. It bends and saves the line.",
  drag: "Set the drag lighter with the − button.", shake: "Hold the rod up when it shakes its head." };
const THROWN = { jump: ["It threw the hook.", "Lower the rod as soon as it jumps."], thrash: ["It shook the hook out.", "Hold the rod up when it shakes its head."],
  shake: ["It shook the hook out.", "Keep reeling slowly when it shakes its head."], charge: ["It threw the hook.", "Reel fast when it swims at you."] };
export function lossText(reason, o = {}) {
  const steer = o.input === "motion" ? "Tilt the phone left or right to steer it away." : String(o.turn || "Drag the rod sideways.").replace(/\.$/, "") + " to steer it.";
  const hook = String(o.hook || "Swipe it up!").replace(/!$/, "");
  const line = ({
    snap: ["SNAP! The line broke.", SNAP_TIP[o.cause] || SNAP_TIP.grind],
    thrown: THROWN[o.by] || ["It threw the hook.", "Keep the line tight."],
    spat: ["It spat the lure.", hook + " as soon as it strikes."],
    spooked: ["You spooked it.", "Wait for the strike."],
    weeds: ["It wrapped the line in the weeds.", steer],
    stump: ["The line broke on a stump.", "Steer the fish away from the stumps."],
    logs: ["The line broke on the logs.", "Keep the fish away from the logjam."],
    rocks: ["The line broke on the rocks.", "Hold the rod up near the rocks, and steer away."],
    spooled: ["It took all your line.", "Tighten the drag on a long run."],
  })[reason] || ["It got away.", ""];
  if (!o.legend || !JOURNEY[o.legend]) return line;
  // a lost legend: its name, the move, and when its gold ring comes back
  const sp = SPECIES.find((s) => s.id === fishingOf(o.legend).legend.id), art = sp.article ? sp.article[0].toUpperCase() + sp.article.slice(1) + " " : "";
  return [art + sp.name + " got away.", (line[1] ? line[1] + " " : "") + "Look for its gold ring again " + JOURNEY[o.legend].when + "."];
}

