// Wall climbing in flat play and the roof antennas: fly into a wall and hold on, W or the up arrow climbs, D goes along
// the wall, Space jumps off, the top steps on to the roof, a phone gets a climb pad, and a rope catches a roof antenna
// that you can then climb. The hero climbs with both hands and both feet on holds that stay put in the world, stepping in
// diagonal pairs. Run from the repo root (the server is our own, see lib.mjs).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { newPage, open, close, watchdog } from './lib.mjs';
watchdog(900000, 'climb'); // the limb checks record a few hundred frames
const out = process.env.SHOTS || '/tmp/swing-qa'; await mkdir(out, { recursive: true });
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, 'getGamepads', { value: () => [] }); };

// In the page: a one-box building with a clear street face (+x), and helpers to fly into it and to press keys.
const SETUP = () => {
  const C = G.city;
  const B = C.colliders.find((c) => {
    if (!(c.type === 'box' && c.tag === 'building' && c.minY === 0 && c.maxY > 25 && c.maxY < 90)) return false;
    if (C.colliders.some((d) => d !== c && d.bid === c.bid)) return false;
    const z = (c.minZ + c.maxZ) / 2;
    for (let y = 0.5; y < c.maxY + 3; y += 1) if (C.collideSphere(c.maxX + 2, y, z, 1.6)) return false;
    return !C.isWater(c.maxX + 1, z) && C.groundY(c.maxX + 1, z) < 0.5;
  });
  window.QA = {
    B, z: (B.minZ + B.maxZ) / 2,
    key(code, on) { window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code })); },
    // in the air 3 m off the wall at half its height, flying at it, facing it
    flyIn(y = B.maxY / 2, z = QA.z) {
      G.test.teleport(B.maxX + 3, y, z); G.rigYaw = Math.PI / 2; G.desktop.level(0);
      G.P.vel.x = -8; G.test.step(1 / 60, 30);
      return !!G.P.wall;
    },
    // n frames of the climb: each limb's hold and whether it steps, the drawn palms and ankles, the body and the hero's root
    record(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        G.test.step(1 / 60, 1);
        const h = G.hero.info(), c = h.climb;
        out.push({ wall: !!G.P.wall, pos: [G.P.pos.x, G.P.pos.y, G.P.pos.z], grab: c.grab, n: c.wall, hands: h.hands, feet: h.feet, head: h.head,
          limbs: c.limbs.map((l) => [l.moving ? 1 : 0, ...l.hold, l.t]), root: G.hero.root.position.toArray(), cling: h.weights.cling, mantle: c.mantle });
      }
      return out;
    },
    // a stick held part way (mx right, my up), like a pad; no arguments gives the keys back
    analog(mx, my) {
      const D = G.desktop;
      if (!D.keysOnly) D.keysOnly = D.update;
      D.update = mx == null ? D.keysOnly : (dt) => { const i = D.keysOnly(dt); i.move.x = mx; i.move.y = my; return i; };
    },
  };
  return { ok: !!B, h: B && B.maxY };
};

// The gait over recorded frames on the wall (after the grab's reach): the most limbs stepping at once, steps with two limbs
// that are not a diagonal pair, the fastest a planted palm or ankle moves in the world, how far it is from its hold, the steps
// of each limb (left hand, right hand, left foot, right foot), each limb's hold range along the wall (u right, v up), and
// the mean height (v) at which each limb lands on a new hold.
function gait(F) {
  const g = { frames: 0, maxMoving: 0, notDiagonal: 0, planted: 0, off: 0, steps: [0, 0, 0, 0], u: [0, 1, 2, 3].map(() => [9, -9]), v: [0, 1, 2, 3].map(() => [9, -9]), land: [0, 0, 0, 0] };
  const lands = [[], [], [], []];
  for (let f = 1; f < F.length; f++) {
    const a = F[f - 1], b = F[f];
    if (!a.wall || !b.wall || b.grab < 0.3) continue;
    g.frames++;
    const mv = b.limbs.map((l) => l[0]), nm = mv[0] + mv[1] + mv[2] + mv[3];
    g.maxMoving = Math.max(g.maxMoving, nm);
    if (nm === 2 && !((mv[1] && mv[2]) || (mv[0] && mv[3]))) g.notDiagonal++;
    for (let i = 0; i < 4; i++) {
      const pa = i < 2 ? a.hands[i] : a.feet[i - 2], pb = i < 2 ? b.hands[i] : b.feet[i - 2], h = b.limbs[i];
      if (!a.limbs[i][0] && mv[i]) g.steps[i]++;
      if (a.limbs[i][0] && !mv[i]) lands[i].push(h[2] - b.pos[1]);
      if (a.limbs[i][0] || mv[i]) continue;
      g.planted = Math.max(g.planted, Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]) * 60);
      // a palm sits on its hold, an ankle just off it (the toes on the hold)
      g.off = Math.max(g.off, Math.hypot(pb[0] - h[1], pb[1] - h[2], pb[2] - h[3]) - (i < 2 ? 0.06 : 0.17));
      const u = (h[1] - b.pos[0]) * b.n[1] - (h[3] - b.pos[2]) * b.n[0], v = h[2] - b.pos[1];
      g.u[i][0] = Math.min(g.u[i][0], u); g.u[i][1] = Math.max(g.u[i][1], u); g.v[i][0] = Math.min(g.v[i][0], v); g.v[i][1] = Math.max(g.v[i][1], v);
    }
  }
  g.land = lands.map((l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : NaN));
  return g;
}
// which limb of a stepping pair goes first: frames where one is on its way (0 < t < 1) while its partner still waits (t <= 0)
function leads(F) {
  const n = { hand: 0, foot: 0 };
  for (const f of F) {
    if (!f.wall || f.grab < 0.3) continue;
    for (const [h, ft] of [[1, 2], [0, 3]]) {
      const a = f.limbs[h], b = f.limbs[ft], go = (l) => l[0] && l[4] > 0 && l[4] < 1, wait = (l) => l[0] && l[4] <= 0;
      if (go(a) && wait(b)) n.hand++;
      if (go(b) && wait(a)) n.foot++;
    }
  }
  return n;
}
const r2 = (g) => JSON.stringify(g, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v));
// the checks every climb must pass: two limbs at most, a diagonal pair, planted limbs still, on their holds, every limb steps
function gaitOk(g, what, minSteps) {
  assert(g.frames > 40, what + ': climbed long enough to judge: ' + r2(g));
  assert(g.maxMoving <= 2 && g.notDiagonal === 0, what + ': never more than two limbs step at once, and two are a diagonal pair: ' + r2(g));
  assert(g.planted < 0.05, what + ': a planted hand or foot stays put in the world (under 5 cm/s): ' + r2(g));
  assert(g.off < 0.03, what + ': planted hands and feet are on their holds: ' + r2(g));
  assert(g.steps.every((n) => n >= minSteps), what + ': every limb steps (at least ' + minSteps + ' times): ' + r2(g));
}

try {
  /* ---------------- keyboard and mouse ---------------- */
  {
    const page = await newPage({ width: 640, height: 360 });
    await page.addInitScript(quiet);
    await open(page, '?nosw&skipintro'); await page.waitForFunction(() => G.viewDone);
    await page.locator('#playFlat').click(); await page.waitForFunction(() => G.state === 'play');
    await page.evaluate(() => G.test.hold(true));
    const b = await page.evaluate(SETUP);
    assert(b.ok, 'a building to climb');
    const grab = await page.evaluate(() => ({ wall: QA.flyIn(), n: G.P.wall && G.P.wall.nx, said: document.querySelector('.fs-sub').textContent }));
    assert(grab.wall && Math.abs(grab.n - 1) < 1e-6, 'flying into a wall holds you: ' + JSON.stringify(grab));
    assert(/W and S climb/.test(grab.said), 'the first wall says how to climb: ' + grab.said);
    console.log('PASS fly into a wall and hold on (' + b.h + ' m building)');
    const climb = await page.evaluate(() => {
      const y0 = G.P.pos.y; QA.key('KeyW', true); G.test.step(1 / 60, 30); QA.key('KeyW', false); G.test.step(1 / 60, 1);
      const y1 = G.P.pos.y; QA.key('ArrowUp', true); G.test.step(1 / 60, 30); QA.key('ArrowUp', false); G.test.step(1 / 60, 1);
      const y2 = G.P.pos.y, z0 = G.P.pos.z; QA.key('KeyD', true); G.test.step(1 / 60, 30); QA.key('KeyD', false); G.test.step(1 / 60, 1);
      return { w: y1 - y0, arrow: y2 - y1, side: G.P.pos.z - z0, still: !!G.P.wall };
    });
    assert(Math.abs(climb.w - 3) < 0.25 && Math.abs(climb.arrow - 3) < 0.25, 'W and the up arrow climb 6 m/s: ' + JSON.stringify(climb));
    assert(climb.side < -2.5 && climb.still, 'D goes right along the wall: ' + JSON.stringify(climb));
    console.log('PASS W and the up arrow climb, D goes along the wall', JSON.stringify(climb));
    await page.screenshot({ path: out + '/climb-desktop.png' });
    const jump = await page.evaluate(() => { QA.key('Space', true); G.test.step(1 / 60, 1); QA.key('Space', false); G.test.step(1 / 60, 1); return { wall: !!G.P.wall, vx: G.P.vel.x, vy: G.P.vel.y }; });
    assert(!jump.wall && jump.vx > 4 && jump.vy > 3, 'Space jumps off the wall: ' + JSON.stringify(jump));
    console.log('PASS Space jumps off the wall');
    const top = await page.evaluate(() => {
      QA.flyIn(); QA.key('KeyW', true);
      for (let i = 0; i < 900 && G.P.wall; i++) G.test.step(1 / 60, 1);
      QA.key('KeyW', false); G.test.step(1 / 60, 2);
      return { wall: !!G.P.wall, ground: G.P.onGround, y: G.P.pos.y, roof: QA.B.maxY };
    });
    assert(!top.wall && top.ground && Math.abs(top.y - top.roof) < 0.01, 'the top steps on to the roof: ' + JSON.stringify(top));
    console.log('PASS at the top you step on to the roof');

    // a roof antenna: a rope catches it, and you can climb it to the top
    const ant = await page.evaluate(() => {
      const A = G.city.colliders.find((c) => c.tag === 'antenna' && c.y1 - c.y0 > 10 && !G.city.collideSphere(c.x + 12, c.y1 - 2, c.z, 1.5));
      if (!A) return 'no antenna';
      G.test.teleport(A.x + 12, A.y1 - 2, A.z); G.rigYaw = Math.PI / 2; G.desktop.level(0); G.test.step(1 / 60, 1);
      G.test.aimAt(1, A.x, (A.y0 + A.y1) / 2 + 2, A.z); G.test.press(1, true); G.test.step(1 / 60, 30);
      const rope = { state: G.P.ropes[1].state, tag: G.test.state().ropes[1].tag };
      G.test.press(1, false); G.test.aimAt(1, null); G.test.step(1 / 60, 2);
      // climb it: fly into the pole low down, then W to the top
      G.test.teleport(A.x + 2.5, A.y0 + 1, A.z); G.P.vel.x = -6; G.test.step(1 / 60, 30);
      const grabbed = !!G.P.wall;
      QA.key('KeyW', true); for (let i = 0; i < 600 && G.P.wall; i++) G.test.step(1 / 60, 1); QA.key('KeyW', false); G.test.step(1 / 60, 2);
      return { rope, grabbed, top: G.P.onGround && Math.abs(G.P.pos.y - A.y1) < 0.01, y: G.P.pos.y, y1: A.y1, count: G.city.colliders.filter((c) => c.tag === 'antenna').length };
    });
    assert(ant.rope && ant.rope.state === 'attached' && ant.rope.tag === 'antenna', 'a rope catches a roof antenna: ' + JSON.stringify(ant));
    assert(ant.grabbed && ant.top, 'you can climb an antenna to its top: ' + JSON.stringify(ant));
    console.log('PASS a rope catches a roof antenna, and you can climb one to the top (' + ant.count + ' antennas)');
    await page.evaluate(() => { G.test.camera && null; });
    await page.screenshot({ path: out + '/antenna-top.png' });

    // the limbs on the wall: hands and feet on holds on the wall's surface, all four planted while the hero holds still.
    // (The loop stops drawing for these: they only step the game, and the software renderer is slow.)
    await page.evaluate(() => G.renderer.setAnimationLoop(null));
    const hold = await page.evaluate(() => {
      QA.flyIn(); const F = QA.record(40), last = F[F.length - 1];
      return { F, faceX: QA.B.maxX, moving: last.limbs.filter((l) => l[0]).length, holds: last.limbs.map((l) => l[1]) };
    });
    assert(hold.moving === 0 && hold.holds.every((x) => Math.abs(x - hold.faceX) < 0.01), 'after the grab all four limbs hold points on the wall face: ' + JSON.stringify(hold.holds) + ' face ' + hold.faceX);
    const rest = gait(hold.F.slice(20));
    assert(rest.planted < 0.01 && rest.off < 0.03, 'holding still, the hands and feet stay on their holds: ' + r2(rest));
    console.log('PASS after the grab both hands and both feet hold points on the wall');
    // climbing up: right hand with left foot, then left hand with right foot; the hands reach up over the head
    const upF = await page.evaluate(() => { QA.key('KeyW', true); const F = QA.record(120); QA.key('KeyW', false); return F; });
    const up = gait(upF);
    gaitOk(up, 'climbing up', 6);
    assert(up.land[0] > 1.6 && up.land[1] > 1.6 && up.land[2] > 0.45 && up.land[3] > 0.45 && up.v[2][0] < 0.2 && up.v[3][0] < 0.2, 'climbing up the hands land over the head, the feet step up high and push down low: ' + r2(up));
    console.log('PASS climbing up the limbs step in diagonal pairs on planted holds', r2({ steps: up.steps, planted: up.planted, off: up.off }));
    // at rest after a climb: the limbs settle back under the body, then all four hold on and only the body breathes
    const still = await page.evaluate(() => { G.test.step(1 / 60, 90); return QA.record(120); });
    const st = gait(still), headY = still.map((f) => f.head[1] - f.pos[1]);
    assert(st.maxMoving === 0 && st.planted < 0.01, 'at rest on the wall all four limbs stay planted: ' + r2(st));
    assert(Math.max(...headY) - Math.min(...headY) > 0.004, 'at rest the body still breathes: ' + (Math.max(...headY) - Math.min(...headY)));
    console.log('PASS at rest all four limbs hold on and the body breathes');
    // going along the wall: the leading hand reaches out, the trailing hand crosses toward it
    const sideF = await page.evaluate(() => {
      QA.flyIn(QA.B.maxY / 2, QA.B.maxZ - 1);
      const n = Math.min(120, Math.floor(((QA.B.maxZ - QA.B.minZ - 3) / 6) * 60));
      QA.key('KeyD', true); const F = QA.record(n); QA.key('KeyD', false); return F;
    });
    const side = gait(sideF);
    gaitOk(side, 'going along the wall', 3);
    assert(side.u[1][1] > 0.42 && side.u[0][1] > 0.12, 'going right the right hand reaches out wide and the left crosses past the middle: ' + r2(side));
    console.log('PASS going along the wall the leading hand reaches out and the trailing hand crosses', r2({ steps: side.steps, u: side.u }));
    // climbing down: the feet reach lower than going up
    const downF = await page.evaluate(() => { QA.flyIn(QA.B.maxY - 3); QA.key('KeyS', true); const F = QA.record(120); QA.key('KeyS', false); return F; });
    const down = gait(downF);
    gaitOk(down, 'climbing down', 6);
    assert(down.land[2] < 0.2 && down.land[3] < 0.2 && down.land[0] < 1.35 && down.land[1] < 1.35, 'climbing down the feet reach down to land low, the hands follow: ' + r2({ down: down.land, up: up.land }));
    console.log('PASS climbing down the feet reach down, on planted holds');
    // a stick held part way: a slower climb, a slower step rate, and in each pair the hand goes first going up, the foot going down
    const slow = await page.evaluate(() => {
      QA.flyIn(4); QA.analog(0, 0.4); const up = QA.record(150);
      QA.flyIn(QA.B.maxY - 3); QA.analog(0, -0.4); const down = QA.record(150);
      QA.analog(); G.test.step(1 / 60, 2);
      return { up, down };
    });
    const su = gait(slow.up), sd = gait(slow.down), lu = leads(slow.up), ld = leads(slow.down);
    gaitOk(su, 'climbing up slowly', 2); gaitOk(sd, 'climbing down slowly', 2);
    const rate = (g) => g.steps.reduce((a, b) => a + b, 0) / g.frames;
    assert(rate(su) < rate(up) * 0.6, 'a slower climb steps less often: ' + r2({ slow: rate(su), fast: rate(up) }));
    assert(lu.hand > 0 && lu.foot === 0 && ld.foot > 0 && ld.hand === 0, 'going up the hand of a pair goes first, going down the foot: ' + JSON.stringify({ up: lu, down: ld }));
    console.log('PASS a slower climb steps slower; the hand leads going up and the foot going down', JSON.stringify({ up: lu, down: ld }));
    // letting go: back to the air pose
    const off = await page.evaluate(() => { QA.key('Space', true); G.test.step(1 / 60, 1); QA.key('Space', false); const F = QA.record(20); const h = G.hero.info(); return { cling: h.weights.cling, air: h.weights.air, on: h.climb.on, wall: !!G.P.wall, jump: F.map((f) => Math.hypot(f.root[0] - f.pos[0], f.root[1] - f.pos[1], f.root[2] - f.pos[2])) }; });
    assert(!off.wall && !off.on && off.cling < 0.1 && off.air > 0.9 && Math.max(...off.jump) < 1e-6, 'jumping off the wall blends back to the air pose: ' + JSON.stringify(off));
    console.log('PASS jumping off blends back to the air pose');
    // over the top: the body steps on to the roof at once, but the hero is drawn going up and over the edge
    const top2 = await page.evaluate(() => {
      QA.flyIn(QA.B.maxY - 3); QA.key('KeyW', true);
      let F = [];
      for (let i = 0; i < 120 && !F.some((f) => f.mantle > 0); i++) F = F.concat(QA.record(1));
      F = F.concat(QA.record(40)); QA.key('KeyW', false);
      let posJump = 0, rootJump = 0, edge = 9;
      for (let i = 1; i < F.length; i++) {
        posJump = Math.max(posJump, Math.hypot(F[i].pos[0] - F[i - 1].pos[0], F[i].pos[1] - F[i - 1].pos[1], F[i].pos[2] - F[i - 1].pos[2]));
        rootJump = Math.max(rootJump, Math.hypot(F[i].root[0] - F[i - 1].root[0], F[i].root[1] - F[i - 1].root[1], F[i].root[2] - F[i - 1].root[2]));
        if (F[i].mantle > 0.5) for (const h of F[i].hands) edge = Math.min(edge, Math.abs(h[1] - QA.B.maxY) + Math.max(0, h[0] - QA.B.maxX - 0.1));
      }
      const end = F[F.length - 1];
      return { posJump, rootJump, edge, ground: G.P.onGround, settled: Math.hypot(end.root[0] - end.pos[0], end.root[1] - end.pos[1], end.root[2] - end.pos[2]) };
    });
    assert(top2.ground && top2.posJump > 0.8 && top2.rootJump < 0.25 && top2.settled < 1e-6, 'over the top the hero is drawn up and over the edge smoothly: ' + JSON.stringify(top2));
    assert(top2.edge < 0.12, 'going over the top the hands press on the roof edge: ' + JSON.stringify(top2));
    console.log('PASS over the top the hero goes up and over the edge, hands on it', JSON.stringify(top2));
    await page.evaluate(() => { QA.flyIn(); G.test.step(1 / 60, 30); G.renderer.render(G.scene, G.camera); });
    await page.screenshot({ path: out + '/climb-limbs.png' });
    assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
    await close();
  }

  /* ---------------- phone ---------------- */
  {
    const page = await newPage({ width: 390, height: 844 });
    await page.addInitScript(quiet);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      window.__sensors = 'denied'; // a test turns motion aim on by setting 'granted' and calling G.desktop.mobile.start()
      window.DeviceOrientationEvent.requestPermission = () => Promise.resolve(window.__sensors);
      window.DeviceMotionEvent.requestPermission = () => Promise.resolve(window.__sensors);
    });
    await open(page, '?nosw'); await page.waitForFunction(() => G.viewDone);
    await page.locator('#playFlat').click(); await page.waitForFunction(() => G.state === 'play');
    await page.evaluate(() => G.test.hold(true));
    const built = await page.evaluate(SETUP);
    // the hint over the SWING button: the resting line off the wall, and the wall line on it
    const hintOf = () => page.evaluate(() => document.querySelector('.phone-hint').textContent);
    // every way off the wall must put the line of before back. A way that leaves the wall line is named, and the test fails once at the end.
    const stale = [];
    const back = async (way, want) => {
      const got = await hintOf();
      if (got === want) console.log('PASS ' + way + ' puts the hint over SWING back to the line of before');
      else stale.push(way + ' leaves "' + got + '"');
    };
    await page.evaluate(() => G.test.step(1 / 60, 3));
    const rest = await hintOf();
    assert(/^Tap left or right to throw a plunger/.test(rest), 'off the wall the hint says to tap left or right: ' + rest);
    const pad = page.locator('.phone-climb');
    assert(await pad.isHidden(), 'no climb pad off the wall');
    assert(await page.evaluate(() => QA.flyIn()), 'a phone holds the wall too');
    await page.evaluate(() => G.test.step(1 / 60, 1));
    assert(await pad.isVisible(), 'the climb pad shows on the wall');
    const wallHint = await hintOf();
    assert(/^On the wall\. Hold the arrows to climb/.test(wallHint), 'on the wall the hint over SWING says how to climb: ' + wallHint);
    const up = page.locator('[data-climb=up]'), box = await up.boundingBox();
    const y0 = await page.evaluate(() => G.P.pos.y);
    await up.dispatchEvent('pointerdown', { pointerId: 7, isPrimary: true });
    await page.evaluate(() => G.test.step(1 / 60, 30));
    await up.dispatchEvent('pointerup', { pointerId: 7, isPrimary: true });
    const y1 = await page.evaluate(() => { G.test.step(1 / 60, 10); return G.P.pos.y; });
    assert(Math.abs(y1 - y0 - 3) < 0.3, 'holding the up arrow climbs, letting go stops: ' + (y1 - y0));
    console.log('PASS the phone climb pad shows on a wall and its up arrow climbs', (y1 - y0).toFixed(2) + ' m');
    await page.screenshot({ path: out + '/climb-phone.png' });
    assert(box.x < 195, 'the climb pad sits on the left, clear of the SWING button');
    await page.locator('.phone-climb [data-action=hop]').click();
    const off = await page.evaluate(() => { G.test.step(1 / 60, 2); return { wall: !!G.P.wall, vx: G.P.vel.x }; });
    assert(!off.wall && off.vx > 3, 'JUMP leaves the wall: ' + JSON.stringify(off));
    await page.evaluate(() => G.test.step(1 / 60, 2));
    assert(await pad.isHidden(), 'the pad hides off the wall');
    console.log('PASS JUMP leaves the wall and the pad hides');
    await back('JUMP', rest);
    // a tap swings you off the wall
    const swing = await page.evaluate(() => {
      QA.flyIn(); G.test.step(1 / 60, 1);
      G.desktop.mobile.tap(1); G.test.step(1 / 60, 30);
      const ev = G.test.events().slice(-12).filter((e) => e.type !== 'input').map((e) => e.type);
      return { wall: !!G.P.wall, rope: G.P.ropes[1].state, ev, fired: ev.includes('fire') && ev.includes('attach'), hint: document.querySelector('.phone-hint').textContent };
    });
    assert(!swing.wall && swing.fired, 'a tap on a wall swings you off it: ' + JSON.stringify(swing));
    console.log('PASS a tap swings you off the wall');
    assert(/^Swinging/.test(swing.hint), 'after a tap swung you off the wall the hint says swinging, not the resting line: ' + swing.hint);
    console.log('PASS after a tap swings you off the wall the hint keeps the swing line');
    // the other ways off the wall: hold an arrow until the hero is off (over the top, down to the street)
    const leave = async (arrow, id, y) => {
      assert(await page.evaluate((y) => { const ok = QA.flyIn(y); G.test.step(1 / 60, 2); return ok; }, y), 'a phone holds the wall (' + arrow + ')');
      assert(/^On the wall/.test(await hintOf()), 'on the wall again the hint says how to climb (' + arrow + ')');
      const b = page.locator('[data-climb=' + arrow + ']');
      await b.dispatchEvent('pointerdown', { pointerId: id, isPrimary: true });
      const r = await page.evaluate(() => { for (let i = 0; i < 24 && G.P.wall; i++) G.test.step(1 / 60, 10); G.test.step(1 / 60, 2); return { wall: !!G.P.wall, ground: G.P.onGround, y: G.P.pos.y }; });
      await b.dispatchEvent('pointerup', { pointerId: id, isPrimary: true });
      return r;
    };
    const top = await leave('up', 21, await page.evaluate(() => QA.B.maxY - 3));
    assert(!top.wall && top.ground && top.y > built.h - 0.5, 'the up arrow takes the hero over the top and on to the roof: ' + JSON.stringify(top));
    await back('going over the top on to the roof', rest);
    const down = await leave('down', 22, 4);
    assert(!down.wall && down.ground && down.y < 1, 'the down arrow takes the hero to the street: ' + JSON.stringify(down));
    await back('climbing down to the street', rest);
    // motion aim on: the line of before is the motion line
    await page.evaluate(() => { window.__sensors = 'granted'; return G.desktop.mobile.start(); });
    const motion = await hintOf();
    assert(/^Point the phone/.test(motion), 'with motion aim on the resting hint says to point the phone: ' + motion);
    assert(await page.evaluate(() => { const ok = QA.flyIn(); G.test.step(1 / 60, 2); return ok; }), 'a phone holds the wall (motion aim on)');
    assert(/^On the wall/.test(await hintOf()), 'with motion aim on the wall still says how to climb');
    // on the wall a line that does not come from the wall must not hide the wall line: a Center press, and a tap that finds nothing
    // (the picker finds no target for it, so main.js dry-fires and tells the panel)
    await page.locator('[data-action=center]').click();
    await page.evaluate(() => G.test.step(1 / 60, 2));
    const centred = await hintOf();
    assert(/^On the wall/.test(centred), 'a Center press on the wall keeps the wall line: ' + centred);
    console.log('PASS a Center press on the wall keeps the wall line');
    const dry = await page.evaluate(() => {
      const tap = G.picker.tap; G.picker.tap = () => null;
      G.desktop.mobile.tap(1); G.test.step(1 / 60, 6);
      G.picker.tap = tap;
      return { wall: !!G.P.wall, dry: G.test.events().slice(-12).some((e) => e.type === 'dry'), hint: document.querySelector('.phone-hint').textContent };
    });
    assert(dry.wall && dry.dry, 'a tap with nothing in reach is a dry fire and the hero stays on the wall: ' + JSON.stringify(dry));
    assert(/^On the wall/.test(dry.hint), 'a tap that finds nothing on the wall keeps the wall line: ' + dry.hint);
    console.log('PASS a tap that finds nothing on the wall keeps the wall line');
    await page.locator('.phone-climb [data-action=hop]').click();
    await page.evaluate(() => G.test.step(1 / 60, 4));
    await back('JUMP with motion aim on', motion);
    // the Motion button on the wall: motion aim goes off, the wall line stays, and the line of that moment (the tap line) comes back off the wall
    assert(await page.evaluate(() => { const ok = QA.flyIn(); G.test.step(1 / 60, 2); return ok; }), 'a phone holds the wall (Motion press)');
    await page.locator('[data-action=motion]').click();
    await page.evaluate(() => G.test.step(1 / 60, 2));
    const toggled = await hintOf();
    assert(/^On the wall/.test(toggled), 'a Motion press on the wall keeps the wall line: ' + toggled);
    console.log('PASS a Motion press on the wall keeps the wall line');
    await page.locator('.phone-climb [data-action=hop]').click();
    await page.evaluate(() => G.test.step(1 / 60, 4));
    await back('JUMP after Motion went off on the wall', rest);
    assert.equal(stale.length, 0, 'the wall line "On the wall..." must not stay after the hero leaves the wall: ' + stale.join('; '));
    assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
    console.log('PASS no runtime errors');
  }
} finally { await close(); }
