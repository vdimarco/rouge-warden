// In Full Swing: what you hold (spec §8). A plunger launcher on each controller (a wooden grip, a brass reel with the
// three heart lamps, a red cup loaded at the muzzle), or yellow rubber gloves on tracked hands with a small launcher
// strapped to the back of each hand. Launchers and hand launchers share one instanced draw; the 50 glove joints
// are a second. Each has an ink outline twin, and the light is the comic cel light of rope.js. Everything is a child of the
// rig, placed from tracking-space poses.
import * as THREE from "three";
import { COLORS, GAME } from "./config.js";
import { smoothNormals } from "./comic.js";
import { PROP_GLSL, HULL_HEAD, hullPush, hullMaterial, inkTwin, partsBuilder, place, addCup, cupOut, rgb } from "./rope.js";

const BY = 0.02; // the barrel's height above the aim ray
const MUZZLE = [0, BY, -0.1]; // launcher frame: where the rope leaves
const HAND_TIP = [0, 0.019, -0.042]; // hand launcher frame
const JOINTS = 25;
// each joint's next joint toward the finger tip (−1: a tip, or the wrist)
const CHILD = [-1, 2, 3, 4, -1, 6, 7, 8, 9, -1, 11, 12, 13, 14, -1, 16, 17, 18, 19, -1, 21, 22, 23, 24, -1];
const METACARPAL = { 5: 1, 10: 1, 15: 1, 20: 1 };
// the glove joints that glow for a tutorial hint (hands have no buttons: the fingers that do the job light up)
const GLOW_JOINTS = { trigger: [3, 4, 8, 9], grip: [12, 13, 14, 17, 18, 19, 22, 23, 24], stick: [8, 9], wrist: [0, 5, 10, 15, 20] };
const GLOW_ID = { trigger: 1, grip: 2, stick: 3, wrist: 4 };
const GLOVE = 0xf2c230;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------------- the models ---------------- */
// aInfo: part (0 launcher, 1 its plunger, 2 hand launcher, 3 its plunger), glow id, heart lamp 1–3, material.
function buildLaunchers() {
  const B = partsBuilder(), R90 = Math.PI / 2;
  const WALNUT = 0x7a4524, BRASS = COLORS.brass, DARK = 0x1c1412;
  /* -- the controller launcher, in the aim frame: −z along the ray, +y up -- */
  B.add(new THREE.CylinderGeometry(0.0165, 0.0165, 0.15, 10), place(0, BY, -0.005, R90), WALNUT, [0, 0, 0, 0]);
  for (const z of [0.058, -0.052]) B.add(new THREE.TorusGeometry(0.0168, 0.0026, 6, 16), place(0, BY, z), BRASS, [0, 0, 0, 1]);
  B.add(new THREE.CylinderGeometry(0.0185, 0.021, 0.018, 12), place(0, BY, -0.086, R90), BRASS, [0, 0, 0, 1]);
  B.add(new THREE.CylinderGeometry(0.0105, 0.0105, 0.002, 10), place(0, BY, -0.0955, R90), DARK, [0, 0, 0, 5]);
  B.add(new THREE.CylinderGeometry(0.0155, 0.0172, 0.012, 10), place(0, BY, 0.075, R90), BRASS, [0, 0, 0, 1]);
  // the thumb knob (the stick)
  B.add(new THREE.CylinderGeometry(0.003, 0.003, 0.01, 6), place(0, BY + 0.015, 0.064), BRASS, [0, 3, 0, 1]);
  B.add(new THREE.SphereGeometry(0.0078, 10, 8), place(0, BY + 0.022, 0.064, 0, 0, 0, 1, 0.75, 1), 0x2b2222, [0, 3, 0, 2]);
  // the brass reel on top, with rope wound on it and a crank
  const RY = BY + 0.037, RZ = 0.01;
  B.add(new THREE.BoxGeometry(0.012, 0.018, 0.03), place(0, BY + 0.018, RZ), BRASS, [0, 0, 0, 1]);
  B.add(new THREE.CylinderGeometry(0.0205, 0.0205, 0.022, 14), place(0, RY, RZ, 0, 0, R90), COLORS.rope, [0, 0, 0, 4]);
  for (const x of [-0.0128, 0.0128]) B.add(new THREE.CylinderGeometry(0.029, 0.029, 0.0036, 18), place(x, RY, RZ, 0, 0, R90), BRASS, [0, 0, 0, 1]);
  B.add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.034, 8), place(0, RY, RZ, 0, 0, R90), BRASS, [0, 0, 0, 1]);
  B.add(new THREE.BoxGeometry(0.003, 0.026, 0.006), place(0.0185, RY - 0.011, RZ + 0.004, 0.35), BRASS, [0, 0, 0, 1]);
  B.add(new THREE.CylinderGeometry(0.0042, 0.0042, 0.012, 8), place(0.025, RY - 0.022, RZ + 0.008, 0, 0, R90), COLORS.wood, [0, 0, 0, 0]);
  // the heart lamps: a small plate behind the reel, tilted to face your eye
  const plate = place(0, BY + 0.03, 0.05, -0.55);
  B.add(new THREE.BoxGeometry(0.042, 0.017, 0.005), plate, BRASS, [0, 0, 0, 1]);
  [-0.0125, 0, 0.0125].forEach((x, k) => {
    B.add(new THREE.SphereGeometry(0.0046, 10, 8), new THREE.Matrix4().multiplyMatrices(plate, place(x, 0, 0.0028, 0, 0, 0, 1, 1, 0.7)), 0xff3040, [0, 0, k + 1, 3]);
    B.add(new THREE.TorusGeometry(0.0052, 0.0011, 5, 12), new THREE.Matrix4().multiplyMatrices(plate, place(x, 0, 0.0028)), BRASS, [0, 0, 0, 1]);
  });
  // the grip: along the controller's handle (down and back at 45°), with a brass butt and a lanyard ring (the wrist)
  const d = [0, -Math.SQRT1_2, Math.SQRT1_2], gc = [0, -0.0265, 0.0605];
  B.add(new THREE.CylinderGeometry(0.0152, 0.0172, 0.1, 10), place(gc[0], gc[1], gc[2], -Math.PI / 4, 0, 0, 0.86, 1, 1), COLORS.wood, [0, 2, 0, 0]);
  const at = (k) => [gc[0] + d[0] * k, gc[1] + d[1] * k, gc[2] + d[2] * k];
  const butt = at(0.052), ring = at(0.064);
  B.add(new THREE.CylinderGeometry(0.0172, 0.0162, 0.01, 10), place(butt[0], butt[1], butt[2], -Math.PI / 4, 0, 0, 0.88, 1, 1), BRASS, [0, 4, 0, 1]);
  B.add(new THREE.TorusGeometry(0.0078, 0.0018, 5, 12), place(ring[0], ring[1], ring[2], Math.PI / 4, R90), BRASS, [0, 4, 0, 1]);
  // the trigger guard and the trigger
  B.add(new THREE.TorusGeometry(0.0165, 0.0022, 5, 12, Math.PI), place(0, BY - 0.012, 0.004, 0, R90, Math.PI), BRASS, [0, 0, 0, 1]);
  B.add(new THREE.BoxGeometry(0.005, 0.02, 0.0065), place(0, BY - 0.021, 0.0, 0.35), 0xc23a22, [0, 1, 0, 2]);
  // the loaded plunger: its mouth just past the muzzle
  addCup(B, place(0, BY, -0.165), 1);

  /* -- the hand launcher, in the hand frame: +y out of the back of the hand, −z toward the fingers -- */
  B.add(new THREE.BoxGeometry(0.046, 0.006, 0.052), place(0, 0.003, 0), 0x4a2c1c, [2, 0, 0, 0]);
  B.add(new THREE.BoxGeometry(0.032, 0.005, 0.042), place(0, 0.0075, -0.002), BRASS, [2, 0, 0, 1]);
  B.add(new THREE.CylinderGeometry(0.0095, 0.0095, 0.05, 10), place(0, 0.019, -0.01, R90), WALNUT, [2, 0, 0, 0]);
  B.add(new THREE.CylinderGeometry(0.0105, 0.0125, 0.009, 10), place(0, 0.019, -0.037, R90), BRASS, [2, 0, 0, 1]);
  [-0.011, 0, 0.011].forEach((x, k) => {
    B.add(new THREE.SphereGeometry(0.0038, 8, 6), place(x, 0.0115, 0.02, 0, 0, 0, 1, 0.7, 1), 0xff3040, [2, 0, k + 1, 3]);
  });
  addCup(B, new THREE.Matrix4().multiplyMatrices(place(0, 0.019, -0.074), new THREE.Matrix4().makeScale(0.72, 0.72, 0.72)), 3);
  return B.build();
}

const glv = (hex) => { const c = rgb(hex); return `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`; };
const GLOW_C = glv(COLORS.sludgeGlow);

/* ---------------- hands ---------------- */
export function createHands(rig, scene, settings) {
  let visible = true, glowName = null, glowSide = null, hearts = 3, gold = 0, time = 0;

  const lgeo = buildLaunchers();
  smoothNormals(lgeo);
  const instAttr = new THREE.InstancedBufferAttribute(new Float32Array(2 * 4), 4).setUsage(THREE.DynamicDrawUsage);
  lgeo.setAttribute("aInst", instAttr);
  const lVS = `
      attribute vec3 aCol; attribute vec4 aInfo;
      attribute vec4 aInst; // x: 0 launcher, 1 hand launcher; y: the plunger is loaded; z: this one glows
      #ifdef HULL
      attribute vec3 aOutline;
      #endif
      ${HULL_HEAD}
      uniform float uGlow, uTime, uHearts;
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec3 vL; varying float vM; varying float vG; varying float vH;
      void main() {
        float part = aInfo.x;
        float show = aInst.x > 0.5 ? step(1.5, part) : step(part, 1.5);
        if (abs(part - 1.0) < 0.5 || part > 2.5) show *= step(0.5, aInst.y);
        vW = vec3(0.0); vN = vec3(0.0, 1.0, 0.0); vC = aCol; vL = position; vM = aInfo.w; vG = 0.0; vH = -1.0;
        // the parts this one does not use fold away outside the view
        if (show < 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(m) * normal);
        if (aInfo.y > 0.5 && abs(aInfo.y - uGlow) < 0.5 && aInst.z > 0.5) vG = 0.55 + 0.45 * sin(uTime * 5.0);
        if (aInfo.z > 0.5) vH = aInfo.z < uHearts + 0.5 ? 1.0 : 0.0;
        #ifdef HULL
        ${hullPush("w.xyz", "mat3(m) * aOutline")}
        #endif
        gl_Position = projectionMatrix * viewMatrix * w;
      }`;
  const lUniforms = { uGlow: { value: 0 }, uTime: { value: 0 }, uHearts: { value: 3 }, uGold: { value: 0 } };
  const lmat = new THREE.ShaderMaterial({
    uniforms: lUniforms,
    side: THREE.DoubleSide,
    vertexShader: lVS.replace(HULL_HEAD, ""),
    fragmentShader: `
      uniform float uGold;
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec3 vL; varying float vM; varying float vG; varying float vH;
      ${PROP_GLSL}
      void main() {
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        if (!gl_FrontFacing) N = -N;
        vec3 base = vC; float metal = 0.0, gloss = 0.3;
        if (vM > 0.5 && vM < 1.5) { metal = 1.0; gloss = 0.75; }
        else if (vM > 1.5 && vM < 2.5) gloss = 0.55;
        else if (vM > 3.5 && vM < 4.5) gloss = 0.0;
        else if (vM > 4.5) gloss = 0.3;
        // the Golden Plunger: wood and brass turn to polished gold
        if (uGold > 0.5 && (vM < 0.5 || (vM > 0.5 && vM < 1.5))) { base = ${glv(COLORS.gold)} * (vM < 0.5 ? 0.92 : 1.05); metal = 1.0; gloss = 0.9; }
        // dots in the shade, fixed to the launcher (model space: they never slide over it as your hand moves)
        vec3 col = shadePropX(base, N, V, metal, gloss, propDots(vL, N, 0.004));
        if (vM > 2.5 && vM < 3.5) {
          // a heart lamp: lit red, or dark glass once that heart is gone
          col = vH > 0.5 ? mix(vec3(1.0, 0.24, 0.28), vec3(1.0, 0.85, 0.7), comicStep(0.86, dot(N, V))) : shadeProp(vec3(0.16, 0.08, 0.1), N, V, 0.0, 0.9);
        }
        col = mix(col, ${GLOW_C}, vG * 0.55) + ${GLOW_C} * vG * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const launchers = new THREE.InstancedMesh(lgeo, lmat, 2);
  launchers.name = "launchers";
  launchers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  launchers.frustumCulled = false;
  launchers.count = 0;
  launchers.visible = false;
  launchers.add(inkTwin(launchers, hullMaterial({ vertexShader: lVS, uniforms: lUniforms, width: 0.0007, px: 1.8 })));
  rig.add(launchers);

  // the gloves: 25 joints a hand, each a sphere stretched along its bone to the next joint
  const jgeo = new THREE.SphereGeometry(1, 12, 8);
  const jAttr = new THREE.InstancedBufferAttribute(new Float32Array(JOINTS * 2), 1).setUsage(THREE.DynamicDrawUsage);
  jgeo.setAttribute("aGlow", jAttr);
  const jVS = `
      attribute float aGlow;
      ${HULL_HEAD}
      uniform float uTime;
      varying vec3 vW; varying vec3 vN; varying float vG;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        // stretched spheres: divide the normal by the squared scale so it stays true
        vec3 s2 = vec3(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz), dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz));
        vN = normalize(mat3(m) * (normal / max(s2, vec3(1e-10))));
        vec4 w = m * vec4(position, 1.0);
        #ifdef HULL
        ${hullPush("w.xyz", "vN")}
        #endif
        vW = w.xyz;
        vG = aGlow * (0.55 + 0.45 * sin(uTime * 5.0));
        gl_Position = projectionMatrix * viewMatrix * w;
      }`;
  const jUniforms = { uTime: { value: 0 } };
  const jmat = new THREE.ShaderMaterial({
    uniforms: jUniforms,
    vertexShader: jVS.replace(HULL_HEAD, ""),
    fragmentShader: `
      varying vec3 vW; varying vec3 vN; varying float vG;
      ${PROP_GLSL}
      void main() {
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        vec3 col = shadeProp(${glv(GLOVE)}, N, V, 0.0, 0.5);
        col = mix(col, ${GLOW_C}, vG * 0.55) + ${GLOW_C} * vG * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const joints = new THREE.InstancedMesh(jgeo, jmat, JOINTS * 2);
  joints.name = "gloves";
  joints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  joints.frustumCulled = false;
  joints.count = 0;
  joints.visible = false;
  joints.add(inkTwin(joints, hullMaterial({ vertexShader: jVS, uniforms: jUniforms, width: 0.0006, px: 1.8 })));
  rig.add(joints);

  /* ---- scratch ---- */
  const tips = [new THREE.Vector3(), new THREE.Vector3()];
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), O = new THREE.Vector3(), F = new THREE.Vector3();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Nn = new THREE.Vector3(), BK = new THREE.Vector3();
  const M = new THREE.Matrix4(), S = new THREE.Vector3();
  const frames = [new THREE.Matrix4(), new THREE.Matrix4()];
  const shown = [{ mode: -1, plunger: false }, { mode: -1, plunger: false }];
  const hudSide = () => (settings && settings.hand === "left" ? 1 : 0);
  // Does launcher i glow? The stick hint lights the turning hand, the wrist hint the hand with the HUD.
  const glows = (i) => {
    if (!glowName) return false;
    if (glowSide != null) return glowSide === i;
    if (glowName === "stick") return i === 1 - hudSide();
    if (glowName === "wrist") return i === hudSide();
    return true;
  };
  // Which glove joints glow on hand i. Hands turn with the wrist arrows, so the stick hint lights the HUD wrist and
  // the other hand's index finger that pokes it.
  const jointGlow = (i) => {
    if (!glowName || (glowSide != null && glowSide !== i)) return null;
    if (glowName === "stick") return i === hudSide() ? GLOW_JOINTS.wrist : GLOW_JOINTS.stick;
    if (glowName === "wrist") return i === hudSide() ? GLOW_JOINTS.wrist : null;
    return GLOW_JOINTS[glowName];
  };

  // The controller launcher's frame: forward along the aim ray, up from the grip. The grip's −z runs up the handle,
  // so across the ray it points up; that holds for any runtime that tilts the handle away from the ray.
  function launcherFrame(h, out) {
    F.copy(h.aimLocal.dir);
    if (F.lengthSq() < 1e-9) F.set(0, 0, -1); else F.normalize();
    Y.set(0, 0, -1).applyQuaternion(h.gripLocal.quat);
    Y.addScaledVector(F, -Y.dot(F));
    if (Y.lengthSq() < 0.02) { Y.set(0, 1, 0).applyQuaternion(h.gripLocal.quat); Y.addScaledVector(F, -Y.dot(F)); }
    if (Y.lengthSq() < 1e-6) Y.set(0, 1, 0);
    Y.normalize();
    Z.copy(F).negate();
    X.crossVectors(Y, Z);
    return out.makeBasis(X, Y, Z).setPosition(h.aimLocal.pos);
  }

  const jp = (J, j, v) => v.set(J[j * 4], J[j * 4 + 1], J[j * 4 + 2]);
  // The glove joints of one hand into instances k0..k0+24, and the hand launcher's frame on the back of the hand.
  function handFrame(h, k0, out) {
    const J = h.joints;
    // the palm normal from the wrist and the index and little metacarpals (a left hand is mirrored)
    jp(J, 5, A).sub(jp(J, 0, O)); jp(J, 20, B).sub(O);
    Nn.crossVectors(A, B);
    if (h.side === "left") Nn.negate();
    if (Nn.lengthSq() < 1e-12) Nn.set(0, -1, 0); else Nn.normalize();
    const glowSet = jointGlow(h.index);
    for (let j = 0; j < JOINTS; j++) {
      const r = Math.max(0.005, J[j * 4 + 3] || 0.008) * 1.08, c = CHILD[j];
      jp(J, j, A);
      if (c >= 0) {
        jp(J, c, B);
        Y.copy(B).sub(A);
        const l = Y.length();
        if (l < 1e-5) Y.set(0, 1, 0); else Y.divideScalar(l);
        // roll: the flat side of each bone lies in the palm
        Z.copy(Nn).addScaledVector(Y, -Nn.dot(Y));
        if (Z.lengthSq() < 1e-6) Z.set(0, 0, 1).addScaledVector(Y, -Y.z);
        Z.normalize();
        X.crossVectors(Y, Z);
        const wide = METACARPAL[j] ? 1.4 : 1.0, thick = METACARPAL[j] ? 0.85 : 1.0;
        O.copy(A).add(B).multiplyScalar(0.5);
        M.makeBasis(X, Y, Z).scale(S.set(r * wide, l * 0.5 + r * 0.55, r * thick)).setPosition(O);
      } else if (j === 0) {
        // the wrist joint draws the palm: a flat pad from the wrist to the knuckles, as wide as the knuckles
        jp(J, 11, B);
        Y.copy(B).sub(A);
        const l = Math.max(0.02, Y.length());
        Y.divideScalar(l);
        Z.copy(Nn).addScaledVector(Y, -Nn.dot(Y)).normalize();
        X.crossVectors(Y, Z);
        jp(J, 6, O); jp(J, 21, F);
        const wide = Math.max(0.025, O.distanceTo(F) * 0.5 + 0.006);
        O.copy(A).lerp(B, 0.42);
        M.makeBasis(X, Y, Z).scale(S.set(wide, l * 0.55, Math.max(0.011, r * 0.62))).setPosition(O);
      } else M.makeScale(r, r, r).setPosition(A);
      joints.setMatrixAt(k0 + j, M);
      jAttr.setX(k0 + j, glowSet && glowSet.includes(j) ? 1 : 0);
    }
    // the hand launcher: on the back of the hand, a little toward the wrist, pointing along the fingers
    jp(J, 0, A); jp(J, 11, B);
    BK.copy(Nn).negate();
    F.copy(B).sub(A);
    F.addScaledVector(BK, -F.dot(BK));
    if (F.lengthSq() < 1e-9) F.set(0, 0, -1); else F.normalize();
    O.copy(A).lerp(B, 0.42).addScaledVector(BK, Math.max(0.008, J[10 * 4 + 3] || 0.01) + 0.004);
    Y.copy(BK); Z.copy(F).negate(); X.crossVectors(Y, Z);
    return out.makeBasis(X, Y, Z).setPosition(O);
  }

  const H = {
    visible: true,
    update(input, P, dt) {
      time += dt || 0;
      lmat.uniforms.uTime.value = time; jmat.uniforms.uTime.value = time;
      let nl = 0, nj = 0;
      const xr = input.mode === "xr";
      for (let i = 0; i < 2; i++) {
        const h = input.hands[i], sh = shown[i];
        sh.mode = -1;
        if (!xr) {
          // flat play: the muzzles sit 0.1 m ahead of the grips, low in the view (no launcher is drawn)
          tips[i].set(0, 0, -0.1).applyQuaternion(h.gripQuat).add(h.gripPos);
          continue;
        }
        if (!h.connected) continue;
        const out = !!(P && P.ropes[i] && P.ropes[i].state !== "idle") || cupOut[i];
        let frame = null, tip = null, mode = 0;
        if (h.kind === "hand") {
          if (!h.joints) continue;
          frame = handFrame(h, nj * JOINTS, frames[i]);
          nj++;
          tip = HAND_TIP; mode = 1;
        } else {
          frame = launcherFrame(h, frames[i]);
          tip = MUZZLE;
        }
        tips[i].set(tip[0], tip[1], tip[2]).applyMatrix4(frame).applyMatrix4(rig.matrixWorld);
        launchers.setMatrixAt(nl, frame);
        instAttr.setXYZW(nl, mode, out ? 0 : 1, glows(i) ? 1 : 0, 0);
        sh.mode = mode; sh.plunger = !out;
        nl++;
      }
      launchers.count = nl; joints.count = nj * JOINTS;
      launchers.visible = visible && nl > 0;
      joints.visible = visible && nj > 0;
      if (nl) { launchers.instanceMatrix.needsUpdate = true; instAttr.needsUpdate = true; }
      if (nj) { joints.instanceMatrix.needsUpdate = true; jAttr.needsUpdate = true; }
    },
    // the world point a rope leaves from
    tip: (side) => tips[side === "right" || side === 1 ? 1 : 0],
    // 3 lamps on each reel (hands: on the back of each hand)
    setHearts(n) { hearts = n == null ? 3 : clamp(Math.round(n), 0, 3); lmat.uniforms.uHearts.value = hearts; },
    // a tutorial hint: "trigger" | "grip" | "stick" | "wrist" | null. side (0/1) picks one hand; by default the stick
    // hint lights the turning hand and the wrist hint the hand with the HUD.
    glow(control, side) {
      glowName = GLOW_ID[control] ? control : null;
      glowSide = side === 0 || side === 1 ? side : side === "left" ? 0 : side === "right" ? 1 : null;
      lmat.uniforms.uGlow.value = glowName ? GLOW_ID[glowName] : 0;
      if (!glowName) { jAttr.array.fill(0); jAttr.needsUpdate = true; }
    },
    // Loonie unlock: the Golden Plunger at 100
    setStyle(bank) { gold = bank >= GAME.unlocks.launcher ? 1 : 0; lmat.uniforms.uGold.value = gold; },
    setVisible(v) {
      visible = H.visible = !!v;
      if (!visible) { launchers.visible = false; joints.visible = false; }
    },
    // what is drawn, for the tests
    info: () => ({
      visible, hearts, gold, glow: glowName,
      hands: shown.map((s, i) => ({ mode: s.mode === 1 ? "hand" : s.mode === 0 ? "launcher" : null, plunger: s.plunger, tip: tips[i].toArray() })),
      launchers: launchers.visible ? launchers.count : 0, joints: joints.visible ? joints.count : 0,
    }),
    meshes: { launchers, joints },
  };
  return H;
}
