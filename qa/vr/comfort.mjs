// Checks comfort under IWER (an emulated Meta Quest 3): the vignette (speed, acceleration and smooth turning raise it,
// it holds and falls back; its shape and render state), the comic speed lines (they grow from 14 to 30 m/s, follow the
// setting, use only the direction on their sphere, and never touch the middle 50 degrees of the view), presets, seated
// play and calibrate, and in mixed reality the reality fade from the room (SEM living_room: planes and meshes, near a wall,
// the middle of the room, the seated rules, the blend) and the safety bubble when there is no room data.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/comfort.mjs   (SHOTS=<dir> saves pictures)
import {
  checker, watchdog, newPage, open, close, state, waitState, waitFor, enterXR, freeze, frames, sampleAfter, controller, head, recenter, lookQuat, shot,
} from "./lib.mjs";

const { check, done } = checker("comfort");
watchdog(25 * 60 * 1000, "comfort");
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;

/* ================= VR: the vignette, presets, seated ================= */
try {
  const page = await newPage({ width: 480, height: 270, clock: true });
  await open(page, "?emulate&skipintro");
  await enterXR(page, "vr");
  await waitState(page, { state: "play" }, 60000);
  await freeze(page);
  await frames(page, 2);
  check((await page.evaluate(() => G.settings.speedLines)) === true, "speedLines is on by default");

  // drive C.update by hand with the loop held: 20 ms steps
  const vig = await page.evaluate(() => {
    G.test.hold(true);
    const C = G.comfort, out = {};
    C.applyPreset("moderate");
    const go = (n, s) => { for (let i = 0; i < n; i++) C.update(0.02, { vel: { x: 0, y: 0, z: 0 }, speed: 0, accel: 0, yawRate: 0, snapped: false, play: true, ar: false, mode: "xr", ...s }); return C.info(); };
    out.rest = go(10, {});
    out.speed = go(25, { speed: 30 });
    out.hold = go(9, { speed: 0 });
    out.release = go(30, { speed: 0 });
    out.accel = go(10, { accel: 15 });
    go(60, {});
    out.accelHalf = go(10, { accel: 8.5 });
    go(60, {});
    out.yaw = go(10, { yawRate: 120 });
    out.paused = go(60, { yawRate: 120, play: false });
    out.fast = go(3, { accel: 15 });
    const m = C.meshes.vignette;
    out.mesh = { parent: m.parent === G.camera, side: m.material.side, depthTest: m.material.depthTest, depthWrite: m.material.depthWrite, transparent: m.material.transparent, order: m.renderOrder, culled: m.frustumCulled, r: m.geometry.parameters.radius };
    return out;
  });
  check(vig.rest.strength === 0 && !vig.rest.visible, "at rest there is no vignette", vig.rest);
  check(near(vig.speed.strength, 0.5, 1e-6) && near(vig.speed.innerFov, 92.5, 1e-6) && vig.speed.visible, "speed 30 m/s raises it to half (wSpeed 0.5): 92.5° of clear view", vig.speed);
  check(near(vig.hold.strength, 0.5, 1e-6), "it holds for 0.2 s after the speed drops", vig.hold);
  check(vig.release.strength === 0 && !vig.release.visible, "then it falls back within the 0.5 s release", vig.release);
  check(near(vig.accel.strength, 1, 1e-6) && near(vig.accel.innerFov, 75, 1e-6) && near(vig.accelHalf.strength, 0.5, 1e-6), "acceleration raises it: full at 15 m/s² (75° on moderate), half at 8.5", { full: vig.accel, half: vig.accelHalf });
  check(near(vig.yaw.strength, 1, 1e-6), "smooth turning at 120°/s raises it fully", vig.yaw);
  check(vig.paused.strength === 0, "outside play (a pause, the intro) there is no vignette", vig.paused);
  check(vig.fast.strength > 0.55 && vig.fast.strength < 0.65, "it rises fast (0.1 s attack)", vig.fast);
  check(vig.mesh.parent && vig.mesh.side === 1 && !vig.mesh.depthTest && !vig.mesh.depthWrite && vig.mesh.transparent && vig.mesh.order === 999 && !vig.mesh.culled && vig.mesh.r === 1, "the vignette is an inward 1 m sphere on the camera (BackSide, no depth, renderOrder 999)", vig.mesh);

  // pixels: at full strength the edge of the view goes dark and the middle stays clear. The vignette draws only on the first frame after
  // a comfort.update. The loop is held, so a frame between the update and the read would hide it. The update and the read go in one task.
  const spots = { mid: [0.5, 0.5], edge: [0.03, 0.5], corner: [0.04, 0.08] };
  const px0 = await sampleAfter(page, spots, () => { for (let i = 0; i < 60; i++) G.comfort.update(0.02, { play: true, mode: "xr" }); });
  const px1 = await sampleAfter(page, spots, () => { for (let i = 0; i < 10; i++) G.comfort.update(0.02, { speed: 0, accel: 15, yawRate: 0, play: true, ar: false, mode: "xr" }); });
  const lum = (p) => p[0] + p[1] + p[2];
  check(lum(px1.edge) < 50 && lum(px1.corner) < 50 && Math.abs(lum(px1.mid) - lum(px0.mid)) < 30 && lum(px0.edge) > 60, "at full strength the edge of the view is dark and the middle is clear", { before: px0, after: px1 });
  await shot(page, "comfort-vignette");
  await page.evaluate(() => { for (let i = 0; i < 60; i++) G.comfort.update(0.02, { play: true, mode: "xr" }); G.test.hold(false); });
  await frames(page, 3);

  // the real loop: a swing on a rope raises it
  const S = await page.evaluate(() => ({ ...G.city.start, ring: G.city.goldRing }));
  await page.evaluate((S) => G.test.teleport(S.x, S.y, S.z), S);
  await frames(page, 3);
  await page.evaluate((R) => G.test.aimAt(1, R.x, R.y, R.z), S.ring);
  await frames(page, 2);
  await page.evaluate(() => G.test.press(1, true));
  let peak = 0;
  for (let i = 0; i < 40; i++) { await frames(page, 1); peak = Math.max(peak, await page.evaluate(() => G.comfort.info().strength)); }
  await page.evaluate((S) => { G.test.press(1, false); G.test.aimAt(1, null); G.test.teleport(S.x, S.y, S.z); }, S);
  await frames(page, 3);
  check(peak > 0.3, "a real swing raises the vignette", { peak });

  // presets: the comfort radio (as on the title) sets the caps, the vignette, turning and aim
  const pre = await page.evaluate(() => {
    const pick = (v) => { const r = document.querySelector("input[name=preset][value=" + v + "]"); r.checked = true; r.dispatchEvent(new Event("change")); return { preset: G.settings.preset, vignette: G.settings.vignette, turn: G.settings.turn, aim: G.settings.aim, speedLines: G.settings.speedLines, speedCap: G.P.speedCap, fallCap: G.P.fallCap, minFov: G.comfort.info().minFov }; };
    const out = { comfortable: pick("comfortable"), intense: pick("intense"), moderate: pick("moderate") };
    G.settings.speedLines = false; // the desktop preset must leave the headset's own choice alone
    G.comfort.applyPreset("desktop");
    out.desktop = { preset: G.settings.preset, vignette: G.settings.vignette, aim: G.settings.aim, speedLines: G.settings.speedLines };
    G.comfort.applyPreset("moderate");
    // intense has no vignette at all, however fast you go
    G.test.hold(true);
    G.comfort.applyPreset("intense");
    for (let i = 0; i < 10; i++) G.comfort.update(0.02, { speed: 35, accel: 20, play: true, mode: "xr" });
    out.intenseVig = G.comfort.info();
    G.comfort.applyPreset("moderate");
    for (let i = 0; i < 60; i++) G.comfort.update(0.02, { play: true, mode: "xr" });
    G.test.hold(false);
    return out;
  });
  check(pre.comfortable.speedCap === 20 && pre.comfortable.fallCap === 14 && pre.comfortable.vignette === "high" && pre.comfortable.minFov === 60 && pre.comfortable.aim === "high" && pre.comfortable.turn === "snap", "the comfortable preset: caps 20 / 14, vignette high (60°), aim high, snap turns", pre.comfortable);
  check(pre.intense.speedCap === 35 && pre.intense.fallCap === 35 && pre.intense.vignette === "off" && pre.intense.turn === "smooth" && !pre.intenseVig.visible && pre.intenseVig.alpha === 0, "the intense preset: caps 35, no vignette, smooth turning", { intense: pre.intense, vig: pre.intenseVig });
  check(pre.moderate.speedCap === 26 && pre.moderate.fallCap === 26 && pre.moderate.minFov === 75 && pre.moderate.preset === "moderate", "the moderate preset: caps 26, vignette medium (75°)", pre.moderate);
  check(pre.desktop.preset === "moderate" && pre.desktop.vignette === "off" && pre.desktop.aim === "high", "the desktop preset sets the flat-screen feel but is never saved as the choice", pre.desktop);
  check(pre.comfortable.speedLines === false && pre.moderate.speedLines === true && pre.intense.speedLines === true && pre.desktop.speedLines === false, "the presets set speedLines: off for comfortable, on for moderate and intense, and the desktop preset leaves it alone", { c: pre.comfortable.speedLines, m: pre.moderate.speedLines, i: pre.intense.speedLines, d: pre.desktop.speedLines });
  await frames(page, 2);

  /* ---- the comic speed lines: they grow from 14 to 30 m/s and follow the setting ---- */
  const sl = await page.evaluate(() => {
    G.test.hold(true);
    const C = G.comfort, out = {};
    C.applyPreset("moderate");
    const go = (n, s) => { for (let i = 0; i < n; i++) C.update(0.02, { vel: { x: 0, y: 0, z: -(s.speed || 0) }, speed: 0, accel: 0, yawRate: 0, snapped: false, play: true, ar: false, mode: "xr", ...s }); return C.info().lines; };
    go(100, {}); // the real swing above left some lines behind: let them go
    out.rest = go(20, {});
    out.slow = go(100, { speed: 12 });
    out.mid = go(100, { speed: 22 });
    out.fast = go(100, { speed: 30 });
    out.paused = go(100, { speed: 30, play: false });
    out.fast2 = go(100, { speed: 30 });
    C.settings.speedLines = false;
    out.off = go(100, { speed: 30 });
    C.settings.speedLines = true;
    go(100, {});
    const m = C.meshes.speedLines, mat = m.material;
    out.mesh = { parent: m.parent === G.camera, side: mat.side, depthTest: mat.depthTest, depthWrite: mat.depthWrite, transparent: mat.transparent, order: m.renderOrder, culled: m.frustumCulled, raw: !!mat.isRawShaderMaterial, r: m.geometry.parameters.radius, vigOrder: C.meshes.vignette.renderOrder };
    out.src = { vertex: mat.vertexShader, fragment: mat.fragmentShader };
    go(100, {});
    G.test.hold(false);
    return out;
  });
  check(sl.rest.amount === 0 && !sl.rest.visible && sl.slow.amount === 0 && !sl.slow.visible, "no speed lines at rest or at 12 m/s (they start at 14)", { rest: sl.rest, slow: sl.slow });
  check(near(sl.mid.amount, 0.5, 0.01) && sl.mid.visible && near(sl.fast.amount, 1, 0.01), "they grow with speed: half at 22 m/s, full at 30 m/s", { mid: sl.mid, fast: sl.fast });
  check(sl.paused.amount === 0 && !sl.paused.visible && near(sl.fast2.amount, 1, 0.01), "outside play (a pause, the intro) there are none, and they come back", { paused: sl.paused, again: sl.fast2 });
  check(sl.off.amount === 0 && !sl.off.visible && !sl.off.on, "settings.speedLines = false turns them off at any speed", sl.off);
  check(sl.mesh.parent && sl.mesh.side === 1 && !sl.mesh.depthTest && !sl.mesh.depthWrite && sl.mesh.transparent && sl.mesh.order === 998 && sl.mesh.order < sl.mesh.vigOrder && !sl.mesh.culled && !sl.mesh.raw && sl.mesh.r < 1, "the lines are an inward sphere on the camera under the vignette (BackSide, no depth, renderOrder 998, ShaderMaterial)", sl.mesh);
  // both eyes must see the same lines: the shader may only use the direction on its own sphere and uniforms
  const shaderText = sl.src.vertex + sl.src.fragment;
  check(!/gl_FragCoord|modelMatrix|viewMatrix|cameraPosition|resolution|gl_ViewID/.test(shaderText) && /varying vec3 vP/.test(shaderText) && /normalize\(vP\)/.test(shaderText), "the lines come from the direction on their sphere only (no screen position, no world position), so both eyes agree", shaderText.length);
  await frames(page, 2);

  // seated: calibrate stores the head height, and the view rises so the head stands at 1.65 m
  await head(page, { pos: [0, 1.1, 0] });
  await frames(page, 2);
  const seat = await page.evaluate(() => { G.settings.seated = true; return G.comfort.calibrate(G.test.state().headLocal.y); });
  await frames(page, 3);
  const st1 = await state(page);
  const h1 = await page.evaluate(() => ({ height: G.settings.height, off: G.comfort.seatedOffset, rigY: G.rig.position.y, P: G.P.pos.y }));
  check(near(h1.height, 1.1, 1e-3) && near(seat, 0.55, 1e-3) && near(h1.off, 0.55, 1e-3) && near(st1.head.y - st1.pos.y, 1.65, 0.01), "seated: calibrate stores 1.1 m and the view rises 0.55 m to a 1.65 m head", { seat, h1, headAbove: st1.head.y - st1.pos.y });
  await page.evaluate(() => { G.settings.seated = false; });
  await frames(page, 3);
  const st2 = await state(page);
  check(near(st2.head.y - st2.pos.y, 1.1, 0.01) && (await page.evaluate(() => G.comfort.seatedOffset)) === 0, "standing: no offset, your own height is kept", { headAbove: st2.head.y - st2.pos.y });
  const cal = await page.evaluate(() => { G.settings.seated = true; G.settings.height = 0; return { before: G.comfort.seatedOffset }; });
  await frames(page, 4);
  const lazy = await page.evaluate(() => ({ height: G.settings.height, off: G.comfort.seatedOffset }));
  check(cal.before === 0 && near(lazy.height, 1.1, 0.01) && near(lazy.off, 0.55, 0.01), "seated with no height yet: it measures the head once it is tracked", { cal, lazy });
  await page.evaluate(() => { G.settings.seated = false; G.comfort.calibrate(1.8); });
  const tall = await page.evaluate(() => ({ height: G.settings.height, off: G.comfort.seatedOffset }));
  check(near(tall.height, 1.8, 1e-3) && tall.off === 0, "calibrate while standing keeps a tall player's height", tall);
  await head(page, { pos: [0, 1.6, 0] });
  await frames(page, 2);

  check(page.errors.length === 0, "no errors in VR", page.errors);
  await page.context().close();
} catch (e) { check(false, "the VR run threw", e.stack || String(e)); }

/* ================= flat screen: the speed lines never touch the middle 50 degrees ================= */
try {
  const page = await newPage({ width: 480, height: 270 });
  await open(page, "?skipintro");
  await enterXR(page, "desktop");
  await page.evaluate(() => G.test.skipIntro());
  await waitState(page, { mode: "desktop", state: "play" }, 120000);
  // freeze the world (the loop still draws), then draw the same view with the lines off and on. The vignette is off on the flat screen.
  // The glow (bloom, on by default here) blurs the bright streaks into the clear middle. The first check reads the streaks alone, so it
  // draws with the glow off. The second check bounds what the glow adds.
  const g = await page.evaluate(() => {
    G.test.hold(true);
    const cam = G.camera, aspect = cam.aspect, th = Math.tan((cam.fov * Math.PI) / 360), pts = [];
    for (let j = 0; j < 11; j++) for (let i = 0; i < 17; i++) {
      const nx = -0.97 + (i / 16) * 1.94, ny = -0.97 + (j / 10) * 1.94;
      pts.push({ fx: (nx + 1) / 2, fy: (1 - ny) / 2, deg: (Math.atan(Math.hypot(nx * aspect * th, ny * th)) * 180) / Math.PI });
    }
    return { pts, fov: cam.fov, aspect, vignette: G.settings.vignette, bloom: G.test.bloom().want };
  });
  // The settings, the updates and the read go in one page task, so the frame that answers the read is the first one after them (the lines
  // draw only on that frame). level is the glow of that frame.
  const draw = (on, level) => page.evaluate(({ on, level, grid }) => {
    const C = G.comfort;
    G.settings.bloom = level;
    C.settings.speedLines = on;
    for (let i = 0; i < 120; i++) C.update(0.02, { vel: { x: 0, y: 0, z: -30 }, speed: 30, accel: 0, yawRate: 0, snapped: false, play: true, ar: false, mode: "desktop" });
    return G.test.sample(grid).then((px) => ({ px, level: G.test.bloom().level }));
  }, { on, level, grid: g.pts.map((p) => [p.fx, p.fy]) });
  const diffs = async (level) => {
    const off = await draw(false, level), on = await draw(true, level);
    const d = g.pts.map((p, i) => Math.abs(on.px[i][0] - off.px[i][0]) + Math.abs(on.px[i][1] - off.px[i][1]) + Math.abs(on.px[i][2] - off.px[i][2]));
    return { level: off.level + "/" + on.level, d };
  };
  const flat = await diffs("off");
  const inner = g.pts.map((p, i) => ({ deg: p.deg, d: flat.d[i] })).filter((q) => q.deg <= 24.5);
  const outer = g.pts.map((p, i) => ({ deg: p.deg, d: flat.d[i] })).filter((q) => q.deg >= 30);
  check(g.vignette === "off" && flat.level === "off/off" && inner.length >= 20 && inner.every((q) => q.d <= 2), "in the middle 50 degrees (" + inner.length + " sample points within 24.5 degrees of where you look) no pixel changes with the lines on", { vignette: g.vignette, bloom: flat.level, worst: Math.max(...inner.map((q) => q.d)) });
  check(outer.length >= 40 && outer.filter((q) => q.d > 40).length >= 3, "farther out the streaks show: " + outer.filter((q) => q.d > 40).length + " of " + outer.length + " sample points past 30 degrees change", { fov: g.fov, aspect: g.aspect });
  // With the glow on, the bright streaks bleed a few levels into the middle. The measure (the sum over the three channels) is 3 to 5 on Low and
  // 12 to 16 on High, and it differs a little from run to run. The limits are about 1.5 times the largest measure: a stronger glow fails here.
  const GLOW = { low: 8, high: 24 }, glow = {};
  for (const level of Object.keys(GLOW)) {
    const r = await diffs(level);
    const worst = Math.max(...g.pts.map((p, i) => (p.deg <= 24.5 ? r.d[i] : 0)));
    glow[level] = { drawn: r.level, worst, limit: GLOW[level] };
  }
  console.log("INFO: the glow adds at most " + glow.low.worst + " levels on Low and " + glow.high.worst + " on High to the middle 50 degrees");
  check(g.bloom === "low" && Object.keys(GLOW).every((l) => glow[l].drawn === l + "/" + l && glow[l].worst <= GLOW[l]), "the glow keeps the streaks faint in the middle 50 degrees: at most " + GLOW.low + " levels on Low and " + GLOW.high + " on High", { default: g.bloom, glow });
  check(page.errors.length === 0, "no errors on the flat screen", page.errors);
  await page.context().close();
} catch (e) { check(false, "the speed-line pixel run threw", e.stack || String(e)); }

/* ================= AR with a room: the reality fade ================= */
try {
  const page = await newPage({ width: 400, height: 225, clock: true });
  await open(page, "?emulate=ar&room=living_room&skipintro");
  await enterXR(page, "ar");
  await waitState(page, { state: "play" }, 60000);
  await waitFor(page, () => G.xr.planes.size > 0 && G.xr.meshes.size > 0, null, 60000);
  await freeze(page);
  // hands close to the head, so only the head decides
  await controller(page, "left", { pos: [-0.1, 1.45, -0.12] });
  await controller(page, "right", { pos: [0.1, 1.45, -0.12] });
  await frames(page, 3);
  const r0 = await page.evaluate(() => {
    const labels = [...G.xr.planes.values()].map((p) => p.label), mlabels = [...G.xr.meshes.values()].map((m) => m.label);
    const meshes = [];
    G.rig.traverse((o) => { if (o.isMesh && o.name.startsWith("reality:")) meshes.push(o); });
    const m = meshes[0].material;
    return {
      info: G.test.reality(), planes: labels.length, floorCeil: labels.filter((l) => l === "floor" || l === "ceiling").length, meshes: mlabels.length, global: mlabels.filter((l) => l === "global mesh").length,
      names: [...new Set(meshes.map((o) => o.name))],
      mat: { blending: m.blending, src: m.blendSrc, dst: m.blendDst, srcA: m.blendSrcAlpha, dstA: m.blendDstAlpha, transparent: m.transparent, depthTest: m.depthTest, depthWrite: m.depthWrite, side: m.side, order: meshes[0].renderOrder, parent: meshes[0].parent === G.rig },
      look: G.comfort.info().look, vigBlend: G.comfort.meshes.vignette.material.blending,
    };
  });
  const T = await page.evaluate(() => ({ custom: 5, zero: 200, omsa: 205, double: 2 }));
  check(r0.info.planes === r0.planes - r0.floorCeil && r0.info.meshes === r0.meshes - r0.global && r0.info.planes >= 10 && r0.info.meshes >= 5, "G.test.reality() reports the planes (no floor or ceiling) and meshes (no global mesh)", { info: r0.info, planes: r0.planes, meshes: r0.meshes });
  check(!r0.names.some((n) => /floor|ceiling|global mesh/.test(n)), "no reality mesh comes from the floor, the ceiling or the global mesh", r0.names);
  check(r0.mat.blending === T.custom && r0.mat.src === T.zero && r0.mat.dst === T.omsa && r0.mat.srcA === null && r0.mat.dstA === null && r0.mat.transparent && !r0.mat.depthTest && !r0.mat.depthWrite && r0.mat.side === T.double && r0.mat.order === 1000 && r0.mat.parent, "the reality material: Zero / OneMinusSrcAlpha, no depth, both sides, renderOrder 1000, a rig child", r0.mat);
  check(r0.look === "room" && r0.vigBlend === T.custom, "in AR the vignette shows the real room (the reality blend)", { look: r0.look, blend: r0.vigBlend });

  // the middle of the room: nothing fades, and every pixel stays opaque
  await head(page, { pos: [0.3, 1.6, 0.9], quat: [0, 0, 0, 1] });
  await controller(page, "left", { pos: [0.2, 1.45, 0.78] });
  await controller(page, "right", { pos: [0.4, 1.45, 0.78] });
  await frames(page, 3);
  const mid = await page.evaluate(() => G.test.reality());
  const pm = page.evaluate(() => G.test.sample([[0.2, 0.3], [0.5, 0.5], [0.8, 0.3], [0.5, 0.8], [0.2, 0.8], [0.8, 0.8]]));
  await frames(page, 1);
  const pxm = await pm;
  check(mid.maxFade === 0 && mid.near === 0 && pxm.every((p) => p[3] === 255), "in the middle of the room maxFade is 0 and the city is opaque", { mid, alpha: pxm.map((p) => p[3]) });
  await shot(page, "comfort-ar-middle");

  // near the front wall (z −2.46): it fades in, and the view shows passthrough there
  await head(page, { pos: [0.2, 1.6, -2.13], quat: [0, 0, 0, 1] });
  await controller(page, "left", { pos: [0.1, 1.45, -2.0] });
  await controller(page, "right", { pos: [0.3, 1.45, -2.0] });
  await frames(page, 8);
  const wall = await page.evaluate(() => G.test.reality());
  const pw = page.evaluate(() => G.test.sample([[0.5, 0.5], [0.4, 0.4], [0.6, 0.6]]));
  await frames(page, 1);
  const pxw = await pw;
  check(wall.maxFade > 0.9 && wall.near > 0, "near a wall maxFade rises to 1", wall);
  check(pxw.every((p) => p[3] < 40), "and the wall in front of you shows as passthrough (alpha near 0)", pxw);
  await shot(page, "comfort-ar-wall");
  // 0.6 m from the wall: a partial fade
  await head(page, { pos: [0.2, 1.6, -1.86], quat: [0, 0, 0, 1] });
  await controller(page, "left", { pos: [0.1, 1.45, -1.72] });
  await controller(page, "right", { pos: [0.3, 1.45, -1.72] });
  await frames(page, 8);
  const part = await page.evaluate(() => G.test.reality());
  check(part.maxFade > 0.3 && part.maxFade < 0.9, "0.6 m from the wall the fade is partial (0.4 → 0.9 m ramp)", part);
  // a hand pushed toward the wall fades it even when the head is far
  await head(page, { pos: [0.2, 1.6, -1.3], quat: [0, 0, 0, 1] });
  await controller(page, "left", { pos: [0.1, 1.45, -1.2] });
  await controller(page, "right", { pos: [0.3, 1.45, -2.3] });
  await frames(page, 8);
  const hnd = await page.evaluate(() => G.test.reality());
  check(hnd.maxFade > 0.5, "a hand near the wall fades it in", hnd);

  // seated: the hands no longer count, and a low table (0.45 m) stays in the game; standing, both fade in
  const seatAt = async (hd, hr) => {
    await head(page, { pos: hd, quat: [0, 0, 0, 1] });
    await controller(page, "left", { pos: [hd[0] - 0.2, hd[1] - 0.2, hd[2] - 0.1] });
    await controller(page, "right", { pos: hr });
    await frames(page, 8);
    const stand = await page.evaluate(() => G.test.reality());
    await page.evaluate(() => { G.settings.seated = true; });
    await frames(page, 2);
    const sit = await page.evaluate(() => G.test.reality());
    await page.evaluate(() => { G.settings.seated = false; });
    await frames(page, 2);
    return { stand, sit };
  };
  const sh = await seatAt([0.2, 1.15, -1.3], [0.3, 1.3, -2.3]);
  check(sh.stand.maxFade > 0.5 && sh.sit.maxFade < 0.01, "seated: a hand near the wall no longer fades it in (standing, it does)", { stand: sh.stand.maxFade, sit: sh.sit.maxFade });
  const st = await seatAt([1.0, 1.15, -0.4], [1.2, 1.0, -0.5]);
  const tbl = (r) => Math.max(0, ...r.sources.filter((q) => q.kind === "plane" && q.label === "table").map((q) => q.fade));
  check(tbl(st.stand) > 0.9 && tbl(st.sit) === 0, "seated: the low coffee table stays in the game (standing, it fades in under you)", { stand: tbl(st.stand), sit: tbl(st.sit) });
  await head(page, { pos: [0.3, 1.6, 0.9] });
  await frames(page, 2);

  check(page.errors.length === 0, "no errors in AR", page.errors);
  await page.context().close();
} catch (e) { check(false, "the AR run threw", e.stack || String(e)); }

/* ================= AR with no room data: the safety bubble ================= */
try {
  const page = await newPage({ width: 400, height: 225, clock: true });
  await open(page, "?emulate&skipintro");
  const sup = await page.evaluate(() => navigator.xr.isSessionSupported("immersive-ar"));
  if (!sup) console.log("INFO: IWER without SEM offers no immersive-ar: the bubble check is skipped");
  else {
    await enterXR(page, "ar");
    await waitState(page, { state: "play" }, 60000);
    await freeze(page);
    await head(page, { pos: [0, 1.6, 0] });
    await frames(page, 30);
    const b0 = await page.evaluate(() => ({ r: G.test.reality(), ring: G.comfort.meshes.ring.visible }));
    await frames(page, 170); // past 3 s with no planes or meshes
    const b1 = await page.evaluate(() => ({ r: G.test.reality(), ring: G.comfort.meshes.ring.visible, ringAt: G.comfort.meshes.ring.position.toArray() }));
    check(!b0.r.bubble && b1.r.bubble && b1.r.planes === 0 && b1.r.meshes === 0 && b1.ring, "no room data after 3 s: the safety bubble and its chalk ring turn on", { b0, b1 });
    const bubAt = async (x) => {
      await head(page, { pos: [x, 1.6, 0] });
      await frames(page, 3);
      const p = page.evaluate(() => G.test.sample([[0.5, 0.5], [0.3, 0.3]]));
      await frames(page, 1);
      return { r: await page.evaluate(() => G.test.reality()), px: await p };
    };
    const a = await bubAt(0.5), b = await bubAt(1.2), c = await bubAt(1.5);
    check(a.r.bubbleFade === 0 && near(b.r.bubbleFade, 0.5, 0.02) && c.r.bubbleFade === 1, "passthrough fades in as you move 1.0 → 1.4 m from your spot", { a: a.r.bubbleFade, b: b.r.bubbleFade, c: c.r.bubbleFade });
    check(a.px.every((p) => p[3] === 255) && c.px.every((p) => p[3] < 10), "at 1.5 m the whole view is passthrough; at 0.5 m none is", { a: a.px, c: c.px });
    // a recentre moves the tracking origin to the head: the spot stays where it is in the room
    await bubAt(1.2);
    const ring0 = await page.evaluate(() => G.comfort.meshes.ring.position.toArray());
    await recenter(page);
    await frames(page, 3);
    const rc = await page.evaluate(() => ({ r: G.test.reality(), head: G.test.state().headLocal, ring: G.comfort.meshes.ring.position.toArray() }));
    check(Math.hypot(rc.head.x, rc.head.z) < 0.01 && near(rc.r.bubbleFade, 0.5, 0.03) && Math.hypot(rc.ring[0] - rc.head.x, rc.ring[2] - rc.head.z) > 1.1, "after a recentre the bubble still measures from the same real spot", { rc, ring0 });
    await head(page, { pos: [0.4, 1.6, 0.3], quat: lookQuat([-0.4, -1.2, -0.3]) });
    await frames(page, 3);
    await shot(page, "comfort-bubble-ring");
    check(page.errors.length === 0, "no errors in AR with no room data", page.errors);
  }
  await page.context().close();
} catch (e) { check(false, "the bubble run threw", e.stack || String(e)); }

await close();
done();
