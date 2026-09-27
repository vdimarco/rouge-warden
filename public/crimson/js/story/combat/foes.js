// js/story/combat/foes.js : the gang and the bosses as data, and the brain that fights with them
// (COMBAT spec 5). Each foe is a body, a life and posture, and a move table in the GABE_ATK schema
// ({clip, from, speed, tell, track, limb, hits:[[t0, t1, shape]], dmg, pp, bc, lunges, ...}) with its
// clips from the body's retargeted library ('gabe:*', 'ronin:*', 'bear:*'). chooseAttack picks by
// distance band with weights and never three of a kind, from rng('ai') (seeded, so a replay plays the same).
import * as THREE from 'three';
import { TUNE, PATK, GABE_ATK, BEAR_ATK } from '../../moves.js';
import { FOE_IDS, LEGEND_IDS } from '../types.js';
import { PATROLS } from '../world/places.js';
import { NEON } from '../look/palette.js';
import { glowTex } from '../../fx.js';
import { toonRamp } from '../../render.js';
import { makeFighter, startAttack, endAttack, stepAttack, stepCharge, decayPosture, turn, clamp, damp, angDiff, angleTo, flatDist } from './fighter.js';

// the procedural stride, when the body has one (A2)
const mv = (a, speed, o) => { if (a && a.move) a.move(speed, o); };
/* ---------------- move builders ---------------- */
const scaleShape = (sh, k) => (!sh ? sh : sh.aoe ? { aoe: [sh.aoe[0] * k, sh.aoe[1] * k] } : { reach: sh.reach * k, arc: sh.arc });
// Gabe's move on a gang body
const G = (name, o = {}) => { const s = GABE_ATK[name]; return { ...s, clip: `gabe:${s.cut}`, ...o }; };
// the bear's move on a human body: shapes and lunges scaled to a person
const B = (name, o = {}) => {
  const s = BEAR_ATK[name];
  return { ...s, clip: s.cut ? `bear:${s.cut}` : null, hits: s.hits.map(([a, b, sh]) => [a, b, scaleShape(sh, 0.62)]), lunges: s.lunges && s.lunges.map(([a, b, v]) => [a, b, v * 0.75]), ...o };
};
// the ronin's cut as a foe's swing (a bat, a cane, a chain)
const R = (name, o = {}) => {
  const p = PATK[name];
  return { clip: `ronin:${p.cut}`, from: p.from, speed: p.speed * 0.72, tell: p.hit[0] - 0.32, track: p.hit[0] - 0.1, limb: 'RightHand', hits: [[p.hit[0], p.hit[1], { reach: p.reach, arc: p.arc * 0.8 }]], lunges: [[p.lunge[0], p.lunge[1], p.lunge[2] * 0.8]], dmg: 14, pp: 16, bc: 16, snd: 'bossSwing', ...o };
};
// a tell a set time (real seconds) before the first hit, at the move's speed
const tellBefore = (spec, sec, speedK = 1) => spec.hits[0][0] - sec * (spec.speed || 1) * TUNE.atkSpeed * speedK;

/* ---------------- the foes ---------------- */
// bands: [[min distance, [[move, weight], ...]], ...] from far to near. combos: move -> [next, chance].
export const FOES = {
  driver: {
    id: 'driver', cast: 'gang', hp: 90, posture: 60, speed: 3.9, idle: 'gabe:idle', rest: [1.0, 1.8],
    moves: {
      jabs: G('jabs', { speed: 1.05, dmg: 13, pp: 14, bc: 10 }),
      kick: G('kick', { speed: 1.1, dmg: 20, pp: 20, bc: 20 }),
    },
    bands: [[3.5, [['kick', 2], ['jabs', 1]]], [0, [['jabs', 3], ['kick', 1.4]]]],
    combos: { jabs: ['kick', 0.25] }, reach: 2.4,
  },
  guard: {
    id: 'guard', cast: 'gang', hp: 110, posture: 80, speed: 3.7, idle: 'ronin:idle', rest: [1.1, 1.9], weapon: 'bat',
    moves: {
      swing: R('l1', { dmg: 16, pp: 16, bc: 16, hits: [[PATK.l1.hit[0], PATK.l1.hit[1], { reach: 2.3, arc: 1.1 }]] }),
      overhead: R('heavy', { speed: 1.0, dmg: 24, pp: 26, bc: 28, tell: PATK.heavy.hit[0] - 0.6, hits: [[PATK.heavy.hit[0], PATK.heavy.hit[1], { reach: 2.5, arc: 0.8 }]] }),
      jabs: G('jabs', { speed: 1.05, dmg: 11, pp: 12, bc: 10 }),
    },
    bands: [[3.2, [['overhead', 2], ['swing', 1]]], [0, [['swing', 3], ['overhead', 1.2], ['jabs', 0.8]]]],
    combos: { swing: ['swing', 0.3] }, reach: 2.5,
  },
  boone: {
    id: 'boone', cast: 'boone', hp: 260, posture: 120, speed: 3.6, idle: 'gabe:idle', rest: [1.2, 2.0], boss: true, radius: 0.6,
    name: 'BOONE', kanji: '牛',
    moves: { kick: G('kick', { dmg: 22 }), grab: G('grab', { grab: true, dmg: 28 }), fly: G('fly', { leapMax: 8 }), counter: G('counter'), jabs: G('jabs') },
    bands: [[7, [['fly', 3], ['kick', 0.6]]], [3.5, [['kick', 2.5], ['fly', 1], ['jabs', 1]]], [0, [['jabs', 3], ['kick', 1.5], ['grab', 1.2], ['counter', 0.6]]]],
    combos: { jabs: ['kick', 0.35] }, counterRate: 0.5, reach: 3,
  },
  rattler: {
    id: 'rattler', cast: 'rattler', hp: 700, posture: 100, speed: 4.2, idle: 'gabe:idle', rest: [1.1, 1.9], boss: true, radius: 0.55, weapon: 'chain',
    name: 'WADE "RATTLER" PRUITT', kanji: '蛇', phase2: 'rattlesnake',
    moves: {
      jabs: G('jabs', { dmg: 14 }), kick: G('kick', { dmg: 20 }), counter: G('counter', { dmg: 18 }), grab: G('grab', { grab: true, dmg: 26 }),
      lash: R('heavy', { speed: 1.05, dmg: 18, pp: 22, bc: 24, tell: PATK.heavy.hit[0] - 0.55, lash: true, hits: [[PATK.heavy.hit[0], PATK.heavy.hit[1], { reach: 4.2, arc: 0.7 }]], lunges: null }),
    },
    bands: [[5, [['lash', 3], ['kick', 1]]], [3, [['lash', 2], ['kick', 2], ['jabs', 1]]], [0, [['jabs', 3], ['kick', 1.3], ['grab', 1.1], ['counter', 0.6]]]],
    combos: { jabs: ['kick', 0.35] }, counterRate: 0.6, reach: 4,
  },
  voss: {
    id: 'voss', cast: 'voss', hp: 1000, posture: 120, speed: 3.8, idle: 'ronin:idle', rest: [1.2, 2.0], boss: true, radius: 0.55, weapon: 'cane',
    name: 'HARLAN VOSS, THE SMILING MAN', kanji: '笑', phase2: 'scorpion',
    moves: {
      l1: R('l1', { dmg: 13 }), l2: R('l2', { dmg: 14 }), l3: R('l3', { dmg: 18, pp: 20 }),
      overhead: R('heavy', { speed: 1.0, dmg: 24, pp: 26, bc: 28, tell: PATK.heavy.hit[0] - 0.6 }),
      thrust: R('deathblow', { speed: 1.1, dmg: 20, pp: 22, bc: 22, tell: PATK.deathblow.hit[0] - 0.4, hits: [[PATK.deathblow.hit[0], PATK.deathblow.hit[1], { reach: 3.2, arc: 0.45 }]], lunges: [[0.4, 0.78, 5]] }),
      counter: G('counter', { dmg: 18 }),
      sand: R('l1', { speed: 1.0, dmg: 4, unblock: true, sand: true, impact: PATK.l1.hit[0], snd: 'dodge', hits: [[PATK.l1.hit[0], PATK.l1.hit[1], { reach: 5, arc: 0.5 }]], lunges: null }),
    },
    bands: [[5, [['thrust', 2.4], ['sand', 1.2], ['overhead', 0.8]]], [2.8, [['thrust', 1.5], ['l1', 2], ['overhead', 1.2], ['sand', 0.9]]], [0, [['l1', 3], ['overhead', 1.2], ['counter', 0.8], ['sand', 0.6]]]],
    combos: { l1: ['l2', 0.7], l2: ['l3', 0.6] }, counterRate: 0.3, reach: 3.2,
  },
};
// phase two: the vortex forms (bosses.js runs the custom moves)
const strike = G('fly', { unblock: true, knock: true, dmg: 26, leapMax: 7, leapH: 1.1, tellSnd: 'rattle', hits: [[GABE_ATK.fly.hits[0][0], GABE_ATK.fly.hits[0][1], { reach: 2.4, arc: 1.0 }]] });
strike.tell = tellBefore(strike, 0.6, 1.1);
export const PHASE2 = {
  rattlesnake: {
    name: 'THE RATTLESNAKE', kanji: '蛇', speedK: 1.1, rest: [0.9, 1.6],
    moves: {
      jabs: G('jabs', { dmg: 14 }),
      coil: { custom: 'coil', dur: 1.0, hits: [], dmg: 0 },
      strike,
      sweep: G('kick', { dmg: 22, pp: 24, bc: 30, knock: true, impact: GABE_ATK.kick.hits[0][0] + 0.02, hits: [[GABE_ATK.kick.hits[0][0], GABE_ATK.kick.hits[0][1], { aoe: [0.3, 4] }]] }),
    },
    bands: [[5, [['coil', 2], ['strike', 2]]], [2.6, [['coil', 2], ['sweep', 1.5], ['strike', 1]]], [0, [['sweep', 2.5], ['jabs', 2], ['coil', 1]]]],
    combos: { jabs: ['sweep', 0.3] },
  },
  scorpion: {
    name: 'THE SCORPION OF THE RED ROCKS', kanji: '蠍', speedK: 1.0, rest: [1.0, 1.7],
    moves: {
      pincer: B('sweep', { dmg: 20, pp: 20, bc: 26 }),
      crush: B('chop', { dmg: 30, pp: 30, bc: 36, impact: BEAR_ATK.chop.impact }),
      sting: { custom: 'sting', unblock: true, knock: true, dmg: 26, tell: 0.1, hits: [[0.95, 1.2, { reach: 6, arc: 0.35 }]], dur: 1.9 },
      dash: B('charge', { dmg: 24, windup: 0.6, run: 1.4, speed: 11, maxDist: 12, windClip: 'bear:roar', windAt: 1.0, runClip: 'ronin:run', runSnd: 'scorpionClick' }),
      trick: { custom: 'trick', hits: [], dmg: 0, dur: 0.9 },
    },
    bands: [[6, [['dash', 2.5], ['sting', 2], ['trick', 1]]], [3, [['sting', 2], ['pincer', 1.5], ['trick', 1.2], ['dash', 0.8]]], [0, [['pincer', 2.6], ['crush', 1.8], ['sting', 1.2], ['trick', 1.2]]]],
    combos: { pincer: ['crush', 0.35], trick: ['pincer', 1] },
  },
};
// E9: the four Legends, ink vortex forms of the gang body, one guarding each vortex cairn
export const LEGENDS = {
  javelina: {
    id: 'legend', variant: 'javelina', cast: 'gang', hp: 420, posture: 100, speed: 4.4, idle: 'gabe:idle', rest: [0.9, 1.6], boss: true, legend: true, radius: 0.6,
    name: 'THE JAVELINA', kanji: '猪', mark: 'tusks',
    moves: { charge: B('charge', { dmg: 26, speed: 10, maxDist: 12, windClip: 'bear:roar', runClip: 'bear:charge' }), sweep: B('sweep'), smash: B('smash') },
    bands: [[7, [['charge', 3]]], [3.5, [['charge', 1.6], ['sweep', 1.6]]], [0, [['sweep', 2.5], ['smash', 2]]]], combos: { sweep: ['smash', 0.4] }, reach: 3,
  },
  vulture: {
    id: 'legend', variant: 'vulture', cast: 'gang', hp: 380, posture: 100, speed: 4.2, idle: 'gabe:idle', rest: [1.0, 1.7], boss: true, legend: true,
    name: 'THE VULTURE', kanji: '鷲', mark: 'wings',
    moves: { fly: G('fly', { leapMax: 9, leapH: 2.2 }), kick: G('kick'), jabs: G('jabs'), grab: G('grab', { grab: true }) },
    bands: [[6, [['fly', 3], ['kick', 0.5]]], [3, [['fly', 1.5], ['kick', 2]]], [0, [['jabs', 2.5], ['kick', 1.3], ['grab', 1]]]], combos: { jabs: ['kick', 0.35] }, reach: 3,
  },
  gila: {
    id: 'legend', variant: 'gila', cast: 'gang', hp: 480, posture: 110, speed: 3.2, idle: 'gabe:idle', rest: [1.2, 2.0], boss: true, legend: true, radius: 0.6,
    name: 'THE GILA', kanji: '蜥', mark: 'spots',
    moves: { slam: B('slam'), chop: B('chop'), smash: B('smash') },
    bands: [[4, [['chop', 2.5], ['slam', 1]]], [0, [['slam', 2], ['smash', 2], ['chop', 1.2]]]], combos: { chop: ['slam', 0.35] }, reach: 3,
  },
  tarantula: {
    id: 'legend', variant: 'tarantula', cast: 'gang', hp: 400, posture: 100, speed: 4.6, idle: 'gabe:idle', rest: [0.9, 1.5], boss: true, legend: true,
    name: 'THE TARANTULA', kanji: '蛛', mark: 'legs',
    moves: { jabs: G('jabs'), counter: G('counter'), grab: G('grab', { grab: true }), kick: G('kick') },
    bands: [[4, [['kick', 2.5], ['jabs', 1]]], [0, [['jabs', 3], ['grab', 1.5], ['counter', 1]]]], combos: { jabs: ['jabs', 0.35] }, counterRate: 0.8, reach: 2.6,
  },
};

/* ---------------- props the gang carries (not in the cast's prop list) ---------------- */
const batMat = new THREE.MeshToonMaterial({ color: 0x6b4a33, gradientMap: toonRamp });
const gripMat = new THREE.MeshToonMaterial({ color: 0x1c1c1e, gradientMap: toonRamp });
const batGeo = new THREE.CylinderGeometry(0.036, 0.018, 0.84, 10); batGeo.translate(0, 0.42, 0);
const gripGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8); gripGeo.translate(0, 0.02, 0);
function makeBat() { const g = new THREE.Group(); const b = new THREE.Mesh(batGeo, batMat); b.castShadow = true; g.add(b); g.add(new THREE.Mesh(gripGeo, gripMat)); g.name = 'prop:bat'; return g; }
const chainMat = new THREE.MeshToonMaterial({ color: 0x7c8086, gradientMap: toonRamp });
const linkGeo = new THREE.TorusGeometry(0.03, 0.009, 4, 8);
function makeChain() {
  const g = new THREE.Group(); g.name = 'prop:chain';
  for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(linkGeo, chainMat); l.position.y = 0.05 + i * 0.05; l.rotation.y = i % 2 ? Math.PI / 2 : 0; g.add(l); }
  return g;
}

export function createFoes(K) {
  const { S } = K;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const defOf = (foeId, variant) => (foeId === 'legend' ? LEGENDS[variant] : FOES[foeId]);

  // a prop held in the right hand with the bone's scale undone (the makeKatana pattern); re-held when the
  // real body arrives in place of the placeholder
  function hold(f) {
    if (!f.propObj || !f.a) return;
    const hand = f.a.bone && f.a.bone('RightHand');
    if (!hand) { if (f.propObj.parent !== f.a.root) { f.a.root.add(f.propObj); f.propObj.position.set(0.25, 1.0, 0.15); f.propObj.scale.setScalar(1); } return; }
    if (f.propObj.parent === hand) return;
    f.a.root.updateMatrixWorld(true);
    const ws = new THREE.Vector3(); hand.getWorldScale(ws); const rs = new THREE.Vector3(); f.a.root.getWorldScale(rs);
    const k = rs.x / ws.x;
    f.propObj.scale.setScalar(k); f.propObj.position.set(0, 0.07 * k, 0.02 * k); f.propObj.rotation.set(Math.PI / 2, 0, 0);
    hand.add(f.propObj);
  }
  function arm(f, weapon) {
    if (weapon === 'bat') f.propObj = makeBat();
    else if (weapon === 'chain') { f.propObj = makeChain(); f.propObj.visible = false; }
    else if (weapon === 'cane') { f.caneProp = S.cast.props.attach(f.a, 'cane', 'RightHand', { rot: [Math.PI, 0, 0] }); }
    else if (weapon && S.cast.props.names && S.cast.props.names.includes(weapon)) S.cast.props.attach(f.a, weapon);
    hold(f);
  }
  // the tell: a neon glow on the striking limb (neon means danger)
  function glowOf(f) {
    if (f.glowS) return f.glowS;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: NEON.tell, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 }));
    s.scale.setScalar(0.34); s.renderOrder = 5; S.world.group.add(s); f.glowS = s;
    return s;
  }

  /* ---------------- spawn ---------------- */
  function spawn(foeId, o = {}) {
    if (!FOE_IDS.includes(foeId)) throw new Error(`S.combat.spawn: unknown foe '${foeId}'`);
    if (foeId === 'legend' && !LEGEND_IDS.includes(o.variant)) throw new Error(`S.combat.spawn: a legend needs a variant (${LEGEND_IDS.join(', ')}), not '${o.variant}'`);
    const def = defOf(foeId, o.variant);
    const H = S.hero;
    let at = o.place ? S.world.place(o.place) : o.pos || null;
    if (!at) { const a = K.rand(0, Math.PI * 2); at = { x: H.pos.x + Math.sin(a) * 6, z: H.pos.z + Math.cos(a) * 6 }; }
    const yHint = at.y != null ? at.y + 0.5 : H.pos.y + 3;
    const y = S.world.surface(at.x, at.z, Number.isFinite(yHint) ? yHint : Infinity);
    const yaw = o.yaw ?? at.yaw ?? angleTo(at, H.pos);
    const f = makeFighter({ team: 'foe', def: { ...def, variant: o.variant || null }, hp: def.hp, posture: def.posture, face: yaw, group: o.group || 'main', alert: o.alert ?? true, boss: !!def.boss, radius: def.radius ?? 0.5, name: def.name || '', kanji: def.kanji || '' });
    f.id = `${def.variant || def.id}${++K.seq}`;
    f.pos.set(at.x, y, at.z);
    f.moves = def.moves; f.bands = def.bands; f.combos = def.combos || {}; f.rest = def.rest; f.speed = def.speed; f.idleClip = def.idle;
    f.counterRate = def.counterRate || 0; f.legend = !!def.legend; f.phase2Pending = !!def.phase2;
    f.cooldown = K.arand(0.6, 1.4); f.ringR = K.arand(3.6, 5.8); f.strafe = K.aiRand() < 0.5 ? -1 : 1;
    f.patrol = o.patrol && PATROLS[o.patrol] ? PATROLS[o.patrol] : null; f.patrolI = 0; f.flashlight = !!o.flashlight;
    f.home = new THREE.Vector3(at.x, y, at.z); f.homeYaw = yaw;
    const a = f.a = S.cast.spawn(def.cast, { pos: { x: at.x, y, z: at.z }, yaw });
    a.useCdt = true;
    arm(f, o.weapon || def.weapon);
    if (f.flashlight) K.stealth.flashlight(f, true);
    if (f.legend) { f.ink = true; S.cast.inkShadow(a, 1); K.bosses.legendMarks(f); }
    a.play(f.alert ? f.idleClip : 'idle', { fade: 0 });
    f.state = f.alert ? 'idle' : 'calm';
    K.enemies.push(f);
    if (f.boss) { K.combat.boss = f; if (S.ui && S.ui.boss) S.ui.boss(f); }
    K.emit('spawn', f);
    return f;
  }
  function despawn(f) {
    if (f.glowS) { f.glowS.removeFromParent(); f.glowS.material.dispose(); f.glowS = null; }
    if (f.propObj) { f.propObj.removeFromParent(); f.propObj = null; }
    K.stealth.unwatch(f); K.stealth.flashlight(f, false);
    K.bosses.release(f);
    S.interact.remove(`tie:${f.id}`);
    if (f.a) S.cast.despawn(f.a);
    f.gone = true;
  }

  /* ---------------- choosing a move (chooseAttack) ---------------- */
  function chooseAttack(f, d) {
    let opts = null;
    for (const [min, list] of f.bands) if (d > min) { opts = list.map(([n, w]) => [n, w]); break; }
    if (!opts) opts = f.bands[f.bands.length - 1][1].map(([n, w]) => [n, w]);
    for (const o of opts) { if (o[0] === f.last) o[1] *= 0.35; if (o[0] === f.last && o[0] === f.lastLast) o[1] = 0.01; }
    let r = K.aiRand() * opts.reduce((a, o) => a + o[1], 0), pick = opts[0][0];
    for (const o of opts) { r -= o[1]; if (r <= 0) { pick = o[0]; break; } }
    const q = [pick], c = f.combos[pick];
    if (c && K.aiRand() < c[1] && f.moves[c[0]]) q.push(c[0]);
    f.lastLast = f.last; f.last = pick;
    return q;
  }
  function begin(f, name) { const spec = f.moves[name]; if (!spec) return false; if (spec.custom) K.bosses.startCustom(f, name, spec); else startAttack(K, f, name, spec); if (f.token) f.usedToken = true; return true; }
  K.beginMove = begin;

  /* ---------------- the brain and the body (updateBoss, per enemy) ---------------- */
  function update(f, dt) {
    if (f.gone) return;
    const H = S.hero, A = f.a;
    const toP = angleTo(f.pos, H.pos), dist = flatDist(f.pos, H.pos) - f.radius;
    const heroOut = H.mode !== 'foot' || H.hp <= 0;
    f.t += dt; f.nextHit = null; f.dodging = false; f.clipT = 0;
    decayPosture(f, dt);
    let move = 0, moveDir = f.face, glowWant = 0, limbOn = null;
    switch (f.state) {
      case 'calm': case 'search':
        if (f.alert) { f.state = 'idle'; f.t = 0; f.cooldown = Math.max(f.cooldown, 0.6); break; } // told to fight
        K.stealth.patrol(f, dt); move = f.walk || 0; moveDir = f.walkDir ?? f.face; break;
      case 'idle': {
        if (K.bosses.check(f)) break;
        if (heroOut) { A.play(f.idleClip, { fade: 0.3 }); f.cooldown = Math.max(f.cooldown, 0.8); if (dist < 3) { move = -1.2; } break; }
        turn(f, toP, f.boss ? 4.2 : 5, dt);
        f.cooldown -= dt;
        const canAct = f.boss || f.token;
        // reading the hero's swing: slip it and counter (the arena's Gabe rule)
        if (f.counterRate && f.moves.counter && H.state === 'attack' && dist < 3 && f.cooldown < 0.8 && K.aiRand() < dt * f.counterRate && (f.boss || f.token)) { f.queue = []; begin(f, 'counter'); break; }
        if (canAct) {
          const reach = (f.phaseDef ? 4 : f.def.reach || 2.6);
          if (dist > reach + 1.2) move = f.speed * (f.speedK || 1);
          else if (dist < 1.2) move = -1.2;
          else { f.strafeT -= dt; if (f.strafeT <= 0) { f.strafe = K.aiRand() < 0.5 ? -1 : 1; f.strafeT = K.arand(0.8, 1.8); } move = 1.2; moveDir = f.face + f.strafe * Math.PI / 2; }
          if (f.cooldown <= 0 && (dist <= reach + 1.5 || f.boss)) { f.queue = chooseAttack(f, dist); begin(f, f.queue.shift()); break; }
        } else {
          // no token: hold the ring, strafe, and now and then a taunt
          const rx = H.pos.x + Math.sin(f.ring) * f.ringR, rz = H.pos.z + Math.cos(f.ring) * f.ringR;
          const toRing = Math.atan2(rx - f.pos.x, rz - f.pos.z), dr = Math.hypot(rx - f.pos.x, rz - f.pos.z);
          if (dist < 3.5) { move = -2.2; }
          else if (dr > 1.2) { move = Math.min(f.speed, 1 + dr * 0.8); moveDir = toRing; }
          else { f.strafeT -= dt; if (f.strafeT <= 0) { f.strafe = K.aiRand() < 0.5 ? -1 : 1; f.strafeT = K.arand(1.0, 2.2); if (K.aiRand() < 0.12) { f.state = 'taunt'; f.t = 0; A.play('gabe:taunt', { loop: false, speed: 1.3, fade: 0.2, restart: true, at: 1.2 }); break; } } move = 1.1; moveDir = f.face + f.strafe * Math.PI / 2; }
        }
        A.play(f.idleClip, { fade: 0.2 });
        break;
      }
      case 'taunt': turn(f, toP, 3, dt); if (f.t > 1.6 || dist < 2.5) { f.state = 'idle'; f.t = 0; } break;
      case 'attack': {
        const s = f.atk.spec;
        limbOn = s.limb;
        if (s.custom) { move = K.bosses.stepCustom(f, dt) || 0; glowWant = 1.2; break; }
        if (s.charge) { stepCharge(K, f, dt, H, onHit); glowWant = 1.6; break; }
        move = stepAttack(K, f, dt, H, onHit);
        if (s.lash && f.propObj) f.propObj.visible = f.state === 'attack' && f.clipT > (s.tell || 0) - 0.2;
        if (f.state === 'attack' && f.clipT >= (s.tell ?? 0) && f.clipT <= s.hits[s.hits.length - 1][1] + 0.1) glowWant = 2.2;
        break;
      }
      case 'grabHold': {
        // the hero is lifted, then thrown down (the arena's grab)
        const spec = f.atk ? f.atk.spec : f.moves.grab, ct = (spec.from || 0) + A.t, throwAt = spec.throwAt ?? GABE_ATK.grab.throwAt;
        const hand = A.bone && A.bone('RightHand');
        if (ct < throwAt && hand) {
          const paw = hand.getWorldPosition(tmp);
          H.pos.set(paw.x, H.pos.y, paw.z);
          if (H.actor) H.actor.root.position.set(paw.x, Math.max(K.groundAt(H.pos), paw.y - 1.5), paw.z);
          H.face = f.face + Math.PI;
        } else if (!f.thrown) {
          f.thrown = true;
          H.pos.x += Math.sin(f.face) * 2.5; H.pos.z += Math.cos(f.face) * 2.5; H.state = 'move';
          K.resolve.hurtHero(spec.dmg || 28, true, false, f);
          const g = K.groundAt(H.pos); K.fx.dust(K.at(H.pos.x, g, H.pos.z, g), 14, 1.4); K.sfx('slam', H.pos); K.cam.shake = 1;
        }
        if (A.done || f.t > 4) { if (H.state === 'grabbed') H.state = 'move'; f.state = 'idle'; f.t = 0; f.atk = null; f.cooldown = K.arand(...(f.rest || TUNE.rest)); }
        break;
      }
      case 'recoil': if (f.t > 0.75) { f.state = 'idle'; f.t = 0; f.cooldown = K.arand(0.3, 0.8); } break;
      case 'hit': if (f.t > 0.42) { f.state = 'idle'; f.t = 0; f.cooldown = Math.max(f.cooldown, 0.5); } break;
      case 'stagger': move = f.t < 0.6 ? -2.6 : 0; moveDir = toP; if (f.t > f.stunT) { f.state = 'idle'; f.t = 0; f.cooldown = 0.6; A.play(f.idleClip, { fade: 0.3 }); } break;
      case 'broken': if (f.t > (f.boss ? 3.6 : 2.4)) { f.state = 'recover'; f.t = 0; f.posture = f.maxPosture * 0.4; A.play(f.idleClip, { fade: 0.6 }); } break;
      case 'recover': if (f.t > (f.boss ? 1.2 : 0.8)) { f.state = 'idle'; f.t = 0; f.cooldown = 0.5; } break;
      case 'dive': move = 5.5; moveDir = f.diveDir; if (f.t > 0.4) { f.state = f.alert ? 'idle' : 'calm'; f.t = 0; } break;
      case 'down':
        if (f.t > 1.55 && A.cur === 'lib:knock') A.play('lib:dazed', { fade: 0.4 });
        break;
      case 'phase': case 'vanish': K.bosses.stepState(f, dt); break;
    }
    if (move) {
      const px = f.pos.x, pz = f.pos.z;
      f.pos.x += Math.sin(moveDir) * move * dt; f.pos.z += Math.cos(moveDir) * move * dt;
      f.speedNow = Math.hypot(f.pos.x - px, f.pos.z - pz) / Math.max(dt, 1e-4);
    } else f.speedNow = 0;
    K.solid(f);
    if (K.arenaRing && !f.downed) { const c = K.arenaRing, dx = f.pos.x - c.x, dz = f.pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + 2; if (d > m) { f.pos.x = c.x + dx / d * m; f.pos.z = c.z + dz / d * m; } }
    f.flinch = Math.max(0, f.flinch - dt * 5);
    f.glow = damp(f.glow, glowWant, 10, dt);
    const idleLike = f.state === 'idle' || f.state === 'calm' || f.state === 'search' || f.state === 'stagger' || f.state === 'dive' || f.state === 'taunt';
    if (idleLike) mv(A, f.speedNow, { upper: f.state === 'calm' || f.state === 'search', turn: 0 });
    else mv(A, 0);
    sync(f, dt);
    // the tell glow on the striking limb
    const s = glowOf(f), limb = limbOn && A.bone && A.bone(limbOn);
    if (limb && f.glow > 0.05) { limb.getWorldPosition(s.position); s.material.opacity = Math.min(0.85, f.glow * 0.4); s.visible = true; }
    else s.visible = false;
  }
  function onHit(f, i) { K.resolve.receive(f, i); }
  function sync(f, dt) {
    const A = f.a; if (!A) return;
    f.pos.y = S.world.surface(f.pos.x, f.pos.z, (Number.isFinite(f.pos.y) ? f.pos.y : 0) + 0.6);
    f.yaw = dt ? f.yaw + angDiff(f.yaw, f.face) * Math.min(1, dt * 14) : f.face;
    A.root.position.set(f.pos.x, f.pos.y + f.air, f.pos.z);
    A.root.rotation.set(0, f.yaw, 0);
    if (f.propObj) hold(f);
  }
  // a vehicle asks the foe to dive out of its path
  function diveOf(f) {
    return (dir) => {
      if (f.downed || f.gone || f.state === 'grabHold' || f.state === 'attack' || f.state === 'phase') return false;
      if (f.state !== 'dive') { f.prevState = f.state; f.state = 'dive'; f.t = 0; f.diveDir = Math.atan2(dir.x, dir.z); f.atk = null; }
      return true;
    };
  }
  function people() {
    if (!S.vehicles || !S.vehicles.people || !S.world.visible) return;
    for (const f of K.enemies) {
      if (f.gone) continue;
      if (!f.circle) f.circle = { x: 0, z: 0, r: 0.5, id: f.id, dive: diveOf(f) };
      f.circle.x = f.pos.x; f.circle.z = f.pos.z;
      S.vehicles.people.push(f.circle);
    }
  }
  // clones of ink burst at a touch
  function vanish(f, hit) {
    const g = K.groundAt(f.pos), p = K.at(f.pos.x, g + 1.2, f.pos.z, g);
    K.fx.ink(p, 24, 1.4, 1); K.fx.neon(p, 16, 1); K.sfx('scorpionClick', f.pos);
    if (hit) K.toast('A CLONE OF INK');
    despawn(f);
    const i = K.enemies.indexOf(f); if (i >= 0) K.enemies.splice(i, 1);
    if (K.lock === f) K.tokens.retarget();
  }
  return { spawn, despawn, update, people, vanish, sync, begin, chooseAttack, defOf };
}
