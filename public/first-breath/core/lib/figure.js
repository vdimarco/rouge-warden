// First Breath: the abstract baby figure (design.md 14.4). Soft splats on a small 2D skeleton: a head, a body, four
// limbs (two capsules each from week 8, one growing bud before that), a heart splat in the vessel channel and the
// cord root. At most 14 splats. No face, no features, no expression: the head is one plain blob. After James Blinn,
// "A Generalization of Algebraic Surface Drawing" (1982): blobs summed into one soft shape, drawn here as splats. Pure.
//
// Contract choices (16.2 gives figure(pose, sizeU, gaDay)):
// - sizeU is the length from the top of the head to the bottom of the body, in u; the figure is centred on the body
//   with the head up (world +y) unless the pose is headDown, tuck or lift (head down).
// - pose is a name from POSES, or { name, p } to blend from curl toward that pose by p (0..1): the reflex moves
//   play this way, and { name: "headDown", p } turns the figure half way round at p = 0.5. An unknown name is curl.
// - A 4th argument, at = { x, y, rot }, places and turns the whole figure (radians), so a view needs no second pass.
// - By gaDay: no buds before gaDay 38; buds grow to full size by week 8 (gaDay 56), then limbs; the heart splat from
//   gaDay 36 (the first beat); the head shrinks relative to the body from week 8 to week 14; the body rounds out
//   from week 28 to week 36.
// - Splat fields follow the draw list: m membrane, n nucleus, v vessel and heart, hue 0..1 (warm coral and rose).

export const POSES = Object.freeze(["curl", "uncurl", "stretchL", "stretchR", "startle", "kick", "fist", "thumb",
  "headDown", "tuck", "lift"]);

const D = Math.PI / 180;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, p) => a + (b - a) * p;

// Right-side limb angles in degrees, [upper, lower] (0 = +x, 90 = up); left sides mirror unless given.
const CURL = { arm: [-60, 150], leg: [30, -120], head: [0.03, 0.25] };
const TABLE = {
  curl: CURL,
  uncurl: { arm: [-50, -80], leg: [-75, -95], head: [0, 0.3] },
  startle: { arm: [25, 70], leg: [-40, -70], head: [0, 0.31] },
  fist: { arm: [-20, 110], leg: CURL.leg, head: CURL.head },
  thumb: { arm: [30, 170], armL: CURL.arm, leg: CURL.leg, head: CURL.head },
  kick: { arm: CURL.arm, leg: [-80, -95], legL: CURL.leg, head: [0.02, 0.27] },
  stretchR: { arm: [5, 0], armL: CURL.arm, leg: CURL.leg, head: [0.02, 0.27] },
  stretchL: { arm: CURL.arm, armL: [5, 0], leg: CURL.leg, head: [-0.02, 0.27] },
  headDown: { ...CURL, down: true },
  tuck: { arm: CURL.arm, leg: CURL.leg, head: [0.05, 0.2], down: true },
  lift: { arm: [-40, 120], leg: CURL.leg, head: [0, 0.33], down: true },
};

const side = (pose, key, left) => (left ? pose[key + "L"] || pose[key] : pose[key]);

export function figure(pose, sizeU, gaDay, at = null) {
  const name = typeof pose === "string" ? pose : pose && pose.name;
  const p = typeof pose === "object" && pose && Number.isFinite(pose.p) ? clamp01(pose.p) : 1;
  const to = TABLE[name] || CURL;
  const S = Number.isFinite(sizeU) && sizeU > 0 ? sizeU : 1;
  const g = Number.isFinite(gaDay) ? gaDay : 56;

  const headR = lerp(0.24, 0.19, clamp01((g - 56) / 42));
  const round = clamp01((g - 196) / 56);
  const bodyR = lerp(0.15, 0.19, round);
  const limbR = lerp(1, 1.2, round);
  const turn = (to.down ? Math.PI : 0) * p + (at && Number.isFinite(at.rot) ? at.rot : 0);
  const cx = at && Number.isFinite(at.x) ? at.x : 0, cy = at && Number.isFinite(at.y) ? at.y : 0;
  const c = Math.cos(turn), s = Math.sin(turn);
  const X = (x, y) => cx + S * (x * c - y * s);
  const Y = (x, y) => cy + S * (x * s + y * c);
  const out = [];
  const circle = (x, y, r, m, v, hue) => out.push({ k: "c", x: X(x, y), y: Y(x, y), r: r * S, x2: X(x, y), y2: Y(x, y), m, n: 0, v, hue });
  const capsule = (x, y, x2, y2, r, m, v, hue) => out.push({ k: "s", x: X(x, y), y: Y(x, y), r: r * S, x2: X(x2, y2), y2: Y(x2, y2), m, n: 0, v, hue });

  // head and body
  const hx = lerp(CURL.head[0], to.head[0], p), hy = lerp(CURL.head[1], to.head[1], p) + (headR - 0.24) * 0.5;
  circle(hx, hy, headR, 1, 0, 0.03);
  capsule(0, 0.04, 0, -0.27, bodyR, 1, 0, 0.03);

  // limbs: buds before week 8, then two capsules each
  const budP = clamp01((g - 38) / 18);
  const limbs = [
    { key: "arm", x: 0.11, y: 0.0, l1: 0.15, l2: 0.13, r: 0.045 },
    { key: "leg", x: 0.08, y: -0.27, l1: 0.18, l2: 0.17, r: 0.055 },
  ];
  for (const L of limbs) {
    for (const left of [false, true]) {
      const a = side(to, L.key, left), b = side(CURL, L.key, left);
      let u = lerp(b[0], a[0], p) * D, w = lerp(b[1], a[1], p) * D;
      if (left) { u = Math.PI - u; w = Math.PI - w; }
      const x0 = left ? -L.x : L.x, y0 = L.y;
      if (g < 56) {
        if (g < 38) continue;
        const len = 0.12 * budP;
        capsule(x0, y0, x0 + len * Math.cos(u), y0 + len * Math.sin(u), L.r * lerp(0.6, 1, budP), 1, 0, 0.03);
        continue;
      }
      const x1 = x0 + L.l1 * Math.cos(u), y1 = y0 + L.l1 * Math.sin(u);
      capsule(x0, y0, x1, y1, L.r * limbR, 1, 0, 0.03);
      capsule(x1, y1, x1 + L.l2 * Math.cos(w), y1 + L.l2 * Math.sin(w), L.r * 0.9 * limbR, 1, 0, 0.03);
    }
  }

  // the heart (vessel channel) from its first beat, and the cord root
  if (g >= 36) circle(0.02, -0.02, 0.05, 0.2, 1, 0.98);
  circle(0.06, -0.16, 0.035, 0.6, 0.6, 0.02);
  return out;
}
