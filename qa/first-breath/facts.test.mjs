// First Breath: the facts and their sources (design.md 15.1 to 15.3, 18; tasks.md 5.1). It reads every fact table
// (core/stages/<id>.facts.js and core/ending.facts.js, gathered by core/facts.js) and checks:
// - every fact has an id that names its stage, a text, a gaDay inside its stage's span (and a gaEnd after it for a
//   span), a where, a src list whose every key resolves in core/sources.js, access R or A (never S) and a checked
//   flag; no id is in two tables;
// - each label comes from clock.label or clock.range, and every "Day" label says "after fertilization"; no text starts
//   with "Week" or "Day"; a span stays on one side of gaDay 42;
// - each fact is at most 20 words and each sentence at most 16, with every carer word; no em dash;
// - a size comparison names the NHS ("a plum, the NHS says" or "The NHS compares this to") and cites an NHS page;
//   cells (stages 1 to 3) get no object comparison; the trimester cards say "about";
// - swim.frame, egg.frame and end.apgar are run result facts, and the run result screen names them; the facts a stage
//   has no room to show whole in real time (design.md 12, qa/first-breath/pacing.test.mjs) are result facts too, and
//   the run result's "What was real" lists each played stage's;
// - every fact id the stages, the ending, the run and the screens name resolves: a scan of the code's string
//   literals, and the fact events of every stage played by the bot at skills 1, 0.7, 0.5 and 0 (each such event names
//   a shown caption fact of its own stage); every caption fact is shown by some bot run, and every card and overlay
//   fact by a whole run;
// - a checked: false fact (or an S one, or an unknown id) is never shown: isShown, line() and shown() leave it out,
//   and the run drops its fact event.
// node qa/first-breath/facts.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FACTS, byId, label, isShown, line, shown, gather } from "../../public/first-breath/core/facts.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import { FACT_TABLES, STAGES, ENDING } from "../../public/first-breath/core/stages/index.js";
import { label as clockLabel, range } from "../../public/first-breath/core/clock.js";
import { CARERS, fill, has } from "../../public/first-breath/core/text.js";
import { DEFAULT_CARRY } from "../../public/first-breath/core/carry.js";
import { createBot, playStep } from "../../public/first-breath/core/bots.js";
import { createRun } from "../../public/first-breath/core/run.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { DT } from "../../public/first-breath/core/clock.js";

const FILE = "qa/first-breath/facts.test.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GAME = path.join(ROOT, "public/first-breath");
let passed = 0;
const failed = [];
function check(name, fn) {
  try { fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}

const MODS = [...STAGES, ENDING];
const IDS = MODS.map((m) => m.meta.id);
const WHERE = new Set(["card", "caption", "overlay", "end", "result"]);
const prefixOf = (stage) => (stage === "ending" ? "end." : stage + ".");
const ALL = FACT_TABLES.flat();
const words = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);

check("the tables come in stage order, one per stage and the ending, and no id is in two tables", () => {
  assert.equal(FACT_TABLES.length, MODS.length);
  FACT_TABLES.forEach((table, i) => {
    assert.ok(Array.isArray(table) && table.length > 0, `${IDS[i]}: no facts`);
    for (const f of table) assert.equal(f.stage, IDS[i], `${f.id} is in the ${IDS[i]} table`);
  });
  const seen = new Map();
  for (const f of ALL) { assert.ok(!seen.has(f.id), `${f.id} twice`); seen.set(f.id, f); }
  assert.equal(FACTS.length, ALL.length, "core/facts.js gathers every fact");
});

check("every fact has an id, a text, a gaDay in its stage, a where, sources, access R or A and a checked flag", () => {
  const bad = [];
  for (const f of ALL) {
    const mod = MODS.find((m) => m.meta.id === f.stage);
    const why = [];
    if (typeof f.id !== "string" || !f.id.startsWith(prefixOf(f.stage))) why.push("id");
    if (typeof f.text !== "string" || !f.text.trim()) why.push("text");
    if (!Number.isFinite(f.gaDay) || !mod || f.gaDay < mod.meta.ga.start || f.gaDay > mod.meta.ga.end) why.push(`gaDay ${f.gaDay}`);
    if ("gaEnd" in f && !(Number.isFinite(f.gaEnd) && f.gaEnd >= f.gaDay)) why.push(`gaEnd ${f.gaEnd}`);
    if (!WHERE.has(f.where)) why.push(`where ${f.where}`);
    if (!Array.isArray(f.src) || !f.src.length) why.push("no src");
    if (f.access !== "R" && f.access !== "A") why.push(`access ${f.access}`);
    if (typeof f.checked !== "boolean") why.push("checked flag");
    if ("fertilized" in f && typeof f.fertilized !== "boolean") why.push("fertilized");
    if (why.length) bad.push(`${f.id}: ${why.join(", ")}`);
  }
  assert.deepEqual(bad, []);
});

check("every source key resolves in core/sources.js to a name and an https link", () => {
  const bad = [];
  for (const f of ALL) for (const k of f.src) {
    const s = SOURCES[k];
    if (!s || typeof s.name !== "string" || !s.name || !/^https:\/\/\S+$/.test(s.url || "")) bad.push(`${f.id}: "${k}"`);
  }
  assert.deepEqual(bad, []);
  for (const f of shown()) assert.equal(f.links.length, f.src.length, `${f.id}: every source has a link`);
});

check("labels come from the clock; every Day label says after fertilization; no text starts with Week or Day", () => {
  const bad = [];
  for (const f of ALL) {
    const fert = typeof f.fertilized === "boolean" ? f.fertilized : f.gaDay > 14;
    const want = Number.isFinite(f.gaEnd) && f.gaEnd !== f.gaDay ? range(f.gaDay, f.gaEnd) : clockLabel(f.gaDay, { fertilized: fert });
    const got = label(f);
    if (got !== want || !got) bad.push(`${f.id}: label "${got}", want "${want}"`);
    if (/^Days?\b/.test(got) && !/after fertilization/.test(got)) bad.push(`${f.id}: "${got}"`);
    if (/^\s*(Week|Day)s?\b/i.test(f.text)) bad.push(`${f.id}: text starts "${f.text.slice(0, 12)}"`);
  }
  assert.deepEqual(bad, []);
});

check("a span never crosses gaDay 42", () => {
  const spans = ALL.filter((f) => Number.isFinite(f.gaEnd) && f.gaEnd !== f.gaDay);
  assert.ok(spans.length >= 2, `only ${spans.length} spans`);
  const bad = spans.filter((f) => (f.gaDay < 42) !== (f.gaEnd < 42));
  assert.deepEqual(bad.map((f) => `${f.id} ${f.gaDay} to ${f.gaEnd}`), []);
});

check("each fact is at most 20 words and each sentence at most 16, with every carer word; no em dash", () => {
  const bad = [];
  for (const carer of Object.keys(CARERS)) {
    for (const f of ALL) {
      const t = fill(f.text, {}, { carer });
      if (/\{\w+\}/.test(t)) bad.push(`${carer} ${f.id}: unfilled "${t}"`);
      if (words(t) > 20) bad.push(`${carer} ${f.id}: ${words(t)} words`);
      for (const s of sentences(t)) if (words(s) > 16) bad.push(`${carer} ${f.id}: a sentence of ${words(s)} words`);
      if (/[—]/.test(t)) bad.push(`${f.id}: em dash`);
      if (!/[.!?]$/.test(t.trim())) bad.push(`${f.id}: no full stop`);
    }
  }
  assert.deepEqual([...new Set(bad)], []);
});

const OBJECT = /\b(seed|raspberry|plum|kiwi|banana|lime|lemon|avocado|apple|orange|grape|pea|bean|blueberry|melon|papaya|mango|cabbage|pumpkin|watermelon|poppy|lentil|fig|pear|coconut|grapefruit|onion|pomegranate|aubergine|courgette|cauliflower|lettuce|pineapple|squash|corn|swede|turnip|marrow|olive|prune|peach|nectarine|cherry|strawberry|apricot)s?\b/i;
check('a size comparison names the NHS and cites an NHS page; cells get none; trimester cards say "about"', () => {
  const comp = ALL.filter((f) => OBJECT.test(f.text));
  assert.ok(comp.length >= 4, `only ${comp.length} size comparisons`);
  const bad = [];
  for (const f of comp) {
    if (!/, the NHS says\b|\bThe NHS compares this to\b/.test(f.text)) bad.push(`${f.id}: "${f.text}"`);
    if (!f.src.some((k) => /^NHS week \d+$/.test(k))) bad.push(`${f.id}: no NHS week page`);
    if (["swim", "egg", "split"].includes(f.stage)) bad.push(`${f.id}: a cell with a comparison`);
  }
  const tri = ALL.filter((f) => /trimester/i.test(f.text));
  assert.equal(tri.length, 3, tri.map((f) => f.id).join(", "));
  for (const f of tri) {
    if (f.where !== "card") bad.push(`${f.id}: a trimester line not on a card`);
    if (!/\babout\b/.test(f.text)) bad.push(`${f.id}: no "about"`);
  }
  assert.deepEqual(bad, []);
});

check("swim.frame, egg.frame and end.apgar are shown run result facts, and the run result names them", () => {
  const screens = fs.readFileSync(path.join(GAME, "ui/screens.js"), "utf8");
  for (const id of ["swim.frame", "egg.frame", "end.apgar"]) {
    const f = byId(id);
    assert.ok(f && isShown(f), `${id} is shown`);
    assert.equal(f.where, "result", `${id}: where`);
    assert.ok(screens.includes(`"${id}"`), `ui/screens.js names ${id}`);
  }
  // the facts with no room to show whole in their stage (design.md 12): "What was real" lists them with their stage
  const more = ALL.filter((f) => f.where === "result" && !["egg.frame", "end.apgar", "swim.frame"].includes(f.id)).map((f) => f.id);
  assert.deepEqual(more.sort(), ["answer.hic", "answer.outside", "egg.cilia", "egg.day", "egg.place",
    "egg.pronuclei", "egg.seal", "egg.signal", "egg.size", "egg.stick", "egg.wave", "end.fluid", "end.seconds", "grow.flow", "grow.frame",
    "grow.never", "grow.w11kick", "root.buds", "root.glands", "root.grows", "root.size", "root.tube", "split.inner", "swim.few",
    "swim.hyper", "swim.ready", "swim.walls", "swim.warm"]);
  assert.ok(screens.includes('f.where === "result"'), "the run result lists the played stages' result facts");
});

// ---- every fact id the code names
const SOUND = fs.readFileSync(path.join(GAME, "ui/sound.js"), "utf8");
const soundIds = new Set([...SOUND.matchAll(/["'`]([a-z]+\.[A-Za-z0-9_.]+)["'`]/g)].map((m) => m[1]));
check("every stage-shaped id in the code resolves as a fact, a string or a sound (a scan of core/, ui/ and main.js)", () => {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".js") && !/\.(facts|text)\.js$/.test(p) && !p.endsWith("ui/sound.js")) files.push(p);
    }
  };
  walk(path.join(GAME, "core"));
  walk(path.join(GAME, "ui"));
  files.push(path.join(GAME, "main.js"));
  const RE = /["'`]((?:swim|egg|split|root|grow|answer|turn|birth|end|ending)\.[A-Za-z0-9_.]*[A-Za-z0-9_])["'`](?!\s*\+)/g;
  const bad = [];
  let facts = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");
    for (const m of src.matchAll(RE)) {
      const id = m[1];
      if (byId(id)) { facts++; continue; }
      if (!has(id) && !soundIds.has(id)) bad.push(`${path.relative(GAME, f)}: "${id}"`);
    }
  }
  assert.ok(facts >= 40, `only ${facts} fact ids named in the code`);
  assert.deepEqual([...new Set(bad)], []);
});

// Every raw fact event of each stage (before core/run.js filters them), played by the bot.
const emitted = new Map();
const raw = [];
for (const mod of MODS) {
  for (const [skill, seed] of [[1, 1], [1, 2], [0.7, 3], [0.5, 4], [0, 5]]) {
    const st = mod.create(seed, DEFAULT_CARRY, { assist: false, oneButton: false, motherPhase: 0 });
    const bot = createBot(skill, seed);
    const cap = Math.ceil((mod.meta.capS + 5) / DT);
    for (let i = 0; i < cap && !mod.result(st).done; i++) {
      mod.step(st, bot.intents(mod, st));
      for (const e of st.events) if (e.name === "fact") { raw.push({ ...e, stage: mod.meta.id }); emitted.set(e.id, (emitted.get(e.id) || 0) + 1); }
      st.events.length = 0;
    }
  }
}

check("every fact event a stage emits names a shown caption fact of that stage", () => {
  assert.ok(raw.length > 100, `only ${raw.length} fact events`);
  const bad = [];
  for (const e of raw) {
    const f = byId(e.id);
    if (!f) { bad.push(`${e.stage}: unknown "${e.id}"`); continue; }
    if (!isShown(f)) bad.push(`${e.stage}: "${e.id}" is not shown`);
    if (f.stage !== e.stage) bad.push(`${e.stage}: "${e.id}" belongs to ${f.stage}`);
    if ((e.where || f.where) !== f.where || f.where !== "caption") bad.push(`${e.stage}: "${e.id}" where ${e.where} (fact ${f.where})`);
  }
  assert.deepEqual([...new Set(bad)], []);
});

check("every caption fact is shown by some bot run", () => {
  const never = ALL.filter((f) => f.where === "caption" && !emitted.has(f.id)).map((f) => f.id);
  assert.deepEqual(never, []);
});

check("whole runs show every card and overlay fact, and only shown facts", () => {
  const seen = new Set(), where = {};
  for (const [skill, seed, oneButton] of [[1, 1, false], [0.5, 2, false], [1, 3, true]]) {
    const run = createRun({ seed, settings: { oneButton }, start: "new" });
    const bot = createBot(skill, seed);
    for (let i = 0; i < 60 * 60 * 20 && run.screen !== "result"; i++) {
      playStep(run, bot);
      for (const e of run.events) if (e.name === "fact") { seen.add(e.id); where[e.id] = e.where; }
      run.events.length = 0;
    }
    assert.equal(run.screen, "result", `skill ${skill} seed ${seed}: reached ${run.screen}`);
    const ids = run.summary().facts;
    const bad = ids.filter((id) => !isShown(byId(id)));
    assert.deepEqual(bad, [], `run facts that are not shown`);
  }
  const missing = ALL.filter((f) => (f.where === "card" || f.where === "overlay") && !seen.has(f.id)).map((f) => f.id);
  assert.deepEqual(missing, [], "card and overlay facts never shown");
  for (const f of ALL.filter((x) => x.where === "card" || x.where === "overlay")) assert.equal(where[f.id], f.where, f.id);
});

// ---- a checked: false fact can never be shown
check("a checked: false fact, an S fact or an unknown id is never shown", () => {
  const base = byId("turn.focus");
  const off = { ...base, id: "turn.off", checked: false };
  const s = { ...base, id: "turn.s", access: "S" };
  assert.equal(isShown(off), false);
  assert.equal(isShown(s), false);
  assert.equal(isShown(null), false);
  assert.equal(line("no.such.fact"), null);
  const t = gather([[off, s, base]]);
  assert.deepEqual(t.filter(isShown).map((f) => f.id), ["turn.focus"]);
  // the shipped tables: shown() is exactly the checked R and A facts, and line() is null for the rest
  const want = ALL.filter((f) => f.checked === true && (f.access === "R" || f.access === "A")).map((f) => f.id);
  assert.deepEqual(shown().map((f) => f.id), want);
  for (const f of ALL.filter((x) => !isShown(x))) assert.equal(line(f.id), null, f.id);
  // the WHO weights stay out until reviewed (15.1, tasks.md 5.10)
  const w = byId("turn.weight");
  assert.ok(!w || w.checked === false, "turn.weight is shipped only after the review");
  if (w) assert.ok(!shown().some((f) => f.id === "turn.weight"));
});

check("the run drops a fact event that names an unknown or unshown fact", () => {
  const run = createRun({ seed: 1, settings: {}, start: { practice: "turn" } });
  for (let i = 0; i < 600 && run.screen !== "stage"; i++) run.step(makeIntents());
  assert.equal(run.screen, "stage", `screen ${run.screen}`);
  run.events.length = 0;
  run.state.events.push({ name: "fact", id: "turn.weight", where: "caption", t: run.state.t });
  run.state.events.push({ name: "fact", id: "no.such.fact", where: "caption", t: run.state.t });
  run.state.events.push({ name: "fact", id: "turn.focus", where: "caption", t: run.state.t });   // a shown one gets through
  run.step(makeIntents());
  const ids = run.events.filter((e) => e.name === "fact").map((e) => e.id);
  assert.ok(ids.includes("turn.focus"), `the shown fact is passed on (${ids.join(", ")})`);
  assert.ok(!ids.includes("turn.weight") && !ids.includes("no.such.fact"), ids.join(", "));
  assert.ok(!run.summary().facts.includes("turn.weight") && !run.summary().facts.includes("no.such.fact"));
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks (${ALL.length} facts, ${raw.length} fact events)`);
}
