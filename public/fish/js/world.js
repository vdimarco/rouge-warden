// Reel It In: the 3D world. One canvas with the sky, the place you fish (Loon Lake, Stump Bay, Cedar River or Gull Rock),
// the stand under your feet, the rod in your hands, the line, the lure, the fish and the trophy. Everything is built in
// code (see world-env, world-look, world-gear, world-fish, world-fx). world.setPlace(place) changes the place.
import * as THREE from "three";
import { artStyle, normalizeStyle } from "./art-style.js";
import { PLACES, getPlace } from "./places.js";
import { placeSpecies } from "./fishing.js";
import { byId, lengthFor, showScale } from "./species.js";
import * as E from "./world-env.js";
import { lookOf } from "./world-look.js";
import { isCalm } from "./calm.js";
import { Rod, Line, Lure } from "./world-gear.js";
import { loadCartoonModels } from "./cartoon-models.js";
import { loadPaintedForest } from "./painted-forest.js";
import * as Fish from "./world-fish.js";
import { fishMesh as makeFish, JUNK_LEN } from "./world-fish.js";
import { Spray, followerShadow, fireflies as makeFireflies, Gulls, boardMesh, BOARD_LENGTHS } from "./world-fx.js";
import { createRenderScale } from "./render-scale.js";

export { fishMesh } from "./world-fish.js";

const { U, clamp, lerp, smooth } = E;
const DEG = Math.PI / 180;
// Colours are authored as they should look on screen, and lit in that space (a painted look, not a photo).
THREE.ColorManagement.enabled = false;

// Tunables
export const WORLD = {
  DPR: { high: 2, low: 1.25 },
  FOV_H: { title: 78, cast: 72, flight: 72, reel: 88, catch: 60 },  // horizontal field of view to aim for, degrees
  FOV_V_PORTRAIT: [58, 90],        // the vertical field of view is kept inside these on tall screens
  FOV_V_WIDE: [42, 62],            // and inside these on wide screens
  PITCH_CAST: { wide: -5, portrait: -11 },
  ZOOM_WIDTH: 42,                  // flight view: meters of lake across the view at the lure, once the lure is far
  GRIP: { d: 0.9, x: 0.5, y: -0.4, pd: 0.9, px: 0.5, py: -0.4 },  // room below the grip for a pull-back gesture
  LURE_MIN_SCREEN: 0.022,          // the lure is drawn at least this fraction of the view height
  PHOTO: { push: 1.2, from: 1.35, freeze: 0.3 },   // the photo beat of a big catch: seconds of slow push-in, its start distance (x), seconds the fish holds still after
  // the big moments of the reel (main.js calls them; Calm effects and reduced motion skip the camera parts):
  PUNCH: { k: 0.08, hold: 120, back: 250 },   // the hook set: the view narrows by k at once, holds (ms), then eases back (ms)
  // a leap: meters of lake across the view at the fish, s it stays after, ease rates in and out; at: how far down the view
  // the leap sits (a part of its height), free: the top part the HUD and the prompt take on any layout, kept clear of it
  JUMP_ZOOM: { width: 10, after: 0.4, in: 6, out: 2, at: 0.64, free: 0.5 },
  KICK_DECAY: 14,                  // the rod tip's twitch (a nibble, the strike, the hook set) dies away at this rate (1/s)
  SPLASH_FAR: [12, 4, 15, 3],      // a splash grows from 12 m out, up to 4x; its ring from 15 m, up to 3x
};

/* ---------------- the hours ---------------- */
// The keyframes of the day are in world-look.js (each place has its own).
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function lerpHex(out, a, b, t) { tmpA.set(a); tmpB.set(b); return out.copy(tmpA).lerp(tmpB, t); }
// Sun path: rises in the north-east, high in the south at noon, sets in the north-west (a summer day, a little
// stretched so the evening sun hangs over the far west shore where the angler can see it). A place may turn it.
export function sunAt(h, look = null) {
  const elev = 58 * Math.sin(Math.PI * (h - 5.8) / 15) * DEG;
  const az = (clamp(180 + (h - 12.8) * 18.5, 40, 332) + (look && look.sunTurn || 0)) * DEG;  // from north (-z), clockwise toward east (+x)
  return new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev));
}

/* ---------------- the world ---------------- */

export async function createWorld(container, { quality = "high", place = PLACES.loon, style = "painted" } = {}) {
  await Promise.all([loadCartoonModels(), loadPaintedForest(), E.loadPaintedWater()]);
  let currentStyle = normalizeStyle(style);
  artStyle.value = currentStyle === "painted" ? 1 : 0;
  let low = quality === "low";
  let PL = typeof place === "string" ? getPlace(place) : place, LK = lookOf(PL);   // the place we are at, and how it looks
  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  // shader error checks are synchronous GL calls on each program's first draw: only in ?debug
  renderer.debug.checkShaderErrors = /[?&]debug\b/.test(location.search);
  // dynamic resolution: when frames run long for a while the render scale steps down, and when they are fast again it
  // steps back up (render-scale.js)
  const res = createRenderScale();
  const ratio = () => Math.max(0.6, Math.min(window.devicePixelRatio || 1, low ? WORLD.DPR.low : WORLD.DPR.high) * res.scale);
  renderer.setPixelRatio(ratio());
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcccccc, 120, 900);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.08, 1400);
  camera.rotation.order = "YXZ";
  const hemi = new THREE.HemisphereLight(0xbcd8f4, 0x5e6e3a, 1.2);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, sun, sun.target);

  /* the place: the sky and water are built once; the ground and its trees (they depend on the quality) are rebuilt when it
     changes, and everything else when the place changes */
  const sky = E.buildSky(low);
  const { water, u: WU } = E.buildWater(low, PL, LK);
  scene.add(sky, water);
  // an InstancedMesh frees its instance buffers only on its own dispose
  function dispose(root) {
    root.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (m.map) m.map.dispose(); m.dispose(); }
    });
  }
  let envGroup = null, treeGroup = null, propGroup = null, loon = null, flies = null, gulls = null;
  function buildEnv() {
    if (envGroup) { scene.remove(envGroup); dispose(envGroup); }
    envGroup = new THREE.Group();
    treeGroup = E.buildTrees(low, PL, LK, currentStyle);
    envGroup.add(new THREE.Mesh(E.buildTerrain(low, PL, LK), E.terrainMaterial(low)), treeGroup);
    if (PL.props.lilies.length) envGroup.add(E.buildPads(low, PL, LK));
    if (PL.props.reeds.length) envGroup.add(E.buildReeds(low, PL, LK));
    scene.add(envGroup);
  }
  // rocks, the stand, the cottage and the loon, or a road, a wall, a logjam: they do not change with the quality
  function buildProps() {
    for (const o of [propGroup, flies, gulls && gulls.mesh]) if (o) { scene.remove(o); dispose(o); }
    flies = gulls = null;
    const b = E.buildProps(PL, LK);
    propGroup = b.group; loon = b.loon;
    scene.add(propGroup);
    if (LK.props.includes("fireflies")) { flies = makeFireflies(PL); scene.add(flies); }
    if (LK.props.includes("gulls")) { gulls = new Gulls(); scene.add(gulls.mesh); }
  }
  buildEnv();
  buildProps();

  /* tackle and fish */
  const rod = new Rod(low), line = new Line(), lure = new Lure();
  scene.add(rod.mesh, line.mesh, lure.group, lure.glint);
  const spray = new Spray(low ? 160 : 320);
  const shadow = followerShadow();
  scene.add(spray.points, shadow);
  const fishCache = new Map();
  // a soft golden glow over a gold ring, so it shows from the dock even 50 m out
  const haloTex = (() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const x = cv.getContext("2d"), r = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,236,170,1)"); r.addColorStop(0.3, "rgba(255,200,90,0.55)"); r.addColorStop(1, "rgba(255,170,40,0)");
    x.fillStyle = r; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const halos = Array.from({ length: E.RINGS }, () => {
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    h.visible = false; h.renderOrder = 16; scene.add(h);
    return h;
  });

  /* state */
  const S = {
    clock: 0, hour: 12, w: 1, h: 1,
    view: { mode: "title", yaw: 0, look: null, portrait: false },
    cam: { pos: new THREE.Vector3(0, 9, 30), yaw: 0, pitch: -0.1, fov: 55, init: false },
    rod: { theta: 60, yaw: 0, steer: 0, bend: 0, pull: null, visible: false },
    tip: new THREE.Vector3(),
    lastTip: new THREE.Vector3(),
    line: { from: null, to: null, slack: 0, visible: false, flying: false },
    lure: { x: 0, y: 1, z: -1, visible: false, spin: 0, vel: new THREE.Vector3(), prev: null, prevT: 0 },
    fish: null, jumpWas: 0, jumpSplashed: false,
    follower: null, followA: 0,
    rings: [], aim: { yaw: 0, visible: false, a: 0 },
    rip: 0,
    loon: { t: 40 },
    trophy: null,
    fps: 60, lastRender: 0, info: { calls: 0, tris: 0 },
    // the big moments: the punch's start (ms), no update until (ms), the jump zoom (0..1) and how long it holds (clock s),
    // the rod tip's twitch (0..1) and how long it holds at full (clock s)
    punchAt: -1e9, freezeUntil: 0, zoomK: 0, zoomHold: 0, kick: 0, kickHold: 0,
  };

  /* ---------------- hours ---------------- */
  const moonDir = new THREE.Vector3(), mistCol = new THREE.Color();
  function setHour(h) {
    const rows = LK.hours;
    h = clamp(h, rows[0].h, rows[rows.length - 1].h);
    S.hour = h;
    let i = 0;
    while (i < rows.length - 2 && rows[i + 1].h < h) i++;
    const a = rows[i], b = rows[i + 1], t = clamp((h - a.h) / (b.h - a.h), 0, 1);
    const num = (k) => lerp(a[k], b[k], t);
    lerpHex(U.uZenith.value, a.zen, b.zen, t);
    lerpHex(U.uHorizon.value, a.hor, b.hor, t);
    lerpHex(U.uGlow.value, a.glow, b.glow, t);
    lerpHex(U.uSunCol.value, a.sun, b.sun, t);
    lerpHex(U.uFogCol.value, a.fog, b.fog, t);
    lerpHex(U.uCloudLit.value, a.cl, b.cl, t);
    lerpHex(U.uCloudShade.value, a.cs, b.cs, t);
    lerpHex(U.uForest.value, a.forest, b.forest, t);
    lerpHex(U.uDeep.value, a.deep, b.deep, t);
    lerpHex(U.uShallow.value, a.shal, b.shal, t);
    U.uNight.value = num("night");
    let near = num("near"), far = num("far");
    // a place may have its own fog at some hours (a morning mist)
    const F = LK.fog && LK.fog(h, { near, far });
    if (F) { near = F.near; far = F.far; if (F.k > 0) U.uFogCol.value.lerp(mistCol.set(F.col), F.k); }
    if (artStyle.value) {
      // Apply from this hour's base palette each time, so repeated toggles cannot drift.
      const daylight = 1 - U.uNight.value;
      U.uZenith.value.lerp(mistCol.set(0x70bed0), 0.42 * daylight);
      U.uHorizon.value.lerp(mistCol.set(0xf5e5b8), 0.32 * daylight);
      U.uCloudLit.value.lerp(mistCol.set(0xfff2cb), 0.45 * daylight);
      U.uCloudShade.value.lerp(mistCol.set(0x97b6b8), 0.35 * daylight);
      U.uFogCol.value.lerp(mistCol.set(0xa6c9b6), 0.3 * daylight);
      U.uDeep.value.lerp(mistCol.set(0x3e9293), 0.78 * daylight);
      U.uShallow.value.lerp(mistCol.set(0x8cbd9f), 0.72 * daylight);
      U.uForest.value.lerp(mistCol.set(0x48765a), 0.35 * daylight);
    }
    U.uFogNear.value = near; U.uFogFar.value = far;
    scene.fog.color.copy(U.uFogCol.value); scene.fog.near = U.uFogNear.value; scene.fog.far = U.uFogFar.value;
    const sd = sunAt(h, LK);
    let si = num("si"), moonW = 0;
    // at night a moon takes the sun's place: same light, same glitter on the water, a colder colour
    const M = LK.moon;
    if (M) {
      moonW = smooth(M.from, M.from + M.fade, h);
      if (moonW > 0) {
        const az = M.az * DEG, el = M.el * DEG;
        moonDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
        sd.lerp(moonDir, moonW).normalize();
        U.uSunCol.value.lerp(mistCol.set(M.col), moonW);
        si = lerp(si, M.si, moonW);
      }
    }
    U.uMoon.value = moonW;
    U.uSunDir.value.copy(sd);
    // the sun light fades as it nears the horizon; below it, only the sky lights the world
    const vis = smooth(-0.04, 0.08, sd.y);
    U.uSunVis.value = vis;
    sun.position.copy(sd).multiplyScalar(100);
    sun.color.copy(U.uSunCol.value);
    sun.intensity = si * vis;
    lerpHex(hemi.color, a.sky, b.sky, t);
    lerpHex(hemi.groundColor, a.gnd, b.gnd, t);
    hemi.intensity = num("hi");
    if (artStyle.value) {
      hemi.color.lerp(mistCol.set(0xffe9bf), 0.25 * (1 - U.uNight.value));
      hemi.intensity *= 1.15;
      sun.intensity *= 0.86;
    }
    // foam and the line catch the light of the hour
    U.uFoam.value.copy(U.uHorizon.value).lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(0.55 + 0.45 * vis);
    line.mat.color.setRGB(0.95, 0.94, 0.78).multiplyScalar(0.45 + 0.55 * Math.max(vis, 0.3));
    spray.u.uCol.value.copy(U.uFoam.value).multiplyScalar(1.3);
    for (const g of fishCache.values()) g.userData.fx.uWater.value.copy(U.uDeep.value);
    lure.fx.uWater.value.copy(U.uDeep.value);
  }

  /* ---------------- camera ---------------- */
  // the eye of this place, and where the catch camera hangs (a little below the eye)
  const EYEV = new THREE.Vector3(), CATCH_CAM = new THREE.Vector3(0.12, 2.05, 1.05);
  function applyStand() {
    const e = PL.stand.eye, R = PL.stand.rod;
    EYEV.set(e.x, e.y, e.z);
    CATCH_CAM.set(0.12, e.y - 0.2, 1.05);
    S.tip.set(R.base.x, R.base.y + R.length, R.base.z);
  }
  applyStand();
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  // tall: the layout to fit (the cast view of a cutscene's last key); the view's own when not given
  function baseFov(mode, tall) {
    const aspect = S.w / S.h, portrait = tall ?? (S.view.portrait || aspect < 0.9);
    const hf = (WORLD.FOV_H[mode] || 70) * DEG;
    const v = 2 * Math.atan(Math.tan(hf / 2) / aspect) / DEG;
    const [lo, hi] = portrait ? WORLD.FOV_V_PORTRAIT : WORLD.FOV_V_WIDE;
    return clamp(v, lo, hi);
  }
  const CATCH_PITCH = -36 * DEG, CATCH_YAW = -3 * DEG;
  const trophySpot = () => {
    // the fish is held out toward the end of the stand, below the eye (a big one is held out flatter, so it stays above the water)
    const T = S.trophy, d = T ? T.dist * T.push : 1.1, p = T ? T.pitch : CATCH_PITCH;
    return new THREE.Vector3(Math.sin(CATCH_YAW) * Math.cos(p), Math.sin(p), -Math.cos(CATCH_YAW) * Math.cos(p)).multiplyScalar(d).add(CATCH_CAM);
  };
  // The photo beat runs on the wall clock (s since the fish showed), as main.js times the flash and the card by it. The
  // lake's own clock moves at most 50 ms a frame, so on slow frames it falls behind them
  const beatT = (T) => (performance.now() - T.at) / 1000;
  // the share of the way to the photo's pose the camera goes this frame, during the push-in (null after it, or with no
  // beat): the rest of the push-in's curve, so the camera is there when the push-in ends and the flash comes, from
  // wherever the fight left it (a leap's zoom looks up at the sky) and however slow the frames are
  function photoStep() {
    const T = S.trophy, P = WORLD.PHOTO.push;
    if (!T || !T.beat || S.view.mode !== "catch" || T.camT >= P) return null;
    const e = beatT(T), left = (t) => Math.pow(1 - clamp(t / P, 0, 1), 3), k = 1 - left(e) / left(T.camT);
    T.camT = e;
    return k;
  }
  function camTarget() {
    const m = S.view.mode, portrait = S.view.portrait || S.w / S.h < 0.9;
    const out = { pos: EYEV.clone(), yaw: (S.view.yaw || 0) * DEG, pitch: (portrait ? WORLD.PITCH_CAST.portrait : WORLD.PITCH_CAST.wide) * DEG, fov: baseFov(m), rate: 4, posRate: 2.2 };
    const lookAt = (p, drop = 0) => {
      const dx = p.x - out.pos.x, dz = p.z - out.pos.z, dh = Math.hypot(dx, dz);
      out.yaw = Math.atan2(dx, -dz);
      out.pitch = Math.atan2(p.y - out.pos.y, Math.max(dh, 0.01)) - drop;
      return dh;
    };
    if (m === "title") {
      const t = S.clock, sd = U.uSunDir.value;
      const A = LK.title;
      out.pos.set(A.x + 5 * Math.sin(t * 0.021), A.y + 0.8 * Math.sin(t * 0.031), A.z + 3 * Math.cos(t * 0.017));
      const sunAz = Math.atan2(sd.x, -sd.z), low = 1 - smooth(0.25, 0.6, sd.y);
      out.yaw = lerp(-12 * DEG, clamp(sunAz * 0.72, -48 * DEG, 42 * DEG), low * 0.9) + 7 * DEG * Math.sin(t * 0.013);
      out.pitch = -4 * DEG;
      out.rate = 1.2; out.posRate = 0.9;
    } else if (m === "flight") {
      const L = S.view.look || S.lure;
      const dh = Math.hypot(L.x - EYEV.x, L.z - EYEV.z);
      const base = { yaw: out.yaw, pitch: out.pitch };
      lookAt(L, 0.04);
      // near the dock (the back cast) keep looking out over the lake instead of spinning round
      const w = smooth(4, 12, dh) * smooth(EYEV.z - 0.5, EYEV.z - 4, L.z);
      out.yaw = base.yaw + angDiff(base.yaw, out.yaw) * w;
      out.pitch = lerp(base.pitch, clamp(out.pitch, -0.45, 0.55), w);
      const zoom = 2 * Math.atan(WORLD.ZOOM_WIDTH / 2 / Math.max(dh, 1) / (S.w / S.h)) / DEG;
      out.fov = clamp(Math.min(out.fov, lerp(out.fov, zoom, smooth(8, 30, dh))), 22, out.fov);
      out.rate = 6;
    } else if (m === "reel") {
      const L = S.view.look || (S.fish ? S.fish : S.lure), J = WORLD.JUMP_ZOOM, k = S.zoomK > 0.001 ? S.zoomK : 0;
      // a leap looks up at half its height (the arc drawFish draws, the highest one), not a little down at the water
      const len = S.fish ? S.fish.len || 0.4 : 0.4, top = 0.35 + 0.9 * len;
      const dh = lookAt({ x: L.x, y: lerp(Math.max(L.y, -0.3), top / 2, k), z: L.z }, 0.07 * (1 - k));
      out.rate = 3;
      // and the view narrows to about 10 m of lake across at the fish (never wider than it is), but never so far that the
      // top of the leap and the fish (drawn up to 2x far out) rise from the leap's place, J.at of the way down the view,
      // into the HUD and the prompt (the top J.free of it). S.zoomK eases it (see update), and the camera follows closely
      if (k) {
        const d = Math.max(dh, 1), up = top / 2 + len * (1 + smooth(8, 30, dh)) / 2 + 0.1;
        const zoom = Math.max(2 * Math.atan(J.width / 2 / d / (S.w / S.h)), 2 * Math.atan(up / (2 * d * (J.at - J.free)))) / DEG;
        out.fov = lerp(out.fov, Math.min(out.fov, zoom), k);
        out.pitch += k * Math.atan((2 * J.at - 1) * Math.tan(out.fov * DEG / 2));
        out.rate = 10;
      }
      out.pitch = clamp(out.pitch, -0.8, 0.35);
    } else if (m === "catch") {
      out.pos.copy(CATCH_CAM);
      const T = trophySpot();
      lookAt(T);
      out.fov = S.trophy ? S.trophy.fov : baseFov("catch");
      out.rate = 3;
    } else if (S.view.look) {
      lookAt(S.view.look);
    }
    return out;
  }
  // A cutscene (cutscenes.js) holds the camera: while cutFn is set it gives the pose each frame in place of camTarget(),
  // and the rod, the line, the lure and the aim hide. fn(dt, { cast, aspect, loon }) returns { pos, look, fov } ({x, y, z}
  // points, degrees). cast: the cast view as main.js lays it out (tall up to 1.15 wide): { pos, pitch, fov }; loon: where
  // the loon swims (null while it dives, or at a place with none). When it gives the camera back, the next frame starts
  // from camTarget(): play never comes back to a camera still flying home from the shot
  let cutFn = null;
  function cutCamera(dt) {
    const tall = S.w / S.h <= 1.15, C = S.cam;
    const T = cutFn(dt, { cast: { pos: EYEV, pitch: (tall ? WORLD.PITCH_CAST.portrait : WORLD.PITCH_CAST.wide) * DEG, fov: baseFov("cast", tall) }, aspect: S.w / S.h, loon: loon && loon.visible ? loon.position : null });
    if (T) {
      const dx = T.look.x - T.pos.x, dz = T.look.z - T.pos.z;
      C.pos.set(T.pos.x, T.pos.y, T.pos.z);
      C.yaw = Math.atan2(dx, -dz); C.pitch = Math.atan2(T.look.y - T.pos.y, Math.max(Math.hypot(dx, dz), 0.01)); C.fov = T.fov;
      C.init = true;
    }
    applyCamera();
  }
  function updateCamera(dt) {
    if (cutFn) { cutCamera(dt); return; }
    const T = camTarget(), C = S.cam;
    if (!C.init) { C.pos.copy(T.pos); C.yaw = T.yaw; C.pitch = T.pitch; C.fov = T.fov; C.init = true; }
    let k = 1 - Math.exp(-dt * T.rate), kp = 1 - Math.exp(-dt * T.posRate);
    if (S.view.mode !== "title") kp = Math.max(kp, k * 0.6);
    const b = photoStep();
    if (b !== null) k = kp = b;
    C.pos.lerp(T.pos, kp);
    C.yaw += angDiff(C.yaw, T.yaw) * k;
    C.pitch += (T.pitch - C.pitch) * k;
    C.fov += (T.fov - C.fov) * k;
    applyCamera();
  }
  function applyCamera() {
    const C = S.cam;
    camera.position.copy(C.pos);
    camera.rotation.set(C.pitch, -C.yaw, 0, "YXZ");
    // the hook-set punch narrows the view at once, on the frozen frame too (so it is applied here, not eased in update)
    camera.fov = C.fov * punchK();
    camera.aspect = S.w / S.h;
    camera.near = S.view.mode === "catch" ? 0.05 : 0.08;
    // the catch card covers the right part of a wide view, or the bottom of a tall one: shift the picture so the fish sits in the free part
    const inset = S.view.mode === "catch" ? S.view.inset || 0 : 0, bottom = S.view.mode === "catch" ? S.view.bottom || 0 : 0;
    if (inset > 0 || bottom > 0) camera.setViewOffset(S.w, S.h, S.w * inset / 2, S.h * bottom / 2, S.w, S.h);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
  }
  // the punch of the hook set: 1 - k at once, held, then eased back (a smooth step). 1 when there is none
  function punchK() {
    const P = WORLD.PUNCH, t = performance.now() - S.punchAt;
    if (t < 0 || t >= P.hold + P.back || S.view.mode !== "reel") return 1;
    return 1 - P.k * (t < P.hold ? 1 : 1 - smooth(0, 1, (t - P.hold) / P.back));
  }
  // radians per CSS pixel: thin things (line, rod tip) are kept about a pixel wide on any screen. q: see rodQ
  const pxAngle = (q = 1) => (2 * Math.tan(camera.fov * DEG / 2) * q) / Math.max(1, S.h);

  /* ---------------- rod and line ---------------- */
  const firstPerson = () => S.view.mode !== "title" && S.view.mode !== "catch";
  // The jump zoom of the reel keeps the rod in the hand, as it is in the reel's own view: it is posed for a view q times
  // wider, then squeezed toward the middle of the narrow view by q (rodSqueeze), so it is not blown up across the fish
  const rodQ = () => (S.view.mode === "reel" && S.zoomK > 0 ? Math.max(1, Math.tan(baseFov("reel") * DEG / 2) / Math.tan(S.cam.fov * DEG / 2)) : 1);
  const squeeze = new THREE.Matrix4(), sqTmp = new THREE.Matrix4();
  const rodSqueeze = (q) => squeeze.copy(camera.matrixWorld).multiply(sqTmp.makeScale(1 / q, 1 / q, 1)).multiply(camera.matrixWorldInverse);
  rod.mesh.matrixAutoUpdate = false;
  function gripPoint(q = 1) {
    const portrait = S.view.portrait || S.w / S.h < 0.9;
    const G = WORLD.GRIP, d = portrait ? G.pd : G.d;
    const tv = Math.tan(camera.fov * DEG / 2) * q, th = tv * camera.aspect;
    // in the zoomed flight view the rod slides down out of the way
    const zoomed = clamp(1 - 2 * Math.atan(tv) / DEG / baseFov(S.view.mode === "flight" ? "flight" : "cast"), 0, 1);
    const nx = portrait ? G.px : G.x, ny = (portrait ? G.py : G.y) - zoomed * 2.2;
    return new THREE.Vector3(nx * d * th, ny * d * tv, -d).applyMatrix4(camera.matrixWorld);
  }
  function poseRod() {
    const R = S.rod, q = rodQ();
    // Present the rod toward the lake; physics still uses the measured angle.
    const yaw = (R.yaw + (R.steer || 0) * 35) * DEG, th = (R.theta - 35) * DEG;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(th), Math.sin(th), -Math.cos(yaw) * Math.cos(th)).normalize();
    const pull = R.pull ? new THREE.Vector3(R.pull.x, R.pull.y, R.pull.z) : null;
    // S.kick: the tip twitches for a nibble, dips hard on a strike and whips on the hook set
    const tip = rod.pose(gripPoint(q), dir, R.bend || 0, pull, camera.position, pxAngle(q), 1.35, S.kick);
    S.tip.copy(tip);
    if (q > 1) { rod.mesh.matrix.copy(rodSqueeze(q)); S.tip.applyMatrix4(squeeze); } else rod.mesh.matrix.identity();
    rod.mesh.matrixWorldNeedsUpdate = true;
    return S.tip;
  }
  function drawLine(dt) {
    const Ln = S.line;
    const show = Ln.visible && Ln.from && Ln.to && firstPerson() && !cutFn;
    line.mesh.visible = !!show;
    if (!show) { line.motion.reset(); return; }
    // if the caller drew the line from the tip we returned, follow the tip as the camera settles this frame
    const from = Math.hypot(Ln.from.x - S.lastTip.x, Ln.from.y - S.lastTip.y, Ln.from.z - S.lastTip.z) < 0.25 ? S.tip : Ln.from;
    line.build(from, Ln.to, Ln.slack, Ln.flying, camera.position, pxAngle(), dt);
  }

  /* ---------------- lure ---------------- */
  const qTmp = new THREE.Quaternion(), mTmp = new THREE.Matrix4(), vA = new THREE.Vector3(), vB = new THREE.Vector3();
  function drawLure(dt) {
    const Lr = S.lure, g = lure.group;
    const show = Lr.visible && firstPerson() && !cutFn;
    g.visible = show;
    lure.glint.visible = false;
    WU.uLure.value.set(0, 0, 0, 0);
    if (!show) return;
    g.position.set(Lr.x, Lr.y, Lr.z);
    // nose along the flight when it moves fast, else toward the line
    const sp = Lr.vel.length();
    if (sp > 2) vA.copy(Lr.vel).normalize();
    else vA.set(S.tip.x - Lr.x, S.tip.y - Lr.y, S.tip.z - Lr.z).normalize();
    if (vA.lengthSq() > 0.5) {
      mTmp.lookAt(vB.set(0, 0, 0), vA, Math.abs(vA.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
      // Matrix4.lookAt turns -z toward the target, and the lure's nose is -z
      qTmp.setFromRotationMatrix(mTmp);
      g.quaternion.slerp(qTmp, 1 - Math.exp(-dt * 12));
    }
    // blade spin: 0..1 of full speed (about 12 turns a second), a bigger number is taken as turns a second;
    // with none given it follows the lure's speed through the water
    const rps = Lr.spin > 1 ? Lr.spin : Lr.spin > 0 ? Lr.spin * 12 : Lr.y < 0 ? Math.min(sp * 6, 12) : 0;
    lure.spinA += rps * Math.PI * 2 * dt;
    lure.spinner.rotation.z = lure.spinA;
    // grow it far away so it stays a few pixels tall
    const dist = camera.position.distanceTo(g.position);
    const need = (WORLD.LURE_MIN_SCREEN * 2 * dist * Math.tan(camera.fov * DEG / 2)) / 0.07;
    g.scale.setScalar(Math.max(1, need));
    // under the water it fades into the lake colour
    const depth = -Lr.y;
    lure.fx.uUnder.value = depth > 0 ? clamp(1 - Math.exp(-depth * 0.8), 0, 0.9) : 0;
    lure.fx.uAlpha.value = depth > 0 ? clamp(Math.exp(-depth * 0.5), 0, 1) : 1;
    // a glint of sun off the blade while it flies or skims
    const air = Lr.y > 0.15 && dist > 4;
    if ((depth < 0.05 && U.uSunVis.value > 0.1) || air) {
      const flick = 0.55 + 0.45 * Math.sin(lure.spinA * 2 + S.clock * 9);
      lure.glint.visible = true;
      lure.glint.position.copy(g.position);
      const s = dist * Math.tan(camera.fov * DEG / 2) * (air ? 0.075 : 0.045) * (0.7 + 0.5 * flick);
      lure.glint.scale.set(s, s, s);
      lure.glint.material.opacity = Math.max(0.9 * U.uSunVis.value, air ? 0.55 : 0);
    }
    if (depth > -0.1 && depth < 0.7 && sp > 0.15) WU.uLure.value.set(Lr.x, Lr.z, Lr.vel.x, Lr.vel.z);
  }

  /* ---------------- fish ---------------- */
  function getFish(id) {
    if (!fishCache.has(id)) {
      const m = makeFish(id);
      if (!m) return null;
      m.visible = false;
      m.userData.fx.uWater.value.copy(U.uDeep.value);
      m.userData.phase = 0;
      fishCache.set(id, m);
      scene.add(m);
    }
    return fishCache.get(id);
  }
  // out in the water a fish is drawn bigger than life, more so the heavier it is (showScale in species.js). It comes back
  // to its true length as it nears the rod (from 9 m in to 2.5 m), so it meets the hand and the board at its own size
  const shown = (f) => (f.kg ? 1 + (showScale(f.kg) - 1) * smooth(2.5, 9, Math.hypot(f.x - EYEV.x, f.z - EYEV.z)) : 1);
  const unitLen = (m) => (m.userData.kind === "junk" ? JUNK_LEN[m.userData.id] : 1);
  function drawFish(dt) {
    const f = S.fish;
    for (const [id, m] of fishCache) if (!f || id !== f.id) m.visible = false;
    if (!f) { S.jumpWas = 0; return; }
    const m = getFish(f.id);
    if (!m) return;
    const u = m.userData.fx, len = f.len || 0.4;
    m.visible = true;
    // a leap far out is drawn larger (up to 2x from 30 m), so the moment reads on a phone. Not in a cutscene: its camera
    // is near the fish and frames it at its own size
    const far = (f.jump || 0) > 0 && !cutFn ? 1 + smooth(8, 30, Math.hypot(f.x - EYEV.x, f.z - EYEV.z)) : 1;
    m.scale.setScalar((len / unitLen(m)) * far * (m.userData.kind === "junk" ? 1 : shown(f)));
    const j = clamp(f.jump || 0, 0, 1), heading = f.heading || 0;
    let y = f.y, pitch = 0, roll = f.roll || 0;   // roll: the body turns about its length (radians): a thrashing or beaten fish lies over
    const fwd = new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading));
    let x = f.x, z = f.z;
    if (j > 0) {
      // a leap: out of the water nose first, arc over, and back in. fish.js lifts y itself; a caller that
      // only gives the phase (y still at the surface) gets an arc drawn here
      const H = 0.35 + len * 0.9, own = 1 - smooth(0.0, 0.06, f.y);
      y = Math.max(f.y, -0.1) + own * 4 * j * (1 - j) * H;
      pitch = (0.5 - j) * 2.2;
      roll += Math.sin(S.clock * 14) * 0.3 * (f.thrash || 0.5);
      if (S.jumpWas === 0) { autoSplash(x, z, 0.4 + len * 0.6); S.jumpSplashed = false; }
      if (j > 0.82 && !S.jumpSplashed) { autoSplash(x + fwd.x * len * 0.4, z + fwd.z * len * 0.4, 0.45 + len * 0.7); S.jumpSplashed = true; }
      // water streams off the fish in the air
      for (let k = 0; k < 3; k++) if (Math.random() < dt * 30) {
        const s = (Math.random() - 0.5) * len;
        spray.emit(x + fwd.x * s, y + (Math.random() - 0.3) * len * 0.1, z + fwd.z * s, (Math.random() - 0.5) * 1.2 - fwd.x * 0.8, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2 - fwd.z * 0.8, 0.05 + Math.random() * 0.05, 0.7);
      }
    } else if (S.jumpWas > 0 && !S.jumpSplashed) { autoSplash(x, z, 0.45 + len * 0.7); }
    S.jumpWas = j;
    m.position.set(x, y, z);
    m.rotation.set(0, 0, 0, "YXZ");
    m.rotation.order = "YXZ";
    m.rotation.y = -heading; m.rotation.x = pitch; m.rotation.z = roll;
    // swimming: a tail beat that gets wild when it thrashes
    const th = f.thrash || 0;
    m.userData.phase += dt * (7 + th * 18);
    u.uWag.value.set(m.userData.phase, 0.25 + th * 0.9, j > 0 ? Math.sin(j * Math.PI) * 0.25 * (f.thrash || 0.4) : 0, 0);
    u.uKey.value = j > 0 ? 0.45 : 0;
    // under the water: tint and fade with depth and with how close it is to the surface
    const depth = -y;
    if (depth > 0.02 && j === 0) {
      const near = clamp(f.near == null ? 1 : f.near, 0, 1);
      u.uUnder.value = clamp(1 - Math.exp(-depth * 0.7) + (1 - near) * 0.4, 0, 0.92);
      u.uAlpha.value = clamp(near * Math.exp(-depth * 0.22), 0, 1);
      m.visible = u.uAlpha.value > 0.02;
    } else { u.uUnder.value = 0; u.uAlpha.value = 1; }
  }
  function drawFollower(dt) {
    const f = S.follower;
    S.followA += ((f ? 1 : 0) - S.followA) * (1 - Math.exp(-dt * 3));
    shadow.visible = S.followA > 0.01 && !!(f || S.followLast) && !(LK.nightShadow != null && U.uNight.value > LK.nightShadow);
    if (f) S.followLast = f;
    const g = S.followLast;
    if (!shadow.visible || !g) return;
    shadow.position.set(g.x, -0.03, g.z);
    shadow.rotation.y = -(g.heading || 0);
    const len = (g.len || 0.4) * shown(g);
    shadow.scale.set(len * 1.35, 1, len * 1.35);
    shadow.userData.u.uAlpha.value = S.followA * 0.75 * clamp(Math.exp((g.y || -0.5) * 0.3), 0.3, 1);
  }

  /* ---------------- water effects ---------------- */
  function ripple(x, z, size = 0.5) {
    // a ripple with no place would break the water until its slot came round again
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    WU.uRip.value[S.rip].set(x, z, U.uTime.value, clamp(Number.isFinite(size) ? size : 0.5, 0.05, 2));
    S.rip = (S.rip + 1) % E.RIPPLES;
  }
  // a splash far out grows with the distance (WORLD.SPLASH_FAR), so the landing of a long cast and a strike at 40 m show
  function splashAt(x, z, size = 0.5) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const d = Math.hypot(x - EYEV.x, z - EYEV.z), [d0, k0, r0, rk] = WORLD.SPLASH_FAR;
    ripple(x, z, size * 1.2 * clamp(d / r0, 1, rk));
    spray.burst(x, z, clamp(size, 0.1, 1.6), Math.random, clamp(d / d0, 1, k0));
    S.lastSplash = { x, z, t: S.clock };
  }
  // gold sparks over the water (a cast right into a ring), grown with the distance like a splash
  function sparkle(x, z, n = 8) {
    const k = clamp(Math.hypot(x - EYEV.x, z - EYEV.z) / WORLD.SPLASH_FAR[0], 1, WORLD.SPLASH_FAR[1]);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; spray.emit(x + Math.cos(a) * 0.3, 0.05, z + Math.sin(a) * 0.3, Math.cos(a) * 0.6, 1.2 + Math.random() * 1.2 * Math.sqrt(k), Math.sin(a) * 0.6, 0.08 * k, 0.9, 1, 0.4); }
  }
  // the leap splashes on its own, unless the game just splashed there itself
  function autoSplash(x, z, size) {
    const L = S.lastSplash;
    if (L && S.clock - L.t < 0.4 && Math.hypot(L.x - x, L.z - z) < 2.5) return;
    splashAt(x, z, size);
  }
  function rise(x, z) {
    ripple(x, z, 0.35);
    for (let k = 0; k < 6; k++) { const a = Math.random() * 6.28; spray.emit(x, 0.02, z, Math.cos(a) * 0.4, 0.8 + Math.random() * 0.8, Math.sin(a) * 0.4, 0.025, 0.4); }
  }

  /* ---------------- loon ---------------- */
  function drawLoon(dt) {
    if (!loon) return;
    const L = S.loon;
    L.t += dt;
    // it paddles a slow loop out in the bay, and now and then dives and comes up somewhere else
    const cyc = L.t % 75, under = cyc > 60;
    const a = L.t * 0.018, cx = 12, cz = -44, r = 11;
    const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
    const hd = Math.atan2(Math.cos(a), Math.sin(a));  // along the loop: d/da of (sin a, cos a)
    if (under !== !loon.visible) ripple(x, z, 0.5);
    loon.visible = !under;
    loon.position.set(x, 0.02 + Math.sin(S.clock * 1.3) * 0.012, z);
    loon.rotation.y = -hd;
    const sp = r * 0.018;
    WU.uLoon.value.set(x, z, under ? 0 : Math.sin(hd) * sp * 3, under ? 0 : -Math.cos(hd) * sp * 3);
  }

  /* ---------------- the trophy ---------------- */
  // A fish in the catch view lies on a measuring board: a strip with cm marks, the nose at 0, the shortest of
  // BOARD_LENGTHS that holds the fish. So a big fish looks big and a small one looks small. There is none for junk.
  // photo: a slow push-in first (WORLD.PHOTO), for a trophy, a legend or a fish that opens a place (Calm effects: no
  // push-in). sparkle: a burst of gold sparks when the push-in ends (a trophy or a legend). Every legend glitters.
  function showCatch(id, kg, { photo = false, sparkle = false } = {}) {
    hideCatch();
    const m = makeFish(id);
    if (!m) return;
    const sp = byId(id), junk = m.userData.kind === "junk";
    const len = junk ? JUNK_LEN[id] : lengthFor(sp, kg || sp.kg[0]) / 100;
    m.scale.setScalar(len / unitLen(m));
    // solid body and eyes in the hand; the fins stay see-through
    for (const mt of m.userData.mats) if (!mt.userData.fin) mt.transparent = false;
    m.traverse((o) => { o.renderOrder = 30; });
    m.userData.fx.uKey.value = 1;
    // turn on a stage around its middle; its size as shown: the long side across, its height up
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    m.position.copy(mid).negate();
    const pivot = new THREE.Group(), stage = new THREE.Group();
    stage.userData.trophy = true;
    pivot.add(m);
    stage.add(pivot);
    let W = id === "frisbee" ? size.x : size.z, H = id === "frisbee" ? size.x * 0.95 : size.y * 1.1;
    let board = null, behind = 0;
    if (!junk) {
      const bl = BOARD_LENGTHS.find((b) => b / 100 >= size.z / 0.85) || BOARD_LENGTHS[BOARD_LENGTHS.length - 1], L = bl / 100, bh = L * 48 / 512;
      board = boardMesh(bl);
      // the fish lies along the board with its nose at 0; the board is a little behind it and under its belly; the pair is centred
      const yb = -size.y / 2 - bh * 0.35, yc = (size.y / 2 + (yb - bh / 2)) / 2;
      pivot.position.set(-L / 2 + size.z / 2, -yc, 0);
      behind = size.x / 2 + 0.07 * size.z + 0.01;
      board.position.set(0, yb - yc, -behind);
      stage.add(board);
      W = L * 1.06; H = (size.y / 2 - (yb - bh / 2)) * 1.1;
    }
    // beat: main.js holds the card back for the photo beat (Calm effects too, with no push-in); at: when the fish showed, on
    // the wall clock (ms); camT: how far into the beat the camera has come (s, see photoStep)
    const calm = isCalm();
    S.trophy = { mesh: stage, pivot, inner: m, board, behind, len, W, H, dist: 1, fov: 40, t: 0, sw: 0, junk, id, photo: photo && !calm, push: photo && !calm ? WORLD.PHOTO.from : 1, pitch: CATCH_PITCH,
      legend: !!(sp && sp.legend), sparkle: sparkle && !calm, beat: photo, at: performance.now(), camT: 0 };
    fitTrophy();
    scene.add(stage);
  }
  // hold the fish out at a distance that fits both ways in the free part of the view, and narrow the view for a
  // small fish. Again on every resize: the view often changes size just as the catch shows
  function fitTrophy() {
    const T = S.trophy;
    if (!T) return;
    const { W, H } = T;
    const aspect = S.w * (1 - (S.view.inset || 0)) / S.h;
    const d0 = clamp(Math.max(W, H) * 1.3, 0.42, 1.5);
    const fb = 1 - (S.view.bottom || 0);   // the part of the height that the card leaves free
    const needV = (w, h, d) => Math.max(2 * Math.atan(w / 0.72 / 2 / d / aspect), 2 * Math.atan(h / 0.78 / fb / 2 / d)) / DEG;
    T.fov = clamp(needV(W, H, d0), 14, 78);
    const tv = Math.tan(T.fov * DEG / 2);
    T.dist = Math.max(d0, W / 0.72 / 2 / (tv * aspect), H / 0.78 / fb / 2 / tv);
    // a big fish (or a narrow view) puts the fish far out: hold it flatter, so it does not sink into the stand or the water
    const floor = Math.max(0, PL.stand.dock.deck) + H / 2 + 0.25;
    T.pitch = clamp(Math.asin(clamp((floor - CATCH_CAM.y) / T.dist, -1, 1)), CATCH_PITCH, -8 * DEG);
  }
  function hideCatch() {
    const T = S.trophy;
    if (!T) return;
    scene.remove(T.mesh);
    T.mesh.traverse((o) => { if (o.material) o.material.dispose(); });   // the fish's own skin and shape are cached in world-fish
    if (T.board) { T.board.geometry.dispose(); T.board.material.map.dispose(); T.board.material.dispose(); }
    S.trophy = null;
  }
  function drawTrophy(dt) {
    const T = S.trophy;
    if (!T) return;
    T.t += dt;
    const m = T.mesh, P = WORLD.PHOTO;
    m.visible = S.view.mode === "catch";
    // the board lies a little behind the fish: drawn larger by that much, its marks line up with the fish as the eye sees it
    if (T.board) T.board.scale.setScalar(1 + T.behind / Math.max(0.3, T.dist * T.push));
    // the photo beat: the view eases in from far away, then the fish holds still for a moment (on the beat's clock, beatT)
    const e = T.photo ? beatT(T) : T.t;
    if (T.photo) T.push = lerp(P.from, 1, 1 - Math.pow(1 - clamp(e / P.push, 0, 1), 3));
    const frozen = T.photo && e > P.push && e < P.push + P.freeze;
    if (!frozen) T.sw += dt;
    const p = trophySpot();
    // face the camera: the stage turns with the view, the fish swings slowly on it
    m.position.copy(p);
    m.position.y += Math.sin(T.t * 1.4) * 0.01;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(S.cam.pitch, -S.cam.yaw, 0, "YXZ"));
    m.quaternion.copy(q);
    // on the board the swing is small, so the nose stays at 0
    const sw = T.board ? 0.12 : 0.5, spin = new THREE.Quaternion();
    if (T.id === "frisbee") spin.setFromEuler(new THREE.Euler(1.2, T.t * 0.5, 0, "XYZ"));
    else spin.setFromEuler(new THREE.Euler(0.08 * Math.sin(T.sw * 0.9), Math.PI / 2 + sw * Math.sin(T.sw * 0.55), 0.1 * Math.sin(T.sw * 0.7), "YXZ"));
    T.pivot.quaternion.copy(spin);
    const u = T.inner.userData.fx;
    u.uWag.value.set(T.t * 3, T.junk ? 0 : 0.12, 0, 0);
    u.uUnder.value = 0; u.uAlpha.value = 1;
    if (Math.random() < dt * 3 && !T.junk) spray.emit(p.x + (Math.random() - 0.5) * T.len * 0.6, p.y - 0.05, p.z, 0, -0.3, 0, 0.012, 0.8);
    // a legend glitters
    if (T.legend && Math.random() < dt * 12) spray.emit(p.x + (Math.random() - 0.5) * T.len, p.y + (Math.random() - 0.5) * T.len * 0.3, p.z + (Math.random() - 0.5) * 0.1, 0, 0.08, 0, 0.012, 1.2, 1, 0);
    // a trophy or a legend: one burst of gold sparks around the fish as the push-in ends
    if (T.sparkle && e >= (T.photo ? P.push : 0.3)) {
      T.sparkle = false;
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * 6.28, r = T.len * (0.3 + 0.4 * Math.random());
        spray.emit(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.5, p.z + 0.05, Math.cos(a) * 0.35, 0.15 + Math.sin(a) * 0.3, 0, 0.012 + 0.01 * Math.random(), 0.7 + 0.5 * Math.random(), 1, 0.3);
      }
    }
  }

  /* ---------------- per frame ---------------- */
  function update(dt) {
    // the hook-set freeze: the lake, the fish and the camera hold still for a moment (main.js keeps the sim and the
    // input going; render() still draws, with the punch)
    if (performance.now() < S.freezeUntil) return;
    dt = clamp(dt || 0, 0, 0.1);
    S.clock += dt;
    // the jump zoom: in while the fish is in the air (and from jumpZoom()), out a little after; in fast, out slow.
    // Calm effects and reduced motion keep the view as it is
    const J = WORLD.JUMP_ZOOM;
    if (S.fish && S.fish.jump > 0 && S.view.mode === "reel") S.zoomHold = Math.max(S.zoomHold, S.clock + J.after);
    const zw = S.view.mode === "reel" && S.clock < S.zoomHold && !isCalm() ? 1 : 0;
    S.zoomK += (zw - S.zoomK) * (1 - Math.exp(-dt * (zw > S.zoomK ? J.in : J.out)));
    if (!zw && S.zoomK < 0.001) S.zoomK = 0;
    // the rod tip's twitch holds, then dies away
    if (S.clock > S.kickHold) S.kick *= Math.exp(-dt * WORLD.KICK_DECAY);
    U.uTime.value = S.clock % 3600;
    updateCamera(dt);
    drawLoon(dt);
    drawFish(dt);
    drawFollower(dt);
    drawTrophy(dt);
    // the aim line fades in and out; it only belongs to the cast view
    S.aim.a += ((S.aim.visible && S.view.mode === "cast" && !cutFn ? 0.75 : 0) - S.aim.a) * (1 - Math.exp(-dt * 6));
    const ay = (S.aim.yaw || 0) * DEG, z0 = PL.stand.dock.z0, to = S.aim.to;
    WU.uAim.value.set(Math.sin(ay), -Math.cos(ay), S.aim.a, z0);
    // the preview: how far along the line a cast like the last one lands, and whether that is dry land (amber)
    WU.uAimTo.value.set(to ? Math.max(4, to.x * Math.sin(ay) - (to.z - z0) * Math.cos(ay)) : 0, to && to.warn ? 1 : 0);
    // gold rings glow and throw up sparkles
    halos.forEach((h, i) => {
      const r = S.rings[i];
      h.visible = !!(r && r.gold) && firstPerson() && S.view.mode !== "reel";   // in the reel the ring shader and sparkles show it: one draw call less
      if (!h.visible) return;
      const d = Math.hypot(r.x - camera.position.x, r.z - camera.position.z);
      const s = (1.6 + d * 0.035) * (0.85 + 0.15 * Math.sin(S.clock * 3 + i));
      h.position.set(r.x, 0.12 + s * 0.12, r.z);
      h.scale.set(s * 1.6, s * 0.7, 1);
      h.material.opacity = 0.75;
    });
    for (const r of S.rings) if (r.gold && Math.random() < dt * 14) {
      const a = Math.random() * 6.28, d = Math.random() * 1.6;
      spray.emit(r.x + Math.cos(a) * d, 0.05, r.z + Math.sin(a) * d, 0, 0.5 + Math.random() * 0.6, 0, 0.18 + 0.004 * Math.hypot(r.x, r.z), 1.4, 1, 0);
    }
    spray.update(dt);
    // the gulls circle over the rising fish, the fireflies come out at night
    if (gulls) gulls.update(dt, S.rings);
    if (flies) flies.visible = U.uNight.value > 0.5;
    S.lureDt = dt;
  }
  function render() {
    applyCamera();
    // a narrow view hides the rod (it would fill it), but not the jump zoom of the reel: there it is squeezed (see rodQ)
    rod.mesh.visible = S.rod.visible && firstPerson() && (rodQ() > 1 || camera.fov > baseFov(S.view.mode) * 0.8);
    if (rod.mesh.visible) poseRod();
    drawLine(S.lureDt || 1 / 60);
    drawLure(S.lureDt || 1 / 60);
    shadow.visible = shadow.visible && S.view.mode !== "catch";
    spray.u.uScale.value = (S.h * renderer.getPixelRatio()) / (2 * Math.tan(camera.fov * DEG / 2));
    if (flies) flies.userData.u.uScale.value = spray.u.uScale.value;
    renderer.render(scene, camera);
    S.info.calls = renderer.info.render.calls;
    S.info.tris = renderer.info.render.triangles;
    const now = performance.now();
    if (S.lastRender) S.fps = S.fps * 0.9 + (1000 / Math.max(1, now - S.lastRender)) * 0.1;
    S.lastRender = now;
  }

  function resize(w, h) {
    S.w = Math.max(1, w | 0); S.h = Math.max(1, h | 0);
    renderer.setPixelRatio(ratio());
    renderer.setSize(S.w, S.h);
    fitTrophy();
    applyCamera();
  }

  // Go to another place (a place or its id). Everything that belongs to the old place is freed: props, trees, ground, the
  // water texture and the fish it had that this place does not. Returns { ms }, the time it took. Do it behind a card.
  let travel = Promise.resolve();
  async function goTo(next) {
    const np = typeof next === "string" ? getPlace(next) : next;
    if (!np || !np.stand || np === PL) return { ms: 0 };
    const t0 = performance.now();
    hideCatch();
    PL = np; LK = lookOf(np);
    applyStand();
    E.setWaterPlace(water, WU, PL, LK);
    buildEnv();
    buildProps();
    // fish of the old place go; the two warm-up fish stay (their shaders stay cached), and the fish module frees the skins
    const keep = placeSpecies(PL.id);
    for (const [id, m] of fishCache) if (!keep.includes(id) && !WARM_IDS.includes(id)) { scene.remove(m); for (const mt of m.userData.mats) mt.dispose(); fishCache.delete(id); }
    Fish.releaseFish([...new Set([...keep, ...WARM_IDS])]);
    // nothing carries over: no fish, rings, lure, aim or trophy
    S.fish = null; S.follower = null; S.followLast = null; S.followA = 0; S.rings = [];
    for (let i = 0; i < E.RINGS; i++) WU.uRing.value[i].set(0, 0, 0, 0);
    WU.uLure.value.set(0, 0, 0, 0); WU.uLoon.value.set(0, 0, 0, 0);
    S.lure.visible = false; S.lure.prev = null; S.line.visible = false; S.aim.visible = false; S.aim.a = 0;
    S.view = { mode: "title", yaw: 0, look: null, portrait: false };
    S.cam.init = false;
    setHour(S.hour);
    updateCamera(0);
    await warmUp();
    setHour(S.hour);
    return { ms: performance.now() - t0 };
  }

  const world = {
    renderer, scene, camera,
    resize,
    get artStyle() { return currentStyle; },
    setArtStyle(style) {
      const previousStyle = currentStyle;
      currentStyle = normalizeStyle(style);
      artStyle.value = currentStyle === "painted" ? 1 : 0;
      if (currentStyle !== previousStyle) {
        envGroup.remove(treeGroup); dispose(treeGroup);
        treeGroup = E.buildTrees(low, PL, LK, currentStyle);
        envGroup.add(treeGroup);
        buildProps();
      }
      rod.setArtStyle(currentStyle); lure.setArtStyle(currentStyle); poseRod();
      setHour(S.hour);
      if (artStyle.value) E.loadStorySky().then(render);
    },
    setQuality(q) {
      const nl = q === "low";
      if (nl === low) return;
      low = nl;
      res.reset();
      renderer.setPixelRatio(ratio());
      renderer.setSize(S.w, S.h);
      buildEnv();
      sky.material.defines.OCT = low ? 3 : 5; sky.material.needsUpdate = true;
      water.material.defines.LOW = low ? 1 : 0; water.material.needsUpdate = true;
    },
    // inset: the part of the width (from the right) that a card covers, for the catch view.
    // bottom: the part of the height (from the bottom) that a card covers, on a tall view (at most 0.62)
    setView({ mode = "cast", yaw = 0, look = null, portrait = false, inset = 0, bottom = 0 } = {}) {
      bottom = clamp(bottom || 0, 0, 0.62);
      const refit = inset !== (S.view.inset || 0) || bottom !== (S.view.bottom || 0);
      S.view = { mode, yaw, look, portrait, inset, bottom };
      if (refit) fitTrophy();
    },
    // a cutscene's camera, or null to give the camera back (see cutCamera). The rod and the aim hide with it, until main.js
    // draws them again (setRod, setAim) when play goes on. Given back, the camera is at once where play has it
    cutCamera(fn) {
      const had = !!cutFn;
      cutFn = typeof fn === "function" ? fn : null;
      if (cutFn) { S.rod.visible = false; S.aim.a = 0; } else if (had) S.cam.init = false;
    },
    setRod({ theta = 60, yaw = 0, steer = 0, bend = 0, pull = null, visible = true } = {}) {
      S.rod = { theta, yaw, steer, bend, pull, visible };
      applyCamera();
      const tip = poseRod();
      S.lastTip.copy(tip);
      return { x: tip.x, y: tip.y, z: tip.z };
    },
    tip() { return { x: S.tip.x, y: S.tip.y, z: S.tip.z }; },
    rodAnchor() {
      const q = rodQ(), p = gripPoint(q);
      if (q > 1) p.applyMatrix4(rodSqueeze(q));
      p.project(camera);
      return { x: (p.x + 1) * S.w / 2, y: (1 - p.y) * S.h / 2 };
    },
    // the lure on the screen, in CSS px of the view; null while it is hidden or behind the camera. The messages keep
    // clear of it (main.js), and the QA checks read it
    // the length the hooked fish is drawn at, in m (QA: the Heavy fish look heavy checks); null when none shows
    fishDrawn() {
      const f = S.fish, m = f && fishCache.get(f.id);
      return m && m.visible ? m.scale.x * unitLen(m) : null;
    },
    lureScreen() {
      const L = S.lure;
      if (!L.visible || !firstPerson() || cutFn) return null;
      vA.set(L.x, L.y, L.z).project(camera);
      if (vA.z > 1) return null;
      return { x: (vA.x + 1) * S.w / 2, y: (1 - vA.y) * S.h / 2 };
    },
    setLine({ from = null, to = null, slack = 0, visible = true, flying = false } = {}) {
      S.line = { from, to, slack, visible, flying };
    },
    setLure({ x = 0, y = 0, z = 0, visible = true, spin = 0 } = {}) {
      const L = S.lure, t = S.clock;
      if (L.prev && t > L.prevT + 1e-4) {
        const dt = t - L.prevT;
        const v = new THREE.Vector3((x - L.prev.x) / dt, (y - L.prev.y) / dt, (z - L.prev.z) / dt);
        if (v.length() < 80) L.vel.lerp(v, 0.5);
      } else if (!L.prev) L.vel.set(0, 0, 0);
      if (t > L.prevT + 1e-4 || !L.prev) { L.prev = { x, y, z }; L.prevT = t; }
      // a hidden lure forgets where it was, so the next cast does not start with a jump in speed
      if (!visible) L.prev = null;
      Object.assign(L, { x, y, z, visible, spin });
    },
    setFish(f) { S.fish = f ? { ...f } : null; },
    setFollower(f) { S.follower = f ? { ...f } : null; },
    setRings(list) {
      S.rings = (list || []).slice(0, E.RINGS);
      for (let i = 0; i < E.RINGS; i++) {
        const r = S.rings[i];
        if (r) WU.uRing.value[i].set(r.x, r.z, r.gold ? 1 : 0, 1); else WU.uRing.value[i].set(0, 0, 0, 0);
      }
    },
    // to: where a cast like the last one would land ({ x, z, warn: not in the water }), or null for the short line
    setAim({ yaw = 0, visible = true, to = null } = {}) { S.aim.yaw = yaw; S.aim.visible = visible; S.aim.to = to; },
    ripple, splash: splashAt, rise, sparkle,
    // The big moments (main.js). Each returns false when Calm effects or reduced motion skip it.
    // punch(): the hook set narrows the reel view by 8% at once, holds 120 ms, and eases back over 250 ms
    punch() { if (isCalm()) return false; S.punchAt = performance.now(); return true; },
    // freeze(ms): no update for ms (the lake, the fish, the camera); the game's sim and input go on
    freeze(ms = 70) { if (isCalm()) return false; S.freezeUntil = performance.now() + ms; return true; },
    // jumpZoom(s): a fish is about to leap: zoom in on it now and for s seconds (while it is in the air the zoom holds by itself)
    jumpZoom(s = 0.8) { if (isCalm()) return false; S.zoomHold = Math.max(S.zoomHold, S.clock + s); return true; },
    // twitch(k, ms): the rod tip dips by k (0..1) toward the line, holds for ms, then springs back (a nibble, the strike, the hook set)
    twitch(k, ms = 0) { S.kick = clamp(Math.max(S.kick, k), 0, 1); S.kickHold = Math.max(S.kickHold, S.clock + ms / 1000); },
    // for the tests: the state of the big moments right now
    feel() { return { clock: S.clock, frozen: performance.now() < S.freezeUntil, punch: punchK(), zoom: S.zoomK, kick: S.kick, fov: camera.fov, base: baseFov(S.view.mode), rod: rod.mesh.visible }; },
    setHour,
    showCatch, hideCatch,
    update, render,
    info() {
      const m = renderer.info.memory;
      return { calls: S.info.calls, tris: S.info.tris, fps: Math.round(S.fps), scale: +res.scale.toFixed(2), mem: { geometries: m.geometries, textures: m.textures } };
    },
    place: () => PL,
    // one trip at a time: a second call waits for the first
    setPlace(next) {
      const trip = travel.then(() => goTo(next));
      travel = trip.catch(() => {});
      return trip;
    },
    // main.js reports the time of each frame that drew the lake, in ms: slow frames for a while lower the render scale,
    // fast ones raise it again. Returns true when the pixel ratio changed: that clears the canvas, so a lake that stands
    // still under a screen must be drawn again
    frameTime(ms) {
      if (document.hidden || renderer.getContext().isContextLost() || !res.frame(ms)) return false;
      renderer.setPixelRatio(ratio());
      return true;
    },
    // fn("lost") when the GL context is lost, fn("restored") when it is back and the shaders are warm again
    onContext(fn) { ctxFn = fn; },
    get lost() { return renderer.getContext().isContextLost(); },
    // upload a fish's painted skin before it is needed: the sim picks the fish at the landing, seconds before the strike
    prepareFish(id) {
      const m = getFish(id);
      if (m && m.userData && m.userData.mats) for (const mt of m.userData.mats) if (mt.map) renderer.initTexture(mt.map);
    },
  };

  // Compile the shaders now (fish, junk, trophies, lure, glows, and the props of this place) so the first bite or catch
  // does not stutter. A real draw, not just a compile: three checks each program and the driver builds its pipeline on
  // first use, and those must not land on the release, the strike or the catch.
  const WARM_IDS = ["smallmouth", "boot"];
  let solid = null, warmBoard = null;
  async function warmUp() {
    const warm = WARM_IDS.map(getFish);
    if (!solid) {
      solid = WARM_IDS.map(makeFish);   // the trophy variant: solid body, kept so its program stays cached
      solid.forEach((m) => { for (const mt of m.userData.mats) if (!mt.userData.fin) mt.transparent = false; });
    }
    solid.forEach((m) => scene.add(m));
    if (!warmBoard) warmBoard = boardMesh(BOARD_LENGTHS[0]);   // the measuring board of the catch view, kept so its shader stays cached
    scene.add(warmBoard);
    const extras = [lure.group, lure.glint, rod.mesh, line.mesh, shadow, ...halos, ...(flies ? [flies] : [])];
    warm.concat(solid).forEach((m) => { m.visible = true; m.position.set(0, 1, -3); });
    extras.forEach((o) => { o.visible = true; });
    warmBoard.position.set(0, 1, -3);
    const culled = [];
    scene.traverse((o) => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
    try {
      if (renderer.compileAsync && renderer.extensions.has("KHR_parallel_shader_compile")) await renderer.compileAsync(scene, camera);
      renderer.render(scene, camera);
    } catch (e) { /* draw on first use instead */ }
    culled.forEach((o) => { o.frustumCulled = true; });
    warm.forEach((m) => { m.visible = false; });
    solid.forEach((m) => scene.remove(m));
    scene.remove(warmBoard);
    extras.forEach((o) => { o.visible = false; });
  }

  // A lost GL context (iOS can drop it while the app is in the background, or the GPU resets): three keeps the scene and
  // uploads it again when the context comes back. Warm the shaders again then, so the first strike after it does not
  // stutter. main.js pauses on the loss, and draws again after the warm-up
  let ctxFn = null;
  renderer.domElement.addEventListener("webglcontextlost", () => { if (ctxFn) ctxFn("lost"); });
  renderer.domElement.addEventListener("webglcontextrestored", async () => {
    try { await warmUp(); } catch (e) { /* draw on first use instead */ }
    if (ctxFn) ctxFn("restored");
  });

  setHour(12);
  const rect = container.getBoundingClientRect();
  resize(rect.width || window.innerWidth, rect.height || window.innerHeight);
  updateCamera(0);
  await warmUp();
  if (artStyle.value) E.loadStorySky().then(render);
  return world;
}

