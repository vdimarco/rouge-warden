// Light Years Home v3: the 2D annotation layer over the 3D view (final.md 13.6, tech §4.6, §6.3). It draws the
// video's look: thin white rings with a diagonal leader line and a small label (scanned things), dotted rings at 40%
// for things to scan (with a filling arc while you hold the nose on one), orange for the one current objective, grey
// for done, 20% white for the rest of a course; edge chevrons for what is off screen and the orange HOME chevron; the
// radar, heading up; and the callouts that answer every risky move (NEAR, HAIRLINE, the drift tiers, TAKEDOWN, the
// nines), one at a time by priority. Labels are placed by core/labels.js (at most 6) clear of the HUD's rectangles.
// Marks are projected with the camera's own matrices, passed in as plain arrays (three.js elements, column-major),
// so this file never imports three. 3D gates and pads are drawn by render/gates.js; marks with ring: false get only
// their leader and label here.
import { TUNE } from '../core/tune.js';
import { placeLabels, MAX_LABELS } from '../core/labels.js';
import { blackbodyRGB } from '../core/physics.js';
import { fmtLy, MEDAL_ORDER } from './hud.js';

export const ORANGE = '#f08a2c';
export const MIN_RING_PX = 14;
export const MAX_RINGS = 20;
export const MAX_CHEVRONS = 4;
export const CHEVRON_INSET = 22;
const NEAR_Z = 0.05;
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const upper = (s) => String(s ?? '').toUpperCase();

// Drift tier colours: the sparks' star temperatures (red 3,200 K, white 5,800 K, blue 20,000 K).
const rgbCss = (T) => {
  const c = blackbodyRGB(T);
  const m = Math.max(c[0], c[1], c[2]) || 1;
  return `rgb(${Math.round((255 * c[0]) / m)}, ${Math.round((255 * c[1]) / m)}, ${Math.round((255 * c[2]) / m)})`;
};
export const TIER_COLOUR = Object.freeze([rgbCss(3200), rgbCss(5800), rgbCss(20000)]);

// ---------------------------------------------------------------- projection (pure)

/**
 * Where a point lands: cam = { view, proj (16 numbers each, column-major, three's matrixWorldInverse and
 * projectionMatrix elements), w, h }. p is [x, y, z] in zone coordinates; w = 0 projects a direction (a far thing).
 * Returns { x, y, depth, front, vx, vy } in CSS px (y down); vx, vy are view-space x and y (for chevrons behind you).
 */
export function projectPoint(cam, p, w = 1, out = {}) {
  const V = cam.view, P = cam.proj;
  const px = p[0], py = p[1], pz = p[2];
  const x = V[0] * px + V[4] * py + V[8] * pz + V[12] * w;
  const y = V[1] * px + V[5] * py + V[9] * pz + V[13] * w;
  const z = V[2] * px + V[6] * py + V[10] * pz + V[14] * w;
  const cx = P[0] * x + P[4] * y + P[8] * z + P[12];
  const cy = P[1] * x + P[5] * y + P[9] * z + P[13];
  const cw = P[3] * x + P[7] * y + P[11] * z + P[15];
  out.depth = -z;
  out.front = -z > (w ? NEAR_Z : 1e-6) && cw > 0;
  out.vx = x; out.vy = y;
  if (out.front) {
    out.x = ((cx / cw + 1) / 2) * cam.w;
    out.y = ((1 - cy / cw) / 2) * cam.h;
  } else {
    const s = Math.hypot(x, y) || 1;
    out.x = cam.w / 2 + (x / s) * 1e6;
    out.y = cam.h / 2 - (y / s) * 1e6;
  }
  return out;
}

// A ring's radius on screen for a world radius r at that depth (P[5] is 1 / tan(fovY / 2)).
export const ringPx = (cam, r, depth) => (fin(r) * cam.proj[5] * (cam.h / 2)) / Math.max(NEAR_Z, depth);

// The edge chevron for a point outside the box: { x, y, angle (0 = right, y down), edge } or null when inside.
export function chevronAt(pt, box, inset = CHEVRON_INSET) {
  const x0 = box.x + inset, x1 = box.x + box.w - inset, y0 = box.y + inset, y1 = box.y + box.h - inset;
  if (pt.front && pt.x >= x0 && pt.x <= x1 && pt.y >= y0 && pt.y <= y1) return null;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let dx, dy;
  if (pt.front) { dx = pt.x - cx; dy = pt.y - cy; } else {
    dx = pt.vx; dy = -pt.vy;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) dy = 1;   // dead behind: point down
    else if (pt.behind !== false && dy < 0 && Math.abs(dx) < Math.abs(dy) * 0.6) dy = -dy;   // behind: the bottom
  }
  let t = Infinity, edge = 'right';
  if (dx > 0 && (x1 - cx) / dx < t) { t = (x1 - cx) / dx; edge = 'right'; }
  if (dx < 0 && (x0 - cx) / dx < t) { t = (x0 - cx) / dx; edge = 'left'; }
  if (dy > 0 && (y1 - cy) / dy < t) { t = (y1 - cy) / dy; edge = 'bottom'; }
  if (dy < 0 && (y0 - cy) / dy < t) { t = (y0 - cy) / dy; edge = 'top'; }
  if (!Number.isFinite(t)) t = 0;
  return { x: cx + dx * t, y: cy + dy * t, angle: Math.atan2(dy, dx), edge };
}

// Where the radar puts a map point: heading up (heading in radians clockwise from +y), k px per u.
export function radarXY(dx, dy, heading, k, out = [0, 0]) {
  const c = Math.cos(heading), s = Math.sin(heading);
  out[0] = (dx * c - dy * s) * k;
  out[1] = -(dx * s + dy * c) * k;
  return out;
}

// ---------------------------------------------------------------- callouts (pure)

// Each risky move answers with a word by the ship. pri: a lower one never replaces a higher one in its first 0.6 s.
export const CALLOUTS = Object.freeze({
  near: { text: 'NEAR', pri: 1, tone: 'orange' },
  hairline: { text: 'HAIRLINE', pri: 3, tone: 'orange' },
  thread: { text: 'THREAD', pri: 5, tone: 'orange' },
  skimStart: { text: 'SKIM', pri: 2, tone: 'white' },
  draftStart: { text: 'DRAFT', pri: 2, tone: 'white' },
  driftTier: { text: ['DRIFT', 'HOT DRIFT', 'BLUE DRIFT'], pri: 3, tone: 'tier' },
  driftBoost: { text: 'BOOST', pri: 3, tone: 'tier' },
  boostStart: { text: 'BOOST', pri: 0, tone: 'white' },
  sling: { text: 'SLINGSHOT', pri: 4, tone: 'orange' },
  perfectSling: { text: 'PERFECT SLING', pri: 6, tone: 'orange' },
  takedown: { text: 'TAKEDOWN', pri: 6, tone: 'orange' },
  scrape: { text: 'SCRAPE', pri: 1, tone: 'grey' },
  crash: { text: 'CRASH', pri: 2, tone: 'grey' },
  bigCrash: { text: 'CRASH', pri: 4, tone: 'grey' },
  pad: { text: 'PAD', pri: 1, tone: 'white' },
  padPerfect: { text: 'PERFECT', pri: 3, tone: 'orange' },
  gate: { text: { bullseye: 'BULLSEYE', clip: 'CLIP' }, pri: 2, tone: 'white' },
  gateMiss: { text: 'MISSED · +3 S', pri: 3, tone: 'grey' },
  chainUp: { text: 'CHAIN', pri: 4, tone: 'orange' },
  chainBank: { text: '+', pri: 2, tone: 'white' },
  chainLost: { text: 'CHAIN LOST', pri: 2, tone: 'grey' },
  hook: { text: 'HOOKED', pri: 4, tone: 'white' },
  release: { text: 'LET GO', pri: 3, tone: 'white' },
  cargoHit: { text: 'CAREFUL', pri: 3, tone: 'grey' },
  jGraze: { text: 'GRAZE', pri: 1, tone: 'orange' },
  jHairline: { text: 'HAIRLINE', pri: 3, tone: 'orange' },
  jThread: { text: 'THREAD', pri: 5, tone: 'orange' },
  jPad: { text: 'PAD', pri: 1, tone: 'white' },
  jSkim: { text: 'SKIM', pri: 2, tone: 'white' },
  jHit: { text: 'HIT', pri: 2, tone: 'grey' },
  nine: { text: { 2: 'TWO NINES', 3: 'THREE NINES' }, pri: 8, tone: 'orange' },
  punch: { text: 'LIGHT SPEED', pri: 10, tone: 'white' },
});
export const CALLOUT_HOLD = 0.6;   // s a higher callout is safe from a lower one
export const CALLOUT_LIFE = 0.9;   // s on screen

// The callout one event makes: { text, pri, tone, colour } or null.
export function calloutOf(e) {
  const c = CALLOUTS[e?.type];
  if (!c) return null;
  let text = c.text, pri = c.pri, colour = null;
  switch (e.type) {
    case 'driftTier': {
      const k = clamp(fin(e.tier, 1), 1, 3) - 1;
      text = c.text[k]; colour = TIER_COLOUR[k]; pri += k;
      break;
    }
    case 'driftBoost': colour = TIER_COLOUR[clamp(fin(e.tier, 1), 1, 3) - 1]; break;
    case 'gate': text = c.text[e.kind]; if (!text) return null; if (e.kind === 'bullseye') pri = 3; break;
    case 'nine': text = c.text[e.n]; if (!text) return null; pri += e.n === 3 ? 2 : 0; break;
    case 'chainUp': text = `CHAIN ×${fin(e.mult, 2)}`; break;
    case 'chainBank':
      if (!(fin(e.points) > 0)) return null;
      text = `+${Math.round(e.points).toLocaleString('en-US')}`;
      break;
    case 'hairline': case 'jHairline': if (fin(e.rel) >= 40) pri += 1; break;
    default: break;
  }
  return { text, pri, tone: c.tone, colour };
}

// The callout queue: push(e, t) and current(t). Repeats of the same word within the life count up (NEAR ×3).
export function createCallouts() {
  let cur = null;
  return {
    push(e, t) {
      const c = calloutOf(e);
      if (!c) return false;
      if (cur && t - cur.t0 < CALLOUT_LIFE && cur.text === c.text) {
        cur.n++; cur.t0 = t; cur.pop = t;
        return true;
      }
      if (cur && t - cur.t0 < CALLOUT_HOLD && c.pri < cur.pri) return false;
      cur = { ...c, n: 1, t0: t, pop: t };
      return true;
    },
    current(t) {
      if (cur && t - cur.t0 > CALLOUT_LIFE + (cur.pri >= 8 ? 0.6 : 0)) cur = null;
      return cur;
    },
    clear() { cur = null; },
  };
}

// ---------------------------------------------------------------- marks from the game state

const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Build the overlay's marks from the game state and zone data, so main.js can pass them straight to draw() and add
 * its own (a scanned traffic galaxy, say). Reads WP6's zone data: scans with target { body } or { at, r } (a list of
 * points picks the nearest), far things (opts.dirOf(objectId, out) gives a far landmark's map direction, as
 * render/backdrop.js dirOf does), bodies with labels, giver rings, start rings, the exit, the running race's next
 * gate and actors. The objective is game.zone.waypoint: an id ('exit', a scan, ring, event or 'actor:<id>'), an
 * object { id, pos, label }, or a list of them (a beat that turns three far rings orange). opts.scan(id) is the
 * core's scan state ('unseen' | 'seen' | 'scanning' | 'scanned') when zone.js has it; opts.facts(id) a card.
 * A mark: { id, pos | dir, r (u) or rPx, kind, label, ring, chevron, priority, progress, medals, radar }.
 */
export function marksFrom(game, zone, opts = {}) {
  const out = [];
  if (!game || !zone) return out;
  const zr = game.zone || {};
  const ship = game.ship?.pos || [0, 0, 0];
  const T = game.tune || TUNE;
  const scanned = (id) => !!zr.scanned?.[id];
  const stateOf = (id) => opts.scan?.(id) || (scanned(id) ? 'scanned' : zr.scan?.id === id ? 'scanning'
    : zr.seen?.[id] ? 'seen' : 'unseen');
  const bodies = new Map((zone.bodies || []).map((b) => [b.id, b]));
  const wp = zr.waypoint;
  const goals = (Array.isArray(wp) ? wp : wp ? [wp] : []).map((w) => (typeof w === 'string' ? { id: w } : w));
  const isObj = (id) => goals.some((w) => w && (w.id === id || w.id === `actor:${id}`));
  const seenRange = T.RACE?.SEEN ?? 400;
  const scanProgress = (far) => clamp(fin(zr.scan?.t) / (far ? T.ZONE.FAR_T : T.ZONE.SCAN_T), 0, 1);

  // Scan targets with a place in the zone.
  for (const s of zone.scans || []) {
    const tg = s.target || {};
    if (s.far || tg.far) continue;                                   // drawn with the far things below
    const b = bodies.get(tg.body || s.body || s.id);
    let pos = s.pos || b?.pos || null, r = fin(tg.r, fin(b?.r, 3) * 1.25);
    const at = tg.at || s.at;
    if (!pos && Array.isArray(at)) {
      const list = Array.isArray(at[0]) ? at : [at];
      pos = list.reduce((best, p) => (!best || dist2(ship, p) < dist2(ship, best) ? p : best), null);
    }
    if (!pos) continue;
    const st = stateOf(s.id);
    if (st === 'unseen' && !opts.showUnseen) continue;
    const label = upper(s.label || b?.label || opts.facts?.(s.card || s.id)?.title || s.id);
    const kind = isObj(s.id) ? 'objective' : st === 'scanned' ? 'scanned' : st === 'scanning' ? 'scanning' : 'scan';
    out.push({ id: s.id, pos, r, kind, label, progress: st === 'scanning' ? scanProgress(false) : 0,
      priority: kind === 'objective' ? 100 : 40, radar: st === 'scanned' ? null : 'scan',
      chevron: kind === 'objective' });
  }
  // Far things in their real directions. An objective far ring is orange but unlabelled until scanned.
  if (opts.dirOf) {
    for (const f of zone.far || []) {
      const dir = opts.dirOf(f.object, [0, 0, 0]);
      if (!dir) continue;
      const id = f.scan || f.id;
      const st = f.scan ? stateOf(f.scan) : 'scanned';
      const obj = isObj(id) && st !== 'scanned';
      const kind = obj ? 'objective' : st === 'scanned' ? 'scanned' : st === 'scanning' ? 'scanning' : 'scan';
      out.push({ id, dir, rPx: 18, kind, label: obj ? '' : upper(f.label || f.object),
        progress: st === 'scanning' ? scanProgress(true) : 0, priority: obj ? 90 : st === 'scanned' ? 30 : 20,
        chevron: obj, scanning: st === 'scanning' });
    }
  }
  // Labelled bodies nearby read like the video's frames.
  for (const b of zone.bodies || []) {
    if (!b.label || out.some((m) => m.id === b.id) || dist2(ship, b.pos) > 220) continue;
    out.push({ id: b.id, pos: b.pos, r: fin(b.r, 3) * 1.2, kind: isObj(b.id) ? 'objective' : 'scanned',
      label: upper(b.label), priority: 10 });
  }
  // Giver and drop rings (3D rings: label only).
  for (const g of zone.rings || []) {
    if (!g.pos || dist2(ship, g.pos) > seenRange) continue;
    out.push({ id: g.id, pos: g.pos, r: fin(g.r, 6), kind: isObj(g.id) ? 'objective' : 'giver', ring: false,
      label: upper(g.label || g.id), priority: 60, radar: 'giver', chevron: isObj(g.id) });
  }
  // Start rings you have seen, with their medal pips; hidden while a mission or another event runs.
  const busy = !!(game.race || game.mission);
  for (const e of zone.events || []) {
    const p = e.start?.pos || e.ring?.pos || e.area?.centre;
    if (!p || busy || !e.start) continue;
    const seen = zr.seen?.[e.id] || dist2(ship, p) <= seenRange;
    if (!seen) continue;
    const best = game.progress?.events?.[e.id];
    const medals = best?.medal ? MEDAL_ORDER.indexOf(best.medal) + 1 : 0;
    out.push({ id: e.id, pos: p, r: fin(e.start?.r, 4.5), kind: isObj(e.id) ? 'objective' : 'start', ring: false,
      label: upper(e.title || e.id), medals, priority: 50, radar: 'start' });
  }
  // The running race: the next gate is the objective.
  const race = game.race;
  if (race && race.state === 'running') {
    const ev = (zone.events || []).find((e) => e.id === race.id);
    const gate = ev?.gates?.[fin(race.gate)];
    const pt = gate && ev.line?.[gate.at];
    if (pt) {
      out.push({ id: `${race.id}:gate`, pos: [pt[0], pt[1], pt[2] || 0], r: fin(gate.r, 4.5), kind: 'objective',
        ring: false, label: upper(gate.name || `GATE ${fin(race.gate) + 1}`), priority: 100, chevron: true,
        radar: 'objective' });
    }
  }
  // The exit gate, once open.
  if (zone.exit?.pos && zr.exitOpen) {
    out.push({ id: 'exit', pos: zone.exit.pos, r: fin(zone.exit.r, 10), kind: isObj('exit') ? 'objective' : 'exit',
      ring: false, label: upper(zone.exit.label || zone.exit.to), priority: 80, radar: 'exit',
      chevron: isObj('exit') });
  }
  // Actors: the objective's ring, and the radar's shapes.
  for (const a of game.actors || []) {
    if (!a?.pos) continue;
    const obj = isObj(a.id);
    out.push({ id: a.id, pos: a.pos, r: fin(a.data?.r, 1.6), kind: obj ? 'objective' : 'actor', ring: obj,
      label: obj ? upper(a.data?.label || a.label || a.id) : '', priority: obj ? 100 : 0, chevron: obj,
      radar: a.id === 'vela' || a.kind === 'racer' ? 'vela' : 'actor' });
  }
  // Waypoints with their own place (a map tap, a mission's point) that matched nothing above.
  for (const w of goals) {
    if (!w?.pos || out.some((m) => m.id === w.id && m.kind === 'objective')) continue;
    out.push({ id: w.id || 'waypoint', pos: w.pos, r: fin(w.r, 6), kind: 'objective', ring: w.ring !== false,
      label: upper(w.label || ''), priority: 100, chevron: true, radar: 'objective' });
  }
  return out;
}

// The HOME chevron's label from Earth's distance: 'HOME · 1.00 GLY'.
export const homeLabel = (aheadLy) => `HOME · ${fmtLy(aheadLy)}`;

// ---------------------------------------------------------------- drawing

/**
 * createOverlay(canvas, { tune }) → { resize(w, h, dpr), draw(view), clear(), rings, labels, chevrons }.
 * view = { game, zone, layout, cam ({ view, proj, w, h } or null), marks (marksFrom or your own), home ({ dir,
 * label } or null), events (core events since the last draw), dt, t (real s), reduced }.
 * rings, labels and chevrons are what the last draw put on screen (for picking and the hook).
 */
export function createOverlay(canvas, { tune = TUNE } = {}) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, ratio = 1;
  const widths = new Map();
  const callouts = createCallouts();
  let drawn = { rings: [], labels: [], chevrons: [] };
  let radarRange = tune.ZONE.RADAR, clock = 0;
  const pt = {}, xy = [0, 0];

  function resize(w, h, dpr) {
    const k = clamp(fin(dpr, globalThis.devicePixelRatio || 1), 1, 3);
    const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
    if (w === W && h === H && k === ratio && canvas.width === cw) return;
    W = w; H = h; ratio = k;
    canvas.width = cw; canvas.height = ch;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    widths.clear();
  }

  const font = (px, weight = 700) => `${weight} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  function measure(text, f) {
    const key = `${f}|${text}`;
    let w = widths.get(key);
    if (w === undefined) {
      if (widths.size > 800) widths.clear();
      ctx.font = f;
      w = ctx.measureText(text).width;
      widths.set(key, w);
    }
    return w;
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const rectBox = (r) => (r ? { x: r[0], y: r[1], w: r[2], h: r[3] } : null);

  // The area chevrons sit in: under the reading rows, above a control in the middle of the bottom edge (the chip).
  function freeBox(layout) {
    const s = layout?.safe || { t: 0, b: 0, l: 0, r: 0 }, R = layout?.rects || {};
    const topY = Math.max(s.t, ...['info', 'toast', 'radar', 'captions'].filter((n) => R[n] && R[n][1] < H / 2)
      .filter((n) => n !== 'radar' || layout.kind === 'portrait').map((n) => R[n][1] + R[n][3])) + 4;
    let botY = H - s.b - 8;
    for (const n of ['chip', 'boost', 'gas', 'brake']) {
      const r = R[n];
      if (r && r[1] > H / 2 && r[0] < W * 0.7 && r[0] + r[2] > W * 0.3) botY = Math.min(botY, r[1] - 6);
    }
    return { x: s.l + 4, y: topY, w: W - s.l - s.r - 8, h: Math.max(40, botY - topY) };
  }

  // An off-screen point as a direction from the screen's centre (chevronAt then puts it on the box's edge).
  const toward = (p) => ({ front: false, behind: !p.front, vx: p.front ? p.x - W / 2 : p.vx,
    vy: p.front ? H / 2 - p.y : p.vy });

  // Slide a chevron off any HUD box it lands on: inward from a side edge, up or down from the top or bottom.
  function clearOfHud(c, layout) {
    const rects = Object.entries(layout?.rects || {}).filter(([n]) => n !== 'ship' && n !== 'pips');
    for (let k = 0; k < 4; k++) {
      const hit = rects.find(([, r]) => c.x > r[0] - 8 && c.x < r[0] + r[2] + 8 && c.y > r[1] - 8
        && c.y < r[1] + r[3] + 8);
      if (!hit) break;
      const r = hit[1];
      if (c.edge === 'right') c.x = r[0] - 14;
      else if (c.edge === 'left') c.x = r[0] + r[2] + 14;
      else if (c.edge === 'bottom') c.y = r[1] - 14;
      else c.y = r[1] + r[3] + 14;
    }
    return c;
  }

  function ring(x, y, r, style) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.lineWidth = style.lw || 1;
    ctx.strokeStyle = style.colour;
    ctx.setLineDash(style.dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const STYLE = {
    scan: { colour: 'rgba(255,255,255,0.4)', dash: [2, 4] },
    scanning: { colour: 'rgba(255,255,255,0.55)', dash: [2, 4] },
    scanned: { colour: 'rgba(255,255,255,0.85)' },
    objective: { colour: ORANGE, lw: 1.5 },
    done: { colour: 'rgba(150,150,150,0.55)' },
    course: { colour: 'rgba(255,255,255,0.2)' },
    start: { colour: 'rgba(255,255,255,0.85)' },
    giver: { colour: 'rgba(255,255,255,0.85)' },
    exit: { colour: 'rgba(255,255,255,0.85)' },
    actor: { colour: 'rgba(255,255,255,0.5)' },
  };
  const LABELLED = new Set(['scanned', 'objective', 'start', 'giver', 'exit']);

  function chevron(c, colour, size = 9) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.75);
    ctx.lineTo(-size * 0.3, 0);
    ctx.lineTo(-size * 0.7, size * 0.75);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.restore();
  }

  // A chevron's label, inside the screen beside it; moved above or below when that spot covers a HUD box or a label
  // already drawn. avoid: [x, y, w, h] boxes.
  function chevronLabel(c, text, colour, f, avoid = []) {
    const w = measure(text, f), hgt = 14;
    let align = 'center', x = c.x - Math.cos(c.angle) * 16, y = c.y - Math.sin(c.angle) * 16;
    if (c.edge === 'right') { align = 'right'; x -= 2; } else if (c.edge === 'left') { align = 'left'; x += 2; }
    else y += c.edge === 'top' ? 8 : -8;
    const left = (ax) => (align === 'right' ? ax - w : align === 'left' ? ax : ax - w / 2);
    const fits = (ax, ay) => !avoid.some((r) => left(ax) < r[0] + r[2] && r[0] < left(ax) + w
      && ay - hgt / 2 < r[1] + r[3] && r[1] < ay + hgt / 2);
    const spots = [[x, y], [x, y - 18], [x, y + 18], [x, y - 34], [x, y + 34]];
    const [sx, sy] = spots.find(([ax, ay]) => fits(ax, ay)) || spots[0];
    let tx = clamp(sx, w / 2 + 4, W - w / 2 - 4);
    if (align === 'right') tx = Math.max(sx, w + 4);
    if (align === 'left') tx = Math.min(sx, W - w - 4);
    ctx.font = f;
    ctx.fillStyle = colour;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    ctx.fillText(text, tx, sy);
    const rect = [left(tx), sy - hgt / 2, w, hgt];
    avoid.push(rect);
    return rect;
  }

  // ---------- the radar

  function drawRadar(view, rect) {
    const g = view.game, zone = view.zone, ship = g?.ship;
    if (!rect || !ship) return;
    const [rx, ry, rw, rh] = rect;
    const R = Math.min(rw, rh) / 2, cx = rx + rw / 2, cy = ry + rh / 2;
    const Z = tune.ZONE;
    // Range: 300 u at cruise, 420 on boost, 200 in a pocket or with the objective within 150 u.
    const objMark = (view.marks || []).find((m) => m.kind === 'objective' && m.pos);
    const near = g.pocketId || (objMark && dist2(objMark.pos, ship.pos) < 150);
    const want = near ? Z.RADAR_NEAR : ship.boosting ? Z.RADAR_BOOST : Z.RADAR;
    radarRange += (want - radarRange) * (1 - Math.exp(-fin(view.dt, 1 / 60) / 0.5));
    const k = R / radarRange;
    const v = ship.vel || [0, 0, 0];
    const head = Math.hypot(v[0], v[1]) > 2 ? Math.atan2(v[0], v[1]) : fin(ship.yaw);
    const sp = ship.pos;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.stroke();
    ctx.clip();

    // Roads and orbits, faint.
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = Math.max(1, Math.min(3, 6 * k));
    for (const road of zone?.roads || []) {
      ctx.beginPath();
      if (road.kind === 'orbit' && road.centre) {
        const rr = Array.isArray(road.r) ? (road.r[0] + road.r[1]) / 2 : fin(road.r);
        radarXY(road.centre[0] - sp[0], road.centre[1] - sp[1], head, k, xy);
        ctx.arc(cx + xy[0], cy + xy[1], Math.max(1, rr * k), 0, TAU);
      } else if (road.pts) {
        road.pts.forEach((p, i) => {
          radarXY(p[0] - sp[0], p[1] - sp[1], head, k, xy);
          if (i) ctx.lineTo(cx + xy[0], cy + xy[1]); else ctx.moveTo(cx + xy[0], cy + xy[1]);
        });
      }
      ctx.stroke();
    }
    // The zone's rim when in range.
    const zR = fin(zone?.R, 0);
    if (zR && Math.hypot(sp[0], sp[1]) + radarRange > zR) {
      radarXY(-sp[0], -sp[1], head, k, xy);
      ctx.beginPath();
      ctx.arc(cx + xy[0], cy + xy[1], zR * k, 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // Marks: the objective last, so it sits on top; out of range, things sit on the rim as ticks.
    const marks = (view.marks || []).filter((m) => m.pos && (m.radar || m.kind === 'objective'));
    marks.sort((a, b) => (a.kind === 'objective') - (b.kind === 'objective'));
    for (const m of marks) {
      radarXY(m.pos[0] - sp[0], m.pos[1] - sp[1], head, k, xy);
      const d = Math.hypot(xy[0], xy[1]);
      const out = d > R - 4;
      const x = cx + (out ? (xy[0] / d) * (R - 3) : xy[0]), y = cy + (out ? (xy[1] / d) * (R - 3) : xy[1]);
      const obj = m.kind === 'objective';
      if (out && !obj && m.radar !== 'exit') continue;
      ctx.beginPath();
      if (obj) {
        ctx.fillStyle = ORANGE;
        ctx.arc(x, y, out ? 2.5 : 3.5, 0, TAU);
        ctx.fill();
      } else if (m.radar === 'start' || m.radar === 'giver') {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
        ctx.arc(x, y, 3, 0, TAU); ctx.stroke();
      } else if (m.radar === 'scan') {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.setLineDash([1.5, 2]);
        ctx.arc(x, y, 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      } else if (m.radar === 'exit') {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.2;
        ctx.rect(x - 3, y - 3, 6, 6); ctx.stroke();
      } else if (m.radar === 'vela') {
        ctx.fillStyle = '#cfe0ff'; ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(190,190,190,0.85)';
        ctx.moveTo(x, y - 3); ctx.lineTo(x + 2.6, y + 2); ctx.lineTo(x - 2.6, y + 2); ctx.closePath(); ctx.fill();
      }
      const dz = fin(m.pos[2]) - fin(sp[2]);
      if (!out && Math.abs(dz) > 30) {          // above or below the plane
        ctx.beginPath();
        const s = dz > 0 ? -1 : 1;
        ctx.moveTo(x - 2.5, y + s * 5); ctx.lineTo(x, y + s * 7.5); ctx.lineTo(x + 2.5, y + s * 5);
        ctx.strokeStyle = obj ? ORANGE : 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    // Home: an orange tick on the rim.
    const hd = view.home?.dir;
    if (hd && Math.hypot(hd[0], hd[1]) > 1e-6) {
      radarXY(hd[0], hd[1], head, 1, xy);
      const a = Math.atan2(xy[1], xy[0]);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
      ctx.lineTo(cx + Math.cos(a) * (R + 1), cy + Math.sin(a) * (R + 1));
      ctx.strokeStyle = ORANGE; ctx.lineWidth = 2.5; ctx.stroke();
    }
    // The ship: a white chevron with an orange tip, pointing up.
    const s = Math.max(5, R * 0.1);
    ctx.beginPath();
    ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s * 0.75, cy + s * 0.8); ctx.lineTo(cx, cy + s * 0.35);
    ctx.lineTo(cx - s * 0.75, cy + s * 0.8); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s * 0.28, cy - s * 0.35); ctx.lineTo(cx - s * 0.28, cy - s * 0.35);
    ctx.closePath(); ctx.fillStyle = ORANGE; ctx.fill();
  }

  // ---------- callouts by the ship

  // Where callouts go: just above the drift pips (above the hint when a short screen puts it there); the big ones
  // (the nines, LIGHT SPEED) under the reading rows.
  function calloutSpot(L, big) {
    const pips = L.rects.pips || L.rects.ship;
    const px = (L.kind === 'desktop' ? 22 : L.kind === 'landscape' ? 17 : 19) * (big ? 1.35 : 1);
    const x = pips[0] + pips[2] / 2;
    let y = big ? H * 0.38 : pips[1] - px * 0.9;
    if (big && L.rects.toast) y = Math.max(y, L.rects.toast[1] + L.rects.toast[3] + px * 2);
    const hr = L.rects.hint;
    if (!big && hr && y + px > hr[1] && y - px < hr[1] + hr[3]) y = hr[1] - px * 0.8;
    return { x, y, px };
  }
  // The box labels keep clear of: the callout's line, with room for its rise.
  function calloutBox(L) {
    if (!L?.rects?.pips && !L?.rects?.ship) return null;
    const { x, y, px } = calloutSpot(L, false);
    const w = px * 9;
    return { x: x - w / 2, y: y - px - 14, w, h: px * 2 + 14 };
  }

  function drawCallout(view) {
    const t = clock;
    for (const e of view.events || []) callouts.push(e, t);
    const c = callouts.current(t);
    const L = view.layout;
    if (!c || !L) return;
    const big = c.pri >= 8;
    const age = t - c.t0, life = CALLOUT_LIFE + (big ? 0.6 : 0);
    const pop = view.reduced ? 1 : 1 + 0.3 * Math.max(0, 1 - (t - c.pop) / 0.12);
    const alpha = clamp((life - age) / 0.3, 0, 1);
    const rise = view.reduced ? 0 : Math.min(1, age / life) * 12;
    const { x, y: y0, px } = calloutSpot(L, big);
    const y = y0 - (big ? 0 : rise);
    const label = c.n > 1 ? `${c.text} ×${c.n}` : c.text;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.font = font(px, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = c.colour || (c.tone === 'orange' ? ORANGE : c.tone === 'grey' ? '#a6a6a6' : '#fff');
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  // ---------- one frame

  function draw(view) {
    clock += clamp(fin(view.dt, 1 / 60), 0, 0.25);
    clear();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const g = view.game, L = view.layout, cam = view.cam;
    const mode = g?.mode || 'title';
    drawn = { rings: [], labels: [], chevrons: [] };
    const hidden = mode === 'title' || mode === 'paused' || mode === 'log';
    const inZone = !(mode === 'punch' || mode === 'tunnel');
    if (hidden) { callouts.clear(); return drawn; }

    if (cam && inZone) {
      const box = freeBox(L);
      const items = [], rings = [];
      for (const m of view.marks || []) {
        if (rings.length >= MAX_RINGS && m.kind !== 'objective') continue;
        if (m.dir) projectPoint(cam, m.dir, 0, pt); else if (m.pos) projectPoint(cam, m.pos, 1, pt); else continue;
        let r = m.dir ? fin(m.rPx, 16) : ringPx(cam, fin(m.r, 2), pt.depth);
        if (m.kind === 'scanned' && m.pos && r > Math.min(W, H) * 0.3) continue;   // too close to need a label
        r = clamp(r, MIN_RING_PX, Math.min(W, H) * 0.42);
        const on = pt.front && pt.x > -r && pt.x < W + r && pt.y > -r && pt.y < H + r;
        const entry = { id: m.id, kind: m.kind, x: pt.x, y: pt.y, r, front: pt.front, onScreen: on, mark: m,
          vx: pt.vx, vy: pt.vy };
        rings.push(entry);
        if (on && m.label && LABELLED.has(m.kind)) {
          items.push({ id: m.id, x: pt.x, y: pt.y, r: m.ring === false ? r * 0.9 : r, text: m.label,
            width: measure(m.label, font(L?.kind === 'desktop' ? 12 : 10.5, 600)),
            priority: fin(m.priority) + (m.kind === 'objective' ? 1000 : 0) });
        }
      }
      // Rings.
      for (const e of rings) {
        if (!e.onScreen) continue;
        const m = e.mark;
        const st = STYLE[m.kind] || STYLE.scanned;
        if (m.ring !== false) ring(e.x, e.y, e.r, st);
        if (m.kind === 'scanning' && m.progress > 0) {
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r, -Math.PI / 2, -Math.PI / 2 + TAU * m.progress);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }
        drawn.rings.push({ id: e.id, kind: m.kind, x: e.x, y: e.y, r: e.r });
      }
      // Labels with their leaders, clear of the HUD.
      const avoid = Object.entries(L?.rects || {}).filter(([n]) => n !== 'ship')
        .map(([, r]) => rectBox(r));
      const cb = calloutBox(L);
      if (cb) avoid.push(cb);
      const fpx = L?.kind === 'desktop' ? 12 : 10.5;
      const placed = placeLabels(items, { width: W, height: H, avoid, max: MAX_LABELS, fontPx: fpx,
        box: { x: box.x, y: Math.max(0, box.y - 30), w: box.w, h: box.h + 30 }, leader: 16, run: 12 });
      ctx.font = font(fpx, 600);
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      for (const p of placed) {
        const m = rings.find((e) => e.id === p.id)?.mark;
        const colour = m?.kind === 'objective' ? ORANGE : 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        ctx.moveTo(p.anchor[0], p.anchor[1]);
        ctx.lineTo(p.elbow[0], p.elbow[1]);
        ctx.lineTo(p.end[0], p.end[1]);
        ctx.strokeStyle = colour; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = colour;
        ctx.textAlign = p.align;
        ctx.fillText(p.text, p.textX, p.textY);
        if (m?.medals !== undefined) {                  // four medal pips under a start ring's label
          const w = p.rect.w, x0 = p.align === 'left' ? p.textX : p.textX - w;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(x0 + 3 + i * 9, p.textY + fpx, 2.6, 0, TAU);
            ctx.lineWidth = 1; ctx.strokeStyle = colour; ctx.stroke();
            if (i < m.medals) { ctx.fillStyle = colour; ctx.fill(); }
          }
        }
        drawn.labels.push({ id: p.id, text: p.text, rect: [p.rect.x, p.rect.y, p.rect.w, p.rect.h] });
      }
      // Edge chevrons for what is off the screen: the objective first, at most 4. Their labels keep clear of the HUD
      // and of the labels placed above.
      const hudBoxes = Object.entries(L?.rects || {}).filter(([n]) => n !== 'ship').map(([, r]) => r)
        .concat(drawn.labels.map((l) => l.rect));
      const onScreen = (e) => e.front && e.x >= 0 && e.x <= W && e.y >= 0 && e.y <= H;
      const off = rings.filter((e) => e.mark.chevron && !onScreen(e));
      off.sort((a, b) => (b.kind === 'objective') - (a.kind === 'objective'));
      for (const e of off.slice(0, MAX_CHEVRONS)) {
        const c = chevronAt(toward(e), box);
        if (!c) continue;
        clearOfHud(c, L);
        const colour = e.kind === 'objective' ? ORANGE : 'rgba(255,255,255,0.75)';
        chevron(c, colour);
        if (e.kind === 'objective' && e.mark.label) chevronLabel(c, e.mark.label, colour, font(fpx, 700), hudBoxes);
        drawn.chevrons.push({ id: e.id, x: c.x, y: c.y, angle: c.angle });
      }
      // HOME: an orange chevron at the edge toward Earth, or a marker where it lies.
      if (view.home?.dir) {
        projectPoint(cam, view.home.dir, 0, pt);
        const visible = pt.front && pt.x >= 8 && pt.x <= W - 8 && pt.y >= 8 && pt.y <= H - 8;
        const c = visible ? null : chevronAt(toward(pt), box);
        const label = view.home.label || 'HOME';
        if (c) {
          clearOfHud(c, L);
          chevron(c, ORANGE, 10);
          chevronLabel(c, label, ORANGE, font(fpx, 700), hudBoxes);
          drawn.chevrons.push({ id: 'home', x: c.x, y: c.y, angle: c.angle });
        } else {
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y + 6); ctx.lineTo(pt.x - 6, pt.y - 4); ctx.lineTo(pt.x + 6, pt.y - 4); ctx.closePath();
          ctx.fillStyle = ORANGE; ctx.fill();
          ctx.font = font(fpx, 700); ctx.textAlign = 'center'; ctx.fillText(label, pt.x, pt.y - 14);
          drawn.chevrons.push({ id: 'home', x: pt.x, y: pt.y, angle: Math.PI / 2, onScreen: true });
        }
      }
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    if (L?.rects?.radar && mode !== 'punch' && mode !== 'tunnel') drawRadar(view, L.rects.radar);
    drawCallout(view);
    return drawn;
  }

  return {
    resize, draw, clear,
    get rings() { return drawn.rings; },
    get labels() { return drawn.labels; },
    get chevrons() { return drawn.chevrons; },
  };
}
