// The standard shots of the flat-screen chase camera (js/flatcam.js): nine views a player sees, saved as PNGs, with the numbers
// that say where the camera is. For each shot it prints the camera height over the hero's head, the camera's distance from
// the head and its arm, the pitch, and where the head and the feet land on the screen (NDC; inside is -1 to 1).
// Run from the repo root: NODE_PATH=qa/browser/node_modules node qa/vr/view-shots.mjs
// The PNGs go to $SHOTS, or to view-shots/ in the system temp folder. A small magenta ring marks the middle of the screen
// (the aim) in the PNGs only; the page itself has no such mark in the chase view.
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { newPage, open, close, watchdog } from "./lib.mjs";

watchdog(2400000, "view shots"); // nine shots at 960 x 540 on a software renderer: slow on a busy machine
const out = process.env.SHOTS || path.join(os.tmpdir(), "view-shots");
await mkdir(out, { recursive: true });
const DEG = Math.PI / 180, SENS = 0.0022; // desktop.js: radians of look per pixel of mouse travel
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, "getGamepads", { value: () => [] }); };
const phone = () => {
  Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
  window.DeviceOrientationEvent.requestPermission = () => Promise.resolve("denied");
  window.DeviceMotionEvent.requestPermission = () => Promise.resolve("denied");
};

// In the page: the numbers for a shot, the mouse, and spots in the city.
const SETUP = () => {
  const C = G.city, V3 = G.camera.position.constructor;
  const ndc = (x, y, z) => { const v = new V3(x, y, z).project(G.camera); return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), in: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1 }; };
  window.VS = {
    measure() {
      G.camera.updateMatrixWorld(true);
      const c = G.camera.position, h = G.hero.head, p = G.P.pos, f = G.test.flat(), v = G.P.vel;
      return {
        camOverHead: +(c.y - h.y).toFixed(2), camToHead: +Math.hypot(c.x - h.x, c.y - h.y, c.z - h.z).toFixed(2), arm: +f.dist.toFixed(2),
        pitch: +(f.pitch / (Math.PI / 180)).toFixed(1), fov: +f.fov.toFixed(1), head: ndc(h.x, h.y, h.z), feet: ndc(p.x, p.y, p.z),
        speed: +Math.hypot(v.x, v.y, v.z).toFixed(1), blocked: f.blocked, opacity: +f.opacity.toFixed(2),
        inside: !!C.collideSphere(c.x, c.y, c.z, 0.12, {}),
      };
    },
    // a mouse move under pointer lock, in pixels (up is negative), as the browser sends it: at most 200 px an event
    mouse(dx, dy) {
      G.desktop.locked = true;
      for (let n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 190) || 1, i = 0; i < n; i++) window.dispatchEvent(new MouseEvent("mousemove", { movementX: dx / n, movementY: dy / n }));
      G.test.step(1 / 60, 1);
      G.desktop.locked = false;
    },
    clear() {
      for (const i of [0, 1]) { G.test.press(i, false); G.test.aimAt(i, null); }
      G.P.frozen = false;
      const s = C.start;
      G.test.teleport(s.x, s.y, s.z); G.rigYaw = s.yaw; G.flatcam.reset(s.yaw); G.test.step(1 / 60, 30);
    },
    // a spot on a lower roof, gap metres from the wall of the tier above it (as in hero.mjs)
    wall(gap) {
      for (const b of C.buildings) for (let i = 1; i < b.tiers.length; i++) {
        const L = b.tiers[i - 1], U = b.tiers[i];
        if (Math.abs(L.y1 - U.y0) > 0.5 || U.maxX - U.minX < 6 || U.maxZ - U.minZ < 6 || U.y1 - U.y0 < 8) continue;
        const mx = (U.minX + U.maxX) / 2, mz = (U.minZ + U.maxZ) / 2;
        for (const q of [{ x: U.minX - gap, z: mz, dx: 1, dz: 0 }, { x: U.maxX + gap, z: mz, dx: -1, dz: 0 }, { x: mx, z: U.minZ - gap, dx: 0, dz: 1 }, { x: mx, z: U.maxZ + gap, dx: 0, dz: -1 }]) {
          const tb = C.topBelow(q.x, L.y1 + 0.6, q.z, 0.3);
          if (!tb || Math.abs(tb.y - L.y1) > 0.2) continue;
          const hit = C.raycast(q.x, L.y1 + 1.3, q.z, q.dx, 0, q.dz, gap + 3, {});
          if (hit && Math.abs(hit.t - gap) < 0.3) return { ...q, y: L.y1 };
        }
      }
      return null;
    },
    // a one-box building with a clear street face (+x), to hold on to (as in climb.e2e.mjs)
    climbWall() {
      return C.colliders.find((c) => {
        if (!(c.type === "box" && c.tag === "building" && c.minY === 0 && c.maxY > 25 && c.maxY < 90)) return false;
        if (C.colliders.some((d) => d !== c && d.bid === c.bid)) return false;
        const z = (c.minZ + c.maxZ) / 2;
        for (let y = 0.5; y < c.maxY + 3; y += 1) if (C.collideSphere(c.maxX + 2, y, z, 1.6)) return false;
        return !C.isWater(c.maxX + 1, z) && C.groundY(c.maxX + 1, z) < 0.5;
      });
    },
  };
};

const rows = [];
async function snap(page, name, note) {
  const m = await page.evaluate(() => VS.measure());
  // the aim mark, for the PNG only
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "vs-mark";
    d.style.cssText = "position:fixed;left:50%;top:50%;width:10px;height:10px;margin:-6px 0 0 -6px;border:2px solid #f0f;border-radius:50%;z-index:99999;pointer-events:none";
    document.body.appendChild(d);
  });
  const file = path.join(out, name + ".png");
  await page.screenshot({ path: file });
  await page.evaluate(() => document.getElementById("vs-mark").remove());
  rows.push({ name, ...m });
  console.log(`${name}  cam-head ${m.camOverHead} m  cam to head ${m.camToHead} m  arm ${m.arm} m  pitch ${m.pitch} deg  head ${m.head.in ? "in" : "OUT"} (${m.head.x}, ${m.head.y})  feet ${m.feet.in ? "in" : "OUT"} (${m.feet.x}, ${m.feet.y})  fov ${m.fov}  speed ${m.speed}${m.blocked ? "  blocked" : ""}${m.inside ? "  INSIDE A BUILDING" : ""}  ${note || ""}`);
  return m;
}
// look to a pitch (degrees) with the mouse, from wherever the view is
async function lookTo(page, deg) {
  const p = await page.evaluate(() => G.test.flat().pitch);
  await page.evaluate((px) => VS.mouse(0, px), -((deg * DEG - p) / SENS));
}

try {
  /* ---------------- desktop ---------------- */
  const page = await newPage({ width: 960, height: 540 });
  await page.addInitScript(quiet);
  await open(page, "?nosw&skipintro"); await page.waitForFunction(() => G.viewDone);
  await page.locator("#playFlat").click({ noWaitAfter: true }); await page.waitForFunction(() => G.state === "play");
  await page.evaluate(() => G.test.hold(true));
  await page.waitForFunction(() => G.hero && G.hero.model !== "loading", null, { timeout: 180000 });
  await page.evaluate(SETUP);

  // s1: the default view right after PLAY, no look input
  await page.evaluate(() => G.test.step(1 / 60, 120));
  await snap(page, "s1-default", "(the view after PLAY)");
  // s2 to s4: looking up 30 degrees, up as far as the mouse goes, down 45 degrees (pitch from level)
  await lookTo(page, 30); await page.evaluate(() => G.test.step(1 / 60, 30));
  await snap(page, "s2-up30");
  await page.evaluate(() => { VS.mouse(0, -3000); G.test.step(1 / 60, 30); });
  await snap(page, "s3-up-max");
  await lookTo(page, -45); await page.evaluate(() => G.test.step(1 / 60, 30));
  await snap(page, "s4-down45");

  // s5: mid-swing, a rope on a tall building ahead, at 18 to 25 m/s low in the arc
  await page.evaluate(() => VS.clear());
  const swing = await page.evaluate(() => {
    const C = G.city, s = C.start;
    // from 30 m over the start avenue, moving along it, the first face 30-70 m ahead and up
    const y0 = s.y + 22;
    for (const el of [0.75, 0.9, 0.6]) for (const az of [0, 0.25, -0.25, 0.5, -0.5]) {
      const ya = s.yaw + az, fx = -Math.sin(ya), fz = -Math.cos(ya);
      G.test.teleport(s.x, y0, s.z); G.rigYaw = s.yaw; G.flatcam.reset(s.yaw);
      const r = C.raycast(s.x, y0 + 1.6, s.z, fx * Math.cos(el), Math.sin(el), fz * Math.cos(el), 75, {});
      if (!r || r.t < 30) continue;
      const P = G.P; P.onGround = false; P.vel.x = -Math.sin(s.yaw) * 12; P.vel.z = -Math.cos(s.yaw) * 12; P.vel.y = 0;
      G.test.aimAt(1, r.x, r.y, r.z); G.test.press(1, true);
      let best = null;
      for (let i = 0; i < 360; i++) {
        G.test.step(1 / 60, 1);
        const v = P.vel, sp = Math.hypot(v.x, v.y, v.z), on = P.ropes[1].state === "attached";
        if (P.dead || P.onGround) break;
        if (!on) continue;
        // low in the arc: the rope within 30 degrees of hanging straight down, and the speed in range
        const A = P.ropes[1].anchor, ry = A.y - (P.pos.y + P.chest), rh = Math.hypot(A.x - P.pos.x, A.z - P.pos.z);
        if (sp >= 18 && sp <= 25 && ry > 0 && rh < ry * Math.tan(Math.PI / 6)) { best = { i, sp, vy: v.y, rope: +(Math.atan2(rh, ry) * 180 / Math.PI).toFixed(0) }; break; }
      }
      if (best) return best;
      for (const i of [0, 1]) { G.test.press(i, false); G.test.aimAt(i, null); }
    }
    return null;
  });
  if (swing) await snap(page, "s5-swing", "(rope attached, " + swing.i + " frames in, " + swing.rope + " degrees off vertical, vy " + swing.vy.toFixed(1) + ")");
  else console.log("s5-swing  FAILED: no swing reached 18-25 m/s low in the arc");

  // s6: 60 m over the street, falling, looking level
  await page.evaluate(() => VS.clear());
  await page.evaluate(() => {
    const C = G.city, s = C.start;
    for (let d = 20; d < 200; d += 5) {
      const x = s.x - Math.sin(s.yaw) * d, z = s.z - Math.cos(s.yaw) * d;
      if (C.groundY(x, z) > 0.5 || C.collideSphere(x, 60, z, 6)) continue;
      G.test.teleport(x, 60, z); G.rigYaw = s.yaw; G.flatcam.reset(s.yaw);
      const P = G.P; P.onGround = false; P.vel.x = P.vel.z = 0; P.vel.y = -12;
      return;
    }
  });
  await lookTo(page, 0); await page.evaluate(() => G.test.step(1 / 60, 8));
  await snap(page, "s6-fall", "(over the street)");

  // s7: holding a building wall, looking up 20 degrees
  await page.evaluate(() => VS.clear());
  const held = await page.evaluate(() => {
    const B = VS.climbWall(); if (!B) return false;
    G.test.teleport(B.maxX + 3, B.maxY / 2, (B.minZ + B.maxZ) / 2); G.rigYaw = Math.PI / 2; G.flatcam.reset(Math.PI / 2);
    G.P.vel.x = -8; G.test.step(1 / 60, 30);
    return !!G.P.wall;
  });
  await lookTo(page, 20); await page.evaluate(() => G.test.step(1 / 60, 30));
  await snap(page, "s7-wall-up20", held ? "(holding the wall)" : "(NOT holding a wall)");

  // s8: standing with a wall 1 m behind the hero
  await page.evaluate(() => VS.clear());
  const w = await page.evaluate(() => {
    const w = VS.wall(1); if (!w) return null;
    G.test.teleport(w.x, w.y, w.z); const yaw = Math.atan2(w.dx, w.dz); G.rigYaw = yaw; G.flatcam.reset(yaw); G.test.step(1 / 60, 60);
    return w;
  });
  if (w) await snap(page, "s8-wall-behind", "(a wall 1 m behind)");
  else console.log("s8-wall-behind  FAILED: no roof with a wall next to it");
  if (page.errors.length) console.log("desktop page errors: " + JSON.stringify(page.errors));
  await page.context().close();

  /* ---------------- phone, portrait ---------------- */
  const ph = await newPage({ width: 390, height: 844 });
  await ph.addInitScript(quiet); await ph.addInitScript(phone);
  await open(ph, "?nosw"); await ph.waitForFunction(() => G.viewDone);
  await ph.locator("#playFlat").click({ noWaitAfter: true }); await ph.waitForFunction(() => G.state === "play");
  await ph.evaluate(() => G.test.hold(true));
  await ph.waitForFunction(() => G.hero && G.hero.model !== "loading", null, { timeout: 180000 });
  await ph.evaluate(SETUP);
  await ph.evaluate(() => G.test.step(1 / 60, 120));
  await snap(ph, "s9-phone", "(390 x 844, touch)");
  if (ph.errors.length) console.log("phone page errors: " + JSON.stringify(ph.errors));
  console.log("PNGs in " + out);
} finally { await close(); }
