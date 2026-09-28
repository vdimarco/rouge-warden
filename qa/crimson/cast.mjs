// The CAST package: bodies, clips, poses, props, the drain, LOD, the crowd and followers.
// - Every body GLB the story loads (the wild crew, Christian, Ryu and the donor skeleton) has exactly the 24
//   Meshy bones, at most 16k triangles and no Draco, meshopt or Basis extensions; no new GLB is added (A5).
// - Every body (GLB, arena and code-built) has exactly the 24 bone names; every code-built variant has
//   2k-5k triangles and only palette colours that pass the neon test (the gang's hi-vis stripe is the one
//   neon); the portraits exist.
// - D1: each retargeted clip's posed height (skeleton top to bottom over the bind height) stays within
//   +-0.03 of the same clip on its source body at 10 sampled frames (the extreme poses, listed in EXTREME,
//   within +-0.05); the retargeted idles sit in 0.86-0.93 on every body; the procedural locomotion keeps a
//   foot on the ground at every key. No NaN in any track; the Hips x/z is 0 on every key of every
//   retargeted and procedural clip; 'lib:walk' does not drift.
// - A placeholder has the same clip names and durations as the body that replaces it, and keeps its clip.
// - 10 spawns of one template share its clips and geometry, no clip is smoothed twice, and disposing them
//   frees their geometry and hulls.
// - drain(gabe, 1) leaves under 0.3% neon pixels on Gabe in a NIGHT frame; drain(gabe, 0) brings it back.
// - props, the costume, every pose, the vortex parts, locomotion, LOD, the crowd and the followers work;
//   SAVE & QUIT puts the arena actors back.
// Pass --shots to save pictures to /tmp/cast_*.png.
import { open, step, stepUntil, storyReady, canvasRGBA, shot, finish, writePNG, freeRoam } from "./lib.mjs";
import { readFileSync, readdirSync, existsSync } from "fs";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg); };
const SHOTS = process.argv.includes("--shots");
const PUB = new URL("../../public/", import.meta.url).pathname;
const T = await import(new URL("../../public/crimson/js/story/types.js", import.meta.url).href);
const BONES = ["Hips", "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase", "Spine02", "Spine01", "Spine", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightShoulder", "RightArm", "RightForeArm", "RightHand", "neck", "Head", "head_end", "headfront"];

/* ---------------- Node: the GLB files ---------------- */
function glb(path) {
  const b = readFileSync(path), jl = b.readUInt32LE(12), json = JSON.parse(b.toString("utf8", 20, 20 + jl));
  let tris = 0; for (const m of json.meshes || []) for (const p of m.primitives) tris += (p.indices != null ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3;
  return { json, tris, joints: (json.skins || [])[0] ? json.skins[0].joints.map((j) => json.nodes[j].name) : [] };
}
const BANNED = ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"];
const urls = [...new Set([...Object.values(T.BODY_URL).filter(Boolean), T.DONOR_RIG])];
for (const u of urls) {
  const g = glb(PUB + (u.startsWith("/") ? u.slice(1) : "crimson/" + u)); // relative URLs are under /crimson/
  const ext = (g.json.extensionsUsed || []).filter((e) => BANNED.includes(e));
  const same = g.joints.length === 24 && BONES.every((n) => g.joints.includes(n));
  check(same && g.tris <= 16000 && !ext.length, `${u}: 24 Meshy bones, ${g.tris} triangles, no Draco/meshopt/Basis`);
}
const models = readdirSync(PUB + "crimson/models").sort();
// H1 overrides A5: the rigged Vance, Voss, Rattler and gang GLBs are the only new character GLBs
check(JSON.stringify(models) === JSON.stringify(["bear.glb", "gabe.glb", "gang.glb", "rattler.glb", "ronin.glb", "vance.glb", "voss.glb"]), `only the H1 character GLBs are new: models/ holds ${models.join(", ")}`);
check(!existsSync(PUB + "crimson/anim/anim.glb"), "no anim.glb (A5)");
for (const n of ["vance", "voss", "rattler"]) check(existsSync(PUB + `crimson/art/portraits/${n}.webp`), `portrait art/portraits/${n}.webp exists (A3)`);
// no timers for flow in the package (G2)
for (const f of readdirSync(PUB + "crimson/js/story/cast")) {
  const src = readFileSync(PUB + "crimson/js/story/cast/" + f, "utf8");
  check(!/setTimeout|setInterval/.test(src), `cast/${f} uses no setTimeout or setInterval`);
}

/* ---------------- the page ---------------- */
const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", width: 640, height: 360 });
const r = await storyReady(page);
check(r.ok, `the story is ready (${r.sec} s stepped)`);
await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 30 });
check((await freeRoam(page)).ok, "free roam: F1's mission quit, nothing modal");
await step(page, 1);

// the placeholder: ryu is not in the core cast, so he is not loaded yet
const ph = await page.evaluate(() => {
  const S = __crimson.story.S;
  const was = S.cast.ready("ryu");
  const a = window.__ryu = S.cast.spawn("ryu", { pos: { x: 0, z: 0 } });
  a.play("gabe:jabs", { fade: 0 });
  a.update(0.4);
  const names = []; for (const k in a.clips) names.push(k);
  const dur = {}; for (const k of names) dur[k] = a.clips[k].duration;
  return { was, placeholder: !a.body, names, dur, t: a.t };
});
check(!ph.was && ph.placeholder, "spawn() before the body loads gives a placeholder at once");
check(ph.names.length > 60 && ["idle", "walk", "run", "ronin:l1", "gabe:jabs", "bear:sweep", "lib:walk", "lib:sitDrive", "lib:kneel"].every((n) => ph.names.includes(n)), `the placeholder has the clip names (${ph.names.length})`);

// load every body
const loadAll = await page.evaluate(async (ids) => {
  const S = __crimson.story.S, t0 = performance.now();
  const h = S.cast.preload(ids);
  while (!h.done && performance.now() - t0 < 90000) await new Promise((r) => setTimeout(r, 100));
  return { done: h.done, ms: Math.round(performance.now() - t0), ready: ids.filter((id) => !S.cast.ready(id)) };
}, T.CAST_IDS.filter((id) => !T.ARENA_CAST.includes(id)));
check(loadAll.done && !loadAll.ready.length, `every body loads (${loadAll.ms} ms real)${loadAll.ready.length ? "; not ready: " + loadAll.ready.join(", ") : ""}`);
await step(page, 0.1);
const swap = await page.evaluate(() => {
  const a = window.__ryu, dur = {}; for (const k in a.clips) dur[k] = a.clips[k].duration;
  return { body: !!a.body, cur: a.cur, t: a.t, dur };
});
const durDiff = Object.keys(ph.dur).filter((k) => Math.abs((swap.dur[k] ?? -1) - ph.dur[k]) > 1e-4);
check(swap.body && swap.cur === "gabe:jabs" && swap.t > 0.4, `the body swaps in and keeps its clip (${swap.cur} at ${swap.t.toFixed(2)} s)`);
check(!durDiff.length && Object.keys(swap.dur).length >= ph.names.length, `the placeholder's clip durations match the body's${durDiff.length ? ": " + durDiff.slice(0, 5).join(", ") : ""}`);

// bones and triangles
const bodies = await page.evaluate(() => {
  const S = __crimson.story.S, C = S.test.cast, out = {};
  for (const id of [...S.test.cast.crew, "gabe", "ronin", "bear", "christian", "ryu", ...C.built]) out[id] = { bones: C.bones(id), tris: C.tris(id) };
  const variants = {}, glb = {}; for (const id of C.built) variants[id] = Array.from({ length: S.cast.variants(id) }, (_, i) => (C.glb.includes(id) ? C.builtTris(id, i) : C.tris(id, i)));
  for (const id of C.glb) glb[id] = Array.from({ length: S.cast.variants(id) }, (_, i) => C.tris(id, i));
  return { out, variants, glb };
});
for (const [id, b] of Object.entries(bodies.out)) {
  const miss = BONES.filter((n) => !b.bones.includes(n)), extra = b.bones.filter((n) => !BONES.includes(n));
  check(b.bones.length === 24 && !miss.length && !extra.length, `${id}: exactly the 24 Meshy bone names`);
}
for (const [id, v] of Object.entries(bodies.glb)) check(v.every((t) => t > 5000 && t <= 16000), `${id}: the H1 GLB body (${v.join(", ")} triangles)`);
for (const [id, v] of Object.entries(bodies.variants)) check(v.every((t) => t >= 2000 && t <= 5000), `${id}: ${v.length} code-built variants, ${v.join(", ")} triangles (2k-5k)`);
// the palette: every colour a code-built body uses passes the neon test, except the gang's hi-vis stripe
const pal = await page.evaluate(async () => {
  const P = await import(new URL("js/story/look/palette.js", location.href).href);
  const B = __crimson.story.S.test.cast.bodies, used = {};
  const walk = (o, path) => { for (const [k, v] of Object.entries(o)) { if (typeof v === "number" && k !== "h" && k !== "build" && k !== "glow" && k !== "smile" && k !== "brows") used[`${path}.${k}`] = v; else if (v && typeof v === "object") walk(v, `${path}.${k}`); } };
  for (const [id, list] of Object.entries(B)) list.forEach((s, i) => walk(s, `${id}${i}`));
  const neon = Object.values(P.NEON), bad = [], stripes = [];
  for (const [k, v] of Object.entries(used)) { if (neon.includes(v)) { stripes.push(k); continue; } const b = P.checkNeon({ entries: { [k]: v }, dev: false }); if (b.length) bad.push(`${k} ${b[0].rule || b[0].score}`); }
  return { n: Object.keys(used).length, bad, stripes };
});
check(!pal.bad.length, `the ${pal.n} body colours pass the neon test${pal.bad.length ? ": " + pal.bad.slice(0, 4).join(", ") : ""}`);
check(pal.stripes.length && pal.stripes.every((k) => /(gang|rattler|boone)\d\.(jacket|vest)\.stripe$/.test(k)), `the only neon on a body is the gang's hi-vis stripe (${pal.stripes.length})`);

// D1: posed height against the source body, the idle band, NaN, Hips x/z, drift
const EXTREME = ["gabe:fly", "gabe:flykick", "ronin:down", "ronin:knock", "ronin:rollc", "ronin:roll", "ronin:db", "ronin:thrust", "ronin:dead", "ronin:drink", "ronin:sip", "gabe:grab", "gabe:taunt", "gabe:call"];
const d1 = await page.evaluate((EXTREME) => {
  const S = __crimson.story.S, C = S.test.cast;
  const bodies = ["tanktop", "fifty", "shades", "newbalance", "redjersey", "gabe", "vance", "voss", "rattler", "boone", "gang", "civA", "civB", "christian", "ryu"];
  const names = C.clipNames("newbalance");
  const sets = { ronin: names.filter((n) => n.startsWith("ronin:")), gabe: names.filter((n) => n.startsWith("gabe:")), bear: names.filter((n) => n.startsWith("bear:")) };
  const res = { worst: 0, worstAt: "", strictBad: [], extremeBad: [], nan: [], drift: [], band: [], clips: 0, frames: 0 };
  const src = {};
  for (const [set, list] of Object.entries(sets)) for (const c of list) src[c] = C.heights(set, c);
  for (const id of bodies) {
    for (const [set, list] of Object.entries(sets)) {
      if (set === "bear" && !["voss", "rattler", "boone", "gang", "gabe"].includes(id)) continue; // the bear set is for bosses
      for (const c of list) {
        const clip = C.clip(id, c);
        if (!C.finite(clip)) res.nan.push(`${id} ${c}`);
        if (C.drift(clip) > 1e-6) res.drift.push(`${id} ${c}`);
        const h = C.heights(id, c), s = src[c];
        res.clips++; res.frames += h.length;
        const dev = Math.max(...h.map((x, i) => Math.abs(x - s[i])));
        if (dev > res.worst) { res.worst = dev; res.worstAt = `${id} ${c}`; }
        const lim = EXTREME.includes(c) || set === "bear" ? 0.05 : 0.03;
        if (dev > lim) (lim > 0.03 ? res.extremeBad : res.strictBad).push(`${id} ${c} ${dev.toFixed(3)}`);
      }
      for (const c of ["ronin:idle", "gabe:idle"]) { const h = C.heights(id, c), m = h.reduce((a, b) => a + b, 0) / h.length; if (!(m >= 0.86 && m <= 0.93)) res.band.push(`${id} ${c} ${m.toFixed(3)}`); }
    }
    for (const n of names.filter((n) => n.startsWith("lib:"))) { const clip = C.clip(id, n); if (!C.finite(clip)) res.nan.push(`${id} ${n}`); if (C.drift(clip) > 1e-6) res.drift.push(`${id} ${n}`); }
  }
  return res;
}, EXTREME);
check(!d1.strictBad.length, `D1: ${d1.clips} retargeted clips on 15 bodies (${d1.frames} frames) within +-0.03 of the source body${d1.strictBad.length ? ": " + d1.strictBad.slice(0, 6).join(", ") : ""}`);
check(!d1.extremeBad.length, `D1: the extreme poses (knockdowns, rolls, the flying kick, the bear set) within +-0.05; worst ${d1.worst.toFixed(3)} (${d1.worstAt})${d1.extremeBad.length ? ": " + d1.extremeBad.slice(0, 6).join(", ") : ""}`);
check(!d1.band.length, `the retargeted idles sit in 0.86-0.93 of bind height on every body${d1.band.length ? ": " + d1.band.slice(0, 6).join(", ") : ""}`);
check(!d1.nan.length, `no NaN in any track${d1.nan.length ? ": " + d1.nan.slice(0, 4).join(", ") : ""}`);
check(!d1.drift.length, `the Hips x/z is 0 on every key of every retargeted and procedural clip${d1.drift.length ? ": " + d1.drift.slice(0, 4).join(", ") : ""}`);

// procedural locomotion: a foot on the ground at every key, the root in place
const loco = await page.evaluate(async () => {
  const S = __crimson.story.S, C = S.test.cast, THREE = S.THREE;
  const R = await import(new URL("js/story/cast/rig.js", location.href).href);
  const out = [];
  for (const id of ["newbalance", "fifty", "vance", "civB", "boone"]) {
    const tpl = C.template(id), rig = tpl.rig;
    for (const n of ["lib:walk", "lib:jog", "lib:run", "lib:crouchWalk", "lib:idle", "lib:kneel", "lib:crouch"]) {
      const clip = C.clip(id, n);
      const q = {}, it = {};
      for (const t of clip.tracks) { const [b, p] = t.name.split("."); it[t.name] = t.createInterpolant(); }
      let worst = 0;
      for (let k = 0; k < 12; k++) {
        const t = clip.duration * k / 12;
        for (const b of R.BONES) q[b] = new THREE.Quaternion().fromArray(it[`${b}.quaternion`].evaluate(t));
        const hp = new THREE.Vector3().fromArray(it["Hips.position"].evaluate(t));
        const f = R.fk(rig, q, hp);
        let lo = Infinity; for (const b of ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase", "LeftLeg", "RightLeg"]) lo = Math.min(lo, f.P[b].y - (b.endsWith("Leg") ? 0.075 * rig.hipsY : rig.worldP[b].y - rig.minY));
        worst = Math.max(worst, Math.abs(lo));
      }
      out.push([`${id} ${n}`, worst]);
    }
  }
  return out;
});
const lbad = loco.filter(([, w]) => w > 2.5);
check(!lbad.length, `the procedural clips keep a foot or knee on the ground at every key (worst ${Math.max(...loco.map((x) => x[1])).toFixed(2)} cm)${lbad.length ? ": " + lbad.map(([k, w]) => `${k} ${w.toFixed(1)}`).join(", ") : ""}`);

// 10 spawns of one template: shared clips and geometry, one smoothing pass, dispose frees everything
const ten = await page.evaluate(async () => {
  const S = __crimson.story.S, R = S.renderer;
  const A = await import(new URL("js/actors.js", location.href).href);
  const ronin = S.ctx.actors.ronin, runBefore = Array.from(ronin.clips.run.tracks[0].values.slice(0, 8));
  const hulls = () => { let n = 0; S.scene.traverse((o) => { if (o.isMesh && o.material && o.material.side === S.THREE.BackSide && o.material.isMeshBasicMaterial) n++; }); return n; };
  __crimson.step(1 / 60, true);
  const g0 = R.info.memory.geometries, h0 = hulls();
  const p = S.world.place("airport_mesa");
  const list = Array.from({ length: 10 }, (_, i) => S.cast.spawn("gang", { variant: 1, pos: { x: p.x + i, z: p.z } }));
  for (const a of list) a.play("ronin:run", { fade: 0 });
  __crimson.step(1 / 60, true);
  const g1 = R.info.memory.geometries, h1 = hulls();
  const sameClip = list.every((a) => a.body.clips["ronin:run"] === list[0].body.clips["ronin:run"]) && list.every((a) => a.body.clips["lib:walk"] === list[0].body.clips["lib:walk"]);
  const geo = (a) => { let g = null; a.body.model.traverse((o) => { if (!g && o.isSkinnedMesh) g = o.geometry; }); return g; };
  const sameGeo = list.every((a) => geo(a) === geo(list[0]));
  const smoothOnce = A.smoothPasses(ronin.clips.run) && JSON.stringify(Array.from(ronin.clips.run.tracks[0].values.slice(0, 8))) === JSON.stringify(runBefore);
  for (const a of list) S.cast.despawn(a);
  __crimson.step(1 / 60, true);
  const g2 = R.info.memory.geometries, h2 = hulls();
  return { g0, g1, g2, h0, h1, h2, sameClip, sameGeo, smoothOnce, disposed: list.every((a) => a.disposed && !a.root.parent) };
});
check(ten.sameClip && ten.sameGeo, "10 spawns of one template share its clips and its geometry");
// frustum culling with padded spheres in the skinned mesh's own space (a quantized GLB too)
const cull = await page.evaluate(() => {
  const S = __crimson.story.S, T = S.THREE, out = [];
  for (const id of ["newbalance", "vance", "tanktop"]) {
    const a = S.cast.spawn(id, { pos: { x: 0, z: 0 } });
    a.root.updateMatrixWorld(true);
    let m = null; a.body.model.traverse((o) => { if (!m && o.isSkinnedMesh && !o.userData.hull) m = o; });
    const c = m.boundingSphere.center.clone().applyMatrix4(m.matrixWorld), r = m.boundingSphere.radius * m.matrixWorld.getMaxScaleOnAxis();
    const hips = a.bone("Hips").getWorldPosition(new T.Vector3());
    out.push({ id, cull: m.frustumCulled, r: +r.toFixed(2), off: +c.distanceTo(hips).toFixed(2) });
    S.cast.despawn(a);
  }
  return out;
});
check(cull.every((c) => c.cull && c.r > 1.2 && c.r < 2.2 && c.off < 0.6), `story bodies frustum-cull with a padded sphere round the body (${JSON.stringify(cull)})`);
check(ten.smoothOnce, "no clip is smoothed twice (the arena run clip is untouched)");
check(ten.disposed && ten.g2 <= ten.g0 && ten.h2 === ten.h0 && ten.h1 >= ten.h0 + 10, `dispose frees the geometry and the hulls (geometries ${ten.g0} -> ${ten.g1} -> ${ten.g2}, hulls ${ten.h0} -> ${ten.h1} -> ${ten.h2})`);

/* ---------------- the drain on Gabe in a NIGHT frame ---------------- */
await page.evaluate(() => {
  const S = __crimson.story.S, T = S.THREE;
  const p = S.world.place("airport_mesa"), y = S.world.surface(p.x, p.z);
  if (window.__ryu) { S.cast.despawn(window.__ryu); window.__ryu = null; }
  const g = window.__g = S.cast.spawn("gabe", { pos: { x: p.x, z: p.z }, yaw: 0 });
  window.__gShadow = []; g.root.traverse((o) => { if (o.isMesh && o.castShadow) { o.castShadow = false; window.__gShadow.push(o); } }); // only Gabe's own pixels differ
  g.play("gabe:idle", { fade: 0 });
  S.look.set("NIGHT", { dur: 0, clock: false });
  const Q = window.__qa = { eye: new T.Vector3(p.x, y + 1.2, p.z + 3.2), at: new T.Vector3(p.x, y + 1.0, p.z) };
  S.cameras.add("qa", 1000, () => !!window.__qa, () => { S.camera.position.copy(Q.eye); S.camera.lookAt(Q.at); S.focus.copy(Q.at); });
});
await step(page, 1);
const frame = (k, vis) => canvasRGBA(page, async ([k, vis]) => { const S = __crimson.story.S; if (k != null) S.cast.drain(window.__g, k); window.__g.visible = vis; __crimson.step(1 / 60, true); __crimson.step(1 / 60, true); }, [k, vis]);
const neonOf = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / (mx + 0.02); const s = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }; return s(0.82, 1.02, g / (r + 0.03)) * s(0.12, 0.4, g - b) * s(0.35, 0.6, sat) * s(0.18, 0.4, g); };
const bg = await frame(null, false);
const neonShare = (img) => { let n = 0, ne = 0; for (let i = 0; i < img.data.length; i += 4) { const d = Math.abs(img.data[i] - bg.data[i]) + Math.abs(img.data[i + 1] - bg.data[i + 1]) + Math.abs(img.data[i + 2] - bg.data[i + 2]); if (d < 24) continue; n++; if (neonOf(img.data[i] / 255, img.data[i + 1] / 255, img.data[i + 2] / 255) > 0.5) ne++; } return { n, share: ne / Math.max(1, n) }; };
const d0 = neonShare(await frame(0, true)), dimg = await frame(1, true), d1n = neonShare(dimg), d2 = neonShare(await frame(0, true));
check(d0.n > 3000 && d0.share > 0.03, `Gabe undrained shows his neon at night (${(d0.share * 100).toFixed(1)}% of ${d0.n} pixels)`);
check(d1n.n > 3000 && d1n.share < 0.003, `drain(gabe, 1) leaves under 0.3% neon pixels on Gabe in a NIGHT frame (${(d1n.share * 100).toFixed(2)}%)`);
check(Math.abs(d2.share - d0.share) < 0.01, `drain(gabe, 0) brings the neon back (${(d2.share * 100).toFixed(1)}%)`);
if (SHOTS) writePNG("/tmp/cast_drain.png", dimg);
// the ink shadow: black body, neon eyes
const ink = await canvasRGBA(page, async () => { const S = __crimson.story.S; S.cast.drain(window.__g, 1); S.cast.inkShadow(window.__g, 1); __crimson.step(1 / 60, true); __crimson.step(1 / 60, true); });
let dark = 0, tot = 0; for (let i = 0; i < ink.data.length; i += 4) { const d = Math.abs(ink.data[i] - bg.data[i]) + Math.abs(ink.data[i + 1] - bg.data[i + 1]) + Math.abs(ink.data[i + 2] - bg.data[i + 2]); if (d < 24) continue; tot++; if (ink.data[i] + ink.data[i + 1] + ink.data[i + 2] < 150) dark++; } // under 50 of 255 a channel: ink black (the grain lifts it a little)
const eyes = await page.evaluate(() => (window.__g.inkEyes || []).length);
check(tot > 1000 && dark / tot > 0.6 && eyes === 2, `inkShadow(gabe, 1) turns the body to ink with two neon eyes (${(100 * dark / Math.max(1, tot)).toFixed(0)}% dark)`);
if (SHOTS) writePNG("/tmp/cast_ink.png", ink);
await page.evaluate(() => { const S = __crimson.story.S; S.cast.inkShadow(window.__g, 0); S.cast.drain(window.__g, 1); for (const o of window.__gShadow) o.castShadow = true; });

/* ---------------- props, costume, poses, vortex parts ---------------- */
const pr = await page.evaluate(() => {
  const S = __crimson.story.S, T = S.THREE, out = { sizes: {}, missing: [] };
  for (const n of S.cast.props.names) {
    if (["haori", "sash", "sheath"].includes(n)) continue;
    const m = S.cast.props.make(n); if (!m) { out.missing.push(n); continue; }
    const b = new T.Box3().setFromObject(m), s = b.getSize(new T.Vector3());
    out.sizes[n] = +Math.max(s.x, s.y, s.z).toFixed(2);
  }
  const p = S.world.place("airport_mesa");
  const a = window.__crew = S.cast.spawn("tanktop", { pos: { x: p.x + 1.5, z: p.z } });
  S.cast.costume(a, true);
  a.play("ronin:combo", { fade: 0 });
  for (let i = 0; i < 30; i++) a.update(1 / 30);
  a.root.updateMatrixWorld(true);
  const w = (o) => o.getWorldPosition(new T.Vector3());
  const head = w(a.bone("Head")), kasa = w(a.props.kasa);
  out.costume = { kasa: !!a.props.kasa && kasa.y > head.y && kasa.distanceTo(head) < 0.4, haori: !!(a.props.haori && a.props.haori.isSkinnedMesh), sash: !!(a.props.sash && a.props.sash.isSkinnedMesh && a.props.sash.material.userData.key === "solid"), sheath: !!a.props.sheath };
  S.cast.props.attach(a, "foamKatana");
  const k = w(a.props.foamKatana), hand = w(a.bone("RightHand"));
  out.katana = k.distanceTo(hand);
  out.drawn = a.props.sheath.visible === false;
  // D3: the costume follows the chapter (on from F3, off in F1)
  const M = S.missions, was = M.chapter;
  const f = S.cast.spawn("shades", { pos: { x: p.x + 3, z: p.z } });
  const off0 = !f.props.kasa;
  try { M.chapter = "f3"; S.bus.emit("chapter", { id: "f3" }); } catch (e) { /* a getter */ }
  const on = !!f.props.kasa;
  try { M.chapter = was; S.bus.emit("chapter", { id: was }); } catch (e) { /* a getter */ }
  out.auto = off0 && on && !f.props.kasa;
  S.cast.despawn(f);
  S.cast.costume(a, false);
  out.off = !a.props.kasa && !a.props.haori && !a.props.sash;
  // poses
  out.poses = {};
  for (const n of ["sitDrive", "sitPass", "kneel", "crouch", "photo", "phone", "talk", "handsOpen", "dazed", "knocked", "cheer"]) {
    S.cast.pose(a, n, 1); for (let i = 0; i < 20; i++) a.update(1 / 30); a.root.updateMatrixWorld(true);
    out.poses[n] = { clip: a.cur, hips: +(w(a.bone("Hips")).y - a.root.position.y).toFixed(2), head: +(w(a.bone("Head")).y - a.root.position.y).toFixed(2) };
  }
  S.cast.pose(a, "talk", 0.6); out.talk = a.loco.talk;
  // vortex parts
  const v = S.cast.spawn("voss", { pos: { x: p.x - 1.5, z: p.z } }), rt = S.cast.spawn("rattler", { pos: { x: p.x - 3, z: p.z } });
  const sc = S.cast.vortexParts(v, "scorpion"), rs = S.cast.vortexParts(rt, "rattlesnake");
  v.root.updateMatrixWorld(true); rt.root.updateMatrixWorld(true);
  const t0 = w(sc.tip), r0 = w(rs.tip);
  sc.set({ curl: 1, strike: 1, open: 1 }); rs.set({ curl: 1, rattle: 1 });
  v.root.updateMatrixWorld(true); rt.root.updateMatrixWorld(true);
  const t1 = w(sc.tip), r1 = w(rs.tip);
  out.vortex = { scorp: !!sc.tail.parent && t0.distanceTo(t1) > 0.3, snake: !!rs.tail.parent && r0.distanceTo(r1) > 0.1, tipY: +(t0.y - v.root.position.y).toFixed(2), finite: [t0, t1, r0, r1].every((q) => Number.isFinite(q.x + q.y + q.z)) };
  S.cast.despawn(v); S.cast.despawn(rt);
  return out;
});
check(!pr.missing.length && Object.keys(pr.sizes).length >= 20, `every prop builds (${Object.keys(pr.sizes).length}): ${Object.entries(pr.sizes).map(([k, v]) => `${k} ${v}`).join(", ")}`);
check(Math.abs(pr.sizes.staff - 1.6) < 0.05 && pr.sizes.foamKatana > 0.85 && pr.sizes.foamKatana < 1.05 && pr.sizes.cue > 1.4, "props are sized in metres (staff 1.6 m, katana 0.9 m, cue 1.45 m)");
check(pr.costume.kasa && pr.costume.haori && pr.costume.sash && pr.costume.sheath && pr.off, `the costume: kasa on the head, haori and crimson sash shells, katana at the hip, all off again (${JSON.stringify(pr.costume)})`);
check(pr.katana < 0.25 && pr.drawn, `a held prop sits in the hand (${pr.katana.toFixed(2)} m from the wrist), and drawing the katana empties the sheath`);
check(pr.auto, "the crew costume follows the chapter (D3: on in F3, off in F1)");
const P = pr.poses;
check(Object.values(P).every((p) => p.clip && p.clip.startsWith("lib:")), "every procedural pose plays its lib clip");
check(P.knocked.head < 0.45 && P.dazed.hips < 0.3 && P.kneel.hips < 0.8 && P.crouch.hips < 0.8 && P.photo.hips > 0.85 && Math.abs(P.sitDrive.hips - 0.12) < 0.08, `the poses stand, sit, kneel and lie where they should (${Object.entries(P).map(([k, v]) => `${k} hips ${v.hips} head ${v.head}`).join("; ")})`);
check(pr.talk > 0.5, "pose(a, 'talk', k) lays the talk sway over the clip");
check(pr.vortex.scorp && pr.vortex.snake && pr.vortex.finite && pr.vortex.tipY > 1.2, `the vortex parts pose with set() (scorpion stinger ${pr.vortex.tipY} m up)`);

/* ---------------- locomotion, replace, LOD ---------------- */
const lo = await page.evaluate(() => {
  const S = __crimson.story.S, T = S.THREE, a = window.__crew, out = {};
  a.play("lib:idle", { fade: 0 });
  for (let i = 0; i < 30; i++) a.update(1 / 30);
  const leg = () => a.bone("LeftUpLeg").quaternion.clone();
  const q0 = leg();
  a.move(1.5); const qs = [];
  for (let i = 0; i < 40; i++) { a.update(1 / 30); qs.push(leg()); }
  out.walks = Math.max(...qs.map((q) => q.angleTo(q0))) > 0.3;
  a.move(0);
  for (let i = 0; i < 60; i++) a.update(1 / 30);
  out.stops = a.loco.w < 0.02 && leg().angleTo(q0) < 0.08;
  // replace: the C0 cut, from one body to another on the same clip
  const b = S.cast.spawn("gang", { pos: { x: a.root.position.x + 2, z: a.root.position.z } });
  b.play("gabe:jabs", { fade: 0 }); for (let i = 0; i < 10; i++) b.update(1 / 30);
  const bt = b.t, c = S.cast.replace(b, "fifty");
  out.replace = c.cur === "gabe:jabs" && Math.abs(c.t - bt) < 0.05 && !!c.props.kasa && b.disposed;
  if (!out.replace) out.replaceInfo = { cur: c.cur, t: c.t, bt, kasa: !!c.props.kasa, disposed: b.disposed };
  S.cast.despawn(c);
  // LOD: hull, mixer rate, hiding
  const cam = S.camera.position.clone();
  const at = (d) => { a.root.position.set(cam.x + d, a.root.position.y, cam.z); S.cast.lodUpdate(cam); return { hull: a.hullOn, hz: a.lodHz || 0, hidden: !!a.lodHidden, model: a.model.visible }; };
  out.lod = { near: at(5), mid: at(28), far: at(60), gone: at(150), back: at(5) };
  // a heavy body draws its coarse copy far off (a third of the triangles, the same skin), the full one near
  const tris = () => { let n = 0; a.root.traverse((o) => { if (o.isSkinnedMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return n; };
  at(5); const tn = tris(); at(28); const tf = tris(); at(5); const tb = tris();
  out.coarse = { heavy: !!a.heavy, near: tn, far: tf, back: tb };
  return out;
});
check(lo.walks && lo.stops, "move(speed) lays a stride over the clip and fades out at rest");
check(lo.replace, `replace() stands a costumed crew body in for another on the same clip and time (the C0 cut)${lo.replaceInfo ? " " + JSON.stringify(lo.replaceInfo) : ""}`);
const L = lo.lod;
check(L.near.hull && !L.near.hz && !L.mid.hull && L.far.hz === 15 && L.gone.hidden && !L.gone.model && L.back.hull && L.back.model, `LOD: hull within 25 m, 15 Hz beyond 30 m, hidden beyond 120 m (${JSON.stringify(L)})`);
const Co = lo.coarse;
check(!Co.heavy || (Co.far < Co.near * 0.5 && Co.far > Co.near * 0.2 && Co.back === Co.near), `LOD: a heavy body draws a coarse copy far off (${JSON.stringify(Co)})`);

/* ---------------- the crowd and followers ---------------- */
await page.evaluate(() => { const S = __crimson.story.S; window.__qa = null; S.look.set("DAY", { dur: 0, clock: false }); const u = S.world.place("uptown"); S.hero.place(u.x, u.z, 0); });
await step(page, 20);
const cr = await page.evaluate(() => {
  const S = __crimson.story.S, C = S.test.cast.crowd, out = {};
  out.n = C.list.length;
  out.onGround = C.list.every((p) => Math.abs(p.pos.y - S.world.surface(p.pos.x, p.pos.z, p.pos.y + 1)) < 0.05);
  out.people = S.vehicles.people.filter((c) => c.crowd).length;
  const p = C.list[0];
  const c = p.circle, x0 = p.pos.x, z0 = p.pos.z;
  out.dive = c.dive({ x: 1, z: 0 });
  window.__dive = { p, x0, z0 };
  S.cast.crowd.scatter(p.pos.x, p.pos.z, 30);
  out.flee = C.list.filter((q) => q.state === "flee").length;
  return out;
});
await step(page, 0.5);
const dv = await page.evaluate(() => { const d = window.__dive; return Math.hypot(d.p.pos.x - d.x0, d.p.pos.z - d.z0); });
check(cr.n >= 8 && cr.n <= 12, `the crowd fills Uptown at Q2 (${cr.n} people, at most 12)`);
check(cr.onGround, "every pedestrian stands on the ground");
check(cr.people === cr.n, `each pedestrian puts a soft circle into S.vehicles.people (${cr.people})`);
check(cr.dive && dv > 1.2, `dive() sidesteps a pedestrian clear in 0.4 s (${dv.toFixed(2)} m)`);
check(cr.flee >= 1, `scatter() sends nearby people running (${cr.flee})`);
const fo = await page.evaluate(() => {
  const S = __crimson.story.S, H = S.hero;
  // (the chapter's crew already follows the hero in free roam: send them off so these two take the first slots)
  for (const e of S.cast.followers.list.slice()) { S.cast.followers.remove(e.a); e.a.visible = false; }
  const f = [S.cast.spawn("shades", { pos: { x: H.pos.x + 3, z: H.pos.z } }), S.cast.spawn("redjersey", { pos: { x: H.pos.x - 3, z: H.pos.z } })];
  f.forEach((a) => S.cast.followers.add(a));
  window.__f = f;
  H.place(H.pos.x + 12, H.pos.z - 8, H.face);
  return f.length;
});
await step(page, 8);
const fo2 = await page.evaluate(() => {
  const S = __crimson.story.S, H = S.hero, f = window.__f;
  const d = f.map((a) => Math.hypot(a.root.position.x - H.pos.x, a.root.position.z - H.pos.z));
  // board a van: they walk to the door, fade and sit
  const v = S.vehicles.spawn("van", { pos: { x: H.pos.x + 4, z: H.pos.z + 4 } });
  window.__van = v;
  S.cast.followers.board(v);
  return d;
});
await step(page, 6);
const fo3 = await page.evaluate(() => { const S = __crimson.story.S; const f = window.__f; const seated = f.map((a) => !a.visible); S.cast.followers.board(null); return seated; });
await step(page, 1);
const fo4 = await page.evaluate(() => window.__f.map((a) => a.visible));
check(fo2.every((d) => d < 4.5), `followers keep their slots behind the hero (${fo2.map((d) => d.toFixed(1)).join(", ")} m)`);
check(fo3.every(Boolean) && fo4.every(Boolean), "followers board a van (hidden in their seats) and get out again");

if (SHOTS) {
  await page.evaluate(() => {
    const S = __crimson.story.S, T = S.THREE, H = S.hero;
    const eye = new T.Vector3(H.pos.x + 5, H.pos.y + 3, H.pos.z + 6), at = new T.Vector3(H.pos.x, H.pos.y + 1, H.pos.z);
    S.cameras.add("qa2", 1001, () => true, () => { S.camera.position.copy(eye); S.camera.lookAt(at); });
  });
  await step(page, 0.1, { draw: true });
  await shot(page, "/tmp/cast_followers.png");
}

/* ---------------- SAVE & QUIT puts the arena actors back ---------------- */
const back = await page.evaluate(() => {
  const S = __crimson.story.S, g = S.ctx.actors.gabe, rn = S.ctx.actors.ronin;
  S.test.ui.quit();
  const protoOk = [g, rn, S.ctx.actors.bear].every((a) => Object.getPrototypeOf(a.clips) === Object.prototype && a.driver === null && !a.move && !a.loco);
  const glowOk = g.glowMats.every((m) => Math.abs(m.emissiveIntensity - 0.35) < 1e-6);
  let patched = 0; g.model.traverse((o) => { if (o.material && o.material.userData && o.material.userData.castFx) patched++; });
  const hullsOn = S.test.cast.lod.hullsOf(g).every((h) => h.visible);
  return { protoOk, glowOk, patched, hullsOn, scale: g.root.scale.x, state: __crimson.game.state, live: S.test.cast.live };
});
check(back.state === "title" && back.live === 0, "SAVE & QUIT despawns every story actor");
check(back.protoOk && back.glowOk && !back.patched && back.hullsOn && back.scale === 1, `the arena actors are back as the arena built them (${JSON.stringify(back)})`);

await finish("cast", fails, browser, errors);
