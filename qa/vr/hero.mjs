// Checks the third-person hero and the chase camera in flat play (js/hero.js, js/flatcam.js and their wiring in main.js): third
// person by default, the camera behind and above, the pull-in near walls, V and first person, ropes from the hero's hands, the
// poses, the model and the built-in fallback, the draw budget, the intro, and that the headset is untouched.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/hero.mjs
import { start, newPage, open, close, enterXR, waitState, waitFor, state, checker, watchdog, shot, sleep } from "./lib.mjs";

const { check, done } = checker("hero");
watchdog(1500000, "hero");
const hz = (v) => Math.hypot(v.x, v.z);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* helpers that run in the page */
async function install(page) {
  await page.evaluate(() => {
    window.__h = {
      step: (n = 1, dt = 1 / 60) => { G.test.step(dt, n); return G.test.flat(); },
      // draws one frame by hand (the loop is off: the software renderer takes seconds a frame) and reads pixels in the same task
      draw() { G.renderer.render(G.scene, G.camera); const i = G.renderer.info.render; return { calls: i.calls, tris: i.triangles }; },
      px(points) {
        __h.draw();
        const gl = G.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, b = new Uint8Array(4);
        return points.map(([x, y]) => { gl.readPixels(Math.min(w - 1, Math.max(0, Math.floor(w * x))), Math.min(h - 1, Math.max(0, Math.floor(h * (1 - y)))), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return [b[0], b[1], b[2], b[3]]; });
      },
      // a spot on a lower roof, gap metres from the wall of the tier above it: { x, y, z, dx, dz } with (dx, dz) toward the wall
      wall(gap = 1.2) {
        const c = G.city;
        for (const b of c.buildings) {
          for (let i = 1; i < b.tiers.length; i++) {
            const L = b.tiers[i - 1], U = b.tiers[i];
            if (Math.abs(L.y1 - U.y0) > 0.5 || U.maxX - U.minX < 6 || U.maxZ - U.minZ < 6) continue;
            const mx = (U.minX + U.maxX) / 2, mz = (U.minZ + U.maxZ) / 2;
            const cands = [{ x: U.minX - gap, z: mz, dx: 1, dz: 0 }, { x: U.maxX + gap, z: mz, dx: -1, dz: 0 }, { x: mx, z: U.minZ - gap, dx: 0, dz: 1 }, { x: mx, z: U.maxZ + gap, dx: 0, dz: -1 }];
            for (const q of cands) {
              const tb = c.topBelow(q.x, L.y1 + 0.6, q.z, 0.3);
              if (!tb || Math.abs(tb.y - L.y1) > 0.2) continue;
              const hit = c.raycast(q.x, L.y1 + 1.3, q.z, q.dx, 0, q.dz, gap + 3, {});
              if (!hit || Math.abs(hit.t - gap) > 0.3) continue;
              return { ...q, y: L.y1, t: hit.t };
            }
          }
        }
        return null;
      },
      // a target on a face ahead and up, for ropes: the first ray of a fan that hits 25-90 m away
      target(x, y, z) {
        const c = G.city, S = c.start, o = { x, y: y + 1.6, z };
        for (const el of [0.6, 0.75, 0.9, 0.5]) for (const az of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9]) {
          const ya = S.yaw + az, fx = -Math.sin(ya), fz = -Math.cos(ya);
          const r = c.raycast(o.x, o.y, o.z, fx * Math.cos(el), Math.sin(el), fz * Math.cos(el), 90, {});
          if (r && r.t > 25) return { x: r.x, y: r.y, z: r.z };
        }
        return null;
      },
    };
  });
}
const S = (page) => state(page);
const flat = (page) => page.evaluate(() => G.test.flat());
const step = (page, n = 1) => page.evaluate((n) => __h.step(n), n);
// releases every key and both ropes, and puts the hero back on the start roof
async function reset(page) {
  await page.keyboard.up("KeyW"); await page.keyboard.up("KeyD"); await page.keyboard.up("KeyA");
  await page.evaluate(() => {
    G.test.press(0, false); G.test.press(1, false); G.test.aimAt(0, null); G.test.aimAt(1, null);
    G.P.frozen = false;
    const s = G.city.start;
    G.test.teleport(s.x, s.y, s.z);
    __h.step(30);
  });
}

/* ================= the model, in flat play ================= */
let page = null, f = null, s = null;
try {
  page = await start("skipintro&god", { width: 320, height: 180 });
  await install(page);
  await enterXR(page, "desktop");
  await waitState(page, { mode: "desktop", state: "play" }, 240000);
  await waitFor(page, () => G.hero && G.hero.model !== "loading", null, 120000);
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await step(page, 120);

  const info0 = await page.evaluate(() => ({ model: G.hero.model, tris: G.hero.tris, parent: G.camera.parent === G.scene, hasFlat: !!G.flatcam, hasHero: !!G.hero, kind: G.test.input().kind }));
  check(info0.hasHero && info0.hasFlat, "G.hero and G.flatcam are exposed", info0);
  check(info0.model === "glb" && info0.tris > 10000 && info0.tris < 14000, "the crew5 model loads (12.5k triangles)", info0);
  check(info0.parent, "the flat camera is a child of the scene, not of the rig");

  /* ---- third person by default ---- */
  f = await flat(page); s = await S(page);
  check(f.on && !f.firstPerson, "flat play starts in third person", { on: f.on, fp: f.firstPerson });
  {
    const yaw = f.yaw, fw = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const rel = { x: f.camera.x - s.pos.x, y: f.camera.y - (s.pos.y + 1.25), z: f.camera.z - s.pos.z };
    const behind = -(rel.x * fw.x + rel.z * fw.z), side = Math.abs(rel.x * fw.z - rel.z * fw.x);
    check(behind > 3.8 && behind < 4.8 && side < 0.05, "the camera sits 4.5 m behind the hero", { behind, side });
    check(rel.y > 0.9 && rel.y < 2.2, "and about 1.2 m above the chest", rel);
    check(Math.abs(f.dist - 4.5) < 0.15, "the spring arm is 4.5 m long at rest", f.dist);
  }
  // the hero draws: red jersey pixels near the hero's chest on screen
  const px = await page.evaluate(async () => {
    const T = G.camera.position.constructor, h = G.test.state().pos, c = G.camera;
    const grid = [];
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const v = new T(h.x, h.y + 1.3, h.z).project(c);
      grid.push([(v.x + 1) / 2 + a * 0.008, (1 - v.y) / 2 + b * 0.012]);
    }
    const on = __h.px(grid);
    return on.filter(([r, g, b]) => r > 120 && r > g * 1.6 && r > b * 1.6).length;
  });
  check(px >= 6, "the hero is drawn (red jersey pixels at the chest)", px);
  const head = await page.evaluate(() => { const v = G.hero.head.clone().project(G.camera); return { x: v.x, y: v.y, z: v.z }; });
  check(Math.abs(head.x) < 0.2 && head.y > -0.3 && head.y < 0.6 && head.z < 1, "the camera looks at the hero (the head is near the middle of the view)", head);
  // the chase view looks down at the hero's feet: the auto target must not take the roof under them but a building up and ahead
  const da = await page.evaluate(() => { __h.step(2); const a = G.test.aim(1), h = G.test.state().head; return a && { valid: a.valid, ny: a.ny, x: a.x, y: a.y, z: a.z, dist: a.dist, headY: h.y }; });
  check(da && da.valid && !(da.ny > 0.7 && da.y < da.headY - 0.3) && da.y > da.headY, "the auto target from the chase view is a building up and ahead, not the roof under the hero", da);
  await shot(page, "hero-third-person");

  /* ---- the mouse turns the camera (input.turn and input.pitch) ---- */
  {
    const b = await flat(page);
    await page.evaluate(() => { G.desktop.locked = true; window.dispatchEvent(new MouseEvent("mousemove", { movementX: -200, movementY: -100 })); });
    const a = await step(page, 3);
    await page.evaluate(() => { G.desktop.locked = false; });
    const dy = wrapA(a.yaw - b.yaw), dp = a.pitch - b.pitch;
    check(Math.abs(dy - 0.44) < 0.03 && Math.abs(dp - 0.22) < 0.03, "a mouse move turns the view like a mouse (0.0022 rad per pixel)", { dy, dp });
    check(Math.abs(a.forward.y - Math.sin(a.pitch)) < 1e-6, "the camera looks along its yaw and pitch", a.forward);
    // the pitch is limited to -60 to +70 degrees
    await page.evaluate(() => { G.test.look(0, 3); });
    let c = await step(page, 3);
    check(Math.abs(c.pitch - (70 * Math.PI) / 180) < 0.01, "the pitch stops at +70 degrees", c.pitch);
    await page.evaluate(() => { G.test.look(0, -6); });
    c = await step(page, 3);
    check(Math.abs(c.pitch - (-60 * Math.PI) / 180) < 0.01, "and at -60 degrees", c.pitch);
    await page.evaluate(() => { G.test.look(0, 0.9); });
    await step(page, 3);
  }

  /* ---- movement is relative to the camera ---- */
  await page.evaluate(() => G.test.look(Math.PI / 2, 0));
  await step(page, 3);
  await page.keyboard.down("KeyW");
  await step(page, 50);
  f = await flat(page); s = await S(page);
  {
    const fw = { x: f.forward.x, z: f.forward.z }, l = Math.hypot(fw.x, fw.z), vl = hz(s.vel);
    check(vl > 2 && (fw.x * s.vel.x + fw.z * s.vel.z) / (l * vl) > 0.95, "W runs the way the camera looks", { vel: s.vel, fw });
    check(f.hero.pose === "run" && f.hero.weights.run > 0.6, "the hero runs (pose run)", f.hero);
    const want = Math.atan2(-s.vel.x, -s.vel.z);
    check(Math.abs(wrapA(f.hero.yaw - want)) < 0.25, "the hero faces the way it runs", { yaw: f.hero.yaw, want });
  }
  await page.keyboard.up("KeyW");
  await page.keyboard.down("KeyD");
  await step(page, 50);
  f = await flat(page); s = await S(page);
  {
    // D moves to the camera's right; the hero turns that way
    const right = { x: Math.cos(f.yaw), z: -Math.sin(f.yaw) }, vl = hz(s.vel);
    check(vl > 2 && (right.x * s.vel.x + right.z * s.vel.z) / vl > 0.95, "D moves to the camera's right", { vel: s.vel, right });
    check(Math.abs(wrapA(f.hero.yaw - Math.atan2(-s.vel.x, -s.vel.z))) < 0.3, "the hero turns to face its move direction on the ground", { yaw: f.hero.yaw });
  }
  await page.keyboard.up("KeyD");
  await reset(page);

  /* ---- idle on the roof ---- */
  await step(page, 90);
  f = await flat(page);
  check(f.hero.pose === "idle" && f.hero.weights.run < 0.05 && f.hero.weights.air < 0.05, "idle on the roof", f.hero);
  const idleHands = f.hero.hands.map((h) => h.slice());

  /* ---- collision pull-in near a wall ---- */
  const w = await page.evaluate(() => __h.wall(1.2));
  check(!!w, "there is a roof with a wall next to it (a setback tier)", w);
  if (w) {
    await page.evaluate((w) => { G.test.teleport(w.x, w.y, w.z); __h.step(10); }, w);
    // the camera looks away from the wall, so it sits between the hero and the wall
    const yawAway = Math.atan2(w.dx, w.dz), cur = (await flat(page)).yaw;
    await page.evaluate((d) => G.test.look(d, 0), wrapA(yawAway - cur));
    // start with the camera out at full length (walk away and back is not needed: it lets out slowly, so give it time first)
    await step(page, 5);
    f = await flat(page);
    check(f.blocked && f.dist < 3 && f.dist >= 0.35, "the camera pulls in when a wall is behind the hero", { dist: f.dist, blocked: f.blocked });
    check(f.opacity < 1, "the hero fades when the camera is closer than 1.5 m", { opacity: f.opacity, dist: f.dist });
    const inside = await page.evaluate(() => G.city.collideSphere(G.camera.position.x, G.camera.position.y, G.camera.position.z, 0.15, {}));
    check(!inside, "the camera is not inside a building", f.camera);
    // it lets out again when you turn the camera around (slowly)
    await page.evaluate(() => G.test.look(Math.PI, 0));
    await step(page, 120);
    f = await flat(page);
    check(f.dist > 4.2 && f.opacity > 0.99, "the arm lets out again in the open", { dist: f.dist, opacity: f.opacity });
  }
  await reset(page);
  // every yaw and pitch, on many roofs and streets: the camera is never inside a collider or under the street
  const sweep = await page.evaluate(async () => {
    const { createFlatCam } = await import("/vr/js/flatcam.js");
    const THREE = await import("three");
    const c = G.city, cam = new THREE.PerspectiveCamera(70, 1.78, 0.1, 4000), fc = createFlatCam(cam, c);
    const P = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, chest: 1.25 };
    let n = 0, bad = 0, low = 0, minD = 99, first = null;
    const spots = [];
    for (let i = 0; i < c.buildings.length; i += Math.max(1, Math.floor(c.buildings.length / 40))) {
      const b = c.buildings[i];
      spots.push([b.x, b.roofY, b.z], [b.x + b.w / 2 - 1.5, b.roofY, b.z], [b.x, b.roofY, b.z - b.d / 2 + 1.2]);
    }
    for (let i = 0; i < 40; i++) spots.push([-300 + i * 15, 0, -200 + ((i * 37) % 200)], [-300 + i * 15, 30 + (i % 5) * 20, -100]);
    for (const [x, y, z] of spots) {
      if (c.collideSphere(x, y + 1.5, z, 0.4, {})) continue; // a pivot inside a building is not a place to stand
      for (let k = 0; k < 16; k++) for (const p of [-1.0, -0.27, 0, 0.6, 1.2]) {
        P.pos.x = x; P.pos.y = y; P.pos.z = z;
        fc.reset((k / 16) * Math.PI * 2, p, false);
        fc.update(0.016, P, null, { dx: 0, dy: 0 }, {});
        n++;
        const q = cam.position;
        if (c.collideSphere(q.x, q.y, q.z, 0.12, {})) { bad++; if (!first) first = { x, y, z, k, p, cam: q.toArray() }; }
        if (q.y < 0.3 - 1e-6 && y < 5) low++;
        minD = Math.min(minD, fc.dist);
      }
    }
    return { n, bad, low, minD, first };
  });
  check(sweep.n > 3000 && sweep.bad === 0 && sweep.low === 0 && sweep.minD >= 0.34, "the camera is never inside a building or below the street (" + sweep.n + " views)", sweep);

  /* ---- V and first person ---- */
  await reset(page);
  await step(page, 30);
  await page.keyboard.press("KeyV");
  f = await step(page, 90);
  s = await S(page);
  check(f.firstPerson && f.blend === 0, "V switches to first person", { fp: f.firstPerson, blend: f.blend });
  check(Math.hypot(f.camera.x - s.head.x, f.camera.y - s.head.y, f.camera.z - s.head.z) < 0.05, "the first-person camera sits at the hero's eyes", { cam: f.camera, head: s.head });
  check(!(await page.evaluate(() => G.hero.root.visible)) && f.opacity < 0.05, "the hero is hidden in first person");
  check((await page.evaluate(() => document.body.dataset.view)) === "first", "body[data-view] says first (the page hides the third-person crosshair with it)");
  // the muzzles sit low in the first-person view, about 30 degrees under the view axis, and the mouse looks up to 85 degrees
  const mz = await page.evaluate(() => { const c = G.camera; c.updateMatrixWorld(true); const l = c.worldToLocal(G.hands.tip(1).clone()); return { x: l.x, y: l.y, z: l.z, below: (Math.atan2(-l.y, -l.z) * 180) / Math.PI }; });
  check(Math.abs(mz.below - 29.7) < 2.5 && mz.x > 0.15, "in first person the right muzzle sits low and to the right in the view (about 30 degrees under the axis)", mz);
  const pitch0 = f.pitch;
  await page.evaluate(() => { G.desktop.locked = true; for (let i = 0; i < 6; i++) window.dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: -200 })); });
  f = await step(page, 3);
  await page.evaluate(() => { G.desktop.locked = false; });
  check(Math.abs(f.pitch - (85 * Math.PI) / 180) < 0.01, "in first person the mouse looks up to 85 degrees", f.pitch);
  await page.evaluate((d) => G.test.look(0, d), pitch0 - f.pitch); // back to the pitch it had
  await step(page, 3);
  await page.keyboard.press("KeyV");
  f = await step(page, 90);
  check(!f.firstPerson && f.blend === 1 && Math.abs(f.dist - 4.5) < 0.15, "V again returns to third person", { fp: f.firstPerson, blend: f.blend, dist: f.dist });
  check(await page.evaluate(() => G.hero.root.visible), "and the hero shows again");
  check((await page.evaluate(() => document.body.dataset.view)) === "third", "body[data-view] says third");
  // the input edge (pad Y, the touch eye button) toggles too, and an edge together with the V key is one toggle
  // (an edge lasts one frame: true on the next call, false on the one after)
  const edge = () => page.evaluate(() => {
    const D = G.desktop, orig = D.update;
    let n = 0;
    D.update = (dt) => { const i = orig(dt); i.viewDown = n++ === 0; if (n > 1) D.update = orig; return i; };
  });
  await edge();
  f = await step(page, 90);
  check(f.firstPerson, "an input.viewDown edge toggles the view", f.firstPerson);
  await edge();
  await page.keyboard.press("KeyV");
  f = await step(page, 90);
  check(!f.firstPerson, "viewDown and V in one frame are one toggle", f.firstPerson);

  /* ---- ropes start at the hero's hands ---- */
  await reset(page);
  const tgt = await page.evaluate(() => { const s = G.city.start; return __h.target(s.x, s.y, s.z); });
  check(!!tgt, "a swing target exists ahead of the start roof", tgt);
  await page.evaluate((t) => { G.test.aimAt(1, t.x, t.y, t.z); G.test.press(1, true); }, tgt);
  await step(page, 25);
  s = await S(page);
  check(s.ropes[1].state === "attached", "the right rope attaches", s.ropes[1]);
  const rp = await page.evaluate(() => {
    const ri = G.ropes.info(), h = G.hero.hand(1), m = G.hands.tip(1);
    const from = ri.ropes[1].to;
    return { from, hand: h.toArray(), muzzle: m.toArray(), d: Math.hypot(from[0] - h.x, from[1] - h.y, from[2] - h.z), dm: Math.hypot(from[0] - m.x, from[1] - m.y, from[2] - m.z), chest: Math.hypot(h.x - G.P.pos.x, h.y - G.P.pos.y - 1.25, h.z - G.P.pos.z) };
  });
  check(rp.d < 0.02, "in third person the rope starts at the hero's hand", rp);
  check(rp.dm > 0.3 && rp.chest < 1.3, "not at the first-person muzzle; the hand is at the hero's body", rp);
  // the arm reaches along the rope: the hand is on the line from the hero to the anchor
  {
    const a = s.ropes[1].anchor, hd = rp.hand, p = s.pos, cy = p.y + 1.25;
    const v = [a.x - p.x, a.y - cy, a.z - p.z], u = [hd[0] - p.x, hd[1] - cy, hd[2] - p.z];
    const cos = (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (Math.hypot(...v) * Math.hypot(...u));
    f = await flat(page);
    check(cos > 0.9 && f.hero.weights.reach[1] > 0.9 && f.hero.hands[1][1] > idleHands[1][1] + 0.2, "the rope arm reaches along the rope to the anchor (the hand is up, toward the anchor)", { cos, reach: f.hero.weights.reach, y: f.hero.hands[1][1], idleY: idleHands[1][1] });
  }
  // in first person the ropes leave the muzzles again
  await page.keyboard.press("KeyV");
  await step(page, 90);
  const rp2 = await page.evaluate(() => { const ri = G.ropes.info(), m = G.hands.tip(1), from = ri.ropes[1].to; return { d: Math.hypot(from[0] - m.x, from[1] - m.y, from[2] - m.z), from, m: m.toArray() }; });
  check(rp2.d < 0.02, "in first person the rope starts at the muzzle, as before", rp2);
  await page.keyboard.press("KeyV");
  await step(page, 90);
  await reset(page);

  /* ---- poses change with the state ---- */
  // fall: high in the air, falling fast
  await page.evaluate(() => { G.test.teleport(G.city.start.x, G.city.start.y + 40, G.city.start.z); const P = G.P; P.onGround = false; P.vel.y = -20; P.vel.x = 0; P.vel.z = 0; __h.step(8); });
  f = await flat(page);
  const fallW = Math.hypot(f.hero.hands[0][0] - f.hero.hands[1][0], f.hero.hands[0][2] - f.hero.hands[1][2]), idleW = Math.hypot(idleHands[0][0] - idleHands[1][0], idleHands[0][2] - idleHands[1][2]);
  check(f.hero.pose === "fall" && f.hero.weights.air > 0.6, "falling fast gives the fall pose", f.hero);
  check(fallW > idleW + 0.4 && f.hero.hands[0][1] > idleHands[0][1] + 0.15, "in the fall the arms are out and up", { fallW, idleW, y: f.hero.hands[0][1], idleY: idleHands[0][1] });
  // jump: rising
  await page.evaluate(() => { const P = G.P; P.vel.y = 6; P.vel.x = 2; __h.step(4); });
  f = await flat(page);
  check(f.hero.pose === "jump", "rising gives the jump pose", f.hero.pose);
  // swing: a rope attached in the air
  await reset(page);
  const t2 = await page.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y + 25, s.z); G.P.onGround = false; return __h.target(s.x, s.y + 25, s.z); });
  await page.evaluate((t) => { G.test.aimAt(1, t.x, t.y, t.z); G.test.press(1, true); __h.step(30); }, t2);
  f = await flat(page); s = await S(page);
  check(s.ropes[1].state === "attached" && !s.onGround && f.hero.pose === "swing" && f.hero.weights.swing > 0.6, "a rope in the air gives the swing pose", { pose: f.hero.pose, rope: s.ropes[1].state, swing: f.hero.weights.swing });
  await shot(page, "hero-swing");
  // yank: a sharp pull of the rope arm
  await page.evaluate(() => { G.test.yank(1, 3); __h.step(2); });
  f = await flat(page);
  check(f.hero.pose === "yank" && f.hero.weights.yank[1] > 0.5, "a yank pulls the rope arm (pose yank)", { pose: f.hero.pose, yank: f.hero.weights.yank });
  await page.evaluate(() => { G.test.press(1, false); G.test.aimAt(1, null); __h.step(20); });
  // swing (two ropes): both arms reach
  await reset(page);
  const t3 = await page.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y + 25, s.z); G.P.onGround = false; return __h.target(s.x, s.y + 25, s.z); });
  await page.evaluate((t) => { for (const i of [0, 1]) { G.test.aimAt(i, t.x, t.y, t.z); G.test.press(i, true); } __h.step(30); }, t3);
  f = await flat(page); s = await S(page);
  check(s.ropes[0].state === "attached" && s.ropes[1].state === "attached" && f.hero.weights.reach[0] > 0.9 && f.hero.weights.reach[1] > 0.9, "two ropes: both arms reach", { reach: f.hero.weights.reach, ropes: s.ropes.map((r) => r.state) });
  await page.evaluate(() => { for (const i of [0, 1]) { G.test.press(i, false); G.test.aimAt(i, null); } __h.step(5); });
  // land: a short crouch after a hard landing
  await reset(page);
  await page.evaluate(() => { const P = G.P, s = G.city.start; P.pos.y = s.y + 3; P.vel.y = -14; P.onGround = false; P.ground = null; });
  let landed = false, sawLand = false;
  for (let i = 0; i < 40 && !sawLand; i++) {
    f = await step(page, 1); s = await S(page);
    if (s.onGround) landed = true;
    if (landed && f.hero.pose === "land") sawLand = true;
  }
  check(landed && sawLand, "a hard landing gives a short crouch (pose land)", { landed, pose: f.hero.pose });
  f = await step(page, 90);
  check(f.hero.pose === "idle", "and the crouch ends", f.hero.pose);

  /* ---- the body turns with the velocity in the air ---- */
  await reset(page);
  await page.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y + 60, s.z); const P = G.P; P.onGround = false; P.vel.x = 14; P.vel.z = 0; P.vel.y = 0; __h.step(60); });
  f = await flat(page);
  check(Math.abs(wrapA(f.hero.yaw - Math.atan2(-14, 0))) < 0.3, "in the air the body faces the velocity", { yaw: f.hero.yaw });

  /* ---- the field of view widens with speed ---- */
  await reset(page);
  await step(page, 150);
  f = await flat(page);
  check(Math.abs(f.fov - 70) < 0.6, "the field of view is 70 degrees at rest", f.fov);
  await page.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y + 60, s.z); const P = G.P; P.onGround = false; P.frozen = true; P.vel.x = 32; P.vel.y = 0; P.vel.z = 0; __h.step(150); });
  f = await flat(page);
  check(f.fov > 84 && f.fov <= 88.5, "and widens toward 88 degrees at 32 m/s", f.fov);
  await reset(page);

  /* ---- the view turns toward your travel while you swing, but not right after you looked ---- */
  // the camera on its own, with a fake body: no physics, so the numbers are exact
  const fol = await page.evaluate(async () => {
    const { createFlatCam } = await import("/vr/js/flatcam.js");
    const THREE = await import("three");
    const cam = new THREE.PerspectiveCamera(70, 1.78, 0.1, 4000), fc = createFlatCam(cam, G.city);
    const P = { pos: { x: -75, y: 44.8, z: 72 }, vel: { x: -12, y: 0, z: 0 }, chest: 1.25 }; // going left (-x); the view faces -z
    const yawWant = Math.atan2(12, 0); // atan2(-vx, -vz) = +90 degrees
    const run = (n, look, flags) => { for (let i = 0; i < n; i++) fc.update(1 / 60, P, null, look, flags); return fc.info(); };
    const out = {};
    fc.reset(0, -0.27, false);
    out.idle = run(180, { dx: 0, dy: 0 }, { swinging: false }); // not swinging: no follow
    run(1, { dx: 0.01, dy: 0 }, { swinging: true }); // a look
    const y0 = fc.yaw;
    out.held = run(85, { dx: 0, dy: 0 }, { swinging: true }); // 1.4 s later: still holding
    out.heldD = fc.yaw - y0;
    out.moving = run(60, { dx: 0, dy: 0 }, { swinging: true }); // 2.4 s: following
    out.movedD = fc.yaw - y0;
    out.final = run(300, { dx: 0, dy: 0 }, { swinging: true });
    out.finalErr = Math.abs(Math.atan2(Math.sin(fc.yaw - yawWant), Math.cos(fc.yaw - yawWant)));
    // slow travel does not turn the view
    P.vel.x = -2;
    fc.reset(0, -0.27, false);
    out.slow = run(200, { dx: 0, dy: 0 }, { swinging: true }).yaw;
    // a time constant of about 1.2 s: after 1.2 s of following, about 63 % of the turn is done
    P.vel.x = -12;
    fc.reset(0, -0.27, false);
    run(90, { dx: 0, dy: 0 }, { swinging: true }); // (the turn is already under way)
    const a0 = fc.yaw;
    run(72, { dx: 0, dy: 0 }, { swinging: true }); // 1.2 s
    out.tau = (fc.yaw - a0) / (yawWant - a0);
    return out;
  });
  check(Math.abs(fol.idle.yaw) < 1e-6, "with no rope the view does not follow your travel", fol.idle);
  check(Math.abs(fol.heldD) < 0.02 && !fol.held.following, "for 1.5 s after a look the view does not follow", { d: fol.heldD, following: fol.held.following });
  check(fol.moving.following && fol.movedD > 0.05, "then it turns toward the travel direction", { d: fol.movedD, following: fol.moving.following });
  check(fol.finalErr < 0.05, "and gets there", { err: fol.finalErr });
  check(Math.abs(fol.slow) < 1e-6, "below 6 m/s it does not follow", fol.slow);
  check(fol.tau > 0.5 && fol.tau < 0.75, "the time constant is about 1.2 s (63 % in 1.2 s: " + fol.tau.toFixed(2) + ")", fol.tau);
  // in the game: a real swing makes the flag come on while the rope is attached and fast
  await reset(page);
  const t4 = await page.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y + 25, s.z); G.P.onGround = false; return __h.target(s.x, s.y + 25, s.z); });
  await page.evaluate((t) => { G.test.aimAt(1, t.x, t.y, t.z); G.test.press(1, true); }, t4);
  let followed = false;
  for (let i = 0; i < 40 && !followed; i++) { f = await step(page, 10); followed = f.following; }
  check(followed, "in a real swing the view follows the travel", { following: f.following });
  await page.evaluate(() => { G.test.press(1, false); G.test.aimAt(1, null); G.P.frozen = false; });
  await reset(page);

  /* ---- named camera shots and the test hooks keep working ---- */
  const shots = await page.evaluate(async () => {
    const out = {};
    for (const n of ["start", "needle", "canyon", "street"]) {
      out[n] = !!G.test.camera(n);
      out[n + "Hidden"] = !G.hero.root.visible; // the hero would sit in the lens
      out[n + "Px"] = __h.px([[0.5, 0.5], [0.25, 0.4], [0.75, 0.6], [0.5, 0.2]]).filter((p) => p[0] + p[1] + p[2] > 30).length;
    }
    G.test.camera(null);
    __h.step(5);
    out.back = G.hero.root.visible;
    return out;
  });
  check(["start", "needle", "canyon", "street"].every((n) => shots[n] && shots[n + "Hidden"] && shots[n + "Px"] >= 3) && shots.back, "G.test.camera shots still work: the hero hides in them and comes back", shots);
  const tp = await page.evaluate(() => { const p = G.test.teleport(G.city.start.x + 3, G.city.start.y, G.city.start.z); __h.step(5); const s = G.test.state(); return { p, pos: s.pos }; });
  check(Math.abs(tp.pos.x - (tp.p.x)) < 0.5, "G.test.teleport still moves the hero", tp);

  /* ---- a clog on a lower roof further away stays a target ---- */
  // A clog within 60 m and 22 degrees of the camera forward is the auto target, though the view points at the roof beside it. Stand on a
  // higher roof, point the chase view at the roof right by a clog 14 to 60 m away, and the target must be that clog.
  const lo = await page.evaluate(() => {
    const C = G.city, out = [];
    for (const c of C.clogs) {
      for (const b of C.buildings) {
        const d = Math.hypot(b.x - c.x, b.z - c.z);
        if (b.roofY < c.y + 3 || d < 14 || d > 60) continue;
        const ex = b.x, ey = b.roofY + 1.65, ez = b.z, dx = c.x - ex, dy = c.y + 2.5 - ey, dz = c.z - ez, L = Math.hypot(dx, dy, dz);
        const h = C.raycast(ex, ey, ez, dx / L, dy / L, dz / L, L + 1, {});
        if (h && Math.hypot(h.x - c.x, h.z - c.z) > 3) continue;
        G.test.teleport(b.x, b.roofY, b.z);
        let yaw = Math.atan2(-(c.x - b.x), -(c.z - b.z));
        G.rigYaw = yaw; G.flatcam.reset(yaw, -0.3); __h.step(30);
        for (let k = 0; k < 4; k++) {
          const p = G.camera.position, ux = c.x - p.x, uy = c.y + 0.6 - p.y, uz = c.z - p.z;
          yaw = Math.atan2(-ux, -uz); G.rigYaw = yaw; G.flatcam.reset(yaw, Math.asin(uy / Math.hypot(ux, uy, uz))); __h.step(2);
        }
        const p = G.camera.position, f = new p.constructor(0, 0, -1).applyQuaternion(G.camera.quaternion);
        const r = C.raycast(p.x, p.y, p.z, f.x, f.y, f.z, 400, {});
        // only views whose centre ray lands on the roof by the clog test the rule
        if (!r || r.ny < 0.7 || Math.hypot(r.x - c.x, r.z - c.z) > 5) continue;
        const a = G.test.aim(1);
        out.push({ clog: c.id, from: b.id, d: +d.toFixed(1), tag: a && a.tag, id: a && a.id, valid: !!(a && a.valid) });
        if (out.filter((o) => o.clog === c.id).length >= 2) break;
      }
    }
    G.rigYaw = G.city.start.yaw;
    return out;
  });
  check(lo.length >= 2 && lo.every((o) => o.tag === "clog" && o.id === "clog:" + o.clog && o.valid), "pointing the chase view at a clog on a lower roof further away makes that clog the auto target (" + lo.length + " views)", lo);
  // A clog on the hero's own roof, 14 to 24 m away, aimed low with nothing behind it: the centre ray runs a little down past the roof edge
  // and hits nothing within 400 m. The auto target must stay on the clog.
  const same = await page.evaluate(() => {
    const C = G.city, out = [];
    for (const c of C.clogs) {
      const b = C.buildings[c.bid];
      for (let k = 0; k < 64 && out.filter((o) => o.clog === c.id).length < 1; k++) {
        const a = (k / 64) * Math.PI * 2, d = 14 + (k % 6) * 2, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        if (Math.abs(x - b.x) > b.w / 2 - 1.5 || Math.abs(z - b.z) > b.d / 2 - 1.5) continue;
        const top = C.topBelow(x, c.y + 2, z, 0.3);
        if (!top || Math.abs(top.y - c.y) > 0.3) continue;
        G.test.teleport(x, c.y, z);
        let yaw = Math.atan2(-(c.x - x), -(c.z - z)); G.rigYaw = yaw; G.flatcam.reset(yaw); __h.step(30);
        for (let j = 0; j < 4; j++) {
          const p = G.camera.position, ux = c.x - p.x, uy = c.y + 0.8 - p.y, uz = c.z - p.z;
          yaw = Math.atan2(-ux, -uz); G.rigYaw = yaw; G.flatcam.reset(yaw, Math.asin(uy / Math.hypot(ux, uy, uz))); __h.step(2);
        }
        const p = G.camera.position, f = new p.constructor(0, 0, -1).applyQuaternion(G.camera.quaternion);
        if (f.y >= 0 || C.raycast(p.x, p.y, p.z, f.x, f.y, f.z, 400, {})) continue;
        const a2 = G.test.aim(1);
        out.push({ clog: c.id, d, tag: a2 && a2.tag, id: a2 && a2.id, valid: !!(a2 && a2.valid) });
      }
    }
    G.rigYaw = G.city.start.yaw;
    return out;
  });
  check(same.length >= 3 && same.every((o) => o.tag === "clog" && o.id === "clog:" + o.clog && o.valid), "a low view of a clog on the hero's own roof, with nothing behind it, makes that clog the auto target (" + same.length + " views)", same);

  /* ---- holding a wall: the hero faces it with both hands on it ---- */
  const cl = await page.evaluate(() => {
    const C = G.city, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const B = C.colliders.find((c) => c.type === "box" && c.tag === "building" && c.minY === 0 && c.maxY > 25 && c.maxY < 90 &&
      !C.colliders.some((d) => d !== c && d.bid === c.bid) && !C.collideSphere(c.maxX + 2, c.maxY / 2, (c.minZ + c.maxZ) / 2, 1.6));
    if (!B) return null;
    const z = (B.minZ + B.maxZ) / 2, key = (code, on) => window.dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { code }));
    G.test.teleport(B.maxX + 3, B.maxY / 2, z); G.rigYaw = Math.PI / 2; G.flatcam.reset(Math.PI / 2); G.P.vel.x = -8; __h.step(30);
    const face = () => { const w = G.P.wall; return w ? Math.abs(wrap(G.hero.info().yaw - Math.atan2(w.nx, w.nz))) : null; };
    const held = { wall: !!G.P.wall, pose: G.hero.info().pose, off: face(), air: G.hero.info().weights.air };
    key("KeyW", true); __h.step(30); const up = { pose: G.hero.info().pose, off: face() }; key("KeyW", false);
    key("KeyD", true); __h.step(30); const along = { pose: G.hero.info().pose, off: face(), wall: !!G.P.wall }; key("KeyD", false);
    __h.step(2);
    G.test.teleport(G.city.start.x, G.city.start.y, G.city.start.z); G.rigYaw = G.city.start.yaw; __h.step(10);
    return { held, up, along };
  });
  check(cl && cl.held.wall && cl.held.pose === "cling" && cl.held.off < 0.2 && cl.held.air < 0.1, "holding a wall the hero faces it in the cling pose, with no air pose", cl);
  check(cl && cl.up.pose === "cling" && cl.up.off < 0.2 && cl.along.wall && cl.along.pose === "cling" && cl.along.off < 0.2, "climbing up and along, the hero keeps facing the wall", cl);

  /* ---- the draw budget ---- */
  await reset(page);
  await page.evaluate(() => { G.test.camera(null); __h.step(20); });
  const withHero = await page.evaluate(() => __h.draw());
  await page.evaluate(() => G.hero.setVisible(false));
  const without = await page.evaluate(() => __h.draw());
  await page.evaluate(() => G.hero.setVisible(true));
  check(withHero.calls - without.calls >= 1 && withHero.calls - without.calls <= 4, "the hero and its outline are at most 4 draw calls (" + (withHero.calls - without.calls) + ")", { withHero, without });
  check(withHero.tris - without.tris > 5000 && withHero.tris - without.tris <= 26000, "and about 25k triangles with the outline (" + (withHero.tris - without.tris) + ")", { withHero, without });
  check(withHero.calls <= 120, "the whole frame stays under 120 draws (" + withHero.calls + ")", withHero);

  /* ---- leaving flat play gives the camera back to the rig; coming back turns the chase view on again ---- */
  await reset(page);
  await page.evaluate(() => { G.test.uiPress("exit"); __h.step(5); });
  const out = await page.evaluate(() => ({ mode: G.mode, parent: G.camera.parent === G.rig, vis: G.hero.root.visible, on: G.test.flat().on, view: document.body.dataset.view || "" }));
  check(out.mode === "title" && out.parent && !out.vis && !out.on && out.view === "", "Exit gives the camera back to the rig and hides the hero", out);
  await page.evaluate(() => { document.querySelector("#playFlat").click(); });
  await waitFor(page, () => G.mode === "desktop", null, 60000);
  await step(page, 90);
  const back = await page.evaluate(() => ({ st: G.test.state().state, f: G.test.flat(), parent: G.camera.parent === G.scene, vis: G.hero.root.visible, view: document.body.dataset.view }));
  check(back.st === "play" && back.f.on && !back.f.firstPerson && back.parent && back.vis && back.view === "third" && Math.abs(back.f.dist - 4.5) < 0.2, "playing again shows the hero and the chase camera", { st: back.st, on: back.f.on, dist: back.f.dist, parent: back.parent, vis: back.vis, view: back.view });

  const errs = page.errors.filter((e) => !/Failed to load resource/i.test(e));
  check(errs.length === 0, "no page errors in flat play", errs);
  await page.context().close();
} catch (e) { check(false, "the flat-play run threw", e.stack || String(e)); }

/* ================= the fallback figure ================= */
try {
  page = await newPage({ width: 320, height: 180 });
  await page.route("**/wild/models/crew5.glb", (r) => r.fulfill({ status: 404, body: "no" }));
  await open(page, "skipintro&god");
  await install(page);
  await enterXR(page, "desktop");
  await waitState(page, { mode: "desktop", state: "play" }, 240000);
  await waitFor(page, () => G.hero && G.hero.model !== "loading", null, 120000);
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await step(page, 90);
  const fb = await page.evaluate(() => ({ model: G.hero.model, tris: G.hero.tris, vis: G.hero.root.visible }));
  check(fb.model === "built" && fb.vis && fb.tris > 500, "with no model file a code-built figure takes its place", fb);
  const px2 = await page.evaluate(async () => {
    const T = G.camera.position.constructor, h = G.test.state().pos, c = G.camera, grid = [];
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const v = new T(h.x, h.y + 1.3, h.z).project(c); grid.push([(v.x + 1) / 2 + a * 0.008, (1 - v.y) / 2 + b * 0.012]); }
    return __h.px(grid).filter(([r, g, b]) => r > 100 && r > g * 1.5 && r > b * 1.5).length;
  });
  check(px2 >= 6, "the built-in figure draws (red jersey)", px2);
  await shot(page, "hero-fallback");
  // the same poses drive it
  const t5 = await page.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y + 25, s.z); G.P.onGround = false; return __h.target(s.x, s.y + 25, s.z); });
  await page.evaluate((t) => { G.test.aimAt(1, t.x, t.y, t.z); G.test.press(1, true); __h.step(30); }, t5);
  f = await flat(page);
  const rp3 = await page.evaluate(() => { const ri = G.ropes.info(), h = G.hero.hand(1), from = ri.ropes[1].to; return Math.hypot(from[0] - h.x, from[1] - h.y, from[2] - h.z); });
  check(f.hero.pose === "swing" && f.hero.weights.reach[1] > 0.9 && rp3 < 0.02, "the built-in figure swings and holds the rope in its hand", { pose: f.hero.pose, rp3 });
  await page.evaluate(() => { const i = G.hero.info(); window.__hi = i; });
  await page.evaluate(() => { G.test.press(1, false); G.test.aimAt(1, null); });
  const ri2 = await page.evaluate(() => __h.draw());
  check(ri2.calls <= 120, "the built-in figure is within the draw budget (" + ri2.calls + " calls)", ri2);
  const errs2 = page.errors.filter((e) => !/Failed to load resource|crew5/i.test(e));
  check(errs2.length === 0, "no page errors with the fallback", errs2);
  await page.context().close();
} catch (e) { check(false, "the fallback run threw", e.stack || String(e)); }

/* ================= the intro stays first person, then the camera pulls out ================= */
try {
  page = await newPage({ width: 320, height: 180 });
  await open(page, "god");
  await install(page);
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await waitFor(page, () => G.hero && G.hero.model !== "loading", null, 120000);
  await page.evaluate(() => { __h.step(30); });
  let g = await page.evaluate(() => ({ st: G.test.state().state, f: G.test.flat(), vis: G.hero.root.visible, head: G.test.state().head }));
  check(g.st === "intro" && g.f.blend === 0 && !g.vis, "the intro is first person: the camera is at the eyes and the hero is hidden", { st: g.st, blend: g.f.blend, vis: g.vis });
  check(Math.hypot(g.f.camera.x - g.head.x, g.f.camera.y - g.head.y, g.f.camera.z - g.head.z) < 0.05, "the intro camera sits at the head, as before", { cam: g.f.camera, head: g.head });
  await page.evaluate(() => { G.test.skipIntro(); });
  let st = "intro";
  for (let i = 0; i < 60 && st !== "play"; i++) { await step(page, 20); st = (await S(page)).state; }
  check(st === "play", "the intro ends", st);
  g = await page.evaluate(() => { __h.step(150); return { f: G.test.flat(), vis: G.hero.root.visible }; });
  check(g.f.blend === 1 && Math.abs(g.f.dist - 4.5) < 0.2 && g.vis && Math.abs(g.f.pitch - -0.27) < 0.05, "at the hand-off the camera pulls out to the chase view", { blend: g.f.blend, dist: g.f.dist, vis: g.vis, pitch: g.f.pitch });
  const errs3 = page.errors.filter((e) => !/Failed to load resource/i.test(e));
  check(errs3.length === 0, "no page errors in the intro", errs3);
  await page.context().close();
} catch (e) { check(false, "the intro run threw", e.stack || String(e)); }

/* ================= the headset is untouched ================= */
try {
  page = await newPage({ width: 320, height: 180 });
  await open(page, "emulate&skipintro");
  await enterXR(page, "vr");
  await waitFor(page, () => G.state === "play", null, 240000);
  await sleep(500);
  const x = await page.evaluate(() => ({ parent: G.camera.parent === G.rig, vis: G.hero.root.visible, flat: G.test.flat().on, mode: G.mode }));
  check(x.mode === "vr" && x.parent && !x.vis && !x.flat, "in VR the camera stays under the rig and the hero is hidden", x);
  // no auto target, no lock-on ring and no key strip in a headset
  const hud = await page.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return !e.closest("[hidden]") && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; };
    return { on: G.test.target().on, ring: vis("#lockRing"), arrow: vis("#lockArrow"), strip: vis("#keyHints"), cue: vis("#lockCue") };
  });
  check(hud.on === false, "in VR no auto target runs (G.test.target().on is false)", hud);
  check(!hud.ring && !hud.arrow && !hud.strip && !hud.cue, "and no lock-on ring, arrow, LET GO caption or key strip shows", hud);
  const errs4 = page.errors.filter((e) => !/Failed to load resource/i.test(e));
  check(errs4.length === 0, "no page errors in VR", errs4);
  await page.context().close();
} catch (e) { check(false, "the VR run threw", e.stack || String(e)); }

await close();
done();
