// First Breath: the words (design.md 1.3, 15.4; the facts-and-tone spec, "The word for the person carrying the
// baby"). Every registered string (core/text.js allStrings(), which holds the stage and ending tables) and every
// shown fact, filled with each of the four carer words, has no banned pronoun as a whole word: she, her, hers,
// herself, he, him, his, himself, they, them, their, theirs or themselves. The Sources screen's headings are part of
// that scan (sources.list once said "Where they come from"). The carer word applies to every string: with "mum",
// stage 6's answered phrase reads "Your mum feels you."
// It also checks (tasks.md 5.1, design.md 15.4, 18):
// - every string id named in core/, ui/ and main.js resolves in core/text.js (the base table or a stage's text
//   table), and so does every id the game hands the host in whole bot runs (skills 1, 0.5 and 0, and one-button):
//   prompts and their textKeys, sub-goal lines, captions (a string or a fact) and the run result's part labels;
// - no shown string keeps an unfilled {var}: a string's named vars are all given where the host says it, and every
//   line from those runs, filled with its event's vars and each carer word, has none left;
// - no string or fact has an em dash, and each stays plain: no raw id, no "undefined", "null" or "NaN", no stray
//   spaces;
// - the banned words of 15.4 in every string and fact, with each carer word; no "fastest", "winner", win, wins, won,
//   "beat the" or "beats the" in stage 1 and 2 lines; "Apgar" only in end.apgar; sentences of at most 16 words.
// node qa/first-breath/text.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allStrings, say, CARERS, has, fill } from "../../public/first-breath/core/text.js";
import { shown, byId, FACTS } from "../../public/first-breath/core/facts.js";
import { createRun } from "../../public/first-breath/core/run.js";
import { createBot, playStep } from "../../public/first-breath/core/bots.js";

const FILE = "qa/first-breath/text.test.mjs";
let passed = 0;
const failed = [];
function check(name, fn) {
  try { fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}

const PRONOUN = /\b(she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themselves)\b/i;
const WORDS = Object.keys(CARERS);

check("every registered string, with each of the four carer words, has no banned pronoun", () => {
  const ids = allStrings().map((s) => s.id);
  assert.ok(ids.length > 100, `only ${ids.length} strings registered`);
  const hits = [];
  for (const carer of WORDS) {
    for (const id of ids) {
      const text = say(id, {}, { carer });
      const m = PRONOUN.exec(text);
      if (m) hits.push(`${carer} ${id}: "${text}" (${m[0]})`);
    }
  }
  assert.deepEqual(hits, [], hits.slice(0, 8).join("\n"));
});

check("every shown fact, with each of the four carer words, has no banned pronoun", () => {
  const hits = [];
  for (const carer of WORDS) {
    const facts = shown({ carer });
    assert.ok(facts.length > 20, `only ${facts.length} facts shown`);
    for (const f of facts) {
      const m = PRONOUN.exec(f.text);
      if (m) hits.push(`${carer} ${f.id}: "${f.text}" (${m[0]})`);
    }
  }
  assert.deepEqual(hits, [], hits.slice(0, 8).join("\n"));
});

check("the Sources screen's headings name no pronoun", () => {
  for (const id of ["sources.title", "sources.note", "sources.list"]) {
    const text = say(id);
    assert.notEqual(text, id, `${id} is registered`);
    assert.ok(!PRONOUN.test(text), `${id}: "${text}"`);
  }
});

check('the carer word applies to every string: with "mum", stage 6 says "Your mum feels you."', () => {
  assert.equal(say("answer.feels", {}, { carer: "mum" }), "Your mum feels you.");
  assert.equal(say("answer.feels", {}, {}), "Your mother feels you.");
  for (const id of allStrings().map((s) => s.id)) {
    for (const carer of WORDS) assert.ok(!/\{carer\}|\{Carer\}/.test(say(id, {}, { carer })), `${id} keeps a {carer} slot`);
  }
});

// ---- the ids the code names, and the ids whole runs hand the host
const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/first-breath");
const CODE = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".js") && !/\.(facts|text)\.js$/.test(p) && !p.endsWith(path.join("core", "text.js"))) {
      CODE.push({ file: path.relative(GAME, p), src: fs.readFileSync(p, "utf8").replace(/^\s*\/\/.*$/gm, "") });
    }
  }
})(GAME);
const SHARED = /^(title|settings|tap|ui|card|overlay|almost|pause|hud|cue|grade|part|mark|result|stages|sources|ending)\./;

check("every string id named in core/, ui/ and main.js resolves in core/text.js", () => {
  const bad = [];
  const CALL = /\b(?:say|has|textOf)\(\s*["'`]([A-Za-z0-9_]+\.[A-Za-z0-9_.]*[A-Za-z0-9_])["'`](?!\s*\+)/g;
  const LIT = /["'`]([a-z]+\.[A-Za-z0-9_.]*[A-Za-z0-9_])["'`](?!\s*\+)/g;
  let n = 0;
  for (const { file, src } of CODE) {
    for (const m of src.matchAll(CALL)) { n++; if (!has(m[1])) bad.push(`${file}: say("${m[1]}")`); }
    for (const m of src.matchAll(LIT)) if (SHARED.test(m[1]) && !has(m[1]) && !byId(m[1])) bad.push(`${file}: "${m[1]}"`);
  }
  assert.ok(n > 60, `only ${n} say() calls with an id`);
  assert.deepEqual([...new Set(bad)], []);
});

// Every id a whole run hands the host: { kind, id, vars }.
const HANDED = new Map();
const hand = (kind, id, vars = null) => { if (typeof id === "string" && !HANDED.has(kind + " " + id)) HANDED.set(kind + " " + id, { kind, id, vars }); };
for (const [skill, seed, settings] of [[1, 7, {}], [0.5, 3, {}], [0, 4, {}], [1, 5, { oneButton: true }]]) {
  const run = createRun({ seed, settings, start: "new" });
  const bot = createBot(skill, seed);
  for (let i = 0; i < 60 * 60 * 20 && run.screen !== "result"; i++) {
    playStep(run, bot);
    if (run.state && run.mod && (run.screen === "stage" || run.screen === "ending")) {
      const p = run.mod.prompt(run.state) || {};
      hand("prompt", p.text);
      hand("prompt", p.textKeys);
    }
    for (const e of run.events) {
      if (e.name === "subgoal") hand("subgoal", e.text);
      else if (e.name === "caption") hand("caption", e.id, e.vars || null);
    }
    run.events.length = 0;
  }
  for (const s of run.summary().stages) for (const p of s.parts || []) hand("part", p.label);
}

check("every id whole runs hand the host resolves: prompts, sub-goal lines, captions and part labels", () => {
  const kinds = new Set([...HANDED.values()].map((h) => h.kind));
  assert.deepEqual([...kinds].sort(), ["caption", "part", "prompt", "subgoal"]);
  assert.ok(HANDED.size > 150, `only ${HANDED.size} ids`);
  const bad = [...HANDED.values()].filter((h) => !(has(h.id) || (h.kind === "caption" && byId(h.id)))).map((h) => `${h.kind} "${h.id}"`);
  assert.deepEqual(bad, []);
});

check("no shown string keeps an unfilled {var}", () => {
  const bad = [];
  // a run line, filled as the host fills it
  for (const h of HANDED.values()) {
    if (!has(h.id)) continue;
    for (const carer of WORDS) {
      const text = say(h.id, h.vars || {}, { carer });
      if (/\{\w+\}/.test(text)) bad.push(`${h.kind} ${h.id}: "${text}"`);
    }
  }
  // a string with named vars: the host gives each one where it says the string
  const corpus = CODE.map((c) => c.src).join("\n");
  let named = 0;
  for (const { id, text } of allStrings()) {
    const vars = [...new Set([...fill(text, {}, {}).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
    if (!vars.length) continue;
    named++;
    const at = [...corpus.matchAll(new RegExp(`["'\`]${id.replace(/\./g, "\\.")}["'\`]`, "g"))].map((m) => corpus.slice(m.index, m.index + 200));
    const given = at.some((w) => vars.every((v) => new RegExp(`\\b${v}\\b\\s*[:,}]`).test(w)));
    if (!given) bad.push(`${id}: {${vars.join("}, {")}} is not given where it is said (${at.length} uses)`);
  }
  assert.ok(named >= 8, `only ${named} strings with named vars`);
  assert.deepEqual([...new Set(bad)], []);
});

const LINES = () => {
  const out = [];
  for (const carer of WORDS) {
    for (const { id } of allStrings()) out.push({ id, carer, text: say(id, {}, { carer }) });
    for (const f of FACTS) out.push({ id: f.id, carer, text: fill(f.text, {}, { carer }), fact: true });
  }
  return out;
};

check("no string or fact has an em dash, and each stays plain (no raw id, no undefined, no stray spaces)", () => {
  const bad = [];
  const RAW = /\b(?:swim|egg|split|root|grow|answer|turn|birth|end|ending|title|settings|tap|ui|card|overlay|almost|pause|hud|cue|grade|part|mark|result|stages|sources)\.[a-z][A-Za-z0-9]*\b/;
  for (const l of LINES()) {
    if (/\u2014/.test(l.text)) bad.push(`${l.id}: em dash`);
    if (RAW.test(l.text)) bad.push(`${l.id}: a raw id in "${l.text}"`);
    if (/\b(undefined|null|NaN)\b|\[object/.test(l.text)) bad.push(`${l.id}: "${l.text}"`);
    if (!l.text.trim() || l.text !== l.text.trim() || / {2}/.test(l.text)) bad.push(`${l.id}: spaces in "${l.text}"`);
  }
  assert.deepEqual([...new Set(bad)], []);
});

const BANNED = /\b(die|dies|died|dying|dead|death|kill\w*|lose|loses|losing|lost|loser|fail\w*|miscarr\w*|abort\w*|sex\w*|pain\w*|hurt\w*|danger\w*|sick\w*|viab\w*|prematur\w*|NICU|invad\w*|invas\w*|attack\w*|destroy\w*|defeat\w*|conquer\w*|enem\w*|fight\w*|battle\w*)/i;
const RACE = /\b(fastest|winner|win|wins|won|beat the|beats the)\b/i;
check("the banned words, the race words in stages 1 and 2, Apgar only in end.apgar, sentences of at most 16 words", () => {
  const bad = [];
  const words = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  for (const l of LINES()) {
    let m;
    if ((m = BANNED.exec(l.text))) bad.push(`${l.carer} ${l.id}: "${m[0]}"`);
    if (/^(swim|egg)\./.test(l.id) && (m = RACE.exec(l.text))) bad.push(`${l.id}: "${m[0]}"`);
    if (/apgar/i.test(l.text) && l.id !== "end.apgar") bad.push(`${l.id}: Apgar`);
    for (const s of l.text.split(/(?<=[.!?])\s+/)) if (words(s) > 16) bad.push(`${l.carer} ${l.id}: a sentence of ${words(s)} words`);
  }
  assert.deepEqual([...new Set(bad)], []);
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks`);
}
