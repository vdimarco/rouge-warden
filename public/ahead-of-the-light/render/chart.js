// Ahead of the Light: the star chart (final.md 11.3, 16) in the video's style: a ladder of 9 thin white rings from
// START to EARTH with leader lines and small labels, the passed gates filled, the one you stand at orange, the next
// leg's lanes as 1.5 px curves (a RISK lane bulges wider, the VOID is nearly straight) with chips at their midpoints,
// boss cards beside their legs, and one line at the bottom: THE LIGHT AT LAUNCH. It draws on a 2D canvas from
// core/chart.js's chartView and returns where everything went, so ui/screens.js can lay its chip buttons over the
// chips (tap areas 120 × 80 px). Portrait: nodes 84 px apart from y 782 to y 110. Landscape: the ladder on its side
// along y 260, nodes 95 px apart, chips above it. Desktop: a 900 × 720 panel at 1.4 × scale.
import { FAMILIES } from '../core/cards.js';

const ORANGE = '#f08a2c';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Where the ladder, its labels and the chips go for a screen. → { kind, k (scale), nodes: [{ x, y }], axis
// ('v' | 'h'), panel }
export function chartLayout(w, h) {
  const kind = h > w ? 'portrait' : h < 500 ? 'landscape' : 'desktop';
  if (kind === 'portrait') {
    const x = Math.round(w / 2 - 40), top = 110, bottom = Math.min(782, h - 62);
    const step = (bottom - top) / 8;
    return { kind, k: 1, axis: 'v', nodes: Array.from({ length: 9 }, (_, i) => ({ x, y: bottom - step * i })), step,
      panel: null };
  }
  if (kind === 'landscape') {
    const y = Math.min(260, h - 130), step = Math.min(95, (w - 70) / 8), x0 = (w - step * 8) / 2;
    return { kind, k: 1, axis: 'h', nodes: Array.from({ length: 9 }, (_, i) => ({ x: x0 + step * i, y })), step,
      panel: null };
  }
  const pw = Math.min(900, w - 40), ph = Math.min(720, h - 40);
  const px = (w - pw) / 2, py = (h - ph) / 2;
  const k = 1.4, step = (pw - 120) / 8, y = py + ph * 0.56;
  return { kind, k, axis: 'h', nodes: Array.from({ length: 9 }, (_, i) => ({ x: px + 60 + step * i, y })), step,
    panel: { x: px, y: py, w: pw, h: ph } };
}

// The chip's icon in thin white line art (11.3): the family's glyph in its colour, a cracked ring (RISK), an empty
// dashed ring (the VOID), a ring with a dot (the long way), a row of dots (the belt).
function icon(ctx, kind, fam, x, y, r) {
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = fam && FAMILIES[fam] ? FAMILIES[fam].colour : '#fff';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  switch (kind) {
    case 'cracked-ring':
      ctx.arc(x, y, r, 0.35, Math.PI * 2 - 0.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + r * 0.95, y - r * 0.33); ctx.lineTo(x + r * 0.45, y); ctx.lineTo(x + r * 0.95, y + r * 0.33);
      ctx.stroke(); break;
    case 'dashed-ring':
      ctx.setLineDash([2.5, 2.5]); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); break;
    case 'well-ring':
      ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); break;
    case 'belt-dots':
      for (let i = -2; i <= 2; i++) { ctx.moveTo(x + i * r * 0.5 + 1.3, y); ctx.arc(x + i * r * 0.5, y + (i % 2) * 2, 1.3, 0, Math.PI * 2); }
      ctx.fill(); break;
    case 'family': {
      const g = fam && FAMILIES[fam] ? FAMILIES[fam].glyph : 'dot-chevron';
      if (g === 'ring-dot') {
        ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      else if (g === 'two-chevrons') {
        for (const dx of [-r * 0.45, r * 0.45]) { ctx.moveTo(x + dx - 3, y + 4); ctx.lineTo(x + dx, y - 4); ctx.lineTo(x + dx + 3, y + 4); }
        ctx.stroke();
      } else if (g === 'chevron-flame') {
        ctx.moveTo(x - 5, y + 3); ctx.lineTo(x, y - 6); ctx.lineTo(x + 5, y + 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 2, y + 4); ctx.lineTo(x, y + 9); ctx.lineTo(x + 2, y + 4); ctx.fill();
      } else {
        ctx.moveTo(x - 5, y + 4); ctx.lineTo(x, y - 4); ctx.lineTo(x + 5, y + 4); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y - 8, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    default:
      ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
  }
}

function label(ctx, str, x, y, { px = 11, weight = 600, color = '#fff', align = 'left', alpha = 1 } = {}) {
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${px}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, px * 0.28); ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineJoin = 'round';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

// Draw the chart. model: chartView(run, tune). opts: t (seconds since the screen appeared, for the draw-on), chips
// (true: draw the chips too, for a page without DOM chips), focus (a highlighted chip index). Returns
// { kind, nodes: [{ x, y, r, name }], chips: [{ i, x, y, w, h, id }], launch: { x, y } }.
export function drawChart(ctx, model, { w, h, dpr = 1, t = 9, chips = true, focus = -1, clear = true, dim = 0.45 } = {}) {
  const L = chartLayout(w, h);
  const k = L.k;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (clear) ctx.clearRect(0, 0, w, h);
  const appear = smooth(0, 0.5, t);
  // the sky behind the chart steps back (a static screen, so one flat fill costs nothing)
  if (dim > 0 && !L.panel) { ctx.fillStyle = `rgba(0,0,0,${dim * appear})`; ctx.fillRect(0, 0, w, h); }
  if (L.panel) {
    ctx.globalAlpha = 0.55 * appear;
    ctx.fillStyle = '#000'; ctx.fillRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h);
    ctx.globalAlpha = appear;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    ctx.strokeRect(L.panel.x + 0.5, L.panel.y + 0.5, L.panel.w - 1, L.panel.h - 1);
    ctx.globalAlpha = 1;
  }
  const nodes = model.nodes || [];
  const lanes = model.lanes || [];
  const out = { kind: L.kind, nodes: [], chips: [], launch: null };
  const here = nodes.findIndex((n) => n.state === 'current');
  const next = Math.max(0, here);

  // the spine: thin white lines between rings, brighter where you have been
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = L.nodes[i], b = L.nodes[i + 1];
    const passed = i < here;
    ctx.globalAlpha = appear * (passed ? 0.75 : i === next ? 0.18 : 0.35);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    if (!passed && i !== next) ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;

  // the next leg's lanes: curves from where you stand to the next ring, each through its chip
  if (here >= 0 && here < 8 && lanes.length) {
    const a = L.nodes[here], b = L.nodes[here + 1];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const n = lanes.length;
    const cw = 120 * k, ch = 80 * k;
    lanes.forEach((ln, i) => {
      let qx, cx0, cy0;
      if (L.axis === 'v') {
        // portrait: the first lane's chip left of the spine, the second right, a third (the VOID) on the spine
        const side = n === 1 ? 1 : i === 0 ? -1 : i === 1 ? 1 : 0;
        const chipX = side < 0 ? 8 : side > 0 ? w - 8 - cw : (w - cw) / 2;
        cx0 = chipX; cy0 = clamp(my - ch / 2, 60, h - ch - 50);
        qx = side === 0 ? mx : chipX + cw / 2;
      } else {
        // on its side: the chips in a row above the spine, each curve rising through its chip's foot; the row moves
        // as one to stay on screen (each chip kept in on its own stacked them at the right edge on leg 7)
        const gap = 12 * k, rowW = n * cw + (n - 1) * gap;
        const left = clamp(mx - rowW / 2, 6, Math.max(6, w - rowW - 6));
        cx0 = left + i * (cw + gap);
        cy0 = clamp(my - 64 * k - ch, 56, h - ch - 50);
        qx = cx0 + cw / 2;
      }
      const draw = smooth(0.15 + i * 0.12, 0.6 + i * 0.12, t);
      ctx.globalAlpha = draw;
      ctx.strokeStyle = ln.colour && ln.kind === 'family' ? ln.colour : '#fff';
      ctx.lineWidth = 1.5 * (L.kind === 'desktop' ? 1.2 : 1);
      if (ln.kind === 'void') ctx.setLineDash([5, 4]);
      // through the chip: from this ring out to the chip's edge, then on to the next ring
      const fx = L.axis === 'v' ? (qx < mx ? cx0 + cw : qx > mx ? cx0 : mx) : cx0 + cw / 2;
      const fy = L.axis === 'v' ? my : cy0 + ch;
      // a RISK lane bows out wider; the VOID runs nearly straight
      const bow = (ln.kind === 'risk' ? 18 : 0) * k;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      if (L.axis === 'v' && fx === mx) ctx.lineTo(b.x + 4, b.y);
      else if (L.axis === 'v') {
        const sg = fx < mx ? -1 : 1;
        ctx.quadraticCurveTo(fx + sg * bow, a.y, fx, fy); ctx.quadraticCurveTo(fx + sg * bow, b.y, b.x, b.y);
      } else { ctx.quadraticCurveTo(a.x, fy - bow, fx, fy); ctx.quadraticCurveTo(b.x, fy - bow, b.x, b.y); }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      out.chips.push({ i, id: ln.id, x: cx0, y: cy0, w: cw, h: ch });
      if (chips) {
        ctx.globalAlpha = draw;
        ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(cx0, cy0, cw, ch);
        ctx.strokeStyle = focus === i ? ORANGE : 'rgba(255,255,255,0.7)'; ctx.lineWidth = focus === i ? 2 : 1;
        ctx.strokeRect(cx0 + 0.5, cy0 + 0.5, cw - 1, ch - 1);
        icon(ctx, ln.icon, ln.fam, cx0 + 16 * k, cy0 + 20 * k, 8 * k);
        label(ctx, ln.short || ln.name, cx0 + 30 * k, cy0 + 20 * k, { px: Math.round(12 * k), weight: 800 });
        (ln.tags || []).slice(0, 2).forEach((tag, j) => label(ctx, tag, cx0 + 10 * k, cy0 + (44 + 18 * j) * k,
          { px: Math.round(11 * k), weight: 700, color: j === 0 ? (ln.kind === 'family' && ln.colour ? ln.colour : ORANGE) : '#fff' }));
        ctx.globalAlpha = 1;
      }
    });
  }

  // the rings, their leaders and labels; boss cards beside their legs
  nodes.forEach((nd, i) => {
    const p = L.nodes[i];
    const cur = nd.state === 'current', passed = nd.state === 'passed';
    const r = (i === 0 || i === 8 ? 9 : 7) * k * (cur ? 1.25 : 1);
    ctx.globalAlpha = appear;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    if (passed) { ctx.fillStyle = '#fff'; ctx.fill(); }
    ctx.strokeStyle = cur ? ORANGE : 'rgba(255,255,255,0.85)'; ctx.lineWidth = cur ? 2 : 1; ctx.stroke();
    if (cur) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      ctx.globalAlpha = appear * (0.25 + 0.35 * pulse);
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 5 * k + 3 * pulse, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // the video's leader: out at 45°, then flat, then the name
    const px = Math.round(11 * k);
    let lx, ly, ex, ey;
    if (L.axis === 'v') {
      // the ring you stand at labels downward, so the lane chips above it never cover its name
      const dn = cur && lanes.length ? 1 : -1;
      lx = p.x + r * 0.7071; ly = p.y + dn * r * 0.7071; ex = lx + 14; ey = ly + dn * 10;
    } else {
      const up = i % 2 === 0;
      lx = p.x + r * 0.7071; ly = p.y + r * 0.7071; ex = lx + 10 * k; ey = ly + (up ? 16 : 36) * k;
    }
    // a name that would leave the screen's right edge (EARTH at the end of the landscape ladder) leads up and to the
    // left, above the ladder, where no other name sits
    ctx.font = `${cur ? 800 : 600} ${px}px ${FONT}`;
    const dir = ex + 19 * k + ctx.measureText(nd.name).width > w - 6 ? -1 : 1;
    if (dir < 0) { lx = p.x - (lx - p.x); ex = p.x - (ex - p.x); ly = p.y - (ly - p.y); ey = ly - 16 * k; }
    ctx.globalAlpha = appear * (passed || cur ? 0.9 : 0.6);
    ctx.strokeStyle = cur ? ORANGE : '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(ex, ey); ctx.lineTo(ex + dir * 8 * k, ey); ctx.stroke();
    ctx.globalAlpha = 1;
    label(ctx, nd.name, ex + dir * 11 * k, ey, { px, weight: cur ? 800 : 600, color: cur ? ORANGE : '#fff',
      align: dir < 0 ? 'right' : 'left', alpha: appear * (passed || cur || nd.state === 'next' ? 1 : 0.65) });
    out.nodes.push({ x: p.x, y: p.y, r, name: nd.name });
  });

  // the boss cards: the next leg's in full (name, what it does), the later ones by name beside their legs
  const bosses = { whale: 'WHALE', mako: 'MAKO', manta: 'MANTA' };
  nodes.forEach((nd, i) => {
    if (!nd.boss || i <= here) return;
    const a = L.nodes[i - 1], b = L.nodes[i];
    const isNext = model.boss && model.boss.id === nd.boss;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const px = Math.round(10 * k);
    const name = bosses[nd.boss] || nd.boss.toUpperCase();
    if (!isNext) {
      const x = L.axis === 'v' ? 8 : mx - 20 * k, y = L.axis === 'v' ? my : b.y + 62 * k;
      label(ctx, name, x, y, { px: Math.round(10 * k), weight: 800, alpha: appear * 0.5 });
      return;
    }
    let x, y, maxW;
    if (L.axis === 'v') { x = 8; y = my + 54; maxW = Math.max(90, L.nodes[0].x - 24); }
    else { x = L.panel ? L.panel.x + 16 : 16; y = L.panel ? L.panel.y + 26 : 70; maxW = 190 * k; }
    label(ctx, name, x, y, { px: Math.round(12 * k), weight: 800, color: ORANGE, alpha: appear });
    const words = String(model.boss.text || '').split(' ');
    let row = '', ry = y + 15 * k;
    ctx.font = `600 ${px}px ${FONT}`;
    for (const wd of words) {
      const tryRow = row ? `${row} ${wd}` : wd;
      if (ctx.measureText(tryRow).width > maxW && row) { label(ctx, row, x, ry, { px, alpha: appear * 0.9 }); row = wd; ry += 13 * k; }
      else row = tryRow;
    }
    if (row) label(ctx, row, x, ry, { px, alpha: appear * 0.9 });
  });

  // one line at the bottom: the light at launch, and who joins
  const bx = L.panel ? L.panel.x + L.panel.w / 2 : w / 2;
  const by = L.panel ? L.panel.y + L.panel.h - 30 : h - 28;
  if (model.launch) {
    label(ctx, model.launch.line, bx, by, { px: Math.round(13 * k), weight: 800, align: 'center', alpha: appear });
    out.launch = { x: bx, y: by };
  }
  if (model.joins) label(ctx, model.joins, bx, by - 20 * k, { px: Math.round(11 * k), weight: 800, color: ORANGE,
    align: 'center', alpha: appear });
  return out;
}
