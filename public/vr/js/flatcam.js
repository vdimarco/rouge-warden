// In Full Swing: the camera for flat screens. A chase camera behind and above the hero, turned by the look input, that swings
// toward your travel while you swing and never goes inside a building; V (or the Y button, or the eye button) moves it to the
// hero's eyes and back. It drives camera.position and camera.quaternion in world space, so the camera is a child of the scene.
// The arm hangs from a pivot above the hero's head and always points up from it, so the camera never drops below the head and
// never looks up at the hero from underneath. Looking down swings the arm up with the view. Looking up past the default
// lowers the arm toward a floor just over the head (and past level shortens it a little), while the view tilts up on its
// own: the hero slides down the screen and the aim (the middle of the screen) stays above the head.
import * as THREE from "three";
import { COMFORT, FLATCAM } from "./config.js";

const DEG = Math.PI / 180;
const ARM = FLATCAM.arm;        // the spring arm, metres from the pivot
const ARM_FAST = 5.6;           // it lets out a little at speed
const DRIVE_ARM = 1.7;          // behind a car the arm is this much longer
const ARM_UP = 0.9;             // looking up from level to the limit shortens it to this part of its length
const PIVOT_UP = 0.35;          // the pivot sits this far above the eyes, so the middle of the view is above the head
const OVER_HEAD = 0.45;         // looking up brings the camera down to this height above the eyes, and no lower
const PITCH_MIN = -60 * DEG, PITCH_MAX = 25 * DEG, PITCH_FP = 85 * DEG; // at +25 degrees the head is still in view, near the bottom
const PITCH0 = FLATCAM.pitch0;  // the default view looks down 20 degrees, over the hero's head
const NEAR_HIT = 0.3;           // stays this far off a wall
const MIN_DIST = 0.35;          // never closer than this to the pivot: closer than about 1.2 m the camera is nearly in the head
const FADE_FROM = 1.5, FADE_TO = 0.8; // the hero fades out between these camera distances
const FOLLOW_TAU = FLATCAM.followTau; // s, the swing toward your velocity
const HOLD_LOOK = FLATCAM.holdLook;   // s of no follow after a look input
const FOV_TP = [70, 88], FOV_FP = [75, 87], FOV_V = [15, 35]; // degrees at rest and at speed; the speeds (m/s) that span them
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);
const stepK = (t, secs) => { const k = t / secs; return k * k * (3 - 2 * k); }; // the smooth step of turnTo (made once, so a frame allocates nothing)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createFlatCam(camera, city) {
  const E = new THREE.Euler(0, 0, 0, "YXZ");
  const HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null }, SPH = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 };
  const T = new THREE.Vector3(), EYE = new THREE.Vector3(), DIR = new THREE.Vector3(), BACK = new THREE.Vector3(), POS = new THREE.Vector3();
  const S = { yaw: 0, pitch: PITCH0, dist: ARM, room: ARM, el: PITCH0, blend: 1, fp: false, hold: 9, fov: FOV_TP[0], keyEdge: false, settle: false, turn: null };

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
      S.yaw = FC.yaw = wrap(yaw); S.pitch = FC.pitch = pitch; S.hold = 9; S.dist = S.room = ARM; S.settle = false; S.turn = null;
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
      // third person has a narrower range than first person: a view left outside it (by V or the intro's hand-off) eases back
      // in instead of snapping, and the look cannot push it further out meanwhile
      let p = clamp(S.pitch + dy, -PITCH_FP, PITCH_FP);
      if (!fp && p > PITCH_MAX) p = S.pitch > PITCH_MAX ? PITCH_MAX + (Math.min(p, S.pitch) - PITCH_MAX) * (1 - ease(dt, 6)) : PITCH_MAX;
      else if (!fp && p < PITCH_MIN) p = S.pitch < PITCH_MIN ? PITCH_MIN + (Math.max(p, S.pitch) - PITCH_MIN) * (1 - ease(dt, 6)) : PITCH_MIN;
      S.pitch = p;
      if (Math.abs(dx) + Math.abs(dy) > 1e-4) { S.hold = 0; S.settle = false; } else S.hold += dt;
      if (S.settle) {
        S.pitch += (PITCH0 - S.pitch) * ease(dt, 3.5);
        if (Math.abs(PITCH0 - S.pitch) < 0.004) S.settle = false;
      }
      const vx = P.vel.x, vy = P.vel.y, vz = P.vel.z, hs = Math.hypot(vx, vz), speed = Math.hypot(hs, vy);
      // a swing from a wall turns the view toward the swing (turnTo): a smooth step over about 0.4 s, on top of any look input
      const tn = S.turn;
      if (tn) {
        const t1 = Math.min(tn.secs, tn.t + dt);
        S.yaw = wrap(S.yaw + tn.d * (stepK(t1, tn.secs) - stepK(tn.t, tn.secs)));
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
      // driving (flags.drive: the car's yaw): the view swings round behind the car, faster than a swing's follow
      if (flags && flags.drive != null && !fp && S.hold > HOLD_LOOK * 0.5) { FC.following = true; S.yaw = wrap(S.yaw + wrap(flags.drive - S.yaw) * ease(dt, 2.2) * smooth(0.5, 4, hs)); }
      FC.yaw = S.yaw; FC.pitch = S.pitch;
      const cp = Math.cos(S.pitch);
      DIR.set(-Math.sin(S.yaw) * cp, Math.sin(S.pitch), -Math.cos(S.yaw) * cp); // the way the camera looks
      FC.forward.copy(DIR);

      // the blend between the eye (0) and the chase position (1)
      S.blend += ((fp ? 0 : 1) - S.blend) * ease(dt, 7);
      if (Math.abs(S.blend - (fp ? 0 : 1)) < 0.003) S.blend = fp ? 0 : 1;
      const px = P.pos.x, py = P.pos.y, pz = P.pos.z;
      EYE.set(px, py + COMFORT.standingHead, pz);
      T.set(px, EYE.y + PIVOT_UP, pz);

      // the arm: longer at speed, and a little shorter as you look up past level (the hero keeps its size in ordinary play)
      const full = (ARM + (ARM_FAST - ARM) * smooth(FOV_V[0], FOV_V[1], speed)) * (flags && flags.drive != null ? DRIVE_ARM : 1);
      const arm = full * (1 - (1 - ARM_UP) * smooth(0, PITCH_MAX, S.pitch));
      // its angle: the view's while you look down; above the default it bends smoothly toward the floor over the head
      // (with the same slope at the default, so the camera never jerks there)
      const top = -Math.asin(clamp((OVER_HEAD - PIVOT_UP) / arm, 0, 1)), bend = top - PITCH0;
      const el = S.pitch <= PITCH0 || bend <= 0 ? S.pitch : PITCH0 + bend * Math.tanh((S.pitch - PITCH0) / bend);
      const ce = Math.cos(el);
      S.el = el;
      BACK.set(Math.sin(S.yaw) * ce, -Math.sin(el), Math.cos(S.yaw) * ce); // from the pivot out to the camera

      // the room behind: never through a building or under the street
      let room = full;
      FC.blocked = false;
      if (S.blend > 0.001) {
        const hit = city.raycast(T.x, T.y, T.z, BACK.x, BACK.y, BACK.z, arm + NEAR_HIT, HIT);
        if (hit) { room = Math.max(MIN_DIST, hit.t - NEAR_HIT); FC.blocked = true; }
        // (the arm always points up from the pivot, so it never reaches under the street)
        // the camera is a small ball: back off if the ball still touches something (a corner the ray slipped past)
        for (let k = 0; k < 3; k++) {
          const a = Math.min(arm, room), cx = T.x + BACK.x * a, cy = T.y + BACK.y * a, cz = T.z + BACK.z * a;
          if (a <= MIN_DIST || !city.collideSphere(cx, cy, cz, 0.28, SPH)) break;
          room = Math.max(MIN_DIST, a * 0.8); FC.blocked = true;
        }
      }
      // the room comes in at once and lets out slowly, so a wall never gets a frame inside the view; the look's own pull-in
      // follows the look at once
      if (room < S.room) S.room = room; else S.room += (room - S.room) * ease(dt, 4);
      S.dist = Math.min(arm, S.room);
      POS.copy(T).addScaledVector(BACK, S.dist);
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
    info: () => ({ yaw: S.yaw, pitch: S.pitch, el: S.el, room: S.room, dist: S.dist, blend: S.blend, firstPerson: S.fp, following: FC.following, lifting: FC.lifting, turning: !!S.turn, blocked: FC.blocked, opacity: FC.opacity, fov: camera.fov, hold: S.hold }),
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
