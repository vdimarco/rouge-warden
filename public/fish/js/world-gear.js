// The tackle in first person: the rod (blank, guides, cork grip, a spinning reel), the line, and the spinner lure.
// The rod is rebuilt on the CPU each frame along a bent curve: it is small, and it keeps the tip exact for the line.
import * as THREE from "three";
import { storyMaterial } from "./art-style.js";
import { ROD } from "./lake.js";
import { bake, merge, hex, clamp, lerp } from "./world-env.js";
import { fx, fxUniforms } from "./world-fish.js";

const V3 = () => new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

/* ---------------- the rod ---------------- */

// Stations along the rod (meters from the reel seat; the butt is behind it), each a ring of the blank.
function stations() {
  const S = [], add = (s, r, c) => S.push({ s, r, c: hex(c) });
  const cork = "#c9a46a", cork2 = "#b8915a", blank = "#1d2530", seat = "#3a3f46", wrap = "#a8262a";
  add(-0.34, 0.006, "#202020"); add(-0.335, 0.0145, "#202020"); add(-0.3, 0.0155, "#252525");
  add(-0.3, 0.0155, cork2); add(-0.2, 0.0165, cork); add(-0.1, 0.016, cork2); add(-0.03, 0.0148, cork);
  add(-0.03, 0.0125, seat); add(0.0, 0.0118, seat); add(0.1, 0.0118, seat); add(0.12, 0.0125, seat);
  add(0.12, 0.0145, cork); add(0.2, 0.0135, cork2); add(0.25, 0.011, cork);
  add(0.25, 0.0085, wrap); add(0.27, 0.0082, wrap); add(0.27, 0.0078, blank);
  const n = 18;
  for (let i = 1; i <= n; i++) { const s = 0.27 + (ROD.length - 0.27) * (i / n); add(s, lerp(0.0078, 0.0021, (i / n) ** 0.9), blank); }
  return S;
}
export const GUIDES = [0.62, 1.0, 1.34, 1.62, 1.85, 2.03, 2.17, ROD.length - 0.005];

export class Rod {
  constructor(low) {
    this.seg = low ? 6 : 8;
    this.S = stations();
    // every vertex remembers which frame it rides on (s), its offset in that frame, and whether it grows to stay visible
    const vs = [], ns = [], cs = [], fr = [], grow = [];
    const push = (s, off, nrm, col, g) => { vs.push(off[0], off[1], off[2]); ns.push(nrm[0], nrm[1], nrm[2]); cs.push(col[0], col[1], col[2]); fr.push(s); grow.push(g); };
    // the blank: rings joined into a tube
    const seg = this.seg, S = this.S;
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1];
      if (a.s === b.s) continue;
      for (let k = 0; k < seg; k++) {
        const t0 = (k / seg) * Math.PI * 2, t1 = ((k + 1) / seg) * Math.PI * 2;
        const q = [[a, t0], [b, t0], [b, t1], [a, t0], [b, t1], [a, t1]];
        for (const [st, t] of q) push(st.s, [0, Math.cos(t) * st.r, Math.sin(t) * st.r], [0, Math.cos(t), Math.sin(t)], (st === a ? a.c : b.c), 1);
      }
    }
    // guides hang under the blank: a ring the line runs through, on a little frame
    const gc = hex("#b8bcc2"), gd = hex("#2a2e33");
    GUIDES.forEach((s, i) => {
      const k = i / (GUIDES.length - 1), R = lerp(0.016, 0.0035, k ** 0.7), drop = lerp(0.035, 0.006, k ** 0.7);
      const ring = new THREE.TorusGeometry(R, R * 0.2 + 0.0006, 4, 10);
      ring.rotateY(Math.PI / 2);
      ring.translate(0, drop + R, 0);
      const leg = new THREE.BoxGeometry(0.003, drop + 0.002, 0.002);
      leg.translate(0, (drop + 0.002) / 2, 0);
      for (const g of [bake(ring, { color: gc }), bake(leg, { color: gd })]) {
        const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
        for (let j = 0; j < p.count; j++) push(s, [p.getX(j), p.getY(j), p.getZ(j)], [n.getX(j), n.getY(j), n.getZ(j)], [c.getX(j), c.getY(j), c.getZ(j)], 2);
      }
    });
    // the spinning reel under the seat. Local axes: x = along the rod, y = down, z = to the left (the handle side)
    const reel = [];
    const body = hex("#2b3036"), silver = hex("#c9ced4"), dark = hex("#1a1c1f"), line = hex("#e9ecb8"), gold = hex("#d8962a");
    const M = () => new THREE.Matrix4();
    reel.push(bake(new THREE.BoxGeometry(0.02, 0.05, 0.008), { matrix: M().makeTranslation(0.05, 0.035, 0), color: body }));
    const box = new THREE.SphereGeometry(1, 12, 8); box.scale(0.035, 0.03, 0.022);
    reel.push(bake(box, { matrix: M().makeTranslation(0.045, 0.085, 0), color: body }));
    const cyl = (r0, r1, h, x, y, c, segs = 14) => { const g = new THREE.CylinderGeometry(r0, r1, h, segs); g.rotateZ(-Math.PI / 2); reel.push(bake(g, { matrix: M().makeTranslation(x, y, 0), color: c })); };
    cyl(0.026, 0.02, 0.03, 0.09, 0.085, body);       // rotor cup
    cyl(0.024, 0.024, 0.022, 0.115, 0.085, line);    // line on the spool
    cyl(0.026, 0.026, 0.004, 0.103, 0.085, silver);  // spool lips
    cyl(0.026, 0.026, 0.004, 0.127, 0.085, silver);
    cyl(0.009, 0.012, 0.014, 0.135, 0.085, gold, 10);  // drag knob
    const bail = new THREE.TorusGeometry(0.029, 0.0016, 4, 16, Math.PI);
    bail.rotateY(Math.PI / 2);
    reel.push(bake(bail, { matrix: M().makeTranslation(0.1, 0.085, 0), color: silver }));
    // the handle on the left: an arm out from the body and a knob
    const arm = new THREE.BoxGeometry(0.006, 0.05, 0.006);
    reel.push(bake(arm, { matrix: M().makeRotationX(0.9).setPosition(0.04, 0.1, 0.04), color: silver }));
    const knob = new THREE.CylinderGeometry(0.008, 0.009, 0.026, 10); knob.rotateX(Math.PI / 2);
    reel.push(bake(knob, { matrix: M().makeTranslation(0.04, 0.12, 0.072), color: dark }));
    reel.push(bake(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8).rotateX(Math.PI / 2), { matrix: M().makeTranslation(0.04, 0.085, 0.02), color: body }));
    for (const g of reel) {
      const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
      for (let j = 0; j < p.count; j++) push(0.02, [p.getX(j), p.getY(j), p.getZ(j)], [n.getX(j), n.getY(j), n.getZ(j)], [c.getX(j), c.getY(j), c.getZ(j)], 0);
    }
    this.local = new Float32Array(vs); this.localN = new Float32Array(ns); this.grow = Uint8Array.from(grow);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vs.length), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(ns.length), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cs), 3));
    this.mesh = new THREE.Mesh(geo, storyMaterial(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x5a5a5a })));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    // the frames we need: every distinct s, and for each vertex the index of its frame
    this.keys = [...new Set(fr)].sort((a, b) => a - b);
    const radius = (s) => { let r = S[0].r; for (const st of S) if (st.s <= s) r = st.r; return r; };
    this.frames = this.keys.map((s) => ({ s, r: radius(s), P: V3(), T: V3(), D: V3(), B: V3(), k: 1 }));
    const index = new Map(this.keys.map((s, i) => [s, i]));
    this.fi = Uint16Array.from(fr, (s) => index.get(s));
    this.tip = V3();
  }

  // grip: world point of the reel seat. dir: unit rod direction. bend 0..1, pull: world point the line pulls toward (or null).
  // cam + pxAng: to keep the thin end at least about a pixel wide.
  pose(grip, dir, bend, pull, cam, pxAng) {
    const L = ROD.length;
    // bend toward the pull, most of it near the tip (a fast-action rod)
    const n = V3();
    if (pull) { n.copy(pull).sub(grip).normalize(); }
    else n.copy(DOWN);
    const along = n.dot(dir);
    n.addScaledVector(dir, -along);
    if (n.lengthSq() < 1e-6) n.copy(DOWN).addScaledVector(dir, -DOWN.dot(dir));
    if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
    n.normalize();
    const phi = clamp(bend, 0, 1) * 1.25 * (pull ? clamp(Math.sqrt(1 - along * along) + 0.25, 0.3, 1) : 1) + 0.04;
    const P = V3().copy(grip), T = V3().copy(dir), tmp = V3();
    // a light load bends only the tip; a heavy one works down into the butt
    const act = 2.3 - 1.1 * clamp(bend, 0, 1);
    let s = 0;
    const setFrame = (f, pos, tan) => {
      f.P.copy(pos); f.T.copy(tan);
      f.D.copy(DOWN).addScaledVector(tan, -DOWN.dot(tan));
      if (f.D.lengthSq() < 1e-6) f.D.copy(n);
      f.D.normalize();
      f.B.crossVectors(f.T, f.D);
      f.k = Math.max(1, (pos.distanceTo(cam) * pxAng * 0.6) / f.r);
    };
    for (const f of this.frames) {
      const key = f.s;
      if (key <= 0) { setFrame(f, tmp.copy(grip).addScaledVector(dir, key), dir); continue; }
      // integrate the bent curve up to this station in small steps
      while (s < key - 1e-6) {
        const ds = Math.min(0.04, key - s), a = phi * ((s + ds / 2) / L) ** act;
        T.copy(dir).multiplyScalar(Math.cos(a)).addScaledVector(n, Math.sin(a));
        P.addScaledVector(T, ds);
        s += ds;
      }
      const a = phi * (s / L) ** act;
      T.copy(dir).multiplyScalar(Math.cos(a)).addScaledVector(n, Math.sin(a)).normalize();
      setFrame(f, P, T);
    }
    const tf = this.frames[this.frames.length - 1];
    this.tip.copy(tf.P).addScaledVector(tf.D, 0.004 * tf.k);
    // write the vertices
    const pa = this.mesh.geometry.attributes.position, na = this.mesh.geometry.attributes.normal;
    const p = pa.array, q = na.array, lo = this.local, ln = this.localN, fi = this.fi, F = this.frames;
    for (let i = 0, N = fi.length; i < N; i++) {
      const f = F[fi[i]], g = this.grow[i];
      const k = g ? f.k : 1;
      const x = lo[i * 3] * k, y = lo[i * 3 + 1] * k, z = lo[i * 3 + 2] * k;
      p[i * 3] = f.P.x + f.T.x * x + f.D.x * y + f.B.x * z;
      p[i * 3 + 1] = f.P.y + f.T.y * x + f.D.y * y + f.B.y * z;
      p[i * 3 + 2] = f.P.z + f.T.z * x + f.D.z * y + f.B.z * z;
      const a = ln[i * 3], b = ln[i * 3 + 1], c = ln[i * 3 + 2];
      q[i * 3] = f.T.x * a + f.D.x * b + f.B.x * c;
      q[i * 3 + 1] = f.T.y * a + f.D.y * b + f.B.y * c;
      q[i * 3 + 2] = f.T.z * a + f.D.z * b + f.B.z * c;
    }
    pa.needsUpdate = true; na.needsUpdate = true;
    return this.tip;
  }
}

/* ---------------- the line ---------------- */

// A thin ribbon that always faces the camera, about a pixel and a half wide, with a sag.
export class Line {
  constructor() {
    this.N = 44;
    const N = this.N, geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xf2f0c8, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.pts = Array.from({ length: N }, V3);
  }
  build(from, to, slack, flying, cam, pxAng) {
    const N = this.N, pts = this.pts;
    const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    // a flying line is pulled nearly straight by the lure; a slack one bellies down to the water
    const sag = flying ? len * 0.006 : len * (0.01 + clamp(slack, 0, 1) * 0.22);
    for (let i = 0; i < N; i++) {
      // in flight the belly hangs near the rod; the lure end is pulled straight
      const t = i / (N - 1), tt = flying ? t ** 0.55 : t;
      const x = lerp(from.x, to.x, t), y0 = lerp(from.y, to.y, t), z = lerp(from.z, to.z, t);
      let y = y0 - sag * 4 * tt * (1 - tt);
      // slack line lies on the water instead of sinking with its sag
      y = Math.max(y, Math.min(y0, 0.012));
      pts[i].set(x, y, z);
    }
    const p = this.mesh.geometry.attributes.position.array, tan = V3(), view = V3(), side = V3();
    for (let i = 0; i < N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
      tan.subVectors(b, a).normalize();
      view.subVectors(cam, pts[i]);
      const d = view.length();
      side.crossVectors(tan, view).normalize().multiplyScalar(Math.max(0.0005, d * pxAng * 0.6));
      p[i * 6] = pts[i].x - side.x; p[i * 6 + 1] = pts[i].y - side.y; p[i * 6 + 2] = pts[i].z - side.z;
      p[i * 6 + 3] = pts[i].x + side.x; p[i * 6 + 4] = pts[i].y + side.y; p[i * 6 + 5] = pts[i].z + side.z;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

/* ---------------- the lure ---------------- */

// A chrome look without an environment map: a tiny painted sphere of sky, horizon and dark water.
function matcap() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const x = cv.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, "#bcd6ec"); g.addColorStop(0.5, "#fff2d0"); g.addColorStop(0.56, "#6a6258"); g.addColorStop(1, "#2a2e30");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const r = x.createRadialGradient(22, 20, 1, 22, 20, 14);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = r; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
function glintTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const x = cv.getContext("2d");
  const r = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,240,1)"); r.addColorStop(0.15, "rgba(255,245,200,0.8)"); r.addColorStop(1, "rgba(255,230,160,0)");
  x.fillStyle = r; x.fillRect(0, 0, 64, 64);
  x.fillStyle = "rgba(255,255,240,0.9)";
  x.fillRect(31, 2, 2, 60); x.fillRect(2, 31, 60, 2);
  return new THREE.CanvasTexture(cv);
}

export class Lure {
  constructor() {
    this.fx = fxUniforms();
    const M = () => new THREE.Matrix4(), parts = [];
    const red = hex("#d42a24"), white = hex("#f4f2ea"), wire = hex("#b8bcc0"), hook = hex("#3a3d40"), feather = hex("#e8e8e0");
    // the shaft runs along z; the nose (line eye) is at -z
    parts.push(bake(new THREE.CylinderGeometry(0.0009, 0.0009, 0.07, 4).rotateX(Math.PI / 2), { matrix: M().makeTranslation(0, 0, -0.005), color: wire }));
    parts.push(bake(new THREE.TorusGeometry(0.003, 0.0008, 4, 8), { matrix: M().makeRotationY(Math.PI / 2).setPosition(0, 0, -0.042), color: wire }));
    parts.push(bake(new THREE.SphereGeometry(0.004, 8, 6), { matrix: M().makeTranslation(0, 0, -0.012), color: red }));
    parts.push(bake(new THREE.SphereGeometry(0.0035, 8, 6), { matrix: M().makeTranslation(0, 0, -0.005), color: white }));
    const body = new THREE.CylinderGeometry(0.0055, 0.0045, 0.02, 10); body.rotateX(Math.PI / 2);
    parts.push(bake(body, { matrix: M().makeTranslation(0, 0, 0.009), colorFn: (x, y, z) => (Math.floor((z + 0.02) * 250) % 2 ? red : white) }));
    // the treble hook: three curved points around the shaft, and a white tuft
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([V3().set(0, 0, 0.02), V3().set(0, 0.002, 0.032), V3().set(0, 0.008, 0.04), V3().set(0, 0.012, 0.034), V3().set(0, 0.011, 0.028)]);
      const tube = new THREE.TubeGeometry(curve, 8, 0.0007, 3, false);
      tube.rotateZ(a);
      parts.push(bake(tube, { color: hook }));
    }
    const tuft = new THREE.ConeGeometry(0.006, 0.02, 6, 1, true); tuft.rotateX(-Math.PI / 2);
    parts.push(bake(tuft, { matrix: M().makeTranslation(0, 0, 0.03), color: feather }));
    this.body = new THREE.Mesh(merge(parts), fx(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x666666, transparent: true, side: THREE.DoubleSide }), this.fx, { wag: false }));
    // the blade: a willow-leaf spoon on a clevis, turning around the shaft
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.quadraticCurveTo(0.011, 0.006, 0.009, 0.02); shape.quadraticCurveTo(0.004, 0.032, 0, 0.034); shape.quadraticCurveTo(-0.004, 0.032, -0.009, 0.02); shape.quadraticCurveTo(-0.011, 0.006, 0, 0);
    const bg = new THREE.ShapeGeometry(shape, 4);
    const bp = bg.attributes.position;
    for (let i = 0; i < bp.count; i++) { const xx = bp.getX(i); bp.setZ(i, -xx * xx * 12); }
    bg.computeVertexNormals();
    bg.rotateX(Math.PI / 2 + 0.45);
    bg.translate(0, 0.004, -0.018);
    this.blade = new THREE.Mesh(bg, fx(new THREE.MeshMatcapMaterial({ matcap: matcap(), side: THREE.DoubleSide, transparent: true }), this.fx, { wag: false }));
    this.spinner = new THREE.Group();
    this.spinner.add(this.blade);
    this.group = new THREE.Group();
    this.group.add(this.body, this.spinner);
    this.body.renderOrder = 13; this.blade.renderOrder = 13;
    this.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), color: 0xfff4d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    this.glint.renderOrder = 14;
    this.spinA = 0;
    this.q = new THREE.Quaternion();
  }
}
