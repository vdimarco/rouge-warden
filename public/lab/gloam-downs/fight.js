// Gloam Downs: a fight on the page. It ties the foes' minds (foes.js) to the run's runner, the pool of figures (pool.js), the spark
// pool (sparks.js) and the feel (feel.js): it wakes and parks the pool's slots, poses each foe from its state with its tell, lays its
// ground markers on the walk map (markers.js), flies the Pitchrook's coal, breaks a foe put out into its bone parts, draws the ember
// cracks, the bursts and the glim motes, and shows the ember notches at the screen's edge for wind-ups out of view and toward a dark
// beacon's keepers. At Barrow Crown it does the same for the Barrow Reeve (boss.js): its slot, its markers and shards, the grave
// candles, and the caged light that rides at the lantern after the fall. main.js makes one for each place of a run.
import { makeFoes, poseOf, phaseOf, ringAt, laneAt, MARKERS } from './foes.js';
import { makeBoss, poseOfBoss, lightAt, lanternOf, REEVE, ATTACKS } from './boss.js';
import { makeSparks, OVER } from './sparks.js';
import { makeFeel, gradeFloats, FEEL } from './feel.js';
import { fitRing, fitLane, WATER } from './markers.js';
import { writeBone, rotX, rotZ } from './pool.js';
import { bladeAt, SWINGS } from './play.js';


const STEP = 1 / 60;
export const SPARKS = 256;
/* how far over its fitted plane a marker lies: the places' ground splats stand up to about 0.1 m over the walk map's floor (cobbles,
   tufts, ripples on the water), and at 0.05 m the Ironback's and the Mirelight's rings broke up into specks under them */
export const MARK_LIFT = 0.16;
/* On a small screen a tell glows larger: its bones (the Snuffer's cup, the Pitchrook's coal glow, the Mirelight's core, the Ironback's
   crack) grow about their pivots so that a metre covers no fewer art pixels than at 1280x720 (180 art px high, 8.5 m back, 48°), up to
   max. A phone held upright sees ±4.6 m to each side, so its figures are smaller (qa/lab/gloam-downs-run.fight.e2e.mjs measures it) */
export const TELL = { px: 180 / (2 * 8.5 * Math.tan((24 * Math.PI) / 180)), max: 2 };
export const tellGrow = (view, artH) => {
  if (!artH || !view?.dist || !view.fov) return 1;
  const px = artH / (2 * view.dist * Math.tan(view.fov / 2));
  return Math.max(1, Math.min(TELL.max, TELL.px / px));
};
const NOTCH = { size: 30, gap: 8, most: 3, keepers: 180 };
/* The trail of a swing: from the step the strike leaves the wind-up's top to the step after the hit's own (the hit step + 1), a smear
   along the blade's own arc at three points of the blade (from 0.6 of its length to the tip), sampled `sub` times a step at fractional
   steps of the swing, so each piece follows the curve and not the chord. Each piece is a ribbon: long along the arc, `span` wide along
   the blade (half the gap between the rows, so the three rows join into one band) and thin across it. The inner row lives `inner` of
   the others' life, so as the trail fades it narrows toward the tip and stays one band. Lamp colours (slots 46 and 47, the blade's
   lit edge) for the cuts, and gold (36) at the finisher's tip. A piece shorter than `min` (a slow blade) is left out. Life in
   seconds, on play steps; after hit stop a smear ages `after` times as fast (sparks.js) */
export const TRAIL = { ks: [0.6, 0.8, 1], cols: [46, 46, 47], fin: [46, 36, 36], sub: 3, min: 0.06, inner: 0.6, w: { cut1: 0.04, cut2: 0.04, fin: 0.05 }, life: { cut1: 0.075, cut2: 0.075, fin: 0.11 } };
const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
];
const app = (a, v) => [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2]];

/* makeFight({ walk, meta, world, pool, rs, max, still, fx, project, doc }): max() is the run's maximum health; fx holds the effect
   flags (stop, flash, kick, zoom, grade, shake); project([x, y, z]) gives the screen point in CSS px or null; doc is the page's
   document (null in Node: no notches) */
export function makeFight({ walk, meta, world, pool, rs, max = () => 100, still = false, fx = {}, project = null, doc = null }) {
  const water = WATER[meta.id];
  const W = () => (doc ? doc.defaultView.innerWidth : 1280), H = () => (doc ? doc.defaultView.innerHeight : 720);
  const onScreen = (x, y, z) => {
    if (!project) return true;
    const q = project([x, y, z]);
    return !!q && q[0] >= 0 && q[0] <= W() && q[1] >= 0 && q[1] <= H();
  };
  const foes = makeFoes({ walk, meta, slots: pool.slots.map(s => s.code), seed: rs.run?.seed ?? 1, onScreen, water });
  const sparks = pool.extra && pool.extra.end > pool.extra.first ? makeSparks(world, pool.extra.first, pool.extra.end - pool.extra.first, meta.pal) : null;
  const feel = makeFeel({ pal: meta.pal, still, fx });
  const fits = new Map(); // a foe's marker laid on the ground: its fit, kept while the marker stands where it is
  const G = { foes, sparks, feel, runner: null, game: 0, keeperTo: -1, keeperAt: null, beatTo: -1, lift: MARK_LIFT, bars: 0 };
  const slotOf = f => (f.slot >= 0 ? pool.slots[f.slot] : null);
  /* the Barrow Reeve, at Barrow Crown: its slot (from the boss files, reserved until they come in), the candles' slot, and the slot of
     the light carried after the fall (from the foe files, so a reload after the fall needs no boss file) */
  const codeSlot = code => pool.slots.find(s => s.code === code) || null;
  const bossSlot = codeSlot('B'), candleSlot = codeSlot('C'), lightSlot = codeSlot('L');
  const arena = (meta.zones || []).find(z => z.boss);
  const boss = (G.boss = arena && (bossSlot || lightSlot) ? makeBoss({ walk, arena, seed: rs.run?.seed ?? 1, bounds: meta.bounds, down: !!rs.run?.bossDown, water }) : null);
  const fire = meta.beacon?.p ? [meta.beacon.p[0], meta.beacon.p[1] + 1.2, meta.beacon.p[2]] : null;
  // the twelve candles stand on the ground round the ring of 7.0 m; they light (their slot wakes) at the intro
  function placeCandles() {
    if (!candleSlot?.type || !boss) return;
    const [cx, cy, cz] = boss.c, n = candleSlot.type.groups.length;
    pool.placeGroups(candleSlot, Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2, x = cx + Math.sin(a) * REEVE.arena.candles, z = cz + Math.cos(a) * REEVE.arena.candles;
      return [x, walk.support(x, z, cy + 3) ?? walk.top(x, z), z];
    }));
  }
  if (boss) { boss.ready = !!bossSlot?.type; placeCandles(); }
  // after the boss's fall (a reload), no zone of Barrow Crown wakes
  if (boss && rs.run?.bossDown) foes.hush();
  // the boss files have come in: their figures go into the slots that waited for them, and the arena can wake
  G.fill = src => {
    if (!boss || boss.ready) return false;
    pool.fill('B', src);
    if (candleSlot) pool.fill('C', src);
    placeCandles();
    boss.ready = true;
    return true;
  };

  G.bind = runner => { G.runner = runner; foes.bind(runner); boss?.bind(runner); return G; };
  // the runner's think: the foes and the boss, then the effects of this game step
  G.think = (ev, play) => {
    G.game++;
    foes.think(ev, play);
    if (boss) { boss.think(ev, play); embers(); }
    const run = rs.run, share = run ? run.hp / Math.max(1, max()) : 1;
    for (const c of feel.tick(share)) { ev.push({ type: 'cue', cue: c }); if (!still) G.beatTo = G.game + 12; }
    if (play) trail();
    sparks?.update(STEP, play);
    syncSlots();
    if (boss) syncBoss();
  };
  /* the tell of the cage slam and the lamp-shards: a fire glow at the cage, growing over the wind-up (the cage's own light is wisp
     green, and fire is the colour of danger). The sweeps' and the lunge's tell is the crook's glowing hook, in the boss's own bake */
  function embers() {
    const g = boss.state === 'move' && (boss.move === 'slam' || boss.move === 'shards') ? boss.seg() : null;
    if (!sparks || g?.kind !== 'wind' || G.game % 5) return;
    const p = G.cageAt || [boss.x + Math.sin(boss.yaw) * 0.3, boss.y + 2.12, boss.z + Math.cos(boss.yaw) * 0.3], k = g.at / g.n;
    sparks.flash(p[0], p[1], p[2], 36, 0.2 + 0.22 * k, 0.11);
    sparks.sparks(p[0], p[1], p[2], 35, 1 + Math.round(2 * k), 1.4);
  }
  function trail() {
    const s = G.runner?.fighter.body.s, a = s?.act, S = a && SWINGS[a.move];
    if (!sparks || !S || fx.trail === false || !meta.bones?.pivots || a.t <= S.strike || a.t > S.hit + 1) return;
    const cols = a.move === 'fin' ? TRAIL.fin : TRAIL.cols, w = TRAIL.w[a.move], life = TRAIL.life[a.move], n = TRAIL.ks.length;
    let prev = null;
    for (let j = 0; j <= TRAIL.sub; j++) {
      const cur = bladeAt(meta.bones, { ...s, hide: false, act: { ...a, t: a.t - 1 + j / TRAIL.sub } }, TRAIL.ks).points;
      if (prev) {
        // the blade's direction here (inner row to tip), and half the gap between two rows: each ribbon reaches its neighbours
        const b = [cur[n - 1][0] - cur[0][0], cur[n - 1][1] - cur[0][1], cur[n - 1][2] - cur[0][2]], bl = Math.hypot(b[0], b[1], b[2]) || 1;
        const along = b.map(v => v / bl), span = (bl / (n - 1)) * 0.5;
        cur.forEach((p, i) => {
          if (Math.hypot(p[0] - prev[i][0], p[1] - prev[i][1], p[2] - prev[i][2]) >= TRAIL.min) sparks.smear(prev[i], p, cols[i], w, i === 0 ? life * TRAIL.inner : life, along, span);
        });
      }
      prev = cur;
    }
    G.trails = (G.trails || 0) + 1;
  }
  // the boss's slot shows while it does (from the intro to its parts), the candles from the intro on, and the light after the fall
  function syncBoss() {
    const want = !!bossSlot?.type && boss.shown();
    if (want && !bossSlot.awake) { pool.wake(bossSlot, { x: boss.x, y: boss.y - 1.8, z: boss.z, yaw: boss.yaw, floor: boss.y }, 'intro'); G.bossMarks = true; }
    else if (!want && bossSlot?.awake) pool.park(bossSlot);
    const flash = want && boss.flash > 0 && fx.flash !== false;
    if (bossSlot?.awake && bossSlot.flash !== flash) pool.flash(bossSlot, flash);
    const lit = !!candleSlot?.type && boss.ready && boss.state !== 'wait';
    if (lit && !candleSlot.awake) pool.wake(candleSlot, { x: boss.c[0], y: boss.c[1], z: boss.c[2], yaw: 0 }, null);
    else if (!lit && candleSlot?.awake) pool.park(candleSlot);
    const shine = !!lightSlot?.type && ['rise', 'fly', 'carried', 'beacon'].includes(boss.light.state);
    if (shine && !lightSlot.awake) {
      const p = lightAt(boss.light, lantern() || [boss.x, boss.y + 1.6, boss.z], fire) || [boss.x, boss.y + 1.6, boss.z];
      pool.wake(lightSlot, { x: p[0], y: p[1], z: p[2], yaw: 0 }, 'rest');
      pool.place(lightSlot, 'light', p);
    } else if (!shine && lightSlot?.awake) pool.park(lightSlot);
  }
  // what the combat camera reads: outside the arena and within 16 m of its centre, the boss is its foe at any distance, while the
  // fight has started and the boss is up
  G.bossFoe = s => {
    if (!boss?.fighting()) return [];
    const d = Math.hypot(s.x - boss.c[0], s.z - boss.c[2]);
    return d > REEVE.arena.in && d <= REEVE.arena.camera ? [{ id: boss.id, x: boss.x, y: boss.y, z: boss.z, home: false, range: Infinity }] : [];
  };
  // the targets of the blade, soft aim, R, Look and RB: the foes, and the boss while the fight has started and it is up
  G.targets = () => (boss?.alive ? [...foes.targets(), boss] : foes.targets());
  // the guard rule, and at Barrow Crown the boss's light: the beacon lights only with the light carried to it
  G.lightable = () => { const a = foes.lightable(); return a.ok && boss ? boss.lightable() : a; };
  // wake a slot when its foe shows, park it when it no longer does, and flash it on the 3 game steps after a hit
  function syncSlots() {
    pool.slots.forEach((s, i) => {
      if (!'SPMI'.includes(s.code)) return;
      const f = foes.holders[i], want = !!f && foes.shown(f);
      if (want && !s.awake) { pool.wake(s, atOf(f), 'rest'); f.markerShown = false; }
      else if (!want && s.awake) pool.park(s);
      const flash = want && f.flash > 0 && fx.flash !== false;
      if (s.awake && s.flash !== flash) pool.flash(s, flash);
    });
  }
  // a foe's place for the pose: its feet, its facing, the floor under it for the shadow, and the shake of a hit in the picture only
  function atOf(f) {
    const sh = shakeOf(f);
    return { x: f.x + sh[0], y: f.y, z: f.z + sh[2], yaw: f.yaw, floor: foes.floorUnder(f) };
  }
  // ±0.04 m along the hit's way, every 2 game steps (none with reduced motion or with the shake turned off)
  function shakeOf(f) {
    if (still || fx.shake === false || !(f.shake > 0)) return [0, 0, 0];
    const k = (Math.floor(f.shake / 2) % 2 ? 1 : -1) * 0.04;
    return [f.shakeDir[0] * k, 0, f.shakeDir[1] * k];
  }

  /* ---------------- what happened, as the page draws and feels it ---------------- */
  G.event = e => {
    const s = G.runner?.fighter.body.s;
    switch (e.type) {
      case 'hit': {
        feel.hit(e.kind);
        const t = e.target;
        if (t && sparks) {
          const dx = t.x - s.x, dz = t.z - s.z, l = Math.hypot(dx, dz) || 1;
          sparks.sparks(t.x - (dx / l) * t.r * 0.6, t.y + (t.T?.chest ?? 0.9), t.z - (dz / l) * t.r * 0.6, e.kind === 'fin' || e.kind === 'plunge' ? 36 : 35, e.kind === 'fin' ? 12 : 7, 4.5, dx / l, dz / l);
        }
        break;
      }
      case 'hurt':
        feel.hurt(e.dmg);
        if (sparks && s) sparks.sparks(s.x, s.y + 0.9, s.z, 34, 8, 3.5);
        break;
      case 'ring': sparks?.ring(e.x, e.y + OVER, e.z, 35, 0.3, e.r, 0.32, 22, 0.05); sparks?.drops(e.x, e.y + OVER, e.z, 33, 6, 2.5, 2.5); break;
      case 'dead': feel.dead(); break;
      case 'boss': bossEvent(e); break;
      case 'win':
        // the last beacon: the bars come in again over 30 steps, and the light flies from the lantern into the fire
        feel.barsTo([FEEL.bars, 30]);
        if (boss) boss.toBeacon(G.lightNow || lanternOf(s));
        break;
      case 'cracks': for (const p of e.pts) sparks?.cracks(p[0], p[1], p[2], (x, z) => walk.support(x, z, p[1] + 0.6)); break;
      case 'burst':
        if (!sparks) break;
        if (e.kind === 'clang') { sparks.sparks(e.x, e.y, e.z, 36, 14, 5); sparks.flash(e.x, e.y, e.z, 37, 0.35, 0.1); }
        else {
          sparks.ring(e.x, e.y + OVER, e.z, e.kind === 'pulse' ? 39 : 35, e.r * 0.3, e.r, 0.3, Math.round(10 + e.r * 6), 0.05);
          sparks.drops(e.x, e.y + OVER, e.z, e.kind === 'pulse' ? 38 : 34, 6, 2, 2.5);
          if (e.kind === 'coal') sparks.flash(e.x, e.y + 0.2, e.z, 36, 0.4, 0.12);
        }
        break;
      case 'foeOut': sparks?.drops(e.x, e.y + 0.6, e.z, 33, 10, 1.8, 2.5); break;
      case 'dark': G.keeperTo = G.game + NOTCH.keepers; G.keeperAt = e.at; break;
    }
  };
  /* the boss's moments: at the intro every other awake zone sleeps (its foes sink over 0.6 s), ember cracks show where it rises, the
     bars ease in and the zoom goes to 1.15; at the start they ease out; a phase change and the slam kick the camera; at the fall the bars
     come in over the 9 steps of hit stop and ease out over 30, and the place's colours pull toward fire for 6 steps */
  function bossEvent(e) {
    switch (e.what) {
      case 'intro':
        foes.hush();
        feel.barsTo([FEEL.bars, 30]);
        feel.intro(true);
        if (sparks) for (let k = 0; k < 4; k++) sparks.cracks(boss.x + Math.sin(k * 1.6) * 0.7, boss.y, boss.z + Math.cos(k * 1.6) * 0.7, (x, z) => walk.support(x, z, boss.y + 0.6));
        break;
      case 'start': feel.barsTo([0, 30]); feel.intro(false); break;
      case 'phase': case 'slam': feel.shock(e.kick); break;
      case 'fall':
        foes.hush();
        feel.fall();
        feel.barsTo([FEEL.bars, REEVE.stop], [0, 30]);
        if (sparks) { sparks.sparks(e.x, e.y + 1.8, e.z, 36, 14, 4.5); sparks.drops(e.x, e.y + 0.4, e.z, 33, 14, 2.4, 2.5); }
        break;
    }
  }

  /* ---------------- the picture ---------------- */
  // lay a foe's marker: its ring's six slices or its lane's pieces, each fitted to the ground (refitted when it moves or doubles)
  function markers(f, s) {
    const m = f.marker, T = f.T, mk = MARKERS[f.type];
    const names = f.type === 'I' ? [...ringNames, ...laneNames] : mk ? ringNames : [];
    if (!m || !mk) { if (f.markerShown) { for (const n of names) pool.hide(s, n); f.markerShown = false; } return; }
    f.markerShown = true;
    if (m.kind === 'ring') {
      const M = f.move === 'lob' ? T.moves.lob : f.type === 'I' ? T.moves.slam : T.moves.pulse;
      const winding = f.move && f.T.moves[f.move] === M && phaseOf(M, f.mt) === 'wind';
      const r = Math.max(0.05, winding ? ringAt(M, f.mt) : m.full), R = r < m.full * 0.6 ? m.full * 0.5 : m.full;
      const key = `r${m.x.toFixed(2)},${m.z.toFixed(2)},${R}`;
      let fit = fits.get(f);
      if (!fit || fit.key !== key) { fit = { key, slices: fitRing(walk, m.x, m.z, R, m.y, water) }; fits.set(f, fit); }
      fit.slices.forEach((q, i) => pool.marker(s, ringNames[i], { x: m.x, y: q.y, z: m.z, yaw: fit.slices.yaw, k: r / mk.ring, tilt: q.tilt, lift: G.lift }));
      if (f.type === 'I') for (const n of laneNames) pool.hide(s, n);
    } else {
      const M = T.moves.charge, [w, L, n] = mk.lane, len = f.move === 'charge' && phaseOf(M, f.mt) === 'wind' ? laneAt(M, f.mt) : m.full;
      const key = `l${m.x.toFixed(2)},${m.z.toFixed(2)},${m.yaw.toFixed(3)},${len.toFixed(1)}`;
      let fit = fits.get(f);
      if (!fit || fit.key !== key) { fit = { key, pieces: fitLane(walk, m.x, m.z, m.yaw, len, w, L, n, m.y, water) }; fits.set(f, fit); }
      fit.pieces.forEach((p, i) => pool.marker(s, laneNames[i], { x: p.x, y: p.y, z: p.z, yaw: m.yaw, kx: 1, kz: p.k, tilt: p.tilt, lift: G.lift }));
      for (const nm of ringNames) pool.hide(s, nm);
    }
  }
  const ringNames = ['ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'ring6'], laneNames = ['lane1', 'lane2', 'lane3', 'lane4', 'lane5'];
  /* the boss's markers: the slam's ring of six slices (the sweeps show its front three, at 4.0 m), the lunge's lane in six pieces of
     1.5 m, and the three rings of the lamp-shards; each fitted to the ground as a foe's is, and kept while it stands where it is */
  const six = p => [1, 2, 3, 4, 5, 6].map(i => `${p}${i}`);
  const B_RING = six('ring'), B_LANE = six('lane'), B_SHARD_RINGS = [1, 2, 3].map(r => six(`shardRing${r}_`)), B_SHARDS = ['shard1', 'shard2', 'shard3'];
  const B_MARKS = [...B_RING, ...B_LANE, ...B_SHARD_RINGS.flat(), ...B_SHARDS], shardFits = [];
  const fitOf = (slot, key, make) => { let f = fits.get(slot); if (!f || f.key !== key) { f = { key, ...make() }; fits.set(slot, f); } return f; };
  function bossMarkers(s) {
    const m = boss.mk, hide = list => { for (const n of list) pool.hide(s, n); };
    if (!m) { if (G.bossMarks) { hide(B_MARKS); G.bossMarks = false; } return; }
    G.bossMarks = true;
    if (m.kind === 'slices' || m.kind === 'ring') {
      const R = Math.max(0.05, m.R), fitR = R < m.full * 0.6 ? m.full * 0.5 : m.full, yaw = m.kind === 'slices' ? m.face - Math.PI / 2 : null;
      const fit = fitOf(B_RING, `${m.kind}${m.x.toFixed(2)},${m.z.toFixed(2)},${fitR},${yaw === null ? '' : yaw.toFixed(2)}`, () => ({ slices: fitRing(walk, m.x, m.z, fitR, m.y, water, yaw) }));
      fit.slices.forEach((q, i) => {
        if (m.kind === 'slices' && i > 2) pool.hide(s, B_RING[i]);
        else pool.marker(s, B_RING[i], { x: m.x, y: q.y, z: m.z, yaw: fit.slices.yaw, k: R / ATTACKS.slam.ring, tilt: q.tilt, lift: G.lift });
      });
      hide(B_LANE); hide(B_SHARD_RINGS.flat());
    } else if (m.kind === 'shards') {
      m.rings.forEach((p, r) => {
        if (m.done[r]) { hide(B_SHARD_RINGS[r]); return; }
        const R = Math.max(0.05, m.R), fitR = R < m.full * 0.6 ? m.full * 0.5 : m.full, key = `s${p[0].toFixed(2)},${p[2].toFixed(2)},${fitR}`;
        if (!shardFits[r] || shardFits[r].key !== key) shardFits[r] = { key, slices: fitRing(walk, p[0], p[2], fitR, p[1], water) };
        const fit = shardFits[r];
        fit.slices.forEach((q, i) => pool.marker(s, B_SHARD_RINGS[r][i], { x: p[0], y: q.y, z: p[2], yaw: fit.slices.yaw, k: R / m.full, tilt: q.tilt, lift: G.lift }));
      });
      hide(B_RING); hide(B_LANE);
    } else if (m.kind === 'lane') {
      const len = Math.max(0.05, m.len), A = ATTACKS.lunge;
      const fit = fitOf(B_LANE, `l${m.x.toFixed(2)},${m.z.toFixed(2)},${m.yaw.toFixed(3)},${len.toFixed(1)}`, () => ({ pieces: fitLane(walk, m.x, m.z, m.yaw, len, A.width, 1.5, 6, m.y, water) }));
      fit.pieces.forEach((p, i) => pool.marker(s, B_LANE[i], { x: p.x, y: p.y, z: p.z, yaw: m.yaw, kx: 1, kz: p.k, tilt: p.tilt, lift: G.lift }));
      hide(B_RING); hide(B_SHARD_RINGS.flat());
    }
  }
  /* pose the boss from its state, with its markers and its shards in flight; at the fall it kneels, then breaks into its bone parts
     (its light leaves them: the light's own slot takes over). Where its cage and its light are is kept for the embers and the light */
  const LIGHT_KEEP = new Set(['light']), app3 = (w, pv) => { const a = app(w.A, pv); return [a[0] + w.t[0], a[1] + w.t[1], a[2] + w.t[2]]; };
  function drawBoss(time, grow) {
    const s = bossSlot;
    if (!s?.type || !s.awake) return;
    if (boss.state === 'parts') { boss.partsClip = 'fall'; boss.partsT = REEVE.fall / 60; parts(boss, s, LIGHT_KEEP); return; }
    boss.partsFrom = null;
    const p = poseOfBoss(boss, time), sh = shakeOf(boss), clip = s.type.clips[p.clip] ? p.clip : 'rest';
    const w = pool.pose(s, { x: boss.x + sh[0], y: boss.y + p.dy, z: boss.z + sh[2], yaw: boss.yaw, floor: boss.y }, clip, p.t, grow > 1 ? { grow: { crookTip: grow } } : undefined);
    const ci = s.type.index.cage, li = s.type.index.light;
    if (w[ci] && !w[ci].hidden) G.cageAt = app3(w[ci], s.type.bones[ci].pivot);
    if (w[li] && !w[li].hidden) boss.lightFrom = app3(w[li], s.type.bones[li].pivot);
    bossMarkers(s);
    B_SHARDS.forEach((n, k) => { const q = boss.shards.find(x => x.k === k); if (q) pool.place(s, n, boss.shardAt(q)); else pool.hide(s, n); });
  }
  // the lantern of the lamplighter as it is posed this frame (its lantern arm), or from its facing while the blink hides it
  const armL = meta.bones?.names?.indexOf('armL') ?? -1, REST_LANTERN = meta.bones?.pivots ? [0.56, meta.bones.pivots[0][1] - 0.1 + 0.35, 0.14] : null;
  function lantern() {
    const s = G.runner?.fighter.body.s;
    if (!s) return null;
    if (armL < 0 || !REST_LANTERN || s.hide) return lanternOf(s);
    const o = 12 * armL, b = pool.bones, A = [b[o], b[o + 1], b[o + 2], b[o + 3], b[o + 4], b[o + 5], b[o + 6], b[o + 7], b[o + 8]];
    // a bone not posed yet (or put away) is all zeros
    if (!A.some(v => v !== 0)) return lanternOf(s);
    return app3({ A, t: [b[o + 9], b[o + 10], b[o + 11]] }, REST_LANTERN);
  }
  function drawLight() {
    if (!lightSlot?.awake) return;
    const p = lightAt(boss.light, lantern() || [boss.x, boss.y, boss.z], fire);
    if (p) { pool.place(lightSlot, 'light', p); G.lightNow = p; }
  }
  /* a foe put out breaks into its bone parts: each part flies from where it was, turns and falls, and shrinks to nothing over the
     0.6 s before its slot parks */
  function parts(f, s, skip = null) {
    if (!f.partsFrom) f.partsFrom = pool.pose(s, { ...f.diedAt, floor: f.diedAt.y }, f.partsClip || 'rest', f.partsT || 0);
    const u = Math.min(1, f.t / 36), tau = (f.t / 60), k = Math.max(0, 1 - u), c = [f.diedAt.x, f.diedAt.y + f.T.chest, f.diedAt.z];
    s.type.bones.forEach((bone, b) => {
      const w = f.partsFrom[b];
      if (bone.parent === 'ground' || !w || w.hidden || skip?.has(bone.name)) { writeBone(pool.bones, s.base + b, { A: [0, 0, 0, 0, 0, 0, 0, 0, 0], t: [0, -500, 0] }); return; }
      const pw = app(w.A, bone.pivot).map((v, i) => v + w.t[i]), out = [pw[0] - c[0], pw[1] - c[1] + 0.4, pw[2] - c[2]], l = Math.hypot(...out) || 1;
      const sp = 1.6 + (b % 3) * 0.5, v = [(out[0] / l) * sp, 1.8 + (b % 2) * 0.8, (out[2] / l) * sp];
      const floor = (f.diedAt.y ?? 0) + 0.05, y = Math.max(floor, pw[1] + v[1] * tau - 4.5 * tau * tau);
      const A = mul(mul(rotX((b % 2 ? 1 : -1) * 5 * tau), rotZ((b % 3 - 1) * 4 * tau)), [k, 0, 0, 0, k, 0, 0, 0, k]), A2 = mul(A, w.A), ap = app(A2, bone.pivot);
      writeBone(pool.bones, s.base + b, { A: A2, t: [pw[0] + v[0] * tau - ap[0], y - ap[1], pw[2] + v[2] * tau - ap[2]] });
    });
  }
  /* pose every foe that shows, lay its marker and its coal, write the sparks and the motes, and set the effects. view is the camera
     of this draw ({ yaw, pitch, dist, fov }); o.time is the game time for the clips; o.pool false parks every slot for this one draw;
     o.art is the art's height in px, for the tells' growth on a small screen */
  G.draw = (view = {}, o = {}) => {
    const time = o.time ?? G.game / 60, grow = (G.grow = tellGrow(view, o.art));
    pool.slots.forEach((s, i) => {
      const f = foes.holders[i];
      if (!f || !s.awake || !'SPMI'.includes(s.code)) return;
      if (o.pool === false) { for (let b = 0; b < s.type.bones.length; b++) writeBone(pool.bones, s.base + b, { A: [0, 0, 0, 0, 0, 0, 0, 0, 0], t: [0, -500, 0] }); return; }
      if (f.state === 'dying') { parts(f, s); return; }
      f.partsFrom = null;
      const p = poseOf(f, time), clip = s.type.clips[p.clip] ? p.clip : 'rest';
      pool.pose(s, atOf(f), clip, p.t, grow > 1 ? { grow: { tell: grow, core: grow } } : undefined);
      markers(f, s);
    });
    if (o.pool !== false) for (const c of foes.coals) {
      const s = slotOf(c.f);
      if (!s?.awake || c.f.state === 'dying') continue;
      const p = foes.coalAt(c);
      pool.place(s, 'coal', p);
      pool.place(s, 'tell', p);
    }
    if (boss) {
      if (o.pool === false) { for (const s of [bossSlot, lightSlot]) if (s?.awake) for (let b = 0; b < s.type.bones.length; b++) writeBone(pool.bones, s.base + b, { A: [0, 0, 0, 0, 0, 0, 0, 0, 0], t: [0, -500, 0] }); }
      else { drawBoss(time, grow); drawLight(); }
    }
    if (sparks && o.pool === false) { sparks.hide(); for (const r of sparks.rows()) pool.rows.add(r); }
    else if (sparks && sparks.write(foes.motes, time)) for (const r of sparks.rows()) pool.rows.add(r);
    G.kick = feel.kick(view.yaw, view.pitch);
    G.zoom = feel.zoom();
    G.bars = feel.bars();
    G.cols = feel.grade();
    world.anim.grade = G.cols ? gradeFloats(G.cols, G.gradeBuf ||= new Float32Array(64 * 3)) : null;
  };

  /* ---------------- notches ----------------
   An ember notch at the screen's edge for each wind-up whose foe's chest is out of the view (the 3 nearest their hit), filling from
   empty to full over the wind-up; and for 3 s toward a dark beacon's keepers. A notch sits where the line from the screen's middle
   toward the foe meets the edge, slid along the edge clear of the controls: on a touch screen a notch at the bottom sits 8 px over
   the buttons, and one at the top 8 px under the Lab bar and clear of the HUD and the tools */
  const AVOID = ['.labbar .back', '#menu', '#hud', '#tools', '#toast.on', '#bAttack', '#bRoll', '#bHeal', '#bJump', '.bossbar', '#bossBar'];
  function rects() {
    if (!doc) return [];
    return AVOID.flatMap(sel => [...doc.querySelectorAll(sel)]).filter(el => !el.hidden && el.offsetParent !== null).map(el => el.getBoundingClientRect()).filter(r => r.width && r.height);
  }
  const overlaps = (a, b, pad = 4) => a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
  function edgePoint(q, side, w, h) {
    const cx = w / 2, cy = h / 2, m = NOTCH.size / 2 + NOTCH.gap;
    let dx, dy;
    if (q) { dx = q[0] - cx; dy = q[1] - cy; } else { dx = side * w * 0.25; dy = h; }
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = -1;
    const kx = dx ? (dx > 0 ? w - m - cx : m - cx) / dx : Infinity, ky = dy ? (dy > 0 ? h - m - cy : m - cy) / dy : Infinity, k = Math.min(kx, ky);
    const edge = kx < ky ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top';
    return { x: cx + dx * k, y: cy + dy * k, edge, angle: Math.atan2(dy, dx) };
  }
  function placeNotch(n, avoid, taken, w, h) {
    const S = NOTCH.size, half = S / 2, box = (x, y) => ({ left: x - half, right: x + half, top: y - half, bottom: y + half });
    const touch = avoid.filter(r => r.top > h * 0.5 && r.left > w * 0.3);
    if (n.edge === 'bottom' && touch.length) n.y = Math.min(n.y, Math.min(...touch.map(r => r.top)) - NOTCH.gap - half);
    const bar = avoid.filter(r => r.top < 70 && r.bottom < 120);
    if (n.edge === 'top' && bar.length) n.y = Math.max(n.y, Math.max(...bar.map(r => r.bottom)) + NOTCH.gap + half);
    const free = (x, y) => { const b = box(x, y); return b.left >= 2 && b.right <= w - 2 && b.top >= 2 && b.bottom <= h - 2 && !avoid.some(r => overlaps(b, r)) && !taken.some(t => overlaps(b, t)); };
    const along = n.edge === 'left' || n.edge === 'right' ? [0, 1] : [1, 0];
    for (let tries = 0; tries < 3; tries++) {
      for (let d = 0; d < Math.max(w, h); d += 8) for (const sg of d ? [1, -1] : [1]) {
        const x = n.x + along[0] * d * sg, y = n.y + along[1] * d * sg;
        if (free(x, y)) { n.x = x; n.y = y; n.rect = box(x, y); return n; }
      }
      // nowhere along this line: step in from the edge, under (or over) what is in the way
      if (n.edge === 'top') n.y += S; else if (n.edge === 'bottom') n.y -= S; else if (n.edge === 'left') n.x += S; else n.x -= S;
    }
    n.rect = box(n.x, n.y);
    return n;
  }
  G.notches = (view = {}) => {
    if (!project || !G.runner) return [];
    const s = G.runner.fighter.body.s, w = W(), h = H(), list = [];
    const side = p => {
      const yaw = view.yaw ?? 0, rx = Math.cos(yaw), rz = -Math.sin(yaw);
      return Math.sign((p[0] - s.x) * rx + (p[2] - s.z) * rz) || 1;
    };
    const ups = [...foes.windups(), ...(boss ? boss.windups() : [])].filter(u => !onScreen(u.x, u.y, u.z)).sort((a, b) => b.fill - a.fill).slice(0, NOTCH.most);
    for (const u of ups) {
      const p = [u.x, u.y, u.z], q = project(p);
      list.push({ kind: 'foe', foe: u.id, fill: u.fill, bearing: Math.atan2(u.x - s.x, u.z - s.z), ...edgePoint(q, side(p), w, h) });
    }
    if (G.game < G.keeperTo && G.keeperAt && list.length < NOTCH.most) {
      const a = G.keeperAt, p = [a[0], s.y + 1, a[2]], q = project(p);
      // the bearing on the screen: toward the keepers' centre from the lamplighter, as the camera sees it
      const yaw = view.yaw ?? 0, dx = a[0] - s.x, dz = a[2] - s.z, fwd = [-Math.sin(yaw), -Math.cos(yaw)], rt = [Math.cos(yaw), -Math.sin(yaw)];
      const sx = dx * rt[0] + dz * rt[1], sz = dx * fwd[0] + dz * fwd[1], l = Math.hypot(sx, sz) || 1;
      const qq = q && q[0] >= 0 && q[0] <= w && q[1] >= 0 && q[1] <= h ? q : [w / 2 + (sx / l) * w, h / 2 - (sz / l) * h];
      list.push({ kind: 'keepers', fill: 1, bearing: Math.atan2(dx, dz), ...edgePoint(qq, 1, w, h) });
    }
    const avoid = rects(), taken = [];
    for (const n of list) { placeNotch(n, avoid, taken, w, h); taken.push(n.rect); }
    return list;
  };
  let box = null;
  // the notches as HTML shapes of our own: a dark disc with an ember rim, a pointer toward the foe, and the fill of the wind-up
  G.showNotches = (view, playing) => {
    if (!doc) return [];
    box ||= doc.getElementById('notches');
    if (!box) {
      box = doc.createElement('div');
      box.id = 'notches';
      box.setAttribute('aria-hidden', 'true');
      const st = doc.createElement('style');
      st.textContent = `#notches{position:fixed;inset:0;pointer-events:none;z-index:25}
#notches .notch{position:absolute;width:${NOTCH.size}px;height:${NOTCH.size}px;margin:-${NOTCH.size / 2}px 0 0 -${NOTCH.size / 2}px;border-radius:50%;
background:rgba(18,8,8,.78);box-shadow:0 0 0 2px #ff9a32,0 0 10px rgba(210,85,28,.7);overflow:visible}
#notches .notch i{position:absolute;left:3px;right:3px;bottom:3px;border-radius:0 0 12px 12px;background:#d2551c;max-height:calc(100% - 6px)}
#notches .notch b{position:absolute;left:50%;top:50%;width:0;height:0;margin:-6px 0 0 -3px;border:6px solid transparent;border-left:9px solid #ffd77a;
transform-origin:3px 6px;transform:rotate(var(--a)) translateX(14px)}
#notches .notch.keepers{box-shadow:0 0 0 2px #ffd77a,0 0 12px rgba(255,154,50,.8)}`;
      doc.head.appendChild(st);
      doc.body.appendChild(box);
    }
    const list = playing ? G.notches(view) : [];
    while (box.children.length > list.length) box.lastChild.remove();
    while (box.children.length < list.length) { const d = doc.createElement('div'); d.className = 'notch'; d.append(doc.createElement('i'), doc.createElement('b')); box.appendChild(d); }
    list.forEach((n, i) => {
      const d = box.children[i];
      d.className = `notch ${n.kind} ${n.edge}`;
      d.style.left = `${n.x}px`; d.style.top = `${n.y}px`;
      d.firstChild.style.height = `${Math.round(n.fill * 100)}%`;
      d.lastChild.style.setProperty('--a', `${n.angle}rad`);
    });
    // the health bar pulses for 12 steps after each heartbeat (the HUD sets .low itself, below 30% health)
    doc.getElementById('hud')?.classList.toggle('beat', G.game < G.beatTo);
    G.shown = list;
    return list;
  };

  /* ---------------- ?test ---------------- */
  // __gloam.foes(): each awake foe with its pose's shake
  G.list = () => [
    ...foes.list().map(({ ref, ...f }) => ({ ...f, shake: shakeOf(ref) })),
    ...(boss?.shown() ? [{ id: boss.id, type: 'B', zone: 'arena', x: boss.x, y: boss.y, z: boss.z, yaw: boss.yaw, hp: boss.hp, state: boss.state, phase: boss.phase,
      move: boss.move || boss.state, t: (boss.move ? boss.mt : boss.t) / 60, flash: boss.flash, held: !!boss.hold, shake: shakeOf(boss) }] : [])
  ];
  const isBoss = q => !!boss && (q === boss.id || q === 'B' || q === boss);
  G.hooks = {
    // the boss's health, as __gloam.set({ bossHp }) puts it
    bossHp: v => { if (!boss) return null; boss.setHp(v); return boss.view(); },
    wake: id => foes.wake(id),
    spawn: (type, x, z, yaw) => {
      const r = foes.spawn(type, x, z, yaw);
      syncSlots();
      return r;
    },
    hold: (q, move, t) => (isBoss(q) ? boss.holdAt(move, t) : foes.hold(q, move, t)),
    out: q => { const n = foes.putOut(q); return { ok: n > 0, n }; }
  };
  return G;
}
