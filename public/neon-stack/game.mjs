// Neon Stack: one loop, plain objects, camera snapped once per frame.
import { TILE, build, pathfind, RUNNER_BOX, hackStep, rayHits, hitsMachine } from "./world.mjs";
import { atlasUrl } from "./art/atlas-data.mjs";
import { createRenderer, lookAt, perspective, mul } from "./render.mjs";

const FOV_PORTRAIT = 20 * Math.PI / 180;
const FOV_LAND = 30 * Math.PI / 180;
const RUNNER_SCALE = 1.64 / 1.5 * (1.64 / 1.66);
const TILES = 10;
const SUN = norm([0.48, 0.84, 0.26]);
const HAZE = [0x1f / 255, 0x2a / 255, 0x3a / 255];
const SMOG = [0x8a / 255, 0x83 / 255, 0x78 / 255];
const canvas = document.getElementById("view");
const params = new URLSearchParams(location.search);
const world = build(params.get("seed") || 1);
const renderer = createRenderer(canvas);
let lastDt = 1 / 60;

const player = { x: world.spawn.x, y: world.spawn.y };
let yaw = 20;
let tilt = 55;
let attract = true;
let eatClick = false;
let cutaway = true;
let route = [];
let time = 0;
const override = [null, null, null, null, null, null];
const fade = [1, 1, 1, 1, 1, 1];
let facing = 1;
let head = 0;
let faceWant = 1;
let faceT = 1;
let moving = false;
let speed = 0;
const stick = { x: 0, y: 0 };
let stickTimer = 0;
let wish = { x: 0, y: -1 };
let pose = "";
const keys = new Set();
const active = new Map();
let dragged = false;
let multi = false;
const samples = [];
let frameMs = 0;
let fps = 0;
let ready = false;
const dpr0 = window.devicePixelRatio || 1;
const locked = params.get("ratio");
let ratio = locked ? Math.min(Number(locked), dpr0) : Math.min(dpr0, 1.5);
let cool = 0;
let hack = { held: 0, flash: 0, cool: 0 };
let holding = false;
let warmed = 0;
const drops = new Float32Array(120);
for (let i = 0; i < 60; i++) {
  drops[i * 2] = (i * 97) % 311;
  drops[i * 2 + 1] = (i * 53) % 211;
}
const hz = 8 + (world.seed % 5);

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function wrap(d) { return ((d % 360) + 360) % 360; }
function clampTilt(d) { return Math.max(20, Math.min(87, d)); }
function phone() { return window.innerWidth < 800; }
// In-plane half-width so the skyline meets both side edges. axis 0 extends in X, 1 in Z.
function skyHalf(cam, focus, fov, aspect, sky, axis) {
  const f = norm(sub(focus, cam));
  let right = cross(f, [0, 1, 0]);
  const rl = Math.hypot(right[0], right[1], right[2]) || 1;
  right = right.map((v) => v / rl);
  const rel = sub(sky, cam);
  const A = dot(rel, right);
  const B = Math.max(1, dot(rel, f));
  const tanH = Math.tan(fov / 2) * aspect;
  const ax = axis === 0 ? [1, 0, 0] : [0, 0, 1];
  const rx = dot(ax, right), fx = dot(ax, f);
  const hxR = (tanH * B - A) / (rx - tanH * fx || 1e-4);
  const hxL = (-tanH * B - A) / (rx + tanH * fx || 1e-4);
  const hx = Math.max(Math.abs(hxR), Math.abs(hxL)) * 1.06;
  return Math.min(28 * TILE, Math.max(2 * TILE, hx));
}
// One quad past the far side of the block, facing the camera, so a turn cannot
// swing it across a lot. Depth test keeps every building in front.
function placeSky(cam, focus, fov, aspect) {
  const f = norm(sub(focus, cam));
  const depthOf = (x, y, z) => (x - cam[0]) * f[0] + (y - cam[1]) * f[1] + (z - cam[2]) * f[2];
  const span = 6 * TILE;
  let farD = -1e9;
  for (const x of [0, span]) for (const z of [0, span]) for (const y of [0, 7 * TILE]) {
    farD = Math.max(farD, depthOf(x, y, z));
  }
  const fl = Math.hypot(f[0], f[2]) || 1;
  const fx = f[0] / fl, fz = f[2] / fl;
  const axisX = Math.abs(fx) >= Math.abs(fz);
  const sign = axisX ? (fx >= 0 ? 1 : -1) : (fz >= 0 ? 1 : -1);
  const y0 = 3.7 * TILE, hz = 1.6 * TILE;
  let gap = 0.6 * TILE;
  let sx = 3 * TILE, sz = -1.2 * TILE, hx = 8 * TILE, orient = 2;
  for (let n = 0; n < 10; n++) {
    const plane = sign > 0 ? span + gap : -gap;
    if (axisX) {
      const denom = Math.abs(f[0]) < 1e-4 ? 1e-4 : f[0];
      const t = (plane - cam[0]) / denom;
      sx = plane;
      sz = cam[2] + f[2] * t;
      orient = 1;
    } else {
      const denom = Math.abs(f[2]) < 1e-4 ? 1e-4 : f[2];
      const t = (plane - cam[2]) / denom;
      sz = plane;
      sx = cam[0] + f[0] * t;
      orient = 2;
    }
    hx = skyHalf(cam, focus, fov, aspect, [sx, y0, sz], axisX ? 1 : 0);
    const pts = [];
    for (const du of [-hx, hx]) for (const dy of [-hz, hz]) {
      pts.push(axisX ? [sx, y0 + dy, sz + du] : [sx + du, y0 + dy, sz]);
    }
    const nearest = Math.min(...pts.map((p) => depthOf(p[0], p[1], p[2])));
    if (nearest > farD + 2) break;
    gap += TILE;
  }
  const plane = sign > 0 ? span + gap : -gap;
  return { x: sx, z: sz, hx, orient, sign, plane: axisX ? sx : sz, axisX };
}
function solid(tx, ty) {
  return tx < 0 || ty < 0 || tx >= 6 || ty >= 6 || world.blocked[tx][ty];
}
function free(x, y) { return !solid(Math.floor(x), Math.floor(y)) && !hitsMachine(x, y); }
function viewDelta(mx, my) {
  const yr = yaw * Math.PI / 180;
  const sy = my / Math.max(0.25, Math.sin(tilt * Math.PI / 180));
  const upx = -Math.sin(yr);
  const upz = -Math.cos(yr);
  const rx = -upz;
  const rz = upx;
  const len = Math.hypot(mx, sy) || 1;
  return [(mx * rx - sy * upx) / len, (mx * rz - sy * upz) / len];
}
function tryMove(dx, dy) {
  const nx = player.x + dx, ny = player.y + dy;
  if (free(nx, ny)) { player.x = nx; player.y = ny; return; }
  if (free(nx, player.y)) player.x = nx;
  else if (free(player.x, ny)) player.y = ny;
}
function hits(ax, az, bx, bz, box) {
  const dx = bx - ax, dz = bz - az;
  let t0 = 0, t1 = 1;
  const slabs = [[dx, ax, box.x - box.hx, box.x + box.hx], [dz, az, box.z - box.hz, box.z + box.hz]];
  for (const [d, o, min, max] of slabs) {
    if (Math.abs(d) < 1e-8) { if (o < min || o > max) return false; continue; }
    let tA = (min - o) / d, tB = (max - o) / d;
    if (tA > tB) { const s = tA; tA = tB; tB = s; }
    t0 = Math.max(t0, tA); t1 = Math.min(t1, tB);
    if (t0 > t1) return false;
  }
  return true;
}
let lastCam = [0, 0, 0];
for (const s of world.slices) s.uv0 = s.uv.slice();
function aim(s, cam, uv) {
  const o = s.orient || 0;
  const back = o >= 1.5 ? cam[2] < s.z : o > 0.5 && cam[0] > s.x;
  s.hx = (back ? -1 : 1) * Math.abs(s.hx);
  s.uv = back ? [uv[2], uv[1], uv[0], uv[3]] : uv;
}
let shownOutline = { on: 0, colour: [0, 0, 0] };
function camera() {
  const tr = tilt * Math.PI / 180;
  const yr = yaw * Math.PI / 180;
  const aspect = renderer.view.artW / Math.max(1, renderer.view.artH);
  const portrait = renderer.view.artH > renderer.view.artW;
  const fov = portrait ? FOV_PORTRAIT : FOV_LAND;
  const hold = Math.tan(FOV_PORTRAIT / 2);
  const lens = Math.tan(fov / 2);
  const span = Math.abs(Math.cos(yr)) + Math.abs(Math.sin(yr));
  const establishing = !attract && player.y > 4;
  const tiles = portrait
    ? (attract ? 8.4 : establishing ? 6 : 7.25) * span
    : (attract ? TILES + 1 : establishing ? 10 : TILES);
  const dist = (tiles * TILE) / (2 * hold * aspect);
  const cx = (attract ? 3 : player.x) * TILE;
  const cz = (attract ? 3 : player.y) * TILE;
  const along = attract ? 16 : establishing ? TILE * (portrait ? -2 : -0.3125) : 36;
  const lift = establishing ? TILE * (portrait ? 4.125 : 5.625) : 0;
  const focus = [cx + Math.sin(yr) * along, lift, cz + Math.cos(yr) * along];
  const cam = [
    focus[0] + Math.cos(tr) * Math.sin(yr) * dist,
    focus[1] + Math.sin(tr) * dist,
    focus[2] + Math.cos(tr) * Math.cos(yr) * dist,
  ];
  const forward = norm(sub(focus, cam));
  let right = cross(forward, [0, 1, 0]);
  const rl = Math.hypot(right[0], right[1], right[2]);
  right = rl < 1e-5 ? [1, 0, 0] : right.map((v) => v / rl);
  const up = cross(right, forward);
  const wpp = (2 * dist * lens) / renderer.view.artH;
  const rel = sub(focus, cam);
  const vx = dot(rel, right), vy = dot(rel, up);
  const sx = Math.round(vx / wpp) * wpp - vx;
  const sy = Math.round(vy / wpp) * wpp - vy;
  cam[0] -= right[0] * sx + up[0] * sy;
  cam[1] -= right[1] * sx + up[1] * sy;
  cam[2] -= right[2] * sx + up[2] * sy;
  lastCam = cam;
  return { cam, focus, dist };
}
function scatterRain() {
  const w = renderer.view.artW || 320;
  const h = renderer.view.artH || 200;
  if (scatterRain.w === w && scatterRain.h === h) return;
  scatterRain.w = w;
  scatterRain.h = h;
  for (let i = 0; i < 60; i++) {
    drops[i * 2] = (i * 97) % w;
    drops[i * 2 + 1] = (i * 53) % h;
  }
}
function fit() {
  const cssW = window.innerWidth, cssH = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  renderer.resize(cssW, cssH, dpr, ratio);
  const { backW, backH } = renderer.view;
  if (canvas.width !== backW || canvas.height !== backH) {
    canvas.width = backW;
    canvas.height = backH;
  }
}
function planes(dist) {
  return [Math.max(0.5, dist * 0.06), dist * 3.4];
}
function groundAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const { ox, oy, scale, artW, artH, backH } = renderer.view;
  const bx = (clientX - rect.left) * (canvas.width / rect.width);
  const byTop = (clientY - rect.top) * (canvas.height / rect.height);
  const ax = (bx - ox) / scale;
  const ay = artH - ((backH - byTop) - oy) / scale;
  if (ax < 0 || ay < 0 || ax >= artW || ay >= artH) return null;
  const hit = renderer.unproject(ax, ay);
  if (!hit) return null;
  return [hit[0] / TILE, hit[1] / TILE];
}
function onMachine(clientX, clientY) {
  const g = groundAt(clientX, clientY);
  if (!g) return false;
  const m = world.machine;
  const o = lastCam;
  const d = [g[0] * TILE - o[0], 0.05 - o[1], g[1] * TILE - o[2]];
  const span = [[m.x - m.hx, m.x + m.hx], [0, m.h], [m.z - m.hz, m.z + m.hz]];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-6) { if (o[i] < span[i][0] || o[i] > span[i][1]) return false; continue; }
    let a = (span[i][0] - o[i]) / d[i], b = (span[i][1] - o[i]) / d[i];
    if (a > b) { const s = a; a = b; b = s; }
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return t0 <= 1;
}
function walkAt(clientX, clientY) {
  const hit = groundAt(clientX, clientY);
  if (!hit) return;
  route = pathfind((x, y) => solid(x, y), player.x, player.y, hit[0], hit[1]);
}
function lightsNow() {
  const out = world.lights.map((l) => ({ ...l }));
  for (let i = 0; i < 6; i++) {
    const buzz = world.signs[i].buzz && (time % 3.6) < 0.08;
    const want = override[i] === false ? 0 : 1;
    const step = Math.min(Math.abs(want - fade[i]), lastDt / 0.15);
    fade[i] += Math.sign(want - fade[i]) * step;
    out[i].on = override[i] !== false && !buzz;
    out[i].intensity = buzz ? 0 : fade[i];
  }
  const fire = out.find((l) => l.type === "fire");
  if (fire) {
    const flick = 0.42 + 0.58 * Math.abs(Math.sin(time * hz * Math.PI * 2));
    fire.x += Math.sin(time * hz * 2.2) * 0.05;
    fire.z += Math.sin(time * hz * 3.1) * 0.35;
    fire.intensity = flick;
    fire.on = true;
  }
  return out;
}
function frameUV(name, flip) {
  const f = world.frames[name];
  let u0 = f.x / 1024, u1 = (f.x + f.w) / 1024;
  const v0 = 1 - (f.y + f.h) / 1024, v1 = 1 - f.y / 1024;
  if (flip) { const t = u0; u0 = u1; u1 = t; }
  return [u0, v0, u1, v1];
}
function flatPose() {
  return pose === "crouch" || pose === "hack" || pose === "spotted";
}
function runnerFrame() {
  if (pose === "idle") return "runner_idle";
  if (flatPose()) return "runner_" + pose;
  if (pose === "run" || moving) return "runner_run_" + (Math.floor(time * 8) % 2);
  return "runner_idle";
}
const STACK_N = 20;
const STACK_STEP = 1.2;
const stackSlots = Array.from({ length: STACK_N }, () => ({
  x: 0, z: 0, y: 0, hx: 0, hz: 0, uv: [0, 0, 0, 0],
  kind: 1, sign: 0, bid: -1, low: true, orient: 0,
}));
const outlineSlot = {
  x: 0, z: 0, y: 0, hx: 0, hz: 0, uv: [0, 0, 0, 0],
  kind: 1, sign: 2, bid: -1, low: true, orient: 2,
};
// Flat cards and the outline ring share the stack's ground slice and its crown height.
function placeCard(s, fr, name, boost) {
  const px = (TILE / 16) * RUNNER_SCALE;
  const box = RUNNER_BOX[name];
  const ground = 0.5 * STACK_STEP * px;
  const span = (STACK_N - 1) * STACK_STEP * px;
  // A flat card foreshortens; the stack's top face does not. Standing poses use 1.5.
  const scale = span / (24 * px) * boost;
  const foot = ground - (boost > 1.2 ? 8 * px : 0);
  s.hx = fr.w * px / 2 * scale;
  s.hz = fr.h * px / 2 * scale;
  s.y = foot + s.hz - box.bottom * px * scale;
}
function stackKey() {
  if (pose === "run" || (pose !== "idle" && moving)) return "runner_stack_run_" + (Math.floor(time * 8) % 2);
  return "runner_stack_idle";
}
function pushStack(runner) {
  const fr = world.frames[stackKey()];
  const px = (TILE / 16) * RUNNER_SCALE;
  const x = player.x * TILE;
  const z = player.y * TILE;
  for (let i = 0; i < STACK_N; i++) {
    const s = stackSlots[i];
    const x0 = fr.x + i * 12;
    s.x = x;
    s.z = z;
    s.y = (i + 0.5) * STACK_STEP * px;
    s.hx = 12 * px / 2;
    s.hz = 10 * px / 2;
    s.uv[0] = x0 / 1024;
    s.uv[1] = 1 - (fr.y + 10) / 1024;
    s.uv[2] = (x0 + 12) / 1024;
    s.uv[3] = 1 - fr.y / 1024;
    runner.push(s);
  }
}
function scene() {
  fit();
  const { cam, focus, dist } = camera();
  const aspect = renderer.view.artW / Math.max(1, renderer.view.artH);
  const portrait = renderer.view.artH > renderer.view.artW;
  const [near, far] = planes(dist);
  const view = lookAt(cam, focus, [0, 1, 0]);
  const proj = perspective(renderer.view.artH > renderer.view.artW ? FOV_PORTRAIT : FOV_LAND, renderer.view.artW / renderer.view.artH, near, far);
  const cuts = new Set();
  if (cutaway && !rayHits(cam[0], cam[2], player.x * TILE, player.y * TILE, world.machine)) {
    const px = player.x * TILE, pz = player.y * TILE;
    world.buildings.forEach((b, i) => { if (hits(cam[0], cam[2], px, pz, b)) cuts.add(i); });
    world.fillers.forEach((b) => { if (hits(cam[0], cam[2], px, pz, b)) cuts.add(b.bid); });
  }
  const lights = lightsNow();
  const runner = [];
  const rest = [];
  const runName = runnerFrame();
  const runFr = world.frames[runName];
  for (const s of world.slices) {
    if (s.kind === 1) {
      if (!flatPose()) continue;
      s.x = player.x * TILE;
      s.z = player.y * TILE;
      placeCard(s, runFr, runName, 1.5);
      s.uv = frameUV(runName, facing < 0);
      const yr = yaw * Math.PI / 180;
      s.orient = Math.abs(Math.sin(yr)) > Math.abs(Math.cos(yr)) ? 1 : 2;
      s.sign = 0;
      aim(s, cam, s.uv);
      runner.push(s);
    } else if (s.kind === 3 && s.sign >= 1) {
      const meta = world.signs[s.sign - 1];
      const on = override[s.sign - 1] !== false;
      s.uv = frameUV(meta.frame + (on ? "_on" : "_off"), false);
      if (s.bid < 0 || !cuts.has(s.bid) || s.low) rest.push(s);
    } else if (s.kind === 6) {
      s.uv = frameUV("steam_vent_" + (Math.floor(time * 8) % 4), false);
      aim(s, cam, s.uv);
      rest.push(s);
    } else if (s.kind === 5) {
      const placed = placeSky(cam, focus, portrait ? FOV_PORTRAIT : FOV_LAND, aspect);
      // Follow most of the walk so the sky shifts about a third as far as the lots,
      // and never cross back onto the block.
      const follow = 0.62;
      let x = placed.x + (player.x - world.spawn.x) * TILE * follow;
      let z = placed.z + (player.y - world.spawn.y) * TILE * follow;
      if (placed.axisX) x = placed.sign > 0 ? Math.max(x, placed.plane) : Math.min(x, placed.plane);
      else z = placed.sign > 0 ? Math.max(z, placed.plane) : Math.min(z, placed.plane);
      s.x = x;
      s.z = z;
      s.hx = placed.hx;
      s.orient = placed.orient;
      aim(s, cam, s.uv0);
      rest.push(s);
    } else if (s.bid < 0 || !cuts.has(s.bid) || s.low) {
      if (s.kind === 8 && s.sign < 0) {
        const zFace = (s.orient || 0) >= 1.5;
        const nx = zFace ? 0 : (s.hx < 0 ? 1 : -1);
        const nz = zFace ? (s.hx < 0 ? -1 : 1) : 0;
        if (nx * (cam[0] - s.x) + nz * (cam[2] - s.z) <= 0) continue;
      }
      if (s.kind === 16) s.sign = hack.flash > 0 ? 1 : 0;
      if (s.kind === 9 || s.kind === 12) aim(s, cam, s.uv0);
      rest.push(s);
    }
  }
  if (!flatPose()) {
    pushStack(runner);
    const name = runnerFrame();
    const fr = world.frames[name];
    const s = outlineSlot;
    s.x = player.x * TILE;
    s.z = player.y * TILE;
    placeCard(s, fr, name, 1);
    const yr = yaw * Math.PI / 180;
    const facingCam = Math.cos(yr - head);
    const faceOn = Math.abs(facingCam);
    s.hx *= 0.7 + 0.3 * faceOn;
    if (facingCam < -0.4) s.hx *= 0.72;
    s.orient = Math.abs(Math.sin(yr)) > Math.abs(Math.cos(yr)) ? 1 : 2;
    s.sign = 2;
    aim(s, cam, frameUV(name, facing < 0));
    runner.push(s);
  }
  let nearD = 2;
  let outline = [0, 0, 0];
  let outlineOn = 0;
  for (const l of lights) {
    if (l.type !== "neon" || (l.intensity ?? 0) < 0.45) continue;
    const d = Math.hypot(l.x - player.x, l.y - player.y);
    if (d < 2 && d < nearD) {
      nearD = d;
      outlineOn = 1;
      const hex = l.colour;
      outline = [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
    }
  }
  shownOutline = { on: outlineOn, colour: outline.slice() };
  renderer.tile = TILE;

  const uL = new Float32Array(32);
  const uC = new Float32Array(32);
  const uI = new Float32Array(8);
  const halo = new Float32Array(32);
  const haloC = new Float32Array(32);
  const fadeU = new Float32Array(8);
  let rimx = SUN[0], rimz = SUN[2], best = 0;
  const rx = player.x * TILE, rz = player.y * TILE;
  lights.forEach((l, i) => {
    const x = l.x * TILE, y = l.z, z = l.y * TILE;
    uL[i * 4] = x; uL[i * 4 + 1] = y; uL[i * 4 + 2] = z; uL[i * 4 + 3] = l.sign >= 0 ? l.radius : 0;
    const hex = l.colour;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    uC[i * 4] = r; uC[i * 4 + 1] = g; uC[i * 4 + 2] = b; uC[i * 4 + 3] = 1;
    uI[i] = l.intensity ?? 1;
    if (l.sign >= 0) fadeU[l.sign + 1] = l.intensity ?? 1;
    const dx = x - rx, dz = z - rz, dy = y - 8;
    const d = Math.hypot(dx, dy, dz) || 1;
    const a = Math.max(0, 1 - d / l.radius) * (l.intensity ?? 1);
    if (a > best) { best = a; rimx = dx / d; rimz = dz / d; }
    const onSign = l.sign >= 0 ? (l.intensity ?? 1) : 0;
    halo[i * 4 + 2] = onSign;
    haloC[i * 4] = r; haloC[i * 4 + 1] = g; haloC[i * 4 + 2] = b;
    const gx = l.x * TILE, gz = l.y * TILE;
    const dirx = Math.sin(yaw * Math.PI / 180), dirz = Math.cos(yaw * Math.PI / 180);
    const lim = 6 * TILE;
    const ex = Math.min(lim, Math.max(0, gx + dirx * TILE * 2));
    const ez = Math.min(lim, Math.max(0, gz + dirz * TILE * 2));
    l._ground = [gx, gz];
    l._end = [ex, ez];
    l._world = [x, y, z];
  });
  fadeU[0] = 1;
  const rl = Math.hypot(rimx, rimz) || 1;
  const vp = mul(proj, view);
  renderer.vp = vp;
  lights.forEach((l, i) => {
    const p = renderer.project([l._ground[0], 0.3, l._ground[1]]);
    const e = renderer.project([l._end[0], 0.3, l._end[1]]);
    const ah = renderer.view.artH;
    halo[i * 4] = p.x;
    halo[i * 4 + 1] = ah - p.y;
    halo[i * 4 + 3] = e.x;
    haloC[i * 4 + 3] = ah - e.y;
  });
  return {
    vp, slices: runner.concat(rest), runnerCount: runner.length, runnerPaper: false,
    outline, outlineOn,
    head,
    camXZ: [cam[0], cam[2]],
    runnerXZ: [player.x, player.y],
    frame: [runFr.x / 1024, 1 - (runFr.y + runFr.h) / 1024, (runFr.x + runFr.w) / 1024, 1 - runFr.y / 1024],
    sun: SUN, haze: HAZE, smog: SMOG,
    rim: [rimx / rl, rimz / rl],
    fade: fadeU, lights: uL, lightColor: uC, intensity: uI,
    drops, halo, haloColor: haloC, time, lightsApi: lights,
  };
}
function step(dt) {
  if (attract) yaw += 12 * dt;
  if (keys.has("q")) yaw -= 90 * dt;
  if (keys.has("e")) yaw += 90 * dt;
  let mx = stick.x, my = stick.y;
  if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
  if (keys.has("d") || keys.has("arrowright")) mx += 1;
  if (keys.has("w") || keys.has("arrowup")) my -= 1;
  if (keys.has("s") || keys.has("arrowdown")) my += 1;
  mx = Math.max(-1, Math.min(1, mx));
  my = Math.max(-1, Math.min(1, my));
  const pushing = mx !== 0 || my !== 0;
  if (pushing) {
    const len = Math.hypot(mx, my) || 1;
    wish = { x: mx / len, y: my / len };
  }
  speed = Math.max(0, Math.min(1, speed + (pushing ? 1 : -1) * dt / 0.1));
  moving = false;
  if (speed > 0.001) {
    moving = true;
    route = [];
    const [dx, dy] = viewDelta(wish.x, wish.y);
    if (dx || dy) head = Math.atan2(dx, dy);
    if (Math.abs(dx) > 0.2) {
      const want = dx > 0 ? 1 : -1;
      if (want !== faceWant) { faceWant = want; faceT = 0; }
    }
    faceT += dt;
    if (faceT >= 0.08) facing = faceWant;
    tryMove(dx * 3 * speed * dt, dy * 3 * speed * dt);
  } else if (route.length) {
    const [tx, ty] = route[0];
    const dx = tx - player.x, dy = ty - player.y;
    const d = Math.hypot(dx, dy);
    const step = 3 * dt;
    moving = true;
    if (dx || dy) head = Math.atan2(dx, dy);
    if (dx) facing = dx > 0 ? 1 : -1;
    if (d <= step) { player.x = tx; player.y = ty; route.shift(); }
    else { player.x += dx / d * step; player.y += dy / d * step; }
  }
  hack = hackStep(hack, dt, holding);
  scatterRain();
  for (let i = 0; i < 60; i++) {
    let x = drops[i * 2] + 28 * dt;
    let y = drops[i * 2 + 1] - 28 * dt;
    const w = renderer.view.artW, h = renderer.view.artH;
    if (x >= w || y < 0 || x < 0 || y >= h) {
      x = (i * 97 + Math.floor(time * 13)) % w;
      y = (i * 53 + Math.floor(time * 29)) % h;
    }
    drops[i * 2] = Math.floor(x);
    drops[i * 2 + 1] = Math.floor(y);
  }
}
function frame(now) {
  const raw = Math.min(0.25, (now - (frame.then || now)) / 1000);
  frame.then = now;
  const dt = Math.min(0.1, raw);
  time = (time + dt) % 120;
  lastDt = dt;
  step(dt);
  if (!renderer.lost()) {
    const s = scene();
    renderer.draw(s);
    frame.lights = s.lightsApi;
    ready = true;
  }
  samples.push(raw * 1000);
  if (samples.length > 60) samples.shift();
  if (fpsWant) {
    fpsWindow.push({ t: now, ms: raw * 1000 });
    while (fpsWindow.length && now - fpsWindow[0].t > 1000) fpsWindow.shift();
    if (now - (frame.fpsShown || 0) > 250 && fpsWindow.length) {
      const avg = fpsWindow.reduce((a, s) => a + s.ms, 0) / fpsWindow.length;
      fpsEl.textContent = avg > 0 ? (1000 / avg).toFixed(0) + " fps" : "";
      frame.fpsShown = now;
    }
  }
  frameMs = samples.reduce((a, b) => a + b, 0) / samples.length;
  fps = frameMs > 0 ? 1000 / frameMs : 0;
  warmed++;
  cool -= dt;
  const cap = Math.min(window.devicePixelRatio || 1, 2);
  if (!locked && warmed > 90 && cool <= 0) {
    if (frameMs < 12 && ratio + 0.25 <= cap + 1e-4) { ratio = Math.round((ratio + 0.25) * 4) / 4; cool = 2.5; fit(); }
    else if (frameMs > 28 && ratio - 0.25 >= 1) { ratio = Math.round((ratio - 0.25) * 4) / 4; cool = 2.5; fit(); }
  }
  requestAnimationFrame(frame);
}
frame.then = performance.now();

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  try { canvas.setPointerCapture?.(e.pointerId); } catch (err) { /* already released */ }
  if (attract) { attract = false; eatClick = true; }
  active.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, drag: false, machine: onMachine(e.clientX, e.clientY) });
  holding = [...active.values()].some((p) => p.machine) && hack.flash <= 0 && hack.cool <= 0;
  if (active.size >= 2) { multi = true; dragged = true; }
});
canvas.addEventListener("pointermove", (e) => {
  const p = active.get(e.pointerId);
  if (!p) return;
  if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) { p.drag = true; dragged = true; }
  if (phone() && active.size >= 2) {
    yaw -= (e.clientX - p.x) * 0.45;
    tilt = clampTilt(tilt + (e.clientY - p.y) * 0.15);
    p.x = e.clientX;
    p.y = e.clientY;
    stick.x = 0;
    stick.y = 0;
    multi = true;
    dragged = true;
  } else if (phone() && p.drag) {
    stick.x = Math.max(-1, Math.min(1, (e.clientX - p.sx) / 48));
    stick.y = Math.max(-1, Math.min(1, (e.clientY - p.sy) / 48));
  } else if (!phone() && p.btn === 2 && p.drag) {
    yaw -= (e.clientX - p.x) * 0.4;
    p.x = e.clientX;
  }
});
function endPointer(e) {
  const p = active.get(e.pointerId);
  if (!p) return;
  active.delete(e.pointerId);
  if (active.size) return;
  stick.x = 0;
  stick.y = 0;
  const walk = !eatClick && !dragged && !multi && !p.machine && (phone() || p.btn === 0);
  if (!active.size) holding = false;
  eatClick = false;
  dragged = false;
  multi = false;
  if (walk) walkAt(e.clientX, e.clientY);
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  attract = false;
  tilt = clampTilt(tilt - Math.sign(e.deltaY) * 3);
}, { passive: false });
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k.startsWith("arrow")) e.preventDefault();
  if (attract) attract = false;
  keys.add(k);
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

window.__test = {
  ready: () => ready,
  state: () => ({
    player: { x: player.x, y: player.y, facing, heading: head * 180 / Math.PI },
    tilt, yaw: wrap(yaw),
    slices: renderer.slices,
    drawCalls: renderer.drawCalls,
    frameMs, fps,
    lights: (frame.lights || world.lights).map((l) => ({
      x: l.x, y: l.y, z: l.z, colour: l.colour, type: l.type, on: !!l.on, street: !!l.street,
    })),
  }),
  setTilt: (d) => { tilt = clampTilt(d); attract = false; },
  setYaw: (d) => { yaw = wrap(d); attract = false; },
  moveTo: (x, y) => { player.x = x; player.y = y; route = []; attract = false; },
  setSign: (i, on) => { override[i] = on; },
  forceCutaway: (on) => { cutaway = !!on; },
  enter: () => { attract = false; },
  buildings: () => world.buildings.map((b) => ({ x: b.tx, y: b.ty, h: b.h, prop: b.prop })),
  signs: () => world.signs.map((s) => ({
    name: s.name, colour: s.colour, tx: s.tx, ty: s.ty,
    plate: s.plate, light: [s.x, s.y],
  })),
  goals: () => world.goals,
  sky: () => {
    const s = world.slices.find((sl) => sl.kind === 5);
    return { x: s.x / TILE, y: s.z / TILE, h: s.y, hx: s.hx / TILE };
  },
  solid: (x, y) => solid(Math.floor(x), Math.floor(y)),
  project: (x, y, z) => renderer.project([x * TILE, z, y * TILE]),
  pixel: (x, y) => renderer.pixel(x, y),
  client: (x, y, z) => renderer.client(renderer.project([x * TILE, z, y * TILE]).x, renderer.project([x * TILE, z, y * TILE]).y, canvas.getBoundingClientRect()),
  view: () => ({ ...renderer.view, ratio }),
  cam: () => lastCam.slice(),
  probe: () => {
    const r = world.slices.find((s) => s.kind === 1);
    return r ? { x: r.x, y: r.y, z: r.z, hx: r.hx, uv: r.uv } : null;
  },
  setPose: (name) => { pose = name || ""; },
  setHeading: (deg) => { head = deg * Math.PI / 180; },
  outline: () => shownOutline,
  hack: () => ({ held: hack.held, flash: hack.flash, cool: hack.cool, holding }),
  holdMachine: (seconds) => {
    let left = seconds;
    while (left > 0) {
      const dt = Math.min(0.05, left);
      hack = hackStep(hack, dt, true);
      left -= dt;
    }
    hack = hackStep(hack, 0, false);
    return { held: hack.held, flash: hack.flash, cool: hack.cool };
  },
  moveInput: (dx, dy, ms = 100) => {
    attract = false;
    stick.x = Math.max(-1, Math.min(1, dx));
    stick.y = Math.max(-1, Math.min(1, dy));
    clearTimeout(stickTimer);
    stickTimer = setTimeout(() => { stick.x = 0; stick.y = 0; }, ms);
  },
  viewStep: (mx, my, dt = 0.3) => {
    attract = false;
    const [dx, dy] = viewDelta(mx, my);
    if (dx || dy) head = Math.atan2(dx, dy);
    if (dx) facing = dx > 0 ? 1 : -1;
    const before = { x: player.x, y: player.y };
    tryMove(dx * 3 * dt, dy * 3 * dt);
    return { before, after: { x: player.x, y: player.y }, dx, dy };
  },
  runnerRect: () => {
    const name = runnerFrame();
    const box = RUNNER_BOX[name];
    const f = world.frames[name];
    const px = TILE / 16 * RUNNER_SCALE;
    const halfW = f.w * px / 2;
    const halfH = f.h * px / 2;
    const cx = player.x * TILE;
    const cz = player.y * TILE;
    const left = facing < 0 ? box.right : box.left;
    const right = facing < 0 ? box.left : box.right;
    const x0 = cx - halfW + left * px;
    const x1 = cx + halfW - right * px;
    const y0 = box.bottom * px;
    const y1 = (f.h - box.top) * px;
    const rect = canvas.getBoundingClientRect();
    const css = (x, y, z) => {
      const p = renderer.project([x, y, z]);
      return renderer.client(p.x, p.y, rect);
    };
    const corners = [css(x0, y0, cz), css(x1, y0, cz), css(x0, y1, cz), css(x1, y1, cz)];
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const foot = css(cx, y0, cz);
    const tile = css(cx, y0 + TILE, cz);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, tilePx: Math.abs(tile.y - foot.y) };
  },
};
const fpsWant = params.get("fps") === "1";
const fpsEl = document.createElement("div");
fpsEl.id = "fps";
fpsEl.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:4;color:#F3E9D6;font:14px/1 ui-monospace,monospace;display:none;pointer-events:none";
document.body.appendChild(fpsEl);
if (fpsWant) fpsEl.style.display = "block";
const fpsWindow = [];
const atlas = new Image();
atlas.onload = () => {
  renderer.setAtlas(atlas);
  requestAnimationFrame(frame);
};
atlas.src = atlasUrl;
