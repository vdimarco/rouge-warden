// Ahead of the Light: the view, drawn in characters with ascii.rest (vendor/ascii-rest, MIT, by bas3line). The game
// is one ascii.rest piece sized to the window: each frame lights a grid of cells, then picks a character by how bright
// a cell is (the library's ramp) and a colour by its place on the spectrum. What it draws:
//  - the library's galaxy piece far ahead, the way home;
//  - the starbow: at the edge of light speed the stars crowd ahead and turn blue, a ring of colour stands round the way
//    ahead, and the sky at the edges reddens;
//  - stars streaming past as streaks, and the stars in your path as bright discs with flares (the ones you would hit
//    get red brackets);
//  - spectral rings to fly through, your ship from behind, and the HUD as lines of text.
// The page calls show(run) with the state to draw; mount() plays the piece at its own frame rate.
import { mount } from '../vendor/ascii-rest/mount.js';
import galaxyPiece, { meta as galaxyMeta } from '../vendor/ascii-rest/galaxy.js';
import { banner } from '../vendor/ascii-rest/banner.js';
import { SECTORS, sectorAt, COURSE_LEN, RING_R, SHIP_R } from '../core/world.js';
import { gapOf, betaOf, progressOf } from '../core/flight.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const RAMP = ' .·:-=+*#%@';
// The spectrum, red to violet, in seven hues; each hue in eight levels; then white in four, and the HUD's inks.
const HUES = [[255, 59, 59], [255, 150, 50], [255, 238, 90], [91, 255, 154], [79, 214, 255], [96, 120, 255], [200, 100, 255]];
const LEVELS = 8;
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const PALETTE = [];
for (const [r, g, b] of HUES) for (let l = 0; l < LEVELS; l++) {
  const k = 0.25 + 0.75 * (l / (LEVELS - 1)), w = l >= LEVELS - 2 ? (l - LEVELS + 3) * 0.25 : 0;
  PALETTE.push(hex((r * (1 - w) + 255 * w) * k, (g * (1 - w) + 255 * w) * k, (b * (1 - w) + 255 * w) * k));
}
const WHITE0 = PALETTE.length;              // 56..59: white, dim to full
for (const k of [0.35, 0.55, 0.8, 1]) PALETTE.push(hex(255 * k, 255 * k, 255 * k));
const INK = { text: WHITE0 + 3, dim: WHITE0 + 1, alert: PALETTE.push('#ff5a4a') - 1, gold: PALETTE.push('#ffd27a') - 1,
  goldHot: PALETTE.push('#fff1b8') - 1, goldDim: PALETTE.push('#a8781e') - 1 };
export { PALETTE, HUES };

// The first runs' tips: [from s, to s, lines]. Short lines, so they fit a phone.
const TIPS = (touch) => [
  [1, 5.5, [touch ? 'DRAG TO STEER' : 'STEER  A D W S  OR  ARROWS', 'you fly through a tube of stars']],
  [5.5, 11, ['FLY THROUGH THE GOLD RINGS', 'each one speeds you up']],
  [11, 16.5, ['DODGE THE STARS', 'red [ ] = you will hit it']],
  [16.5, 22, ['SKIM PAST A STAR TO CHARGE', touch ? 'then HOLD BOOST' : 'then HOLD SHIFT TO BOOST']],
  [22, 28, ["THE BURST'S LIGHT IS BEHIND YOU", 'top right: keep the gap open']],
];
const hueIndex = (h) => clamp(Math.round(clamp(h, 0, 1) * (HUES.length - 1)), 0, HUES.length - 1);
const CODE = (s) => s.charCodeAt(0);

// host: the canvas to draw on. Returns { show, resize, onEvents, stop, grid }.
export function createAsciiView({ canvas, reduced = false, touch = false } = {}) {
  const V = {
    cols: 0, rows: 0, lum: null, hue: null, hw: null, ch: null, ci: null, stop: null, run: null, title: false,
    flash: 0, shake: 0, pops: [], banner: null, tips: false, last: performance.now(), t: 0, streaks: [], drawn: {}, ms: [],
  };
  const gal = galaxyPiece();
  const GC = galaxyMeta.cols, GR = galaxyMeta.rows;
  const galLum = new Float32Array(GC * GR);
  const bannerCache = new Map();

  // the streaking stars: a tube round the way ahead, seen from the ship
  let sr = 9;
  const rnd = () => { sr = (Math.imul(sr, 1664525) + 1013904223) >>> 0; return sr / 4294967296; };
  function seedStreaks(n) {
    V.streaks = Array.from({ length: n }, () => { const a = rnd() * 6.283, r = 2 + Math.sqrt(rnd()) * 60; return { x: Math.cos(a) * r, y: Math.sin(a) * r, z: 1 + rnd() * 320 }; });
  }

  function piece() {
    return {
      meta: { name: 'ahead of the light', category: 'space', note: 'a run home at the edge of light speed', cols: V.cols, rows: V.rows,
        fps: 40, palette: PALETTE, ground: '#000000', cell: 2 },
      default: () => frame,
    };
  }
  // The grid for this window: cells about 8 px wide on a computer and 7 on a phone, twice as tall.
  function resize() {
    const w = innerWidth, h = innerHeight;
    const cw = w < 600 ? 7 : 8;
    const cols = Math.max(40, Math.floor(w / cw));
    const rows = Math.max(24, Math.floor(h / ((w / cols) * 2)));
    if (cols === V.cols && rows === V.rows) return;
    V.cols = cols; V.rows = rows;
    const n = cols * rows;
    V.lum = new Float32Array(n); V.hue = new Float32Array(n); V.hw = new Float32Array(n);
    V.ch = new Uint16Array(n); V.ci = new Int16Array(n);
    seedStreaks(w < 600 ? 150 : 240);
    if (V.stop) V.stop();
    canvas.style.width = '100%';
    V.stop = mount(canvas, piece(), { fps: 40, motion: true });
    canvas.style.top = `${Math.max(0, (h - (w * rows * 2) / cols) / 2)}px`;
  }

  // ---- drawing into the grid ----
  function light(c, r, l, h = -1) {
    if (c < 0 || r < 0 || c >= V.cols || r >= V.rows) return;
    const k = (r | 0) * V.cols + (c | 0);
    V.lum[k] += l;
    if (h >= 0) { V.hue[k] += h * l; V.hw[k] += l; }
  }
  function put(c, r, str, ink = INK.text) {
    c |= 0; r |= 0;
    if (r < 0 || r >= V.rows) return;
    for (let i = 0; i < str.length; i++) {
      const x = c + i;
      if (x < 0 || x >= V.cols) continue;
      const k = r * V.cols + x;
      V.ch[k] = str.charCodeAt(i); V.ci[k] = ink;
    }
  }
  function mark(c, r, chr, ink) { put(c, r, chr, ink); }
  function line(c0, r0, c1, r1, l, h) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0))));
    if (n > 200) return;
    for (let i = 0; i <= n; i++) { const f = i / n; light(c0 + (c1 - c0) * f, r0 + (r1 - r0) * f, l * (0.35 + 0.65 * f), h); }
  }
  // The starbow's colour at a cell: violet-blue ahead, through the ring's rainbow, red at the edges.
  function bowHue(dc, dr, R) {
    const rr = Math.hypot(dc, dr * 2) / R;
    return clamp(1.02 - rr * 1.05, 0, 1);
  }

  function frame(t, env) {
    const now = performance.now();
    const text = draw(env);
    V.ms.push(performance.now() - now);
    if (V.ms.length > 240) V.ms.shift();
    return text;
  }
  function draw(env) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - V.last) / 1000);
    V.last = now;
    V.t += dt;
    const { cols, rows } = V, n = cols * rows;
    V.lum.fill(0); V.hue.fill(0); V.hw.fill(0); V.ch.fill(0); V.ci.fill(-1);
    const run = V.run;
    const ship = run ? run.ship : { x: 0, y: 0, d: 0, speed: 60, vx: 0, vy: 0, boosting: false };
    // the camera rides a little behind and above the ship; the way ahead is high in the frame
    const cx = cols / 2 + (V.shake ? (Math.random() - 0.5) * V.shake * 3 : 0);
    const cy = rows * (V.title ? 0.42 : 0.4) + (V.shake ? (Math.random() - 0.5) * V.shake * 1.5 : 0);
    const F = Math.min(cols, rows * 2) * 0.9;    // focal length in columns
    const R = Math.min(cols, rows * 2) * 0.5;
    const BACK = 7, UP = 1.7;
    const proj = (x, y, z) => ({ c: cx + (x / z) * F, r: cy - ((y / z) * F) / 2, s: F / z });

    // Characters are written back to front (galaxy, tunnel, streaks, stars far to near, rings, ship): a nearer
    // thing simply overwrites a farther one, so the frame stays crisp with no haze of half-lit cells.
    const ink = (h, l) => hueIndex(h) * LEVELS + clamp(Math.round(l), 0, LEVELS - 1);
    // the galaxy ahead: the library's piece in its own characters, dim, bigger as home nears
    const g = gal(V.t * 0.6).split('\n');
    const home = run ? progressOf(run) : 0.15;
    const gw = Math.min(cols * 0.75, R * (0.9 + 0.5 * home)), gh = (gw / GC) * GR * 0.5;
    const g0c = cx - gw / 2 - ship.x * 0.3, g0r = cy - gh * 0.55 + ship.y * 0.15;
    for (let r = Math.max(0, Math.floor(g0r)); r < Math.min(rows, g0r + gh); r++) {
      for (let c = Math.max(0, Math.floor(g0c)); c < Math.min(cols, g0c + gw); c++) {
        const gc = Math.floor(((c - g0c) / gw) * GC), gr = Math.floor(((r - g0r) / gh) * GR);
        const chr = g[gr]?.[gc] ?? ' ';
        const k = RAMP.indexOf(chr);
        if (k >= 3) mark(c, r, chr, ink(0.85, 0.5 + k * 0.45));
      }
    }
    // the tube: its rings every 40 m coming at you, and eight lines along its wall to the vanishing point
    const STEP = 40;
    for (let j = 0; j < 8; j++) {
      const dd = Math.floor(ship.d / STEP) * STEP + j * STEP;
      const z = dd - ship.d + BACK;
      if (z < 3) continue;
      const p = proj(-ship.x, -ship.y - UP, z), rc = 15 * p.s;
      const near = clamp(1 - z / 320, 0, 1);
      const steps = Math.round(clamp(rc * 3.2, 24, 320));
      const chr = near > 0.85 ? ':' : near > 0.6 ? '.' : '·';
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        mark(p.c + Math.cos(a) * rc, p.r + (Math.sin(a) * rc) / 2, chr, ink(0.7, 2 + 5 * near));
      }
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8, wx = Math.cos(a) * 15 - ship.x, wy = Math.sin(a) * 15 - ship.y - UP;
      for (let z = 6; z < 420; z *= 1.09) {
        const p = proj(wx, wy, z);
        mark(p.c, p.r, '.', ink(0.7, 1 + 3.5 * clamp(1 - z / 420, 0, 1)));
      }
    }
    // the streaks: lines along their own direction, blue near the middle and red at the edges, a bright head
    const v = (ship.speed || 60) * (ship.boosting ? 1.5 : 1) * 3.2;
    const tail = reduced ? 0.02 : 0.05 + (ship.boosting ? 0.03 : 0);
    for (const s of V.streaks) {
      s.z -= v * dt;
      if (s.z < 1) { s.z += 320; const a = rnd() * 6.283, rr = 2 + Math.sqrt(rnd()) * 60; s.x = Math.cos(a) * rr; s.y = Math.sin(a) * rr; }
      const x = s.x - ship.x * 0.6, y = s.y - ship.y * 0.6;
      const a = proj(x, y, s.z), b = proj(x, y, s.z + v * tail);
      if (a.c < -4 || a.c > cols + 4 || a.r < -4 || a.r > rows + 4) continue;
      const near = 1 - s.z / 320;
      const h = bowHue(a.c - cx, a.r - cy, R);
      const dx = a.c - b.c, dy = (a.r - b.r) * 2;
      const chr = Math.abs(dx) > 2.4 * Math.abs(dy) ? '-' : Math.abs(dy) > 2.4 * Math.abs(dx) ? '|' : dx * dy > 0 ? '\\' : '/';
      const len = Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
      if (len >= 1 && len < 120) for (let i = 0; i < len; i++) { const f = i / len; mark(b.c + (a.c - b.c) * f, b.r + (a.r - b.r) * f, chr, ink(h, 1 + 4 * near * f)); }
      mark(a.c, a.r, near > 0.7 ? '*' : near > 0.35 ? '+' : '.', ink(h, 3 + 4 * near));
    }
    // the stars in your path, far to near: lit balls, shaded from the upper left so they read as round
    const drawn = { stars: 0, threats: 0, rings: 0 };
    const SHADE = '.:-=+*#%@';
    const LX = -0.42, LY = -0.5, LZ = 0.76;
    if (run) {
      const list = run.world.starsBetween(ship.d - BACK + 2, ship.d + 520).sort((p, q) => q.d - p.d);
      for (const st of list) {
        const z = st.d - ship.d + BACK;
        if (z < 1.2) continue;
        const p = proj(st.x - ship.x, st.y - ship.y - UP, z);
        // far stars are drawn a little larger so they read; from 60 m in, at their true size
        const rc = st.r * p.s * (1 + 0.9 * clamp((z - 60) / 200, 0, 1));
        if (p.c < -rc - 4 || p.c > cols + rc + 4 || p.r < -rc / 2 - 4 || p.r > rows + rc / 2 + 4) continue;
        const fade = clamp((520 - (st.d - ship.d)) / 160, 0, 1);
        drawn.stars++;
        if (rc < 0.7) {
          mark(p.c, p.r, rc < 0.3 ? '·' : rc < 0.5 ? '+' : '*', ink(st.hue, 2 + 5 * fade));
          continue;
        }
        // a short flare across a big, close star, behind its ball
        if (rc > 2) {
          const len = Math.min(cols / 2, rc * 2.6);
          for (let i = Math.ceil(rc); i < len; i++) { const lv = 2 + 3 * (1 - i / len); mark(p.c + i, p.r, '-', ink(st.hue, lv)); mark(p.c - i, p.r, '-', ink(st.hue, lv)); }
          for (let i = Math.ceil(rc / 2); i < len / 3; i++) { const lv = 2 + 3 * (1 - (i * 3) / len); mark(p.c, p.r + i, '|', ink(st.hue, lv)); mark(p.c, p.r - i, '|', ink(st.hue, lv)); }
        }
        for (let r = Math.floor(p.r - rc / 2); r <= p.r + rc / 2; r++) for (let c = Math.floor(p.c - rc); c <= p.c + rc; c++) {
          const nx = (c + 0.5 - p.c) / rc, ny = ((r + 0.5 - p.r) * 2) / rc, q = nx * nx + ny * ny;
          if (q > 1) continue;
          const nz = Math.sqrt(1 - q);
          const b = clamp(nx * LX + ny * LY + nz * LZ, 0, 1);
          const lit = 0.12 + 0.88 * b;
          const chr = q > 0.86 ? (b > 0.3 ? 'o' : '.') : SHADE[Math.min(SHADE.length - 1, Math.floor(lit * SHADE.length))];
          mark(c, r, chr, b > 0.92 ? WHITE0 + 3 : ink(st.hue, (1 + 6.5 * lit) * (0.5 + 0.5 * fade)));
        }
        // one you would hit soon gets red brackets
        const ahead = st.d - ship.d, off = Math.hypot(ship.x - st.x, ship.y - st.y) - st.r - SHIP_R;
        if (ahead > 0 && ahead < ship.speed * 1.1 && off < 0.4) {
          const w = Math.max(2, rc + 1);
          mark(p.c - w - 1, p.r, '[', INK.alert); mark(p.c + w + 1, p.r, ']', INK.alert);
          drawn.threats++;
        }
      }
      // the rings: solid glowing gold, your target. The next one pulses and wears +SPEED; far ones get ( ) so they
      // stand out; when the next one is off screen an arrow at the edge points to it.
      let next = null;
      for (let i = run.rings.i; i < run.rings.i + 4; i++) {
        const gr = run.world.ring(i);
        if (!gr) continue;
        const z = gr.d - ship.d + BACK;
        if (z < 1.5 || gr.d - ship.d > 600) continue;
        const p = proj(gr.x - ship.x, gr.y - ship.y - UP, z), rc = RING_R * p.s;
        const first = !next;
        if (first) next = { p, rc, z, gr };
        const pulse = first && Math.floor(V.t * 5) % 2 === 0;
        const steps = Math.max(14, Math.min(200, Math.round(rc * 7)));
        const chr = rc > 6 ? 'O' : rc > 2.5 ? 'o' : '·';
        for (let k = 0; k < steps; k++) {
          const a = (k / steps) * Math.PI * 2;
          mark(p.c + Math.cos(a) * rc, p.r + (Math.sin(a) * rc) / 2, chr, first ? (pulse ? INK.goldHot : INK.gold) : INK.gold);
          if (rc > 3) mark(p.c + Math.cos(a) * rc * 0.82, p.r + (Math.sin(a) * rc * 0.82) / 2, '·', INK.goldDim);
        }
        if (rc < 2.2) { mark(p.c - 2, p.r, '(', INK.gold); mark(p.c + 2, p.r, ')', INK.gold); }
        if (first && rc > 1 && gr.d - ship.d < 320) {
          const tag = '+SPEED';
          for (let j = 0; j < tag.length; j++) mark(p.c - 3 + j, p.r - rc / 2 - 1.2, tag[j], INK.goldHot);
        }
        drawn.rings++;
      }
      if (next) {
        const { p } = next;
        const inside = p.c >= 1 && p.c <= cols - 2 && p.r >= 5 && p.r <= rows - 2;
        drawn.nextRing = { c: Math.round(p.c), r: Math.round(p.r), inside };
        if (!inside) {
          const ec = clamp(p.c, 1, cols - 2), er = clamp(p.r, 5, rows - 2);
          const dx = p.c - cx, dy = (p.r - cy) * 2;
          const arrow = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '>' : '<') : dy > 0 ? 'v' : '^';
          const blink = Math.floor(V.t * 4) % 2 === 0 ? INK.goldHot : INK.gold;
          mark(ec, er, arrow, blink);
          const lab = 'RING';
          const lc = clamp(ec - (dx > 0 ? lab.length + 1 : -2), 0, cols - lab.length);
          for (let j = 0; j < lab.length; j++) mark(lc + j, er, lab[j], blink);
          drawn.arrow = arrow;
        }
      }
      // the ship, from behind: it sits where the camera sees it, banked into a turn
      const sp = proj(0, -UP, BACK);
      const bank = clamp(ship.vx / 20, -1, 1);
      const art = Math.abs(bank) < 0.35 ? ['   /\\   ', '  /##\\  ', ' /#/\\#\\ ', '<_/  \\_>'] : bank > 0 ? ['    /\\  ', '  _/##\\ ', ' /#/\\#\\>', '<_/  \\/ '] : ['  /\\    ', ' /##\\_  ', '</#/\\#\\ ', ' \\/  \\_>'];
      const sc = Math.round(sp.c - 4), srow = Math.round(sp.r - 2);
      for (let i = 0; i < art.length; i++) for (let j = 0; j < art[i].length; j++) if (art[i][j] !== ' ') mark(sc + j, srow + i, art[i][j], run.ship.hurtAt > run.t - 0.4 ? INK.alert : INK.text);
      const fl = ship.boosting ? '*+*' : '+·+';
      mark(sc + 2, srow + art.length, fl[Math.floor(V.t * 20) % 3], hueIndex(0.75) * LEVELS + 7);
      mark(sc + 5, srow + art.length, fl[(Math.floor(V.t * 20) + 1) % 3], hueIndex(0.75) * LEVELS + 7);
      drawn.ship = { c: sc, r: srow };
    }
    // the burst behind: the frame's edges whiten as it closes
    const gap = run ? gapOf(run) : 999;
    const white = run ? clamp(1 - gap / 220, 0, 1) : 0;
    if (white > 0) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const e = Math.max(Math.abs(c - cols / 2) / (cols / 2), Math.abs(r - rows / 2) / (rows / 2));
      if (e > 0.7) light(c, r, (e - 0.7) * 3 * white, -1);
    }
    V.flash = Math.max(0, V.flash - dt * 2.5);
    V.shake = Math.max(0, V.shake - dt * 3);
    // ---- to characters ----
    const color = env && env.color;
    const out = new Array(n);
    for (let k = 0; k < n; k++) {
      if (V.ch[k]) { out[k] = String.fromCharCode(V.ch[k]); if (color) color[k] = V.ci[k]; continue; }
      const l = 1 - Math.exp(-1.6 * (V.lum[k] + V.flash));
      const idx = Math.min(RAMP.length - 1, Math.floor(l * RAMP.length));
      out[k] = RAMP[idx];
      if (color) {
        const lvl = clamp(Math.floor(l * LEVELS), 0, LEVELS - 1);
        color[k] = V.hw[k] > V.lum[k] * 0.35 && V.flash < 0.3 ? hueIndex(V.hue[k] / V.hw[k]) * LEVELS + lvl : WHITE0 + clamp(Math.floor(l * 4), 0, 3);
      }
    }
    if (run && !V.title) hud(run, out, color, drawn);
    V.drawn = drawn;
    const lines = [];
    for (let r = 0; r < rows; r++) lines.push(out.slice(r * cols, (r + 1) * cols).join(''));
    return lines.join('\n');
  }

  // ---- the HUD: lines of text across the top, popups, and the sector's name in block letters ----
  function text(out, color, c, r, str, ink) {
    c |= 0;
    if (r < 0 || r >= V.rows) return;
    for (let i = 0; i < str.length; i++) {
      const x = c + i;
      if (x < 0 || x >= V.cols) continue;
      const k = r * V.cols + x;
      out[k] = str[i];
      if (color) color[k] = typeof ink === 'function' ? ink(i) : ink;
    }
  }
  const pad = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
  const bar = (frac, n, on = '█', off = '░') => on.repeat(Math.round(clamp(frac, 0, 1) * n)) + off.repeat(n - Math.round(clamp(frac, 0, 1) * n));
  function hud(run, out, color, drawn) {
    const { cols } = V, s = run.ship, T = run.tune;
    const small = cols < 70;
    const sec = sectorAt(s.d);
    const gap = Math.max(0, gapOf(run)), danger = gap < T.WARN_GAP;
    const beta = Math.min(0.9999999, betaOf(run)).toFixed(7) + 'c';
    const left = ` ${String(sec + 1).padStart(2, '0')}/08 ${SECTORS[sec].name}`;
    const right = `BURST ${Math.round(gap)} LY `;
    text(out, color, 0, 0, left, INK.text);
    text(out, color, cols - right.length, 0, right, danger && Math.floor(V.t * 3) % 2 === 0 ? INK.alert : danger ? INK.alert : INK.dim);
    text(out, color, 1, 1, beta, INK.dim);
    // the chase: the burst, the gap, and you
    const mw = Math.max(8, Math.min(30, cols - 34));
    const fill = Math.round(clamp(gap / T.START_GAP, 0, 1) * mw);
    const meter = 'BURST ●' + '─'.repeat(fill) + '▶ YOU';
    text(out, color, cols - meter.length - 1, 1, meter, (i) => (i < 6 ? INK.alert : i === 6 ? INK.text : i === meter.length - 5 ? INK.gold : danger ? INK.alert : INK.dim));
    drawn.chase = fill;
    // hull, shield, boost
    const nb = small ? 6 : 10;
    const parts = [['HULL ', bar(s.hull / 100, nb), s.hull < 35 ? INK.alert : INK.gold], [' SHLD ', bar(s.shield / 100, nb, '▓', '░'), hueIndex(0.7) * LEVELS + 7],
      [' BOOST ', bar(s.charge, nb, '■', '□'), s.boosting ? hueIndex(0.4) * LEVELS + 7 : INK.text]];
    let line3 = '';
    for (const p of parts) line3 += p[0] + p[1];
    let c = Math.max(1, Math.floor((cols - line3.length) / 2));
    for (const [lab, b, ink] of parts) { text(out, color, c, 2, lab, INK.dim); c += lab.length; text(out, color, c, 2, b, ink); c += b.length; }
    // the way home: a spectral line with you on it
    const pw = cols - 14, pf = progressOf(run);
    const km = `${((COURSE_LEN - s.d) / 1000).toFixed(1)} KM`;
    text(out, color, 1, 3, '─'.repeat(pw), (i) => hueIndex(i / pw) * LEVELS + (i / pw < pf ? 7 : 2));
    text(out, color, 1 + Math.round(pf * (pw - 1)), 3, '●', INK.text);
    text(out, color, pw + 2, 3, pad(km, 11), INK.dim);
    // popups over the ship
    const pr = Math.round(V.rows * 0.62);
    for (let i = V.pops.length - 1, k = 0; i >= 0; i--) {
      const p = V.pops[i], age = run.t - p.t0;
      if (age > 1.1 || age < 0) { V.pops.splice(i, 1); continue; }
      text(out, color, Math.round(cols / 2 - p.text.length / 2), pr - k - Math.floor(age * 3), p.text, p.ink);
      k += 1;
    }
    // the first run's tips, one line at a time
    const tip = V.tips ? TIPS(touch).find(([t0, t1]) => run.t >= t0 && run.t < t1) : null;
    if (tip) {
      const lines = tip[2];
      for (let i = 0; i < lines.length; i++) text(out, color, Math.round(cols / 2 - lines[i].length / 2), Math.round(V.rows * 0.72) + i, lines[i], i ? INK.dim : INK.goldHot);
      drawn.tip = lines[0];
    }
    // warnings
    if (!tip && danger && Math.floor(V.t * 3) % 2 === 0) { const w = cols < 60 ? '!! LIGHT CLOSING · BOOST !!' : '!! THE LIGHT IS CLOSING · GRAB RINGS · BOOST !!'; text(out, color, Math.round(cols / 2 - w.length / 2), Math.round(V.rows * 0.7), w, INK.alert); }
    // the sector's name in the library's block letters
    if (V.banner) {
      const age = run.t - V.banner.t0;
      if (age > 2.6 || age < 0) V.banner = null;
      else {
        const art = blockText(SECTORS[V.banner.sector].name, cols - 2);
        const top = Math.round(V.rows * 0.16);
        const shown = Math.min(art.length, Math.ceil(age * 18));
        for (let i = 0; i < art.length; i++) {
          const row = art[i];
          const c0 = Math.round((cols - row.length) / 2);
          text(out, color, c0, top + i, row.slice(0, shown * 4), (j) => (row[j] === ' ' ? INK.dim : row[j] === '█' || row[j] === '▓' ? hueIndex((j / row.length + V.t * 0.2) % 1) * LEVELS + 7 : INK.dim));
        }
        text(out, color, Math.round(cols / 2 - 5), top - 1, `SECTOR ${String(V.banner.sector + 1).padStart(2, '0')}`, INK.dim);
        drawn.banner = SECTORS[V.banner.sector].name;
      }
    }
  }
  // A name in ascii.rest's block letters, cut to fit: two lines if one is too wide, or plain capitals.
  function blockText(name, width) {
    const key = `${name}|${width}`;
    if (bannerCache.has(key)) return bannerCache.get(key);
    const tryOne = (s, pixel) => { try { const p = banner(s, { effect: 'still', pixel }); return p.default()(0).split('\n'); } catch (e) { return null; } };
    let art = null;
    for (const px of [2, 1]) { const a = tryOne(name, px); if (a && a[0].length <= width) { art = a; break; } }
    if (!art) {
      const words = name.split(' '), half = Math.ceil(words.length / 2);
      const a = tryOne(words.slice(0, half).join(' '), 1), b = words.length > 1 ? tryOne(words.slice(half).join(' '), 1) : null;
      if (a && a[0].length <= width && (!b || b[0].length <= width)) art = b ? [...a, '', ...b] : a;
    }
    if (!art) art = [name];
    bannerCache.set(key, art);
    return art;
  }

  function onEvents(events, run) {
    for (const e of events) {
      if (e.type === 'hit') { V.shake = reduced ? 0.2 : 1; V.flash = Math.max(V.flash, reduced ? 0.15 : 0.5); V.pops.push({ t0: run.t, text: 'IMPACT', ink: INK.alert }); }
      if (e.type === 'grab') { V.flash = Math.max(V.flash, reduced ? 0.05 : 0.15); V.pops.push({ t0: run.t, text: e.chain > 1 ? `RING ×${e.chain}` : 'RING', ink: hueIndex(0.55) * LEVELS + 7 }); }
      if (e.type === 'graze' || e.type === 'hair') V.pops.push({ t0: run.t, text: e.type === 'hair' ? 'HAIRLINE' : 'SKIM', ink: INK.gold });
      if (e.type === 'shieldPop') V.pops.push({ t0: run.t, text: 'SHIELD DOWN', ink: hueIndex(0.7) * LEVELS + 7 });
      if (e.type === 'sector') V.banner = { t0: run.t, sector: e.sector };
      if (e.type === 'caught' || e.type === 'wreck') V.flash = 1.5;
    }
    if (V.pops.length > 3) V.pops.splice(0, V.pops.length - 3);
  }
  resize();
  return {
    show(run, { title = false } = {}) { V.run = run; V.title = title; },
    resize, onEvents,
    clear() { V.pops = []; V.banner = null; V.flash = 0; V.shake = 0; },
    stop() { if (V.stop) V.stop(); },
    get drawn() { return V.drawn; },
    get grid() { return { cols: V.cols, rows: V.rows }; },
    drawMs() { const a = [...V.ms].sort((x, y) => x - y); return a.length ? { p50: a[a.length >> 1], p95: a[Math.floor(a.length * 0.95)] } : null; },
    sectorBanner(sector, run) { V.banner = { t0: run.t, sector }; },
    tips(on) { V.tips = Boolean(on); },
  };
}
