// Reel It In: the cutscenes. Short shots drawn live in the game's own scene, so each place keeps its own look, light and
// hour: the opening at Loon Lake, the fly-in at each new place, the first gold ring of a legend, a legend landed, and the
// finale after the fourth legend. No video files and no network.
// A script is a list of camera keys over time ({ t, pos, look, fov }), the sounds and moments on the way (a loon call, a
// legend's breach), and one caption. The player eases the camera through the keys (world.cutCamera), shows the bars, the
// caption and the Skip hint (cutscenes.css), and ends at once on a skip. With calm effects or reduced motion it shows
// still shots joined by fades, with no camera flight. main.js says when a cutscene plays and what comes after it.
// The scripts read only the place maps, so node can check them (qa/fish/cutscenes.test.mjs).
import { journeyOf, fmtKg } from "./journey.js";
import { fishingOf } from "./fishing.js";
import { byId, lengthFor } from "./species.js";
import { isCalm } from "./calm.js";

const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const v3 = (x, y, z) => ({ x, y, z });
// the cutscene ids the save keeps (save.js CUTS). The arrival at Loon Lake is the opening
export const arriveId = (id) => (id === "loon" ? "open" : "arrive." + id);
export const revealId = (id) => "reveal." + id;
export const landedId = (id) => "landed." + id;
// seconds of the fade between two still shots (and in and out of a calm cutscene, or of one that ends through black)
const FADE = 0.4;

/* ---------------- the camera path ---------------- */
// A smooth path through values at their times: a cubic between each pair of keys, with the speed at a key set by its
// neighbours. The first key keeps moving in (rest: it starts from still), the last one comes to rest
function path(ts, vs, t, rest0) {
  const n = ts.length;
  if (n === 1 || t <= ts[0]) return vs[0];
  if (t >= ts[n - 1]) return vs[n - 1];
  let i = 0;
  while (i < n - 2 && t > ts[i + 1]) i++;
  const m = (k) => (k === n - 1 || (k === 0 && rest0) ? 0 : k === 0 ? (vs[1] - vs[0]) / (ts[1] - ts[0]) : (vs[k + 1] - vs[k - 1]) / (ts[k + 1] - ts[k - 1]));
  const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * h * m(i) + (3 * s2 - 2 * s3) * vs[i + 1] + (s3 - s2) * h * m(i + 1);
}
const path3 = (ts, ps, t, rest0) => v3(path(ts, ps.map((p) => p.x), t, rest0), path(ts, ps.map((p) => p.y), t, rest0), path(ts, ps.map((p) => p.z), t, rest0));
const val = (v, c) => (typeof v === "function" ? v(c) : v);
// The camera at time t: { pos, look, fov }. c: what the world tells the camera each frame (see world.cutCamera) and what
// the player read at the start: { cast: { pos, pitch, fov }, aspect, start: the camera when the cutscene began, loon }
export function poseAt(script, t, c) {
  const K = script.keys, ts = K.map((k) => k.t), rest0 = !!K[0].rest;
  return { pos: path3(ts, K.map((k) => val(k.pos, c)), t, rest0), look: path3(ts, K.map((k) => val(k.look, c)), t, rest0), fov: path(ts, K.map((k) => val(k.fov, c)), t, rest0) };
}
// a key's own pose, for a still shot
const keyPose = (k, c) => ({ pos: val(k.pos, c), look: val(k.look, c), fov: val(k.fov, c) });
// the cast view: from the eye, straight out over the water, as the cast starts
const castLook = (c) => v3(c.cast.pos.x, c.cast.pos.y + Math.tan(c.cast.pitch) * 40, c.cast.pos.z - 40);
const castKey = (t) => ({ t, pos: (c) => c.cast.pos, look: castLook, fov: (c) => c.cast.fov });
// the vertical field of view that shows w meters across at d meters, inside lo..hi
const fovFor = (w, d, aspect, lo = 26, hi = 70) => clamp(2 * Math.atan(w / 2 / d / Math.max(0.3, aspect)) / DEG, lo, hi);

/* ---------------- the scripts ---------------- */
// The opening: the first "Go fishing" on a fresh save. Loon Lake at dawn: the camera glides in low over the water, past
// the loon, and settles on the dock in the cast view. The path is laid out from where the loon swims when it starts
// (the middle of its loop if it is under water)
export function opening(place) {
  const L = (c) => c.loon || v3(12, 0, -44), eye = place.stand.eye;
  return {
    id: arriveId("loon"), kind: "arrive", place: place.id, len: 8,
    keys: [
      { t: 0, pos: (c) => v3(L(c).x - 16, 3.2, L(c).z - 34), look: (c) => v3(L(c).x, 0.4, L(c).z), fov: (c) => c.cast.fov + 6 },
      { t: 3.2, pos: (c) => v3(L(c).x - 5, 1.5, L(c).z - 1), look: (c) => v3(L(c).x, 0.3, L(c).z), fov: (c) => c.cast.fov + 2 },
      { t: 5.6, pos: v3(eye.x - 2.5, eye.y + 0.5, eye.z - 16), look: (c) => v3(L(c).x, 0.3, L(c).z), fov: (c) => c.cast.fov + 2 },
      castKey(8),
    ],
    stills: [{ key: 1, to: 4 }, { key: 3 }],
    caption: { title: "Loon Lake", line: "The fish are rising.", at: 1 },
    cues: [{ t: 0.1, sfx: "swell", v: 0 }, { t: 2.6, sfx: "loonWail" }],
  };
}

// The fly-in at a new place, at its free-fishing hour, before the arrival card. Each ends on the stand in the cast view
const FLY = {
  // the dead trees at dusk: back along the drowned road, between the stumps, with the sunset on the left
  stumps: { len: 6.4, caption: "The sun sets over the dead trees.", keys: [
    { t: 0, pos: v3(6, 2.4, -50), look: v3(-36, 4, -78), fov: 8 },
    { t: 3, pos: v3(2, 1.7, -24), look: v3(-14, 2.5, -60), fov: 4 },
  ] },
  // the river at dawn: down the current from the pool to the logjam, then onto the gravel bar
  river: { len: 6.4, caption: "The river runs fast at dawn.", keys: [
    { t: 0, pos: v3(20, 3.5, -34), look: v3(-36, 0.3, -14), fov: 6 },
    { t: 3, pos: v3(-14, 1.8, -10), look: v3(-38, 0.2, -14), fov: 2 },
  ] },
  // the sea wall and the open sea: high over the wall, then down along it to its end
  sea: { len: 6.6, caption: "The open sea, from the end of the wall.", keys: [
    { t: 0, pos: v3(-4, 17, 72), look: v3(4, 0, -80), fov: 4 },
    { t: 3.3, pos: v3(-5, 8, 22), look: v3(8, 0, -60), fov: 2 },
  ] },
};
export function arrival(place) {
  if (place.id === "loon") return opening(place);
  const F = FLY[place.id] || FLY.stumps;
  return {
    id: arriveId(place.id), kind: "arrive", place: place.id, len: F.len,
    keys: [...F.keys.map((k) => ({ ...k, fov: (c) => c.cast.fov + k.fov })), castKey(F.len)],
    stills: [{ key: 0, to: F.len * 0.5 }, { key: 2 }],
    caption: { title: journeyOf(place.id).name, line: F.caption, at: 0.8 },
    cues: [{ t: 0.1, sfx: "swell", v: 0 }],
  };
}

// The point d m short of `to` on the line from `from`, at height y, moved aside until the line to it clears every stump
// taller than y (Stump Bay; the other places have none)
function clearOf(place, from, to, d, y) {
  const posts = (place.props && place.props.stumps || []).filter((s) => s.top > y - 0.5);
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
  const near = (px, pz) => posts.some((s) => {
    const k = clamp(((s.x - from.x) * (px - from.x) + (s.z - from.z) * (pz - from.z)) / Math.max(1e-6, (px - from.x) ** 2 + (pz - from.z) ** 2), 0, 1);
    return Math.hypot(from.x + (px - from.x) * k - s.x, from.z + (pz - from.z) * k - s.z) < s.r + 1.2;
  });
  for (const side of [0, 3, -3, 6, -6]) {
    const px = to.x - ux * d - uz * side, pz = to.z - uz * d + ux * side;
    if (!near(px, pz)) return v3(px, y, pz);
  }
  return v3(to.x - ux * d, y, to.z - uz * d);
}
// The first gold ring of a legend, outside a fight: the camera pushes toward the ring, the legend breaches once, and its
// name shows. Play goes on from the same cast state. ring: { x, z } on the water
export function reveal(place, ring) {
  const sp = byId(fishingOf(place.id).legend.id), eye = place.stand.eye;
  // the fish, and how high its leap goes (world.js draws the arc: 0.35 m and 0.9 of its length). A big one is seen from
  // farther, and the view is tall enough for the whole leap
  const len = lengthFor(sp, (sp.kg[0] + sp.kg[1]) / 2) / 100, arc = 0.35 + len * 0.9, d = Math.max(10, len * 6);
  const near = clearOf(place, eye, ring, d, 1.6), close = clearOf(place, eye, ring, d - 1.5, 1.5);
  const fov = (w, at) => (c) => Math.max(fovFor(w, at, c.aspect), Math.min(70, 2 * Math.atan((arc + len * 1.4) * 0.72 / at) / DEG));
  // seen side on: the fish swims across the view
  const heading = Math.atan2(ring.x - near.x, -(ring.z - near.z)) + Math.PI / 2;
  const look = (y) => v3(ring.x, y, ring.z);
  const BREACH = 2.8, AIR = 1.4;
  return {
    id: revealId(place.id), kind: "reveal", place: place.id, len: 6, fade: true, ring: { x: ring.x, z: ring.z },
    keys: [
      { t: 0, rest: true, pos: (c) => c.start.pos, look: (c) => c.start.look, fov: (c) => c.start.fov },
      { t: 2.6, pos: near, look: look(arc * 0.6), fov: fov(8, d) },
      { t: 6, pos: close, look: look(arc * 0.7), fov: fov(7, d - 1.5) },
    ],
    stills: [{ key: 1 }],
    caption: { title: sp.name, line: "The legend of " + journeyOf(place.id).name + ".", at: 3.1 },
    cues: [{ t: 0, sfx: "swell", v: 1 }, { t: BREACH, sfx: "jump", v: 1 }],
    events: [
      { t: 0.2, run: (k, c) => c.world.rise(ring.x, ring.z) },
      { t: 1.6, run: (k, c) => c.world.rise(ring.x, ring.z) },
      // the breach: out of the ring nose first, over, and back in (world.js draws the arc and the splashes)
      { t: BREACH, dur: AIR, run: (k, c) => c.world.setFish(k < 1 ? { id: sp.id, x: ring.x, y: 0, z: ring.z, heading, len, jump: Math.max(0.001, k), thrash: 0.6, roll: 0, near: 1 } : null) },
    ],
    done: (c) => c.world.setFish(null),
  };
}

// A legend landed: the hero shot. The catch view and its photo push (world.js), the name and the weight, before the
// catch card. The game's own camera: no keys
export function landed(place, fish) {
  const sp = byId(fish.id);
  return { id: landedId(place.id), kind: "landed", place: place.id, len: 4.6, keys: null, caption: { title: sp ? sp.name : fish.name || "", line: fmtKg(fish.kg), at: 0.5 } };
}

// After the fourth legend: a slow pull back over the place, at its hour
export function finale(place) {
  const eye = place.stand.eye, out = v3(eye.x, 1, eye.z - 60);
  return {
    id: "finale", kind: "finale", place: place.id, len: 6.5, fade: true,
    keys: [
      { t: 0, rest: true, pos: (c) => c.start.pos, look: (c) => c.start.look, fov: (c) => c.start.fov },
      { t: 1.3, pos: v3(eye.x, eye.y + 0.4, eye.z + 1), look: out, fov: (c) => c.cast.fov + 6 },
      { t: 6.5, pos: v3(eye.x, eye.y + 18, eye.z + 16), look: v3(eye.x, 0, eye.z - 60), fov: (c) => c.cast.fov + 4 },
    ],
    stills: [{ key: 1, to: 3.2 }, { key: 2 }],
    caption: { title: "You fished them all.", line: "Every legend is in your journal.", at: 1.4 },
    cues: [{ t: 0.1, sfx: "swell", v: 2 }],
  };
}

// Where a legend's ring rises, for a replay on the Places card: the middle of its ring distance, in its own kind of water,
// as near to straight out as the map allows
export function ringSpot(place) {
  const L = fishingOf(place.id).legend, d = (L.ring[0] + L.ring[1]) / 2;
  for (let i = 0; i <= 28; i++) {
    const a = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 5 * DEG, x = Math.sin(a) * d, z = -Math.cos(a) * d, zn = place.zone(x, z);
    if (zn !== "land" && place.depth(x, z) >= 0.6 && (!L.zone || zn === L.zone)) return { x, z };
  }
  return { x: 0, z: -d };
}

/* ---------------- the player ---------------- */
// createCutscenes({ world, root: #game, sound: Sound, touch }): one player for the game.
//   play(script, then): starts it; then(skipped) runs when it ends (on its own, or at once on a skip)
//   skip(): ends the one playing now; update(dt): moves it on (main.js step() calls it, and holds the rest of the game)
//   playing: a cutscene is on; id: its id ("" when none); calm: the one playing is the still version
// While one plays, #game has data-cut (cutscenes.css hides the HUD, the prompts and the toasts), the world hides the rod,
// and the keys go to the skip: Space, Escape or Enter skips, the rest do nothing in the game. A press anywhere skips too.
export function createCutscenes({ world, root, sound = null, touch = false }) {
  const el = document.createElement("div"), fade = document.createElement("div");
  el.id = "cut"; el.hidden = true; el.setAttribute("data-nopin", "");
  el.innerHTML = "<div class='bar top'></div><div class='bar bot'></div><div class='cap' role='status'><b></b><span></span></div><div class='skip'></div>";
  fade.id = "cutFade"; fade.hidden = true;
  root.append(el, fade);
  const cap = el.querySelector(".cap"), skipHint = el.querySelector(".skip");
  skipHint.textContent = touch ? "Tap to skip" : "Press Space to skip";
  let P = null, eatT = 0, liftT = 0;

  // the press that skips must not go on to the screen under it: the overlay stays (unseen) until the finger lifts
  const eat = (e) => { e.preventDefault(); e.stopPropagation(); };
  const uneat = () => { clearTimeout(eatT); if (!P) { el.hidden = true; el.classList.remove("gone"); } };
  el.addEventListener("pointerdown", (e) => {
    eat(e);
    if (!P) return;
    finish(true);
    // (unless what came after it is another cutscene, which takes the press itself)
    if (!P) { el.classList.add("gone"); el.hidden = false; eatT = setTimeout(uneat, 800); }
  });
  // (a finger's click comes after it lifts, on what is under it then: the overlay waits for it, or a moment)
  for (const t of ["pointerup", "pointercancel"]) el.addEventListener(t, (e) => { eat(e); clearTimeout(eatT); eatT = setTimeout(uneat, 350); });
  el.addEventListener("click", (e) => { eat(e); uneat(); });
  el.addEventListener("contextmenu", eat);
  // (the game never sees a key meanwhile; the browser keeps its own, like a reload)
  addEventListener("keydown", (e) => {
    if (!P) return;
    e.stopImmediatePropagation();
    if (e.code !== "Space" && e.code !== "Escape" && e.code !== "Enter") return;
    e.preventDefault();
    if (!e.repeat) finish(true);
  }, true);

  // the camera: the pose at the player's time, or the still shot under it (world.js calls this every frame)
  function camera(dt, info) {
    if (!P) return null;
    const c = P.c;
    c.cast = info.cast; c.aspect = info.aspect;
    // the loon is read once, on the first frame, so the path it lays out holds still
    if (!c.loonRead) { c.loon = info.loon ? v3(info.loon.x, 0, info.loon.z) : null; c.loonRead = true; }
    if (!P.calm) return poseAt(P.s, P.t, c);
    const st = P.s.stills, i = Math.max(0, st.findIndex((s) => s.to == null || P.t < s.to));
    return keyPose(P.s.keys[st[i].key], c);
  }
  // how dark the fade is at time t: into a calm cutscene and between its still shots, and out at the end of a calm one or
  // one that ends through black
  function fadeAt(p, t) {
    const s = p.s, near = (at) => 1 - clamp(Math.abs(t - at) / FADE, 0, 1);
    let k = 0;
    if (p.calm && s.keys) { k = Math.max(k, near(0)); for (const st of s.stills) if (st.to != null) k = Math.max(k, near(st.to)); }
    if ((p.calm && s.keys) || s.fade) k = Math.max(k, 1 - clamp((s.len - t) / FADE, 0, 1));
    return k;
  }
  // the moment events between t0 and t1 (a moment with a length runs every frame while it lasts, and once with k = 1)
  function events(p, t0, t1) {
    for (const q of p.s.cues || []) if (q.t > t0 && q.t <= t1 && sound) sound.sfx(q.sfx, q.v);
    for (const ev of p.s.events || []) {
      if (!ev.dur) { if (ev.t > t0 && ev.t <= t1) ev.run(1, p.c); continue; }
      if (p.closed.has(ev) || t1 < ev.t) continue;
      const k = clamp((t1 - ev.t) / ev.dur, 0, 1);
      ev.run(k, p.c);
      if (k >= 1) p.closed.add(ev);
    }
  }
  function show(p) {
    const s = p.s, t = p.t, C = s.caption;
    cap.classList.toggle("on", !!C && t >= C.at && t < s.len - 0.2);
    skipHint.classList.toggle("on", t >= 0.5);
    const k = fadeAt(p, t);
    fade.hidden = k <= 0;
    fade.style.opacity = String(k);
  }

  function play(script, then) {
    if (P) finish(true);
    clearTimeout(eatT); clearTimeout(liftT);
    const calm = isCalm(), cam = world.camera, yaw = -cam.rotation.y, pitch = cam.rotation.x;
    const pos = v3(cam.position.x, cam.position.y, cam.position.z);
    const start = { pos, look: v3(pos.x + Math.sin(yaw) * Math.cos(pitch) * 30, pos.y + Math.sin(pitch) * 30, pos.z - Math.cos(yaw) * Math.cos(pitch) * 30), fov: cam.fov };
    P = { s: script, t: 0, calm, then, closed: new Set(), c: { world, start, cast: null, aspect: 1, loon: null } };
    const C = script.caption;
    cap.querySelector("b").textContent = C ? C.title : "";
    cap.querySelector("span").textContent = C ? C.line : "";
    cap.classList.remove("on"); skipHint.classList.remove("on");
    el.classList.remove("gone");
    el.hidden = false;
    fade.style.transition = "none";
    root.dataset.cut = script.kind || "on";
    if (script.keys) world.cutCamera(camera);
    events(P, -1, 0);
    show(P);
  }
  function update(dt) {
    const p = P;
    if (!p) return;
    const t0 = p.t;
    p.t = Math.min(p.s.len, p.t + Math.max(0, dt));
    events(p, t0, p.t);
    if (P !== p) return;
    show(p);
    if (p.t >= p.s.len) finish(false);
  }
  function finish(skipped) {
    const p = P;
    if (!p) return;
    P = null;
    // every moment ends as it would have (a breach that was cut short leaves no fish in the air)
    for (const ev of p.s.events || []) if (ev.dur && !p.closed.has(ev) && p.t >= ev.t) ev.run(1, p.c);
    if (p.s.done) p.s.done(p.c);
    world.cutCamera(null);
    delete root.dataset.cut;
    cap.classList.remove("on"); skipHint.classList.remove("on");
    el.hidden = true;
    // a dark fade lifts over the game as it comes back (the game's camera eases home under it)
    const k = Number(fade.style.opacity) || 0;
    if (k > 0) {
      fade.hidden = false;
      void fade.offsetWidth;
      fade.style.transition = "opacity " + FADE + "s ease-out";
      fade.style.opacity = "0";
      liftT = setTimeout(() => { if (!P) fade.hidden = true; }, FADE * 1000 + 50);
    } else fade.hidden = true;
    p.then(skipped);
  }
  return {
    play, update, skip: () => finish(true),
    get playing() { return !!P; },
    get id() { return P ? P.s.id : ""; },
    get calm() { return !!(P && P.calm); },
    // for the tests: where the cutscene is (s), how long it is, and the camera it holds
    get state() { return P ? { id: P.s.id, kind: P.s.kind, t: P.t, len: P.s.len, calm: P.calm, fade: fadeAt(P, P.t) } : null; },
  };
}
