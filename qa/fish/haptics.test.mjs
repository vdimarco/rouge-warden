// Checks public/fish/js/haptics.js. Parts 1-2 run in plain node: a recorder stands in for navigator.vibrate, and a
// fake clock drives it. Part 4 (also node) is the iPhone app: a stub window.Capacitor whose Haptics plugin records
// every call. Part 3 checks the iPhone switch pads in headless Chromium, with the platform forced to "ios"
// (it serves public/ with python3 on a free port, and needs the playwright package: project, NODE_PATH or npm -g).
// Run: node qa/fish/haptics.test.mjs   (exit code 1 on failure)
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = new URL("../../public/fish/js/haptics.js", import.meta.url).href;
let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok    " + name); } catch (e) { failed++; console.log("FAIL  " + name + "\n      " + (e && e.message)); }
}

/* ---------- 1. plain node: no window, no vibrate. Every call must be a quiet no-op ---------- */
{
  const { Haptics } = await import(SRC + "?plain");
  check("plain node: kind is none and every call is a safe no-op", () => {
    assert.equal(Haptics.kind, "none");
    assert.equal(Haptics.enabled, true);
    Haptics.unlock(); Haptics.tick(); Haptics.bail(); Haptics.bail(true); Haptics.bump(0.4); Haptics.thump(); Haptics.hookset();
    Haptics.jolt(); Haptics.land(); Haptics.land(2); Haptics.splash(0.5); Haptics.load(); Haptics.setTension(0.9, 1, true); Haptics.setCrank(2);
    Haptics.throb(); Haptics.rub(0.8); Haptics.thrash(); Haptics.charge(); Haptics.phase();
    Haptics.thump(0.3); Haptics.turn(); Haptics.big(); Haptics.shutter(); Haptics.surge();
    Haptics.mute(100); Haptics.mute(0); Haptics.stop();
    assert.equal(Haptics.attachPad({}), null);
    assert.equal(Haptics.attachCrank({}, { toLocal: (x, y) => ({ x, y }) }), null);
  });
}

/* ---------- 2. an Android phone: a stub navigator, a stub localStorage, a fake clock ---------- */
const calls = [];                          // { t, p }: every vibrate() call
let T = 1000;                              // the fake clock, ms
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const phone = {
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
  maxTouchPoints: 5,
  vibrate(p) { calls.push({ t: T, p: Array.isArray(p) ? p.slice() : p }); return true; },
};
Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: phone });
const { Haptics: H } = await import(SRC + "?android");
H._clock(() => T);

const pulses = () => calls.filter((c) => Array.isArray(c.p) || c.p > 0);
const onMs = (p) => (Array.isArray(p) ? p : [p]).filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
const lenMs = (p) => (Array.isArray(p) ? p : [p]).reduce((a, b) => a + b, 0);
function fresh() { H._reset(); H.setEnabled(true); H.unlock(); calls.length = 0; T += 5000; }
// run the game loop at 60 fps for ms, calling fn every frame
function run(ms, fn, fps = 60) {
  const end = T + ms, dt = 1000 / fps;
  while (T < end) { fn(T); T += dt; }
}
// the most calls that fall in any window of `win` ms
function maxInWindow(list, win = 1000) {
  let best = 0;
  for (let i = 0, j = 0; i < list.length; i++) { while (list[i].t - list[j].t >= win) j++; best = Math.max(best, i - j + 1); }
  return best;
}
// pulses closer than 50 ms blur into one buzz: the longest such buzz, ms
function longestBuzz(list) {
  let best = 0, start = null, end = -1e9;
  for (const c of list) {
    if (!Array.isArray(c.p) && !(c.p > 0)) continue;
    if (start === null || c.t - end > 50) start = c.t;
    end = Math.max(end, c.t + lenMs(c.p));
    best = Math.max(best, end - start);
  }
  return best;
}
const intervals = (list) => list.slice(1).map((c, i) => c.t - list[i].t);
const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);

check("detects an Android phone as kind vibrate, enabled by default", () => {
  assert.equal(H.kind, "vibrate");
  assert.equal(H.enabled, true);
});

check("no vibrate before the first gesture (unlock or a finger lift)", () => {
  run(2000, () => { H.tick(); H.bail(); H.bump(1); H.thump(); H.jolt(); H.land(); H.setTension(0.9, 0, true); H.setCrank(2); });
  assert.equal(calls.length, 0, "calls before unlock: " + calls.length);
  H.unlock();
  T += 1000;
  assert.equal(H.thump(), true);
  assert.equal(calls.length, 1);
});

check("navigator.userActivation wins: hasBeenActive false blocks even after unlock()", () => {
  fresh();
  phone.userActivation = { hasBeenActive: false };
  H.unlock(); H.thump(); H.tick();
  assert.equal(calls.length, 0);
  phone.userActivation.hasBeenActive = true;
  assert.equal(H.thump(), true);
  delete phone.userActivation;
});

check("priorities: a tick or a nibble does not cut a strike; a quick hook set and a snap do; the snap leaves a silence", () => {
  fresh();
  assert.equal(H.thump(), true);                        // [45, 25, 90] = 160 ms
  T += 20; assert.equal(H.tick(), false, "tick cut the strike");
  T += 20; assert.equal(H.bump(0.8), false, "nibble cut the strike");
  T += 20; assert.equal(H.bail(), false, "bail cut the strike");
  T += 20; assert.equal(H.hookset(), true, "a quick hook set could not cut the strike");
  T += 10; assert.equal(H.jolt(), true, "snap did not cut the hook set");
  // 140 ms buzz + 600 ms of enforced quiet
  T += 300; assert.equal(H.thump(), false, "strike during the snap silence");
  run(300, () => H.setTension(0.9, 0, true));
  assert.equal(calls.length, 3, "anything during the snap silence");   // the strike, the hook set and the snap
  T += 200; assert.equal(H.thump(), true, "strike after the silence");
  // a strong effect preempts a weak one that is still playing
  T += 1000; H.land(); T += 5; assert.equal(H.jolt(), true);
  T += 1000; H.bump(0.2); T += 2; assert.equal(H.thump(), true, "strike could not preempt a nibble");
  T += 1000; H.tick(); T += 2; assert.equal(H.bail(), true, "bail could not preempt a tick");
});

check("the tension train speeds up with tension (interval 600 - 520 t^1.5, width 6 + 18 t)", () => {
  const rates = [];
  for (const f of [0.2, 0.4, 0.6, 0.8]) {
    fresh();
    run(6000, () => H.setTension(f, 0, true));
    const list = pulses();
    const iv = mean(intervals(list));
    const want = 600 - 520 * Math.pow(f, 1.5);
    const w = list[0].p[0];
    rates.push(list.length / 6);
    console.log(`      t=${f}: ${(list.length / 6).toFixed(2)} pulses/s, interval ${iv.toFixed(0)} ms (want ${want.toFixed(0)}), width ${w} ms (want ${Math.round(6 + 18 * f)})`);
    assert.ok(Math.abs(iv - want) < 17, `interval ${iv} vs ${want}`);
    assert.equal(w, Math.round(6 + 18 * f));
    assert.ok(list.every((c) => c.p.length === 1), "single pulses below 0.85");
  }
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i] > rates[i - 1], "rate did not rise: " + rates.join(", "));
});

check("near the break (t > 0.85): double pulses with jitter", () => {
  fresh();
  run(3000, () => H.setTension(0.92, 0, true));
  const list = pulses();
  assert.ok(list.length > 8);
  assert.ok(list.every((c) => c.p.length === 3 && c.p[1] === 30), "not [w, 30, w]");
  const iv = intervals(list).filter((v) => v < 400);
  const spread = Math.max(...iv) - Math.min(...iv);
  console.log(`      t=0.92: ${list.length} doubles in 3 s, intervals ${Math.min(...iv).toFixed(0)}..${Math.max(...iv).toFixed(0)} ms`);
  assert.ok(spread > 20, "no jitter: " + spread);
});

check("slack line and fight off: no tension pulses", () => {
  fresh();
  run(2000, () => H.setTension(0.03, 0, true));
  run(2000, () => H.setTension(0.9, 2, false));
  assert.equal(calls.length, 0);
});

// each "on" segment of every call, as { t, w }
function onsets(list) {
  const out = [];
  for (const c of list) {
    if (!Array.isArray(c.p)) continue;
    let t = c.t;
    c.p.forEach((v, i) => { if (i % 2 === 0) out.push({ t, w: v }); t += v; });
  }
  return out;
}

check("drag slip: 8-12 ms pulses every 30-80 ms, faster when it slips faster", () => {
  const got = [];
  for (const slip of [0.3, 1, 2.5]) {
    fresh();
    run(1200, () => H.setTension(0.7, slip, true));   // shorter than the 1.5 s cap
    const on = onsets(pulses());
    const iv = intervals(on);
    got.push(mean(iv));
    console.log(`      slip ${slip} m/s: ${on.length} pulses in ${pulses().length} calls in 1.2 s, width ${on[0].w} ms, every ${Math.min(...iv).toFixed(0)}..${Math.max(...iv).toFixed(0)} ms`);
    assert.ok(on.every((p) => p.w >= 8 && p.w <= 12), "widths " + on.map((p) => p.w).join(","));
    assert.ok(iv.every((v) => v >= 28 && v <= 97), "intervals " + iv.map((v) => v.toFixed(0)).join(","));
  }
  assert.ok(got[0] > got[1] && got[1] > got[2], "not faster with more slip: " + got.join(", "));
});

check("never one continuous buzz longer than ~1.5 s (drag, top tension, fast crank)", () => {
  for (const [name, fn] of [["drag 3 m/s", () => H.setTension(0.8, 3, true)], ["tension 1.0", () => H.setTension(1, 0, true)], ["crank 6 rev/s", () => H.setCrank(6)]]) {
    fresh();
    run(8000, fn);
    const buzz = longestBuzz(calls);
    const n = pulses().length;
    console.log(`      ${name}: ${n} calls in 8 s, longest buzz ${buzz.toFixed(0)} ms`);
    assert.ok(n > 20, name + ": too few pulses");
    assert.ok(buzz <= 1500, name + ": buzz " + buzz);
  }
});

check("crank: ~4 ticks a turn, capped at 15/s, then a light whirr", () => {
  for (const rps of [0.5, 1, 2, 3]) {
    fresh();
    run(4000, () => H.setCrank(rps));
    const n = pulses().length / 4, want = Math.min(15, rps * 4);
    console.log(`      ${rps} rev/s: ${n.toFixed(2)} ticks/s (want ~${want})`);
    assert.ok(Math.abs(n - want) <= 0.6, `${rps} rev/s: ${n} ticks/s`);
    assert.ok(pulses().every((c) => c.p.length === 1 && c.p[0] === 8));
  }
  fresh();
  run(4000, () => H.setCrank(5));
  const list = pulses();
  assert.ok(list.length > 0 && list.every((c) => c.p.length === 7), "fast crank is not a whirr");
  assert.ok(maxInWindow(list) <= 9, "whirr calls/s " + maxInWindow(list));
  fresh();
  run(2000, () => H.setCrank(0));
  assert.equal(calls.length, 0, "ticks with the crank still");
});

check("mute(ms) silences, mute(0) unmutes", () => {
  fresh();
  H.mute(1000);
  assert.equal(H.thump(), false);
  run(900, () => { H.setTension(0.7, 0, true); H.setCrank(2); H.tick(); });
  assert.equal(calls.length, 0);
  T += 200;
  assert.equal(H.thump(), true);
  T += 500;
  H.mute(4000); T += 10;
  assert.equal(H.bail(), false);
  H.mute(0);
  assert.equal(H.bail(), true);
  // muting cuts a long pattern that plays, but lets a tick finish
  T += 500; H.land(); const n = calls.length; H.mute(3000);
  assert.equal(calls.length, n + 1); assert.equal(calls[calls.length - 1].p, 0);
  H.mute(0); T += 500; H.tick(); const m = calls.length; H.mute(3000);
  assert.equal(calls.length, m, "a tick was cancelled");
});

check("setEnabled(false) silences everything and is saved in fish.haptics", () => {
  fresh();
  H.land();
  H.setEnabled(false);
  assert.equal(calls[calls.length - 1].p, 0, "the playing pattern was not stopped");
  assert.equal(store.get("fish.haptics"), "false");
  calls.length = 0;
  run(3000, () => { H.tick(); H.bail(); H.bump(1); H.thump(); H.hookset(); H.jolt(); H.land(); H.splash(1); H.load(); H.setTension(0.95, 2, true); H.setCrank(3); });
  assert.equal(calls.length, 0);
  assert.equal(H.enabled, false);
  H.setEnabled(true);
  assert.equal(store.get("fish.haptics"), "true");
  assert.equal(H.thump(), true);
});

{
  // the next visit: a new page load reads the saved setting
  store.set("fish.haptics", "false");
  const { Haptics: H2 } = await import(SRC + "?reload");
  check("the saved setting comes back on the next page load", () => assert.equal(H2.enabled, false));
  store.set("fish.haptics", "true");
}

check("a hidden page gets no vibrate calls", () => {
  fresh();
  globalThis.document = { visibilityState: "hidden" };
  run(1000, () => { H.thump(); H.setTension(0.9, 1, true); H.setCrank(2); });
  delete globalThis.document;
  assert.equal(calls.length, 0);
});

check("stop() cancels a playing pattern and the trains", () => {
  fresh();
  H.land();
  T += 10;
  H.stop();
  assert.equal(calls[calls.length - 1].p, 0);
  // stop() with nothing playing makes no call at all
  T += 1000; const n = calls.length; H.stop();
  assert.equal(calls.length, n);
});

check("at most ~30 calls/s and ~15 ticks/s, whatever the game spams", () => {
  fresh();
  let f = 0;
  run(8000, () => {
    f++;
    H.tick(); H.setCrank(3.5); H.setTension(f % 200 < 100 ? 0.95 : 0.6, f % 300 < 120 ? 2 : 0, true);
    if (f % 3 === 0) H.bump(0.3);
    if (f % 7 === 0) H.splash(0.4);
    if (f % 45 === 0) H.thump();
  });
  const peak = maxInWindow(calls);
  const ticks = maxInWindow(calls.filter((c) => Array.isArray(c.p) && c.p.length === 1 && c.p[0] === 8));
  console.log(`      ${calls.length} calls in 8 s; busiest second ${peak} calls, ${ticks} ticks`);
  assert.ok(peak <= 30, "calls/s " + peak);
  assert.ok(ticks <= 15, "ticks/s " + ticks);
  assert.ok(longestBuzz(calls) <= 1600, "buzz " + longestBuzz(calls));
});

check("every pattern is short and odd-length, with pulses of 6 ms or more", () => {
  fresh();
  H.tick(); T += 500; H.bail(); T += 500; H.bail(true); T += 500; H.bail(false); T += 500; H.bump(0.1); T += 500; H.bump(0.9);
  T += 500; H.thump(); T += 500; H.hookset(); T += 500; H.land(); T += 500; H.splash(0.2); T += 500; H.splash(1); T += 500; H.load();
  T += 500; H.jolt(); T += 1000;
  run(1000, () => H.setTension(0.95, 0, true));
  const bad = calls.filter((c) => Array.isArray(c.p) && (c.p.length > 9 || c.p.length % 2 === 0 || c.p.some((v, i) => i % 2 === 0 && v < 6)));
  assert.equal(bad.length, 0, JSON.stringify(bad));
  const shapes = calls.slice(0, 14).map((c) => JSON.stringify(c.p)).join(" ");
  console.log("      patterns: " + shapes);
  assert.ok(calls.length >= 14);
});

/* ---------- the new fights: sulk, rub, thrash, charge, a boss stage, and a big landing ---------- */
check("throb: one lub-dub a second, however often the game calls it", () => {
  fresh();
  run(5000, () => H.throb());
  const list = pulses();
  console.log(`      ${list.length} throbs in 5 s, every ${mean(intervals(list)).toFixed(0)} ms, pattern ${JSON.stringify(list[0].p)}`);
  assert.ok(list.length >= 5 && list.length <= 6, "throbs " + list.length);
  assert.ok(Math.abs(mean(intervals(list)) - 1000) < 40, "interval " + mean(intervals(list)));
  assert.deepEqual(list[0].p, [34, 70, 20]);
  // it does not run when the player turned the buzz off
  fresh(); H.setEnabled(false); run(2000, () => H.throb()); assert.equal(calls.length, 0); H.setEnabled(true);
});

check("rub: a scratchy double click that comes quicker as the meter fills, and stops at 0", () => {
  const rates = [], widths = [];
  for (const lv of [0.1, 0.4, 0.7, 1]) {
    fresh();
    run(3000, () => H.rub(lv));
    const list = pulses(), iv = mean(intervals(list));
    rates.push(list.length / 3); widths.push(list[0].p[0]);
    console.log(`      rub ${lv}: ${(list.length / 3).toFixed(1)} clicks/s, interval ${iv.toFixed(0)} ms, ${JSON.stringify(list[0].p)}`);
    assert.ok(list.every((c) => c.p.length === 3), "double clicks");
    assert.ok(maxInWindow(list) <= 26, "the continuous budget");
    assert.ok(longestBuzz(list) <= 1600, "one long buzz");
  }
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i] > rates[i - 1], "rate did not rise: " + rates.join(", "));
  for (let i = 1; i < widths.length; i++) assert.ok(widths[i] >= widths[i - 1], "clicks did not grow: " + widths.join(", "));
  // a meter that empties: no more buzz
  fresh(); run(1000, () => H.rub(0.6)); const n = calls.length; run(1000, () => H.rub(0)); assert.equal(calls.length, n, "rub(0) buzzed");
  // the scratch is not a metronome
  fresh(); run(4000, () => H.rub(0.5));
  const iv = intervals(pulses()); assert.ok(Math.max(...iv) - Math.min(...iv) > 10, "the intervals never vary");
});

check("rub, throb and the tension train share the motor without breaking the call limit", () => {
  fresh();
  let f = 0;
  run(6000, () => { f++; H.setTension(0.7, 0, true); H.rub(f % 240 < 150 ? 0.9 : 0); H.throb(); H.setCrank(2); });
  console.log(`      ${calls.length} calls in 6 s, busiest second ${maxInWindow(calls)}`);
  assert.ok(maxInWindow(calls) <= 30);
  assert.ok(longestBuzz(calls) <= 1600);
});

check("thrash is three bumps at 8 Hz, charge two light bumps, a boss stage one 300 ms buzz", () => {
  fresh();
  assert.equal(H.thrash(), true);
  assert.deepEqual(calls[0].p, [14, 111, 14, 111, 14]);
  assert.ok(Math.abs(lenMs(calls[0].p) - 264) <= 1);
  T += 500; assert.equal(H.charge(), true); assert.deepEqual(calls[1].p, [10, 100, 10]);
  T += 500; assert.equal(H.phase(), true); assert.deepEqual(calls[2].p, [300]);
  // a nibble does not cut the boss buzz; a snap does
  T += 50; assert.equal(H.bump(0.5), false, "a bump cut the stage buzz");
  T += 10; assert.equal(H.jolt(), true);
});

check("land(): a trophy shakes longer than a fish, and a legend longest", () => {
  const len = [];
  for (const lv of [0, 1, 2]) { fresh(); assert.equal(H.land(lv), true); len.push(lenMs(calls[0].p)); }
  console.log("      land 0/1/2: " + len.join(" / ") + " ms");
  assert.ok(len[1] > len[0] && len[2] > len[1] && len[0] === 250);
  assert.deepEqual(calls.at(-1).p, [60, 50, 60, 50, 60, 50, 250, 100, 400]);
  // no argument, or nonsense: a plain fish
  fresh(); H.land(); assert.equal(lenMs(calls[0].p), 250);
  fresh(); H.land(NaN); assert.equal(lenMs(calls[0].p), 250);
  fresh(); H.land(9); assert.equal(lenMs(calls[0].p), len[2]);
});

check("the new patterns are short, odd-length, with pulses of 6 ms or more", () => {
  fresh();
  H.throb(); T += 1100; H.throb(); T += 500; H.thrash(); T += 500; H.charge(); T += 500; H.phase(); T += 500; H.land(1); T += 1000; H.land(2); T += 1000;
  run(1000, () => H.rub(1));
  const bad = calls.filter((c) => Array.isArray(c.p) && (c.p.length > 9 || c.p.length % 2 === 0 || c.p.some((v, i) => i % 2 === 0 && v < 6)));
  assert.equal(bad.length, 0, JSON.stringify(bad));
});

check("the last run: its buzz is not the snap, and the drag buzz keeps going under it", () => {
  // the drag starts to slip as the run starts; after a surge the ratchet comes back as soon as the surge ends
  const first = (warn) => {
    fresh();
    assert.equal(warn(), true);
    const t0 = T, warnCall = calls.at(-1).p;
    run(1000, () => H.setTension(0.6, 2, true));
    const drag = pulses().filter((c) => c.t > t0);
    return { warnCall, at: drag.length ? drag[0].t - t0 : Infinity, n: drag.length };
  };
  const surge = first(() => H.surge()), snap = first(() => H.jolt());
  console.log(`      surge ${JSON.stringify(surge.warnCall)}: first drag pulse at ${surge.at.toFixed(0)} ms, ${surge.n} in 1 s; ` +
    `snap ${JSON.stringify(snap.warnCall)}: first at ${snap.at.toFixed(0)} ms, ${snap.n} in 1 s`);
  assert.notDeepEqual(surge.warnCall, snap.warnCall, "the last run plays the snap buzz");
  assert.ok(surge.at <= 350, "the drag waits " + surge.at + " ms after the surge");
  assert.ok(surge.n >= 8, "drag pulses in the first second: " + surge.n);
  assert.ok(snap.at >= 700, "the snap no longer leaves its silence");
  // a nibble does not cut the warning
  fresh(); H.surge(); T += 30; assert.equal(H.bump(0.5), false);
});

/* ---------- the big moments: the strike alone thumps, the hook set buzzes longest, each event has its own pattern ---------- */
check("the strike scales with how hard it hit; the hook set buzzes longer than the hardest strike", () => {
  const one = (fn) => { fresh(); assert.equal(fn(), true); return calls[0].p; };
  const soft = one(() => H.thump(0.3)), plain = one(() => H.thump()), hard = one(() => H.thump(1)), set = one(() => H.hookset());
  console.log(`      strike soft ${JSON.stringify(soft)} / default ${JSON.stringify(plain)} / hard ${JSON.stringify(hard)}; hook set ${JSON.stringify(set)}`);
  assert.deepEqual(plain, [45, 25, 90], "the default strike changed (the pinball lab uses it)");
  assert.ok(onMs(soft) < onMs(plain) && onMs(plain) < onMs(hard), "the strike does not grow with its strength");
  assert.ok(onMs(set) > onMs(hard) && lenMs(set) > lenMs(hard), `the hook set (${onMs(set)} ms on) is not longer than the hardest strike (${onMs(hard)} ms on)`);
  assert.ok(onMs(hard) <= 150, "the hardest strike is more than 150 ms on");
});

check("it turned, a big one and the shutter each have their own light pattern, not the strike's", () => {
  fresh(); assert.equal(H.turn(), true); assert.deepEqual(calls[0].p, [20, 60, 20, 60, 20]);
  fresh(); assert.equal(H.big(), true); assert.deepEqual(calls[0].p, [60]);
  fresh(); assert.equal(H.shutter(), true); assert.deepEqual(calls[0].p, [10, 50, 10]);
  // the warnings may cut the drag train, never the strike or a snap
  fresh(); H.thump(); T += 20; assert.equal(H.turn(), false, "it turned cut the strike"); assert.equal(H.big(), false, "a big one cut the strike");
  fresh(); run(300, () => H.setTension(0.6, 2, true)); assert.equal(H.turn(), true, "it turned could not cut the drag");
});

check("no two named events share a pattern (but the strengths of bump and splash)", () => {
  const table = {
    tick: () => H.tick(), bail: () => H.bail(), bailOpen: () => H.bail(true), bailShut: () => H.bail(false), nibble: () => H.bump(0.5),
    strike: () => H.thump(), softStrike: () => H.thump(0.3), hookset: () => H.hookset(), snap: () => H.jolt(), lastrun: () => H.surge(),
    land: () => H.land(0), trophy: () => H.land(1), legend: () => H.land(2), thrash: () => H.thrash(), charge: () => H.charge(), phase: () => H.phase(),
    splash: () => H.splash(0.5), load: () => H.load(), turn: () => H.turn(), big: () => H.big(), shutter: () => H.shutter(),
  };
  const seen = new Map();
  for (const [name, fn] of Object.entries(table)) {
    fresh(); assert.equal(fn(), true, name + " did not buzz");
    const key = JSON.stringify(calls[0].p);
    assert.ok(!seen.has(key), `${name} has the same pattern as ${seen.get(key)}: ${key}`);
    seen.set(key, name);
  }
});

/* ---------- 4. the iPhone app: a stub Capacitor, its Haptics plugin records every call ---------- */
{
  const hx = [];                             // { t, m, a }: every plugin call
  const rec = (m) => (o) => { hx.push({ t: T, m, a: o ? o.style || o.type : undefined }); return Promise.resolve(); };
  const plugin = { impact: rec("impact"), notification: rec("notification"), selectionStart: rec("selectionStart"), selectionChanged: rec("selectionChanged"), selectionEnd: rec("selectionEnd"), vibrate: rec("vibrate") };
  globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", isPluginAvailable: (n) => n === "Haptics", Plugins: { Haptics: plugin } };
  // the later steps of a pattern run on the fake clock
  const queue = [];
  H._timers({ later: (fn, ms) => { const job = { at: T + ms, fn }; queue.push(job); return job; }, clear: (job) => { const i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1); } });
  const wait = (ms) => {
    const end = T + ms;
    for (;;) { queue.sort((a, b) => a.at - b.at); const job = queue[0]; if (!job || job.at > end) break; queue.shift(); T = job.at; job.fn(); }
    T = end;
  };
  const words = (from = 0) => hx.slice(from).map((c) => c.a ? c.m + ":" + c.a : c.m);
  // the steps of one call: the word and when it came, from the first
  const steps = () => hx.map((c) => [c.t - hx[0].t, c.a || c.m]);
  const nfresh = () => { H._reset(); H.setEnabled(true); hx.length = 0; calls.length = 0; queue.length = 0; T += 5000; };

  H._forcePlatform("auto");
  check("the iPhone app: the Haptics plugin makes the kind native (before navigator.vibrate)", () => assert.equal(H.kind, "native"));

  check("the iPhone app: a strike is two heavy impacts, 70 ms apart, with no first gesture and no vibrate call", () => {
    nfresh();
    assert.equal(H.thump(), true);
    wait(300);
    assert.deepEqual(steps(), [[0, "HEAVY"], [70, "HEAVY"]]);
    assert.equal(calls.length, 0, "navigator.vibrate was called");
  });

  check("the iPhone app: the hook set is heavy, medium, heavy (longer than the strike); land(2) is SUCCESS and 4 heavy taps; the snap is ERROR", () => {
    nfresh(); H.hookset(); wait(300); assert.deepEqual(steps(), [[0, "HEAVY"], [40, "MEDIUM"], [110, "HEAVY"]]);
    nfresh(); H.land(2); wait(1000); assert.deepEqual(words(), ["notification:SUCCESS", "impact:HEAVY", "impact:HEAVY", "impact:HEAVY", "impact:HEAVY"]);
    nfresh(); H.land(0); wait(1000); assert.deepEqual(words(), ["notification:SUCCESS", "impact:HEAVY"]);
    nfresh(); H.jolt(); wait(300); assert.deepEqual(words(), ["notification:ERROR"]);
    nfresh(); H.phase(); wait(300); assert.deepEqual(words(), ["notification:WARNING"]);
    nfresh(); H.surge(); wait(300); assert.deepEqual(words(), ["impact:MEDIUM", "impact:MEDIUM", "impact:HEAVY"]);
    nfresh(); H.thrash(); wait(400); assert.deepEqual(steps(), [[0, "MEDIUM"], [125, "MEDIUM"], [250, "MEDIUM"]]);
    nfresh(); H.bail(true); T += 500; H.bail(false); T += 500; H.bump(0.2); T += 500; H.bump(0.9); T += 500; H.splash(0.3); T += 500; H.splash(1); T += 500; H.load();
    assert.deepEqual(words(), ["impact:LIGHT", "impact:MEDIUM", "impact:LIGHT", "impact:MEDIUM", "impact:MEDIUM", "impact:HEAVY", "impact:LIGHT"]);
  });

  check("the iPhone app: the new patterns: a soft strike (still two heavy impacts), it turned, a big one, the shutter", () => {
    nfresh(); H.thump(0.3); wait(300); assert.deepEqual(steps(), [[0, "HEAVY"], [70, "HEAVY"]]);
    nfresh(); H.thump(0); wait(300); assert.deepEqual(steps(), [[0, "HEAVY"], [70, "HEAVY"]]);
    nfresh(); H.thump(1); wait(300); assert.deepEqual(steps(), [[0, "HEAVY"], [70, "HEAVY"]]);
    nfresh(); H.turn(); wait(300); assert.deepEqual(steps(), [[0, "LIGHT"], [80, "MEDIUM"], [160, "MEDIUM"]]);
    nfresh(); H.big(); wait(300); assert.deepEqual(steps(), [[0, "HEAVY"], [90, "LIGHT"]]);
    nfresh(); H.shutter(); wait(300); assert.deepEqual(steps(), [[0, "LIGHT"], [60, "LIGHT"]]);
    // the hook set spans longer than the strike, with more impacts
    nfresh(); H.thump(1); wait(300); const strike = steps(); nfresh(); H.hookset(); wait(300); const set = steps();
    assert.ok(set.length > strike.length && set.at(-1)[0] > strike.at(-1)[0], "the hook set is not longer than the strike on the iPhone");
  });

  check("the iPhone app: a quick hook set cuts the strike, and the strike's second impact does not come in the middle of it", () => {
    nfresh(); H.thump(1); T += 20; assert.equal(H.hookset(), true); wait(300);
    assert.deepEqual(steps(), [[0, "HEAVY"], [20, "HEAVY"], [60, "MEDIUM"], [130, "HEAVY"]]);
    // the snap cuts the strike the same way: nothing heavy comes in its silence
    nfresh(); H.thump(1); T += 20; assert.equal(H.jolt(), true); wait(300);
    assert.deepEqual(words(), ["impact:HEAVY", "notification:ERROR"]);
    // a pattern that has played out leaves nothing to drop: the next one plays in full, and so did it
    nfresh(); H.land(2); wait(1000); H.thump(1); wait(300);
    assert.deepEqual(words(), ["notification:SUCCESS", "impact:HEAVY", "impact:HEAVY", "impact:HEAVY", "impact:HEAVY", "impact:HEAVY", "impact:HEAVY"]);
  });

  check("the iPhone app: the same gates as the web buzz (priority, the snap silence)", () => {
    nfresh();
    H.thump(); T += 20;
    assert.equal(H.tick(), false); assert.equal(H.bump(0.8), false); assert.equal(H.turn(), false);
    assert.equal(H.jolt(), true);
    T += 300; assert.equal(H.thump(), false, "a strike in the snap silence");
    wait(1000);
    assert.equal(H.thump(), true);
  });

  check("the iPhone app: mute, Buzz and taps off, and a hidden page stop every call (and the steps still to come)", () => {
    nfresh(); H.mute(1000); H.thump(); H.land(2); run(500, () => { H.setTension(0.9, 0, true); H.setCrank(2); }); wait(100); assert.equal(hx.length, 0, "muted: " + words());
    nfresh(); H.thump(); H.setEnabled(false); wait(300);
    assert.deepEqual(words(), ["impact:HEAVY"], "the second strike impact came after Buzz and taps went off");
    hx.length = 0;
    run(2000, () => { H.tick(); H.bail(); H.bump(1); H.thump(); H.jolt(); H.land(2); H.surge(); H.setTension(0.95, 2, true); H.setCrank(3); H.throb(); H.rub(0.8); });
    wait(1000);
    assert.equal(hx.length, 0, "with Buzz and taps off: " + words());
    nfresh(); globalThis.document = { visibilityState: "hidden" };
    run(1000, () => { H.thump(); H.setTension(0.9, 1, true); H.setCrank(2); });
    delete globalThis.document;
    assert.equal(hx.length, 0, "hidden: " + words());
  });

  check("the iPhone app: the fight trains are single impacts, harder with the load; the drag ratchet is light, 20 a second at most", () => {
    const styles = (frac, slip) => { nfresh(); run(2000, () => H.setTension(frac, slip, true)); return [...new Set(words())]; };
    assert.deepEqual(styles(0.3, 0), ["impact:LIGHT"]);
    assert.deepEqual(styles(0.7, 0), ["impact:MEDIUM"]);
    assert.deepEqual(styles(0.92, 0), ["impact:HEAVY"]);
    nfresh(); run(1000, () => H.setTension(0.7, 2.5, true));
    const n = hx.length;
    console.log(`      drag ratchet at 2.5 m/s: ${n} light impacts in 1 s`);
    assert.ok(n >= 10 && n <= 20, "drag impacts " + n);
    assert.ok(hx.every((c) => c.a === "LIGHT"));
  });

  check("the iPhone app: crank ticks are selection ticks (selectionStart once)", () => {
    nfresh(); run(2000, () => H.setCrank(1));
    const w = words();
    assert.equal(w[0], "selectionStart"); assert.equal(w.filter((x) => x === "selectionStart").length, 1);
    assert.ok(w.filter((x) => x === "selectionChanged").length >= 6, w.join(","));
  });

  check("the iPhone app: the call rate stays capped, whatever the game spams", () => {
    nfresh();
    let f = 0;
    run(6000, () => { f++; H.tick(); H.setCrank(3.5); H.setTension(f % 200 < 100 ? 0.95 : 0.6, f % 300 < 120 ? 2 : 0, true); if (f % 3 === 0) H.bump(0.3); if (f % 45 === 0) H.thump(); wait(0); });
    const peak = maxInWindow(hx);
    console.log(`      ${hx.length} plugin calls in 6 s; busiest second ${peak}`);
    assert.ok(peak <= 40, "plugin calls/s " + peak);
  });

  check("the iPhone app: a plugin that is missing, throws or fails does nothing", () => {
    nfresh();
    plugin.impact = () => { throw new Error("gone"); };
    plugin.notification = () => Promise.reject(new Error("no"));
    H.thump(); H.jolt(); wait(300);
    // an app built without the plugin
    globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", isPluginAvailable: () => false, Plugins: {} };
    H._forcePlatform("auto");
    assert.notEqual(H.kind, "native");
    delete globalThis.Capacitor;
    H._forcePlatform("auto");
    assert.equal(H.kind, "vibrate", "the Android stub after the app is gone");
  });
  H._timers();
}

/* ---------- 3. the iPhone pads, in a real page (Chromium with the platform forced to "ios") ---------- */
await iosPads();

console.log(failed ? `\n${failed} check(s) failed` : "\nall haptics checks passed");
process.exit(failed ? 1 : 0);

async function iosPads() {
  const req = createRequire(import.meta.url);
  let pw = null;
  try { pw = req("playwright"); } catch (e) { try { pw = req(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright")); } catch (e2) { /* none */ } }
  if (!pw) { failed++; console.log("FAIL  iPhone pads: the playwright package is missing (npm i -g playwright)"); return; }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
  const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
  const base = `http://127.0.0.1:${port}`;
  const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", root], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/fish/js/haptics.js")).ok) break; } catch (e) { /* not yet */ } await new Promise((r) => setTimeout(r, 100)); }
  // the page: #game turned 90 degrees the way main.js does it when the phone lies sideways with rotation lock on
  const page0 = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html, body { margin: 0; height: 100%; overflow: hidden; touch-action: none; }
    #game { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; transform-origin: 50% 50%; background: #0d2f38; }
    #castUI, #reelUI { position: absolute; inset: 0; }
    #reelBox { position: absolute; left: 0; right: 0; bottom: 0; height: 46%; background: #134451; }
    #crankBox { position: absolute; right: 8px; bottom: 8px; width: 250px; height: 250px; background: #234; border-radius: 50%; }
  </style><div id="game"><div id="castUI"><div id="reelBox"></div></div><div id="reelUI"><div id="crankBox"></div></div></div>
  <script type="module">
    import { Haptics } from "/fish/js/haptics.js";
    window.Haptics = Haptics;
    const game = document.getElementById("game");
    window.rot = 0;
    window.rotate = (r) => {
      window.rot = r;
      const W = innerWidth, H = innerHeight;
      Object.assign(game.style, r ? { width: H + "px", height: W + "px", left: (W - H) / 2 + "px", top: (H - W) / 2 + "px", transform: "rotate(" + r + "deg)" } : { width: "", height: "", left: "", top: "", transform: "" });
    };
    // main.js's toLocal: client pixels to the unrotated pixels of el
    window.toLocal = (cx, cy, el) => {
      let x = cx, y = cy;
      if (rot) { const W = innerWidth, H = innerHeight, Lw = H, Lh = W, dx = cx - W / 2, dy = cy - H / 2; if (rot === 90) { x = dy + Lw / 2; y = Lh / 2 - dx; } else { x = Lw / 2 - dy; y = dx + Lh / 2; } }
      for (let e = el; e && e !== game && e !== document.body; e = e.offsetParent) { x -= e.offsetLeft; y -= e.offsetTop; }
      return { x, y };
    };
    // and back: a point in #game's own pixels to client pixels
    window.toClient = (x, y) => {
      if (!rot) return { x, y };
      const W = innerWidth, H = innerHeight, Lw = H, Lh = W;
      return rot === 90 ? { x: W / 2 + Lh / 2 - y, y: H / 2 + x - Lw / 2 } : { x: W / 2 - Lh / 2 + y, y: H / 2 - x + Lw / 2 };
    };
    window.ready = true;
  </script>`;
  const browser = await pw.chromium.launch();
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.route(base + "/__qa/hx.html", (r) => r.fulfill({ contentType: "text/html", body: page0 }));
    await page.goto(base + "/__qa/hx.html");
    await page.waitForFunction(() => window.ready === true);
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });

    // not an iPhone: nothing is attached
    const none = await page.evaluate(() => { Haptics._forcePlatform("none"); return [Haptics.attachPad(document.getElementById("reelBox")), Haptics.attachCrank(document.getElementById("crankBox"))]; });
    check("iPhone pads: attachPad and attachCrank return null when the platform is not ios", () => assert.deepEqual(none, [null, null]));

    // the pad on the reel face
    const pad = await page.evaluate(() => {
      Haptics._forcePlatform("ios");
      const box = document.getElementById("reelBox");
      window.log = { toggles: [], boxClicks: 0, boxPointers: [] };
      box.addEventListener("click", () => log.boxClicks++);
      for (const t of ["pointerdown", "pointerup"]) box.addEventListener(t, (e) => log.boxPointers.push(t + ":" + e.target.tagName));
      window.padH = Haptics.attachPad(box, { onToggle: (on) => log.toggles.push(on) });
      const el = padH.el, cs = getComputedStyle(el), a = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      return { tag: el.tagName, type: el.type, sw: el.hasAttribute("switch"), tabindex: el.hasAttribute("tabindex"), tabIndexProp: el.tabIndex,
        aria: el.getAttribute("aria-hidden"), opacity: cs.opacity, touchAction: cs.touchAction, pe: cs.pointerEvents, last: box.lastElementChild === el,
        rect: [a.left - b.left, a.top - b.top, a.width - b.width, a.height - b.height].map((v) => Math.round(v)), center: [b.left + b.width / 2, b.top + b.height / 2] };
    });
    check("iPhone pads: attachPad puts a hidden switch over the whole reel face (no tabindex, opacity 0, touch-action none)", () => {
      assert.equal(pad.tag, "INPUT"); assert.equal(pad.type, "checkbox"); assert.equal(pad.sw, true);
      assert.equal(pad.tabindex, false, "has a tabindex attribute"); assert.equal(pad.aria, "true");
      assert.equal(pad.opacity, "0"); assert.equal(pad.touchAction, "none"); assert.equal(pad.pe, "auto"); assert.equal(pad.last, true);
      assert.deepEqual(pad.rect, [0, 0, 0, 0]);
    });
    await touch("touchStart", pad.center[0], pad.center[1]); await touch("touchEnd");
    await page.waitForTimeout(100);
    await touch("touchStart", pad.center[0], pad.center[1]); await page.waitForTimeout(400); await touch("touchEnd");   // a long hold, then a lift
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => { const r = { ...log, checked: padH.el.checked }; Haptics.setEnabled(false); r.offPE = getComputedStyle(padH.el).pointerEvents; Haptics.setEnabled(true); r.onPE = getComputedStyle(padH.el).pointerEvents; padH.dispose(); r.gone = !document.querySelector("#reelBox input"); return r; });
    check("iPhone pads: a tap and a long hold both toggle it on lift; the game still gets the pointer events, never the click", () => {
      assert.deepEqual(after.toggles, [true, true], "toggles " + JSON.stringify(after.toggles));    // touchstart unchecks it again each time
      assert.equal(after.boxClicks, 0, "the click leaked to the reel");
      assert.ok(after.boxPointers.includes("pointerdown:INPUT") && after.boxPointers.includes("pointerup:INPUT"), JSON.stringify(after.boxPointers));
    });
    check("iPhone pads: turned off, the pad lets touches through; dispose() removes it", () => {
      assert.equal(after.offPE, "none"); assert.equal(after.onPE, "auto"); assert.equal(after.gone, true);
    });

    // the crank, with #game turned 90 degrees
    const crank = await page.evaluate(() => {
      rotate(90);
      const box = document.getElementById("crankBox");
      window.ticks = 0;
      window.crankH = Haptics.attachCrank(box, { toLocal, onTick: () => ticks++ });
      const sw = crankH.el, wrap = sw.parentElement, cs = getComputedStyle(wrap);
      // WebKit's rule, worked out on its own from the screen: the finger's side of the switch's centre line, with the
      // switch's rotation plus #game's. It ticks when the side changes, from 200 ms after touchstart
      window.wk = { ticks: 0, on: true, t0: 0 };
      const side = (x, y) => {
        const r = sw.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const th = (parseFloat((/rotate\(([-\d.e]+)deg\)/.exec(sw.style.transform) || [0, 0])[1]) + rot) * Math.PI / 180;
        return (x - cx) * Math.cos(th) + (y - cy) * Math.sin(th) >= 0;
      };
      addEventListener("touchstart", (e) => { wk.t0 = e.timeStamp; wk.on = true; }, true);
      addEventListener("touchmove", (e) => {
        if (e.timeStamp - wk.t0 < 200) return;
        const t = e.touches[0], s = side(t.clientX, t.clientY);
        if (s !== wk.on) { wk.on = s; wk.ticks++; }
      }, true);
      // the centre and radius of the crank in #game's pixels
      let x = box.offsetLeft + box.offsetWidth / 2, y = box.offsetTop + box.offsetHeight / 2;
      for (let e = box.offsetParent; e && e.id !== "game"; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
      const wr = wrap.getBoundingClientRect();
      return { cx: x, cy: y, d: wrap.offsetWidth, s: sw.offsetWidth, radius: cs.borderRadius, overflow: cs.overflow, sq: sw.offsetWidth === sw.offsetHeight,
        tabindex: sw.hasAttribute("tabindex"), round: Math.round(wr.width) === wrap.offsetWidth };
    });
    check("iPhone pads: attachCrank puts a square switch in a round window over the crank", () => {
      assert.equal(crank.d, 250); assert.equal(crank.sq, true); assert.ok(crank.s >= 250 * 1.41, "side " + crank.s);
      assert.equal(crank.radius, "50%"); assert.equal(crank.overflow, "hidden"); assert.equal(crank.tabindex, false);
    });
    // two clockwise turns of the thumb round the hub, ~1.2 turns a second
    const R = 90, steps = 144, pt = (a) => page.evaluate(([x, y]) => toClient(x, y), [crank.cx + R * Math.cos(a), crank.cy + R * Math.sin(a)]);
    let p = await pt(0);
    await touch("touchStart", p.x, p.y);
    for (let i = 1; i <= steps; i++) { p = await pt((i / steps) * 4 * Math.PI); await touch("touchMove", p.x, p.y); await page.waitForTimeout(10); }
    await page.waitForTimeout(40);
    const turn = await page.evaluate(() => ({ ours: ticks, webkit: wk.ticks }));
    // hold still, then a bite: forceTick() flips the switch, so the next small move ticks
    for (let i = 0; i < 4; i++) { p = await pt(4 * Math.PI + (i % 2 ? 0.02 : -0.02)); await touch("touchMove", p.x, p.y); await page.waitForTimeout(20); }
    const still = await page.evaluate(() => ({ ours: ticks, webkit: wk.ticks }));
    await page.evaluate(() => crankH.forceTick());
    await page.waitForTimeout(60);
    p = await pt(4 * Math.PI + 0.03); await touch("touchMove", p.x, p.y);
    await page.waitForTimeout(40);
    await touch("touchEnd");
    const forced = await page.evaluate(() => ({ ours: ticks, webkit: wk.ticks }));
    console.log(`      crank: two turns gave ${turn.ours} ticks by our count and ${turn.webkit} by WebKit's rule; forceTick added ${forced.webkit - still.webkit}`);
    check("iPhone pads: the crank switch ticks ~6 times a turn with #game turned 90 degrees, and matches WebKit's rule", () => {
      assert.ok(turn.webkit >= 9 && turn.webkit <= 13, "WebKit ticks " + turn.webkit);
      assert.ok(Math.abs(turn.ours - turn.webkit) <= 1, `ours ${turn.ours} vs WebKit ${turn.webkit}`);
      assert.equal(still.webkit, turn.webkit, "ticked while the thumb held still");
    });
    check("iPhone pads: forceTick() makes the next move tick", () => {
      assert.equal(forced.webkit, still.webkit + 1);
      assert.equal(forced.ours, still.ours + 1);
    });
    const flag = await page.evaluate(() => { crankH.dispose(); const gone = !document.querySelector("#crankBox .hx-crank"); localStorage.setItem("fish.iosCrank", "0"); const r = Haptics.attachCrank(document.getElementById("crankBox"), { toLocal }); localStorage.removeItem("fish.iosCrank"); return { gone, r }; });
    check("iPhone pads: dispose() removes the crank switch; fish.iosCrank = 0 turns it off", () => { assert.equal(flag.gone, true); assert.equal(flag.r, null); });
    // the legacy path (iOS before 26.5) runs without errors, and never takes focus
    const legacy = await page.evaluate(() => { Haptics.unlock(); Haptics.thump(); Haptics.bail(); const l = document.querySelector("label[for=fishHxLegacy]"); return { rig: !!l, focus: document.activeElement === document.body }; });
    check("iPhone pads: the old label.click() path builds its hidden switch and leaves focus alone", () => { assert.equal(legacy.rig, true); assert.equal(legacy.focus, true); });
    // a bigger fish gets more taps: 2, 3 and 5, 120 ms apart
    const taps = await page.evaluate(async () => {
      const l = document.querySelector("label[for=fishHxLegacy]"), out = [];
      let n = 0;
      l.addEventListener("click", () => { n++; }, true);
      for (const lv of [0, 1, 2]) { n = 0; await new Promise((r) => setTimeout(r, 300)); Haptics.land(lv); await new Promise((r) => setTimeout(r, 800)); out.push(n); }
      return out;
    });
    check("iPhone pads: a fish lands with 2 taps, a trophy with 3, a legend with 5", () => assert.deepEqual(taps, [2, 3, 5]));
    check("iPhone pads: no console errors", () => assert.deepEqual(errors, []));
  } finally {
    await browser.close();
    server.kill();
  }
}
