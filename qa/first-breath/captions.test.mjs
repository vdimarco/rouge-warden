// First Breath: the captions queue and its clock (ui/captions.js; design.md 12; review F18, F32). It runs the module
// against a small fake DOM and a virtual clock (setTimeout and performance.now), so every time is exact, and checks:
// - a fact cut by a caption comes back after it, for the time its page had left, so it is seen for its whole reading
//   time, and a page with almost no time left counts as read (the next page comes back, not the same one);
// - waiting facts show in order and are not dropped past 3 in the queue or after 8 s; one that waited 12 s gives way
//   only to a newer fact behind it, and a lone waiting fact always shows, however long captions keep coming;
// - the stage 6 pattern (a phrase's fact sent with its hum line, then "Your mother feels you.", every 7.7 s): each
//   fact that shows does so for its whole reading time, in order, never for under 1.5 s at a time, within 12 s of
//   being sent, and each hum line shows within 1.5 s (a fact page shows 1.5 s before a caption may cut it);
// - while a fact waits, a caption stays only for its reading time; stage 1's one-line pages keep 2.4 s;
// - pause() and resume(): a caption under the pause screen is still there on resume with the time it had left, and a
//   fact that waited through a long pause still shows;
// - a sound's caption that must show (the stage's music caption, say(…, { kind: "cue", wait: true })): on a busy line
//   it waits its turn instead of being dropped (a plain sound's caption still is), it shows once, for 1.2 s while a fact
//   waits behind it and its whole time when none does, a caption in the step it begins sends it back to show whole
//   after, a caption later waits until it has shown 1.2 s, it never comes back once seen, and drop() takes it away.
// CAPTIONS_JS=<path> runs it against another copy of the module (to show a fault on old code).
// node qa/first-breath/captions.test.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const FILE = "qa/first-breath/captions.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}

// ---- the virtual clock
let clock = 0, tid = 0;
const timers = new Map();
globalThis.setTimeout = (fn, ms) => { const id = ++tid; timers.set(id, { at: clock + Math.max(0, Number(ms) || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { timers.delete(id); };
Object.defineProperty(globalThis, "performance", { value: { now: () => clock }, configurable: true, writable: true });

// ---- a small fake DOM: a line is 26 px tall per 40 letters; the portrait band holds two lines (68 px)
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
  getBoundingClientRect() { return this.isRoot ? { height: 68, width: 366 } : { height: 26 * Math.max(1, Math.ceil(this._text.length / 40)), width: 300 }; }
  get scrollWidth() { return 300; }
  get clientWidth() { return 300; }
}
const html = new El("html");
globalThis.document = { documentElement: html, createElement: (t) => new El(t) };
globalThis.window = { innerWidth: 390, innerHeight: 844 };
globalThis.getComputedStyle = () => ({ lineHeight: "22px", fontSize: "18px", paddingTop: "3px", paddingBottom: "3px" });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD = process.env.CAPTIONS_JS ? path.resolve(process.env.CAPTIONS_JS) : path.join(HERE, "../../public/first-breath/ui/captions.js");
const { createCaptions } = await import(pathToFileURL(MOD).href);

// A fresh captions root in a stage, with a log of what shows: [{ id, fact, page, text, from, to }].
function setup(stage = "answer") {
  clock = 0;
  timers.clear();
  html.dataset.stage = stage;
  const root = new El("div");
  root.isRoot = true;
  const cap = createCaptions(root, { on: true });
  const log = [];
  let last = null;
  const look = () => {
    const el = root.children[0] || null;
    const key = el ? `${el.dataset.id}#${el.dataset.page}#${el.textContent}` : null;
    if (key === (last && last.key)) return;
    if (last) last.to = clock;
    last = el ? { key, id: el.dataset.id, fact: el.dataset.fact || null, page: el.dataset.page, text: el.textContent, from: clock, to: null } : null;
    if (last) log.push(last);
  };
  // run the clock to `until`, firing timers in order and noting each change
  const run = (until) => {
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
  const at = (t, fn) => { run(t); fn(); look(); };
  const line = (id, text, ms = 4000) => cap.say(id, text, { kind: "say", ms });
  const fact = (id, text, ms = 4000) => cap.say(id, text, { kind: "fact", fact: id, ms });
  const shown = (id) => log.filter((x) => x.id === id).reduce((s, x) => s + ((x.to ?? clock) - x.from), 0);
  return { cap, log, run, at, line, fact, shown, look };
}
const readMs = (text) => Math.max(4000, 1500 + 55 * text.length);

const F1 = "Week 19: In one study, the first response to sound was to a low tone.";
const HUM = "♪ your mother hums, left: 3 notes";

await check("a fact cut by a caption comes back after it, for the time its page had left", () => {
  const c = setup("answer");
  c.at(0, () => c.fact("answer.respond", F1));
  c.at(1000, () => c.line("answer.cap.hum3", HUM));
  c.run(30000);
  const spans = c.log.filter((x) => x.id === "answer.respond");
  assert.ok(spans.length >= 2, `the fact came back ${spans.length - 1} times: ${JSON.stringify(c.log.map((x) => x.id))}`);
  assert.equal(c.log[1].id, "answer.cap.hum3", "the caption shows at once");
  assert.ok(spans[1].from >= c.log[1].to, "the fact comes back after the caption");
  assert.ok(c.shown("answer.respond") >= readMs(F1) - 1, `the fact showed ${c.shown("answer.respond")} ms of ${readMs(F1)}`);
  assert.equal(spans[1].text, F1, "the cut page comes back whole");
});

await check("a fact that starts a frame before a caption is not flashed: the caption waits its turn", () => {
  // review of the fact pacing: "It opens." is cut to its reading time because a fact waits, the fact starts, and the
  // guard line comes in the next frame. The fact must not show for one frame and vanish.
  const FF = "Week 2: Finger-like fimbriae sweep the egg into the tube.";
  for (const gap of [6, 10, 15, 20]) {
    const c = setup("egg");
    c.at(0, () => c.line("egg.open", "It opens.", 4000));
    c.at(100, () => c.fact("egg.fimbriae", FF));
    let t = 100;
    while (!c.log.some((x) => x.id === "egg.fimbriae") && t < 10000) c.run(++t);
    c.at(clock + gap, () => c.line("egg.guard", "Guard your shell. Only one may enter."));
    c.run(30000);
    const spans = c.log.filter((x) => x.id === "egg.fimbriae").map((x) => x.to - x.from);
    assert.ok(spans.every((d) => d === 0 || d >= 1400), `a line ${gap} ms after the fact began: the fact showed for ${spans.join(", ")} ms`);
    assert.ok(c.shown("egg.fimbriae") >= readMs(FF) - 1, `a line ${gap} ms after: the fact showed ${c.shown("egg.fimbriae")} of ${readMs(FF)} ms`);
  }
});

await check("a fact page with almost no time left counts as read: the next page comes back", () => {
  const c = setup("answer");
  const long = "Week 2: In many mammals, sperm rest on the tube wall before the egg comes. Human data are less clear about it.";
  c.at(0, () => c.fact("swim.rest", long));
  const p1 = c.log[0];
  assert.ok(p1 && p1.page === "1", "page 1 shows");
  const ends = [...timers.values()].map((t) => t.at).sort((a, b) => a - b)[0];
  c.at(ends - 100, () => c.line("x.line", "Now you are ready."));
  c.run(60000);
  const back = c.log.filter((x) => x.id === "swim.rest");
  assert.ok(back.length >= 2, "the fact came back");
  assert.equal(back[1].page, "2", `page ${back[1].page} came back, wanted page 2`);
  assert.equal(back.filter((x) => x.page === "1").length, 1, "page 1 is not shown again");
});

await check("waiting facts keep their order past 3 and past 8 s; after 12 s one gives way only to a newer one", () => {
  const c = setup("egg");
  c.at(0, () => c.line("egg.guardGoal", "Guard your shell. Only one may enter."));
  const ids = ["egg.zona", "egg.corona", "egg.choice", "egg.signal", "egg.size", "egg.day"];
  ids.forEach((id, k) => c.at(10 + k, () => c.fact(id, `Week 2: Fact number ${k + 1} about the egg and its shell.`)));
  c.run(120000);
  const order = c.log.filter((x) => x.fact).map((x) => x.id).filter((id, i, a) => a.indexOf(id) === i);
  // each shows 4 s after the line's 2.85 s: the first three start within 12 s (the third after waiting over 8 s),
  // the 4th and 5th have waited over 12 s with a newer one behind them, and the last one waiting always shows
  assert.deepEqual(order, ["egg.zona", "egg.corona", "egg.choice", "egg.day"]);
  for (const id of order) assert.ok(c.shown(id) >= 4000 - 1, `${id} showed ${c.shown(id)} ms`);
  assert.ok(c.log.find((x) => x.id === "egg.choice").from > 8010, "the third waited more than 8 s and still showed");
});

await check("a lone waiting fact always shows, however long captions keep coming", () => {
  const c = setup("grow");
  c.at(0, () => c.fact("grow.w12", "Week 12: Near week 12, more of your mother's blood flows into the placenta."));
  for (let k = 0; k < 12; k++) c.at(200 + 2000 * k, () => c.line("grow.line" + k, `Move to the light, number ${k + 1}.`));
  c.run(120000);
  const text = "Week 12: Near week 12, more of your mother's blood flows into the placenta.";
  assert.ok(c.shown("grow.w12") >= readMs(text) - 250, `shown ${c.shown("grow.w12")} of ${readMs(text)} ms`);
  const last = c.log.filter((x) => x.id === "grow.w12").pop();
  assert.ok(last.from > 20000, "it came back after the last caption");
});

await check("stage 6: phrase facts sent with their hum lines show whole, in order, never flashed; each hum within 1.5 s", () => {
  const c = setup("answer");
  const facts = [];
  for (let k = 0; k < 6; k++) {
    const t0 = 10000 + 7700 * k;
    const id = "answer.f" + k, text = `Week ${19 + k}: A fact for phrase ${k + 1}, about what you can hear now.`;
    facts.push({ id, text });
    c.at(t0, () => { c.fact(id, text); c.line("answer.cap.hum" + k, HUM.replace("3", String(k + 1))); });
    c.at(t0 + 3100, () => c.line("answer.feels", "Your mother feels you."));
  }
  c.run(200000);
  for (let k = 0; k < 6; k++) {
    const hum = c.log.find((x) => x.id === "answer.cap.hum" + k);
    const t0 = 10000 + 7700 * k;
    assert.ok(hum && hum.from >= t0 && hum.from <= t0 + 1500, `hum ${k} shows within 1.5 s (${hum && hum.from - t0} ms)`);
    assert.ok((hum.to ?? clock) - hum.from >= 2000 - 1, `hum ${k} shows at least 2 s`);
  }
  assert.equal(c.log[0].id, "answer.cap.hum0", "a fact sent with its hum line waits behind it, unseen");
  // 6 facts of 4.7 s, 6 hums and 6 replies in 46 s do not all fit: the order is kept, the first and the last show,
  // and at most one gives way (it waited over 12 s with a newer one behind it); each one that shows starts within 12 s
  const order = c.log.filter((x) => x.fact).map((x) => x.id).filter((id, i, a) => a.indexOf(id) === i);
  const all = facts.map((f) => f.id);
  assert.deepEqual(order, all.filter((id) => order.includes(id)), "in order");
  assert.ok(order[0] === all[0] && order[order.length - 1] === all[all.length - 1] && order.length >= all.length - 1,
    `shown: ${order.join(", ")}`);
  for (const f of facts.filter((x) => order.includes(x.id))) {
    const spans = c.log.filter((x) => x.id === f.id);
    const sent = 10000 + 7700 * Number(f.id.slice(-1));
    assert.ok(spans[0].from - sent <= 12000, `${f.id} waited ${spans[0].from - sent} ms`);
    // its whole reading time, less at most the 0.25 s that lets a cut page count as read
    assert.ok(c.shown(f.id) >= readMs(f.text) - 250, `${f.id} showed ${c.shown(f.id)} of ${readMs(f.text)} ms`);
    for (const s of spans) assert.ok((s.to ?? clock) - s.from >= 1500 - 1, `${f.id} flashed for ${(s.to ?? clock) - s.from} ms`);
  }
});

await check("while a fact waits a caption stays for its reading time; stage 1 one-line pages keep 2.4 s", () => {
  const c = setup("answer");
  c.at(0, () => c.line("answer.feels", "Your mother feels you."));
  c.at(100, () => c.fact("answer.low", "Week 22: Low sounds reach you first. High sounds come later."));
  c.run(30000);
  const feels = c.log.find((x) => x.id === "answer.feels");
  assert.equal(feels.to - feels.from, Math.max(2000, 1000 + 50 * "Your mother feels you.".length));
  const s = setup("swim");
  s.at(0, () => s.line("swim.warmWay", "Take the warm way.", 2500));
  s.at(100, () => s.fact("swim.few", "Week 2: Only a few thousand sperm reach the tubes."));
  s.run(30000);
  const warm = s.log.find((x) => x.id === "swim.warmWay");
  assert.equal(warm.to - warm.from, 2400);
});

await check("pause and resume: a caption keeps the time it had left, and a waiting fact still shows", () => {
  const c = setup("root");
  assert.equal(typeof c.cap.pause, "function", "captions.pause()");
  assert.equal(typeof c.cap.resume, "function", "captions.resume()");
  c.at(0, () => c.line("cue.mother", "♥ your mother's heartbeat"));
  c.at(500, () => c.fact("root.size", "Week 6: You are about 4 mm long, the size of a lentil."));
  c.at(1000, () => c.cap.pause());
  c.run(11000);
  assert.equal(c.cap.current(), "cue.mother", "still on screen after a 10 s pause");
  c.at(11000, () => c.cap.resume());
  c.run(60000);
  const m = c.log.find((x) => x.id === "cue.mother");
  const shownMs = m.to - m.from - 10000;
  assert.ok(Math.abs(shownMs - Math.max(2000, 1000 + 50 * "♥ your mother's heartbeat".length)) <= 1, `shown ${shownMs} ms outside the pause`);
  assert.ok(c.shown("root.size") >= readMs("Week 6: You are about 4 mm long, the size of a lentil.") - 1, "the waiting fact shows whole");
});

await check("a sound's caption that must show waits its turn on a busy line, shows once for 1.2 s or more, and can be dropped", () => {
  const MUSIC = "♪ march music";
  const music = (c, ms = 2500) => c.cap.say("music.egg", MUSIC, { kind: "cue", wait: true, ms });
  // a busy line: the stage's lines and a fact; the plain sound's caption is dropped, the music caption waits
  const c = setup("egg");
  c.at(0, () => c.line("egg.now", "Now you are the egg.", 2500));
  c.at(100, () => assert.equal(c.cap.say("cue.seal", "♪ a shimmer runs round your shell", { kind: "cue" }), false, "a plain sound's caption on a busy line"));
  c.at(200, () => assert.equal(music(c), true, "the music caption is taken"));
  c.at(300, () => c.fact("egg.zona", "Week 2: A clear shell called the zona pellucida protects the egg."));
  c.run(30000);
  const ids = c.log.map((x) => x.id);
  assert.deepEqual(ids, ["egg.now", "music.egg", "egg.zona"], `in order: ${ids.join(", ")}`);
  const m = c.log[1];
  assert.equal(m.to - m.from, 1200, "1.2 s while a fact waits behind it");
  // a free line: its whole time
  const f = setup("egg");
  f.at(0, () => music(f));
  f.run(30000);
  assert.equal(f.log.length, 1);
  assert.equal(f.log[0].to - f.log[0].from, 2500, "its whole time on a free line");
  // a caption in the step it begins sends it back, whole; a caption once it is seen waits for its 1.2 s; never twice
  const g = setup("egg");
  g.at(0, () => g.line("egg.opens", "It opens.", 2000));
  g.at(100, () => music(g));
  g.at(2000, () => g.line("egg.guardGoal", "Bounce the glow off your arc.", 2500));   // the music caption began at 2000
  g.at(4600, () => g.line("egg.chargeGoal", "Tap to seal. It clears the sparks.", 2500));
  g.run(30000);
  const spans = g.log.filter((x) => x.id === "music.egg").map((x) => [x.from, x.to - x.from]);
  assert.deepEqual(spans, [[2000, 0], [4500, 1200]], `the music caption: ${JSON.stringify(spans)}`);
  const charge = g.log.find((x) => x.id === "egg.chargeGoal");
  assert.equal(charge.from, 5700, "the caption waited for the music caption's 1.2 s");
  // drop(): off the queue, and off the screen
  const d = setup("egg");
  d.at(0, () => d.line("egg.now", "Now you are the egg.", 2500));
  d.at(100, () => music(d));
  d.at(200, () => d.cap.drop("music.egg"));
  d.run(30000);
  assert.ok(!d.log.some((x) => x.id === "music.egg"), "dropped while it waits");
  const e = setup("egg");
  e.at(0, () => music(e));
  e.at(500, () => e.cap.drop("music.egg"));
  e.run(30000);
  assert.equal(e.log[0].to - e.log[0].from, 500, "dropped while it shows");
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else console.log(`PASS ${FILE}: ${passed} checks`);
