// Checks the ropes and hands under IWER (an emulated Meta Quest 3): aim assist (the exact ray, the cone search, special
// targets with the snap cone and the pipe normal rule, hysteresis), the reticle's constant 1.5° size, firing and the
// rope's instanced draw, the dry fire, reeling, a yank, snap and smooth turns, the launcher tip, and hand tracking
// (the glove joints, a pinch that fires, the palm gate).
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/swing.mjs   (SHOTS=<dir> saves pictures)
import {
  checker, watchdog, newPage, open, close, state, events, waitState, enterXR, freeze, frames, run,
  controller, hand, head, inputMode, lookQuat, axisQuat, mulQuat, shot,
} from "./lib.mjs";
import { SWING } from "../../public/vr/js/config.js";

const { check, done } = checker("swing");
const REACH = SWING.ropeRange * SWING.rangeGrace;
watchdog(25 * 60 * 1000, "swing");
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
const sub = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const newEvents = async (page, since) => (await events(page)).filter((e) => e.frame > since);

try {
  const page = await newPage({ width: 480, height: 270, clock: true });
  await open(page, "?emulate&skipintro");
  await enterXR(page, "vr");
  await waitState(page, { state: "play" }, 60000);
  await freeze(page);
  await frames(page, 2);
  const S = await page.evaluate(() => ({ ...G.city.start, ring: G.city.goldRing }));
  await page.evaluate((S) => G.test.teleport(S.x, S.y, S.z), S);
  await frames(page, 3);

  /* ---------------- aim assist, driven directly with the loop held ---------------- */
  // The page-side helpers: O is the head on the start roof; dir(yaw, pitch) in degrees (yaw 0 = −z, left positive).
  await page.evaluate(() => {
    G.test.hold(true);
    const h = G.test.state().head;
    window.__O = { x: h.x, y: h.y, z: h.z };
    window.__V0 = { x: 0, y: 0, z: 0 };
    window.__UP = { x: 0, y: 1, z: 0 };
    window.__dir = (yaw, pitch) => { const a = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180; return { x: -Math.sin(a) * Math.cos(p), y: Math.sin(p), z: -Math.cos(a) * Math.cos(p) }; };
    // a fresh aim for side 1: aiming at the open sky first forgets the last target
    window.__fresh = (d, side = 1) => { G.ropes.aim(side, __O, __UP, __V0); const r = G.ropes.aim(side, __O, d, __V0); return r && { ...r }; };
    window.__ang = (d, r) => { const x = r.x - __O.x, y = r.y - __O.y, z = r.z - __O.z, l = Math.hypot(x, y, z); return (Math.acos(Math.max(-1, Math.min(1, (x * d.x + y * d.y + z * d.z) / l))) * 180) / Math.PI; };
  });

  // 1. the exact ray misses, the cone finds a building
  const cone = await page.evaluate((cones) => {
    const HIT = {};
    const coneDeg = cones[G.settings.aim];
    for (let pitch = 2; pitch <= 60; pitch += 2) for (let yaw = 0; yaw < 360; yaw += 3) {
      const d = __dir(yaw, pitch);
      if (G.city.raycast(__O.x, __O.y, __O.z, d.x, d.y, d.z, 400, HIT)) continue; // the exact ray must miss
      const r = __fresh(d);
      if (r && r.valid && !r.special) return { yaw, pitch, r, ang: __ang(d, r), coneDeg, exactMiss: true };
    }
    return null;
  }, SWING.aimCone);
  check(cone && cone.r.tag !== "" && cone.ang > 0.5 && cone.ang <= cone.coneDeg + 0.01 && cone.r.dist <= REACH, "aim assist: the exact ray misses and the cone search finds a building inside the cone", cone);
  const exact = await page.evaluate((R) => {
    const x = R.x - __O.x, y = R.y - __O.y, z = R.z - __O.z, l = Math.hypot(x, y, z), d = { x: x / l, y: y / l, z: z / l };
    const r = __fresh(d);
    return { r, off: Math.hypot(r.x - R.x, r.y - R.y, r.z - R.z) };
  }, S.ring);
  check(exact.r && exact.r.valid && exact.off < 0.05 && exact.r.tag === "building", "aim assist: an exact hit in reach wins (the gold ring face)", exact);

  // 2. hysteresis: where two fresh aims a degree apart pick different targets, a hand that was on the first keeps it
  const hy = await page.evaluate(() => {
    const out = { pairs: 0, kept: 0, bad: [], switched: 0 };
    for (let pitch = 4; pitch <= 40; pitch += 3) for (let yaw = 0; yaw < 360; yaw += 2) {
      const d1 = __dir(yaw, pitch), d2 = __dir(yaw + 1, pitch);
      const a = __fresh(d1), b = __fresh(d2);
      if (!a || !b || !a.valid || !b.valid || a.special || a.id === b.id) continue;
      if (b.score === a.score) continue;
      out.pairs++;
      G.ropes.aim(0, __O, __UP, __V0);
      G.ropes.aim(0, __O, d1, __V0);
      const k = { ...G.ropes.aim(0, __O, d2, __V0) };
      if (k.id === a.id) { out.kept++; if (b.score > k.score * 1.2 + 1e-9) out.bad.push({ yaw, pitch, a: a.id, b: b.id, ks: k.score, bs: b.score }); }
      else out.switched++;
      if (out.pairs > 400) return out;
    }
    return out;
  });
  check(hy.pairs > 5 && hy.kept > 0 && hy.bad.length === 0, "hysteresis: a target is kept unless a new one scores 20 % better", hy);

  // 3. special targets: a clog snaps inside the 16° cone, not outside it, and it wins over the city behind it
  const sp = await page.evaluate(() => {
    const HIT = {};
    let d = null;
    for (let pitch = 10; pitch <= 60 && !d; pitch += 2) for (let yaw = 0; yaw < 360; yaw += 5) {
      const q = __dir(yaw, pitch);
      if (!G.city.raycast(__O.x, __O.y, __O.z, q.x, q.y, q.z, 45, HIT)) { d = q; break; }
    }
    const pos = { x: __O.x + d.x * 30, y: __O.y + d.y * 30, z: __O.z + d.z * 30 };
    G.ropes.addTarget({ id: "clog:99", tag: "clog", pos, radius: 2.5 });
    // turn the aim 10° and 28° away from the clog, about a horizontal axis across it
    const turn = (deg) => { const a = (deg * Math.PI) / 180, h = Math.hypot(d.x, d.z), up = { x: -d.x * d.y / h, y: h, z: -d.z * d.y / h }; return { x: d.x * Math.cos(a) + up.x * Math.sin(a), y: d.y * Math.cos(a) + up.y * Math.sin(a), z: d.z * Math.cos(a) + up.z * Math.sin(a) }; };
    const at = __fresh(d), ten = __fresh(turn(10)), far = __fresh(turn(28));
    // "special" mode skips the city: a building gives nothing, the clog still snaps
    G.ropes.setMode("special");
    const R = G.city.goldRing, x = R.x - __O.x, y = R.y - __O.y, z = R.z - __O.z, l = Math.hypot(x, y, z);
    const bld = __fresh({ x: x / l, y: y / l, z: z / l }), spec = __fresh(turn(10));
    G.ropes.update(0, G.P, [G.hands.tip(0), G.hands.tip(1)], 0);
    const ret = G.ropes.info().reticles[1];
    G.ropes.aim(1, __O, { x: x / l, y: y / l, z: z / l }, __V0);
    G.ropes.update(0, G.P, [G.hands.tip(0), G.hands.tip(1)], 0);
    const retBld = G.ropes.info().reticles[1];
    G.ropes.setMode("all");
    G.ropes.removeTarget("clog:99");
    const gone = __fresh(turn(10));
    return { at, ten, far, bld, spec, ret, retBld, gone };
  });
  check(sp.at && sp.at.id === "clog:99" && sp.at.special && sp.ten && sp.ten.id === "clog:99" && sp.ten.tag === "clog", "a special target snaps from 10° off (the 16° snap cone)", { at: sp.at, ten: sp.ten });
  check(!sp.far || sp.far.id !== "clog:99", "a special target 28° off does not snap", sp.far);
  check(sp.bld === null && sp.spec && sp.spec.id === "clog:99" && sp.ret.visible && sp.ret.special === 1 && !sp.retBld.visible, "special mode skips the city and shows the reticle only on special targets", { bld: sp.bld, spec: sp.spec && sp.spec.id, ret: sp.ret, retBld: sp.retBld });
  check(!sp.gone || sp.gone.id !== "clog:99", "removeTarget takes a special target away", sp.gone);

  // 4. the pipe normal rule: a pipe takes a cup only from within 60° of its outward normal
  const pipe = await page.evaluate(() => {
    const HIT = {};
    let d = null;
    for (let pitch = 10; pitch <= 60 && !d; pitch += 2) for (let yaw = 0; yaw < 360; yaw += 5) {
      const q = __dir(yaw, pitch);
      if (!G.city.raycast(__O.x, __O.y, __O.z, q.x, q.y, q.z, 45, HIT)) { d = q; break; }
    }
    const pos = { x: __O.x + d.x * 30, y: __O.y + d.y * 30, z: __O.z + d.z * 30 };
    // toward the shooter is −d; tilt it by a given angle about a horizontal axis
    const tilt = (deg) => { const a = (deg * Math.PI) / 180, h = Math.hypot(d.x, d.z), up = { x: -d.x * d.y / h, y: h, z: -d.z * d.y / h }; return { x: -d.x * Math.cos(a) + up.x * Math.sin(a), y: -d.y * Math.cos(a) + up.y * Math.sin(a), z: -d.z * Math.cos(a) + up.z * Math.sin(a) }; };
    const out = {};
    for (const deg of [0, 50, 70, 180]) {
      G.ropes.addTarget({ id: "pipe:9", tag: "pipe", pos, radius: 1.5, normal: tilt(deg) });
      const r = __fresh(d);
      out[deg] = r ? r.id : null;
    }
    // the cup faces along the pipe's normal
    G.ropes.addTarget({ id: "pipe:9", tag: "pipe", pos, radius: 1.5, normal: tilt(30) });
    const r = __fresh(d), n = tilt(30);
    out.normal = r && Math.hypot(r.nx - n.x, r.ny - n.y, r.nz - n.z) < 1e-6;
    G.ropes.removeTarget("pipe:9");
    return out;
  });
  check(pipe[0] === "pipe:9" && pipe[50] === "pipe:9" && pipe[70] !== "pipe:9" && pipe[180] !== "pipe:9" && pipe.normal, "the pipe normal rule: from 0° and 50° off its normal yes, from 70° and from behind no", pipe);

  // the haptic tick: onValid fires when a target comes into reach
  const tick = await page.evaluate((R) => {
    const got = [];
    G.ropes.onValid((side) => got.push(side));
    G.ropes.aim(1, __O, __UP, __V0);
    const x = R.x - __O.x, y = R.y - __O.y, z = R.z - __O.z, l = Math.hypot(x, y, z), d = { x: x / l, y: y / l, z: z / l };
    G.ropes.aim(1, __O, d, __V0);
    const n1 = got.length;
    G.ropes.aim(1, __O, d, __V0);
    return { n1, n2: got.length };
  }, S.ring);
  check(tick.n1 === 1 && tick.n2 === 1, "onValid ticks once when a target comes into reach", tick);
  await page.evaluate(() => G.test.hold(false));
  await frames(page, 2);

  /* ---------------- the reticle keeps 1.5° at 5 m and at 60 m ---------------- */
  // measured against the XR camera, from the reticle instance's own matrix
  const retAt = async (target) => {
    await page.evaluate((t) => G.test.aimAt(1, t.x, t.y, t.z), target);
    await frames(page, 3);
    return page.evaluate(() => {
      const m = G.ropes.meshes.reticles, a = G.test.aim(1), M = new m.matrix.constructor(), cam = G.renderer.xr.getCamera();
      const i = G.ropes.info().reticles[1];
      if (!a || !i.visible) return { aim: a, visible: false };
      // find this hand's instance: the one nearest the aim point
      let best = null;
      for (let k = 0; k < m.count; k++) {
        m.getMatrixAt(k, M);
        const e = M.elements, p = { x: e[12], y: e[13], z: e[14] }, s = Math.hypot(e[0], e[1], e[2]);
        const d = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
        if (!best || d < best.d) best = { d, p, s };
      }
      const c = cam.cameras.length ? cam.cameras[0].matrixWorld.elements : cam.matrixWorld.elements;
      const dist = Math.hypot(best.p.x - c[12], best.p.y - c[13], best.p.z - c[14]);
      return { visible: true, dist, deg: (2 * Math.atan(best.s / dist) * 180) / Math.PI, aimDist: a.dist, fill: i.fill };
    });
  };
  // 5 m: the roof itself, 1.6 m under the eyes; 60 m: a tower face found by a ray
  const hd = (await state(page)).head;
  const r5 = await retAt({ x: hd.x + 4.7, y: S.y, z: hd.z });
  const far = await page.evaluate((h) => {
    const HIT = {};
    for (let pitch = 0; pitch <= 40; pitch += 1) for (let yaw = 0; yaw < 360; yaw += 1) {
      const a = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180, d = { x: -Math.sin(a) * Math.cos(p), y: Math.sin(p), z: -Math.cos(a) * Math.cos(p) };
      const r = G.city.raycast(h.x, h.y, h.z, d.x, d.y, d.z, 400, HIT);
      if (r && r.t > 58 && r.t < 62 && Math.abs(r.ny) < 0.5) return { x: r.x, y: r.y, z: r.z };
    }
    return null;
  }, hd);
  const r60 = far ? await retAt(far) : null;
  check(r5.visible && r5.dist > 4 && r5.dist < 6 && near(r5.deg, 1.5, 0.03) && r60 && r60.visible && r60.dist > 55 && r60.dist < 65 && near(r60.deg, 1.5, 0.03), "the reticle is 1.5° across at 5 m and at 60 m", { r5, r60 });
  await page.evaluate(() => G.test.aimAt(1, null));

  /* ---------------- fire, attach, the rope draws ---------------- */
  await page.evaluate((S) => G.test.teleport(S.x, S.y, S.z), S);
  await frames(page, 3);
  const cpos = [0.25, 1.35, -0.3];
  const tl = await page.evaluate((t) => G.test.toLocal(t.x, t.y, t.z), S.ring);
  await controller(page, "right", { pos: cpos, quat: lookQuat(sub(tl, { x: cpos[0], y: cpos[1], z: cpos[2] })) });
  await head(page, { pos: [0, 1.6, 0], quat: lookQuat([tl.x, tl.y - 1.6, tl.z]) });
  await frames(page, 3);
  const pre = await page.evaluate(() => G.hands.info().hands[1]);
  const f0 = (await state(page)).frame;
  await controller(page, "right", { trigger: 1 });
  await frames(page, 2);
  const flying = await page.evaluate(() => ({ st: G.test.state().ropes[1].state, cup: G.ropes.info().cups[1], plunger: G.hands.info().hands[1].plunger }));
  for (let i = 0; i < 40 && (await state(page)).ropes[1].state !== "attached"; i++) await frames(page, 1);
  await frames(page, 2);
  const att = await page.evaluate(() => {
    const st = G.test.state(), ri = G.ropes.info(), t = G.hands.tip(1);
    return { rope: st.ropes[1], info: ri, tip: t.toArray(), plunger: G.hands.info().hands[1].plunger, count: G.ropes.meshes.ropes.count };
  });
  const evA = await newEvents(page, f0);
  const cupP = att.info.cups[1].pos, anc = att.rope.anchor, ro = att.info.ropes[1];
  check(pre.plunger && flying.st === "flying" && flying.cup.visible && !flying.plunger, "a shot hides the loaded plunger and a cup flies out", { pre, flying });
  check(att.rope.state === "attached" && evA.some((e) => e.type === "fire" && e.side === 1) && evA.some((e) => e.type === "attach" && e.side === 1), "the trigger fires the rope and it attaches", { rope: att.rope.state, events: evA.map((e) => e.type) });
  check(Math.hypot(cupP[0] - anc.x, cupP[1] - anc.y, cupP[2] - anc.z) < 0.01 && near(att.info.cups[1].out[0], -1, 1e-6), "the stuck cup sits at rope.anchor and faces along rope.normal", { cup: att.info.cups[1], anchor: anc });
  check(att.count >= 1 && ro.segs >= 1 && Math.hypot(ro.to[0] - att.tip[0], ro.to[1] - att.tip[1], ro.to[2] - att.tip[2]) < 0.3 && Math.hypot(ro.from[0] - anc.x, ro.from[1] - anc.y, ro.from[2] - anc.z) < 3, "the rope instances run from the cup to the launcher tip", { segs: ro.segs, count: att.count, from: ro.from, to: ro.to, tip: att.tip });
  // pixels: a point on the rope a metre from the tip, drawn and then hidden. While held, G.frame stands still and the
  // loop only renders, so the clock steps it.
  await page.evaluate(() => G.test.hold(true));
  await run(page, 32);
  // points along the rope from 0.6 m to 2.4 m past the tip, each with its 3 × 3 pixel neighbourhood
  const pts = await page.evaluate(() => {
    const ro = G.ropes.info().ropes[1], cam = G.renderer.xr.getCamera(), c = cam.cameras.length ? cam.cameras[0] : cam;
    const V3 = G.camera.position.constructor, a = new V3().fromArray(ro.to), b = new V3().fromArray(ro.from), out = [];
    const W = G.renderer.getContext().drawingBufferWidth, H = G.renderer.getContext().drawingBufferHeight;
    for (let m = 0.6; m <= 2.41; m += 0.3) {
      const p = a.clone().lerp(b, m / a.distanceTo(b)).project(c);
      for (let dx = -2; dx <= 2; dx += 2) for (let dy = -2; dy <= 2; dy += 2) out.push([(p.x + 1) / 2 + dx / W, (1 - p.y) / 2 + dy / H]);
    }
    return out;
  });
  const on = page.evaluate((p) => G.test.sample(p), pts);
  await run(page, 32);
  const pOn = await on;
  await page.evaluate(() => G.ropes.setVisible(false));
  const off = page.evaluate((p) => G.test.sample(p), pts);
  await run(page, 32);
  const pOff = await off;
  await page.evaluate(() => { G.ropes.setVisible(true); G.ropes.update(0, G.P, [G.hands.tip(0), G.hands.tip(1)], 0); G.test.hold(false); });
  const changed = pOn.filter((q, k) => Math.abs(q[0] - pOff[k][0]) + Math.abs(q[1] - pOff[k][1]) + Math.abs(q[2] - pOff[k][2]) > 30).length;
  check(changed >= 5, "the rope draws pixels along its length (" + changed + " of " + pts.length + " samples change when it hides)", { first: pts[4], on: pOn[4], off: pOff[4] });
  await frames(page, 2);
  await shot(page, "swing-attached");

  /* ---------------- reel and yank ---------------- */
  const l0 = (await state(page)).ropes[1].lenTarget;
  await controller(page, "right", { squeeze: 1 });
  await frames(page, 20);
  const l1 = (await state(page)).ropes[1];
  await controller(page, "right", { squeeze: 0 });
  await frames(page, 2);
  check(l1.state === "attached" && l0 - l1.lenTarget > 2, "squeezing the grip reels the rope in", { before: l0, after: l1.lenTarget });
  await run(page, 400);
  const y0 = await state(page);
  const uy = sub(y0.ropes[1].anchor, y0.pos), ul = Math.hypot(...uy);
  const v0 = (y0.vel.x * uy[0] + y0.vel.y * uy[1] + y0.vel.z * uy[2]) / ul;
  const fy = y0.frame;
  await page.evaluate(() => G.test.yank(1, 4));
  await frames(page, 1);
  const y1 = await state(page);
  const v1 = (y1.vel.x * uy[0] + y1.vel.y * uy[1] + y1.vel.z * uy[2]) / ul;
  const evY = await newEvents(page, fy);
  check(evY.some((e) => e.type === "yank" && e.side === 1 && !e.pump) && v1 - v0 > 2, "a yank on a building throws you toward the anchor", { v0, v1, events: evY.map((e) => e.type) });
  let tw = 0;
  for (let i = 0; i < 3; i++) { tw = Math.max(tw, await page.evaluate(() => G.ropes.info().ropes[1].segs)); await frames(page, 1); }
  check(tw > 1, "the yank plucks the rope (it bends into several segments)", tw);
  await controller(page, "right", { trigger: 0 });
  await frames(page, 2);
  const back = await page.evaluate(() => ({ st: G.test.state().ropes[1].state, cup: G.ropes.info().cups[1] }));
  await frames(page, 15);
  const home = await page.evaluate(() => ({ cup: G.ropes.info().cups[1], plunger: G.hands.info().hands[1].plunger, count: G.ropes.meshes.ropes.count }));
  check(back.st === "idle" && back.cup.back && !home.cup.visible && home.plunger && home.count === 0, "let go: the cup zips back to the launcher and it is loaded again", { back, home });

  /* ---------------- the dry fire ---------------- */
  await page.evaluate((S) => G.test.teleport(S.x, S.y, S.z), S);
  await controller(page, "right", { pos: cpos, quat: lookQuat([0, 1, -0.02]) }); // at the open sky
  await frames(page, 3);
  const fd = (await state(page)).frame;
  await controller(page, "right", { trigger: 1 });
  await frames(page, 1);
  await controller(page, "right", { trigger: 0 });
  await frames(page, 1);
  const d0 = await page.evaluate(() => ({ cup: G.ropes.info().cups[1], tip: G.hands.tip(1).toArray() }));
  const track = [];
  for (let i = 0; i < 64; i++) { await frames(page, 1); track.push(await page.evaluate(() => ({ t: G.time, c: G.ropes.info().cups[1] }))); }
  const evD = await newEvents(page, fd);
  const start = d0.tip, out = track.map((q) => ({ t: q.t - track[0].t, d: Math.hypot(q.c.pos[0] - start[0], q.c.pos[1] - start[1], q.c.pos[2] - start[2]), y: q.c.pos[1], vis: q.c.visible, dry: q.c.dry }));
  const peak = out.reduce((m, q) => (q.vis && q.d > m.d ? q : m), { d: 0 });
  const top = out.reduce((m, q) => (q.dry && q.y > m.y ? q : m), { y: -1e9 });
  const drop = out.filter((q) => q.dry && q.t > top.t);
  check(evD.some((e) => e.type === "dry" && e.side === 1) && !evD.some((e) => e.type === "fire"), "a shot at nothing is a dry fire", evD.map((e) => e.type));
  check(peak.d > 5 && peak.d < 7.6, "the dry cup flies about SWING.dryFly (6 m) out", { peak });
  check(drop.length > 3 && drop[drop.length - 1].y < top.y - 0.5 && out[out.length - 1].vis === false, "then it drops, and reels back into the launcher", { top: top.y, drop: drop.map((q) => q.y.toFixed(2)), last: out[out.length - 1] });

  /* ---------------- turning ---------------- */
  await page.evaluate((S) => G.test.teleport(S.x, S.y, S.z), S);
  await frames(page, 3);
  const t0 = await state(page);
  await controller(page, "right", { stick: [1, 0] });
  await frames(page, 1);
  const t1 = await state(page);
  const blink = await page.evaluate(() => G.comfort.info().blink);
  await controller(page, "right", { stick: [0, 0] });
  await frames(page, 2);
  await page.evaluate(() => { G.settings.snap = 90; });
  await controller(page, "right", { stick: [-1, 0] });
  await frames(page, 1);
  const t2 = await state(page);
  await controller(page, "right", { stick: [0, 0] });
  await frames(page, 2);
  check(near(t1.rig.yaw - t0.rig.yaw, -Math.PI / 4, 1e-6) && blink && near(t2.rig.yaw - t1.rig.yaw, Math.PI / 2, 1e-6), "snap turns: 45° right with a blink, then 90° left at the 90° setting", { d1: t1.rig.yaw - t0.rig.yaw, d2: t2.rig.yaw - t1.rig.yaw, blink });
  await page.evaluate(() => { G.settings.snap = 45; G.settings.turn = "smooth"; });
  const s0 = await state(page);
  await controller(page, "right", { stick: [1, 0] });
  await frames(page, 30);
  const s1 = await state(page);
  const vg = await page.evaluate(() => G.comfort.info());
  await controller(page, "right", { stick: [0, 0] });
  await frames(page, 2);
  const rate = ((s0.rig.yaw - s1.rig.yaw) * 180) / Math.PI / (s1.time - s0.time);
  check(rate > 80 && rate < 95 && dist(s0.head, s1.head) < 0.01, "smooth turn: 90°/s to the right, the head stays put", { rate, head0: s0.head, head1: s1.head });
  check(vg.strength > 0.5 && vg.innerFov < 100, "smooth turning narrows the vignette", vg);
  await page.evaluate(() => { G.settings.turn = "snap"; });

  /* ---------------- the launcher tip follows the controller ---------------- */
  const tipAt = async (pos) => {
    await controller(page, "right", { pos, quat: [0, 0, 0, 1] });
    await frames(page, 2);
    return page.evaluate((p) => ({ tip: G.hands.tip(1).toArray(), w: G.test.toWorld(p[0], p[1], p[2]), aim: G.test.input().hands[1] }), pos);
  };
  const ta = await tipAt([0.2, 1.3, -0.3]), tb = await tipAt([0.3, 1.4, -0.45]);
  const dT = [tb.tip[0] - ta.tip[0], tb.tip[1] - ta.tip[1], tb.tip[2] - ta.tip[2]], dW = [tb.w.x - ta.w.x, tb.w.y - ta.w.y, tb.w.z - ta.w.z];
  const ahead = [ta.tip[0] - ta.aim.aimPos.x, ta.tip[1] - ta.aim.aimPos.y, ta.tip[2] - ta.aim.aimPos.z];
  const along = ahead[0] * ta.aim.aimDir.x + ahead[1] * ta.aim.aimDir.y + ahead[2] * ta.aim.aimDir.z;
  check(Math.hypot(dT[0] - dW[0], dT[1] - dW[1], dT[2] - dW[2]) < 1e-4 && along > 0.05 && along < 0.15 && Math.hypot(...ahead) < 0.15, "the launcher tip follows the controller, 5–15 cm ahead along the aim", { dT, dW, along });
  await head(page, { pos: [0, 1.6, 0], quat: axisQuat([1, 0, 0], -0.35) });
  await controller(page, "left", { pos: [-0.14, 1.36, -0.33], quat: mulQuat(axisQuat([0, 1, 0], 0.25), axisQuat([1, 0, 0], 0.2)) });
  await controller(page, "right", { pos: [0.14, 1.36, -0.33], quat: mulQuat(axisQuat([0, 1, 0], -0.25), axisQuat([1, 0, 0], 0.2)) });
  await frames(page, 2);
  const lau = await page.evaluate(() => ({ info: G.hands.info(), calls: G.test.renderInfo() }));
  check(lau.info.launchers === 2 && lau.info.hands.every((h) => h.mode === "launcher" && h.plunger), "two launchers draw, each with a loaded plunger", lau.info);
  await shot(page, "swing-launchers");
  await page.evaluate(() => { G.hands.setHearts(1); G.hands.glow("trigger"); G.hands.setStyle(100); G.ropes.setStyle(60); });
  await frames(page, 2);
  const sty = await page.evaluate(() => ({ h: G.hands.info(), r: G.ropes.info() }));
  check(sty.h.hearts === 1 && sty.h.gold === 1 && sty.h.glow === "trigger" && sty.r.stripe === 1 && sty.r.goldCup === 1, "hearts, the trigger glow and the unlock looks switch on", { hearts: sty.h.hearts, gold: sty.h.gold, glow: sty.h.glow, stripe: sty.r.stripe, cup: sty.r.goldCup });
  await shot(page, "swing-launchers-gold");
  await page.evaluate(() => { G.hands.setHearts(3); G.hands.glow(null); G.hands.setStyle(0); G.ropes.setStyle(0); });

  /* ---------------- hands: the gloves, a pinch fires, the palm gate ---------------- */
  await page.evaluate((S) => G.test.teleport(S.x, S.y, S.z), S);
  await inputMode(page, "hand");
  await frames(page, 3);
  await hand(page, "right", { pos: [0.16, 1.35, -0.32], quat: axisQuat([1, 0, 0], 0.3), pose: "default", pinch: 0 });
  await hand(page, "left", { pos: [-0.16, 1.35, -0.32], quat: axisQuat([1, 0, 0], 0.3), pose: "default", pinch: 0 });
  await frames(page, 3);
  const gl = await page.evaluate(() => {
    const m = G.hands.meshes.joints, M = new m.matrix.constructor(), inp = G.test.input(), out = { count: m.count, visible: m.visible, finite: true, off: 0 };
    // every instance sits near a joint of its hand (tracking space: the gloves are rig children)
    for (let k = 0; k < m.count; k++) {
      m.getMatrixAt(k, M);
      const e = M.elements;
      if (!e.every(Number.isFinite)) out.finite = false;
      const J = inp.hands[k < 25 ? 0 : 1].joints;
      let best = 1e9;
      for (let j = 0; j < 25; j++) best = Math.min(best, Math.hypot(e[12] - J[j * 4], e[13] - J[j * 4 + 1], e[14] - J[j * 4 + 2]));
      out.off = Math.max(out.off, best);
    }
    out.info = G.hands.info();
    return out;
  });
  check(gl.count === 50 && gl.visible && gl.finite && gl.off < 0.05 && gl.info.hands.every((h) => h.mode === "hand"), "hand tracking draws 50 glove joints (one instanced draw) and a launcher on each hand", gl);
  await head(page, { pos: [0, 1.6, 0], quat: axisQuat([1, 0, 0], -0.35) });
  await frames(page, 2);
  await shot(page, "swing-hands");
  // pinch while aiming the hand at the gold ring
  await page.evaluate((R) => G.test.aimAt(1, R.x, R.y, R.z), S.ring);
  await frames(page, 2);
  const fh = (await state(page)).frame;
  await hand(page, "right", { pose: "pinch", pinch: 1 });
  for (let i = 0; i < 40 && (await state(page)).ropes[1].state !== "attached"; i++) await frames(page, 1);
  await frames(page, 2);
  const hp = await page.evaluate(() => ({ rope: G.test.state().ropes[1], ri: G.ropes.info().ropes[1], tip: G.hands.tip(1).toArray(), plunger: G.hands.info().hands[1].plunger }));
  const evH = await newEvents(page, fh);
  check(hp.rope.state === "attached" && evH.some((e) => e.type === "fire" && e.side === 1) && hp.ri.segs >= 1 && Math.hypot(hp.ri.to[0] - hp.tip[0], hp.ri.to[1] - hp.tip[1], hp.ri.to[2] - hp.tip[2]) < 0.3 && !hp.plunger, "a pinch fires from the hand launcher and the rope attaches", { rope: hp.rope.state, events: evH.map((e) => e.type), segs: hp.ri.segs });
  await head(page, { pos: [0, 1.6, 0], quat: [0, 0, 0, 1] });
  await shot(page, "swing-hand-rope");
  await hand(page, "right", { pose: "default", pinch: 0 });
  await frames(page, 30);
  await page.evaluate(() => G.test.aimAt(1, null));
  // palm toward the head: a pinch there fires nothing
  const palmUp = mulQuat(axisQuat([1, 0, 0], 1.1), axisQuat([0, 0, 1], Math.PI));
  await hand(page, "right", { quat: palmUp, pose: "default", pinch: 0 });
  await frames(page, 2);
  const fp = (await state(page)).frame;
  await hand(page, "right", { pose: "pinch", pinch: 1 });
  await frames(page, 25);
  const evP = await newEvents(page, fp);
  check(!evP.some((e) => (e.type === "fire" || e.type === "dry") && e.side === 1), "the palm gate: a pinch with the palm toward your face fires nothing", evP.map((e) => e.type));
  await hand(page, "right", { quat: [0, 0, 0, 1], pose: "default", pinch: 0 });
  await inputMode(page, "controller");
  await frames(page, 3);

  check(page.errors.length === 0, "no errors", page.errors);
  await page.context().close();
} catch (e) { check(false, "the swing run threw", e.stack || String(e)); }

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }

await close();
done();
