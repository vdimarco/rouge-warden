// Reel It In: the 3D lake. One canvas with the sky, Loon Lake, the dock under your feet, the rod in your hands,
// the line, the lure, the fish and the trophy. Everything is built in code (see world-env, world-gear, world-fish, world-fx).
import * as THREE from "three";
import { EYE, ROD, DOCK } from "./lake.js";
import { byId, lengthFor } from "./species.js";
import * as E from "./world-env.js";
import { Rod, Line, Lure } from "./world-gear.js";
import { fishMesh as makeFish, JUNK_LEN } from "./world-fish.js";
import { Spray, followerShadow } from "./world-fx.js";

export { fishMesh } from "./world-fish.js";

const { U, clamp, lerp, smooth } = E;
const DEG = Math.PI / 180;
// Colours are authored as they should look on screen, and lit in that space (a painted look, not a photo).
THREE.ColorManagement.enabled = false;

// Tunables
export const WORLD = {
  DPR: { high: 2, low: 1.25 },
  FOV_H: { title: 78, cast: 70, flight: 70, reel: 80, catch: 60 },  // horizontal field of view to aim for, degrees
  FOV_V_PORTRAIT: [58, 90],        // the vertical field of view is kept inside these on tall screens
  FOV_V_WIDE: [42, 62],            // and inside these on wide screens
  PITCH_CAST: { wide: -5, portrait: -11 },
  ZOOM_WIDTH: 42,                  // flight view: meters of lake across the view at the lure, once the lure is far
  GRIP: { d: 0.5, x: 0.6, y: -0.74, px: 0.66, py: -0.6 },  // where the reel seat sits in the view (screen fractions)
  LURE_MIN_SCREEN: 0.022,          // the lure is drawn at least this fraction of the view height
};

/* ---------------- the hours ---------------- */
// Keyframes of the day. Colours are sRGB hex; si = sun strength, hi = sky light strength.
const HOURS = [
  { h: 4.5, zen: "#0e1634", hor: "#2e3658", glow: "#3a2440", sun: "#ff8a50", si: 0, sky: "#6a78a8", gnd: "#2a3024", hi: 1.9, fog: "#2e3658", near: 50, far: 520, deep: "#0c1622", shal: "#1a2622", cl: "#3a4260", cs: "#1c2240", forest: "#10180f", night: 1 },
  { h: 5.5, zen: "#2e4278", hor: "#c2908a", glow: "#e8866a", sun: "#ff9a60", si: 0.25, sky: "#9aa4c8", gnd: "#3a4028", hi: 2.1, fog: "#b69a9a", near: 30, far: 440, deep: "#1a2c3a", shal: "#3a4436", cl: "#e8b0a0", cs: "#6a6a8a", forest: "#1c2a1c", night: 0.35 },
  { h: 6.5, zen: "#5a86c4", hor: "#f4caa6", glow: "#ffb070", sun: "#ffc890", si: 1.15, sky: "#a8c0e0", gnd: "#4a5230", hi: 2.0, fog: "#e6c8b0", near: 35, far: 480, deep: "#224050", shal: "#58623e", cl: "#fff0dc", cs: "#9aa0b4", forest: "#28402a", night: 0 },
  { h: 9, zen: "#4f92e0", hor: "#d4e6f2", glow: "#fff0d0", sun: "#fff0d8", si: 1.65, sky: "#b8d4f0", gnd: "#5a6a38", hi: 1.65, fog: "#c8dcea", near: 80, far: 760, deep: "#1e4a60", shal: "#6a7446", cl: "#ffffff", cs: "#a8b8cc", forest: "#2c4a30", night: 0 },
  { h: 12, zen: "#3f86dc", hor: "#cfe4f6", glow: "#fff8e0", sun: "#fff8ea", si: 1.8, sky: "#bcd8f4", gnd: "#5e6e3a", hi: 1.6, fog: "#c6dcee", near: 95, far: 820, deep: "#1a4a64", shal: "#6e7a4a", cl: "#ffffff", cs: "#aebdd0", forest: "#2e4c32", night: 0 },
  { h: 16.5, zen: "#4a8cdc", hor: "#dbe6ea", glow: "#fff0c8", sun: "#fff0d0", si: 1.7, sky: "#c0d6ec", gnd: "#5e6a38", hi: 1.6, fog: "#d2dee6", near: 85, far: 780, deep: "#1c4860", shal: "#6e7648", cl: "#fffaf0", cs: "#b0b8c8", forest: "#2c4a30", night: 0 },
  { h: 19, zen: "#5c86c8", hor: "#ffd8a0", glow: "#ffb452", sun: "#ffc47a", si: 1.65, sky: "#b0c0dc", gnd: "#5a5a34", hi: 1.5, fog: "#f2d6b2", near: 45, far: 580, deep: "#23405a", shal: "#6a6a42", cl: "#fff0d8", cs: "#b4a4b0", forest: "#2c3e2c", night: 0 },
  { h: 19.5, zen: "#5a80c2", hor: "#ffcf92", glow: "#ffa640", sun: "#ffb86a", si: 1.55, sky: "#aab8d4", gnd: "#585432", hi: 1.5, fog: "#f0cfa4", near: 42, far: 560, deep: "#223c56", shal: "#686640", cl: "#ffe8c8", cs: "#b098a8", forest: "#2a3a2a", night: 0 },
  { h: 20.3, zen: "#4a5ea8", hor: "#ff9e70", glow: "#ff7a44", sun: "#ff8e58", si: 0.9, sky: "#a0a0c4", gnd: "#4a4630", hi: 1.6, fog: "#d8a08a", near: 40, far: 520, deep: "#1e3048", shal: "#4a4636", cl: "#ffb89a", cs: "#8a7090", forest: "#202c22", night: 0.05 },
  { h: 21, zen: "#222a62", hor: "#b86a7e", glow: "#e0684a", sun: "#ff6a40", si: 0.12, sky: "#9a90c0", gnd: "#3a3630", hi: 2.2, fog: "#7a5a78", near: 38, far: 480, deep: "#141e34", shal: "#2a2e30", cl: "#d88a88", cs: "#4a4468", forest: "#161e1a", night: 0.45 },
  { h: 22, zen: "#0e1634", hor: "#2e3658", glow: "#3a2440", sun: "#ff6a40", si: 0, sky: "#6a78a8", gnd: "#2a3024", hi: 1.9, fog: "#2e3658", near: 50, far: 520, deep: "#0c1622", shal: "#1a2622", cl: "#3a4260", cs: "#1c2240", forest: "#10180f", night: 1 },
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function lerpHex(out, a, b, t) { tmpA.set(a); tmpB.set(b); return out.copy(tmpA).lerp(tmpB, t); }
// Sun path: rises in the north-east, high in the south at noon, sets in the north-west (a summer day, a little
// stretched so the evening sun hangs over the far west shore where the angler can see it).
export function sunAt(h) {
  const elev = 58 * Math.sin(Math.PI * (h - 5.8) / 15) * DEG;
  const az = clamp(180 + (h - 12.8) * 18.5, 40, 332) * DEG;  // from north (-z), clockwise toward east (+x)
  return new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev));
}

/* ---------------- the world ---------------- */

export async function createWorld(container, { quality = "high" } = {}) {
  let low = quality === "low";
  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? WORLD.DPR.low : WORLD.DPR.high));
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcccccc, 120, 900);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.08, 1400);
  camera.rotation.order = "YXZ";
  const hemi = new THREE.HemisphereLight(0xbcd8f4, 0x5e6e3a, 1.2);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, sun, sun.target);

  /* the lake: pieces that depend on the quality are rebuilt when it changes */
  const sky = E.buildSky(low);
  const { water, u: WU } = E.buildWater(low);
  scene.add(sky, water);
  let envGroup = null, terrainMesh = null;
  function buildEnv() {
    if (envGroup) { scene.remove(envGroup); envGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    envGroup = new THREE.Group();
    terrainMesh = new THREE.Mesh(E.buildTerrain(low), E.terrainMaterial(low));
    envGroup.add(terrainMesh, E.buildTrees(low), E.buildPads(low), E.buildReeds(low));
    scene.add(envGroup);
  }
  buildEnv();
  const rocks = E.buildRocks(), dock = E.buildDock(), cottage = E.buildCottage(), loon = E.buildLoon();
  scene.add(rocks, dock, cottage, loon);

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
    clock: 0, hour: 12, w: 1, h: 1, portrait: false,
    view: { mode: "title", yaw: 0, look: null, portrait: false },
    cam: { pos: new THREE.Vector3(0, 9, 30), yaw: 0, pitch: -0.1, fov: 55, init: false },
    rod: { theta: 60, yaw: 0, steer: 0, bend: 0, pull: null, visible: false },
    tip: new THREE.Vector3(ROD.base.x, ROD.base.y + ROD.length, ROD.base.z),
    lastTip: new THREE.Vector3(),
    line: { from: null, to: null, slack: 0, visible: false, flying: false },
    lure: { x: 0, y: 1, z: -1, visible: false, spin: 0, vel: new THREE.Vector3(), prev: null, prevT: 0 },
    fish: null, fishShown: null, jumpWas: 0, jumpSplashed: false,
    follower: null, followA: 0,
    rings: [], aim: { yaw: 0, visible: false, a: 0 },
    rip: 0,
    loon: { t: 40, dive: 0 },
    trophy: null,
    fps: 60, lastRender: 0, info: { calls: 0, tris: 0 },
  };

  /* ---------------- hours ---------------- */
  function setHour(h) {
    h = clamp(h, 4.5, 22);
    S.hour = h;
    let i = 0;
    while (i < HOURS.length - 2 && HOURS[i + 1].h < h) i++;
    const a = HOURS[i], b = HOURS[i + 1], t = clamp((h - a.h) / (b.h - a.h), 0, 1);
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
    U.uFogNear.value = num("near"); U.uFogFar.value = num("far");
    scene.fog.color.copy(U.uFogCol.value); scene.fog.near = U.uFogNear.value; scene.fog.far = U.uFogFar.value;
    const sd = sunAt(h);
    U.uSunDir.value.copy(sd);
    // the sun light fades as it nears the horizon; below it, only the sky lights the lake
    const vis = smooth(-0.04, 0.08, sd.y);
    U.uSunVis.value = vis;
    sun.position.copy(sd).multiplyScalar(100);
    sun.color.copy(U.uSunCol.value);
    sun.intensity = num("si") * vis;
    lerpHex(hemi.color, a.sky, b.sky, t);
    lerpHex(hemi.groundColor, a.gnd, b.gnd, t);
    hemi.intensity = num("hi");
    // foam and the line catch the light of the hour
    U.uFoam.value.copy(U.uHorizon.value).lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(0.55 + 0.45 * vis);
    line.mat.color.setRGB(0.95, 0.94, 0.78).multiplyScalar(0.45 + 0.55 * Math.max(vis, 0.3));
    spray.u.uCol.value.copy(U.uFoam.value).multiplyScalar(1.3);
    for (const g of fishCache.values()) g.userData.fx.uWater.value.copy(U.uDeep.value);
    lure.fx.uWater.value.copy(U.uDeep.value);
  }

  /* ---------------- camera ---------------- */
  const EYEV = new THREE.Vector3(EYE.x, EYE.y, EYE.z);
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  function baseFov(mode) {
    const aspect = S.w / S.h, portrait = S.view.portrait || aspect < 0.9;
    const hf = (WORLD.FOV_H[mode] || 70) * DEG;
    const v = 2 * Math.atan(Math.tan(hf / 2) / aspect) / DEG;
    const [lo, hi] = portrait ? WORLD.FOV_V_PORTRAIT : WORLD.FOV_V_WIDE;
    return clamp(v, lo, hi);
  }
  const CATCH_CAM = new THREE.Vector3(0.12, 2.05, 1.05), CATCH_PITCH = -36 * DEG, CATCH_YAW = -3 * DEG;
  const trophySpot = () => {
    // the fish is held out toward the end of the dock, below the eye
    const d = S.trophy ? S.trophy.dist : 1.1;
    return new THREE.Vector3(Math.sin(CATCH_YAW) * Math.cos(CATCH_PITCH), Math.sin(CATCH_PITCH), -Math.cos(CATCH_YAW) * Math.cos(CATCH_PITCH)).multiplyScalar(d).add(CATCH_CAM);
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
      out.pos.set(7 + 5 * Math.sin(t * 0.021), 6 + 0.8 * Math.sin(t * 0.031), 7 + 3 * Math.cos(t * 0.017));
      const sunAz = Math.atan2(sd.x, -sd.z), low = 1 - smooth(0.25, 0.6, sd.y);
      out.yaw = lerp(-12 * DEG, clamp(sunAz * 0.72, -48 * DEG, 42 * DEG), low * 0.9) + 7 * DEG * Math.sin(t * 0.013);
      out.pitch = -4 * DEG;
      out.rate = 1.2; out.posRate = 0.9;
    } else if (m === "flight") {
      const L = S.view.look || S.lure;
      const dh = Math.hypot(L.x - EYE.x, L.z - EYE.z);
      const base = { yaw: out.yaw, pitch: out.pitch };
      lookAt(L, 0.04);
      // near the dock (the back cast) keep looking out over the lake instead of spinning round
      const w = smooth(4, 12, dh) * (L.z < EYE.z - 1 ? 1 : 0);
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
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
  }
  const pxAngle = () => (2 * Math.tan(camera.fov * DEG / 2)) / Math.max(1, S.h * renderer.getPixelRatio());

  /* ---------------- rod and line ---------------- */
  const firstPerson = () => S.view.mode !== "title" && S.view.mode !== "catch";
  function gripPoint() {
    const portrait = S.view.portrait || S.w / S.h < 0.9;
    const G = WORLD.GRIP, d = G.d;
    const tv = Math.tan(camera.fov * DEG / 2), th = tv * camera.aspect;
    // in the zoomed flight view the rod slides down out of the way
    const zoomed = clamp(1 - camera.fov / baseFov(S.view.mode === "flight" ? "flight" : "cast"), 0, 1);
    const nx = portrait ? G.px : G.x, ny = (portrait ? G.py : G.y) - zoomed * 2.2;
    return new THREE.Vector3(nx * d * th, ny * d * tv, -d).applyMatrix4(camera.matrixWorld);
  }
  function poseRod() {
    const R = S.rod;
    const yaw = (R.yaw + (R.steer || 0) * 35) * DEG, th = R.theta * DEG;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(th), Math.sin(th), -Math.cos(yaw) * Math.cos(th)).normalize();
    const pull = R.pull ? new THREE.Vector3(R.pull.x, R.pull.y, R.pull.z) : null;
    const tip = rod.pose(gripPoint(), dir, R.bend || 0, pull, camera.position, pxAngle());
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
    // blade spin: rev/s from the caller, or from the speed through the water
    const rps = Lr.spin > 0 ? Lr.spin : Lr.y < 0 ? sp * 6 : 0;
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
    const far = (f.jump || 0) > 0 ? 1 + 0.5 * smooth(8, 30, Math.hypot(f.x - EYE.x, f.z - EYE.z)) : 1;
    m.scale.setScalar((len / unitLen(m)) * far);
    const j = clamp(f.jump || 0, 0, 1), heading = f.heading || 0;
    let y = f.y, pitch = 0, roll = 0;
    const fwd = new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading));
    let x = f.x, z = f.z;
    if (j > 0) {
      // a leap: out of the water nose first, arc over, and back in
      const H = 0.35 + len * 0.9;
      y = Math.max(f.y, -0.1) + 4 * j * (1 - j) * H;
      pitch = (0.5 - j) * 2.2;
      x += fwd.x * (j - 0.5) * len * 1.2; z += fwd.z * (j - 0.5) * len * 1.2;
      roll = Math.sin(S.clock * 14) * 0.3 * (f.thrash || 0.5);
      if (S.jumpWas === 0) { splashAt(x, z, 0.4 + len * 0.6); S.jumpSplashed = false; }
      if (j > 0.82 && !S.jumpSplashed) { splashAt(x + fwd.x * len * 0.4, z + fwd.z * len * 0.4, 0.45 + len * 0.7); S.jumpSplashed = true; }
      // water streams off the fish in the air
      for (let k = 0; k < 3; k++) if (Math.random() < dt * 30) {
        const s = (Math.random() - 0.5) * len;
        spray.emit(x + fwd.x * s, y + (Math.random() - 0.3) * len * 0.1, z + fwd.z * s, (Math.random() - 0.5) * 1.2 - fwd.x * 0.8, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2 - fwd.z * 0.8, 0.05 + Math.random() * 0.05, 0.7);
      }
    } else if (S.jumpWas > 0 && !S.jumpSplashed) { splashAt(x, z, 0.45 + len * 0.7); }
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
    shadow.visible = S.followA > 0.01 && !!(f || S.followLast);
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
  }
  function rise(x, z) {
    ripple(x, z, 0.35);
    for (let k = 0; k < 6; k++) { const a = Math.random() * 6.28; spray.emit(x, 0.02, z, Math.cos(a) * 0.4, 0.8 + Math.random() * 0.8, Math.sin(a) * 0.4, 0.025, 0.4); }
  }

  /* ---------------- loon ---------------- */
  function drawLoon(dt) {
    const L = S.loon;
    L.t += dt;
    // it paddles a slow loop out in the bay, and now and then dives and comes up somewhere else
    const cyc = L.t % 75, under = cyc > 60;
    const a = L.t * 0.018, cx = 12, cz = -44, r = 11;
    const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
    const hd = Math.atan2(Math.cos(a), -Math.sin(a));
    if (under !== !loon.visible) ripple(x, z, 0.5);
    loon.visible = !under;
    loon.position.set(x, 0.02 + Math.sin(S.clock * 1.3) * 0.012, z);
    loon.rotation.y = -hd;
    const sp = r * 0.018;
    WU.uLoon.value.set(x, z, under ? 0 : Math.sin(hd) * sp * 3, under ? 0 : -Math.cos(hd) * sp * 3);
  }

  /* ---------------- the trophy ---------------- */
  function showCatch(id, kg) {
    hideCatch();
    const m = makeFish(id);
    if (!m) return;
    const sp = byId(id), junk = m.userData.kind === "junk";
    const len = junk ? JUNK_LEN[id] : lengthFor(sp, kg || sp.kg[0]) / 100;
    m.scale.setScalar(len / unitLen(m));
    for (const mt of m.userData.mats) mt.transparent = false;
    m.traverse((o) => { o.renderOrder = 30; });
    m.userData.fx.uKey.value = 1;
    // turn on a stage around its middle; its size as shown: the long side across, its height up
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    m.position.copy(mid).negate();
    const stage = new THREE.Group();
    stage.add(m);
    const W = id === "frisbee" ? size.x : size.z, H = id === "frisbee" ? size.x * 0.95 : size.y * 1.1;
    // hold it out at a distance that fits both ways, and narrow the view for a small fish
    const aspect = S.w / S.h;
    const d0 = clamp(Math.max(W, H) * 1.3, 0.42, 1.5);
    const needV = (w, h, d) => Math.max(2 * Math.atan(w / 0.72 / 2 / d / aspect), 2 * Math.atan(h / 0.78 / 2 / d)) / DEG;
    const fov = clamp(needV(W, H, d0), 14, 78);
    const tv = Math.tan(fov * DEG / 2);
    const dist = Math.max(d0, W / 0.72 / 2 / (tv * aspect), H / 0.78 / 2 / tv);
    S.trophy = { mesh: stage, inner: m, len, dist, fov, t: 0, junk, id };
    scene.add(stage);
  }
  function hideCatch() {
    if (!S.trophy) return;
    scene.remove(S.trophy.mesh);
    S.trophy.mesh.traverse((o) => { if (o.material) o.material.dispose(); });
    S.trophy = null;
  }
  function drawTrophy(dt) {
    const T = S.trophy;
    if (!T) return;
    T.t += dt;
    const m = T.mesh;
    m.visible = S.view.mode === "catch";
    const p = trophySpot();
    // face the camera: the stage turns with the view, the fish swings slowly on it
    m.position.copy(p);
    m.position.y += Math.sin(T.t * 1.4) * 0.01;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(S.cam.pitch, -S.cam.yaw, 0, "YXZ"));
    const spin = new THREE.Quaternion();
    if (T.id === "frisbee") spin.setFromEuler(new THREE.Euler(1.2, T.t * 0.5, 0, "XYZ"));
    else spin.setFromEuler(new THREE.Euler(0.08 * Math.sin(T.t * 0.9), Math.PI / 2 + 0.5 * Math.sin(T.t * 0.55), 0.1 * Math.sin(T.t * 0.7), "YXZ"));
    m.quaternion.copy(q).multiply(spin);
    const u = T.inner.userData.fx;
    u.uWag.value.set(T.t * 3, T.junk ? 0 : 0.12, 0, 0);
    u.uUnder.value = 0; u.uAlpha.value = 1;
    if (Math.random() < dt * 3 && !T.junk) spray.emit(p.x + (Math.random() - 0.5) * T.len * 0.6, p.y - 0.05, p.z, 0, -0.3, 0, 0.012, 0.8);
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
    // the aim line fades in and out
    S.aim.a += ((S.aim.visible && firstPerson() ? 0.75 : 0) - S.aim.a) * (1 - Math.exp(-dt * 6));
    const ay = (S.aim.yaw || 0) * DEG;
    WU.uAim.value.set(Math.sin(ay), -Math.cos(ay), S.aim.a, 0);
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
    renderer.render(scene, camera);
    S.info.calls = renderer.info.render.calls;
    S.info.tris = renderer.info.render.triangles;
    const now = performance.now();
    if (S.lastRender) S.fps = S.fps * 0.9 + (1000 / Math.max(1, now - S.lastRender)) * 0.1;
    S.lastRender = now;
  }

  function resize(w, h) {
    S.w = Math.max(1, w | 0); S.h = Math.max(1, h | 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? WORLD.DPR.low : WORLD.DPR.high));
    renderer.setSize(S.w, S.h);
    applyCamera();
  }

  const world = {
    renderer, scene, camera,
    resize,
    setQuality(q) {
      const nl = q === "low";
      if (nl === low) return;
      low = nl;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? WORLD.DPR.low : WORLD.DPR.high));
      renderer.setSize(S.w, S.h);
      buildEnv();
      sky.material.defines.OCT = low ? 3 : 5; sky.material.needsUpdate = true;
      water.material.defines.LOW = low ? 1 : 0; water.material.needsUpdate = true;
    },
    setView({ mode = "cast", yaw = 0, look = null, portrait = false } = {}) {
      if (mode !== S.view.mode && mode === "catch") S.cam.pitch = Math.min(S.cam.pitch, 0);
      S.view = { mode, yaw, look, portrait };
    },
    setRod({ theta = 60, yaw = 0, steer = 0, bend = 0, pull = null, visible = true } = {}) {
      S.rod = { theta, yaw, steer, bend, pull, visible };
      applyCamera();
      const tip = poseRod();
      S.lastTip.copy(tip);
      return { x: tip.x, y: tip.y, z: tip.z };
    },
    tip() { return { x: S.tip.x, y: S.tip.y, z: S.tip.z }; },
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
    info() { return { calls: S.info.calls, tris: S.info.tris, fps: Math.round(S.fps) }; },
  };

  setHour(12);
  const rect = container.getBoundingClientRect();
  resize(rect.width || window.innerWidth, rect.height || window.innerHeight);
  updateCamera(0);
  // compile the shaders now (fish, junk and lure included) so the first bite does not stutter
  const warm = [getFish("smallmouth"), getFish("boot")];
  warm.forEach((m) => { m.visible = true; m.position.set(0, 1, -3); });
  lure.group.visible = true; rod.mesh.visible = true; line.mesh.visible = true; shadow.visible = true;
  try {
    if (renderer.compileAsync && renderer.extensions.has("KHR_parallel_shader_compile")) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
  } catch (e) { /* compile on first draw instead */ }
  warm.forEach((m) => { m.visible = false; });
  lure.group.visible = false; rod.mesh.visible = false; line.mesh.visible = false; shadow.visible = false;
  return world;
}
