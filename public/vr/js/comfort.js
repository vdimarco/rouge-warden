// In Full Swing: comfort (spec §8). The tunnel vignette, snap and smooth turning, the comfort presets, seated play and
// the calibrated height. In mixed reality it also lets your real room show through: walls and furniture fade in as
// passthrough when your head or hands come near them, and without room data a safety bubble keeps you near your spot.
import * as THREE from "three";
import { COMFORT } from "./config.js";

const DEG = Math.PI / 180;
const VC = COMFORT.vignette;
const OPEN_FOV = 110; // the vignette's inner field of view at rest: past the edge of the Quest 3 lenses
const FEATHER = Math.max(8, VC.feather * 55) * DEG; // the soft edge, so it never shows a hard ring (Mach bands)
const GLOBAL_MIN_Y = 0.15; // the global mesh includes the floor you stand on: drop it
const SEATED_BELOW = 0.8; // seated: no horizontal surface below this (the chair, a table beside you)
const NO_DATA_AFTER = 3; // seconds of AR with no planes or meshes before the safety bubble takes over
const FAR = 1e4;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ramp = (v, r) => clamp((v - r[0]) / (r[1] - r[0]), 0, 1);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// The reality blend: it scales what is already drawn by 1 − alpha, colour and alpha alike, so the compositor shows
// the passthrough there. Alpha factors stay null, so three uses the colour factors for alpha too.
function realityBlend(m) {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.ZeroFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = null; m.blendDstAlpha = null; m.blendEquationAlpha = null;
  return m;
}

// An inward sphere round the eyes. The alpha comes from the angle between the view axis and the direction in the
// sphere's own space, so both eyes see the same tunnel, and it works with multiview.
function tunnelMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uInner: { value: Math.PI }, uWidth: { value: FEATHER }, uAlpha: { value: 0 }, uFull: { value: 0 }, uColor: { value: new THREE.Vector3() } },
    vertexShader: `
      varying vec3 vP;
      void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uInner, uWidth, uAlpha, uFull; uniform vec3 uColor;
      varying vec3 vP;
      void main() {
        float ang = acos(clamp(-normalize(vP).z, -1.0, 1.0));
        float a = max(smoothstep(uInner, uInner + uWidth, ang) * uAlpha, uFull);
        gl_FragColor = vec4(uColor, a);
      }`,
    side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true,
  });
}

export function createComfort(camera, rig, settings) {
  /* ---------------- the vignette ---------------- */
  const vigMat = tunnelMaterial();
  const BLACK = [0.043, 0.027, 0.063]; // almost black, a touch of plum
  vigMat.uniforms.uColor.value.fromArray(BLACK);
  const vig = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), vigMat);
  vig.name = "vignette";
  vig.renderOrder = 999;
  vig.frustumCulled = false;
  vig.visible = false;
  camera.add(vig);
  const V = { strength: 0, target: 0, hold: 0, blink: 0, innerFov: OPEN_FOV, look: "black", ar: false, mode: "xr" };
  let armed = true, override = null, lastDt = 0, realSeenAtUpdate = 0;

  // Everything here only draws while main keeps calling us. Back on the title (no update, no reality), the gate hides
  // it on the next draw, so a vignette or a room fade never sticks on the attract view.
  let updN = 0, updSeen = 0, realN = 0, realSeen = 0, gateFrame = -1, updLive = false, realLive = false;
  function gate(renderer) {
    const f = renderer.info.render.frame;
    if (f === gateFrame) return;
    gateFrame = f;
    updLive = updN !== updSeen; updSeen = updN;
    realLive = realN !== realSeen; realSeen = realN;
  }
  vig.onBeforeRender = (renderer) => { gate(renderer); if (!updLive) { vig.visible = false; vigMat.uniforms.uAlpha.value = 0; vigMat.uniforms.uFull.value = 0; } };

  /* ---------------- the reality fade (AR) ---------------- */
  const RU = {
    uHead: { value: new THREE.Vector3(FAR, FAR, FAR) }, uH0: { value: new THREE.Vector3(FAR, FAR, FAR) }, uH1: { value: new THREE.Vector3(FAR, FAR, FAR) },
    uV0: { value: 0 }, uV1: { value: 0 }, uFloor: { value: 0 }, uHands: { value: 1 }, uSeated: { value: 0 }, uOn: { value: 0 },
  };
  const realityMaterial = (minY) => realityBlend(new THREE.ShaderMaterial({
    uniforms: { ...RU, uMinY: { value: minY } },
    vertexShader: `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform vec3 uHead, uH0, uH1; uniform float uV0, uV1, uFloor, uHands, uSeated, uOn, uMinY;
      varying vec3 vW;
      void main() {
        float y = vW.y - uFloor; // height above the real floor
        vec3 fn = normalize(cross(dFdx(vW), dFdy(vW)));
        // under the head (a table, your shins) only the distance across the floor counts
        vec3 dh = vW - uHead;
        float dHead = vW.y < uHead.y - 0.3 ? length(dh.xz) : length(dh);
        float f = 1.0 - smoothstep(0.4, 0.9, dHead);
        if (uHands > 0.5) {
          f = max(f, 1.0 - smoothstep(0.15, 0.5 + 0.25 * uV0, distance(vW, uH0)));
          f = max(f, 1.0 - smoothstep(0.15, 0.5 + 0.25 * uV1, distance(vW, uH1)));
        }
        if (y < uMinY || (uSeated > 0.5 && abs(fn.y) > 0.7 && y < ${SEATED_BELOW.toFixed(2)})) f = 0.0;
        gl_FragColor = vec4(0.0, 0.0, 0.0, f * uOn);
      }`,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  }));
  const realMat = realityMaterial(-FAR), globalMat = realityMaterial(GLOBAL_MIN_Y);
  const sources = new Map(); // XRPlane or XRMesh → { kind, mesh, version, ... }
  const info = { planes: 0, meshes: 0, maxFade: 0, near: 0, bubble: false, bubbleFade: 0 };
  const hideChunks = (s) => { for (const c of s.chunks) c.mesh.visible = false; };
  const hideReality = () => { sources.forEach(hideChunks); bub.visible = false; ring.visible = false; };
  const realGate = (renderer) => { gate(renderer); if (!realLive) { RU.uOn.value = 0; bubMat.uniforms.uFull.value = 0; hideReality(); } };

  // the safety bubble: the whole view fades to passthrough as you leave your spot, and a chalk ring marks the spot
  const bubMat = realityBlend(tunnelMaterial());
  bubMat.uniforms.uInner.value = Math.PI; // no tunnel: uFull alone
  const bub = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 12), bubMat);
  bub.name = "bubble";
  bub.renderOrder = 1000;
  bub.frustumCulled = false;
  bub.visible = false;
  bub.onBeforeRender = realGate;
  camera.add(bub);
  const ring = new THREE.Mesh(new THREE.RingGeometry(COMFORT.bubble.ring - 0.035, COMFORT.bubble.ring + 0.035, 96, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    vertexShader: `
      varying vec2 vP;
      void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vP;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        // chalk: a rough band, broken where the stick skipped on the roof
        float r = length(vP), a = atan(vP.y, vP.x);
        float edge = 1.0 - smoothstep(0.012, 0.03, abs(r - ${COMFORT.bubble.ring.toFixed(3)}) + 0.012 * h(floor(vec2(a * 160.0, r * 90.0))));
        float grain = 0.55 + 0.45 * h(floor(vP * 260.0));
        float skip = smoothstep(0.1, 0.3, h(vec2(floor(a * 24.0), 7.0)));
        float al = edge * grain * mix(0.35, 1.0, skip);
        if (al < 0.02) discard;
        gl_FragColor = vec4(vec3(0.95, 0.94, 0.9), al * 0.9);
      }`,
    transparent: true, depthWrite: false,
  }));
  ring.name = "chalkRing";
  ring.renderOrder = 5;
  ring.visible = false;
  ring.onBeforeRender = realGate;
  rig.add(ring);
  const bubble = { set: false, x: 0, z: 0, noData: 0, on: false, fade: 0 };
  // A recentre moves the tracking origin. The bubble's spot is a place in your real room, so it moves with it: we keep
  // the last head pose, and on a reset carry the spot over by the head's jump in position and yaw.
  const last = { ok: false, x: 0, z: 0, yaw: 0 };
  let hooked = null, resetSeen = false, session = null;
  const yawOf = (q) => Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));

  /* ---- building the room ---- */
  // A plane is one flat polygon in its own space (+y is its normal). A mesh is baked into tracking space and, when it
  // is big (the global mesh), cut into 1 m pieces, so only the pieces near you draw and their boxes give honest
  // distances. Each piece: { mesh, box (tracking space) }.
  const CHUNK = 1, SMALL = 256;
  function piece(geo, mat, name) {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.matrixAutoUpdate = false;
    m.renderOrder = 1000; // after the vignette (999)
    m.frustumCulled = false;
    m.visible = false;
    m.onBeforeRender = realGate;
    rig.add(m);
    return m;
  }
  function buildPlane(e, name) {
    const poly = e.polygon, n = poly.length;
    if (n < 3) return null;
    const tris = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p.x, p.z)), []);
    if (!tris.length) return null;
    const pos = new Float32Array(n * 3), P2 = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < n; i++) { pos[i * 3] = poly[i].x; pos[i * 3 + 2] = poly[i].z; P2[i * 2] = poly[i].x; P2[i * 2 + 1] = poly[i].z; }
    for (const t of tris) idx.push(t[0], t[1], t[2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    return { chunks: [{ mesh: piece(g, realMat, name), box: null }], poly: P2, n };
  }
  function buildMesh(e, name, global) {
    const v = e.vertices, ix = e.indices;
    if (!v || !ix || v.length < 9 || ix.length < 3) return null;
    const m = e.matrix.elements, nv = v.length / 3, tv = new Float32Array(v.length);
    for (let i = 0; i < nv; i++) {
      const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
      tv[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
      tv[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      tv[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    // group the triangles by the 1 m cell of their centre (the global mesh leaves its floor out)
    const big = ix.length / 3 > SMALL, cells = new Map();
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      if (global && (tv[a + 1] + tv[b + 1] + tv[c + 1]) / 3 < GLOBAL_MIN_Y) continue;
      const key = big ? Math.floor((tv[a] + tv[b] + tv[c]) / (3 * CHUNK)) + ":" + Math.floor((tv[a + 2] + tv[b + 2] + tv[c + 2]) / (3 * CHUNK)) : "all";
      let list = cells.get(key);
      if (!list) cells.set(key, (list = []));
      list.push(ix[t], ix[t + 1], ix[t + 2]);
    }
    const chunks = [];
    for (const list of cells.values()) {
      const remap = new Map(), pos = [], idx = [];
      for (const k of list) {
        let j = remap.get(k);
        if (j === undefined) { j = pos.length / 3; remap.set(k, j); pos.push(tv[k * 3], tv[k * 3 + 1], tv[k * 3 + 2]); }
        idx.push(j);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeBoundingBox();
      chunks.push({ mesh: piece(g, global ? globalMat : realMat, name), box: g.boundingBox });
    }
    if (!chunks.length) return null;
    // baked with the pose at build time: later poses apply as the change since then
    return { chunks, bake: new THREE.Matrix4().copy(e.matrix).invert() };
  }
  function dropSource(s, key) {
    for (const c of s.chunks) { c.mesh.removeFromParent(); c.mesh.geometry.dispose(); }
    sources.delete(key);
  }
  function addSource(key, e, kind) {
    let s = sources.get(key);
    if (s && s.version === e.version) return s;
    if (s) dropSource(s, key);
    const label = (e.label || "").toLowerCase(), global = kind === "mesh" && label === "global mesh", name = "reality:" + (label || kind);
    const built = kind === "plane" ? buildPlane(e, name) : buildMesh(e, name, global);
    if (!built) return null;
    s = { kind, label, global, version: e.version, entry: e, chunks: built.chunks, poly: built.poly, n: built.n, bake: built.bake || null, horizontal: e.orientation === "horizontal", fade: 0 };
    sources.set(key, s);
    return s;
  }

  /* ---- distances on the CPU: which pieces are near enough to draw, and maxFade for the tests ---- */
  const MX = new THREE.Matrix4(), INV = new THREE.Matrix4(), L = new THREE.Vector3(), Qp = new THREE.Vector3(), HW = new THREE.Vector3();
  const NP = { x: 0, z: 0 };
  // the nearest point of a polygon (plane space, x/z pairs) to (px, pz)
  function nearestOnPoly(poly, n, px, pz) {
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = poly[i * 2], zi = poly[i * 2 + 1], xj = poly[j * 2], zj = poly[j * 2 + 1];
      if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
    }
    if (inside) { NP.x = px; NP.z = pz; return NP; }
    let best = Infinity;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = poly[j * 2], az = poly[j * 2 + 1], bx = poly[i * 2], bz = poly[i * 2 + 1];
      const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
      const t = l2 > 0 ? clamp(((px - ax) * ex + (pz - az) * ez) / l2, 0, 1) : 0;
      const qx = ax + ex * t, qz = az + ez * t, d = (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
      if (d < best) { best = d; NP.x = qx; NP.z = qz; }
    }
    return NP;
  }
  // the nearest point of a plane, or of a mesh piece's box, to p (tracking space), into Qp. MX/INV: the piece's pose.
  function nearest(s, box, p) {
    L.copy(p).applyMatrix4(INV);
    if (!box) { const q = nearestOnPoly(s.poly, s.n, L.x, L.z); Qp.set(q.x, 0, q.z); } else Qp.copy(L).clamp(box.min, box.max);
    return Qp.applyMatrix4(MX);
  }
  // the fade formula of spec §8, at the nearest point: under the head (lower than head − 0.3) only x/z counts
  function fadeAt(s, box, head, hands) {
    const q = nearest(s, box, head);
    const dx = q.x - head.x, dz = q.z - head.z, dy = q.y - head.y;
    let f = 1 - sstep(0.4, 0.9, q.y < head.y - 0.3 ? Math.sqrt(dx * dx + dz * dz) : Math.sqrt(dx * dx + dy * dy + dz * dz));
    if (seated || !hands) return f;
    for (let i = 0; i < 2; i++) {
      const h = hands[i];
      if (!h || !h.connected) continue;
      const v = Math.min(8, h.velRel ? h.velRel.length() : 0);
      f = Math.max(f, 1 - sstep(0.15, 0.5 + 0.25 * v, nearest(s, box, h.gripLocal.pos).distanceTo(h.gripLocal.pos)));
    }
    return f;
  }

  let rXR = null, rHead = null, rHands = null, hasOther = false, seated = false;
  // WebXR semantic labels are lower case already, so the per-frame checks compare them as they are
  const syncPlane = (e, key) => {
    const label = e.label;
    if (label === "floor" || label === "ceiling") return;
    // unlabelled flat surfaces at floor or ceiling height are the floor and the ceiling too
    const y = e.matrix.elements[13];
    if (!label && e.orientation === "horizontal" && (y < 0.15 || y > 2.2)) return;
    addSource(key, e, "plane");
  };
  const findOther = (e) => { if (e.label !== "global mesh") hasOther = true; };
  // the global mesh (tens of thousands of triangles) is only built when there is no other mesh
  const syncMesh = (e, key) => {
    if (hasOther && e.label === "global mesh") { const s = sources.get(key); if (s) dropSource(s, key); return; }
    addSource(key, e, "mesh");
  };
  const dropGone = (s, key) => { if (!(s.kind === "plane" ? rXR.planes && rXR.planes.has(key) : rXR.meshes && rXR.meshes.has(key))) dropSource(s, key); };
  const countSource = (s) => { if (s.kind === "plane") info.planes++; else if (!(s.global && hasOther)) info.meshes++; };
  const perSource = (s) => {
    if (s.bake) MX.multiplyMatrices(s.entry.matrix, s.bake); else MX.copy(s.entry.matrix);
    INV.copy(MX).invert();
    // the global mesh only when there is no other mesh; seated, no low flat surfaces
    const used = !(s.global && hasOther) && !(seated && s.kind === "plane" && s.horizontal && s.entry.matrix.elements[13] < SEATED_BELOW);
    s.fade = 0;
    for (const c of s.chunks) {
      c.mesh.matrix.copy(MX);
      c.mesh.matrixWorldNeedsUpdate = true;
      // seated, low furniture (a table or a seat beside you, all of it under 0.8 m) stays in the game too
      const f = used && !(seated && c.box && c.box.max.y < SEATED_BELOW) ? fadeAt(s, c.box, rHead, rHands) : 0;
      c.mesh.visible = f > 0.001;
      if (f > s.fade) s.fade = f;
      if (c.mesh.visible) info.near++;
    }
    if (s.fade > info.maxFade) info.maxFade = s.fade;
  };

  /* ---------------- the API ---------------- */
  const C = {
    settings,
    get seatedOffset() {
      if (override != null) return override;
      if (V.mode === "desktop" || !settings.seated || !(settings.height > 0)) return 0;
      return Math.max(0, COMFORT.standingHead - settings.height);
    },
    set seatedOffset(v) { override = Number.isFinite(v) ? v : null; },

    // s = { vel, speed, accel (50 ms low-pass, m/s²), yawRate (deg/s, smooth turn only), snapped, play, ar, mode }
    update(dt, s = {}) {
      updN++;
      dt = lastDt = dt > 0 ? dt : 0;
      V.mode = s.mode || V.mode;
      V.ar = s.ar != null ? !!s.ar : realN > 0 && realN === realSeenAtUpdate + 1;
      realSeenAtUpdate = realN;
      // seated without a height yet: take it from the head once it is tracked
      if (settings.seated && !(settings.height > 0) && V.mode === "xr" && camera.position.y > 0.3) C.calibrate(camera.position.y);
      // strength: the strongest of acceleration, smooth turning and speed; fast attack, a short hold, a slow release
      const play = s.play !== false;
      const want = play ? Math.max(VC.wAccel * ramp(Math.abs(s.accel || 0), VC.accel), VC.wYaw * ramp(Math.abs(s.yawRate || 0), VC.yaw), VC.wSpeed * ramp(s.speed || 0, VC.speed)) : 0;
      V.target = want;
      if (want >= V.strength) { V.strength = Math.min(want, V.strength + dt / VC.attack); V.hold = VC.hold; }
      else if (V.hold > 0) V.hold -= dt;
      else V.strength = Math.max(want, V.strength - dt / VC.release);
      if (s.snapped) V.blink = Math.max(V.blink, COMFORT.snapBlink);
      const minFov = COMFORT.vignetteMinFov[settings.vignette] ?? OPEN_FOV;
      V.innerFov = OPEN_FOV + (minFov - OPEN_FOV) * V.strength;
      const u = vigMat.uniforms;
      u.uInner.value = (V.innerFov / 2) * DEG;
      u.uAlpha.value = minFov < OPEN_FOV ? sstep(0, 0.12, V.strength) : 0;
      u.uFull.value = V.blink > 0 ? 1 : 0;
      V.blink = Math.max(0, V.blink - dt);
      // the look: your real room in mixed reality (the reality blend), black otherwise
      const room = V.ar && settings.vignetteLook !== "black";
      if (room !== (V.look === "room")) {
        V.look = room ? "room" : "black";
        if (room) realityBlend(vigMat); else { vigMat.blending = THREE.NormalBlending; }
        if (room) u.uColor.value.set(0, 0, 0); else u.uColor.value.fromArray(BLACK);
      }
      vig.visible = u.uAlpha.value > 0.002 || u.uFull.value > 0;
    },

    // Right stick x → a yaw change (radians; right is negative). Snap past 0.7, re-armed under 0.3, with a short blink;
    // or smooth at COMFORT.smoothTurnDegPerSec.
    turn(input, dt) {
      const x = (input && input.turn) || 0;
      if (settings.turn === "smooth") { armed = true; return -x * COMFORT.smoothTurnDegPerSec * DEG * (dt > 0 ? dt : 0); }
      if (Math.abs(x) < COMFORT.snapOff) armed = true;
      if (armed && Math.abs(x) > COMFORT.snapOn) {
        armed = false;
        V.blink = COMFORT.snapBlink;
        return -Math.sign(x) * ([30, 45, 90].includes(settings.snap) ? settings.snap : 45) * DEG;
      }
      return 0;
    },

    // Copies a preset's vignette, turning and aim assist into settings. main sets the body's speed caps from the
    // same preset. "desktop" is a mode, not a choice, so it is never saved as the preset.
    applyPreset(name) {
      const p = COMFORT.presets[name];
      if (!p) return false;
      settings.vignette = p.vignette; settings.turn = p.turn; settings.snap = p.snap; settings.aim = p.aim;
      if (name !== "desktop") settings.preset = name;
      V.mode = name === "desktop" ? "desktop" : V.mode === "desktop" ? "xr" : V.mode;
      armed = true;
      return true;
    },

    // Stores the head height (tracking space, metres) in settings.height. Seated, the view then rises so the head
    // stands at COMFORT.standingHead; standing, your own height is kept.
    calibrate(headLocalY) {
      const y = +headLocalY;
      if (y > 0.3 && y < 2.6) { settings.height = Math.round(y * 1000) / 1000; override = null; }
      return C.seatedOffset;
    },

    // AR, after the reveal, every frame: the room surfaces near your head or hands show as passthrough.
    reality(xr, headLocal, hands, P) {
      realN++;
      if (!xr || !headLocal) return;
      // a new session has a new tracking origin: the bubble starts over where you stand
      if (xr.session !== session) { session = xr.session; bubble.set = false; bubble.noData = 0; last.ok = false; }
      rXR = xr; rHead = headLocal; rHands = hands;
      seated = !!settings.seated;
      // sources: planes except floor and ceiling, meshes except the global mesh (unless it is all there is)
      hasOther = false;
      if (xr.planes) xr.planes.forEach(syncPlane);
      if (xr.meshes) { xr.meshes.forEach(findOther); xr.meshes.forEach(syncMesh); }
      sources.forEach(dropGone);
      info.planes = 0; info.meshes = 0;
      sources.forEach(countSource);
      // the shader works in world space: the head, the hands, and the real floor's height (main placed the rig already)
      RU.uHead.value.copy(headLocal).applyMatrix4(rig.matrixWorld);
      for (let i = 0; i < 2; i++) {
        const h = hands && hands[i], on = h && h.connected && !seated;
        (i ? RU.uH1 : RU.uH0).value.copy(on ? h.gripPos : HW.set(FAR, FAR, FAR));
        (i ? RU.uV1 : RU.uV0).value = on && h.velRel ? Math.min(8, h.velRel.length()) : 0;
      }
      RU.uFloor.value = rig.matrixWorld.elements[13];
      RU.uHands.value = seated ? 0 : 1;
      RU.uSeated.value = seated ? 1 : 0;
      RU.uOn.value = 1;
      info.maxFade = 0; info.near = 0;
      sources.forEach(perSource);
      // no room data after 3 s: the safety bubble round the spot where you stood at the reveal
      if (hooked !== xr && xr.onReset) { hooked = xr; xr.onReset(() => { resetSeen = true; }); }
      const q = xr.input && xr.input.head.local.quat, yaw = q ? yawOf(q) : 0;
      if (resetSeen && bubble.set && last.ok) {
        const a = yaw - last.yaw, c = Math.cos(a), s = Math.sin(a), dx = bubble.x - last.x, dz = bubble.z - last.z;
        bubble.x = headLocal.x + dx * c + dz * s; bubble.z = headLocal.z - dx * s + dz * c;
      }
      resetSeen = false;
      last.ok = true; last.x = headLocal.x; last.z = headLocal.z; last.yaw = yaw;
      if (!bubble.set) { bubble.set = true; bubble.x = headLocal.x; bubble.z = headLocal.z; }
      const noData = (!xr.planes || xr.planes.size === 0) && (!xr.meshes || xr.meshes.size === 0);
      bubble.noData = noData ? bubble.noData + (lastDt || 0) : 0;
      bubble.on = bubble.noData >= NO_DATA_AFTER;
      const dx = headLocal.x - bubble.x, dz = headLocal.z - bubble.z;
      bubble.fade = bubble.on ? sstep(COMFORT.bubble.from, COMFORT.bubble.to, Math.sqrt(dx * dx + dz * dz)) : 0;
      bubMat.uniforms.uFull.value = bubble.fade;
      bub.visible = bubble.fade > 0.001;
      ring.visible = bubble.on;
      if (bubble.on) ring.position.set(bubble.x, 0.012 - C.seatedOffset, bubble.z);
      info.bubble = bubble.on; info.bubbleFade = bubble.fade;
    },

    // The safety bubble's centre (tracking space), normally where your head was at the burst.
    bubble(center) {
      if (!center) { bubble.set = false; last.ok = false; return; }
      bubble.set = true; bubble.x = center.x; bubble.z = center.z;
    },

    realityInfo: () => {
      const list = [];
      sources.forEach((s) => list.push({ kind: s.kind, label: s.label, fade: s.fade, pieces: s.chunks.length }));
      return { ...info, sources: list };
    },
    // the vignette's state, for the tests
    info: () => ({ strength: V.strength, target: V.target, innerFov: V.innerFov, minFov: COMFORT.vignetteMinFov[settings.vignette] ?? OPEN_FOV, blink: vigMat.uniforms.uFull.value > 0, look: V.look, visible: vig.visible, alpha: vigMat.uniforms.uAlpha.value, seatedOffset: C.seatedOffset }),
    meshes: { vignette: vig, bubble: bub, ring },
  };
  return C;
}
