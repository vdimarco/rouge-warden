// Reel It In: the 3D world. One canvas with the sky, the place you fish (Loon Lake, Stump Bay, Cedar River or Gull Rock),
// the stand under your feet, the rod in your hands, the line, the lure, the fish and the trophy. Everything is built in
// code (see world-env, world-look, world-gear, world-fish, world-fx). world.setPlace(place) changes the place.
import * as THREE from "three";
import { artStyle, normalizeStyle } from "./art-style.js";
import { PLACES, getPlace } from "./places.js";
import { placeSpecies } from "./fishing.js";
import { byId, lengthFor } from "./species.js";
import * as E from "./world-env.js";
import { lookOf } from "./world-look.js";
import { Rod, Line, Lure } from "./world-gear.js";
import { loadCartoonModels } from "./cartoon-models.js";
import { loadPaintedForest } from "./painted-forest.js";
import * as Fish from "./world-fish.js";
import { fishMesh as makeFish, JUNK_LEN } from "./world-fish.js";
import { Spray, followerShadow, fireflies as makeFireflies, Gulls, boardMesh, BOARD_LENGTHS } from "./world-fx.js";

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

export async function createWorld(container, { quality = "high", place = PLACES.loon, style = "ghibli" } = {}) {
  await Promise.all([loadCartoonModels(), loadPaintedForest(), E.loadPaintedWater()]);
  let currentStyle = normalizeStyle(style);
  artStyle.value = currentStyle === "ghibli" ? 1 : 0;
  let low = quality === "low";
  let PL = typeof place === "string" ? getPlace(place) : place, LK = lookOf(PL);   // the place we are at, and how it looks
  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  // shader error checks are synchronous GL calls on each program's first draw: only in ?debug
  renderer.debug.checkShaderErrors = /[?&]debug\b/.test(location.search);
  // dynamic resolution: when frames run long the render scale drops, and it creeps back when there is room
  let resScale = 1, ftAvg = 16.7, ftHold = 0;
  const ratio = () => Math.max(0.6, Math.min(window.devicePixelRatio || 1, low ? WORLD.DPR.low : WORLD.DPR.high) * resScale);
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
  function baseFov(mode) {
    const aspect = S.w / S.h, portrait = S.view.portrait || aspect < 0.9;
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
      const L = S.view.look || (S.fish ? S.fish : S.lure);
      lookAt({ x: L.x, y: Math.max(L.y, -0.3), z: L.z }, 0.07);
      out.pitch = clamp(out.pitch, -0.8, 0.35);
      out.rate = 3;
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
  function updateCamera(dt) {
    const T = camTarget(), C = S.cam;
    if (!C.init) { C.pos.copy(T.pos); C.yaw = T.yaw; C.pitch = T.pitch; C.fov = T.fov; C.init = true; }
    const k = 1 - Math.exp(-dt * T.rate), kp = 1 - Math.exp(-dt * T.posRate);
    C.pos.lerp(T.pos, S.view.mode === "title" ? kp : Math.max(kp, k * 0.6));
    C.yaw += angDiff(C.yaw, T.yaw) * k;
    C.pitch += (T.pitch - C.pitch) * k;
    C.fov += (T.fov - C.fov) * k;
    applyCamera();
  }
  function applyCamera() {
    const C = S.cam;
    camera.position.copy(C.pos);
    camera.rotation.set(C.pitch, -C.yaw, 0, "YXZ");
    camera.fov = C.fov;
    camera.aspect = S.w / S.h;
    camera.near = S.view.mode === "catch" ? 0.05 : 0.08;
    // the catch card covers the right part of a wide view: shift the picture so the fish sits in the free part
    const inset = S.view.mode === "catch" ? S.view.inset || 0 : 0;
    if (inset > 0) camera.setViewOffset(S.w, S.h, S.w * inset / 2, 0, S.w, S.h);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
  }
  // radians per CSS pixel: thin things (line, rod tip) are kept about a pixel wide on any screen
  const pxAngle = () => (2 * Math.tan(camera.fov * DEG / 2)) / Math.max(1, S.h);

  /* ---------------- rod and line ---------------- */
  const firstPerson = () => S.view.mode !== "title" && S.view.mode !== "catch";
  function gripPoint() {
    const portrait = S.view.portrait || S.w / S.h < 0.9;
    const G = WORLD.GRIP, d = portrait ? G.pd : G.d;
    const tv = Math.tan(camera.fov * DEG / 2), th = tv * camera.aspect;
    // in the zoomed flight view the rod slides down out of the way
    const zoomed = clamp(1 - camera.fov / baseFov(S.view.mode === "flight" ? "flight" : "cast"), 0, 1);
    const nx = portrait ? G.px : G.x, ny = (portrait ? G.py : G.y) - zoomed * 2.2;
    return new THREE.Vector3(nx * d * th, ny * d * tv, -d).applyMatrix4(camera.matrixWorld);
  }
  function poseRod() {
    const R = S.rod;
    // Present the rod toward the lake; physics still uses the measured angle.
    const yaw = (R.yaw + (R.steer || 0) * 35) * DEG, th = (R.theta - 35) * DEG;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(th), Math.sin(th), -Math.cos(yaw) * Math.cos(th)).normalize();
    const pull = R.pull ? new THREE.Vector3(R.pull.x, R.pull.y, R.pull.z) : null;
    const tip = rod.pose(gripPoint(), dir, R.bend || 0, pull, camera.position, pxAngle(), 1.35);
    S.tip.copy(tip);
    return tip;
  }
  function drawLine() {
    const Ln = S.line;
    const show = Ln.visible && Ln.from && Ln.to && firstPerson();
    line.mesh.visible = !!show;
    if (!show) return;
    // if the caller drew the line from the tip we returned, follow the tip as the camera settles this frame
    const from = Math.hypot(Ln.from.x - S.lastTip.x, Ln.from.y - S.lastTip.y, Ln.from.z - S.lastTip.z) < 0.25 ? S.tip : Ln.from;
    line.build(from, Ln.to, Ln.slack, Ln.flying, camera.position, pxAngle());
  }

  /* ---------------- lure ---------------- */
  const qTmp = new THREE.Quaternion(), mTmp = new THREE.Matrix4(), vA = new THREE.Vector3(), vB = new THREE.Vector3();
  function drawLure(dt) {
    const Lr = S.lure, g = lure.group;
    const show = Lr.visible && firstPerson();
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
  const unitLen = (m) => (m.userData.kind === "junk" ? JUNK_LEN[m.userData.id] : 1);
  function drawFish(dt) {
    const f = S.fish;
    for (const [id, m] of fishCache) if (!f || id !== f.id) m.visible = false;
    if (!f) { S.jumpWas = 0; return; }
    const m = getFish(f.id);
    if (!m) return;
    const u = m.userData.fx, len = f.len || 0.4;
    m.visible = true;
    // a leap far out is drawn a little larger, so the moment reads on a phone
    const far = (f.jump || 0) > 0 ? 1 + 0.5 * smooth(8, 30, Math.hypot(f.x - EYEV.x, f.z - EYEV.z)) : 1;
    m.scale.setScalar((len / unitLen(m)) * far);
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
    const len = g.len || 0.4;
    shadow.scale.set(len * 1.35, 1, len * 1.35);
    shadow.userData.u.uAlpha.value = S.followA * 0.75 * clamp(Math.exp((g.y || -0.5) * 0.3), 0.3, 1);
  }

  /* ---------------- water effects ---------------- */
  function ripple(x, z, size = 0.5) {
    WU.uRip.value[S.rip].set(x, z, U.uTime.value, clamp(size, 0.05, 2));
    S.rip = (S.rip + 1) % E.RIPPLES;
  }
  function splashAt(x, z, size = 0.5) {
    ripple(x, z, size * 1.2);
    spray.burst(x, z, clamp(size, 0.1, 1.6));
    S.lastSplash = { x, z, t: S.clock };
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
  // photo: a slow push-in first (WORLD.PHOTO), for a trophy, a legend or a fish that opens a place.
  function showCatch(id, kg, { photo = false } = {}) {
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
    S.trophy = { mesh: stage, pivot, inner: m, board, behind, len, W, H, dist: 1, fov: 40, t: 0, sw: 0, junk, id, photo, push: photo ? WORLD.PHOTO.from : 1, pitch: CATCH_PITCH };
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
    const needV = (w, h, d) => Math.max(2 * Math.atan(w / 0.72 / 2 / d / aspect), 2 * Math.atan(h / 0.78 / 2 / d)) / DEG;
    T.fov = clamp(needV(W, H, d0), 14, 78);
    const tv = Math.tan(T.fov * DEG / 2);
    T.dist = Math.max(d0, W / 0.72 / 2 / (tv * aspect), H / 0.78 / 2 / tv);
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
    // the photo beat: the view eases in from far away, then the fish holds still for a moment
    if (T.photo) T.push = lerp(P.from, 1, 1 - Math.pow(1 - clamp(T.t / P.push, 0, 1), 3));
    const frozen = T.photo && T.t > P.push && T.t < P.push + P.freeze;
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
    // the legend glitters
    if (T.id === "golden" && Math.random() < dt * 12) spray.emit(p.x + (Math.random() - 0.5) * T.len, p.y + (Math.random() - 0.5) * T.len * 0.3, p.z + (Math.random() - 0.5) * 0.1, 0, 0.08, 0, 0.012, 1.2, 1, 0);
  }

  /* ---------------- per frame ---------------- */
  function update(dt) {
    dt = clamp(dt || 0, 0, 0.1);
    S.clock += dt;
    U.uTime.value = S.clock % 3600;
    updateCamera(dt);
    drawLoon(dt);
    drawFish(dt);
    drawFollower(dt);
    drawTrophy(dt);
    // the aim line fades in and out; it only belongs to the cast view
    S.aim.a += ((S.aim.visible && S.view.mode === "cast" ? 0.75 : 0) - S.aim.a) * (1 - Math.exp(-dt * 6));
    const ay = (S.aim.yaw || 0) * DEG;
    WU.uAim.value.set(Math.sin(ay), -Math.cos(ay), S.aim.a, PL.stand.dock.z0);
    // gold rings glow and throw up sparkles
    halos.forEach((h, i) => {
      const r = S.rings[i];
      h.visible = !!(r && r.gold) && firstPerson();
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
    rod.mesh.visible = S.rod.visible && firstPerson() && camera.fov > baseFov(S.view.mode) * 0.8;
    if (rod.mesh.visible) poseRod();
    drawLine();
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
      artStyle.value = currentStyle === "ghibli" ? 1 : 0;
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
      resScale = 1;
      renderer.setPixelRatio(ratio());
      renderer.setSize(S.w, S.h);
      buildEnv();
      sky.material.defines.OCT = low ? 3 : 5; sky.material.needsUpdate = true;
      water.material.defines.LOW = low ? 1 : 0; water.material.needsUpdate = true;
    },
    // inset: the part of the width (from the right) that a card covers, for the catch view
    setView({ mode = "cast", yaw = 0, look = null, portrait = false, inset = 0 } = {}) {
      const refit = inset !== (S.view.inset || 0);
      S.view = { mode, yaw, look, portrait, inset };
      if (refit) fitTrophy();
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
      const p = gripPoint().project(camera);
      return { x: (p.x + 1) * S.w / 2, y: (1 - p.y) * S.h / 2 };
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
    setAim({ yaw = 0, visible = true } = {}) { S.aim.yaw = yaw; S.aim.visible = visible; },
    ripple, splash: splashAt, rise,
    setHour,
    showCatch, hideCatch,
    update, render,
    info() {
      const m = renderer.info.memory;
      return { calls: S.info.calls, tris: S.info.tris, fps: Math.round(S.fps), scale: +resScale.toFixed(2), mem: { geometries: m.geometries, textures: m.textures } };
    },
    place: () => PL,
    // one trip at a time: a second call waits for the first
    setPlace(next) {
      const trip = travel.then(() => goTo(next));
      travel = trip.catch(() => {});
      return trip;
    },
    // main.js reports each frame's time in ms: long frames lower the render scale, short ones raise it again
    frameTime(ms) {
      if (!(ms > 0) || ms > 250 || document.hidden) return;
      ftAvg += (ms - ftAvg) * 0.05;
      if ((ftHold -= ms) > 0) return;
      if (ftAvg > 22 && resScale > 0.6) { resScale = Math.max(0.6, resScale * 0.85); renderer.setPixelRatio(ratio()); ftHold = 1500; }
      else if (ftAvg < 14 && resScale < 1) { resScale = Math.min(1, resScale * 1.08); renderer.setPixelRatio(ratio()); ftHold = 4000; }
    },
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

  setHour(12);
  const rect = container.getBoundingClientRect();
  resize(rect.width || window.innerWidth, rect.height || window.innerHeight);
  updateCamera(0);
  await warmUp();
  if (artStyle.value) E.loadStorySky().then(render);
  return world;
}
