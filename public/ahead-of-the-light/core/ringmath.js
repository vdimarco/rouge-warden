// Ahead of the Light: the Ring's geometry, ported from lab A (public/light-years-home/lab/a/core.js and view.js).
// Penrose's stereographic aberration puts everything beside the ship on one ring of radius f ÷ sinh φ: the ring is
// the speedometer. Added for the race: course speed, the burst ring (4.1), where rivals are drawn (ahead, abreast,
// behind and clamped to the screen), the hull and fuel wings (8.1), the caption line and label placement (10.7, 7.6).
// Pure: plain numbers in, plain objects out. Angles on screen are degrees from 6 o'clock, + to the right.
import { TUNE } from './tune.js';

export const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (p) => p * p * (3 - 2 * p);
export const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

// Where the ring sits for a screen: portrait, phone landscape or desktop (lab A's layoutFor). Desktop doubles every
// size on the ring (8.1), so `scale` is 2 there.
export function layoutFor(w, h, tune = TUNE) {
  const kind = h > w ? 'portrait' : h < 500 ? 'landscape' : 'desktop';
  const fy = kind === 'portrait' ? tune.CENTRE_Y_PORTRAIT : kind === 'landscape' ? tune.CENTRE_Y_LANDSCAPE
    : tune.CENTRE_Y_DESKTOP;
  return { kind, w, h, cx: w / 2, cy: h * fy, short: Math.min(w, h), desk: kind === 'desktop',
    scale: kind === 'desktop' ? 2 : 1 };
}

// The ring's floor in rapidity: the φ at which the ring is RING_FLOOR of the short side (at least RING_FLOOR_PX).
export function phiFloor(shortPx, tune = TUNE) {
  const floorPx = Math.max(tune.RING_FLOOR * shortPx, tune.RING_FLOOR_PX);
  return Math.asinh((tune.F * shortPx) / floorPx);
}

// The rapidity the ring and hazards are drawn with (6.1): φ = 1 + (φ_floor − 1) × min(1, (η − 1) ÷ 2.8), punched
// toward RING_PUNCH of the short side while `punch` (seconds left of PUNCH_S) runs down.
export function phiHazOf(eta, shortPx, tune = TUNE, punch = 0) {
  const span = Math.max(1e-6, tune.ETA_RING_TOP - tune.ETA0);
  const u = clamp((eta - tune.ETA0) / span, 0, 1);
  let phi = 1 + (phiFloor(shortPx, tune) - 1) * u;
  if (punch > 0) phi += (Math.asinh(tune.F / tune.RING_PUNCH) - phi) * smooth(clamp(punch / tune.PUNCH_S, 0, 1));
  return phi;
}

// The sky's rapidity: the true η, capped at SKY_CAP, punched toward SKY_PUNCH.
export function phiSkyOf(eta, tune = TUNE, punch = 0) {
  const base = Math.min(eta, tune.SKY_CAP);
  if (!(punch > 0)) return base;
  return base + (tune.SKY_PUNCH - base) * smooth(clamp(punch / tune.PUNCH_S, 0, 1));
}

// Screen radius (px) of a point on the tube wall at depth z (tube radii, + ahead) seen at rapidity phi with focal
// length fPx. tan(θ/2) = 1 ÷ (√(1 + z²) + z); aberrated by e^−φ; r = f tan θ′. Infinity once it is behind the eye.
export function depthPx(z, phi, fPx) {
  const t = 1 / (Math.hypot(1, z) + z);
  const tp = Math.exp(-phi) * t;
  if (!(tp < 1)) return Infinity;
  return (fPx * 2 * tp) / (1 - tp * tp);
}

// Doppler factor of a point on the tube wall at depth z: (e^φ + t² e^−φ) ÷ (1 + t²), t = tan(θ/2).
export function dopplerAt(z, phi) {
  const t = 1 / (Math.hypot(1, z) + z), t2 = t * t;
  return (Math.exp(phi) + t2 * Math.exp(-phi)) / (1 + t2);
}

// The ring's radius on this screen (px).
export function ringPx(eta, shortPx, tune = TUNE, punch = 0) {
  return (tune.F * shortPx) / Math.sinh(phiHazOf(eta, shortPx, tune, punch));
}

// Course speed (tube radii a second): V0 × (1 + V_K × (min(η, V_ETA_CAP) − 1)), × LS_SURGE at LIGHT SPEED.
export function courseSpeed(eta, tune = TUNE, lightspeed = false) {
  const v = tune.V0 * (1 + tune.V_K * (Math.min(eta, tune.V_ETA_CAP) - tune.ETA0));
  return lightspeed ? v * tune.LS_SURGE : v;
}
export const beatsPerS = (eta, tune = TUNE, lightspeed = false) => courseSpeed(eta, tune, lightspeed) / tune.BEAT_R;
// The music's tempo follows course speed, so scripted hazards land on their beats at any speed.
export const bpmOf = (eta, tune = TUNE, lightspeed = false) =>
  (tune.BPM0 * courseSpeed(eta, tune, lightspeed)) / courseSpeed(tune.ETA0, tune);

// Everything the overlay needs for one frame: the layout, the focal length, φ, the ring now (R) and at launch (R0),
// beats a second, and the camera roll (degrees; a bearing b draws at wrap(b − cam)).
export function ringView({ w, h, eta = TUNE.ETA0, punch = 0, cam = 0, lightspeed = false, tune = TUNE } = {}) {
  const L = layoutFor(w, h, tune);
  const fPx = tune.F * L.short;
  const phi = phiHazOf(eta, L.short, tune, punch);
  return { ...L, fPx, phi, R: fPx / Math.sinh(phi), R0: ringPx(tune.ETA0, L.short, tune), eta,
    bps: beatsPerS(eta, tune, lightspeed), cam, tune };
}

// A point at screen angle ang (degrees from 6 o'clock, + right) and radius r from the ring centre.
export function toScreen(view, ang, r) {
  return { x: view.cx + Math.sin(ang * DEG) * r, y: view.cy + Math.cos(ang * DEG) * r };
}

// Where a course item draws, seen from a ship at course distance dist (beats): radius r, screen angle ang, Doppler
// D, the half-width of its outline arc (px), depth z (tube radii) and seconds to its pass. psi: its bearing now
// (kinds.psiAt for a turning rail).
export function screenOf(view, item, dist, psi = item.psi) {
  const T = view.tune || TUNE;
  const z = (item.beat - dist) * T.BEAT_R;
  const r = depthPx(z, view.phi, view.fPx);
  return { r, ang: wrap((psi || 0) - view.cam), D: dopplerAt(z, view.phi), halfPx: r * (item.half || 0) * DEG, z,
    ttp: (item.beat - dist) / view.bps };
}

// ---------- the burst ring (4.1) ----------

// The light's time to catch as words a player can read (playtest P1-6): whole seconds under 100 s ("44 S"), then
// whole minutes ("2 MIN"), then "HOURS" from an hour. LIGHT · 36185 S told nobody anything.
export function ttcText(ttc) {
  if (!(ttc > 0)) return '0 S';
  if (ttc < 99.5) return `${Math.round(ttc)} S`;
  if (ttc < 3600) return `${Math.max(2, Math.round(ttc / 60))} MIN`;
  return 'HOURS';
}

// How far the burst ring has opened, 0 (it touches your ring) to 1 (full size), from the time to catch.
export function burstU(ttc, tune = TUNE) {
  if (!(ttc > 0)) return 0;
  return clamp(Math.log(1 + ttc / 2) / Math.log(1 + tune.TTC_FULL / 2), 0, 1);
}

// R_b = R_p × (1 + K_B × u). K_B is KB_DESK on desktop, KB_PHONE on phones.
export function burstPx(view, ttc, tune = view.tune || TUNE) {
  return view.R * (1 + (view.desk ? tune.KB_DESK : tune.KB_PHONE) * burstU(ttc, tune));
}

// ---------- rivals (4.1, 10.7) ----------

// Shrink r along the ray at angle ang until the point is at least `inset` px inside the screen.
function clampToScreen(view, ang, r, inset) {
  const sx = Math.sin(ang * DEG), sy = Math.cos(ang * DEG);
  let lim = r;
  if (sx > 1e-9) lim = Math.min(lim, (view.w - inset - view.cx) / sx);
  if (sx < -1e-9) lim = Math.min(lim, (inset - view.cx) / sx);
  if (sy > 1e-9) lim = Math.min(lim, (view.h - inset - view.cy) / sy);
  if (sy < -1e-9) lim = Math.min(lim, (inset - view.cy) / sy);
  return Math.max(0, lim);
}

// The rear band's radius for a rival behind you (4.1): R + 22 px + (R_b − R − 22 px) × clamp(1 − gap_rival ÷ gap_you,
// 0, 1). When the burst ring is closer than 44 px (the glare), the band starts halfway to it instead of 22 px out, so
// a rival behind you is never drawn outside the light that has not caught it.
export function rearPx(view, gapRival, gapYou, Rb, tune = view.tune || TUNE) {
  const gy = gapYou > 0 ? gapYou : 1e-6;
  const k = clamp(1 - (gapRival ?? gy) / gy, 0, 1);
  const room = Math.max(0, Rb - view.R);
  const inner = view.R + Math.min(tune.BEHIND_MIN, room / 2);
  return inner + Math.max(0, Rb - inner) * k;
}

// Where to draw a rival, seen from your ship. place: 'ahead' (inside the ring, in the true aberrated projection,
// never nearer the centre than AHEAD_MIN × R: then `hollow`), 'abreast' (on the ring, within CONTACT_Z either way)
// or 'behind' (outside it by light gap, rearPx, and `edge` when it was pulled BEHIND_EDGE px inside the screen).
// secAhead: seconds ahead at your speed (− behind).
// Between abreast and CONTACT_Z behind the radius blends from the ring to the rear band, so nothing jumps.
export function rivalPx(view, rival, you, Rb, tune = view.tune || TUNE) {
  const ang = wrap((rival.bearing || 0) - view.cam);
  const dBeats = (rival.dist || 0) - (you.dist || 0);
  const secAhead = dBeats / view.bps;
  let r, place, hollow = false, edge = false;
  if (dBeats > 0) {
    r = depthPx(dBeats * tune.BEAT_R, view.phi, view.fPx);
    place = secAhead <= tune.CONTACT_Z ? 'abreast' : 'ahead';
    if (r < tune.AHEAD_MIN * view.R) { r = tune.AHEAD_MIN * view.R; hollow = true; }
  } else {
    const rear = rearPx(view, rival.gap, you.gap, Rb, tune);
    const blend = clamp(-secAhead / Math.max(1e-6, tune.CONTACT_Z), 0, 1);
    r = view.R + (rear - view.R) * blend;
    place = blend < 1 ? 'abreast' : 'behind';
    const lim = clampToScreen(view, ang, r, tune.BEHIND_EDGE);
    if (lim < r) { r = lim; edge = true; }
  }
  return { ...toScreen(view, ang, r), r, ang, place, hollow, edge, secAhead };
}

// ---------- the wings (8.1) ----------

// Hull pips left of the ship and fuel diamonds right of it, one every WING_PITCH° from WING_FROM° out, on an arc
// WING_OUT px outside the ring; the shield bubble round the ship. Desktop doubles every size. ship: { bearing, hull,
// hullMax, fuel, fuelCap, shield, shieldMax }. Each item has its centre, its angle, and how full it is.
export function wingsPx(view, ship, tune = view.tune || TUNE) {
  const s = view.scale || 1;
  const shipAng = wrap((ship.bearing || 0) - view.cam);
  const rad = view.R + tune.WING_OUT * s;
  const item = (i, side) => {
    const ang = shipAng + side * (tune.WING_FROM + tune.WING_PITCH * i);
    return { ...toScreen(view, ang, rad), ang, off: tune.WING_FROM + tune.WING_PITCH * i };
  };
  const hull = [];
  for (let i = 0; i < (ship.hullMax || 0); i++) {
    hull.push({ ...item(i, -1), full: i < (ship.hull || 0), len: 12 * s, wide: 4 * s });
  }
  const fuel = [];
  for (let i = 0; i < (ship.fuelCap || 0); i++) {
    fuel.push({ ...item(i, 1), fill: clamp((ship.fuel || 0) - i, 0, 1), size: 8 * s });
  }
  const at = toScreen(view, shipAng, view.R);
  return { hull, fuel, shield: { ...at, r: 13 * s, line: 1.25 * s, charges: ship.shield || 0,
    max: ship.shieldMax || 0 }, ship: { ...at, ang: shipAng } };
}

// ---------- text (15.2, 10.7, 7.6) ----------

// The caption line: the centre minus 0.55 launch-ring radii (portrait y 248, landscape 89, desktop 224). It does
// not move as the ring cinches.
export function captionY(view, tune = view.tune || TUNE) {
  const R0 = ringPx(tune.ETA0, view.short, tune);
  return view.cy - 0.55 * R0;
}

// A width estimate for bold capitals in system-ui (no canvas in the core).
export const textW = (text, px) => String(text).length * px * 0.62;

const inBox = (view, x, y, inset) => x >= inset && x <= view.w - inset && y >= inset && y <= view.h - inset;
const boxesNear = (a, b, gap) =>
  a.x - gap < b.x + b.w && b.x - gap < a.x + a.w && a.y - gap < b.y + b.h && b.y - gap < a.y + a.h;

// The light's label (7.6): a leader from the burst ring's 4:30 point (or, if that is off screen, the nearest point
// on the ring that is on screen, which is where the ring meets the right or the bottom edge), up and right 20 px,
// then 10 px flat, then the text in 11 px (22 on desktop). It flips to up and left when the text would leave the
// screen. Returns null if no part of the lower right of the ring is on screen.
export function lightLabelPx(view, Rb, text, tune = view.tune || TUNE) {
  const s = view.scale || 1, inset = tune.BEHIND_EDGE, px = 11 * s;
  let anchor = null;
  for (let k = 0; k <= 90 && !anchor; k += 0.5) {
    for (const th of k === 0 ? [45] : [45 + k, 45 - k]) {
      if (th < -90 || th > 135) continue;
      const x = view.cx + Math.cos(th * DEG) * Rb, y = view.cy + Math.sin(th * DEG) * Rb;
      if (inBox(view, x, y, inset)) { anchor = { x, y, th }; break; }
    }
  }
  if (!anchor) return null;
  const w = textW(text, px), d = (20 / Math.SQRT2) * s, flat = 10 * s, pad = 4 * s;
  let dir = 1;
  if (anchor.x + d + flat + pad + w > view.w - 4) dir = -1;
  const elbow = { x: anchor.x + dir * d, y: anchor.y - d };
  const end = { x: elbow.x + dir * flat, y: elbow.y };
  const tx = end.x + dir * pad;
  const box = { x: dir > 0 ? tx : tx - w, y: end.y - px * 0.6, w, h: px * 1.2 };
  return { anchor, elbow, end, x: tx, y: end.y, align: dir > 0 ? 'left' : 'right', px, box };
}

// Rival labels (10.7): at most `max` (2), in the order given (the caller sorts: Nemesis, boss, nearest, changed).
// Each sits on a 12 px leader pointing away from the ring centre, in 11 px (13 on desktop). Two ships within 10 px
// share one label. A label never comes within 24 px of `landmark` (a box { x, y, w, h }) and stays on screen; one
// that cannot is skipped. cands: [{ id, x, y, text }]. Returns [{ ids, text, anchor, elbow, x, y, align, px, box }].
export function placeLabels(view, cands, { landmark = null, max = 2 } = {}) {
  const px = view.desk ? 13 : 11, lead = 12 * (view.scale || 1), out = [], used = new Set();
  const avoid = landmark ? [landmark] : [];
  for (let i = 0; i < cands.length && out.length < max; i++) {
    const c = cands[i];
    if (used.has(c.id)) continue;
    const group = [c];
    for (let j = i + 1; j < cands.length; j++) {
      const o = cands[j];
      if (!used.has(o.id) && Math.hypot(o.x - c.x, o.y - c.y) <= 10) group.push(o);
    }
    const text = group.map((g) => g.text).join(' · ');
    const w = textW(text, px);
    const ux0 = c.x - view.cx, uy0 = c.y - view.cy, len = Math.hypot(ux0, uy0) || 1;
    let placed = null;
    // outward first, then the two sides, then inward
    for (const [ux, uy] of [[ux0 / len, uy0 / len], [-uy0 / len, ux0 / len], [uy0 / len, -ux0 / len],
      [-ux0 / len, -uy0 / len]]) {
      const elbow = { x: c.x + ux * lead, y: c.y + uy * lead };
      const right = ux >= 0;
      const tx = elbow.x + (right ? 3 : -3);
      const box = { x: right ? tx : tx - w, y: elbow.y - px * 0.6, w, h: px * 1.2 };
      if (box.x < 4 || box.y < 4 || box.x + box.w > view.w - 4 || box.y + box.h > view.h - 4) continue;
      if (avoid.some((a) => boxesNear(box, a, 24))) continue;
      if (out.some((l) => boxesNear(box, l.box, 2))) continue;
      placed = { ids: group.map((g) => g.id), text, anchor: { x: c.x, y: c.y }, elbow, x: tx, y: elbow.y,
        align: right ? 'left' : 'right', px, box };
      break;
    }
    if (!placed) continue;
    for (const g of group) used.add(g.id);
    out.push(placed);
  }
  return out;
}
