// Ahead of the Light: the HUD, after Null Range's orange vector instruments. Drawn on a 2D canvas each frame:
// a distance tape to Earth across the top, the sector box top left, the light's gap top right, a reticle with
// SPD and ALT arcs round it, BOOST charge and SONAR arcs further out, HULL and SHIELD bars and the burst's rear
// disc at the bottom, brackets on the gates, warnings, and the sector's name when you cross into it.
import { SECTORS, SECTOR_LEN, COURSE_LEN, sectorAt, GATE_R } from '../core/world.js';

const OR = '#ffa31a', YEL = '#ffd21a', CY = '#7fe9ff', RED = '#ff5a3c', WHITE = '#ffffff';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif-condensed, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pad2 = (n) => String(n).padStart(2, '0');

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  const H = { w: 1, h: 1, dpr: 1, banner: null, pops: [], insets: { t: 0, r: 0, b: 0, l: 0 }, drawn: {} };
  function resize(w, h, dpr = 1, insets = H.insets) {
    H.w = w; H.h = h; H.dpr = Math.min(dpr, 2); H.insets = insets;
    canvas.width = Math.round(w * H.dpr); canvas.height = Math.round(h * H.dpr);
  }
  function onEvents(events, run) {
    for (const e of events) {
      if (e.type === 'sector') H.banner = { t0: run.t, sector: e.sector };
      if (e.type === 'grab') H.pops.push({ t0: run.t, text: e.chain > 1 ? `GATE ×${e.chain}` : 'GATE', color: OR });
      if (e.type === 'hit') H.pops.push({ t0: run.t, text: 'IMPACT', color: RED });
      if (e.type === 'shieldPop') H.pops.push({ t0: run.t, text: 'SHIELD DOWN', color: CY });
      if (e.type === 'ping') H.pops.push({ t0: run.t, text: e.marked ? `SONAR · ${e.marked} GATES` : 'SONAR', color: CY });
    }
    if (H.pops.length > 4) H.pops.splice(0, H.pops.length - 4);
  }
  const font = (px, w = 700, fam = COND) => `${w} ${px}px ${fam}`;
  function text(str, x, y, { px = 12, color = OR, align = 'left', base = 'middle', fam = COND, w = 700, alpha = 1 } = {}) {
    ctx.globalAlpha = alpha;
    ctx.font = font(px, w, fam); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
    ctx.fillText(str, x, y);
    ctx.globalAlpha = 1;
    return ctx.measureText(str).width;
  }
  function box(x, y, w, h, color = OR) {
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 1, y + 1, w - 1, h - 1);
  }
  // A row of dots on an arc from a0 to a1 (radians, 0 = right, clockwise on screen), the first n lit.
  function dotArc(cx, cy, r, a0, a1, count, lit, color, size = 2.2) {
    for (let i = 0; i < count; i++) {
      const a = a0 + (a1 - a0) * (i / (count - 1));
      ctx.globalAlpha = i < lit ? 1 : 0.22;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function bars(x, y, w, h, frac, color, segs) {
    const gapPx = 2, sw = (w - gapPx * (segs - 1)) / segs;
    for (let i = 0; i < segs; i++) {
      ctx.globalAlpha = (i + 0.5) / segs <= frac ? 1 : 0.18;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x + i * (sw + gapPx)), y, Math.max(1, Math.floor(sw)), h);
    }
    ctx.globalAlpha = 1;
  }

  // One frame. run: the run; view: render/view.js (for project); opts: { compact, controls } (controls: the touch
  // buttons' boxes, kept clear).
  function draw(run, view, dt, opts = {}) {
    const { w, h } = H;
    const I = H.insets;
    ctx.setTransform(H.dpr, 0, 0, H.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = run.ship, T = run.tune;
    const small = Math.min(w, h) < 520;
    const px = small ? 11 : 13;
    const drawn = {};
    const cx = w / 2, cy = h * (w < h ? 0.42 : 0.47);

    // ---- the tape to Earth ----
    const left = COURSE_LEN - s.d;
    const tw = Math.min(small ? w - 40 : 460, w - (opts.touch ? 136 : 40)), tx = cx - tw / 2, ty = I.t + 14;
    ctx.strokeStyle = OR; ctx.lineWidth = 1;
    const per = small ? 22 : 28;       // px per 100 m
    const first = Math.ceil((s.d - (tw / 2 / per) * 100) / 100) * 100;
    for (let m = first; m <= s.d + (tw / 2 / per) * 100; m += 100) {
      const x = cx + ((m - s.d) / 100) * per;
      if (x < tx || x > tx + tw) continue;
      const major = m % SECTOR_LEN === 0, mid = m % 500 === 0;
      ctx.globalAlpha = 1 - Math.abs(x - cx) / (tw / 2) * 0.7;
      ctx.beginPath(); ctx.moveTo(x + 0.5, ty); ctx.lineTo(x + 0.5, ty + (major ? 14 : mid ? 9 : 5)); ctx.stroke();
      if (major && m > 0 && m <= COURSE_LEN) text(SECTORS[Math.min(SECTORS.length - 1, m / SECTOR_LEN)]?.id.toUpperCase() ?? '', x, ty + 22, { px: 9, fam: MONO, w: 600, align: 'center', alpha: ctx.globalAlpha });
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = OR;
    ctx.beginPath(); ctx.moveTo(cx, ty - 1); ctx.lineTo(cx - 4, ty - 7); ctx.lineTo(cx + 4, ty - 7); ctx.fill();
    text(`${(left / 1000).toFixed(1)} KM TO EARTH`, cx, ty + 36, { px: px - 1, fam: MONO, w: 600, align: 'center' });
    drawn.tape = { x: tx, y: ty - 8, w: tw, h: 50 };

    // ---- the sector box, top left; the light, top right ----
    const sec = sectorAt(s.d);
    const bw = small ? 128 : 190, bh = small ? 44 : 54, by = I.t + (small ? 62 : 16);
    box(I.l + 10, by, bw, bh);
    text(`SECTOR ${pad2(sec + 1)}/${pad2(SECTORS.length)}`, I.l + 18, by + 12, { px: 9, fam: MONO, w: 600 });
    text(SECTORS[sec].name, I.l + 18, by + (small ? 29 : 33), { px: small ? 15 : 20 });
    if (!small) text(`GATES ${run.stats.gates}  ·  CHAIN ×${run.gates.chain}`, I.l + 18, by + 47, { px: 9, fam: MONO, w: 600 });
    drawn.sector = { x: I.l + 10, y: by, w: bw, h: bh };
    const gap = Math.max(0, s.d - run.light.d);
    const secs = gap / Math.max(1, run.light.speed - s.speed + 1e-6);
    const closing = run.light.speed > s.speed;
    const danger = gap < T.WARN_GAP;
    const rx = w - I.r - 10 - bw;
    box(rx, by, bw, bh, danger ? RED : OR);
    text('BURST BEHIND', rx + 8, by + 12, { px: 9, fam: MONO, w: 600, color: danger ? RED : OR });
    text(`${Math.round(gap)} M`, rx + 8, by + (small ? 29 : 33), { px: small ? 15 : 20, color: danger ? RED : OR });
    if (!small) text(closing ? `CLOSING · ${secs < 99 ? secs.toFixed(1) : '99+'} S` : 'OPENING', rx + 8, by + 47, { px: 9, fam: MONO, w: 600, color: danger ? RED : OR });
    drawn.light = { x: rx, y: by, w: bw, h: bh };

    // ---- the reticle, SPD and ALT ----
    const R = Math.min(w, h) * (small ? 0.16 : 0.13);
    ctx.strokeStyle = OR; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke();
    for (const a of [0.25, 0.75, 1.25, 1.75]) {
      const c = Math.cos(a * Math.PI), sn = Math.sin(a * Math.PI);
      ctx.beginPath(); ctx.moveTo(cx + c * 11, cy + sn * 11); ctx.lineTo(cx + c * 22, cy + sn * 22); ctx.stroke();
    }
    // where you are heading: a small mark led by your strafe and climb
    const vxp = clamp(s.vx / 60, -1, 1) * R * 0.7, vyp = clamp(-s.vy / 40, -1, 1) * R * 0.7;
    ctx.beginPath(); ctx.arc(cx + vxp, cy + vyp, 3, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 0.82, Math.PI * 1.18); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI * 0.18, Math.PI * 0.18); ctx.stroke();
    const spdK = clamp((s.speed - 40) / 120, 0, 1);
    dotArc(cx, cy, R - 7, Math.PI * 1.18, Math.PI * 0.82, 12, Math.round(spdK * 12), OR, 1.6);
    text(s.speed.toFixed(0), cx - R - 6, cy - R * 0.62, { px: px + 1, align: 'right' });
    text('SPD', cx - R, cy + R * 0.66, { px: 9, fam: MONO, w: 600, align: 'center' });
    const alt = Math.max(0, s.alt);
    text(alt.toFixed(1), cx + R + 6, cy - R * 0.62, { px: px + 1, color: alt < T.SKIM ? YEL : OR });
    text('ALT', cx + R, cy + R * 0.66, { px: 9, fam: MONO, w: 600, align: 'center' });
    if (alt < T.SKIM) text('SKIM', cx + R + 6, cy - R * 0.62 + 14, { px: 9, fam: MONO, w: 600, color: YEL });

    // ---- BOOST and SONAR arcs ----
    const R2 = R * (small ? 1.75 : 2.1);
    const chg = Math.round(s.charge * 18);
    dotArc(cx, cy, R2, Math.PI * 1.3, Math.PI * 0.7, 18, chg, s.boosting ? YEL : OR, small ? 2 : 2.5);
    text(s.boosting ? 'BOOST ▲' : 'BOOST', cx - R2 * 0.82, cy + R2 * 0.66, { px: 9, fam: MONO, w: 600, align: 'center', color: s.boosting ? YEL : OR });
    const ready = run.ping.cool <= 0;
    const pingK = 1 - run.ping.cool / T.PING_COOL;
    dotArc(cx, cy, R2, -Math.PI * 0.3, Math.PI * 0.3, 12, Math.round(pingK * 12), CY, small ? 2 : 2.5);
    text(ready ? 'SONAR READY' : 'SONAR', cx + R2 * 0.82, cy + R2 * 0.66, { px: 9, fam: MONO, w: 600, align: 'center', color: CY });
    drawn.arcs = { x: cx - R2 - 4, y: cy - R2 - 4, w: R2 * 2 + 8, h: R2 * 2 + 8 };

    // ---- HULL, SHIELD and the burst's disc, at the bottom ----
    const bwid = Math.min(small ? (w - 100) / 2 - 16 : 120, 140), bbH = small ? 10 : 14;
    const bb = h - I.b - (opts.controlsBottom ? opts.controlsBottom : 0) - (small ? 26 : 34);
    const discR = small ? 18 : 26;
    bars(cx - discR - 10 - bwid, bb, bwid, bbH, s.hull / 100, s.hull < 35 ? RED : YEL, small ? 10 : 14);
    text(`HULL: ${Math.round(s.hull)}%`, cx - discR - 10 - bwid / 2, bb + bbH + 9, { px: 9, fam: MONO, w: 600, align: 'center', color: YEL });
    bars(cx + discR + 10, bb, bwid, bbH, s.shield / 100, CY, small ? 10 : 14);
    text(`SHIELD: ${Math.round(s.shield)}%`, cx + discR + 10 + bwid / 2, bb + bbH + 9, { px: 9, fam: MONO, w: 600, align: 'center', color: CY });
    const near = clamp(1 - gap / (T.START_GAP * 1.2), 0, 1);
    const dy = bb + bbH / 2;
    for (let i = 1; i <= 4; i++) {
      ctx.strokeStyle = OR; ctx.globalAlpha = 0.25 + 0.15 * i; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, dy, discR * i / 4, discR * 0.62 * i / 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 0.25 + 0.75 * near; ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.ellipse(cx, dy, discR * near, discR * 0.62 * near, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    drawn.bars = { x: cx - discR - 10 - bwid, y: bb, w: 2 * (discR + 10 + bwid), h: bbH + 16 };

    // ---- gate brackets ----
    for (let i = run.gates.i, shown = 0; i < run.gates.i + 6 && shown < 3; i++) {
      const g = run.world.gate(i);
      if (!g) continue;
      const ahead = g.d - s.d;
      if (ahead > 800) break;
      const marked = run.marks.has(i);
      if (!marked && ahead > 260) continue;
      const p = view.project(g.x, g.y, g.d);
      if (!p.on) continue;
      shown++;
      const q = view.project(g.x + GATE_R, g.y, g.d);
      const r = clamp(Math.abs(q.x - p.x) * 1.25, 6, 140);
      const k = r * 0.35;
      ctx.strokeStyle = marked ? OR : 'rgba(255,163,26,0.6)'; ctx.lineWidth = 1.4;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(p.x + sx * r, p.y + sy * (r - k)); ctx.lineTo(p.x + sx * r, p.y + sy * r); ctx.lineTo(p.x + sx * (r - k), p.y + sy * r);
        ctx.stroke();
      }
      if (marked) text(`${Math.round(ahead)}`, p.x + r + 4, p.y - r, { px: 9, fam: MONO, w: 600 });
    }

    // ---- warnings, pops and the sector banner ----
    let warn = null;
    if (run.mode === 'fly') {
      if (s.exposed) warn = ['EXPOSED · DIVE', RED];
      else if (danger) warn = ['BURST CLOSING · BOOST', RED];
      else if (s.vy < -8 && s.alt < 10) warn = ['PULL UP', YEL];
    }
    if (warn && Math.floor(run.t * 3) % 2 === 0) text(warn[0], cx, cy + R + (small ? 34 : 44), { px: px + 5, align: 'center', color: warn[1] });
    drawn.warn = warn ? warn[0] : null;
    let py = cy - R - (small ? 30 : 40);
    for (let i = H.pops.length - 1; i >= 0; i--) {
      const p = H.pops[i], age = run.t - p.t0;
      if (age > 1.1 || age < 0) { H.pops.splice(i, 1); continue; }
      text(p.text, cx, py - age * 16, { px: px + 2, align: 'center', color: p.color, alpha: 1 - age / 1.1 });
      py -= 18;
    }
    if (H.banner) {
      const age = run.t - H.banner.t0;
      if (age > 3 || age < 0) H.banner = null;
      else {
        const a = Math.min(1, age * 3) * (1 - clamp((age - 2.2) / 0.8, 0, 1));
        const by2 = h * 0.24;
        text(`SECTOR ${pad2(H.banner.sector + 1)}`, cx, by2 - (small ? 18 : 26), { px: 10, fam: MONO, w: 600, align: 'center', alpha: a });
        text(SECTORS[H.banner.sector].name, cx, by2, { px: small ? 30 : 46, align: 'center', alpha: a });
        drawn.banner = SECTORS[H.banner.sector].name;
      }
    }
    H.drawn = drawn;
    return drawn;
  }
  function clear() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); H.pops = []; H.banner = null; }
  return { resize, draw, onEvents, clear, state: H };
}
