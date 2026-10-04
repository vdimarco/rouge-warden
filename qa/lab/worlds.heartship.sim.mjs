// Checks the rules of Heartship (Small Worlds) with no browser: node qa/lab/worlds.heartship.sim.mjs
// It imports the game module with a stub api and plays it with scripted players. The beat is audible and closes a
// ring on the heart, pulses on the beat are strong and build the multiplier, the voyage is endless and seeded with a
// rising tempo, and every hazard is warned, passes the ship, and gives a near miss or a hit. Exit code 1 on failure.
import createGame from "../../public/lab/worlds/games/heartship.js";
import { mulberry } from "../../public/lab/kit/rng.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const STEP = 1 / 120, SHIP_Y = 321, PANEL = 383;
const ORG = { left: { x: 73, y: 554 }, right: { x: 347, y: 554 }, shield: { x: 128, y: 447 }, sail: { x: 292, y: 447 } }, HEART = { x: 210, y: 566 };

// A stub of the shell's api. It logs each sound and effect with the game time.
function start(seed, best = 0) {
  const log = { now: 0, calls: [], status: [], finish: null };
  const rec = (k) => (...a) => log.calls.push({ k, t: log.now, a });
  const g = createGame({ W: 420, H: 680, rng: mulberry(seed), seed, daily: false, best, status: (s) => log.status.push({ t: log.now, s }), metric: () => {}, finish: (o) => { log.finish ||= { ...o, t: log.now }; }, tone: rec("tone"), noise: rec("noise"), chord: rec("chord"), slow: rec("slow"), shake: rec("shake"), burst() {}, buzz() {} });
  return { g, log };
}
// One step of game time. The log's clock is the game time while the step runs.
function step(g, log) { log.now = g.getState().time + STEP; g.update(STEP); }
function play(seed, player, { stop = () => false, maxT = 600, after = 0 } = {}) {
  const { g, log } = start(seed);
  let s = g.getState();
  while (!log.finish && s.time < maxT && !stop(s)) { log.now = s.time; if (player) player(g, s); step(g, log); s = g.getState(); }
  for (let i = 0; i < after * 120; i++) step(g, log); // the shell keeps the game running after the end
  return { g, log, s: g.getState() };
}
const until = (g, log, fn, maxT = 120) => { while (!fn(g.getState()) && g.getState().time < maxT) step(g, log); return g.getState(); };
const send = (g, organ, from = HEART) => { g.pointer("down", from); g.pointer("move", ORG[organ]); g.pointer("up", ORG[organ]); };

/* ---------------- players ---------------- */
// A near-perfect player. Right after each beat it decides what to send on the next beat. It presses early for a long
// charge only when it needs a dash or a long shield, and lets go just after the beat. jitter (s) makes it human.
function perfect({ jitter = 0, seed = 1, sail = true } = {}) {
  const r = mulberry(seed ^ 0x51ed), gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / Math.sqrt(.5); };
  let plan = null, pressed = -1, decided = -1, late = .02;
  const lineAt = (s, b) => s.hazards.filter((h) => h.beat === b && !h.calm && !h.done);
  return (g, s) => {
    const k = Math.floor(s.beat), ph = s.beat - k;
    if (pressed >= 0 && (k > pressed && ph >= late && ph < .5 || late < 0 && k === pressed && ph >= 1 + late)) {
      pressed = -1;
      const p = plan && plan.organ ? ORG[plan.organ] : HEART;
      g.pointer("move", p); g.pointer("up", p); plan = null;
      return;
    }
    if (decided !== k && ph >= .03) {
      decided = k;
      const b = k + 1, lane = s.lane, shieldUntil = s.beat + s.shieldBeats;
      const reefs = (x) => lineAt(s, x).filter((h) => h.type === "reef").map((h) => h.lane), storm = (x) => lineAt(s, x).some((h) => h.type === "storm"), safe = (l, x) => !reefs(x).includes(l);
      let organ = null, long = false;
      if (storm(b + 1) && shieldUntil < b + 1.05 || storm(b + 2) && shieldUntil < b + 2.05) { organ = "shield"; long = true; }
      else {
        const score = (l) => (safe(l, b + 1) ? 100 : 0) + (safe(l, b + 2) ? 10 : 0) + (safe(l, b + 3) ? 1 : 0) - Math.abs(l - lane) * .5;
        let want = lane; for (const l of [0, 1, 2]) if (score(l) > score(want)) want = l;
        const light = s.lanterns.find((q) => !q.done && q.beat > b && q.beat <= b + 1);
        if (want === lane && light && Math.abs(light.lane - lane) === 1 && safe(light.lane, b + 1) && safe(light.lane, b + 2) && s.energy > 30) want = light.lane;
        if (want !== lane) { organ = want < lane ? "left" : "right"; long = Math.abs(want - lane) === 2; }
        else if (sail && s.energy > 55 && s.sailBeats < 1 && [1, 2, 3].every((d) => lineAt(s, b + d).length === 0)) { organ = "sail"; long = true; }
      }
      plan = { organ, at: long ? k + .05 : k + .72 };
    }
    if (pressed < 0 && plan && plan.organ && s.beat >= plan.at && !s.done) { g.pointer("down", HEART); pressed = k; late = .02 + (jitter ? gauss() * jitter * s.bpm / 60 : 0); }
  };
}
// Presses the heart now and then and lets go over a random organ at a random time.
function masher(seed) {
  const r = mulberry(seed ^ 0x77); let next = 1, down = false;
  return (g, s) => {
    if (s.time < next) return;
    if (!down) { g.pointer("down", HEART); down = true; next = s.time + .1 + r() * .5; }
    else { const o = Object.values(ORG)[Math.floor(r() * 4)]; g.pointer("move", o); g.pointer("up", o); down = false; next = s.time + .2 + r() * 1.2; }
  };
}

/* ---------------- 1. the beat ---------------- */
section("The beat is the game");
{
  const { g, log } = start(3), bot = perfect({ seed: 3 }), crossings = [];
  let s = g.getState();
  while (crossings.length < 120) { log.now = s.time; bot(g, s); const k = Math.floor(s.beat); step(g, log); s = g.getState(); if (Math.floor(s.beat) > k) crossings.push(log.now); }
  const tones = log.calls.filter((q) => q.k === "tone" && q.a[2] === "triangle"), loud = [];
  let every = true;
  for (let i = 0; i < crossings.length - 1; i++) {
    const lub = tones.filter((q) => Math.abs(q.t - crossings[i]) < 1e-6 && q.a[0] >= 100 && q.a[0] <= 120), dub = tones.filter((q) => q.t > crossings[i] && q.t < crossings[i + 1] && q.a[0] >= 150 && q.a[0] <= 180);
    if (lub.length !== 1 || dub.length !== 1) every = false;
    if (lub.length) loud.push(lub[0].a[3]);
  }
  check(every, `every beat plays a lub near 110 Hz on the beat and a dub near 165 Hz after it (${crossings.length - 1} beats, 75 to ${s.bpm} BPM)`);
  check(loud.every((v) => v >= .1), `the lub is loud enough for a phone speaker (volume ${loud[0]}; the old beat was 80 Hz at 0.018)`);
  // the ring around the heart closes as the beat comes
  const ring = (phase) => { const { g, log } = start(1); until(g, log, (s) => s.beat >= 2 + phase); let r = 0; g.draw(recorder((k, a) => { if (k === "arc" && a[0] === HEART.x && a[1] === HEART.y && a[2] > r) r = a[2]; })); return r; };
  const early = ring(.1), late = ring(.95);
  check(early > late + 25 && late < 50, `a ring closes on the heart: radius ${early.toFixed(0)} px just after a beat, ${late.toFixed(0)} px just before the next`);

  const shieldAt = (phase) => { const { g, log } = start(5); until(g, log, (s) => s.beat >= 4 + phase); send(g, "shield"); until(g, log, (s) => s.shield > 0 || s.time > 9); return { s: g.getState(), when: g.getState().time }; };
  const on = shieldAt(.05).s, off = shieldAt(.5).s;
  check(on.lastPulse.onBeat && !off.lastPulse.onBeat, "a pulse at beat phase 0.05 is on the beat, and one at phase 0.5 is not");
  check(on.shield >= 2 && off.shield < 1 && on.shield > off.shield * 2, `an on-beat shield lasts its full length (${on.shield.toFixed(2)} s); an off-beat one is weak (${off.shield.toFixed(2)} s)`);
  // on the beat a fin lands at once; off the beat it crawls down the vein
  const finAt = (phase, charge = 0) => { const { g, log } = start(5); until(g, log, (s) => s.beat >= 4 + phase - charge); g.pointer("down", HEART); until(g, log, (s) => s.beat >= 4 + phase); g.pointer("move", ORG.right); g.pointer("up", ORG.right); const lane0 = g.getState().lane, t0 = g.getState().time; const s = until(g, log, (s) => s.lane !== 1 || s.time > t0 + 1); return { now: lane0, lane: s.lane, after: s.time - t0 }; };
  const quick = finAt(.03), slow = finAt(.5);
  check(quick.now === 2 && slow.now === 1 && slow.after > .35, `an on-beat fin moves the ship at once; an off-beat fin lands after ${slow.after.toFixed(2)} s`);
  const dash = (() => { const { g, log } = start(5); send(g, "left"); until(g, log, (s) => s.lane === 0); until(g, log, (s) => s.beat >= 3.4); g.pointer("down", HEART); until(g, log, (s) => s.beat >= 4.03); g.pointer("move", ORG.right); g.pointer("up", ORG.right); return g.getState(); })();
  check(dash.lane === 2 && dash.lastPulse.power >= .45, `a charged on-beat fin dashes two lanes, from the left lane to the right (charge ${dash.lastPulse.power.toFixed(2)})`);
  const offDash = (() => { const { g, log } = start(5); send(g, "left"); until(g, log, (s) => s.lane === 0); until(g, log, (s) => s.beat >= 3.9); g.pointer("down", HEART); until(g, log, (s) => s.beat >= 4.5); g.pointer("move", ORG.right); g.pointer("up", ORG.right); return until(g, log, (s) => s.lane !== 0 || s.time > 9); })();
  check(offDash.lane === 1, "a charged fin off the beat moves only one lane");
  // the combo is the score multiplier
  const { g: c, log: cl } = start(9);
  for (let k = 2; k <= 4; k++) { until(c, cl, (s) => s.beat >= k + .03); send(c, "sail"); }
  const three = c.getState();
  until(c, cl, (s) => s.beat >= 5.5); send(c, "sail");
  const broken = c.getState();
  check(three.combo === 3 && three.mult === 2 && broken.combo === 0 && broken.mult === 1, `three on-beat pulses in a row make ×${three.mult}; an off-beat pulse ends the run of beats (×${broken.mult})`);
  const onRun = play(4, perfect({ seed: 4 }), { maxT: 80 }).s, offRun = play(4, perfect({ seed: 4, jitter: .25 }), { maxT: 80 }).s;
  check(onRun.score > onRun.metres * 2 && onRun.score > offRun.score * 1.5, `score is metres × the multiplier: on the beat ${onRun.score} points for ${Math.round(onRun.metres)} m, off the beat ${offRun.score} for ${Math.round(offRun.metres)} m`);
}

/* ---------------- 2. an endless voyage ---------------- */
section("An endless, seeded voyage with a rising tempo");
{
  const list = (s, n = 40) => s.hazards.slice(0, n).map((h) => `${h.beat}:${h.type}:${h.lane}`).join(" ");
  // a good player who sails and a sloppy one who never sails reach each beat at other distances and tempos
  const a = play(11, perfect({ seed: 11 }), { maxT: 120 }).s, b = play(11, perfect({ seed: 11, jitter: .08, sail: false }), { maxT: 120 }).s, c = play(12, perfect({ seed: 12 }), { maxT: 120 }).s;
  check(a.hazards.length >= 40 && b.hazards.length >= 40 && list(a) === list(b), `the same seed gives the same first 40 hazards for two different players (one sailed ${Math.round(a.metres)} m, the other ${Math.round(b.metres)} m)`);
  const m = play(11, masher(11), { maxT: 120 }).s;
  check(list(m, m.hazards.length) === list(a, m.hazards.length), `a random player who sinks early sees the same first ${m.hazards.length} hazards`);
  check(list(a) !== list(c), "another seed gives other hazards");
  const long = play(2, perfect({ seed: 2 }), { maxT: 200 }).s, lines = new Map(), kinds = new Set();
  for (const h of long.hazards) { if (!lines.has(h.beat)) lines.set(h.beat, []); lines.get(h.beat).push(h); }
  const open = (line) => line && line.length === 2 && line.every((h) => h.type === "reef") ? 3 - line[0].lane - line[1].lane : -1;
  for (const [beat, line] of lines) {
    if (line.some((h) => h.type === "storm")) kinds.add("storm");
    const o = open(line); if (o >= 0) kinds.add("pair");
    if ((o === 0 || o === 2) && open(lines.get(beat + 2)) === 2 - o) kinds.add("gate");
  }
  check(["pair", "storm", "gate"].every((k) => kinds.has(k)), `patterns include reef pairs, storms, and gates that need a dash across two lanes (${[...kinds].join(", ")})`);
  // the tempo
  const tempo = [];
  play(2, perfect({ seed: 2 }), { stop: (s) => { tempo.push([s.metres, s.bpm]); return s.metres > 2100; }, maxT: 400 });
  const at = (m) => tempo.find((q) => q[0] >= m)[1];
  check(at(0) === 75 && at(149) === 75 && at(151) === 80 && at(1500) === 125 && at(1660) === 130 && at(2050) === 130, `the tempo rises 5 BPM every 150 m, from 75 to 130 (at 0, 151, 1500, 1660 and 2050 m: ${[0, 151, 1500, 1660, 2050].map(at).join(", ")} BPM)`);
  const runs = [1, 2, 3, 4, 5].map((seed) => play(seed, perfect({ seed }), { stop: (s) => s.metres >= 2000, maxT: 400 }).s);
  check(runs.every((s) => s.metres >= 2000 && !s.done), `a perfect player passes 2,000 m on every seed (${runs.map((s) => `${Math.round(s.time)} s`).join(", ")}, ${runs.map((s) => s.hits).join("/")} hits)`);
  const humans = [1, 2, 3, 4, 5, 6].map((seed) => play(seed, perfect({ seed, jitter: .06 }), { maxT: 900 }));
  check(humans.every((r) => r.log.finish && r.log.finish.t >= 60 && r.log.finish.t <= 360), `a good player with 60 ms timing error sails for 1 to 6 minutes (${humans.map((r) => `${Math.round(r.log.finish?.t)} s, ${Math.round(r.s.metres)} m`).join("; ")})`);
  const idle = [1, 2, 3].map((seed) => play(seed, null, { maxT: 300 }));
  check(idle.every((r) => r.log.finish && r.s.hp === 0 && r.log.finish.t < 60), `the run ends at zero hearts: an idle ship sinks in ${idle.map((r) => Math.round(r.log.finish.t)).join(", ")} s`);
  const end = humans[0].log.finish;
  check(/next dawn was [\d,]+ m ahead/.test(end.detail) && end.score === humans[0].s.score, `the end says how close the next dawn was ("${end.detail}")`);
}

/* ---------------- 3. warnings, near misses and hits ---------------- */
section("Every hazard is warned, passes the ship, and lands as a near miss or a hit");
{
  const r = play(6, perfect({ seed: 6 }), { maxT: 150 });
  const live = r.s.hazards.filter((h) => h.done && !h.calm), tones = r.log.calls.filter((q) => q.k === "tone");
  const warned = live.filter((h) => h.warnAt >= 0 && h.at - h.warnAt >= .3 && h.at - h.warnAt <= 1.1);
  const rising = live.filter((h) => { const w = tones.filter((q) => Math.abs(q.t - h.warnAt) < 1e-6 && q.a[0] >= 300 && q.a[2] === "triangle").sort((x, y) => (x.a[4] || 0) - (y.a[4] || 0)); return w.length === 3 && w.every((q, i) => !i || q.a[0] > w[i - 1].a[0] && (q.a[4] || 0) > (w[i - 1].a[4] || 0)); });
  check(live.length > 60 && warned.length === live.length, `a warning comes 0.3 s to 1.1 s before every hazard (${warned.length} of ${live.length}; shortest ${Math.min(...live.map((h) => h.at - h.warnAt)).toFixed(2)} s)`);
  check(rising.length === live.length, `each warning is a rising run of tones (${rising.length} of ${live.length})`);
  // a reef that has passed the ship is still drawn below it
  const { g, log } = start(6);
  let reef = null;
  until(g, log, (s) => { reef = s.hazards.find((h) => h.type === "reef" && h.done && s.beat - h.beat > .4); return !!reef; });
  const ys = [];
  g.draw(recorder((k, a) => { if (k === "translate") ys.push(a[1]); }));
  check(ys.some((y) => y > SHIP_Y + 10 && y < PANEL), `reefs pass the ship and slide under the panel (a reef drawn at y ${ys.filter((y) => y > SHIP_Y + 10 && y < PANEL).map(Math.round).join(", ")}; the ship is at ${SHIP_Y})`);
  // a hit cracks the reef and shakes the screen, and the reason stays for 1.5 s
  const hit = play(2, null, { stop: (s) => s.hits > 0 });
  const struck = hit.s.hazards.find((h) => h.hit), shake = hit.log.calls.find((q) => q.k === "shake");
  check(struck && shake, `a hit cracks the ${struck?.type} and shakes the screen (${shake?.a[0]} px)`);
  const reason = hit.log.status[hit.log.status.length - 1];
  until(hit.g, hit.log, (s) => s.time > reason.t + 2);
  const nextStatus = hit.log.status.find((q) => q.t > reason.t && q.s !== reason.s);
  check(/reef|storm/i.test(reason.s) && (!nextStatus || nextStatus.t - reason.t >= 1.45), `the hit reason stays for 1.5 s ("${reason.s}", replaced after ${nextStatus ? (nextStatus.t - reason.t).toFixed(2) + " s" : "more than 2 s"})`);
  // a near miss: wait in a reef's lane and dodge on the beat just before it arrives
  let close = null;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { g, log } = start(seed);
    const s0 = until(g, log, (s) => s.hazards.some((h) => h.type === "reef" && h.lane === s.lane && h.beat - s.beat > 1.2 && h.beat - s.beat < 2 && s.hazards.filter((q) => q.beat === h.beat).length === 1 && !s.hazards.some((q) => q.beat > s.beat && q.beat < h.beat)), 60);
    const h = s0.hazards.find((q) => q.type === "reef" && q.lane === s0.lane && q.beat - s0.beat > 1.2);
    if (!h) continue;
    const away = h.lane === 2 ? "left" : "right", hits = s0.hits;
    until(g, log, (s) => s.beat >= h.beat - .25); g.pointer("down", HEART);
    until(g, log, (s) => s.beat >= h.beat - .03); g.pointer("move", ORG[away]); g.pointer("up", ORG[away]);
    until(g, log, (s) => s.beat >= h.beat + .1);
    const s = g.getState(), slow = log.calls.find((q) => q.k === "slow");
    close = { seed, closes: s.closes, hits: s.hits - hits, slow, popup: [] };
    g.draw(recorder((k, a) => { if (k === "fillText" && a[0] === "CLOSE") close.popup.push(a[0]); }));
    break;
  }
  check(close && close.closes === 1 && close.hits === 0 && close.slow && close.slow.a[0] < 1 && Math.abs(close.slow.a[1] - .3) < 1e-9 && close.popup.length > 0, `a dodge in the last moment is a near miss: 0.3 s of slow motion and "CLOSE" (seed ${close?.seed})`);
}

/* ---------------- 4. the heart, the edges and the dawn ---------------- */
section("The heart, the edges and the dawn");
{
  const { g, log } = start(4);
  until(g, log, (s) => s.time > 2);
  const before = g.getState();
  g.pointer("down", HEART); until(g, log, (s) => s.time > 2.6); g.pointer("move", { x: 214, y: 560 }); g.pointer("up", { x: 214, y: 560 });
  until(g, log, (s) => s.time > 3.4);
  const after = g.getState();
  check(after.lane === before.lane && after.pulses === 0 && after.energy >= before.energy, `a release on the heart cancels: the lane stays ${after.lane} and no energy is spent`);
  send(g, "left"); until(g, log, (s) => s.lane === 0, 9);
  until(g, log, (s) => s.time > 5);
  const e0 = g.getState().energy, n = log.calls.length;
  send(g, "left");
  const edge = g.getState();
  check(edge.lane === 0 && edge.energy >= e0 && log.calls.slice(n).some((q) => q.k === "tone"), "a fin at the edge costs no energy and gives a bump you can hear");
  const sky = (m) => { const r = play(8, perfect({ seed: 8 }), { stop: (s) => s.metres >= m, maxT: 200 }), stops = []; r.g.draw(recorder((k, a) => { if (k === "addColorStop") stops.push(a[1]); })); return +/rgba\([^)]*,([\d.]+)\)/.exec(stops[1])[1]; };
  const dusk = sky(20), nearDawn = sky(380);
  check(nearDawn < dusk - .1, `the sky brightens toward dawn (night shade ${dusk.toFixed(2)} at the start, ${nearDawn.toFixed(2)} near 400 m)`);
  const run = play(3, perfect({ seed: 3 }), { stop: (s) => s.dawns > 0, maxT: 120 });
  const slow = run.log.calls.find((q) => q.k === "slow" && q.a[1] > 1), chord = run.log.calls.find((q) => q.k === "chord" && q.a[0].length >= 5);
  check(run.s.dawns === 1 && run.s.metres >= 400 && run.s.metres < 410, `a dawn comes at 400 m (${Math.round(run.s.metres)} m)`);
  check(slow && chord, `the dawn plays in slow motion (${slow?.a[1]} s) with a chord (${chord?.a[0].join(", ")} Hz)`);
  check(run.s.hazards.filter((h) => h.calm).length > 0, "and it calms the next few beats of sea");
  // drift into the first hazard with no input, then sail well to the dawn
  const { g: hg, log: hl } = start(2), helm = perfect({ seed: 2 });
  let hs = hg.getState(), hpBefore = 3;
  while (!hl.finish && hs.dawns === 0 && hs.time < 200) { hl.now = hs.time; if (hs.hits > 0) helm(hg, hs); hpBefore = hs.hp; step(hg, hl); hs = hg.getState(); }
  check(hs.dawns === 1 && hpBefore < 3 && hs.hp === hpBefore + 1, `a dawn gives back a lost heart (${hpBefore} hearts before the dawn, ${hs.hp} after)`);
}

/* ---------------- 5. drawing ---------------- */
section("Drawing");
{
  const { g, log } = start(5), p = perfect({ seed: 5, jitter: .05 });
  let errors = 0, frames = 0;
  const moments = new Set();
  for (let i = 0; i < 120 * 400 && !moments.has("outro"); i++) {
    const s = g.getState(); log.now = s.time;
    if (!s.done) p(g, s);
    step(g, log);
    const n = g.getState();
    const m = n.done ? (n.time - log.finish.t > .5 ? "outro" : "end") : n.dawns && n.metres - 400 < 30 ? "dawn" : n.holding ? "holding" : n.shieldBeats > 0 ? "shield" : n.sailBeats > 0 ? "sail" : "sea";
    if (i % 20 === 0 || !moments.has(m)) { moments.add(m); try { g.draw(recorder()); frames++; } catch (e) { errors++; console.log("   ", m, e.message); } }
  }
  check(errors === 0 && ["sea", "holding", "shield", "sail", "dawn", "outro"].every((m) => moments.has(m)), `draw() runs at sea, while holding, with a shield and a sail, at a dawn and in the outro (${frames} frames)`);
}

console.log(`\nworlds.heartship.sim: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);

// A canvas context that accepts every call. onCall(name, args) sees each method call.
function recorder(onCall = () => {}) {
  const props = {};
  const gradient = { addColorStop: (...a) => onCall("addColorStop", a) };
  return new Proxy(props, {
    get(target, k) {
      if (k in target) return target[k];
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => gradient;
      if (k === "measureText") return () => ({ width: 10 });
      return (...a) => onCall(k, a);
    },
    set(target, k, v) { target[k] = v; return true; },
  });
}
