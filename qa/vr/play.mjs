// A bot plays In Full Swing in desktop mode through the G.test hooks and the real physics (one short run under the Quest
// emulator, IWER, checks the first clog with a controller). It walks the whole game: the tutorial by real actions, all 12
// clogs flushed with real yanks (and pumps below the threshold that do not count), the 80 Loonies flown through, the bank and
// its unlocks, one trial to the end (and the ring rules), the King (asleep, woken, wind-up, the line-of-sight rule, hits and
// dodges by the ball radius + hit radius rule, hearts, the deck), the three pipes, the finale, free roam, and the save after a
// reload. SHOTS=<dir> also saves pictures of a clog, a flush, the King and a trial ring.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/play.mjs
import { checker, watchdog, newPage, open, close, enterXR, waitState, freeze, frames, controller, lookQuat, SHOTS, sleep } from "./lib.mjs";
import { GAME, WORLD, SWING } from "../../public/vr/js/config.js";
import { generate } from "../../public/vr/js/city.js";

const { check, done } = checker("play");
watchdog(40 * 60 * 1000, "play");
const N = generate(WORLD.seed);
const OUT = process.env.SHOTS || "";
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

/* ---------------- page-side helpers ---------------- */
// Everything the bot does runs inside the page, in tight loops of G.test.step, so a check costs a few evaluate calls.
const HELPERS = () => {
  const b = (window.__b = {
    step(n, dt = 1 / 60) { for (let i = 0; i < n; i++) G.test.step(dt, 1); },
    // steps until f() is true; returns the steps it took, or -1
    until(f, max = 600, dt = 1 / 60) { for (let i = 0; i <= max; i++) { if (f()) return i; if (i < max) G.test.step(dt, 1); } return -1; },
    key(code, on) { window.dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { code })); },
    s: () => G.test.state(),
    g: () => G.game.info(),
    prog: () => G.game.progress,
    // aim and hold the trigger; returns the steps until the rope is attached, or -1
    // (a trigger that is still held from before would give no new press: let go first)
    fire(side, x, y, z) { G.test.press(side, false); b.step(1); G.test.aimAt(side, x, y, z); G.test.press(side, true); return b.until(() => G.test.state().ropes[side].state === "attached", 60); },
    let(side) { G.test.press(side, false); G.test.aimAt(side, null); b.step(2); },
    pump(side, v) { G.test.yank(side, v); b.step(1); b.step(30); },
    // a spot on the clog's roof with a clear line from the head to the bowl
    spot(c) {
      const S = 1.35, T = { x: c.x, y: c.y + 1.9 * S, z: c.z }, HIT = {};
      for (const r of [4.5, 6, 8, 10, 13]) for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        const tb = G.city.topBelow(x, c.y + 0.4, z, 0.3);
        if (!tb || Math.abs(tb.y - c.y) > 0.05) continue;
        if (G.city.collideSphere(x, c.y + 1.25, z, 0.5) || G.city.collideSphere(x, c.y + 0.5, z, 0.4)) continue;
        const dx = T.x - x, dy = T.y - (c.y + 1.65), dz = T.z - z, d = Math.hypot(dx, dy, dz);
        if (G.city.raycast(x, c.y + 1.65, z, dx, dy, dz, d - 0.7, HIT)) continue;
        return { x, y: c.y, z };
      }
      return null;
    },
    // the whole job on one clog: stand near it, shoot, pump three times
    flush(c) {
      const sp = b.spot(c);
      if (!sp) return "no spot";
      G.test.teleport(sp.x, sp.y, sp.z);
      b.step(3);
      const T = G.game.info().clogs; // (only to make sure the game is alive)
      const bowl = { x: c.x, y: c.y + 1.9 * 1.35, z: c.z };
      if (b.fire(1, bowl.x, bowl.y, bowl.z) < 0) return "no attach: aim " + JSON.stringify(G.test.aim(1)) + " rope " + JSON.stringify(G.test.state().ropes[1]) + " head " + JSON.stringify(G.test.state().head) + " spot " + JSON.stringify(sp) + " bowl " + JSON.stringify(bowl);
      if (G.test.state().ropes[1].tag !== "clog") return "attached to " + G.test.state().ropes[1].tag;
      for (let i = 0; i < 3 && !G.game.info().clogs[c.id].done; i++) b.pump(1, 3.2);
      b.let(1);
      return G.game.info().clogs[c.id].done ? "ok" : "not flushed";
    },
    // put the body somewhere with a velocity, in the air, without a teleport event
    place(x, y, z, vx = 0, vy = 0, vz = 0) {
      const P = G.P;
      P.pos.x = x; P.pos.y = y; P.pos.z = z; P.vel.x = vx; P.vel.y = vy; P.vel.z = vz; P.onGround = false; P.ground = null;
    },
    // hang in the air, held still (only the ropes run): a fixed target for the King
    hover(x, y, z) { G.test.teleport(x, y, z); G.P.frozen = true; b.step(2); },
    cam(pos, at, fov = 60) {
      const r = G.rig, c = G.camera;
      b.sv = { rp: r.position.clone(), rr: r.rotation.clone(), cp: c.position.clone(), cq: c.quaternion.clone(), fov: c.fov };
      r.position.set(0, 0, 0); r.rotation.set(0, 0, 0); r.updateMatrixWorld(true);
      c.position.set(...pos); c.lookAt(...at); c.fov = fov; c.updateProjectionMatrix();
    },
    uncam() { const s = b.sv, r = G.rig, c = G.camera; r.position.copy(s.rp); r.rotation.copy(s.rr); r.updateMatrixWorld(true); c.position.copy(s.cp); c.quaternion.copy(s.cq); c.fov = s.fov; c.updateProjectionMatrix(); },
    // a plain-object copy of the King's ball log
    balls: () => G.game.info().king.balls,
  });
  // spies: what the game asks of the view and the ui
  window.__spy = { finale: [], king: [], district: [], credits: 0, fades: [], toasts: [], lines: [], says: [] };
  const wrap = (o, k, f) => { const orig = o[k]; o[k] = (...a) => { f(...a); return orig.apply(o, a); }; };
  wrap(G.view, "setFinale", (v) => __spy.finale.push(v));
  wrap(G.view, "setKing", (v) => __spy.king.push(v));
  wrap(G.view, "setDistrictClog", (d, v) => __spy.district.push([d, v]));
  wrap(G.ui, "showCredits", () => { __spy.credits++; });
  wrap(G.ui, "fade", (to, secs, look) => __spy.fades.push([to, secs, look]));
  wrap(G.ui, "toast", (t) => __spy.toasts.push(t));
  wrap(G.ui, "sayLine", (g, i, k) => __spy.lines.push([g, i, k]));
  wrap(G.ui, "say", (t) => __spy.says.push(t));
};

const ev = (page, f, ...a) => page.evaluate(f, ...a);
async function snap(page, name, pos, at, fov = 60) {
  if (!OUT) return;
  await page.evaluate(([p, a, f]) => __b.cam(p, a, f), [pos, at, fov]);
  await sleep(2200);
  await page.screenshot({ path: OUT + "/" + name + ".png" });
  await page.evaluate(() => __b.uncam());
}

try {
  /* ---------------- boot ---------------- */
  const page = await newPage({ width: 640, height: 360 });
  await open(page, "?skipintro");
  await enterXR(page, "desktop");
  await waitState(page, { state: "play" }, 180000);
  await ev(page, HELPERS);
  await ev(page, () => G.test.hold(true));
  await ev(page, () => __b.until(() => G.viewDone, 400));
  const boot = await ev(page, () => ({ p: JSON.parse(JSON.stringify(G.game.progress)), vis: G.game.root.visible, info: G.game.info(), hearts: G.hands.info().hearts, calls: G.test.renderInfo().calls }));
  check(boot.vis && boot.info.started, "the game starts at the hand-off: the game root shows");
  check(boot.p.clogsTotal === 12 && boot.p.looniesTotal === 80 && boot.p.king === "sleeping" && boot.p.hearts === GAME.king.hearts && boot.p.clogs === 0 && boot.p.loonies === 0 && boot.p.bank === 0, "progress starts at 0/12 clogs, 0/80 Loonies, bank 0, the King asleep, 3 hearts", boot.p);
  check(boot.p.tutorial === 0 && boot.hearts === 3, "a first run starts the tutorial at step 0, and the launchers show 3 hearts", { t: boot.p.tutorial, hearts: boot.hearts });
  // the comic look gives some things an ink outline twin (named "...:outline", a second draw of the same shape): the budgets
  // count the things themselves, and the twins are counted apart, at most one per thing
  const meshes = await ev(page, () => {
    const cnt = (o) => { let n = 0; o.traverse((x) => { if (x.isMesh && !/:outline$/.test(x.name)) n++; }); return n; };
    const m = G.game.meshes, tw = m.outlines.map((o) => o.name);
    return { clogs: cnt(m.toilets) + cnt(m.fountains) + cnt(m.particles), coins: cnt(m.coins), rings: cnt(m.rings), beacons: cnt(m.beacons), king: cnt(m.king) + cnt(m.ball) + cnt(m.pipes), twins: tw, draws: G.game.info().draws };
  });
  check(meshes.clogs <= 4 && meshes.coins === 1 && meshes.rings === 1 && meshes.beacons === 1 && meshes.king <= 3, "the draw budgets hold: clogs 3 of 4, coins 1, rings 1, beacons 1, the King 3 of 3", meshes);
  check(meshes.twins.length <= 6 && new Set(meshes.twins).size === meshes.twins.length && meshes.twins.includes("toilets:outline") && meshes.twins.includes("loonies:outline"), "the ink outline twins are few: toilets, Loonies, pipes, the ball and the King, one each", meshes.twins);
  check(boot.info.model === "glb" && boot.info.king.visible, "the King is on the Needle from the start, built from king.glb", { model: boot.info.model, visible: boot.info.king.visible });
  const sleepy = await ev(page, () => { __b.step(150); return { g: G.game.info(), pos: G.game.meshes.king.position.toArray(), zzz: G.game.meshes.particles.visible }; });
  const perch = await ev(page, () => ({ x: G.view.perch.x, y: G.view.perch.y, z: G.view.perch.z }));
  check(sleepy.g.king.state === "sleeping" && sleepy.g.fx.live && Math.abs(sleepy.pos[0] - perch.x) < 0.01 && Math.abs(sleepy.pos[2] - perch.z) < 0.01, "the King sleeps on the perch and Z's rise from him", { pos: sleepy.pos, perch, fx: sleepy.g.fx });
  check(sleepy.g.king.throws === 0 && sleepy.g.king.ball === null, "a sleeping King throws nothing");
  const at = boot.info.pads;
  check(at.length === 3, "there are three trial start pads", at);

  /* ---------------- the tutorial by real actions ---------------- */
  // each step is done by its own event, not by the 30 s timeout: the step's clock stays under GAME.tutorialTimeout
  const R = N.goldRing;
  const gold = await ev(page, () => { const a = G.game.meshes.rings.geometry.attributes.aN.array; return a[3 * 4 + 3]; });
  check(gold === 3, "step 0 shows the gold ring marker on the tower in front of the start");
  const t0 = await ev(page, ([R]) => { const n = __b.fire(1, R.x, R.y, R.z); return { n, p: __b.prog().tutorial, ring: G.test.state().ropes[1].anchor.y }; }, [R]);
  check(t0.p === 1 && t0.n >= 0 && t0.ring - (N.start.y + 1.25) >= 10, "step 0 is done by an attach 10 m or more above the chest", t0);
  const gone = await ev(page, () => G.game.meshes.rings.geometry.attributes.aN.array[3 * 4 + 3]);
  check(gone === 0, "the gold ring marker goes away after step 0");
  // step 1: run to the roof edge, jump, and let go at speed
  const t1 = await ev(page, () => {
    __b.key("KeyW", true);
    __b.until(() => G.test.state().pos.z > 79.5, 400);
    __b.key("Space", true); __b.step(2); __b.key("Space", false);
    const n = __b.until(() => { const s = G.test.state(); return !s.onGround && Math.hypot(s.vel.x, s.vel.y, s.vel.z) >= 8.5; }, 400);
    __b.key("KeyW", false);
    const sp = Math.hypot(G.P.vel.x, G.P.vel.y, G.P.vel.z);
    G.test.press(1, false); G.test.aimAt(1, null); __b.step(2);
    return { n, sp, p: __b.prog().tutorial, tut: G.game.info().tutorial };
  });
  check(t1.n >= 0 && t1.p === 2, "step 1 is done by a detach at 8 m/s or more", t1);
  // step 2: shoot again in the air
  const t2 = await ev(page, ([R]) => { const air = !G.P.onGround; const n = __b.fire(0, R.x, R.y, R.z); return { air, n, p: __b.prog().tutorial }; }, [R]);
  check(t2.air && t2.n >= 0 && t2.p === 3, "step 2 is done by an attach while airborne", t2);
  // step 3: reel 8 m in all
  const t3 = await ev(page, () => { G.test.grip(0, 1); const n = __b.until(() => __b.prog().tutorial !== 3, 200); G.test.grip(0, null); return { n, p: __b.prog().tutorial, reel: G.game.info().tutorial.reel }; });
  check(t3.n >= 0 && t3.p === 4, "step 3 is done by reeling the rope in 8 m", t3);
  // step 4: a yank on a normal target
  const t4 = await ev(page, () => { G.test.yank(0, 3); __b.step(2); return { p: __b.prog().tutorial }; });
  check(t4.p === 5, "step 4 is done by the first yank on a normal target", t4);
  const p4 = await ev(page, () => ({ t: G.game.info().tutorial.t }));
  // step 5: turn
  const t5 = await ev(page, () => { const before = __b.prog().tutorial; G.rigYaw += 0.5; __b.step(3); return { before, p: __b.prog().tutorial }; });
  check(t5.before === 5 && t5.p === 6, "step 5 is done by the first turn", t5);
  // step 6: the HUD (in flat play it is on the screen: two seconds)
  const t6 = await ev(page, () => { const n = __b.until(() => __b.prog().tutorial !== 6, 400); return { n, p: __b.prog().tutorial, says: __spy.says.slice(-1)[0] }; });
  check(t6.p === 7 && t6.n < GAME.tutorialTimeout * 60 - 60, "step 6 is done by the HUD being shown, not by the timeout", t6);
  const lines = await ev(page, () => __spy.lines.filter((l) => l[0] === "tutorial").map((l) => l[1]));
  // (the spies start after the hand-off, so step 0's line was said before them)
  const seq = [...new Set(lines)];
  check(seq.slice(-7).join(",") === "1,2,3,4,5,6,7", "every tutorial step said its line, in order, by input kind", { seq, kind: await ev(page, () => __spy.lines.find((l) => l[0] === "tutorial")[2]) });
  await ev(page, () => { __b.let(0); __b.let(1); });

  /* ---------------- the first clog: pumps, the flush, the bank ---------------- */
  const c6 = N.clogs.find((c) => c.id === 6);
  const sp6 = await ev(page, ([c]) => __b.spot(c), [c6]);
  check(!!sp6, "a spot on the first clog's roof with a clear line to the bowl", sp6);
  await ev(page, ([sp]) => { G.test.teleport(sp.x, sp.y, sp.z); __b.step(3); }, [sp6]);
  const bowl6 = { x: c6.x, y: c6.y + 1.9 * 1.35, z: c6.z };
  await ev(page, () => __b.until(() => G.viewDone, 400));
  await snap(page, "clog", [c6.x + 7, c6.y + 3.2, c6.z + 10], [c6.x, c6.y + 3.2, c6.z], 60);
  const att = await ev(page, ([b]) => { const n = __b.fire(1, b.x, b.y, b.z); const r = G.test.state().ropes[1]; return { n, tag: r.tag, id: r.id, aim: G.test.aim(1) }; }, [bowl6]);
  check(att.n >= 0 && att.tag === "clog" && att.id === "clog:6", "a rope shot at the clog attaches to the special target clog:6", att);
  // pumps below the threshold do not count: a pull of 1.6 m/s is 0.4 over the yank threshold, under GAME.pumpMin
  const weak = await ev(page, () => { G.test.yank(1, 1.6); __b.step(1); const e = G.test.events().filter((x) => x.type === "yank").pop(); __b.step(30); return { e, c: G.game.info().clogs[6].pumps }; });
  check(weak.e && weak.e.pump === false && weak.c === 0, "a yank below pumpMin is not a pump", weak);
  const ok1 = await ev(page, () => { G.test.yank(1, 3.2); __b.step(1); const e = G.test.events().filter((x) => x.type === "yank").pop(); __b.step(30); return { e, c: G.game.info().clogs[6].pumps, tint: __spy.district.slice(-1)[0] }; });
  check(ok1.e && ok1.e.pump === true && ok1.c === 1, "a pull over pumpMin is one pump", ok1);
  await ev(page, () => { __b.pump(1, 3.2); });
  const pre = await ev(page, () => ({ c: G.game.info().clogs[6], loon: G.game.progress.loonies, bank: G.game.progress.bank, sl: G.save.loonies.length, tut: G.save.tutorial, tt: G.game.progress.tutorial }));
  check(pre.c.pumps === 2 && !pre.c.done && pre.bank === 0, "two pumps do not flush", pre);
  await snap(page, "pump", [c6.x + 7, c6.y + 3.2, c6.z + 10], [c6.x, c6.y + 3.4, c6.z], 60);
  // the third pump flushes: sparkles, the rope lets go, the target goes, the district clears, the bonus goes to the bank
  await ev(page, () => { G.test.yank(1, 3.2); __b.step(1); });
  await ev(page, () => __b.step(20));
  await snap(page, "flush", [c6.x + 12, c6.y + 2.5, c6.z + 15], [c6.x, c6.y + 6, c6.z], 60);
  const post = await ev(page, () => {
    __b.step(30);
    return { c: G.game.info().clogs[6], p: JSON.parse(JSON.stringify(G.game.progress)), ropeState: G.test.state().ropes[1].state, target: G.ropes.targets().some((t) => t.id === "clog:6"), save: JSON.parse(localStorage.getItem("plungerd.vr.v1")), spy: __spy.district.slice(-1)[0], fx: G.game.info().fx.live, stripe: G.ropes.info().stripe };
  });
  check(post.c.done && post.p.clogs === 1 && post.ropeState === "idle" && !post.target, "the third pump flushes: the rope lets go and the target is removed", { c: post.c, rope: post.ropeState, target: post.target });
  check(post.p.bank === GAME.looniesPerFlush && post.p.loonies === 0 && post.save.bonus === GAME.looniesPerFlush && post.save.loonies.length === 0, "the flush bonus goes to the bank and not to the x/80 Loonie count", { p: post.p, save: post.save });
  check(post.save.clogs.includes(6) && post.save.tutorial === true && post.p.tutorial === -1, "the flush autosaves, and the first flush ends the tutorial (save.tutorial)", { clogs: post.save.clogs, tutorial: post.save.tutorial, step: post.p.tutorial });
  check(post.spy && post.spy[0] === c6.district && post.spy[1] === 0.5, "view.setDistrictClog gets the district's clean share (1 of 2 left)", post.spy);

  /* ---------------- 11 clogs, one by one, with real yanks (the 12th wakes the King, so it waits) ---------------- */
  const last = N.clogs.find((c) => c.id === 5);
  const results = {};
  for (const c of N.clogs) {
    if (c.id === 6 || c.id === last.id) continue;
    results[c.id] = await ev(page, ([c]) => __b.flush(c), [c]);
  }
  const bad = Object.entries(results).filter(([, v]) => v !== "ok"); 
  const all = await ev(page, () => ({ p: JSON.parse(JSON.stringify(G.game.progress)), tints: __spy.district.slice(-6), save: JSON.parse(localStorage.getItem("plungerd.vr.v1")) }));
  check(bad.length === 0 && all.p.clogs === 11, "11 clogs flush with real shots and pumps (all but the last)", { bad, clogs: all.p.clogs });
  check(all.p.bank === 55 && all.p.loonies === 0 && all.save.bonus === 55, "the 11 flushes put 55 bonus Loonies in the bank (x/80 still 0)", { bank: all.p.bank });
  await ev(page, () => __b.let(1));

  /* ---------------- Loonies: fly through them ---------------- */
  // the bank is 55: the gold stripe (30) is unlocked, the golden cup (60) is not
  const ropes55 = await ev(page, () => ({ st: G.ropes.info().stripe, cup: G.ropes.info().goldCup, gold: G.hands.info().gold, toasts: __spy.toasts.slice() }));
  check(ropes55.st === 1 && ropes55.cup === 0 && ropes55.gold === 0, "bank 55 has unlocked the gold stripe only", ropes55);
  // a coin 4 m off the flight line is not collected; one in the way is
  const first = N.loonies[0];
  const miss = await ev(page, ([L]) => {
    __b.place(L.x + 6, L.y - 1.25, L.z - 8, 0, 0, 10);
    __b.step(40);
    return G.game.progress.loonies;
  }, [first]);
  check(miss === 0, "a coin 6 m off your line is not collected");
  const flown = await ev(page, () => {
    const HIT = {}, out = { flown: 0, teleported: 0, got: 0 };
    const dirs = [];
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; dirs.push([Math.cos(a), Math.sin(a)]); }
    for (const L of G.city.loonies) {
      if (G.game.progress.loonies >= 80) break;
      const have = () => G.save.loonies.includes(L.id);
      if (have()) continue;
      let ok = false;
      for (const [dx, dz] of dirs) {
        const sx = L.x - dx * 4, sz = L.z - dz * 4;
        if (G.city.raycast(sx, L.y, sz, dx, 0, dz, 3.6, HIT)) continue;
        if (G.city.collideSphere(sx, L.y, sz, 0.4)) continue;
        __b.place(sx, L.y - G.P.chest, sz, dx * 14, 0, dz * 14);
        __b.until(have, 30);
        if (have()) { ok = true; out.flown++; break; }
      }
      if (!ok) { __b.place(L.x, L.y - G.P.chest, L.z, 0, 0, 0); __b.step(2); if (have()) out.teleported++; }
    }
    out.got = G.game.progress.loonies;
    G.test.teleport(G.city.start.x, G.city.start.y, G.city.start.z); __b.step(3);
    return out;
  });
  check(flown.got === 80 && flown.flown >= 60, "80 of 80 Loonies collected, flying through them (" + flown.flown + " flown, " + flown.teleported + " placed)", flown);
  const fin = await ev(page, () => ({ p: JSON.parse(JSON.stringify(G.game.progress)), save: JSON.parse(localStorage.getItem("plungerd.vr.v1")), gold: G.hands.info().gold, toasts: __spy.toasts.slice() }));
  check(fin.p.loonies === 80 && fin.p.bank === 135 && fin.save.loonies.length === 80, "80 Loonies + 55 bonus make a bank of 135", fin.p);
  check(fin.gold === 1 && fin.toasts.some((t) => /100/.test(t)) && fin.toasts.some((t) => /30/.test(t)) && fin.toasts.some((t) => /60/.test(t)), "the unlocks at 30, 60 and 100 said so, and the launchers are golden at 100", fin.toasts);

  /* ---------------- a trial to the end ---------------- */
  const tr = N.trials[0]; // Harbour Loop
  const pads = await ev(page, () => G.game.meshes.rings.geometry.attributes.aN.array.slice(6 * 4, 9 * 4));
  check(pads[3] === 4 && pads[7] === 4 && pads[11] === 5, "the pads glow, and Needle Drop's is the Intense one (orange)", Array.from(pads));
  await ev(page, ([t]) => { G.test.teleport(t.start.x, t.start.y, t.start.z); __b.step(30); }, [tr]);
  const half = await ev(page, () => ({ t: G.game.progress.trial, hold: G.game.info().pads[0].hold }));
  check(half.t === null && half.hold > 0.4 && half.hold < 0.6, "standing on a pad charges it (0.5 s of 1 s)", half);
  const st = await ev(page, () => { __b.step(45); return { t: G.game.progress.trial, i: G.game.info().trial }; });
  check(st.t && st.t.id === tr.id && st.t.ring === 0, "standing in the pad for 1 s starts the trial", st);
  const shown = await ev(page, () => { const a = G.game.meshes.rings.geometry.attributes; return [0, 1, 2, 3].map((k) => ({ st: a.aN.array[k * 4 + 3], x: a.aC.array[k * 4] })); });
  check(shown[0].st === 1 && shown[1].st === 2 && shown[2].st === 2 && shown[3].st !== 1 && shown[3].st !== 2 && near(shown[0].x, tr.rings[0].x, 1e-3) && near(shown[2].x, tr.rings[2].x, 1e-3), "only the next 3 rings show (the next one bright)", shown);
  await snap(page, "ring", [tr.rings[0].x - 30, tr.rings[0].y + 2, tr.rings[0].z + 8], [tr.rings[0].x, tr.rings[0].y, tr.rings[0].z], 60);
  // the rules: a pass 7 m off the centre (ring r is 5) does not count; the ring after the next one does not count either
  const rules = await ev(page, ([r0, r1]) => {
    const fly = (r, off) => {
      // through the ring plane along its normal, with a sideways offset in metres
      const px = -r.nz, pz = r.nx, pl = Math.hypot(px, pz) || 1;
      __b.place(r.x - r.nx * 5 + (px / pl) * off, r.y - r.ny * 5 - G.P.chest, r.z - r.nz * 5 + (pz / pl) * off, r.nx * 20, r.ny * 20, r.nz * 20);
      __b.step(30);
      return G.game.progress.trial ? G.game.progress.trial.ring : -1;
    };
    return { off: fly(r0, 7), skip: fly(r1, 0) };
  }, [tr.rings[0], tr.rings[1]]);
  check(rules.off === 0 && rules.skip === 0, "a pass 7 m off the middle does not count, and neither does a ring out of order", rules);
  const times = await ev(page, ([rings]) => {
    const seen = [];
    for (let k = 0; k < rings.length; k++) {
      const r = rings[k];
      __b.place(r.x - r.nx * 5, r.y - r.ny * 5 - G.P.chest, r.z - r.nz * 5, r.nx * 20, r.ny * 20, r.nz * 20);
      __b.step(30);
      seen.push(G.game.progress.trial ? G.game.progress.trial.ring : -1);
    }
    return seen;
  }, [tr.rings]);
  const rest = await ev(page, () => ({ p: G.game.progress.trial, save: JSON.parse(localStorage.getItem("plungerd.vr.v1")).best, toast: __spy.toasts.slice(-1)[0] }));
  check(times.slice(0, -1).every((v, k) => v === k + 1) && rest.p === null, "flying through all " + tr.rings.length + " rings in order finishes the trial", { times, p: rest.p });
  check(rest.save && rest.save[String(tr.id)] > 0 && rest.save[String(tr.id)] < 30, "the best time is saved", rest.save);
  check(/Harbour Loop/.test(rest.toast || ""), "the result shows as a toast", rest.toast);
  // cancel from the pause menu
  const cn = await ev(page, ([t]) => {
    G.test.teleport(t.start.x, t.start.y, t.start.z); __b.step(90);
    const a = !!G.game.progress.trial;
    G.game.cancelTrial(); __b.step(2);
    return { a, b: G.game.progress.trial };
  }, [N.trials[1]]);
  check(cn.a && cn.b === null, "cancelTrial ends a running trial", cn);

  /* ---------------- the last clog wakes the King ---------------- */
  const wkPre = await ev(page, () => ({ king: G.game.progress.king, throws: G.game.info().king.throws }));
  check(wkPre.king === "sleeping", "11 clogs and the King still sleeps", wkPre);
  const lastRes = await ev(page, ([c]) => __b.flush(c), [last]);
  check(lastRes === "ok", "the 12th clog flushes", lastRes);
  const wk = await ev(page, () => ({ king: G.game.progress.king, save: G.save.king, state: G.game.info().king.state, spy: __spy.king.slice(), lines: __spy.lines.filter((l) => l[0] === "king").map((l) => l[1]), bank: G.game.progress.bank, toasts: __spy.toasts.slice() }));
  check(wk.king === "sleeping" && wk.state === "sleeping" && wk.lines.includes(0), "the 12th flush says so, and he wakes only after a moment", wk);
  check(wk.bank === 140 && wk.toasts.some((t) => /140/.test(t)), "the bank reaches 140 and the fireworks unlock says so", { bank: wk.bank });
  await ev(page, () => { __b.step(300); });
  const aw = await ev(page, () => ({ king: G.game.progress.king, save: G.save.king, state: G.game.info().king.state, spy: __spy.king.slice(), lines: __spy.lines.filter((l) => l[0] === "king").map((l) => l[1]), targets: G.ropes.targets().map((t) => t.id) }));
  check(aw.king === "awake" && aw.save === "awake" && aw.spy.includes(1) && aw.lines.includes(0) && aw.lines.includes(1), "12 clogs wake the King: the pod glows (setKing 1), the lines are said, save.king is awake", aw);
  check(["pipe:0", "pipe:1", "pipe:2"].every((id) => aw.targets.includes(id)), "the three pipes become special targets", aw.targets);
  const reacts = await ev(page, () => __spy.lines.filter((l) => l[0] === "king" && (l[1] === 4 || l[1] === 5)).length);
  check(reacts >= 2, "the King reacted at 4 and 8 flushes (two lines)", reacts);
  await snap(page, "king-awake", [perch.x, perch.y + 9, perch.z - 45], [perch.x, perch.y + 8, perch.z], 55);

  /* ---------------- the King throws: line of sight, hits, dodges ---------------- */
  const M = await ev(page, () => G.game.info().king.mouth);
  const spot = { x: M[0], y: M[1] - 8, z: M[2] - 38 };
  await ev(page, ([s]) => { G.flags.god = false; __b.hover(s.x, s.y, s.z); }, [spot]);
  // 1) never without a line of sight: hang behind the pod, on the deck
  const deck = await ev(page, () => G.game.info().deck);
  await ev(page, ([d]) => { __b.hover(d.x, d.y, d.z); __b.step(60 * 30); }, [deck]);
  const blind = await ev(page, () => ({ k: G.game.info().king, hearts: G.game.progress.hearts }));
  check(blind.k.throws === 0 && blind.k.ball === null && blind.hearts === 3, "no throw in 30 s while you hang on the deck, out of his sight", { throws: blind.k.throws, windT: blind.k.windT });
  // 2) in the open: a wind-up, then a ball, at most one at a time
  await ev(page, ([s]) => { __b.hover(s.x, s.y, s.z); }, [spot]);
  const seen = await ev(page, () => {
    const out = { wind: false, maxBalls: 0, throws: [], steps: 0 };
    for (let i = 0; i < 60 * 20 && G.game.info().king.throws < 1; i++) {
      __b.step(1);
      const k = G.game.info().king;
      if (k.windT > 0) out.wind = true;
      out.steps = i;
    }
    return out;
  });
  const th1 = await ev(page, () => G.game.info().king);
  check(seen.wind && th1.throws === 1 && th1.balls[0].los === true, "in the open he winds up for a second, then throws once", { wind: seen.wind, throws: th1.throws });
  check(th1.balls[0].dist > 30 && th1.ball && th1.ball.cosmetic === false, "the ball is in flight and is not a show lob", th1.ball);
  const rec = th1.balls[0];
  // the same line-of-sight test, made independently, for every throw so far
  const los = await ev(page, ([r]) => { const h = {}; const d = [r.to[0] - r.from[0], r.to[1] - r.from[1], r.to[2] - r.from[2]]; const l = Math.hypot(...d); return !G.city.raycast(r.from[0], r.from[1], r.from[2], d[0], d[1], d[2], l - 0.4, h); }, [rec]);
  check(los, "the first throw had a clear line from the King to the chest");
  // 3) a hit: stand still. the ball comes within ballRadius + hitRadius; a heart goes; a splat; grace
  const hit = await ev(page, () => {
    const n = __b.until(() => G.game.info().king.hits >= 1, 60 * 12);
    const k = G.game.info().king;
    return { n, hits: k.hits, hearts: G.game.progress.hearts, rec: k.balls[0], lamps: G.hands.info().hearts, grace: k.grace, splat: G.game.meshes.splat.visible };
  });
  check(hit.hits === 1 && hit.hearts === GAME.king.hearts - 1 && hit.lamps === hit.hearts, "the ball hits: one heart goes, and the launchers show " + hit.lamps, hit);
  check(hit.rec.hit && hit.rec.minDist <= GAME.king.ballRadius + GAME.king.hitRadius, "a hit needs the ball within ballRadius + hitRadius (" + hit.rec.minDist + " m)", hit.rec);
  check(hit.splat && hit.grace > 2.5, "a splat covers the view edge and the King waits out the grace time", { splat: hit.splat, grace: hit.grace });
  // 4) the ball that follows is thrown only after the grace time; step aside right after it leaves. The ball's path is fixed
  // at the throw (no lead), so a step of 1.3 m (beyond ballRadius + hitRadius = 0.8 m) dodges it, and 0.5 m still hits.
  const tHit = await ev(page, () => G.time);
  await ev(page, () => __b.until(() => !G.game.info().king.ball, 60 * 20));
  const side = async (off, label, wantHit) => {
    const n0 = await ev(page, () => G.game.info().king.throws);
    const w = await ev(page, ([n]) => { const k = __b.until(() => G.game.info().king.throws > n, 60 * 40); return { k, t: G.time }; }, [n0]);
    const before = await ev(page, () => ({ hits: G.game.info().king.hits, throws: G.game.info().king.throws, hearts: G.game.progress.hearts }));
    await ev(page, ([off]) => {
      const r = G.game.info().king.balls.slice(-1)[0], dx = r.to[0] - r.from[0], dz = r.to[2] - r.from[2], l = Math.hypot(dx, dz);
      const px = -dz / l, pz = dx / l, s = G.test.state().pos;
      G.test.teleport(s.x + px * off, s.y, s.z + pz * off); G.P.frozen = true;
    }, [off]);
    const res = await ev(page, () => { __b.until(() => !G.game.info().king.ball, 60 * 20); const k = G.game.info().king; return { hits: k.hits, hearts: G.game.progress.hearts, rec: k.balls[k.balls.length - 1] }; });
    const got = res.hits > before.hits;
    check(got === wantHit && (wantHit ? res.rec.minDist <= 0.8 : res.rec.minDist > 0.8), label, { off, res, before });
    return { w, res };
  };
  const d1 = await side(1.3, "1.3 m to the side dodges the ball (it passes at more than 0.8 m)", false);
  check(d1.w.t - tHit >= GAME.king.grace + GAME.king.windUp - 0.1, "no throw within the grace time after a hit (" + (d1.w.t - tHit).toFixed(1) + " s)", { dt: d1.w.t - tHit });
  const d2 = await side(0.5, "0.5 m to the side still hits (within 0.8 m)", true);
  check(d2.res.hearts === 1, "the second hit leaves one heart", d2.res.hearts);
  // never more than one ball at a time: every throw ended before the next
  const one = await ev(page, () => G.game.info().king.balls.every((b, i, a) => i === 0 || (a[i - 1].ended && b.t >= a[i - 1].t)));
  check(one, "at most one ball is in flight: every ball ended before the next throw");
  // 5) ?god: the ball hits but no heart goes
  await ev(page, () => { G.flags.god = true; });
  const gh = await ev(page, () => { const h0 = G.game.info().king.hits, hp = G.game.progress.hearts; __b.until(() => G.game.info().king.hits > h0, 60 * 25); return { h0, hits: G.game.info().king.hits, hp0: hp, hp: G.game.progress.hearts }; });
  check(gh.hits > gh.h0 && gh.hp === gh.hp0, "?god: the ball hits and no heart is lost", gh);
  await ev(page, () => { G.flags.god = false; });
  // 6) zero hearts: fade, the deck, full hearts
  const zero = await ev(page, () => {
    __b.until(() => G.game.progress.hearts <= 0 || G.game.info().king.respawn > 0, 60 * 90);
    const fadeOut = __spy.fades.slice(-1)[0];
    const rs = G.game.info().king.respawn;
    __b.step(60);
    const pos = G.test.state().pos, d = G.game.info().deck;
    return { rs, fadeOut, hearts: G.game.progress.hearts, pos, deck: d, lamps: G.hands.info().hearts, fades: __spy.fades.slice(-2) };
  });
  check(zero.rs > 0 || zero.hearts === 3, "at zero hearts he stops and the view fades", zero);
  check(Math.hypot(zero.pos.x - zero.deck.x, zero.pos.z - zero.deck.z) < 0.5 && Math.abs(zero.pos.y - zero.deck.y) < 0.5 && zero.hearts === 3 && zero.lamps === 3, "then you are on the Needle deck with 3 hearts", zero);

  /* ---------------- the pipes ---------------- */
  const tips = await ev(page, () => G.game.info().pipes.map((p) => p.tip));
  const pipeSpots = N.needle.pipes.map((p, i) => ({ id: p.id, tip: tips[i], n: [p.nx, p.ny, p.nz] }));
  // the normal rule: from the side (90° off the normal) the pipe does not take a cup; from the front it does
  const nr = await ev(page, ([p]) => {
    const px = -p.n[2], pz = p.n[0], l = Math.hypot(px, pz);
    G.flags.god = true;
    __b.hover(p.tip[0] + (px / l) * 30, p.tip[1], p.tip[2] + (pz / l) * 30);
    G.test.aimAt(1, p.tip[0], p.tip[1], p.tip[2]); __b.step(2);
    const side = G.test.aim(1);
    __b.hover(p.tip[0] + p.n[0] * 30, p.tip[1] + p.n[1] * 30, p.tip[2] + p.n[2] * 30);
    G.test.aimAt(1, p.tip[0], p.tip[1], p.tip[2]); __b.step(2);
    const front = G.test.aim(1);
    G.test.aimAt(1, null);
    return { side: side && side.id, front: front && front.id };
  }, [pipeSpots[0]]);
  check(nr.side !== "pipe:0" && nr.front === "pipe:0", "a pipe takes a cup from the front, not from 90° off its normal", nr);
  // rip the first pipe after one hit: the hearts refill
  await ev(page, () => { G.flags.god = false; });
  const p0 = pipeSpots[0];
  await ev(page, ([p]) => __b.hover(p.tip[0] + p.n[0] * 34, p.tip[1] + p.n[1] * 34 - 6, p.tip[2] + p.n[2] * 34), [p0]);
  const hurt = await ev(page, () => { __b.until(() => G.game.progress.hearts < 3, 60 * 40); return G.game.progress.hearts; });
  check(hurt < 3, "a ball took a heart before the pipe (" + hurt + " left)", hurt);
  const rip0 = await ev(page, ([p]) => {
    const n = __b.fire(1, p.tip[0], p.tip[1], p.tip[2]);
    const tag = G.test.state().ropes[1].tag;
    __b.pump(1, 3.2); __b.pump(1, 3.2);
    const two = G.game.info().pipes[0];
    __b.pump(1, 3.2);
    __b.let(1);
    return { n, tag, two, after: G.game.info().pipes[0], hearts: G.game.progress.hearts, lamps: G.hands.info().hearts, rope: G.test.state().ropes[1].state, target: G.ropes.targets().some((t) => t.id === "pipe:0"), save: G.save.pipes.slice() };
  }, [p0]);
  check(rip0.tag === "pipe" && rip0.two.pumps === 2 && !rip0.two.ripped && rip0.after.ripped, "three pumps rip a pipe off (two do not)", rip0);
  check(rip0.hearts === 3 && rip0.lamps === 3, "the hearts refill when a pipe comes off", { hearts: rip0.hearts });
  check(rip0.rope === "idle" && !rip0.target && rip0.save.includes(0), "the rope lets go, the pipe is no longer a target, and it is saved", rip0);
  const tum = await ev(page, () => { __b.step(60 * 3); return G.game.info().pipes[0].ripped; });
  await ev(page, () => { G.flags.god = true; });
  for (const p of pipeSpots.slice(1)) {
    const r = await ev(page, ([p]) => {
      __b.hover(p.tip[0] + p.n[0] * 30, p.tip[1] + p.n[1] * 30, p.tip[2] + p.n[2] * 30);
      const n = __b.fire(1, p.tip[0], p.tip[1], p.tip[2]);
      __b.pump(1, 3.2); __b.pump(1, 3.2); __b.pump(1, 3.2);
      __b.let(1);
      return { n, ripped: G.game.info().pipes[p.id].ripped };
    }, [p]);
    check(r.n >= 0 && r.ripped, "pipe " + p.id + " comes off with three pumps", r);
  }

  /* ---------------- the finale and free roam ---------------- */
  const f0 = await ev(page, () => ({ king: G.game.progress.king, save: G.save.king, fin: G.game.info().finale, spy: __spy.finale.slice(), credits: __spy.credits }));
  check(f0.king === "beaten" && f0.save === "beaten" && f0.fin.on, "the third pipe cracks the King: beaten, saved, the finale runs", f0);
  await ev(page, () => { __b.step(60 * 3); });
  await snap(page, "king-flush", [perch.x, perch.y + 12, perch.z - 45], [perch.x, perch.y + 8, perch.z], 60);
  await ev(page, () => { __b.step(60 * 4); });
  const fw = await ev(page, () => {
    const a = G.game.meshes.particles.geometry.attributes, n = a.aA.count;
    let sparks = 0;
    for (let i = 0; i < n; i++) if (a.aD.array[i * 4] === 3 && a.aA.array[i * 4 + 3] < 1e8) sparks++;
    return { sparks, finale: __spy.finale.slice(-1)[0], credits: __spy.credits, ballVis: G.game.meshes.ball.visible };
  });
  check(fw.sparks >= 100 && fw.finale === 1, "fireworks go up over the lake and the whole city warms (setFinale 1)", fw);
  await snap(page, "fireworks", [N.needle.x, 262, 250], [N.needle.x, 190, 480], 75);
  await ev(page, () => { __b.step(60 * 4); });
  // the credits panel comes at 10.4 s; on a flat screen it pauses the game until "Keep swinging"
  const cr = await ev(page, () => ({ credits: __spy.credits, panel: G.test.ui().panel, state: G.state, fin: G.game.info().finale.on }));
  check(cr.credits === 1 && cr.panel === "credits", "the credits panel shows after the fireworks", cr);
  await ev(page, () => { G.test.uiPress("credits:keep"); __b.step(120); });
  const f1 = await ev(page, () => ({ credits: __spy.credits, fin: G.game.info().finale, king: G.game.info().king, state: G.state }));
  check(f1.credits === 1 && !f1.fin.on && f1.state === "play", "the credits show once, and the game goes on in free roam", f1);
  check(f1.king.state === "gone" && f1.king.visible === false, "the flushed King is gone from the Needle");
  const roam = await ev(page, () => {
    G.P.frozen = false; G.flags.god = false;
    G.test.teleport(G.city.start.x, G.city.start.y, G.city.start.z); __b.step(60 * 20);
    return { p: G.game.progress.king, hearts: G.game.progress.hearts, throws: G.game.info().king.throws, throwsBefore: 0, pos: G.test.state().pos };
  });
  check(roam.p === "beaten" && roam.hearts === 3, "free roam: the King stays beaten, you keep your hearts", roam);

  /* ---------------- the save survives a reload ---------------- */
  const saved = await ev(page, () => ({ raw: JSON.parse(localStorage.getItem("plungerd.vr.v1")), p: JSON.parse(JSON.stringify(G.game.progress)) }));
  await page.reload();
  await page.waitForFunction(() => window.G && window.G.ready, null, { timeout: 180000, polling: 100 });
  await enterXR(page, "desktop");
  await waitState(page, { state: "play" }, 180000);
  await ev(page, HELPERS);
  await ev(page, () => { G.test.hold(true); __b.step(5); });
  const back = await ev(page, () => ({ p: JSON.parse(JSON.stringify(G.game.progress)), info: G.game.info(), save: G.save, stripe: G.ropes.info().stripe, gold: G.hands.info().gold, ring: G.game.meshes.rings.geometry.attributes.aN.array[3 * 4 + 3], targets: G.ropes.targets().map((t) => t.id) }));
  check(back.p.clogs === 12 && back.p.loonies === 80 && back.p.bank === 140 && back.p.king === "beaten" && back.p.tutorial === -1, "after a reload the progress is back: 12 clogs, 80 Loonies, bank 140, the King beaten, no tutorial", back.p);
  check(back.stripe === 1 && back.gold === 1 && back.info.clogs.every((c) => c.done) && back.info.pipes.every((p) => p.ripped) && back.targets.length === 0, "the unlocks, the flushed toilets and the ripped pipes are back too", { stripe: back.stripe, gold: back.gold, targets: back.targets });
  check(back.save.best[String(tr.id)] === saved.raw.best[String(tr.id)] && back.save.best[String(tr.id)] > 0 && back.info.king.visible === false, "the best time survives, and the King is not on the Needle", back.save.best);
  check(back.info.finale.on === false, "no finale replays after a reload");

  check(page.errors.length === 0, "no page errors during the whole run", page.errors);

  /* ---------------- one short run under the Quest emulator ---------------- */
  const vr = await newPage({ width: 480, height: 270, clock: true });
  await open(vr, "?emulate&skipintro");
  await enterXR(vr, "vr");
  await waitState(vr, { state: "play" }, 180000);
  await freeze(vr);
  await frames(vr, 2);
  const spv = await vr.evaluate(([c]) => {
    const S = 1.35, HIT = {}, T = { x: c.x, y: c.y + 1.9 * S, z: c.z };
    for (const r of [4.5, 6, 8, 10]) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const tb = G.city.topBelow(x, c.y + 0.4, z, 0.3);
      if (!tb || Math.abs(tb.y - c.y) > 0.05 || G.city.collideSphere(x, c.y + 1.25, z, 0.5)) continue;
      const d = Math.hypot(T.x - x, T.y - c.y - 1.65, T.z - z);
      if (G.city.raycast(x, c.y + 1.65, z, T.x - x, T.y - c.y - 1.65, T.z - z, d - 0.7, HIT)) continue;
      return { x, y: c.y, z, T };
    }
    return null;
  }, [c6]);
  await vr.evaluate((s) => G.test.teleport(s.x, s.y, s.z), spv);
  await frames(vr, 4);
  // aim the right controller at the bowl (tracking space), pull the trigger, then three yanks
  const aim = await vr.evaluate((s) => { const hd = G.test.state().headLocal, t = G.test.toLocal(s.T.x, s.T.y, s.T.z); return { hd, t }; }, spv);
  const d = [aim.t.x - aim.hd.x, aim.t.y - (aim.hd.y - 0.2), aim.t.z - aim.hd.z];
  await controller(vr, "right", { pos: [aim.hd.x + 0.2, aim.hd.y - 0.2, aim.hd.z], quat: lookQuat(d), trigger: 1 });
  await frames(vr, 6);
  const vs = await vr.evaluate(() => G.test.state().ropes[1]);
  check(vs.state === "attached" && vs.tag === "clog", "under the Quest emulator a controller shot attaches to the clog", vs);
  for (let i = 0; i < 3; i++) {
    await vr.evaluate(() => G.test.yank(1, 3.4));
    await frames(vr, 32);
  }
  const vf = await vr.evaluate(() => ({ p: JSON.parse(JSON.stringify(G.game.progress)), rope: G.test.state().ropes[1].state, hearts: G.hands.info().hearts, mode: G.mode }));
  check(vf.mode === "vr" && vf.p.clogs === 1 && vf.p.bank === 5 && vf.rope === "idle", "three yanks flush the first clog in VR: 1 of 12, bank 5, the rope lets go", vf);
  check(vr.errors.length === 0, "no page errors in the VR run", vr.errors);
} catch (e) {
  check(false, "the bot ran to the end", String(e && e.stack || e));
}
await close();
done();
