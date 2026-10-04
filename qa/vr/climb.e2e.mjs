// Wall climbing in flat play and the roof antennas: fly into a wall and hold on, W or the up arrow climbs, D goes along
// the wall, Space jumps off, the top steps on to the roof, a phone gets a climb pad, and a rope catches a roof antenna
// that you can then climb. Run from the repo root (the server is our own, see lib.mjs).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { newPage, open, close, watchdog } from './lib.mjs';
watchdog(300000, 'climb');
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
    flyIn() {
      G.test.teleport(B.maxX + 3, B.maxY / 2, QA.z); G.rigYaw = Math.PI / 2; G.desktop.level(0);
      G.P.vel.x = -8; G.test.step(1 / 60, 30);
      return !!G.P.wall;
    },
  };
  return { ok: !!B, h: B && B.maxY };
};

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
    assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
    await close();
  }

  /* ---------------- phone ---------------- */
  {
    const page = await newPage({ width: 390, height: 844 });
    await page.addInitScript(quiet);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      window.DeviceOrientationEvent.requestPermission = () => Promise.resolve('denied');
      window.DeviceMotionEvent.requestPermission = () => Promise.resolve('denied');
    });
    await open(page, '?nosw'); await page.waitForFunction(() => G.viewDone);
    await page.locator('#playFlat').click(); await page.waitForFunction(() => G.state === 'play');
    await page.evaluate(() => G.test.hold(true));
    await page.evaluate(SETUP);
    const pad = page.locator('.phone-climb');
    assert(await pad.isHidden(), 'no climb pad off the wall');
    assert(await page.evaluate(() => QA.flyIn()), 'a phone holds the wall too');
    await page.evaluate(() => G.test.step(1 / 60, 1));
    assert(await pad.isVisible(), 'the climb pad shows on the wall');
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
    // a tap swings you off the wall
    const swing = await page.evaluate(() => {
      QA.flyIn(); G.test.step(1 / 60, 1);
      document.querySelector('[data-action=throw]').onclick(); G.test.step(1 / 60, 30);
      const ev = G.test.events().slice(-12).filter((e) => e.type !== 'input').map((e) => e.type);
      return { wall: !!G.P.wall, rope: G.P.ropes[1].state, ev, fired: ev.includes('fire') && ev.includes('attach') };
    });
    assert(!swing.wall && swing.fired, 'a tap on a wall swings you off it: ' + JSON.stringify(swing));
    console.log('PASS a tap swings you off the wall');
    assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
    console.log('PASS no runtime errors');
  }
} finally { await close(); }
