// In Full Swing: the opening (spec §10). A crack grows on a wall of your real room (mixed reality) or of a small cottage
// room (VR and flat screen), sludge drips, a jagged hole opens onto the city at sunset, you plunge the crack and pull,
// the wall bursts, and a sphere of city sweeps out round you until you stand on the start roof.
// The city shows only through stencil masks: the hole, then the growing sphere. Everything that belongs to the room
// draws only where the mask is not set, so the room is replaced by the city and never fights it in the depth buffer.
import * as THREE from "three";
import { COLORS, GAME } from "./config.js";
import { fire, release } from "./physics.js";

const DEG = Math.PI / 180;
const INTRO = GAME.intro;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/* ---------------- the sequence, in seconds ---------------- */
const T = {
  gurgleMin: 3.2, // the gurgle before the crack shows
  gazeMax: 10, // wait this long for you to face a wall that is off to the side
  crack: 4.6, // the crack grows
  hole: 1.4, // the hole opens
  roomWait: 8, // "Give yourself some room."
  slow: { scale: 0.35, secs: 0.6 }, // the chunks fly at 0.35x speed for the first 0.6 s
  chalk: 10, // the outline of your room stays on the roof
  kingWake: 3, // the King's pod glows green for this long at the burst
  repeat: GAME.tutorialRepeat, // a prompt is said again this often
};
const WALL = { min: 1.5, max: 4, far: 5.5, tight: 0.9, off: 60 * DEG, ahead: 2.2, half: 0.75 }; // where a wall may be (m), and the hole's half width plus a margin
const HOLE = { w: INTRO.holeWidth, h: 1.7, n: 15 };
const DECAL = { size: 2.3, px: 1024 };
const ROOM = { w: 4.4, d: 4.2, h: 2.7 }; // the cottage room of VR and flat play

/* ---------------- generators: the hole and its cracks ---------------- */
// A jagged star-shaped polygon (a squarish ellipse whose radius alternates long and short), in wall metres (x right, y up).
function holePolygon(rand, w, h, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + (rand() - 0.5) * 0.6) / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const jag = i % 2 ? 0.8 + rand() * 0.14 : 1.0 + rand() * 0.14;
    const k = 1 / Math.pow(Math.pow(Math.abs(c), 3) + Math.pow(Math.abs(s), 3), 1 / 3);
    pts.push([c * (w / 2) * jag * k * 0.84, s * (h / 2) * jag * k * 0.84]);
  }
  return pts;
}
// Crack lines: a zig-zag from the middle to every corner of the hole, a tail and sometimes a branch beyond it, and the hole edge.
function crackLines(rand, poly) {
  const lines = [], lim = DECAL.size / 2 - 0.04;
  const clampP = (p) => { p[0] = clamp(p[0], -lim, lim); p[1] = clamp(p[1], -lim, lim); return p; };
  for (const p of poly) {
    const len = Math.hypot(p[0], p[1]), dir = Math.atan2(p[1], p[0]), nx = Math.cos(dir + Math.PI / 2), ny = Math.sin(dir + Math.PI / 2);
    const pts = [[(rand() - 0.5) * 0.07, (rand() - 0.5) * 0.07]], steps = 4 + ((rand() * 3) | 0);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, wob = s === steps ? 0 : (rand() - 0.5) * 0.12 * (1 - t * 0.5);
      pts.push([Math.cos(dir) * len * t + nx * wob, Math.sin(dir) * len * t + ny * wob]);
    }
    lines.push({ pts, w0: 9, w1: 5 });
    if (rand() < 0.9) {
      const total = 0.18 + rand() * 0.55, ts = 3 + ((rand() * 3) | 0), tail = [p.slice()];
      let cx = p[0], cy = p[1], a = dir + (rand() - 0.5) * 0.5;
      for (let s = 0; s < ts; s++) {
        a += (rand() - 0.5) * 0.9; cx += (Math.cos(a) * total) / ts; cy += (Math.sin(a) * total) / ts;
        tail.push(clampP([cx, cy]));
        if (s === 1 && rand() < 0.55) {
          const br = [[cx, cy]]; let bx = cx, by = cy, ba = a + (rand() < 0.5 ? 1 : -1) * (0.6 + rand() * 0.5);
          for (let q = 0; q < 3; q++) { ba += (rand() - 0.5) * 0.8; bx += Math.cos(ba) * 0.09; by += Math.sin(ba) * 0.09; br.push(clampP([bx, by])); }
          lines.push({ pts: br, w0: 3.5, w1: 1 });
        }
      }
      lines.push({ pts: tail, w0: 5, w1: 1.2 });
    }
  }
  lines.push({ pts: poly.concat([poly[0]]).map((p) => p.slice()), w0: 6, w1: 6 });
  return lines;
}
// The crack texture: red is the dark line, green its pale rim, blue a soft halo of dust round it (the shader colours them).
function crackTexture(lines) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = DECAL.px;
  const c = cv.getContext("2d"), k = DECAL.px / DECAL.size, X = (x) => (x + DECAL.size / 2) * k, Y = (y) => (DECAL.size / 2 - y) * k;
  c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = "lighter"; c.lineCap = "round"; c.lineJoin = "round";
  const stroke = (col, grow, dx, dy, blur) => {
    c.filter = blur ? "blur(" + blur + "px)" : "none";
    c.strokeStyle = col;
    for (const l of lines) {
      const n = l.pts.length - 1;
      for (let i = 0; i < n; i++) {
        c.lineWidth = (l.w0 + (l.w1 - l.w0) * (i / Math.max(1, n - 1))) * (k / 465) * grow + (grow > 1 ? 0 : 0);
        c.beginPath(); c.moveTo(X(l.pts[i][0]) + dx, Y(l.pts[i][1]) + dy); c.lineTo(X(l.pts[i + 1][0]) + dx, Y(l.pts[i + 1][1]) + dy); c.stroke();
      }
    }
  };
  stroke("rgb(0,0,255)", 5, 0, 0, 9);
  stroke("rgb(0,255,0)", 1.9, 1.5, 1.5, 0);
  stroke("rgb(255,0,0)", 1, 0, 0, 0);
  c.filter = "none";
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

/* ---------------- shaders (built-in materials and ShaderMaterial only; nothing here redeclares the view matrices) ---------------- */
const NOISE = `
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`;
// Room things draw only where the mask is not set: the hole and the reveal sphere replace them with the city.
function roomStencil(m) {
  m.stencilWrite = true; m.stencilRef = 1; m.stencilFunc = THREE.NotEqualStencilFunc;
  m.stencilFail = m.stencilZFail = m.stencilZPass = THREE.KeepStencilOp;
  return m;
}
// The exact mask of spec §10.
function maskMaterial() {
  return new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp });
}
const VERT_UV = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// The crack: it grows outward from the middle, the dark lines seep green and glow warm as the hole is about to open.
function decalMaterial(tex) {
  return roomStencil(new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uGrow: { value: 0 }, uSeep: { value: 0 }, uPulse: { value: 0 } },
    vertexShader: VERT_UV,
    fragmentShader: `${NOISE}
      uniform sampler2D uMap; uniform float uGrow, uSeep, uPulse; varying vec2 vUv;
      void main() {
        vec3 t = texture2D(uMap, vUv).rgb;
        float d = length(vUv - 0.5) * 2.0;
        float n = vn(vUv * 11.0) * 0.16 + vn(vUv * 31.0) * 0.06;
        float grow = uGrow * 1.25;
        float reveal = 1.0 - smoothstep(grow - 0.1, grow, d + n);
        float front = smoothstep(grow - 0.2, grow - 0.03, d + n) * reveal;
        float core = t.r * reveal, rim = t.g * reveal, halo = t.b * reveal;
        vec3 dust = vec3(0.74, 0.7, 0.64), dark = vec3(0.06, 0.045, 0.045), wet = vec3(0.4, 0.55, 0.1), lit = vec3(1.0, 0.62, 0.26);
        vec3 col = mix(dust, vec3(1.0, 0.96, 0.88), rim * 0.6);
        vec3 line = mix(dark, wet, clamp(uSeep, 0.0, 1.0) * (0.4 + 0.6 * vn(vUv * 60.0)));
        line = mix(line, lit, clamp(uPulse, 0.0, 1.0) * (0.5 + 0.5 * core));
        col = mix(col, line, core);
        col += wet * front * core * 0.5;
        float a = clamp(core * 0.96 + rim * 0.34 + halo * 0.3, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
  }));
}
// The torn plaster round the hole (a strip from the hole edge to 14 cm out) and the tunnel through the wall's thickness.
function rimMaterial() {
  return roomStencil(new THREE.ShaderMaterial({
    uniforms: { uOpen: { value: 0 } },
    vertexShader: `attribute float aRim; varying float vRim; varying vec2 vP; void main() { vRim = aRim; vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${NOISE}
      uniform float uOpen; varying float vRim; varying vec2 vP;
      void main() {
        float n = vn(vP * 22.0) * 0.6 + vn(vP * 70.0) * 0.4;
        float t = clamp(vRim + (n - 0.5) * 0.7, 0.0, 1.0);
        vec3 plaster = vec3(0.8, 0.77, 0.7) * (0.9 + 0.2 * n), deep = vec3(0.11, 0.085, 0.075);
        vec3 col = mix(deep, plaster, smoothstep(0.05, 0.6, t));
        col += vec3(1.0, 0.58, 0.26) * (1.0 - smoothstep(0.0, 0.3, vRim)) * 0.55 * uOpen;
        gl_FragColor = vec4(col, (1.0 - smoothstep(0.6, 1.0, t)) * clamp(uOpen * 4.0, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
}
function tunnelMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `attribute float aTun; varying float vTun; varying vec3 vW; varying vec2 vP; void main() { vTun = aTun; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vP = position.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${NOISE}
      varying float vTun; varying vec3 vW; varying vec2 vP;
      void main() {
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        float lit = 0.4 + 0.6 * max(dot(n, normalize(vec3(0.25, 0.75, 0.55))), 0.0);
        float g = vn(vP * 30.0 + vTun * 5.0);
        vec3 base = mix(vec3(0.74, 0.71, 0.65), vec3(0.3, 0.25, 0.22), smoothstep(0.0, 0.9, vTun)) * (0.85 + 0.3 * g);
        vec3 col = base * lit + vec3(1.0, 0.62, 0.3) * vTun * 0.2;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
}
// Sludge running down the wall: a thin trail with a round drop at its head. Each strip is a quad with its own start and speed.
function dripMaterial() {
  return roomStencil(new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: `attribute vec4 aDrip; attribute vec2 aQ; varying vec2 vQ; varying vec4 vD; void main() { vQ = aQ; vD = aDrip; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${NOISE}
      uniform float uT; varying vec2 vQ; varying vec4 vD;
      // vD: x start time, y strip length, z speed, w half width. vQ: x across (-1..1), y along (0 at the start, 1 at the end)
      void main() {
        float head = min(vD.y, max(0.0, uT - vD.x) * vD.z * (1.0 - 0.35 * smoothstep(0.0, vD.y, max(0.0, uT - vD.x) * vD.z)));
        float along = vQ.y * vD.y;
        if (along > head + 0.001) discard;
        float k = head - along;
        float bulb = 1.0 - smoothstep(0.0, 0.055, k);
        float thin = 0.34 + 0.12 * vn(vec2(along * 9.0, vD.x));
        float w = mix(thin, 1.0, bulb);
        float side = abs(vQ.x) / w;
        if (side > 1.0) discard;
        float rnd = sqrt(max(0.0, 1.0 - side * side));
        vec3 base = mix(vec3(0.24, 0.31, 0.07), vec3(0.42, 0.55, 0.12), rnd);
        float spec = pow(max(0.0, rnd - 0.35), 4.0) * 0.9 * (0.6 + 0.4 * vn(vec2(along * 20.0, 1.0)));
        vec3 col = base * (0.75 + 0.4 * (1.0 - vQ.x * 0.5)) + vec3(0.95, 1.0, 0.7) * spec;
        gl_FragColor = vec4(col, smoothstep(1.0, 0.85, side));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
}
// The floor puddle: an uneven dark green pool that grows, reflects the sunset in a fake fresnel, and rings where a drop lands.
function puddleMaterial() {
  return roomStencil(new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 0 }, uT: { value: 0 }, uRip: { value: [new THREE.Vector3(9, 9, -9), new THREE.Vector3(9, 9, -9), new THREE.Vector3(9, 9, -9), new THREE.Vector3(9, 9, -9)] } },
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${NOISE}
      uniform float uSize, uT; uniform vec3 uRip[4]; varying vec2 vP;
      void main() {
        vec2 q = vP / vec2(0.62, 0.5);
        float ang = atan(q.y, q.x), r = length(q);
        float edge = uSize * (0.78 + 0.28 * vn(vec2(ang * 1.6 + 3.0, 1.3)) + 0.12 * sin(ang * 5.0 + 1.0));
        if (r > edge) discard;
        float a = 1.0 - smoothstep(edge - 0.1, edge, r);
        float ring = 0.0;
        for (int i = 0; i < 4; i++) { float age = uT - uRip[i].z; float d = length(vP - uRip[i].xy); ring += smoothstep(0.02, 0.0, abs(d - age * 0.35)) * smoothstep(1.4, 0.0, age) * step(0.0, age); }
        float fres = pow(1.0 - clamp(r / max(edge, 0.001), 0.0, 1.0), 0.6);
        vec3 deep = vec3(0.09, 0.13, 0.03), glow = vec3(0.34, 0.5, 0.09), sunset = vec3(1.0, 0.62, 0.3);
        vec3 col = mix(glow, deep, fres * 0.85) + sunset * (0.16 + 0.5 * ring) * (0.4 + 0.6 * vn(vP * 9.0 + uT * 0.2));
        gl_FragColor = vec4(col, a * 0.93);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
}
// Chunks of wall: flat-shaded shards, one draw for all of them. A per-instance colour, and a warm rim from the hole.
function chunkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uL: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() } },
    vertexShader: `attribute vec3 aCol; varying vec3 vC; varying vec3 vW; void main() { vC = aCol; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform vec3 uL; varying vec3 vC; varying vec3 vW;
      void main() {
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        float lit = 0.6 + 0.5 * max(dot(n, uL), 0.0);
        float back = pow(max(dot(n, vec3(0.0, 0.0, -1.0)), 0.0), 2.0);
        gl_FragColor = vec4(vC * lit * vec3(1.0, 0.95, 0.88) + vec3(1.0, 0.55, 0.22) * back * 0.2, 1.0);
      }`,
  });
}
// Dust: soft round puffs that face you, one draw for all of them.
function dustMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `attribute float aA; varying vec2 vQ; varying float vA;
      void main() {
        vQ = position.xy * 2.0; vA = aA;
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0));
        float s = length(instanceMatrix[0].xyz);
        mv.xy += position.xy * s;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `${NOISE}
      varying vec2 vQ; varying float vA;
      void main() {
        float r = length(vQ);
        if (r > 1.0) discard;
        float n = vn(vQ * 3.0 + vA * 7.0);
        float a = (1.0 - smoothstep(0.2, 1.0, r * (0.85 + 0.3 * n))) * vA;
        vec3 col = mix(vec3(0.62, 0.58, 0.52), vec3(1.0, 0.76, 0.46), 0.35 + 0.35 * n);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false,
  });
}
// A plain light patch that adds to what is behind it (the sunset spilling through the hole onto the floor).
function spillTexture() {
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 256;
  const c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgba(255,170,90,0.95)"); g.addColorStop(0.35, "rgba(255,140,60,0.4)"); g.addColorStop(1, "rgba(255,120,40,0)");
  c.fillStyle = g; c.fillRect(0, 0, 128, 256);
  // narrow the far end: a soft trapezoid
  c.globalCompositeOperation = "destination-in";
  const m = c.createLinearGradient(0, 0, 128, 0);
  m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(0.2, "rgba(0,0,0,1)"); m.addColorStop(0.8, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = m; c.fillRect(0, 0, 128, 256);
  return new THREE.CanvasTexture(cv);
}
// A chevron for the floor arrow.
function arrowTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const c = cv.getContext("2d");
  for (let i = 0; i < 3; i++) {
    const y = 40 + i * 62;
    c.beginPath(); c.moveTo(28, y + 46); c.lineTo(128, y); c.lineTo(228, y + 46); c.lineTo(228, y + 78); c.lineTo(128, y + 32); c.lineTo(28, y + 78); c.closePath();
    c.fillStyle = "rgba(255,244,216," + (0.95 - i * 0.25) + ")"; c.fill();
    c.lineWidth = 6; c.strokeStyle = "rgba(255,138,58," + (0.9 - i * 0.25) + ")"; c.stroke();
  }
  return new THREE.CanvasTexture(cv);
}
// The chalk line round your room: a rough white band that breaks where the stick skipped.
function chalkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uA: { value: 1 } },
    vertexShader: `attribute vec2 aQ; varying vec2 vQ; void main() { vQ = aQ; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${NOISE}
      uniform float uA; varying vec2 vQ;
      void main() {
        float edge = 1.0 - smoothstep(0.55, 1.0, abs(vQ.y) + 0.22 * (h21(floor(vec2(vQ.x * 60.0, vQ.y * 6.0))) - 0.5));
        float grain = 0.55 + 0.45 * h21(floor(vec2(vQ.x * 240.0, vQ.y * 20.0)));
        float skip = smoothstep(0.08, 0.3, h21(vec2(floor(vQ.x * 3.0), 5.0)));
        float a = edge * grain * mix(0.35, 1.0, skip) * uA;
        if (a < 0.02) discard;
        gl_FragColor = vec4(vec3(0.96, 0.95, 0.9), a * 0.92);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

export function createPortal({ scene, rig, camera, renderer, xr, city, view, ropes, audio, ui, P, placeRig, haptic }) {
  const G = () => window.G || {};
  const S = city.start;
  const doneFns = [];
  const UP = new THREE.Vector3(0, 1, 0);
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3();
  const M1 = new THREE.Matrix4(), Q1 = new THREE.Quaternion();
  const yawOf = (x, z) => Math.atan2(-x, -z); // the yaw of a direction (0 faces −z), as spec §10 writes it

  let mode = "vr", firstRun = false, skipReq = false, placed = false, phase = "idle", pt = 0, total = 0, resetSeen = false;
  let inp = null;
  const s = { defer: 0, hid: false, roomClear: 0, best: null, parked: 0, burstT: 0, stance: "none", waitPlanes: 0, gaze: 0, said: 0, sayT: 0, widened: false, auto: false, easy: false, warmed: false, hole: 0, dripT: 0, surge: 0, pulse: 0, room: null, roomT: 0, slow: 1, stirAt: 0, r: 0, kingT: -1, chalkT: -1, kingGlow: false, revealSpeed: INTRO.revealSpeed };
  const last = { ok: false, x: 0, z: 0, yaw: 0 }; // the head in the previous frame, to carry a fixed crack across a recentre
  const target = { id: "crack", tag: "crack", pos: { x: 0, y: 0, z: 0 }, radius: 0.4, normal: { x: 0, y: 0, z: 1 }, cone: undefined };

  /* ---------------- the wall ---------------- */
  // kind: "plane" (a real wall: the crack keeps its place in that plane's own space, so a recentre cannot move it),
  // "hit" (a hit-test point), or "virtual" (a wall of the cottage room, or 2.2 m ahead). C, N, R in tracking space.
  const wall = { kind: "virtual", label: "", plane: null, Lp: new THREE.Vector3(), nSign: 1, C: new THREE.Vector3(), N: new THREE.Vector3(0, 0, 1), R: new THREE.Vector3(1, 0, 0), floorY: 0, dist: 0, angle: 0, cy: 1.35, ok: false };
  const headFwd = (q, out) => { out.set(0, 0, -1).applyQuaternion(q); out.y = 0; const l = out.length(); if (l < 0.2) out.set(-Math.sin(last.yaw), 0, -Math.cos(last.yaw)); else out.divideScalar(l); return out; };

  // A vertical plane as a segment on the floor plus a height range, in tracking space: { sx, sz, ex, ez, ax, az, len, y0, y1 }.
  function planeSeg(e, out) {
    const m = e.matrix, poly = e.polygon, n = poly.length;
    if (n < 3) return null;
    let best = -1, bi = 0, bj = 0, y0 = Infinity, y1 = -Infinity;
    const wx = [], wz = [];
    for (let i = 0; i < n; i++) {
      V1.set(poly[i].x, 0, poly[i].z).applyMatrix4(m);
      wx.push(V1.x); wz.push(V1.z); y0 = Math.min(y0, V1.y); y1 = Math.max(y1, V1.y);
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = (wx[i] - wx[j]) ** 2 + (wz[i] - wz[j]) ** 2; if (d > best) { best = d; bi = i; bj = j; } }
    const len = Math.sqrt(best);
    if (len < 0.05) return null;
    out.sx = wx[bi]; out.sz = wz[bi]; out.ex = wx[bj]; out.ez = wz[bj]; out.len = len; out.ax = (wx[bj] - wx[bi]) / len; out.az = (wz[bj] - wz[bi]) / len; out.y0 = y0; out.y1 = y1;
    return out;
  }
  const isVertical = (e) => { if (e.orientation === "vertical") return true; if (e.orientation === "horizontal") return false; return Math.abs(e.matrix.elements[5]) < 0.5; };
  const OPENING = { door: 1, window: 1, "wall art": 1, screen: 1, other: 0 };

  // Picks the wall (spec §10): a vertical plane labelled wall, else any vertical plane, whose nearest point is 1.5–4 m away and
  // closest to straight ahead; else the hit-test point ahead; else a virtual wall 2.2 m ahead. Rooms too small for that use
  // the roomiest real wall there is, since a crack on a real wall beats a floating one.
  function chooseWall(hl, fwd) {
    const cands = [], seg = { sx: 0, sz: 0, ex: 0, ez: 0, ax: 0, az: 0, len: 0, y0: 0, y1: 0 };
    const headYaw = yawOf(fwd.x, fwd.z);
    let floorY = 0;
    if (xr && xr.planes) for (const e of xr.planes.values()) if (e.label === "floor") { const y = e.matrix.elements[13]; if (y > -0.15 && y < 0.3) floorY = Math.max(0, y); }
    if (xr && xr.planes) {
      const openings = [];
      for (const e of xr.planes.values()) if (isVertical(e) && OPENING[e.label] === 1) { const g = planeSeg(e, {}); if (g) openings.push(g); }
      for (const [key, e] of xr.planes) {
        if (!isVertical(e) || OPENING[e.label] === 1) continue;
        const g = planeSeg(e, seg);
        if (!g || g.len < 1.2 || g.y1 - g.y0 < 1.5) continue;
        // where the head's forward ray meets the wall's line, kept inside the wall with room for the hole
        const wx = g.sx - hl.x, wz = g.sz - hl.z, det = -fwd.x * g.az + g.ax * fwd.z;
        let t = det * det > 1e-10 ? (fwd.x * wz - fwd.z * wx) / det : -wx * g.ax - wz * g.az;
        const half = Math.min(WALL.half, g.len / 2);
        t = clamp(t, half, g.len - half);
        // stay clear of doors, windows and pictures on the same wall
        const cy = clamp(hl.y - 0.25, g.y0 + 1.0, Math.max(g.y0 + 1.0, g.y1 - 1.0)), free = (tt) => {
          for (const o of openings) {
            const mx = (o.sx + o.ex) / 2 - g.sx, mz = (o.sz + o.ez) / 2 - g.sz;
            if (Math.abs(mx * -g.az + mz * g.ax) > 0.4) continue; // not on this wall
            const t0 = Math.min((o.sx - g.sx) * g.ax + (o.sz - g.sz) * g.az, (o.ex - g.sx) * g.ax + (o.ez - g.sz) * g.az) - 0.1, t1 = Math.max((o.sx - g.sx) * g.ax + (o.sz - g.sz) * g.az, (o.ex - g.sx) * g.ax + (o.ez - g.sz) * g.az) + 0.1;
            if (tt + half > t0 && tt - half < t1 && cy + 0.9 > o.y0 && cy - 0.9 < o.y1) return false;
          }
          return true;
        };
        let blocked = false;
        if (!free(t)) { blocked = true; for (let k = 1; k * 0.1 < g.len; k++) { const a = clamp(t + k * 0.1, half, g.len - half), b = clamp(t - k * 0.1, half, g.len - half); if (free(a)) { t = a; blocked = false; break; } if (free(b)) { t = b; blocked = false; break; } } }
        const px = g.sx + g.ax * t, pz = g.sz + g.az * t, d = Math.hypot(px - hl.x, pz - hl.z);
        // the nearest point of the wall to the head
        const tn = clamp((hl.x - g.sx) * g.ax + (hl.z - g.sz) * g.az, 0, g.len), near = Math.hypot(g.sx + g.ax * tn - hl.x, g.sz + g.az * tn - hl.z);
        const ang = Math.abs(wrap(yawOf(px - hl.x, pz - hl.z) - headYaw));
        cands.push({ key, e, label: e.label, px, py: cy, pz, near, d, ang, blocked, g: { ax: g.ax, az: g.az, sx: g.sx, sz: g.sz } });
      }
    }
    const rank = (c, wallOnly) => (wallOnly ? c.label === "wall" : true);
    const inRange = (c) => c.near >= WALL.min && c.near <= WALL.max && c.d <= WALL.far;
    const cost = (c) => c.ang + 0.15 * Math.max(0, c.d - WALL.max) + (c.blocked ? 0.9 : 0);
    let pick = null;
    for (const wallOnly of [true, false]) { const list = cands.filter((c) => rank(c, wallOnly) && inRange(c)).sort((a, b) => cost(a) - cost(b)); if (list.length) { pick = list[0]; break; } }
    if (pick) return planeWall(pick, hl, fwd, floorY, "plane");
    // a hit-test point ahead that stands on a wall
    const hit = xr && xr.hitTest ? xr.hitTest() : null;
    if (hit && Math.abs(hit.normal.y) < 0.5) {
      const d = Math.hypot(hit.pos.x - hl.x, hit.pos.z - hl.z);
      if (d >= WALL.min && d <= WALL.far) {
        wall.kind = "hit"; wall.label = "hit-test"; wall.plane = null;
        wall.N.set(hit.normal.x, 0, hit.normal.z).normalize();
        if (wall.N.x * (hl.x - hit.pos.x) + wall.N.z * (hl.z - hit.pos.z) < 0) wall.N.negate();
        wall.C.set(hit.pos.x, clamp(hit.pos.y, 1.0, 1.6), hit.pos.z);
        wall.floorY = floorY; wall.dist = d; wall.angle = 0;
        return wall;
      }
    }
    // a small room: the wall with the most room in front of it
    const tight = cands.filter((c) => c.label === "wall" && c.near >= WALL.tight && c.d <= WALL.far).sort((a, b) => b.near - a.near + (a.ang - b.ang) * 0.3);
    if (tight.length) return planeWall(tight[0], hl, fwd, floorY, "plane");
    return virtualWall(hl, fwd, floorY);
  }
  function planeWall(c, hl, fwd, floorY) {
    const e = c.e, m = e.matrix;
    wall.kind = "plane"; wall.label = c.label || "wall"; wall.plane = c.key;
    V1.set(c.px, c.py, c.pz);
    M1.copy(m).invert();
    wall.Lp.copy(V1).applyMatrix4(M1);
    // the wall's normal, horizontal, facing the head (the runtime's sign varies; the head decides)
    V2.set(m.elements[4], 0, m.elements[6]).normalize();
    wall.nSign = V2.x * (hl.x - c.px) + V2.z * (hl.z - c.pz) >= 0 ? 1 : -1;
    wall.C.copy(V1); wall.N.copy(V2).multiplyScalar(wall.nSign);
    wall.floorY = floorY; wall.dist = c.d; wall.angle = c.ang;
    return wall;
  }
  function virtualWall(hl, fwd, floorY) {
    wall.kind = "virtual"; wall.label = mode === "ar" ? "virtual" : "cottage"; wall.plane = null;
    wall.N.set(-fwd.x, 0, -fwd.z);
    wall.cy = clamp(hl.y - 0.25, 1.0, 1.6);
    wall.C.set(hl.x + fwd.x * WALL.ahead, wall.cy, hl.z + fwd.z * WALL.ahead);
    wall.floorY = floorY; wall.dist = WALL.ahead; wall.angle = 0;
    return wall;
  }
  // Each frame: the crack's pose from its plane's pose now (a recentre moves the tracking space, and the plane with it).
  function wallFrame() {
    if (wall.kind === "plane" && xr && xr.planes) {
      const e = xr.planes.get(wall.plane);
      if (e) {
        wall.C.copy(wall.Lp).applyMatrix4(e.matrix);
        wall.N.set(e.matrix.elements[4], 0, e.matrix.elements[6]).normalize().multiplyScalar(wall.nSign);
      }
    }
    wall.R.crossVectors(V1.copy(wall.N).negate(), UP).normalize();
    wallG.matrix.makeBasis(wall.R, UP, wall.N).setPosition(wall.C);
    wallG.matrixWorldNeedsUpdate = true;
  }

  /* ---------------- scene graph ---------------- */
  const root = new THREE.Group(); root.name = "portal"; root.visible = false;
  rig.add(root);
  const wallG = new THREE.Group(); wallG.name = "portal:wall"; wallG.matrixAutoUpdate = false;
  root.add(wallG);
  const chalkG = new THREE.Group(); chalkG.name = "portal:chalk"; chalkG.visible = false;
  rig.add(chalkG);
  const maskMat = maskMaterial();
  const fx = {
    built: false, mats: {}, geos: [], tex: [],
    decal: null, holeG: null, mask: null, rim: null, tunnel: null, drips: null, puddle: null, spill: null,
    chunks: null, dust: null, arrow: null, spinner: null, flash: null, sphere: null, room: null, poly: null,
  };
  // Materials and textures live as long as the page: each program compiles once and every opening reuses it.
  const MC = {}, TC = {};
  const mat = (k, make) => MC[k] || (MC[k] = make());
  const tx = (k, make) => TC[k] || (TC[k] = make());

  /* ---------------- effects that do not depend on the wall ---------------- */
  const NCH = 46, NDU = 30;
  const chunkS = Array.from({ length: NCH }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), s: new THREE.Vector3(), a: 1, rest: false }));
  const dustS = Array.from({ length: NDU }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 9, life: 1, s0: 0.2, s1: 0.8, a0: 0.4 }));
  const dropS = Array.from({ length: 5 }, () => ({ on: false, x: 0, y: 0, z: 0, vy: 0 }));
  function buildFx() {
    if (fx.built) return;
    fx.built = true;
    // the chunks of wall
    const cg = new THREE.IcosahedronGeometry(1, 0);
    fx.mats.chunk = mat("chunk", chunkMaterial);
    const col = new THREE.InstancedBufferAttribute(new Float32Array(NCH * 3), 3);
    cg.setAttribute("aCol", col);
    fx.chunks = new THREE.InstancedMesh(cg, fx.mats.chunk, NCH);
    fx.chunks.name = "portal:chunks"; fx.chunks.frustumCulled = false; fx.chunks.count = 0; fx.chunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(fx.chunks);
    // dust
    const dg = new THREE.PlaneGeometry(1, 1);
    dg.setAttribute("aA", new THREE.InstancedBufferAttribute(new Float32Array(NDU), 1));
    fx.mats.dust = mat("dust", dustMaterial);
    fx.dust = new THREE.InstancedMesh(dg, fx.mats.dust, NDU);
    fx.dust.name = "portal:dust"; fx.dust.frustumCulled = false; fx.dust.count = 0; fx.dust.renderOrder = 900; fx.dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(fx.dust);
    // the reveal sphere: the mask, slightly ragged so its edge does not look like a ball
    const sg = new THREE.SphereGeometry(1, 40, 28), pa = sg.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), n = Math.sin(x * 7.1 + z * 3.3) * Math.sin(y * 6.3 + x * 2.1) * 0.06 + Math.sin(z * 13.0 + y * 9.0) * 0.025;
      pa.setXYZ(i, x * (1 + n), y * (1 + n), z * (1 + n));
    }
    fx.sphere = new THREE.Mesh(sg, maskMat);
    fx.sphere.name = "portal:sphere"; fx.sphere.renderOrder = -100; fx.sphere.frustumCulled = false; fx.sphere.visible = false;
    root.add(fx.sphere);
    // the floor arrow
    fx.mats.arrow = mat("arrow", () => new THREE.MeshBasicMaterial({ map: tx("arrow", () => { const t = arrowTexture(); renderer.initTexture(t); return t; }), transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    fx.arrow = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), fx.mats.arrow);
    fx.arrow.name = "portal:arrow"; fx.arrow.rotation.order = "YXZ"; fx.arrow.renderOrder = 990; fx.arrow.frustumCulled = false; fx.arrow.visible = false;
    root.add(fx.arrow);
    // the loading ring: while the city builds behind the crack
    fx.spinner = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 32, Math.PI * 1.5), new THREE.MeshBasicMaterial({ color: 0xffc27a, fog: false, depthTest: false, transparent: true }));
    fx.spinner.position.set(0, -0.08, -1.1); fx.spinner.renderOrder = 998; fx.spinner.visible = false; fx.spinner.frustumCulled = false;
    camera.add(fx.spinner);
    // the flash at the burst
    fx.mats.flash = mat("flash", () => new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
    fx.flash = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), fx.mats.flash);
    fx.flash.renderOrder = 1000; fx.flash.frustumCulled = false; fx.flash.visible = false;
    camera.add(fx.flash);
  }

  /* ---------------- the wall's visuals (built again for each opening) ---------------- */
  function clearWall() {
    for (const c of wallG.children.slice()) {
      c.removeFromParent();
      c.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    if (fx.crackTex) { fx.crackTex.dispose(); fx.crackTex = null; }
    fx.decal = fx.holeG = fx.mask = fx.rim = fx.tunnel = fx.drips = fx.puddle = fx.spill = fx.room = fx.drops = null;
  }
  function buildWall() {
    clearWall();
    const rand = rng(7), poly = fx.poly = holePolygon(rand, HOLE.w, HOLE.h, HOLE.n), lines = crackLines(rand, poly);
    const fl = wall.C.y - wall.floorY; // the crack centre's height above the floor
    wall.fl = fl;
    // the crack decal
    const tex = fx.crackTex = crackTexture(lines);
    renderer.initTexture(tex);
    fx.mats.decal = mat("decal", () => decalMaterial(tex));
    fx.mats.decal.uniforms.uMap.value = tex;
    fx.decal = new THREE.Mesh(new THREE.PlaneGeometry(DECAL.size, DECAL.size), fx.mats.decal);
    fx.decal.position.z = 0.006; fx.decal.renderOrder = 3; fx.decal.frustumCulled = false;
    wallG.add(fx.decal);
    // the hole: the stencil mask, the torn rim, and a tunnel through the wall's thickness, scaled together as it opens
    fx.holeG = new THREE.Group();
    const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1])));
    fx.mask = new THREE.Mesh(new THREE.ShapeGeometry(shape), maskMat);
    fx.mask.renderOrder = -100; fx.mask.frustumCulled = false;
    fx.holeG.add(fx.mask);
    const n = poly.length, rimPos = new Float32Array(n * 2 * 3), rimA = new Float32Array(n * 2), tunPos = new Float32Array(n * 2 * 3), tunA = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = poly[i], l = Math.hypot(x, y) || 1, out = 0.13 + 0.09 * rand();
      rimPos.set([x, y, 0.004, x + (x / l) * out, y + (y / l) * out, 0.004], i * 6); rimA[i * 2] = 0; rimA[i * 2 + 1] = 1;
      tunPos.set([x, y, 0, x * 0.93, y * 0.93, -0.15], i * 6); tunA[i * 2] = 0; tunA[i * 2 + 1] = 1;
      const j = (i + 1) % n;
      idx.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(rimPos, 3)); rg.setAttribute("aRim", new THREE.BufferAttribute(rimA, 1)); rg.setIndex(idx);
    fx.mats.rim = mat("rim", rimMaterial);
    fx.rim = new THREE.Mesh(rg, fx.mats.rim); fx.rim.renderOrder = 2; fx.rim.frustumCulled = false;
    const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(tunPos, 3)); tg.setAttribute("aTun", new THREE.BufferAttribute(tunA, 1)); tg.setIndex(idx);
    fx.mats.tunnel = mat("tunnel", tunnelMaterial);
    fx.tunnel = new THREE.Mesh(tg, fx.mats.tunnel); fx.tunnel.frustumCulled = false;
    fx.holeG.add(fx.rim, fx.tunnel);
    fx.holeG.scale.set(0.001, 0.001, 1); fx.holeG.visible = false;
    wallG.add(fx.holeG);
    // sludge drips from the lowest corners of the hole
    const low = poly.map((p, i) => ({ p, i })).filter((q) => q.p[1] < -0.15).sort((a, b) => a.p[1] - b.p[1]).slice(0, 5);
    const nd = low.length, dpos = new Float32Array(nd * 12), dA = new Float32Array(nd * 16), dQ = new Float32Array(nd * 8), didx = [];
    low.forEach((q, k) => {
      const x = q.p[0] + (rand() - 0.5) * 0.06, ys = q.p[1] - 0.03, len = Math.max(0.3, ys + fl - 0.012), hw = 0.016 + rand() * 0.01, t0 = 1.6 + k * 0.42 + rand() * 0.3, sp = 0.2 + rand() * 0.13;
      dpos.set([x - hw, ys, 0.009, x + hw, ys, 0.009, x - hw, ys - len, 0.009, x + hw, ys - len, 0.009], k * 12);
      for (let v = 0; v < 4; v++) dA.set([t0, len, sp, hw], k * 16 + v * 4);
      dQ.set([-1, 0, 1, 0, -1, 1, 1, 1], k * 8);
      const b = k * 4; didx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    });
    const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(dpos, 3)); dg.setAttribute("aDrip", new THREE.BufferAttribute(dA, 4)); dg.setAttribute("aQ", new THREE.BufferAttribute(dQ, 2)); dg.setIndex(didx);
    fx.mats.drip = mat("drip", dripMaterial);
    fx.drips = new THREE.Mesh(dg, fx.mats.drip); fx.drips.renderOrder = 4; fx.drips.frustumCulled = false;
    wallG.add(fx.drips);
    fx.dripEnds = low.map((q) => ({ x: q.p[0], y: q.p[1] }));
    // the puddle and the light that spills through the hole, both flat on the floor
    fx.mats.puddle = mat("puddle", puddleMaterial);
    fx.puddle = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), fx.mats.puddle);
    fx.puddle.rotation.x = -Math.PI / 2; fx.puddle.position.set(0, -fl + 0.006, 0.42); fx.puddle.renderOrder = 4; fx.puddle.frustumCulled = false;
    wallG.add(fx.puddle);
    fx.mats.spill = mat("spill", () => roomStencil(new THREE.MeshBasicMaterial({ map: tx("spill", () => { const t = spillTexture(); renderer.initTexture(t); return t; }), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false, toneMapped: false })));
    fx.spill = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.7), fx.mats.spill);
    fx.spill.rotation.x = -Math.PI / 2; fx.spill.position.set(0, -fl + 0.009, 1.45); fx.spill.renderOrder = 3; fx.spill.frustumCulled = false;
    wallG.add(fx.spill);
    // drops that fall from the hole's lower edge (positions are set each frame)
    fx.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 8, 6), roomStencil(new THREE.MeshBasicMaterial({ color: 0x8fae32, fog: false, toneMapped: false })), dropS.length);
    fx.drops.count = 0; fx.drops.frustumCulled = false; fx.drops.renderOrder = 4; fx.drops.visible = false; fx.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    wallG.add(fx.drops);
    if (mode !== "ar") buildRoom(fl);
  }

  /* ---------------- the cottage room (VR and flat screen) ---------------- */
  // Built round the crack wall in wall space (x right, y up, z into the room): wood panelling, a window, a toilet that gurgles,
  // a rug. Everything is code and one baked texture per surface, and every part draws only where the mask is not set.
  const mkCanvas = (w, h) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return [cv, cv.getContext("2d")]; };
  const tex2 = (cv, wrap) => { const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; renderer.initTexture(t); return t; };
  function wallpaperTexture() {
    const [cv, c] = mkCanvas(512, 1024), rand = rng(3);
    c.fillStyle = "#dccb9f"; c.fillRect(0, 0, 512, 1024);
    for (let x = 0; x < 512; x += 64) { c.fillStyle = "rgba(150,118,66,0.16)"; c.fillRect(x, 0, 22, 1024); c.fillStyle = "rgba(255,246,214,0.22)"; c.fillRect(x + 30, 0, 5, 1024); }
    // little green sprigs between the stripes
    for (let y = 40; y < 600; y += 70) for (let x = 32; x < 512; x += 64) {
      c.fillStyle = "rgba(96,120,60,0.55)"; c.beginPath(); c.ellipse(x + (y % 140 ? 16 : 0), y, 5, 9, 0.6, 0, 7); c.fill();
      c.beginPath(); c.ellipse(x + 8 + (y % 140 ? 16 : 0), y + 4, 4, 7, -0.7, 0, 7); c.fill();
    }
    // the panelling: vertical boards with grooves and grain
    const top = 640;
    for (let i = 0; i < 5; i++) {
      const x = i * 102.4, tone = 120 + rand() * 26;
      c.fillStyle = `rgb(${tone + 24},${tone - 20},${tone - 66})`; c.fillRect(x, top, 102.4, 1024 - top);
      for (let k = 0; k < 26; k++) { c.strokeStyle = `rgba(60,34,12,${0.05 + rand() * 0.1})`; c.lineWidth = 1 + rand() * 2; c.beginPath(); const gx = x + 8 + rand() * 86; c.moveTo(gx, top); c.bezierCurveTo(gx + (rand() - 0.5) * 12, top + 120, gx + (rand() - 0.5) * 12, top + 260, gx + (rand() - 0.5) * 8, 1024); c.stroke(); }
      c.fillStyle = "rgba(30,16,6,0.55)"; c.fillRect(x - 2, top, 5, 1024 - top);
      c.fillStyle = "rgba(255,200,130,0.16)"; c.fillRect(x + 3, top, 3, 1024 - top);
    }
    // rail, baseboard, crown
    c.fillStyle = "#4e3016"; c.fillRect(0, top - 26, 512, 30); c.fillStyle = "#b07a3a"; c.fillRect(0, top - 26, 512, 6); c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(0, top + 4, 512, 10);
    c.fillStyle = "#3f2810"; c.fillRect(0, 980, 512, 44); c.fillStyle = "#8a5c2c"; c.fillRect(0, 980, 512, 5);
    c.fillStyle = "#efe4c4"; c.fillRect(0, 0, 512, 34); c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(0, 34, 512, 8);
    return tex2(cv, true);
  }
  function plankTexture() {
    const [cv, c] = mkCanvas(512, 512), rand = rng(5);
    for (let i = 0; i < 8; i++) {
      const y = i * 64, tone = 118 + rand() * 30;
      c.fillStyle = `rgb(${tone + 30},${tone - 12},${tone - 60})`; c.fillRect(0, y, 512, 64);
      for (let k = 0; k < 22; k++) { c.strokeStyle = `rgba(70,38,14,${0.06 + rand() * 0.1})`; c.lineWidth = 1 + rand() * 2; c.beginPath(); const gy = y + 6 + rand() * 52; c.moveTo(0, gy); c.bezierCurveTo(170, gy + (rand() - 0.5) * 8, 340, gy + (rand() - 0.5) * 8, 512, gy + (rand() - 0.5) * 6); c.stroke(); }
      c.fillStyle = "rgba(30,14,4,0.6)"; c.fillRect(0, y, 512, 3);
      const j = rand() * 400 + 40; c.fillRect(j, y, 3, 64);
    }
    return tex2(cv, true);
  }
  function rugTexture() {
    const [cv, c] = mkCanvas(512, 340);
    c.fillStyle = "#7a2418"; c.fillRect(0, 0, 512, 340);
    c.fillStyle = "#e9d7a6"; c.fillRect(22, 22, 468, 296);
    c.strokeStyle = "#b04a2a"; c.lineWidth = 8; c.strokeRect(38, 38, 436, 264);
    for (let i = 0; i < 5; i++) { c.save(); c.translate(96 + i * 80, 170); c.rotate(Math.PI / 4); c.fillStyle = i % 2 ? "#b04a2a" : "#2c5a5a"; c.fillRect(-26, -26, 52, 52); c.strokeStyle = "#7a2418"; c.lineWidth = 4; c.strokeRect(-26, -26, 52, 52); c.restore(); }
    for (let x = 0; x < 512; x += 16) { c.fillStyle = "#f0e4c0"; c.fillRect(x, 0, 8, 10); c.fillRect(x, 330, 8, 10); }
    for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(${rand255()},${rand255()},${rand255()},0.05)`; c.fillRect(Math.random() * 512, Math.random() * 340, 2, 2); }
    return tex2(cv, false);
  }
  const rand255 = () => (Math.random() * 255) | 0;
  // The window: a golden-hour sky with a far tree line, a warm sun, a white frame with a cross of bars.
  function windowTexture() {
    const [cv, c] = mkCanvas(384, 448);
    const g = c.createLinearGradient(0, 0, 0, 448);
    g.addColorStop(0, "#39508f"); g.addColorStop(0.5, "#e58a52"); g.addColorStop(0.82, "#ffc27a"); g.addColorStop(1, "#ffdca0");
    c.fillStyle = g; c.fillRect(0, 0, 384, 448);
    const sun = c.createRadialGradient(280, 330, 4, 280, 330, 150);
    sun.addColorStop(0, "rgba(255,250,220,1)"); sun.addColorStop(0.15, "rgba(255,226,150,0.85)"); sun.addColorStop(1, "rgba(255,170,90,0)");
    c.fillStyle = sun; c.fillRect(0, 0, 384, 448);
    c.fillStyle = "rgba(255,255,255,0.35)"; for (const [x, y, w] of [[60, 120, 120], [210, 80, 100], [120, 210, 150]]) { c.beginPath(); c.ellipse(x, y, w / 2, 9, 0, 0, 7); c.fill(); }
    c.fillStyle = "#2a1c26"; c.beginPath(); c.moveTo(0, 410);
    for (let x = 0; x <= 384; x += 16) c.lineTo(x, 392 - ((x * 7) % 23) - (x % 48 ? 0 : 12)); c.lineTo(384, 448); c.lineTo(0, 448); c.fill();
    c.strokeStyle = "#f4ecd8"; c.lineWidth = 22; c.strokeRect(11, 11, 362, 426);
    c.lineWidth = 12; c.beginPath(); c.moveTo(192, 0); c.lineTo(192, 448); c.moveTo(0, 224); c.lineTo(384, 224); c.stroke();
    c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 3; c.strokeRect(22, 22, 340, 404);
    return tex2(cv, false);
  }
  // Soft baked shading for a wall or floor: darker in the corners and toward the ceiling and floor.
  function shade(geo, fn) {
    const pa = geo.attributes.position, uv = geo.attributes.uv, col = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) { const k = fn(uv.getX(i), uv.getY(i)); col[i * 3] = k * 1.0; col[i * 3 + 1] = k * 0.93; col[i * 3 + 2] = k * 0.82; }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  }
  const tileUV = (geo, sx, sy) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return geo; };
  const litMats = [];
  // A lit material for the toilet and the lamp: shaded by a light direction (world space) that follows the room.
  const litMat = (k, color) => mat("lit:" + k, () => {
    const m = roomStencil(new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Color(color) }, uL: { value: new THREE.Vector3(0, 1, 0) } },
      vertexShader: `varying vec3 vN; void main() { vN = mat3(modelMatrix) * normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uC, uL; varying vec3 vN; void main() { vec3 n = normalize(vN); float l = 0.5 + 0.5 * dot(n, uL); gl_FragColor = vec4(uC * (0.5 + 0.62 * l * l) + vec3(1.0, 0.6, 0.3) * 0.1 * max(dot(n, -uL), 0.0), 1.0); }`,
      side: THREE.DoubleSide,
    }));
    litMats.push(m);
    return m;
  });
  function buildRoom(fl) {
    const g = new THREE.Group(); g.name = "portal:room";
    const W = ROOM.w, D = ROOM.d, H = ROOM.h, y0 = -fl;
    const basic = (k, o) => mat("room:" + k, () => roomStencil(new THREE.MeshBasicMaterial({ fog: false, toneMapped: false, ...o })));
    const wallMat = basic("wall", { map: tx("paper", wallpaperTexture), vertexColors: true });
    const wallGeo = (w) => {
      const geo = shade(new THREE.PlaneGeometry(w, H, 14, 8), (u, v) => 0.96 - 0.3 * Math.exp(-Math.min(u, 1 - u) * 9 * (W / w)) - 0.22 * (1 - sstep(0, 0.16, v)) - 0.16 * sstep(0.86, 1, v));
      return tileUV(geo, w / 1.35, 1);
    };
    const front = new THREE.Mesh(wallGeo(W), wallMat); front.position.set(0, y0 + H / 2, -0.002);
    const back = new THREE.Mesh(wallGeo(W), wallMat); back.position.set(0, y0 + H / 2, D); back.rotation.y = Math.PI;
    const left = new THREE.Mesh(wallGeo(D), wallMat); left.position.set(-W / 2, y0 + H / 2, D / 2); left.rotation.y = Math.PI / 2;
    const right = new THREE.Mesh(wallGeo(D), wallMat); right.position.set(W / 2, y0 + H / 2, D / 2); right.rotation.y = -Math.PI / 2;
    const floorGeo = tileUV(shade(new THREE.PlaneGeometry(W, D, 12, 12), (u, v) => 0.98 - 0.4 * Math.exp(-Math.min(u, 1 - u) * 7) - 0.4 * Math.exp(-Math.min(v, 1 - v) * 7)), W / 1.0, D / 1.0);
    const floor = new THREE.Mesh(floorGeo, basic("floor", { map: tx("planks", plankTexture), vertexColors: true })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, y0, D / 2);
    const ceil = new THREE.Mesh(shade(new THREE.PlaneGeometry(W, D, 6, 6), (u, v) => 0.86 - 0.18 * Math.exp(-Math.min(u, 1 - u) * 8)), basic("ceil", { color: 0xefe4c4, vertexColors: true })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, y0 + H, D / 2);
    // the window in the left wall, its light on the floor
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.35), basic("window", { map: tx("window", windowTexture) })); win.position.set(-W / 2 + 0.006, y0 + 1.55, 1.55); win.rotation.y = Math.PI / 2;
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.4), basic("shaft", { map: tx("spill", () => { const t = spillTexture(); renderer.initTexture(t); return t; }), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    shaft.rotation.set(-Math.PI / 2, 0, Math.PI / 2); shaft.position.set(-W / 2 + 1.3, y0 + 0.01, 1.55); shaft.renderOrder = 5;
    // the rug under your feet
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), basic("rug", { map: tx("rug", rugTexture) })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, y0 + 0.006, D / 2 + 0.1);
    // a hanging lamp
    const shadeM = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.2, 20, 1, true), litMat("lamp", 0x8a4a2a)); shadeM.position.set(0, y0 + H - 0.34, D / 2);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 5), basic("cord", { color: 0x2a1c14 })); cord.position.set(0, y0 + H - 0.2, D / 2);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), basic("bulb", { color: 0xffe2a8 })); bulb.position.set(0, y0 + H - 0.42, D / 2);
    g.add(front, back, left, right, floor, ceil, win, shaft, rug, shadeM, cord, bulb);
    // the toilet: a lathe bowl (stretched into an oval), a seat ring, a lid on a hinge, a tank with a gold handle
    const T = new THREE.Group(); T.position.set(1.4, y0, 0.36);
    const porcelain = litMat("porcelain", COLORS.porcelain), goldM = litMat("gold", COLORS.gold), sludgeM = litMat("sludge", 0x6a8a1e);
    const prof = [[0.001, 0], [0.13, 0], [0.145, 0.1], [0.2, 0.26], [0.245, 0.36], [0.265, 0.43], [0.245, 0.47], [0.2, 0.475], [0.19, 0.44], [0.13, 0.36], [0.001, 0.32]].map((p) => new THREE.Vector2(p[0], p[1]));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), porcelain); bowl.scale.set(1, 1, 1.32); bowl.position.z = 0.12;
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.028, 8, 28), porcelain); seat.rotation.x = Math.PI / 2; seat.scale.set(1, 1.32, 1); seat.position.set(0, 0.485, 0.12);
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.5, -0.17);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.022, 24), porcelain); lid.scale.set(1, 1, 1.32); lid.position.set(0, 0, 0.29);
    lidPivot.add(lid);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.2), porcelain); tank.position.set(0, 0.68, -0.28);
    const tankTop = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.045, 0.24), porcelain); tankTop.position.set(0, 0.9, -0.28);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), goldM); handle.position.set(-0.17, 0.79, -0.165);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), goldM); knob.position.set(-0.22, 0.79, -0.165);
    const ooze = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), sludgeM); ooze.rotation.x = -Math.PI / 2; ooze.scale.set(1, 1.32, 1); ooze.position.set(0, 0.452, 0.12);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), basic("glow", { color: 0x9cff3a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    glow.rotation.x = -Math.PI / 2; glow.scale.set(1, 1.32, 1); glow.position.set(0, 0.5, 0.12); glow.renderOrder = 6;
    T.add(bowl, seat, lidPivot, tank, tankTop, handle, knob, ooze, glow);
    g.add(T);
    fx.room = { g, toilet: T, lid: lidPivot, glow, ooze, fl };
    wallG.add(g);
    // the light in the room comes from the window: from −x, above
    fx.lightLocal = new THREE.Vector3(-0.7, 0.6, 0.35).normalize();
  }
  function roomLight() {
    if (!litMats.length) return;
    V1.copy(fx.lightLocal).transformDirection(wallG.matrixWorld);
    for (const m of litMats) m.uniforms.uL.value.copy(V1);
  }

  /* ---------------- chunks of wall, dust, drops ---------------- */
  const CH_A = [[0.86, 0.83, 0.76], [0.74, 0.7, 0.64], [0.9, 0.87, 0.8], [0.66, 0.61, 0.55], [0.86, 0.83, 0.76], [0.52, 0.4, 0.28]];
  const CH_V = [[0.86, 0.8, 0.62], [0.62, 0.4, 0.2], [0.5, 0.32, 0.16], [0.9, 0.84, 0.66], [0.75, 0.66, 0.45]];
  function spawnChunks() {
    const rand = rng(11), pal = mode === "ar" ? CH_A : CH_V, ca = fx.chunks.geometry.attributes.aCol;
    for (let i = 0; i < NCH; i++) {
      const c = chunkS[i], lx = (rand() - 0.5) * HOLE.w * 0.95, ly = (rand() - 0.5) * HOLE.h * 0.95, big = i < 8;
      V1.set(lx, ly, 0.03).applyMatrix4(wallG.matrix);
      c.p.copy(V1);
      const sp = 1.4 + rand() * 3.0;
      c.v.copy(wall.N).multiplyScalar(sp).addScaledVector(wall.R, lx * 5 + Math.sign(lx || 1) * (0.6 + rand() * 1.2)).addScaledVector(UP, ly * 2.6 + 1.0 + rand() * 1.6);
      c.q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6));
      c.w.set((rand() - 0.5) * 9, (rand() - 0.5) * 9, (rand() - 0.5) * 9);
      const sz = big ? 0.09 + rand() * 0.07 : 0.035 + rand() * 0.07;
      c.s.set(sz * (0.7 + rand() * 0.6), sz * (0.5 + rand() * 0.8), sz * (0.25 + rand() * 0.4));
      c.a = 1; c.rest = false;
      const k = pal[(rand() * pal.length) | 0], j = 0.85 + rand() * 0.3;
      ca.setXYZ(i, k[0] * j, k[1] * j, k[2] * j);
    }
    ca.needsUpdate = true;
    fx.chunks.count = NCH; fx.chunks.visible = true;
  }
  const CM = new THREE.Matrix4(), CS = new THREE.Vector3();
  function chunkStep(dt, fade) {
    if (!fx.chunks.visible) return;
    for (let i = 0; i < NCH; i++) {
      const c = chunkS[i];
      if (!c.rest) {
        c.v.y -= 9.8 * dt; c.v.multiplyScalar(1 - 0.25 * dt);
        c.p.addScaledVector(c.v, dt);
        const wl = c.w.length();
        if (wl > 1e-4) { Q1.setFromAxisAngle(V2.copy(c.w).divideScalar(wl), wl * dt); c.q.premultiply(Q1); }
        const fy = wall.floorY + c.s.y * 0.6;
        if (c.p.y < fy) {
          c.p.y = fy; c.v.y *= -0.3; c.v.x *= 0.55; c.v.z *= 0.55; c.w.multiplyScalar(0.45);
          if (Math.abs(c.v.y) < 0.5 && c.v.lengthSq() < 0.6) { c.rest = true; c.w.set(0, 0, 0); }
        }
      }
      CS.copy(c.s).multiplyScalar(fade);
      CM.compose(c.p, c.q, CS);
      fx.chunks.setMatrixAt(i, CM);
    }
    fx.chunks.instanceMatrix.needsUpdate = true;
  }
  const dustA = () => fx.dust.geometry.attributes.aA;
  let dustN = 0;
  function puff(x, y, z, vx, vy, vz, life, s0, s1, a0) {
    const d = dustS[dustN++ % NDU];
    d.p.set(x, y, z); d.v.set(vx, vy, vz); d.age = 0; d.life = life; d.s0 = s0; d.s1 = s1; d.a0 = a0;
    fx.dust.visible = true;
  }
  function dustStep(dt) {
    let n = 0;
    const a = dustA();
    for (let i = 0; i < NDU; i++) {
      const d = dustS[i];
      if (d.age >= d.life) continue;
      d.age += dt; d.p.addScaledVector(d.v, dt); d.v.multiplyScalar(1 - 1.4 * dt);
      const t = clamp(d.age / d.life, 0, 1), sz = d.s0 + (d.s1 - d.s0) * easeOut(t);
      CM.makeScale(sz, sz, sz).setPosition(d.p);
      fx.dust.setMatrixAt(n, CM);
      a.setX(n, d.a0 * sstep(0, 0.12, t) * (1 - sstep(0.25, 1, t)));
      n++;
    }
    fx.dust.count = n;
    if (n) { fx.dust.instanceMatrix.needsUpdate = true; a.needsUpdate = true; }
  }
  // dust off the crack as it grows
  function crackDust(n, amount) {
    const rand = Math.random;
    for (let i = 0; i < n; i++) {
      const lx = (rand() - 0.5) * 1.1, ly = (rand() - 0.5) * 1.5;
      V1.set(lx, ly, 0.04).applyMatrix4(wallG.matrix);
      puff(V1.x, V1.y, V1.z, wall.N.x * 0.15, -0.1, wall.N.z * 0.15, 1.2 + rand() * 0.8, 0.08, 0.22 + rand() * 0.15, 0.22 * amount);
    }
  }
  // sludge drops that fall from the hole's lower edge into the puddle
  function dropStep(dt) {
    const fl = wall.fl || 1.35;
    for (const d of dropS) {
      if (!d.on) continue;
      d.vy -= 9.8 * dt; d.y += d.vy * dt;
      if (d.y <= -fl + 0.02) {
        d.on = false;
        // a ring in the puddle at the spot where it fell
        const k = (rippleN++) % 4, u = fx.mats.puddle.uniforms;
        u.uRip.value[k].set(d.x, -(d.z - 0.42), u.uT.value);
        audio.sfx("drip", { pos: wallToWorld(d.x, -fl, d.z, V3), vol: 0.5 });
      }
    }
  }
  let rippleN = 0;
  const wallToWorld = (x, y, z, out) => out.set(x, y, z).applyMatrix4(wallG.matrix).applyMatrix4(rig.matrixWorld);

  /* ---------------- floor arrow and chalk ---------------- */
  const arrow = { goal: null, t: 0, hideNear: 0 };
  const goalObj = { x: 0, z: 0 };
  const aimAt = (x, z) => { goalObj.x = x; goalObj.z = z; arrow.goal = goalObj; }; // the arrow points at a floor point; one object, so no garbage each frame
  function arrowStep(dt) {
    if (!arrow.goal || !inp) { if (fx.arrow) fx.arrow.visible = false; return; }
    arrow.t += dt;
    const hl = inp.head.local.pos, dx = arrow.goal.x - hl.x, dz = arrow.goal.z - hl.z, l = Math.hypot(dx, dz);
    if (l < arrow.hideNear) { fx.arrow.visible = false; return; }
    const ux = dx / l, uz = dz / l, bob = 0.06 * Math.sin(arrow.t * 4);
    fx.arrow.position.set(hl.x + ux * (0.95 + bob), wall.floorY + 0.02, hl.z + uz * (0.95 + bob));
    fx.arrow.rotation.set(-Math.PI / 2, yawOf(ux, uz), 0);
    fx.mats.arrow.opacity = 0.55 + 0.4 * Math.sin(arrow.t * 5);
    fx.arrow.visible = true;
  }
  function chalkBuild() {
    for (const c of chalkG.children.slice()) { c.removeFromParent(); c.geometry.dispose(); }
    const loops = [];
    const seatedOff = (G().seatedOffset) || 0;
    if (xr && xr.planes) {
      for (const e of xr.planes.values()) if (e.label === "floor" && e.polygon.length >= 3) loops.push({ closed: true, pts: e.polygon.map((p) => { V1.set(p.x, 0, p.z).applyMatrix4(e.matrix); return [V1.x, V1.z]; }) });
      if (!loops.length) {
        const seg = { sx: 0, sz: 0, ex: 0, ez: 0 };
        for (const e of xr.planes.values()) if (isVertical(e) && !OPENING[e.label] && planeSeg(e, seg)) loops.push({ closed: false, pts: [[seg.sx, seg.sz], [seg.ex, seg.ez]] });
      }
    }
    if (!loops.length) return false;
    const pos = [], q = [], idx = [];
    for (const lp of loops) {
      const n = lp.pts.length, m = lp.closed ? n : n - 1;
      let u = 0;
      for (let i = 0; i < m; i++) {
        const a = lp.pts[i], b = lp.pts[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
        if (l < 0.02) continue;
        const nx = (-dz / l) * 0.035, nz = (dx / l) * 0.035, base = pos.length / 3;
        pos.push(a[0] + nx, 0, a[1] + nz, a[0] - nx, 0, a[1] - nz, b[0] + nx, 0, b[1] + nz, b[0] - nx, 0, b[1] - nz);
        q.push(u, 1, u, -1, u + l, 1, u + l, -1);
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        u += l;
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("aQ", new THREE.Float32BufferAttribute(q, 2)); g.setIndex(idx);
    const cm = mat("chalk", chalkMaterial);
    cm.uniforms.uA.value = 1;
    const mesh = new THREE.Mesh(g, cm); mesh.renderOrder = 5; mesh.frustumCulled = false;
    chalkG.add(mesh);
    chalkG.position.set(0, wall.floorY + 0.012 - seatedOff, 0);
    chalkG.visible = true;
    return true;
  }

  /* ---------------- the room check (mixed reality) ---------------- */
  // How much clear floor there is round a point (tracking space): the distance to the nearest wall or piece of furniture the
  // headset knows, in the horizontal plane. Floor, ceiling, things above your head and things flat on the floor do not count.
  const room = { segs: [], boxes: [], has: false, bx0: 0, bx1: 0, bz0: 0, bz1: 0, loop: null };
  function roomScan(hy) {
    room.segs.length = 0; room.boxes.length = 0; room.has = false; room.loop = null;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const grow = (x, z) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); };
    if (xr && xr.planes) {
      const seg = { sx: 0, sz: 0, ex: 0, ez: 0, len: 0, y0: 0, y1: 0 };
      for (const e of xr.planes.values()) {
        room.has = true;
        if (e.label === "floor") { if (e.polygon.length >= 3) room.loop = e.polygon.map((p) => { V1.set(p.x, 0, p.z).applyMatrix4(e.matrix); grow(V1.x, V1.z); return [V1.x, V1.z]; }); continue; }
        if (e.label === "ceiling" || OPENING[e.label] === 1) continue;
        if (isVertical(e)) { if (planeSeg(e, seg)) { room.segs.push([seg.sx, seg.sz, seg.ex, seg.ez]); grow(seg.sx, seg.sz); grow(seg.ex, seg.ez); } continue; }
        // a table or a couch: its top, if it is between the knees and the head
        const y = e.matrix.elements[13];
        if (y < 0.15 || y > hy + 0.3 || e.polygon.length < 3) continue;
        const pts = e.polygon.map((p) => { V1.set(p.x, 0, p.z).applyMatrix4(e.matrix); return [V1.x, V1.z]; });
        for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; room.segs.push([a[0], a[1], b[0], b[1]]); }
      }
    }
    if (xr && xr.meshes) {
      for (const e of xr.meshes.values()) {
        room.has = true;
        if (e.label === "global mesh" || !e.vertices) continue;
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let i = 0; i < e.vertices.length; i += 3) { V1.set(e.vertices[i], e.vertices[i + 1], e.vertices[i + 2]).applyMatrix4(e.matrix); a0 = Math.min(a0, V1.x); a1 = Math.max(a1, V1.x); b0 = Math.min(b0, V1.z); b1 = Math.max(b1, V1.z); y0 = Math.min(y0, V1.y); y1 = Math.max(y1, V1.y); }
        if (y1 < 0.15 || y0 > hy + 0.3) continue;
        room.boxes.push([a0, a1, b0, b1]);
      }
    }
    room.bx0 = x0; room.bx1 = x1; room.bz0 = z0; room.bz1 = z1;
    return room.has;
  }
  function segDist(x, z, a) {
    const ex = a[2] - a[0], ez = a[3] - a[1], l2 = ex * ex + ez * ez, t = l2 > 0 ? clamp(((x - a[0]) * ex + (z - a[1]) * ez) / l2, 0, 1) : 0;
    return Math.hypot(x - (a[0] + ex * t), z - (a[1] + ez * t));
  }
  function clearance(x, z) {
    let d = Infinity;
    for (const a of room.segs) d = Math.min(d, segDist(x, z, a));
    for (const b of room.boxes) { const dx = Math.max(b[0] - x, 0, x - b[1]), dz = Math.max(b[2] - z, 0, z - b[3]); d = Math.min(d, Math.hypot(dx, dz)); }
    return d;
  }
  const inLoop = (x, z, lp) => { let ins = false; for (let i = 0, j = lp.length - 1; i < lp.length; j = i++) if ((lp[i][1] > z) !== (lp[j][1] > z) && x < ((lp[j][0] - lp[i][0]) * (z - lp[i][1])) / (lp[j][1] - lp[i][1]) + lp[i][0]) ins = !ins; return ins; };
  // The most open floor point: the best clearance, a little favouring the nearer ones.
  function openPoint(hx, hz) {
    let best = null, bs = -Infinity;
    if (!isFinite(room.bx0)) return null;
    for (let x = room.bx0; x <= room.bx1; x += 0.25) for (let z = room.bz0; z <= room.bz1; z += 0.25) {
      if (room.loop && !inLoop(x, z, room.loop)) continue;
      const c = clearance(x, z), sc = Math.min(c, 1.6) - 0.12 * Math.hypot(x - hx, z - hz);
      if (sc > bs) { bs = sc; best = { x, z, c }; }
    }
    return best;
  }

  /* ---------------- the sequence ---------------- */
  const gl = { gurgle: null, drip: null };
  const say = (i) => { ui.sayLine("intro", i, inp ? inp.kind : undefined); s.said = i; s.sayT = 0; };
  const sayRepeat = (dt) => { if (s.said >= 0 && (s.sayT += dt) >= T.repeat) { s.sayT = 0; ui.sayLine("intro", s.said, inp ? inp.kind : undefined); } };
  const crackWorld = new THREE.Vector3(), crackNormal = new THREE.Vector3();
  function syncTarget() {
    crackWorld.copy(wall.C).applyMatrix4(rig.matrixWorld);
    crackNormal.copy(wall.N).transformDirection(rig.matrixWorld);
    target.pos.x = crackWorld.x; target.pos.y = crackWorld.y; target.pos.z = crackWorld.z;
    target.normal.x = crackNormal.x; target.normal.y = crackNormal.y; target.normal.z = crackNormal.z;
  }
  function releaseRopes() { release(P, 0); release(P, 1); }
  function stopLoops() { for (const k of ["gurgle", "drip"]) { if (gl[k]) { try { gl[k].stop(); } catch (e) { /* audio off */ } gl[k] = null; } } }
  const gurglePos = (out) => (mode === "ar" || !fx.room ? out.copy(crackWorld) : wallToWorld(1.15, -wall.fl + 0.5, 0.36, out));
  const puddlePos = (out) => wallToWorld(0, -wall.fl + 0.02, 0.42, out);
  function go(next) {
    phase = Pt.phase = next; pt = 0;
    const f = ENTER[next];
    if (f) f();
  }
  const ENTER = {
    gurgle() {
      say(0);
      s.said = 0;
      gurglePos(V3);
      gl.gurgle = audio.loop("gurgle", V3.clone());
    },
    crack() {
      s.crackOn = true; s.surge = -1;
      puddlePos(V3);
      gl.drip = audio.loop("drip", V3.clone());
    },
    hole() {
      s.holeOn = true;
      audio.sfx("crack", { pos: crackWorld, vol: 1.3 });
      haptic("left", 0.35, 90); haptic("right", 0.35, 90);
      crackDust(10, 1.0);
      ropes.addTarget(target);
    },
    shoot() { say(2); },
    yank() { say(3); s.yankT = 0; },
    room() { say(5); s.roomT = 0; },
    burst() { /* startBurst does the work */ },
  };
  // The wall bursts: ropes let go, chunks and dust fly (slowly at first), the sphere mask starts to grow, and the King wakes for a moment.
  function startBurst() {
    releaseRopes();
    ropes.removeTarget("crack");
    audio.sfx("burst", { pos: crackWorld });
    if (gl.gurgle) { try { gl.gurgle.stop(); } catch (e) { /* audio off */ } gl.gurgle = null; }
    audio.ambience(1);
    haptic("left", 1, 140); haptic("right", 1, 140);
    arrow.goal = null;
    spawnChunks();
    for (let i = 0; i < 14; i++) {
      const rd = Math.random;
      V1.set((rd() - 0.5) * HOLE.w, (rd() - 0.5) * HOLE.h, 0.05).applyMatrix4(wallG.matrix);
      puff(V1.x, V1.y, V1.z, wall.N.x * (1 + rd() * 2.5) + (rd() - 0.5) * 0.8, 0.2 + rd() * 0.8, wall.N.z * (1 + rd() * 2.5) + (rd() - 0.5) * 0.8, 2.2 + rd() * 1.2, 0.3, 1.1 + rd() * 0.9, 0.5);
    }
    if (fx.tunnel) fx.tunnel.visible = false;
    fx.sphere.position.copy(wall.C);
    s.r = 0.9; fx.sphere.scale.setScalar(s.r); fx.sphere.visible = true;
    s.flash = 1; s.kingT = 0; s.burstT = 0;
    if (view.setKing) view.setKing(1);
    go("burst");
  }
  // The end of the reveal: the stencil comes off, the room things go, the chalk outline of your room stays, and play starts.
  function finishReveal() {
    const chalked = chalkBuild();
    s.chalkT = chalked ? 0 : -1;
    s.stirAt = 0.3; // the King stirs for a moment once the game has started
    finish();
  }
  function finish() {
    if (s.hid) { s.hid = false; view.root.visible = true; }
    view.stencil(null);
    releaseRopes();
    ropes.removeTarget("crack");
    ropes.setMode("all");
    stopLoops();
    audio.ambience(1);
    if (ui.setSkip) ui.setSkip(null);
    hideRoom();
    Pt.active = false; Pt.phase = phase = "done";
    for (const f of doneFns.slice()) { try { f(); } catch (e) { console.error(e); } }
  }
  function hideRoom() {
    clearWall();
    if (fx.chunks) { fx.chunks.visible = false; fx.chunks.count = 0; }
    if (fx.dust) { fx.dust.visible = false; fx.dust.count = 0; }
    if (fx.sphere) fx.sphere.visible = false;
    if (fx.spinner) fx.spinner.visible = false;
    if (fx.arrow) fx.arrow.visible = false;
    if (fx.flash) fx.flash.visible = false;
    arrow.goal = null;
    root.visible = false;
  }
  // Skip: no wall was picked yet, so face the Needle the way the stub did (the head's own direction plays the crack's).
  function finishSkip() {
    if (!placed && inp) {
      headFwd(inp.head.local.quat, V4);
      placeRig(S.yaw - yawOf(V4.x, V4.z), S.x, S.y, S.z);
      placed = true;
    }
    if (view.setKing) view.setKing(0);
    s.kingT = -1;
    finish();
  }
  // A recentre moved the tracking space: a wall of the real room moved with it (its plane says where), and the rig is placed again
  // so the city stays where the crack shows it. A fixed crack is carried by the head's own jump.
  function afterReset(hl, yaw) {
    if (wall.kind !== "plane" && last.ok) {
      const a = yaw - last.yaw, c = Math.cos(a), sn = Math.sin(a);
      const rel = (x, z) => [hl.x + (x - last.x) * c + (z - last.z) * sn, hl.z - (x - last.x) * sn + (z - last.z) * c];
      const p = rel(wall.C.x, wall.C.z);
      wall.C.x = p[0]; wall.C.z = p[1];
      wall.N.set(wall.N.x * c + wall.N.z * sn, 0, -wall.N.x * sn + wall.N.z * c);
    }
    wallFrame();
    if (placed) fixRig(hl);
  }
  function fixRig(hl) {
    placeRig(S.yaw - yawOf(wall.C.x - hl.x, wall.C.z - hl.z), S.x, S.y, S.z);
    placed = true;
  }
  function pickAndPlace() {
    unpark(); wallG.visible = true; s.parked = 0;
    const hl = inp.head.local.pos;
    headFwd(inp.head.local.quat, V4);
    const fw = V4.clone();
    if (mode === "ar") chooseWall(hl, fw); else virtualWall(hl, fw, 0);
    wallFrame();
    buildWall();
    wallFrame();
    fixRig(hl);
    syncTarget();
    root.visible = true;
    roomLight();
    // the angle to the crack from where you look: over 60° and a floor arrow shows the way
    const yawHead = yawOf(fw.x, fw.z), yawCrack = yawOf(wall.C.x - hl.x, wall.C.z - hl.z);
    wall.angle = Math.abs(wrap(yawCrack - yawHead));
  }

  // A wall 30 m behind the tracking origin with everything visible but out of sight (a mask of 1 mm), so a compile pass sees it.
  function park() {
    wall.kind = "virtual"; wall.plane = null; wall.label = "parked"; wall.floorY = 0; wall.cy = 1.35;
    wall.C.set(0, 1.35, 30); wall.N.set(0, 0, -1);
    wallFrame(); buildWall(); wallFrame();
    root.visible = true; wallG.visible = true; s.parked = 1;
    fx.holeG.visible = true; fx.holeG.scale.set(0.001, 0.001, 1);
    fx.chunks.visible = true; fx.chunks.count = 0; fx.dust.visible = true; fx.dust.count = 0;
    fx.sphere.position.set(0, 0, 30); fx.sphere.scale.setScalar(0.001); fx.sphere.visible = true;
    fx.arrow.position.set(0, 0, 30); fx.arrow.visible = true;
    fx.spinner.visible = true; fx.spinner.scale.setScalar(0.001);
    fx.flash.visible = true;
  }
  const unpark = () => { fx.sphere.visible = false; fx.arrow.visible = false; fx.spinner.visible = false; fx.spinner.scale.setScalar(1); fx.flash.visible = false; fx.chunks.visible = false; fx.dust.visible = false; };

  /* ---------------- per frame ---------------- */
  let toiletT = 0, dropT = 0, dropI = 0;
  function timers(dt) {
    // the King wakes for a moment at the burst (the pod glows green), then sleeps again until the game wakes him
    if (s.kingT >= 0) { s.kingT += dt; if (s.kingT >= T.kingWake) { s.kingT = -1; if (view.setKing) view.setKing(0); } }
    if (s.stirAt > 0) { s.stirAt -= dt; if (s.stirAt <= 0) { const gm = G().game; if (gm && gm.stir) gm.stir(2.8); } }
    // the chalk outline fades out over the last seconds
    if (s.chalkT >= 0) {
      s.chalkT += dt;
      const a = 1 - sstep(T.chalk - 1.5, T.chalk, s.chalkT);
      for (const c of chalkG.children) if (c.material.uniforms) c.material.uniforms.uA.value = a;
      if (s.chalkT >= T.chalk) { s.chalkT = -1; chalkG.visible = false; for (const c of chalkG.children.slice()) { c.removeFromParent(); c.geometry.dispose(); } }
    }
  }
  function fxUpdate(dt) {
    const m = fx.mats;
    if (!m.decal) return;
    // the crack grows in surges, each with a crack of its own
    const t = phase === "crack" ? clamp(pt / T.crack, 0, 1) : s.crackOn ? 1 : 0;
    s.grow = 0.92 * (0.16 * sstep(0, 0.22, t) + 0.3 * sstep(0.27, 0.5, t) + 0.3 * sstep(0.54, 0.8, t) + 0.24 * sstep(0.82, 1.0, t)) + (t >= 1 ? 0.08 : 0);
    m.decal.uniforms.uGrow.value = t <= 0 ? 0 : s.grow;
    m.decal.uniforms.uSeep.value = sstep(0.25, 0.9, t);
    m.decal.uniforms.uPulse.value = sstep(0.72, 1, t) * (phase === "crack" ? 1 : 0.6);
    fx.decal.visible = t > 0;
    if (s.crackOn) s.dripT += dt;
    m.drip.uniforms.uT.value = s.dripT;
    m.puddle.uniforms.uT.value = s.dripT;
    m.puddle.uniforms.uSize.value = sstep(2.2, 13, s.dripT) * 0.92 + (s.dripT > 13 ? 0.08 : 0);
    fx.puddle.visible = s.dripT > 2.2;
    // the hole
    const open = phase === "hole" ? easeOut(Math.min(1, pt / T.hole)) : s.holeOn ? 1 : 0;
    s.hole = open;
    fx.holeG.visible = open > 0.002;
    fx.holeG.scale.set(Math.max(0.001, open), Math.max(0.001, open), 1);
    m.rim.uniforms.uOpen.value = open;
    m.spill.opacity = 0.85 * open;
    fx.spill.visible = open > 0.01;
    // the room's own life
    if (fx.room) {
      toiletT += dt;
      const g = phase === "gurgle" ? sstep(0, 2.5, pt) * 0.6 : s.crackOn ? 0.6 + 0.4 * (phase === "crack" ? t : 1) : 0;
      fx.room.lid.rotation.x = -g * (0.05 * Math.abs(Math.sin(toiletT * 21)) + 0.035 * Math.abs(Math.sin(toiletT * 13.7)));
      fx.room.glow.material.opacity = g * (0.24 + 0.18 * Math.sin(toiletT * 8.3));
      roomLight();
    }
    // drops fall from the lower edge of the hole once it has dripped for a while
    if (fx.dripEnds && fx.dripEnds.length && s.crackOn && s.dripT > 1.4 && fx.drops) {
      dropT += dt;
      if (dropT > 0.85) {
        dropT = 0;
        const e = fx.dripEnds[dropI++ % fx.dripEnds.length], d = dropS.find((q) => !q.on);
        if (d) { d.on = true; d.x = e.x + (Math.random() - 0.5) * 0.05; d.y = e.y - 0.04; d.z = 0.03 + Math.random() * 0.03; d.vy = 0; }
      }
      dropStep(dt);
      let n = 0;
      for (const d of dropS) if (d.on) { CM.makeTranslation(d.x, d.y, d.z); fx.drops.setMatrixAt(n++, CM); }
      fx.drops.count = n; fx.drops.visible = n > 0;
      if (n) fx.drops.instanceMatrix.needsUpdate = true;
    }
  }

  function update(dt, time, frame, input) {
    if (!Pt.active) return;
    inp = input;
    total += dt; pt += dt;
    const hl = input.head.local.pos;
    headFwd(input.head.local.quat, V4);
    const yawNow = yawOf(V4.x, V4.z);
    if (skipReq) { if (phase === "burst" || phase === "reveal") finishReveal(); else finishSkip(); return; }
    // the Skip button: always on later runs, on the first run after 30 s
    const allowed = !firstRun || total >= INTRO.skipAfter;
    if (allowed !== s.skipOn) { s.skipOn = allowed; if (ui.setSkip) ui.setSkip(allowed ? Pt.skip : null); }
    timers(dt);
    if (phase === "prep") {
      // a few frames after the compile pass has seen the parked things, they go
      if (s.parked && ++s.parked > 4) { s.parked = 0; wallG.visible = false; unpark(); root.visible = false; }
      if (firstRun && mode !== "desktop") {
        // "Clear the space around you." and the stance question, before the crack
        if (s.stance === "none") { s.stance = "asking"; if (mode === "ar") ui.sayLine("intro", 4, input.kind); ui.askStance().then(() => { s.stance = "done"; }); }
        if (s.stance === "asking") { last.ok = true; last.x = hl.x; last.z = hl.z; last.yaw = yawNow; return; }
      }
      if (mode === "ar" && xr && xr.features && xr.features.includes("plane-detection") && xr.planes.size === 0 && s.waitPlanes < 3) { s.waitPlanes += dt; return; }
      if (s.defer > 0) { s.defer--; return; }
      if (s.hid) { s.hid = false; view.stencil(1); view.root.visible = true; }
      pickAndPlace();
      go("gurgle");
    }
    if (!placed) return;
    if (resetSeen) { resetSeen = false; afterReset(hl, yawNow); }
    last.ok = true; last.x = hl.x; last.z = hl.z; last.yaw = yawNow;
    wallFrame();
    syncTarget();
    if (gl.gurgle) { gurglePos(V3); gl.gurgle.setPos(V3); }
    if (gl.drip) { puddlePos(V3); gl.drip.setPos(V3); }

    // where the crack is, from where you look
    const off = Math.abs(wrap(yawOf(wall.C.x - hl.x, wall.C.z - hl.z) - yawNow));
    switch (phase) {
      case "gurgle": {
        if (pt > 1.7 && s.said === 0) say(1);
        // a wall off to the side or behind: a floor arrow shows the way and the gurgle comes from there
        arrow.hideNear = 0;
        if (off > WALL.off) { aimAt(wall.C.x, wall.C.z); s.gaze += dt; } else if (off < 45 * DEG) arrow.goal = null;
        const facing = off < WALL.off;
        if (pt >= T.gurgleMin && (facing || s.gaze >= T.gazeMax)) { arrow.goal = null; go("crack"); }
        break;
      }
      case "crack": {
        // each surge of the crack has its own sound and a puff of dust
        const marks = [0.0, 1.3, 2.5, 3.8];
        for (let i = 0; i < marks.length; i++) if (s.surge < i && pt >= marks[i]) { s.surge = i; audio.sfx("crack", { pos: crackWorld, vol: 0.5 + i * 0.15, pitch: 1 - i * 0.08 }); haptic("left", 0.15 + i * 0.05, 50); haptic("right", 0.15 + i * 0.05, 50); crackDust(3 + i, 0.6 + i * 0.2); }
        // warm the city's programs while the crack grows: no hitch when the wall opens
        if (!s.warmed && pt > 0.6 && view.startReady !== false) { s.warmed = true; if (view.warm) view.warm(renderer, camera); }
        if (off > WALL.off) aimAt(wall.C.x, wall.C.z); else if (off < 45 * DEG) arrow.goal = null;
        const ready = view.startReady !== false;
        if (pt >= T.crack) { if (ready) { fx.spinner.visible = false; go("hole"); } else fx.spinner.visible = true; }
        break;
      }
      case "hole": {
        if (off > WALL.off) aimAt(wall.C.x, wall.C.z); else if (off < 45 * DEG) arrow.goal = null;
        if (pt >= T.hole) go("shoot");
        break;
      }
      case "shoot": {
        sayRepeat(dt);
        if (off > WALL.off) aimAt(wall.C.x, wall.C.z); else if (off < 45 * DEG) arrow.goal = null;
        // after 10 s the crack takes a wider aim; after 20 s a cup flies from your right hand by itself
        if (pt > INTRO.widenAfter && !s.widened) { s.widened = true; target.cone = 35; }
        if (pt > INTRO.autoFireAfter && !s.auto) { s.auto = true; autoFire(); }
        break;
      }
      case "yank": {
        sayRepeat(dt);
        s.yankT += dt;
        if (off > WALL.off) aimAt(wall.C.x, wall.C.z); else if (off < 45 * DEG) arrow.goal = null;
        if (s.yankT > INTRO.easyYankAfter) s.easy = true;
        if (s.yankT > INTRO.burstAfter) pumped();
        break;
      }
      case "room": {
        s.roomT += dt;
        const c = s.roomClear = clearance(hl.x, hl.z), best = s.best;
        if (best) aimAt(best.x, best.z); else arrow.goal = null;
        arrow.hideNear = 0.5;
        if (c >= 1.0 || (best && c >= best.c - 0.05) || s.roomT >= T.roomWait) { arrow.goal = null; startBurst(); }
        break;
      }
      case "burst":
      case "reveal": {
        s.burstT += dt;
        const slow = s.burstT < T.slow.secs ? T.slow.scale : 1;
        s.slow = slow;
        s.r += s.revealSpeed * dt;
        fx.sphere.scale.setScalar(s.r);
        // the chunks and the dust fly slowly for the first 0.6 s while the camera stays still, then at full speed
        const fadeOut = 1 - sstep(INTRO.revealEnd - 8, INTRO.revealEnd, s.r);
        chunkStep(dt * slow, Math.max(0.001, fadeOut));
        dustStep(dt * slow);
        if (phase === "burst" && s.burstT >= T.slow.secs) go("reveal");
        if (s.r >= INTRO.revealEnd) { finishReveal(); return; }
        break;
      }
    }
    if (phase !== "burst" && phase !== "reveal") { dustStep(dt); }
    if (s.flash > 0) { s.flash = Math.max(0, s.flash - dt / 0.45); fx.mats.flash.opacity = 0.7 * s.flash * s.flash; fx.flash.visible = s.flash > 0.01; }
    if (fx.spinner && fx.spinner.visible) fx.spinner.rotation.z -= dt * 5;
    fxUpdate(dt);
    arrowStep(dt);
  }

  // The yank is enough: in mixed reality a tight room asks you to step back first.
  function pumped() {
    if (phase !== "yank") return;
    if (mode === "ar" && inp && roomScan(inp.head.local.pos.y)) {
      const hl = inp.head.local.pos;
      if (clearance(hl.x, hl.z) < 1.0) { s.best = openPoint(hl.x, hl.z); go("room"); return; }
    }
    startBurst();
  }
  function autoFire() {
    if (!inp) return;
    const h = inp.hands[1];
    V1.copy(h && h.connected ? h.aimPos : inp.head.pos);
    if (!(h && h.connected)) V1.y -= 0.3;
    const tg = { x: target.pos.x, y: target.pos.y, z: target.pos.z, nx: target.normal.x, ny: target.normal.y, nz: target.normal.z, tag: "crack", id: "crack" };
    fire(P, 1, V1, tg);
    // it flies on its own with no trigger held: sticky keeps it from being let go before it lands
    P.ropes[1].sticky = true;
    audio.sfx("fire", { pos: V1 });
    haptic(1, 0.2, 20);
  }

  /* ---------------- API ---------------- */
  const Pt = {
    active: false, phase: "idle",
    begin(m, first) {
      hideRoom(); buildFx();
      if (ui.setSkip) ui.setSkip(null);
      mode = m === "ar" || m === "desktop" ? m : "vr"; firstRun = !!first;
      skipReq = false; placed = false; total = 0; pt = 0; resetSeen = false; last.ok = false;
      Object.assign(s, { defer: 0, hid: false, roomClear: 0, best: null, parked: 0, burstT: 0, slow: 1, stance: "none", waitPlanes: 0, gaze: 0, said: -1, sayT: 0, widened: false, auto: false, easy: false, warmed: false, hole: 0, dripT: 0, surge: -1, room: null, roomT: 0, r: 0, flash: 0, stirAt: 0, kingT: -1, chalkT: -1, crackOn: false, holeOn: false, grow: 0, yankT: 0, skipOn: false, revealSpeed: INTRO.revealSpeed });
      arrow.goal = null; arrow.t = 0; dustN = 0; toiletT = 0; dropT = 0; dropI = 0; rippleN = 0;
      if (MC["room:glow"]) MC["room:glow"].opacity = 0;
      if (MC.puddle) { const u = MC.puddle.uniforms; u.uSize.value = 0; u.uT.value = 0; for (const r of u.uRip.value) r.set(9, 9, -9); }
      if (MC.chunk) fx.mats.chunk = MC.chunk;
      for (const c of chalkG.children.slice()) { c.removeFromParent(); c.geometry.dispose(); }
      chalkG.visible = false;
      ropes.removeTarget("crack"); target.cone = undefined;
      // the city shows only through the mask from here on: not a pixel of it before the hole opens. On the flat screen the
      // room and the mask wait three frames (the city stays hidden), so the first frame after the click is light
      s.defer = mode === "desktop" ? 3 : 0;
      if (s.defer) { s.hid = true; view.root.visible = false; } else view.stencil(1);
      audio.ambience(0.2);
      Pt.active = true; Pt.phase = phase = "prep";
      // the shaders of the opening are compiled with everything else in the first frame of a session (main.js), not as a
      // hitch when the crack starts: until the wall is chosen they wait in view of the compiler but far behind you
      if (xr && xr.session && !(G().flags && G().flags.skipintro)) park();
    },
    update,
    onEvent(ev) {
      if (!Pt.active || !ev) return;
      const tag = ev.target && ev.target.tag;
      if (ev.type === "attach" && tag === "crack" && (phase === "shoot" || phase === "hole")) go("yank");
      else if (ev.type === "yank" && tag === "crack" && phase === "yank" && (ev.pump || (s.easy && ev.strength >= INTRO.easyYank))) pumped();
    },
    onDone: (fn) => doneFns.push(fn),
    skip: () => { skipReq = true; },
    info() {
      const p = (v) => ({ x: +v.x.toFixed(4), y: +v.y.toFixed(4), z: +v.z.toFixed(4) });
      return {
        phase, active: Pt.active, mode, placed,
        wall: { label: wall.label, kind: wall.kind, local: p(wall.C), normal: p(wall.N), dist: +wall.dist.toFixed(3), angle: +(wall.angle / DEG).toFixed(1), plane: !!wall.plane },
        crack: { world: p(crackWorld), local: p(wall.C), grow: +(s.grow || 0).toFixed(3), hole: +(s.hole || 0).toFixed(3) },
        target: { added: ropes.targets ? ropes.targets().some((t) => t.id === "crack") : null, cone: target.cone },
        sphere: { r: +(s.r || 0).toFixed(2), visible: !!(fx.sphere && fx.sphere.visible) },
        arrow: { visible: !!(fx.arrow && fx.arrow.visible), goal: arrow.goal ? { x: +arrow.goal.x.toFixed(2), z: +arrow.goal.z.toFixed(2) } : null },
        chalk: { visible: chalkG.visible, t: s.chalkT, lines: chalkG.children.length },
        timers: { phase: +pt.toFixed(2), total: +total.toFixed(2) },
        flags: { widened: !!s.widened, auto: !!s.auto, easy: !!s.easy, skipOn: !!s.skipOn, warmed: !!s.warmed, stance: s.stance },
        king: { t: s.kingT },
        slowMo: s.slow,
        room: { clear: s.roomClear, best: s.best ? { x: +s.best.x.toFixed(2), z: +s.best.z.toFixed(2), c: +s.best.c.toFixed(2) } : null, t: +s.roomT.toFixed(2) },
      };
    },
  };
  if (xr && xr.onReset) xr.onReset(() => { resetSeen = true; });
  if (ui && ui.onFrame) ui.onFrame((dt) => { if (!Pt.active) timers(dt); });
  return Pt;
}
