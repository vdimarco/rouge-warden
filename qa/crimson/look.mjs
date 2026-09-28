// The story's look (design 3.6), checked on a live page at ?q=2:
// - DAY is colour: the frame's mean saturation is over 0.12, through the COLOR variant.
// - NIGHT is ink: a KEY.solid crimson quad keeps its hue (red > green + 0.15) and a neon quad stays neon;
//   the rest of the frame is grey.
// - the key debug view shows no keyed pixel when no key material is in view (and does show the quad).
// - legend() bleeds to ink in 0.6 s and back in 1.2 s; vortex() reaches ink in 1.2 s; a timed set() tweens;
//   the clock drives DAY, DUSK and NIGHT; the three composite variants never recompile.
// - the frame-time governor (render.js createAdapter), on synthetic frame times: a steady 16.7 ms climbs one
//   step after 20 s; 25 ms drops (tier first); a probe followed by 25 ms frames reverts within 3 s and doubles
//   the wait; frames over 100 ms and frames under a hold are ignored.
// - every story sound plays without an error; the score takes each cue.
// - SAVE & QUIT gives the arena its look back: post uniforms, fog, toon ramp, MSAA and depth.
import { open, step, stepUntil, storyReady, canvasRGBA, finish, writePNG } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg); };
const SHOTS = process.argv.includes("--shots");
const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", width: 640, height: 360 });
const r = await storyReady(page);
check(r.ok, `the story is ready (${r.sec} s stepped)`);
await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 30 });
await step(page, 1);

// a fixed QA camera at Schnebly vista, looking out along the vista's own bearing (downhill), with test quads 7 m ahead
await page.evaluate(async () => {
  const S = __crimson.story.S, T = S.THREE;
  const R = await import(new URL("js/render.js", location.href).href);
  const P = await import(new URL("js/story/look/palette.js", location.href).href);
  const p = S.world.place("schnebly_vista"), y = S.world.surface(p.x, p.z, 50);
  const eye = new T.Vector3(p.x, y + 1.7, p.z), yaw = (p.yaw ?? Math.PI / 2) + 0.35; // the real world slopes up to the east
  const f = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), rt = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const at = eye.clone().addScaledVector(f, 10);
  const Q = window.__lookQA = { eye, at, on: true, props: [] };
  S.cameras.add("qa", 1000, () => Q.on, () => { S.camera.position.copy(eye); S.camera.lookAt(at); S.focus.copy(at); if (S.camera.fov !== 55) { S.camera.fov = 55; S.camera.updateProjectionMatrix(); } });
  const quad = (mat, side) => {
    const m = new T.Mesh(new T.BoxGeometry(1.1, 1.1, 0.2), mat);
    m.position.copy(eye).addScaledVector(f, 7).addScaledVector(rt, side * 1.4); m.position.y = eye.y - 0.2; m.lookAt(eye.x, m.position.y, eye.z);
    m.castShadow = true; S.scene.add(m); Q.props.push(m); return m;
  };
  const toon = (c) => new T.MeshToonMaterial({ color: c, gradientMap: R.toonRamp });
  Q.crimson = quad(R.KEY.solid(toon(P.CRIMSON.crimson)), -1);
  Q.neon = quad(toon(P.NEON.hiVis), 1);
  // an additive crimson glow (KEY.glow), over the ground between them
  Q.glow = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), R.KEY.glow(new T.MeshBasicMaterial({ color: P.CRIMSON.crimsonGlow, transparent: true, opacity: 0.85 })));
  Q.glow.position.copy(eye).addScaledVector(f, 7); Q.glow.position.y = eye.y + 0.9; Q.glow.lookAt(eye); S.scene.add(Q.glow); Q.props.push(Q.glow);
  // screen boxes of the two quads (fractions of the canvas)
  Q.box = (m) => { const v = m.position.clone(); S.camera.position.copy(eye); S.camera.lookAt(at); S.camera.updateMatrixWorld(); v.project(S.camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; };
});
const draw = () => __crimson.step(1 / 60, true); // one tick (the look writes its uniforms), then a draw
const stats = (img, fx, fy, half = 0.02) => {
  const { width: W, height: H, data } = img;
  const x0 = Math.round((fx - half) * W), x1 = Math.round((fx + half) * W), y0 = Math.round((fy - half * W / H) * H), y1 = Math.round((fy + half * W / H) * H);
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const o = (y * W + x) * 4; r += data[o]; g += data[o + 1]; b += data[o + 2]; n++; }
  return { r: r / n / 255, g: g / n / 255, b: b / n / 255 };
};
const meanSat = (img) => { let s = 0; const d = img.data; for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); s += mx ? (mx - mn) / mx : 0; } return s / (d.length / 4); };
const setLook = (name, o = { clock: false }) => page.evaluate(([n, o]) => __crimson.story.S.look.set(n, o), [name, o]);
const look = () => page.evaluate(() => { const L = __crimson.story.S.test.look; return { name: L.name, ink: L.ink, variant: L.variant, clock: L.clockDriven, legend: L.legend, vortex: L.vortex }; });

/* ---------------- DAY: colour ---------------- */
await page.evaluate(() => __crimson.story.S.day.set("thu", 13));
await setLook("DAY");
for (let i = 0; i < 100 && !(await page.evaluate(() => __crimson.story.S.test.look.skyReady)); i++) await page.waitForTimeout(100);
await step(page, 0.2);
const day = await canvasRGBA(page, draw);
const ds = meanSat(day), dl = await look();
check(ds > 0.12 && dl.variant === "COLOR", `DAY is colour: mean saturation ${ds.toFixed(3)} (over 0.12), variant ${dl.variant}`);
if (SHOTS) writePNG("/tmp/look_qa_day.png", day);

/* ---------------- NIGHT: ink, crimson kept, neon kept ---------------- */
await setLook("NIGHT");
await step(page, 0.2);
const night = await canvasRGBA(page, draw);
if (SHOTS) writePNG("/tmp/look_qa_night.png", night);
const boxes = await page.evaluate(() => ({ c: __lookQA.box(__lookQA.crimson), n: __lookQA.box(__lookQA.neon), g: __lookQA.box(__lookQA.glow) }));
const cr = stats(night, ...boxes.c), ne = stats(night, ...boxes.n);
check(cr.r > cr.g + 0.15 && cr.r > cr.b + 0.1, `NIGHT keeps the crimson quad crimson (r ${cr.r.toFixed(2)} g ${cr.g.toFixed(2)} b ${cr.b.toFixed(2)})`);
const gl = stats(night, ...boxes.g, 0.01);
check(gl.r > gl.g + 0.15, `NIGHT keeps a KEY.glow crimson glow crimson (r ${gl.r.toFixed(2)} g ${gl.g.toFixed(2)} b ${gl.b.toFixed(2)})`);
const neonOk = ne.g / (ne.r + 0.03) > 0.82 && ne.g - ne.b > 0.3 && ne.g > 0.4;
check(neonOk, `NIGHT keeps the neon quad neon (r ${ne.r.toFixed(2)} g ${ne.g.toFixed(2)} b ${ne.b.toFixed(2)})`);
// everything but the two quads is ink: grey
let off = 0, tot = 0;
{ const { width: W, height: H, data } = night;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const fx = x / W, fy = y / H; if (Math.abs(fx - boxes.c[0]) < 0.08 && Math.abs(fy - boxes.c[1]) < 0.14) continue; if (Math.abs(fx - boxes.n[0]) < 0.1 && Math.abs(fy - boxes.n[1]) < 0.18) continue; if (Math.abs(fx - boxes.g[0]) < 0.1 && Math.abs(fy - boxes.g[1]) < 0.18) continue;
    const o = (y * W + x) * 4, mx = Math.max(data[o], data[o + 1], data[o + 2]), mn = Math.min(data[o], data[o + 1], data[o + 2]);
    tot++; if (mx - mn > 40) off++;
  } }
check(off / tot < 0.003, `NIGHT: the rest of the frame is grey ink (${(off / tot * 100).toFixed(2)}% coloured pixels)`);
const nl = await look();
check(nl.variant === "INK" && nl.ink === 1, `NIGHT uses the INK variant (ink ${nl.ink}, ${nl.variant})`);

/* ---------------- the key debug view ---------------- */
await page.evaluate(() => { __lookQA.crimson.visible = __lookQA.glow.visible = false; __crimson.story.S.look.debugKey(true); });
const kd = await canvasRGBA(page, draw);
let keyed = 0; for (let i = 0; i < kd.data.length; i += 4) if (kd.data[i] > 12) keyed++;
check(keyed === 0, `key debug: no keyed pixel with no key material in view (${keyed} keyed)`);
await page.evaluate(() => { __lookQA.crimson.visible = true; });
const kd2 = await canvasRGBA(page, draw);
const kc = stats(kd2, ...boxes.c, 0.01);
check(kc.r > 0.9, `key debug: the crimson quad shows as keyed (${kc.r.toFixed(2)})`);
await page.evaluate(() => __crimson.story.S.look.debugKey(false));

/* ---------------- legend, vortex, tweens ---------------- */
await setLook("DAY");
await step(page, 0.1);
await page.evaluate(() => __crimson.story.S.look.legend(true));
await step(page, 0.3);
const l1 = await look();
await step(page, 0.3);
const l2 = await look();
check(l1.ink > 0.3 && l1.ink < 0.7 && l1.variant === "TRANSITION", `legend: halfway to ink at 0.3 s (ink ${l1.ink.toFixed(2)}, ${l1.variant})`);
check(l2.ink >= 0.999 && l2.variant === "INK", `legend: ink 1 at 0.6 s (ink ${l2.ink.toFixed(3)}, ${l2.variant})`);
await page.evaluate(() => __crimson.story.S.look.legend(false));
await step(page, 0.6);
const l3 = await look();
await step(page, 0.62);
const l4 = await look();
check(l3.ink > 0.3 && l3.ink < 0.7 && l4.ink === 0 && l4.variant === "COLOR", `legend: back to colour in 1.2 s (ink ${l3.ink.toFixed(2)} at 0.6 s, ${l4.ink} at 1.2 s)`);
await page.evaluate(() => __crimson.story.S.look.vortex(true));
await step(page, 1.22);
const v1 = await look();
check(v1.ink >= 0.999 && v1.vortex >= 0.999, `vortex: ink in 1.2 s (ink ${v1.ink}, vortex ${v1.vortex.toFixed(2)})`);
await page.evaluate(() => __crimson.story.S.look.vortex(false));
await step(page, 1.3);
await setLook("NIGHT", { dur: 2, clock: false });
await step(page, 1);
const t1 = await look();
check(t1.ink > 0.2 && t1.ink < 0.8 && t1.variant === "TRANSITION", `set('NIGHT', {dur: 2}) is halfway at 1 s (ink ${t1.ink.toFixed(2)})`);
await step(page, 1.1);
const t2 = await look();
check(t2.ink === 1 && t2.name === "NIGHT", `set('NIGHT', {dur: 2}) is ink at 2 s`);
// the dawn: the ink leaves the ground (the bottom of the frame) before the sky
const colourful = (img, y0, y1) => { const { width: W, height: H, data } = img; let k = 0, n = 0; for (let y = Math.floor(y0 * H); y < y1 * H; y += 2) for (let x = 0; x < W; x += 2) { const o = (y * W + x) * 4, mx = Math.max(data[o], data[o + 1], data[o + 2]), mn = Math.min(data[o], data[o + 1], data[o + 2]); n++; if (mx - mn > 18) k++; } return k / n; };
await page.evaluate(() => { __lookQA.crimson.visible = __lookQA.neon.visible = __lookQA.glow.visible = false; const S = __crimson.story.S; S.day.set(null, 13); S.look.set("DAY", { clock: false }); });
const dayRef = await canvasRGBA(page, draw);
await page.evaluate(() => { const S = __crimson.story.S; S.look.set("NIGHT", { clock: false }); __crimson.step(0.1, false); S.look.dawn(2); });
await step(page, 1);
const dawnMid = await canvasRGBA(page, draw);
if (SHOTS) writePNG("/tmp/look_qa_dawn.png", dawnMid);
const lowK = colourful(dawnMid, 0.7, 1) / Math.max(0.01, colourful(dayRef, 0.7, 1)), highK = colourful(dawnMid, 0, 0.3) / Math.max(0.01, colourful(dayRef, 0, 0.3));
check(lowK > highK + 0.3, `dawn(): halfway, the ground has its colour before the sky (bottom ${lowK.toFixed(2)}, top ${highK.toFixed(2)} of full day)`);
await step(page, 1.1);
await page.evaluate(() => { __lookQA.crimson.visible = __lookQA.neon.visible = true; });
// the clock
await page.evaluate(() => { const S = __crimson.story.S; S.day.set(null, 12); S.look.set("DAY"); });
await step(page, 0.1);
const c1 = await look();
await page.evaluate(() => __crimson.story.S.day.set(null, 19.25));
await step(page, 0.1);
const c2 = await look();
await page.evaluate(() => __crimson.story.S.day.set(null, 22));
await step(page, 0.1);
const c3 = await look();
await page.evaluate(() => __crimson.story.S.day.set(null, 5.9));
await step(page, 0.1);
const c4 = await look();
check(c1.clock && c1.ink === 0 && c2.ink > 0.1 && c2.ink < 0.9 && c3.ink === 1 && c4.ink < 0.5, `the clock drives the look: noon ink ${c1.ink}, 19:15 ink ${c2.ink.toFixed(2)}, 22:00 ink ${c3.ink}, 05:54 ink ${c4.ink.toFixed(2)}`);
// variant swaps never recompile
const pr0 = await page.evaluate(() => __crimson.story.S.test.perf.programs());
for (const [n, h] of [["DAY", 12], ["DUSK", 19.2], ["NIGHT", 23], ["MEMORY", 14], ["HANGOVER", 9], ["VORTEX", 23], ["INTERIOR", 23], ["DEEP_INK", 1]]) {
  await page.evaluate(([n, h]) => { const S = __crimson.story.S; S.day.set(null, h); S.look.set(n, { clock: false }); S.look.headlights(n === "NIGHT"); }, [n, h]);
  await step(page, 0.05, { draw: true });
}
const pr1 = await page.evaluate(() => __crimson.story.S.test.perf.programs());
check(pr1 === pr0, `every look and variant swap reuses its programs (${pr0} before, ${pr1} after)`);

/* ---------------- the frame-time governor ---------------- */
const sim = (frames, o) => page.evaluate(([f, o]) => __crimson.story.S.test.perf.adaptSim(f, o), [frames, o]);
const a1 = await sim([[16.7, 1260]], { pr: 1.0, q: 1 });
const probes = a1.log.filter((e) => e.what === "probe");
check(probes.length === 1 && probes[0].at >= 19.9 && probes[0].at <= 20.2 && a1.pr === 1.1, `a steady 16.7 ms climbs one step after 20 s (${JSON.stringify(a1.log)})`);
const a2 = await sim([[25, 200]], { pr: 1.0, q: 1 });
const d2 = a2.log.find((e) => e.what === "drop");
check(!!d2 && d2.q === 0 && d2.pr === 1.0 && d2.at < 3, `25 ms frames drop the tier first (${JSON.stringify(a2.log)})`);
const a2b = await sim([[25, 400]], { pr: 1.0, q: 0 });
const d2b = a2b.log.find((e) => e.what === "drop");
check(!!d2b && d2b.pr < 1.0, `at the lowest tier the pixel ratio drops (${JSON.stringify(a2b.log)})`);
const a3 = await sim([[16.7, 1200], [25, 180], [16.7, 2600]], { pr: 1.0, q: 1 });
const p3 = a3.log.find((e) => e.what === "probe"), rv = a3.log.find((e) => e.what === "revert");
const next = a3.log.filter((e) => e.what === "probe")[1];
check(!!p3 && !!rv && rv.at - p3.at <= 3 && rv.pr === 1.0, `a probe followed by 25 ms frames reverts within 3 s (${p3 && p3.at} to ${rv && rv.at})`);
check(!next || next.at - rv.at >= 39.9, `after a revert the next probe waits twice as long (${next ? (next.at - rv.at).toFixed(1) + " s" : "none in 43 s"})`);
const a4 = await sim([[16.7, 600], [150, 40], [16.7, 700]], { pr: 1.0, q: 1 });
check(a4.log.length === 1 && a4.log[0].what === "probe", `frames over 100 ms are ignored (${JSON.stringify(a4.log)})`);
const a5 = await sim([[60, 16]], { pr: 1.0, q: 1, hold: 1000 });
const a5b = await sim([[60, 60]], { pr: 1.0, q: 1 });
check(a5.log.length === 0 && a5b.log.some((e) => e.what === "drop"), `a hold ignores frames (held: ${a5.log.length} actions; unheld: ${a5b.log.map((e) => e.what).join(",")})`);

/* ---------------- sound ---------------- */
const snd = await page.evaluate(() => {
  const S = __crimson.story.S, out = { errors: [] };
  const names = ["horn", "kazooHorn", "kazoo", "doorOpen", "doorClose", "doorSlide", "trunk", "shutter", "phoneBuzz", "rattle", "scorpionClick", "siren", "step", "splash", "pickup", "cairn", "zip", "radio", "bump"];
  for (const n of names) try { S.audio.sfx(n, { at: S.camera.position, surface: "rock" }); } catch (e) { out.errors.push(n + ": " + e.message); }
  const ls = [], base = S.test.audio.loops; // the night's crickets may already run
  for (const n of ["engine", "skid", "gravel", "crickets", "creek", "fire"]) try { const h = S.audio.loop(n, { at: S.camera.position }); h.set({ rpm: 0.5, throttle: 1, slip: 0.5, speed: 0.5, level: 1 }); ls.push(h); } catch (e) { out.errors.push(n + ": " + e.message); }
  out.loops = S.test.audio.loops - base;
  for (const h of ls) h.stop(0.1);
  out.after = S.test.audio.loops - base;
  for (const c of ["day", "night", "chase", "memory", "boss", null]) try { S.audio.cue(c); } catch (e) { out.errors.push("cue " + c + ": " + e.message); }
  out.cue = S.test.audio.cue; S.audio.cue("auto");
  out.defined = S.test.audio.defined; out.have = names.filter((n) => !S.test.audio.names().includes(n));
  out.ctx = !!S.ctx.Audio.ctx;
  S.audio.wind("canyon"); out.wind = S.test.audio.wind;
  return out;
});
check(snd.errors.length === 0 && (!snd.ctx || (snd.defined && snd.have.length === 0 && snd.loops === 6 && snd.after === 0)), `every story sound, loop and cue plays (audio ${snd.ctx ? "on" : "off"}; ${snd.errors.join("; ") || "no errors"}; missing ${snd.have.join(",") || "none"}; loops ${snd.loops} then ${snd.after})`);
await step(page, 0.6);

/* ---------------- SAVE & QUIT gives the arena its look back ---------------- */
await page.evaluate(() => __crimson.story.S.look.set("DAY"));
await step(page, 0.2);
await page.evaluate(() => { __lookQA.on = false; for (const m of __lookQA.props) m.removeFromParent(); __crimson.story.S.test.ui.quit(); });
await step(page, 0.1);
const back = await page.evaluate(async () => {
  const R = await import(new URL("js/render.js", location.href).href);
  const u = R.post.m.uniforms, bad = [];
  for (const [k, v] of Object.entries(R.POST_DEFAULTS)) { const cur = u[k].value; const ok = Array.isArray(v) ? v.every((x, i) => Math.abs(cur.getComponent(i) - x) < 1e-9) : cur === v; if (!ok) bad.push(k); }
  const W = await import(new URL("js/world.js", location.href).href);
  return { bad, variant: R.post.current, fog: R.scene.fog === W.ARENA_LOOK.fog && R.scene.fog.isFogExp2, ramp: [...R.toonRamp.image.data].join(","), samples: R.quality.samples, depth: __crimson.depth, state: __crimson.game.state, wind: __crimson.story.S.test.audio.wind };
});
check(back.state === "title" && back.bad.length === 0 && back.variant === "INK", `SAVE & QUIT: every post uniform is back at the arena value (${back.bad.join(",") || "all"}; ${back.variant})`);
check(back.fog && back.ramp === "40,110,190,255" && back.depth[0] === 0.1 && back.depth[1] === 3000, `SAVE & QUIT: arena fog, toon ramp ${back.ramp}, depth ${back.depth}`);
check(!back.wind || (back.wind.freq === 420 && back.wind.level === 0.05), `SAVE & QUIT: the arena wind is back (${JSON.stringify(back.wind)})`);
await finish("look", fails, browser, errors);
