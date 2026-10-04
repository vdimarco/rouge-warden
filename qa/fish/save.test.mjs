// Checks the save file and the trail of places in node: node qa/fish/save.test.mjs
// 1. loadSave reads every save today's loader (main.js before the places) could read, and gives the same values.
// 2. An old save moves to the places: Loon Lake gets its record, and a big enough fish opens Stump Bay.
// 3. Broken place values are dropped, and a load, save and load gives the same text.
// 4. A catch and a derby end update the place records, the legend steps and the locks.
// 5. journey.js: the place data is whole, and its helpers give the right words.
// 6. The goals (goals.js): the new save fields and their fuzz, the six goals of each place and their bit in the save,
//    today's goal over 60 days and the run of days, the next goal and the next rank, the hints, the help on the way.
// Exit code 1 on failure.
import { isDeepStrictEqual } from "node:util";
import { SAVE_KEY, blank, blankPlace, loadSave, placeRec, recordCatch, recordGoal, recordDay, legendStep, recordDerby } from "../../public/fish/js/save.js";
import { ORDER, JOURNEY, nextPlace, prevPlace, isOpen, rankFor, nextRank, goalText, openedText, legendHint, legendsLanded, topFish, foundHere, foundAll, zoneHint,
  newPlaces, untoldOpens, startHour, stepHour, isBigFish, sizeLine, revealText } from "../../public/fish/js/journey.js";
import { PLACE_GOALS, goalMet, goalsMet, goalCount, nextGoal, DAILY, isDay, prevDay, dayOf, dailyGoal, dailyText, dayHit, dayDoneText, todayLine,
  STREAK, ASSIST, SHORT_M, assistFish, progressNote } from "../../public/fish/js/goals.js";
import { SPECIES, JUNK, byId } from "../../public/fish/js/species.js";
import { fishingOf, ecology } from "../../public/fish/js/fishing.js";
import { PLACES, PLACE_IDS, rng } from "../../public/fish/js/places.js";
import { normalizeStyle } from "../../public/fish/js/art-style.js";

/* ---------------- reporting ---------------- */
const fails = [];
let passes = 0;
function check(ok, msg) {
  if (ok) passes++;
  else fails.push(msg);
  console.log((ok ? "  ok   " : "  FAIL ") + msg);
}
function section(name) { console.log("\n" + name); }
const same = isDeepStrictEqual;
const without = (s, ...keys) => { const o = { ...s }; for (const k of keys) delete o[k]; return o; };
const text = (s) => JSON.stringify(s);
// the keys a save got after today's loader: the places, the art style, the reel side, and the goals
const LATER = ["place", "places", "artStyle", "reelSide", "today", "days", "bestRun"];

/* ---------------- today's loader, as main.js had it before the places (bdf042b, lines 25-48) ---------------- */
// the reference: loadSave must give the same values for every key it had
function todayRead(v) { try { return v == null ? null : JSON.parse(v); } catch (e) { return null; } }
function todayLoad(s) {
  const blank = () => ({ v: 1, journal: {}, casts: 0, longest: 0, derbyBest: 0, biggest: null, input: null, assist: true, quality: "auto", seen: {}, caught: 0 });
  const save = blank();
  if (s && typeof s === "object") for (const k of Object.keys(save)) if (k in s && typeof s[k] === typeof save[k]) save[k] = s[k];
  if (s && (s.input === "motion" || s.input === "touch")) save.input = s.input;
  if (!save.journal || typeof save.journal !== "object" || Array.isArray(save.journal)) save.journal = {};
  if (!save.seen || typeof save.seen !== "object") save.seen = {};
  if (save.input !== "motion" && save.input !== "touch") save.input = null;
  const fin = (v) => typeof v === "number" && Number.isFinite(v);
  const J = {};
  for (const [id, e] of Object.entries(save.journal)) if (byId(id) && e && typeof e === "object") J[id] = { n: fin(e.n) ? Math.max(0, Math.floor(e.n)) : 0, kg: fin(e.kg) ? e.kg : 0, cm: fin(e.cm) ? e.cm : 0 };
  save.journal = J;
  const b = save.biggest;
  save.biggest = b && typeof b === "object" && byId(b.id) && fin(b.kg) && b.kg > 0 ? { id: b.id, kg: b.kg } : null;
  for (const k of ["casts", "longest", "derbyBest", "caught"]) if (!fin(save[k]) || save[k] < 0) save[k] = 0;
  if (!["auto", "high", "low"].includes(save.quality)) save.quality = "auto";
  return save;
}
// loadSave's result is well-formed for the places part
function placesOk(s) {
  if (!s.places || typeof s.places !== "object" || Array.isArray(s.places)) return false;
  for (const [id, e] of Object.entries(s.places)) {
    if (!ORDER.includes(id)) return false;
    if (!same(Object.keys(e).sort(), Object.keys(blankPlace()).sort())) return false;
    if (e.open !== 0 && e.open !== 1) return false;
    for (const k of ["d", "kg", "n"]) if (!(Number.isFinite(e[k]) && e[k] >= 0)) return false;
    if (!Number.isInteger(e.n) || !Number.isInteger(e.lg) || e.lg < 0 || e.lg > 3) return false;
    if (e.id !== null && !(byId(e.id) && !JUNK.some((j) => j.id === e.id))) return false;
  }
  return s.places.loon && s.places.loon.open === 1 && ORDER.includes(s.place) && s.places[s.place] && s.places[s.place].open === 1;
}

/* ---------------- art style preferences ---------------- */
section("Art style preferences");
check(loadSave(null).artStyle === "painted", "new saves default to Painted");
check(loadSave({ casts: 12 }).artStyle === "painted", "old saves without a style default to Painted");
check(loadSave(text(loadSave({ artStyle: "original" }))).artStyle === "original", "an explicit Original choice survives reload");
const styled = loadSave({ artStyle: "painted", casts: 12, journal: { perch: { n: 2, kg: 0.4, cm: 25 } } });
check(loadSave(text(styled)).artStyle === "painted", "Painted survives a save and reload");
check(styled.casts === 12 && styled.journal.perch.n === 2, "the art preference keeps fishing progress");
check(loadSave({ artStyle: "unknown" }).artStyle === "painted", "an unknown art style falls back to Painted");
// the style's old name: an old save keeps the painted look, and the next save writes the new name
const old = loadSave(JSON.stringify({ v: 1, artStyle: "ghibli", casts: 40, caught: 3, journal: { perch: { n: 3, kg: 0.5, cm: 28 } } }));
check(old.artStyle === "painted" && old.casts === 40 && old.caught === 3 && old.journal.perch.n === 3, "a save with the old style name \"ghibli\" loads as Painted and keeps its progress");
check(!/ghibli/i.test(text(old)) && loadSave(text(old)).artStyle === "painted", "and its next save has no \"ghibli\" in it");
check(normalizeStyle("ghibli") === "painted" && normalizeStyle("painted") === "painted" && normalizeStyle("original") === "original" && normalizeStyle(undefined) === "painted", "normalizeStyle maps the old name to Painted and keeps Original");

// today's loader kept seen: [] as an array (flags set on it were lost at the next save); loadSave reads it as no flags
const seenFix = (s) => (Array.isArray(s.seen) ? { ...s, seen: {} } : s);

/* ---------------- 1. today's saves ---------------- */
section("1. today's saves load as before");
{
  check(SAVE_KEY === "fish.v1", "the save key stays fish.v1");
  const b = blank();
  check(same(without(b, ...LATER), todayLoad(null)) && b.place === "loon" && same(b.places, {}) && same(b.today, { d: "", k: 0, n: 0, done: 0 }) && same(b.days, { n: 0, run: 0, best: 0, last: "" }) && b.bestRun === 0,
    "blank() is today's new save plus art style, reel side, places, and the goals (no day yet, no run, no sweet run)");
  const fresh = loadSave(null);
  check(same(without(fresh, "places"), without(blank(), "places")) && same(fresh.places, { loon: { open: 1, d: 0, kg: 0, id: null, n: 0, lg: 0, g: 0 } }),
    "no save: a new save at Loon Lake, with only Loon Lake open");
  // the corrupt saves today's loader was built for (text as storage holds it, or a value already parsed)
  const CASES = [
    ["null", null], ["undefined", undefined], ["{}", "{}"], ["corrupt JSON", "{\"casts\": 12, \"journal\": {"], ["empty text", ""],
    ["the text null", "null"], ["an array", "[1,2]"], ["a string", "\"walleye\""], ["a number", "42"],
    ["a string biggest.kg", { biggest: { id: "walleye", kg: "3.6" } }], ["a numeric journal entry", { journal: { perch: 5, walleye: { n: 2, kg: 1.4, cm: 50 } } }],
    ["a journal array", { journal: [{ n: 1 }] }], ["a null journal", { journal: null }], ["a journal of junk", { journal: { shark: { n: 3 }, perch: { n: "2", kg: NaN, cm: -Infinity }, boot: { n: 2.7 } } }],
    ["broken counts", { casts: -3, longest: NaN, derbyBest: Infinity, caught: "9" }], ["input motion", { input: "motion" }], ["input 5", { input: 5 }],
    ["an unknown quality", { quality: "ultra" }], ["an unknown biggest", { biggest: { id: "shark", kg: 3 } }], ["a zero biggest", { biggest: { id: "walleye", kg: 0 } }],
    ["a string biggest", { biggest: "walleye" }], ["a null seen", { seen: null }], ["a string seen", { seen: "x" }], ["assist as text", { assist: "no" }],
  ];
  let ok = 0, well = 0;
  const bad = [];
  for (const [name, raw] of CASES) {
    let got = null;
    try { got = loadSave(raw); } catch (e) { bad.push(name + " threw " + e.message); continue; }
    const want = todayLoad(typeof raw === "string" ? todayRead(raw) : raw);
    if (same(without(got, ...LATER), want)) ok++; else bad.push(name);
    if (placesOk(got) && got.place === "loon") well++; else bad.push(name + " (places)");
  }
  check(ok === CASES.length && well === CASES.length, `${CASES.length} corrupt saves load with today's values, at Loon Lake${bad.length ? ": " + bad.join(", ") : ""}`);
  check(same(loadSave("{\"casts\": 12, \"journal\": {"), loadSave(null)), "corrupt JSON gives a new save");
  check(loadSave({ biggest: { id: "walleye", kg: "3.6" } }).biggest === null, "a string biggest.kg is dropped");
  const nj = loadSave({ journal: { perch: 5, walleye: { n: 2, kg: 1.4, cm: 50 } } }).journal;
  check(same(nj, { walleye: { n: 2, kg: 1.4, cm: 50 } }), "a numeric journal entry is dropped, and the good one is kept");
  const nf = loadSave({ journal: { crappie: { n: 1, kg: 0.5, cm: 25 }, bigblue: { n: 1, kg: 80, cm: 180 }, boot: { n: 1, kg: 0.8, cm: 0 } } }).journal;
  check(Object.keys(nf).length === 3, "journal entries of the new fish (crappie, Big Blue) and junk are kept");

  // many random saves, each value right or broken: loadSave and today's loader agree on every key today's loader had
  const R = rng(4242), pick = (a) => a[Math.floor(R() * a.length)];
  const NUMS = [undefined, null, NaN, Infinity, -Infinity, -5, 0, 0.5, 3.7, 12, "7", true, [], {}];
  const ids = ["perch", "walleye", "golden", "crappie", "whiskers", "bigblue", "hookjaw", "boot", "shark", "", "__proto__"];
  const entry = () => pick([5, "x", null, [], { n: pick(NUMS), kg: pick(NUMS), cm: pick(NUMS) }, { n: 2, kg: 1.2, cm: 44 }]);
  const PLACE_VALS = () => pick([undefined, null, "x", 7, [], {}, { open: pick([1, 0, true, "1", 2, NaN]), d: pick(NUMS), kg: pick(NUMS), id: pick(ids), n: pick(NUMS), lg: pick([0, 1, 2, 3, 4, -1, 2.5, "3", NaN]) }]);
  let agree = 0, formed = 0, stable = 0, untouched = 0, thrown = 0, away = 0, opened = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) {
    const s = {};
    const put = (k, v) => { if (v !== undefined) s[k] = v; };
    put("v", pick([1, 2, "1", undefined]));
    put("journal", pick([undefined, null, "x", [], Object.fromEntries(Array.from({ length: 1 + Math.floor(R() * 4) }, () => [pick(ids), entry()]))]));
    for (const k of ["casts", "longest", "derbyBest", "caught"]) put(k, pick(NUMS));
    put("biggest", pick([undefined, null, "walleye", { id: pick(ids), kg: pick(NUMS) }, { id: "walleye", kg: 3.6 }, { id: "catfish", kg: 7.2 }]));
    put("input", pick([undefined, null, "motion", "touch", "tilt", 5]));
    put("assist", pick([undefined, true, false, "no", 1]));
    put("quality", pick([undefined, "auto", "high", "low", "ultra", 3]));
    put("seen", pick([undefined, null, "x", [], { bite: 1, "at.stumps": 1 }]));
    put("place", pick([undefined, "loon", "stumps", "river", "sea", "moon", 7, null]));
    put("places", pick([undefined, null, "x", 7, [], Object.fromEntries(pick([["loon"], ["loon", "stumps"], ["stumps", "river", "moon"], ORDER]).map((id) => [id, PLACE_VALS()]))]));
    const before = structuredClone(s);
    let got;
    try { got = loadSave(pick([true, false]) ? s : JSON.stringify(s)); } catch (e) { thrown++; continue; }
    if (same(without(loadSave(s), ...LATER), seenFix(todayLoad(s))) && same(without(loadSave(JSON.stringify(s)), ...LATER), seenFix(todayLoad(JSON.parse(JSON.stringify(s)))))) agree++;
    if (placesOk(got)) formed++;
    if (got.place !== "loon") away++;
    if (isOpen(got, "stumps")) opened++;
    const t = text(got);
    if (text(loadSave(t)) === t) stable++;
    if (same(s, before)) untouched++;
  }
  check(thrown === 0, `${N} random saves: none throws (${opened} with Stump Bay open, ${away} at a place other than Loon Lake)`);
  check(agree === N, `${N} random saves: the same values as today's loader for every old key (${agree} of ${N})`);
  check(formed === N, `${N} random saves: place records well-formed, Loon Lake open, the player at an open place (${formed} of ${N})`);
  check(stable === N, `${N} random saves: load, save and load gives the same text (${stable} of ${N})`);
  check(untouched === N, `${N} random saves: loadSave never changes the object it reads (${untouched} of ${N})`);
}

/* ---------------- 2. an old save moves to the places ---------------- */
section("2. an old save moves to the places");
const OLD = {
  v: 1, journal: { perch: { n: 4, kg: 0.41, cm: 31 }, walleye: { n: 2, kg: 3.6, cm: 66 }, golden: { n: 1, kg: 2.4, cm: 55 } },
  casts: 120, longest: 48.2, derbyBest: 8.4, biggest: { id: "walleye", kg: 3.6 }, input: "motion", assist: true, quality: "auto", seen: { bite: 1, run: 1 }, caught: 7,
};
{
  const s = loadSave(JSON.stringify(OLD));
  check(same(s.journal, OLD.journal), "the journal is kept: perch, walleye and the golden bass");
  check(same(without(s, ...LATER), OLD), "every old value is kept (derbyBest 8.4, biggest walleye 3.6, counts, settings, seen)");
  check(same(s.places.loon, { open: 1, d: 8.4, kg: 3.6, id: "walleye", n: 7, lg: 3, g: 0 }), `places.loon is d 8.4, kg 3.6, walleye, n 7, lg 3: ${text(s.places.loon)}`);
  check(isOpen(s, "stumps") && s.places.stumps.open === 1, "a 3.6 kg fish opens Stump Bay");
  check(!isOpen(s, "river") && !isOpen(s, "sea"), "Cedar River and Gull Rock stay closed");
  check(s.place === "loon", "the player is at Loon Lake");
  check(same(untoldOpens(s), ["stumps"]) && openedText("stumps", s.places.loon.kg, byId(s.places.loon.id).name) === "Your 3.6 kg Walleye opened a new place: Stump Bay.",
    "the first load tells the player once: \"Your 3.6 kg Walleye opened a new place: Stump Bay.\"");
  s.seen["opened.stumps"] = 1;
  check(untoldOpens(s).length === 0, "after the toast (seen opened.stumps) it does not show again");
  const s29 = loadSave({ ...OLD, biggest: { id: "walleye", kg: 2.9 }, journal: { ...OLD.journal, walleye: { n: 2, kg: 2.9, cm: 60 } } });
  check(!isOpen(s29, "stumps") && !s29.places.stumps && s29.places.loon.kg === 2.9, "biggest 2.9 kg leaves Stump Bay closed");
  check(isOpen(loadSave({ biggest: { id: "smallmouth", kg: 3.5 } }), "stumps") && !isOpen(loadSave({ biggest: { id: "smallmouth", kg: 3.49 } }), "stumps"),
    "the goal is 3.5 kg or more: 3.5 opens Stump Bay, 3.49 does not");
  const s2 = loadSave({ derbyBest: 8.4, places: { loon: { open: 1, d: 5, kg: 2, id: "perch", n: 3, lg: 0 } } });
  check(s2.places.loon.d === 8.4, "Loon Lake's best derby is at least derbyBest");
  const s3 = loadSave({ derbyBest: 3, places: { loon: { open: 0, d: 11, kg: 2, id: "perch", n: 3, lg: 1 } } });
  check(s3.places.loon.open === 1 && s3.places.loon.d === 11 && s3.derbyBest === 3, "Loon Lake is always open, and a higher record there is kept");
  const chain = loadSave({ places: { loon: { open: 1, kg: 4 }, stumps: { open: 1, kg: 9 }, river: { open: 1, kg: 8.2 } } });
  check(isOpen(chain, "river") && isOpen(chain, "sea"), "the goals open the trail in order: 4 kg at Loon, 9 kg at Stump Bay, 8.2 kg at Cedar River");
  const chain2 = loadSave({ places: { loon: { open: 1, kg: 4 }, stumps: { open: 1, kg: 5.9 } } });
  check(isOpen(chain2, "stumps") && !isOpen(chain2, "river"), "5.9 kg at Stump Bay leaves Cedar River closed (goal 6 kg)");
  const lg = loadSave({ journal: { whiskers: { n: 1, kg: 21, cm: 120 } }, places: { loon: { open: 1, kg: 4 }, stumps: { open: 1, kg: 21, id: "whiskers", n: 3, lg: 1 } } });
  check(lg.places.stumps.lg === 3 && lg.places.loon.lg === 0, "Old Whiskers in the journal: Stump Bay's legend step is 3 (landed); Loon Lake's stays 0");
}

/* ---------------- 3. broken place values ---------------- */
section("3. broken place values are dropped");
{
  const base = { biggest: { id: "perch", kg: 0.5 }, caught: 2 };
  const loonOnly = loadSave(base);
  for (const [name, v] of [["places: \"x\"", "x"], ["places: null", null], ["places: 7", 7], ["places: []", []]]) {
    const s = loadSave({ ...base, places: v });
    check(same(s.places, loonOnly.places) && s.places.loon.kg === 0.5 && s.places.loon.n === 2, `${name} is dropped (Loon Lake rebuilt from the old values)`);
  }
  for (const [name, v] of [["place: 7", 7], ["place: null", null], ["place: \"moon\"", "moon"], ["place: \"constructor\"", "constructor"], ["place: \"river\" (closed)", "river"], ["place: \"stumps\" (closed)", "stumps"]]) {
    check(loadSave({ ...base, place: v }).place === "loon", `${name} becomes loon`);
  }
  check(loadSave({ ...base, place: "stumps", places: { stumps: { open: 1 } } }).place === "stumps", "place: \"stumps\" (open) is kept");
  check(loadSave({ ...OLD, place: "stumps" }).place === "stumps", "place: \"stumps\" opened on this load by the old 3.6 kg fish is kept");
  const nan = loadSave({ derbyBest: NaN, places: { loon: { open: "yes", d: NaN, kg: -2, id: "shark", n: 2.7, lg: 2.5 }, stumps: { open: 1, d: Infinity, kg: NaN, id: "boot", n: -4, lg: 7 }, moon: { open: 1, kg: 99 } } });
  check(same(nan.places.loon, { open: 1, d: 0, kg: 0, id: null, n: 2, lg: 0, g: 0 }), `NaN, negative and unknown values at Loon Lake become 0 or null: ${text(nan.places.loon)}`);
  check(same(nan.places.stumps, { open: 1, d: 0, kg: 0, id: null, n: 0, lg: 0, g: 0 }), `Infinity, NaN, a junk id and lg 7 at Stump Bay are dropped: ${text(nan.places.stumps)}`);
  check(!("moon" in nan.places) && Object.keys(nan.places).every((k) => ORDER.includes(k)), "an unknown place key is dropped");
  check(!isOpen(loadSave({ places: { stumps: { open: 1, kg: Infinity } } }), "river"), "an Infinity weight opens nothing");
  check(loadSave({ places: { stumps: "x", loon: { open: 1 } } }).places.stumps === undefined, "a place record that is not an object is dropped");
  check(loadSave({ places: { stumps: { open: "1" } } }).places.stumps.open === 0, "open must be 1: the text \"1\" is closed");
  for (const v of [-1, 4, 1.5, "2", null]) check(loadSave({ places: { loon: { lg: v } } }).places.loon.lg === 0, `lg ${JSON.stringify(v)} is not a step 0..3, so it is 0`);
  check(loadSave({ places: { loon: { lg: 2 } } }).places.loon.lg === 2, "lg 2 is kept");
}

/* ---------------- round trips ---------------- */
section("3b. load, save, load");
{
  const played = loadSave(JSON.stringify(OLD));
  recordCatch(played, "loon", { id: "golden", kg: 4.8, cm: 60 });
  played.place = "stumps";
  recordCatch(played, "stumps", { id: "catfish", kg: 7.4, cm: 80 });
  legendStep(played, "stumps", 2);
  recordDerby(played, "stumps", 21.5);
  played.seen["at.stumps"] = 1;
  for (const [name, s0] of [["a new save", loadSave(null)], ["the old save", loadSave(OLD)], ["a played save at Stump Bay", played], ["a broken save", loadSave({ places: { river: { open: 1, kg: 9 }, moon: 3 }, place: "river", derbyBest: 4 })]]) {
    const t1 = text(s0), s1 = loadSave(t1), t2 = text(s1), s2 = loadSave(t2);
    check(t1 === t2 && text(s2) === t2 && same(s1, s0), `${name}: load, save and load gives the same text`);
  }
  const back = loadSave(text(played));
  check(back.place === "stumps" && back.places.stumps.kg === 7.4 && back.places.stumps.lg === 2 && back.places.stumps.d === 21.5 && isOpen(back, "river"),
    "the played save keeps its place, records, legend step and the place it opened");
}

/* ---------------- 4. a catch and a derby ---------------- */
section("4. a catch and a derby end");
{
  const s = loadSave(null);
  let r = recordCatch(s, "loon", { id: "perch", kg: 0.4, cm: 30 });
  check(r.isNew && !r.record && !r.junk && r.opened === null && !r.close, "a first perch: NEW SPECIES, nothing opened");
  check(same(s.journal.perch, { n: 1, kg: 0.4, cm: 30 }) && s.caught === 1 && same(s.biggest, { id: "perch", kg: 0.4 }), "the journal, the count and the biggest fish move as today");
  check(same(s.places.loon, { open: 1, d: 0, kg: 0.4, id: "perch", n: 1, lg: 0, g: 0 }), "Loon Lake's record: 1 fish, the biggest a 0.4 kg perch");
  r = recordCatch(s, "loon", { id: "walleye", kg: 2.6, cm: 58 });
  check(r.close && r.opened === null && !isOpen(s, "stumps"), "a 2.6 kg walleye (74% of 3.5 kg) is a close call");
  check(goalText("loon", "close") === "Close! Land a fish of 3.5 kg or more to open Stump Bay.", "the close call reads \"Close! Land a fish of 3.5 kg or more to open Stump Bay.\"");
  r = recordCatch(s, "loon", { id: "walleye", kg: 2.3, cm: 55 });
  check(!r.close && !r.record && r.oldKg === 2.6, "2.3 kg (66%) is not close, and not a record");
  r = recordCatch(s, "loon", { id: "walleye", kg: 3.5, cm: 66 });
  check(r.record && r.oldKg === 2.6 && r.opened === "stumps" && isOpen(s, "stumps"), "a 3.5 kg walleye is a NEW RECORD (old 2.6 kg) and opens Stump Bay");
  check(same(s.places.stumps, { open: 1, d: 0, kg: 0, id: null, n: 0, lg: 0, g: 0 }), "Stump Bay gets an open, empty record");
  check(same(newPlaces(s), ["stumps"]), "the NEW badge: Stump Bay is open and not visited");
  r = recordCatch(s, "loon", { id: "muskie", kg: 9, cm: 110 });
  check(r.opened === null && !r.close, "a bigger fish later opens nothing more");
  const n0 = s.caught, l0 = s.places.loon.n;
  r = recordCatch(s, "loon", { id: "boot", kg: 0.8, junk: true });
  check(r.junk && r.isNew && s.caught === n0 && s.places.loon.n === l0 && s.journal.boot.n === 1 && s.biggest.id === "muskie", "junk goes in the journal only: no fish count, no record");
  recordCatch(s, "loon", { id: "plunger", kg: 0.5 });
  check(s.caught === n0, "junk is known by its id too (no junk flag)");
  r = recordCatch(s, "stumps", { id: "catfish", kg: 5.9, cm: 80 });
  check(r.close && !isOpen(s, "river") && s.places.stumps.n === 1 && s.places.stumps.kg === 5.9 && s.biggest.id === "muskie",
    "5.9 kg at Stump Bay: close to 6 kg, its own record, and the muskie stays the biggest anywhere");
  recordCatch(s, "loon", { id: "muskie", kg: 12, cm: 125 });
  check(!isOpen(s, "river") && s.places.stumps.kg === 5.9, "only fish landed at a place count: a 12 kg muskie at Loon Lake does not open Cedar River");
  r = recordCatch(s, "stumps", { id: "whiskers", kg: 22, cm: 124 });
  check(r.opened === "river" && s.places.stumps.lg === 3 && s.places.stumps.id === "whiskers", "Old Whiskers at Stump Bay: legend step 3, and 22 kg opens Cedar River");
  check(legendsLanded(s) === 1, "legends landed: 1 of 4");
  // a place open only by ?open: the catch counts in the journal, but opens nothing and keeps no record
  const c0 = s.caught;
  r = recordCatch(s, "sea", { id: "striper", kg: 20, cm: 105 });
  check(s.caught === c0 + 1 && s.journal.striper.n === 1 && !s.places.sea && r.opened === null && placeRec(s, "sea") === null,
    "a catch at a closed place (the ?open switch) goes in the journal, but keeps no record there");
  check(isOpen(s, "sea", true) && !isOpen(s, "sea"), "?open opens every place for this page only");
  // legend steps
  const t = loadSave(null);
  check(legendStep(t, "loon", 1) && t.places.loon.lg === 1, "the gold ring seen: step 1");
  check(legendStep(t, "loon", 2) && t.places.loon.lg === 2, "the legend hooked: step 2");
  check(!legendStep(t, "loon", 1) && t.places.loon.lg === 2, "a step never goes back");
  check(!legendStep(t, "loon", 7) && !legendStep(t, "loon", 2.5) && t.places.loon.lg === 2, "a step that is not 1..3 does nothing");
  check(!legendStep(t, "stumps", 1) && !t.places.stumps, "no step at a closed place");
  recordCatch(t, "loon", { id: "golden", kg: 4.1, cm: 56 });
  check(t.places.loon.lg === 3 && !legendStep(t, "loon", 2), "the legend landed: step 3, and it stays");
  // the derby
  const d = loadSave(JSON.stringify(OLD));
  let e = recordDerby(d, "loon", 6);
  check(!e.best && e.old === 8.4 && d.derbyBest === 8.4 && d.places.loon.d === 8.4, "6 kg after a best of 8.4: no new best");
  e = recordDerby(d, "loon", 12.3);
  check(e.best && e.old === 8.4 && d.derbyBest === 12.3 && d.places.loon.d === 12.3, "12.3 kg: a new best at Loon Lake, and derbyBest moves with it");
  e = recordDerby(d, "stumps", 18);
  check(e.best && e.old === 0 && d.places.stumps.d === 18 && d.derbyBest === 12.3, "18 kg at Stump Bay: its own best; derbyBest stays the Loon Lake best");
  e = recordDerby(d, "stumps", 0);
  check(!e.best && d.places.stumps.d === 18, "a skunked derby is never a best");
  e = recordDerby(d, "sea", 30);
  check(!e.best && !d.places.sea, "a derby at a closed place (?open) keeps no record");
  const bl = blank();
  recordCatch(bl, "loon", { id: "perch", kg: 0.3, cm: 25 });
  check(bl.places.loon && bl.places.loon.open === 1 && bl.places.loon.n === 1, "a blank() save that never went through loadSave still records at Loon Lake");
}

/* ---------------- 5. journey.js ---------------- */
section("5. journey.js");
{
  check(same(ORDER, PLACE_IDS), "ORDER is the trail of places.js: " + ORDER.join(" > "));
  const want = { name: "string", short: "string", level: "string", bigKg: "number", clock: "object", when: "string", kick: "string", newDay: "string", ranks: "object", blurb: "string", gear: "string", tip: "string", hints: "object" };
  const bad = [];
  for (const id of ORDER) {
    const J = JOURNEY[id];
    for (const [k, t] of Object.entries(want)) if (typeof J[k] !== t) bad.push(id + "." + k);
    if (J.name !== PLACES[id].name) bad.push(id + ".name is not " + PLACES[id].name);
    if (J.short.length > 10) bad.push(id + ".short is long");
    if (J.kick !== J.name.toUpperCase()) bad.push(id + ".kick");
    if (!(J.goalKg === null ? id === ORDER.at(-1) : J.goalKg > 0)) bad.push(id + ".goalKg");
    const c = J.clock;
    if (!(c.wrap <= c.free && c.free < c.end && c.wrap <= c.derby && c.derby < c.end)) bad.push(id + ".clock");
    if (!same(J.ranks[0], [0, "SKUNKED"]) || J.ranks.length !== 6 || J.ranks.some((r, i) => i && !(r[0] > J.ranks[i - 1][0]))) bad.push(id + ".ranks");
    if (J.hints.length !== 3 || typeof J.hints[0] !== "string" || J.hints[1] !== null || typeof J.hints[2] !== "string") bad.push(id + ".hints");
    if ([J.blurb, J.gear, J.tip, J.newDay, ...J.hints].some((t) => t && /[\u2013\u2014]/.test(t))) bad.push(id + " has a dash");
    const L = fishingOf(id).legend;
    if (!(byId(L.id) && byId(L.id).legend && L.ring[1] <= 50)) bad.push(id + ".legend");
  }
  check(bad.length === 0, "every place has its fields, its name matches places.js, clocks and ranks are in order, legend rings are 50 m or less" + (bad.length ? ": " + bad.join(", ") : ""));
  check(JOURNEY.loon.goalKg < JOURNEY.stumps.goalKg && JOURNEY.stumps.goalKg < JOURNEY.river.goalKg && JOURNEY.sea.goalKg === null && JOURNEY.sea.bigKg === 10,
    "goals 3.5 < 6 < 8 kg; Gull Rock has no goal and a big fish at 10 kg");
  check(nextPlace("loon") === "stumps" && nextPlace("sea") === null && nextPlace("moon") === null && prevPlace("river") === "stumps" && prevPlace("loon") === null, "nextPlace and prevPlace");
  check(rankFor("loon", 0) === "SKUNKED" && rankFor("loon", 0.2) === "DOCK ROOKIE" && rankFor("loon", 3.99) === "DOCK ROOKIE" && rankFor("loon", 4) === "WEEKEND ANGLER" && rankFor("loon", 30) === "LOON LAKE CHAMPION",
    "Loon Lake ranks: 0 SKUNKED, 0.2 DOCK ROOKIE, 4 WEEKEND ANGLER, 30 LOON LAKE CHAMPION");
  check(rankFor("sea", 20) === "TIDE READER" && rankFor("moon", 9) === "COTTAGE REGULAR", "Gull Rock 20 kg: TIDE READER; an unknown place uses Loon Lake's ranks");
  check(goalText("loon") === "Land a fish of 3.5 kg or more here to open Stump Bay." && goalText("stumps", "remind") === "Goal: land a fish of 6 kg or more. It opens Cedar River."
    && goalText("river", "card") === "To open: land a fish of 8 kg or more at Cedar River." && goalText("stumps", "next") === "Next: land 6 kg or more at Stump Bay to open Cedar River."
    && goalText("sea") === "" && goalText("sea", "next") === "", "the goal lines, and none at Gull Rock");
  check(openedText("river", 6.24, "Channel Catfish", "results") === "Your 6.2 kg Channel Catfish opened Cedar River.", "the derby results line: \"Your 6.2 kg Channel Catfish opened Cedar River.\"");
  check(legendHint("loon", 0) === JOURNEY.loon.hints[0] && legendHint("stumps", 1) === "Look for a gold ring late at night, 30 to 45 m out. Cast right into it."
    && legendHint("river", 2) === JOURNEY.river.hints[2] && legendHint("sea", 3) === null, "legend hints: the rumor, the ring (\"late at night, 30 to 45 m out\"), the fight tip");
  check(ORDER.map((id) => topFish(id).id).join() === "muskie,catfish,chinook,striper", "top fish: " + ORDER.map((id) => topFish(id).name).join(", "));
  const s = loadSave(OLD);
  check(ORDER.map((id) => foundHere(loadSave(null), id).m).join() === "13,8,8,7" && same(foundHere(s, "loon"), { n: 3, m: 13 }) && same(foundAll(s), { n: 3, m: SPECIES.length + JUNK.length }) && SPECIES.length + JUNK.length === 29,
    "found: 3 of 13 at Loon Lake, 3 of 29 in all (8, 8 and 7 at the other places)");
  check(newPlaces(loadSave(null)).length === 0 && untoldOpens(loadSave(null)).length === 0, "a new save: no NEW badge and no unlock toast");
  check(startHour("stumps", "derby") === 20 && startHour("stumps", "free") === 19 && startHour("moon", "free") === 6.2, "start hours: Stump Bay derby 20, free 19; unknown gives Loon Lake's");
  const a = stepHour("loon", 6.2, 75, "free"), b = stepHour("loon", 18.3, 400, "derby"), w = stepHour("stumps", 23.99, 1, "free"), w2 = stepHour("loon", 20.99, 1, "free");
  check(Math.abs(a.hour - 7.2) < 1e-9 && !a.wrapped && Math.abs(b.hour - 19.3) < 1e-9 && w.hour === 19 && w.wrapped && w2.hour === 5 && w2.wrapped,
    "the clock: an hour is 75 s free and 400 s in the derby; Stump Bay wraps at 24 to 19, Loon Lake at 21 to 5");
  check(isBigFish("loon", 3.5, 0) && !isBigFish("loon", 3.4, 0.89) && isBigFish("loon", 0.4, 0.9) && isBigFish("sea", 10, 0) && !isBigFish("sea", 9.9, 0.5), "big fish: 3.5 kg at Loon Lake, 10 kg at Gull Rock, or a size rank of 0.9");
  check(sizeLine(0.5) === "" && sizeLine(0.75) === "Bigger than 3 in 4 of its kind." && sizeLine(0.93) === "Bigger than 9 in 10 of its kind." && sizeLine(0.95) === "Bigger than 19 in 20 of its kind." && sizeLine(0.995) === "Bigger than 99 in 100 of its kind.",
    "the size line at 0.75, 0.9, 0.95 and 0.99");
  check(revealText(byId("walleye")) === "It is a Walleye!" && revealText(byId("cod")) === "It is an Atlantic Cod!" && revealText(byId("walleye"), true) === "It is a huge Walleye!"
    && revealText(byId("golden"), true) === "It is the Golden Loon Bass!" && revealText(byId("whiskers")) === "It is Old Whiskers!", "reveal: a / an / a huge, and the legend's own article");
}

/* ---------------- 6. the goals ---------------- */
section("6a. the goal fields in the save");
{
  const fresh = loadSave(null);
  check(same(fresh.today, { d: "", k: 0, n: 0, done: 0 }) && same(fresh.days, { n: 0, run: 0, best: 0, last: "" }) && fresh.bestRun === 0 && fresh.places.loon.g === 0,
    "a new save: no day yet, no run of days, no sweet run, no goals done");
  const old = loadSave(JSON.stringify(OLD));
  check(same(old.today, fresh.today) && same(old.days, fresh.days) && old.bestRun === 0 && old.places.loon.g === 0, "an old save gets the same: nothing done yet");
  const good = { today: { d: "2026-10-03", k: 2, n: 1, done: 0 }, days: { n: 4, run: 2, best: 3, last: "2026-10-02" }, bestRun: 5, places: { loon: { open: 1, g: 37 } } };
  const g1 = loadSave(good), g2 = loadSave(text(g1));
  check(same(g1.today, good.today) && same(g1.days, good.days) && g1.bestRun === 5 && g1.places.loon.g === 37 && text(g2) === text(g1), "good values are kept, and a load, save and load gives the same text");
  for (const v of [64, -1, 2.5, "3", NaN, null, Infinity, [], {}]) check(loadSave({ places: { loon: { open: 1, g: v } } }).places.loon.g === 0, `a goal value of ${text(v) ?? String(v)} is not a whole number from 0 to 63, so no goals are done`);
  check(loadSave({ places: { loon: { g: 63 } } }).places.loon.g === 63 && loadSave({ places: { loon: { g: 0 } } }).places.loon.g === 0, "0 and 63 are kept");
  for (const [name, t] of [["a day that is not a date", { d: "2026-02-30", k: 0, n: 1, done: 0 }], ["a day as a number", { d: 20261003, k: 0, n: 1, done: 0 }], ["a goal past the list", { d: "2026-10-03", k: DAILY.length, n: 1, done: 0 }],
    ["a goal of -1", { d: "2026-10-03", k: -1, n: 1, done: 0 }], ["an array", ["2026-10-03", 1]], ["text", "2026-10-03"]]) check(same(loadSave({ today: t }).today, fresh.today), `today: ${name} gives no day`);
  check(same(loadSave({ today: { d: "2026-10-03", k: 1, n: -2, done: "yes" } }).today, { d: "2026-10-03", k: 1, n: 0, done: 0 }), "today: a broken count and done are 0");
  check(same(loadSave({ days: { n: 2.5, run: 3, best: 1, last: "yesterday" } }).days, { n: 3, run: 3, best: 3, last: "" }), "days: a broken count is 0, the best run is at least the run, the days done at least the best run, a bad last day is \"\"");
  for (const v of [-3, 2.5, "4", NaN, null]) check(loadSave({ bestRun: v }).bestRun === 0, `bestRun ${text(v) ?? String(v)} is 0`);
  // the counts stop at a million, so a broken save never shows "1e+21"
  const huge = loadSave({ bestRun: 1e21, days: { n: 1e21, run: 2 ** 53, best: 1e7, last: "2026-10-02" } });
  check(huge.bestRun === 1e6 && same(huge.days, { n: 1e6, run: 1e6, best: 1e6, last: "2026-10-02" }), "huge counts stop at a million (" + text({ bestRun: huge.bestRun, days: huge.days }) + ")");
  // today's goal against the places and the goal: a goal at a locked place is dropped (it would count toward another
  // goal), and its progress is never more than the goal
  const atStumps = DAILY.findIndex((g) => g.at === "stumps" && g.kind === "count"), five = DAILY.findIndex((g) => g.at === "loon" && g.kind === "count");
  check(same(loadSave({ today: { d: "2026-10-03", k: atStumps, n: 2, done: 0 } }).today, fresh.today), "today: a goal at Stump Bay while Stump Bay is locked gives no day");
  check(same(loadSave({ today: { d: "2026-10-03", k: atStumps, n: 2, done: 0 }, places: { stumps: { open: 1 } } }).today, { d: "2026-10-03", k: atStumps, n: 2, done: 0 }), "the same goal with Stump Bay open is kept");
  check(same(loadSave({ today: { d: "2026-10-03", k: five, n: 99, done: 0 } }).today, { d: "2026-10-03", k: five, n: 4, done: 0 }), "today: 99 of 5, not done, is 4 of 5");
  check(same(loadSave({ today: { d: "2026-10-03", k: five, n: 1, done: 1 } }).today, { d: "2026-10-03", k: five, n: 5, done: 1 }), "today: a done goal holds all of its count, 5 of 5");
  check(todayLine(loadSave({ today: { d: "2026-10-03", k: five, n: 99, done: 0 } }), "2026-10-03") === "Today: land 5 fish at Loon Lake. 4 of 5.", "and the title line reads 4 of 5");

  // a fuzz of the new fields: every result well-formed and stable, and the input never changed
  const R = rng(777), pick = (a) => a[Math.floor(R() * a.length)];
  const DAYS = [undefined, null, "", "2026-10-03", "2026-13-01", "2026-02-29", "2024-02-29", "x", 7, [], {}];
  const NUMS = [undefined, null, NaN, Infinity, -1, 0, 1, 2.5, 7, 9, 12, 63, 64, 1e21, "3", true, [], {}];
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  let formed = 0, stable = 0, untouched = 0, thrown = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const s = {};
    const put = (k, v) => { if (v !== undefined) s[k] = v; };
    put("today", pick([undefined, null, "x", [], 3, { d: pick(DAYS), k: pick(NUMS), n: pick(NUMS), done: pick([0, 1, true, "1", 2, undefined]) }]));
    put("days", pick([undefined, null, "x", [], { n: pick(NUMS), run: pick(NUMS), best: pick(NUMS), last: pick(DAYS) }]));
    put("bestRun", pick(NUMS));
    put("seen", pick([undefined, [], ["ring.tip"], { "ring.tip": 1 }]));
    put("places", pick([undefined, { loon: { open: 1, g: pick(NUMS) }, stumps: { open: pick([0, 1]), g: pick(NUMS) } }]));
    const before = structuredClone(s);
    let got;
    try { got = loadSave(pick([true, false]) ? s : JSON.stringify(s)); } catch (e) { thrown++; continue; }
    const t = got.today, d = got.days, whole = (v) => Number.isInteger(v) && v >= 0;
    const tg = DAILY[t.k], small = (v) => whole(v) && v <= 1e6;
    const tOk = same(Object.keys(t), ["d", "k", "n", "done"]) && (t.d === "" ? same(t, { d: "", k: 0, n: 0, done: 0 }) : DAY.test(t.d) && isDay(t.d) && !!tg && isOpen(got, tg.at) && (t.done ? t.n === tg.n : t.n < tg.n)) && whole(t.k) && t.k < DAILY.length && whole(t.n) && (t.done === 0 || t.done === 1);
    const dOk = same(Object.keys(d), ["n", "run", "best", "last"]) && small(d.n) && small(d.run) && small(d.best) && d.best >= d.run && d.n >= d.best && (d.last === "" || isDay(d.last));
    const gOk = Object.values(got.places).every((e) => Number.isInteger(e.g) && e.g >= 0 && e.g <= 63);
    if (tOk && dOk && small(got.bestRun) && gOk && !Array.isArray(got.seen)) formed++;
    const txt = text(got);
    if (text(loadSave(txt)) === txt) stable++;
    if (same(s, before)) untouched++;
  }
  check(thrown === 0 && formed === N, `${N} random saves: today, days, bestRun and the goal values are well-formed (${formed} of ${N}, ${thrown} threw)`);
  check(stable === N, `${N} random saves: load, save and load gives the same text (${stable} of ${N})`);
  check(untouched === N, `${N} random saves: loadSave never changes the object it reads (${untouched} of ${N})`);

  // an array of flags: no flags, a copy, and a flag set after the load is kept by the next save
  const raw = { seen: [] }, s = loadSave(raw);
  s.seen["at.stumps"] = 1;
  check(!Array.isArray(s.seen) && s.seen !== raw.seen && raw.seen.length === 0 && Object.keys(raw.seen).length === 0 && loadSave(text(s)).seen["at.stumps"] === 1,
    "seen: [] loads as {}, does not share the input, and a flag set after loading survives a save and load");
}

section("6b. the six goals of each place");
{
  const bad = [];
  for (const id of ORDER) {
    const G6 = PLACE_GOALS[id];
    if (!G6 || G6.length !== 6) bad.push(id + " has " + (G6 ? G6.length : 0) + " goals");
    for (const g of G6 || []) {
      if (g.text.length > 32) bad.push(id + ": \"" + g.text + "\" is " + g.text.length + " characters");
      if (!/^[A-Z].*\.$/.test(g.text) || /[–—!]/.test(g.text)) bad.push(id + ": \"" + g.text + "\" is not a plain sentence");
      if (g.on !== "cast" && g.on !== "catch") bad.push(id + ": \"" + g.text + "\" has no kind");
    }
    if (new Set((G6 || []).map((g) => g.text)).size !== (G6 || []).length) bad.push(id + " has the same goal twice");
  }
  check(bad.length === 0, "6 goals at each place, 24 in all, each a plain sentence of 32 characters or fewer" + (bad.length ? ": " + bad.join("; ") : ""));
  // every fish and every kind of cover a goal names is there at its place
  const live = (id, sp) => ecology(id).some(([s]) => s.id === sp);
  const names = [["loon", "smallmouth"], ["stumps", "catfish"], ["stumps", "gar"], ["river", "browntrout"], ["river", "chinook"], ["sea", "cod"], ["sea", "bluefish"], ["sea", "striper"]];
  check(names.every(([id, sp]) => live(id, sp)) && fishingOf("loon").junk.includes("plunger"), "every fish a goal names lives at its place, and the plunger is on Loon Lake's bottom");
  check(["stumps", "logs", "wall"].every((k, i) => fishingOf(["stumps", "river", "sea"][i]).coverAt[k]) && Object.values(fishingOf("stumps").cover).some((c) => c.includes("stumps")) && Object.values(fishingOf("river").cover).some((c) => c.includes("logs")) && Object.values(fishingOf("sea").cover).some((c) => c.includes("wall")),
    "the stumps, the logs and the wall are cover that fish run for at their places");

  // each goal: a catch (or a cast) that meets it, and one that misses by a little
  const cast = (dist) => ({ kind: "cast", dist }), fish = (o) => ({ kind: "catch", id: "perch", kg: 0.4, junk: false, hour: 12, dist: 20, ...o });
  const CASES = {
    loon: [[cast(40), cast(39.9)], [fish({ ring: true }), fish({ ring: false })], [fish({ feather: true }), fish({})], [fish({ id: "smallmouth", jumps: 1 }), fish({ id: "smallmouth", jumps: 0 })],
      [fish({ turned: ["pads"] }), fish({ turned: [] })], [fish({ id: "plunger", junk: true }), fish({ id: "boot", junk: true })]],
    stumps: [[fish({ turned: ["stumps"] }), fish({ turned: ["pads"] })], [fish({ hour: 21.2 }), fish({ hour: 20.9 })], [fish({ id: "catfish", unstuck: true }), fish({ id: "catfish" })],
      [fish({ id: "gar", jumps: 2 }), fish({ id: "bowfin", jumps: 2 })], [fish({ lastrun: true }), fish({})], [fish({ ring: true }), fish({})]],
    river: [[fish({ turned: ["logs"] }), fish({ turned: [""] })], [fish({ walk: true }), fish({ jumps: 1 })], [fish({ unstuck: true }), fish({})],
      [fish({ id: "browntrout", hour: 7.5 }), fish({ id: "browntrout", hour: 8.5 })], [fish({ id: "chinook", kg: 10 }), fish({ id: "chinook", kg: 9.9 })], [fish({ dist: 40 }), fish({ dist: 39 })]],
    sea: [[fish({ turned: ["wall"] }), fish({ turned: ["ledge"] })], [fish({ id: "cod", unstuck: true }), fish({ id: "pollock", unstuck: true })], [fish({ id: "bluefish", hour: 10.5 }), fish({ id: "bluefish", hour: 12 })],
      [fish({ id: "striper", hour: 18.5 }), fish({ id: "striper", hour: 17 })], [fish({ kg: 10 }), fish({ kg: 9.99 })], [fish({ lastrun: true }), fish({})]],
  };
  const wrong = [];
  for (const id of ORDER) PLACE_GOALS[id].forEach((g, i) => {
    const [yes, no] = CASES[id][i];
    if (!goalMet(g, yes)) wrong.push(id + " #" + i + " \"" + g.text + "\" is not met by " + text(yes));
    if (goalMet(g, no)) wrong.push(id + " #" + i + " \"" + g.text + "\" is met by " + text(no));
  });
  check(wrong.length === 0, "each of the 24 goals is met by the right catch or cast, and not by one a little off" + (wrong.length ? ": " + wrong.join("; ") : ""));
  check(PLACE_GOALS.stumps[0].text === "Turn a fish from the stumps." && same(goalsMet("stumps", fish({ turned: ["stumps"], hour: 20 })), [0]), "at Stump Bay a fish turned from the stumps does \"Turn a fish from the stumps.\" and nothing else");
  check(!goalMet(PLACE_GOALS.loon[1], fish({ junk: true, id: "boot", ring: true })) && !goalMet(PLACE_GOALS.loon[0], fish({ dist: 50 })) && !goalMet(PLACE_GOALS.loon[5], fish({ id: "plunger", junk: false })),
    "junk does no fish goal, a catch does no cast goal, and the plunger goal wants the junk");
  check(same(goalsMet("moon", cast(60)), []) && !goalMet(null, cast(60)) && !goalMet(PLACE_GOALS.loon[0], null), "an unknown place, goal or context does nothing");

  // the bit of each goal in the save
  const s = loadSave(null);
  check(recordGoal(s, "loon", 0) && s.places.loon.g === 1 && !recordGoal(s, "loon", 0) && s.places.loon.g === 1, "goal 0 at Loon Lake: g = 1, and a second time it is not new");
  check(recordGoal(s, "loon", 5) && s.places.loon.g === 33 && goalCount(s.places.loon.g) === 2, "goal 5: g = 33, 2 goals done");
  check(!recordGoal(s, "loon", 6) && !recordGoal(s, "loon", -1) && !recordGoal(s, "loon", 1.5) && s.places.loon.g === 33, "a goal number that is not 0..5 does nothing");
  check(!recordGoal(s, "stumps", 0) && !s.places.stumps, "no goal at a place that is not open in the save (the ?open switch)");
  for (let i = 0; i < 6; i++) recordGoal(s, "loon", i);
  check(s.places.loon.g === 63 && goalCount(63) === 6 && goalCount(0) === 0 && loadSave(text(s)).places.loon.g === 63, "all six: g = 63, and it survives a save and load");
  const b = blank();
  check(recordGoal(b, "loon", 2) && b.places.loon.g === 4, "a blank() save that never went through loadSave keeps a goal at Loon Lake");
}

section("6c. today's goal");
{
  const days = (from, n) => Array.from({ length: n }, (_, i) => { const [y, m, d] = from.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10); });
  check(isDay("2026-10-03") && isDay("2024-02-29") && !isDay("2026-02-29") && !isDay("2026-13-01") && !isDay("26-10-03") && !isDay(20261003) && !isDay(null), "a day is a real date as YYYY-MM-DD");
  check(prevDay("2026-10-03") === "2026-10-02" && prevDay("2026-03-01") === "2026-02-28" && prevDay("2027-01-01") === "2026-12-31", "the day before, across months and years");
  check(dayOf(new Date(2026, 0, 5, 23, 59)) === "2026-01-05" && dayOf(new Date(2026, 9, 3, 0, 1)) === "2026-10-03", "the day of a date is the phone's local date");
  // the goals of the list: named fish live there and bite in the hours of the place's clock
  const bad = [];
  for (const [k, g] of DAILY.entries()) {
    if (!JOURNEY[g.at]) { bad.push(k + ": no place"); continue; }
    if (!["fish", "count", "kg", "ring"].includes(g.kind) || !(Number.isInteger(g.n) && g.n >= 1)) bad.push(k + ": kind or n");
    if (g.kind === "fish") {
      const e = ecology(g.at).find(([s]) => s.id === g.id), c = JOURNEY[g.at].clock, lo = Math.min(c.free, c.derby, c.wrap);
      if (!e) bad.push(k + ": " + g.id + " does not live at " + g.at);
      else if (e[1].hours.length && !e[1].hours.some(([a, b2]) => b2 > lo && a < c.end)) bad.push(k + ": " + g.id + " does not bite in the hours of " + g.at);
    }
    if (g.kind === "kg" && !(g.kg > 0 && g.kg < (JOURNEY[g.at].goalKg || JOURNEY[g.at].bigKg))) bad.push(k + ": kg");
    const t = dailyText(g);
    if (!/^land .* at [A-Z][a-z]+ [A-Z][a-z]+\.$/.test(t) || /[–—]/.test(t)) bad.push(k + ": \"" + t + "\"");
  }
  check(bad.length === 0 && ORDER.every((id) => DAILY.filter((g) => g.at === id).length >= 4), `${DAILY.length} goals of the day, 4 or more at each place: each fish lives at its place and bites in its hours` + (bad.length ? ": " + bad.join("; ") : ""));
  check(dailyText(DAILY[0]) === "land a Yellow Perch at Loon Lake." && dailyText({ at: "river", kind: "fish", id: "steelhead", n: 2 }) === "land 2 Steelhead at Cedar River." && dailyText({ at: "loon", kind: "count", n: 5 }) === "land 5 fish at Loon Lake." && dailyText({ at: "sea", kind: "fish", id: "cod", n: 1 }) === "land an Atlantic Cod at Gull Rock."
    && dailyText({ at: "stumps", kind: "kg", kg: 3, n: 1 }) === "land a fish of 3 kg or more at Stump Bay." && dailyText({ at: "loon", kind: "ring", n: 1 }) === "land a fish from a rising ring at Loon Lake.", "the words of the goals");

  // 60 days: the same goal all day, only open places, every goal of the open places comes, never two days in a row
  const loon = loadSave(null), two = loadSave({ places: { loon: { open: 1, kg: 4 } } }), all = loadSave({ places: { loon: { open: 1 }, stumps: { open: 1 }, river: { open: 1 }, sea: { open: 1 } } });
  for (const [name, s, places] of [["only Loon Lake open", loon, ["loon"]], ["Loon Lake and Stump Bay open", two, ["loon", "stumps"]], ["every place open", all, ORDER]]) {
    const ds = days("2026-09-01", 60), ks = ds.map((d) => dailyGoal(d, s).k), want = DAILY.map((g, k) => k).filter((k) => places.includes(DAILY[k].at));
    const again = ds.every((d, i) => dailyGoal(d, s).k === ks[i] && dailyGoal(d, loadSave(text(s))).k === ks[i]);
    const open = ks.every((k) => places.includes(DAILY[k].at)), every = want.every((k) => ks.includes(k)), repeat = ks.filter((k, i) => i && k === ks[i - 1]).length;
    check(again && open && every && repeat === 0, `${name}, 60 days: the same goal for the same day, open places only, all ${want.length} goals come, none two days in a row (${again}, ${open}, ${every}, ${repeat} repeats)`);
  }
  // the save holds today's goal: a place that opens during the day does not change it
  const s = loadSave(null), day = "2026-10-03", g = dailyGoal(day, s);
  let r = recordDay(s, day, g, false);
  check(r.first && s.today.d === day && s.today.k === g.k && s.today.n === 0 && !r.done, "the first fish of the day starts today's goal from 0 (and says it is the first)");
  recordCatch(s, "loon", { id: "walleye", kg: 3.6, cm: 66 });
  check(isOpen(s, "stumps") && dailyGoal(day, s).k === g.k && dailyGoal(day, loadSave(text(s))).k === g.k, "Stump Bay opens during the day: today's goal stays the same, also after a save and load");
  r = recordDay(s, day, dailyGoal(day, s), false);
  check(!r.first, "the second fish of the day is not the first");
  // a save that holds a goal for the day at a place that is not open (loadSave drops it; here it is put in by hand): its
  // progress never shows against the day's goal, and the next fish starts the day's goal from 0
  const k2 = DAILY.findIndex((x) => x.at === "stumps" && x.kind === "count"), odd = { ...loadSave(null), today: { d: day, k: k2, n: 3, done: 0 } }, og = dailyGoal(day, odd);
  check(og.k !== k2 && todayLine(odd, day) === todayLine(loadSave(null), day), "a day's goal at a locked place: the title shows the day's own goal with none of that progress (" + todayLine(odd, day) + ")");
  r = recordDay(odd, day, og, false);
  check(!r.first && same(odd.today, { d: day, k: og.k, n: 0, done: 0 }), "and the next fish starts the day's goal from 0, not as the first fish (" + text(odd.today) + ")");

  // what counts: a perch for "land a Yellow Perch", any fish for "land 5 fish", a heavy one, a ring fish; never junk
  const ctx = (o) => ({ kind: "catch", at: "loon", id: "perch", kg: 0.4, junk: false, ...o }), G = (i) => ({ ...DAILY[i], k: i });
  const perch = DAILY.findIndex((x) => x.at === "loon" && x.kind === "fish" && x.id === "perch"), five = DAILY.findIndex((x) => x.at === "loon" && x.kind === "count");
  const heavy = DAILY.findIndex((x) => x.at === "loon" && x.kind === "kg"), ringed = DAILY.findIndex((x) => x.at === "loon" && x.kind === "ring");
  check(dayHit(G(perch), ctx({})) && !dayHit(G(perch), ctx({ id: "pumpkinseed" })) && !dayHit(G(perch), ctx({ at: "stumps" })) && !dayHit(G(perch), ctx({ junk: true, id: "boot" })), "a perch at Loon Lake counts for the perch; a pumpkinseed, a perch elsewhere or junk does not");
  check(dayHit(G(five), ctx({ id: "walleye" })) && !dayHit(G(five), ctx({ junk: true })) && dayHit(G(heavy), ctx({ kg: 2.5 })) && !dayHit(G(heavy), ctx({ kg: 2.49 })) && dayHit(G(ringed), ctx({ ring: true })) && !dayHit(G(ringed), ctx({})),
    "any fish counts for land 5 fish; 2.5 kg for the heavy one; a ring fish for the ring");
  // land 5 fish: 1 of 5 ... done; yesterday was done too, so 2 days in a row
  const p = loadSave({ today: { d: "2026-10-02", k: 4, n: 1, done: 1 }, days: { n: 5, run: 1, best: 3, last: "2026-10-02" } });
  p.today = { d: day, k: five, n: 0, done: 0 };
  const pg = dailyGoal(day, p);
  check(pg.k === five && todayLine(p, day) === "Today: land 5 fish at Loon Lake. 0 of 5.", "the title line: \"" + todayLine(p, day) + "\"");
  recordDay(p, day, pg, true);
  check(todayLine(p, day) === "Today: land 5 fish at Loon Lake. 1 of 5." && todayLine(loadSave(text(p)), day) === todayLine(p, day), "1 of 5, the same after a save and load");
  recordDay(p, day, pg, false);
  for (let i = 0; i < 3; i++) recordDay(p, day, pg, true);
  r = recordDay(p, day, pg, true);
  check(r.done && r.run === 2 && same(p.days, { n: 6, run: 2, best: 3, last: day }) && p.today.done === 1 && dayDoneText(r.run) === "Today's goal is done. 2 days in a row.", "the fifth fish: done, 2 days in a row (" + text(p.days) + ")");
  check(todayLine(p, day) === "Today's goal is done. 2 days in a row." && !recordDay(p, day, pg, true).done && p.days.n === 6, "the title says so, and a sixth fish does not count it again");
  check(todayLine({ ...loadSave(null), today: { d: day, k: perch, n: 0, done: 0 } }, day) === "Today: land a Yellow Perch at Loon Lake.", "a goal of one fish shows no count");
  // a missed day ends the run, and takes nothing else
  const q = loadSave(text(p)), later = "2026-10-05", qg = dailyGoal(later, q);
  check(todayLine(q, later).startsWith("Today: ") && q.days.run === 2, "two days later a new goal shows; the run is not touched until a goal is done");
  for (let i = 0; i < qg.n; i++) r = recordDay(q, later, qg, true);
  check(r.done && same(q.days, { n: 7, run: 1, best: 3, last: later }) && dayDoneText(1) === "Today's goal is done." && q.journal.walleye === p.journal.walleye, "the goal done after a missed day: the run starts again at 1, days done and the best run stay (" + text(q.days) + ")");
  check(dailyGoal("not a day", loon).k === DAILY.findIndex((x) => x.at === "loon"), "a day that is not a date still gives a goal at an open place");
}

section("6d. the next goal and the next rank");
{
  check(same(nextRank("loon", 3.6), { name: "WEEKEND ANGLER", kg: 4 }) && same(nextRank("loon", 14), { name: "LAKE PRO", kg: 17 }) && nextRank("loon", 26) === null && same(nextRank("loon", 0), { name: "WEEKEND ANGLER", kg: 4 }),
    "Loon Lake: 3.6 kg -> WEEKEND ANGLER at 4 kg, 14 -> LAKE PRO at 17, 26 is the top, a skunked derby points at WEEKEND ANGLER");
  check(same(nextRank("sea", 14), { name: "TIDE READER", kg: 20 }) && same(nextRank("stumps", 0.4), { name: "SWAMP WADER", kg: 5.5 }) && same(nextRank("moon", 9), { name: "LAKE PRO", kg: 17 }), "Gull Rock 14 kg -> TIDE READER at 20; Stump Bay 0.4 -> SWAMP WADER at 5.5");
  // the trail, stage by stage
  const s = loadSave(null);
  check(nextGoal(s, "loon") === "Land a fish of 3.5 kg or more here to open Stump Bay.", "a new save: the goal of Loon Lake");
  recordCatch(s, "loon", { id: "walleye", kg: 3.6, cm: 66 });
  check(nextGoal(s, "loon") === "Next: land 6 kg or more at Stump Bay to open Cedar River." && nextGoal(s, "stumps") === "Land a fish of 6 kg or more here to open Cedar River.", "Stump Bay open: the goal there, from Loon Lake and from Stump Bay");
  check(nextGoal(s, "loon", true) === "Next: the legend of Loon Lake. Look for a gold ring at dawn or dusk.", "?open: no goal to open a place, so the legend here");
  const all = loadSave({ journal: { golden: { n: 1, kg: 4, cm: 55 }, whiskers: { n: 1, kg: 20, cm: 120 } }, places: { loon: { open: 1 }, stumps: { open: 1 }, river: { open: 1 }, sea: { open: 1 } } });
  check(nextGoal(all, "loon") === "Next: the legend of Cedar River. Look for a gold ring at dawn." && nextGoal(all, "sea") === "Next: the legend of Gull Rock. Look for a gold ring at dawn or dusk.",
    "every place open, two legends left: the next legend and when to look for it (from Loon Lake: Cedar River's; at Gull Rock: its own)");
  for (const id of ["river", "sea"]) all.journal[fishingOf(id).legend.id] = { n: 1, kg: 30, cm: 130 };
  check(nextGoal(all, "loon") === "Next goal here: Cast 40 m.", "every legend landed: this place's first goal not done");
  for (let i = 0; i < 6; i++) recordGoal(all, "loon", i);
  check(nextGoal(all, "loon") === "Next rank here: WEEKEND ANGLER at 4 kg.", "every goal here done: the next rank here");
  recordDerby(all, "loon", 30);
  check(nextGoal(all, "loon") === "12 fish here are not in your journal.", "the top rank here: the fish not in the journal");
  for (const id of fishingOf("loon").junk.concat(ecology("loon").map(([sp]) => sp.id))) all.journal[id] = { n: 1, kg: 1, cm: 1 };
  check(nextGoal(all, "loon") === "", "all of it done: nothing (the title says something else)");
  all.journal.boot = { n: 0, kg: 0, cm: 0 };
  check(nextGoal(all, "loon") === "1 fish here is not in your journal.", "one left: \"1 fish here is not in your journal.\"");
}

section("6e. the hints and the catch card counts");
{
  const bad = [];
  for (const id of ORDER) for (const [sp] of ecology(id)) {
    const h = zoneHint(sp, id);
    if (!/^Try [a-z].*\.$/.test(h)) bad.push(id + " " + sp.id + ": \"" + h + "\"");
    if (id === "stumps" && /morning|midday/.test(h)) bad.push(id + " " + sp.id + " promises an hour Stump Bay does not have: \"" + h + "\"");
  }
  check(bad.length === 0, "every fish at every place has a hint (\"Try ...\"), and none at Stump Bay promises morning or midday" + (bad.length ? ": " + bad.join("; ") : ""));
  check(zoneHint(byId("bluefish"), "sea") === "Try the tide channel in the morning.", "Bluefish (6:00 to 11:00) looks in the morning: \"" + zoneHint(byId("bluefish"), "sea") + "\"");
  check(zoneHint(byId("catfish"), "stumps") === "Try the creek bed at night." && zoneHint(byId("gar"), "stumps") === "Try the sand flat." && zoneHint(byId("browntrout"), "river") === "Try the logjam at dusk."
    && zoneHint(byId("pike"), "loon") === "Try the weed flat at midday." && zoneHint(byId("perch"), "loon") === "Try the weed flat in the morning.", "catfish at night, gar with no hour (its hours are not on Stump Bay's clock), brown trout at dusk, pike at midday, perch in the morning");
  check(zoneHint(byId("cod"), "loon") === "", "a fish that does not live at a place has no hint there");
  // the catch card counts a new find the way the journal and Places do: fish, legend and junk
  const s = loadSave(null);
  check(same(foundHere(s, "loon"), { n: 0, m: 13 }), "Loon Lake's journal holds 13 finds: 9 fish, the legend and 3 pieces of junk");
  for (const id of ["perch", "walleye", "pike", "boot"]) recordCatch(s, "loon", { id, kg: 1, cm: 30 });
  check(same(foundHere(s, "loon"), { n: 4, m: 13 }), "4 of 13 after a perch, a walleye, a pike and a boot");
}

section("6f. help on the way");
{
  check(progressNote({ streak: 3 }) === "Three sweet casts! A big fish is near." && progressNote({ streak: 6, dist: 10, goalOpen: true, castN: 1 }) === STREAK.text && progressNote({ streak: 4 }) === "" && progressNote({ streak: 2 }) === "",
    "three sweet casts in a row (and six) light up the report; two or four do not");
  const hint = (castN, dist = 15, goalOpen = true) => progressNote({ streak: 0, dist, goalOpen, castN });
  check(hint(1) === "Big fish live far out." && [2, 3, 4, 5].every((n) => hint(n) === "") && hint(6) === "Big fish live far out." && hint(11) === "Big fish live far out.", "a short cast hears \"Big fish live far out.\" on the 1st, 6th and 11th short cast, not between");
  check(hint(1, SHORT_M) === "" && hint(1, 15, false) === "" && SHORT_M === 22, "not on a cast of 22 m or more, and not once the goal that opens the next place is met");
  check(STREAK.n === 3 && STREAK.boost === 0.4 && ASSIST.casts === 20 && ASSIST.reach === 25 && ASSIST.boost > 0, "three sweet casts give boost 0.4; the help comes after 20 casts, at a ring within 25 m");
  check(ORDER.map(assistFish).join() === "pike,catfish,chinook," && ["loon", "stumps", "river"].every((id) => byId(assistFish(id)).kg[1] > JOURNEY[id].goalKg && ecology(id).some(([sp]) => sp.id === assistFish(id))),
    "the big ring's fish lives at its place and its usual range goes past the goal: pike, catfish, chinook (none at Gull Rock)");
}

console.log(fails.length ? `\n${fails.length} of ${passes + fails.length} checks failed` : `\nAll ${passes} checks passed`);
process.exit(fails.length ? 1 : 0);

