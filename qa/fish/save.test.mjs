// Checks the save file and the trail of places in node: node qa/fish/save.test.mjs
// 1. loadSave reads every save today's loader (main.js before the places) could read, and gives the same values.
// 2. An old save moves to the places: Loon Lake gets its record, and a big enough fish opens Stump Bay.
// 3. Broken place values are dropped, and a load, save and load gives the same text.
// 4. A catch and a derby end update the place records, the legend steps and the locks.
// 5. journey.js: the place data is whole, and its helpers give the right words.
// Exit code 1 on failure.
import { isDeepStrictEqual } from "node:util";
import { SAVE_KEY, blank, blankPlace, loadSave, placeRec, recordCatch, legendStep, recordDerby } from "../../public/fish/js/save.js";
import { ORDER, JOURNEY, nextPlace, prevPlace, isOpen, rankFor, goalText, openedText, legendHint, legendsLanded, topFish, foundHere, foundAll,
  newPlaces, untoldOpens, startHour, stepHour, isBigFish, sizeLine, revealText } from "../../public/fish/js/journey.js";
import { SPECIES, JUNK, byId } from "../../public/fish/js/species.js";
import { fishingOf } from "../../public/fish/js/fishing.js";
import { PLACES, PLACE_IDS, rng } from "../../public/fish/js/places.js";

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
check(loadSave(null).artStyle === "ghibli", "new saves default to Ghibli");
check(loadSave({ casts: 12 }).artStyle === "ghibli", "old saves without a style default to Ghibli");
check(loadSave(text(loadSave({ artStyle: "original" }))).artStyle === "original", "an explicit Original choice survives reload");
const styled = loadSave({ artStyle: "ghibli", casts: 12, journal: { perch: { n: 2, kg: 0.4, cm: 25 } } });
check(loadSave(text(styled)).artStyle === "ghibli", "Ghibli survives a save and reload");
check(styled.casts === 12 && styled.journal.perch.n === 2, "the art preference keeps fishing progress");
check(loadSave({ artStyle: "unknown" }).artStyle === "ghibli", "an unknown art style falls back to Ghibli");

/* ---------------- 1. today's saves ---------------- */
section("1. today's saves load as before");
{
  check(SAVE_KEY === "fish.v1", "the save key stays fish.v1");
  const b = blank();
  check(same(without(b, "place", "places", "artStyle", "reelSide"), todayLoad(null)) && b.place === "loon" && same(b.places, {}), "blank() is today's new save plus art style, reel side and places");
  const fresh = loadSave(null);
  check(same(without(fresh, "places"), without(blank(), "places")) && same(fresh.places, { loon: { open: 1, d: 0, kg: 0, id: null, n: 0, lg: 0 } }),
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
    if (same(without(got, "place", "places", "artStyle", "reelSide"), want)) ok++; else bad.push(name);
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
    if (same(without(loadSave(s), "place", "places", "artStyle", "reelSide"), todayLoad(s)) && same(without(loadSave(JSON.stringify(s)), "place", "places", "artStyle", "reelSide"), todayLoad(JSON.parse(JSON.stringify(s))))) agree++;
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
  check(same(without(s, "place", "places", "artStyle", "reelSide"), OLD), "every old value is kept (derbyBest 8.4, biggest walleye 3.6, counts, settings, seen)");
  check(same(s.places.loon, { open: 1, d: 8.4, kg: 3.6, id: "walleye", n: 7, lg: 3 }), `places.loon is d 8.4, kg 3.6, walleye, n 7, lg 3: ${text(s.places.loon)}`);
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
  check(same(nan.places.loon, { open: 1, d: 0, kg: 0, id: null, n: 2, lg: 0 }), `NaN, negative and unknown values at Loon Lake become 0 or null: ${text(nan.places.loon)}`);
  check(same(nan.places.stumps, { open: 1, d: 0, kg: 0, id: null, n: 0, lg: 0 }), `Infinity, NaN, a junk id and lg 7 at Stump Bay are dropped: ${text(nan.places.stumps)}`);
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
  check(same(s.places.loon, { open: 1, d: 0, kg: 0.4, id: "perch", n: 1, lg: 0 }), "Loon Lake's record: 1 fish, the biggest a 0.4 kg perch");
  r = recordCatch(s, "loon", { id: "walleye", kg: 2.6, cm: 58 });
  check(r.close && r.opened === null && !isOpen(s, "stumps"), "a 2.6 kg walleye (74% of 3.5 kg) is a close call");
  check(goalText("loon", "close") === "Close! Land a fish of 3.5 kg or more to open Stump Bay.", "the close call reads \"Close! Land a fish of 3.5 kg or more to open Stump Bay.\"");
  r = recordCatch(s, "loon", { id: "walleye", kg: 2.3, cm: 55 });
  check(!r.close && !r.record && r.oldKg === 2.6, "2.3 kg (66%) is not close, and not a record");
  r = recordCatch(s, "loon", { id: "walleye", kg: 3.5, cm: 66 });
  check(r.record && r.oldKg === 2.6 && r.opened === "stumps" && isOpen(s, "stumps"), "a 3.5 kg walleye is a NEW RECORD (old 2.6 kg) and opens Stump Bay");
  check(same(s.places.stumps, { open: 1, d: 0, kg: 0, id: null, n: 0, lg: 0 }), "Stump Bay gets an open, empty record");
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
    && goalText("river", "card") === "To open: land a fish of 8 kg or more at Cedar River." && goalText("sea") === "", "the goal lines, and none at Gull Rock");
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

console.log(fails.length ? `\n${fails.length} of ${passes + fails.length} checks failed` : `\nAll ${passes} checks passed`);
process.exit(fails.length ? 1 : 0);
