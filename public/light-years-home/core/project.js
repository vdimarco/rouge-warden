// Light Years Home: where a point in space lands on the screen. The same light-speed maths as the star shader
// (physics.aberrate, the stereographic form) and the same camera as the renderer (core/geo.cameraFor), so rings,
// labels, picking and tests agree with the picture. Off-screen targets get an edge chevron. Pure: no DOM, no three.js.

import { OBJECTS, KM_PER_LY } from './objects.js';
import { aberrate } from './physics.js';

export const MIN_RING_PX = 14;   // rings are at least this big (CSS px)
export const CHEVRON_INSET = 24; // chevrons sit this far inside the free area

const D2R = Math.PI / 180;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const FRONT = 1e-6;              // a point counts as in front when its direction is this far ahead of the camera plane

// Position and size of what is being projected: an object id, an object ({ pos, radiusLy }), or [x, y, z] in ly.
function targetOf(target, radiusLy) {
  if (typeof target === 'string') {
    const o = OBJECTS[target];
    if (!o) throw new Error(`unknown object ${target}`);
    return { pos: o.pos, radius: finite(radiusLy) ? radiusLy : radiusOf(o) };
  }
  if (Array.isArray(target) || ArrayBuffer.isView(target)) {
    return { pos: target, radius: finite(radiusLy) ? radiusLy : 0 };
  }
  if (target && target.pos) return { pos: target.pos, radius: finite(radiusLy) ? radiusLy : radiusOf(target) };
  throw new Error('project: give an object id, an object with pos, or a position');
}

// Physical radius in light-years: radiusLy for extended objects, radiusKm for the Sun, planets and the Moon.
export function radiusOf(o) {
  if (!o) return 0;
  if (finite(o.radiusLy)) return o.radiusLy;
  if (finite(o.radiusKm)) return o.radiusKm / KM_PER_LY;
  return 0;
}

// Screen size of a camera description: cam.width × cam.height in CSS px, or the aspect at a height of 1.
function screenOf(cam) {
  const aspect = finite(cam.aspect) && cam.aspect > 0 ? cam.aspect : 1;
  const H = finite(cam.height) && cam.height > 0 ? cam.height : 1;
  const W = finite(cam.width) && cam.width > 0 ? cam.width : aspect * H;
  return { W, H, aspect: W / H };
}

// Where a point is seen. target: object id, { pos, radiusLy } or [x, y, z] (ly, galaxy frame). cam: from
// geo.cameraFor (pos, basis { right, up, fwd }, fovY in degrees, width, height, velocity, phiView). phiView defaults
// to cam.phiView. Returns, in CSS px with y down:
//   x, y      the centre on screen (far outside the screen when behind the camera)
//   r         ring radius, at least MIN_RING_PX; rawR is the projected size without that floor
//   visible   in front of the camera and inside the screen; front: in front at all
//   D         Doppler factor (> 1 is blueshift); nx, ny: normalised device coordinates (y up)
//   dir       the seen direction in camera axes [right, up, forward]; dist: true distance in ly; ang: seen angular
//             radius in radians (aberration is conformal, so small sizes scale by 1 / D)
export function project(target, cam, phiView, opts = {}) {
  const { pos, radius } = targetOf(target, opts.radiusLy);
  const { W, H, aspect } = screenOf(cam);
  const phi = finite(phiView) ? Math.max(0, phiView) : Math.max(0, finite(cam.phiView) ? cam.phiView : 0);
  const { right, up, fwd } = cam.basis;
  const d = [pos[0] - cam.pos[0], pos[1] - cam.pos[1], pos[2] - cam.pos[2]];
  const dist = Math.hypot(d[0], d[1], d[2]);
  if (!(dist > 0)) {
    return { x: W / 2, y: H / 2, r: Math.max(W, H), rawR: Math.max(W, H), visible: false, front: false, D: 1, nx: 0,
      ny: 0, dir: [0, 0, 1], dist: 0, ang: Math.PI / 2 };
  }
  const n = [d[0] / dist, d[1] / dist, d[2] / dist];
  const v = cam.velocity || fwd;
  const seen = phi > 0 ? aberrate(n, v, phi) : { n, D: 1 };
  const m = seen.n;
  const cx = dot(m, right), cy = dot(m, up), cz = dot(m, fwd);
  const T = Math.tan((cam.fovY * D2R) / 2);
  const front = cz > FRONT;
  let nx, ny;
  if (front) {
    nx = cx / (cz * T * aspect);
    ny = cy / (cz * T);
  } else {
    // Behind the camera: put it far outside the screen in the direction it lies, so chevrons point the right way.
    const s = Math.hypot(cx, cy);
    nx = s > 0 ? (cx / s) * 1e6 : 0;
    ny = s > 0 ? (cy / s) * 1e6 : -1e6;
  }
  const x = ((nx + 1) / 2) * W, y = ((1 - ny) / 2) * H;
  const visible = front && x >= 0 && x <= W && y >= 0 && y <= H;
  const ang = radius > 0 ? (dist <= radius ? Math.PI / 2 : Math.asin(radius / dist)) / seen.D : 0;
  // Gnomonic scale at the point: sec² along the radius, sec across it; the ring uses their geometric mean.
  const sec = front ? 1 / Math.max(cz, 1e-6) : 1;
  const rawR = Math.min(ang * ((H / 2) / T) * sec ** 1.5, 8 * Math.max(W, H));
  return {
    x, y, r: Math.max(MIN_RING_PX, rawR), rawR, visible, front, D: seen.D, nx, ny, dir: [cx, cy, cz], dist, ang,
  };
}

// The chevron for a target outside the free area: where on the area's edge it sits and which way it points.
// target: a result of project() or anything project() takes. opts: { box: {x, y, w, h} (default cam.box, else the
// screen), inset (px), phiView }. Returns null when the target is inside the area; else { x, y, angle (radians,
// 0 = right, y down), behind, edge: 'left' | 'right' | 'top' | 'bottom' }.
export function edgeChevron(target, cam, opts = {}) {
  const p = target && Array.isArray(target.dir) && finite(target.x) ? target : project(target, cam, opts.phiView, opts);
  const { W, H } = screenOf(cam);
  const box = opts.box || cam.box || { x: 0, y: 0, w: W, h: H };
  let inset = finite(opts.inset) ? opts.inset : CHEVRON_INSET;
  inset = Math.max(0, Math.min(inset, box.w / 2 - 1, box.h / 2 - 1));
  const x0 = box.x + inset, x1 = box.x + box.w - inset, y0 = box.y + inset, y1 = box.y + box.h - inset;
  if (p.front && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) return null;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let dx, dy;
  if (p.front) {
    dx = p.x - cx; dy = p.y - cy;
  } else {
    dx = p.dir[0]; dy = -p.dir[1];                     // behind: the way it lies, seen from the screen centre
    if (dx === 0 && dy === 0) dy = 1;                  // dead behind: point down
  }
  let t = Infinity, edge = 'right';
  if (dx > 0 && (x1 - cx) / dx < t) { t = (x1 - cx) / dx; edge = 'right'; }
  if (dx < 0 && (x0 - cx) / dx < t) { t = (x0 - cx) / dx; edge = 'left'; }
  if (dy > 0 && (y1 - cy) / dy < t) { t = (y1 - cy) / dy; edge = 'bottom'; }
  if (dy < 0 && (y0 - cy) / dy < t) { t = (y0 - cy) / dy; edge = 'top'; }
  if (!finite(t)) t = 0;
  return { x: cx + dx * t, y: cy + dy * t, angle: Math.atan2(dy, dx), behind: !p.front, edge };
}
