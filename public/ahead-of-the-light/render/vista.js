// Ahead of the Light: the vista (final.md 4.2, 16): 2.5 s of lab B's north-up chase camera (pitch 30°, 24 units
// back) as you pass the leg's landmark, after the gate. The sky is the leg's backdrop seen at your true speed from
// behind your heading (render/points.js aberration about the heading in view space, as lab B does); the landmark is
// the backdrop's own geometry, flown past on one side; rivals are labelled points; the light follows as a white
// wall. It borrows the scene's renderer and the backdrop's buffers (shared, never copied) and draws its labels on the
// overlay's 2D canvas. Ported from public/light-years-home/lab/b/view.js.
import * as THREE from 'three';
import { createRelativity, createGlowMaterial } from '../../light-years-home/render/points.js';
import { TUNE } from '../core/tune.js';
import { DEG, wrap } from '../core/ringmath.js';
import { createFloorMaterial } from './scene.js';
import { ROUTE_Z } from './landmarks.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const VISTA_S = 2.5;
const PITCH = 30, BACK = 24, LOOK_AHEAD = 6;

export function createVista({ scene: host, tune = TUNE } = {}) {
  const T = tune;
  const renderer = host.renderer;
  const scene = new THREE.Scene();
  const skyScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 4000);
  const skyCam = new THREE.PerspectiveCamera(60, 1, 0.1, 1e6);
  const rel = { sky: createRelativity(host.lut), land: createRelativity(host.lut), near: createRelativity(host.lut) };
  const V = { on: false, t: 0, w: 1, h: 1, dpr: 1, focal: 300, ship: [0, 0], speed: 1, body: null, rivals: [],
    gap: 8, eta: 1, label: '', parts: [], skyObj: null, mats: [], wallZ: 10 };

  // the ship: a white glow; its trail: a fading line
  const shipBag = { pos: new Float32Array(3), temp: new Float32Array([12000]), lum: new Float32Array([400]),
    size: new Float32Array([0.35]) };
  const shipGeo = new THREE.BufferGeometry();
  shipGeo.setAttribute('position', new THREE.BufferAttribute(shipBag.pos, 3));
  shipGeo.setAttribute('aTemp', new THREE.BufferAttribute(shipBag.temp, 1));
  shipGeo.setAttribute('aLum', new THREE.BufferAttribute(shipBag.lum, 1));
  shipGeo.setAttribute('aSize', new THREE.BufferAttribute(shipBag.size, 1));
  const shipMat = createFloorMaterial({ shared: rel.near, falloff: 0, maxPx: 40, emax: 600, sized: true, exposure: 1 });
  const ship = new THREE.Points(shipGeo, shipMat);
  ship.frustumCulled = false;
  ship.renderOrder = 5;
  scene.add(ship);
  // rivals: up to 8 small glows
  const RV = 8;
  const rvPos = new Float32Array(RV * 3), rvT = new Float32Array(RV).fill(8000), rvL = new Float32Array(RV),
    rvS = new Float32Array(RV).fill(0.18);
  const rvGeo = new THREE.BufferGeometry();
  rvGeo.setAttribute('position', new THREE.BufferAttribute(rvPos, 3));
  rvGeo.setAttribute('aTemp', new THREE.BufferAttribute(rvT, 1));
  rvGeo.setAttribute('aLum', new THREE.BufferAttribute(rvL, 1));
  rvGeo.setAttribute('aSize', new THREE.BufferAttribute(rvS, 1));
  const rvMat = createFloorMaterial({ shared: rel.near, falloff: 0, maxPx: 20, emax: 300, sized: true, exposure: 1 });
  const rvPts = new THREE.Points(rvGeo, rvMat);
  rvPts.frustumCulled = false;
  rvPts.renderOrder = 4;
  scene.add(rvPts);
  const TRAIL = 90;
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(TRAIL * 3), trailCol = new Float32Array(TRAIL * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  trail.frustumCulled = false;
  scene.add(trail);
  const landGroup = new THREE.Group();
  scene.add(landGroup);

  function clearBorrowed() {
    for (const m of V.mats) m.dispose();
    V.mats = [];
    landGroup.clear();
    if (V.skyObj) { skyScene.remove(V.skyObj); V.skyObj = null; }
  }

  // Start the vista from the race as it ends. backdrop: the leg's backdrop (its sky and landmark are borrowed).
  function begin({ race, backdrop = null }) {
    clearBorrowed();
    V.on = true; V.t = 0;
    const you = race.ships[0];
    V.eta = you.eta; V.gap = you.gap;
    const body = backdrop ? backdrop.ahead : null;
    V.body = body;
    V.label = body ? body.label : '';
    if (backdrop) {
      const sky = new THREE.Points(backdrop.sky.geometry, createFloorMaterial({ shared: rel.sky, falloff: 0, maxPx: 4,
        emax: 1.4, cull: 0.02, exposure: 0.22, floor: 0, floorAbs: 0.5 }));
      sky.frustumCulled = false;
      V.mats.push(sky.material);
      skyScene.add(sky);
      V.skyObj = sky;
      for (const p of backdrop.vistaParts()) {
        const mat = p.kind === 'glow' ? createGlowMaterial({ shared: rel.land, exposure: 0.08, eref: 4, maxPx: 48 })
          : createFloorMaterial({ shared: rel.land, falloff: 0, maxPx: 5, emax: 6, cull: 0.02,
            exposure: p.kind === 'planets' ? 2.2 : 1.0, floor: 0.2, tint: p.kind === 'nebula' || p.kind === 'planets' });
        const pts = new THREE.Points(p.geometry, mat);
        pts.frustumCulled = false;
        V.mats.push(mat);
        landGroup.add(pts);
      }
    }
    // the landmark passes on your left at 1.2 radii; you fly 5 radii in 2.5 s
    const rad = body ? body.rad : 6;
    V.rad = rad;
    V.speed = (5 * rad) / VISTA_S;
    const c = body ? body.c : [0, 0, -ROUTE_Z];
    // the backdrop's frame: the body centre goes to (−1.2 rad, −0.3 rad, −3 rad) from your start
    landGroup.position.set(-c[0] - 1.2 * rad, -c[1] - 0.3 * rad, -c[2] - 3 * rad);
    // rivals: placed by their bearing and seconds from you
    V.rivals = race.ships.slice(1).filter((r) => r.kind !== 'drifter' && !r.caught && !r.wrecked).slice(0, RV).map((r) => ({
      id: r.id, name: r.name || String(r.id).toUpperCase(), x: wrap(r.bearing - you.bearing) * DEG * rad * 0.8,
      z: -((r.dist - you.dist) / Math.max(1e-6, 1.87)) * rad * 1.5, nemesis: Boolean(r.ai && r.ai.nemesis) }));
    V.trail = [];
  }

  function resize(w, h, dpr = 1) { V.w = w; V.h = h; V.dpr = dpr; }

  // One frame of the vista. ctx: the overlay's 2D context (its labels and the light's wall). Returns true while it
  // runs.
  function render(dt, ctx = null) {
    if (!V.on) return false;
    V.t += dt;
    const portrait = V.h > V.w;
    const sz = -V.speed * V.t;
    const shipP = new THREE.Vector3(0, 0, sz);
    // the camera: north-up chase, pitch 30°, 24 units back, looking a little ahead
    const p = PITCH * DEG;
    const look = new THREE.Vector3(0, 0, sz - LOOK_AHEAD);
    camera.up.set(0, 1, 0);
    camera.position.set(0, BACK * Math.sin(p), sz + BACK * Math.cos(p));
    camera.lookAt(look);
    const hfov = (portrait ? 62 : 70) * DEG;
    const aspect = V.w / V.h;
    const vfov = portrait ? 2 * Math.atan(Math.tan(hfov / 2) / aspect) : hfov / Math.max(1, aspect) * 1.2;
    camera.fov = vfov / DEG; camera.aspect = aspect; camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    V.focal = V.h / 2 / Math.tan(vfov / 2);
    skyCam.quaternion.copy(camera.quaternion);
    skyCam.fov = camera.fov; skyCam.aspect = aspect; skyCam.updateProjectionMatrix(); skyCam.updateMatrixWorld(true);
    // relativity about the heading, in view space
    const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion.clone().invert()).normalize();
    // the sky at your true speed; the landmark drawn where it is, so its ring and label sit on it
    const phiS = Math.min(V.eta, T.SKY_CAP), phiL = 0;
    const set = (r, phi) => {
      r.uExpPhi.value = Math.exp(phi); r.uExpMinusPhi.value = Math.exp(-phi); r.uVel.value.copy(vel);
      r.uPxPerRad.value = V.focal; r.uRatio.value = renderer.getPixelRatio();
    };
    set(rel.sky, phiS); set(rel.land, phiL); set(rel.near, 0);
    // ship and rivals
    shipBag.pos[0] = 0; shipBag.pos[1] = 0.2; shipBag.pos[2] = sz;
    shipGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < RV; i++) {
      const r = V.rivals[i];
      if (r) { rvPos[i * 3] = r.x; rvPos[i * 3 + 1] = 0.2; rvPos[i * 3 + 2] = sz + r.z; rvL[i] = r.nemesis ? 220 : 160;
        rvT[i] = r.nemesis ? 3200 : 9000; } else rvL[i] = 0;
    }
    rvGeo.attributes.position.needsUpdate = true; rvGeo.attributes.aLum.needsUpdate = true;
    rvGeo.attributes.aTemp.needsUpdate = true;
    V.trail.push([0, sz]);
    if (V.trail.length > TRAIL) V.trail.shift();
    const n = V.trail.length;
    for (let i = 0; i < n; i++) {
      trailPos[i * 3] = V.trail[i][0]; trailPos[i * 3 + 1] = 0.15; trailPos[i * 3 + 2] = V.trail[i][1] + 0.6;
      const f = (i / Math.max(1, n - 1)) ** 1.6 * 0.85;
      trailCol[i * 3] = trailCol[i * 3 + 1] = trailCol[i * 3 + 2] = f;
    }
    trailGeo.setDrawRange(0, n);
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;

    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(skyScene, skyCam);
    renderer.render(scene, camera);
    renderer.autoClear = true;

    if (ctx) drawLabels(ctx, shipP);
    if (V.t >= VISTA_S) V.on = false;
    return V.on;
  }

  const project = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x + 1) / 2 * V.w, y: (1 - v.y) / 2 * V.h, on: v.z < 1 && v.z > -1 };
  };

  function drawLabels(ctx, shipP) {
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    ctx.clearRect(0, 0, V.w, V.h);
    const fade = smooth(0, 0.3, V.t) * (1 - smooth(VISTA_S - 0.3, VISTA_S, V.t));
    const px = V.w > 900 && V.h > 600 ? 13 : 11;
    const boxes = [];
    const boxOf = (p, textS, dx, dy) => {
      ctx.font = `600 ${px}px ${FONT}`;
      const tw = ctx.measureText(textS).width, x0 = p.x + dx * 28;
      return { x: dx > 0 ? x0 : x0 - tw, y: p.y + dy * 14 - px * 0.7, w: tw, h: px * 1.4 };
    };
    const hits = (b) => boxes.some((o) => b.x < o.x + o.w + 6 && o.x < b.x + b.w + 6 && b.y < o.y + o.h + 4 && o.y < b.y + b.h + 4);
    // a leader out at 45° (up, or down with dy = 1), 10 px flat, then the text: the video's labels
    const label = (p, textS, color = '#fff', dx = 1, dy = -1) => {
      boxes.push(boxOf(p, textS, dx, dy));
      ctx.globalAlpha = fade;
      ctx.strokeStyle = color === '#fff' ? 'rgba(255,255,255,0.8)' : color; ctx.lineWidth = 1;
      const ey = p.y + dy * 14;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dx * 14, ey); ctx.lineTo(p.x + dx * 24, ey); ctx.stroke();
      ctx.font = `600 ${px}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = dx > 0 ? 'left' : 'right';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(textS, p.x + dx * 28, ey);
      ctx.fillStyle = color; ctx.fillText(textS, p.x + dx * 28, ey);
      ctx.globalAlpha = 1;
    };
    // the landmark: a thin ring round it and its label
    // the light: where its white wall crosses the screen (drawn after the landmark, which keeps clear of it)
    const wz = shipP.z + clamp(V.gap * 1.6, 3, 18);
    const wa = project(-80, 0, wz), wb = project(80, 0, wz);
    // a wall further back than the screen's bottom edge stands at the edge, so the light is always in view
    const wallY = wa.on && wb.on && (wa.y + wb.y) / 2 < V.h - 22 ? (wa.y + wb.y) / 2 : V.h - 22;
    if (V.body) {
      const c = landGroup.position, b = V.body.c;
      const q = project(b[0] + c.x, b[1] + c.y, b[2] + c.z);
      const e = project(b[0] + c.x + V.rad, b[1] + c.y, b[2] + c.z);
      if (q.on) {
        const r = Math.max(8, Math.hypot(e.x - q.x, e.y - q.y));
        ctx.globalAlpha = fade; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
        // the landmark labels from its ring's lower right, downward, clear of the rivals' labels (which go up)
        let dy = 1;
        let lx = clamp(q.x + r * 0.7071, 12, V.w - 12), ly = clamp(q.y + r * 0.7071, 60, V.h - 40);
        if (Math.abs(ly + 14 - wallY) < 30) { dy = -1; ly = clamp(q.y - r * 0.7071, 60, V.h - 40); }
        ctx.font = `600 ${px}px ${FONT}`;
        const tw = ctx.measureText(V.label).width;
        label({ x: lx, y: ly }, V.label, '#fff', lx + 28 + tw > V.w - 8 ? -1 : 1, dy);
      }
    }
    // rivals as labelled points
    V.rivals.forEach((r, i) => {
      const q = project(r.x, 0.2, shipP.z + r.z);
      if (!q.on) return;
      // the first way round that is clear of the labels already drawn
      let pick = null;
      for (const [dx, dy] of [[i % 2 ? -1 : 1, -1], [i % 2 ? 1 : -1, -1], [1, 1], [-1, 1]]) {
        if (!hits(boxOf(q, r.name, dx, dy))) { pick = [dx, dy]; break; }
      }
      if (pick) label(q, r.name, r.nemesis ? '#f08a2c' : '#fff', pick[0], pick[1]);
    });
    // the light: a white wall following you
    {
      const a = { x: 0, y: wallY }, b = { x: V.w, y: wallY };
      ctx.globalAlpha = fade;
      for (const [lw, al] of [[10, 0.12], [4, 0.3], [1.5, 0.95]]) {
        ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      label({ x: V.w * 0.9, y: wallY }, `THE LIGHT · ${Math.max(0, V.gap).toFixed(1)} S BEHIND`, '#fff', -1,
        wallY > V.h - 40 ? -1 : 1);
    }
    const sp = project(0, 0.2, shipP.z);
    if (sp.on) label(sp, 'YOU', '#f08a2c', 1);
  }

  return {
    begin, render, resize,
    skip() { V.on = false; },
    end() { V.on = false; clearBorrowed(); },
    active: () => V.on,
    time: () => V.t,
    camera, project,
    dispose() {
      clearBorrowed();
      for (const o of [ship, rvPts, trail]) { o.geometry.dispose(); o.material.dispose(); }
    },
  };
}
