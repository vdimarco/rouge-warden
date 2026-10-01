// Checks the WebXR layer under IWER (an emulated Meta Quest 3): session features and 72 Hz, controllers and their
// values and edges, firing at a building, a scripted swing, yanks (synthetic and a real controller pull), snap turn,
// blur and pause, recentring, hand tracking with pinch and the palm gate, Exit, and an AR session with a room.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/xr.mjs
import {
  checker, watchdog, newPage, open, close, state, input, events, waitFor, waitState, enterXR, freeze, frames, run,
  controller, hand, head, inputMode, visibility, recenter, remote, lookQuat, axisQuat, mulQuat, dist2, shot,
} from "./lib.mjs";

const { check, done } = checker("xr");
watchdog(20 * 60 * 1000, "xr");
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
const sub = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const newEvents = async (page, since) => (await events(page)).filter((e) => e.frame > since);

/* ================= VR, controllers then hands ================= */
try {
  const page = await newPage({ width: 640, height: 360, clock: true });
  await open(page, "?emulate&skipintro");
  await enterXR(page, "vr");
  await waitState(page, { state: "play" }, 60000);
  await freeze(page);
  await frames(page, 2);

  /* ---- the session ---- */
  const sess = await page.evaluate(() => ({ init: G.xr.lastInit, features: G.xr.features, rate: G.xr.frameRate, asked: G.xr.requestedFrameRate, ref: G.renderer.xr.getReferenceSpace() ? true : false }));
  check(sess.init.requiredFeatures.includes("local-floor") && sess.features.includes("local-floor"), "ENTER VR starts a session with local-floor", sess);
  check(["hand-tracking", "layers", "bounded-floor"].every((f) => sess.init.optionalFeatures.includes(f)) && !sess.init.optionalFeatures.some((f) => /plane|mesh|hit-test/.test(f)), "VR asks for hand-tracking, layers and bounded-floor, and no spatial features", sess.init);
  check(sess.asked === 72 && sess.rate === 72, "the session asks for 72 Hz and runs at it", { asked: sess.asked, rate: sess.rate });
  const st0 = await remote(page, "get_session_status");
  check(st0 && st0.sessionActive === true && st0.sessionMode === "immersive-vr" && st0.deviceName === "Meta Quest 3", "the IWER remote API answers under the frozen clock", st0);

  /* ---- two controllers with the right handedness ---- */
  let inp = await input(page);
  check(inp.hands[0].side === "left" && inp.hands[1].side === "right" && inp.hands.every((h) => h.connected && h.kind === "controller") && inp.kind === "controller", "Input has a left and a right controller", inp.hands.map((h) => [h.side, h.connected, h.kind]));
  check(inp.hands[0].gripLocal.pos.x < 0 && inp.hands[1].gripLocal.pos.x > 0, "each controller's pose comes from its own handedness", inp.hands.map((h) => h.gripLocal.pos));
  check(near(inp.hands[1].aimLocal.dir.z, -1, 1e-3) && inp.hands[1].aimPos && Math.abs(inp.head.pos.y - inp.head.local.pos.y - (await state(page)).rig.y) < 1e-3, "aim rays and world poses follow the rig", { dir: inp.hands[1].aimLocal.dir, head: inp.head });

  /* ---- trigger, grip, sticks and buttons ---- */
  // point the right controller at the sky, so the trigger test fires nothing
  await controller(page, "right", { pos: [0.25, 1.4, -0.35], quat: lookQuat([0, 1, -0.05]) });
  await frames(page, 2);
  await controller(page, "right", { trigger: 1 });
  await frames(page, 1);
  inp = await input(page);
  const d1 = inp.hands[1];
  await frames(page, 1);
  const d2 = (await input(page)).hands[1];
  await controller(page, "right", { trigger: 0 });
  await frames(page, 1);
  const d3 = (await input(page)).hands[1];
  await frames(page, 1);
  const d4 = (await input(page)).hands[1];
  check(d1.trigger === 1 && d1.triggerDown && d1.holding && !d2.triggerDown && d2.holding && d3.trigger === 0 && d3.triggerUp && !d3.holding && !d4.triggerUp, "the trigger gives its value and one-frame down and up edges", { d1: [d1.trigger, d1.triggerDown, d1.holding], d2: [d2.triggerDown, d2.holding], d3: [d3.trigger, d3.triggerUp], d4: d4.triggerUp });
  await controller(page, "left", { squeeze: 0.8 });
  await frames(page, 1);
  const g1 = (await input(page)).hands[0];
  await frames(page, 1);
  const g2 = (await input(page)).hands[0];
  await controller(page, "left", { squeeze: 0.2 });
  await frames(page, 1);
  const g3 = (await input(page)).hands[0];
  check(near(g1.grip, 0.8, 1e-3) && g1.gripDown && !g2.gripDown && g3.gripUp && near(g3.grip, 0.2, 1e-3), "the grip gives its value and edges at 0.7 and 0.4", { g1: [g1.grip, g1.gripDown], g2: g2.gripDown, g3: [g3.grip, g3.gripUp] });
  const ev0 = (await state(page)).frame;
  await controller(page, "left", { stick: [0.1, 0.08] });
  await frames(page, 1);
  const dz = (await input(page)).move;
  await controller(page, "left", { stick: [0, -1] });
  await controller(page, "right", { stick: [0.5, 0] });
  await frames(page, 1);
  inp = await input(page);
  check(dz.x === 0 && dz.y === 0 && near(inp.move.y, 1, 1e-3) && near(inp.move.x, 0, 1e-6) && near(inp.turn, 0.5, 1e-3), "the left stick moves (y = −axes[3], 0.15 dead zone), the right stick turns", { dead: dz, move: inp.move, turn: inp.turn });
  await controller(page, "left", { stick: [0, 0] });
  await controller(page, "right", { stick: [0, 0] });
  await controller(page, "right", { buttons: { "a-button": 1 } });
  await frames(page, 1);
  const j1 = (await input(page)).jumpDown;
  await frames(page, 1);
  const j2 = (await input(page)).jumpDown;
  await controller(page, "right", { buttons: { "a-button": 0 } });
  await controller(page, "left", { buttons: { "y-button": 1 } });
  await frames(page, 1);
  const m1 = await input(page), p1 = await state(page);
  await controller(page, "left", { buttons: { "y-button": 0 } });
  await frames(page, 1);
  await controller(page, "right", { buttons: { "b-button": 1 } });
  await frames(page, 1);
  const p2 = await state(page);
  await controller(page, "right", { buttons: { "b-button": 0 } });
  await frames(page, 2);
  check(j1 && !j2, "A gives one jumpDown edge");
  check(m1.menuDown && p1.paused && p1.state === "paused" && !p2.paused && p2.state === "play", "Y opens the pause menu and B closes it (menuDown)", { menu: m1.menuDown, p1: p1.state, p2: p2.state });
  check((await newEvents(page, ev0)).every((e) => e.type !== "fire"), "no rope fires while testing the buttons");

  /* ---- fire at a building: aim the real controller through toLocal ---- */
  const S = await page.evaluate(() => ({ ...G.city.start, ring: G.city.goldRing }));
  await page.evaluate((S) => G.test.teleport(S.x, S.y, S.z), S);
  await frames(page, 3);
  // the gold ring's spot on the tower face, and a point 0.5 m past it along the ray (inside the tower)
  const cpos = [0.25, 1.35, -0.3];
  const cw = await page.evaluate((c) => G.test.toWorld(c[0], c[1], c[2]), cpos);
  const rd = sub(S.ring, cw), rl = Math.hypot(...rd);
  const target = { x: S.ring.x + (rd[0] / rl) * 0.5, y: S.ring.y + (rd[1] / rl) * 0.5, z: S.ring.z + (rd[2] / rl) * 0.5 };
  const tl = await page.evaluate((t) => G.test.toLocal(t.x, t.y, t.z), target);
  await controller(page, "right", { pos: cpos, quat: lookQuat(sub(tl, { x: cpos[0], y: cpos[1], z: cpos[2] })) });
  await frames(page, 3);
  const aim = await page.evaluate(() => G.test.aim(1));
  check(aim && aim.valid && aim.tag === "building" && Math.hypot(aim.x - S.ring.x, aim.y - S.ring.y, aim.z - S.ring.z) < 0.05, "aiming the controller at a tower face through toLocal gives a valid target there", { aim, ring: S.ring });
  const f0 = (await state(page)).frame;
  await controller(page, "right", { trigger: 1 });
  for (let i = 0; i < 40 && (await state(page)).ropes[1].state !== "attached"; i++) await frames(page, 1);
  let s = await state(page);
  const evA = await newEvents(page, f0);
  check(s.ropes[1].state === "attached" && evA.some((e) => e.type === "fire" && e.side === 1) && evA.some((e) => e.type === "attach" && e.side === 1), "the trigger fires the rope and it attaches (stub rope, real physics)", { rope: s.ropes[1], events: evA.map((e) => e.type) });

  /* ---- a real yank: pull the controller back fast ---- */
  const pull0 = await state(page);
  const anchorL = await page.evaluate((a) => G.test.toLocal(a.x, a.y, a.z), pull0.ropes[1].anchor);
  let u = sub(anchorL, { x: cpos[0], y: cpos[1], z: cpos[2] });
  const ul = Math.hypot(...u);
  u = u.map((v) => v / ul);
  const f1 = pull0.frame;
  const p = cpos.slice();
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 3; k++) p[k] -= u[k] * 0.1; // 0.1 m per 16 ms frame: 6.25 m/s straight away from the anchor
    await controller(page, "right", { pos: p.slice() });
    await frames(page, 1);
  }
  const evY = await newEvents(page, f1);
  const yk = evY.find((e) => e.type === "yank" && e.side === 1);
  check(!!yk && yk.strength > 1 && !yk.pump, "a fast pull of the real controller gives a yank event", evY.map((e) => e.type + ":" + (e.strength || 0).toFixed?.(2)));
  const vy = await state(page);
  check(Math.hypot(vy.vel.x, vy.vel.y, vy.vel.z) > 3, "the yank throws the body toward the anchor", vy.vel);

  /* ---- a synthetic yank (G.test.yank), after the cooldown ---- */
  await run(page, 450);
  const f2 = (await state(page)).frame;
  await page.evaluate(() => G.test.yank(1, 4));
  await frames(page, 1);
  const evT = await newEvents(page, f2);
  check(evT.some((e) => e.type === "yank" && e.side === 1 && Math.abs(e.strength - (4 - 1.2)) < 1e-6), "G.test.yank gives a yank event of the right strength", evT);

  /* ---- a scripted swing: reel in with the grip, then ride it ---- */
  const sw0 = await state(page);
  let airborne = false, far = 0;
  await controller(page, "right", { squeeze: 1 });
  for (let i = 0; i < 12; i++) { await frames(page, 5); s = await state(page); airborne ||= !s.onGround; far = Math.max(far, Math.hypot(s.pos.x - S.x, s.pos.y - S.y, s.pos.z - S.z)); }
  await controller(page, "right", { squeeze: 0 });
  for (let i = 0; i < 12; i++) { await frames(page, 5); s = await state(page); airborne ||= !s.onGround; far = Math.max(far, Math.hypot(s.pos.x - S.x, s.pos.y - S.y, s.pos.z - S.z)); }
  check(airborne && far > 8, "a scripted swing (reel, then ride) carries the player off the roof", { far: far.toFixed(1), from: sw0.pos, now: s.pos, rope: s.ropes[1].state });
  await shot(page, "xr-swing");
  await controller(page, "right", { trigger: 0 });
  await frames(page, 2);

  /* ---- the G.test hooks inside the XR loop ---- */
  const px = page.evaluate(() => G.test.sample([[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]]));
  await frames(page, 2);
  const pix = await px;
  const ri = await page.evaluate(() => G.test.renderInfo());
  const rt = await page.evaluate(() => { const w = G.test.toWorld(0.3, 1.2, -0.4), l = G.test.toLocal(w.x, w.y, w.z); return Math.hypot(l.x - 0.3, l.y - 1.2, l.z + 0.4); });
  check(pix.filter((q) => q[0] + q[1] + q[2] > 60).length >= 2, "G.test.sample reads pixels inside the XR frame (not black)", pix);
  check(ri.views === 2 && ri.calls > 0 && ri.tris > 0, "renderInfo counts two views in the XR session", ri);
  check(rt < 1e-9, "toLocal undoes toWorld in XR", rt);

  /* ---- snap turn keeps the head in place ---- */
  await page.evaluate((S) => G.test.teleport(S.x, S.y, S.z), S);
  await frames(page, 4);
  const t0 = await state(page);
  await controller(page, "right", { stick: [1, 0] });
  await frames(page, 1);
  const t1 = await state(page);
  await frames(page, 4);
  const t2 = await state(page);
  await controller(page, "right", { stick: [0, 0] });
  await frames(page, 1);
  const dyaw = t1.rig.yaw - t0.rig.yaw;
  check(near(dyaw, -Math.PI / 4, 1e-6) && dist2(t1.head, t0.head) < 0.01 && near(t1.head.y, t0.head.y, 1e-6), "a snap turn turns 45° right and keeps the head in place", { dyaw, head0: t0.head, head1: t1.head });
  check(near(t2.rig.yaw, t1.rig.yaw, 1e-9), "a held stick snaps once until it comes back to centre", { t1: t1.rig.yaw, t2: t2.rig.yaw });

  /* ---- blur: pause, hide the hands, freeze; visible again opens the pause menu ---- */
  await visibility(page, "visible-blurred");
  await frames(page, 2);
  const b0 = await state(page);
  await frames(page, 10);
  const b1 = await state(page);
  check(!b0.visible && !b0.handsVisible && dist2(b0.pos, b1.pos) < 1e-9 && b0.pos.y === b1.pos.y, "a blurred session hides the hands and freezes the game", { visible: b0.visible, hands: b0.handsVisible });
  await visibility(page, "visible");
  await frames(page, 2);
  const b2 = await state(page);
  check(b2.visible && b2.handsVisible && b2.paused && b2.state === "paused", "the session coming back opens the pause menu", { visible: b2.visible, state: b2.state });
  await page.evaluate(() => G.test.uiPress("resume"));
  await frames(page, 2);
  check((await state(page)).state === "play", "Resume goes back to play");

  /* ---- reset: recentring keeps the body where it is ---- */
  await head(page, { pos: [0.35, 1.6, 0.25] });
  await frames(page, 3);
  await remote(page, "set_transform", { device: "headset", position: { x: 0.4, y: 1.6, z: 0.3 } });
  await frames(page, 3);
  const r0 = await state(page);
  await recenter(page);
  await frames(page, 3);
  const r1 = await state(page);
  check(Math.hypot(r0.headLocal.x, r0.headLocal.z) > 0.4 && Math.hypot(r1.headLocal.x, r1.headLocal.z) < 0.01, "xrDevice.recenter() moves the tracking origin to the head", { before: r0.headLocal, after: r1.headLocal });
  check(dist2(r0.pos, r1.pos) < 0.01 && dist2(r0.head, r1.head) < 0.02 && near(r0.rig.yaw, r1.rig.yaw, 1e-9), "a reset keeps the body, the head's world position and the yaw", { pos0: r0.pos, pos1: r1.pos, head0: r0.head, head1: r1.head });

  /* ---- hands: pinch to fire, the palm gate ---- */
  await inputMode(page, "hand");
  await frames(page, 3);
  await hand(page, "right", { pos: [0.2, 1.3, -0.35], quat: [0, 0, 0, 1], pose: "default", pinch: 0 });
  await hand(page, "left", { pos: [-0.2, 1.3, -0.35], quat: [0, 0, 0, 1], pose: "default", pinch: 0 });
  await frames(page, 3);
  inp = await input(page);
  check(inp.kind === "hand" && inp.hands.every((h) => h.connected && h.kind === "hand" && h.joints && h.joints.length === 100), "switching to hands gives kind hand with 25 joints each", inp.hands.map((h) => [h.side, h.kind, h.joints && h.joints.length]));
  check(!inp.hands[1].palmUp && inp.hands[1].trigger === 0, "a relaxed hand, palm down, gives no trigger", { palmUp: inp.hands[1].palmUp, trigger: inp.hands[1].trigger });
  await hand(page, "right", { pose: "pinch", pinch: 1 });
  await frames(page, 1);
  const h1 = (await input(page)).hands[1];
  check(h1.trigger > 0.99 && h1.triggerDown && h1.holding, "a pinch is the trigger (down edge, holding)", { trigger: h1.trigger, down: h1.triggerDown });
  await hand(page, "right", { pose: "default", pinch: 0 });
  await frames(page, 1);
  const h2 = (await input(page)).hands[1];
  await frames(page, 15);
  const h3 = (await input(page)).hands[1];
  check(h2.trigger === 0 && h2.triggerUp && h2.holding && !h3.holding, "an opened pinch keeps holding for 0.2 s (pinch grace)", { h2: [h2.trigger, h2.triggerUp, h2.holding], h3: h3.holding });
  // turn the palm toward the head (the system gesture zone): roll 180° and tip it back toward the face
  const palmUp = mulQuat(axisQuat([1, 0, 0], 1.1), axisQuat([0, 0, 1], Math.PI));
  await hand(page, "right", { quat: palmUp, pose: "pinch", pinch: 1 });
  let downs = 0;
  for (let i = 0; i < 4; i++) { await frames(page, 1); const hh = (await input(page)).hands[1]; if (hh.triggerDown) downs++; }
  const g4 = (await input(page)).hands[1];
  check(g4.palmUp && g4.trigger === 0 && downs === 0, "the palm gate: a pinch with the palm toward the head gives no trigger", { palmUp: g4.palmUp, trigger: g4.trigger, downs });
  await hand(page, "right", { quat: [0, 0, 0, 1] });
  await frames(page, 2);
  const g5 = (await input(page)).hands[1];
  await hand(page, "right", { pose: "default", pinch: 0 });
  await frames(page, 2);
  await hand(page, "right", { pose: "pinch", pinch: 1 });
  await frames(page, 1);
  const g6 = (await input(page)).hands[1];
  check(!g5.palmUp && g5.trigger === 0 && g6.trigger > 0.99 && g6.triggerDown, "the gated pinch stays ignored until the hand reopens with the palm away", { g5: [g5.palmUp, g5.trigger], g6: [g6.trigger, g6.triggerDown] });
  await hand(page, "right", { pose: "default", pinch: 0 });
  await inputMode(page, "controller");
  await frames(page, 3);
  inp = await input(page);
  check(inp.kind === "controller" && inp.hands.every((h) => h.connected && h.kind === "controller"), "switching back gives controllers again");

  /* ---- Exit ---- */
  await page.evaluate(() => { G.ui.openPause(); });
  await frames(page, 1);
  await page.evaluate(() => G.test.uiPress("exit"));
  for (let i = 0; i < 20 && (await page.evaluate(() => !!G.xr.session)); i++) await run(page, 50);
  await run(page, 100);
  const ex = await page.evaluate(() => ({ session: !!G.xr.session, mode: G.mode, state: G.state, title: !document.querySelector("#title").hidden, re: !document.querySelector("#reenter").hidden, label: document.querySelector("#reenterBtn").textContent }));
  check(!ex.session && ex.mode === "title" && ex.title && ex.re && /RE-ENTER/.test(ex.label), "Exit ends the session and the title shows RE-ENTER", ex);
  check(page.errors.length === 0, "no errors in the VR session", page.errors);
  await page.context().close();
} catch (e) { check(false, "the VR run threw", e.stack || String(e)); }

/* ================= AR with a synthetic room ================= */
try {
  const page = await newPage({ width: 640, height: 360 });
  await open(page, "?emulate=ar&room=office_small&skipintro");
  const sem = await page.evaluate(() => ({ planes: window.xrDevice.sem ? window.xrDevice.sem.trackedPlanes.size : 0 }));
  await enterXR(page, "ar");
  const init = await page.evaluate(() => ({ init: G.xr.lastInit, features: G.xr.features, blend: G.xr.session.environmentBlendMode }));
  check(["plane-detection", "mesh-detection", "hit-test"].every((f) => init.init.optionalFeatures.includes(f) && init.features.includes(f)), "ENTER MIXED REALITY asks for and gets the spatial features", init);
  check(init.blend === "alpha-blend", "the AR session blends over passthrough", init.blend);
  await waitFor(page, () => G.xr.planes.size > 0 && G.xr.meshes.size > 0, null, 60000);
  const pl = await page.evaluate(() => {
    const planes = [...G.xr.planes.values()], meshes = [...G.xr.meshes.values()];
    return { n: planes.length, m: meshes.length, labels: planes.map((p) => p.label), walls: planes.filter((p) => p.orientation === "vertical").length, poly: planes.every((p) => p.polygon.length >= 3 && p.version >= 1), mat: planes.every((p) => p.matrix.elements.some((v, i) => i === 15 ? v === 1 : v !== 0)) };
  });
  check(pl.n >= 5 && pl.labels.includes("wall") && pl.walls >= 2 && pl.poly && pl.mat && pl.m >= 1, "X.planes and X.meshes fill from the room", { ...pl, semPlanes: sem.planes });
  const s = await state(page);
  check(s.mode === "ar" && (s.state === "play" || s.state === "intro"), "the AR session runs the game", { mode: s.mode, state: s.state });
  await shot(page, "xr-ar");
  check(page.errors.length === 0, "no errors in the AR session", page.errors);
  await page.context().close();
} catch (e) { check(false, "the AR run threw", e.stack || String(e)); }

await close();
done();
