// Light Years Home v3: one zone on the GPU. Builds the roads (rivers of points), the traffic (impostors and points),
// the giants (cards and star swarms), the sparks to pick up, every 3D ring (exit gate, start rings, pads, race gates,
// giver and drop rings, the zoom ring) and the other ships (Vela, the Pelican, Magpies), and frees them all on
// dispose. Everything it draws is read from the game state and the zone data; nothing here changes the game.
import * as THREE from 'three';
import { H } from '../core/game.js';
import { TUNE } from '../core/tune.js';
import { createRoads } from './roads.js';
import { createTrafficView, bakeAtlas, roadCurve } from './traffic.js';
import { createGiant, GIANT_LOOKS } from './bodies.js';
import { createGates } from './gates.js';
import { createTern } from './tern.js';
import { ORANGE } from './stage.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2] || 0) || 1; return [a[0] / l, a[1] / l, (a[2] || 0) / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0)];

// ---------- sparks ----------

/**
 * sparkPositions(zoneData, traffic?) → Float32Array xyz in game.zone.sparks order. Road sparks sit on the road's
 * curve at s = from + (to − from) · i / (n − 1), `lateral` u to its right; on a ring road s is a share of a turn
 * from +x and `lateral` is outward; listed points as they are.
 */
export function sparkPositions(zoneData, traffic = null) {
  const out = [];
  const p = [0, 0, 0], t = [0, 0, 0];
  for (const s of zoneData.sparks || []) {
    if (Array.isArray(s.pts)) { for (const q of s.pts) out.push(q[0], q[1], q[2] || 0); continue; }
    const road = (zoneData.roads || []).find((r) => r.id === s.road);
    const n = s.n | 0;
    if (road && road.kind === 'orbit' && n > 0) {
      // On a ring road: s is the share of a turn from +x (as the traffic's angle), lateral u outward.
      const rr = (Array.isArray(road.r) ? (road.r[0] + road.r[1]) / 2 : road.r) + (s.lateral || 0);
      const c = road.centre || [0, 0];
      for (let i = 0; i < n; i++) {
        const a = 2 * Math.PI * (n === 1 ? (s.from + s.to) / 2 : s.from + (s.to - s.from) * (i / (n - 1)));
        out.push(c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a), 0);
      }
      continue;
    }
    if (!road || road.kind !== 'road' || n <= 0) { for (let i = 0; i < n; i++) out.push(NaN, NaN, NaN); continue; }
    const c = roadCurve(road, traffic);
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? (s.from + s.to) / 2 : s.from + (s.to - s.from) * (i / (n - 1));
      c.at(u, p);
      c.tangent(u, t);
      const h = Math.hypot(t[0], t[1]) || 1, lat = s.lateral || 0;
      out.push(p[0] + (t[1] / h) * lat, p[1] - (t[0] / h) * lat, p[2]);
    }
  }
  return new Float32Array(out);
}

const SPARK_VS = /* glsl */ `
  uniform float uTime, uPxPerRad, uRatio;
  attribute float aLive;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = max(-mv.z, 0.1);
    float pulse = 0.8 + 0.2 * sin(uTime * 5.0 + position.x * 0.3 + position.y * 0.2);
    float px = max(0.9 * uPxPerRad / d, 5.0) * pulse;
    vA = aLive * (0.55 + 0.45 * smoothstep(400.0, 60.0, d));
    gl_PointSize = min(px, 64.0) * uRatio;
    gl_Position = projectionMatrix * mv;
    if (aLive < 0.01 || position.x != position.x) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
  }`;
const SPARK_FS = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float r2 = dot(q, q) * 4.0;
    if (r2 > 1.0) discard;
    float core = exp(-r2 * 22.0), glow = exp(-r2 * 5.0) * (1.0 - r2);
    vec3 c = uColor * (glow * 0.9 + core * 1.4) + vec3(1.0) * core * 0.8;
    gl_FragColor = vec4(c * vA, 1.0);
    #include <colorspace_fragment>
  }`;

function createSparkView(stage, positions) {
  const n = positions.length / 3;
  const live = new Float32Array(Math.max(1, n)).fill(1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions.length ? positions : new Float32Array(3), 3));
  g.setAttribute('aLive', new THREE.BufferAttribute(live, 1).setUsage(THREE.DynamicDrawUsage));
  g.setDrawRange(0, n);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SPARK_VS, fragmentShader: SPARK_FS,
    uniforms: { uTime: { value: 0 }, uPxPerRad: { value: 500 }, uRatio: { value: 1 },
      uColor: { value: ORANGE.clone() } },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  mat.name = 'lyh-pickups';
  const pts = new THREE.Points(g, mat);
  pts.name = 'pickups';
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  const last = new Uint8Array(Math.max(1, n));
  return {
    object: pts,
    update(t, taken) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uPxPerRad.value = stage.relNear.uPxPerRad.value;
      mat.uniforms.uRatio.value = stage.ratio;
      if (!taken) return;
      let changed = false;
      for (let i = 0; i < n; i++) {
        const v = taken[i] ? 1 : 0;
        if (v !== last[i]) { last[i] = v; live[i] = v ? 0 : 1; changed = true; }
      }
      if (changed) g.attributes.aLive.needsUpdate = true;
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

// ---------- rings ----------

const flowDir = (line, k) => {
  const a = line[Math.max(0, k - 1)], b = line[Math.min(line.length - 1, Math.max(k, 1))];
  return unit(sub([b[0], b[1], b[2] || 0], [a[0], a[1], a[2] || 0]));
};

/**
 * zoneRings(game, zoneData) → the 3D rings the zone shows now: the exit gate, start rings, trap rings, light pads,
 * the running race's gates, giver and drop rings and the zoom ring, as gates.js items with ids. The objective
 * (game.zone.waypoint's id) is orange.
 */
export function zoneRings(game, zoneData) {
  const list = [];
  const z = game?.zone || {};
  const wp = z.waypoint?.id ?? z.waypoint ?? null;
  const race = game?.race && game.race.state === 'running' ? game.race : null;
  const stunt = game?.stunt || null;
  const centreDir = (pos) => unit([-(pos[0]), -(pos[1]), 0]);
  const objective = (id, state) => (wp && wp === id ? 'orange' : state);
  const ex = zoneData.exit;
  if (ex) list.push({ id: 'exit', pos: ex.pos, r: ex.r, normal: unit([ex.pos[0], ex.pos[1], 0]),
    state: objective('exit', z.exitOpen ? 'white' : 'dim') });
  for (const ev of zoneData.events || []) {
    if (ev.start && !(race && race.id === ev.id)) {
      list.push({ id: `start:${ev.id}`, pos: ev.start.pos, r: ev.start.r ?? 4.5, normal: ev.start.dir || [0, 1, 0],
        state: objective(`start:${ev.id}`, race ? 'dim' : 'white') });
    }
    if (race && race.id === ev.id && Array.isArray(ev.line) && Array.isArray(ev.gates)) {
      const cur = race.gate | 0;
      ev.gates.forEach((gt, k) => {
        if (k < cur) return;
        const p = ev.line[gt.at];
        if (!p) return;
        list.push({ id: `gate:${ev.id}:${k}`, pos: [p[0], p[1], p[2] || 0], r: gt.r ?? 4.5,
          normal: flowDir(ev.line, gt.at), state: k === cur ? 'orange' : k === cur + 1 ? 'white' : 'dim' });
      });
    }
    if (ev.type === 'trap' && ev.ring) {
      list.push({ id: `trap:${ev.id}`, pos: ev.ring.pos, r: ev.ring.r ?? 6,
        normal: ev.ring.dir || centreDir(ev.ring.pos), state: objective(`trap:${ev.id}`, 'white') });
    }
    if (ev.type === 'line' && Array.isArray(ev.pads)) {
      const on = stunt && stunt.id === ev.id;
      const next = on ? (stunt.value | 0) : -1;
      ev.pads.forEach((p, k) => {
        if (on && k < next) return;
        list.push({ id: `pad:${ev.id}:${k}`, pos: [p[0], p[1], p[2] || 0], r: 2.2,
          normal: flowDir(ev.pads, k === 0 ? 1 : k), state: k === next ? 'padNext' : 'pad' });
      });
    }
  }
  for (const r of zoneData.rings || []) {
    if (!r || !r.pos) continue;
    list.push({ id: `ring:${r.id}`, pos: r.pos, r: r.r ?? 6, normal: r.normal || centreDir(r.pos),
      state: objective(r.id, 'white') });
  }
  const pk = zoneData.pocket?.ring;
  if (pk && !game?.pocketId) list.push({ id: 'pocket', pos: pk.pos, r: pk.r, normal: pk.normal || [0, 1, 0],
    state: objective('pocket', 'white') });
  return list;
}

// ---------- the other ships ----------

function hullKindFor(actor) {
  const id = String(actor.id || '');
  if (/vela|swift/.test(id) || actor.kind === 'racer') return 'swift';
  if (/pelican|tug/.test(id) || actor.kind === 'towable') return 'pelican';
  if (/magpie/.test(id) || actor.kind === 'pursuer' || actor.kind === 'runner') return 'magpie';
  return null;
}

// ---------- the zone view ----------

/**
 * buildZoneView(stage, zoneData, built) → { update(game, alpha, cam), setRings(list), dispose(), ready, bodies }.
 * built: core's builtOf(game) ({ traffic, ... }); the giants' stars are made in the worker here, and the traffic
 * atlas is baked once per stage. bodies ([{ pos, r }]) and wells ([{ pos, cut }]) are for chase.setBodies and
 * chase.setWells.
 */
export function buildZoneView(stage, zoneData, built = null, { seed = 1, scene = null } = {}) {
  const root = new THREE.Group();
  root.name = `zone:${zoneData.id}`;
  (scene || stage.scenes.zone).add(root);
  const parts = [];

  const roads = createRoads(stage, zoneData, built, { seed });
  root.add(roads);
  parts.push(() => { roads.userData.dispose(); });

  let traffic = null;
  const jobs = [];
  const atlas = () => bakeAtlas(stage).then((tex) => traffic?.setAtlas(tex))
    .catch((err) => console.warn('zoneview: atlas', err));
  if (built?.traffic) {
    traffic = createTrafficView(stage, zoneData, built.traffic, null, { scene: root });
    parts.push(() => traffic.dispose());
    jobs.push(atlas());
    // A lost context empties render targets: bake the atlas again (everything else uploads again by itself).
    parts.push(stage.onRestored(() => { atlas(); }));
  }

  const giants = [];
  for (const b of zoneData.bodies || []) {
    if (!GIANT_LOOKS[b.look]) continue;
    const g = createGiant(stage, b, null);
    root.add(g);
    giants.push({ body: b, obj: g });
    parts.push(() => g.userData.dispose());
    jobs.push(stage.gen.run('galaxyParticles', g.userData.starOpts).then((d) => g.userData.setStars(d))
      .catch((err) => console.warn('zoneview: giant stars', err)));
  }

  const sparks = createSparkView(stage, sparkPositions(zoneData, built?.traffic));
  root.add(sparks.object);
  parts.push(() => sparks.dispose());

  const gates = createGates(stage, 256, { scene: root });
  parts.push(() => gates.dispose());
  let extra = [], replace = false;

  const ships = new Map();                         // actor id → ship view
  parts.push(() => { for (const s of ships.values()) s.dispose(); ships.clear(); });

  const bodies = (zoneData.bodies || []).filter((b) => (b.rc || 0) > 0).map((b) => ({ pos: b.pos, r: b.rc * 1.3 }));
  const wells = (zoneData.bodies || []).filter((b) => b.well && b.well.rs > 0)
    .map((b) => ({ id: b.id, pos: b.pos, cut: (b.well.cut ?? TUNE.WELL.CUT) * b.well.rs }));
  const ready = Promise.all(jobs).then(() => true);
  const camPos = new THREE.Vector3();

  function visibleBody(b, game, cam) {
    let f = 1;
    if (b.hiddenUntil) {
      const [kind, id] = String(b.hiddenUntil).split(':');
      const z = game?.zone || {};
      const open = kind === 'rumour' ? !!z.rumours?.[id] : kind === 'secret' ? !!z.secrets?.[id] : true;
      if (!open) f = 0;
    }
    if (b.visibleWithin && cam) {
      const d = Math.hypot(cam.x - b.pos[0], cam.y - b.pos[1], cam.z - (b.pos[2] || 0));
      f *= 1 - clamp((d - b.visibleWithin) / (b.visibleWithin * 0.25), 0, 1);
    }
    return f;
  }

  function update(game, alpha = 1, cam = stage.cameras.zone) {
    const scale = game?.timeScale ?? 1;
    const t = Math.max(0, (game?.zoneT ?? 0) - (1 - clamp(alpha, 0, 1)) * H * scale);
    camPos.copy(cam.position);
    traffic?.update(t, camPos);
    roads.userData.update(t);
    if (roads.userData.budget !== stage.budget.version) {
      roads.userData.setBudget(stage.budget.points);
      roads.userData.budget = stage.budget.version;
    }
    for (const g of giants) g.obj.userData.setFade(visibleBody(g.body, game, camPos));
    sparks.update(game?.t ?? 0, game?.zone?.sparks);
    const rings = replace ? extra : zoneRings(game, zoneData).concat(extra);
    gates.set(rings);
    gates.update(game?.t ?? 0);
    // Other ships: one view per actor with a hull.
    const seen = new Set();
    for (const a of game?.actors || []) {
      if (!a || !a.pos) continue;
      const kind = hullKindFor(a);
      if (!kind) continue;
      seen.add(a.id);
      let v = ships.get(a.id);
      if (!v) { v = createTern(stage, { kind, scene: root }); ships.set(a.id, v); }
      v.update(a, 1, null, 1 / 60);
    }
    for (const [id, v] of ships) if (!seen.has(id)) { v.dispose(); ships.delete(id); }
  }

  /** setRings(list, { replace }): extra rings (gates.js items) on top of the zone's own, or instead of them. */
  function setRings(list, opts = {}) {
    extra = Array.isArray(list) ? list : [];
    replace = !!opts.replace;
  }

  function dispose() {
    for (const p of parts) { try { p(); } catch (err) { console.warn('zoneview: dispose', err); } }
    traffic = null;
    root.removeFromParent();
  }

  return { update, setRings, dispose, ready, bodies, wells, object: root, get traffic() { return traffic; } };
}
