// Full Tilt: the table, in millimetres. x runs right, y runs up the table (0 is the drain). The ball is 27 mm across,
// like a real one. The playfield is 455 wide with the shooter lane on the right (455 to 500), under a round top.
// Walls are segments (a polyline is a chain of them); posts and bumpers are circles. No DOM here: the tests import it.

export const BALL_R = 13.5;
export const TABLE_W = 500, TABLE_H = 1060;
const ARC_C = [250, 790], ARC_R = 250;

const seg = (a, b, o = {}) => ({ a, b, e: 0.55, ...o });
function chain(pts, o = {}) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) out.push(seg(pts[i], pts[i + 1], o));
  return out;
}
function arc(cx, cy, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
const mirror = (p) => [455 - p[0], p[1]];

export function makeTable() {
  const walls = [];
  // the outline: the left wall, the round top, the outside of the shooter lane. The top is a steel rail, not a
  // rubber: the ball rolls along it, so a soft launch falls off it into the top lanes (the skill shot).
  const top = arc(ARC_C[0], ARC_C[1], ARC_R, Math.PI, 0, 36);
  walls.push(seg([0, 40], [0, ARC_C[1]]), ...chain(top, { e: 0.15 }), seg([500, ARC_C[1]], [500, 40]));
  walls.push(seg([0, 40], [500, 40]));           // the floor under everything (the drain is above it)
  // the shooter lane: its inner wall, and a gate at the top that lets the ball out but not back in
  walls.push(seg([455, 40], [455, 760]));
  walls.push(seg([455, 760], [500, 845], { oneway: true, e: 0.3 }));
  // The lower playfield, left side: the outlane wall, then the inlane guide. The guide ends where it is tangent to the
  // top of the flipper's pivot, in line with the flipper at rest, so the ball rolls straight on (no notch to wedge in).
  // Above it, the slingshot.
  const left = [
    ...chain([[40, 360], [40, 215], [137, 151]], { e: 0.4 }),
    ...chain([[84, 330], [84, 230], [126, 205]], { e: 0.55 }),
    seg([126, 205], [84, 330], { kick: 1000, e: 0.75, sling: "L" }),
  ];
  walls.push(...left);
  for (const w of left) walls.push({ ...w, a: mirror(w.a), b: mirror(w.b), sling: w.sling ? "R" : undefined });

  const posts = [
    { x: 40, y: 360, r: 7, e: 0.8 }, { x: 415, y: 360, r: 7, e: 0.8 },       // tops of the outlane walls
    // the guides between the top lanes: under the rail, a little right of centre, where soft launches come down
    { x: 200, y: 960, r: 6, e: 0.7 }, { x: 255, y: 960, r: 6, e: 0.7 }, { x: 310, y: 960, r: 6, e: 0.7 }, { x: 365, y: 960, r: 6, e: 0.7 },
  ];
  const bumpers = [
    { id: 0, x: 170, y: 640, r: 28, kick: 1400 },
    { id: 1, x: 285, y: 640, r: 28, kick: 1400 },
    { id: 2, x: 228, y: 735, r: 28, kick: 1400 },
  ];
  // three drop targets on the left, facing into the playfield
  const drops = [0, 1, 2].map((i) => ({ id: i, a: [18, 470 + i * 42], b: [18, 502 + i * 42], up: true }));
  for (const d of drops) walls.push(seg(d.a, d.b, { drop: d, e: 0.3 }));
  // the caps at the ends of the bank slope down toward the playfield, so a ball behind fallen targets rolls back out
  walls.push(seg([18, 462], [0, 470], { e: 0.4 }), seg([18, 594], [0, 601], { e: 0.4 }));
  // three top lanes between the posts
  const lanes = [227.5, 282.5, 337.5].map((x, i) => ({ id: i, x, y: 960, lit: false }));
  const flippers = [
    { side: -1, px: 132, py: 140, len: 75, r1: 12, r2: 6, rest: (-30 * Math.PI) / 180, up: (28 * Math.PI) / 180 },
    { side: 1, px: 323, py: 140, len: 75, r1: 12, r2: 6, rest: Math.PI + (30 * Math.PI) / 180, up: Math.PI - (28 * Math.PI) / 180 },
  ];
  const launch = { x: 477.5, y: 40 + BALL_R + 6 };   // where the ball waits on the plunger
  // the outline as a polygon, for the "never escapes" check
  const outline = [[0, 40], [0, ARC_C[1]], ...top.slice(1), [500, 40]];
  return { walls, posts, bumpers, drops, lanes, flippers, launch, outline, drainY: 95, W: TABLE_W, H: TABLE_H };
}

export function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
