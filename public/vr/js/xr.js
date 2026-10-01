// In Full Swing: the WebXR session and the Input it builds every frame from controllers and hands (spec §7).
// It reads every pose itself from the XRFrame, in tracking space (local-floor). It never uses three.js controller
// groups, so nothing here moves with the rig: main.js turns these local poses into world poses.
import * as THREE from "three";
import { PERF } from "./config.js";

const DOWN = 0.7, UP = 0.4; // trigger and grip edges: pressed above 0.7, released below 0.4
const DEAD = 0.15; // stick dead zone
const JOINTS = 25;
const FINGERS = [10, 15, 20]; // middle, ring and little metacarpals in the WebXR joint order
const GRACE = 0.2; // hand mode: holding stays true this long after the pinch opens or the hand drops out
const VEL_TAU = 0.03, VEL_MAX = 8, GAP = 0.1; // velRel smoothing, clamp, and the frame gap that resets it
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dead = (v) => (Math.abs(v) < DEAD ? 0 : v);

/* ---------------- the Input shape (spec §4.1), shared with desktop.js ---------------- */
function makeHand(side, index, kind) {
  return {
    side, index, connected: false, kind,
    gripLocal: { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }, aimLocal: { pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1) },
    gripPos: new THREE.Vector3(), gripQuat: new THREE.Quaternion(), aimPos: new THREE.Vector3(), aimDir: new THREE.Vector3(0, 0, -1),
    trigger: 0, triggerDown: false, triggerUp: false, grip: 0, gripDown: false, gripUp: false, holding: false,
    velRel: new THREE.Vector3(), yank: 0, palmUp: false, joints: null,
    pulse() {},
  };
}
export function createInput(mode, kind) {
  return {
    mode,
    head: { local: { pos: new THREE.Vector3(0, 1.6, 0), quat: new THREE.Quaternion() }, pos: new THREE.Vector3(), quat: new THREE.Quaternion() },
    hands: [makeHand("left", 0, kind), makeHand("right", 1, kind)],
    move: { x: 0, y: 0 }, turn: 0, pitch: 0,
    jumpDown: false, menuDown: false, mapDown: false,
    visible: true, kind,
  };
}
// Clears the one-frame fields. Edges are true for exactly one frame.
export function clearEdges(inp) {
  for (const h of inp.hands) { h.triggerDown = h.triggerUp = h.gripDown = h.gripUp = false; h.yank = 0; }
  inp.jumpDown = inp.menuDown = inp.mapDown = false;
}

/* ---------------- the session ---------------- */
export function createXR(renderer, rig, camera, settings) {
  const inp = createInput("xr", "controller");
  const fns = { start: [], end: [], reset: [], vis: [] };
  const call = (list, a) => { for (const f of list) { try { f(a); } catch (e) { console.error(e); } } };
  // per hand: the source it came from, pressed states, the velRel history, the palm gate and the joint buffers
  const st = [0, 1].map(() => ({
    source: null, kind: null, trig: false, grp: false, btn: [false, false, false, false, false, false, false, false], real: false,
    vel: new THREE.Vector3(), prevGrip: new THREE.Vector3(), prevHead: new THREE.Vector3(), tracked: 0,
    gate: false, grace: 0, handObj: null, spaces: null, poses: new Float32Array(JOINTS * 16), radii: new Float32Array(JOINTS),
  }));
  const V = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), FWD = new THREE.Vector3(0, 0, -1), QA = new THREE.Quaternion();
  const hit = { pos: new THREE.Vector3(), normal: new THREE.Vector3(), valid: false };
  const M = new THREE.Matrix4();
  const seen = [false, false];
  let lastT = -1, hitSource = null, starting = null;

  const X = {
    input: inp, session: null, mode: null, features: [], lastInit: null, requestedFrameRate: null,
    planes: new Map(), meshes: new Map(),
    supported: null,
    get frameRate() { return X.session && X.session.frameRate != null ? X.session.frameRate : null; },
    onStart: (fn) => fns.start.push(fn), onEnd: (fn) => fns.end.push(fn), onReset: (fn) => fns.reset.push(fn), onVisibility: (fn) => fns.vis.push(fn),
  };

  X.supported = (async () => {
    const xr = navigator.xr;
    if (!xr || !xr.isSessionSupported) return { vr: false, ar: false };
    const ask = (m) => xr.isSessionSupported(m).then((v) => !!v, () => false);
    const [vr, ar] = await Promise.all([ask("immersive-vr"), ask("immersive-ar")]);
    return { vr, ar };
  })();

  // Features by mode: the spatial ones only for AR, so VR never shows the Spatial permission prompt.
  X.start = async (mode) => {
    if (X.session) return X.session;
    if (starting) return starting;
    if (!navigator.xr) throw new Error("WebXR is not available");
    const init = { requiredFeatures: ["local-floor"], optionalFeatures: ["hand-tracking", "layers", "bounded-floor"] };
    if (mode === "ar") init.optionalFeatures.push("plane-detection", "mesh-detection", "hit-test");
    X.lastInit = JSON.parse(JSON.stringify(init));
    renderer.xr.setReferenceSpaceType("local-floor");
    renderer.xr.setFramebufferScaleFactor(1);
    renderer.xr.setFoveation(settings.foveation != null ? settings.foveation : PERF.foveation);
    starting = (async () => {
      const session = await navigator.xr.requestSession(mode === "ar" ? "immersive-ar" : "immersive-vr", init);
      X.session = session; X.mode = mode;
      X.features = session.enabledFeatures ? Array.from(session.enabledFeatures) : init.requiredFeatures.slice();
      session.addEventListener("end", onEnd);
      session.addEventListener("visibilitychange", () => { inp.visible = session.visibilityState === "visible"; call(fns.vis, session.visibilityState); });
      session.addEventListener("inputsourceschange", () => { for (const s of st) s.tracked = 0; });
      await renderer.xr.setSession(session);
      const ref = renderer.xr.getReferenceSpace();
      if (ref && ref.addEventListener) ref.addEventListener("reset", onReset);
      if (mode === "ar" && X.features.includes("hit-test") && session.requestHitTestSource) {
        try {
          const viewer = await session.requestReferenceSpace("viewer");
          hitSource = await session.requestHitTestSource({ space: viewer });
        } catch (e) { hitSource = null; /* no hit-test here: the portal falls back to a virtual wall */ }
      }
      lastT = -1;
      inp.visible = session.visibilityState ? session.visibilityState === "visible" : true;
      // 72 Hz is the floor on Quest; 90 only when the player asks for it and the headset offers it
      await X.setFrameRate(settings.hz === 90 ? 90 : PERF.hz).catch(() => {});
      call(fns.start, session);
      return session;
    })();
    try { return await starting; } catch (e) { X.session = null; X.mode = null; throw e; } finally { starting = null; }
  };

  X.end = () => (X.session ? X.session.end().catch(() => {}) : Promise.resolve());

  X.setFrameRate = async (hz) => {
    const s = X.session;
    if (!s || !s.updateTargetFrameRate) return;
    const list = s.supportedFrameRates ? Array.from(s.supportedFrameRates) : [];
    if (list.length && !list.includes(hz)) {
      const lower = list.filter((r) => r <= hz);
      hz = lower.length ? Math.max(...lower) : Math.min(...list);
    }
    X.requestedFrameRate = hz;
    await s.updateTargetFrameRate(hz);
  };

  X.hitTest = () => (hit.valid ? hit : null);

  function onEnd() {
    X.session = null; X.mode = null; X.features = [];
    X.planes.clear(); X.meshes.clear();
    hitSource = null; hit.valid = false;
    for (const s of st) { s.source = null; s.tracked = 0; s.trig = s.grp = false; s.gate = false; s.grace = 0; }
    for (const h of inp.hands) { h.connected = false; h.holding = false; h.trigger = h.grip = 0; }
    call(fns.end);
  }
  function onReset() {
    // the tracking origin moved: old velocity samples would read as a huge hand speed
    for (const s of st) { s.tracked = 0; s.vel.set(0, 0, 0); }
    call(fns.reset);
  }

  /* ---------------- per frame ---------------- */
  // X.update(frame, time) → Input. time is the XR frame time in ms (the loop callback's argument).
  // Without a frame (G.test.step while held) it only clears the edges and keeps every pose.
  X.update = (frame, time) => {
    clearEdges(inp);
    inp.move.x = inp.move.y = 0; inp.turn = 0;
    const session = X.session;
    if (!frame || !session) return inp;
    const ref = renderer.xr.getReferenceSpace();
    if (!ref) return inp;
    const t = time != null ? time : frame.predictedDisplayTime != null ? frame.predictedDisplayTime : performance.now();
    const dtXR = lastT < 0 ? 0 : (t - lastT) / 1000;
    lastT = t;
    const gap = dtXR <= 0 || dtXR > GAP;
    X.frameDt = dtXR;
    inp.visible = session.visibilityState ? session.visibilityState === "visible" : true;

    const vp = frame.getViewerPose(ref);
    const headOk = !!vp && !vp.emulatedPosition;
    if (vp) {
      const p = vp.transform.position, o = vp.transform.orientation;
      inp.head.local.pos.set(p.x, p.y, p.z);
      inp.head.local.quat.set(o.x, o.y, o.z, o.w);
    }

    seen[0] = seen[1] = false;
    let sticks = 0, stickSide = -1;
    for (const src of session.inputSources) {
      // gaze and transient pointers (and anything with no hand) never drive a rope
      if (src.targetRayMode !== "tracked-pointer") continue;
      if (src.handedness !== "left" && src.handedness !== "right") continue;
      const i = src.handedness === "left" ? 0 : 1;
      if (seen[i]) continue;
      seen[i] = true;
      const h = inp.hands[i], s = st[i], kind = src.hand ? "hand" : "controller";
      if (s.source !== src || s.kind !== kind || !h.connected) {
        // a new source, a hand/controller switch or a reconnect: forget the old velocity and presses
        s.source = src; s.kind = kind; s.tracked = 0; s.vel.set(0, 0, 0); s.gate = false; s.real = false;
        s.trig = s.grp = false; s.btn.fill(false);
        h.pulse = kind === "controller" ? makePulse(src) : noPulse;
      }
      h.connected = true; h.kind = kind;
      readHand(frame, ref, src, h, s, dtXR, gap, headOk);
      if (kind === "controller" && src.gamepad) { sticks++; stickSide = i; }
    }
    for (let i = 0; i < 2; i++) {
      if (seen[i]) continue;
      const h = inp.hands[i], s = st[i];
      if (h.connected || s.trig) {
        if (s.trig) h.triggerUp = true;
        if (s.grp) h.gripUp = true;
        // a hand that drops out while pinching keeps its rope for a moment (tracking often returns within a few frames)
        if (s.kind === "hand" && s.trig) s.grace = GRACE;
        s.trig = s.grp = false; s.source = null; s.tracked = 0; s.vel.set(0, 0, 0);
      }
      h.connected = false; h.trigger = 0; h.grip = 0; h.palmUp = false; h.joints = null; h.velRel.set(0, 0, 0);
      if (s.grace > 0 && dtXR > 0) s.grace -= dtXR;
      h.holding = s.kind === "hand" && s.grace > 0;
    }

    // sticks: left moves, right turns (swapped for left-handed play); one controller does both
    const left = settings.hand === "left";
    const moveSide = left ? 1 : 0, turnSide = left ? 0 : 1;
    if (sticks === 1) {
      const gp = inp.hands[stickSide].kind === "controller" && st[stickSide].source && st[stickSide].source.gamepad;
      if (gp) { inp.turn = dead(gp.axes[2] ?? 0); inp.move.y = dead(-(gp.axes[3] ?? 0)); }
    } else {
      const gm = stickPad(moveSide), gt = stickPad(turnSide);
      if (gm) {
        let x = gm.axes[2] ?? 0, y = -(gm.axes[3] ?? 0);
        const l = Math.hypot(x, y);
        if (l < DEAD) x = y = 0; else { const k = Math.min(1, (l - DEAD) / (1 - DEAD)) / l; x *= k; y *= k; }
        inp.move.x = x; inp.move.y = y;
      }
      if (gt) inp.turn = dead(gt.axes[2] ?? 0);
    }
    let hands = 0, ctrls = 0;
    for (const h of inp.hands) if (h.connected) { if (h.kind === "hand") hands++; else ctrls++; }
    inp.kind = hands > ctrls ? "hand" : "controller";

    readPlanes(frame, ref);
    readHits(frame, ref);
    return inp;
  };

  const noPulse = () => {};
  function makePulse(src) {
    return (intensity, ms) => {
      const a = src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators[0];
      if (a && a.pulse) { try { a.pulse(clamp(intensity, 0, 1), ms); } catch (e) { /* haptics off */ } }
    };
  }
  function stickPad(i) {
    const s = st[i];
    return inp.hands[i].connected && s.kind === "controller" && s.source && s.source.gamepad ? s.source.gamepad : null;
  }

  // One hand's poses, buttons, joints, palm gate, holding and velRel.
  function readHand(frame, ref, src, h, s, dtXR, gap, headOk) {
    const gp = src.gamepad;
    const gripPose = src.gripSpace ? frame.getPose(src.gripSpace, ref) : null;
    const aimPose = frame.getPose(src.targetRaySpace, ref);
    let poseOk = false;
    if (gripPose) {
      const p = gripPose.transform.position, o = gripPose.transform.orientation;
      h.gripLocal.pos.set(p.x, p.y, p.z); h.gripLocal.quat.set(o.x, o.y, o.z, o.w);
      poseOk = trusted(s, gripPose);
    }
    if (aimPose) {
      const p = aimPose.transform.position, o = aimPose.transform.orientation;
      h.aimLocal.pos.set(p.x, p.y, p.z);
      QA.set(o.x, o.y, o.z, o.w);
      h.aimLocal.dir.copy(FWD).applyQuaternion(QA);
      if (!gripPose) { h.gripLocal.pos.copy(h.aimLocal.pos); h.gripLocal.quat.copy(QA); poseOk = trusted(s, aimPose); }
    }
    const missing = !gripPose && !aimPose;
    let trigger = 0, grip = 0;
    if (s.kind === "controller") {
      h.joints = null; h.palmUp = false;
      trigger = gp && gp.buttons[0] ? gp.buttons[0].value : 0;
      grip = gp && gp.buttons[1] ? gp.buttons[1].value : 0;
      if (gp) {
        // A/X jumps, B/Y (or the menu button when the browser shows it) opens the menu, the move stick's click opens the map
        const b = gp.buttons, moveSide = settings.hand === "left" ? 1 : 0;
        if (edge(s, 4, b[4])) inp.jumpDown = true;
        if (edge(s, 5, b[5])) inp.menuDown = true;
        if (edge(s, 7, b[7])) inp.menuDown = true;
        if (edge(s, 3, b[3]) && h.index === moveSide) inp.mapDown = true;
      }
    } else {
      const ok = readJoints(frame, ref, src, h, s);
      if (ok) {
        const J = h.joints;
        trigger = gp && gp.buttons && gp.buttons[0] ? gp.buttons[0].value : pinchRamp(J);
        const curl = curlOf(J);
        // a fist reels; a loose hand does not. Map curl 0.75..1 to grip 0.2..1 (0.2 is where the reel starts)
        grip = curl < 0.75 ? 0 : 0.2 + 0.8 * clamp((curl - 0.75) / 0.25, 0, 1);
        h.palmUp = palmFacesHead(J, h.side, headOk ? inp.head.local.pos : null);
      } else {
        // no joints this frame: keep the last press state, so a brief tracking loss does not drop the rope
        trigger = s.trig ? 1 : 0; grip = h.grip;
      }
      // Palm gate (system gesture zone): a palm that faces the head gives no trigger, grip or yank,
      // and a pinch that began there stays ignored until the hand reopens with the palm turned away.
      if (h.palmUp) s.gate = true;
      else if (s.gate && trigger < UP) s.gate = false;
      if (s.gate) { trigger = 0; grip = 0; }
    }
    if (missing && s.kind === "hand") trigger = s.trig ? 1 : 0;
    h.trigger = trigger; h.grip = grip;
    if (!s.trig && trigger >= DOWN) { s.trig = true; h.triggerDown = true; }
    else if (s.trig && trigger < UP) { s.trig = false; h.triggerUp = true; }
    if (!s.grp && grip >= DOWN) { s.grp = true; h.gripDown = true; }
    else if (s.grp && grip < UP) { s.grp = false; h.gripUp = true; }
    h.holding = s.trig;
    if (s.kind === "hand") {
      if (s.trig) s.grace = GRACE;
      else if (s.grace > 0) { s.grace -= dtXR; h.holding = true; }
    } else s.grace = 0;

    // velRel: grip velocity minus head velocity, in tracking space, from the XR frame times
    const usable = poseOk && headOk && !gap && !s.gate && !missing;
    if (usable) {
      if (s.tracked > 0) {
        V.copy(h.gripLocal.pos).sub(s.prevGrip).sub(B.copy(inp.head.local.pos).sub(s.prevHead)).divideScalar(dtXR);
        const l = V.length();
        if (l > VEL_MAX) V.multiplyScalar(VEL_MAX / l);
        s.vel.lerp(V, 1 - Math.exp(-dtXR / VEL_TAU));
      }
      s.tracked++;
      s.prevGrip.copy(h.gripLocal.pos); s.prevHead.copy(inp.head.local.pos);
    } else { s.tracked = 0; s.vel.set(0, 0, 0); }
    // three tracked frames before a pull can count as a yank
    if (s.tracked >= 3) h.velRel.copy(s.vel); else h.velRel.set(0, 0, 0);
  }
  // emulatedPosition marks a controller that lost optical tracking (its position is a guess). Trust the flag once the
  // source has shown real tracking: an emulator that marks every pose as emulated would otherwise never yank.
  function trusted(s, pose) {
    if (!pose.emulatedPosition) s.real = true;
    return !pose.emulatedPosition || !s.real;
  }
  function edge(s, i, b) {
    const on = !!b && (b.pressed || b.value > 0.5);
    const was = s.btn[i];
    s.btn[i] = on;
    return on && !was;
  }

  // Joints into h.joints (tracking-space xyz + radius, WebXR joint order) with fillPoses into preallocated arrays.
  function readJoints(frame, ref, src, h, s) {
    if (s.handObj !== src.hand) { s.handObj = src.hand; s.spaces = Array.from(src.hand.values()); }
    if (!h.joints) h.joints = s.jointBuf || (s.jointBuf = new Float32Array(JOINTS * 4));
    const J = h.joints;
    let ok = false;
    try {
      if (frame.fillPoses && frame.fillJointRadii) {
        ok = frame.fillPoses(s.spaces, ref, s.poses);
        frame.fillJointRadii(s.spaces, s.radii);
        if (ok) for (let j = 0; j < JOINTS; j++) { J[j * 4] = s.poses[j * 16 + 12]; J[j * 4 + 1] = s.poses[j * 16 + 13]; J[j * 4 + 2] = s.poses[j * 16 + 14]; J[j * 4 + 3] = s.radii[j]; }
      } else {
        ok = true;
        for (let j = 0; j < JOINTS && ok; j++) {
          const p = frame.getJointPose(s.spaces[j], ref);
          if (!p) { ok = false; break; }
          const q = p.transform.position;
          J[j * 4] = q.x; J[j * 4 + 1] = q.y; J[j * 4 + 2] = q.z; J[j * 4 + 3] = p.radius;
        }
      }
    } catch (e) { ok = false; }
    // a missing joint shows up as NaN; treat the whole hand as untracked for this frame
    if (ok) for (let j = 0; j < JOINTS * 4; j += 4) if (!(J[j] === J[j])) { ok = false; break; }
    return ok;
  }
  const jd = (J, a, b) => Math.hypot(J[a * 4] - J[b * 4], J[a * 4 + 1] - J[b * 4 + 1], J[a * 4 + 2] - J[b * 4 + 2]);
  // thumb tip (4) to index tip (9): 1 at 1.5 cm or closer, 0 at 4 cm or more
  function pinchRamp(J) { return clamp((0.04 - jd(J, 4, 9)) / 0.025, 0, 1); }
  // curl of middle (10), ring (15) and little (20): a straight finger's tip is as far from its metacarpal as its bones are long
  function curlOf(J) {
    let sum = 0;
    for (const f of FINGERS) {
      const segs = jd(J, f, f + 1) + jd(J, f + 1, f + 2) + jd(J, f + 2, f + 3) + jd(J, f + 3, f + 4);
      sum += segs > 1e-6 ? clamp((0.95 - jd(J, f, f + 4) / segs) / 0.55, 0, 1) : 0;
    }
    return sum / 3;
  }
  // The palm normal from the wrist and the index and little metacarpals. For a right hand, (index − wrist) × (little − wrist)
  // points out of the palm; a left hand is its mirror image, so the sign flips.
  function palmFacesHead(J, side, head) {
    if (!head) return false;
    A.set(J[20] - J[0], J[21] - J[1], J[22] - J[2]);
    B.set(J[80] - J[0], J[81] - J[1], J[82] - J[2]);
    N.crossVectors(A, B);
    if (side === "left") N.negate();
    const l = N.length();
    if (l < 1e-9) return false;
    N.divideScalar(l);
    V.set(head.x - J[0], head.y - J[1], head.z - J[2]);
    const d = V.length();
    return d > 1e-6 && N.dot(V) / d > 0.5;
  }

  /* ---------------- planes, meshes, hit-test ---------------- */
  // Entries stay in the map while the runtime reports them. version goes up when the geometry changes;
  // the portal, comfort and ui keep their own version caches, so no consumer hides a change from another.
  function readPlanes(frame, ref) {
    if (X.features.includes("plane-detection")) {
      let set = null;
      try { set = frame.detectedPlanes; } catch (e) { set = null; }
      if (set) {
        for (const plane of set) {
          let e = X.planes.get(plane);
          if (!e) { e = { label: "", orientation: "", matrix: new THREE.Matrix4(), polygon: [], version: 0, t: -1 }; X.planes.set(plane, e); }
          if (e.t !== plane.lastChangedTime || e.version === 0) {
            e.t = plane.lastChangedTime; e.version++;
            e.label = plane.semanticLabel || ""; e.orientation = plane.orientation || "";
            e.polygon = Array.from(plane.polygon || [], (p) => ({ x: p.x, z: p.z }));
          }
          const pose = frame.getPose(plane.planeSpace, ref);
          if (pose) e.matrix.fromArray(pose.transform.matrix);
        }
        for (const k of X.planes.keys()) if (!set.has(k)) X.planes.delete(k);
      }
    }
    if (X.features.includes("mesh-detection")) {
      let set = null;
      try { set = frame.detectedMeshes; } catch (e) { set = null; }
      if (set) {
        for (const mesh of set) {
          let e = X.meshes.get(mesh);
          if (!e) { e = { label: "", matrix: new THREE.Matrix4(), vertices: null, indices: null, version: 0, t: -1 }; X.meshes.set(mesh, e); }
          if (e.t !== mesh.lastChangedTime || e.version === 0) {
            e.t = mesh.lastChangedTime; e.version++;
            e.label = mesh.semanticLabel || ""; e.vertices = mesh.vertices; e.indices = mesh.indices;
          }
          const pose = frame.getPose(mesh.meshSpace, ref);
          if (pose) e.matrix.fromArray(pose.transform.matrix);
        }
        for (const k of X.meshes.keys()) if (!set.has(k)) X.meshes.delete(k);
      }
    }
  }
  function readHits(frame, ref) {
    hit.valid = false;
    if (!hitSource) return;
    let res = null;
    try { res = frame.getHitTestResults(hitSource); } catch (e) { res = null; }
    if (!res || !res.length) return;
    const pose = res[0].getPose(ref);
    if (!pose) return;
    // the hit pose's +Y axis is the surface normal
    M.fromArray(pose.transform.matrix);
    hit.pos.setFromMatrixPosition(M);
    hit.normal.set(M.elements[4], M.elements[5], M.elements[6]).normalize();
    hit.valid = true;
  }

  return X;
}
