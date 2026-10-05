// Street life, bloom and the dive in flat play: people walk the sidewalks and are drawn; a landing near them gets a cheer
// (a gasp and a jump back when it is hard and close); the neon signs glow; the Comfort menu's Bloom row changes the glow and
// is saved; a fall with no rope is a head-first dive that flips upright before the ground or when a rope catches.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/street.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("street");
watchdog(1500000, "street");
const out = SHOTS || "/tmp/swing-qa";
await mkdir(out, { recursive: true });
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, "getGamepads", { value: () => [] }); };

// In the page: helpers to step, to stand on a street, to read the frame's brightness, and to read the hero's dive.
const SETUP = () => {
  window.QA = {
    step(n = 1) { G.test.step(1 / 60, n); },
    // stand on the sidewalk of the z = 14 avenue in the Market, looking west along it (the signs are on both sides)
    street(y = 0) {
      G.test.teleport(-150, y, 2); G.rigYaw = Math.PI / 2; G.desktop.level(0);
      if (y > 0) { G.P.vel.x = 0; G.P.vel.y = 0; G.P.vel.z = 0; }
    },
    // the mean brightness of a grid over the frame, drawn through the real path (bloom included)
    bright() {
      G.test.render();
      const gl = G.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
      let s = 0, n = 0;
      for (let i = 1; i < 16; i++) for (let j = 1; j < 9; j++) { gl.readPixels(Math.floor((w * i) / 16), Math.floor((h * j) / 9), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); s += px[0] + px[1] + px[2]; n++; }
      return s / n / 3;
    },
    dive() {
      const h = G.hero.info(), tilt = G.hero.root.getObjectByName("hero-tilt"), v = G.P.vel, sp = Math.hypot(v.x, v.y, v.z);
      const q = tilt.getWorldQuaternion(new G.camera.quaternion.constructor()), up = new G.camera.position.constructor(0, 1, 0).applyQuaternion(q);
      const ang = sp > 0.1 ? Math.acos(Math.max(-1, Math.min(1, (up.x * v.x + up.y * v.y + up.z * v.z) / sp))) * 180 / Math.PI : 180;
      // the hands against the shoulders, along the body's up axis (the head stands in for the shoulders, 0.25 m under it)
      const hd = h.head, along = (p) => (p[0] - hd[0]) * up.x + (p[1] - hd[1]) * up.y + (p[2] - hd[2]) * up.z;
      return { pose: h.pose, dive: h.weights.dive, ang, hands: h.hands.map(along), y: G.P.pos.y, vy: v.y, ground: G.P.onGround };
    },
  };
};

try {
  const page = await newPage({ width: 960, height: 540 });
  await page.addInitScript(quiet);
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await page.evaluate(SETUP);

  /* ---- people ---- */
  const ppl = await page.evaluate(() => { QA.street(); QA.step(240); return G.test.street(true); });
  const near = ppl.people.filter((p) => Math.hypot(p.x + 150, p.z - 2) < 80);
  check(ppl.count >= 100 && ppl.view.people >= 40 && ppl.view.people <= ppl.count, "people are out, and the ones near the camera drawn (" + ppl.count + " out, " + ppl.view.people + " drawn)", { count: ppl.count, view: ppl.view });
  check(near.length >= 25, "at least 25 people within 80 m of a Market street (" + near.length + ")");
  check(ppl.people.every((p) => p.onWalk), "every person is on a sidewalk or a zebra", ppl.people.filter((p) => !p.onWalk).slice(0, 3));
  check(ppl.signs >= 1400 && ppl.view.signsAll === ppl.signs && ppl.view.signs >= 50 && ppl.view.signs < ppl.signs, "the shop signs are laid out, and the ones near the camera drawn (" + ppl.view.signs + " of " + ppl.signs + ")", ppl.view);
  const ri = await page.evaluate(() => G.test.render());
  check(ri.calls > 0 && ri.calls <= 130, "the draw calls stay in budget with the people and the signs (" + ri.calls + ")", ri);
  await page.screenshot({ path: out + "/street-market.png" });

  /* ---- bloom: the Comfort row, the glow, the saved choice ---- */
  const b0 = await page.evaluate(() => G.test.bloom());
  check(b0.want === "low", "with a mouse the bloom starts on Low", b0);
  const row = await page.evaluate(() => { G.test.uiPress("comfort"); return G.test.ui().buttons.filter((b) => b.id.startsWith("bloom:")).map((b) => b.id); });
  check(["bloom:off", "bloom:low", "bloom:high"].every((id) => row.includes(id)), "the Comfort page has the Bloom row: Off, Low, High", row);
  const lv = await page.evaluate(() => {
    QA.street(); G.test.look(0, 0.05); QA.step(2);
    const r = {};
    for (const l of ["off", "low", "high"]) { G.test.uiPress("bloom:" + l); r[l] = QA.bright(); r[l + "L"] = G.test.bloom().level; }
    return r;
  });
  check(lv.offL === "off" && lv.lowL === "low" && lv.highL === "high", "each choice renders at its own level", lv);
  check(lv.high > lv.low + 1 && lv.low > lv.off + 0.5, "the glow grows from Off to Low to High (mean " + [lv.off, lv.low, lv.high].map((v) => v.toFixed(1)).join(", ") + ")", lv);
  await page.screenshot({ path: out + "/street-bloom-high.png" });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("plungerd.vr.v1") || "{}"));
  check(saved.settings && saved.settings.bloom === "high", "the choice is saved", saved.settings);
  await page.evaluate(() => { G.test.uiPress("bloom:off"); QA.bright(); });
  await page.screenshot({ path: out + "/street-bloom-off.png" });
  await page.evaluate(() => { G.test.uiPress("bloom:low"); G.test.uiPress("back"); G.test.uiPress("resume"); });

  /* ---- reactions through the game: a hard landing on the sidewalk next to people ---- */
  const react = await page.evaluate(() => {
    QA.street(); QA.step(30);
    const s0 = G.test.street(true).people.filter((p) => p.state === "walk").sort((a, b) => Math.hypot(a.x + 150, a.z - 2) - Math.hypot(b.x + 150, b.z - 2))[0];
    const before = G.test.street().stats;
    // drop the hero 3 m beside that person from 12 m up
    G.test.teleport(s0.x + 3, 12, s0.z); G.P.vel.x = 0; G.P.vel.z = 0; G.P.vel.y = -8;
    for (let i = 0; i < 120 && !G.P.onGround; i++) QA.step(1);
    QA.step(3);
    const after = G.test.street(true), me = after.people.find((p) => p.id === s0.id);
    return { before, after: after.stats, me, ground: G.P.onGround };
  });
  check(react.ground && react.after.cheers + react.after.flees > react.before.cheers + react.before.flees, "a landing on the sidewalk is seen by the people near", react);
  check(react.after.flees > react.before.flees && react.me && (react.me.state === "flee" || react.me.state === "cheer"), "the person next to a hard landing jumps back or cheers", react.me);

  /* ---- the dive ---- */
  const d = await page.evaluate(() => {
    // 110 m over the middle of the z = 14 avenue, still
    G.test.teleport(-150, 110, 14); G.P.vel.x = 4; G.P.vel.y = 0; G.P.vel.z = 0;
    const rec = [];
    for (let i = 0; i < 900 && !G.P.onGround; i++) { QA.step(1); if (i % 2 === 0 || G.P.pos.y < 30) rec.push(QA.dive()); }
    QA.step(4);
    return { rec, end: QA.dive() };
  });
  const at1 = d.rec.find((r) => r.vy < -12);
  check(at1 && at1.pose === "dive" && at1.dive > 0.8, "after a second of falling the pose is a dive", at1);
  const deep = d.rec.filter((r) => r.dive > 0.95);
  check(deep.length > 5 && deep.every((r) => r.ang < 50), "diving, the body's up axis points along the flight (worst " + Math.max(...deep.map((r) => r.ang)).toFixed(1) + " degrees)");
  const up = deep.filter((r) => !(r.hands[0] < -0.25 && r.hands[1] < -0.25));
  check(deep.length > 0 && up.length === 0, "diving, both hands are down the body from the shoulders", up.slice(0, 3));
  // the last second before the ground: upright again (the dive weight low) before the feet touch
  const last = d.rec.filter((r) => !r.ground).slice(-3);
  check(last.length && last.every((r) => r.dive < 0.2), "the hero flips upright before the landing", last);
  check(d.end.ground && (d.end.pose === "land" || d.end.pose === "idle" || d.end.pose === "run"), "the landing plays as before", d.end);

  const c = await page.evaluate(() => {
    // over the z = -370 avenue in the Financial district, between towers taller than the fall
    G.test.teleport(-40, 125, -370); G.P.vel.x = 4; G.P.vel.y = 0; G.P.vel.z = 0;
    QA.step(70);
    const before = QA.dive();
    // a rope to the nearest wall in front (a point on a tall building beside the avenue)
    const p = G.P.pos, C = G.city, hit = C.raycast(p.x, p.y + 1.2, p.z, 0, 0.3, -1, 60) || C.raycast(p.x, p.y + 1.2, p.z, 0, 0.3, 1, 60);
    if (!hit) return { before, none: true };
    G.test.aimAt(1, hit.x, hit.y, hit.z); G.test.press(1, true);
    let n = 0;
    for (; n < 60 && G.P.ropes[1].state !== "attached"; n++) QA.step(1);
    QA.step(24);
    return { before, after: QA.dive(), n, rope: G.P.ropes[1].state };
  });
  check(c.before.pose === "dive", "set up: diving before the rope", c.before);
  check(c.none || (c.rope === "attached" && c.after.dive < 0.2 && c.after.pose !== "dive"), "a rope that catches ends the dive within 0.4 s", c);

  check(page.errors.length === 0, "no errors", page.errors);
  await page.context().close();
} catch (e) { check(false, "street threw", e.stack || String(e)); }

await close();
done();
