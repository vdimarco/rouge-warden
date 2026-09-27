// Palette discipline (design 3.6, risk 9): neon means danger, and nothing else in Sedona may read as neon.
// - every PALETTE and CRIMSON entry (js/story/look/palette.js) scores 0.05 or less on the post pass's neon
//   test at light levels 0.5, 1 and 1.6, and greens stay bluish (green - blue under 0.12);
// - every NEON entry does read as neon (the danger colours work);
// - on a live page at NIGHT, a wall of every palette colour, lit, shows no neon pixels (under 0.3%, with
//   the crimson ones keyed), and night views at four places with no gang in view have neon pixels under 0.3%.
import { open, step, stepUntil, storyReady, canvasRGBA, finish, writePNG } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg); };
const SHOTS = process.argv.includes("--shots");
const P = await import(new URL("../../public/crimson/js/story/look/palette.js", import.meta.url).href);

/* ---------------- the numbers ---------------- */
const bad = P.checkNeon({ dev: false });
const n = Object.keys(P.PALETTE).length + Object.keys(P.CRIMSON).length;
check(bad.length === 0, `all ${n} palette colours score 0.05 or less at exposures ${P.EXPOSURES.join(", ")}${bad.length ? ": " + bad.slice(0, 8).map((b) => `${b.name} ${b.hex} ${b.rule || b.score}`).join("; ") : ""}`);
const weak = Object.entries(P.NEON).filter(([, h]) => P.neonScore(h, 1) < 0.5);
check(weak.length === 0, `every NEON colour reads as neon (${Object.keys(P.NEON).join(", ")})${weak.length ? ": weak " + weak.map(([k]) => k).join(", ") : ""}`);
let threw = false; try { P.checkNeon({ entries: { lime: 0x9acd32 }, dev: true }); } catch (e) { threw = true; }
check(threw && P.checkNeon({ entries: { lime: 0x9acd32 }, dev: false }).length > 0, "checkNeon catches a lime green, and throws in dev");

/* ---------------- on screen, at night ---------------- */
const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", width: 640, height: 360 });
check((await storyReady(page)).ok, "the story is ready");
await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 30 });
await step(page, 1);
await page.evaluate(() => {
  const S = __crimson.story.S, T = S.THREE;
  const Q = window.__palQA = { eye: new T.Vector3(), at: new T.Vector3(), on: true };
  S.cameras.add("qa", 1000, () => Q.on, () => { S.camera.position.copy(Q.eye); S.camera.lookAt(Q.at); S.focus.copy(Q.at); if (S.camera.fov !== 55) { S.camera.fov = 55; S.camera.updateProjectionMatrix(); } });
  S.day.set("sun", 23); S.look.set("NIGHT", { clock: false });
});
// neon pixels in the output: the same test as the post pass, on the final picture
const neonPixels = (img) => {
  let k = 0; const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / (mx + 0.02);
    if (g / (r + 0.03) > 0.82 && g - b > 0.2 && sat > 0.45 && g > 0.25) k++;
  }
  return k / (d.length / 4);
};
const view = (x, z, yaw, h = 1.8) => page.evaluate(([x, z, yaw, h]) => {
  const S = __crimson.story.S, Q = __palQA, y = S.world.surface(x, z, 200);
  Q.eye.set(x, y + h, z); Q.at.set(x + Math.sin(yaw) * 30, y + h - 1, z + Math.cos(yaw) * 30);
  if (S.hero) S.hero.place(x, z);
}, [x, z, yaw, h]);

// the swatch wall: every palette colour on a box, crimson ones keyed, lit by the night's moon and fill
const wall = await page.evaluate(async () => {
  const S = __crimson.story.S, T = S.THREE, Q = __palQA;
  const R = await import(new URL("js/render.js", location.href).href);
  const P = await import(new URL("js/story/look/palette.js", location.href).href);
  const p = S.world.place("schnebly_vista"), y = S.world.surface(p.x, p.z, 50);
  const cols = [...Object.entries(P.PALETTE).map(([k, v]) => [k, v, false]), ...Object.entries(P.CRIMSON).map(([k, v]) => [k, v, true])];
  const group = new T.Group(); Q.wall = group; S.scene.add(group);
  const per = 16, sz = 0.55;
  cols.forEach(([, hex, key], i) => {
    const mat = new T.MeshToonMaterial({ color: hex, gradientMap: R.toonRamp });
    if (key) R.KEY.solid(mat);
    const m = new T.Mesh(new T.BoxGeometry(sz, sz, sz), mat);
    m.position.set((i % per - per / 2) * sz * 1.15, Math.floor(i / per) * sz * 1.15, 0);
    m.rotation.y = 0.5; group.add(m);
  });
  const rows = Math.ceil(cols.length / per);
  group.position.set(p.x + 9, y + 0.4, p.z); group.rotation.y = -Math.PI / 2;
  Q.eye.set(p.x, y + 0.4 + rows * sz * 0.58, p.z); Q.at.set(p.x + 9, y + 0.4 + rows * sz * 0.58, p.z);
  return cols.length;
});
for (const [label, hour] of [["moonlit", 23], ["brighter", 23]]) {
  await page.evaluate(([label]) => { const S = __crimson.story.S; S.look.lights.points.forEach((pt, i) => { pt.userData.pinned = label === "brighter"; pt.position.copy(__palQA.eye).add(new S.THREE.Vector3(2, 1 + i, i ? 2 : -2)); pt.intensity = label === "brighter" ? 40 : 0; }); }, [label]);
  await step(page, 0.2);
  const img = await canvasRGBA(page, () => __crimson.step(1 / 60, true));
  if (SHOTS) writePNG(`/tmp/palette_wall_${label}.png`, img);
  const k = neonPixels(img);
  check(k < 0.003, `the ${wall}-colour swatch wall at NIGHT (${label}) shows ${(k * 100).toFixed(3)}% neon pixels (under 0.3%)`);
}
await page.evaluate(() => { const S = __crimson.story.S; __palQA.wall.visible = false; for (const pt of S.look.lights.points) { pt.userData.pinned = false; pt.intensity = 0; } });

// night views at places with no gang in view
const places = ["uptown", "midgley_lot", "airport_overlook", "y_roundabout"];
for (const id of places) {
  const p = await page.evaluate((id) => __crimson.story.S.world.place(id), id);
  let worst = 0;
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    await view(p.x, p.z, yaw);
    await step(page, 0.25);
    const img = await canvasRGBA(page, () => __crimson.step(1 / 60, true));
    if (SHOTS && yaw === 0) writePNG(`/tmp/palette_night_${id}.png`, img);
    worst = Math.max(worst, neonPixels(img));
  }
  check(worst < 0.003, `NIGHT at ${id}: neon pixels ${(worst * 100).toFixed(3)}% at worst of 4 views (under 0.3%)`);
}
await finish("palette", fails, browser, errors);
