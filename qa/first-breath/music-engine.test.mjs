// First Breath: the score engine's scheduler (ui/music.js, openspec/changes/first-breath-score/contract.md "Engine"),
// in node, on a fake AudioContext that keeps the graph, every source's start and end, and fires onended as its clock
// moves. No samples are loaded, so every instrument plays its synth voice; the timing is the same either way.
// It checks:
// - bar lines on the cue's grid (latency taken off), the swing (the off-beat eighth at 0.5 + swing / 2 of the beat),
//   and a tempo change on a bar line (birth's 1.12);
// - a cue change lands on the old cue's bar line with its end stinger there, and the new cue starts on it;
// - a cue whose first downbeat goes by before the first tick (the Play tap's first frame can stall the page) starts
//   then, whole: no note dropped;
// - a change asked for while Music is off (two stages go by) lands as Music comes on: the right cue at once, with no
//   end stinger and no bar of the old cue;
// - a cue that has not sounded yet (stage 6's cue waiting for her first beat) is replaced at once by the next cue;
// - stage 6 after a new run, and after a Try again that lays her beats at another phase: every downbeat on one of her
//   new beats within 1 ms (the beats laid before are dropped);
// - no node is let go while a source feeding it still sounds (a crash's metal rings on after its noise ends), and every
//   voice's nodes are let go once its sources end (only the bus is left connected);
// - at most 48 voices sounding; a big stinger, which lays all its notes at once, loses none of them to that cap (a
//   voice laid ahead is never taken before it sounds); a note at the very end of a tick's window is played, not lost
//   between two windows;
// - a stinger lands on the next beat and the cue ducks by its `ducks` under it; a second stinger waits for the first;
// - fadeOut: every voice ends within 1.25 × its seconds, and a voice laid ahead never sounds;
// - nothing is scheduled while the context is suspended, the page hidden or Music off, and the cue goes on from a new
//   bar line after;
// - tick() costs at most 2 ms at p99 (mean under 0.3 ms) with every cue at level 2.
// node qa/first-breath/music-engine.test.mjs
import assert from "node:assert/strict";
import { createMusic, VOICE_CAP } from "../../public/first-breath/ui/music.js";
import * as SCORE from "../../public/first-breath/core/music/score.js";

const { CUES, CUE_ORDER, STINGERS } = SCORE;
const FILE = "qa/first-breath/music-engine.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 10).join("\n     ")}`); }
}

// ---- a fake AudioContext
function fakeCtx({ sampleRate = 44100 } = {}) {
  const nodes = [], sources = [], cuts = [];
  let id = 0;
  const param = (v = 0) => {
    const p = { value: v, events: [] };
    for (const k of ["setValueAtTime", "linearRampToValueAtTime", "exponentialRampToValueAtTime", "setTargetAtTime", "cancelScheduledValues", "cancelAndHoldAtTime"]) {
      p[k] = (...a) => { p.events.push([k, ...a]); return p; };
    }
    return p;
  };
  const ctx = { sampleRate, currentTime: 0, state: "running", outputLatency: 0, baseLatency: 0 };
  const upstream = (n, seen = new Set()) => {
    const out = [];
    for (const i of n.ins) {
      if (seen.has(i)) continue;
      seen.add(i);
      if (i.isSource) out.push(i);
      out.push(...upstream(i, seen));
    }
    return out;
  };
  function node(kind, extra = {}) {
    const n = { kind, id: id++, outs: new Set(), ins: new Set(), freed: false, ...extra };
    n.connect = (to) => { n.outs.add(to); if (to && to.ins) to.ins.add(n); return to; };
    n.disconnect = () => {
      const live = upstream(n).filter((s) => s.started && !s.ended && s.endAt > ctx.currentTime + 1e-6);
      if (live.length) cuts.push({ kind: n.kind, at: ctx.currentTime, still: live.map((s) => +(s.endAt - ctx.currentTime).toFixed(4)) });
      for (const o of n.outs) if (o && o.ins) o.ins.delete(n);
      n.outs.clear();
      n.freed = true;
    };
    nodes.push(n);
    return n;
  }
  const natural = (s) => {
    const stop = s.stopAt !== null ? Math.max(s.stopAt, s.startAt) : Infinity;
    if (s.kind !== "buffer" || s.loop || !s.buffer) return stop;
    return Math.min(stop, s.startAt + (s.buffer.duration - s.offset) / Math.max(1e-6, s.playbackRate.value));
  };
  function source(kind) {
    const s = node(kind, { isSource: true, started: false, ended: false, never: false, startAt: null, stopAt: null, offset: 0, endAt: Infinity, loop: false, onended: null });
    s.start = (when = 0, offset = 0) => { s.started = true; s.startAt = Math.max(when, ctx.currentTime); s.offset = offset; s.endAt = natural(s); };
    s.stop = (when = 0) => {
      s.stopAt = when;
      if (s.startAt !== null && Math.max(when, ctx.currentTime) <= s.startAt) { s.never = true; s.endAt = ctx.currentTime; }
      else s.endAt = natural(s);
    };
    sources.push(s);
    return s;
  }
  ctx.destination = node("destination");
  ctx.createGain = () => node("gain", { gain: param(1) });
  ctx.createBiquadFilter = () => node("biquad", { type: "lowpass", frequency: param(350), Q: param(1), gain: param(0) });
  ctx.createStereoPanner = () => node("panner", { pan: param(0) });
  ctx.createConvolver = () => node("convolver", { buffer: null });
  ctx.createBuffer = (ch, len, sr) => {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: (i) => data[i] };
  };
  ctx.createBufferSource = () => { const s = source("buffer"); s.buffer = null; s.playbackRate = param(1); s.loopStart = 0; s.loopEnd = 0; return s; };
  ctx.createOscillator = () => { const s = source("osc"); s.type = "sine"; s.frequency = param(440); s.detune = param(0); return s; };
  // the clock moves to `to`, each source ending in turn
  ctx.advance = (to) => {
    for (;;) {
      let next = null;
      for (const s of sources) if (s.started && !s.ended && s.endAt <= to && (!next || s.endAt < next.endAt)) next = s;
      if (!next) break;
      ctx.currentTime = Math.max(ctx.currentTime, next.endAt);
      next.ended = true;
      if (typeof next.onended === "function") next.onended();
    }
    ctx.currentTime = to;
  };
  ctx._ = { nodes, sources, cuts };
  return ctx;
}

// A rig: the music on a fake context, ticked every 25 ms as main.js does. each(t) runs before each tick.
function rig({ lat = 0, score = null } = {}) {
  const ctx = fakeCtx();
  ctx.outputLatency = lat;
  const m = createMusic(ctx, { dest: ctx.destination, latencyS: lat, seed: 3, fetchFn: null, ...(score ? { score } : {}) });
  let t = 0;
  // a suspended context's clock stands still: then it ticks 40 times at the same time
  const run = (until, each) => {
    if (ctx.state !== "running") { for (let i = 0; i < 40; i++) { if (each) each(t); m.tick(t); } return; }
    while (t < until - 1e-9) {
      t = Math.round((t + 0.025) * 1000) / 1000;
      ctx.advance(t);
      if (each) each(t);
      m.tick(t);
    }
  };
  // every voice's start (context time): one per voice (a drum's sources share theirs)
  const starts = (from = -Infinity, to = Infinity) => [...new Set(ctx._.sources.filter((s) => s.started && !s.never && s.startAt >= from && s.startAt < to).map((s) => Math.round(s.startAt * 1e6) / 1e6))].sort((a, b) => a - b);
  return { ctx, m, run, starts, now: () => t };
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const barS = (id, tempo = 1) => CUES[id].meter * 60 / (CUES[id].bpm * tempo);

await check("bar lines lie on the cue's grid, latency taken off (swim at 168 bpm, 30 ms latency)", () => {
  const { m, run } = rig({ lat: 0.03 });
  m.cue("swim", 0.5, { level: 1 });
  run(12);
  const bars = m.stats().bars;
  assert.ok(bars.length >= 6, `${bars.length} bar lines`);
  for (const b of bars) {
    const k = Math.round((b.at + 0.03 - 0.5) / barS("swim"));
    assert.ok(near(b.at, 0.5 + k * barS("swim") - 0.03), `bar ${b.bar} at ${b.at}, not on the grid`);
  }
});

await check("swing: in split (swing 0.3) every note starts on a beat or at 0.65 of it", () => {
  const { m, run, starts } = rig();
  m.cue("split", 0.2, { level: 2 });
  run(16);
  const spb = 60 / CUES.split.bpm, fr = new Set();
  for (const t of starts(0.2)) fr.add(Math.round((((t - 0.2) / spb) % 1) * 1000) / 1000);
  const ok = [...fr].every((f) => near(f, 0, 0.002) || near(f, 1, 0.002) || near(f, 0.5 + CUES.split.swing / 2, 0.002));
  assert.ok(ok && fr.size >= 2, `fractions of the beat: ${[...fr].sort().join(", ")}`);
});

await check("a tempo change lands on a bar line (birth to 1.12), and the bars after are shorter", () => {
  const { m, run } = rig();
  m.cue("birth", 0.2, { level: 1 });
  run(6);
  m.setMood({ level: 1, tempo: 1.12 });
  run(14);
  const st = m.stats();
  const ch = st.changes.find((c) => c.kind === "mood" && c.tempo === 1.12);
  assert.ok(ch && st.bars.some((b) => near(b.at, ch.at)), "the change is not on a bar line");
  const after = st.bars.filter((b) => b.at >= ch.at - 1e-9);
  for (let i = 1; i < after.length; i++) assert.ok(near(after[i].at - after[i - 1].at, barS("birth", 1.12), 1e-6), `bar ${i} after: ${after[i].at - after[i - 1].at}`);
  const before = st.bars.filter((b) => b.at < ch.at - 1e-9);
  for (let i = 1; i < before.length; i++) assert.ok(near(before[i].at - before[i - 1].at, barS("birth"), 1e-6));
});

await check("a cue change lands on the old cue's bar line, its end stinger there, the new cue from it", () => {
  const { m, run } = rig();
  m.cue("swim", 0.2, { level: 1 });
  run(5);
  m.cue("egg", 5.0, { level: 1 });
  run(10);
  const st = m.stats();
  const ch = st.changes.find((c) => c.kind === "cue" && c.id === "egg");
  const k = (ch.at - 0.2) / barS("swim");
  assert.ok(ch && near(k, Math.round(k), 1e-6) && ch.at >= 5.0, `egg starts at ${ch && ch.at}`);
  assert.ok(st.stings.some((s) => s.id === CUES.swim.end && near(s.at, ch.at)), JSON.stringify(st.stings));
  assert.ok(near(st.bars.find((b) => b.at >= ch.at - 1e-9).at, ch.at), "egg's first bar line is not the change's");
});

await check("Music off while two stages go by: on again, the right cue plays at once (no end stinger, no bar of the old cue)", () => {
  const { m, run, starts } = rig();
  m.cue("swim", 0.1, { level: 1 });
  run(5);
  m.setEnabled(false);
  run(6);
  m.cue("egg", 6, { level: 1 });
  run(20);
  m.cue("split", 20, { level: 1 });
  run(30);
  const n0 = starts().length;
  m.setEnabled(true);
  run(36);
  const st = m.stats();
  assert.equal(st.cue, "split");
  const ch = st.changes.filter((c) => c.kind === "cue").pop();
  assert.ok(ch.id === "split" && ch.at < 30.2, `split starts at ${ch.at}`);
  assert.equal(st.stings.length, 0, `stingers: ${JSON.stringify(st.stings)}`);
  assert.ok(st.bars.filter((b) => b.at > 29).every((b) => b.bpm === CUES.split.bpm), JSON.stringify(st.bars.slice(-4)));
  assert.ok(starts().length > n0, "nothing plays after Music on");
});

await check("a cue whose first downbeat goes by before the first tick (the Play tap's stalled first frame) starts then, whole", () => {
  for (const stall of [0.3, 0.8]) {
    const { ctx, m, starts } = rig({ lat: 0.03 });
    m.cue("swim", 0.05, { level: 1 });           // asked for at the stage start, 20 ms ahead
    ctx.advance(stall);                           // the first frame bakes the paper: no tick for `stall` s
    for (let t = stall; t < stall + 3; t += 0.025) { ctx.advance(t); m.tick(t); }
    const st = m.stats();
    assert.equal(st.dropped, 0, `stall ${stall} s: ${st.dropped} notes dropped`);
    assert.ok(st.bars[0].at >= stall - 1e-6 && st.bars[0].at < stall + 0.05, `stall ${stall} s: first bar line at ${st.bars[0].at}`);
    assert.ok(near(starts()[0], st.bars[0].at, 1e-6), "the first note is not on the first bar line");
  }
});

await check("a cue that has not sounded yet (stage 6's, waiting for her first beat) is replaced at once", () => {
  const { m, run, starts } = rig();
  m.cue("answer", 0.2, { level: 1 });           // no beats given: it waits
  run(0.6);
  assert.equal(starts().length, 0);
  m.cue("turn", 0.6, { level: 1 });
  run(0.7);
  const st = m.stats();
  assert.equal(st.cue, "turn");
  assert.ok(starts().length > 0 && starts()[0] < 0.75, `turn's first note at ${starts()[0]}`);
  m.cue(null);
  assert.equal(m.stats().cue, "turn", "cue(null) on a cue already sounding waits for its bar line");
});

await check("stage 6 after a new run and after a Try again at another phase: every downbeat on her new beats within 1 ms", () => {
  const P = 60 / 78;
  const beatsFrom = (t0, until) => { const out = []; for (let t = t0; t < until; t += P) out.push(t); return out; };
  // a new run: fadeOut, the same cue again, her beats at another phase
  {
    const { m, run } = rig();
    let her = beatsFrom(0.5, 40);
    const feed = (t) => m.sync(her.filter((x) => x >= t - 0.5 && x <= t + 1), t - 0.5, t + 1);
    m.cue("answer", 0.5, { level: 1 });
    run(10, feed);
    m.fadeOut(0.5);
    her = beatsFrom(10.37, 40);
    m.cue("answer", 10.05, { level: 1 });
    run(22, feed);
    const bars = m.stats().bars.filter((b) => b.at > 10);
    const worst = Math.max(...bars.map((b) => Math.min(...her.map((x) => Math.abs(x - b.at)))));
    assert.ok(bars.length >= 5 && worst <= 0.001, `new run: ${bars.length} downbeats, worst ${(worst * 1000).toFixed(1)} ms`);
  }
  // a Try again: the cue goes on, her beats move to another phase (the beats laid before at the old phase, up to 1 s
  // ahead, must not pull the grid: with them it ran two bars at 300 bpm)
  for (const ph of [10.1, 10.29, 10.45, 10.6]) {
    const { m, run } = rig();
    let her = beatsFrom(0.5, 40);
    const feed = (t) => m.sync(her.filter((x) => x >= t - 0.5 && x <= t + 1), t - 0.5, t + 1);
    m.cue("answer", 0.5, { level: 1 });
    run(10, feed);
    her = [...her.filter((x) => x < 10), ...beatsFrom(ph, 40)];
    run(20, feed);
    const bars = m.stats().bars.filter((b) => b.at > 10);
    const worst = Math.max(...bars.map((b) => Math.min(...her.map((x) => Math.abs(x - b.at)))));
    const tempos = bars.map((b) => b.bpm);
    assert.ok(bars.length >= 4 && worst <= 0.001 && tempos.every((v) => Math.abs(v / 156 - 1) <= 0.1),
      `Try again at ${ph} s: ${bars.length} downbeats, worst ${(worst * 1000).toFixed(1)} ms, bpm ${tempos.join(" ")}`);
  }
});

await check("every cue at level 2 (boss), with stingers and a fadeOut: no node is let go while it still sounds, every voice is let go, at most 48 voices", () => {
  const problems = [];
  for (const id of CUE_ORDER) {
    const { ctx, m, run } = rig();
    m.cue(id, 0.1, { level: 2, boss: true });
    let most = 0;
    run(40, () => { most = Math.max(most, m.stats().voices); });
    m.sting("glowing", ctx.currentTime);
    m.sting("ko", ctx.currentTime);
    run(48);
    m.fadeOut(0.5);
    run(52);
    const { nodes, cuts } = ctx._;
    const held = nodes.filter((n) => n.kind === "gain" && !n.freed).length;      // the bus: out, dry, wet, duck, cue, stinger
    if (cuts.length) problems.push(`${id}: ${cuts.length} cut early (${JSON.stringify(cuts[0])})`);
    if (held !== 6) problems.push(`${id}: ${held} gains still connected (6 is the bus)`);
    if (most > VOICE_CAP) problems.push(`${id}: ${most} voices`);
    if (nodes.filter((n) => n.isSource && n.started && !n.ended).length) problems.push(`${id}: sources still playing`);
  }
  assert.deepEqual(problems, []);
});

await check("a big stinger (all its notes laid at once) loses none of them to the voice cap, over a cue at level 2 too", () => {
  // the cap once counted the voices laid ahead and took them before they started: 39 of glowing's 130 sources never
  // sounded on their own, 136 under birth's light
  const problems = [];
  for (const [id, cue] of [["glowing", null], ["glowing", "root"], ["win", "egg"], ["light", "birth"], ["great", "grow"]]) {
    const { ctx, m, run } = rig();
    if (cue) m.cue(cue, 0.1, { level: 2 });
    run(10);
    const n0 = ctx._.sources.length;
    m.sting(id, 10);
    const laid = ctx._.sources.slice(n0);
    run(20);
    const lost = laid.filter((s) => s.never).length;
    if (lost) problems.push(`${id}${cue ? " over " + cue : ""}: ${lost} of ${laid.length} sources never sound`);
    if (m.stats().voices > VOICE_CAP) problems.push(`${id}: ${m.stats().voices} voices`);
  }
  assert.deepEqual(problems, []);
});

await check("a note at the very end of a tick's window is played, not lost between two windows", () => {
  // every note notesIn hands the engine is played (none dropped by its own window edges)
  for (const id of ["title", "grow", "birth"]) {
    let given = 0;
    const score = { ...SCORE, notesIn: (...a) => { const r = SCORE.notesIn(...a); given += r.length; return r; } };
    const { m, run } = rig({ score });
    m.cue(id, 0.1, { level: 2 });
    run(70);
    assert.equal(m.stats().scheduled, given, `${id}: ${given} notes given, ${m.stats().scheduled} played`);
  }
});

await check("a stinger lands on the next beat and the cue ducks by its ducks; a second stinger waits for the first", () => {
  const { m, run } = rig();
  m.cue("root", 0.2, { level: 1 });
  run(4);
  const spb = 60 / CUES.root.bpm;
  m.sting("good", 4.21);
  m.sting("great", 4.21);
  run(9);
  const st = m.stats();
  const [a, b] = st.stings;
  const k = (a.at - 0.2) / spb;
  assert.ok(a.id === "good" && near(k, Math.round(k), 1e-6) && a.at >= 4.21 && a.at < 4.21 + spb + 1e-6, JSON.stringify(a));
  assert.ok(b.id === "great" && b.at >= a.at + SCORE.stingerSeconds("good") - 0.02, `great at ${b.at}, good ends at ${a.at + SCORE.stingerSeconds("good")}`);
  const kb = (b.at - 0.2) / spb;
  assert.ok(near(kb, Math.round(kb), 1e-6), "the second stinger is not on a beat");
});

await check("fadeOut: every voice ends within 1.25 × its seconds, and the voices laid ahead never sound", () => {
  const { ctx, m, run } = rig();
  m.cue("grow", 0.1, { level: 2 });
  run(10);
  m.sting("light", 10.0);                        // 7.5 s of held chord, laid ahead
  run(10.5);
  m.fadeOut(1.0);
  const t = ctx.currentTime;
  run(13);
  const late = ctx._.sources.filter((s) => s.started && !s.never && s.endAt > t + 1.25 + 1e-6);
  const ahead = ctx._.sources.filter((s) => s.started && s.startAt > t + 0.01 && !s.never);
  assert.equal(m.stats().cue, null);
  assert.ok(late.length === 0, `${late.length} voices sound on past ${(t + 1.25).toFixed(2)} s`);
  assert.ok(ahead.length === 0, `${ahead.length} voices laid ahead still sound`);
});

await check("nothing is scheduled while suspended, hidden or with Music off, and the cue goes on from a new bar line", () => {
  const { ctx, m, run, starts } = rig();
  m.cue("swim", 0.1, { level: 1 });
  run(4);
  const hold = (what, on) => {
    if (what === "suspended") ctx.state = on ? "suspended" : "running";
    else if (what === "hidden") globalThis.document = on ? { hidden: true } : undefined;
    else m.setEnabled(!on);
  };
  let at = 4;
  for (const what of ["suspended", "hidden", "music"]) {
    hold(what, true);
    run(at + 0.2);
    const n = starts(at + 0.5).length;
    run(at + 3);
    assert.equal(starts(at + 0.5).length, n, `${what}: notes laid while stopped`);
    hold(what, false);
    const resumeAt = ctx.currentTime;
    run(ctx.currentTime + 3);
    const bar = m.stats().bars.find((b) => b.at >= resumeAt - 1e-9);
    assert.ok(bar && bar.at <= resumeAt + 0.2, `${what}: no bar line on resuming (${bar && bar.at} after ${resumeAt})`);
    assert.ok(starts(resumeAt).length > 0, `${what}: nothing after resuming`);
    at = ctx.currentTime;
  }
  delete globalThis.document;
});

await check("tick() costs at most 2 ms at p99 (mean under 0.3 ms) with every cue at level 2", () => {
  const ms = [];
  for (const id of CUE_ORDER) {
    const { ctx, m } = rig();
    m.cue(id, 0.1, { level: 2, boss: true });
    for (let t = 0.025; t < 30; t += 0.025) {
      ctx.advance(t);
      const a = performance.now();
      m.tick(t);
      ms.push(performance.now() - a);
    }
  }
  ms.sort((a, b) => a - b);
  const p99 = ms[Math.floor(ms.length * 0.99)], mean = ms.reduce((s, x) => s + x, 0) / ms.length;
  assert.ok(p99 <= 2 && mean <= 0.3, `p99 ${p99.toFixed(3)} ms, mean ${mean.toFixed(3)} ms`);
});

if (failed.length) {
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  for (const f of failed) console.log("  - " + f);
  process.exit(1);
}
console.log(`PASS ${FILE}: ${passed} checks`);
