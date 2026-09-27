// js/story/combat/bosses.js : Rattler, Voss, Boone and the Legends (COMBAT spec 6, design 4.2, E9).
// - Phase two at half life: 'bossPhase' fires first (a listener may cancel it: F3 ends Rattler's fight at
//   half with the lights out), then the vortex: S.look.vortex(true), the body turns to ink
//   (S.cast.inkShadow) and shows its animal in neon (S.cast.vortexParts), with a new move table.
// - THE RATTLESNAKE: coil (1.0 s when blows slip off), a 7 m leaping strike (unblockable; the rattle sounds
//   0.6 s before), a coil sweep (area 4 m, knockdown), speed x1.1.
// - THE SCORPION OF THE RED ROCKS: pincer sweeps and a crush (the bear's clips), a tail sting (unblockable,
//   a 6 m cone of 0.35 rad, driven through vortexParts.set), a dash (the bear's charge with 12 m at most and
//   a stop at walls), a trick step (gone in ink, back behind the hero; the tell is a neon eye blink and a
//   click), and 2 ink clones with 1 life, at 60% and 30% of the second phase.
// - A boss at 0 is down (the finisher: 'finisher' fires; MISSIONS plays the crew cine); hold E for 1 s to
//   zip-tie it.
// - The Legends are ink from the start, with neon marks built here: tusks, wings, spots, legs.
import * as THREE from 'three';
import { NEON } from '../look/palette.js';
import { glowTex } from '../../fx.js';
import { PHASE2 } from './foes.js';
import { startAttack, endAttack, turn, angDiff, angleTo, flatDist } from './fighter.js';

export function createBosses(K) {
  const { S } = K;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const neonMat = () => new THREE.MeshBasicMaterial({ color: NEON.neon, fog: false });

  /* ---------------- phase two ---------------- */
  function check(f) {
    if (!f.boss || !f.phase2Pending || f.hp > f.maxHp * 0.5) return false;
    f.phase2Pending = false;
    let cancelled = false;
    K.emit('bossPhase', { f, phase: 2, cancel: () => { cancelled = true; } });
    if (cancelled || f.def.phase2 === false || f.noPhase2 || f.gone) return false;
    f.state = 'phase'; f.t = 0; f.atk = null; f.queue = []; f.invuln = true; f.phase = 2;
    if (f.a) f.a.play('gabe:taunt', { loop: false, speed: 1.4, fade: 0.2, restart: true, at: 1.4 });
    K.sfx('growl', f.pos); K.sfx('surge', f.pos);
    S.look.vortex(true, 1.2);
    K.vortexOn = true;
    return true;
  }
  function stepState(f, dt) {
    if (f.state === 'phase') {
      const k = Math.min(1, f.t / 1.2);
      turn(f, angleTo(f.pos, S.hero.pos), 2, dt);
      S.cast.inkShadow(f.a, k); f.ink = k > 0.5;
      if (!f.parts && f.a && f.a.bone && f.a.bone('Hips')) f.parts = S.cast.vortexParts(f.a, f.def.phase2);
      if (f.t > 0.6 && !f.flashed) {
        f.flashed = true;
        const g = K.groundAt(f.pos), c = K.at(f.pos.x, g + 1.4, f.pos.z, g);
        K.flash(1); S.hitstop = Math.max(S.hitstop, 0.2); S.slow = 0.35; S.slowT = 1.1; K.cam.punch = 1.6; K.cam.shake = 1.4;
        K.fx.flash(c, 5, 0.5); K.fx.neon(c, 80, 2); K.fx.ink(c, 40, 2.2, 1.2); K.fx.blast(f.pos, 2); K.fx.ring(K.at(f.pos.x, g, f.pos.z, g), 10, 0.9); K.fx.splat(f.pos, 4, g);
        K.sfx('tear', f.pos); K.sfx('roar', f.pos);
        const P = PHASE2[f.def.phase2];
        f.phaseDef = P; f.moves = P.moves; f.bands = P.bands; f.combos = P.combos || {}; f.rest = P.rest; f.speedK = P.speedK || 1;
        f.name = P.name; f.kanji = P.kanji; f.last = f.lastLast = '';
        if (S.ui && S.ui.boss) S.ui.boss(f);
        if (S.ui && S.ui.card) S.ui.toast(`${P.name} ${P.kanji}`, true);
        f.phase2Hp = f.hp; f.clonesAt = [0.6, 0.3];
      }
      if (f.t > 1.8) { f.state = 'idle'; f.t = 0; f.cooldown = 0.5; f.invuln = false; f.posture = 0; K.emit('bossPhaseDone', f); }
      return;
    }
    if (f.state === 'vanish') stepTrick(f, dt);
  }
  // clones at 60% and 30% of the second phase's life
  function clones(f) {
    if (!f.clonesAt || !f.clonesAt.length || f.def.phase2 !== 'scorpion') return;
    if (f.hp > f.phase2Hp * f.clonesAt[0]) return;
    f.clonesAt.shift();
    const H = S.hero, a0 = angleTo(H.pos, f.pos) + (K.aiRand() < 0.5 ? 1.6 : -1.6);
    const c = K.foes.spawn('voss', { pos: { x: H.pos.x + Math.sin(a0) * 5, z: H.pos.z + Math.cos(a0) * 5 }, group: f.group });
    Object.assign(c, { boss: false, clone: true, hp: 1, maxHp: 1, phase2Pending: false, name: '', ink: true, phaseDef: PHASE2.scorpion, moves: { pincer: PHASE2.scorpion.moves.pincer }, bands: [[0, [['pincer', 1]]]], combos: {}, rest: [1.4, 2.2], counterRate: 0 });
    K.combat.boss = f; if (S.ui && S.ui.boss) S.ui.boss(f);
    S.cast.inkShadow(c.a, 1);
    const g = K.groundAt(c.pos); K.fx.ink(K.at(c.pos.x, g + 1.2, c.pos.z, g), 30, 1.6, 1); K.sfx('scorpionClick', c.pos);
    K.toast('THE SCORPION SPLITS', true);
  }

  /* ---------------- custom moves ---------------- */
  function startCustom(f, name, spec) {
    f.state = 'attack'; f.t = 0; f.atk = { name, spec }; f.hitsDone = new Set(); f.snd = new Set(); f.told = false; f.air = 0;
    if (spec.unblock) K.danger(f);
    if (spec.custom === 'coil') { f.a.play('lib:crouch', { fade: 0.2 }); K.sfx('rattle', f.pos, { dur: 0.5 }); }
    else if (spec.custom === 'sting') { f.a.play('bear:roar', { loop: false, speed: 1.3, fade: 0.2, restart: true, at: 0.8 }); K.sfx('scorpionClick', f.pos); }
    else if (spec.custom === 'trick') { f.state = 'vanish'; f.t = 0; f.invuln = true; }
  }
  // returns the forward speed the move wants
  function stepCustom(f, dt) {
    const s = f.atk.spec, H = S.hero;
    const toH = angleTo(f.pos, H.pos);
    f.clipT = f.t;
    if (s.custom === 'coil') {
      // coiled: blows slip off for 1.0 s, then the strike
      f.dodging = f.t < s.dur;
      turn(f, toH, 5, dt);
      if (f.t >= s.dur) { f.dodging = false; startAttack(K, f, 'strike', f.moves.strike); if (f.token) f.usedToken = true; }
      return 0;
    }
    if (s.custom === 'sting') {
      if (f.t < 0.8) turn(f, toH, 3.5, dt);
      f.nextHit = f.hitsDone.has(0) ? null : s.hits[0][0];
      if (f.t > 0.35 && !f.told) { f.told = true; K.sfx('scorpionClick', f.pos); }
      const [t0, t1, sh] = s.hits[0];
      if (!f.hitsDone.has(0) && f.t >= t0 && f.t <= t1) {
        const d = flatDist(f.pos, H.pos) - H.radius, off = Math.abs(angDiff(f.face, angleTo(f.pos, H.pos)));
        if (d <= sh.reach && off <= sh.arc && H.state !== 'downed' && H.state !== 'grabbed') { f.hitsDone.add(0); K.resolve.receive(f, 0); }
        if (!f.stingFx) { f.stingFx = true; const tip = f.parts && f.parts.tip ? f.parts.tip.getWorldPosition(tmp) : tmp.set(f.pos.x, f.pos.y + 1.6, f.pos.z); K.fx.neon(K.at(tip.x + Math.sin(f.face) * 2, tip.y, tip.z + Math.cos(f.face) * 2, K.groundAt(f.pos)), 20, 0.8); K.sfx('bossSwing', f.pos); }
      } else if (f.t > t1) f.hitsDone.add(0);
      if (f.t >= s.dur) { f.stingFx = false; endAttack(K, f); }
      return 0;
    }
    endAttack(K, f);
    return 0;
  }
  // the trick step: gone in ink, a click and a neon blink, back behind the hero, then a pincer
  function stepTrick(f, dt) {
    const H = S.hero, a = f.a;
    if (f.t < 0.3) { if (!f.inked) { f.inked = true; const g = K.groundAt(f.pos); K.fx.ink(K.at(f.pos.x, g + 1.1, f.pos.z, g), 30, 1.3, 1); K.sfx('scorpionClick', f.pos); } return; }
    if (a.visible && f.t < 0.6) { a.visible = false; if (f.inkEyeBlink == null) f.inkEyeBlink = 0; }
    if (f.t >= 0.6 && !a.visible) {
      const bx = H.pos.x - Math.sin(H.face) * 2.2, bz = H.pos.z - Math.cos(H.face) * 2.2;
      f.pos.set(bx, S.world.surface(bx, bz, H.pos.y + 1), bz); K.solid(f);
      f.face = f.yaw = angleTo(f.pos, H.pos);
      a.visible = true; f.inked = false;
      const g = K.groundAt(f.pos); K.fx.ink(K.at(f.pos.x, g + 1.1, f.pos.z, g), 24, 1.1, 1); K.sfx('scorpionClick', f.pos);
      // the tell: the neon eyes blink bright
      if (a.inkEyes) for (const s of a.inkEyes) s.material.opacity = 1;
      f.invuln = false;
      f.state = 'idle'; f.t = 0; f.cooldown = 0;
      f.queue = []; K.beginMove(f, 'pincer');
    }
  }

  /* ---------------- the vortex parts, every frame ---------------- */
  function drive(f, dt) {
    if (!f.parts) {
      if (f.phase === 2 && f.def.phase2 && f.a && f.a.bone && f.a.bone('Hips')) f.parts = S.cast.vortexParts(f.a, f.def.phase2);
      return;
    }
    const s = f.atk && f.atk.spec, t = f.clipT;
    const st = f.vstate || (f.vstate = { curl: 0.3, strike: 0, rattle: 0, open: 0.3, aim: 0 });
    let curl = f.def.phase2 === 'scorpion' ? 0.6 : 0.25, strike = 0, rattle = 0, open = 0.3;
    if (s && s.custom === 'coil') { curl = 1; rattle = 0.4; }
    if (s && f.atk.name === 'strike') { rattle = t >= s.tell - 0.05 && t < s.hits[0][0] ? 1 : 0; curl = t < s.hits[0][0] ? 1 : 0.2; strike = t >= s.hits[0][0] - 0.1 && t <= s.hits[0][1] + 0.2 ? 1 : 0; }
    if (s && f.atk.name === 'sweep') strike = t >= s.hits[0][0] - 0.2 && t <= s.hits[0][1] ? 0.8 : 0;
    if (s && s.custom === 'sting') { curl = f.t < 0.9 ? 1 : 0.4; strike = f.t >= 0.85 && f.t <= 1.3 ? 1 : 0; }
    if (s && (f.atk.name === 'pincer' || f.atk.name === 'crush')) open = 0.9;
    const k = 1 - Math.exp(-dt * 14);
    st.curl += (curl - st.curl) * k; st.strike += (strike - st.strike) * Math.min(1, k * 1.6); st.rattle += (rattle - st.rattle) * k; st.open += (open - st.open) * k;
    f.parts.set(st);
  }

  /* ---------------- the Legends' neon marks ---------------- */
  // Built in world space and moved each frame from the body's bones (no bone-frame guesswork). Thin neon
  // strokes, like the ink forms' animal drawn in light: tusks (the javelina), feathers along the arms (the
  // vulture), beads down the body (the gila), six jointed legs (the tarantula), and two eyes for all.
  const unitRod = new THREE.CylinderGeometry(0.5, 0.5, 1, 5, 1, true); unitRod.translate(0, 0.5, 0);
  const tuskGeo = new THREE.ConeGeometry(0.035, 0.24, 6);
  function legendMarks(f) {
    const g = new THREE.Group(); g.name = `legend:${f.def.variant}`;
    const m = neonMat(), parts = [];
    const sprite = (size, op = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: NEON.neon, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: op })); s.scale.setScalar(size); g.add(s); return s; };
    const rod = (w) => { const r = new THREE.Mesh(unitRod, m); r.scale.set(w, 1, w); r.userData.w = w; g.add(r); return r; };
    if (f.def.mark === 'tusks') for (const sd of [-1, 1]) { const c = new THREE.Mesh(tuskGeo, m); g.add(c); parts.push({ o: c, bone: 'Head', side: sd, kind: 'tusk' }); }
    if (f.def.mark === 'wings') for (const sd of ['Left', 'Right']) for (let i = 0; i < 4; i++) parts.push({ o: rod(0.018), from: `${sd}Arm`, to: `${sd}Hand`, k: 0.15 + i * 0.28, len: 0.55 + i * 0.12, kind: 'feather' });
    if (f.def.mark === 'spots') for (const [bn, to] of [['Spine02', 'Spine01'], ['Spine01', 'Spine'], ['Spine', 'neck'], ['LeftArm', 'LeftForeArm'], ['RightArm', 'RightForeArm'], ['LeftForeArm', 'LeftHand'], ['RightForeArm', 'RightHand'], ['LeftUpLeg', 'LeftLeg'], ['RightUpLeg', 'RightLeg'], ['LeftLeg', 'LeftFoot'], ['RightLeg', 'RightFoot']]) for (const k of [0.3, 0.7]) for (const sd of [-1, 1]) parts.push({ o: sprite(0.13, 0.9), bone: bn, to, k, side: sd, kind: 'bead' });
    if (f.def.mark === 'legs') for (let i = 0; i < 6; i++) parts.push({ a: rod(0.022), b: rod(0.016), i, kind: 'leg' });
    for (const sd of [-1, 1]) parts.push({ o: sprite(0.12), bone: 'Head', side: sd, kind: 'eye' });
    S.world.group.add(g);
    f.marks = { g, parts };
  }
  const Y = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), tC = new THREE.Vector3(), tD = new THREE.Vector3(), tE = new THREE.Vector3();
  // stretch a unit rod from a to b
  function span(o, a, b) { tE.copy(b).sub(a); const L = tE.length(); o.position.copy(a); o.scale.set(o.userData.w, Math.max(0.01, L), o.userData.w); if (L > 1e-5) o.quaternion.setFromUnitVectors(Y, tE.multiplyScalar(1 / L)); }
  function driveMarks(f) {
    const M = f.marks; if (!M) return;
    const a = f.a, ready = !!(a.bone && a.bone('Hips'));
    M.g.visible = ready && a.visible && !f.gone && !a.lodHidden;
    if (!M.g.visible) return;
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw), rx = Math.cos(f.yaw), rz = -Math.sin(f.yaw);
    for (const p of M.parts) {
      if (p.kind === 'feather') {
        // a feather hangs back and down from a point along the arm, swept by how fast the arm moves
        a.bone(p.from).getWorldPosition(tmp); a.bone(p.to).getWorldPosition(tmp2);
        tC.copy(tmp).lerp(tmp2, p.k);
        tD.set(tC.x - fx * p.len * 0.55, tC.y - p.len * 0.8, tC.z - fz * p.len * 0.55);
        span(p.o, tC, tD);
        continue;
      }
      if (p.kind === 'leg') {
        // three legs a side from the chest: up and out to a knee, then down to the ground, walking
        a.bone('Spine01').getWorldPosition(tmp);
        const sd = p.i < 3 ? 1 : -1, row = (p.i % 3) - 1, ph = K.ct * (f.speedNow > 0.5 ? 11 : 3) + p.i * 2.1;
        const out = 0.55 + 0.1 * Math.abs(row), fw = row * 0.32;
        tC.set(tmp.x + rx * sd * out + fx * fw, tmp.y + 0.3 + Math.max(0, Math.sin(ph)) * 0.12, tmp.z + rz * sd * out + fz * fw);
        const reach = 1.15 + 0.1 * Math.abs(row), step = Math.sin(ph) * 0.14;
        tD.set(tmp.x + rx * sd * reach + fx * (fw * 1.6 + step), f.pos.y + 0.03 + f.air, tmp.z + rz * sd * reach + fz * (fw * 1.6 + step));
        span(p.a, tmp, tC); span(p.b, tC, tD);
        continue;
      }
      const b = a.bone(p.bone); if (!b) continue;
      b.getWorldPosition(tmp);
      if (p.kind === 'tusk') { p.o.position.set(tmp.x + fx * 0.14 + rx * 0.05 * p.side, tmp.y - 0.02, tmp.z + fz * 0.14 + rz * 0.05 * p.side); q.setFromUnitVectors(Y, tmp2.set(fx * 0.6 + rx * 0.2 * p.side, 0.75, fz * 0.6 + rz * 0.2 * p.side).normalize()); p.o.quaternion.copy(q); }
      else if (p.kind === 'eye') p.o.position.set(tmp.x + fx * 0.12 + rx * 0.035 * p.side, tmp.y + 0.03, tmp.z + fz * 0.12 + rz * 0.035 * p.side);
      else if (p.kind === 'bead') {
        // beads on the surface of the limb, front and back
        a.bone(p.to).getWorldPosition(tmp2); tC.copy(tmp).lerp(tmp2, p.k);
        const off = p.bone.startsWith('Spine') ? 0.14 : 0.08;
        p.o.position.set(tC.x + fx * off * p.side, tC.y, tC.z + fz * off * p.side);
      }
    }
  }

  /* ---------------- down and tied ---------------- */
  function downed(f) {
    if (!f.boss) return;
    S.interact.add({ id: `tie:${f.id}`, tag: 'combat', label: 'TIE UP', hold: 1, r: 2.4, mode: 'foot', pos: () => ({ x: f.pos.x, y: f.pos.y, z: f.pos.z }), when: () => f.downed && !f.tied && !f.gone, act: () => K.tie(f) });
  }
  function release(f) {
    if (f.marks) { f.marks.g.removeFromParent(); f.marks.g.traverse((o) => { if (o.material) o.material.dispose(); }); f.marks = null; } // the geometry is shared
    if (f.parts && f.a && !f.a.disposed && f.a.vortex) { for (const v of Object.values(f.a.vortex)) v.remove(); }
    f.parts = null;
    if (K.combat.boss === f) { K.combat.boss = null; if (S.ui && S.ui.boss) S.ui.boss(null); }
  }
  function update(f, dt) {
    if (f.gone) return;
    if (f.boss) clones(f);
    if (f.phase === 2 || f.parts) drive(f, dt);
    if (f.marks) driveMarks(f);
  }
  return { check, stepState, startCustom, stepCustom, legendMarks, downed, release, update };
}
