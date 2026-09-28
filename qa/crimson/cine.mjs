// Every cut scene, played through, frame by frame (content/cines.js, missions/cine.js).
// For each chapter the page opens at ?chapter=<id>, the mission's steps up to each cine are passed over
// (the hero set down where a step would take him), and each cine plays on its own clock. Every 0.5 s of
// cine time (--every) and at the start, middle and end of every shot the frame is probed, and the run fails on:
// - the camera inside geometry: under the ground, inside a building, a wall, a tree trunk or a rock's
//   collider or a vehicle's box, inside a closed mesh (a tree crown, a boulder, a prop), a surface within 0.35 m
//   of the lens, or the ground between the lens and the head of the actor the shot looks at
// - a speaker's head out of frame: the line's speaker is in the shot (the camera looks at them, or their
//   body is on screen) but the head is cut off by the frame's edge or the letterbox bars, or it is hidden
//   behind the dialogue box or the subtitle
// - the HUD or the touch controls showing (anything in the story HUD but the subtitles, the dialogue box,
//   the cards and the hold-to-skip ring; the arena's #hud and #touch)
// - a coarse LOD body in a cine (lod.js setCoarse), or a capsule placeholder on screen
// - the render scale below the cine's (quality.js cinePR)
// Usage: node qa/crimson/cine.mjs [chapter ...] [--view phone|desktop|both] [--shots <dir>] [--per <n>] [--every <s>]
//   phone: 1000x750, touch, device pixel ratio 2, Q1 (the tier a phone starts on); desktop: 1280x720, Q2.
//   --shots saves n frames per shot (default 3: start, middle, end) as <dir>/<view>/<cine>_s<shot>_<k>.png.
import { open, step, stepUntil, storyReady, finish } from "./lib.mjs";
import { mkdirSync } from "fs";

const T = await import(new URL("../../public/crimson/js/story/types.js", import.meta.url).href);
const C = { ...(await import(new URL("../../public/crimson/js/story/content/content.js", import.meta.url).href)), ...(await import(new URL("../../public/crimson/js/story/content/chapters.js", import.meta.url).href)), ...(await import(new URL("../../public/crimson/js/story/content/cines.js", import.meta.url).href)) };
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const SHOTS = opt("--shots", null), PER = +opt("--per", 3) || 3, VIEW = opt("--view", "phone"), EVERY = +opt("--every", 0.5) || 0.5;
const want = args.filter((a) => !a.startsWith("--"));
const CHAPTERS = want.length ? want : T.CHAPTER_ORDER;
const VIEWS = { phone: { width: 1000, height: 750, touch: true, dpr: 2, q: 1 }, desktop: { width: 1280, height: 720, touch: false, dpr: 1, q: 2 } };
const views = VIEW === "both" ? ["phone", "desktop"] : [VIEW];
const fails = [], errs = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg); };

// the cines of a chapter, in order: [{mission, index, cine}]
function cinesOf(ch) {
  const out = [];
  const ms = (C.CHAPTERS[ch] && C.CHAPTERS[ch].missions) || Object.values(C.MISSIONS).filter((m) => m.chapter === ch).map((m) => m.id);
  for (const id of ms) {
    const m = C.MISSIONS[id]; if (!m) continue;
    m.steps.forEach((s, i) => { const c = s.type === "cine" ? s.id : s.args && s.args.cine; if (c) out.push({ mission: id, index: i, cine: c }); });
  }
  return out;
}
// the times to look at: every 0.25 s, plus the start, middle and end of each shot (the shot's index and k)
function timesOf(def) {
  const shots = def.shots || [], out = [];
  shots.forEach((s, i) => {
    const end = Math.min(def.dur, i + 1 < shots.length ? shots[i + 1].at : def.dur), span = end - s.at;
    for (let k = 0; k < PER; k++) out.push({ t: s.at + Math.min(0.12, span / 4) + (span - 2 * Math.min(0.12, span / 4)) * (PER === 1 ? 0.5 : k / (PER - 1)), shot: i, k });
  });
  for (let t = EVERY; t < def.dur - 0.05; t += EVERY) if (!out.some((o) => Math.abs(o.t - t) < 0.06)) out.push({ t });
  return out.sort((a, b) => a.t - b.t);
}

/* ---------------- in the page ---------------- */
// the probe: what is wrong with the frame now (the camera, the speaker, the HUD, the bodies)
const PROBE = (CREW) => {
  const S = __crimson.story.S, T3 = S.THREE, cam = S.camera, id = S.cine.current, def = S.content.CINES[id] || {};
  const bad = [], info = {};
  S.scene.updateMatrixWorld(true);
  cam.updateMatrixWorld(true);
  const c = cam.position.clone();
  const bars = document.body.classList.contains("cine") ? 0.11 : 0; // the letterbox bars, 11vh each
  const W = innerWidth, H = innerHeight;
  // the actors' roots (their meshes are not geometry the camera can be inside)
  const actors = S.cast.all().filter((a) => a && a.root);
  const roots = new Set(actors.map((a) => a.root));
  const isActor = (o) => { for (let p = o; p; p = p.parent) if (roots.has(p) || p.userData && p.userData.actor) return true; return false; };
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  // 1. the camera inside geometry
  if (!def.arena && S.world && S.world.surface) {
    const g = S.world.surface(c.x, c.z, c.y + 0.5);
    info.clear = +(c.y - g).toFixed(2);
    const vol = c.y < -200 && S.world.colliders.inVolume ? S.world.colliders.inVolume(c.x, c.y, c.z) : null;
    if (c.y < -200 && !vol) bad.push("camera outside the room it films");
    else if (vol && c.y > vol.y1 - 1.1) bad.push("camera above the room's ceiling");
    else if (c.y < g + 0.2) bad.push(`camera ${(g - c.y).toFixed(2)} m under the ground`);
    let rockNear = false;
    S.world.colliders.query(c.x, c.z, 0.2, (it) => {
      if (it.kind === "volume" || !(c.y > it.y0 && c.y < it.y1)) return;
      if (it.tag === "rock") { rockNear = true; return; } // (a rock collider has no height: the rays below say)
      bad.push(`camera inside a collider (${it.tag || it.kind})`);
    });
    // inside a rock formation: the formations are part of the terrain tiles, so rays out from the lens against
    // the tiles around it; most of them leaving through a back face means the lens is inside the rock
    if (rockNear) {
      const ray = new T3.Raycaster(), dirs = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].map((d) => new T3.Vector3(...d)), sp = new T3.Sphere();
      const tiles = []; S.scene.traverse((o) => { if (o.isMesh && /^tile/.test(o.name) && shown(o)) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); if (sp.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld).containsPoint(c)) tiles.push(o); } });
      let back = 0;
      for (const d of dirs) {
        ray.set(c, d); ray.far = 80;
        const sides = tiles.map((o) => { const m = Array.isArray(o.material) ? o.material[0] : o.material, was = m.side; m.side = T3.DoubleSide; return [m, was]; });
        try { const h = ray.intersectObjects(tiles, false)[0]; if (h && h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(d) > 0) back++; } finally { for (const [m, was] of sides) m.side = was; }
      }
      if (back >= 3) bad.push("camera inside a rock formation");
    }
    for (const v of (S.test.vehicles ? S.test.vehicles.all : S.vehicles.list) || []) {
      if (!v.toLocal || !v.pos) continue;
      const [lx, lz] = v.toLocal(c.x, c.z);
      if (Math.abs(lx) < v.hw + 0.2 && Math.abs(lz) < v.hd + 0.2 && c.y > v.pos.y - 0.5 && c.y < v.pos.y + (v.h || 2) + 0.1) bad.push(`camera inside a vehicle (${v.kind || v.id})`);
    }
  }
  // the ground between the lens and what the shot looks at (the actor it is on: its head)
  const shotNow = (() => { let x = null; for (const s of def.shots || []) if (s.at <= S.cine.t + 1e-6) x = s; return x; })();
  if (!def.arena && shotNow && shotNow.look && shotNow.look.who && c.y > -200) {
    const la = S.cine.actor ? S.cine.actor(shotNow.look.who) : null, hb = la && la.bone && la.bone("Head");
    if (hb) {
      const L = hb.getWorldPosition(new T3.Vector3()), n = Math.min(60, Math.ceil(L.distanceTo(c) / 0.4));
      for (let i = 1; i < n; i++) { const q = c.clone().lerp(L, i / n); if (q.y < S.world.height(q.x, q.z) - 0.1) { bad.push(`the ground hides ${la.id}'s head`); break; } }
    }
  }
  // meshes around the lens: inside a closed mesh (rays out all hit its back faces), or a face at the lens
  const ray = new T3.Raycaster(), hits = [], mats = [], m4 = new T3.Matrix4(), sph = new T3.Sphere();
  const near = [];
  const tmpMesh = new T3.Mesh();
  S.scene.traverse((o) => {
    if (!(o.isMesh) || o.isSkinnedMesh || !shown(o) || isActor(o)) return;
    const mt = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mt || mt.visible === false || (mt.transparent && mt.opacity < 0.3) || mt.blending === T3.AdditiveBlending || mt.side === T3.BackSide && mt.isMeshBasicMaterial) return;
    const g = o.geometry; if (!g) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (o.isInstancedMesh) {
      if (!o.boundingSphere) o.computeBoundingSphere();
      if (sph.copy(o.boundingSphere).applyMatrix4(o.matrixWorld).distanceToPoint(c) > 0.6) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld);
        sph.copy(g.boundingSphere).applyMatrix4(m4);
        if (sph.radius < 80 && sph.distanceToPoint(c) < 0.6) near.push({ o, m: m4.clone(), i });
      }
    } else {
      sph.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
      if (sph.radius < 80 && sph.distanceToPoint(c) < 0.6) near.push({ o, m: o.matrixWorld.clone() });
    }
  });
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((d) => new T3.Vector3(...d));
  const fwd = [[0, 0], [0.85, 0.7], [-0.85, 0.7], [0.85, -0.7], [-0.85, -0.7]].map(([x, y]) => new T3.Vector3(x, y, 0.5).unproject(cam).sub(c).normalize());
  for (const n of near) {
    const o = n.o, mt = Array.isArray(o.material) ? o.material[0] : o.material, side = mt.side;
    tmpMesh.geometry = o.geometry; tmpMesh.material = mt; tmpMesh.matrixWorld.copy(n.m); tmpMesh.matrixAutoUpdate = false;
    mt.side = T3.DoubleSide;
    let back = 0;
    try {
      for (const d of dirs) {
        ray.set(c, d); ray.far = 60;
        const h = ray.intersectObject(tmpMesh, false)[0];
        if (h && h.face && h.face.normal.clone().transformDirection(n.m).dot(d) > 0) back++;
      }
      let at = null;
      for (const d of fwd) { ray.set(c, d); ray.far = 0.35 / Math.max(0.2, d.dot(fwd[0])) + 0.05; const h = ray.intersectObject(tmpMesh, false)[0]; if (h) { at = h; break; } }
      const name = o.name || (o.parent && o.parent.name) || o.geometry.type;
      if (back >= 5) bad.push(`camera inside a mesh (${name}${n.i != null ? " #" + n.i : ""})`);
      else if (at) bad.push(`a surface ${at.distance.toFixed(2)} m from the lens (${name})`);
    } finally { mt.side = side; }
  }
  // 2. the speakers: the line's speaker, when in the shot, has the whole head in the frame, clear of the boxes
  const vis = (a) => a.root.visible && a.root.parent && shown(a.root) && (!a.model || a.model.visible !== false) && !a.lodHidden;
  const headOf = (a) => { const b = (a.bone && (a.bone("Head") || a.bone("head"))) || null; return b ? b.getWorldPosition(new T3.Vector3()) : a.root.getWorldPosition(new T3.Vector3()).add(new T3.Vector3(0, 1.62, 0)); };
  const proj = (p) => { const v = p.clone().project(cam); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, z: v.z, front: v.z < 1 && p.clone().sub(c).dot(cam.getWorldDirection(new T3.Vector3())) > 0 }; };
  const boxes = [];
  for (const sel of ["#sSubs", "#sSay"]) { const e = document.querySelector(sel); if (e && !e.classList.contains("hidden")) { const r = e.getBoundingClientRect(); if (r.width && r.height) boxes.push([sel, r]); } }
  const lookWho = (() => { const shots = def.shots || []; let s = null; for (const x of shots) if (x.at <= S.cine.t + 1e-6) s = x; return s && s.look && s.look.who ? s.look.who : null; })();
  const lookId = lookWho ? ({ pick: CREW[S.ctx.crewPick] || "shades", hero: S.hero.body }[lookWho] || (def.cast && def.cast[lookWho] ? (typeof def.cast[lookWho] === "string" ? def.cast[lookWho] : def.cast[lookWho].id) : lookWho)) : null;
  info.speakers = [];
  for (const v of S.ui.voices || []) {
    if (!v || !v.text || /^\s*\(.*\)\s*$/.test(v.text)) continue;
    const idv = v.who === "pick" || v.who === "hero" ? CREW[S.ctx.crewPick] || "shades" : v.who;
    let a = null, bd = 40;
    for (const x of actors) { if (x.id !== idv || !vis(x)) continue; const d = x.root.getWorldPosition(new T3.Vector3()).distanceTo(c); if (d < bd) { bd = d; a = x; } }
    if (!a) continue;
    const hp = headOf(a), h = proj(hp), chest = proj(hp.clone().add(new T3.Vector3(0, -0.45, 0)));
    const dist = hp.distanceTo(c), rad = Math.atan(0.14 / dist) / (cam.fov * Math.PI / 360) / 2; // the head's radius in frame heights
    const radX = rad * H / W;
    const inFrame = (p) => p.front && p.x > 0 && p.x < 1 && p.y > bars && p.y < 1 - bars;
    const onIt = lookId === a.id;
    info.speakers.push({ id: a.id, x: +h.x.toFixed(2), y: +h.y.toFixed(2), r: +rad.toFixed(3), on: onIt });
    if (!inFrame(h) && !inFrame(chest) && !onIt) continue; // off screen: a voice over the shot
    if (!inFrame(h)) { bad.push(`${a.id}'s head is out of frame (${h.x.toFixed(2)}, ${h.y.toFixed(2)})`); continue; }
    if (dist < 6) {
      const cut = h.x - radX < 0 || h.x + radX > 1 || h.y - rad < bars - 0.005 || h.y + rad > 1 - bars + 0.005;
      if (cut) bad.push(`${a.id}'s head is cut off by the frame (${h.x.toFixed(2)}, ${h.y.toFixed(2)}, r ${rad.toFixed(2)})`);
    }
    for (const [sel, r] of boxes) {
      const px = h.x * W, py = h.y * H;
      if (px > r.left && px < r.right && py > r.top - rad * H * 0.5 && py < r.bottom) bad.push(`${a.id}'s face is under ${sel}`);
    }
  }
  // 3. the HUD and the touch controls
  const ok = new Set(["sSubs", "sSay", "sCard", "sSkip", "card", "bars", "sCards", "sFlash", "sFilm"]);
  const seen = [];
  const showing = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return false; } const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.right > 0 && r.bottom > 0 && r.left < W && r.top < H; };
  // (an element paints when it has its own text, a background, a border, or is a control or an image)
  const paints = (e) => { const cs = getComputedStyle(e); if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return true; if (e.matches("button, svg, img, canvas, i")) return true; if (cs.backgroundImage !== "none") return true; const bg = cs.backgroundColor.match(/[\d.]+/g); if (bg && (bg.length < 4 || +bg[3] > 0.05) && cs.backgroundColor !== "transparent") return true; return parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" || parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== "none"; };
  const story = document.getElementById("story");
  for (const e of story ? story.querySelectorAll("*") : []) {
    if (e.closest("#sSubs, #sSay, #sSkip, #sCard, .sCard")) continue;
    if (showing(e) && paints(e)) { const top = e.closest("#story > *"); seen.push((top && (top.id || top.className)) || e.id || e.className); }
  }
  for (const e of document.querySelectorAll("#hud > :not(#card), #hud > :not(#card) *, #touch, #touch *")) if (showing(e) && paints(e)) seen.push(e.closest("#touch") ? "#touch" : "#hud " + (e.closest("#hud > *").id || e.closest("#hud > *").className));
  if (seen.length) bad.push(`HUD showing: ${[...new Set(seen)].slice(0, 5).join(", ")}`);
  // 4. the bodies: none coarse, no capsule on screen
  const fr = new T3.Frustum().setFromProjectionMatrix(new T3.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  for (const a of actors) {
    if (!vis(a)) continue;
    const p = a.root.getWorldPosition(new T3.Vector3()).add(new T3.Vector3(0, 0.9, 0));
    if (!fr.intersectsSphere(new T3.Sphere(p, 1))) continue;
    const d = p.distanceTo(c);
    if (a.coarseOn) bad.push(`${a.id} is a coarse LOD body ${d.toFixed(1)} m from the camera`);
    if (!a.body && a.ph && d < 60) bad.push(`${a.id} is a placeholder capsule on screen`);
  }
  // the camera in a body: within 0.35 m of an actor's axis (feet to the top of the head)
  for (const a of actors) {
    if (!vis(a)) continue;
    const f = a.root.getWorldPosition(new T3.Vector3()), hd = headOf(a), top = hd.clone().add(new T3.Vector3(0, 0.18, 0));
    const seg = new T3.Line3(f, top), q = seg.closestPointToPoint(c, true, new T3.Vector3());
    const r = q.y > hd.y - 0.3 ? 0.2 : 0.3; // (the head is narrower than the shoulders)
    if (q.distanceTo(c) < r) bad.push(`camera inside ${a.id} (${q.distanceTo(c).toFixed(2)} m from the axis)`);
  }
  // 5. the render scale
  info.pr = S.renderer.getPixelRatio();
  const want = S.look && S.look.cinePR ? S.look.cinePR() : 0;
  if (want && info.pr < want - 0.01) bad.push(`render scale ${info.pr} below the cine's ${want}`);
  return { id, t: +S.cine.t.toFixed(2), bad, info };
};

// step the chapter on until the next wanted cine plays (steps before it passed over); returns its id or null
const DRIVE = (w) => {
  const S = __crimson.story.S, K = S.test.missions.K, m = K.current;
  window.__drv = window.__drv || { stepT: 0, idx: -1 };
  const D = window.__drv;
  if (S.cine.active) {
    const cur = S.cine.current;
    if (w.cines.includes(cur) && !w.done.includes(cur)) return true;
    S.cine.skip(); return false;
  }
  if (S.ui.modalOpen && S.ui.modalOpen() || S.modal) S.ui.advanceAll();
  if (!m) return false;
  const key = m.def.id + "#" + m.index;
  if (key !== D.key) { D.key = key; D.t = 0; }
  D.t += 1 / 60;
  const last = w.targets[m.def.id];
  const s = m.def.steps[m.index];
  if (last == null || m.index > last) { if (D.t > 0.1) K.skipReq = true; return false; } // (past its last cine: on to the next mission)
  if (m.index === last && s && s.type !== "script" && s.type !== "cine") { if (D.t > 0.1) K.skipReq = true; return false; }
  if (m.index === last) return false;
  if (!s) return false;
  // set the hero down where a movement step would take him, then pass it
  const to = s.to && (typeof s.to === "string" ? S.world.place(s.to) : s.to.x != null ? s.to : null);
  if (["goto", "drive", "escort", "stealth", "chase", "race", "tail"].includes(s.type) && to && S.hero.mode === "foot") S.hero.place(to.x, to.z);
  if (s.type === "script" || s.type === "cine") { if (D.t > 25) K.skipReq = true; return false; }
  if (D.t > 0.1) K.skipReq = true;
  return false;
};

/* ---------------- the run ---------------- */
const total = { frames: 0, bad: 0, cines: 0 };
for (const view of views) {
  const V = VIEWS[view];
  for (const ch of CHAPTERS) {
    const list = cinesOf(ch);
    if (!list.length) continue;
    const t0 = Date.now();
    const { browser, page, errors } = await open({ query: `?chapter=${ch}&seed=7&nomusic&god&q=${V.q}`, width: V.width, height: V.height, touch: V.touch, dpr: V.dpr });
    const r0 = await storyReady(page, { maxSec: 60 });
    if (!r0.ok) { check(false, `${view} ${ch}: the story is ready`); await browser.close(); continue; }
    const targets = {}; for (const e of list) targets[e.mission] = Math.max(targets[e.mission] ?? -1, e.index);
    const done = [];
    for (let n = 0; n < list.length; n++) {
      const w = { cines: list.map((e) => e.cine), done, targets };
      // (real time passes between chunks: bodies and textures load on real time)
      let got = null;
      for (let k = 0; k < 400 && !got; k++) {
        got = await page.evaluate(([src, w]) => { const f = (0, eval)("(" + src + ")"); for (let i = 0; i < 30; i++) { if (f(w)) return __crimson.story.S.cine.current; __crimson.step(1 / 60, false); } return null; }, [DRIVE.toString(), w]);
        if (!got) await page.waitForTimeout(20);
      }
      if (!got) { check(false, `${view} ${ch}: the cine ${list.filter((e) => !done.includes(e.cine)).map((e) => e.cine).join(", ")} plays`); break; }
      done.push(got);
      total.cines++;
      const def = C.CINES[got], times = timesOf(def), probs = new Map();
      let frames = 0;
      for (const at of times) {
        // step the cine's clock to the time (a held line or a film holds it: step on anyway)
        const ok = await page.evaluate(([t, id]) => { const S = __crimson.story.S; for (let i = 0; i < 60 * 60 && S.cine.active && S.cine.current === id && S.cine.t < t - 1e-4; i++) { if (S.modal) S.ui.advanceAll(); __crimson.step(1 / 60, false); } return S.cine.active && S.cine.current === id; }, [at.t, got]);
        if (!ok) break;
        await page.evaluate(() => __crimson.step(1 / 60, true));
        const p = await page.evaluate(([src, crew]) => (0, eval)("(" + src + ")")(crew), [PROBE.toString(), T.CREW_IDS]);
        frames++;
        for (const b of p.bad) { const key = b.replace(/[-\d.]+/g, "#"); if (!probs.has(key)) probs.set(key, { first: p.t, n: 0, text: b }); probs.get(key).n++; }
        if (SHOTS && at.shot != null) {
          const dir = `${SHOTS}/${view}`; mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${got}_s${at.shot}_${at.k}.png`, timeout: 240000 });
          if (p.bad.length) console.log(`     ${view} ${got} s${at.shot}.${at.k} t=${p.t}: ${p.bad.join("; ")}`);
        }
      }
      total.frames += frames;
      total.bad += probs.size;
      check(!probs.size, `${view} ${ch} ${got}: ${frames} frames${probs.size ? ": " + [...probs.values()].map((q) => `${q.text} (from ${q.first} s, ${q.n}x)`).join("; ") : " clean"}`);
      // on to the end of it
      await page.evaluate(() => { const S = __crimson.story.S; if (S.cine.active) S.cine.skip(); });
    }
    if (errors.length) errs.push(`${view} ${ch}: ${errors.slice(0, 3).join(" | ")}`);
    console.log(`     (${view} ${ch}: ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    await browser.close();
  }
}
console.log(`     ${total.cines} cines, ${total.frames} frames, ${total.bad} problems`);
await finish("cine", fails, null, errs);
