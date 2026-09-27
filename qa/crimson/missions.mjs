// The mission VM and free roam, on a live page (MISSIONS acceptance):
// 1. Save during a mission, reload, CONTINUE: the story resumes in that mission at its checkpoint step, with
//    the hero where the checkpoint had him.
// 2. A test mission that uses every step type in STEP_TYPES passes on autopilot, with no page errors.
// 3. Each step can fail and RETRY from its checkpoint; every retry is back in its step in < 1.5 s of wall
//    time.
// 4. Stepping the same mission twice after __crimson.seed(7) gives the same event log (determinism).
// 5. Pause freezes play: with the story menu open, a mission timer and a moving car stand still, and they
//    go on once it closes. A dialogue during a fight freezes the enemies; they move again after it (B7).
// 6. Side content (E8, E9): four Legend fights, two jeep time trials and three photo hunts exist and pass
//    on autopilot; 17 kazoos add a gourd sip and 51 turn the horn into a kazoo; a found cairn is a fast
//    travel stop; a wrecked van in free roam is towed to the A-frame.
// Run: NODE_PATH=/opt/node22/lib/node_modules node qa/crimson/missions.mjs (CRIMSON_URL for a worktree).
import { open, step, stepUntil, finish } from "./lib.mjs";

const fails = [], errs = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const Sx = (page, fn, arg) => page.evaluate(fn, arg);

/* ---------------- 1: save in a mission, reload, CONTINUE ---------------- */
// (no ?chapter= in the address: the reload must come back to the title and its CONTINUE)
const { browser, page, errors } = await open({ query: "?seed=7&nomusic" });
{
  await page.evaluate(() => __crimson.startStory({ chapter: "f1" }));
  let r = await stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.chapter === "f1" && __crimson.story.mission, { maxSec: 60 });
  check(r.ok, `a jump to f1 starts f1 (${r.sec} s)`);
  // autopilot to the first checkpoint after the start, then play stops there
  const cp = await Sx(page, () => {
    const S = __crimson.story.S, T = S.test.missions;
    S.missions.autopilot(true);
    for (let i = 0; i < 1200; i++) { const c = T.cp; if (c && c.mission === "f1" && c.step >= 1 && S.missions.active && S.missions.active.step === c.step) break; __crimson.step(1 / 60, false); }
    S.missions.autopilot(false);
    const c = T.cp, snap = T.K.cp.snap;
    return c ? { ...c, hero: snap.hero, active: { ...S.missions.active } } : null;
  });
  check(!!cp && cp.step >= 1, `f1 reaches a checkpoint on autopilot (step ${cp && cp.step})`);
  await step(page, 1.5);
  // (a step the autopilot began can finish on its own and reach the next checkpoint: compare with the latest)
  if (cp) Object.assign(cp, await Sx(page, () => { const T = __crimson.story.S.test.missions; return T.cp ? { ...T.cp, hero: T.K.cp.snap.hero } : {}; }));
  const saved = await Sx(page, () => { const S = __crimson.story.S; const ok = S.save.write(); return { ok, s: JSON.parse(localStorage.getItem("crimson.story.v1")) }; });
  check(saved.ok && saved.s.mission && saved.s.mission.id === "f1" && saved.s.mission.step === cp.step, `the save holds the mission and its checkpoint step (${JSON.stringify(saved.s.mission)})`);
  await page.reload();
  await page.waitForFunction(() => window.__crimson && __crimson.game.ready, null, { timeout: 300000, polling: 100 });
  await page.evaluate(() => __crimson.step(0, false));
  check(await Sx(page, () => __crimson.focusMode === "continue"), "after a reload the title offers CONTINUE");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 50 });
  r = await stepUntil(page, () => __crimson.story && __crimson.story.mission && __crimson.story.mission.id === "f1" && __crimson.story.mode === "play", { maxSec: 60 });
  const back = await Sx(page, () => { const S = __crimson.story.S; return { m: { ...S.missions.active }, hero: { x: S.hero.pos.x, z: S.hero.pos.z }, chapter: S.missions.chapter }; });
  const dh = cp && cp.hero ? Math.hypot(back.hero.x - cp.hero.x, back.hero.z - cp.hero.z) : 99;
  check(r.ok && back.chapter === "f1" && back.m.step === cp.step, `CONTINUE resumes f1 at the checkpoint step (${back.m.step} of ${cp.step}, ${back.m.type})`);
  check(dh < 3, `the hero is back where the checkpoint had him (${dh.toFixed(2)} m)`);
}

/* ---------------- the test mission: every step type ---------------- */
await Sx(page, () => {
  const S = __crimson.story.S, C = S.content;
  C.LINES["qa.line"] = { who: "gabe", text: "This is a test line." };
  C.CINES.qa_cine = { id: "qa_cine", dur: 2, cast: { g: "gabe" },
    shots: [{ at: 0, dur: 2, from: { who: "g", x: 0.6, y: 1.7, z: 4 }, to: { who: "g", x: -0.6, y: 1.6, z: 3 }, look: { who: "g", y: 1.5 } }],
    actors: [{ at: 0, who: "g", do: "moveTo", args: { to: { x: -600, z: 160 } } }, { at: 1, who: "g", do: "face", args: { who: "hero" } }],
    lines: [{ at: 0.4, who: "gabe", line: "qa.line" }], cards: [{ at: 0, kind: "title", title: "QA CINE" }], end: { actors: { g: { pos: { x: -598, z: 162 }, yaw: 1 } } } };
  C.SCRIPTS.qaScript = function* (m) { yield 0.1; m.flag("qaScript", true); };
  C.MISSIONS.qa_all = { id: "qa_all", title: "Every Step",
    spawns: [
      { id: "van", kind: "van", place: "f1_van", player: true },
      { id: "suv", kind: "suv", pos: { x: -540, z: 128 }, yaw: 1.57 },
      { id: "pickup", kind: "pickup", pos: { x: -500, z: 128 }, yaw: 1.57 },
      { id: "people", kind: "whitevan", pos: { x: -520, z: 110 }, yaw: 1.57, protect: true },
      { id: "gabe", cast: "gabe", pos: { x: -596, z: 166 } },
      { id: "dana", cast: "civA", pos: { x: -590, z: 160 } },
    ],
    steps: [
      { type: "cine", id: "qa_cine", cast: { g: "gabe" }, cp: true },
      { type: "talk", lines: ["qa.line"], cp: true },
      { type: "card", title: "QA CARD", dur: 1, cp: true },
      { type: "goto", to: "gas", r: 6, cp: true, objective: "Walk to the gas station." },
      { type: "enter", vehicle: "van", cp: true },
      { type: "drive", to: "sunline_plaza", r: 12, cp: true },
      { type: "tail", target: "suv", to: "motel", cp: true },
      { type: "lose", pursuers: ["pickup"], cp: true },
      { type: "chase", target: "pickup", goal: "disable", hits: 3, protect: ["people"], cp: true },
      { type: "race", gates: ["gas", "canyon_fleet"], target: 300, cp: true },
      { type: "exit", cp: true },
      { type: "wait", sec: 0.5, cp: true },
      { type: "stakeout", zone: "gas", until: "17:00", events: [{ at: "16:30", lines: ["qa.line"] }], cp: true },
      { type: "photo", subject: "motel", kind: "place", min: 30, cp: true },
      { type: "fight", waves: [[{ foe: "driver" }, { foe: "driver" }]], cp: true },
      { type: "defend", protect: { place: "gas", hp: 100, label: "BOX" }, waves: [[{ foe: "driver" }]], cp: true },
      { type: "stealth", guards: [{ foe: "guard", pos: { x: -455, z: 185 } }], cp: true },
      { type: "interact", at: "gas", label: "USE", hold: 1, cp: true },
      { type: "escort", followers: ["dana"], to: "motel", cover: ["gas"], cp: true },
      { type: "collect", items: [{ id: "a", at: "gas" }, { id: "b", at: "motel" }], cp: true },
      { type: "choice", title: "PICK ONE", options: ["A", { label: "B", flag: "qaB" }], cp: true },
      { type: "set", flags: { qaSet: 1 }, look: "DAY", cp: true },
      { type: "script", fn: "qaScript", cp: true },
    ] };
  S.day.set("sat", "16:00");
});
const bad = await Sx(page, async () => {
  const T = await import(new URL("js/story/types.js", location.href).href);
  const P = await import(new URL("js/story/world/places.js", location.href).href);
  const C = __crimson.story.S.content;
  return [...T.validateMission(C.MISSIONS.qa_all, { places: new Set(P.ALL_POINT_IDS), lines: C.LINES, cines: C.CINES, scripts: C.SCRIPTS }), ...T.validateCine(C.CINES.qa_cine, { lines: C.LINES })];
});
check(!bad.length, `the test mission and cine validate${bad.length ? ": " + bad.join("; ") : ""}`);

/* ---------------- 2: every step type on autopilot ---------------- */
const runQA = (page, reseed) => Sx(page, (reseed) => {
  const S = __crimson.story.S, T = S.test.missions;
  if (reseed) { __crimson.seed(7); S.day.set("sat", "16:00"); S.hero.place(-612, 176, 1.57); }
  const n0 = T.log.length;
  S.missions.autopilot(true);
  S.missions.start("qa_all");
  let i = 0;
  for (; i < 6000; i++) { __crimson.step(1 / 60, false); if (T.done.includes("qa_all") && !S.missions.active) break; }
  S.missions.autopilot(false);
  const log = T.log.slice(n0);
  const s0 = log.findIndex((e) => e[1] === "mission" && e[2] === "qa_all" && e[3] === "start"), t0 = s0 >= 0 ? log[s0][0] : 0;
  const run = log.slice(s0).map((e) => [Math.round((e[0] - t0) * 1000) / 1000, ...e.slice(1)]);
  const end = run.findIndex((e) => e[1] === "mission" && e[3] === "pass");
  return { ticks: i, done: T.done.includes("qa_all"), types: [...new Set(run.filter((e) => e[1] === "step").map((e) => e[4]))], log: run.slice(0, end + 1), flags: { s: !!S.flags.qaScript, set: S.flags.qaSet, choice: S.flags["choice:qa_all"] } };
}, reseed);
const run1 = await runQA(page, false);
const T = await import(new URL("../../public/crimson/js/story/types.js", import.meta.url).href);
const missing = T.STEP_TYPES.filter((t) => !run1.types.includes(t));
check(run1.done, `the test mission passes on autopilot (${run1.ticks} ticks)`);
check(!missing.length, `it ran every step type (${run1.types.length} of ${T.STEP_TYPES.length}${missing.length ? ", missing " + missing.join(", ") : ""})`);
check(run1.flags.s && run1.flags.set === 1 && run1.flags.choice === 0, `script, set and choice left their flags (${JSON.stringify(run1.flags)})`);

/* ---------------- 4: determinism ---------------- */
const a = await runQA(page, true), b = await runQA(page, true);
const same = JSON.stringify(a.log) === JSON.stringify(b.log);
let diff = "";
if (!same) { for (let i = 0; i < Math.max(a.log.length, b.log.length); i++) if (JSON.stringify(a.log[i]) !== JSON.stringify(b.log[i])) { diff = `${JSON.stringify(a.log[i])} vs ${JSON.stringify(b.log[i])}`; break; } }
check(a.done && b.done && same && a.log.length > 40, `two runs after seed(7) log the same ${a.log.length} events${diff ? ": first difference " + diff : ""}`);

/* ---------------- 3: each step fails and retries from its checkpoint ---------------- */
{
  const res = await Sx(page, () => {
    const S = __crimson.story.S, T = S.test.missions, K = T.K;
    const n = S.content.MISSIONS.qa_all.steps.length, failed = new Map(), back = new Map(), wrong = [];
    let pending = null;
    const off = S.bus.on("step", (e) => {
      if (e.mission !== "qa_all") return;
      if (pending != null) { if (e.index === pending) back.set(e.index, performance.now() - K.retryT); else wrong.push(`${pending}->${e.index}`); pending = null; }
      if (!failed.has(e.index)) { failed.set(e.index, K.cp && K.cp.step); S.missions.fail("A QA failure."); }
    });
    const offFail = S.bus.on("fail", (e) => { if (e.id === "qa_all" && S.missions.active) pending = S.missions.active.step; });
    let passed = false;
    const offPass = S.bus.on("mission", (e) => { if (e.id === "qa_all" && e.state === "pass") passed = true; });
    S.hero.place(-612, 176, 1.57); S.day.set("sat", "16:00");
    S.missions.autopilot(true);
    S.missions.start("qa_all");
    let i = 0;
    for (; i < 12000; i++) { __crimson.step(1 / 60, false); if (passed && !S.missions.active) break; }
    off(); offFail(); offPass(); S.missions.autopilot(false);
    const cpOk = [...failed.entries()].every(([k, c]) => c === k);
    const types = S.content.MISSIONS.qa_all.steps.map((s) => s.type);
    const missing = [...failed.keys()].filter((k) => !back.has(k)).map((k) => `${k} ${types[k]}`);
    return { n, failed: failed.size, back: back.size, max: Math.max(0, ...back.values()), cpOk, wrong, missing, cps: [...failed.entries()].filter(([k, c]) => c !== k).slice(0, 4) };
  });
  check(res.failed === res.n && res.back === res.n && !res.wrong.length, `each of the ${res.n} steps failed once and RETRY went back into it (${res.back} retries${res.wrong.length ? ", wrong: " + res.wrong.join(" ") : ""}${res.missing.length ? ", not back: " + res.missing.join(", ") : ""})`);
  check(res.cpOk, `every retry started from that step's own checkpoint${res.cps.length ? ": " + JSON.stringify(res.cps) : ""}`);
  check(res.max < 1500, `every retry took under 1.5 s of wall time (slowest ${res.max.toFixed(0)} ms)`);
}

/* ---------------- 5: pause freezes the timer and traffic; a dialogue freezes a fight ---------------- */
{
  const r = await Sx(page, () => {
    const S = __crimson.story.S, C = S.content;
    C.MISSIONS.qa_timer = { id: "qa_timer", spawns: [{ id: "car", kind: "sedan", pos: { x: -560, z: 128 }, yaw: 1.57 }], steps: [{ type: "goto", to: "airport_mesa", timeLimit: 90, cp: true }] };
    S.hero.place(-612, 176, 1.57);
    S.missions.start("qa_timer");
    for (let i = 0; i < 30; i++) __crimson.step(1 / 60, false);
    const m = S.test.missions.K.current, car = m.get("car");
    S.drivers.route(car, [{ x: -300, z: 110 }], { speed: 14 });
    for (let i = 0; i < 90; i++) __crimson.step(1 / 60, false);
    const t0 = m.timerLeft, c0 = car.pos.clone(), traffic0 = S.traffic.cars.map((v) => v.pos.clone());
    S.ui.menu.open();
    for (let i = 0; i < 120; i++) __crimson.step(1 / 60, false);
    const inMenu = S.mode, t1 = m.timerLeft, c1 = car.pos.clone(), traffic1 = S.traffic.cars.map((v) => v.pos.clone());
    S.ui.menu.close();
    for (let i = 0; i < 60; i++) __crimson.step(1 / 60, false);
    const t2 = m.timerLeft, c2 = car.pos.clone();
    const tMoved = traffic0.some((p, i) => traffic1[i] && p.distanceTo(traffic1[i]) > 1e-6);
    return { inMenu, t0, t1, t2, frozenCar: c0.distanceTo(c1), moved: c1.distanceTo(c2), traffic: traffic0.length, tMoved };
  });
  check(r.inMenu === "menu" && Math.abs(r.t1 - r.t0) < 1e-9 && r.frozenCar < 1e-6 && !r.tMoved, `with the menu open the mission timer, the car and ${r.traffic} traffic cars stand still (timer ${r.t0.toFixed(2)} -> ${r.t1.toFixed(2)}, car ${r.frozenCar.toFixed(3)} m)`);
  check(r.t0 - r.t2 > 0.9 && r.moved > 2, `after the menu the timer runs and the car drives on (timer ${r.t2.toFixed(2)}, car ${r.moved.toFixed(1)} m)`);
  await Sx(page, () => { const S = __crimson.story.S; S.missions.quit(); for (let i = 0; i < 10; i++) __crimson.step(1 / 60, false); });

  const f = await Sx(page, () => {
    const S = __crimson.story.S, C = S.content;
    C.MISSIONS.qa_fight = { id: "qa_fight", steps: [{ type: "fight", waves: [[{ foe: "driver", pos: { x: -600, z: 184 } }, { foe: "driver", pos: { x: -602, z: 168 } }]], cp: true }] };
    S.hero.place(-612, 176, 1.57); S.hero.hp = S.hero.maxHp;
    S.missions.start("qa_fight");
    for (let i = 0; i < 150; i++) __crimson.step(1 / 60, false);
    const E = () => S.combat.enemies.map((e) => [e.pos.x, e.pos.z, e.state, e.hp, e.a ? e.a.root.position.x : 0]);
    const h = S.ui.say([{ who: "gabe", text: "Hold on. A test line." }], { block: true });
    const frozen = S.freeze;
    const e0 = JSON.stringify(E()), hp0 = S.hero.hp;
    for (let i = 0; i < 120; i++) __crimson.step(1 / 60, false);
    const e1 = JSON.stringify(E()), hp1 = S.hero.hp;
    S.ui.advanceAll(); for (let i = 0; i < 5; i++) __crimson.step(1 / 60, false);
    const open = !h.done;
    const p0 = S.combat.enemies.map((e) => e.pos.clone());
    for (let i = 0; i < 120; i++) __crimson.step(1 / 60, false);
    const movedAfter = S.combat.enemies.some((e, i) => p0[i] && e.pos.distanceTo(p0[i]) > 0.05);
    S.missions.autopilot(true); for (let i = 0; i < 300 && S.missions.active; i++) __crimson.step(1 / 60, false); S.missions.autopilot(false);
    return { frozen, same: e0 === e1, hp: hp0 === hp1, open, movedAfter, n: JSON.parse(e0).length, log: S.test.missions.log.slice(-6) };
  });
  check(f.frozen && f.same && f.hp && f.n === 2, `a dialogue during a fight freezes the ${f.n} enemies and the hero's life${f.n !== 2 ? " " + JSON.stringify(f.log) : ""}`);
  check(!f.open && f.movedAfter, "after the dialogue the enemies move again");
}

/* ---------------- 6: side content ---------------- */
{
  const s = await Sx(page, () => {
    const S = __crimson.story.S, T = S.test.missions, K = T.K;
    K.doneSet.add("p1"); // free roam's side content opens after P1
    const ids = T.side();
    const run = (id) => { S.missions.autopilot(true); S.missions.start(id); let i = 0; for (; i < 3000; i++) { __crimson.step(1 / 60, false); if (T.done.includes(id) && !S.missions.active) break; } S.missions.autopilot(false); return { id, ok: T.done.includes(id), ticks: i }; };
    const out = { ids, runs: [] };
    for (const id of ["legend_javelina", "trial_schnebly", "hunt_bell"]) { S.hero.place(-612, 176, 1.57); out.runs.push(run(id)); }
    out.flags = { javelina: !!(S.flags.legend_javelina || T.done.includes("legend_javelina")), hunt: !!S.flags.hunt_bell, trial: K.trials.trial_schnebly };
    out.avail = S.missions.available();
    return out;
  });
  const want = ["legend_javelina", "legend_vulture", "legend_gila", "legend_tarantula", "trial_schnebly", "trial_canyon", "hunt_bell", "hunt_cathedral", "hunt_snoopy"];
  check(want.every((id) => s.ids.includes(id)), `the side content is there: 4 Legends, 2 time trials, 3 photo hunts (${s.ids.join(", ")})`);
  for (const r of s.runs) check(r.ok, `${r.id} passes on autopilot (${r.ticks} ticks)`);
  check(s.flags.javelina && s.flags.hunt && s.flags.trial > 0, `the side missions leave their marks (${JSON.stringify(s.flags)})`);
  check(!s.avail.includes("legend_javelina") && !s.avail.includes("legend_tarantula"), "a beaten Legend and a sleeping one are not offered");

  const k = await Sx(page, () => {
    const S = __crimson.story.S, T = S.test.missions, H = S.hero;
    H.canteenMax = 5;
    for (let i = 0; i < 17; i++) T.collect(i);
    const at17 = H.canteenMax;
    for (let i = 17; i < 51; i++) T.collect(i);
    return { at17, at51: H.canteenMax, horn: !!S.flags.kazooHorn, n: T.kazoos(), s: T.K.kazooString() };
  });
  check(k.at17 === 6 && k.at51 === 8, `17 kazoos add a gourd sip, 51 make 8 (${k.at17}, ${k.at51})`);
  check(k.horn && k.n === 51 && /^1{51}$/.test(k.s), "all 51 kazoos turn the horn into a kazoo");

  const c = await Sx(page, () => {
    const S = __crimson.story.S, T = S.test.missions, K = T.K;
    S.missions.quit(); for (let i = 0; i < 5; i++) __crimson.step(1 / 60, false);
    const P = S.world.place("cairn_bell");
    S.hero.place(P.x + 6, P.z + 6);
    for (let i = 0; i < 10; i++) __crimson.step(1 / 60, false);
    const found = S.missions.cairns.includes("cairn_bell");
    S.hero.place(-520, 150, 1.57); // (away from the marker back into f1, which would start it)
    for (let i = 0; i < 5; i++) __crimson.step(1 / 60, false);
    const asked = S.missions.travel("cairn_bell");
    for (let i = 0; i < 200; i++) __crimson.step(1 / 60, false);
    const d = Math.hypot(S.hero.pos.x - P.x, S.hero.pos.z - P.z);
    // a wrecked van in free roam goes to the A-frame
    const v = S.vehicles.player;
    let tow = null;
    if (v) {
      v.setPose(-560, 150, 0); v.damage = 100; v.wrecked = true;
      for (let i = 0; i < 400; i++) __crimson.step(1 / 60, false);
      const a = S.world.place("f1_park");
      tow = { wrecked: v.wrecked, d: Math.hypot(v.pos.x - a.x, v.pos.z - a.z), roaming: T.roaming };
    }
    // down in free roam: the crew pulls the hero out at the last cairn
    S.hero.place(-520, 150, 0); S.flags.lastCairn = "cairn_bell"; S.hero.hp = 0;
    for (let i = 0; i < 360; i++) __crimson.step(1 / 60, false);
    const rs = { d: Math.hypot(S.hero.pos.x - P.x, S.hero.pos.z - P.z), hp: S.hero.hp === S.hero.maxHp };
    return { found, asked, d, tow, roaming: T.roaming, rs };
  });
  check(c.found, "walking up to a cairn finds it");
  check(c.asked && c.d < 10, `free roam travels to a found cairn (${c.d.toFixed(1)} m from it)`);
  check(!!c.tow && !c.tow.wrecked && c.tow.d < 8, `a wrecked van in free roam is towed to the A-frame (${c.tow && c.tow.d.toFixed(1)} m)`);
  check(c.rs.d < 10 && c.rs.hp, `down in free roam, the hero wakes at the last cairn with full life (${c.rs.d.toFixed(1)} m)`);
}
errs.push(...errors);
await browser.close();
await finish("missions", fails, null, errs);
