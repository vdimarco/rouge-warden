// Everything in the world is built from simple shapes here: the crew, the critters, the bosses, and the buildings.
// Toon materials give the flat, painted look. A dark shell behind each character draws its outline.
import * as THREE from "three";
import * as GLB from "./glb.js";

const cache = new Map();
let gradient = null;
export function gradientMap() {
  if (gradient) return gradient;
  // five soft bands of light: painted shade, not hard cartoon shadow
  const steps = [105, 150, 198, 236, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}
export function toon(color, extra = {}) {
  const key = typeof color === "number" && !Object.keys(extra).length ? color : null;
  if (key !== null && cache.has(key)) return cache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...extra });
  if (key !== null) cache.set(key, m);
  return m;
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x3a2a20, side: THREE.BackSide });

function mesh(geo, mat, x = 0, y = 0, z = 0, outline = true, thick = 0.045) {
  const m = new THREE.Mesh(geo, typeof mat === "number" ? toon(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (outline) {
    const o = new THREE.Mesh(geo, OUTLINE);
    geo.computeBoundingSphere();
    const r = geo.boundingSphere.radius || 1;
    o.scale.setScalar(1 + thick / r);
    o.userData.outline = true;
    m.add(o);
  }
  return m;
}
const put = (p, c) => (p.add(c), c);
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
const cyl = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/* ---------------- the crew ---------------- */
// Colors come from the crew art in /fall/art.
export const LOOKS = [
  { skin: 0xe0a882, shirt: 0xd22a2a, trim: 0xffffff, sleeves: false, shorts: 0x243a6a, shoes: 0xf2f2f2, shoe2: 0xc81e1e, hat: 0x1f2c4a, hatBack: false, beard: 0x6a4a30, glasses: 0x3a2a1a, hair: 0x5a4030, model: "crew1" },
  { skin: 0xd6a07a, shirt: 0x1d2c5e, trim: 0xc8283a, sleeves: true, shorts: 0x26262a, shoes: 0x2a3a78, shoe2: 0xffffff, hat: 0x2e8a3e, hatBack: true, beard: 0x3a2a1e, glasses: 0, hair: 0x3a2a1e, number: "51", model: "crew2" },
  { skin: 0x9a6848, shirt: 0x1c1c1e, trim: 0x2a2a2e, sleeves: true, shorts: 0x3a3a40, long: true, shoes: 0x151515, shoe2: 0xffffff, hat: 0x121214, hatBack: false, beard: 0x1a1210, glasses: 0x2a6ac8, hair: 0x1a1210, model: "crew3" },
  { skin: 0xe2b08a, shirt: 0x1c1c1e, trim: 0x2a2a2e, sleeves: true, shorts: 0x6a6a6e, shoes: 0x9a9aa2, shoe2: 0xffffff, hat: 0xe8e8ea, hatBack: true, beard: 0x3a2618, glasses: 0x6a4a2a, clear: true, hair: 0x3a2618, model: "crew4" },
  { skin: 0xe6b28e, shirt: 0xd8302a, trim: 0xffffff, sleeves: true, buttons: true, shorts: 0x1a1a1c, shoes: 0xf4f4f4, shoe2: 0xc8201e, hat: 0x141416, hatBack: true, beard: 0, glasses: 0x2a7ae0, hair: 0x2a1a10, model: "crew5" },
];

// A person: legs, body, arms, and a big head. Returns the rig with joints the animation moves.
export function person(look, scale = 1) {
  // the painted 3D model, when it loaded
  const glb = look.model && GLB.person(look.model, scale);
  if (glb) { glb.look = look; return glb; }
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const S = look;
  const hips = new THREE.Group(); hips.position.y = 0.78; body.add(hips);
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * 0.16, 0, 0); hips.add(leg);
    const thigh = mesh(cap(0.12, S.long ? 0.42 : 0.22), S.long ? S.shorts : S.shorts, 0, S.long ? -0.3 : -0.18, 0);
    leg.add(thigh);
    if (!S.long) leg.add(mesh(cap(0.095, 0.3), S.skin, 0, -0.45, 0));
    leg.add(mesh(cyl(0.1, 0.1, 0.08), 0xf4f4f0, 0, -0.62, 0, false));
    const shoe = mesh(box(0.2, 0.14, 0.32), S.shoes, 0, -0.71, 0.05);
    shoe.add(mesh(box(0.21, 0.05, 0.33), S.shoe2, 0, -0.05, 0, false));
    leg.add(shoe);
    legs.push(leg);
  }
  const torso = new THREE.Group(); torso.position.y = 0.8; body.add(torso);
  const shirt = mesh(cap(0.27, 0.34), S.shirt, 0, 0.3, 0);
  shirt.scale.set(1.08, 1, 0.8);
  torso.add(shirt);
  put(torso, mesh(cyl(0.285, 0.29, 0.08, 14), S.shorts, 0, 0.02, 0, false)).scale.set(1.08, 1, 0.8);
  if (S.number) torso.add(numberPlate(S.number, S.trim));
  if (S.buttons) for (let k = 0; k < 3; k++) torso.add(mesh(sph(0.025, 6, 4), 0xffffff, 0, 0.18 + k * 0.13, 0.225, false));
  put(torso, mesh(cyl(0.2, 0.22, 0.05, 14), S.trim, 0, 0.66, 0.02, false)).scale.set(1, 1, 0.9);
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.34, 0.56, 0); torso.add(arm);
    if (S.sleeves) arm.add(mesh(cap(0.105, 0.1), S.shirt, 0, -0.08, 0));
    arm.add(mesh(cap(0.085, 0.36), S.skin, 0, -0.26, 0));
    const hand = mesh(sph(0.1, 10, 8), S.skin, 0, -0.5, 0.02);
    arm.add(hand);
    arm.rotation.z = side * 0.18;
    arms.push(arm);
  }
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head);
  const skull = mesh(sph(0.36, 18, 14), S.skin, 0, 0.3, 0);
  skull.scale.set(1, 1.02, 0.95);
  head.add(skull);
  head.add(mesh(sph(0.07, 8, 6), S.skin, -0.35, 0.28, 0, false));
  head.add(mesh(sph(0.07, 8, 6), S.skin, 0.35, 0.28, 0, false));
  head.add(mesh(sph(0.05, 8, 6), 0xd08a6a, 0, 0.24, 0.35, false));
  if (S.beard) {
    const b = mesh(sph(0.34, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), S.beard, 0, 0.26, 0.03, false);
    b.geometry = new THREE.SphereGeometry(0.345, 16, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48);
    b.scale.set(1, 1.02, 0.97);
    head.add(b);
    put(head, mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12, Math.PI), 0xa05a4a, 0, 0.16, 0.33, false)).rotation.z = Math.PI;
  } else {
    put(head, mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI), 0xa0503a, 0, 0.17, 0.33, false)).rotation.z = Math.PI;
  }
  if (S.glasses) {
    const g = new THREE.Group(); g.position.set(0, 0.36, 0.3); head.add(g);
    for (const s of [-1, 1]) g.add(mesh(box(0.2, 0.12, 0.04), S.clear ? toon(0xcfe6ff, { transparent: true, opacity: 0.45 }) : S.glasses, s * 0.12, 0, 0.02, false));
    g.add(mesh(box(0.5, 0.03, 0.03), 0x1a1a1a, 0, 0.05, 0, false));
    if (S.clear) for (const s of [-1, 1]) g.add(mesh(sph(0.035, 8, 6), 0x1a1210, s * 0.12, 0, -0.02, false));
  } else {
    for (const s of [-1, 1]) {
      head.add(mesh(sph(0.055, 10, 8), 0xffffff, s * 0.13, 0.35, 0.3, false));
      head.add(mesh(sph(0.035, 8, 6), 0x1a1210, s * 0.13, 0.35, 0.345, false));
    }
  }
  for (const s of [-1, 1]) head.add(mesh(box(0.13, 0.03, 0.03), S.hair, s * 0.13, 0.45, 0.32, false));
  // the cap: a dome and a brim, forward or backward
  const hat = new THREE.Group(); hat.position.y = 0.36; head.add(hat);
  hat.add(mesh(new THREE.SphereGeometry(0.375, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), S.hat, 0, 0.04, 0, true));
  const brim = mesh(box(0.42, 0.04, 0.3), S.hat, 0, 0.05, 0.4, false);
  hat.add(brim);
  if (S.hatBack) hat.rotation.y = Math.PI;
  // the weapon hand and the glider
  const grip = new THREE.Group(); grip.position.set(0, -0.52, 0.04); arms[1].add(grip);
  const glider = umbrella(); glider.visible = false; glider.position.set(0, 2.25, 0); root.add(glider);
  root.scale.setScalar(scale);
  return { root, body, hips, torso, head, legs, arms, grip, glider, look };
}

function numberPlate(txt, color) {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const x = c.getContext("2d");
  x.font = "bold 44px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.lineWidth = 6; x.strokeStyle = "#" + color.toString(16).padStart(6, "0"); x.fillStyle = "#fff";
  x.strokeText(txt, 32, 34); x.fillText(txt, 32, 34);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  m.position.set(0, 0.34, 0.23);
  return m;
}

// The glider: a striped beach umbrella.
GLB.setUmbrellaMaker(() => umbrella());
function umbrella() {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(1.6, 0.6, 16, 1, true).toNonIndexed();
  const cols = []; const pos = geo.attributes.position;
  // one stripe per two panels, red and white, like a beach umbrella
  for (let i = 0; i < pos.count; i += 3) {
    let cx = 0, cz = 0; for (let v = 0; v < 3; v++) { cx += pos.getX(i + v); cz += pos.getZ(i + v); }
    const k = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 8) % 2;
    const c = new THREE.Color(k ? 0xffffff : 0xe8483a);
    for (let v = 0; v < 3; v++) cols.push(c.r, c.g, c.b);
  }
  geo.computeVertexNormals();
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const canopy = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(), side: THREE.DoubleSide }));
  canopy.castShadow = true;
  g.add(canopy);
  const pole = new THREE.Mesh(cyl(0.03, 0.03, 1.6), toon(0xe8e0d0)); pole.position.y = -0.7; g.add(pole);
  return g;
}

/* ---------------- weapons ---------------- */
export function weaponMesh(id) {
  const g = new THREE.Group();
  const stick = (len, col, r = 0.035) => { const m = mesh(cyl(r, r, len), col, 0, len / 2 - 0.1, 0, true, 0.02); g.add(m); return m; };
  if (id === "plunger" || id === "golden") {
    const gold = id === "golden";
    stick(1.0, gold ? 0xf2c230 : 0xb07a3a);
    const cup = mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), gold ? toon(0xffd84a, { emissive: 0x6a4a00 }) : 0xd2202a, 0, 1.0, 0, true, 0.03);
    cup.rotation.x = Math.PI;
    g.add(cup);
  } else if (id === "paddle") {
    stick(1.1, 0xc89a5a, 0.04);
    const blade = mesh(box(0.28, 0.6, 0.05), 0xc89a5a, 0, 1.2, 0, true, 0.02);
    g.add(blade);
    g.add(mesh(box(0.14, 0.05, 0.06), 0xc89a5a, 0, -0.1, 0, false));
  } else if (id === "stick") {
    stick(1.2, 0x2a2a2a, 0.035);
    const blade = mesh(box(0.08, 0.14, 0.36), 0x2a2a2a, 0, 1.1, 0.14, true, 0.02);
    g.add(blade);
    g.add(mesh(box(0.082, 0.05, 0.2), 0xffffff, 0, 1.1, 0.1, false));
  } else if (id === "rod") {
    stick(1.6, 0x3a5a8a, 0.022);
    g.add(mesh(cyl(0.06, 0.06, 0.1), 0xa0a0a0, 0.06, 0.3, 0, false));
    g.add(mesh(sph(0.05, 8, 6), 0xe82a2a, 0, 1.55, 0, false));
  } else if (id === "pan") {
    stick(0.5, 0x2a2a2a, 0.04);
    const p = mesh(cyl(0.3, 0.26, 0.08, 18), 0x3a3a3e, 0, 0.7, 0, true, 0.02);
    p.rotation.x = Math.PI / 2;
    g.add(p);
  }
  return g;
}

/* ---------------- critters ---------------- */
function eyes(parent, y, z, sep, r = 0.05, glow = 0xff3a2a) {
  for (const s of [-1, 1]) parent.add(mesh(sph(r, 8, 6), toon(glow, { emissive: glow, emissiveIntensity: 0.9 }), s * sep, y, z, false));
}
export function critter(type) {
  const glb = GLB.creature(type);
  if (glb) return glb;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const legs = [];
  const leg = (x, z, len, col, r = 0.07) => { const l = new THREE.Group(); l.position.set(x, len, z); l.add(mesh(cap(r, len * 0.8), col, 0, -len / 2, 0)); body.add(l); legs.push(l); return l; };
  let head;
  if (type === "raccoon") {
    const b = mesh(sph(0.4), 0x7c7c84, 0, 0.5, 0); b.scale.set(0.9, 0.85, 1.25); body.add(b);
    put(body, mesh(sph(0.3), 0xc8c4bc, 0, 0.45, 0.2, false)).scale.set(0.8, 0.8, 0.9);
    head = new THREE.Group(); head.position.set(0, 0.82, 0.4); body.add(head);
    head.add(mesh(sph(0.28), 0x8a8a92, 0, 0, 0));
    head.add(mesh(sph(0.14), 0xf0ece4, 0, -0.06, 0.22, false));
    head.add(mesh(box(0.5, 0.1, 0.1), 0x1e1e22, 0, 0.04, 0.2, false));
    head.add(mesh(sph(0.04, 6, 4), 0x111111, 0, -0.02, 0.36, false));
    for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.09, 0.16, 6), 0x5a5a62, s * 0.18, 0.24, -0.02); head.add(e); }
    eyes(head, 0.05, 0.25, 0.1, 0.04);
    const tail = new THREE.Group(); tail.position.set(0, 0.55, -0.45); body.add(tail);
    for (let k = 0; k < 5; k++) tail.add(mesh(sph(0.13 - k * 0.012, 8, 6), k % 2 ? 0x2a2a2e : 0xb4b0a8, 0, k * 0.07, -k * 0.13, false));
    tail.rotation.x = -0.4;
    root.userData.tail = tail;
    for (const [x, z] of [[-0.18, 0.25], [0.18, 0.25], [-0.18, -0.25], [0.18, -0.25]]) leg(x, z, 0.32, 0x3a3a3e);
    const club = mesh(cyl(0.05, 0.08, 0.8), 0x8a5a2a, 0.3, 0.6, 0.3); club.rotation.x = 0.8; body.add(club); root.userData.club = club;
  } else if (type === "goose") {
    const b = mesh(sph(0.36), 0x8a7a66, 0, 0.62, 0); b.scale.set(0.85, 0.8, 1.3); body.add(b);
    body.add(mesh(sph(0.26), 0xeae4d8, 0, 0.55, 0.22, false));
    put(body, mesh(sph(0.2), 0x4a4038, 0, 0.72, -0.38, false)).scale.set(1, 0.6, 1.2);
    head = new THREE.Group(); head.position.set(0, 0.8, 0.35); body.add(head);
    const neck = mesh(cap(0.07, 0.5), 0x1a1a1a, 0, 0.28, 0.02); head.add(neck);
    head.add(mesh(sph(0.12), 0x1a1a1a, 0, 0.6, 0.05));
    put(head, mesh(sph(0.1), 0xffffff, 0, 0.56, 0.03, false)).scale.set(1.2, 0.6, 1);
    put(head, mesh(new THREE.ConeGeometry(0.05, 0.16, 6), 0x2a2420, 0, 0.6, 0.18, false)).rotation.x = Math.PI / 2;
    eyes(head, 0.64, 0.12, 0.06, 0.025);
    leg(-0.12, 0, 0.35, 0x1a1a1a, 0.035); leg(0.12, 0, 0.35, 0x1a1a1a, 0.035);
    const wings = [];
    for (const s of [-1, 1]) { const w = mesh(sph(0.25), 0x6a5a4a, s * 0.28, 0.7, -0.05); w.scale.set(0.3, 0.6, 1.2); body.add(w); wings.push(w); }
    root.userData.wings = wings;
  } else if (type === "bear") {
    const b = mesh(sph(0.8), 0x1e1a1a, 0, 1.0, 0); b.scale.set(0.95, 0.85, 1.35); body.add(b);
    head = new THREE.Group(); head.position.set(0, 1.35, 1.0); body.add(head);
    head.add(mesh(sph(0.46), 0x221c1c, 0, 0, 0));
    put(head, mesh(sph(0.2), 0xb08a5a, 0, -0.1, 0.38, false)).scale.set(1, 0.8, 1);
    head.add(mesh(sph(0.07, 8, 6), 0x0a0a0a, 0, -0.02, 0.56, false));
    for (const s of [-1, 1]) head.add(mesh(sph(0.14), 0x221c1c, s * 0.34, 0.34, -0.05));
    eyes(head, 0.12, 0.38, 0.16, 0.05);
    for (const [x, z] of [[-0.45, 0.6], [0.45, 0.6], [-0.45, -0.6], [0.45, -0.6]]) leg(x, z, 0.62, 0x1a1616, 0.2);
  } else if (type === "moose") {
    const b = mesh(sph(1.0), 0x5a3a24, 0, 2.2, 0); b.scale.set(0.8, 0.8, 1.5); body.add(b);
    put(body, mesh(sph(0.7), 0x4a2e1c, 0, 2.55, 0.7, false)).scale.set(0.9, 0.9, 1);
    head = new THREE.Group(); head.position.set(0, 2.6, 1.6); body.add(head);
    const h = mesh(sph(0.42), 0x4a2e1c, 0, 0, 0.2); h.scale.set(0.8, 0.9, 1.5); head.add(h);
    put(head, mesh(sph(0.2), 0x2a1a10, 0, -0.35, 0.3, false)).scale.set(1, 1.5, 0.6);
    for (const s of [-1, 1]) {
      const a = mesh(sph(0.6), 0xd8c49a, s * 0.75, 0.55, -0.1); a.scale.set(1, 0.18, 0.7); a.rotation.z = s * 0.35; head.add(a);
      for (let k = 0; k < 4; k++) head.add(mesh(new THREE.ConeGeometry(0.06, 0.3, 5), 0xd8c49a, s * (0.5 + k * 0.2), 0.78 + k * 0.03, -0.3 + k * 0.1, false));
    }
    eyes(head, 0.12, 0.45, 0.22, 0.06);
    for (const [x, z] of [[-0.45, 0.8], [0.45, 0.8], [-0.45, -0.8], [0.45, -0.8]]) leg(x, z, 1.7, 0x3a2416, 0.14);
  } else if (type === "skeeter") {
    head = new THREE.Group(); body.add(head);
    const b = mesh(sph(0.16), 0x3a3a2a, 0, 0, 0); b.scale.set(0.7, 0.7, 1.6); head.add(b);
    put(head, mesh(cyl(0.01, 0.02, 0.4), 0x222222, 0, 0, 0.35, false)).rotation.x = Math.PI / 2;
    eyes(head, 0.06, 0.12, 0.06, 0.035);
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.2), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      w.position.set(s * 0.25, 0.1, 0); head.add(w); wings.push(w);
    }
    root.userData.wings = wings;
    body.position.y = 1.4;
  }
  return { root, body, head, legs };
}

// A walking or running stride for any person rig, driven by the distance covered: knees lift through the swing,
// elbows bend and pump against the legs, and the hips bob as each foot lands. sp is the speed in m/s.
export function stridePose(r, ph, sp) {
  const m = Math.min(1, sp / 1.5), x = Math.min(1, Math.max(0, (sp - 2.5) / 3)), run = x * x * (3 - 2 * x), sn = Math.sin(ph);
  const [lL, lR] = r.legs, [aL, aR] = r.arms, hip = (0.45 + 0.25 * run) * m, lean = 0.04 * Math.min(1, sp / 6) + 0.1 * run;
  lL.rotation.set(-sn * hip - lean * 1.2, 0, 0); lR.rotation.set(sn * hip - lean * 1.2, 0, 0);
  const arm = (0.35 + 0.4 * run) * m;
  aL.rotation.set(sn * arm - 0.15 * run, 0, -0.16 - 0.06 * run); aR.rotation.set(-sn * arm * 0.8 - 0.15 * run, 0, 0.16 + 0.06 * run);
  if (r.knees) {
    const lift = (0.55 + 0.95 * run) * m, stand = (0.12 + 0.18 * run) * m;
    r.knees[0].rotation.x = stand + lift * Math.pow(Math.max(0, Math.cos(ph - 0.35)), 1.3) + 0.001;
    r.knees[1].rotation.x = stand + lift * Math.pow(Math.max(0, Math.cos(ph + Math.PI - 0.35)), 1.3) + 0.001;
    const el = 0.35 + 1.05 * run;
    r.elbows[0].rotation.x = el + Math.max(0, -aL.rotation.x) * 0.3; r.elbows[1].rotation.x = el + Math.max(0, -aR.rotation.x) * 0.3;
  }
  if (r.torso) r.torso.rotation.y = sn * (0.1 + 0.08 * run) * m;
  if (r.head) r.head.rotation.y = -sn * (0.08 + 0.06 * run) * m;
  r.body.rotation.x = lean;
  r.body.position.y = (0.03 + 0.07 * run) * m * sn * sn - 0.05 * run;
}
// the stride cycle grows with speed, so feet neither skate nor flail
export const strideRate = (sp) => (Math.PI * 2 * sp) / (1.4 + sp * 0.33);

/* ---------------- bosses ---------------- */
export function boss(id) {
  if (id === "king") return GLB.creature("king") || king();
  const glb = GLB.person(id, 2.1);
  if (glb) {
    if (id === "gabe") { const axe = new THREE.Group(); axe.add(mesh(cyl(0.05, 0.05, 1.4), 0x7a4a24, 0, 0.6, 0)); axe.add(mesh(box(0.08, 0.36, 0.44), 0x9aa0a8, 0, 1.2, 0.2)); axe.rotation.x = Math.PI / 2; glb.grip.add(axe); }
    else { const w = weaponMesh("plunger"); w.rotation.x = Math.PI / 2; glb.grip.add(w); }
    return glb;
  }
  const looks = {
    gabe: { skin: 0xcfa088, shirt: 0xa8c040, trim: 0x8a2a2a, sleeves: true, shorts: 0x3a3a40, long: true, shoes: 0x2a2018, shoe2: 0x1a120c, hat: 0x141414, hatBack: false, beard: 0x9a9a9a, glasses: 0, hair: 0x8a8a8a },
    christian: { skin: 0xb07a52, shirt: 0x151515, trim: 0x151515, sleeves: true, shorts: 0x1e2e4a, shoes: 0x2a2a2a, shoe2: 0x111111, hat: 0x0e0a08, hatBack: false, beard: 0x1a120c, glasses: 0, hair: 0x0e0a08, curly: true },
    ryu: { skin: 0xc08a62, shirt: 0xe8e4dc, trim: 0xd8d0c4, sleeves: true, buttons: true, shorts: 0x1e2230, shoes: 0x1a1a1a, shoe2: 0x5a5a5a, hat: 0x0e0a08, hatBack: false, beard: 0, glasses: 0, hair: 0x0e0a08, bun: true },
  };
  const L = looks[id];
  const p = person(L, 2.1);
  // red eyes: the sludge has them
  const head = p.head;
  head.children.filter((c) => c.geometry && c.geometry.type === "SphereGeometry" && Math.abs(c.position.y - 0.35) < 0.01).forEach((c) => (c.visible = false));
  for (const s of [-1, 1]) {
    const e = mesh(sph(0.07, 8, 6), toon(0xff2a1a, { emissive: 0xff2a1a, emissiveIntensity: 1.4 }), s * 0.13, 0.36, 0.32, false);
    head.add(e);
  }
  if (L.curly) { const hat = head.children.find((c) => c.type === "Group"); hat.visible = false; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; head.add(mesh(sph(0.13, 8, 6), 0x0e0a08, Math.cos(a) * 0.3, 0.55 + Math.sin(k * 1.7) * 0.08, Math.sin(a) * 0.28 - 0.04, false)); } }
  if (L.bun) { const hat = head.children.find((c) => c.type === "Group"); hat.children.forEach((c, i) => { if (i === 1) c.visible = false; }); head.add(mesh(sph(0.16), 0x0e0a08, 0, 0.78, -0.12)); head.add(mesh(box(0.26, 0.04, 0.04), 0x0e0a08, 0, 0.21, 0.35, false)); }
  if (id === "christian") {
    // palm tree print on the shorts
    p.legs.forEach((l) => l.children[0].material = palmsMaterial());
    p.grip.add(weaponMesh("plunger"));
  }
  if (id === "ryu") {
    const bag = mesh(box(0.4, 0.34, 0.14), 0x1a1a1a, 0.3, 0.1, 0.18); p.torso.add(bag);
    put(p.torso, mesh(box(0.06, 0.9, 0.04), 0x1a1a1a, 0, 0.4, 0.23, false)).rotation.z = 0.6;
    p.grip.add(weaponMesh("plunger"));
  }
  if (id === "gabe") {
    const axe = new THREE.Group();
    axe.add(mesh(cyl(0.05, 0.05, 1.4), 0x7a4a24, 0, 0.6, 0));
    axe.add(mesh(box(0.08, 0.36, 0.44), 0x9aa0a8, 0, 1.2, 0.2));
    p.grip.add(axe);
  }
  return p;
}
let palms = null;
function palmsMaterial() {
  if (palms) return palms;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d"); x.fillStyle = "#1e2e4a"; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = "#dfe6ea"; x.lineWidth = 2;
  for (const [px, py] of [[14, 16], [46, 30], [22, 50]]) { for (let a = 0; a < 5; a++) { x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a * 1.25 - 2) * 9, py + Math.sin(a * 1.25 - 2) * 9); x.stroke(); } x.beginPath(); x.moveTo(px, py); x.lineTo(px + 2, py + 10); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  palms = new THREE.MeshToonMaterial({ map: t, gradientMap: gradientMap() });
  return palms;
}

// The Porcelain King: a toilet with a crown, a lid for a mouth, and a bad attitude.
function king() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const white = toon(0xf2f4f6);
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.9 + Math.sin(t * Math.PI) * 0.9 - t * 0.2, t * 2)); }
  const bowl = mesh(new THREE.LatheGeometry(pts, 20), white, 0, 0, 0.4); body.add(bowl);
  bowl.add(mesh(cyl(1.35, 1.35, 0.1, 20), 0x5a3a6a, 0, 1.96, 0, false));
  body.add(mesh(cyl(0.8, 1.0, 0.6, 16), white, 0, 0.3, 0.4));
  const tank = mesh(box(2.6, 2.4, 1.0), white, 0, 3.0, -1.0); body.add(tank);
  tank.add(mesh(box(2.8, 0.2, 1.2), white, 0, 1.3, 0));
  tank.add(mesh(box(0.4, 0.14, 0.14), 0xc0c4c8, 1.1, 0.8, 0.56, false));
  const head = new THREE.Group(); head.position.set(0, 3.2, -0.4); body.add(head);
  for (const s of [-1, 1]) head.add(mesh(sph(0.26, 10, 8), toon(0xff2a1a, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }), s * 0.6, 0.2, 0, false));
  for (const s of [-1, 1]) { const b = mesh(box(0.7, 0.12, 0.1), 0x2a1a1a, s * 0.6, 0.55, 0.02, false); b.rotation.z = -s * 0.35; head.add(b); }
  const lid = new THREE.Group(); lid.position.set(0, 2.05, -0.55); body.add(lid);
  const lidm = mesh(cyl(1.3, 1.3, 0.14, 20), white, 0, 0, 1.0); lidm.scale.z = 1.1; lid.add(lidm);
  lid.rotation.x = -1.2;
  const crown = new THREE.Group(); crown.position.set(0, 4.5, -1.0); body.add(crown);
  const gold = toon(0xffc83a, { emissive: 0x5a3a00 });
  crown.add(mesh(cyl(0.9, 0.9, 0.4, 16, 1, true), gold, 0, 0, 0));
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; crown.add(mesh(new THREE.ConeGeometry(0.18, 0.5, 5), gold, Math.cos(a) * 0.85, 0.4, Math.sin(a) * 0.85)); crown.add(mesh(sph(0.08, 6, 4), 0xd8203a, Math.cos(a) * 0.85, 0.7, Math.sin(a) * 0.85, false)); }
  root.scale.setScalar(1.6);
  return { root, body, head, lid, legs: [] };
}

/* ---------------- buildings and props ---------------- */
function logWall(g, len, h, x, z, rot, col = 0x9a6a3e) {
  const w = new THREE.Group(); w.position.set(x, 0, z); w.rotation.y = rot; g.add(w);
  const n = Math.round(h / 0.4);
  for (let k = 0; k < n; k++) { const l = mesh(cyl(0.21, 0.21, len + 0.5, 8), k % 2 ? col : 0x8a5a32, 0, 0.22 + k * 0.4, 0, false); l.rotation.z = Math.PI / 2; l.receiveShadow = true; w.add(l); }
  return w;
}
export function cabin() {
  const glb = GLB.building("cabin");
  if (glb) {
    // a warm lamp inside, for the windows at night
    const lamp = new THREE.PointLight(0xffb060, 0, 22, 1.5); lamp.position.set(0, 2.2, 0); glb.add(lamp);
    glb.userData.lamp = lamp; glb.userData.windows = toon(0xffd07a, { emissive: 0xffa040 });
    return glb;
  }
  const g = new THREE.Group();
  const W = 10, D = 8, H = 3.6;
  logWall(g, W, H, 0, D / 2, 0); logWall(g, W, H, 0, -D / 2, 0); logWall(g, D, H, W / 2, 0, Math.PI / 2); logWall(g, D, H, -W / 2, 0, Math.PI / 2);
  const floor = mesh(box(W, 0.3, D), 0x7a5a3a, 0, 0.15, 0, false); floor.receiveShadow = true; g.add(floor);
  // gables and roof
  const gable = new THREE.Shape(); gable.moveTo(-D / 2 - 0.3, 0); gable.lineTo(D / 2 + 0.3, 0); gable.lineTo(0, 2.8); gable.closePath();
  for (const s of [-1, 1]) { const m = mesh(new THREE.ShapeGeometry(gable), toon(0x8a5a32, { side: THREE.DoubleSide }), s * W / 2, H + 0.1, 0, false); m.rotation.y = Math.PI / 2; g.add(m); }
  const slope = Math.atan2(2.8, D / 2 + 0.3), len = Math.hypot(2.8, D / 2 + 0.3) + 0.6;
  for (const s of [-1, 1]) { const r = mesh(box(W + 1.4, 0.28, len), 0x4a7a4a, 0, H + 1.4, s * (D / 4 + 0.15)); r.rotation.x = s * slope; g.add(r); }
  g.add(mesh(box(1, 3, 1), 0x8a8a8a, 2.5, H + 2.2, -1.2));
  // door and windows, which glow at night
  const glow = toon(0xffd07a, { emissive: 0xffa040, emissiveIntensity: 0 });
  g.userData.windows = glow;
  g.add(mesh(box(1.3, 2.2, 0.2), 0x5a3a24, 0, 1.4, D / 2 + 0.2, false));
  for (const x of [-3, 3]) { g.add(mesh(box(1.4, 1.1, 0.2), glow, x, 2, D / 2 + 0.2, false)); g.add(mesh(box(1.6, 0.14, 0.3), 0xf0e8d0, x, 1.4, D / 2 + 0.25, false)); }
  for (const x of [-W / 2 - 0.2, W / 2 + 0.2]) g.add(mesh(box(0.2, 1.1, 1.4), glow, x, 2, 0, false));
  // porch
  g.add(mesh(box(W, 0.2, 2.4), 0x9a7a52, 0, 0.3, D / 2 + 1.3, false));
  for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) g.add(mesh(cyl(0.12, 0.12, 3), 0x7a5a3a, x, 1.7, D / 2 + 2.3, false));
  put(g, mesh(box(W + 0.4, 0.2, 2.8), 0x4a7a4a, 0, 3.2, D / 2 + 1.3, false)).rotation.x = 0.18;
  return g;
}
export function outhouse(shrine) {
  const g = GLB.building("outhouse", 0.02) || new THREE.Group();
  if (!g.userData.size) {
    const boards = toon(0xb04a32);
    g.add(mesh(box(2, 3, 2), boards, 0, 1.5, 0, false));
    const roof = mesh(box(2.6, 0.2, 2.8), 0x4a3a2a, 0, 3.2, 0); roof.rotation.x = -0.18; g.add(roof);
    g.add(mesh(box(1.3, 2.4, 0.1), 0x8a3a24, 0, 1.3, 1.02, false));
    const moon = mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 12, Math.PI * 1.3), 0x1a0a06, 0, 2.1, 1.08, false); moon.rotation.z = 0.8; g.add(moon);
  }
  const front = g.userData.size ? g.userData.size.z / 2 + 0.04 : 1.06, wide = g.userData.size ? g.userData.size.x : 2.1;
  if (shrine) {
    const glow = new THREE.MeshBasicMaterial({ color: 0x5ef0ff });
    g.userData.glow = glow;
    for (const [w, h, x, y] of [[wide, 0.08, 0, 0.05], [wide, 0.08, 0, 2.95], [0.08, 2.9, -wide / 2, 1.5], [0.08, 2.9, wide / 2, 1.5]]) put(g, new THREE.Mesh(box(w, h, 0.06), glow)).position.set(x, y, front);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 8, 28), glow); ring.position.y = 5; ring.rotation.x = Math.PI / 2; g.add(ring); g.userData.ring = ring;
  }
  return g;
}
export function fireTower() {
  const g = new THREE.Group();
  const H = 36, wood = 0x9a6a3e;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(cyl(0.3, 0.4, H + 1, 6), wood, sx * 2.6, H / 2, sz * 2.6, false); leg.rotation.z = -sx * 0.04; leg.rotation.x = sz * 0.04; g.add(leg);
  }
  for (let y = 4; y < H; y += 6) for (const [x, z, r] of [[0, 3, 0], [0, -3, 0], [3, 0, Math.PI / 2], [-3, 0, Math.PI / 2]]) {
    const b = mesh(box(6.4, 0.25, 0.25), 0x8a5a32, x * (1 - y / H * 0.08), y, z * (1 - y / H * 0.08), false); b.rotation.y = r; g.add(b);
    const d = mesh(box(8, 0.2, 0.2), 0x8a5a32, x * (1 - y / H * 0.08), y + 3, z * (1 - y / H * 0.08), false); d.rotation.y = r; d.rotation.z = 0.7; g.add(d);
  }
  const top = new THREE.Group(); top.position.y = H; g.add(top);
  const deck = mesh(box(8, 0.4, 8), 0x7a5a3a, 0, 0, 0, false); deck.receiveShadow = true; top.add(deck);
  for (const [x, z, w, d] of [[0, 3.9, 8, 0.2], [0, -3.9, 8, 0.2], [3.9, 0, 0.2, 8], [-3.9, 0, 0.2, 8]]) top.add(mesh(box(w, 0.2, d), 0x9a6a3e, x, 0.8, z, false));
  // a flag on the corner, so you can spot a tower from far away
  top.add(mesh(cyl(0.08, 0.08, 5), 0x7a5a3a, 3.8, 2.5, 3.8, false));
  const flag = mesh(box(1.8, 1, 0.05), 0xe8483a, 4.7, 4.4, 3.8, false); top.add(flag);
  // a little roof on four posts, so the deck reads as a lookout
  for (const [x, z] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) top.add(mesh(cyl(0.14, 0.14, 4.2, 6), 0x7a5a3a, x, 2.1, z, false));
  const roof = mesh(new THREE.ConeGeometry(6.2, 2.4, 4), 0x9a4a32, 0, 5.3, 0); roof.rotation.y = Math.PI / 4; top.add(roof);
  // the signal beacon: an iron bowl of stacked wood on a stone plinth. Lit, it burns day and night.
  top.add(mesh(cyl(0.7, 0.9, 0.8, 10), 0x8a8a84, 0, 0.6, 0));
  const bowl = mesh(new THREE.SphereGeometry(1.0, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x3a3634, 0, 1.55, 0); bowl.material.side = THREE.DoubleSide; top.add(bowl);
  for (let k = 0; k < 4; k++) { const l = mesh(cyl(0.08, 0.1, 1.2, 6), 0x6a4428, Math.cos(k * 1.57) * 0.2, 1.6, Math.sin(k * 1.57) * 0.2, false); l.rotation.set(0, -k * 1.57, 0); l.rotateZ(0.6); top.add(l); }
  const beacon = campfire(true); beacon.scale.setScalar(1.25); beacon.position.y = 1.4; beacon.visible = false; top.add(beacon);
  g.userData.beacon = beacon;
  g.userData.light = () => { beacon.visible = true; };
  g.userData.H = H;
  return g;
}
// A painted campfire: flat bands of deep red, orange, and a pale core, with tongues that lick upward,
// embers that drift up, a thin wisp of smoke, and a warm pool of light on the ground.
export const fireTime = { value: 0 };
let fireMats = null;
function fireMaterials() {
  if (fireMats) return fireMats;
  const noise = `
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }`;
  // a billboard that turns to face the camera around the upright axis
  const bill = `
    uniform float uTime; attribute float aSeed; varying vec2 vUv; varying float vSeed;
    void main(){
      vUv = uv; vSeed = aSeed;
      vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      vec3 right = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
      float sc = length(modelMatrix[0].xyz);
      vec3 w = c + right * position.x * sc + vec3(0.0, position.y * sc, 0.0) + right * position.z * sc;
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    }`;
  const flame = new THREE.ShaderMaterial({
    uniforms: { uTime: fireTime }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: bill,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vSeed; ${noise}
      void main(){
        vec2 uv = vUv; float s = vSeed * 17.0;
        float n = vn(vec2(uv.x * 3.0 + s, uv.y * 2.4 - uTime * 2.6)) * 0.65 + vn(vec2(uv.x * 7.0 - s, uv.y * 5.0 - uTime * 4.2)) * 0.35;
        float x = (uv.x - 0.5) * 2.0 + (n - 0.5) * 0.9 * uv.y;
        // a teardrop: round at the base, pointed at the top, with tongues cut by the noise
        float w = (0.95 - 0.95 * pow(uv.y, 0.75)) * smoothstep(0.0, 0.12, uv.y) + 0.04;
        float body = 1.0 - smoothstep(w * 0.8, w, abs(x));
        body *= 1.0 - smoothstep(0.45 + n * 0.5, 0.6 + n * 0.5, uv.y);
        float heat = body * (1.0 - abs(x) / max(w, 0.01)) * (1.15 - uv.y);
        // flat painted bands with soft edges
        vec3 col = vec3(0.78, 0.16, 0.06);
        col = mix(col, vec3(1.0, 0.45, 0.08), smoothstep(0.16, 0.22, heat));
        col = mix(col, vec3(1.0, 0.78, 0.25), smoothstep(0.42, 0.48, heat));
        col = mix(col, vec3(1.0, 0.97, 0.78), smoothstep(0.68, 0.74, heat));
        float a = smoothstep(0.02, 0.12, body);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col * 1.25, a);
      }`,
  });
  const glow = new THREE.ShaderMaterial({
    uniforms: { uTime: fireTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0; float f = 0.85 + 0.15 * sin(uTime * 11.0) * sin(uTime * 7.3);
        gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * pow(max(0.0, 1.0 - d), 2.2) * 0.55 * f, 1.0); }`,
  });
  // embers and smoke share one set of points: each point knows which it is, and loops through its life
  const specks = new THREE.ShaderMaterial({
    uniforms: { uTime: fireTime }, transparent: true, depthWrite: false,
    vertexShader: `uniform float uTime; attribute vec3 aP; varying float vLife; varying float vKind;
      void main(){
        float seed = aP.x, kind = aP.y, speed = aP.z;
        float life = fract(uTime * speed + seed * 7.0);
        vLife = life; vKind = kind;
        vec3 p = kind < 0.5
          ? vec3(sin(seed * 40.0 + life * 5.0) * 0.35 * life, 0.4 + life * 3.2, cos(seed * 33.0 + life * 4.0) * 0.35 * life)
          : vec3(sin(seed * 20.0 + uTime * 0.4) * 0.6 * life + life * 0.8, 1.3 + life * 6.0, cos(seed * 11.0) * 0.5 * life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float size = kind < 0.5 ? 0.09 * (1.0 - life) : 0.9 + life * 2.2;
        gl_PointSize = size * 420.0 / max(-mv.z, 0.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vLife; varying float vKind;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (vKind < 0.5) { if (d > 1.0) discard; gl_FragColor = vec4(mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 0.35, 0.08), vLife), (1.0 - vLife) * (1.0 - d * d)); }
        else { float a = (1.0 - smoothstep(0.2, 1.0, d)) * sin(vLife * 3.1416) * 0.09; gl_FragColor = vec4(vec3(0.72, 0.72, 0.76), a); }
      }`,
  });
  fireMats = { flame, glow, specks };
  return fireMats;
}
export function campfire(noRing = false) {
  const g = new THREE.Group();
  const M = fireMaterials();
  // logs leaning together like a small tent, charred at the tips
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    const l = mesh(cyl(0.09, 0.12, 1.25, 7), 0x6a4428, Math.cos(a) * 0.32, 0.38, Math.sin(a) * 0.32, true, 0.02);
    l.rotation.set(0, -a, 0); l.rotateZ(0.62); g.add(l);
    const tip = mesh(sph(0.1, 7, 5), 0x2a1a14, Math.cos(a) * 0.08, 0.72, Math.sin(a) * 0.08, false); g.add(tip);
  }
  for (let k = 0; k < 2; k++) { const l = mesh(cyl(0.11, 0.11, 1.2, 7), 0x5a3a22, 0, 0.1, 0, true, 0.02); l.rotation.set(Math.PI / 2, k * 1.4 + 0.4, 0); g.add(l); }
  // a ring of round river stones
  if (!noRing) for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const st = mesh(sph(0.2, 8, 6), k % 3 ? 0x9a968c : 0x86837a, Math.cos(a) * 0.95, 0.08, Math.sin(a) * 0.95, true, 0.02); st.scale.set(1.2, 0.7, 1); st.rotation.y = a; g.add(st); }
  // glowing coals
  g.add(mesh(sph(0.34, 10, 6), toon(0xff5a1a, { emissive: 0xff4a10, emissiveIntensity: 1.2 }), 0, 0.02, 0, false)).scale.y = 0.35;
  // the flame: three painted layers at slightly different sizes and timings
  const flame = new THREE.Group(); g.add(flame);
  const quad = new THREE.PlaneGeometry(1.35, 2.1); quad.translate(0, 1.05, 0);
  [[1.3, 0.1, 0.0], [1.05, 0.55, 0.14], [0.85, 0.83, -0.12]].forEach(([sc, seed, dx]) => {
    const q = quad.clone(); q.setAttribute("aSeed", new THREE.Float32BufferAttribute(new Array(q.attributes.position.count).fill(seed), 1));
    const p = q.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, dx);
    const m = new THREE.Mesh(q, M.flame); m.scale.setScalar(sc); m.position.y = 0.15; m.frustumCulled = false; m.renderOrder = 3; flame.add(m);
  });
  // a warm pool of light on the ground
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(noRing ? 2 : 5, noRing ? 2 : 5), M.glow); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; pool.renderOrder = 2; g.add(pool);
  // embers and smoke
  const n = 30, attr = new Float32Array(n * 3), pos = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { const smoke = !noRing && k >= 26; attr.set([Math.random(), smoke ? 1 : 0, smoke ? 0.07 + Math.random() * 0.04 : 0.35 + Math.random() * 0.35], k * 3); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pg.setAttribute("aP", new THREE.BufferAttribute(attr, 3));
  const pts = new THREE.Points(pg, M.specks); pts.frustumCulled = false; pts.renderOrder = 4; g.add(pts);
  g.userData.flame = flame;
  return g;
}
export function cooler() {
  const g = new THREE.Group();
  g.add(mesh(box(1.2, 0.7, 0.8), 0x2a6ab8, 0, 0.35, 0));
  const lid = new THREE.Group(); lid.position.set(0, 0.7, -0.4); g.add(lid);
  lid.add(mesh(box(1.26, 0.18, 0.86), 0xf2f2f2, 0, 0.09, 0.4));
  g.add(mesh(box(0.5, 0.08, 0.1), 0xf2f2f2, 0, 0.5, 0.42, false));
  g.userData.lid = lid;
  return g;
}
export function loonStatue() {
  const glb = GLB.building("statue");
  if (glb) {
    const orb = new THREE.Mesh(sph(0.35), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 })); orb.position.set(0, glb.userData.size.y + 0.7, 0); glb.add(orb); glb.userData.orb = orb;
    return glb;
  }
  const g = new THREE.Group();
  const stone = 0xaeb0a8;
  g.add(mesh(cyl(1.6, 1.9, 1.2, 10), 0x8a8c86, 0, 0.6, 0));
  const b = mesh(sph(1), stone, 0, 2, 0); b.scale.set(0.8, 0.7, 1.6); g.add(b);
  put(g, mesh(cap(0.2, 0.7), stone, 0, 2.8, 1.1)).rotation.x = 0.4;
  g.add(mesh(sph(0.36), stone, 0, 3.3, 1.3));
  put(g, mesh(new THREE.ConeGeometry(0.1, 0.6, 6), 0x8a8c86, 0, 3.3, 1.8, false)).rotation.x = Math.PI / 2;
  const glow = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.8 });
  const orb = new THREE.Mesh(sph(0.3), glow); orb.position.set(0, 4.3, 0.4); g.add(orb); g.userData.orb = orb;
  return g;
}
export function stoneCircle() {
  const g = new THREE.Group();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const s = mesh(box(1.6, 5 + (k % 3), 1), 0x8a8e8a, Math.cos(a) * 22, 2.5, Math.sin(a) * 22); s.rotation.y = -a; g.add(s); if (k % 2) { const l = mesh(box(4.4, 0.8, 1), 0x8a8e8a, Math.cos(a) * 22, 5.9, Math.sin(a) * 22); l.rotation.y = -a + Math.PI / 2; g.add(l); } }
  return g;
}
export function dojo() {
  const g = new THREE.Group();
  const deck = mesh(box(34, 1, 34), 0xb08a5a, 0, 0.5, 0, false); deck.receiveShadow = true; g.add(deck);
  for (let k = -3; k <= 3; k++) g.add(mesh(box(34, 0.05, 0.1), 0x8a6a42, 0, 1.02, k * 5, false));
  const red = 0xc8302a;
  for (const s of [-1, 1]) g.add(mesh(cyl(0.5, 0.6, 9, 10), red, s * 5, 5, 18, true));
  g.add(mesh(box(14, 0.8, 1.1), 0x1a1a1a, 0, 9.4, 18));
  g.add(mesh(box(12, 0.6, 0.8), red, 0, 7.8, 18));
  for (const [x, z] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) { g.add(mesh(cyl(0.2, 0.2, 2), 0x3a3a3a, x, 2, z, false)); g.add(mesh(box(0.8, 1, 0.8), toon(0xffe0a0, { emissive: 0xff9a3a, emissiveIntensity: 0.6 }), x, 3.4, z, false)); }
  return g;
}
export function castle() {
  // a porcelain throne the size of a church, dripping with sludge
  const g = new THREE.Group();
  const white = toon(0xe8ecf0);
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(10 + Math.sin(t * Math.PI) * 7 - t * 2, t * 14)); }
  g.add(mesh(new THREE.LatheGeometry(pts, 32), white, 0, 0, 6, false));
  g.add(mesh(cyl(15.2, 15.2, 0.8, 32), 0x4a2a5a, 0, 13.8, 6, false));
  const tank = mesh(box(26, 26, 9), white, 0, 20, -10, false); g.add(tank);
  g.add(mesh(box(28, 2, 11), white, 0, 34, -10, false));
  const lid = mesh(cyl(15, 15, 1.2, 32), white, 0, 28, -3, false); lid.rotation.x = -1.35; g.add(lid);
  for (const s of [-1, 1]) g.add(mesh(sph(2.4, 12, 10), toon(0xff2a1a, { emissive: 0xff2a1a, emissiveIntensity: 1.2 }), s * 6, 24, -5.4, false));
  const gold = toon(0xffc83a, { emissive: 0x3a2400 });
  for (let k = 0; k < 7; k++) g.add(mesh(new THREE.ConeGeometry(1.4, 6, 5), gold, -12 + k * 4, 38, -10, false));
  // sludge running down
  const sludge = toon(0x5a2a6a, { emissive: 0x2a0a3a });
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; const d = mesh(cap(0.9, 6 + (k % 3) * 2), sludge, Math.cos(a) * 15, 8, 6 + Math.sin(a) * 15, false); g.add(d); }
  return g;
}
export function loonieMesh() {
  const g = new THREE.Group();
  const coin = new THREE.Mesh(cyl(0.45, 0.45, 0.08, 11), toon(0xffc83a, { emissive: 0x6a4a00, emissiveIntensity: 0.6 }));
  coin.rotation.x = Math.PI / 2; g.add(coin);
  const loon = new THREE.Mesh(sph(0.16, 8, 6), toon(0xb08a1a)); loon.scale.set(1.3, 0.7, 0.4); loon.position.z = 0.05; g.add(loon);
  return g;
}
export function secretRock() {
  const g = new THREE.Group();
  const r = mesh(new THREE.DodecahedronGeometry(0.8), 0x8a8e84, 0, 0.5, 0, false); r.scale.set(1, 0.7, 1); g.add(r);
  for (let k = 0; k < 5; k++) { const a = k * 1.3; g.add(mesh(sph(0.1, 6, 4), k % 2 ? 0xffffff : 0xffd84a, Math.cos(a) * 0.3, 1.05, Math.sin(a) * 0.3, false)); }
  put(g, mesh(sph(0.18, 8, 6), 0x5a9a3a, 0, 0.95, 0, false)).scale.set(1.6, 0.4, 1.6);
  return g;
}
export function food(id) {
  const g = new THREE.Group();
  if (id === "apple") { g.add(mesh(sph(0.22), 0xd8282a, 0, 0.22, 0, true, 0.02)); g.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 4), 0x3a8a2a, 0.06, 0.46, 0, false)); }
  else if (id === "shroom") { g.add(mesh(cyl(0.07, 0.09, 0.3), 0xf0e8d8, 0, 0.15, 0, true, 0.02)); const c = mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xd83a2a, 0, 0.28, 0, true, 0.02); g.add(c); for (let k = 0; k < 4; k++) g.add(mesh(sph(0.04, 6, 4), 0xffffff, Math.cos(k * 1.6) * 0.14, 0.44, Math.sin(k * 1.6) * 0.14, false)); }
  else if (id === "berry") { g.add(mesh(sph(0.36, 10, 8), 0x3a7a3a, 0, 0.3, 0, true, 0.02)); for (let k = 0; k < 9; k++) g.add(mesh(sph(0.07, 6, 4), 0x3a4ab8, Math.cos(k * 2.3) * 0.3, 0.3 + Math.sin(k * 1.7) * 0.2, Math.sin(k * 2.3) * 0.3, false)); }
  else if (id === "syrup") { g.add(mesh(cyl(0.16, 0.2, 0.44, 8), toon(0xc8781a, { transparent: true, opacity: 0.9 }), 0, 0.22, 0, true, 0.02)); g.add(mesh(cyl(0.07, 0.07, 0.12, 8), 0xf2f2f2, 0, 0.5, 0, false)); }
  else if (id === "heart") { const h = mesh(sph(0.3), toon(0xff4a5a, { emissive: 0x8a0a1a }), 0, 0.5, 0, true, 0.02); h.scale.set(1, 0.9, 0.5); g.add(h); }
  return g;
}

/* ---------------- the kayak, its paddle, the fishing rod, and a fish ---------------- */
// The kayak points along +z. Its deck sits about 0.35 above the water line (y = 0).
export function kayak() {
  const g = GLB.building("kayak", 0.02);
  if (g) { const k = new THREE.Group(); g.position.y = -0.18; k.add(g); return k; }
  const k = new THREE.Group();
  const hull = mesh(new THREE.SphereGeometry(1, 20, 10), 0xd8502a, 0, 0.05, 0);
  hull.scale.set(0.42, 0.26, 2.4); k.add(hull);
  const deck = mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xf2e6c8, 0, 0.08, 0, false);
  deck.scale.set(0.4, 0.14, 2.3); k.add(deck);
  const rim = mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 16), 0x9a6a3a, 0, 0.2, -0.1, false);
  rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1.5, 1); k.add(rim);
  return k;
}
export function paddle() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.03, 0.03, 2.3, 6), 0xb07a3a, 0, 0, 0, true, 0.015));
  for (const s of [-1, 1]) { const b = mesh(box(0.2, 0.46, 0.03), 0xc89a5a, 0, s * 1.2, 0, true, 0.015); b.rotation.y = s * 0.5; g.add(b); }
  g.rotation.z = Math.PI / 2;
  const h = new THREE.Group(); h.add(g); return h;
}
// the rod points along +z from the hand; userData.tip is where the line starts
export function rod() {
  const g = new THREE.Group();
  const pole = mesh(cyl(0.012, 0.03, 2.4, 6), 0x7a4a24, 0, 1.1, 0, true, 0.012); g.add(pole);
  g.add(mesh(cyl(0.05, 0.05, 0.12, 8), 0xb0b4b8, 0.05, 0.25, 0, false));
  const tip = new THREE.Object3D(); tip.position.set(0, 2.3, 0); g.add(tip);
  g.rotation.x = Math.PI / 2 - 0.5;
  const h = new THREE.Group(); h.add(g); h.userData.tip = tip; return h;
}
export function bobber() {
  const g = new THREE.Group();
  g.add(mesh(sph(0.09, 10, 8), 0xe8402a, 0, 0.05, 0, false));
  g.add(mesh(new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xffffff, 0, 0.05, 0, false));
  return g;
}
export function fish(color = 0x8a9a5a) {
  const g = GLB.building("fish", 0.012);
  if (g) { if (color !== 0x8a9a5a) g.traverse((o) => { if (o.isMesh && !o.userData.outline) { o.material = o.material.clone(); o.material.color.set(color).lerp(new THREE.Color(0xffffff), 0.4); } }); return g; }
  const f = new THREE.Group();
  const b = mesh(sph(0.2, 12, 8), color, 0, 0.2, 0); b.scale.set(0.45, 0.7, 1.8); f.add(b);
  const t = mesh(new THREE.ConeGeometry(0.16, 0.25, 4), color, 0, 0.2, -0.42); t.rotation.x = -Math.PI / 2; t.scale.set(0.3, 1, 1.2); f.add(t);
  return f;
}
