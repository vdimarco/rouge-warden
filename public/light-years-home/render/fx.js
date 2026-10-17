// Light Years Home v3: the feel. Speed dust (motes in a box round the camera that stretch into lines with speed, one
// draw, the CPU touches nothing per mote), the wingtip trails (two ribbons of the last wingtip positions), sparks
// (drift sparks in star colours, scrapes, takedowns, pickups and near-miss streaks, one draw) and screen shake
// (trauma squared with a linear floor for small events, smooth noise, off under reduced motion).
// Sources: Elite's stardust (1984) via the research (the dust); Eiserloh, "Math for Game Programmers: Juicing Your
// Cameras With Math", GDC 2016 (trauma shake); none fit better than a plain ribbon for the trails.
import * as THREE from 'three';
import { TUNE } from '../core/tune.js';
import { BLACKBODY_GLSL } from './stage.js';

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (dt, tc) => (tc > 0 ? 1 - Math.exp(-dt / tc) : 1);

// A small seeded random source, so screenshots repeat.
function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- speed dust ----------

const DUST_VS = /* glsl */ `
  uniform vec3 uCam, uVel;
  uniform float uBox, uStreak, uStreakMax, uPlaneH, uPlaneZ, uAlpha;
  attribute vec3 aBase;        // 0..1 in the box
  attribute float aEnd;        // 0 head, 1 tail
  attribute float aPlane;      // 1: lane dust near the plane
  varying float vA;
  void main() {
    vec3 rel = mod(aBase * uBox - uCam + 0.5 * uBox, uBox) - 0.5 * uBox;
    vec3 p = uCam + rel;
    if (aPlane > 0.5) p.z = uPlaneZ + (aBase.z * 2.0 - 1.0) * uPlaneH;
    float s = length(uVel);
    vec3 dir = s > 0.01 ? uVel / s : vec3(0.0, 1.0, 0.0);
    float L = min(s * uStreak, uStreakMax);
    p -= dir * L * aEnd;
    float d = length(p - uCam);
    vA = uAlpha * smoothstep(1.5, 4.0, d) * (1.0 - smoothstep(0.62 * uBox * 0.5, 0.5 * uBox, d))
      * mix(1.0, 0.25, aEnd);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const DUST_FS = /* glsl */ `
  varying float vA;
  void main() {
    gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * vA, 1.0);
    #include <colorspace_fragment>
  }`;

function createDust(count, F) {
  const r = rng(77);
  const base = new Float32Array(count * 6), end = new Float32Array(count * 2), plane = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = r(), y = r(), z = r(), lane = r() < F.DUST_PLANE ? 1 : 0;
    for (let k = 0; k < 2; k++) {
      base.set([x, y, z], (i * 2 + k) * 3);
      end[i * 2 + k] = k;
      plane[i * 2 + k] = lane;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
  g.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  g.setAttribute('aPlane', new THREE.BufferAttribute(plane, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: DUST_VS, fragmentShader: DUST_FS,
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3() }, uBox: { value: F.DUST_BOX },
      uStreak: { value: F.DUST_STREAK / 1000 }, uStreakMax: { value: F.DUST_STREAK_MAX },
      uPlaneH: { value: F.DUST_PLANE_H }, uPlaneZ: { value: 0 }, uAlpha: { value: 0.5 },
    },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  mat.name = 'lyh-dust';
  const lines = new THREE.LineSegments(g, mat);
  lines.name = 'dust';
  lines.frustumCulled = false;
  lines.renderOrder = 8;
  return { object: lines, material: mat, count };
}

// ---------- wingtip trails ----------

const TRAIL_VS = /* glsl */ `
  attribute float aA;
  varying float vA;
  void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TRAIL_FS = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() { gl_FragColor = vec4(uColor * vA, 1.0);
    #include <colorspace_fragment>
  }`;

function createTrails(samples, F) {
  const n = Math.max(4, samples | 0);
  const verts = 2 * n * 2;                     // two ribbons, two vertices a sample
  const pos = new Float32Array(verts * 3), alpha = new Float32Array(verts), index = [];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < n - 1; i++) {
      const a = (r * n + i) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aA', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, uniforms: { uColor: { value: new THREE.Color(1, 1, 1) } },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, side: THREE.DoubleSide,
  });
  mat.name = 'lyh-trails';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'trails';
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  // Ring buffers of world positions, one per wingtip, sampled every LIFE / n seconds.
  const LIFE = 0.6;
  const ring = [new Float32Array(n * 3), new Float32Array(n * 3)];
  const slipAt = new Float32Array(n);
  const st = { head: 0, filled: 0, acc: 0, slip: 0, colour: null, live: false };
  const cur = [new THREE.Vector3(), new THREE.Vector3()];
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), side = new THREE.Vector3(), toCam = new THREE.Vector3();

  return {
    object: mesh, material: mat,
    // Called by tern.update each frame with the two wingtips (world), how much the ship slips (0..1) and an
    // optional trail colour (a THREE colour, a hex string or a temperature in K).
    sample(left, right, slip = 0, colour = null) {
      cur[0].copy(left); cur[1].copy(right);
      st.slip = slip;
      st.live = true;
      if (colour !== st.colour) {
        st.colour = colour;
        if (typeof colour === 'string' || (colour && colour.isColor)) mat.uniforms.uColor.value.set(colour);
        else mat.uniforms.uColor.value.setRGB(1, 1, 1);
      }
    },
    clear() { st.filled = 0; st.live = false; },
    update(dt, camPos, speed) {
      if (!st.live) { mesh.visible = false; return; }
      mesh.visible = true;
      st.acc += dt;
      const step = LIFE / (n - 1);
      while (st.acc >= step) {
        st.acc -= step;
        st.head = (st.head + 1) % n;
        st.filled = Math.min(n, st.filled + 1);
        for (let r = 0; r < 2; r++) ring[r].set([cur[r].x, cur[r].y, cur[r].z], st.head * 3);
        slipAt[st.head] = st.slip;
      }
      const moving = clamp((speed - 4) / 16, 0, 1);
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < n; i++) {
          // i = 0 is the live wingtip, then back in time.
          const back = Math.min(i, st.filled - 1);
          let p;
          if (i === 0 || st.filled === 0) p = tmpA.copy(cur[r]);
          else {
            const k = ((st.head - back + 1 + n) % n) * 3;
            p = tmpA.set(ring[r][k], ring[r][k + 1], ring[r][k + 2]);
          }
          // The ribbon's side: across its direction, facing the camera.
          const j = Math.min(i + 1, Math.max(st.filled - 1, 0));
          let q;
          if (j === i || st.filled < 2) q = tmpB.set(p.x, p.y - 0.1, p.z);
          else {
            const k = ((st.head - j + 1 + n) % n) * 3;
            q = tmpB.set(ring[r][k], ring[r][k + 1], ring[r][k + 2]);
          }
          toCam.copy(camPos).sub(p);
          side.subVectors(q, p).cross(toCam).normalize();
          const age = i / (n - 1);
          const sl = slipAt[((st.head - back + 1 + n) % n)] || st.slip;
          const w = (0.004 + 0.009 * sl) * (1 - 0.5 * age);
          // Faint when flying straight, bright in a slide; gone before it reaches the camera.
          const camD = toCam.length();
          const a = (i < st.filled ? 1 : 0) * Math.pow(1 - age, 2) * (0.12 + 0.5 * sl) * moving
            * clamp((camD - 3.5) / 5, 0, 1);
          const v = (r * n + i) * 2;
          pos[v * 3] = p.x + side.x * w; pos[v * 3 + 1] = p.y + side.y * w; pos[v * 3 + 2] = p.z + side.z * w;
          pos[v * 3 + 3] = p.x - side.x * w; pos[v * 3 + 4] = p.y - side.y * w; pos[v * 3 + 5] = p.z - side.z * w;
          alpha[v] = a; alpha[v + 1] = a;
        }
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.aA.needsUpdate = true;
      st.live = false;
    },
  };
}

// ---------- sparks ----------

const SPARK_VS = /* glsl */ `
  attribute vec3 aVel;
  attribute vec4 aInfo;        // temperature, life left 0..1, brightness, end (0 head, 1 tail)
  varying vec3 vC;
  varying float vA;
  ${BLACKBODY_GLSL}
  uniform float uStreak;
  void main() {
    float life = aInfo.y;
    vec3 p = position - aVel * uStreak * aInfo.w * (0.4 + 0.6 * life);
    vC = lyhBB(aInfo.x * (0.75 + 0.25 * life)) * aInfo.z;
    vA = life * (1.0 - 0.7 * aInfo.w);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const SPARK_FS = /* glsl */ `
  varying vec3 vC;
  varying float vA;
  void main() { gl_FragColor = vec4((1.0 - exp(-vC * vA * 2.5)), 1.0);
    #include <colorspace_fragment>
  }`;

function createSparks(stage, cap) {
  const n = Math.max(16, cap | 0);
  const pos = new Float32Array(n * 6), vel = new Float32Array(n * 6), info = new Float32Array(n * 8);
  const P = new Float32Array(n * 3), V = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n);
  const temp = new Float32Array(n), bright = new Float32Array(n), drag = new Float32Array(n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    vertexShader: SPARK_VS, fragmentShader: SPARK_FS,
    uniforms: { uLUT: { value: stage.lut }, uStreak: { value: 0.035 } },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  mat.name = 'lyh-sparks';
  const lines = new THREE.LineSegments(g, mat);
  lines.name = 'sparks';
  lines.frustumCulled = false;
  lines.renderOrder = 9;
  let next = 0, live = 0;
  const r = rng(91);
  function emit(p, v, T = 3200, lifeS = 0.35, brightness = 1, dragK = 1.5) {
    const i = next;
    next = (next + 1) % n;
    P[i * 3] = p.x ?? p[0]; P[i * 3 + 1] = p.y ?? p[1]; P[i * 3 + 2] = p.z ?? p[2];
    V[i * 3] = v[0]; V[i * 3 + 1] = v[1]; V[i * 3 + 2] = v[2];
    life[i] = max[i] = lifeS;
    temp[i] = T;
    bright[i] = brightness;
    drag[i] = dragK;
  }
  // A burst of count sparks round p, moving with base velocity plus speed in random directions.
  function burst(p, base, count, speed, T, lifeS = 0.45, brightness = 1) {
    for (let k = 0; k < count; k++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - u * u), s = speed * (0.4 + 0.6 * r());
      emit(p, [base[0] + q * Math.cos(a) * s, base[1] + q * Math.sin(a) * s, base[2] + u * s * 0.6],
        T * (0.85 + 0.3 * r()), lifeS * (0.6 + 0.6 * r()), brightness);
    }
  }
  function update(dt) {
    live = 0;
    for (let i = 0; i < n; i++) {
      if (life[i] > 0) {
        life[i] -= dt;
        const k = Math.exp(-drag[i] * dt);
        V[i * 3] *= k; V[i * 3 + 1] *= k; V[i * 3 + 2] *= k;
        P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      }
      const l = life[i] > 0 ? life[i] / max[i] : 0;
      if (l > 0) live++;
      for (let e = 0; e < 2; e++) {
        const v = i * 2 + e;
        pos[v * 3] = P[i * 3]; pos[v * 3 + 1] = P[i * 3 + 1]; pos[v * 3 + 2] = P[i * 3 + 2];
        vel[v * 3] = V[i * 3]; vel[v * 3 + 1] = V[i * 3 + 1]; vel[v * 3 + 2] = V[i * 3 + 2];
        info[v * 4] = temp[i]; info[v * 4 + 1] = l; info[v * 4 + 2] = bright[i]; info[v * 4 + 3] = e;
      }
    }
    lines.visible = live > 0;
    if (live > 0 || lines.userData.wasLive) {
      g.attributes.position.needsUpdate = true;
      g.attributes.aVel.needsUpdate = true;
      g.attributes.aInfo.needsUpdate = true;
    }
    lines.userData.wasLive = live > 0;
  }
  return { object: lines, emit, burst, update, get live() { return live; }, cap: n };
}

// ---------- shake ----------

// Smooth 1D value noise at about 18 Hz, one channel per seed.
function noise1(t, seed) {
  const x = t * 18 + seed * 17.3, i = Math.floor(x), f = x - i;
  const h = (n) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

function createShake(F) {
  const st = { trauma: 0, t: 0 };
  const q = new THREE.Quaternion(), e = new THREE.Euler(), off = new THREE.Vector3();
  return {
    get trauma() { return st.trauma; },
    add(x) { st.trauma = clamp(st.trauma + (Number.isFinite(x) ? x : 0), 0, 1); },
    // Trauma per event type (FX.TRAUMA); drift-boost by tier.
    event(e2) {
      const T = F.TRAUMA;
      if (e2.type === 'driftBoost') this.add(T.driftBoost[clamp((e2.tier || 1) - 1, 0, 2)]);
      else if (T[e2.type] !== undefined) this.add(T[e2.type]);
    },
    // Shake the camera in place: yaw, pitch and roll up to SHAKE_MAX × shake, an offset up to SHAKE_MAX_U.
    apply(cam, dt, reduced = false) {
      st.t += dt;
      st.trauma = Math.max(0, st.trauma - F.SHAKE_DECAY * dt);
      const s = reduced ? 0 : Math.max(st.trauma * st.trauma, (F.SHAKE_LIN ?? 0) * st.trauma);
      if (s <= 1e-5 || !cam) return 0;
      const A = F.SHAKE_MAX * DEG * s;
      e.set(noise1(st.t, 1) * A, noise1(st.t, 2) * A, noise1(st.t, 3) * A * 0.75);
      q.setFromEuler(e);
      cam.quaternion.multiply(q);
      off.set(noise1(st.t, 4), noise1(st.t, 5), noise1(st.t, 6)).multiplyScalar(F.SHAKE_MAX_U * s)
        .applyQuaternion(cam.quaternion);
      cam.position.add(off);
      cam.updateMatrixWorld();
      return s;
    },
  };
}

// ---------- the effects together ----------

/**
 * createFx(stage, tier, { scene, tune }) → { dust, trails, sparks, shake, update(view, dt), dispose() }.
 * view: { cam (the zone camera after the chase), ship (shipPose), events (this frame's core events), reduced,
 * planeZ }. update moves the dust with the ship's velocity, ages the sparks, draws the trails, turns events into
 * sparks and trauma, then shakes the camera. Call it after chase.update and before backdrop.update and draw.
 */
export function createFx(stage, tier = stage?.tier || 'mid', { scene = null, tune = TUNE } = {}) {
  const F = tune.FX, S = tune.SHIP;
  const B = stage.TIERS[tier] || stage.TIERS.mid;
  const dustN = tier === 'high' ? F.DUST_HIGH : tier === 'low' ? F.DUST_LOW : F.DUST;
  const dust = createDust(dustN, F);
  const trails = createTrails(B.trail, F);
  const sparks = createSparks(stage, B.sparks);
  const shake = createShake(F);
  const group = new THREE.Group();
  group.name = 'fx';
  group.add(dust.object, trails.object, sparks.object);
  (scene || stage.scenes.zone).add(group);
  const r = rng(5);
  const tmp = new THREE.Vector3(), side = new THREE.Vector3(), fwd = new THREE.Vector3();
  const up = new THREE.Vector3(0, 0, 1);
  const st = { alpha: 0.4 };

  function eachEvent(events, fn) {
    if (!events) return;
    if (Array.isArray(events)) { for (const e of events) if (e) fn(e); return; }
    if (Array.isArray(events.list)) for (let i = 0; i < events.n; i++) if (events.list[i]) fn(events.list[i]);
  }

  function update(view, dt = 1 / 60) {
    const cam = view.cam;
    const ship = view.ship;
    const d = clamp(dt, 0, 0.1);
    const reduced = !!view.reduced;
    // Events: trauma and sparks.
    if (ship) {
      const v = ship.vel || [0, 0, 0];
      const p = ship.pos;
      fwd.set(Math.sin(ship.yaw || 0), Math.cos(ship.yaw || 0), 0);
      side.crossVectors(fwd, up);
      eachEvent(view.events, (e) => {
        shake.event(e);
        const at = e.pos || p;
        switch (e.type) {
          case 'near': case 'hairline': {
            // Streaks whip past on the side it passed.
            const s = Math.sign(e.side || (r() - 0.5)) || 1;
            const n = e.type === 'hairline' ? 14 : 8;
            for (let k = 0; k < n; k++) {
              tmp.set(at[0], at[1], at[2]).addScaledVector(side, s * (0.6 + r() * 0.8)).addScaledVector(fwd,
                r() * 2 - 0.5);
              tmp.z += (r() - 0.5) * 0.6;
              sparks.emit(tmp, [v[0] * 0.2 - fwd.x * 18, v[1] * 0.2 - fwd.y * 18, v[2] * 0.2], e.type === 'hairline'
                ? 12000 : 8000, 0.18 + r() * 0.1, 1.3, 2);
            }
            break;
          }
          case 'scrape': sparks.burst(at, [v[0] * 0.6, v[1] * 0.6, v[2] * 0.6], 26, 10, 3600, 0.45, 1.3); break;
          case 'crash': sparks.burst(at, [v[0] * 0.2, v[1] * 0.2, v[2] * 0.2], 40, 16, 4200, 0.6, 1.5); break;
          case 'bigCrash': sparks.burst(at, [0, 0, 0], 70, 22, 5000, 0.8, 1.8); break;
          case 'takedown': sparks.burst(at, [v[0] * 0.4, v[1] * 0.4, v[2] * 0.4], 60, 18, 9000, 0.7, 1.8); break;
          case 'spark': sparks.burst(at, [v[0] * 0.8, v[1] * 0.8, v[2] * 0.8], 12, 6, 2600, 0.35, 1.4); break;
          case 'pad': case 'padPerfect':
            sparks.burst(at, [v[0] * 0.9, v[1] * 0.9, v[2] * 0.9], e.type === 'padPerfect' ? 24 : 14, 7, 14000, 0.35,
              1.3);
            break;
          case 'driftBoost':
            sparks.burst(at, [v[0] * 0.3, v[1] * 0.3, v[2] * 0.3], 10 + 8 * (e.tier || 1), 9,
              [3200, 5800, 20000][clamp((e.tier || 1) - 1, 0, 2)], 0.4, 1.6);
            break;
          case 'gate':
            if (e.kind === 'bullseye') sparks.burst(at, [v[0] * 0.9, v[1] * 0.9, v[2] * 0.9], 16, 8, 6500, 0.4, 1.2);
            break;
          default: break;
        }
      });
    }
    // Dust: wrapped round the camera, streaked along the ship's velocity.
    if (cam) {
      const u = dust.material.uniforms;
      u.uCam.value.copy(cam.position);
      const v = ship?.vel || [0, 0, 0];
      u.uVel.value.set(v[0], v[1], v[2]);
      const s = ship ? ship.speed ?? Math.hypot(v[0], v[1], v[2]) : 0;
      const f = clamp(s / S.S_TOP, 0, 1.4);
      const target = 0.55 * (0.25 + 0.75 * f * f);
      st.alpha += (target - st.alpha) * ease(d, 0.3);
      u.uAlpha.value = st.alpha;
      u.uPlaneZ.value = view.planeZ || 0;
    }
    sparks.update(d);
    if (cam) trails.update(d, cam.position, ship ? ship.speed ?? 0 : 0);
    shake.apply(cam, d, reduced);
  }

  function dispose() {
    group.removeFromParent();
    for (const o of [dust.object, trails.object, sparks.object]) { o.geometry.dispose(); o.material.dispose(); }
  }

  return { dust, trails, sparks, shake, update, dispose, object: group };
}
