// First Breath: the one clock (design.md section 4 and 4.1). The label and range check values; week =
// floor((14 + N) / 7) for Day N after fertilization, N = 0..30; every label that starts with "Day" says "after
// fertilization"; the trimester cards at gaDay 98 and 196; "fetus" only from gaDay 70 and no "cycle day" in any
// registered string or fact; gaAt over the 4.1 moment table, never running back within or across stages; and
// mmPerShortAxis over the 3.1 scales, never shrinking over a run; fact labels made by clock.label and clock.range;
// the text helpers that print beside the clock (carer words, ordinals, minutes). Once core/stages/index.js exists,
// each stage's meta.moments, meta.ga and meta.mm are checked against the same tables.
// node qa/first-breath/clock.test.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DT, week, label, range, gaAt, mmPerShortAxis, bpmYou } from "../../public/first-breath/core/clock.js";
import { FACTS, label as factLabel, gather, byId, shown } from "../../public/first-breath/core/facts.js";
import { allStrings, say, fill, ordinal, minSec, registerConflicts } from "../../public/first-breath/core/text.js";

const FILE = "qa/first-breath/clock.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

// The 4.1 table. lenS in seconds; beat-counted moments at the stage's rate (hers 72 or 78 bpm, yours from bpmYou).
const her = (beats, bpm) => (beats * 60) / bpm;
const MOMENTS = {
  swim: ["womb", "gate", "fork", "tube", "meet", "carried"].map((id) => ({ id, ga: [14, 14] })),
  egg: ["surge", "open", "sweep", "guard", "enter", "seal", "fusion", "outro"].map((id) => ({ id, ga: [14, 14] })),
  // stage 3 as the roguelike (first-breath-action-genres, design.md 5.3): a day a room (its 10 s timer, the 0.6 s
  // clear, the 1.2 s split and the 3 s pick), the Knot's room (it drifts off at 18 s), the hatch and the outro
  split: [
    ...["day1", "day2", "day3", "day4"].map((id, i) => ({ id, ga: [15 + i, 16 + i], lenS: 14.8 })),
    { id: "bloom", ga: [19, 20], lenS: 18 },
    { id: "hatch", ga: [20, 20], lenS: 3 },
    { id: "outro", ga: [20, 20], lenS: 2 },
  ],
  // stage 4 as the action-adventure (first-breath-action-genres, design.md 5.4): nestle up to 8 s, the lining map up
  // to 58 s, the 6 s heart, the 7 s grow
  root: [
    { id: "nestle", ga: [20, 23], lenS: 8 },
    { id: "roots", ga: [25, 35], lenS: 58 },
    { id: "heart", ga: [36, 36], lenS: 6 },
    { id: "grow", ga: [36, 49], lenS: 7 },
  ],
  // stage 5 on the action layer (openspec/changes/first-breath-action-genres): a wave a week (7.5 s and a 2.2 s
  // rest), weeks 7 to 12, then the big germ (a 1.6 s tell and 16 s)
  grow: (() => {
    const out = [];
    for (let n = 7; n <= 12; n++) out.push({ id: `wave${n}`, ga: [7 * n, 7 * n + 7], lenS: 9.7 });
    out.push({ id: "boss", ga: [91, 97], lenS: 17.6 });
    return out;
  })(),
  answer: [
    { id: "hear", ga: [105, 105] },
    // stage 6 as the rhythm stage (first-breath-action-genres, design.md 5.6): 6 kicks every 2nd beat, 6 phrases of 9
    // beats, the sing-along of 16 notes and the jump note
    { id: "beat", ga: [105, 126], lenS: her(12, 78), beats: true },
    { id: "phrases", ga: [133, 168], lenS: her(54, 78), beats: true },
    { id: "song", ga: [168, 175], lenS: her(17, 78), beats: true },
    { id: "eyes", ga: [175, 182], lenS: 4 },
    { id: "outro", ga: [189, 195], lenS: 3 },
  ],
  // stage 7 as the survivor stage (first-breath-action-genres, design.md 5.7): 60 s of waves, the turn up to 6 s, the
  // 10 s rest and the 3 s outro
  turn: [
    { id: "waves", ga: [196, 245], lenS: 60 },
    { id: "turn", ga: [245, 252], lenS: 6 },
    { id: "rest", ga: [259, 280], lenS: 10 },
    { id: "outro", ga: [280, 280], lenS: 3 },
  ],
  birth: [{ id: "waves", ga: [280, 280] }, { id: "light", ga: [280, 280] }],
};
const ORDER = ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"];

// The 3.1 table: gaDay span and real mm across the short axis (the ending is a 2 m room).
const SCALE = {
  swim: { ga: { start: 14, end: 14 }, mm: { start: 0.3, end: 0.3 } },
  egg: { ga: { start: 14, end: 14 }, mm: { start: 0.4, end: 0.4 } },
  split: { ga: { start: 15, end: 20 }, mm: { start: 0.45, end: 0.45 } },
  root: { ga: { start: 20, end: 49 }, mm: { start: 0.6, end: 30 } },
  grow: { ga: { start: 49, end: 97 }, mm: { start: 30, end: 150 } },
  answer: { ga: { start: 98, end: 195 }, mm: { start: 150, end: 600 } },
  turn: { ga: { start: 196, end: 280 }, mm: { start: 600, end: 700 } },
  birth: { ga: { start: 280, end: 280 }, mm: { start: 700, end: 700 } },
  ending: { ga: { start: 280, end: 280 }, mm: { start: 2000, end: 2000 } },
};

await check("DT is one 60 Hz step and week() counts completed weeks", () => {
  assert.equal(DT, 1 / 60);
  assert.deepEqual([0, 6, 7, 13.9, 14, 41, 42, 279, 280].map(week), [0, 0, 1, 1, 2, 5, 6, 39, 40]);
});

await check("the label check values (section 4)", () => {
  assert.equal(label(14, { fertilized: false }), "Week 2");
  assert.equal(label(14, { fertilized: true }), "Day 0 after fertilization (week 2)");
  assert.equal(label(14), "Day 0 after fertilization (week 2)", "fertilized defaults to true");
  assert.equal(label(36), "Day 22 after fertilization (week 5)");
  assert.equal(label(70), "Week 10");
  assert.equal(label(41.9), "Day 27 after fertilization (week 5)", "labels use floor(gaDay)");
  assert.equal(label(42), "Week 6");
  assert.equal(label(280), "Week 40");
});

await check("the range check values (section 4)", () => {
  assert.equal(range(20, 23), "Days 6 to 9 after fertilization (weeks 2 to 3)");
  assert.equal(range(217, 238), "Weeks 31 to 34");
  assert.equal(range(15, 18), "Days 1 to 4 after fertilization (week 2)", "one week: (week M)");
  assert.equal(range(36, 36), "Day 22 after fertilization (week 5)");
  assert.equal(range(105, 126), "Weeks 15 to 18");
  assert.equal(range(217, 220), "Week 31");
});

await check("week = floor((14 + N) / 7) for Day N after fertilization, N = 0..30", () => {
  for (let n = 0; n <= 30; n++) {
    const w = Math.floor((14 + n) / 7);
    assert.equal(week(14 + n), w, `N = ${n}`);
    const l = label(14 + n);
    if (14 + n < 42) assert.equal(l, `Day ${n} after fertilization (week ${w})`);
    else assert.equal(l, `Week ${w}`);
  }
});

await check("every label that starts with Day says after fertilization", () => {
  const labels = [];
  for (let g = 0; g <= 300; g += 0.5) for (const fertilized of [true, false]) labels.push(label(g, { fertilized }));
  for (let a = 0; a <= 300; a += 3) for (let b = a; b <= Math.min(300, a + 40); b += 4) labels.push(range(a, b));
  for (const f of FACTS) labels.push(factLabel(f));
  for (const l of labels) {
    if (/^Day/.test(l)) assert.match(l, /after fertilization \(weeks? \d+( to \d+)?\)$/, l);
    assert.ok(!/^Day -/.test(l), `no negative day: ${l}`);
  }
});

await check("the trimester cards at gaDay 98 and 196", () => {
  assert.equal(label(98), "Week 14");
  assert.equal(label(196), "Week 28");
  assert.equal(label(97), "Week 13");
  const at = (id, g) => { const f = FACTS.find((x) => x.id === id); if (f) assert.equal(f.gaDay, g, id); };
  at("answer.tri", 98);
  at("answer.card", 98);
  at("turn.card", 196);
});

await check("\"fetus\" only from gaDay 70, and no \"cycle day\" anywhere", () => {
  for (const f of FACTS) {
    if (/fetus/i.test(f.text)) assert.ok(f.gaDay >= 70, `${f.id} says fetus at gaDay ${f.gaDay}`);
    assert.ok(!/cycle day/i.test(f.text), f.id);
  }
  for (const { id, text } of allStrings()) {
    assert.ok(!/cycle day/i.test(text), id);
    if (/^(title|settings|ui|almost|pause|hud|result|stages|sources|card|tap|grade|part|mark|cue)\./.test(id)) {
      assert.ok(!/fetus/i.test(text), `${id} is a shared string and must not say fetus`);
    }
  }
  for (let g = 0; g <= 300; g++) assert.ok(!/cycle day/i.test(label(g)));
});

await check("gaAt follows each 4.1 moment and holds at its ends", () => {
  for (const [stage, list] of Object.entries(MOMENTS)) {
    for (const m of list) {
      const [a, b] = m.ga;
      if (!m.lenS) { assert.equal(gaAt(m, 0), a, `${stage}.${m.id}`); assert.equal(gaAt(m, 99), a); continue; }
      assert.equal(gaAt(m, -1), a, `${stage}.${m.id} before its start`);
      assert.equal(gaAt(m, 0), a, `${stage}.${m.id} at 0`);
      near(gaAt(m, m.lenS / 2), (a + b) / 2, 1e-9, `${stage}.${m.id} half way`);
      assert.equal(gaAt(m, m.lenS), b, `${stage}.${m.id} at lenS`);
      assert.equal(gaAt(m, m.lenS + 50), b, `${stage}.${m.id} after lenS`);
    }
  }
  near(gaAt({ ga: [20, 23], lenS: 12 }, 4), 21, 1e-12, "nestle at 4 s");
  near(MOMENTS.split[0].lenS, 14.8, 1e-9, "a day: room, clear, split and pick");
});

await check("gaDay never runs back: each moment starts at or after the last one's end, across stages too", () => {
  let last = -Infinity, where = "start";
  for (const stage of ORDER) {
    for (const m of MOMENTS[stage]) {
      assert.ok(m.ga[0] >= last, `${stage}.${m.id} starts at ${m.ga[0]}, before ${where} ended at ${last}`);
      assert.ok(m.ga[1] >= m.ga[0], `${stage}.${m.id} runs back`);
      // sample the moment: gaAt never decreases inside it
      let prev = -Infinity;
      for (let s = 0; s <= (m.lenS || 1) + 1; s += 0.25) { const g = gaAt(m, s); assert.ok(g >= prev); prev = g; }
      last = m.ga[1]; where = `${stage}.${m.id}`;
    }
  }
});

await check("mmPerShortAxis log-lerps across meta.ga and never shrinks over a run (3.1)", () => {
  assert.equal(mmPerShortAxis(SCALE.swim, 14), 0.3);
  assert.equal(mmPerShortAxis(SCALE.egg, 14), 0.4);
  assert.equal(mmPerShortAxis(SCALE.split, 17), 0.45);
  near(mmPerShortAxis(SCALE.root, 20), 0.6, 1e-12, "root start");
  near(mmPerShortAxis(SCALE.root, 49), 30, 1e-9, "root end");
  near(mmPerShortAxis(SCALE.root, 34.5), Math.sqrt(0.6 * 30), 1e-9, "root half way is the geometric mean");
  near(mmPerShortAxis(SCALE.grow, 73), Math.sqrt(30 * 150), 1e-9, "grow half way");
  near(mmPerShortAxis(SCALE.turn, 280), 700, 1e-9, "turn end");
  assert.equal(mmPerShortAxis(SCALE.root, 10), 0.6, "clamped before the span");
  near(mmPerShortAxis(SCALE.root, 60), 30, 1e-9, "clamped after the span");
  let prev = 0;
  for (const stage of [...ORDER, "ending"]) {
    const meta = SCALE[stage];
    for (const m of MOMENTS[stage] || [{ ga: [280, 280] }]) {
      for (let s = 0; s <= (m.lenS || 1); s += 0.5) {
        const mm = mmPerShortAxis(meta, gaAt(m, s));
        assert.ok(mm >= prev - 1e-12, `${stage}.${m.id || ""} at ${s} s: ${mm} mm after ${prev} mm`);
        prev = mm;
      }
    }
  }
});

await check("fact labels come from clock.label and clock.range (15.1); shown() fills the carer word", () => {
  const [a, b, c, d] = gather([[
    { id: "x.unf", gaDay: 14, fertilized: false, text: "A.", src: ["TTUHSC"], access: "R", checked: true },
    { id: "x.f", gaDay: 14, fertilized: true, text: "B.", src: ["PMID 33964210"], access: "A", checked: true },
  ], [
    { id: "x.span", gaDay: 20, gaEnd: 23, text: "{Carer} hums.", src: ["UNSW Week 2", "nope"], access: "R", checked: true },
    { id: "x.unf", gaDay: 99, text: "a repeated id is dropped" },
    { id: "x.who", gaDay: 280, text: "C.", src: ["WHO"], access: "R", checked: false },
  ]]);
  assert.equal(factLabel(a), "Week 2");
  assert.equal(factLabel(b), "Day 0 after fertilization (week 2)");
  assert.equal(factLabel(c), "Days 6 to 9 after fertilization (weeks 2 to 3)");
  assert.equal(factLabel({ gaDay: 36 }), "Day 22 after fertilization (week 5)", "fertilized defaults to gaDay > 14");
  assert.equal(factLabel({ gaDay: 14 }), "Week 2");
  assert.equal(d.id, "x.who");
  assert.ok(Object.isFrozen(a));
  assert.equal(byId("no.such"), null);
  assert.ok(Array.isArray(shown({ carer: "mum" })), "shown() lists the checked facts");
  assert.equal(fill(c.text, {}, { carer: "parent" }), "Your parent hums.");
});

await check("text helpers: carer words, named vars, ordinals and minutes", () => {
  assert.equal(say("cue.mother"), "♥ your mother's heartbeat");
  assert.equal(say("cue.mother", {}, { carer: "mom" }), "♥ your mom's heartbeat");
  assert.equal(say("almost.came", { place: ordinal(5), of: 20 }), "You came 5th of 20.");
  assert.equal(say("no.such.string"), "no.such.string", "a missing id shows itself");
  assert.equal(fill("{Carer} and {who}", { who: "you" }, { carer: "bogus" }), "Your mother and you");
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 20, 21, 22, 23, 101, 111].map(ordinal),
    ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "20th", "21st", "22nd", "23rd", "101st", "111th"]);
  assert.equal(minSec(588000), "9 min 48 s");
  assert.equal(minSec(48400), "48 s");
  assert.deepEqual(registerConflicts(), []);
  assert.ok(allStrings().length > 50);
});

const INDEX = fileURLToPath(new URL("../../public/first-breath/core/stages/index.js", import.meta.url));
if (existsSync(INDEX)) {
  const { STAGES } = await import(new URL("../../public/first-breath/core/stages/index.js", import.meta.url).href);
  await check("each stage's meta.moments, ga and mm match the 4.1 and 3.1 tables", () => {
    for (const mod of STAGES || []) {
      const { id, moments, ga, mm } = mod.meta;
      const want = MOMENTS[id];
      assert.ok(want, `an unknown stage ${id}`);
      assert.deepEqual(moments.map((m) => m.id), want.map((m) => m.id), `${id} moment ids`);
      moments.forEach((m, i) => {
        assert.deepEqual(m.ga, want[i].ga, `${id}.${m.id} ga`);
        if (want[i].lenS && !want[i].beats) near(m.lenS, want[i].lenS, 1e-9, `${id}.${m.id} lenS`);
      });
      assert.deepEqual(ga, SCALE[id].ga, `${id} meta.ga`);
      assert.deepEqual(mm, SCALE[id].mm, `${id} meta.mm`);
    }
  });
}

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks${existsSync(INDEX) ? "" : " (no core/stages/index.js yet: the stage meta check waits for it)"}`);
}
