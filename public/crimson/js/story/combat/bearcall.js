// js/story/combat/bearcall.js : the Bear Call (COMBAT spec 8, design 4.2). G, once S.flags.bearCall is set
// (P5: "People run from bears."). The hero pulls Gabe's PVC pipe and roars down it: Gabe's 'call' cut
// retargeted on the crew body, the pipe held at the mouth, neon rings out along an 8 m cone of 0.42 rad
// (updatePipe ported, with a fixed pool of rings: nothing is made per ring). Grunts in the cone stagger
// for 2.5 s; bosses take 20 posture. 40 s to recharge.
import * as THREE from 'three';
import { GABE_ATK } from '../../moves.js';
import { NEON } from '../look/palette.js';
import { angDiff, angleTo, flatDist, breakPosture } from './fighter.js';

export const CALL = Object.freeze({ reach: 8, arc: 0.42, stagger: 2.5, posture: 20, cooldown: 40 });
const SPEC = GABE_ATK.call; // from 1.6: pipe [1.85, 3.4], blow [2.3, 3.05]
const POOL = 14;

export function createBearCall(K) {
  const { S } = K;
  const UP = new THREE.Vector3(0, 1, 0), ZF = new THREE.Vector3(0, 0, 1);
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3(), dir = new THREE.Vector3();
  let pipe = null, ready = 0, waveT = 0, hitDone = false, pvc = false;
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(1, 0.05, 6, 36);
  function build() {
    if (pipe) return;
    pipe = S.cast.props.make('pvcPipe'); pipe.visible = false; S.world.group.add(pipe);
    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.neon).multiplyScalar(1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false; m.userData = { v: new THREE.Vector3(), age: 9 }; S.world.group.add(m); rings.push(m);
    }
  }
  const unlocked = () => !!S.flags.bearCall; // MISSIONS sets the flag (P5, and from the save's abilities)
  const B = {
    get cooldown() { return Math.max(0, ready - S.time); },
    get ready() { return unlocked() && S.time >= ready; },
    get unlocked() { return unlocked(); },
    // G on foot: start the call if it is unlocked and charged
    tryCall() {
      const I = S.input, H = S.hero;
      if (!I.pressed('bearcall')) return false;
      I.consume('bearcall');
      if (!unlocked()) return false;
      if (S.time < ready) { K.toast(`THE PIPE IS READY IN ${Math.ceil(ready - S.time)} S`); return false; }
      if (H.state !== 'move' && H.state !== 'guard' && H.state !== 'dodge') return false;
      build();
      const t = K.lock && !K.lock.downed ? K.lock : K.tokens.softAim(H.pos, H.face, 10, 1.2);
      if (t) H.face = angleTo(H.pos, t.pos);
      H.state = 'call'; H.t = 0; H.atk = null; hitDone = false; waveT = 0;
      if (H.actor) H.actor.play('gabe:call', { loop: false, speed: SPEC.speed, fade: 0.12, restart: true });
      ready = S.time + CALL.cooldown;
      K.emit('bearCall', H);
      return true;
    },
    // the hero's call, step by step: the pipe, the blow and the rings, the effect on everyone in the cone
    stepHero(dt) {
      const H = S.hero, a = H.actor, ct = SPEC.from + (a ? a.t : 0);
      const on = ct >= SPEC.pipe[0] && ct <= SPEC.pipe[1];
      if (on && !pvc) { pvc = true; K.sfx('pvc', H.pos); }
      if (!on) pvc = false;
      pipe.visible = on;
      if (on) {
        const head = a.bone && a.bone('Head') ? a.bone('Head').getWorldPosition(tA) : tA.set(H.pos.x, H.pos.y + 1.65, H.pos.z);
        const fwd = tB.set(Math.sin(H.face), 0, Math.cos(H.face));
        const mouth = tC.copy(head).addScaledVector(fwd, 0.14); mouth.y += 0.02;
        dir.copy(fwd).addScaledVector(tA.set(-fwd.z, 0, fwd.x), -0.3).setY(-0.35).normalize();
        const grow = Math.min(1, (ct - SPEC.pipe[0]) / 0.22), len = 1.0 * grow;
        pipe.position.copy(mouth).addScaledVector(dir, 0.25 * grow); pipe.quaternion.setFromUnitVectors(UP, dir); pipe.scale.set(1, Math.max(0.01, grow), 1);
        if (ct >= SPEC.blow[0] && ct <= SPEC.blow[1]) {
          if (!H.roared) { H.roared = true; K.sfx('pipe', H.pos); }
          waveT -= dt;
          if (waveT <= 0) {
            waveT = 0.07;
            const m = rings.find((r) => r.userData.age > 0.6) || rings[0];
            m.position.copy(mouth).addScaledVector(dir, len); m.quaternion.setFromUnitVectors(ZF, dir);
            m.userData.v.copy(dir).setY(0).normalize().multiplyScalar(13); m.userData.age = 0; m.visible = true;
            K.cam.shake = Math.max(K.cam.shake, 0.25);
          }
          if (!hitDone && ct >= SPEC.hits[0][0]) { hitDone = true; blast(H); }
        }
      }
      if (a && a.done) { H.state = 'move'; H.t = 0; H.roared = false; pipe.visible = false; }
    },
    update(dt) {
      for (const m of rings) {
        const u = m.userData; if (u.age > 0.6) { m.visible = false; continue; }
        u.age += dt; m.position.addScaledVector(u.v, dt);
        const r = 0.15 + u.age * 4.2; m.scale.set(r, r, 1);
        m.material.opacity = Math.max(0, 1 - u.age / 0.6);
      }
    },
    reset() { ready = 0; if (pipe) pipe.visible = false; for (const m of rings) { m.visible = false; m.userData.age = 9; } },
  };
  // everyone in the cone: grunts stagger, bosses take posture; watchers who hear it run from the bear
  function blast(H) {
    let n = 0;
    for (const f of K.enemies) {
      if (f.downed || f.gone || f.tied) continue;
      const d = flatDist(H.pos, f.pos) - f.radius;
      if (d > CALL.reach || Math.abs(angDiff(H.face, angleTo(H.pos, f.pos))) > CALL.arc) continue;
      n++;
      if (f.boss) { f.posture = Math.min(f.maxPosture, f.posture + CALL.posture); f.postureT = 0; if (f.posture >= f.maxPosture && f.state !== 'broken') breakPosture(K, f); }
      else {
        f.state = 'stagger'; f.t = 0; f.stunT = CALL.stagger; f.atk = null; f.queue = []; f.alert = true;
        if (f.a) f.a.play('gabe:hit', { loop: false, speed: 0.6, fade: 0.1, restart: true });
      }
    }
    if (n) K.toast('THE BEAR ROARS', true);
    K.emit('bearCallHit', { count: n });
  }
  return B;
}
