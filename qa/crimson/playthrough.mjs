// The story played by hand: qa/crimson/playbot.js plays each chapter with the real inputs (keys through
// S.input.key, the sticks through S.input.set), no autopilot and no teleports. For each chapter the page
// opens at ?chapter=<id>&seed=7&nomusic, the bot plays until the next chapter starts (or the credits roll),
// and the run fails on a page error, the error card, a soft lock (one step for longer than its limit) or
// running out of time.
// Usage: node qa/crimson/playthrough.mjs [chapter or side id ...] [--shots <dir>] [--max <sec>]
//   (no ids: every chapter in CHAPTER_ORDER; side ids are the SIDE missions, run from free roam)
import { readFileSync } from "fs";
import { open, step, stepUntil, loop, shot, finish, invariants } from "./lib.mjs";

const T = await import(new URL("../../public/crimson/js/story/types.js", import.meta.url).href);
const E = await import(new URL("../../public/crimson/js/story/content/m_epilogue.js", import.meta.url).href);
const BOT = readFileSync(new URL("./playbot.js", import.meta.url), "utf8");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const SHOTS = opt("--shots", null), MAXSEC = +opt("--max", 0) || 0, EVERY = +opt("--every", 0) || 0, VERBOSE = (() => { const i = args.indexOf("--v"); if (i >= 0) { args.splice(i, 1); return true; } return false; })();
const CHOICES = { p1: 1 }; // P1: SHADES speaks first (the non-default option)
const want = args.filter((a) => !a.startsWith("--"));
const ids = want.length ? want : ["fixes", "newstory", ...T.CHAPTER_ORDER, ...Object.keys(E.SIDE)];
const fails = [], errs = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };

// play until done(state) is true; one bot tick before every game tick, in the page
async function play(page, { maxSec, stepLimit = 240, done, shotsAt = [], label }) {
  const t0 = Date.now();
  let sec = 0, lastKey = "", keyT = 0, shotI = 0;
  const log = [];
  for (;;) {
    const r = await page.evaluate(([n, doneSrc]) => {
      const d = (0, eval)("(" + doneSrc + ")");
      for (let i = 0; i < n; i++) {
        if (d()) return { done: true, i };
        __bot.tick(); __crimson.step(1 / 60, false);
      }
      return { done: !!d(), i: n };
    }, [EVERY ? Math.min(300, EVERY * 60) : 300, done.toString()]);
    sec += r.i / 60;
    const st = await page.evaluate(() => { const S = __crimson.story.S, H = S.hero, v = S.drive.riding; return { state: __bot.state, obj: S.test.ui.objective, card: S.test.ui.card, hero: [+H.pos.x.toFixed(1), +H.pos.z.toFixed(1)], hp: H.hp, v: v ? +v.speed.toFixed(1) : null, fails: __bot.fails.length }; });
    if (st.state !== lastKey) { lastKey = st.state; keyT = sec; log.push(`${sec.toFixed(1)}s ${st.state} | ${st.obj || ""}`); }
    if (VERBOSE) console.log(`     ${label} ${sec.toFixed(1)}s ${st.state} | ${st.obj || ""} | hero ${st.hero} hp ${Math.round(st.hp)} ${st.v != null ? "v " + st.v : ""}`);
    if (EVERY && SHOTS) { const k = Math.floor(sec / EVERY); if (k > (play.k ?? -1)) { play.k = k; await page.evaluate(() => __crimson.step(1 / 60, true)); await shot(page, `${SHOTS}/${label}_t${Math.round(sec)}.png`); } }
    else if (SHOTS && shotI < shotsAt.length && sec >= shotsAt[shotI]) { await page.evaluate(() => __crimson.step(1 / 60, true)); await shot(page, `${SHOTS}/${label}_${shotI}.png`); shotI++; }
    if (r.done) return { ok: true, sec, log };
    if (sec - keyT > stepLimit && !/^roam|^cine|^modal/.test(lastKey)) return { ok: false, sec, log, why: `stuck in ${lastKey} for ${(sec - keyT).toFixed(0)} s (${st.obj || "no objective"}; hero ${st.hero})` };
    if (sec > maxSec) return { ok: false, sec, log, why: `out of time after ${sec.toFixed(0)} s in ${lastKey} (${st.obj || "no objective"}; hero ${st.hero})` };
    if (Date.now() - t0 > 40 * 60 * 1000) return { ok: false, sec, log, why: "40 min real time" };
  }
}

async function setup(query) {
  const o = await open({ query });
  await stepUntil(o.page, () => __crimson.story && __crimson.story.ready && __crimson.story.mode === "play", { maxSec: 60 });
  await o.page.evaluate(async (src) => {
    (0, eval)(src);
    __bot.lib = await import("/crimson/js/story/vehicles/drivers.js");
  }, BOT);
  return o;
}

const SIDE = Object.keys(E.SIDE);

/* ---------------- the fixes: short, exact regression checks for what the playthrough found ---------------- */
// Each one jumps to the step (?mission / S.missions.start) and then uses the real inputs where it can.
if (ids.includes("fixes")) {
  const t0 = Date.now();
  const R = await import(new URL("../../public/crimson/js/story/world/roads.js", import.meta.url).href);
  const PL = await import(new URL("../../public/crimson/js/story/world/places.js", import.meta.url).href);
  const C = await import(new URL("../../public/crimson/js/story/content/content.js", import.meta.url).href);
  // --- data: every point a player must reach can be reached
  const segDist = (pts, x, z) => { let b = Infinity; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); b = Math.min(b, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return b; };
  const a89c = R.ROADS.find((r) => r.id === "a89c").pts;
  const gates = C.MISSIONS.trial_canyon.steps.find((st) => st.type === "race").gates;
  check(gates.every((g) => segDist(a89c, g.x, g.z) < 11), `the Canyon Run's gates are all within reach of 89A (${gates.map((g) => segDist(a89c, g.x, g.z).toFixed(0)).join(" ")} m)`);
  const inBuilding = (x, z) => PL.BUILDINGS.some((b) => { const c = Math.cos(b.yaw), s2 = Math.sin(b.yaw), lx = (x - b.x) * c - (z - b.z) * s2, lz = (x - b.x) * s2 + (z - b.z) * c; return Math.abs(lx) < b.w / 2 && Math.abs(lz) < b.d / 2; });
  const p5items = C.MISSIONS.p5.steps.find((st) => st.type === "collect").items;
  check(p5items.every((it) => !inBuilding(it.pos.x, it.pos.z)), "P5's photo points are not inside a building");
  const hr = C.MISSIONS.hunt_rocks.at;
  check(typeof hr === "object" && Math.hypot(hr.x - 60, hr.z - 40) > 12, "the Y photo hunt's marker is not on the boulder island");
  check(Math.hypot(C.MISSIONS.trial_canyon.at.x - PL.PLACES.midgley_lot.x, C.MISSIONS.trial_canyon.at.z - PL.PLACES.midgley_lot.z) > 10, "the Canyon Run and the canyon photo hunt have markers of their own");
  const schneb = R.ROADS.find((r) => r.id === "schnebly").pts[0], r179 = R.ROADS.find((r) => r.id === "r179"), br = r179.bridges[0];
  check(Math.hypot(schneb[0] - br.b[0], schneb[1] - br.b[1]) > 10 && schneb[1] > br.b[1], "Schnebly Hill Rd joins SR 179 past the end of its bridge, not through its rail");

  const { browser, page, errors } = await setup("?mission=f2&step=1&seed=7&nomusic");
  const K = async (code, sec = 0.1) => { await page.evaluate((c) => __crimson.story.S.input.key({ code: c, preventDefault() {} }, true), code); await step(page, 1 / 60); await page.evaluate((c) => __crimson.story.S.input.key({ code: c, preventDefault() {} }, false), code); await step(page, sec); };
  // jump to a step (setup: the cards and lines before it are read through at once)
  const jump = async (id, n) => {
    await page.evaluate(([id, n]) => { window.__jump = { id, n }; __crimson.story.S.input.clear(); __crimson.story.S.missions.start(id, { step: n }); }, [id, n]);
    return stepUntil(page, () => { const S = __crimson.story.S, m = S.test.missions.K.current, J = window.__jump; if (S.modal) S.ui.advanceAll(); if (S.cine.active) S.cine.skip(); return !!m && m.def.id === J.id && m.index >= J.n && !S.modal && !S.cine.active; }, { maxSec: 30 });
  };
  const idx = () => page.evaluate(() => { const m = __crimson.story.S.test.missions.K.current; return m ? `${m.def.id}#${m.index}` : "none"; });
  // F2 step 2: "Take three photos" (subject 'any'): the camera key, then the shutter three times
  await jump("f2", 2);
  await K("KeyV", 0.4);
  for (let i = 0; i < 3; i++) await K("Space", 0.9);
  let at = await idx();
  check(at !== "f2#2", `F2: three photos with the camera key and the shutter end the photo step (now ${at})`);
  // F2 step 6: "Get in the orange jeep" beside Gabe: E at the passenger door seats the hero in front, not at the wheel
  await jump("f2", 5);
  await stepUntil(page, () => __crimson.story.S.test.missions.K.current.index >= 6, { maxSec: 5 });
  await step(page, 1.5); // (the jeep settles where it was spawned)
  const door = await page.evaluate(() => { const S = __crimson.story.S, j = S.test.missions.K.current.get("jeep"), d = j.doorPoint("passenger"); S.hero.place(d.x + 0.5, d.z + 0.5); return { gabe: j.seats[0] && j.seats[0].id, getin: S.interact.list.filter((o) => o.id.includes(j.id)).length }; });
  door.trace = await page.evaluate(() => { const S = __crimson.story.S, out = []; for (let i = 0; i < 18; i++) { __crimson.step(1 / 60, false); if (i % 3 === 0) out.push([S.hero.pos.x.toFixed(1), S.hero.pos.z.toFixed(1), S.hero.state, JSON.stringify(S.input.axis('move'))]); } return out; });
  door.cur = await page.evaluate(() => { const S = __crimson.story.S, c = S.interact.current, j = S.test.missions.K.current.get("jeep"); return [c && c.label, S.hero.mode, S.modal, S.photo.active, S.test.missions.K.current.index, j.id, S.interact.list.filter((o) => o.id.startsWith('getin:' + j.id + ':')).map((o) => { const p = o.pos(); return [o.when(), Math.hypot(p.x - S.hero.pos.x, p.z - S.hero.pos.z).toFixed(2), (p.y - S.hero.pos.y).toFixed(2)]; }), S.hero.pos.x.toFixed(1), S.hero.pos.z.toFixed(1), j.pos.x.toFixed(1), j.pos.z.toFixed(1)]; });
  await K("KeyE", 2);
  const seat = await page.evaluate(() => ({ seat: __crimson.story.S.drive.heroSeat, at: __crimson.story.S.test.missions.K.current.index }));
  check(door.gabe === "gabe" && door.getin === 2 && seat.seat >= 1 && seat.at > 6, `F2: the tour jeep has doors, Gabe drives, E at the passenger door seats the hero beside him (seat ${seat.seat}, step ${seat.at}, ${JSON.stringify(door.cur)} ${JSON.stringify(door.trace)})`);
  // F2 step 8: Gabe drives the jeep up Schnebly Hill to the vista (the junction off SR 179 is clear of the bridge rail)
  let r = await stepUntil(page, () => { const S = __crimson.story.S, m = S.test.missions.K.current; if (S.modal) S.ui.advanceAll(); return m && m.index >= 9; }, { maxSec: 160, chunk: 1 });
  const vista = await page.evaluate(() => { const S = __crimson.story.S, j = S.test.missions.K.current.get("jeep"), v = S.world.place("schnebly_vista"); return Math.hypot(j.pos.x - v.x, j.pos.z - v.z); });
  check(r.ok && vista < 25, `F2: Gabe's jeep reaches the vista (${r.sec.toFixed(0)} s, ${vista.toFixed(0)} m from it)`);
  // F2 step 13: Gabe races in the tour jeep (the rival)
  await jump("f2", 13);
  r = await stepUntil(page, () => { const m = __crimson.story.S.test.missions.K.current; return m && m.index >= 15; }, { maxSec: 5 });
  await step(page, 6);
  const rival = await page.evaluate(() => { const j = __crimson.story.S.test.missions.K.current.get("jeep"); return { kind: j.controller && j.controller.kind, speed: j.speed, driver: j.seats[0] && j.seats[0].id }; });
  check(rival.kind === "race" && rival.speed > 3 && rival.driver === "gabe", `F2: Gabe races down the hill in the tour jeep (${JSON.stringify(rival)})`);
  // F4: rocked out of the creek the van stands on Creekside Dr, and every clue around it is on its level with its
  // own prompt (not the van's GET IN)
  await jump("f4", 6);
  await page.evaluate(() => __crimson.story.S.test.van.enter()); await step(page, 1.2);
  r = await loop(page, 60 * 30, () => { const S = __crimson.story.S, m = [...document.querySelectorAll("#sMeters .meter")].find((e) => /ROCK/.test(e.textContent)); if (!m) return S.test.missions.K.current && S.test.missions.K.current.index > 6; const left = parseFloat(m.querySelector(".dot").style.left) / 100; S.input.key({ code: "KeyW", preventDefault() {} }, left > 0.8 && !window.__qaGas); window.__qaGas = left > 0.8; return false; });
  await page.evaluate(() => __crimson.story.S.input.key({ code: "KeyW", preventDefault() {} }, false));
  const van = await page.evaluate(() => { const S = __crimson.story.S, v = S.vehicles.player; return { road: S.world.roadDist(v.pos.x, v.pos.z), y: v.pos.y, ground: S.world.height(v.pos.x, v.pos.z) }; });
  check(r.stopped && van.road < 3 && Math.abs(van.y - van.ground) < 1.5, `F4: rocked out, the van stands on the road (${van.road.toFixed(1)} m off it)`);
  // (on from there: the lines, then E to get out)
  await stepUntil(page, () => { const S = __crimson.story.S; if (S.modal) S.ui.advanceAll(); return S.test.missions.K.current.index >= 8 && !S.modal; }, { maxSec: 20 });
  await K("KeyE", 1.5);
  await stepUntil(page, () => { const S = __crimson.story.S; if (S.modal) S.ui.advanceAll(); return S.test.missions.K.current.index >= 9 && !S.modal; }, { maxSec: 20 });
  const clues = await page.evaluate(() => { const S = __crimson.story.S, v = S.vehicles.player; return S.interact.list.filter((o) => o.id.startsWith("clue:")).map((o) => { const p = o.pos(); return { id: o.id, dy: Math.abs(p.y - v.pos.y), x: p.x, z: p.z }; }); });
  let prompts = 0;
  for (const c of clues) { await page.evaluate((c) => { const S = __crimson.story.S, v = S.vehicles.player; const a = Math.atan2(c.x - v.pos.x, c.z - v.pos.z); S.hero.place(c.x + Math.sin(a) * 0.6, c.z + Math.cos(a) * 0.6); }, c); await step(page, 0.1); if (await page.evaluate((id) => { const cur = __crimson.story.S.interact.current; return !!cur && cur.id === id; }, c.id)) prompts++; }
  check(clues.length === 5 && clues.every((c) => c.dy < 1.6) && prompts === 5, `F4: the five clues stand by the van on its level, each with its own prompt (${prompts}/5 prompts, dy ${clues.map((c) => c.dy.toFixed(1)).join(" ")})`);
  let grpNote = '';
  // P7 step 8: the timer photo: the camera key props the phone, the shutter starts ten seconds, the photo is kept
  await jump("p7", 8);
  const pre = await page.evaluate(() => { const S = __crimson.story.S; return [S.hero.mode, S.input.context, S.modal, S.photo.active, S.lockControl, S.hero.state]; });
  await K("KeyV", 0.3);
  const propped = await page.evaluate(() => !!__crimson.story.S.test.missions.K.photo.st.propped);
  grpNote = JSON.stringify(pre) + ' propped ' + propped;
  await K("Space", 11.5);
  const grp = await page.evaluate(() => ({ at: __crimson.story.S.test.missions.K.current ? __crimson.story.S.test.missions.K.current.index : -1, flag: __crimson.story.S.flags.p7Group }));
  check(propped && grp.at > 8 && typeof grp.flag === "string", `P7: the camera key props the phone, the shutter's ten seconds take the group photo (${JSON.stringify(grp)} ${grpNote})`);
  // P3 step 11: the optional photo runs out of time and the mission goes on (fail: 'skip' is not MISSION FAILED)
  await jump("p3", 11);
  r = await stepUntil(page, () => { const S = __crimson.story.S; return S.test.missions.done.includes("p3") || S.test.ui.card === "MISSION FAILED"; }, { maxSec: 40, chunk: 0.5 });
  const p3 = await page.evaluate(() => ({ card: __crimson.story.S.test.ui.card, done: __crimson.story.S.test.missions.done.includes("p3") }));
  check(p3.done && p3.card !== "MISSION FAILED", `P3: the optional dash photo times out and the mission passes (${JSON.stringify(p3)})`);
  if (p3.card) await page.evaluate(() => __crimson.story.S.ui.advanceAll());
  // P3 step 7 / F5 step 18: the stealth step watches the mission's own spawns ({spawn}), not new guards
  // dropped beside the hero; F5's Gabe (a cast actor) watches through a stand-in with his flashlight cone
  await jump("p3", 7);
  await step(page, 3);
  const p3s = await page.evaluate(() => { const S = __crimson.story.S, m = S.test.missions.K.current, w = S.stealth.list; return { n: w.length, lookout: w.length === 1 && w[0].f === m.get("lookout"), card: S.test.ui.card, at: m.index }; });
  check(p3s.lookout && p3s.card !== "MISSION FAILED" && p3s.at === 7, `P3: the lookout is the one watcher, and standing still at the van is not seen (${JSON.stringify(p3s)})`);
  await jump("f5", 18);
  await step(page, 1);
  const f5s = await page.evaluate(() => { const S = __crimson.story.S, m = S.test.missions.K.current, w = S.stealth.list, g = m.get("gabe"); return { n: w.length, gabe: w.length === 1 && w[0].f.actor === g, beam: !!(w[0] && w[0].f.beam) && Math.hypot(w[0].f.beam.position.x - g.root.position.x, w[0].f.beam.position.z - g.root.position.z) < 1, enemies: S.combat.enemies.filter((f) => !f.gone).length }; });
  check(f5s.gabe && f5s.beam && f5s.enemies === 0, `F5: Gabe on the Perch is the watcher, with his flashlight cone, and no guard is spawned (${JSON.stringify(f5s)})`);
  await page.evaluate(() => __crimson.story.S.missions.quit()); await step(page, 0.5);
  // P5 step 9: all four photos can be taken from the ridge
  await jump("p5", 9);
  const ridge = await page.evaluate(() => {
    const S = __crimson.story.S, K2 = S.test.missions.K, P = K2.photo, rp = S.world.place("hart_ridge"), out = {};
    P.open({ force: true });
    for (const id of [...P.subjects.keys()].filter((k) => k.startsWith("clue:"))) {
      const sub = P.subjects.get(id), info = P.info(sub), y = S.world.surface(rp.x, rp.z) + 1.62, d = Math.hypot(info.x - rp.x, info.z - rp.z);
      let best = 0; for (const zoom of [2, 4, 6, 8]) { P.pose({ x: rp.x, y, z: rp.z, yaw: Math.atan2(info.x - rp.x, info.z - rp.z), pitch: Math.atan2(info.y + info.h * 0.5 - y, d), zoom }); best = Math.max(best, P.scoreOf(sub).score); }
      out[id] = Math.round(best);
    }
    P.close(); return out;
  });
  check(Object.keys(ridge).length === 4 && Object.values(ridge).every((v) => v >= 45), `P5: the bunkhouse door, the plates, a guard and the generator shed can all be photographed from the ridge (${JSON.stringify(ridge)})`);
  // P10: after the last cover only the goal marker shows
  await jump("p10_rescue", 2);
  for (const c of [[795, -768], [770, -750], [748, -733]]) {
    await page.evaluate((c) => __crimson.story.S.hero.place(c[0] + 1, c[1]), c); await step(page, 0.2);
    await K("KeyE", 0.2);
    await stepUntil(page, () => /cover/.test(__crimson.story.S.test.ui.objective || "") || /Lead them/.test(__crimson.story.S.test.ui.objective || ""), { maxSec: 30, chunk: 0.5 });
  }
  const mk = await page.evaluate(() => __crimson.story.S.test.missions.K.markers3d.list.map((m) => m.id));
  check(!mk.includes("m:cover") && mk.includes("m:goal"), `P10: after the last cover the cover marker goes and the goal shows (${mk.join(" ")})`);
  // P9: the convoy leaves from across town; the chase does not fail before you catch up, and the convoy stops at
  // Gabe's jeep across the bridge
  await jump("p9", 3);
  r = await stepUntil(page, () => { const S = __crimson.story.S, m = S.test.missions.K.current; if (S.modal && S.test.ui.card !== "MISSION FAILED") S.ui.advanceAll(); return S.test.ui.card === "MISSION FAILED" || (m && m.index === 7 && S.time > 0); }, { maxSec: 20 });
  await step(page, 125);
  const p9 = await page.evaluate(() => { const S = __crimson.story.S, m = S.test.missions.K.current, b = S.world.place("p9_bridge_block"); return { card: S.test.ui.card, at: m && m.index, lead: m && Math.hypot(m.get("voss_suv").pos.x - b.x, m.get("voss_suv").pos.z - b.z), speed: m && Math.abs(m.get("voss_suv").speed) }; });
  check(p9.card !== "MISSION FAILED" && p9.at === 7 && p9.lead < 40 && p9.speed < 1, `P9: no "they got away" before you catch up; the convoy waits at the jeep across the bridge (${JSON.stringify(p9)})`);
  // P9 step 9 (a RETRY there rebuilds the convoy at Red Rock Plaza): the SUV and the van come up to the block again
  await jump("p9", 9);
  await step(page, 45);
  const p9b = await page.evaluate(() => { const S = __crimson.story.S, m = S.test.missions.K.current, b = S.world.place("p9_bridge_block"); return { at: m && m.index, van: m && Math.round(Math.hypot(m.get("van1").pos.x - b.x, m.get("van1").pos.z - b.z)) }; });
  check(p9b.at > 9 && p9b.van < 60, `P9: from the block's checkpoint the van comes up the canyon to the block (${JSON.stringify(p9b)})`);
  // E1's wedding cine: the placed cast stands there from the first frame (the bride, Christian, Ryu), and the
  // opening shot is not inside a cottonwood's crown
  await page.evaluate(() => { const S = __crimson.story.S; S.missions.start("e1", { step: 3 }); });
  await stepUntil(page, () => { const S = __crimson.story.S; if (S.modal) S.ui.advanceAll(); return S.cine.active && S.cine.current === "e1_wedding"; }, { maxSec: 30, chunk: 1 / 15 });
  await step(page, 3);
  const wed = await page.evaluate(() => { const S = __crimson.story.S, w = S.world.place("wedding"), c = S.camera.position; let trees = 0; S.world.colliders.query(c.x, c.z, 5, (it) => { if (it.tag === "tree") trees++; });
    const there = S.cast.all().filter((a) => a.root && a.visible !== false && a.root.parent && Math.hypot(a.root.position.x - w.x, a.root.position.z - w.z) < 8).map((a) => a.id);
    return { cine: S.cine.current, trees, there: [...new Set(there)].sort() }; });
  check(wed.cine === "e1_wedding" && wed.trees === 0, `E1: the wedding's opening shot has no tree at the lens (${wed.trees} trunks within 5 m)`);
  check(["christian", "ryu", "civB", "gabe"].every((id) => wed.there.includes(id)), `E1: Gabe, Christian, Ryu and the bride stand at the wedding from the first shot (${wed.there.join(" ")})`);
  await page.evaluate(() => { const S = __crimson.story.S; S.cine.skip(); S.missions.quit(); }); await step(page, 0.5);
  // F5's chase: the pickup and the SUV top out a little under the van, so good driving loses them
  await jump("f5", 4);
  const f5 = await page.evaluate(() => { const S = __crimson.story.S, m = S.test.missions.K.current, v = S.vehicles.player; return { top: v.spec.top, caps: ["pickup", "suv"].map((id) => { const x = m.get(id); return x && x.controller && x.controller.o ? x.controller.o.max : null; }) }; });
  check(f5.caps.every((c) => c != null && c < f5.top && c > f5.top * 0.85), `F5: the pursuers ask for at most ${f5.caps.map((c) => (c == null ? "?" : c.toFixed(1))).join(" and ")} m/s, under the van's ${f5.top}`);
  await page.evaluate(() => { __crimson.story.S.missions.quit(); }); await step(page, 0.5);
  // FR 9: the Whale drives west onto the FR 9 bridge (the deck end is not a wall)
  const fr9 = await page.evaluate(() => { const S = __crimson.story.S, T = S.test.van; S.missions.quit(); return true; });
  await step(page, 1);
  await page.evaluate(() => { const S = __crimson.story.S, T = S.test.van; if (S.drive.riding) S.drive.exit(); T.teleport(578, -704.5, 4.8); T.enter(); });
  await step(page, 1.5);
  await page.evaluate(() => { const T = __crimson.story.S.test.van; T.teleport(578, -704.5, 4.8); T.drive(1, 0, false, 6); });
  await step(page, 5);
  const fx = await page.evaluate(() => { const v = __crimson.story.S.drive.riding; return v ? v.pos.x : 999; });
  check(fr9 && fx < 556, `FR 9: a van driving west gets onto the bridge (x ${fx.toFixed(0)})`);
  if (errors.length) { check(false, `fixes: page errors: ${errors.slice(0, 3).join(" | ")}`); errs.push(...errors); }
  console.log(`     fixes: ${((Date.now() - t0) / 1000).toFixed(0)} s real`);
  await browser.close();
}
// NEW STORY from the title with the keyboard: Enter on NEW STORY, the arena fight (won with the QA win: FIGHT
// GABE is the arena game, not the story), the cold open into F1; F1 by hand to its first drive; SAVE & QUIT from
// the pause menu with the keys (Esc, down to SAVE & QUIT, Enter); a reload; CONTINUE with Enter; F1 by hand
// from the checkpoint to the end.
if (ids.includes("newstory")) {
  const t0 = Date.now();
  const { browser, page, errors } = await open({ query: "?seed=7&nomusic" });
  const title = await page.evaluate(() => ({ state: __crimson.game.state, focus: __crimson.focusMode, cont: !document.getElementById("modeContinue").hidden }));
  check(title.state === "title" && title.focus === "story" && !title.cont, `newstory: the title offers NEW STORY first and no CONTINUE (${JSON.stringify(title)})`);
  await page.keyboard.press("Enter");
  await stepUntil(page, () => __crimson.game.mode === "story" && __crimson.storyLoaded, { maxSec: 30 });
  await page.evaluate(() => __crimson.win());
  let r = await stepUntil(page, () => __crimson.story && __crimson.story.ready && ["c0", "i0"].includes(__crimson.story.chapter), { maxSec: 60 });
  check(r.ok, "newstory: NEW STORY with Enter, the arena fight, then the story takes over at c0");
  await page.evaluate(async (src) => { (0, eval)(src); __bot.lib = await import("/crimson/js/story/vehicles/drivers.js"); }, BOT);
  r = await play(page, { label: "newstory", maxSec: 200, done: () => { const s = __crimson.story, m = s.S.test.missions.K.current; return s.chapter === "f1" && m && m.index >= 4 && !s.S.modal; } });
  check(r.ok, `newstory: c0 and i0 play through into F1, and F1 by hand up to its drive${r.ok ? "" : ": " + r.why}`);
  const before = await page.evaluate(() => ({ step: __crimson.story.S.test.missions.K.current.index, save: JSON.parse(localStorage.getItem("crimson.story.v1") || "null") }));
  // SAVE & QUIT with the keys: Esc opens the menu, SAVE & QUIT is the seventh button
  await page.evaluate(() => __bot.releaseAll());
  await page.keyboard.press("Escape"); await step(page, 0.1);
  for (let i = 0; i < 10 && (await page.evaluate(() => __crimson.story.S.test.ui.focus)) !== "SAVE & QUIT"; i++) { await page.keyboard.press("ArrowDown"); await step(page, 0.05); }
  const focus = await page.evaluate(() => __crimson.story.S.test.ui.focus);
  await page.keyboard.press("Enter"); await step(page, 0.2);
  const t = await page.evaluate(() => ({ state: __crimson.game.state, cont: !document.getElementById("modeContinue").hidden, sum: document.querySelector("#modeContinue small").textContent, save: JSON.parse(localStorage.getItem("crimson.story.v1") || "null") }));
  check(focus === "SAVE & QUIT" && t.state === "title" && t.cont && t.sum === "CHAPTER 3 · TEN SEATS", `newstory: Esc, down to SAVE & QUIT (${focus}), Enter: the title with CONTINUE (${t.sum})`);
  check(!!t.save && t.save.chapter === "f1" && t.save.mission && t.save.mission.id === "f1" && t.save.mission.step === 3, `newstory: the save resumes F1 at its drive checkpoint (${JSON.stringify(t.save && t.save.mission)}; step ${before.step} when quit)`);
  await page.reload();
  await page.waitForFunction(() => window.__crimson && __crimson.game.ready, null, { timeout: 300000, polling: 100 });
  await page.evaluate(() => __crimson.step(0, false));
  const focus2 = await page.evaluate(() => __crimson.focusMode);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 50 });
  r = await stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.mode === "play" && __crimson.story.chapter === "f1" && !!__crimson.story.S.test.missions.K.current, { maxSec: 40 });
  const resumed = await page.evaluate(() => ({ step: __crimson.story.S.test.missions.K.current.index, riding: !!__crimson.story.S.drive.riding }));
  check(focus2 === "continue" && r.ok && resumed.step === 3, `newstory: after a reload CONTINUE (Enter) resumes F1 at its drive (step ${resumed.step}, in the van ${resumed.riding})`);
  await page.evaluate(async (src) => { (0, eval)(src); __bot.lib = await import("/crimson/js/story/vehicles/drivers.js"); }, BOT);
  r = await play(page, { label: "newstory-f1", maxSec: 600, done: () => __crimson.story.chapter === "i1" });
  if (!r.ok) console.log(JSON.stringify(await page.evaluate(() => { const S = __crimson.story.S, v = S.drive.riding; return { y: v && v.pos.y, ts: S.timeScale, freeze: S.freeze, lock: S.lockControl, mode: S.mode, hero: S.hero.mode, v: v && [v.pos.x, v.pos.z, v.speed, JSON.stringify(v.controls)], ctx: S.input.context, drv: __bot.drv && __bot.drv.p && [__bot.drv.p.s, __bot.drv.p.off] }; })));
  check(r.ok, `newstory: F1 by hand from the checkpoint to I1${r.ok ? "" : ": " + r.why}`);
  if (SHOTS) { await page.evaluate(() => __crimson.step(1 / 60, true)); await shot(page, `${SHOTS}/newstory_end.png`); }
  if (errors.length) { check(false, `newstory: page errors: ${errors.slice(0, 3).join(" | ")}`); errs.push(...errors); }
  console.log(`     newstory: ${((Date.now() - t0) / 1000).toFixed(0)} s real`);
  await browser.close();
}
// the side content: E1 by hand to the end of the credits, KEEP PLAYING, then each side job walked (or driven)
// to and started the way a player starts it (a Legend wakes when you walk up to its cairn; a time trial or a
// photo hunt starts on E at its marker). The chapters that unlock them (P1, P5, P7, P9) are not played in this
// run, so their unlocks are given here.
const sideIds = ids.filter((id) => SIDE.includes(id));
if (sideIds.length) {
  const t0 = Date.now();
  const { browser, page, errors } = await setup("?chapter=e1&seed=7&nomusic");
  let r = await play(page, { label: "e1-credits", maxSec: 400, done: () => { const S = __crimson.story.S; return S.test.missions.done.includes("e1") && S.mode === "play" && S.test.missions.roaming && !S.modal; } });
  check(r.ok, `side: E1 by hand to the credits, then KEEP PLAYING goes on to free roam${r.ok ? "" : ": " + r.why}`);
  await page.evaluate((list) => { const K = __crimson.story.S.test.missions.K; for (const id of list) K.unlock(id); }, sideIds);
  for (const id of sideIds) {
    const at = await page.evaluate((id) => { const S = __crimson.story.S, d = S.test.missions.K.lookup(id); const p = d.kind === 'legend' ? S.world.place(d.at) : typeof d.at === 'string' ? S.world.place(d.at) : d.at; return { x: p.x, z: p.z, id }; }, id);
    await page.evaluate((at) => { __bot.cfg.roamTo = at; }, at);
    r = await play(page, { label: id, maxSec: MAXSEC || 900, shotsAt: [], done: new Function(`return () => { const S = __crimson.story.S; return S.test.missions.done.includes(${JSON.stringify(id)}) && !S.modal && !S.missions.active; }`)() });
    const nb = await page.evaluate(() => { const b = { notes: __bot.notes.slice(), fails: __bot.fails.slice() }; __bot.notes.length = 0; __bot.fails.length = 0; return b; });
    check(r.ok, `${id}: found in free roam and finished by hand in ${r.sec.toFixed(0)} s of game time${r.ok ? "" : ": " + r.why}`);
    for (const f of nb.fails) console.log(`     mission failed at ${f.step} (${f.t} s): ${f.reason}`);
    for (const n of nb.notes) console.log(`     note ${n.step} (${n.t} s): ${n.msg}`);
    if (!r.ok || VERBOSE) for (const l of r.log.slice(-30)) console.log("       " + l);
    if (SHOTS) { await page.evaluate(() => __crimson.step(1 / 60, true)); await shot(page, `${SHOTS}/${id}_end.png`); }
  }
  await page.evaluate(() => { __bot.cfg.roamTo = null; });
  if (errors.length) { check(false, `side: page errors: ${errors.slice(0, 3).join(" | ")}`); errs.push(...errors); }
  console.log(`     side: ${((Date.now() - t0) / 1000).toFixed(0)} s real`);
  await browser.close();
}
for (const id of ids.filter((x) => !SIDE.includes(x) && x !== "newstory" && x !== "fixes")) {
  const t0 = Date.now();
  const { browser, page, errors } = await setup(`?chapter=${id}&seed=7&nomusic`);
  const nx = T.CHAPTER_ORDER[T.CHAPTER_ORDER.indexOf(id) + 1] || null;
  await page.evaluate((c) => { __bot.cfg.choice = c; }, CHOICES[id] || 0);
  const done = nx ? new Function(`return () => __crimson.story.chapter === ${JSON.stringify(nx)}`)() : () => __crimson.story.mode === "credits" || __crimson.story.S.test.missions.done.includes("e1");
  const res = await play(page, { label: id, maxSec: MAXSEC || 900, shotsAt: [25, 120], done });
  const r = await page.evaluate(() => ({ notes: __bot.notes, fails: __bot.fails, card: __crimson.story.S.test.ui.card }));
  const inv = await invariants(page);
  if (SHOTS) { await page.evaluate(() => __crimson.step(1 / 60, true)); await shot(page, `${SHOTS}/${id}_end.png`); }
  check(res.ok, `${id}: finished by hand in ${res.sec.toFixed(0)} s of game time${res.ok ? "" : ": " + res.why}`);
  check(r.card !== "SOMETHING WENT WRONG.", `${id}: no error card`);
  check(!inv.length, `${id}: invariants hold${inv.length ? ": " + inv.join("; ") : ""}`);
  for (const f of r.fails) console.log(`     mission failed at ${f.step} (${f.t} s): ${f.reason}`);
  for (const n of r.notes) console.log(`     note ${n.step} (${n.t} s): ${n.msg}`);
  if (!res.ok || VERBOSE) for (const l of res.log.slice(-40)) console.log("       " + l);
  if (errors.length) { check(false, `${id}: page errors: ${errors.slice(0, 3).join(" | ")}`); errs.push(...errors); }
  console.log(`     ${id}: ${((Date.now() - t0) / 1000).toFixed(0)} s real`);
  await browser.close();
}
await finish("playthrough", fails, null, []);
