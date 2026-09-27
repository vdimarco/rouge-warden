// Performance budgets (design 3.7, amendments C5, C6, C8), for each tier ?q=0, 1 and 2:
// - at 8 viewpoints (Uptown, the Y, the bridge, the canyon, Airport Mesa, the ranch, the diner, West
//   Sedona), looking 4 ways by day, the main pass stays under the tier's triangle and draw-call budgets
//   (render.js lastInfo: the scene pass only);
// - the tier sets MSAA, the pixel-ratio range and the shadow box; fog ends at or before the view distance
//   by day and by night (C8); the day painting is 2048 wide on Q1 and Q0 (C6);
// - the fixed light set (C5): turning the headlights, the points and the looks on and off never adds a
//   shader program (renderer.info.programs).
// It uses whatever world is merged (the stub or the real one). --shots saves a picture per viewpoint.
import { open, step, stepUntil, storyReady, canvasRGBA, finish, writePNG, freeRoam } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg); };
const SHOTS = process.argv.includes("--shots");
const TIERS = (process.argv.find((a) => a.startsWith("--q=")) || "--q=2,1,0").slice(4).split(",").map(Number);
const VIEWS = [["Uptown", "uptown"], ["the Y", "y_roundabout"], ["the bridge", "midgley_deck_s"], ["the canyon", "slide_rock"], ["Airport Mesa", "airport_mesa"], ["the ranch", "hart_ranch"], ["the diner", "diner"], ["West Sedona", "sunline_plaza"]];
let allErrors = [];
for (const q of TIERS) {
  const { browser, page, errors } = await open({ query: `?chapter=f1&seed=7&nomusic&q=${q}`, width: 640, height: 360 });
  const r = await storyReady(page);
  check(r.ok, `q=${q}: the story is ready (${r.sec} s stepped)`);
  await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 30 });
  // the world's budgets, measured as before content: free roam, and the chapter's crew (four friends that
  // follow the hero to every viewpoint, about 12k triangles each) sent off
  check((await freeRoam(page)).ok, `q=${q}: free roam, F1's mission quit`);
  await step(page, 1);
  await page.evaluate(() => { const S = __crimson.story.S; for (const e of S.cast.followers.list.slice()) { S.cast.followers.remove(e.a); e.a.visible = false; } });
  const setup = await page.evaluate(async () => {
    const S = __crimson.story.S, T = S.THREE;
    const R = await import(new URL("js/render.js", location.href).href);
    const Q = window.__perfQA = { eye: new T.Vector3(), at: new T.Vector3(), on: true };
    S.cameras.add("qa", 1000, () => Q.on, () => { S.camera.position.copy(Q.eye); S.camera.lookAt(Q.at); S.focus.copy(Q.at); if (S.camera.fov !== 55) { S.camera.fov = 55; S.camera.updateProjectionMatrix(); } });
    S.day.set("thu", 13); S.look.set("DAY", { clock: false });
    const t = S.look.tier;
    return { q: S.q, tier: t, samples: R.quality.samples, prMin: R.quality.prMin, prMax: R.quality.prMax, shadowBox: S.look.sun.shadow.camera.right, shadowMap: S.look.sun.shadow.mapSize.x, world: S.world.group.getObjectByName("stubGround") ? "stub" : "real" };
  });
  const T = setup.tier;
  check(setup.q === q, `q=${q}: S.q is ${setup.q} (${T.name}, world ${setup.world})`);
  check(setup.samples === T.msaa && Math.abs(setup.prMin - T.pr[0]) < 1e-9 && setup.prMax <= T.pr[1] + 1e-9 && setup.shadowBox === T.shadow.box && setup.shadowMap === T.shadow.map,
    `q=${q}: MSAA ${setup.samples}, pixel ratio ${setup.prMin}..${setup.prMax}, shadow box ±${setup.shadowBox} m at ${setup.shadowMap}`);
  // the day painting's width (C6): wait for it to load
  for (let i = 0; i < 80 && !(await page.evaluate(() => __crimson.story.S.test.look.skyReady)); i++) await page.waitForTimeout(100);
  const pano = await page.evaluate(() => __crimson.story.S.look.sky.width);
  check(pano === (q < 2 ? 2048 : 3876), `q=${q}: the day painting is ${pano} wide`);
  // fog ends at or before the view distance, by day and by night (C8)
  const fogs = await page.evaluate(() => {
    const S = __crimson.story.S, out = [];
    for (const [n, h] of [["DAY", 13], ["DUSK", 19.2], ["NIGHT", 23], ["MEMORY", 14], ["VORTEX", 23], ["DEEP_INK", 1]]) { S.day.set(null, h); S.look.set(n, { clock: false }); __crimson.step(1 / 60, false); out.push([n, S.scene.fog.far, h >= 19.75 || h < 5.5]); }
    S.day.set("thu", 13); S.look.set("DAY", { clock: false });
    return out;
  });
  const badFog = fogs.filter(([, far, night]) => far > (night ? T.view.night : T.view.day) + 1e-6);
  check(badFog.length === 0, `q=${q}: fog ends within the view distance (${fogs.map(([n, f]) => `${n} ${Math.round(f)}`).join(", ")}; view ${T.view.day}/${T.view.night})`);

  // the 8 viewpoints, 4 ways each
  const rows = [];
  for (const [label, id] of VIEWS) {
    const p = await page.evaluate((id) => __crimson.story.S.world.place(id), id);
    let calls = 0, tris = 0;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      await page.evaluate(([x, z, yaw]) => {
        const S = __crimson.story.S, Q = __perfQA, y = S.world.surface(x, z, 300);
        Q.eye.set(x, y + 2.2, z); Q.at.set(x + Math.sin(yaw) * 30, y + 1.2, z + Math.cos(yaw) * 30);
        if (S.hero) S.hero.place(x, z);
      }, [p.x, p.z, yaw]);
      await step(page, 0.4); // the world streams its tiles and flora around the camera
      const info = await page.evaluate(() => { __crimson.step(1 / 60, true); return __crimson.story.S.test.perf.info(); });
      calls = Math.max(calls, info.calls); tris = Math.max(tris, info.triangles);
      if (SHOTS && yaw === 0) writePNG(`/tmp/perf_q${q}_${id}.png`, await canvasRGBA(page, () => __crimson.step(1 / 60, true)));
    }
    rows.push([label, calls, tris]);
    check(calls <= T.draws && tris <= T.tris, `q=${q} ${label}: ${calls} draws (budget ${T.draws}), ${Math.round(tris / 1000)}k triangles (budget ${T.tris / 1000}k)`);
  }
  // the fixed light set: no program is added while lights and looks change (C5)
  const progs = await page.evaluate(() => {
    const S = __crimson.story.S, L = S.look, pts = L.lights.points;
    const cycle = () => {
      for (const [n, h] of [["NIGHT", 23], ["DAY", 13], ["INTERIOR", 23], ["DUSK", 19.3], ["VORTEX", 23]]) {
        S.day.set(null, h); L.set(n, { clock: false });
        for (const on of [true, false]) { L.headlights(on); for (const p of pts) { p.userData.pinned = on; p.intensity = on ? 30 : 0; } L.legend(on); __crimson.step(1 / 60, true); }
      }
    };
    cycle(); // warm: every material has met every look
    const before = S.test.perf.programs();
    cycle(); cycle();
    return [before, S.test.perf.programs()];
  });
  check(progs[0] === progs[1], `q=${q}: headlights, points, legend and looks add no shader program (${progs[0]} then ${progs[1]})`);
  allErrors = allErrors.concat(errors);
  await browser.close();
}
await finish("perf", fails, null, allErrors);
