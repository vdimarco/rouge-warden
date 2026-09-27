// js/story/missions/freeroam.js : free roam (design 2.6, AMENDMENTS E8, E9).
// - The roam task: after P1, between chapters (each waits behind its giver marker), after QUIT and after
//   the story. It hosts the side content and handles the van's tow after a wreck (to the A-frame) and the
//   hero's respawn after going down (at the last cairn, else the A-frame).
// - 51 kazoos lie around Sedona from F1 on: every 17 give the gourd one more sip (5 to 8, E8); all 51 turn
//   the horn into a kazoo.
// - 4 vortex cairns: found when you come near; REST saves and refills, WAIT runs the clock to morning or
//   night (x60), and the map travels between found cairns (with a fade). The A-frame and the Airstream let
//   you rest too. One Legend guards each cairn, one more per act (E9): THE JAVELINA, THE VULTURE, THE GILA,
//   THE TARANTULA, ink forms of the gang body. Walk up to a guarded cairn and the fight starts.
// - 2 jeep time trials (the race step) and 3 photo hunts (the photo step), from giver markers.
// - Traffic and people follow the region and the hour (ambient only; missions may override, C2). Calm free
//   roam saves every 30 s.
import { CHAPTER_ORDER } from '../types.js';
import { KAZOOS, CAIRNS, AFRAME, PLACES } from '../world/places.js';
import { PALETTE } from '../look/palette.js';
import { toonRamp } from '../../render.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toHour } from '../../core/clock.js';
import { FAIL } from './vm.js';

const idx = (id) => CHAPTER_ORDER.indexOf(id);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const LEGEND_INFO = { javelina: ['THE JAVELINA', '猪'], vulture: ['THE VULTURE', '鷲'], gila: ['THE GILA', '蜥'], tarantula: ['THE TARANTULA', '蛛'] };
const CAIRN_NAMES = { cairn_airport: 'Airport Mesa', cairn_bell: 'Bell Rock', cairn_cathedral: 'Cathedral Rock', cairn_boynton: 'Boynton Canyon' };
// the act that wakes each Legend: after P1, after P4, after P8 (and all of them once the story is over)
const LEGEND_AFTER = { 1: 'p1', 2: 'p4', 3: 'p8' };
const REGION_TRAFFIC = { uptown: 1, west: 0.95, village: 0.8, airport: 0.45, canyon: 0.55, schnebly: 0.25, redrock: 0.5, boynton: 0.3, ranch: 0 };
const REGION_CROWD = { uptown: 1, west: 0.7, village: 0.7, airport: 0.3, canyon: 0.35, schnebly: 0.1, redrock: 0.4, boynton: 0.25, ranch: 0 };
const hourK = (h, night = 0.25) => (h < 5.5 ? night : h < 7 ? 0.5 : h < 19 ? 1 : h < 22 ? 0.6 : night);

export function createRoam(S, K) {
  const { THREE } = S;
  const M = S.missions;
  const side = K.side;
  const kz = { got: new Array(KAZOOS.length).fill(false), meshes: new Map(), active: false, t: 0 };
  let cairnRoot = null, giverOn = null, resumeId = null, autosaveT = 0, densT = 0, legendNear = null, legendLatch = new Set();

  /* ---------------- side content (E9): built when first needed (the time trials follow the roads) ---------------- */
  function legendPos(cid) { const c = CAIRNS[cid]; const a = (c.yaw || 0) + Math.PI; return { x: Math.round((c.x + Math.sin(a) * 7) * 10) / 10, z: Math.round((c.z + Math.cos(a) * 7) * 10) / 10 }; }
  function buildSide() {
    if (side.built) return;
    for (const [cid, c] of Object.entries(CAIRNS)) {
      const v = c.legend, [name, kanji] = LEGEND_INFO[v];
      side[`legend_${v}`] = { id: `legend_${v}`, title: name, side: 'legend', cairn: cid, legend: v, act: c.act,
        fail: { heroDown: true },
        steps: [
          { type: 'card', kind: 'title', title: name, kanji, sub: 'A LEGEND GUARDS THE CAIRN', dur: 2.4 },
          { type: 'fight', legend: true, boss: 'legend', music: true, arena: { x: c.x, z: c.z, r: 16 }, waves: [[{ foe: 'legend', variant: v, pos: legendPos(cid), alert: true }]], cp: true, objective: `Defeat ${name.toLowerCase().replace(/^the /, 'the ')}.` },
        ],
        onPass: { flags: { [`legend_${v}`]: true } } };
    }
    // two jeep time trials: down Schnebly Hill, and the canyon run over Midgley Bridge
    trial('trial_schnebly', 'Schnebly Hill', 'schnebly_vista', 'arts_village', 14);
    trial('trial_canyon', 'The Canyon Run', 'slide_rock', 'uptown', 16);
    // three photo hunts: postcards of the big rocks
    hunt('hunt_bell', 'Bell Rock', 'bell_cairn', 'bell_rock', 62, 12);
    hunt('hunt_cathedral', 'Cathedral Rock', 'red_rock_crossing', 'cathedral', 62, -10);
    hunt('hunt_snoopy', 'Snoopy Rock', 'mask_mayhem', 'snoopy_rock', 60, 6);
    side.built = true;
  }
  function trial(id, title, from, to, pace) {
    const a = S.world.place(from), b = S.world.place(to);
    let pts = [];
    try { pts = S.world.roads.route({ x: a.x, z: a.z }, { x: b.x, z: b.z }) || []; } catch (e) { pts = []; }
    if (pts.length < 2) pts = [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];
    // a gate every 120 m along the route, and one at the end
    const gates = []; let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const seg = flat(pts[i], pts[i - 1]); acc += seg;
      if (acc >= 120) { gates.push({ x: Math.round(pts[i].x), z: Math.round(pts[i].z), r: 11 }); acc = 0; }
    }
    const end = pts[pts.length - 1]; if (!gates.length || flat(gates[gates.length - 1], end) > 40) gates.push({ x: Math.round(end.x), z: Math.round(end.z), r: 11 });
    let len = 0; for (let i = 1; i < pts.length; i++) len += flat(pts[i], pts[i - 1]);
    const target = Math.max(40, Math.round(len / pace * 1.12));
    const yaw = Math.atan2(pts[1].x - pts[0].x, pts[1].z - pts[0].z);
    const start = { x: pts[0].x - Math.sin(yaw) * 6, z: pts[0].z - Math.cos(yaw) * 6, yaw };
    side[id] = { id, title: `Time Trial: ${title}`, side: 'trial', trial: id, at: start, glyph: '走', giverLabel: 'TIME TRIAL',
      spawns: [{ id: 'jeep', kind: 'jeep', pos: { x: start.x, z: start.z }, yaw, enterable: true }],
      fail: { vanWrecked: false },
      steps: [
        { type: 'card', kind: 'title', title: 'TIME TRIAL', kanji: '走', sub: `${title.toUpperCase()} · ${Math.floor(target / 60)}:${String(target % 60).padStart(2, '0')}`, dur: 2.2 },
        { type: 'enter', vehicle: 'jeep', seat: 0, objective: 'Get in the jeep.', cp: true },
        { type: 'race', gates, target, vehicle: 'jeep', objective: 'Drive through every gate.' },
      ] };
  }
  function hunt(id, title, at, subject, min, off) {
    const p = PLACES[at] || S.world.place(at);
    side[id] = { id, title: `Postcard: ${title}`, side: 'hunt', at: { x: p.x + off, z: p.z + 4, yaw: 0 }, glyph: '写', giverLabel: 'POSTCARD',
      steps: [
        { type: 'card', kind: 'title', title: `POSTCARD · ${title.toUpperCase()}`, kanji: '写', sub: 'Take a photo worth sending home.', dur: 2.2 },
        { type: 'photo', subject, kind: 'place', min, objective: `Take a photo of ${title}. Score ${min} or more.` },
      ],
      onPass: { flags: { [id]: true } } };
  }
  const storyOver = () => K.doneSet.has('e1');
  const reached = (ch) => storyOver() || K.doneSet.has(ch);
  const sideOpen = () => reached('p1');
  const legendAwake = (v) => { const c = Object.values(CAIRNS).find((x) => x.legend === v); return !!c && reached(LEGEND_AFTER[c.act] || 'p1') && !S.flags[`legend_${v}`] && !K.doneSet.has(`legend_${v}`); }; // (content's own Legend defs set another flag)
  function available() {
    if (!sideOpen()) return [];
    buildSide();
    const out = [];
    for (const [id, d] of Object.entries(side)) {
      if (id === 'built' || !d || !d.side) continue;
      if (d.side === 'legend' ? !legendAwake(d.legend) : K.doneSet.has(id) && d.side === 'hunt') continue;
      out.push(id);
    }
    for (const id of K.unlocked) if (!K.doneSet.has(id) && K.lookup(id)) out.push(id);
    return out;
  }

  /* ---------------- kazoos (E8) ---------------- */
  const kazooCount = () => kz.got.reduce((n, g) => n + (g ? 1 : 0), 0);
  function kazooMesh(i) {
    let g = kz.meshes.get(i);
    if (g) return g;
    try { g = S.cast.props.make('kazoo'); } catch (e) { g = null; }
    if (!g) g = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.12, 8), new THREE.MeshToonMaterial({ color: PALETTE.kazoo, gradientMap: toonRamp }));
    // the party kazoo, three times its size so it can be found, tipped on its side with a soft glint
    const holder = new THREE.Group(), tilt = new THREE.Group();
    tilt.add(g); tilt.rotation.z = 1.2; tilt.scale.setScalar(4);
    if (!kz.glint) kz.glint = new THREE.SpriteMaterial({ map: glintTex(), color: 0xfff0d8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
    const sp = new THREE.Sprite(kz.glint); sp.scale.set(0.7, 0.7, 1); sp.position.y = 0.08;
    holder.add(tilt, sp); holder.name = `kazoo:${KAZOOS[i].id}`;
    (S.world.group || S.scene).add(holder);
    kz.meshes.set(i, holder);
    return holder;
  }
  function glintTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,240,210,0.5)'); r.addColorStop(1, 'rgba(255,230,200,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function collect(i) {
    if (kz.got[i]) return;
    kz.got[i] = true;
    const g = kz.meshes.get(i); if (g) { g.removeFromParent(); kz.meshes.delete(i); }
    const n = kazooCount();
    if (S.audio) S.audio.sfx('kazoo', { at: KAZOOS[i] });
    S.ui.toast(`KAZOO ${n}/51`);
    K.log('kazoo', KAZOOS[i].id, n);
    const H = S.hero;
    if (n % 17 === 0 && H) {
      H.canteenMax = Math.min(8, 5 + Math.floor(n / 17)); H.canteen = H.canteenMax;
      S.ui.toast('THE GOURD HOLDS ONE MORE SIP');
    }
    if (n === KAZOOS.length) { S.flags.kazooHorn = true; S.ui.toast('ALL 51 KAZOOS. THE HORN IS A KAZOO NOW.'); }
  }
  function kazooUpdate(rdt) {
    const on = S.world && S.world.visible && M.chapter && idx(M.chapter) >= idx('f1') && S.hero && S.hero.actor && !(S.cine && S.cine.active);
    if (!on) { if (kz.active) { for (const g of kz.meshes.values()) g.visible = false; kz.active = false; } return; }
    kz.active = true; kz.t += rdt;
    const H = S.hero, v = S.drive && S.drive.riding, at = v ? v.pos : H.pos;
    const reach = v ? 3.4 : 1.7;
    for (let i = 0; i < KAZOOS.length; i++) {
      if (kz.got[i]) continue;
      const k = KAZOOS[i], d = Math.hypot(k.x - at.x, k.z - at.z);
      if (d > 70) { const g = kz.meshes.get(i); if (g) g.visible = false; continue; }
      if (d < reach && (H.mode === 'foot' || v) && Math.abs((H.pos.y || 0) - S.world.surface(k.x, k.z, (H.pos.y || 0) + 2)) < 3) { collect(i); continue; }
      const g = kazooMesh(i);
      g.visible = true;
      const y = S.world.surface(k.x, k.z, (H.pos.y || 0) + 3);
      g.position.set(k.x, y + 0.32 + Math.sin(kz.t * 2.2 + i) * 0.06, k.z);
      g.rotation.y = kz.t * 1.1 + i;
      if (kz.glint) kz.glint.opacity = 0.35 + 0.25 * Math.sin(kz.t * 3.1);
    }
  }

  /* ---------------- cairns ---------------- */
  function buildCairns() {
    if (cairnRoot || !S.world || !S.world.ready) return;
    cairnRoot = new THREE.Group(); cairnRoot.name = 'cairns';
    // each cairn is one mesh: the stones merged, coloured per vertex (one draw call a cairn)
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp });
    const cols = [PALETTE.cairnStone, PALETTE.rockGrey, PALETTE.rockCream].map((h) => new THREE.Color(h)), dark = new THREE.Color(PALETTE.rockShadow);
    const base = new THREE.DodecahedronGeometry(1, 0), o3 = new THREE.Object3D();
    const stone = (col, sx, sy, sz, x, y, z, rx, ry, rz) => {
      const gg = base.clone(); o3.position.set(x, y, z); o3.rotation.set(rx, ry, rz); o3.scale.set(sx, sy, sz); o3.updateMatrix(); gg.applyMatrix4(o3.matrix);
      const n = gg.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const k = 0.92 + 0.08 * Math.sin(i * 1.7); c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k; }
      gg.setAttribute('color', new THREE.BufferAttribute(c, 3));
      return gg;
    };
    const swirl = swirlSprite();
    for (const [id, c] of Object.entries(CAIRNS)) {
      const g = new THREE.Group(); g.name = `cairn:${id}`;
      const y0 = S.world.surface(c.x, c.z);
      // a ring of low stones, then a stack of flat stones that narrows, each a little off the one below
      const parts = [];
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; parts.push(stone(dark, 0.26, 0.13, 0.22, Math.sin(a) * 1.15, 0.05, Math.cos(a) * 1.15, 0.2 * (i % 3), i * 2.1, 0)); }
      let y = 0;
      [[0.56, 0.2], [0.48, 0.17], [0.42, 0.16], [0.34, 0.14], [0.28, 0.12], [0.2, 0.11], [0.13, 0.09]].forEach(([w, h], i) => {
        y += h * (i ? 1.55 : 0.8);
        parts.push(stone(cols[i % 3], w, h, w * 0.86, Math.sin(i * 2.4) * 0.05, y, Math.cos(i * 2.4) * 0.05, 0.08 * Math.sin(i * 3), i * 1.7, 0.06 * Math.cos(i * 5)));
        y += h * 0.55;
      });
      const merged = mergeGeometries(parts); for (const p of parts) p.dispose();
      merged.computeVertexNormals();
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'cairnStones';
      g.add(mesh);
      const sp = new THREE.Sprite(swirl); sp.scale.set(1.1, 1.1, 1); sp.position.y = y + 0.9; g.add(sp); g.userData.swirl = sp;
      g.position.set(c.x, y0, c.z);
      cairnRoot.add(g);
      try { S.world.colliders.addCircle(c.x, c.z, 0.9, { tag: 'cairn' }); } catch (e) { /* stub */ }
    }
    (S.world.group || S.scene).add(cairnRoot);
  }
  // a slow ink swirl over each cairn (the vortex)
  function swirlSprite() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.translate(64, 64);
    g.strokeStyle = 'rgba(24,18,20,0.85)'; g.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) { g.lineWidth = 7 - arm * 1.5; g.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = arm * 2.1 + t * 5.5, r = 6 + t * 50; if (t === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r); else g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.75 });
  }
  function cairnUpdate(rdt) {
    if (!S.world.visible) return;
    buildCairns();
    if (cairnRoot) for (const g of cairnRoot.children) if (g.userData.swirl) g.userData.swirl.material.rotation += rdt * 0.4;
    if (!sideOpen() || !S.hero) return;
    const at = S.drive && S.drive.riding ? S.drive.riding.pos : S.hero.pos;
    for (const [id, c] of Object.entries(CAIRNS)) {
      const d = flat(at, c);
      if (d < 16 && !M.cairns.includes(id)) {
        M.cairns.push(id); S.flags[`found:${id}`] = true; S.flags.lastCairn = id;
        try { S.world.reveal(id); } catch (e) { /* stub */ }
        S.ui.toast(`CAIRN FOUND · ${CAIRN_NAMES[id].toUpperCase()}`);
        if (S.audio) S.audio.sfx('cairn', { at: c });
        K.log('cairn', id);
      }
      // a Legend waits here: walking up to it starts the fight (once per approach)
      if (K.roaming && !M.active && legendAwake(c.legend)) {
        if (d < 26 && !legendLatch.has(id) && !K.roamReq && S.hero.mode === 'foot') { legendLatch.add(id); request(() => runSide(`legend_${c.legend}`)); }
        if (d > 60) legendLatch.delete(id);
      }
    }
  }
  function addRestSpots() {
    for (const [id, c] of Object.entries(CAIRNS)) {
      S.interact.add({ id: `roam:rest:${id}`, tag: 'roam', label: 'REST', r: 3, mode: 'foot', prio: 2, pos: () => ({ x: c.x, y: S.world.surface(c.x, c.z), z: c.z }),
        when: () => K.roaming && !M.active && !legendAwake(c.legend) && !K.roamReq, act: () => request(() => restMenu(id, true)) });
    }
    const homes = { aframe: { x: AFRAME.x + Math.sin(AFRAME.yaw) * 6, z: AFRAME.z + Math.cos(AFRAME.yaw) * 6 }, airstream: PLACES.airstream };
    for (const [id, p] of Object.entries(homes)) {
      S.interact.add({ id: `roam:rest:${id}`, tag: 'roam', label: 'REST', r: 2.6, mode: 'foot', prio: 1, pos: () => ({ x: p.x, y: S.world.surface(p.x, p.z), z: p.z }),
        when: () => K.roaming && !M.active && !K.roamReq && sideOpen(), act: () => request(() => restMenu(id, false)) });
    }
    // side givers: walk up and press E
    S.interact.add({ id: 'roam:side', tag: 'roam', label: 'START', r: 3.2, mode: 'foot', prio: 3,
      pos: () => { const g = nearGiver(); return g ? { x: g.x, y: S.world.surface(g.x, g.z), z: g.z } : { x: 0, y: -1e4, z: 0 }; },
      when: () => K.roaming && !M.active && !K.roamReq && !!nearGiver(), act: () => { const g = nearGiver(); if (g) request(() => runSide(g.id)); } });
  }
  function nearGiver() {
    if (!sideOpen()) return null;
    const H = S.hero; let best = null;
    for (const id of available()) {
      const d = side[id] || K.lookup(id); if (!d || !d.at || d.side === 'legend') continue;
      const at = typeof d.at === 'string' ? S.world.place(d.at) : d.at; if (!at) continue;
      if (d.window && !inWindow(d.window)) continue;
      const dd = flat(H.pos, at); if (dd < 3.2 && (!best || dd < best.d)) best = { id, x: at.x, z: at.z, d: dd };
    }
    return best;
  }
  const inWindow = (w) => { const h = S.day.hour, a = toHour(w[0]), b = toHour(w[1]); return a <= b ? h >= a && h < b : h >= a || h < b; };

  /* ---------------- the roam task ---------------- */
  function request(f) { if (!K.roamReq) K.roamReq = f; }
  function* ensureWorld() {
    if (!S.ready) { S.ui.loading(0); while (!S.ready) { S.ui.loading(K.loadProgress()); yield null; } S.ui.loading(null); }
    if (!S.world.visible) {
      S.ctx.setArenaVisible(false); S.world.setVisible(true); S.bus.emit('swap', { to: 'story' });
      if (S.look.name === 'ARENA' || !S.look.name) S.look.set('DAY', { dur: 0, clock: true });
      const p = S.world.place('aframe');
      if (S.hero && p) { S.hero.setBody(K.pickBody()); S.hero.place(p.x, p.z, p.yaw); }
    }
    if (S.hero && !S.hero.actor) S.hero.setBody(K.pickBody());
  }
  function objective() {
    if (giverOn) { const C = giverOn; S.ui.objective(`Chapter ${C.n}: ${C.title}. Go to the marker.`); return; }
    if (resumeId) { const C = S.content.CHAPTERS[resumeId]; S.ui.objective(`Free roam. Go to the marker to play ${C ? C.title : 'on'}.`); return; }
    S.ui.objective(storyOver() ? 'Free roam. Find the cairns and the kazoos.' : 'Free roam. Press Esc for the menu.');
  }
  // one tick of roaming: the asked-for errands (a side mission, a rest, travel, a wait), the tow and the respawn
  function* roamTick() {
    if (K.roamReq) { const f = K.roamReq; try { yield* f(); } finally { K.roamReq = null; objective(); } return; }
    const v = S.vehicles.player;
    if (v && v.wrecked && !(S.drive && S.drive.anim)) { yield* tow(v); return; }
    if (S.hero && S.hero.down) { yield* respawn(); return; }
    yield null;
  }
  function* forever(o = {}) {
    K.roaming = true; M.active = null; M.timeScale = 1;
    resumeId = o.resume || null;
    let armed = false; // the way back into the story opens once the hero has walked away from it
    try {
      yield* ensureWorld();
      if (S.mode !== 'credits') S.mode = 'play';
      if (o.fromSave && K.bootSave && !K.bootSave.hero.lost) S.hero.place(K.bootSave.hero.x, K.bootSave.hero.z, K.bootSave.hero.yaw);
      objective();
      if (o.side) { yield* runSide(o.side, o.step || 0, o.snap); objective(); }
      for (;;) {
        if (resumeId) {
          const C = S.content.CHAPTERS[resumeId], p = C && C.start ? S.world.place(C.start) : null;
          if (p) {
            if (!K.markers3d.get('roam:resume')) K.markers3d.add('roam:resume', { x: p.x, z: p.z, y: p.y, r: 3, label: `CHAPTER ${C.n}` });
            const d = flat(S.hero.pos, p);
            if (d > 12) armed = true;
            if (armed && d < 3 && S.hero.mode === 'foot' && !K.roamReq) { const id = resumeId; S.timers.after(0, () => M.startChapter(id, { reason: 'jump' }), 'missions:switch'); yield null; continue; }
          }
        }
        yield* roamTick();
      }
    } finally { K.roaming = false; K.markers3d.remove('roam:resume'); resumeId = null; }
  }
  // between chapters: roam until the player walks into the next chapter's marker
  function* untilGiver(C) {
    K.roaming = true; giverOn = C; M.active = null;
    const p = (C.start && S.world.place(C.start)) || { x: S.hero.pos.x, y: S.hero.pos.y, z: S.hero.pos.z };
    const first = (C.missions || []).map((id) => K.lookup(id)).find(Boolean);
    const who = (first && first.giver) || 'gabe';
    K.giver = { id: `giver:${C.id}`, x: p.x, z: p.z, kind: 'giver', who, label: `CHAPTER ${C.n}` };
    let t = 0;
    try {
      objective();
      for (;;) {
        if (!K.markers3d.get('roam:giver')) K.markers3d.add('roam:giver', { x: p.x, z: p.z, y: p.y, r: 3.2, label: `CHAPTER ${C.n}` });
        if (flat(S.hero.pos, p) < 3.2 && S.hero.mode === 'foot' && !K.roamReq && !(S.cine && S.cine.active)) break;
        if (M.auto && (t += 1 / 60) > 0.2 && !K.roamReq) { if (S.drive.riding) K.forceOut(S.drive.riding); S.hero.place(p.x, p.z, p.yaw); break; }
        yield* roamTick();
        objective();
      }
    } finally { giverOn = null; K.giver = null; K.roaming = false; K.markers3d.remove('roam:giver'); S.ui.objective(null); }
  }
  // a side mission, with RETRY and QUIT like any other
  function* runSide(id, step = 0, snap = null) {
    buildSide();
    let o = { step, snap };
    const was = K.roaming; K.roaming = false;
    try {
      for (;;) {
        const r = yield* K.vm.runMission(id, o);
        if (r !== FAIL) break;
        const c = yield* K.vm.failCard(id);
        if (c.quit) {
          const d = K.lookup(id);
          if (d && d.cairn) { const cc = CAIRNS[d.cairn], a = Math.atan2(S.hero.pos.x - cc.x, S.hero.pos.z - cc.z); if (S.hero.down) S.hero.hp = S.hero.maxHp; S.hero.place(cc.x + Math.sin(a) * 34, cc.z + Math.cos(a) * 34); }
          else if (S.hero.down) S.hero.hp = S.hero.maxHp;
          break;
        }
        o = c.retry;
      }
    } finally { K.roaming = was; }
  }
  function* restMenu(id, cairn) {
    const h = S.ui.card('text', { title: cairn ? 'VORTEX CAIRN' : 'HOME', kanji: cairn ? '渦' : '家', sub: cairn ? CAIRN_NAMES[id] : 'Rest a while.', choices: ['REST AND SAVE', 'WAIT TILL MORNING', 'WAIT TILL NIGHT', 'LEAVE'] });
    while (!h.done) { if (M.auto) S.ui.advanceAll(); yield null; }
    if (cairn) S.flags.lastCairn = id;
    if (h.choice === 0) {
      const H = S.hero; H.hp = H.maxHp; H.canteen = H.canteenMax;
      const ok = S.save.write();
      S.ui.toast(ok ? 'SAVED. LIFE AND GOURD ARE FULL.' : 'LIFE AND GOURD ARE FULL.');
    } else if (h.choice === 1) yield* waitTo(7);
    else if (h.choice === 2) yield* waitTo(21);
  }
  function* waitTo(hour) {
    S.lockControl = true;
    try {
      const fade = S.ui.fade(0.55, 0.4);
      yield fade;
      yield* K.steps.lapseTo(null, hour, 60 * 12);
      S.ui.fade(0, 0.4);
      S.ui.toast(S.day.label());
    } finally { S.lockControl = false; }
  }
  function* travelTo(cid) {
    const c = CAIRNS[cid]; if (!c) return;
    S.lockControl = true;
    try {
      yield S.ui.fade(1, 0.4);
      const v = S.drive && S.drive.riding;
      const a = (c.yaw || 0), hx = c.x + Math.sin(a) * 4, hz = c.z + Math.cos(a) * 4;
      if (v) { const q = S.world.roads.nearest(c.x, c.z); const at = q && q.dist < 80 ? q : { x: hx, z: hz }; v.setPose(at.x, at.z, v.yaw); v.speed = 0; }
      else S.hero.place(hx, hz, a);
      S.flags.lastCairn = cid;
      yield 0.2;
      yield S.ui.fade(0, 0.5);
      S.ui.toast(CAIRN_NAMES[cid].toUpperCase());
    } finally { S.lockControl = false; if (S.ui.fade) S.ui.fade(0, 0.01); }
  }
  // a wrecked van goes on a tow truck to the A-frame
  function* tow(v) {
    S.lockControl = true;
    try {
      yield S.ui.fade(1, 0.6);
      if (S.drive.riding === v) K.forceOut(v);
      const p = S.world.place('f1_park') || S.world.place('aframe');
      v.setPose(p.x, p.z, p.yaw ?? 0); v.damage = 0; v.wrecked = false; v.speed = 0;
      const h = S.world.place('aframe'); S.hero.place(h.x, h.z, h.yaw);
      yield 0.3;
      S.ui.fade(0, 0.6);
      yield* K.steps.await_(S.ui.card('text', { title: 'TOWED', sub: 'The van is back at the A-frame.', dur: 2.4 }));
    } finally { S.lockControl = false; }
  }
  // down in free roam: the crew pulls you out, at the last cairn (else the A-frame)
  function* respawn() {
    S.lockControl = true;
    try {
      yield S.ui.fade(1, 0.8);
      try { S.combat.clear(); if (S.combat.active) S.combat.end(); } catch (e) { /* stub */ }
      const H = S.hero, cid = S.flags.lastCairn && CAIRNS[S.flags.lastCairn] ? S.flags.lastCairn : null;
      H.hp = H.maxHp; H.canteen = H.canteenMax;
      if (S.drive.riding) K.forceOut(S.drive.riding);
      if (cid) { const c = CAIRNS[cid]; H.place(c.x + Math.sin(c.yaw || 0) * 4, c.z + Math.cos(c.yaw || 0) * 4, c.yaw || 0); }
      else { const h = S.world.place('aframe'); H.place(h.x, h.z, h.yaw); }
      K.stats.deaths++;
      yield 0.4;
      S.ui.fade(0, 0.8);
      yield* K.steps.await_(S.ui.card('text', { title: 'THE CREW PULLS YOU OUT.', dur: 2.2 }));
    } finally { S.lockControl = false; }
  }

  /* ---------------- per tick ---------------- */
  S.register('world', (cdt, rdt) => { if (!S.api || !S.api.active) return; kazooUpdate(rdt); });
  S.register('script', (cdt, rdt) => {
    if (!S.api || !S.api.active || !S.world || !S.world.ready) return;
    cairnUpdate(rdt);
    // traffic and people by region and hour (ambient only); a mission's SetOps win until it ends
    if ((densT -= rdt) <= 0 && S.world.visible && S.hero) {
      densT = 1;
      const r = S.world.regionAt(S.hero.pos.x, S.hero.pos.z), h = S.day.hour;
      const t = K.density.traffic ?? (REGION_TRAFFIC[r] ?? 0.5) * hourK(h, 0.2), c = K.density.crowd ?? (REGION_CROWD[r] ?? 0.3) * hourK(h, 0.08);
      if (Math.abs(t - (K.density.lastT ?? -1)) > 0.04) { K.density.lastT = t; try { S.traffic.setDensity(t); } catch (e) { /* stub */ } }
      if (Math.abs(c - (K.density.lastC ?? -1)) > 0.04) { K.density.lastC = c; try { S.cast.crowd.setDensity(c); } catch (e) { /* stub */ } }
    }
    // calm free roam saves every 30 s
    const calm = K.roaming && !M.active && !K.roamReq && S.mode === 'play' && !S.modal && !(S.combat && S.combat.active) && !(S.hero && S.hero.down);
    if (calm) { autosaveT += rdt; if (autosaveT >= 30) { autosaveT = 0; S.save.write(); } } else autosaveT = 0;
  }, 20);

  /* ---------------- what the map and HUD show ---------------- */
  function markers() {
    const out = [];
    if (!S.world || !S.world.visible) return out;
    if (K.giver) out.push(K.giver);
    // (the HUD, the minimap and the map all draw this list, so only what is near shows: the map draws the
    // cairns for travel by itself)
    const H = S.hero ? S.hero.pos : S.focus;
    if (sideOpen()) {
      for (const [id, c] of Object.entries(CAIRNS)) {
        const d = flat(H, c);
        if (M.cairns.includes(id) && d < 260) out.push({ id: `cairn:${id}`, x: c.x, z: c.z, kind: 'cairn', label: CAIRN_NAMES[id] });
        if (legendAwake(c.legend) && K.roaming && d < 320) out.push({ id: `legend:${id}`, x: c.x, z: c.z, kind: 'danger', label: LEGEND_INFO[c.legend][0] });
      }
      if (K.roaming && !M.active) for (const id of available()) {
        const d = side[id] || K.lookup(id); if (!d || !d.at || d.side === 'legend') continue;
        const at = typeof d.at === 'string' ? S.world.place(d.at) : d.at; if (!at || flat(H, at) > 240) continue;
        if (d.side === 'hunt' && K.doneSet.has(id)) continue;
        out.push({ id: `side:${id}`, x: at.x, z: at.z, kind: 'giver', who: d.giver, glyph: d.glyph || '●', label: d.giverLabel || d.title });
      }
    }
    return out;
  }
  // side givers show a small crimson ring on the ground when near
  S.register('world', () => {
    if (!S.api || !S.api.active || !S.world.visible || !K.roaming || M.active || !sideOpen()) { for (const id of shownRings) K.markers3d.remove(id); shownRings.clear(); return; }
    const H = S.hero, want = new Set();
    for (const id of available()) {
      const d = side[id] || K.lookup(id); if (!d || !d.at || d.side === 'legend') continue;
      const at = typeof d.at === 'string' ? S.world.place(d.at) : d.at; if (!at || flat(H.pos, at) > 150) continue;
      const mid = `roam:side:${id}`; want.add(mid);
      if (!shownRings.has(mid)) { K.markers3d.add(mid, { x: at.x, z: at.z, r: 2.4, kind: 'ring', mapKind: 'giver', hud: false }); shownRings.add(mid); }
    }
    for (const id of [...shownRings]) if (!want.has(id)) { K.markers3d.remove(id); shownRings.delete(id); }
  }, 5);
  const shownRings = new Set();

  return {
    forever, untilGiver, runSide, markers, available, buildSide, collect, kazooCount,
    travel(cid) {
      if (!CAIRNS[cid]) return false;
      if (!K.roaming || M.active) { S.ui.toast('Not during a mission.'); return false; }
      if (!M.cairns.includes(cid)) { S.ui.toast('Find this cairn first.'); return false; }
      request(() => travelTo(cid)); return true;
    },
    wait(hhmm) {
      if (!K.roaming || M.active) { S.ui.toast('Not during a mission.'); return false; }
      request(() => waitTo(toHour(hhmm))); return true;
    },
    kazooString: () => kz.got.map((g) => (g ? '1' : '0')).join(''),
    reset(save) {
      for (const g of kz.meshes.values()) g.removeFromParent();
      kz.meshes.clear(); kz.active = false;
      const s = save && save.kazoos && /^[01]{51}$/.test(save.kazoos) ? save.kazoos : '0'.repeat(51);
      for (let i = 0; i < KAZOOS.length; i++) kz.got[i] = s[i] === '1';
      giverOn = null; resumeId = null; autosaveT = 0; densT = 0; legendLatch.clear(); legendNear = null; void legendNear;
      for (const id of shownRings) K.markers3d.remove(id); shownRings.clear();
      S.interact.clear('roam');
      addRestSpots();
    },
    exit() { for (const g of kz.meshes.values()) g.removeFromParent(); kz.meshes.clear(); S.interact.clear('roam'); },
    get kz() { return kz; },
    legendAwake,
  };
}
