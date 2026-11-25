// A held rope next to the first street car, at 1280 and at 390.
// The first click only takes the pointer lock. The next hold must still be on at 5.5 s, with no snap.
// Ring shots reset the lesson first, so the gold ring stays the target. The attach point is the hand-to-anchor
// distance. Run from the repo root: NODE_PATH=qa/browser/node_modules node qa/vr/street-hold.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog, shot } from "./lib.mjs";

const { check, done } = checker("street-hold");
watchdog(720000, "street-hold");
const out = process.env.SHOTS || "/tmp/street-hold";
await mkdir(out, { recursive: true });

const FAKELOCK = () => {
  let el = null;
  Object.defineProperty(Document.prototype, "pointerLockElement", { get: () => el, configurable: true });
  Element.prototype.requestPointerLock = function () {
    const me = this;
    return Promise.resolve().then(() => {
      if (el !== me) { el = me; document.dispatchEvent(new Event("pointerlockchange")); }
    });
  };
  Document.prototype.exitPointerLock = function () {
    if (el) { el = null; Promise.resolve().then(() => document.dispatchEvent(new Event("pointerlockchange"))); }
  };
};

const http = [];
async function boot(width, height) {
  const page = await newPage({ width, height });
  page.on("response", (res) => { if (res.status() >= 400) http.push(res.status() + " " + res.url()); });
  await page.addInitScript(FAKELOCK);
  await page.addInitScript(() => {
    window.AudioContext = window.webkitAudioContext = undefined;
    Object.defineProperty(navigator, "getGamepads", { value: () => [] });
  });
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click({ noWaitAfter: true });
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  return page;
}

try {
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const page = await boot(w, h);
    if (w !== 1280) await page.setViewportSize({ width: w, height: h });
    const lock = await page.evaluate(async () => {
      const canvas = document.querySelector("canvas");
      if (document.pointerLockElement) document.exitPointerLock();
      await new Promise((r) => setTimeout(r, 40));
      if (G.state === "paused" && G.ui && G.ui.closePause) G.ui.closePause();
      const before = G.test.events().filter((e) => e.type === "fire").length;
      canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1, isPrimary: true }));
      canvas.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      await new Promise((r) => setTimeout(r, 40));
      G.test.step(1 / 60, 4);
      document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
      return {
        locked: document.pointerLockElement === canvas && !!G.desktop.locked,
        fires: G.test.events().filter((e) => e.type === "fire").length - before,
        state: G.state,
      };
    });
    check(lock.locked && lock.fires === 0, w + " first click takes the pointer lock and does not fire", lock);

    const holds = await page.evaluate(() => {
      const first = G.test.traffic(400).list[0];
      const spot = {
        x: first.x + first.fz * 4, z: first.z - first.fx * 4,
        y: G.city.groundY(first.x + first.fz * 4, first.z - first.fx * 4),
        fx: first.fx, fz: first.fz, i: first.i,
      };
      const rows = [];
      const canvas = document.querySelector("canvas");
      for (let i = 0; i < 10; i++) {
        document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
        G.test.teleport(spot.x, spot.y, spot.z);
        G.test.face(spot.x + spot.fx, spot.z + spot.fz);
        if (G.flatcam) { G.flatcam.bankOn = false; G.flatcam.shakeOn = false; G.flatcam.reset(G.rigYaw, -0.15); }
        G.P.vel.x = G.P.vel.y = G.P.vel.z = 0;
        G.P.onGround = true;
        if (G.game && G.game.progress) G.game.progress.tutorial = 0;
        for (let k = 0; k < 6; k++) G.test.step(1 / 60, 1);
        const mark = G.test.events().length;
        canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true }));
        let rope = null;
        for (let n = 0; n < 40 && !rope; n++) {
          G.test.step(1 / 60, 1);
          const live = G.P.ropes.find((r) => r.state === "attached");
          if (!live) continue;
          const side = G.P.ropes.indexOf(live);
          const hand = G.hero.hand(side);
          rope = {
            id: live.target && live.target.id, tag: live.target && live.target.tag,
            y: +live.anchor.y.toFixed(1),
            dist: +Math.hypot(live.anchor.x - hand.x, live.anchor.y - hand.y, live.anchor.z - hand.z).toFixed(2),
          };
        }
        for (let n = 0; n < 330; n++) G.test.step(1 / 60, 1);
        const snaps = G.test.events().slice(mark).filter((e) => e.type === "snap").length;
        const still = G.P.ropes.some((r) => r.state === "attached");
        rows.push({ car: { i: spot.i, x: +spot.x.toFixed(1), z: +spot.z.toFixed(1) }, rope, still, snaps, dead: G.P.dead, t: 330 / 60 });
      }
      document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
      return rows;
    });
    const held = holds.filter((r) => r.still && r.snaps === 0 && r.rope);
    console.log(w + " street", JSON.stringify(holds.map((r) => ({ id: r.rope && r.rope.id, y: r.rope && r.rope.y, dist: r.rope && r.rope.dist, still: r.still, snaps: r.snaps }))));
    check(held.length === 10, w + " street holds next to the first traffic car stay on at 5.5 s, 10/10, no snap", holds);
    await page.evaluate(() => G.test.render(0));
    await shot(page, "street-hold-" + w);
    await page.screenshot({ path: out + "/street-hold-" + w + ".png" });

    const rings = await page.evaluate(() => {
      const R = G.city.goldRing;
      const canvas = document.querySelector("canvas");
      const down = (button) => canvas.dispatchEvent(new MouseEvent("mousedown", { button, bubbles: true, cancelable: true }));
      const up = (button) => document.dispatchEvent(new MouseEvent("mouseup", { button, bubbles: true }));
      const one = (button) => {
        up(0); up(2);
        if (G.game && G.game.progress) G.game.progress.tutorial = 0;
        G.test.teleport(R.x + (R.nx || 0) * 14, R.y - 1.5, R.z + (R.nz || 0) * 14);
        G.test.face(R.x, R.z);
        if (G.flatcam) { G.flatcam.bankOn = false; G.flatcam.shakeOn = false; G.flatcam.reset(G.rigYaw, 0); }
        G.P.onGround = false; G.P.vel.x = G.P.vel.y = G.P.vel.z = 0;
        for (let k = 0; k < 4; k++) G.test.step(1 / 60, 1);
        down(button);
        let rope = null;
        for (let n = 0; n < 20; n++) {
          G.test.step(1 / 60, 1);
          const live = G.P.ropes.find((r) => r.state !== "idle");
          if (!live) continue;
          const side = G.P.ropes.indexOf(live);
          const hand = G.hero.hand(side);
          rope = {
            side, id: live.target && live.target.id,
            dist: +Math.hypot(live.anchor.x - hand.x, live.anchor.y - hand.y, live.anchor.z - hand.z).toFixed(2),
          };
          break;
        }
        const fires = G.test.events().filter((e) => e.type === "fire").slice(-1).map((e) => e.side);
        return { rope, fires };
      };
      let tower = 0;
      const left = [], right = [], dists = [];
      for (let i = 0; i < 30; i++) {
        const s = one(0);
        if (i < 20) left.push(s);
        if (s.rope && s.rope.id === 952) tower++;
        if (s.rope) dists.push(s.rope.dist);
      }
      up(0);
      for (let i = 0; i < 20; i++) {
        const s = one(2);
        right.push(s);
        if (s.rope) dists.push(s.rope.dist);
      }
      up(2);
      const max = dists.length ? Math.max(...dists) : 0;
      const far = dists.filter((d) => d > 28.8).length;
      return {
        tower, n: dists.length, max, far,
        left: left.filter((s) => s.fires[0] === 0 && s.rope && s.rope.side === 0).length,
        right: right.filter((s) => s.fires[0] === 1 && s.rope && s.rope.side === 1).length,
      };
    });
    console.log(w + " rings", JSON.stringify(rings));
    check(rings.tower === 30 && rings.far === 0 && rings.max <= 28.8, w + " ring ropes attach to tower 952, 30/30, every attach point within 28.8 m of the hand", rings);
    check(rings.left === 20, w + " left button fires the left rope 20/20", rings.left);
    check(rings.right === 20, w + " right button fires the right rope 20/20", rings.right);
    await page.context().close();
  }
  check(http.length === 0, "0 HTTP errors", http.slice(0, 5));
  done();
} finally { await close(); }
