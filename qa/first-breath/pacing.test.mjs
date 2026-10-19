// First Breath: fact pacing in real time (design.md 12, 15.1; stages spec "Every caption fact shows whole"). Each
// stage and the ending is played by the reference bot (skill 1) and the mid bot (skill 0.7), seeds 1 to 3, in
// practice (as the Stages menu plays it) and in whole runs (with the cards, the carry from stage to stage and the
// ending's run time line), through core/run.js. Every event goes to the real ui/captions.js the way main.js sends it
// (a caption line, a sub-goal line the prompt line does not already show, a fact caption once per stage, a sound's
// caption), at the time main.js would (after the step it came in), on a virtual clock that runs with the core clock,
// as real-time play does. The captions lay their pages out on a small fake DOM sized from the real page in portrait
// (390 × 844), landscape (844 × 390) and desktop (1280 × 800, with the desktop forms of the lines): each band's width
// and height, the 18 px (16 px fit) and desktop 20 px (18 px fit) type and its glyph widths, 3 % wider so a page never
// holds more than the real one. The checks, for each stage:
// - every caption fact the stage sends is shown whole before the stage ends (the screen leaves the stage, or the next
//   stage starts, and the overlay, the result or the next stage covers or clears the captions): each of its pages on
//   screen, for its whole reading time in all (1.5 s + 55 ms a letter; 2.4 s a one-line page in stage 1 in portrait),
//   less the 0.25 s a cut page may keep (and a frame);
// - every caption fact of the stage is sent in each of those runs, so none is silently left out.
//   node qa/first-breath/pacing.test.mjs            the check
//   node qa/first-breath/pacing.test.mjs report     also prints each stage's sends, fact reading time and misses (seed 1)
//   TIMELINE=egg:portrait:1 [TSEED=1] [TMODE=practice|run] node qa/first-breath/pacing.test.mjs
//                                                   also prints what showed, and when
// CAPTIONS_JS=<path> runs it against another copy of ui/captions.js, FB_DIR=<path> against another copy of the game
// (public/first-breath, with public/lab/kit beside it), to show a fault on old code.
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const FILE = "qa/first-breath/pacing.test.mjs";
const REPORT = process.argv.includes("report");
const TIMELINE = process.env.TIMELINE || "";     // "<stage>:<layout>:<skill>" prints what showed
let passed = 0;
const failed = [];
function check(name, fn) {
  try { fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 24).join("\n     ")}`); }
}

// ---- the virtual clock (ms)
let clock = 0, tid = 0;
const timers = new Map();
globalThis.setTimeout = (fn, ms) => { const id = ++tid; timers.set(id, { at: clock + Math.max(0, Number(ms) || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { timers.delete(id); };
Object.defineProperty(globalThis, "performance", { value: { now: () => clock }, configurable: true, writable: true });

// ---- the layouts, measured on the real page (#captions and .cap at stage start)
const LAYOUTS = {
  portrait: { W: 390, H: 844, device: "touch", textW: 346, font: 18, fit: 16,
    band: { swim: 67, egg: 68, split: 59, root: 42, grow: 68, answer: 68, turn: 59, birth: 68, ending: 67 } },
  landscape: { W: 844, H: 390, device: "touch", textW: 392, font: 18, fit: 16, band: {} },
  desktop: { W: 1280, H: 800, device: "keys", textW: 660, fitW: 592, font: 20, fit: 18, band: {} },
};
// The caption type's glyph widths (Inter 600 at 100 px, as the page lays it out here), ASCII 32 to 126 and a few
// more; a line is 3 % wider than that, so a page never holds more than the real one.
const ASCII = "25,32,52,64,65,100,66,33,37,37,54,67,32,47,32,38,66,42,62,64,67,63,64,58,64,64,32,33,67,67,67,54,100,73,66,74,72,61,59,75,75,28,58,70,57,92,76,77,65,77,65,65,66,74,73,102,72,71,65,37,38,37,48,47,35,57,62,58,62,59,39,63,61,26,26,57,26,90,61,61,62,62,40,55,35,61,59,84,57,59,57,45,36,45,67".split(",").map(Number);
const GLYPH = { "♪": 50, "♥": 102, "·": 32, "’": 29, "…": 96, "×": 67, "→": 95, "←": 95, "°": 46 };
const MARGIN = 1.03;
const widthOf = (s, px) => {
  let w = 0;
  for (const ch of s) { const c = ch.codePointAt(0); w += c >= 32 && c < 127 ? ASCII[c - 32] : GLYPH[ch] ?? 100; }
  return (w / 100) * px * MARGIN;
};
let L = LAYOUTS.portrait;

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this._text = "";
    const cls = new Set();
    this.classList = {
      add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
      toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); },
    };
    this._cls = cls;
  }
  set className(v) { this._cls.clear(); for (const c of String(v).split(/\s+/).filter(Boolean)) this._cls.add(c); }
  get className() { return [...this._cls].join(" "); }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get _font() { return this._cls.has("fit") ? L.fit : L.font; }
  get _width() { return this._cls.has("fit") && L.fitW ? L.fitW : L.textW; }
  _lines() {
    const px = this._font, max = this._width, space = widthOf(" ", px);
    let lines = 1, w = -1;
    for (const word of this._text.split(/\s+/).filter(Boolean)) {
      const ww = widthOf(word, px);
      if (w < 0) w = ww;
      else if (w + space + ww <= max) w += space + ww;
      else { lines++; w = ww; }
    }
    return lines;
  }
  getBoundingClientRect() {
    if (this.isRoot) return { height: L.band[html.dataset.stage] || 0, width: L.textW + 20 };
    return { height: this._lines() * this._font * 1.22 + 6, width: this._width + 20 };
  }
  get scrollWidth() { return Math.max(this._width, Math.ceil(Math.max(0, ...this._text.split(/\s+/).map((x) => widthOf(x, this._font))))); }
  get clientWidth() { return this._width; }
}
const html = new El("html");
globalThis.document = { documentElement: html, createElement: (t) => new El(t) };
globalThis.window = { get innerWidth() { return L.W; }, get innerHeight() { return L.H; } };
globalThis.getComputedStyle = (el) => {
  const f = el && el._font ? el._font : L.font;
  return { lineHeight: `${f * 1.22}px`, fontSize: `${f}px`, paddingTop: "3px", paddingBottom: "3px" };
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = process.env.FB_DIR ? path.resolve(process.env.FB_DIR) : path.join(HERE, "../../public/first-breath");
const MOD = process.env.CAPTIONS_JS ? path.resolve(process.env.CAPTIONS_JS) : path.join(PUB, "ui/captions.js");
const { createCaptions } = await import(pathToFileURL(MOD).href);
const { createRun } = await import(pathToFileURL(path.join(PUB, "core/run.js")).href);
const { createBot, playStep } = await import(pathToFileURL(path.join(PUB, "core/bots.js")).href);
const { say, has } = await import(pathToFileURL(path.join(PUB, "core/text.js")).href);
const { byId: factById, line: factLine, FACTS, isShown } = await import(pathToFileURL(path.join(PUB, "core/facts.js")).href);
const { STAGES } = await import(pathToFileURL(path.join(PUB, "core/stages/index.js")).href);

const PLAYING = new Set(["stage", "ending"]);
const STAGE_IDS = [...STAGES.map((m) => m.meta.id), "ending"];
const SKILLS = [1, 0.7];
const SEEDS = [1, 2, 3];
const readMs = (text) => 1500 + 55 * text.length;
const FACTS_OF = (stage) => FACTS.filter((f) => f.stage === stage && f.where === "caption" && isShown(f)).map((f) => f.id);
const CUT_SLACK_MS = 300;    // a cut page with under 0.25 s left counts as read (ui/captions.js), and a frame

// ---- a practice stage or a whole run played by the bot: per step, its core time, screen, events and the prompt
// line's ids then
function record(start, skill, seed) {
  const run = createRun({ seed, start });
  const bot = createBot(skill, seed);
  const steps = [];
  for (let i = 0; i < 60 * 60 * 20 && run.screen !== "result"; i++) {
    playStep(run, bot);
    const p = PLAYING.has(run.screen) && run.state ? run.mod.prompt(run.state) || {} : {};
    steps.push({ t: run.t, screen: run.screen, events: run.events.slice(),
      prompt: { text: p.text || null, textKeys: p.textKeys || null, gesture: p.gesture || null } });
    run.events.length = 0;
  }
  return steps;
}

// ---- the same events through the real captions, as main.js routes them
const CUE_OF = {
  bump: "cue.pack", bounce: "cue.bounce", goldIn: "cue.goldIn", seal: "cue.seal",
  "swim:swell": "cue.wave", "birth:birth.swell": "cue.wave", "root:root.link": "cue.link", "root:root.linkBeat": "cue.link",
  "grow:bell": "cue.bell", "grow:move": "cue.move", "birth:birth.open": "cue.open",
};
function replay(steps, stage, layout) {
  L = LAYOUTS[layout];
  clock = 0;
  timers.clear();
  html.dataset.stage = stage;
  const root = new El("div");
  root.isRoot = true;
  const cap = createCaptions(root, { on: true });
  const device = L.device;
  const keysForm = (id) => [id + ".keys", id + "Keys"].find((k) => has(k)) || null;
  const sayForm = (id) => (device === "keys" && keysForm(id)) || id;
  const textOf = (id, vars = {}) => (has(id) ? say(id, vars || {}, {}) : null);
  const capMs = () => (stage === "swim" ? 2500 : 4000);
  const capSeen = new Set();
  const sent = [];                       // [{ id, text, at }] every fact caption handed to the captions
  let prompt = {}, screen = "title", visible = false, endAt = null;

  const sayCaption = (id, text, extra = {}) => (text ? cap.say(id, text, { kind: "say", ms: capMs(), ...extra, dir: extra.dir || null }) : false);
  function factCaption(id, dir = null) {
    if (capSeen.has("fact:" + id)) return false;
    const ln = factLine(id, {});
    if (!ln) return false;
    capSeen.add("fact:" + id);
    const text = ln.label ? ln.label + ": " + ln.text : ln.text;
    sent.push({ id, text, at: clock });
    return sayCaption(id, text, { dir, kind: "fact", fact: id });
  }
  function caption(id, vars = {}, dir = null, kind = "say") {
    if (!id) return false;
    const text = textOf(sayForm(id), vars);
    if (text) return sayCaption(id, text, { dir, kind });
    if (factById(id)) return factCaption(id, dir);
    return false;
  }
  function promptText(p) {
    if (!p || !p.text) return null;
    if (device === "keys") { const k = (has(p.textKeys) && p.textKeys) || keysForm(p.text); if (k) return textOf(k); }
    return textOf(p.text);
  }
  function promptShows(id) {
    if (!PLAYING.has(screen) || !prompt.text) return false;
    if (prompt.text === id || prompt.textKeys === id) return true;
    const ln = promptText(prompt), said = textOf(sayForm(id));
    return !!ln && ln === said;
  }
  const cueCaption = (id) => { if (capSeen.has("cue:" + id)) return false; capSeen.add("cue:" + id); return caption(id, {}, null, "cue"); };
  function cueOf(ev) {
    if (ev.name === "sfx") {
      const id = String(ev.id || "");
      const own = id.includes(".") ? id.replace(/^([^.]+)\./, "$1.sfx.") : `${ev.stage}.sfx.${id}`;
      if (has(own)) return own;
      return CUE_OF[`${ev.stage}:${id}`] || null;
    }
    if (ev.name === "bump" && !(ev.a === "you" || ev.b === "you")) return null;
    return CUE_OF[ev.name] || null;
  }

  // the log of what shows: [{ id, fact, page, text, from, to, seen }]; seen: the ms of it on screen while visible
  const log = [];
  let last = null;
  const look = () => {
    const el = root.children[0] || null;
    const key = el ? `${el.dataset.id}#${el.dataset.page}#${el.textContent}` : null;
    if (key === (last && last.key)) return;
    if (last) last.to = clock;
    last = el ? { key, id: el.dataset.id, fact: el.dataset.fact || null, page: el.dataset.page, text: el.textContent, from: clock, to: null, vis: visible } : null;
    if (last) log.push(last);
  };
  const runTo = (until) => {
    for (;;) {
      let next = null;
      for (const [id, t] of timers) if (t.at <= until && (!next || t.at < next[1].at)) next = [id, t];
      if (!next) break;
      timers.delete(next[0]);
      clock = next[1].at;
      next[1].fn();
      look();
    }
    clock = until;
  };

  let t0 = null;
  for (const s of steps) {
    runTo(Math.max(clock, Math.round(s.t * 1000)));
    prompt = s.prompt;
    for (const ev of s.events) {
      switch (ev.name) {
        case "screen": {
          screen = ev.screen;
          const v = PLAYING.has(screen);
          if (v !== visible) { if (last) { last.to = clock; last = null; } visible = v; look(); }
          if (!v && t0 !== null && endAt === null && screen !== "almost") endAt = clock;
          break;
        }
        case "stageStart":
          // the next stage (birth goes straight on to the ending) or a retry: main.js clears the captions there
          if (t0 !== null) { if (endAt === null) endAt = clock; break; }
          t0 = clock; capSeen.clear(); cap.clear();
          if (ev.index === 0 && ev.attempt === 1 && !ev.practice) cueCaption("cue.mother");   // at Play: her heartbeat
          break;
        case "caption":
          if (ev.id === "ending.time") { if (ev.vars && ev.vars.time) caption(ev.id, ev.vars, ev.dir); }
          else caption(ev.id, ev.vars || {}, ev.dir || null);
          break;
        case "fact": {
          const f = factById(ev.id);
          if ((ev.where || (f && f.where)) === "caption") factCaption(ev.id, ev.dir || null);
          break;
        }
        case "subgoal": if (ev.text && !promptShows(ev.text)) caption(ev.text); break;
        default: { const c = cueOf(ev); if (c) cueCaption(c); }
      }
      look();
    }
    if (endAt !== null) break;
  }
  if (endAt === null) endAt = clock;
  if (last && last.to === null) last.to = clock;

  // each fact sent: shown whole before the stage ended?
  const rows = sent.map((f) => {
    const spans = log.filter((x) => x.fact === f.id && x.vis && x.from < endAt);
    const seenMs = spans.reduce((a, x) => a + Math.min(x.to ?? endAt, endAt) - x.from, 0);
    const pages = new Map();
    for (const x of spans) if (Math.min(x.to ?? endAt, endAt) - x.from > 16) pages.set(Number(x.page), x.text);
    const text = [...pages.keys()].sort((a, b) => a - b).map((k) => pages.get(k)).join(" ");
    // stage 1 in portrait: one line a page, each for 2.4 s (ui/captions.js); else the fact's reading time
    const need = (stage === "swim" && L.H >= L.W ? pages.size * 2400 : readMs(f.text)) - CUT_SLACK_MS;
    const whole = text === f.text && seenMs >= need;
    const why = whole ? "" : !spans.length ? "never shown" : text !== f.text ? `only "${text}"`
      : `${Math.round(seenMs)} of ${need + CUT_SLACK_MS} ms before the stage ended`;
    return { ...f, whole, why, seenMs, first: spans.length ? spans[0].from : null };
  });
  return { rows, endAt, t0: t0 ?? 0, log };
}

// A whole run's steps from each stage's start (its first attempt) on: { stage id: steps }
function byStage(steps) {
  const out = {};
  steps.forEach((s, i) => {
    for (const e of s.events) if (e.name === "stageStart" && !out[e.id]) out[e.id] = steps.slice(i);
  });
  return out;
}

// ---- the runs: each stage in practice (as the Stages menu plays it), and whole runs (with the cards, the carry
// from stage to stage and the ending's run time line)
const recs = new Map();
for (const skill of SKILLS) for (const seed of SEEDS) {
  for (const stage of STAGE_IDS) recs.set(`${stage}|${skill}|${seed}|practice`, record({ practice: stage }, skill, seed));
  const whole = byStage(record("new", skill, seed));
  for (const stage of STAGE_IDS) recs.set(`${stage}|${skill}|${seed}|run`, whole[stage]);
}
const MODES = ["practice", "run"];

for (const stage of STAGE_IDS) {
  check(`${stage}: every caption fact it sends shows whole before it ends (ref and mid bot, 3 layouts, practice and whole runs, seeds 1 to 3)`, () => {
    const bad = [];
    for (const mode of MODES) for (const skill of SKILLS) for (const seed of SEEDS) for (const layout of Object.keys(LAYOUTS)) {
      const steps = recs.get(`${stage}|${skill}|${seed}|${mode}`);
      assert.ok(steps && steps.length, `${mode} skill ${skill} seed ${seed}: the stage never started`);
      const { rows, endAt, t0, log } = replay(steps, stage, layout);
      const miss = rows.filter((r) => !r.whole);
      if (TIMELINE === `${stage}:${layout}:${skill}` && seed === Number(process.env.TSEED || 1) && mode === (process.env.TMODE || "practice")) {
        for (const x of log) console.log(`${(((x.from - t0) / 1000).toFixed(2)).padStart(6)} ${String(Math.round((x.to ?? endAt) - x.from)).padStart(5)} ms ${x.vis ? " " : "h"} ${x.fact ? "FACT" : "    "} ${String(x.id).padEnd(22)} p${x.page} ${x.text}`);
        console.log(`end ${((endAt - t0) / 1000).toFixed(2)}`);
      }
      const reading = rows.reduce((a, r) => a + readMs(r.text), 0);
      if (REPORT && seed === 1) {
        console.log(`${stage} ${mode} skill ${skill} ${layout}: stage ${((endAt - t0) / 1000).toFixed(1)} s, ${rows.length} facts sent, ` +
          `${(reading / 1000).toFixed(1)} s of fact reading, ${rows.length - miss.length} whole` +
          (miss.length ? `; not whole: ${miss.map((r) => `${r.id} (${r.why})`).join(", ")}` : ""));
      }
      for (const r of miss) bad.push(`${mode} skill ${skill} seed ${seed} ${layout}: ${r.id} sent at ${((r.at - t0) / 1000).toFixed(1)} s, ${r.why}`);
    }
    assert.equal(bad.length, 0, `${bad.length} facts not shown whole:\n${bad.slice(0, 20).join("\n")}`);
  });
  // and none is left out: every caption fact of the stage goes out in each of those runs (end.seconds only follows a
  // breath that came by itself, which these bots never leave)
  check(`${stage}: every caption fact of the stage is sent in each of those runs`, () => {
    const want = FACTS_OF(stage).filter((id) => id !== "end.seconds");
    const bad = [];
    for (const mode of MODES) for (const skill of SKILLS) for (const seed of SEEDS) {
      const { rows } = replay(recs.get(`${stage}|${skill}|${seed}|${mode}`), stage, "portrait");
      const sent = new Set(rows.map((r) => r.id));
      const miss = want.filter((id) => !sent.has(id));
      if (miss.length) bad.push(`${mode} skill ${skill} seed ${seed}: ${miss.join(", ")}`);
    }
    assert.equal(bad.length, 0, bad.join("\n"));
  });
}

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else console.log(`PASS ${FILE}: ${passed} checks`);
