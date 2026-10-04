// In Full Swing: the camera for flat screens. A chase camera behind and above the hero, turned by the look input, that swings
// toward your travel while you swing and never goes inside a building; V (or the Y button, or the eye button) moves it to the
// hero's eyes and back. It drives camera.position and camera.quaternion in world space, so the camera is a child of the scene.
import * as THREE from "three";
import { COMFORT, FLATCAM } from "./config.js";

const DEG = Math.PI / 180;
const ARM = FLATCAM.arm;        // the spring arm, metres from the pivot
const ARM_FAST = 5.6;           // it lets out a little at speed
const PIVOT_UP = 0.25;          // the pivot sits this far above the chest
const PITCH_MIN = -60 * DEG, PITCH_MAX = 70 * DEG, PITCH_FP = 85 * DEG;
const PITCH0 = FLATCAM.pitch0; // the default view looks down at the chest from 1.2 m above it
const NEAR_HIT = 0.3;           // stays this far off a wall
const MIN_DIST = 0.35;          // never closer than this to the pivot: closer than about 1.2 m the camera is nearly in the head
const FADE_FROM = 1.5, FADE_TO = 0.8; // the hero fades out between these camera distances
const FLOOR = 0.35;             // never lower than this above the street
const FOLLOW_TAU = FLATCAM.followTau; // s, the swing toward your velocity
const HOLD_LOOK = FLATCAM.holdLook;   // s of no follow after a look input
const FOV_TP = [70, 88], FOV_FP = [75, 87], FOV_V = [15, 35]; // degrees at rest and at speed; the speeds (m/s) that span them
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createFlatCam(camera, city) {
  const E = new THREE.Euler(0, 0, 0, "YXZ");
  const HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null }, SPH = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 };
  const T = new THREE.Vector3(), EYE = new THREE.Vector3(), DIR = new THREE.Vector3(), POS = new THREE.Vector3();
  const S = { yaw: 0, pitch: PITCH0, dist: ARM, blend: 1, fp: false, hold: 9, fov: FOV_TP[0], keyEdge: false, settle: false, turn: null };

  const FC = {
    active: false,
    yaw: 0, pitch: PITCH0, forward: new THREE.Vector3(0, 0, -1), firstPerson: false, fovWant: null,
    pos: POS, dist: ARM, opacity: 1, following: false, lifting: false, blocked: false,
    // First person (the old view) or third. Turning the view between them eases over about half a second.
    setFirstPerson(b) { S.fp = !!b; FC.firstPerson = S.fp; },
    toggle() { FC.setFirstPerson(!S.fp); },
    // V is read here so the camera works with any input; main also calls toggle() on input.viewDown. takeKey() gives both
    // one edge, so a press that both paths see is one toggle.
    takeKey() { const k = S.keyEdge; S.keyEdge = false; return k; },
    setYaw(y) { S.yaw = FC.yaw = wrap(y); },
    setPitch(p) { S.pitch = FC.pitch = clamp(p, -PITCH_FP, PITCH_FP); },
    // Start the view: yaw, pitch (the default looks down at the hero), and whether the camera starts at the eye (it then
    // pulls out to the chase position, unless a first-person flag holds it there).
    reset(yaw, pitch = PITCH0, atEye = false) {
      S.yaw = FC.yaw = wrap(yaw); S.pitch = FC.pitch = pitch; S.hold = 9; S.dist = ARM; S.settle = false; S.turn = null;
      S.fp = FC.firstPerson = false; S.blend = atEye ? 0 : 1;
    },
    // Ease the pitch to the default over the next second (the hand-off from the intro), until you move the view yourself.
    settle() { S.settle = true; },
    // Turn the view to face yaw (radians) over secs (0.4 s by default): a swing from a wall in third person. It does not start the
    // timer of the look hold. First person never turns by itself.
    turnTo(yaw, secs = FLATCAM.turnSecs) {
      if (S.fp) return;
      S.turn = { d: wrap(yaw - S.yaw), t: 0, secs: Math.max(0.05, secs) };
    },
    // The frame. look = { dx: yaw radians turned (left is +), dy: pitch radians tilted (up is +) }; flags = { swinging, lift, forceFirst }.
    update(dt, P, hero, look, flags) {
      dt = clamp(dt || 0, 0, 0.1);
      const dx = (look && look.dx) || 0, dy = (look && look.dy) || 0;
      const fp = S.fp || !!(flags && flags.forceFirst);
      S.yaw = wrap(S.yaw + dx);
      S.pitch = clamp(S.pitch + dy, fp ? -PITCH_FP : PITCH_MIN, fp ? PITCH_FP : PITCH_MAX);
      if (Math.abs(dx) + Math.abs(dy) > 1e-4) { S.hold = 0; S.settle = false; } else S.hold += dt;
      if (S.settle) {
        S.pitch += (PITCH0 - S.pitch) * ease(dt, 3.5);
        if (Math.abs(PITCH0 - S.pitch) < 0.004) S.settle = false;
      }
      const vx = P.vel.x, vy = P.vel.y, vz = P.vel.z, hs = Math.hypot(vx, vz), speed = Math.hypot(hs, vy);
      // a swing from a wall turns the view toward the swing (turnTo): a smooth step over about 0.4 s, on top of any look input
      const tn = S.turn;
      if (tn) {
        const t1 = Math.min(tn.secs, tn.t + dt), f = (t) => { const k = t / tn.secs; return k * k * (3 - 2 * k); };
        S.yaw = wrap(S.yaw + tn.d * (f(t1) - f(tn.t)));
        tn.t = t1;
        if (t1 >= tn.secs || fp) S.turn = null;
      }
      // The lift. While a rope flies or holds (or you fall or fly faster than 6 m/s) and you have not moved the view for 0.7 s, the
      // pitch eases up to FLATCAM.lift, where the next buildings are. It only raises the pitch, and it leaves the follow timer alone.
      // main turns flags.lift off while a clog or a pipe is near the view: the lift would pull it off the screen.
      const rope = !!P.ropes && (P.ropes[0].state !== "idle" || P.ropes[1].state !== "idle");
      FC.lifting = !!(flags && flags.lift) && !fp && S.hold > FLATCAM.liftHold && (rope || (!P.onGround && speed > 6)) && S.pitch < FLATCAM.lift;
      if (FC.lifting) S.pitch += (FLATCAM.lift - S.pitch) * ease(dt, FLATCAM.liftRate);
      // while you swing and move fast, the view turns slowly toward where you go (never right after you moved it yourself)
      FC.following = !!(flags && flags.swinging) && !fp && speed > 6 && hs > 3 && S.hold > HOLD_LOOK && !S.turn;
      if (FC.following) S.yaw = wrap(S.yaw + wrap(Math.atan2(-vx, -vz) - S.yaw) * ease(dt, 1 / FOLLOW_TAU) * smooth(3, 7, hs));
      FC.yaw = S.yaw; FC.pitch = S.pitch;
      const cp = Math.cos(S.pitch);
      DIR.set(-Math.sin(S.yaw) * cp, Math.sin(S.pitch), -Math.cos(S.yaw) * cp); // the way the camera looks
      FC.forward.copy(DIR);

      // the blend between the eye (0) and the chase position (1)
      S.blend += ((fp ? 0 : 1) - S.blend) * ease(dt, 7);
      if (Math.abs(S.blend - (fp ? 0 : 1)) < 0.003) S.blend = fp ? 0 : 1;
      const px = P.pos.x, py = P.pos.y, pz = P.pos.z;
      EYE.set(px, py + COMFORT.standingHead, pz);
      T.set(px, py + (P.chest || 1.25) + PIVOT_UP, pz);

      // the arm: as long as the view allows, and never through a building or under the street
      const arm = ARM + (ARM_FAST - ARM) * smooth(FOV_V[0], FOV_V[1], speed);
      let allow = arm;
      FC.blocked = false;
      if (S.blend > 0.001) {
        const hit = city.raycast(T.x, T.y, T.z, -DIR.x, -DIR.y, -DIR.z, arm + NEAR_HIT, HIT);
        if (hit) { allow = Math.min(allow, Math.max(MIN_DIST, hit.t - NEAR_HIT)); FC.blocked = true; }
        if (DIR.y > 1e-3) allow = Math.min(allow, Math.max(MIN_DIST, (T.y - FLOOR) / DIR.y));
        // the camera is a small ball: back off if the ball still touches something (a corner the ray slipped past)
        for (let k = 0; k < 3; k++) {
          const cx = T.x - DIR.x * allow, cy = T.y - DIR.y * allow, cz = T.z - DIR.z * allow;
          if (allow <= MIN_DIST || !city.collideSphere(cx, cy, cz, 0.28, SPH)) break;
          allow = Math.max(MIN_DIST, allow * 0.8); FC.blocked = true;
        }
      }
      // it comes in at once and lets out slowly, so a wall never gets a frame inside the view
      if (allow < S.dist) S.dist = allow; else S.dist += (allow - S.dist) * ease(dt, 4);
      const chase = S.dist;
      POS.set(T.x - DIR.x * chase, T.y - DIR.y * chase, T.z - DIR.z * chase);
      if (S.blend < 1) POS.lerpVectors(EYE, POS, S.blend);
      camera.position.copy(POS);
      E.set(S.pitch, S.yaw, 0);
      camera.quaternion.setFromEuler(E);
      FC.dist = Math.hypot(POS.x - T.x, POS.y - T.y, POS.z - T.z);
      FC.opacity = smooth(FADE_TO, FADE_FROM, FC.dist);

      // the view widens with speed, eased; the two views have their own range, and the blend moves between them
      const tv = smooth(FOV_V[0], FOV_V[1], speed);
      const wantTP = FOV_TP[0] + (FOV_TP[1] - FOV_TP[0]) * tv, wantFP = FOV_FP[0] + (FOV_FP[1] - FOV_FP[0]) * tv;
      // a phone sets its own faster curve (main writes fovWant each frame); else the two views' ranges, blended
      const want = FC.fovWant != null ? FC.fovWant : wantFP + (wantTP - wantFP) * S.blend;
      if (Math.abs(want - camera.fov) > 0.01) { camera.fov += (want - camera.fov) * ease(dt, 4); camera.updateProjectionMatrix(); }
      if (hero) hero.setOpacity(FC.opacity);
      FC.firstPerson = S.fp;
      return FC;
    },
    // The input module writes the camera every frame (it is the head there). This puts back the pose of the last update, so
    // whatever reads the camera before the next update (the reticles, the opening) sees the view you see.
    restore() {
      camera.position.copy(POS);
      camera.quaternion.setFromEuler(E.set(S.pitch, S.yaw, 0));
    },
    // the state, for tests
    info: () => ({ yaw: S.yaw, pitch: S.pitch, dist: S.dist, blend: S.blend, firstPerson: S.fp, following: FC.following, lifting: FC.lifting, turning: !!S.turn, blocked: FC.blocked, opacity: FC.opacity, fov: camera.fov, hold: S.hold }),
  };

  // The V key. It is not read while a menu, a text field or a modifier key is in play.
  addEventListener("keydown", (e) => {
    if (e.code !== "KeyV" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (FC.active) S.keyEdge = true;
  });
  return FC;
}
