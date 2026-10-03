// Checks the mixed-reality opening under IWER (an emulated Meta Quest 3 with two synthetic rooms, office_small and
// living_room): the stance question, the wall rules, the crack, the stencil hole with the city behind it, the shot at the
// crack and its sticky rope, a real yank, the room check, the burst and the reveal, the hand-off to the start roof, the chalk
// outline, every timeout, the Skip rules, a recentre, and the map on a real table.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/mr.mjs   (SHOTS=<dir> saves pictures)
import {
  checker, watchdog, newPage, open, close, state, enterXR, freeze, frames, controller, head, recenter, axisQuat, mulQuat, shot,
} from "./lib.mjs";

const { check, done } = checker("mr");
watchdog(75 * 60 * 1000, "mr");
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;

/* ---------------- helpers ---------------- */
// Logic without drawing: the loop is held and G.test.step owns time (the fake clock only carries the XR frames).
const step = (page, secs, dt = 1 / 30) => page.evaluate(([n, dt]) => { G.test.step(dt, n); return G.test.portal(); }, [Math.max(1, Math.round(secs / dt)), dt]);
// Steps and records [phase, grow, hole, sphere radius, subtitle] after every step.
const trace = (page, secs, dt = 1 / 30) => page.evaluate(([n, dt]) => {
  const out = [];
  for (let i = 0; i < n; i++) { G.test.step(dt, 1); const p = G.test.portal(); out.push([p.phase, p.crack.grow, p.crack.hole, p.sphere.r, G.test.ui().subtitle.text]); }
  return out;
}, [Math.max(1, Math.round(secs / dt)), dt]);
// Waits until the renderer has drawn n more frames (G.frame stands still while the loop is held).
async function renders(page, n = 2) {
  const f0 = await page.evaluate(() => G.renderer.info.render.frame);
  for (let i = 0; i < n * 60; i++) {
    if ((await page.evaluate(() => G.renderer.info.render.frame)) >= f0 + n) return;
    await page.clock.runFor(16);
  }
  throw new Error("the renderer did not draw");
}
async function pixels(page, points) {
  const p = page.evaluate((pts) => G.test.sample(pts), points);
  await renders(page, 1);
  return p;
}
const info = (page) => page.evaluate(() => G.test.portal());
const uiInfo = (page) => page.evaluate(() => G.test.ui());
const yawTo = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// THREE's stencil constants, read from the page's own copy of the library
const enums = (page) => page.evaluate(async () => { const T = await import("three"); return { equal: T.EqualStencilFunc, always: T.AlwaysStencilFunc, replace: T.ReplaceStencilOp, notEqual: T.NotEqualStencilFunc, double: T.DoubleSide }; });
// How the city's materials are set for the stencil right now.
const cityStencil = (page) => page.evaluate(() => {
  const mats = new Set();
  G.view.root.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) mats.add(m); });
  const list = [...mats];
  return { n: list.length, on: list.filter((m) => m.stencilWrite === true && m.stencilRef === 1 && m.stencilFunc === 514).length, off: list.filter((m) => m.stencilWrite === false).length };
});

/* ================= one room ================= */
async function room(name, opts) {
  const tag = name + ": ";
  const page = await newPage({ width: opts.w || 480, height: opts.h || 270, clock: true });
  await open(page, "?emulate=ar&room=" + name);
  await enterXR(page, "ar");
  await freeze(page);
  await frames(page, 3);
  const st0 = await state(page);
  check(st0.mode === "ar" && st0.xr.blend === "alpha-blend" && st0.xr.features.includes("plane-detection") && st0.state === "intro", tag + "the AR session starts the opening", { mode: st0.mode, state: st0.state, blend: st0.xr.blend, features: st0.xr.features });
  const S = await page.evaluate(() => ({ ...G.city.start }));
  const spy = await page.evaluate(() => {
    // record what the portal asks of the sound
    window.__snd = { loop: [], sfx: [], amb: [] };
    const a = G.audio, l = a.loop.bind(a), s = a.sfx.bind(a), m = a.ambience.bind(a);
    a.loop = (n, p) => { window.__snd.loop.push(n); return l(n, p); };
    a.sfx = (n, o) => { window.__snd.sfx.push(n); return s(n, o); };
    a.ambience = (v) => { window.__snd.amb.push(v); return m(v); };
    return true;
  });
  await page.evaluate(() => G.test.hold(true));

  /* ---- the first run: "Clear the space around you." and the stance question ---- */
  await step(page, 0.3);
  let u = await uiInfo(page), p = await info(page);
  check(u.panel === "stance" && u.subtitle.text === "Clear the space around you." && p.phase === "prep" && !p.placed, tag + "the first run says \"Clear the space around you.\" and asks the stance before the crack", { panel: u.panel, text: u.subtitle.text, phase: p.phase });
  check(u.buttons.some((b) => b.id === "stance:standing") && u.buttons.some((b) => b.id === "stance:seated") && u.stance.pre === "standing", tag + "the stance panel has Standing and Seated and preselects standing for a 1.6 m head", u.stance);
  await page.evaluate(() => G.test.uiPress("stance:standing"));

  /* ---- the wall ---- */
  p = await step(page, 0.4);
  const wall = p.wall, crack = p.crack;
  check(p.placed && p.phase === "gurgle" && wall.kind === "plane" && wall.label === "wall", tag + "after the answer a real wall plane is chosen and the gurgle starts", { phase: p.phase, wall });
  if (opts.tiny) check(wall.dist >= 0.9 && wall.dist <= 4, tag + "in a room this small the roomiest real wall is used (none is 1.5 m away)", wall);
  else check(wall.dist >= 1.5 && wall.dist <= 4, tag + "the wall is 1.5 to 4 m away", wall);
  const onWall = await page.evaluate(() => {
    const c = G.test.portal().wall.local;
    let best = 9;
    for (const e of G.xr.planes.values()) if (e.label === "wall") { const m = e.matrix.elements; best = Math.min(best, Math.abs((c.x - m[12]) * m[4] + (c.y - m[13]) * m[5] + (c.z - m[14]) * m[6])); }
    return best;
  });
  check(onWall < 0.03 && crack.local.y >= 1.0 && crack.local.y <= 1.6, tag + "the crack sits on that plane at chest to head height", { off: onWall, y: crack.local.y });
  const s1 = await state(page);
  check(Math.hypot(s1.head.x - S.x, s1.head.z - S.z) < 0.01 && Math.abs(s1.head.y - (S.y + s1.headLocal.y)) < 0.01, tag + "placeRig puts your head over the start roof", { head: s1.head, start: S });
  check(Math.abs(wrapPi(yawTo(s1.head, crack.world) - S.yaw)) < 0.02, tag + "the crack lies toward the Needle from the start (the yaw formula of §10)", { yaw: yawTo(s1.head, crack.world), want: S.yaw });
  const st = await cityStencil(page);
  check(st.n > 0 && st.on === st.n, tag + "view.stencil(1) is on for every city material from the start: no city outside the mask", st);
  const snd0 = await page.evaluate(() => ({ ...window.__snd }));
  // the portal turned the city sound down when the opening began, before the spy was in place: read the level itself
  const amb0 = await page.evaluate(() => (G.audio._engine ? G.audio._engine.st.amb : null));
  check(snd0.loop.includes("gurgle") && amb0 === 0.2, tag + "the gurgle loop plays and the city ambience is low in the room", { snd: snd0, amb: amb0 });
  check(u.subtitle.text.length > 0, tag + "a subtitle shows", u.subtitle);

  /* ---- a wall behind you: the floor arrow shows the way ---- */
  const turnHead = async (yaw) => {
    await head(page, { quat: axisQuat([0, 1, 0], yaw) });
    await page.evaluate(() => G.test.hold(false));
    await frames(page, 3);
    await page.evaluate(() => G.test.hold(true));
  };
  await turnHead(Math.PI * 0.75);
  p = await step(page, 0.3);
  check(p.arrow.goal && near(p.arrow.goal.x, wall.local.x, 0.02) && near(p.arrow.goal.z, wall.local.z, 0.02), tag + "with the wall 135 degrees away a floor arrow points at it", { arrow: p.arrow, wall: wall.local });
  await turnHead(0);
  p = await step(page, 0.3);
  check(p.arrow.goal === null && !p.arrow.visible, tag + "the arrow goes away when you face the wall again", p.arrow);

  /* ---- gurgle, crack, hole ---- */
  const trA = await trace(page, 6);
  await renders(page, 2);
  await shot(page, "mr-" + name + "-crack");
  const tr = trA.concat(await trace(page, 4.6));
  const order = [...new Set(tr.map((r) => r[0]))];
  check(order.join(",") === "gurgle,crack,hole,shoot", tag + "the phases run gurgle, crack, hole, shoot", order);
  const grow = tr.map((r) => r[1]);
  check(grow.every((g, i) => i === 0 || g >= grow[i - 1] - 1e-9) && grow[grow.length - 1] >= 0.99 && grow[0] < 0.3, tag + "the crack decal grows and never shrinks", { first: grow[0], last: grow[grow.length - 1] });
  const hole = tr.map((r) => r[2]);
  check(hole.every((g, i) => i === 0 || g >= hole[i - 1] - 1e-9) && hole[hole.length - 1] >= 0.99 && hole.some((h) => h > 0 && h < 0.9), tag + "a jagged hole opens after the crack", { max: Math.max(...hole) });
  const lines = [...new Set(tr.map((r) => r[4]))];
  check(lines.includes("Shoes off. Plunger up.") && lines.includes("Hear that? Something is backing up.") && lines.includes("Shoot the crack. Hold the trigger."), tag + "the Cottage says its lines (Shoes off, Hear that, Shoot the crack)", lines);
  p = await info(page);
  check(p.flags.warmed && p.target.added, tag + "the city was warmed during the crack and the crack is a rope target", p.flags);
  const rm = await page.evaluate(() => G.ropes.mode);
  check(rm === "special", tag + "the ropes are in special mode (only the crack takes a plunger)", rm);
  const E = await enums(page);
  const mask = await page.evaluate(() => {
    let m = null;
    G.rig.traverse((o) => { if (o.isMesh && o.material && o.material.stencilWrite && o.material.colorWrite === false && o.renderOrder === -100) m = { colorWrite: o.material.colorWrite, depthWrite: o.material.depthWrite, depthTest: o.material.depthTest, side: o.material.side, func: o.material.stencilFunc, ref: o.material.stencilRef, zpass: o.material.stencilZPass, zfail: o.material.stencilZFail, transparent: o.material.transparent, order: o.renderOrder }; });
    return m;
  });
  check(mask && mask.depthWrite === false && mask.depthTest === false && mask.side === E.double && mask.func === E.always && mask.ref === 1 && mask.zpass === E.replace && mask.zfail === E.replace && !mask.transparent, tag + "the hole mask is the exact stencil material of §10", mask);
  const pxA = await pixels(page, { hole: [0.5, 0.45], farL: [0.06, 0.08], farR: [0.94, 0.08] });
  check(pxA.hole[3] === 255 && pxA.farL[3] === 0 && pxA.farR[3] === 0, tag + "the city shows through the hole and nowhere else (alpha 255 in the hole, 0 round it)", pxA);
  await renders(page, 1);
  await shot(page, "mr-" + name + "-hole");

  /* ---- the shot: the trigger opens and the rope stays ---- */
  const cw = p.crack.world;
  await page.evaluate((c) => { G.test.aimAt(1, c.x, c.y, c.z); G.test.press(1, true); }, cw);
  await step(page, 0.7);
  let r1 = (await state(page)).ropes[1];
  check(r1.state === "attached" && r1.tag === "crack", tag + "firing at the crack attaches the plunger to it", r1);
  await page.evaluate(() => { G.test.press(1, false); G.test.aimAt(1, null); });
  p = await step(page, 0.6);
  r1 = (await state(page)).ropes[1];
  check(r1.state === "attached" && p.phase === "yank", tag + "the rope stays when the trigger opens (sticky) and the yank prompt starts", { rope: r1, phase: p.phase });
  u = await uiInfo(page);
  check(u.subtitle.text === "Now pull back hard.", tag + "the prompt says \"Now pull back hard.\"", u.subtitle.text);
  await renders(page, 1);
  await shot(page, "mr-" + name + "-attached");

  /* ---- a real yank: the right controller pulls away from the crack ---- */
  await page.evaluate(() => G.test.hold(false));
  await frames(page, 2);
  const inpNow = await page.evaluate(() => G.test.input());
  const g = inpNow.hands[1].gripLocal.pos, ca = (await info(page)).crack.local;
  let ux = ca.x - g.x, uy = ca.y - g.y, uz = ca.z - g.z;
  const ul = Math.hypot(ux, uy, uz);
  ux /= ul; uy /= ul; uz /= ul;
  const f0 = (await state(page)).frame, pp = [g.x, g.y, g.z];
  for (let i = 0; i < 6; i++) {
    pp[0] -= ux * 0.1; pp[1] -= uy * 0.1; pp[2] -= uz * 0.1;
    await controller(page, "right", { pos: pp.slice() });
    await frames(page, 1);
  }
  const evs = (await page.evaluate(() => G.test.events())).filter((e) => e.frame > f0);
  const yk = evs.find((e) => e.type === "yank" && e.side === 1);
  check(!!yk && yk.pump === true && yk.target.tag === "crack", tag + "a fast pull of the real controller is a pump on the crack", evs.map((e) => e.type));
  await page.evaluate(() => G.test.hold(true));
  p = await info(page);
  // both rooms are full of furniture: the room check asks you to step back
  check(p.phase === "room", tag + "with furniture within 1 m the room check starts", { phase: p.phase });
  u = await uiInfo(page);
  check(u.subtitle.text === "Give yourself some room.", tag + "the room check says \"Give yourself some room.\"", u.subtitle.text);
  await step(page, 0.2);
  p = await info(page);
  check(p.arrow.goal !== null, tag + "a floor arrow points to the most open floor", p.arrow);
  await controller(page, "right", { pos: [g.x, g.y, g.z] });
  await renders(page, 2);
  await shot(page, "mr-" + name + "-roomcheck");

  /* ---- the room check times out after 8 s; the wall bursts ---- */
  p = await step(page, 5);
  check(p.phase === "room" && p.room.t > 4.9, tag + "the room check waits (still asking after 5 s)", { phase: p.phase, t: p.room.t });
  p = await step(page, 8 - p.room.t + 0.1);
  check(p.phase === "burst" && p.sphere.visible && Math.abs(p.room.t - 8) < 0.3, tag + "after 8 s the wall bursts and the reveal sphere appears", { phase: p.phase, sphere: p.sphere, room: p.room });
  const snd1 = await page.evaluate(() => ({ ...window.__snd }));
  check(snd1.sfx.includes("crack") && snd1.sfx.includes("burst") && snd1.amb.includes(1), tag + "the crack and burst sounds play and the city sound comes up", snd1);
  const rel = await page.evaluate(() => { const r = G.test.state().ropes; return [r[0].state, r[1].state]; });
  check(rel[0] === "idle" && rel[1] === "idle", tag + "the ropes let go at the burst", rel);
  await renders(page, 2);
  await shot(page, "mr-" + name + "-burst");

  /* ---- the reveal: 14 m/s from the hole out to 40 m, chunks at 0.35x for 0.6 s ---- */
  const chunks0 = await page.evaluate(() => { const c = G.rig.getObjectByName("portal:chunks"); return { count: c.count, visible: c.visible }; });
  check(chunks0.count > 20 && chunks0.visible, tag + "chunks of wall fly", chunks0);
  const slow0 = p.slowMo;
  const tr2 = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 40; i++) { G.test.step(1 / 60, 1); const q = G.test.portal(); out.push([q.timers.total, q.sphere.r, q.phase, q.slowMo]); }
    return out;
  });
  const dr = (tr2[tr2.length - 1][1] - tr2[0][1]) / (tr2[tr2.length - 1][0] - tr2[0][0]);
  check(near(dr, 14, 1.5), tag + "the reveal sphere grows at 14 m/s", { rate: dr });
  const slowLate = (await info(page)).slowMo;
  check(near(slow0, 0.35, 1e-6) && tr2.some((q) => q[3] === 0.35) && slowLate === 1 && tr2[tr2.length - 1][2] === "reveal", tag + "the chunks fly at 0.35x speed for the first 0.6 s, then at full speed", { first: slow0, late: slowLate, phase: tr2[tr2.length - 1][2] });
  p = await step(page, 0.4);
  await renders(page, 2);
  await shot(page, "mr-" + name + "-reveal");
  const stMid = await cityStencil(page);
  check(stMid.on === stMid.n, tag + "the stencil is still on while the sphere grows", stMid);
  const pxB = await pixels(page, { c: [0.5, 0.4], l: [0.06, 0.08], r: [0.94, 0.08] });
  check(pxB.c[3] === 255 && pxB.l[3] === 255 && pxB.r[3] === 255, tag + "inside the sphere the city covers the whole view", pxB);

  /* ---- hand-off ---- */
  p = await step(page, 3.5);
  check(p.phase === "done" && !p.active, tag + "the reveal ends at 40 m and the opening is done", p);
  const s2 = await state(page);
  check(s2.state === "play", tag + "play starts", s2.state);
  const roof = await page.evaluate(() => { const S = G.city.start, h = G.test.state().head; const tb = G.city.topBelow(h.x, S.y + 0.1, h.z, 0.25); return { roof: tb ? tb.y : null }; });
  check(Math.hypot(s2.pos.x - s2.head.x, s2.pos.z - s2.head.z) < 0.01 && near(s2.pos.y, S.y, 0.01) && s2.onGround && roof.roof !== null && near(roof.roof, S.y, 0.01), tag + "play starts on the start roof with the head over the roof", { pos: s2.pos, head: s2.head, roof: roof.roof });
  const stEnd = await cityStencil(page);
  check(stEnd.off === stEnd.n && stEnd.n > 0, tag + "the stencil is off after the reveal (view.stencil(null))", stEnd);
  const leftovers = await page.evaluate(() => { const w = G.rig.getObjectByName("portal:wall"), ch = G.rig.getObjectByName("portal:chalk"), sp = G.rig.getObjectByName("portal:sphere"); return { wallKids: w.children.length, chalk: ch.visible, chalkKids: ch.children.length, sphere: sp.visible, chunks: G.rig.getObjectByName("portal:chunks").visible }; });
  check(leftovers.wallKids === 0 && !leftovers.sphere && !leftovers.chunks && leftovers.chalk && leftovers.chalkKids > 0, tag + "the room things are gone but the chalk outline of your room stays", leftovers);
  // in a tiny room the comfort module blends your real walls in as you play (its own test covers that): switch that off for this read
  const reality = await page.evaluate(() => { const o = []; G.scene.traverse((n) => { if (n.name && n.name.startsWith("reality:") && n.visible) { n.visible = false; o.push(n); } }); window.__reality = o; return o.length; });
  const pxC = await pixels(page, { l: [0.06, 0.08], r: [0.94, 0.08], c: [0.5, 0.4] });
  await page.evaluate(() => { for (const n of window.__reality) n.visible = true; });
  check(pxC.l[3] === 255 && pxC.r[3] === 255 && pxC.c[3] === 255, tag + "the city fills the view", { px: pxC, hidden: reality });
  const rmode = await page.evaluate(() => G.ropes.mode);
  check(rmode === "all", tag + "ropes go back to normal mode", rmode);
  await step(page, 0.5);
  const gi = await page.evaluate(() => { const g = G.game.info(), c = G.rig.parent && G.game.root; return { started: g.started, king: g.king, root: G.game.root.visible, pos: G.game.meshes.king.getWorldPosition(new (G.camera.position.constructor)()).toArray(), perch: [G.view.perch.x, G.view.perch.y, G.view.perch.z], c: !!c }; });
  const kd = Math.hypot(gi.pos[0] - gi.perch[0], gi.pos[1] - gi.perch[1], gi.pos[2] - gi.perch[2]);
  check(gi.started && gi.root && gi.king.visible && kd < 25, tag + "the King is on the Needle and in the world", { visible: gi.king.visible, dist: kd, root: gi.root });
  check(gi.king.react > 0, tag + "the King stirs for a moment at the burst (game.stir)", gi.king);
  await renders(page, 2);
  await shot(page, "mr-" + name + "-play");
  p = await step(page, 10);
  const chalkGone = await page.evaluate(() => G.rig.getObjectByName("portal:chalk").visible);
  check(!chalkGone, tag + "the chalk outline goes after 10 s", chalkGone);
  const errs = page.errors.slice();
  check(errs.length === 0, tag + "no page errors or console warnings", errs);

  /* ---- the map on a real table ---- */
  await page.evaluate(() => { G.test.teleport(-300, 0, 100); });
  await step(page, 0.3);
  await page.evaluate(() => G.ui.openMap());
  await step(page, 0.1);
  u = await uiInfo(page);
  const worldHidden = await page.evaluate(() => ({ view: G.view.root.visible, game: G.game.root.visible, state: G.test.state().state }));
  check(u.map.open && u.paused && worldHidden.state === "paused" && !worldHidden.view && !worldHidden.game, tag + "the map pauses the game and hides the world so the passthrough shows", { map: u.map.open, world: worldHidden });
  const tbl = await page.evaluate(() => {
    let best = null, bd = 9;
    const hl = G.test.state().headLocal;
    for (const e of G.xr.planes.values()) if (e.label === "table" || e.label === "desk") { const m = e.matrix.elements, d = Math.hypot(m[12] - hl.x, m[14] - hl.z); if (d < bd) { bd = d; best = { x: m[12], y: m[13], z: m[14], d }; } }
    return best;
  });
  // the diorama is a child of the rig, so its own position is in tracking space, like the plane
  const mw = u.map.local;
  check(u.map.table && tbl && mw && Math.hypot(mw.x - tbl.x, mw.z - tbl.z) < 0.03 && mw.y > tbl.y && mw.y - tbl.y < 0.05, tag + "the diorama stands on the table plane nearest to you", { map: mw, table: tbl });
  check(u.map.pins > 10 && u.buttons.some((b) => b.id === "pin:start"), tag + "the map has pins, and the start roof is a travel spot", { pins: u.map.pins, ids: u.buttons.map((b) => b.id) });
  const rigKid = await page.evaluate(() => { const m = G.rig.getObjectByName("ui:map"); return !!m && m.parent === G.rig; });
  check(rigKid, tag + "the diorama is a child of the rig (it stays on the real table)", rigKid);
  // look at the table for the picture
  const dx = tbl.x - 0, dz = tbl.z - 0, yaw = Math.atan2(-dx, -dz);
  await head(page, { quat: mulQuat(axisQuat([0, 1, 0], yaw), axisQuat([1, 0, 0], -0.45)) });
  await renders(page, 3);
  await shot(page, "mr-" + name + "-diorama");
  await head(page, { quat: [0, 0, 0, 1] });
  await page.evaluate(() => G.test.uiPress("pin:start"));
  // the fade and the trip finish through promises: each one needs a turn of the event loop between steps
  for (let i = 0; i < 12; i++) await step(page, 0.3);
  const s3 = await state(page);
  check(s3.state === "play" && Math.hypot(s3.pos.x - S.x, s3.pos.z - S.z) < 0.5 && near(s3.pos.y, S.y, 0.05), tag + "picking the start pin travels there", { state: s3.state, pos: s3.pos });
  const back = await page.evaluate(() => ({ view: G.view.root.visible, game: G.game.root.visible }));
  check(back.view && back.game, tag + "the world is back after the trip", back);
  await close();
}

/* ================= the timeout paths, the Skip rules and a recentre (office_small, a fresh page each) ================= */
async function timeouts() {
  const tag = "timeouts: ";
  const page = await newPage({ width: 320, height: 180, clock: true });
  await open(page, "?emulate=ar&room=office_small");
  await enterXR(page, "ar");
  await freeze(page);
  await frames(page, 3);
  await page.evaluate(() => G.test.hold(true));
  await step(page, 0.3);
  await page.evaluate(() => G.test.uiPress("stance:seated"));
  await step(page, 0.4);
  const sset = await page.evaluate(() => ({ seated: G.settings.seated, height: G.settings.height, off: G.comfort.seatedOffset }));
  check(sset.seated === true && sset.height > 1.5 && sset.off >= 0, tag + "the stance answer is stored (seated, calibrated)", sset);
  let p = await info(page);
  check(!p.flags.skipOn, tag + "on the first run Skip is not there yet", p.flags);
  // shoot step: nothing happens for 10 s, then the cone widens; after 20 s a cup flies by itself
  await step(page, 9.0);
  p = await step(page, 0.2);
  check(p.phase === "shoot", tag + "the opening waits in the shoot step when you do nothing", p.phase);
  const t0 = p.timers.phase;
  p = await step(page, 10 - t0 + 0.3);
  check(p.flags.widened && p.target.cone === 35 && !p.flags.auto, tag + "after 10 s the crack's snap cone widens to 35 degrees", { flags: p.flags, cone: p.target.cone });
  p = await step(page, 10);
  const r1 = (await state(page)).ropes[1];
  check(p.flags.auto && r1.state === "attached" && r1.tag === "crack" && p.phase === "yank", tag + "after 20 s a cup flies from the right hand by itself and sticks", { flags: p.flags, rope: r1, phase: p.phase });
  check(p.flags.skipOn, tag + "the first run shows Skip after 30 s", { total: p.timers.total, flags: p.flags });
  const sk = await uiInfo(page);
  check(sk.skip === true, tag + "the ui offers the skip", sk.skip);
  // yank step: after 10 s the pump threshold drops to 0.6 m/s; after 20 s the wall bursts anyway
  p = await step(page, 10.3);
  check(p.flags.easy && p.phase === "yank", tag + "after 10 s in the yank step the pump threshold is easy", p.flags);
  p = await step(page, 10);
  check(p.phase === "room" || p.phase === "burst", tag + "after 20 s in the yank step the wall goes anyway", p.phase);
  p = await step(page, 9);
  check(p.phase === "burst" || p.phase === "reveal", tag + "the room check gives up after 8 s", p.phase);
  const skipNow = await page.evaluate(() => { G.test.skipIntro(); return true; });
  p = await step(page, 0.2, 1 / 60);
  check(skipNow && p.phase === "done", tag + "Skip ends even the reveal", p.phase);
  await step(page, 0.5);
  check((await state(page)).state === "play", tag + "play starts after a skip", (await state(page)).state);
  await close();

  // a recentre in the crack phase: the wall keeps its place in the real room, and the city its place behind the crack
  const p2 = await newPage({ width: 320, height: 180, clock: true });
  await open(p2, "?emulate=ar&room=living_room");
  await enterXR(p2, "ar");
  await freeze(p2);
  await frames(p2, 3);
  await p2.evaluate(() => G.test.hold(true));
  await step(p2, 0.3);
  await p2.evaluate(() => G.test.uiPress("stance:standing"));
  await step(p2, 5);
  const S = await p2.evaluate(() => ({ ...G.city.start }));
  // the wall plane the crack sits on
  const pl = () => p2.evaluate(() => {
    const w = G.test.portal().wall.local; let best = 9;
    for (const e of G.xr.planes.values()) if (e.label === "wall") { const m = e.matrix.elements; best = Math.min(best, Math.abs((w.x - m[12]) * m[4] + (w.y - m[13]) * m[5] + (w.z - m[14]) * m[6])); }
    return best;
  });
  await head(p2, { pos: [0.35, 1.6, 0.2], quat: axisQuat([0, 1, 0], 0.4) });
  await p2.evaluate(() => G.test.hold(false));
  await frames(p2, 3);
  const before = await info(p2);
  await recenter(p2);
  await frames(p2, 4);
  const after = await info(p2);
  const sh = await state(p2);
  check(after.phase === before.phase || after.phase === "crack" || after.phase === "gurgle", "recentre: the opening carries on", { before: before.phase, after: after.phase });
  check((await pl()) < 0.03, "recentre: the crack still sits on its wall plane (its pose comes from the plane every frame)", await pl());
  check(Math.abs(wrapPi(yawTo(sh.head, after.crack.world) - S.yaw)) < 0.03 && Math.hypot(sh.head.x - S.x, sh.head.z - S.z) < 0.05, "recentre: the city stays behind the crack (the rig is placed again)", { yaw: yawTo(sh.head, after.crack.world), want: S.yaw, head: sh.head });
  await close();

}
// A later run: the save says the opening was seen, so there is no stance question and Skip shows from the start.
async function laterRun() {
  const tag = "later run: ";
  const page = await newPage({ width: 320, height: 180, clock: true, clear: false });
  await page.addInitScript(() => { try { localStorage.setItem("plungerd.vr.v1", JSON.stringify({ v: 1, intro: true, tutorial: true, clogs: [], loonies: [], bonus: 0, king: "sleeping", best: {}, settings: { preset: "moderate", vignette: "med", turn: "snap", snap: 45, aim: "med", vignetteLook: "room", seated: false, height: 0, hand: "right", hold: "hold", hz: 72, foveation: 0.5, music: true } })); } catch (e) { /* storage off */ } });
  await open(page, "?emulate=ar&room=office_small");
  await enterXR(page, "ar");
  await freeze(page);
  await frames(page, 3);
  await page.evaluate(() => G.test.hold(true));
  await step(page, 0.4);
  const u = await uiInfo(page), p = await info(page);
  check(u.panel !== "stance" && p.phase !== "prep" && p.flags.skipOn && u.skip, tag + "no stance question, and Skip shows from the start", { panel: u.panel, phase: p.phase, flags: p.flags });
  check(u.subtitle.text !== "Clear the space around you.", tag + "\"Clear the space\" is only for the first run", u.subtitle.text);
  await page.evaluate(() => G.ui.press("hud:skip"));
  const q = await step(page, 0.2, 1 / 60);
  check(q.phase === "done", tag + "the Skip button ends the opening", q.phase);
  await close();
}

try {
  // ONLY=living_room,office_small,timeouts,later picks parts (all by default)
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null, want = (n) => !only || only.includes(n);
  if (want("living_room")) await room("living_room", { w: 640, h: 360 });
  if (want("office_small")) await room("office_small", { w: 480, h: 270, tiny: true });
  if (want("timeouts")) await timeouts();
  if (want("later")) await laterRun();
} catch (e) { check(false, "mr threw", e.stack || String(e)); }
await close().catch(() => {});
done();
