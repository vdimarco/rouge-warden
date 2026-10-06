// Facade shots for the window-variety check (openspec change full-swing-window-variety): street views facing a building
// face in each district (16 m and 34 m out), three tall faces seen from 40 m, and four rooftop views across the city
// (two from the start roof, two from safe roofs), in flat play with the HUD hidden.
// The spots come from the city's own data (no randomness), so two runs frame the same buildings for a before/after look.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/facade-shots.mjs
// The PNGs go to $SHOTS, or to facade-shots/ in the system temp folder. PHONE=1 shoots at a phone size (844 x 390).
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { newPage, open, close, watchdog } from "./lib.mjs";

watchdog(1800000, "facade shots");
const out = process.env.SHOTS || path.join(os.tmpdir(), "facade-shots");
await mkdir(out, { recursive: true });
const phone = !!process.env.PHONE;
const W = phone ? 844 : 960, H = phone ? 390 : 540;
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, "getGamepads", { value: () => [] }); };

// In the page: spots on the street gap metres out from a face of a building in each district, facing it.
const SPOTS = ({ gap, minH = 14, per = 2 }) => {
  const C = G.city, spots = [];
  for (let d = 0; d < 6; d++) {
    let n = 0;
    for (const b of C.buildings) {
      if (b.district !== d || b.roofY < minH || n >= per) continue;
      const t = b.tiers[0], mx = (t.minX + t.maxX) / 2, mz = (t.minZ + t.maxZ) / 2;
      for (const q of [{ x: t.maxX + gap, z: mz, dx: -1, dz: 0 }, { x: t.minX - gap, z: mz, dx: 1, dz: 0 }, { x: mx, z: t.maxZ + gap, dx: 0, dz: -1 }, { x: mx, z: t.minZ - gap, dx: 0, dz: 1 }]) {
        if (C.isWater(q.x, q.z) || C.groundY(q.x, q.z) > 0.5) continue;
        let free = true;
        for (let y = 0.5; y < 6; y += 1) if (C.collideSphere(q.x, y, q.z, 1.2)) free = false;
        if (!free) continue;
        const r = C.raycast(q.x, 1.6, q.z, q.dx, 0, q.dz, gap + 2, {});
        if (!r || Math.abs(r.t - gap) > 0.6) continue;
        spots.push({ d, x: q.x, z: q.z, yaw: Math.atan2(-q.dx, -q.dz), bid: b.id, h: b.roofY });
        n++;
        break;
      }
    }
  }
  return spots;
};
async function shot(page, name, x, y, z, yaw, pitch) {
  await page.evaluate(({ x, y, z, yaw, pitch }) => {
    G.test.teleport(x, y, z); G.rigYaw = yaw; G.flatcam.reset(yaw);
    G.P.frozen = true;
    G.test.step(1 / 60, 40);
    if (pitch !== undefined) {
      const f = G.test.flat(), SENS = 0.0022, px = -((pitch - f.pitch) / SENS);
      G.desktop.locked = true;
      for (let n = Math.ceil(Math.abs(px) / 190) || 1, i = 0; i < n; i++) window.dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: px / n }));
      G.desktop.locked = false;
      G.test.step(1 / 60, 30);
    }
  }, { x, y, z, yaw, pitch });
  const file = path.join(out, name + ".png");
  await page.screenshot({ path: file });
  console.log("shot " + file);
}

try {
  const page = await newPage({ width: W, height: H });
  await page.addInitScript(quiet);
  await open(page, "?nosw&skipintro"); await page.waitForFunction(() => G.viewDone);
  await page.locator("#playFlat").click({ noWaitAfter: true }); await page.waitForFunction(() => G.state === "play");
  await page.evaluate(() => G.test.hold(true));
  await page.waitForFunction(() => G.hero && G.hero.model !== "loading", null, { timeout: 180000 });
  await page.waitForFunction(() => !G.view || !G.view.art || G.view.art.loaded, null, { timeout: 120000 }).catch(() => {});
  // the HUD off for the shots: only the game's canvas shows
  await page.addStyleTag({ content: "*:not(html):not(body):not(canvas){visibility:hidden !important} canvas{visibility:visible !important}" });
  const near = await page.evaluate(SPOTS, { gap: 16 });
  const far = await page.evaluate(SPOTS, { gap: 34 });
  const towers = (await page.evaluate(SPOTS, { gap: 40, minH: 70, per: 1 })).slice(0, 3);
  const DEG = Math.PI / 180;
  for (const s of near.filter((_, i) => i % 2 === 0)) await shot(page, `near-d${s.d}-b${s.bid}`, s.x, 0, s.z, s.yaw, 22 * DEG);
  for (const s of far.filter((_, i) => i % 2 === 1)) await shot(page, `far-d${s.d}-b${s.bid}`, s.x, 0, s.z, s.yaw, 18 * DEG);
  // towers: from mid air (the hero held still), 40 m out from a tall face, a little above its middle
  for (const s of towers) await shot(page, `tower-d${s.d}-b${s.bid}`, s.x, Math.min(60, s.h * 0.4), s.z, s.yaw, 8 * DEG);
  const st = await page.evaluate(() => G.city.start);
  await shot(page, "roof-start-a", st.x, st.y, st.z, st.yaw + 0.5, 4 * DEG);
  await shot(page, "roof-start-b", st.x, st.y, st.z, st.yaw - 2.4, 4 * DEG);
  const safe = await page.evaluate(() => G.city.safe.slice(0, 12).map((s) => ({ x: s.x, y: s.y, z: s.z })));
  await shot(page, "roof-a", safe[3].x, safe[3].y, safe[3].z, 0.7, -8 * DEG);
  await shot(page, "roof-b", safe[8].x, safe[8].y, safe[8].z, 2.6, -8 * DEG);
  if (page.errors.length) console.log("page errors:\n" + page.errors.join("\n"));
} finally {
  await close();
}
