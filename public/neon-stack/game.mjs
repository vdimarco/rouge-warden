// Neon Stack: one loop, plain objects, camera snapped once per frame.
import { TILE, build, pathfind, RUNNER_BOX } from "./world.mjs";
import { atlasUrl } from "./art/atlas-data.mjs";
import { createRenderer, lookAt, perspective, mul } from "./render.mjs";

const FOV = 20 * Math.PI / 180;
// Idle opaque box is 24/16 = 1.5 tiles. Scale the figure to 1.64.
const RUNNER_SCALE = 1.64 / 1.5 * (1.64 / 1.66);
// Whole-tile zoom. Ten tiles across is the step that fills a short frame at tilt 55
// without pushing a ground corner out. Attract sits one tile further back.
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
let ratio = Math.min(dpr0, 1.5);
let cool = 0;
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
function solid(tx, ty) {
  return tx < 0 || ty < 0 || tx >= 6 || ty >= 6 || world.blocked[tx][ty];
}
function free(x, y) { return !solid(Math.floor(x), Math.floor(y)); }
function viewDelta(mx, my) {
  // A shallow camera squashes screen-up. Stretch that axis by 1/sin(tilt)
  // before turning it into a ground direction, so a screen diagonal stays one.
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
let shownOutline = { on: 0, colour: [0, 0, 0] };
function camera() {
  const tr = tilt * Math.PI / 180;
  const yr = yaw * Math.PI / 180;
  const aspect = renderer.view.artW / Math.max(1, renderer.view.artH);
  const tan = Math.tan(FOV / 2);
  const portrait = renderer.view.artH > renderer.view.artW;
  const span = Math.abs(Math.cos(yr)) + Math.abs(Math.sin(yr));
  const establishing = !attract && player.y > 4;
  const tiles = portrait
    ? (attract ? 8.4 : establishing ? 6 : 7.25) * span
    : (attract ? TILES + 1 : establishing ? 10 : TILES);
  const dist = (tiles * TILE) / (2 * tan * aspect);
  const cx = (attract ? 3 : player.x) * TILE;
  const cz = (attract ? 3 : player.y) * TILE;
  // At the spawn, aim up the block without pulling the camera back. The runner stays
  // in the lower third. Elsewhere keep the closer camera the width checks were built on.
  const along = attract ? 16 : establishing ? TILE * (portrait ? -2 : -1.875) : 36;
  const lift = establishing ? TILE * (portrait ? 4.125 : 3.625) : 0;
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
  const wpp = (2 * dist * Math.tan(FOV / 2)) / renderer.view.artH;
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
  // Tilt 20 still looks down, so the far ground is a few multiples of the camera distance.
  // The band stays tight enough that a 1-unit slice gap does not z-fight.
  return [Math.max(0.5, dist * 0.06), dist * 3.4];
}
function walkAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const { ox, oy, scale, artW, artH, backH } = renderer.view;
  const bx = (clientX - rect.left) * (canvas.width / rect.width);
  const byTop = (clientY - rect.top) * (canvas.height / rect.height);
  const ax = (bx - ox) / scale;
  const ay = artH - ((backH - byTop) - oy) / scale;
  if (ax < 0 || ay < 0 || ax >= artW || ay >= artH) return;
  const hit = renderer.unproject(ax, ay);
  if (!hit) return;
  route = pathfind((x, y) => solid(x, y), player.x, player.y, hit[0] / TILE, hit[1] / TILE);
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
function runnerFrame() {
  if (pose === "idle") return "runner_idle";
  if (pose === "crouch" || pose === "hack" || pose === "spotted") return "runner_" + pose;
  if (pose === "run" || moving) return "runner_run_" + (Math.floor(time * 8) % 4);
  return "runner_idle";
}
function scene() {
  fit();
  const { cam, focus, dist } = camera();
  const [near, far] = planes(dist);
  const view = lookAt(cam, focus, [0, 1, 0]);
  const proj = perspective(FOV, renderer.view.artW / renderer.view.artH, near, far);
  const cuts = new Set();
  if (cutaway) {
    const px = player.x * TILE, pz = player.y * TILE;
    world.buildings.forEach((b, i) => { if (hits(cam[0], cam[2], px, pz, b)) cuts.add(i); });
  }
  const lights = lightsNow();
  const runner = [];
  const rest = [];
  const runName = runnerFrame();
  const runFr = world.frames[runName];
  for (const s of world.slices) {
    if (s.kind === 1) {
      s.x = player.x * TILE;
      s.z = player.y * TILE;
      s.hx = runFr.w * (TILE / 16) / 2 * RUNNER_SCALE;
      s.hz = runFr.h * (TILE / 16) / 2 * RUNNER_SCALE;
      s.y = s.hz;
      s.uv = frameUV(runName, facing < 0);
      const yr = yaw * Math.PI / 180;
      s.orient = Math.abs(Math.sin(yr)) > Math.abs(Math.cos(yr)) ? 1 : 2;
      runner.push(s);
    } else if (s.kind === 3 && s.sign >= 1) {
      const meta = world.signs[s.sign - 1];
      const on = override[s.sign - 1] !== false;
      s.uv = frameUV(meta.frame + (on ? "_on" : "_off"), false);
      if (s.bid < 0 || !cuts.has(s.bid) || s.low) rest.push(s);
    } else if (s.kind === 6) {
      s.uv = frameUV("steam_vent_" + (Math.floor(time * 8) % 4), false);
      rest.push(s);
    } else if (s.kind === 5) {
      if (s.restX === undefined) { s.restX = s.x; s.restZ = s.z; }
      const px = world.spawn.x * TILE + (player.x - world.spawn.x) * TILE * 0.7;
      const pz = world.spawn.y * TILE + (player.y - world.spawn.y) * TILE * 0.7;
      const ox = s.restX - world.spawn.x * TILE;
      const oz = s.restZ - world.spawn.y * TILE;
      const a = -yaw * Math.PI / 180 * 0.78;
      const c = Math.cos(a), sn = Math.sin(a);
      s.x = px + ox * c - oz * sn;
      s.z = pz + ox * sn + oz * c;
      rest.push(s);
    } else if (s.bid < 0 || !cuts.has(s.bid) || s.low) rest.push(s);
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
    if (dx) facing = dx > 0 ? 1 : -1;
    if (d <= step) { player.x = tx; player.y = ty; route.shift(); }
    else { player.x += dx / d * step; player.y += dy / d * step; }
  }
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
  if (warmed > 90 && cool <= 0) {
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
  active.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, drag: false });
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
  const walk = !eatClick && !dragged && !multi && (phone() || p.btn === 0);
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
    player: { x: player.x, y: player.y, facing },
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
    return { x: s.x / TILE, y: s.z / TILE, h: s.y };
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
  outline: () => shownOutline,
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
