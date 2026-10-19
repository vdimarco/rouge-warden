// First Breath: the prompt words for each way to play (design.md 5.3, 16.4; review F13, F15, F17, K2). It plays a
// whole run with the reference bot, once as is and once in one-button mode, gathers every prompt and sub-goal line
// the stages give, and checks the words the host (main.js promptText) would show:
// - on a desktop (".keys", "Keys" or textKeys): every prompt that names a touch (tap, drag, thumb, touch, screen)
//   has a desktop form, and that form names a key (Space or an arrow) and no touch;
// - in one-button mode (".one"): every drag, drag-and-hold or move (the action stages) prompt that names a drag, an
//   arrow, the mouse or pointing has a one-button form, and that form names none of them (the run steers; any key
//   or touch holds);
// - a sub-goal line names no gesture without a desktop form;
// - the stage 7 rest, a hold that needs a fresh touch, never asks to keep the thumb from the turn down;
// - every new string keeps the tone rules: no em dash, no "they" for the carer, short sentences.
// node qa/first-breath/prompts.test.mjs
import assert from "node:assert/strict";
import { createRun } from "../../public/first-breath/core/run.js";
import { createBot, playStep } from "../../public/first-breath/core/bots.js";
import { has, say, allStrings } from "../../public/first-breath/core/text.js";

const FILE = "qa/first-breath/prompts.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}

// Every prompt ({ gesture, text, textKeys }) and every shown sub-goal line of one whole bot run.
function gather(settings) {
  const run = createRun({ seed: 7, settings, start: "new" });
  const bot = createBot(1, 7);
  const prompts = new Map(), subs = new Set();
  for (let i = 0; i < 60 * 60 * 20 && run.screen !== "result"; i++) {
    playStep(run, bot);
    for (const e of run.events) {
      if (e.name === "prompt" && e.text && e.gesture && e.gesture !== "none") {
        prompts.set(`${e.gesture}|${e.text}|${e.textKeys || ""}`, { gesture: e.gesture, text: e.text, textKeys: e.textKeys || null });
      } else if (e.name === "subgoal" && e.state === "shown" && e.text) subs.add(e.text);
    }
    run.events.length = 0;
  }
  assert.equal(run.screen, "result", "the run reaches its result");
  return { prompts: [...prompts.values()], subs: [...subs] };
}

const keysForm = (id) => [id + ".keys", id + "Keys"].find((k) => has(k)) || null;
const TOUCH = /\b(tap|drag|thumb|finger|touch|screen)\b/i;
const NAMES_KEY = /\b(Space|arrow|arrows)\b/;
const STEERS = /\b(drag|arrow|arrows|mouse|point)\b/i;

const plain = gather({});
const one = gather({ oneButton: true });
const all = [...plain.prompts, ...one.prompts];

await check("the run gives prompts in every stage's gestures", () => {
  const g = new Set(all.map((p) => p.gesture));
  for (const want of ["drag", "tap", "hold", "dragHold"]) assert.ok(g.has(want), `no ${want} prompt`);
  assert.ok(all.length >= 20, `only ${all.length} prompts`);
});

await check("on a desktop every prompt that names a touch has a desktop form that names a key", () => {
  const bad = [];
  for (const p of all) {
    const k = (p.textKeys && has(p.textKeys) && p.textKeys) || keysForm(p.text);
    if (!TOUCH.test(say(p.text))) continue;
    if (!k) { bad.push(`${p.text} ("${say(p.text)}") has no desktop form`); continue; }
    const w = say(k);
    if (!NAMES_KEY.test(w)) bad.push(`${k} ("${w}") names no key`);
    if (/\b(tap|thumb|finger|touch|screen)\b/i.test(w)) bad.push(`${k} ("${w}") names a touch`);
  }
  assert.deepEqual([...new Set(bad)], []);
});

await check("in one-button mode every drag or drag-and-hold prompt that steers has a one-button form", () => {
  const bad = [];
  for (const p of one.prompts) {
    if (p.gesture !== "drag" && p.gesture !== "dragHold" && p.gesture !== "move") continue;
    const k = (p.textKeys && has(p.textKeys) && p.textKeys) || keysForm(p.text);
    const steers = STEERS.test(say(p.text)) || (k && STEERS.test(say(k)));
    if (!steers) continue;
    const o = p.text + ".one";
    if (!has(o)) { bad.push(`${p.text} ("${say(p.text)}") has no one-button form`); continue; }
    if (STEERS.test(say(o))) bad.push(`${o} ("${say(o)}") still names a drag, an arrow or the mouse`);
    if (!/\bhold\b/i.test(say(o))) bad.push(`${o} ("${say(o)}") does not say to hold`);
  }
  assert.deepEqual([...new Set(bad)], []);
  // the guard is the case the review found: "Turn with the arrow keys, or point with the mouse." in one-button mode
  assert.equal(say("egg.guard.one"), "Hold to guard your shell.");
});

await check("a sub-goal line that names a gesture has a desktop form", () => {
  const bad = [];
  for (const id of [...plain.subs, ...one.subs]) {
    if (/\b(tap|drag|touch)\b/i.test(say(id)) && !keysForm(id)) bad.push(`${id} ("${say(id)}")`);
  }
  assert.deepEqual([...new Set(bad)], []);
});

await check("the stage 7 rest asks for a fresh touch, not the thumb kept from the turn", () => {
  assert.ok(!/keep your thumb/i.test(say("turn.rest")), say("turn.rest"));
  assert.equal(say("turn.rest"), "Rest. Touch and hold if you like.");
  assert.equal(say("turn.rest.keys"), "Rest. Hold Space if you like.");
});

await check("the desktop and one-button forms keep the tone rules", () => {
  const bad = [];
  for (const { id, text } of allStrings()) {
    if (!/(\.keys|Keys|\.one)$/.test(id)) continue;
    if (/[—–]/.test(text)) bad.push(`${id}: a dash`);
    if (/\bthey\b|\bthem\b|\btheir\b/i.test(text)) bad.push(`${id}: a pronoun`);
    for (const s of text.split(/(?<=[.!?])\s+/)) if (s.split(/\s+/).filter(Boolean).length > 12) bad.push(`${id}: a long sentence`);
  }
  assert.deepEqual(bad, []);
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else console.log(`PASS ${FILE}: ${passed} checks`);
