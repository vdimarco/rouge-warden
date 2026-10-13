// Light Years Home: the annotation layer. A 2D canvas over the WebGL view, redrawn each frame from core/project.js
// (the same light-speed maths as the star shader), so rings stay on their objects at any throttle. It draws thin
// rings with a diagonal leader and a short flat run to a small label, as in the video: candidate rings A B C (grey
// after a wrong lock, pulsing for a hint), edge chevrons for candidates off screen, the Laniakea ring, the landmark
// at its reveal, rings that pass during a flight, the gates of the zones ahead, crack lines when a pane breaks, the
// address rings of the ending and its orange "Home" label. Labels are placed by core/labels.js, at most 6.
import { project, edgeChevron } from '../core/project.js';
import { placeLabels, MAX_LABELS } from '../core/labels.js';
import { HIT_MIN } from '../core/pick.js';
import { OBJECTS, distanceLy } from '../core/objects.js';
import { STOPS } from '../core/route.js';
import { legPath } from '../core/geo.js';
import { armsPassed } from '../core/gas.js';
import { legOf, zoneAt, scanOf, PANES } from '../core/engine.js';
import { groupDigits } from '../core/physics.js';
import { mulberry32, hashSeed } from '../core/rng.js';
import { distanceText } from './hud.js';

export const HOME_COLOUR = '#f08a2c';
export const LABEL_COLOUR = '#ffffff';
export const GREY_COLOUR = '#8c8c8c';
const RING_ALPHA = 0.8;          // rings are 1 CSS px at 80 % white
const TEXT_ALPHA = 0.92;
const GATE_LEAD = 2.5;           // screen seconds before a zone: its gate starts to show
const GATE_ANGLE = 0.03;         // a gate's angular radius when it first shows (radians)
const PULSE_S = 1.2;             // a hint pulse every this many seconds
const RING_DRAW = 0.6;           // seconds for a ring to draw on
const CRACK_FLASH = 0.6;         // seconds: a fresh crack fades to its trace
const CRACK_TRACE = 0.18;        // a cracked pane's lines stay this bright for the rest of the flight
const PASS_BEFORE = 0.35, PASS_AFTER = 0.12;   // share of a leg's screen time a passing ring shows around its p
const MAX_SHOWN = MAX_LABELS;     // at most 6 labels at once
const BIG_RING = 40;             // px: a ring this big may hang its label from any side
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Disc planes for rings drawn as tilted ellipses: Laniakea lies near the supergalactic plane (pole at l 47.37°,
// b 6.32°); the Milky Way and the Orion Arm lie in the galactic plane.
const SUPERGALACTIC = [0.67306, 0.73135, 0.11008];
const DISCS = { laniakea: SUPERGALACTIC, 'milky-way': [0, 0, 1], 'orion-arm': [0, 0, 1] };
const ADDRESS_ORDER = ['earth', 'sun', 'orion-arm', 'milky-way', 'local-group', 'laniakea'];   // geo.ADDRESS
const ADDRESS = new Set(ADDRESS_ORDER);
const ARM_RING_LY = 1500;        // half the width of a spiral arm, for its ring

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1]; };
const nameOf = (id) => (OBJECTS[id] && OBJECTS[id].name) || id;

// Gas density in words: '1 atom per cm³', '0.3 atoms per cm³', '3,000 atoms per m³'.
export function densityText(n) {
  if (!(n > 0)) return '';
  const per = n >= 0.01 ? [n, 'cm³'] : [n * 1e6, 'm³'];
  const v = per[0] >= 100 ? groupDigits(Number(per[0].toPrecision(2))) : String(Number(per[0].toPrecision(2)));
  return `${v} ${v === '1' ? 'atom' : 'atoms'} per ${per[1]}`;
}

// Two unit vectors spanning the plane with this normal.
function planeAxes(normal) {
  const n = unit(normal);
  const helper = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = unit(cross(n, helper));
  return [u, cross(n, u)];
}

// The crack lines of one pane, seeded: an impact point (shares of the screen) and polylines in units of the screen's
// shorter side, as flat arrays [x0, y0, x1, y1, ...]: jagged radial cracks with side branches and two rough rings.
const IMPACTS = [[0.24, 0.3], [0.76, 0.64], [0.66, 0.24]];
export function crackPattern(seed, pane) {
  const rnd = mulberry32(hashSeed(seed, 'crack', pane));
  const [ix, iy] = IMPACTS[((pane % 3) + 3) % 3];
  const fx = ix + (rnd() - 0.5) * 0.08, fy = iy + (rnd() - 0.5) * 0.08;
  const lines = [], arms = 7 + Math.floor(rnd() * 3), spokes = [];
  for (let a = 0; a < arms; a++) {
    let ang = (2 * Math.PI * (a + 0.3 * rnd())) / arms, x = 0, y = 0, len = 0;
    const reach = 0.22 + 0.32 * rnd(), line = [0, 0], marks = [];
    while (len < reach) {
      const step = 0.025 + 0.04 * rnd();
      ang += (rnd() - 0.5) * 0.5;
      x += Math.cos(ang) * step; y += Math.sin(ang) * step; len += step;
      line.push(x, y);
      marks.push([x, y, len]);
      if (len > 0.08 && rnd() < 0.22) {
        // a side branch
        let bx = x, by = y, ba = ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + 0.5 * rnd());
        const b = [bx, by];
        for (let k = 0, n = 2 + Math.floor(rnd() * 3); k < n; k++) {
          ba += (rnd() - 0.5) * 0.6;
          const s = 0.02 + 0.03 * rnd();
          bx += Math.cos(ba) * s; by += Math.sin(ba) * s;
          b.push(bx, by);
        }
        lines.push(b);
      }
    }
    lines.unshift(line);
    spokes.push(marks);
  }
  // rough rings round the impact, joining neighbouring cracks
  for (const at of [0.04, 0.09]) {
    for (let a = 0; a < arms; a++) {
      if (rnd() < 0.3) continue;
      const p = spokes[a].find((m) => m[2] >= at), q = spokes[(a + 1) % arms].find((m) => m[2] >= at);
      if (!p || !q) continue;
      const mx = (p[0] + q[0]) / 2 * (0.9 + 0.2 * rnd()), my = (p[1] + q[1]) / 2 * (0.9 + 0.2 * rnd());
      lines.push([p[0], p[1], mx, my, q[0], q[1]]);
    }
  }
  return { fx, fy, lines };
}

export function createOverlay(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, ratio = 1, autoRatio = true;
  let drawnRings = [], drawnLabels = [], drawnCracks = 0, blank = false;
  const widths = new Map();
  // cracks: pane index → { t0: engine time of the crack, or -Infinity for a trace with no flash }
  const cracks = new Map();
  const patterns = new Map();
  let lastPanes = null, lastT = 0, lastSeed = null, lanSince = null;
  const armCache = new Map();

  function deviceRatio() {
    const d = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    return Math.min(3, d);
  }

  // Size the canvas: width and height in CSS px, ratio device px per CSS px. With no arguments it reads the window.
  function resize(width, height, r) {
    const w = finite(width) && width > 0 ? width : canvas.clientWidth || globalThis.innerWidth || 300;
    const h = finite(height) && height > 0 ? height : canvas.clientHeight || globalThis.innerHeight || 150;
    autoRatio = !(finite(r) && r > 0);
    const k = autoRatio ? deviceRatio() : r;
    if (w === W && h === H && k === ratio && canvas.width === Math.round(w * k)) return;
    W = w; H = h; ratio = k;
    canvas.width = Math.max(1, Math.round(W * ratio));
    canvas.height = Math.max(1, Math.round(H * ratio));
    widths.clear();
  }

  function measure(text, font) {
    const key = `${font}|${text}`;
    let w = widths.get(key);
    if (w === undefined) {
      if (widths.size > 600) widths.clear();
      ctx.font = font;
      w = ctx.measureText(text).width;
      widths.set(key, w);
    }
    return w;
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ---------- what to draw ----------

  // A ring on a catalogue object. kind: candidate | landmark | pass | laniakea | address | home | void | target.
  function objRing(id, cam, kind, extra = {}) {
    if (!OBJECTS[id]) return null;
    const p = project(id, cam);
    // a ring on a solid body (the Sun, a planet, the Moon) stands a little off its edge
    const r = Number.isFinite(OBJECTS[id].radiusKm) ? Math.max(p.r, p.rawR * 1.12 + 3) : p.r;
    const ring = { id, kind, letter: null, x: p.x, y: p.y, r, p, alpha: 1, progress: 1, grey: false,
      strong: false, pulse: false, label: null, ...extra };
    if (DISCS[id]) ring.poly = discPoly(OBJECTS[id].pos, OBJECTS[id].radiusLy, DISCS[id], cam, 72);
    return ring;
  }

  // A circle in space (centre, radius in ly, plane normal) as screen points { x, y, ok } (ok: well in front).
  function discPoly(centre, radius, normal, cam, n = 64) {
    const [u, w] = planeAxes(normal);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (2 * Math.PI * i) / n, c = Math.cos(a) * radius, s = Math.sin(a) * radius;
      const q = project([centre[0] + u[0] * c + w[0] * s, centre[1] + u[1] * c + w[1] * s,
        centre[2] + u[2] * c + w[2] * s], cam);
      pts.push({ x: q.x, y: q.y, ok: q.front && q.dir[2] > 0.02 });
    }
    return pts;
  }

  const onCanvas = (x, y, m) => x >= -m && x <= W + m && y >= -m && y <= H + m;

  // The candidates of the scan (clue, scan and fork), with chevrons for those outside the free box.
  function candidates(state, cam, out, chevrons, reduced) {
    const sc = scanOf(state);
    if (!sc) return;
    const ph = state.phase;
    const hintLetter = state.scan.hint ? sc.target : state.scan.teach ? 'A' : null;
    const box = cam.box || { x: 0, y: 0, w: W, h: H };
    sc.candidates.forEach((c, k) => {
      const ring = objRing(c.id, cam, 'candidate', { letter: c.letter, grey: c.grey });
      if (!ring) return;
      ring.strong = sc.open === c.letter;
      ring.pulse = !c.grey && hintLetter === c.letter && sc.open !== c.letter;
      ring.progress = ph === 'clue' && !reduced ? ease((state.phaseT - 0.15 * k) / 0.5) : 1;
      ring.alpha = ph === 'clue' && reduced ? ease(state.phaseT / 0.4) : 1;
      if (ph === 'fork' && !c.grey && c.letter !== sc.target) ring.alpha *= 0.5;
      const text = c.grey ? nameOf(c.id) : `${c.letter} · ${distanceText(distanceLy(cam.ship || cam.pos, c.id))}`;
      ring.label = { text, colour: c.grey ? GREY_COLOUR : LABEL_COLOUR, priority: ring.strong ? 100 : c.grey ? 70 : 90,
        fallback: c.letter };
      out.push(ring);
      const inBox = ring.p.front && ring.x >= box.x && ring.x <= box.x + box.w && ring.y >= box.y
        && ring.y <= box.y + box.h;
      if (!c.grey && !inBox) {
        const ch = edgeChevron(ring.p, cam);
        if (ch) chevrons.push({ ...ch, letter: c.letter, pulse: ring.pulse, alpha: ring.alpha });
      }
    });
  }

  // The gate of the zone ahead in a flight: a thin tilted ring on the camera's path at the zone's start, growing as
  // the zone comes up, labelled with the zone and its gas.
  function gate(state, cam, out) {
    const za = zoneAt(state);
    if (!za || za.dropout || !(za.nextIn <= GATE_LEAD)) return;
    const leg = legOf(state), k = za.index, z = leg.zones[k], next = leg.zones[k + 1];
    if (!next || next.dropout) return;
    const hazard = next.kind === 'waypoint' || next.n >= 0.1 || next.notch < z.notch - 0.05;
    if (!hazard) return;
    // the gate's size: GATE_ANGLE seen from where it first shows (GATE_LEAD screen seconds out at the notch)
    const p0 = clamp(1 - GATE_LEAD / z.screen, 0, 1), lam = z.lambda;
    const left = lam > 1e-6 ? (Math.exp(-lam * p0) - Math.exp(-lam)) / (1 - Math.exp(-lam)) : 1 - p0;
    const radius = Math.max(z.ly * left, 1e-9) * Math.tan(GATE_ANGLE);
    const at = legPath(leg.stop, leg.branch, next.startLy);
    const offset = sub(cam.pos, cam.ship || cam.pos);
    const centre = add(at.pos, offset);
    // tilt the gate 60° to 70° out of square with the path, about a seeded axis
    const rnd = mulberry32(hashSeed(state.seed, 'gate', leg.stop, k + 1));
    const fwd = unit(at.fwd), [u, w] = planeAxes(fwd);
    const spin = 2 * Math.PI * rnd(), tilt = (60 + 10 * rnd()) * Math.PI / 180;
    const axis = [0, 1, 2].map((i) => u[i] * Math.cos(spin) + w[i] * Math.sin(spin));
    const side = cross(fwd, axis);
    const normal = unit([0, 1, 2].map((i) => fwd[i] * Math.cos(tilt) + side[i] * Math.sin(tilt)));
    const poly = discPoly(centre, radius, normal, cam, 96);
    // it fades in as it shows, and out as it grows past the screen (the ship flies through it)
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of poly) {
      if (!q.ok) continue;
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const extent = Math.max(x1 - x0, y1 - y0) / Math.max(1, Math.min(W, H));
    const fade = clamp((GATE_LEAD - za.nextIn) / 0.5, 0, 1) * (1 - clamp((extent - 0.6) / 0.5, 0, 1));
    if (!(fade > 0.01)) return;
    const gas = densityText(next.n);
    out.push({ id: null, kind: 'gate', letter: null, poly, alpha: fade, progress: 1, x: NaN, y: NaN, r: 0,
      label: { text: gas ? `${next.label} · ${gas}` : next.label, colour: LABEL_COLOUR, priority: 75 } });
  }

  // Share of the leg's screen time flown so far (passing rings are timed by it).
  function screenShare(state) {
    const f = state.flight, zones = legOf(state).zones;
    let done = 0, total = 0;
    zones.forEach((z, i) => {
      total += z.screen;
      if (i < f.zone) done += z.screen;
      else if (i === f.zone) done += clamp(f.p, 0, 1) * z.screen;
    });
    return total > 0 ? done / total : 0;
  }

  function passes(stop, share, cam, out, minP = 0) {
    for (const ps of stop.passes || []) {
      if (ps.p < minP || share < ps.p - PASS_BEFORE || share > ps.p + PASS_AFTER) continue;
      const ring = objRing(ps.id, cam, 'pass');
      if (!ring || !ring.p.visible) continue;
      const w = cam.layerWeights && OBJECTS[ps.id] ? cam.layerWeights[OBJECTS[ps.id].layer] : 1;
      ring.alpha = clamp((finite(w) ? w : 1) * 2, 0, 1)
        * clamp((share - (ps.p - PASS_BEFORE)) / 0.08, 0, 1) * clamp((ps.p + PASS_AFTER - share) / 0.05, 0, 1);
      ring.label = { text: nameOf(ps.id), colour: LABEL_COLOUR, priority: 50 };
      out.push(ring);
    }
  }

  // Leg 6 passes under the spiral arms: a ring on each arm above the path, with its height.
  function arms(state, cam, out) {
    const leg = legOf(state), key = `${leg.stop}:${leg.branch}`;
    if (!armCache.has(key)) armCache.set(key, armsPassed(leg.points));
    const frac = state.flight.ly / leg.lengthLy;
    for (const a of armCache.get(key)) {
      if (frac < a.at - 0.25 || frac > a.at + 0.03 || a.at >= 0.999) continue;
      const pos = [a.pos[0], a.pos[1], a.pos[2] + a.armAboveLy];
      const p = project(pos, cam, undefined, { radiusLy: ARM_RING_LY });
      if (!p.visible) continue;
      const h = Math.abs(a.armAboveLy);
      const where = a.armAboveLy > 0 ? 'above' : 'below';
      const text = h < 400 ? a.name : `${a.name} · ${groupDigits(Math.round(h))} ly ${where}`;
      out.push({ id: null, kind: 'arm', letter: null, x: p.x, y: p.y, r: p.r, p, alpha: 0.8, progress: 1,
        label: { text, colour: LABEL_COLOUR, priority: 45 } });
    }
  }

  // Everything to draw for a state: rings (with labels) and chevrons.
  function collect(state, cam, reduced) {
    const out = [], chevrons = [];
    const ph = state.phase, stop = STOPS[state.stop];
    const say = state.say && state.say.current;
    if (ph === 'title' || ph === 'chapter') return { out, chevrons };
    if (ph === 'keyart') {
      for (const id of ['earth', 'moon']) {
        const ring = objRing(id, cam, 'landmark');
        if (ring) { ring.label = { text: nameOf(id), colour: LABEL_COLOUR, priority: 80 }; out.push(ring); }
      }
      return { out, chevrons };
    }
    // Laniakea: drawn on with the intro's ring line, and kept through the first scan
    if (say && say.ring === 'laniakea' && lanSince === null) lanSince = state.t;
    const firstScan = state.stop === 0 && state.mode === 'stop' && (ph === 'clue' || ph === 'scan');
    if ((ph === 'intro' && lanSince !== null) || firstScan) {
      const ring = objRing('laniakea', cam, 'laniakea');
      ring.progress = lanSince === null || reduced ? 1 : ease((state.t - lanSince) / 0.8);
      ring.alpha = reduced && lanSince !== null ? ease((state.t - lanSince) / 0.4) : 1;
      ring.label = { text: nameOf('laniakea'), colour: LABEL_COLOUR, priority: 40 };
      out.push(ring);
    }
    if (ph === 'clue' || ph === 'scan' || ph === 'fork') {
      candidates(state, cam, out, chevrons, reduced);
      if (ph === 'fork') {
        const v = objRing('local-void', cam, 'void');
        if (v && v.p.visible) {
          v.alpha = 0.7;
          v.label = { text: nameOf('local-void'), colour: LABEL_COLOUR, priority: 60 };
          out.push(v);
        }
      }
    } else if (ph === 'flight' && state.flight) {
      const sc = scanOf(state), za = zoneAt(state);
      const target = sc && sc.entry.target.id;
      if (target) {
        const ring = objRing(target, cam, 'target', { letter: null });
        if (ring) {
          ring.alpha = 0.7 * (za && za.dropout ? 1 - clamp(state.flight.p, 0, 1) : 1);
          const dist = distanceText(distanceLy(cam.ship || cam.pos, target));
          const text = sc.target ? `${sc.target} · ${dist}` : dist;
          ring.label = { text, colour: LABEL_COLOUR, priority: 60, fallback: sc.target || null };
          out.push(ring);
        }
      }
      gate(state, cam, out);
      passes(stop, screenShare(state), cam, out);
      if (stop.overlay === 'arms') arms(state, cam, out);
    } else if (ph === 'reveal') {
      const sc = scanOf(state);
      const id = sc && sc.entry.target.id;
      const ring = id && objRing(id, cam, 'landmark');
      if (ring) {
        const t = state.phaseT;
        ring.progress = reduced ? 1 : ease(t / RING_DRAW);
        ring.alpha = reduced ? ease(t / 0.4) : 1;
        ring.label = { text: nameOf(id), colour: LABEL_COLOUR, priority: 80,
          lead: reduced ? 1 : clamp((t - RING_DRAW * 0.75) / 0.3, 0, 1),
          write: reduced ? 1 : clamp((t - RING_DRAW * 0.75 - 0.25) / 0.5, 0, 1) };
        out.push(ring);
      }
      if (state.mode === 'stop') passes(stop, 1, cam, out, 0.9);
    } else if (ph === 'ending' && state.ending) {
      ending(state, cam, out, reduced);
    }
    return { out, chevrons };
  }

  // The ending: Earth and the Moon on the approach; then Earth is "Home" in orange; then one address ring at a time.
  function ending(state, cam, out, reduced) {
    const beat = state.ending.beat, say = state.say && state.say.current;
    const home = (alpha = 1) => {
      const ring = objRing('earth', cam, 'home');
      ring.alpha = alpha;
      ring.label = { text: 'Home', colour: HOME_COLOUR, priority: 95 };
      out.push(ring);
    };
    if (beat === 0) {
      for (const id of ['earth', 'moon']) {
        const ring = objRing(id, cam, id === 'earth' ? 'landmark' : 'pass');
        if (!ring || (id === 'moon' && !ring.p.visible)) continue;
        ring.label = { text: nameOf(id), colour: LABEL_COLOUR, priority: id === 'earth' ? 85 : 60 };
        out.push(ring);
      }
    } else if (beat === 3) {
      // the ring follows the caption, as the camera does (geo.endingPose): "Not the centre of anything." stays on
      // Laniakea, "Home." rings Earth, and with no caption the stills go by every 2.5 s
      const ring0 = say ? say.ring : undefined;
      const id = ADDRESS.has(ring0) ? ring0 : ring0 === 'home' ? 'home' : say ? 'laniakea'
        : ADDRESS_ORDER[clamp(Math.floor(state.ending.t / 2.5), 0, ADDRESS_ORDER.length - 1)];
      if (id === 'home') { home(); return; }
      const ring = objRing(id, cam, 'address');
      ring.progress = reduced || !(say && say.ring) ? 1 : ease(state.say.t / RING_DRAW);
      ring.label = { text: nameOf(id), colour: LABEL_COLOUR, priority: 85 };
      out.push(ring);
    } else {
      home(reduced || beat !== 1 ? 1 : ease(state.ending.t / 0.5));
    }
  }

  // ---------- drawing ----------

  function strokeRing(ring, now, reduced) {
    const a = ring.alpha * (ring.grey ? 0.55 : ring.strong ? 1 : RING_ALPHA);
    if (!(a > 0.003)) return;
    ctx.strokeStyle = ring.grey ? GREY_COLOUR : '#ffffff';
    ctx.globalAlpha = a;
    ctx.lineWidth = ring.strong || (ring.pulse && reduced) ? 1.5 : 1;
    if (ring.poly) strokePoly(ring.poly, ring.progress);
    else {
      // a full ring from 0 to 2π: Chrome draws nothing for a sweep of 2π that starts elsewhere (rounding)
      const k = clamp(ring.progress, 0, 1), a0 = -Math.PI / 4;
      ctx.beginPath();
      if (k >= 0.999) ctx.arc(ring.x, ring.y, ring.r, 0, 2 * Math.PI);
      else if (k > 0) ctx.arc(ring.x, ring.y, ring.r, a0, a0 + 2 * Math.PI * k);
      ctx.stroke();
    }
    if (ring.pulse) {
      if (reduced) {
        // a steady highlight instead of the pulse
        ctx.globalAlpha = 0.6 * ring.alpha;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r + 5, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        const u = ((now / PULSE_S) % 1 + 1) % 1;
        ctx.globalAlpha = 0.85 * (1 - u) * ring.alpha;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r + 3 + 14 * ease(u), 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  }

  function strokePoly(pts, progress = 1) {
    const n = Math.round((pts.length - 1) * clamp(progress, 0, 1));
    if (n < 1) return;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= n && i < pts.length; i++) {
      const q = pts[i];
      if (!q.ok || Math.abs(q.x) > 1e5 || Math.abs(q.y) > 1e5) { pen = false; continue; }
      if (pen) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
      pen = true;
    }
    ctx.stroke();
  }

  // Where an ellipse's label may hang from: its points furthest up-right, up-left, up, down-right, down-left, down,
  // right and left that are on screen, in that order (the label sits on the point with no radius).
  function polyAnchors(poly, area) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of poly) {
      if (!q.ok) continue;
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, out = [];
    for (const [dx, dy] of [[1, -1], [-1, -1], [0, -1], [1, 1], [-1, 1], [0, 1], [1, 0], [-1, 0]]) {
      let best = null, score = -Infinity;
      for (const q of poly) {
        if (!q.ok || q.x < area.x + 8 || q.x > area.x + area.w - 8 || q.y < area.y + 8
          || q.y > area.y + area.h - 8) continue;
        const v = dx * (q.x - cx) + dy * (q.y - cy);
        if (v > score) { score = v; best = q; }
      }
      if (best && !out.includes(best)) out.push(best);
    }
    return out;
  }

  // Is a point inside a closed outline of screen points (even-odd rule over the points in front)?
  function insideShape(pts, x, y) {
    let inside = false;
    const q = pts.filter((p) => p.ok);
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const a = q[i], b = q[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  // An ellipse's outline as small boxes, one per segment, so labels can keep off it.
  function outlineBoxes(poly) {
    const boxes = [];
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1], b = poly[i];
      if (!a.ok || !b.ok || !onCanvas(a.x, a.y, 0) && !onCanvas(b.x, b.y, 0)) continue;
      boxes.push({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(1, Math.abs(b.x - a.x)),
        h: Math.max(1, Math.abs(b.y - a.y)), a, b });
    }
    return boxes;
  }

  // Labels in order of priority, at most 6, each placed by core/labels.placeLabels against the HUD, the labels and
  // leaders already placed, the other rings and the ellipse outlines. A circle's label tries again over the outlines
  // when it finds no room; an ellipse's label tries each of its anchor points.
  function placeAll(rings, area, avoid, font, fontPx) {
    const opts = { width: W, height: H, box: area, fontPx, leader: 14, run: 10, gap: 4, max: 1 };
    const circles = [], polys = [];
    rings.forEach((r, i) => {
      if (!r.label || !(r.alpha > 0.05) || !(r.progress > 0.6)) return;
      const entry = { ring: r, key: `${r.kind}:${r.id || 'x'}:${i}`, width: measure(r.label.text, font) };
      if (r.poly) {
        entry.shape = r.poly;
        entry.outline = outlineBoxes(r.poly);
        polys.push(entry);
      } else if (r.p && r.p.visible) {
        if (r.r > BIG_RING) {
          // a big ring can hang its label from any side, as an ellipse does
          entry.shape = Array.from({ length: 65 }, (_, k) => ({ x: r.x + r.r * Math.cos(k * Math.PI / 32),
            y: r.y + r.r * Math.sin(k * Math.PI / 32), ok: true }));
          entry.outline = outlineBoxes(entry.shape);
        }
        circles.push(entry);
      }
    });
    const obstacles = circles.map((c) => ({ id: c.key, x: c.ring.x, y: c.ring.y, r: c.ring.r, text: 'x', priority: 0 }));
    const placed = [], taken = [];
    const all = [...circles, ...polys].sort((a, b) => b.ring.label.priority - a.ring.label.priority);
    const tryAt = (entry, item, extra) => {
      const others = obstacles.filter((o) => o.id !== entry.key);
      const res = placeLabels([{ ...item, id: entry.key, text: entry.ring.label.text, width: entry.width, priority: 1 },
        ...others], { ...opts, avoid: [...avoid, ...taken, ...extra] });
      return res.length && res[0].id === entry.key ? res[0] : null;
    };
    // hang the label from a point of the shape's outline: clear of every outline (its own less the two segments
    // that meet at the anchor) and outside the shape, then inside it, or over the outlines when loose
    const fromOutline = (entry, strict) => {
      const others = polys.filter((p) => p !== entry).flatMap((p) => p.outline);
      const anchors = polyAnchors(entry.shape, area);
      for (const outside of strict ? [true, false] : [false]) {
        for (const q of anchors) {
          const own = strict ? entry.outline.filter((b) => b.a !== q && b.b !== q) : [];
          const extra = strict ? [...others, ...own] : [];
          for (let tries = 0; tries < 4; tries++) {
            const pl = tryAt(entry, { x: q.x, y: q.y, r: 0 }, extra);
            if (!pl) break;
            if (!outside || !insideShape(entry.shape, pl.rect.x + pl.rect.w / 2, pl.rect.y + pl.rect.h / 2)) return pl;
            extra.push(pl.rect);   // that spot is inside the ring: rule it out and look again
          }
        }
      }
      return null;
    };
    for (const entry of all) {
      if (placed.length >= MAX_SHOWN) break;
      let pl = null;
      if (!entry.ring.poly) {
        const item = { x: entry.ring.x, y: entry.ring.y, r: entry.ring.r };
        const big = Boolean(entry.shape);
        pl = tryAt(entry, item, polys.flatMap((p) => p.outline)) || (big && fromOutline(entry, true))
          || tryAt(entry, item, []) || (big && fromOutline(entry, false)) || null;
      } else {
        pl = fromOutline(entry, true) || fromOutline(entry, false);
      }
      if (!pl) continue;
      placed.push({ pl, ring: entry.ring, key: entry.key });
      taken.push(pl.rect, {
        x: Math.min(pl.anchor[0], pl.end[0]), y: Math.min(pl.anchor[1], pl.end[1]),
        w: Math.max(1, Math.abs(pl.end[0] - pl.anchor[0])), h: Math.max(1, Math.abs(pl.end[1] - pl.anchor[1])),
      });
    }
    return { placed, circles };
  }

  function strokePath(points, progress) {
    // points: [[x, y], ...]; draws the first `progress` share of the polyline's length
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    let left = total * clamp(progress, 0, 1);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length && left > 0; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i];
      const d = Math.hypot(bx - ax, by - ay);
      const k = d > 0 ? Math.min(1, left / d) : 1;
      ctx.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k);
      left -= d;
    }
    ctx.stroke();
  }

  function drawText(text, x, y, align, colour, alpha, font) {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    // a soft dark edge (instead of shadowBlur) keeps a label readable over the bright band of the Milky Way
    ctx.globalAlpha = alpha * 0.45;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x + 0.75, y + 0.75);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
  }

  function drawChevron(ch, now, reduced) {
    const a = ch.alpha * (ch.pulse && !reduced ? 0.6 + 0.4 * Math.cos((2 * Math.PI * now) / PULSE_S) : 1);
    ctx.save();
    ctx.translate(ch.x, ch.y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = ch.pulse ? 1.5 : 1;
    ctx.globalAlpha = 0.45 * a;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 0.9 * a;
    ctx.rotate(ch.angle);
    ctx.beginPath();
    ctx.moveTo(15.5, -4.5);
    ctx.lineTo(20, 0);
    ctx.lineTo(15.5, 4.5);
    ctx.stroke();
    ctx.restore();
    drawText(ch.letter, ch.x, ch.y + 0.5, 'center', LABEL_COLOUR, 0.95 * a, `700 12px ${FONT}`);
  }

  // ---------- cracks ----------

  function trackCracks(state) {
    const ph = state.phase;
    if ((lastSeed !== null && state.seed !== lastSeed) || state.t < lastT - 1e-6 || ph === 'title') {
      cracks.clear();
      lanSince = null;
    }
    lastSeed = state.seed;
    lastT = state.t;
    const panes = finite(state.panes) ? state.panes : PANES;
    const missing = clamp(PANES - panes, 0, PANES);
    const fresh = state.flight && state.flight.lock > 0 && lastPanes !== null && panes < lastPanes;
    for (let k = 0; k < PANES; k++) {
      if (k >= missing) cracks.delete(k);
      else if (!cracks.has(k)) cracks.set(k, { t0: fresh && k >= PANES - lastPanes ? state.t : -Infinity });
    }
    lastPanes = panes;
  }

  function drawCracks(state, fade) {
    if (state.phase !== 'flight' && state.phase !== 'lost') return 0;
    const S = Math.min(W, H);
    let n = 0;
    for (const [k, c] of cracks) {
      const since = state.t - c.t0;
      const a = fade * (CRACK_TRACE + (1 - CRACK_TRACE) * (since >= 0 ? Math.exp(-since / CRACK_FLASH) : 0));
      if (!(a > 0.01)) continue;
      const key = `${state.seed}:${k}`;
      if (!patterns.has(key)) patterns.set(key, crackPattern(state.seed, k));
      const pat = patterns.get(key);
      const ox = pat.fx * W, oy = pat.fy * H;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      pat.lines.forEach((line, i) => {
        ctx.globalAlpha = a * (i < 9 ? 0.9 : 0.6);
        ctx.beginPath();
        ctx.moveTo(ox + line[0] * S, oy + line[1] * S);
        for (let j = 2; j < line.length; j += 2) ctx.lineTo(ox + line[j] * S, oy + line[j + 1] * S);
        ctx.stroke();
      });
      n++;
    }
    return n;
  }

  // ---------- the frame ----------

  // state: engine state (or { ...state, phase: 'keyart' }); cam: core/geo.cameraFor; view: unused here (the renderer
  // draws its own heat glow); layout: { mode, rects, box, reduced, safe } from main.js.
  function draw(state, cam, view, layout = {}) {
    if (!state || !cam) { if (!blank) clear(); blank = true; drawnRings = []; drawnLabels = []; return; }
    const w = finite(cam.width) && cam.width > 0 ? cam.width : W;
    const h = finite(cam.height) && cam.height > 0 ? cam.height : H;
    if (w !== W || h !== H || (autoRatio && deviceRatio() !== ratio)) resize(w, h);
    trackCracks(state);
    const reduced = Boolean(layout.reduced);
    const now = finite(state.t) ? state.t : 0;
    const { out, chevrons } = collect(state, cam, reduced);
    const fade = finite(cam.fade) ? clamp(cam.fade, 0, 1) : 1;
    const anyCrack = cracks.size > 0 && (state.phase === 'flight' || state.phase === 'lost');
    if (!out.length && !chevrons.length && !anyCrack) {
      if (!blank) clear();
      blank = true;
      drawnRings = [];
      drawnLabels = [];
      return;
    }
    blank = false;
    clear();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const phone = layout.mode ? layout.mode !== 'desktop' : W <= 760 || H <= 500;
    const fontPx = phone ? 12 : 11;
    const font = `400 ${fontPx}px ${FONT}`;
    const safe = layout.safe || {};
    const sl = finite(safe.left) ? safe.left : 0, sr = finite(safe.right) ? safe.right : 0;
    const st = finite(safe.top) ? safe.top : 0, sb = finite(safe.bottom) ? safe.bottom : 0;
    const area = { x: sl + 4, y: st + 4, w: Math.max(0, W - sl - sr - 8), h: Math.max(0, H - st - sb - 8) };
    const avoid = [];
    for (const r of Object.values(layout.rects || {})) {
      if (r && [r.x, r.y, r.w, r.h].every(finite) && r.w > 0 && r.h > 0) avoid.push(r);
    }
    // the band above the free box holds the top row, the clocks and the grey info box
    const box = layout.box || cam.box;
    if (box && finite(box.y) && box.y > 0 && state.phase !== 'keyart') avoid.push({ x: 0, y: 0, w: W, h: box.y });

    // rings
    const visible = out.filter((r) => (r.poly ? r.poly.some((q) => q.ok && onCanvas(q.x, q.y, 0))
      : r.p && r.p.front && onCanvas(r.x, r.y, r.r)));
    for (const r of visible) { r.alpha *= fade; strokeRing(r, now, reduced); }

    // labels
    const { placed, circles } = placeAll(visible, area, avoid, font, fontPx);
    const labelsOut = [];
    const placedRings = new Set();
    for (const { pl, ring: r } of placed) {
      placedRings.add(r);
      const lead = r.label.lead ?? 1, write = r.label.write ?? 1;
      // a label shows as its ring finishes drawing on
      const a = r.alpha * (r.label.colour === GREY_COLOUR ? 0.8 : 1) * clamp((r.progress - 0.6) / 0.4, 0, 1);
      ctx.strokeStyle = r.label.colour;
      ctx.globalAlpha = a * RING_ALPHA;
      ctx.lineWidth = 1;
      if (lead > 0) strokePath([pl.anchor, pl.elbow, pl.end], lead);
      if (write >= 1) drawText(r.label.text, pl.textX, pl.textY, pl.align, r.label.colour, a * TEXT_ALPHA, font);
      else if (write > 0) {
        // the label writes on from its left edge, in reading order
        const shown = r.label.text.slice(0, Math.floor(r.label.text.length * write));
        if (shown) drawText(shown, pl.rect.x, pl.textY, 'left', r.label.colour, a * TEXT_ALPHA, font);
      }
      labelsOut.push({ text: r.label.text, x: pl.textX, y: pl.textY, colour: r.label.colour, align: pl.align,
        kind: r.kind, id: r.id, rect: { ...pl.rect } });
    }
    // a lettered ring (a candidate, or the destination in flight) whose label found no room keeps its letter at the
    // ring, on the side away from the screen edge
    const bold = `700 ${fontPx}px ${FONT}`;
    for (const { ring: r } of circles) {
      const letter = r.label.fallback;
      if (placedRings.has(r) || !letter) continue;
      const lw = measure(letter, bold);
      const right = r.x + r.r * Math.SQRT1_2 + 3 + lw <= area.x + area.w;
      const x = right ? r.x + r.r * Math.SQRT1_2 + 3 : r.x - r.r * Math.SQRT1_2 - 3 - lw;
      const y = Math.max(area.y + fontPx, r.y - r.r * Math.SQRT1_2 - 5);
      const a = r.alpha * (r.label.colour === GREY_COLOUR ? 0.8 : 1) * clamp((r.progress - 0.6) / 0.4, 0, 1);
      drawText(letter, x, y, 'left', r.label.colour, a * TEXT_ALPHA, bold);
      labelsOut.push({ text: letter, x, y, colour: r.label.colour, align: 'left', kind: 'letter', id: r.id,
        rect: { x, y: y - fontPx * 0.65, w: lw, h: Math.ceil(fontPx * 1.3) } });
    }

    for (const ch of chevrons) drawChevron({ ...ch, alpha: ch.alpha * fade }, now, reduced);
    const crackCount = drawCracks(state, fade);
    ctx.globalAlpha = 1;

    // what was drawn, for picking and the QA hook: rings on catalogue objects (candidates carry their letter)
    drawnRings = out.filter((r) => r.id && r.p).map((r) => ({
      id: r.id, letter: r.letter, kind: r.kind, x: r.x, y: r.y, r: r.r, hitR: Math.max(r.r, HIT_MIN),
      expectX: r.p.x, expectY: r.p.y, onScreen: r.p.visible, grey: Boolean(r.grey),
    }));
    drawnLabels = labelsOut;
    drawnCracks = crackCount;
  }

  // Engine events: a crack flashes its lines at once (draw() also notices a pane going).
  function onEvent(ev, state) {
    if (!ev || ev.type !== 'crack' || !state) return;
    const k = PANES - (finite(ev.panes) ? ev.panes : PANES) - 1;
    if (k >= 0 && k < PANES) cracks.set(k, { t0: finite(state.t) ? state.t : 0 });
  }

  resize();
  return {
    canvas, draw, resize, onEvent,
    rings: () => drawnRings.map((r) => ({ ...r })),
    labels: () => drawnLabels.map((l) => ({ ...l, rect: { ...l.rect } })),
    cracks: () => drawnCracks,
  };
}
