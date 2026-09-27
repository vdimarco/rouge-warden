// Checks public/fish/js/haptics.js in plain node: a recorder stands in for navigator.vibrate, and a fake clock drives it.
// Run: node qa/fish/haptics.test.mjs   (exit code 1 on failure)
import assert from "node:assert/strict";

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
    Haptics.jolt(); Haptics.land(); Haptics.splash(0.5); Haptics.load(); Haptics.setTension(0.9, 1, true); Haptics.setCrank(2);
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

check("priorities: a tick or a nibble does not cut a strike; a snap cuts a strike; the snap leaves a silence", () => {
  fresh();
  assert.equal(H.thump(), true);                        // [45, 25, 90] = 160 ms
  T += 20; assert.equal(H.tick(), false, "tick cut the strike");
  T += 20; assert.equal(H.bump(0.8), false, "nibble cut the strike");
  T += 20; assert.equal(H.bail(), false, "bail cut the strike");
  T += 20; assert.equal(H.hookset(), false, "hook set cut the strike");
  T += 10; assert.equal(H.jolt(), true, "snap did not cut the strike");
  // 140 ms buzz + 600 ms of enforced quiet
  T += 300; assert.equal(H.thump(), false, "strike during the snap silence");
  run(300, () => H.setTension(0.9, 0, true));
  assert.equal(calls.length, 2, "anything during the snap silence");
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

console.log(failed ? `\n${failed} check(s) failed` : "\nall haptics checks passed");
process.exit(failed ? 1 : 0);
