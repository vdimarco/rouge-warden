// First Breath: the one camera (design.md 5.6, 9, 16.2). makeCamera(viewW, viewH, cam) maps the draw list's world
// units to CSS px and back. World angles are radians, counterclockwise from world +x in a y-up plane; the screen is
// y down. The map is a rotation and a scale, never a mirror, so a clockwise turn on screen is a clockwise turn in the
// world in every layout, and `turn` +1 (which decreases the world angle) turns clockwise as seen. No DOM: node
// imports it for tests, and main.js, the renderer, render/rings.js and ui/input.js all build it the same way.
//
// - "long" (stages 1 to 4): world forward (+y) is up in portrait and right in landscape and on desktop (a −90°
//   rotation, so world +x is screen down there). The subject (the camera's x, y) sits at 50% of the width and 45%
//   of the height in portrait, at 38% of the width and 55% of the height in phone landscape, and at 40% of the width
//   and half the height on desktop.
// - "fit" (stages 5 to 8 and the ending): world up is screen up. The subject sits at 42% of the height in portrait.
// - Scale: the short screen axis is `span` u (100 u at span 100), so pxPerU = min(viewW, viewH) / span.
//
// Contract choices (16.2 gives the signature, not these):
// - The camera's (x, y) is the world point placed on the layout's subject point.
// - The layout comes from the view size alone: portrait when viewH ≥ viewW; phone landscape when wider than tall
//   and the short side is under 600 CSS px; desktop otherwise (a large tablet in landscape counts as desktop).
// - "fit" outside portrait puts the subject at the centre (50%, 50%); 5.6 and 9 give no other point.
// - cam.rot turns the camera counterclockwise in the world by rot radians: the world direction at angle π/2 + rot
//   shows where world forward (+y) shows at rot 0.
// - stickToWorld(vx, vy) takes a screen vector (x right, y down, |v| ≤ 1) and returns the world vector of the same
//   length; it ignores the camera's position.
// - Extras on the camera: layout, subject ({ x, y } px), W, H, theta (the world → screen turn, radians,
//   counterclockwise as seen) and screenAngle(a): a world angle as a screen angle, atan2(dy, dx) in screen px (y
//   down), so it reads like the angle of a drag on screen.

export const SUBJECT = Object.freeze({
  long: Object.freeze({ portrait: [0.5, 0.45], landscape: [0.38, 0.55], desktop: [0.4, 0.5] }),
  fit: Object.freeze({ portrait: [0.5, 0.42], landscape: [0.5, 0.5], desktop: [0.5, 0.5] }),
});
export const PHONE_SHORT_PX = 600;

const fin = (v) => typeof v === "number" && Number.isFinite(v);

// "portrait" | "landscape" (a phone on its side) | "desktop".
export function layoutOf(viewW, viewH) {
  if (!(viewW > viewH)) return "portrait";
  return Math.min(viewW, viewH) < PHONE_SHORT_PX ? "landscape" : "desktop";
}

// An angle wrapped into (−π, π].
const wrap = (a) => {
  const t = Math.PI * 2;
  let r = ((a % t) + t) % t;
  if (r > Math.PI) r -= t;
  return r;
};

export function makeCamera(viewW, viewH, cam = null) {
  const W = viewW > 0 ? viewW : 1, H = viewH > 0 ? viewH : 1;
  const c0 = cam || {};
  const orient = c0.orient === "fit" ? "fit" : "long";
  const layout = layoutOf(W, H);
  const span = fin(c0.span) && c0.span > 0 ? c0.span : 100;
  const cx = fin(c0.x) ? c0.x : 0, cy = fin(c0.y) ? c0.y : 0;
  const rot = fin(c0.rot) ? c0.rot : 0;
  const k = Math.min(W, H) / span;
  const base = orient === "long" && layout !== "portrait" ? -Math.PI / 2 : 0;
  const theta = base - rot;
  const c = Math.cos(theta), s = Math.sin(theta);
  const [fx, fy] = SUBJECT[orient][layout];
  const sx = W * fx, sy = H * fy;

  return {
    orient,
    layout,
    pxPerU: k,
    W, H,
    theta,
    subject: { x: sx, y: sy },
    // world u → CSS px
    toScreen(x, y) {
      const dx = x - cx, dy = y - cy;
      return { x: sx + (c * dx - s * dy) * k, y: sy - (s * dx + c * dy) * k };
    },
    // CSS px → world u
    toWorld(px, py) {
      const rx = (px - sx) / k, ry = -(py - sy) / k;
      return { x: cx + c * rx + s * ry, y: cy - s * rx + c * ry };
    },
    // a screen stick (x right, y down) → a world vector
    stickToWorld(vx, vy) {
      const rx = fin(vx) ? vx : 0, ry = fin(vy) ? -vy : 0;
      return { x: c * rx + s * ry, y: -s * rx + c * ry };
    },
    // a world angle → its screen angle, atan2(dy, dx) in px with y down
    screenAngle(a) {
      return wrap(-(a + theta));
    },
  };
}
