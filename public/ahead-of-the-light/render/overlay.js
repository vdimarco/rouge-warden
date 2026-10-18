// Ahead of the Light: the 2D layer you play by (final.md 4.1, 5, 7.6, 8.1, 10.7, 18.6). Each frame it draws the ring
// (now), the hazards' outlines inside it and their ticks on it (orange when your line grazes, gold and thick when it
// hairlines, red when it would hit), your ship with its wings (hull left, fuel right) and shield bubble, the light's
// burst ring outside with its label, rivals ahead in the true projection, abreast on the ring and behind in the rear
// band, their marks and at most two labels, wakes, a well's reach arc, exit bands and red zone, the gate's THREAD
// and DOCK lines, the landing's door and home line, the landmarks' thin rings with leader lines and small labels (the
// video's look), ripples, streaks and the LIGHT SPEED rush. Captions are DOM text (ui/hud.js), not drawn here. The
// glare, flash and flood are CSS layers whose opacity alone changes (playtest A P2-10). No shadowBlur, no full-screen
// gradients. Ported from lab A's view.js overlay and lab B's rush.
import { TUNE } from '../core/tune.js';
import { DEG, wrap, depthPx, burstPx, rivalPx, wingsPx, placeLabels, lightLabelPx, ttcText } from '../core/ringmath.js';
import { resolve, psiAt, halfAt, railOn, wellCore } from '../core/course/kinds.js';
import { isDropped } from '../core/course/director.js';
import { windowOf, exitsOf, slamAim, gearOf } from '../core/handle.js';
import { CARD, cardFires } from '../core/cards.js';
import { blackbodyRGB, srgbEncode } from '../../light-years-home/core/physics.js';
import { inFog } from './hazards.js';

const ORANGE = '#f08a2c';
const RED = '#ff4d3d';
const EATEN_S = 0.9;              // s the light's burst over an eaten rival lasts
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const a3 = (v) => clamp(v, 0, 1).toFixed(3);
const isOut = (s) => s.caught || s.wrecked;
const SHAPES = { hound: 'hound', pike: 'pike', remora: 'remora', moth: 'moth', whale: 'whale', mako: 'mako',
  manta: 'manta' };

// A damped spring (lab A): the ring's cinch, the burst ring's push-back.
function spring(k = 380, c = 16) {
  return { x: 0, v: 0, step(dt, target = 0) { const a = -k * (this.x - target) - c * this.v; this.v += a * dt; this.x += this.v * dt; } };
}

// The light's colour (6.1): light from behind as you see it, 30,000 K × e^−(η − 1), cached by temperature.
const LIGHT_RGB = new Map();
function lightRgb(eta) {
  const T = Math.max(600, 30000 * Math.exp(-(eta - 1)));
  const key = Math.round(Math.log(T) * 24);
  let s = LIGHT_RGB.get(key);
  if (!s) {
    const c = blackbodyRGB(Math.exp(key / 24));
    s = c.map((v) => Math.round(255 * srgbEncode(v))).join(',');
    LIGHT_RGB.set(key, s);
  }
  return s;
}

export function createOverlay({ canvas, tune = TUNE, reduced = false, fx = {} } = {}) {
  const ctx = canvas.getContext('2d');
  const V = {
    w: 1, h: 1, dpr: 1, time: 0,
    ringK: spring(420, 15), burstK: spring(260, 14),
    shake: 0, sx: 0, sy: 0, flash: 0, flashK: 1, white: 0, flood: 0, rush: 0, glare: 0,
    fx: [], ripples: [], popups: [], sparks: [], frags: [], digits: [], trail: [], beams: [], bulges: [], words: [],
    arcs: [], chainPop: 0, lens: null, lsT: 9, hairs: 0, releases: 0, dry: 0, pops: 0,
    marks: {},                         // per rival: lean, hook, block, fin, flash, lane, changed
    fin: {},                           // MAKO's target: { [makoId]: { target, t } }
    lastGraze: null, intro: -1, legKey: null, landmarkOn: false, gateOn: false, cardShown: {}, cardSeen: 0,
    patchSeen: false, ops: 0, labelsDrawn: [], wingsDrawn: null,
    markWay: {},                       // per landmark id: the way its label went last frame (kept while it is clear)
  };
  const shown = {};
  const count = (type) => { shown[type] = (shown[type] || 0) + 1; };

  // ---------- CSS layers (opacity and scale only) ----------
  const fxLast = {};
  function setFx(name, opacity, scale = 1) {
    const el = fx[name];
    if (!el) return;
    const o = Math.round(clamp(opacity, 0, 1) * 100) / 100, s = Math.round(scale * 100) / 100;
    const key = `${o}|${s}`;
    if (fxLast[name] === key) return;
    fxLast[name] = key;
    el.style.opacity = String(o);
    el.style.transform = s === 1 ? '' : `scale(${s})`;
  }

  function resize(w, h, dpr = 1) {
    V.w = Math.max(1, w); V.h = Math.max(1, h); V.dpr = dpr || 1;
    canvas.width = Math.round(V.w * V.dpr);
    canvas.height = Math.round(V.h * V.dpr);
  }

  // A new leg (or the run's first): clear the effects; run: true also forgets the run's firsts.
  function reset({ run = false } = {}) {
    V.fx = []; V.ripples = []; V.popups = []; V.sparks = []; V.frags = []; V.digits = []; V.trail = []; V.beams = [];
    V.bulges = []; V.words = []; V.arcs = []; V.marks = {}; V.fin = {}; V.lens = null; V.flood = 0; V.white = 0;
    V.flash = 0; V.intro = -1; V.landmarkOn = false; V.gateOn = false; V.ringK.x = V.ringK.v = 0;
    V.burstK.x = V.burstK.v = 0; V.lastGraze = null; V.legKey = null; V.markWay = {};
    if (run) { V.hairs = 0; V.releases = 0; V.cardShown = {}; V.cardSeen = 0; V.patchSeen = false; }
  }

  const markOf = (id) => V.marks[id] || (V.marks[id] = { changed: -9 });

  // ---------- events: each starts its effect on the frame it arrives ----------
  function onEvents(events, race) {
    if (!events || !events.length) return;
    const you = race && race.ships[0];
    const youId = you ? you.id : 'you';
    const t = V.time;
    for (const e of events) {
      const mine = e.ship === youId;
      switch (e.type) {
        case 'graze': case 'hair': {
          if (!mine) { markOf(e.ship).changed = t; break; }
          const hair = e.type === 'hair';
          V.ringK.v -= hair ? 150 : 90;
          V.chainPop = 1;
          V.fx.push({ t0: t, dur: hair ? 0.14 : 0.09, psi: Number.isFinite(e.psi) ? e.psi : you.bearing, hair,
            side: e.side || 1 });
          V.lastGraze = { t, psi: Number.isFinite(e.psi) ? e.psi : you.bearing };
          if (hair) { V.ripples.push({ t0: t, kind: 'hair' }); V.hairs++; }
          count(e.type);
          break;
        }
        case 'rivalGraze':
          if (mine) { V.ringK.v -= 80; V.fx.push({ t0: t, dur: 0.1, psi: you.bearing, hair: false, side: 1, rival: true }); count(e.type); }
          break;
        case 'push':
          if (mine) { V.burstK.v += 140 + 300 * clamp(e.amount || 0.12, 0, 2); V.arcs.push({ t0: t, from: V.lastGraze }); count('push'); }
          break;
        case 'hit':
          if (mine) {
            V.ringK.v += 260; V.shake = reduced ? 0 : 1; V.burstK.v -= 220;
            if (you.chain > 1 || e.chain > 1) V.digits.push({ t0: t, text: String(e.chain || you.chain), red: true });
            count('hit');
          } else { markOf(e.ship).flash = t; markOf(e.ship).changed = t; }
          break;
        case 'bump':
          if (mine) { V.ringK.v += 120; V.shake = reduced ? 0 : 0.4; count('bump'); }
          break;
        case 'chainEnd':
          if (mine && e.chain > 1) { V.digits.push({ t0: t, text: String(e.chain), red: e.why === 'hit' }); count('chainEnd'); }
          break;
        case 'thread':
          if (mine) {
            V.ringK.v -= 160; V.burstK.v += 400;
            if (!e.pair && !e.miss) {
              V.lens = { t0: t, psi: gatePsi(race, e.gate) };
              V.ripples.push({ t0: t, kind: 'gear' });
            }
            if (e.pair) V.words.push({ t0: t, text: 'THREAD', orange: true });
            count('thread');
          }
          break;
        case 'dock': case 'past':
          if (mine) { V.ripples.push({ t0: t, kind: 'hair' }); count(e.type); }
          break;
        case 'headlight':
          if (mine) {
            V.flash = reduced ? 0.35 : e.full ? 1 : 0.55; V.flashK = e.full ? 1 : 0.6;
            V.ringK.v -= 120; V.ripples.push({ t0: t, kind: 'gear' });
            count('headlight');
          }
          break;
        case 'lightspeed':
          if (mine) { V.white = reduced ? 0.4 : 0.9; V.lsT = 0; V.ripples.push({ t0: t, kind: 'gear' }); count('lightspeed'); }
          break;
        case 'dropout':
          if (mine) { V.ripples.push({ t0: t, kind: 'out' }); count('dropout'); }
          break;
        case 'gearUp':
          if (mine) { V.ripples.push({ t0: t, kind: e.best ? 'gear' : 'tick' }); count('gearUp'); }
          break;
        case 'gearDown':
          if (mine) { V.ripples.push({ t0: t, kind: 'out' }); count('gearDown'); }
          break;
        case 'burn': case 'oberth':
          if (mine) {
            V.ringK.v -= e.type === 'oberth' ? 200 : 120;
            V.ripples.push({ t0: t, kind: 'burn' });
            for (let i = 0; i < 10; i++) V.sparks.push({ t0: t, ang: you.bearing, dr: 6 + 26 * hash01(t * 91 + i),
              da: (hash01(t * 37 + i) - 0.5) * 30, orange: true, life: 0.45 });
            count(e.type);
          }
          break;
        case 'dry':
          if (mine) { V.dry = t; count('dry'); }
          break;
        case 'pickFuel':
          if (mine) { V.popups.push({ t0: t, text: '+1 ◆', orange: true }); count('pickFuel'); }
          break;
        case 'pickPatch':
          if (mine) { V.popups.push({ t0: t, text: '+1 HULL', orange: false }); V.patchSeen = true; count('pickPatch'); }
          break;
        case 'spill':
          // a spilled cell flies from the victim to the rammer
          V.beams.push({ t0: t, kind: 'cell', from: e.ship, to: e.taken ? e.to : null });
          if (mine || e.to === youId) count('spill');
          break;
        case 'contact':
          if (e.victim === youId || e.by === youId) {
            V.shake = reduced ? 0 : Math.max(V.shake, e.kind === 'slam' ? 0.6 : 0.25);
            V.ringK.v += e.kind === 'slam' ? 140 : 60;
            count('contact');
          }
          markOf(e.by).changed = t; markOf(e.victim).changed = t;
          break;
        case 'takedown':
          markOf(e.victim).flash = t; markOf(e.victim).changed = t;
          if (e.by === youId) { V.words.push({ t0: t, text: e.trapped ? 'TRAPPED' : 'TAKEDOWN', orange: true }); count('takedown'); }
          break;
        case 'shieldPop':
          if (mine) { V.pops = t; for (let i = 0; i < 6; i++) V.frags.push({ t0: t, a: i * 60 + 30 * hash01(t + i) }); count('shieldPop'); }
          break;
        case 'shieldBack':
          if (mine) { V.ripples.push({ t0: t, kind: 'shield' }); count('shieldBack'); }
          break;
        case 'grab':
          if (mine) { V.ringK.v -= 60; count('grab'); }
          else markOf(e.ship).changed = t;
          break;
        case 'release':
          if (mine) {
            V.releases++;
            if (V.releases > 2) V.words.push({ t0: t, text: e.grade, orange: e.grade === 'PERFECT' });
            V.ringK.v -= e.grade === 'PERFECT' ? 200 : 110;
            V.burstK.v += 200;
            count('release');
          }
          break;
        case 'redIn':
          if (mine) { V.ripples.push({ t0: t, kind: 'red' }); V.shake = reduced ? 0 : 0.3; count('redIn'); }
          break;
        case 'scorch':
          if (mine) { V.ripples.push({ t0: t, kind: 'red' }); V.shake = reduced ? 0 : 0.8; count('scorch'); }
          break;
        case 'slingshot':
          if (mine) {
            for (let i = 0; i < 6; i++) V.fx.push({ t0: t + i * 0.02, dur: 0.18, psi: you.bearing, hair: true, side: 1, sling: true });
            count('slingshot');
          }
          break;
        case 'eaten': {
          const id = e.id || e.ship;
          markOf(id).flash = t; markOf(id).eaten = t; markOf(id).changed = t;
          const r = race && race.ships.find((s) => s.id === id);
          if (r) {
            V.bulges.push({ t0: t, psi: r.bearing });
            if (you && r.dist > you.dist) V.beams.push({ t0: t, kind: 'light', to: id });
          }
          count('eaten');
          break;
        }
        case 'caught': case 'wreck':
          if (mine) { if (!(V.flood > 0)) V.flood = 0.0001; count(e.type); }
          else markOf(e.ship).flash = t;
          break;
        case 'lean':
          markOf(e.ship).lean = { t0: t, target: e.target, side: e.side || 1 };
          count('lean');
          break;
        case 'hook':
          markOf(e.ship).hook = { t0: t, well: e.well, psi: e.psi };
          count('hook');
          break;
        case 'block':
          markOf(e.ship).block = { t0: t, side: e.side || 1 };
          count('block');
          break;
        case 'fin':
          V.fin[e.ship] = { target: e.target, t0: t };
          count('fin');
          break;
        case 'lane':
          markOf(e.ship).lane = { t0: t, psi: e.psi, side: e.side || 1 };
          count('lane');
          break;
        case 'nemesis': case 'settled': case 'shadow': case 'sailTorn': case 'breach': case 'bowWave': case 'roll':
        case 'backOff': case 'dirtyAir':
          markOf(e.ship).changed = t;
          break;
        case 'drafted':
          if (mine) count('drafted');
          break;
        default:
      }
    }
  }

  function gatePsi(race, id) {
    if (!race) return 0;
    const g = race.leg.gate;
    if (g && (g.id === id || g.item === id)) return g.psi;
    const it = race.leg.items.find((x) => x.id === id);
    return it ? it.psi : 0;
  }

  // ---------- drawing helpers ----------
  let cx = 0, cy = 0;
  const P = (ang, rad) => [cx + Math.sin(ang * DEG) * rad, cy + Math.cos(ang * DEG) * rad];
  // canvas arcs run clockwise from +x; a screen angle a (from 6 o'clock, + to the right) is canvas angle 90° − a
  const arc = (ang, half, rad) => {
    ctx.beginPath(); V.ops++;
    ctx.arc(cx, cy, Math.max(0.5, rad), (90 - ang - half) * DEG, (90 - ang + half) * DEG);
  };
  const arcTo = (ang, half, rad) => ctx.arc(cx, cy, Math.max(0.5, rad), (90 - ang - half) * DEG, (90 - ang + half) * DEG);
  const circle = (x, y, rad) => { ctx.beginPath(); V.ops++; ctx.arc(x, y, Math.max(0.5, rad), 0, Math.PI * 2); };
  const line = (x0, y0, x1, y1) => { ctx.beginPath(); V.ops++; ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); };
  const stroke = (style, width) => { ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke(); };
  // Boxes the caption line must keep clear of (22.1): an arc of the ring from rIn to rOut, cut into 15° pieces, each
  // piece's bounding box; and a text's box. main.js moves the caption off them.
  function keepArc(list, ang, half, rIn, rOut) {
    const n = Math.max(1, Math.ceil((2 * half) / 15));
    for (let i = 0; i < n; i++) {
      const a0 = ang - half + (2 * half * i) / n, a1 = ang - half + (2 * half * (i + 1)) / n;
      const pts = [P(a0, rIn), P(a0, rOut), P(a1, rIn), P(a1, rOut), P((a0 + a1) / 2, rOut)];
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      list.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    }
  }
  function textBox(str, x, y, px, weight = 800, align = 'center') {
    ctx.font = `${weight} ${px}px ${FONT}`;
    const tw = ctx.measureText(str).width;
    const x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    return { x0, y0: y - px * 0.6, x1: x0 + tw, y1: y + px * 0.6 };
  }
  // A small label's centre moved so its whole box stays on screen, 6 px from the edges.
  function onScreen(str, x, y, px, w, h) {
    ctx.font = `800 ${px}px ${FONT}`;
    const hw = ctx.measureText(str).width / 2 + 6;
    return [Math.max(hw, Math.min(w - hw, x)), Math.max(px, Math.min(h - px, y))];
  }
  function text(str, x, y, { px = 11, weight = 600, color = '#fff', align = 'left', base = 'middle', alpha = 1 } = {}) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = base;
    ctx.globalAlpha = alpha;
    // a dark edge so small text reads over a bright cluster (no shadowBlur)
    ctx.lineWidth = Math.max(2, px * 0.28); ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
    ctx.globalAlpha = 1;
    V.ops += 2;
  }

  // The video's mark: a thin ring round a thing, a leader line from its lower right going down and right, then flat,
  // and a small label. markLayout says where the leader and label go (dir ±1 picks the side, 0 is right unless the
  // screen's edge turns it; up leads upward); drawMark draws it and returns the label's box.
  function markLayout(x, y, r, label, { px = 11, dir = 0, up = false } = {}) {
    ctx.font = `600 ${px}px ${FONT}`;
    const tw = ctx.measureText(label).width;
    let sx = dir || 1;
    const run = 16 * (px / 11);
    if (!dir && x + r * 0.7071 + run + 14 + tw > V.w - 8) sx = -1;
    if (sx < 0 && x - r * 0.7071 - run - 14 - tw < 8) sx = 1;
    let sy = up ? -1 : 1;
    if (sy > 0 && y + r * 0.7071 + run + px > V.h - 8) sy = -1;
    let lx = x + sx * r * 0.7071, ly = y + sy * r * 0.7071;
    // a ring bigger than the screen: lead from where it crosses the screen's lower right instead
    lx = clamp(lx, 10, V.w - 10); ly = clamp(ly, 70, V.h - 30);
    let ex = lx + sx * run;
    const ey = ly + sy * run;
    if (sx > 0) ex = Math.min(ex, V.w - 8 - 14 - tw - 10); else ex = Math.max(ex, 8 + 14 + tw + 10);
    const bx = sx > 0 ? ex + sx * 14 : ex + sx * 14 - tw;
    return { x, y, r, label, px, sx, lx, ly, ex, ey, box: { x: bx, y: ey - px * 0.6, w: tw, h: px * 1.2 } };
  }
  function drawMark(L, { alpha = 1, color = 'rgba(255,255,255,0.85)' } = {}) {
    ctx.globalAlpha = alpha;
    circle(L.x, L.y, L.r); stroke(color, 1);
    ctx.beginPath(); V.ops++;
    ctx.moveTo(L.lx, L.ly); ctx.lineTo(L.ex, L.ey); ctx.lineTo(L.ex + L.sx * 10, L.ey);
    stroke(color, 1);
    ctx.globalAlpha = 1;
    const tc = color.startsWith('rgba(255,255,255') ? '#fff' : color;
    text(L.label, L.ex + L.sx * 14, L.ey, { px: L.px, align: L.sx > 0 ? 'left' : 'right', alpha, color: tc });
    return L.box;
  }
  // A mark's label clear (4 px) of the labels already placed: the way it went last frame while that stays clear, else
  // its own side and down, the other side, its side and up, the other side and up. → the layout, or null.
  const boxTouch = (a, b, m) => a.x - m < b.x + b.w && b.x - m < a.x + a.w && a.y - m < b.y + b.h && b.y - m < a.y + a.h;
  function placeMark(id, x, y, r, label, px, placed) {
    const L0 = markLayout(x, y, r, label, { px });
    const ways = [L0, markLayout(x, y, r, label, { px, dir: -L0.sx }),
      markLayout(x, y, r, label, { px, dir: L0.sx, up: true }), markLayout(x, y, r, label, { px, dir: -L0.sx, up: true })];
    const last = V.markWay[id];
    for (const k of last ? [last, 0, 1, 2, 3] : [0, 1, 2, 3]) {
      if (placed.some((b) => boxTouch(ways[k].box, b, 4))) continue;
      V.markWay[id] = k;
      return ways[k];
    }
    return null;
  }

  // A rival's ship in its silhouette (10.2, 10.3): nose toward the centre. half: px half-width.
  function shipShape(kind, x, y, ang, half, { fill = '#fff', hollow = false, tilt = 0, alpha = 1, t = 0 } = {}) {
    const dirA = Math.atan2(cy - y, cx - x) + tilt * DEG;
    const sc = half / 7;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dirA);
    ctx.globalAlpha = alpha;
    ctx.beginPath(); V.ops++;
    switch (kind) {
      case 'hound':
        ctx.moveTo(8 * sc, 0); ctx.lineTo(-5 * sc, -half * 1.2); ctx.lineTo(-2.5 * sc, -half * 0.35);
        ctx.lineTo(-5 * sc, 0); ctx.lineTo(-2.5 * sc, half * 0.35); ctx.lineTo(-5 * sc, half * 1.2); break;
      case 'pike':
        ctx.moveTo(13 * sc, 0); ctx.lineTo(-8 * sc, -half * 0.45); ctx.lineTo(-6 * sc, 0); ctx.lineTo(-8 * sc, half * 0.45); break;
      case 'whale':
        ctx.moveTo(8 * sc, 0); ctx.quadraticCurveTo(2 * sc, -half, -7 * sc, -half);
        ctx.lineTo(-4 * sc, 0); ctx.lineTo(-7 * sc, half); ctx.quadraticCurveTo(2 * sc, half, 8 * sc, 0); break;
      case 'mako':
        ctx.moveTo(10 * sc, 0); ctx.lineTo(-5 * sc, -half); ctx.lineTo(-2 * sc, 0); ctx.lineTo(-5 * sc, half); break;
      case 'manta':
        ctx.moveTo(5 * sc, 0); ctx.lineTo(-3 * sc, -half * 0.35); ctx.lineTo(-1 * sc, 0); ctx.lineTo(-3 * sc, half * 0.35); break;
      default:
        ctx.moveTo(9 * sc, 0); ctx.lineTo(-4 * sc, -half); ctx.lineTo(-1 * sc, 0); ctx.lineTo(-4 * sc, half);
    }
    ctx.closePath();
    if (hollow) { ctx.lineWidth = 1.25; ctx.strokeStyle = fill; ctx.stroke(); }
    else if (kind === 'whale') {
      ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = fill; ctx.fill();
      ctx.globalAlpha = alpha; ctx.lineWidth = 1.5; ctx.strokeStyle = fill; ctx.stroke();
    } else { ctx.fillStyle = fill; ctx.fill(); }
    // the marks of each silhouette
    if (kind === 'remora') {
      ctx.beginPath(); V.ops++; ctx.arc(10 * sc, 0, 2.2 * sc, 0, Math.PI * 2);
      ctx.lineWidth = 1.2; ctx.strokeStyle = fill; ctx.stroke();
    }
    if (kind === 'moth') {
      const f = Math.sin(t * 40) * 4 * DEG;
      ctx.fillStyle = fill;
      for (const sg of [-1, 1]) {
        ctx.beginPath(); V.ops++;
        ctx.arc(-1 * sc + Math.sin(f) * 3, sg * (half * 1.25 + Math.sin(f * sg) * 3), 1.6 * sc, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (kind === 'mako') {
      ctx.beginPath(); V.ops++; ctx.moveTo(-2 * sc, 0); ctx.lineTo(-10 * sc, 0);
      ctx.lineWidth = 1.5 * sc; ctx.strokeStyle = fill; ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- one frame ----------
  // race: the race (null on the title); view: from scene.render; opts: title, marks (backdrop.marks), runT (seconds
  // into the run, for the far label), first (a player's first runs: more help), build (run.build, for card tells),
  // fixed. Returns what it drew, for the layout checks.
  function render(race, view, dt, opts = {}) {
    V.time += dt;
    V.ops = 0;
    const { w, h } = V;
    cx = view.cx; cy = view.cy;
    const T = (race && race.tune) || tune;
    const title = Boolean(opts.title) || !race;
    const s = view.scale || 1, kz = view.desk ? 1.6 : 1;
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // springs and shake
    V.ringK.step(Math.min(dt, 0.05));
    V.burstK.step(Math.min(dt, 0.05));
    V.shake = Math.max(0, V.shake - dt * 4);
    const amp = 6 * V.shake * V.shake;
    V.sx = amp ? (hash01(V.time * 61.7) * 2 - 1) * amp : 0;
    V.sy = amp ? (hash01(V.time * 47.3) * 2 - 1) * amp : 0;
    ctx.save();
    ctx.translate(V.sx, V.sy);
    const out = { ring: view.R, burstR: 0, labels: [], wings: null, rivals: [], marks: [], lightLabel: null, ops: 0,
      bands: [], gateLines: [], landmarkBox: null, keep: [] };

    if (title) {
      // the title: a faint ring only (kept clear of the name by the page)
      const R = opts.titleR ?? view.R;
      ctx.globalAlpha = 0.45; circle(cx, cy, R); stroke('#fff', 1); ctx.globalAlpha = 1;
      ctx.restore();
      fxLayers(null, dt, T);
      out.ops = V.ops;
      return out;
    }

    const you = race.ships[0];
    const cam = view.cam;
    const R = Math.max(20, view.R + V.ringK.x);
    const shipA = wrap(you.bearing - cam);
    const bps = Math.max(1e-6, view.bps);
    const items = race.leg.items;
    const legKey = `${race.leg.hash}|${race.legNo}`;
    if (V.legKey !== legKey) {
      // cue moments read from the course once a leg (cues are items, not events)
      V.legKey = legKey;
      const cueAt = (name) => { const c = items.find((it) => it.kind === 'cue' && it.name === name); return c ? c.beat : Infinity; };
      V.landmarkAt = cueAt('landmark');
      V.gateAt = Math.min(cueAt('gateCall'), race.leg.beats - T.GATE_CALL);
    }
    V.landmarkOn = you.dist >= V.landmarkAt;
    V.gateOn = (you.dist >= V.gateAt || race.phase === 'gate') && race.phase !== 'runout' && race.phase !== 'done';

    // ---- the landmarks: thin rings, leader lines and labels (the video's look) ----
    let landmarkBox = null;
    const marks = opts.marks || (opts.backdrop ? opts.backdrop.marks(view, view.progress ?? 0, view.phiL ?? view.phi) : null);
    // the labels of the marks drawn so far: no two landmark labels sit on each other
    const markBoxes = [];
    if (marks && marks.length) {
      let drawn = 0;
      // the leg's goal first (it always draws, and the others keep clear of it), then the nearest others
      for (const m of [...marks.filter((q) => q.ahead), ...marks.filter((q) => !q.ahead)]) {
        if (drawn >= 2) break;
        if (m.ahead && !V.landmarkOn) continue;
        if (!m.ahead && m.r < 6) continue;
        if (Math.hypot(m.x - cx, m.y - cy) < R * 0.98 && m.r > R * 0.9) continue;
        const hot = m.ahead && V.lens && V.time - V.lens.t0 < 1.5;
        const appear = m.ahead ? smooth(0, 0.6, V.time - (V.landmarkT ?? (V.landmarkT = V.time))) : 1;
        const px = view.desk ? 13 : 11;
        const L = placeMark(m.id, m.x, m.y, m.r + 4, m.text, px, markBoxes);
        if (!L) continue;
        const box = drawMark(L, { alpha: 0.9 * appear, color: hot ? ORANGE : 'rgba(255,255,255,0.85)' });
        markBoxes.push(box);
        out.marks.push({ id: m.id, x: m.x, y: m.y, r: m.r, box });
        if (!landmarkBox || m.ahead) landmarkBox = box;
        drawn++;
      }
    }
    if (!V.landmarkOn) V.landmarkT = undefined;
    out.landmarkBox = landmarkBox;

    // ---- the burst ring: the light behind you (4.1, 7.5, 7.6) ----
    const ttc = Number.isFinite(you.ttc) ? you.ttc : 999;
    const light = you.light || (ttc < T.GLARE_IN ? 'glare' : ttc < T.TTC_WARN ? 'warned' : ttc < T.TTC_LABEL ? 'pressed'
      : 'far');
    // at a run's launch the burst ring rises in from the screen's edge (25: about 2.5 s in on a first run)
    const t0 = opts.lightAt ?? (race.legNo === 0 && opts.first ? 0.5 : -10);
    const introK = smooth(t0, t0 + 1.2, race.real);
    const lightOn = race.real >= t0;
    let Rb = burstPx(view, ttc, T) + V.burstK.x;
    Rb += (1 - introK) * (Math.hypot(w, h) - Rb);
    if (you.caught) Rb = Math.min(Rb, R + 1);
    Rb = Math.max(R + 1, Rb);
    out.burstR = Rb;
    if (lightOn) {
      const glare = light === 'glare';
      const warned = light === 'warned' || glare;
      const col = glare ? '255,255,255' : lightRgb(you.eta);
      const beat = warned ? 0.5 + 0.5 * Math.cos(V.time * Math.PI * 2 * (1 + 1.3 * clamp(1 - ttc / T.TTC_WARN, 0, 1))) : 0;
      const intro = smooth(t0, t0 + 0.5, race.real);
      const base = (glare ? 1 : 0.7) * intro;
      const lw = (warned ? 2.5 + 1.2 * beat : 1.5) * kz;
      const ring = (rad) => {
        // a lensing bend at the landmark's bearing, an eaten rival's bulge
        const bends = [];
        if (V.lens && V.time - V.lens.t0 < 0.8) bends.push({ psi: V.lens.psi, a: 26 * (1 - smooth(0, 0.8, V.time - V.lens.t0)) });
        for (const b of V.bulges) if (V.time - b.t0 < 0.7) bends.push({ psi: b.psi, a: 18 * (1 - (V.time - b.t0) / 0.7) });
        ctx.beginPath(); V.ops++;
        if (!bends.length) { ctx.arc(cx, cy, rad, 0, Math.PI * 2); return; }
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * 360 - 180;
          let r2 = rad;
          for (const b of bends) { const d = wrap(a - wrap(b.psi - cam)); r2 += b.a * s * Math.exp(-(d * d) / (2 * 14 * 14)); }
          const [x, y] = P(a, r2);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
      };
      // the soft glow outside the line (8 px), then the line
      for (const [dr, wdt, k] of [[3 * kz, 8 * kz, 0.07], [1 * kz, 3.5 * kz, 0.16]]) {
        ring(Rb + dr); stroke(`rgba(${col},${a3(base * k * (1 + beat))})`, wdt);
      }
      ring(Rb); stroke(`rgba(${col},${a3(base + 0.25 * beat)})`, lw);
      // the push-back arcs: a faint line from the grazed galaxy out toward the ring
      V.arcs = V.arcs.filter((q) => V.time - q.t0 < 0.25);
      for (const q of V.arcs) {
        if (!q.from) continue;
        const k = (V.time - q.t0) / 0.25, a = wrap(q.from.psi - cam);
        const [x0, y0] = P(a, R + 6), [x1, y1] = P(a, R + 6 + (Rb - R - 6) * k);
        line(x0, y0, x1, y1); stroke(`rgba(${col},${a3(0.5 * (1 - k))})`, 1.25 * kz);
      }
      // its label: whole seconds when pressed, tenths in the glare, and when far only the run's first 20 s and each
      // leg's launch (playtest P1-4: the launch's quiet seconds show what the gate left you)
      const runT = opts.runT ?? (race.legNo === 0 ? race.t : 99);
      let label = null;
      if (glare) label = `LIGHT · ${Math.max(0, ttc).toFixed(1)} S`;
      else if (ttc < T.TTC_LABEL) label = `LIGHT · ${Math.max(0, Math.ceil(ttc))} S`;
      else if (runT < 20 || race.phase === 'launch') label = `LIGHT · ${ttcText(ttc)}`;
      if (label && !you.caught) {
        const L = lightLabelPx(view, Rb, label, T);
        if (L) {
          ctx.globalAlpha = intro;
          ctx.beginPath(); V.ops++;
          ctx.moveTo(L.anchor.x, L.anchor.y); ctx.lineTo(L.elbow.x, L.elbow.y); ctx.lineTo(L.end.x, L.end.y);
          stroke(`rgba(${col},0.85)`, 1);
          ctx.globalAlpha = 1;
          text(label, L.x, L.y, { px: L.px, weight: glare ? 800 : 700, align: L.align, alpha: intro,
            color: glare ? '#fff' : warned && beat > 0.5 ? ORANGE : '#fff' });
          out.lightLabel = L.box;
        }
      }
      // the landing's home line (8.2): the burst ring must stay outside it
      if (race.leg.type === 'earth' && opts.homeLine !== false) {
        const need = T.LAND_S + T.LAND_PER_NINE * gearOf(you.eta, T);
        const rH = burstPx(view, need / Math.max(1e-6, 1 - Math.tanh(you.eta)), T);
        ctx.setLineDash([5 * kz, 5 * kz]);
        ctx.beginPath(); V.ops++; ctx.arc(cx, cy, rH, 0, Math.PI * 2); stroke('rgba(255,255,255,0.55)', 1 * kz);
        ctx.setLineDash([]);
        let hx = null, hy = null;
        for (let a = 30; a <= 150 && hx === null; a += 5) {
          const [x, y] = P(-a, rH);
          if (x > 80 && x < w - 8 && y > 70 && y < h - 20) { hx = x; hy = y; }
        }
        if (hx !== null) text('HOME LINE', hx - 4, hy - 8, { px: view.desk ? 13 : 10, weight: 700, alpha: 0.8, align: 'right' });
      }
      // a rival the light takes ahead of you: a thin white beam from the burst ring to it
      V.beams = V.beams.filter((q) => V.time - q.t0 < 0.6);
    }

    // ---- rivals (drawn under the hazards' outlines, over the burst ring) ----
    const labelCands = [];
    const rivalsDrawn = [];
    const wingZone = { a0: 0, a1: 0 };
    {
      const hullN = you.hullMax || 0, fuelN = you.fuelCap || 0;
      wingZone.a0 = T.WING_FROM + T.WING_PITCH * Math.max(hullN, fuelN) + 4;
    }
    let draftingYou = false, finOnYou = false;
    for (let i = 1; i < race.ships.length; i++) {
      const r = race.ships[i];
      const mk = V.marks[r.id] || {};
      const gone = isOut(r);
      const eatenK = mk.eaten !== undefined && V.time - mk.eaten < EATEN_S ? (V.time - mk.eaten) / EATEN_S : -1;
      if (gone && !(mk.flash && V.time - mk.flash < 0.6) && eatenK < 0) continue;
      const pos = rivalPx(view, r, you, Rb, T);
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue;
      let x = pos.x, y = pos.y, rad = pos.r;
      // keep a rival off the wing arcs: beside or just behind you, it moves out past the wings
      const dAng = Math.abs(wrap(pos.ang - shipA));
      if (pos.place !== 'ahead' && dAng < wingZone.a0 && rad < R + (T.WING_OUT + 16) * s + 8) {
        rad = R + (T.WING_OUT + 24) * s;
        [x, y] = P(pos.ang, rad);
        // moved out past the wings, it still stays BEHIND_EDGE px inside the screen along its bearing
        const m = T.BEHIND_EDGE || 12, ux = Math.sin(pos.ang * DEG), uy = Math.cos(pos.ang * DEG);
        let k = rad;
        if (ux > 1e-6) k = Math.min(k, (w - m - cx) / ux); else if (ux < -1e-6) k = Math.min(k, (m - cx) / ux);
        if (uy > 1e-6) k = Math.min(k, (h - m - cy) / uy); else if (uy < -1e-6) k = Math.min(k, (m - cy) / uy);
        if (k < rad) { rad = Math.max(R + 6 * s, k); [x, y] = P(pos.ang, rad); }
      }
      const drifter = r.kind === 'drifter';
      const kind = SHAPES[r.type] || SHAPES[r.id] || 'chevron';
      const fogged = inFog(race, r.bearing, r.dist);
      const nemesis = Boolean(r.ai && r.ai.nemesis);
      const flash = mk.flash && V.time - mk.flash < 0.6;
      const color = flash && Math.floor(V.time * 20) % 2 ? '#fff' : nemesis ? ORANGE : drifter ? 'rgba(200,200,210,0.85)'
        : '#fff';
      // the light takes it (playtest P1-11): a white burst that opens where it was drawn, and a streak from outside,
      // where the light comes from, so the moment reads at the screen's edge too
      if (eatenK >= 0) {
        const f = 1 - eatenK;
        circle(x, y, (5 + 30 * eatenK) * s); stroke(`rgba(255,255,255,${a3(f)})`, (1 + 2.5 * f) * kz);
        circle(x, y, 9 * f * s); ctx.fillStyle = `rgba(255,255,255,${a3(f)})`; ctx.fill(); V.ops++;
        const dl = Math.max(1, Math.hypot(x - cx, y - cy)), ux = (x - cx) / dl, uy = (y - cy) / dl;
        line(x + ux * 46 * s, y + uy * 46 * s, x, y); stroke(`rgba(255,255,255,${a3(0.9 * f)})`, 2 * kz);
      }
      if (drifter) {
        circle(x, y, 2 * s); ctx.fillStyle = color; ctx.fill();
      } else {
        const halfDeg = r.half || T.SHIP_HALF;
        const youHalf = Math.max(7, R * T.SHIP_HALF * DEG) * (view.desk ? 1.2 : 1);
        const half = clamp(Math.min(rad, R) * halfDeg * DEG, 4 * s, youHalf * (halfDeg / T.SHIP_HALF));
        const lean = mk.lean && V.time - mk.lean.t0 < T.LEAN_S ? mk.lean : null;
        if (kind === 'manta') {
          // the sail: a thin bright arc 20° wide, white when lit, grey when shadowed
          const lit = !(r.ai && (r.ai.shadowed || r.ai.tornUntil > race.t));
          arc(pos.ang, 10, rad); stroke(lit ? 'rgba(255,255,255,0.95)' : 'rgba(150,150,150,0.8)', 2.5 * kz);
        }
        if (kind === 'whale') {
          // the WHALE: a huge arc, 20° of the ring, with its back edge bright
          arc(pos.ang, halfDeg, rad); stroke(pos.hollow || fogged ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)', 7 * kz);
          arc(pos.ang, halfDeg - 0.5, rad + 3.5 * kz); stroke(color, 1.5 * kz);
          shipShape('chevron', x, y, pos.ang, Math.min(half, 9 * s), { fill: color, hollow: pos.hollow || fogged, t: V.time });
        } else {
          shipShape(kind, x, y, pos.ang, half, { fill: color, hollow: pos.hollow || fogged,
            tilt: lean ? lean.side * 22 : 0, t: V.time });
        }
        // marks: last hull sparks, the glare halo, the grab hook, the lean's tick, the block's flare
        if (r.hull <= 1 && r.shield < 1 && !gone) {
          for (let k = 0; k < 3; k++) {
            const f = (V.time * 3 + k / 3) % 1;
            const [sx2, sy2] = [x + (x - cx) / Math.max(1, rad) * (4 + 10 * f) + (hash01(k + Math.floor(V.time * 9)) - 0.5) * 4,
              y + (y - cy) / Math.max(1, rad) * (4 + 10 * f)];
            ctx.fillStyle = `rgba(255,190,110,${a3(1 - f)})`; ctx.fillRect(sx2 - 1, sy2 - 1, 2, 2);
          }
        }
        if (r.light === 'glare' && !gone) { circle(x, y, half + 4 * s); stroke('rgba(255,255,255,0.8)', 1.25); }
        if (mk.hook && V.time - mk.hook.t0 < T.HOOK_LEAD) {
          const a = Number.isFinite(mk.hook.psi) ? wrap(mk.hook.psi - cam) : pos.ang;
          const ux = Math.sin(a * DEG) - Math.sin(pos.ang * DEG), uy = Math.cos(a * DEG) - Math.cos(pos.ang * DEG);
          const L2 = Math.hypot(ux, uy) || 1;
          line(x, y, x + (ux / L2) * 10 * s, y + (uy / L2) * 10 * s); stroke('#fff', 1.5);
        }
        if (lean) {
          const tgt = race.ships.find((q) => q.id === lean.target) || you;
          const ta = wrap(tgt.bearing - cam) - lean.side * ((tgt.half || 3.5) + 6);
          arc(ta, 3, (tgt === you ? R : rad) + 3 * s); stroke(ORANGE, 3.5 * kz);
        }
        if (mk.block && V.time - mk.block.t0 < 0.4) {
          const [fx2, fy2] = P(pos.ang + mk.block.side * 9, rad);
          line(x, y, fx2, fy2); stroke(`rgba(255,255,255,${a3(1 - (V.time - mk.block.t0) / 0.4)})`, 2.5);
        }
        if (mk.lane && V.time - mk.lane.t0 < 1.0) {
          const a = wrap((Number.isFinite(mk.lane.psi) ? mk.lane.psi : r.bearing) - cam);
          const [lx0, ly0] = P(a, R), [lx1, ly1] = P(a, Rb);
          line(lx0, ly0, lx1, ly1); stroke('rgba(255,255,255,0.9)', 1);
        }
        // a wake ahead of you: two thin lines from the chevron to the ring, 12° apart where they meet it
        if (!gone && pos.place === 'ahead' && pos.secAhead <= (kind === 'whale' ? T.WHALE.wakeFar : T.WAKE_FAR) + 0.2) {
          const inIt = you.draft && you.draft.lead === r.id;
          const full = inIt && you.draft.charge >= 1;
          const wd = kind === 'whale' ? T.WHALE.wakeHalf : T.WAKE_HALF;
          const col = full ? ORANGE : inIt ? `rgba(240,138,44,${a3(0.4 + 0.5 * you.draft.charge)})` : 'rgba(255,255,255,0.35)';
          ctx.beginPath(); V.ops++;
          for (const sg of [-1, 1]) {
            const [ex, ey] = P(pos.ang + sg * wd, R);
            ctx.moveTo(x, y); ctx.lineTo(ex, ey);
          }
          stroke(col, (full ? 1.6 : 1) * kz);
        }
        if (r.draft && r.draft.lead === you.id) draftingYou = true;
      }
      // MAKO's fin: who it hunts
      const fin = V.fin[r.id] || (r.ai && typeof r.ai.target === 'string' ? { target: r.ai.target } : null);
      if (r.type === 'mako' && fin && fin.target) {
        if (fin.target === you.id) finOnYou = true;
        else {
          const tq = race.ships.find((q) => q.id === fin.target);
          if (tq && !isOut(tq)) {
            const tp = rivalPx(view, tq, you, Rb, T);
            const ux = (tp.x - cx) / Math.max(1, tp.r), uy = (tp.y - cy) / Math.max(1, tp.r);
            ctx.beginPath(); V.ops++;
            ctx.moveTo(tp.x - ux * 8 * s - uy * 3 * s, tp.y - uy * 8 * s + ux * 3 * s);
            ctx.lineTo(tp.x - ux * 14 * s, tp.y - uy * 14 * s);
            ctx.lineTo(tp.x - ux * 8 * s + uy * 3 * s, tp.y - uy * 8 * s - ux * 3 * s);
            ctx.fillStyle = ORANGE; ctx.fill();
          }
        }
      }
      rivalsDrawn.push({ id: r.id, x, y, place: pos.place, edge: pos.edge, hollow: pos.hollow, r: rad });
      if (!drifter && !gone) {
        const sec = pos.secAhead;
        const far = sec > 1.5 && !pos.hollow;
        const name = r.name || String(r.id).toUpperCase();
        const signed = `${sec >= 0 ? '+' : '−'}${Math.abs(sec).toFixed(1)} S`;
        labelCands.push({ id: r.id, x, y, text: `${name} ${signed}`, nemesis, boss: r.kind === 'boss', near: Math.abs(sec),
          changed: V.time - (mk.changed ?? -9) < 2 ? 1 : 0, skip: far && !nemesis && r.kind !== 'boss' });
      }
    }
    // the light's beam to a rival it takes ahead of you
    for (const q of V.beams) {
      if (q.kind !== 'light') continue;
      const tq = race.ships.find((x) => x.id === q.to);
      if (!tq) continue;
      const tp = rivalPx(view, tq, you, Rb, T);
      const [bx, by] = P(tp.ang, Rb);
      line(bx, by, tp.x, tp.y); stroke(`rgba(255,255,255,${a3(1 - (V.time - q.t0) / 0.6)})`, 1.5 * kz);
    }
    // spilled cells: a diamond flies from the victim to the rammer
    for (const q of V.beams) {
      if (q.kind !== 'cell') continue;
      const a = race.ships.find((x) => x.id === q.from), b = q.to ? race.ships.find((x) => x.id === q.to) : null;
      if (!a) continue;
      const pa = a === you ? { x: P(shipA, R)[0], y: P(shipA, R)[1] } : rivalPx(view, a, you, Rb, T);
      const k = clamp((V.time - q.t0) / 0.5, 0, 1);
      let qx = pa.x + (pa.x - cx) * 0.15 * k, qy = pa.y + (pa.y - cy) * 0.15 * k;
      if (b) {
        const pb = b === you ? { x: P(shipA, R)[0], y: P(shipA, R)[1] } : rivalPx(view, b, you, Rb, T);
        qx = pa.x + (pb.x - pa.x) * k; qy = pa.y + (pb.y - pa.y) * k;
      }
      diamond(qx, qy, 5 * s, 1, 1 - k * 0.5);
    }
    out.rivals = rivalsDrawn;

    // ---- hazards: outlines inside the ring (the truth), ticks on it ----
    let alarm = false;
    const inner = [];
    const ticks = [];
    const rams = new Set();
    let named = null;
    // a SLAM from your line that would carry a rival into a hazard turns that hazard's tick orange (5.5)
    for (let i = 1; i < race.ships.length; i++) {
      const r = race.ships[i];
      if (isOut(r)) continue;
      const dz = Math.abs(r.dist - you.dist) / bps;
      if (dz > 0.3 || Math.abs(wrap(r.bearing - you.bearing)) > 60) continue;
      const it = slamAim(race, you, r, T);
      if (it) rams.add(it.id);
    }
    for (let k = race.win.lo; k < race.win.hi; k++) {
      const it = items[k];
      if (it.kind === 'cue' || it.kind === 'fog' || isDropped(race, it)) continue;
      const z = (it.beat - you.dist) * T.BEAT_R;
      const ttp = (it.beat - you.dist) / bps;
      const beatNow = it.kind === 'rail' ? you.dist : it.beat;
      const psiNow = it.kind === 'rail' ? psiAt(it, Math.max(it.beat, you.dist)) : it.psi;
      const ang = wrap(psiNow - cam);
      const res = resolve(it, you.bearing, beatNow, T, you.half);
      const band = it.soft ? T.GRAZE_SOFT : T.GRAZE;
      const state = res.hit ? 'hit' : res.gaps.some((x) => x.g < T.HAIR) ? 'hair' : res.gaps.some((x) => x.g < band)
        ? 'graze' : 'clear';
      const rr = depthPx(z, view.phi, view.fPx) + (z <= 0 ? V.ringK.x : V.ringK.x * clamp(1 - z, 0, 1));
      if (it.kind === 'rail') {
        const z1 = (it.end - you.dist) * T.BEAT_R;
        if (z1 <= 0) continue;
        const on = railOn(it, you.dist);
        if (ttp < 2.2) {
          const wide = it.half > 3;
          if (!wide) {
            const r0 = Math.min(depthPx(Math.max(z, 0), view.phi, view.fPx), R), r1 = depthPx(z1, view.phi, view.fPx);
            const a1 = wrap(psiAt(it, Math.min(it.end, you.dist + 12)) - cam);
            const [x0, y0] = P(a1, r1), [x1, y1] = P(ang, Math.max(r0, r1));
            line(x0, y0, x1, y1); stroke('rgba(255,255,255,0.45)', 1 * kz);
          }
          if (z <= 0 && on) {
            const skim = res.gaps.length && res.gaps[0].g <= (it.skimBand ?? T.SKIM_BAND);
            if (wide) {
              arc(ang, it.half, R - 4 * s); stroke('rgba(255,255,255,0.35)', 1.5 * kz);
              const side = res.gaps.length ? res.gaps[0].side : 1;
              const edge = ang - side * it.half;
              arc(edge + side * 3, 3, R); stroke(skim ? ORANGE : 'rgba(255,255,255,0.8)', 3 * kz);
            } else { arc(ang, it.half + 1, R); stroke(skim ? ORANGE : 'rgba(255,255,255,0.9)', 3 * kz); }
            if (state === 'hit') alarm = true;
          }
        }
        if (z > 0 && ttp <= T.TICK_LEAD) ticks.push({ kind: 'rail', ang, half: it.half, ttp, state, it });
        continue;
      }
      if (ttp <= -0.05) continue;
      const hidden = (it.dark && ttp > T.SILHOUETTE) || (ttp > T.SILHOUETTE && inFog(race, it.psi, it.beat));
      // a wall's or a gate's gap shows early, faintly, so a line can be planned (preview items: 3 s)
      if ((it.preview || it.kind === 'wall') && ttp > T.TICK_LEAD && ttp <= T.PREVIEW_LEAD
        && (it.kind === 'wall' || it.kind === 'gate')) {
        const kk = smooth(T.PREVIEW_LEAD, T.TICK_LEAD, ttp);
        if (it.kind === 'wall') {
          for (const g of it.gaps) {
            const ga = wrap(g.psi - cam);
            ctx.beginPath(); V.ops++;
            for (const sg of [-1, 1]) {
              const [x0, y0] = P(ga + sg * g.w / 2, R - 4), [x1, y1] = P(ga + sg * g.w / 2, R + 10);
              ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
            }
            stroke(`rgba(255,255,255,${a3(0.25 + 0.4 * kk)})`, 1.5 * kz);
          }
        }
      }
      if (ttp <= T.OUTLINE_LEAD + (hidden ? 0.6 : 0) && rr < R * 1.02 && rr > 2) {
        const a = smooth(T.OUTLINE_LEAD + 0.6, T.OUTLINE_LEAD - 0.25, ttp);
        const col = state === 'hit' ? '255,90,70' : state === 'hair' ? '255,215,140' : state === 'graze' ? '240,150,70'
          : '255,255,255';
        const outline = (draw) => {
          draw(); stroke(`rgba(0,0,0,${a3(0.55 * a)})`, 3.5 * kz);
          draw(); stroke(`rgba(${col},${a3(0.9 * a)})`, 1.5 * kz);
        };
        const silhouette = (psi, half) => {
          const rad = Math.max(3, rr * half * DEG);
          const [x, y] = P(wrap(psi - cam), rr);
          circle(x, y, rad); ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fill();
          stroke(it.dark && !inFog(race, it.psi, it.beat) ? `rgba(150,170,255,${a3(0.6 * a)})` : `rgba(240,138,44,${a3(0.9 * a)})`, 1.25 * kz);
        };
        switch (it.kind) {
          case 'knot': if (hidden) silhouette(it.psi, it.half); else outline(() => arc(ang, it.half, rr)); break;
          case 'pulse': { const hh = halfAt(it, you.dist); if (hidden) silhouette(it.psi, hh); else outline(() => arc(ang, hh, rr)); break; }
          case 'well': {
            // the latch ring round the galaxy
            const core = wellCore(it, T);
            const [x, y] = P(ang, rr);
            const held = race.wells[it.id] && race.wells[it.id].holder && race.wells[it.id].holder !== you.id;
            circle(x, y, Math.max(4, rr * core * DEG * 1.6));
            stroke(held ? 'rgba(160,160,160,0.7)' : `rgba(255,255,255,${a3(0.8 * a)})`, 1 * kz);
            outline(() => arc(ang, core, rr));
            break;
          }
          case 'wall': {
            ctx.beginPath(); V.ops++;
            const gs = [...it.gaps].map((g) => ({ a: wrap(g.psi - cam), w: g.w })).sort((p, q) => p.a - q.a);
            for (let i = 0; i < gs.length; i++) {
              const e0 = gs[i].a + gs[i].w / 2;
              const e1 = (i + 1 < gs.length ? gs[i + 1].a : gs[0].a + 360) - (i + 1 < gs.length ? gs[i + 1].w : gs[0].w) / 2;
              if (e1 > e0) { const mid = (e0 + e1) / 2, hw = (e1 - e0) / 2; ctx.moveTo(...P(mid + hw, rr)); arcTo(mid, hw, rr); }
            }
            stroke(`rgba(255,255,255,${a3(0.55 * a)})`, 1.25 * kz);
            break;
          }
          case 'gate': {
            const [hL, hR] = it.halves, g = it.gap / 2;
            for (const sg of [-1, 1]) {
              const half = sg < 0 ? hL : hR;
              const psi = it.psi + sg * (g + half);
              if (hidden) silhouette(psi, half); else outline(() => arc(wrap(psi - cam), half, rr));
            }
            break;
          }
          case 'pickup': {
            const [x, y] = P(ang, rr);
            const sz = clamp(rr * 2.2 * DEG * 1.6, 3, 7) * s;
            if (it.type === 'patch') {
              circle(x, y, sz + 3 * s); stroke(`rgba(255,255,255,${a3(0.8 * a)})`, 1 * kz);
              ctx.beginPath(); V.ops++; ctx.moveTo(x - sz, y); ctx.lineTo(x + sz, y); ctx.moveTo(x, y - sz); ctx.lineTo(x, y + sz);
              stroke(`rgba(255,255,255,${a3(a)})`, 2 * kz);
              if (!V.patchSeen && ttp < 1.0) text('PATCH', x + sz + 8, y, { px: view.desk ? 13 : 11, weight: 700, alpha: a });
            } else {
              ctx.beginPath(); V.ops++;
              ctx.moveTo(x, y - sz); ctx.lineTo(x + sz, y); ctx.lineTo(x, y + sz); ctx.lineTo(x - sz, y); ctx.closePath();
              stroke(`rgba(240,138,44,${a3(a)})`, 1.5 * kz);
            }
            break;
          }
          default:
        }
      }
      if (it.name && it.kind !== 'cue' && ttp > 0.15 && ttp <= T.OUTLINE_LEAD + 0.4 && rr < R * 0.95
        && (!named || ttp < named.ttp)) named = { it, ttp, rr };
      if (ttp <= T.TICK_LEAD) {
        ticks.push({ kind: it.kind, ang, half: it.kind === 'well' ? wellCore(it, T) : it.kind === 'pulse'
          ? halfAt(it, you.dist) : it.half, ttp, state, it, ram: rams.has(it.id) });
      }
      // what will hit you also shows just inside the ring, above the ship, where the chevron cannot hide it
      if (state === 'hit' && ttp <= T.ALARM_LEAD && it.kind !== 'pickup') {
        const half = it.kind === 'knot' || it.kind === 'pulse' ? (it.half || 3) + T.SHIP_HALF : 14;
        inner.push({ centre: it.kind === 'knot' || it.kind === 'pulse' ? ang : shipA, half,
          a: 0.35 + 0.6 * clamp(1 - ttp / T.ALARM_LEAD, 0, 1) });
        alarm = true;
      }
    }
    for (const q of inner) { arc(q.centre, q.half, R - 15 * s); stroke(`rgba(255,77,61,${a3(q.a)})`, 3 * kz); }
    // a named galaxy coming up (NGC 4911, M32, Io...): the video's thin ring and label, one at a time
    let namedBox = null;
    if (named) {
      const [nx, ny] = P(wrap(named.it.psi - cam), named.rr);
      const half = named.it.kind === 'well' ? wellCore(named.it, T) * 1.6 : named.it.half || 3;
      // clear of the landmark labels, or not drawn this frame
      const L = placeMark(`item:${named.it.id}`, nx, ny, Math.max(6, named.rr * half * DEG) + 3, named.it.name,
        view.desk ? 13 : 11, markBoxes);
      if (L) {
        namedBox = drawMark(L, { alpha: smooth(T.OUTLINE_LEAD + 0.4, T.OUTLINE_LEAD - 0.1, named.ttp) });
        out.marks.push({ id: named.it.id, box: namedBox });
      }
    }

    // ---- wells: the reach arc, the window flash, exit bands, the red zone, the tether ----
    const win = you.whip ? null : windowOf(race, you);
    const bands = exitsOf(race, you);
    if (win && win.t <= 1.5) {
      const ka = smooth(1.5, 1.0, win.t);
      const wa = wrap(win.item.psi - cam);
      arc(wa, win.reach, R + 10 * s); stroke(`rgba(255,255,255,${a3(0.12 + 0.25 * ka)})`, 1.5 * kz);
      if (win.open && win.inReach && !win.holder) {
        // the moment: your ring flashes white where the well's latch ring touches it
        const pulse = 0.6 + 0.4 * Math.sin(V.time * 30);
        arc(shipA, 9, R); stroke(`rgba(255,255,255,${a3(pulse)})`, 4 * kz);
        arc(wa, win.core + 2, R); stroke(`rgba(255,255,255,${a3(pulse)})`, 4 * kz);
      }
    }
    if (bands.length && (you.whip || (win && win.t <= 1.5))) {
      const whipping = Boolean(you.whip);
      let next = null;
      for (const b of bands) if (whipping && b.letgo && Number.isFinite(b.t) && b.t > -0.15 && (!next || b.t < next.t)) next = b;
      for (const b of bands.slice(0, 2)) {
        const ba = wrap(b.psi - cam);
        const alpha = whipping ? (b.reach ? 0.6 : 0.2) : 0.22;
        const lw = (whipping ? 6 : 2.5) * kz;
        arc(ba, b.w / 2, R + 5 * s); stroke(`rgba(240,138,44,${a3(alpha)})`, lw);
        arc(ba, b.perfect, R + 5 * s); stroke(`rgba(255,200,140,${a3(alpha + 0.25)})`, lw);
        out.bands.push({ psi: b.psi, ang: ba });
        keepArc(out.keep, ba, b.w / 2, R + 5 * s - lw / 2, R + 5 * s + lw / 2);
        if (b === next) {
          const [lx, ly] = P(ba, R - 26 * s);
          text('LET GO', lx, ly, { px: view.desk ? 26 : 18, weight: 800, color: ORANGE, align: 'center' });
          out.keep.push(textBox('LET GO', lx, ly, view.desk ? 26 : 18));
        }
      }
    }
    if (you.whip) {
      const W = you.whip;
      const wa = wrap(W.psi - cam);
      // the tether: a chord across the ring from you to the well
      const [x0, y0] = P(shipA, R), [x1, y1] = P(wa, R);
      line(x0, y0, x1, y1); stroke(W.latched ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.9)', 1.25 * kz);
      // the red zone: the last RED_SPAN° before the core, in the sweep's direction from the grab
      const dirS = W.dir || 1;
      const redFrom = W.b0 + dirS * W.redAt, redTo = W.b0 + dirS * W.scorchAt;
      const mid = wrap((redFrom + redTo) / 2 - cam), hw = Math.abs(redTo - redFrom) / 2;
      const last = you.hull <= 1 && you.shield < 1;
      const flick = last ? 0.5 + 0.5 * Math.sin(V.time * 24) : 1;
      arc(mid, hw, R + 5 * s); stroke(`rgba(255,77,61,${a3((W.red ? 0.85 : 0.55) * flick)})`, (W.red ? 6 : 4) * kz);
      // the core glows red and crackles from SCORCH_WARN before
      if (W.warned || W.red) {
        const [kx, ky] = P(wa, R);
        circle(kx, ky, (6 + 3 * Math.sin(V.time * 40)) * s); stroke(`rgba(255,77,61,${a3(0.6 + 0.4 * Math.sin(V.time * 50))})`, 2 * kz);
      }
    }

    // ---- the gate: THREAD and DOCK lines with their labels, and the landing's door ----
    const gate = race.leg.gate;
    if (gate && V.gateOn && Number.isFinite(gate.psi)) {
      const tg = ((gate.beat ?? race.leg.beats - 4) - you.dist) / bps;
      if (tg > -0.2) {
        const draw = smooth(4.5, 3.5, tg) * (tg < 0 ? 1 + tg / 0.2 : 1);
        const ta = wrap(gate.psi - cam), gap = (gate.gap ?? 30) / 2;
        const px = view.desk ? 13 : 11;
        if (race.leg.type === 'earth') {
          arc(ta, (T.DOOR_DEG || 60) / 2, R + 6 * s); stroke(`rgba(255,255,255,${a3(0.9 * draw)})`, 3 * kz);
          const [lx, ly] = onScreen('EARTH', ...P(ta, R + 30 * s), px, w, h);
          text('EARTH', lx, ly, { px, weight: 800, align: 'center', alpha: draw });
          if (draw > 0.05) {
            keepArc(out.keep, ta, (T.DOOR_DEG || 60) / 2, R, R + 12 * s);
            out.keep.push(textBox('EARTH', lx, ly, px));
          }
        } else {
          // THREAD: the gap between the giants, orange
          arc(ta, gap, R + 6 * s); stroke(`rgba(240,138,44,${a3(0.95 * draw)})`, 3 * kz);
          ctx.beginPath(); V.ops++;
          for (const sg of [-1, 1]) {
            const [x0, y0] = P(ta + sg * gap, R - 6 * s), [x1, y1] = P(ta + sg * gap, R + 14 * s);
            ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
          }
          stroke(`rgba(240,138,44,${a3(draw)})`, 1.5 * kz);
          const [tx, ty] = P(ta, R + 16 * s), [tx2, ty2] = P(ta, R + 30 * s);
          line(tx, ty, tx2, ty2); stroke(`rgba(240,138,44,${a3(draw)})`, 1);
          const [lx, ly] = onScreen('THREAD', tx2, ty2 + (ty2 > cy ? 8 : -8) * s, px, w, h);
          text('THREAD', lx, ly, { px, weight: 800, color: ORANGE, align: 'center', alpha: draw });
          out.gateLines.push({ kind: 'thread', x: tx2, y: ty2 });
          if (draw > 0.05) {
            keepArc(out.keep, ta, gap, R - 6 * s, R + 30 * s);
            out.keep.push(textBox('THREAD', lx, ly, px));
          }
          if (gate.dock && Number.isFinite(gate.dock.psi)) {
            const da = wrap(gate.dock.psi - cam), dw = (gate.dock.w || T.DOCK_DEG) / 2;
            ctx.setLineDash([6 * kz, 4 * kz]);
            arc(da, dw, R + 6 * s); stroke(`rgba(255,255,255,${a3(0.85 * draw)})`, 2.5 * kz);
            ctx.setLineDash([]);
            const [dx, dy] = P(da + dw * 0.6, R + 14 * s), [dx2, dy2] = P(da + dw * 0.6, R + 30 * s);
            line(dx, dy, dx2, dy2); stroke(`rgba(255,255,255,${a3(0.8 * draw)})`, 1);
            const [kx, ky] = onScreen('DOCK +', dx2, dy2 + (dy2 > cy ? 8 : -8) * s, px, w, h);
            text('DOCK +', kx, ky, { px, weight: 800, align: 'center', alpha: draw });
            out.gateLines.push({ kind: 'dock', x: dx2, y: dy2 });
            if (draw > 0.05) {
              keepArc(out.keep, da, dw, R, R + 30 * s);
              out.keep.push(textBox('DOCK +', kx, ky, px));
            }
          }
        }
      }
    }

    // ---- speed: streaks pour outward past the ring, faster and redder with each gear ----
    if (!reduced && !you.caught) drawStreaks(you, dt, view, R);

    // ---- the ring (now): it draws on from 6 o'clock at the launch ----
    {
      const draw = clamp(race.real / 0.3, 0, 1);
      const glareK = light === 'glare' ? 0.15 : 0;
      ctx.beginPath(); V.ops++;
      ctx.arc(cx, cy, R, Math.PI / 2 - Math.PI * draw, Math.PI / 2 + Math.PI * draw);
      stroke(`rgba(255,255,255,${a3(0.8 + glareK)})`, (view.desk ? 2 : 1.25));
    }
    // ripples: a hairline ripples out; a gear up rings in toward the centre, blue; a drop rings out
    V.ripples = V.ripples.filter((q) => V.time - q.t0 < 0.45);
    for (const q of V.ripples) {
      const k = (V.time - q.t0) / 0.45;
      let rr = R + 4 + 18 * k, col = `rgba(255,255,255,${a3(0.6 * (1 - k))})`, lw = 1.5;
      if (q.kind === 'gear') { rr = Math.max(4, R * (1 - 0.6 * k)); col = `rgba(150,190,255,${a3(0.8 * (1 - k))})`; lw = 2.5; }
      else if (q.kind === 'tick') { rr = R * (1 - 0.15 * k); col = `rgba(150,190,255,${a3(0.5 * (1 - k))})`; }
      else if (q.kind === 'out') { rr = R + 6 + 60 * k; col = `rgba(150,190,255,${a3(0.7 * (1 - k))})`; lw = 2.5; }
      else if (q.kind === 'burn') { rr = R - 10 * k; col = `rgba(240,138,44,${a3(0.7 * (1 - k))})`; lw = 2; }
      else if (q.kind === 'red') {
        arc(shipA, 14 + 30 * k, R + 3 + 10 * k * s); stroke(`rgba(255,77,61,${a3(0.9 * (1 - k))})`, 3 * kz);
        continue;
      } else if (q.kind === 'shield') { rr = R; col = `rgba(160,200,255,${a3(0.5 * (1 - k))})`; lw = 2; }
      circle(cx, cy, rr); stroke(col, lw * kz);
    }
    // graze streaks along the ring
    V.fx = V.fx.filter((q) => V.time - q.t0 < q.dur);
    for (const q of V.fx) {
      if (V.time < q.t0) continue;
      const k = (V.time - q.t0) / q.dur;
      arc(wrap(q.psi - cam), 10 + 40 * k, R);
      stroke(q.sling ? `rgba(240,138,44,${a3(1 - k)})` : `rgba(255,255,255,${a3(1 - k)})`, (q.hair ? 3 : 2) * kz);
    }

    // ---- ticks on the ring (the bright ones last, so they read) ----
    const tells = opts.tells || null;
    const TR = R - 1.5 * s;                        // ticks sit on the ring's inner edge, clear of the wings outside
    for (const tk of ticks) {
      const a = 0.2 + 0.7 * clamp(1 - tk.ttp / T.TICK_LEAD, 0, 1);
      const hits = tk.state === 'hit';
      const thick = tells && tells.has('thick-hair-ticks') ? 1.5 : 1;
      let lw = tk.state === 'hair' ? 5 * thick : tk.state === 'graze' ? 3.5 : 3;
      let col = hits && tk.ttp <= T.ALARM_LEAD ? `rgba(255,77,61,${a3(a)})` : tk.state === 'hair'
        ? `rgba(255,215,140,${a3(a + 0.15)})` : tk.state === 'graze' ? `rgba(240,138,44,${a3(a)})` : `rgba(255,255,255,${a3(a)})`;
      if (tk.ram) { col = `rgba(240,138,44,${a3(Math.max(a, 0.75))})`; lw = 4.5; }
      lw *= kz;
      if (tk.kind === 'pickup') {
        if (tk.it.type === 'fuel') {
          ctx.setLineDash([3, 3]); arc(tk.ang, 3, TR); stroke(`rgba(240,138,44,${a3(a)})`, 3 * kz); ctx.setLineDash([]);
        } else { arc(tk.ang, 3, TR); stroke(`rgba(255,255,255,${a3(a)})`, 3 * kz); }
        continue;
      }
      if (tk.kind === 'wall') {
        const it = tk.it;
        ctx.beginPath(); V.ops++;
        const gs = [...it.gaps].map((g) => ({ a: wrap(g.psi - cam), w: g.w })).sort((p, q) => p.a - q.a);
        for (let i = 0; i < gs.length; i++) {
          const e0 = gs[i].a + gs[i].w / 2;
          const e1 = (i + 1 < gs.length ? gs[i + 1].a : gs[0].a + 360) - (i + 1 < gs.length ? gs[i + 1].w : gs[0].w) / 2;
          if (e1 > e0) { const mid = (e0 + e1) / 2, hw = (e1 - e0) / 2; ctx.moveTo(...P(mid + hw, TR)); arcTo(mid, hw, TR); }
        }
        stroke(col, lw);
      } else if (tk.kind === 'gate') {
        const it = tk.it, g = it.gap / 2;
        ctx.beginPath(); V.ops++;
        for (const sg of [-1, 1]) {
          const half = sg < 0 ? it.halves[0] : it.halves[1];
          const a2 = wrap(it.psi + sg * (g + half) - cam);
          ctx.moveTo(...P(a2 + half, TR)); arcTo(a2, half, TR);
        }
        stroke(col, lw);
      } else if (tk.kind === 'rail' && tk.half > 3) {
        // a sheet (the Great Wall, the bar): its two edges, where you skim or cross it
        ctx.beginPath(); V.ops++;
        for (const sg of [-1, 1]) { const ea = tk.ang + sg * (tk.half - 2); ctx.moveTo(...P(ea + 2, TR)); arcTo(ea, 2, TR); }
        stroke(col, lw);
      } else { arc(tk.ang, Math.max(1.5, tk.half), TR); stroke(col, lw); }
    }

    // ---- your ship: trail, chevron, shield, wings, chain ----
    // the trail: where the ship was on the ring this last 0.22 s, as arcs along it (bearings unwrapped)
    V.trail.push({ b: you.bearing - cam, t: V.time, w: Math.abs(you.turnRate || 0) });
    V.trail = V.trail.filter((q) => V.time - q.t < 0.22);
    if (V.trail.length > 1) {
      ctx.beginPath(); V.ops++;
      let any = false;
      for (let i = 1; i < V.trail.length; i++) {
        const q0 = V.trail[i - 1], q1 = V.trail[i];
        if (clamp(q1.w / 300, 0, 1) < 0.05 || Math.abs(q1.b - q0.b) > 120) continue;
        const a0 = (90 - q0.b) * DEG, a1 = (90 - q1.b) * DEG;
        ctx.moveTo(...P(q0.b, R)); ctx.arc(cx, cy, R, a0, a1, a1 < a0); any = true;
      }
      if (any) stroke('rgba(255,255,255,0.45)', 2.5 * kz);
    }
    const [shx, shy] = P(shipA, R);
    const flicker = you.flicker > 0 && Math.floor(V.time * 16) % 2 === 0;
    const shipHalf = Math.max(7, R * T.SHIP_HALF * DEG) * (view.desk ? 1.2 : 1);
    if (!flicker && !you.caught) drawShip(shx, shy, shipHalf, you, alarm && Math.floor(V.time * 12) % 2 === 0);
    // sparks: the burn's flare, the last hull's trail
    if (you.hull <= 1 && you.shield < 1 && !you.caught && hash01(V.time * 13.3) < 0.6) {
      V.sparks.push({ t0: V.time, ang: you.bearing, dr: 4 + 10 * hash01(V.time * 7), da: (hash01(V.time * 3) - 0.5) * 6, life: 0.4 });
    }
    V.sparks = V.sparks.filter((q) => V.time - q.t0 < q.life);
    for (const q of V.sparks) {
      const k = (V.time - q.t0) / q.life;
      const [x, y] = P(wrap(q.ang - cam) + q.da * k, R + q.dr * k * s);
      ctx.fillStyle = q.orange ? `rgba(240,138,44,${a3(1 - k)})` : `rgba(255,${Math.round(200 - 80 * k)},120,${a3(1 - k)})`;
      ctx.fillRect(x - 1.2 * s, y - 1.2 * s, 2.4 * s, 2.4 * s);
    }
    // the shield bubble (8.1): 13 px, 70 %; recharging, an arc sweeps round it; a pop bursts it into six pieces
    const wings = wingsPx(view, you, T);
    {
      const sh = wings.shield;
      const sx2 = shx, sy2 = shy;
      if (you.shieldMax > 0) {
        if (you.shield >= 1) {
          circle(sx2, sy2, sh.r + (tells && tells.has('blue-halo-widens') ? 3 * s : 0)); stroke('rgba(255,255,255,0.7)', sh.line);
          if (you.shield >= 2) { circle(sx2, sy2, sh.r + 4 * s); stroke('rgba(255,255,255,0.45)', sh.line); }
        } else {
          const k = clamp((you.shieldT || 0) / T.SHIELD_T, 0, 1);
          ctx.beginPath(); V.ops++;
          ctx.arc(sx2, sy2, sh.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
          stroke('rgba(255,255,255,0.3)', sh.line);
        }
      }
      V.frags = V.frags.filter((q) => V.time - q.t0 < 0.4);
      for (const q of V.frags) {
        const k = (V.time - q.t0) / 0.4, rr = sh.r + 18 * k * s;
        ctx.beginPath(); V.ops++;
        ctx.arc(sx2, sy2, rr, (q.a - 18) * DEG, (q.a + 18) * DEG);
        stroke(`rgba(255,255,255,${a3(0.9 * (1 - k))})`, 1.5 * kz);
      }
    }
    // the wings: hull pips left of the ship, fuel diamonds right of it
    if (!you.caught) {
      const dryK = V.time - V.dry < 0.5 ? (Math.floor(V.time * 14) % 2 ? 1 : 0.3) : 0;
      for (const p of wings.hull) {
        const ux = Math.sin(p.ang * DEG), uy = Math.cos(p.ang * DEG);
        const x0 = p.x - ux * p.len * 0.5, y0 = p.y - uy * p.len * 0.5, x1 = p.x + ux * p.len * 0.5, y1 = p.y + uy * p.len * 0.5;
        line(x0, y0, x1, y1);
        stroke(p.full ? (you.hull <= 1 && you.shield < 1 && Math.floor(V.time * 4) % 2 ? RED : '#fff') : 'rgba(255,255,255,0.35)',
          p.full ? p.wide : 1);
      }
      for (const p of wings.fuel) {
        const segs = tells && tells.has('diamond-segments');
        diamond(p.x, p.y, p.size / 2, p.fill, 1, dryK && p.fill < 1 ? dryK : 0, segs);
      }
      out.wings = { hull: wings.hull.map((p) => ({ x: p.x, y: p.y, size: p.len, wide: p.full ? p.wide : 1, ang: p.ang })),
        fuel: wings.fuel.map((p) => ({ x: p.x, y: p.y, size: p.size })),
        shield: { x: shx, y: shy, r: wings.shield.r } };
    }
    // being drafted: an orange tick at your tail; MAKO's fin on you
    if (draftingYou && !you.caught) {
      const [tx, ty] = P(shipA, R + 22 * s), [tx2, ty2] = P(shipA, R + 30 * s);
      line(tx, ty, tx2, ty2); stroke(ORANGE, 3 * kz);
    }
    if (finOnYou && !you.caught) {
      const [fx2, fy2] = P(shipA, R - shipHalf * 1.6);
      ctx.beginPath(); V.ops++;
      ctx.moveTo(fx2 - 3 * s, fy2); ctx.lineTo(fx2, fy2 - 6 * s); ctx.lineTo(fx2 + 3 * s, fy2); ctx.fillStyle = ORANGE; ctx.fill();
    }
    // the chain above the ship, popping on each graze, with the time it has left as a thin arc under it
    if (you.chain > 0) {
      V.chainPop = Math.max(0, V.chainPop - dt * 5);
      const [x, y] = P(shipA, R - 34 * s);
      const size = Math.round(15 * s * (1 + 0.45 * V.chainPop));
      text(String(you.chain), x, y, { px: size, weight: 700, align: 'center', color: you.headlight ? ORANGE : '#fff' });
      const left = clamp(1 - (you.chainT || 0) / T.CHAIN_TIMEOUT, 0, 1);
      ctx.beginPath(); V.ops++;
      ctx.arc(x, y + 2 * s, 13 * s, Math.PI * 0.25 + Math.PI * 0.5 * (1 - left), Math.PI * 0.75);
      stroke(left < 0.35 ? (Math.floor(V.time * 8) % 2 ? ORANGE : 'rgba(240,138,44,0.4)') : 'rgba(255,255,255,0.45)', 1.5 * kz);
    }
    V.digits = V.digits.filter((q) => V.time - q.t0 < 0.8);
    for (const q of V.digits) {
      const k = (V.time - q.t0) / 0.8;
      const [x, y] = P(shipA, R - 34 * s + 70 * k * k);
      const col = q.red ? `rgba(255,77,61,${a3(1 - k)})` : `rgba(170,170,170,${a3(1 - k)})`;
      [...q.text].forEach((ch, i) => text(ch, x + (i - (q.text.length - 1) / 2) * (10 + 26 * k) * s, y + i * 8 * k,
        { px: Math.round((15 + 6 * k) * s), weight: 700, align: 'center', color: col }));
    }
    // small words at the ship: +1 ◆, a whip's grade after the first two, TAKEDOWN, a card's name the first 2 times
    V.popups = V.popups.filter((q) => V.time - q.t0 < 0.7);
    for (const q of V.popups) {
      const k = (V.time - q.t0) / 0.7;
      const [x, y] = P(shipA + 20, R - 18 * s - 22 * k * s);
      text(q.text, x, y, { px: Math.round(12 * s), weight: 700, align: 'center', color: q.orange ? ORANGE : '#fff', alpha: 1 - k });
    }
    V.words = V.words.filter((q) => V.time - q.t0 < 0.8);
    for (const q of V.words) {
      const k = (V.time - q.t0) / 0.8;
      const [x, y] = P(shipA - 22, R - 20 * s - 16 * k * s);
      text(q.text, x, y, { px: Math.round(13 * s), weight: 800, align: 'center', color: q.orange ? ORANGE : '#fff', alpha: 1 - k * k });
    }
    {
      const fires = cardFires(race);
      for (const f of fires) {
        if (f.t > race.t || race.t - f.t > 0.9) continue;
        const key = `${f.id}`;
        const n = V.cardShown[key] || 0;
        if (n >= 2) continue;
        if (V.cardSeen !== f.t) { V.cardSeen = f.t; V.cardShown[key] = n + 1; }
        const c = CARD[f.id];
        if (!c) continue;
        const k = (race.t - f.t) / 0.9;
        const [x, y] = P(shipA, R + 46 * s);
        text(c.name, x, y, { px: Math.round(11 * s), weight: 800, align: 'center', color: ORANGE, alpha: 1 - k });
      }
    }

    // ---- rival labels: at most 2, never within 24 px of the landmark label ----
    labelCands.sort((a, b) => (b.nemesis - a.nemesis) || (b.boss - a.boss) || (a.near - b.near) || (b.changed - a.changed));
    const cands = labelCands.filter((c) => !c.skip);
    // ringmath.placeLabels keeps clear of one landmark label; with more marks on screen a label that lands on another
    // is placed again against that one, and dropped if it still touches a mark. Labels also never touch (3 px) the
    // light's label (its time to catch), your wings and shield, or the HUD (main.js passes its boxes).
    const avoid = out.marks.map((m) => m.box).filter(Boolean);
    const near = (a, b) => boxTouch(a, b, 24);
    const clear = (opts.hud || hudCorners(view)).slice();
    if (out.lightLabel) clear.push(out.lightLabel);
    if (out.wings) {
      for (const p of [...out.wings.hull, ...out.wings.fuel]) {
        clear.push({ x: p.x - p.size / 2, y: p.y - p.size / 2, w: p.size, h: p.size });
      }
      const sh = out.wings.shield;
      clear.push({ x: sh.x - sh.r, y: sh.y - sh.r, w: sh.r * 2, h: sh.r * 2 });
    }
    const bad = (box) => avoid.find((b) => near(box, b)) || clear.find((b) => boxTouch(box, b, 3));
    const placed = [];
    for (const L of placeLabels(view, cands, { landmark: namedBox || landmarkBox, max: 2 })) {
      const hit = bad(L.box);
      if (!hit) { if (!placed.some((q) => boxTouch(L.box, q.box, 2))) placed.push(L); continue; }
      const again = placeLabels(view, cands.filter((c) => L.ids.includes(c.id)), { landmark: hit, max: 1 })[0];
      if (again && !bad(again.box) && !placed.some((q) => near(again.box, q.box))) placed.push(again);
    }
    for (const L of placed) {
      const nem = cands.find((c) => c.id === L.ids[0]);
      const col = nem && nem.nemesis ? ORANGE : '#fff';
      line(L.anchor.x, L.anchor.y, L.elbow.x, L.elbow.y); stroke('rgba(255,255,255,0.7)', 1);
      text(L.text, L.x, L.y, { px: L.px, weight: 700, align: L.align, color: col });
      out.labels.push(L.box);
    }
    out.alarm = alarm;

    // ---- LIGHT SPEED: the rush of lines into the fold and the headlight's rays ----
    V.lsT += dt;
    if (you.lightspeed || V.lsT < 1.2) drawRush(you, dt, view);

    ctx.restore();
    fxLayers(you, dt, T);
    out.ops = V.ops;
    return out;
  }

  // A fuel diamond: fill 0..1 rises from the bottom; flash: the dry click's blink.
  function diamond(x, y, half, fill = 1, alpha = 1, flash = 0, segs = false) {
    ctx.globalAlpha = alpha;
    ctx.beginPath(); V.ops++;
    ctx.moveTo(x, y - half); ctx.lineTo(x + half, y); ctx.lineTo(x, y + half); ctx.lineTo(x - half, y); ctx.closePath();
    if (fill >= 1) { ctx.fillStyle = ORANGE; ctx.fill(); }
    else {
      if (fill > 0) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = ORANGE; ctx.fillRect(x - half, y + half - 2 * half * fill, 2 * half, 2 * half * fill);
        ctx.restore();
        ctx.beginPath(); V.ops++;
        ctx.moveTo(x, y - half); ctx.lineTo(x + half, y); ctx.lineTo(x, y + half); ctx.lineTo(x - half, y); ctx.closePath();
      }
      ctx.strokeStyle = flash ? `rgba(255,255,255,${a3(flash)})` : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1; ctx.stroke();
    }
    if (segs && fill > 0 && fill < 1) {
      ctx.beginPath(); V.ops++; ctx.moveTo(x - half, y); ctx.lineTo(x + half, y); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Your ship: a white chevron with an orange tail on the ring (lab A); red while something will hit you.
  function drawShip(x, y, half, you, red) {
    const ang = Math.atan2(cy - y, cx - x);
    const sc = half / 7;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const tail = (8 + 12 * clamp((you.eta - 0.6) / 2.4, 0, 1)) * Math.sqrt(sc) * (you.burn && you.burn.t > 0 ? 1.8 : 1);
    ctx.beginPath(); V.ops++;
    ctx.moveTo(-2, -half * 0.45); ctx.lineTo(-tail - 4, 0); ctx.lineTo(-2, half * 0.45);
    ctx.fillStyle = 'rgba(240,138,44,0.85)'; ctx.fill();
    ctx.beginPath(); V.ops++;
    ctx.moveTo(9 * sc, 0); ctx.lineTo(-4 * sc, -half); ctx.lineTo(-1 * sc, 0); ctx.lineTo(-4 * sc, half); ctx.closePath();
    ctx.fillStyle = red ? RED : '#fff';
    ctx.fill();
    ctx.restore();
  }

  // Streaks outside the ring: points of the near field rushing past, out of the centre and off the screen. They
  // move at course speed and lengthen with it; at 0.99c and above the light from beside you is redder (Doppler).
  const STREAKS = [];
  for (let i = 0; i < 40; i++) STREAKS.push({ a: hash01(i * 7.7) * 360, r: 1 + 1.6 * hash01(i * 2.9), v: 0.7 + 0.6 * hash01(i * 4.4) });
  function drawStreaks(you, dt, view, R) {
    const g = you.gear || 0;
    const alpha = [0.1, 0.16, 0.22, 0.28, 0.3][Math.min(4, g)];
    const reach = Math.hypot(V.w, V.h) / Math.max(40, R);
    const speed = view.bps * 0.55;
    const col = g >= 2 ? '255,170,150' : '220,230,255';
    ctx.beginPath(); V.ops++;
    for (const q of STREAKS) {
      q.r *= 1 + speed * q.v * dt;
      if (q.r > reach) { q.r = 1.02 + 0.2 * hash01(q.a + V.time); q.a = hash01(q.a * 3.1 + V.time) * 360; }
      const len = (0.04 + 0.05 * g) * q.r * q.v;
      const [x0, y0] = P(q.a, R * q.r), [x1, y1] = P(q.a, R * (q.r + len));
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
    stroke(`rgba(${col},${alpha})`, 1);
  }

  // The LIGHT SPEED rush (lab B): thin blue-white lines flying in to the fold at the centre; strong for the first
  // second, faint while you hold LIGHT SPEED. The headlight's core gets short rays.
  const RUSH = [];
  for (let i = 0; i < 56; i++) {
    RUSH.push({ a: hash01(i * 3.3) * Math.PI * 2, r: hash01(i * 1.7), v: 0.6 + hash01(i * 8.1) * 0.8, w: hash01(i * 5.3) });
  }
  function drawRush(you, dt, view) {
    const strong = 1 - smooth(0.25, 1.1, V.lsT);
    const a0 = (reduced ? 0.5 : 1) * (you.lightspeed ? 0.12 + 0.6 * strong : 0.7 * strong);
    if (a0 < 0.01) return;
    const Rr = Math.hypot(V.w, V.h) * 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath(); V.ops++;
    for (const k of RUSH) {
      k.r -= dt * k.v * (0.35 + 1.6 * strong);
      if (k.r < 0.04) { k.r = 1; k.a = hash01(k.a * 97 + V.time) * Math.PI * 2; }
      const r1 = Rr * k.r, r2 = Rr * Math.max(0.02, k.r - 0.06 - 0.22 * strong);
      const ca = Math.cos(k.a), sa = Math.sin(k.a);
      ctx.moveTo(cx + ca * r1, cy + sa * r1); ctx.lineTo(cx + ca * r2, cy + sa * r2);
    }
    stroke(`rgba(205,225,255,${a3(a0 * 0.7)})`, 1.2);
    if (you.lightspeed) {
      const L = (40 + 20 * Math.sin(V.time * 6)) * (view.scale || 1);
      ctx.beginPath(); V.ops++;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + V.time * 0.4;
        ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); ctx.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
      }
      stroke('rgba(220,235,255,0.55)', 1);
    }
    ctx.lineCap = 'butt';
  }

  // The HUD's two top corners as style.css lays them out, when the page passes no boxes of its own.
  function hudCorners(view) {
    return view.desk ? [{ x: 0, y: 0, w: Math.min(V.w / 2, 480), h: 80 }, { x: V.w - 260, y: 0, w: 260, h: 72 }]
      : [{ x: 0, y: 0, w: Math.min(V.w / 2, 410), h: 72 }, { x: V.w - 200, y: 0, w: 200, h: 62 }];
  }

  // The glare and the flash off at once (the vista's camera cut leaves the ring's view): through setFx, so the next
  // frame that draws the ring writes its own values again.
  function fxOff() {
    V.flash = 0; V.white = 0;
    setFx('glare', 0);
    setFx('flash', 0);
  }

  // The CSS layers: the glare (0.55 × clamp((3 − TTC) ÷ 3, 0, 1)), the HEADLIGHT flash and LIGHT SPEED white-out, the
  // caught flood.
  function fxLayers(you, dt, T) {
    const ttc = you && Number.isFinite(you.ttc) ? you.ttc : 999;
    const glare = you && !you.caught ? T.GLARE_ALPHA * clamp((T.GLARE_IN - ttc) / T.GLARE_IN, 0, 1) : 0;
    setFx('glare', glare * (reduced ? 0.7 : 1));
    const flash = Math.max(V.flash * 0.95 * V.flashK, V.white);
    setFx('flash', flash, 0.7 + 2.6 * (1 - V.flash));
    V.flash = Math.max(0, V.flash - dt * 2.2);
    if (V.white > 0) V.white = V.lsT < 0.2 ? V.white : Math.max(0, V.white - dt * 5);
    if (V.flood > 0) V.flood = Math.min(1, V.flood + dt / 0.5);
    setFx('flood', (reduced ? 0.7 : 1) * smooth(0, 1, V.flood));
  }

  return {
    resize, reset, onEvents, render, fxOff,
    shake: () => ({ x: V.sx, y: V.sy }),
    shown: () => ({ ...shown }),
    state: V,
  };
}

// The card tells a build shows (12.7): CARD[id].tell for each card owned.
export function tellsOf(build = []) {
  const s = new Set();
  for (const b of build || []) { const c = CARD[b.id || b]; if (c && c.tell) s.add(c.tell); }
  return s;
}
