// Everything in the world is built from simple shapes here: the crew, the critters, the bosses, and the buildings.
// Toon materials give the flat, painted look. A dark shell behind each character draws its outline.
import * as THREE from "three";

const cache = new Map();
let gradient = null;
export function gradientMap() {
  if (gradient) return gradient;
  const steps = [70, 150, 215, 255];
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
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x2a2018, side: THREE.BackSide });

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
  { skin: 0xe0a882, shirt: 0xd22a2a, trim: 0xffffff, sleeves: false, shorts: 0x243a6a, shoes: 0xf2f2f2, shoe2: 0xc81e1e, hat: 0x1f2c4a, hatBack: false, beard: 0x6a4a30, glasses: 0x3a2a1a, hair: 0x5a4030 },
  { skin: 0xd6a07a, shirt: 0x1d2c5e, trim: 0xc8283a, sleeves: true, shorts: 0x26262a, shoes: 0x2a3a78, shoe2: 0xffffff, hat: 0x2e8a3e, hatBack: true, beard: 0x3a2a1e, glasses: 0, hair: 0x3a2a1e, number: "51" },
  { skin: 0x9a6848, shirt: 0x1c1c1e, trim: 0x2a2a2e, sleeves: true, shorts: 0x3a3a40, long: true, shoes: 0x151515, shoe2: 0xffffff, hat: 0x121214, hatBack: false, beard: 0x1a1210, glasses: 0x2a6ac8, hair: 0x1a1210 },
  { skin: 0xe2b08a, shirt: 0x1c1c1e, trim: 0x2a2a2e, sleeves: true, shorts: 0x6a6a6e, shoes: 0x9a9aa2, shoe2: 0xffffff, hat: 0xe8e8ea, hatBack: true, beard: 0x3a2618, glasses: 0x6a4a2a, clear: true, hair: 0x3a2618 },
  { skin: 0xe6b28e, shirt: 0xd8302a, trim: 0xffffff, sleeves: true, buttons: true, shorts: 0x1a1a1c, shoes: 0xf4f4f4, shoe2: 0xc8201e, hat: 0x141416, hatBack: true, beard: 0, glasses: 0x2a7ae0, hair: 0x2a1a10 },
];

// A person: legs, body, arms, and a big head. Returns the rig with joints the animation moves.
export function person(look, scale = 1) {
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

/* ---------------- bosses ---------------- */
export function boss(id) {
  if (id === "king") return king();
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
  const g = new THREE.Group();
  const boards = toon(0xb04a32);
  g.add(mesh(box(2, 3, 2), boards, 0, 1.5, 0, false));
  const roof = mesh(box(2.6, 0.2, 2.8), 0x4a3a2a, 0, 3.2, 0); roof.rotation.x = -0.18; g.add(roof);
  g.add(mesh(box(1.3, 2.4, 0.1), 0x8a3a24, 0, 1.3, 1.02, false));
  const moon = mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 12, Math.PI * 1.3), 0x1a0a06, 0, 2.1, 1.08, false); moon.rotation.z = 0.8; g.add(moon);
  if (shrine) {
    const glow = new THREE.MeshBasicMaterial({ color: 0x5ef0ff });
    g.userData.glow = glow;
    for (const [w, h, x, y] of [[2.1, 0.08, 0, 0.05], [2.1, 0.08, 0, 2.95], [0.08, 2.9, -1.02, 1.5], [0.08, 2.9, 1.02, 1.5]]) put(g, new THREE.Mesh(box(w, h, 0.06), glow)).position.set(x, y, 1.06);
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
  // the pedestal where you activate the tower
  const ped = mesh(cyl(0.4, 0.5, 1.1, 8), 0x6a6a70, 0, 0.75, 0); top.add(ped);
  const screen = new THREE.MeshBasicMaterial({ color: 0xff9a3a });
  const s = new THREE.Mesh(box(0.7, 0.08, 0.5), screen); s.position.set(0, 1.33, 0); top.add(s);
  g.userData.screen = screen;
  g.userData.H = H;
  return g;
}
export function campfire() {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) { const l = mesh(cyl(0.12, 0.12, 1.3, 6), 0x5a3a24, 0, 0.12, 0, false); l.rotation.set(Math.PI / 2, k * Math.PI / 4, 0); g.add(l); }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.add(mesh(new THREE.DodecahedronGeometry(0.22), 0x8a8a8a, Math.cos(a) * 0.85, 0.1, Math.sin(a) * 0.85, false)); }
  const flame = new THREE.Group(); g.add(flame);
  for (const [c, s, y] of [[0xff7a1a, 0.5, 0.5], [0xffc83a, 0.32, 0.45], [0xfff0a0, 0.16, 0.4]]) { const f = new THREE.Mesh(new THREE.ConeGeometry(s, s * 2.6, 7), new THREE.MeshBasicMaterial({ color: c })); f.position.y = y + s * 0.8; flame.add(f); }
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
