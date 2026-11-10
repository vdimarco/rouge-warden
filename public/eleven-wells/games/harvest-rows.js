/* 05 Harvest Rows: Nana Pell's Allotment. A farming sim on a falling-block well.
 * Some clods carry SEEDS. Each placement they grow: seed → sprout → growing → ripe veg → mush.
 * Clearing a row digs it up and pays per block: soil a little, unripe seeds little, ripe veg a lot,
 * mush and weeds cost you. Weeds spread onto neighbouring seeds.
 * Seasons turn every 15 pieces. Summer grows fast, autumn pays double, and in winter
 * nothing grows and full rows freeze in place until spring. Each season has rent to pay.
 * Look: a light watercolour storybook. Clods, crops, Nana and the basket are all drawn on canvas
 * with wobbly pencil outlines and cached on offscreen canvases.
 */
(function () {
  const W = window.Wells;

  // ---------- rules ----------
  const SEASONS = [
    { key: 'spring', name: 'Spring', growth: 1, pay: 1, rule: 'Seeds grow at a steady pace. Frozen rows thaw and dig up.',
      ink: '#b2456e', wash: ['#cfe6b6', '#f5c8d6'], fleck: '#f2b3c7' },
    { key: 'summer', name: 'Summer', growth: 1.6, pay: 1, rule: 'Everything grows quick in the heat. Mind it doesn\'t rot.',
      ink: '#8a5f0c', wash: ['#f2d98a', '#f7eab9'], fleck: '#f3dc7a' },
    { key: 'autumn', name: 'Autumn', growth: 1, pay: 2, rule: 'Harvest market: everything you dig pays double.',
      ink: '#a3421b', wash: ['#ebb08a', '#e6cc9f'], fleck: '#c8622c' },
    { key: 'winter', name: 'Winter', growth: 0, pay: 1, freeze: true, rule: 'Nothing grows. Full rows freeze solid till spring.',
      ink: '#2c6390', wash: ['#cfe1f1', '#eaf2f9'], fleck: '#ffffff' },
  ];
  const SEASON_LEN = 15;
  // Fix: spring rent eased (was 15, scaling +60%/year). Spring is when seeds are still coming up.
  const QUOTA = [10, 30, 50, 8];
  const GROWTH = [0.4, 0.6, 0.6, 0.4];
  const quotaFor = (si, year) => Math.round(QUOTA[si] * (1 + GROWTH[si] * year));
  const RIPE = 6;
  const ROT = 14;
  const BARN = 20;

  const UPGRADES = [
    { id: 'fert', name: 'Well-rotted manure', max: 3, desc: 'Seeds grow 25% faster.', quip: 'Smells awful. Works a treat.' },
    { id: 'scare', name: 'Scarecrow', max: 2, desc: 'Weeds spread half as often.', quip: 'His name\'s Bert. Don\'t ask.' },
    { id: 'green', name: 'Cold frame', max: 1, desc: 'Seeds grow at half speed in winter.', quip: 'Old windows and a bit of string.' },
    { id: 'silo', name: 'Bigger biscuit tin', max: 3, desc: 'Keep 20p more between seasons.', quip: 'The good tin, with the shortbread on.' },
    { id: 'seedbag', name: 'Seed packets', max: 2, desc: 'Clods carry more seeds.', quip: 'Your grandad\'s. Still good.' },
    { id: 'weedkill', name: 'Dutch hoe', max: 3, desc: 'Every weed goes back to soil now. Fewer weeds arrive.', quip: 'Sharpened it on the back step.' },
    { id: 'market', name: 'Fête stall', max: 3, desc: 'Ripe veg pays +4p.', quip: 'Village folk pay daft money.' },
    { id: 'compost', name: 'Compost heap', max: 1, desc: 'Mush pays 0 instead of −5p.', quip: 'Peelings, teabags, the lot.' },
    { id: 'sickle', name: 'Scythe', max: 2, desc: 'Each extra row in one dig adds +20% to the take.', quip: 'Mind your ankles.' },
    { id: 'cellar', name: 'Root cellar', max: 2, desc: 'Ripe veg rots 4 plantings later.', quip: 'Cool and dark. Keeps for weeks.' },
  ];
  const PACKET = ['#b2456e', '#5f8f3c', '#c0603c', '#2c6390', '#8a5f0c'];

  // ---------- palette ----------
  const PENCIL = '#4a3626';
  const PAPER = '#fbf6ea';
  // One watercolour soil per piece type, so pieces stay easy to tell apart. Index 7 = weedy peat.
  const TONE_OF = { I: 0, O: 1, T: 2, S: 3, Z: 4, J: 5, L: 6 };
  const TONES = ['#d6b783', '#8a5a3a', '#b4766a', '#8e8a55', '#c0603c', '#7a7068', '#d48d3e', '#6b6046'];
  const VEG = ['carrot', 'beet', 'pumpkin', 'cabbage'];
  const VEG_WEIGHTS = [[4, 4, 1, 2], [3, 3, 2, 2], [2, 2, 5, 2], [1, 2, 1, 5]];
  const VEG_NAMES = { carrot: ['carrot', 'carrots'], beet: ['beetroot', 'beetroots'], pumpkin: ['pumpkin', 'pumpkins'], cabbage: ['cabbage', 'cabbages'] };

  // ---------- drawing kit ----------
  const DPR = () => window.devicePixelRatio || 1;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const CACHE = new Map();
  function sprite(key, w, h, draw) {
    const d = DPR(), k = `${key}|${w}|${h}|${d}`;
    let c = CACHE.get(k);
    if (!c) {
      c = mk(w * d, h * d);
      const x = c.getContext('2d');
      x.setTransform(d, 0, 0, d, 0, 0);
      x.lineCap = 'round'; x.lineJoin = 'round';
      draw(x, w, h);
      CACHE.set(k, c);
    }
    return c;
  }
  // Smooth closed curve through points (midpoint quadratic).
  function trace(c, pts) {
    const n = pts.length;
    const m = (i) => { const a = pts[i % n], b = pts[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    const s0 = m(n - 1);
    c.beginPath();
    c.moveTo(s0[0], s0[1]);
    for (let i = 0; i < n; i++) { const p = pts[i], q = m(i); c.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
    c.closePath();
  }
  function ell(r, cx, cy, rx, ry, j = 0.08, n = 10, rot = 0) {
    const pts = [], off = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2, k = 1 + (r() - 0.5) * 2 * j;
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return pts;
  }
  // Lumpy rounded square: a clod of earth.
  function clodPts(r, x, y, w, h, j = 0.05) {
    const pts = [], cx = x + w / 2, cy = y + h / 2, n = 14, off = r() * 0.3;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const sq = 1 / Math.max(Math.abs(ca), Math.abs(sa));
      const k = (0.5 + 0.5 * sq) * 0.95 * (1 + (r() - 0.5) * 2 * j);
      pts.push([cx + ca * (w / 2) * k, cy + sa * (h / 2) * k]);
    }
    return pts;
  }
  function leafPts(cx, cy, len, wid, ang) {
    const pts = [[0, 0], [len * 0.3, -wid], [len * 0.75, -wid * 0.7], [len, 0], [len * 0.75, wid * 0.7], [len * 0.3, wid]];
    const ca = Math.cos(ang), sa = Math.sin(ang);
    return pts.map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]);
  }
  // Watercolour wash inside a path: flat pigment, a pale bloom, pooled darker edges, granulation.
  function watercolour(c, pts, color, s, r, o = {}) {
    c.save();
    trace(c, pts);
    c.clip();
    c.globalAlpha = o.alpha == null ? 0.92 : o.alpha;
    c.fillStyle = color;
    c.fillRect(-2 * s, -2 * s, 5 * s, 5 * s);
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    const bw = maxX - minX, bh = maxY - minY;
    c.globalAlpha = 0.24;
    c.fillStyle = '#fffaf0';
    trace(c, ell(r, minX + bw * 0.38, minY + bh * 0.34, bw * 0.28, bh * 0.22, 0.2, 8));
    c.fill();
    c.globalAlpha = 0.5;
    c.strokeStyle = W.shade(color, -0.32);
    c.lineWidth = Math.max(1.6, Math.min(bw, bh) * 0.16);
    trace(c, pts);
    c.stroke();
    const n = Math.round(bw * bh * 0.04) + 2;
    for (let i = 0; i < n; i++) {
      c.globalAlpha = 0.14 + r() * 0.22;
      c.fillStyle = r() < 0.75 ? W.shade(color, -0.5) : '#fff6e0';
      const sz = 0.6 + r() * 1.1;
      c.fillRect(minX + r() * bw, minY + r() * bh, sz, sz);
    }
    c.restore();
  }
  // Pencil outline, slightly off-register from the paint like a storybook print.
  function pencil(c, pts, s, r, o = {}) {
    const q = pts.map(([a, b]) => [a + (r() - 0.5) * s * 0.035 + (o.dx || 0), b + (r() - 0.5) * s * 0.035 + (o.dy || 0)]);
    c.save();
    c.globalAlpha = o.alpha == null ? 0.85 : o.alpha;
    c.strokeStyle = o.color || PENCIL;
    c.lineWidth = o.lw || Math.max(1, s * 0.045);
    trace(c, q);
    c.stroke();
    c.restore();
  }
  function stroke(c, pts, color, lw, r, j = 0) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      c.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * j, (y0 + y1) / 2 + (r() - 0.5) * j, x1, y1);
    }
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.stroke();
  }
  const shape = (c, pts, color, s, r, o = {}) => { watercolour(c, pts, color, s, r, o); if (o.line !== false) pencil(c, pts, s, r, o); };

  // ---------- textures ----------
  let grain = null;
  function grainTile() {
    if (grain) return grain;
    const n = 180;
    grain = mk(n, n);
    const c = grain.getContext('2d');
    const img = c.createImageData(n, n), d = img.data, r = W.rng(77);
    for (let i = 0; i < n * n; i++) {
      const v = (r() - 0.5) * 14 + (r() < 0.012 ? -22 : 0);
      d[i * 4] = 246 + v; d[i * 4 + 1] = 240 + v; d[i * 4 + 2] = 226 + v; d[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    for (let i = 0; i < 26; i++) {
      c.globalAlpha = 0.1 + r() * 0.12;
      c.strokeStyle = r() < 0.5 ? '#bfae90' : '#ffffff';
      c.lineWidth = 0.6;
      const x = r() * n, y = r() * n, a = r() * 6.28, l = 4 + r() * 10;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    return grain;
  }
  let grainURL = null;
  const washURL = {};
  function pageWash(si) {
    if (washURL[si]) return washURL[si];
    const S = SEASONS[si], w = 420, h = 300, cv = mk(w, h), c = cv.getContext('2d'), r = W.rng(300 + si);
    const spots = [[0.02, 0.1, 0.3, 0.32, 0], [0.98, 0.9, 0.34, 0.36, 1], [0.95, 0.06, 0.2, 0.16, 1], [0.06, 0.95, 0.24, 0.2, 0]];
    c.filter = 'blur(5px)';
    for (const [x, y, rx, ry, k] of spots) {
      const pts = ell(r, x * w, y * h, rx * w, ry * h, 0.16, 12);
      c.save(); c.globalAlpha = 0.5; c.fillStyle = S.wash[k]; trace(c, pts); c.fill();
      c.globalAlpha = 0.18; c.strokeStyle = W.shade(S.wash[k], -0.2); c.lineWidth = 4; c.stroke(); c.restore();
    }
    c.filter = 'none';
    washURL[si] = cv.toDataURL();
    return washURL[si];
  }

  // ---------- clods ----------
  function clod(tone, v, s) {
    return sprite(`clod${tone}.${v}`, s, s, (c) => {
      const r = W.rng(1000 + tone * 17 + v * 131 + s);
      const pts = clodPts(r, 0.8, 0.8, s - 1.6, s - 1.6, 0.06);
      watercolour(c, pts, TONES[tone], s, r);
      c.save(); trace(c, pts); c.clip();
      // crumbs, a root hair, sometimes a pebble tucked in a corner
      if (s >= 14) {
        c.fillStyle = W.shade(TONES[tone], -0.5);
        for (let i = 0; i < 4; i++) { c.globalAlpha = 0.35; c.beginPath(); c.arc(s * (0.15 + r() * 0.7), s * (0.55 + r() * 0.35), s * (0.025 + r() * 0.02), 0, 6.28); c.fill(); }
        if (v % 2 === 0) {
          const p = ell(r, s * (v === 0 ? 0.78 : 0.24), s * 0.8, s * 0.075, s * 0.05, 0.2, 7);
          c.globalAlpha = 0.85; c.fillStyle = '#e3d9c6'; trace(c, p); c.fill();
          c.globalAlpha = 0.5; c.strokeStyle = PENCIL; c.lineWidth = 0.8; c.stroke();
        }
        if (v === 3) {
          c.globalAlpha = 0.4; c.strokeStyle = '#efe2c4'; c.lineWidth = 0.9;
          c.beginPath(); c.moveTo(s * 0.12, s * 0.42); c.quadraticCurveTo(s * 0.22, s * 0.36, s * 0.3, s * 0.46); c.stroke();
        }
      }
      c.restore();
      pencil(c, pts, s, r);
    });
  }
  function ghostClod(s) {
    return sprite('ghost', s, s, (c) => {
      const r = W.rng(9);
      c.setLineDash([3, 3]);
      pencil(c, clodPts(r, 2, 2, s - 4, s - 4, 0.05), s, r, { alpha: 0.5, lw: 1.4 });
    });
  }
  function snowCap(s) {
    return sprite('snowcap', s, s * 0.5, (c) => {
      const r = W.rng(41);
      const pts = [[s * 0.06, s * 0.2], [s * 0.2, s * 0.06], [s * 0.5, s * 0.02], [s * 0.8, s * 0.05], [s * 0.95, s * 0.2], [s * 0.85, s * 0.27], [s * 0.66, s * 0.22], [s * 0.45, s * 0.3], [s * 0.25, s * 0.24], [s * 0.1, s * 0.3]];
      shape(c, pts, '#ffffff', s, r, { alpha: 0.95, color: '#6f8fa8', lw: 1 });
    });
  }
  function hole(s) {
    return sprite('hole', s, s, (c) => {
      const r = W.rng(5);
      const p = ell(r, s * 0.5, s * 0.58, s * 0.26, s * 0.14, 0.12, 9);
      c.globalAlpha = 0.75; c.fillStyle = '#3d2a1a'; trace(c, p); c.fill();
    });
  }

  // ---------- crops (drawn in a cell, with headroom 0.3s above for fronds) ----------
  const HEAD = 0.3;
  const LEAF = '#5f8f3c', LEAF2 = '#7aa94a';
  function crop(kind, s) {
    return sprite('crop.' + kind, s, s * (1 + HEAD), (c) => {
      c.translate(0, s * HEAD);
      const r = W.rng([...kind].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 3) + s);
      const P = (x, y) => [x * s, y * s];
      const lw = Math.max(1, s * 0.05);
      const leaf = (x, y, len, wid, ang, col = LEAF) => shape(c, leafPts(x * s, y * s, len * s, wid * s, ang), col, s, r, { lw: Math.max(0.8, s * 0.035) });
      const fronds = (x, y, tips, col = LEAF) => {
        for (const [tx, ty] of tips) {
          c.save(); c.globalAlpha = 0.95;
          stroke(c, [P(x, y), P((x + tx) / 2 + 0.03, (y + ty) / 2), P(tx, ty)], col, lw, r, s * 0.05);
          for (let k = 0.35; k < 0.95; k += 0.22) {
            const mx = x + (tx - x) * k, my = y + (ty - y) * k;
            stroke(c, [P(mx, my), P(mx - 0.08, my - 0.06)], col, lw * 0.8, r);
            stroke(c, [P(mx, my), P(mx + 0.08, my - 0.05)], col, lw * 0.8, r);
          }
          c.restore();
        }
      };
      switch (kind) {
        case 'seed': {
          c.globalAlpha = 0.7; c.fillStyle = '#4a3220'; trace(c, ell(r, s * 0.5, s * 0.62, s * 0.18, s * 0.08, 0.1, 8)); c.fill();
          c.globalAlpha = 1;
          shape(c, ell(r, s * 0.5, s * 0.55, s * 0.075, s * 0.11, 0.08, 8, 0.4), '#ecd8a4', s, r, { lw: Math.max(0.8, s * 0.035) });
          break;
        }
        case 'sprout': {
          stroke(c, [P(0.5, 0.68), P(0.49, 0.5), P(0.5, 0.36)], LEAF, lw, r);
          leaf(0.5, 0.38, 0.22, 0.07, -2.6, LEAF2);
          leaf(0.5, 0.36, 0.22, 0.07, -0.5, LEAF2);
          break;
        }
        case 'grow-carrot': fronds(0.5, 0.55, [[0.3, 0.08], [0.5, -0.02], [0.7, 0.1]]);
          shape(c, ell(r, s * 0.5, s * 0.56, s * 0.08, s * 0.05, 0.1, 7), '#ec7a28', s, r, { lw: 1 }); break;
        case 'grow-beet':
          stroke(c, [P(0.5, 0.62), P(0.4, 0.3)], '#a3284f', lw, r); stroke(c, [P(0.5, 0.62), P(0.6, 0.28)], '#a3284f', lw, r);
          leaf(0.42, 0.34, 0.3, 0.1, -2.1); leaf(0.58, 0.32, 0.3, 0.1, -1.0); break;
        case 'grow-pumpkin':
          stroke(c, [P(0.2, 0.7), P(0.4, 0.55), P(0.75, 0.62), P(0.82, 0.5)], LEAF, lw, r, s * 0.08);
          shape(c, ell(r, s * 0.42, s * 0.4, s * 0.22, s * 0.17, 0.22, 9), LEAF, s, r);
          shape(c, ell(r, s * 0.72, s * 0.42, s * 0.09, s * 0.09, 0.3, 7), '#f2c230', s, r, { lw: 1 }); break;
        case 'grow-cabbage':
          shape(c, ell(r, s * 0.37, s * 0.58, s * 0.15, s * 0.11, 0.15, 8), LEAF2, s, r);
          shape(c, ell(r, s * 0.63, s * 0.58, s * 0.15, s * 0.11, 0.15, 8), LEAF2, s, r);
          shape(c, ell(r, s * 0.5, s * 0.5, s * 0.13, s * 0.12, 0.15, 8), '#a6cf7a', s, r); break;
        case 'carrot': {
          fronds(0.5, 0.4, [[0.22, -0.14], [0.42, -0.24], [0.6, -0.22], [0.8, -0.1]]);
          const body = [P(0.25, 0.42), P(0.5, 0.33), P(0.75, 0.42), P(0.68, 0.6), P(0.57, 0.84), P(0.5, 0.97), P(0.44, 0.84), P(0.33, 0.6)];
          shape(c, body, '#ee7a26', s, r);
          c.globalAlpha = 0.6;
          for (const y of [0.5, 0.64, 0.78]) stroke(c, [P(0.4 + (y - 0.5) * 0.25, y), P(0.5, y + 0.02)], '#a8461a', Math.max(0.8, lw * 0.7), r);
          c.globalAlpha = 1;
          break;
        }
        case 'beet': {
          stroke(c, [P(0.48, 0.42), P(0.32, 0.0)], '#a3284f', lw, r); stroke(c, [P(0.52, 0.42), P(0.7, -0.04)], '#a3284f', lw, r);
          leaf(0.36, 0.08, 0.32, 0.12, -2.0); leaf(0.66, 0.04, 0.32, 0.12, -1.1);
          shape(c, ell(r, s * 0.5, s * 0.62, s * 0.28, s * 0.26, 0.07, 11), '#9e2350', s, r);
          stroke(c, [P(0.5, 0.86), P(0.53, 0.94), P(0.58, 0.99)], '#7a1a3c', lw * 0.8, r);
          break;
        }
        case 'pumpkin': {
          stroke(c, [P(0.56, 0.36), P(0.7, 0.22), P(0.82, 0.3), P(0.76, 0.38)], LEAF, lw * 0.8, r, s * 0.06);
          shape(c, ell(r, s * 0.5, s * 0.63, s * 0.43, s * 0.3, 0.06, 12), '#e8871f', s, r);
          c.globalAlpha = 0.55;
          for (const k of [-0.2, 0, 0.2]) stroke(c, [P(0.5 + k * 0.6, 0.37), P(0.5 + k * 1.25, 0.63), P(0.5 + k * 0.6, 0.9)], '#a6520e', Math.max(0.8, lw * 0.7), r);
          c.globalAlpha = 1;
          shape(c, [P(0.45, 0.4), P(0.44, 0.24), P(0.52, 0.2), P(0.56, 0.38)], '#6b5230', s, r, { lw: 1 });
          break;
        }
        case 'cabbage': {
          shape(c, ell(r, s * 0.5, s * 0.64, s * 0.44, s * 0.3, 0.12, 12), '#7fb058', s, r);
          shape(c, ell(r, s * 0.5, s * 0.55, s * 0.26, s * 0.25, 0.06, 10), '#bcdc8e', s, r);
          c.globalAlpha = 0.5;
          stroke(c, [P(0.5, 0.36), P(0.46, 0.55), P(0.5, 0.78)], '#5f8f3c', Math.max(0.8, lw * 0.6), r);
          stroke(c, [P(0.2, 0.6), P(0.33, 0.66), P(0.4, 0.82)], '#4f7a30', Math.max(0.8, lw * 0.6), r);
          stroke(c, [P(0.8, 0.6), P(0.67, 0.66), P(0.6, 0.82)], '#4f7a30', Math.max(0.8, lw * 0.6), r);
          c.globalAlpha = 1;
          break;
        }
        case 'rotten': {
          // a slumped, mouldy lump that used to be a vegetable
          const lump = [P(0.14, 0.86), P(0.2, 0.6), P(0.36, 0.5), P(0.52, 0.56), P(0.66, 0.46), P(0.82, 0.58), P(0.88, 0.86), P(0.5, 0.92)];
          shape(c, lump, '#7a6d55', s, r);
          for (let i = 0; i < 4; i++) { c.globalAlpha = 0.7; c.fillStyle = '#4f4536'; trace(c, ell(r, s * (0.26 + i * 0.16), s * (0.68 + (i % 2) * 0.1), s * 0.06, s * 0.04, 0.3, 6)); c.fill(); }
          c.fillStyle = '#dfe6c8';
          for (let i = 0; i < 9; i++) { c.globalAlpha = 0.85; c.beginPath(); c.arc(s * (0.3 + r() * 0.45), s * (0.52 + r() * 0.12), s * (0.018 + r() * 0.02), 0, 6.28); c.fill(); }
          c.globalAlpha = 0.75;
          stroke(c, [P(0.3, 0.42), P(0.25, 0.3), P(0.31, 0.2), P(0.26, 0.08)], '#6f7a50', Math.max(0.9, lw * 0.7), r, s * 0.04);
          stroke(c, [P(0.72, 0.36), P(0.77, 0.24), P(0.71, 0.13), P(0.75, 0.03)], '#6f7a50', Math.max(0.9, lw * 0.7), r, s * 0.04);
          c.globalAlpha = 1;
          break;
        }
        case 'weed': {
          const blades = [[0.12, 0.5, '#4e6b2b'], [0.24, 0.12, '#3c5520'], [0.36, 0.3, '#56762f'], [0.5, -0.05, '#3c5520'], [0.62, 0.22, '#4e6b2b'], [0.76, 0.05, '#56762f'], [0.88, 0.45, '#3c5520']];
          for (const [tx, ty, col] of blades) {
            const bx = 0.5 + (tx - 0.5) * 0.45, by = 0.86;
            const pts = [P(bx - 0.05, by), P((bx + tx) / 2 - 0.07, (by + ty) / 2 + 0.03), P((bx + tx) / 2 - 0.02, (by + ty) / 2 - 0.02), P(tx, ty), P((bx + tx) / 2 + 0.04, (by + ty) / 2 + 0.02), P((bx + tx) / 2 + 0.07, (by + ty) / 2 + 0.06), P(bx + 0.05, by)];
            c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath();
            c.globalAlpha = 0.92; c.fillStyle = col; c.fill();
            c.globalAlpha = 0.8; c.strokeStyle = '#2a3a14'; c.lineWidth = Math.max(0.8, s * 0.03); c.stroke();
          }
          c.globalAlpha = 1;
          const cx = s * 0.7, cy = s * 0.02, rr = s * 0.11;
          c.strokeStyle = '#9a927f'; c.lineWidth = 0.8;
          c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.stroke();
          stroke(c, [P(0.7, 0.1), P(0.66, 0.5), P(0.6, 0.86)], '#56762f', Math.max(0.8, s * 0.03), r);
          break;
        }
      }
    });
  }

  // ---------- Nana Pell ----------
  function nana(mood, S, wash) {
    return sprite(`nana.${mood}.${wash}`, S, S, (c) => {
      const r = W.rng(2024);
      const P = (x, y) => [x * S, y * S];
      const lw = Math.max(1.2, S * 0.022);
      shape(c, ell(r, S * 0.5, S * 0.52, S * 0.47, S * 0.46, 0.06, 12), wash, S, r, { alpha: 0.7, line: false });
      // cardigan and collar
      shape(c, ell(r, S * 0.5, S * 1.04, S * 0.44, S * 0.3, 0.05, 12), '#6f8f4f', S, r, { lw });
      shape(c, [P(0.36, 0.78), P(0.5, 0.86), P(0.64, 0.78), P(0.6, 0.92), P(0.5, 0.95), P(0.4, 0.92)], '#f6efe2', S, r, { lw });
      for (const y of [0.88, 0.97]) { c.fillStyle = '#e6c26a'; c.beginPath(); c.arc(S * 0.5, S * y, S * 0.018, 0, 6.28); c.fill(); }
      // hair: grey curls with a bun
      shape(c, ell(r, S * 0.5, S * 0.17, S * 0.1, S * 0.08, 0.1, 9), '#d2cfd9', S, r, { lw });
      const curls = [[0.29, 0.42], [0.3, 0.3], [0.38, 0.24], [0.5, 0.22], [0.62, 0.24], [0.7, 0.3], [0.71, 0.42]];
      for (const [x, y] of curls) shape(c, ell(r, S * x, S * y, S * 0.085, S * 0.075, 0.15, 8), '#cfcbd6', S, r, { lw: lw * 0.8 });
      // face
      shape(c, ell(r, S * 0.5, S * 0.52, S * 0.21, S * 0.25, 0.04, 12), '#f2c8a2', S, r, { lw });
      c.globalAlpha = 0.45; c.fillStyle = '#ec8f8f';
      for (const x of [0.37, 0.63]) { c.beginPath(); c.arc(S * x, S * 0.6, S * 0.05, 0, 6.28); c.fill(); }
      c.globalAlpha = 1;
      // specs
      c.strokeStyle = PENCIL; c.lineWidth = lw;
      for (const x of [0.415, 0.585]) { c.beginPath(); c.arc(S * x, S * 0.5, S * 0.07, 0, 6.28); c.stroke(); }
      c.beginPath(); c.moveTo(S * 0.485, S * 0.49); c.quadraticCurveTo(S * 0.5, S * 0.47, S * 0.515, S * 0.49); c.stroke();
      // eyes and brows
      c.fillStyle = PENCIL;
      if (mood === 'proud') {
        for (const x of [0.415, 0.585]) { c.beginPath(); c.arc(S * x, S * 0.51, S * 0.028, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      } else for (const x of [0.415, 0.585]) { c.beginPath(); c.arc(S * x, S * 0.5, S * 0.016, 0, 6.28); c.fill(); }
      c.lineWidth = lw * 1.2;
      const brow = mood === 'cross' ? [[0.36, 0.39, 0.46, 0.42], [0.64, 0.39, 0.54, 0.42]] : [[0.36, 0.41, 0.46, 0.39], [0.64, 0.41, 0.54, 0.39]];
      for (const [a, b, cc, d] of brow) { c.beginPath(); c.moveTo(S * a, S * b); c.lineTo(S * cc, S * d); c.stroke(); }
      // nose and mouth
      c.lineWidth = lw;
      c.beginPath(); c.moveTo(S * 0.5, S * 0.53); c.quadraticCurveTo(S * 0.47, S * 0.6, S * 0.51, S * 0.6); c.stroke();
      c.beginPath();
      if (mood === 'cross') { c.moveTo(S * 0.44, S * 0.68); c.quadraticCurveTo(S * 0.5, S * 0.66, S * 0.56, S * 0.68); }
      else if (mood === 'proud') { c.moveTo(S * 0.41, S * 0.65); c.quadraticCurveTo(S * 0.5, S * 0.75, S * 0.59, S * 0.65); }
      else { c.moveTo(S * 0.43, S * 0.66); c.quadraticCurveTo(S * 0.5, S * 0.71, S * 0.57, S * 0.66); }
      c.stroke();
      c.fillStyle = '#f6f1e6'; c.beginPath(); c.arc(S * 0.29, S * 0.57, S * 0.018, 0, 6.28); c.fill();
    });
  }

  // ---------- basket ----------
  function drawBasket(c, w, h, items, ripe) {
    c.clearRect(0, 0, w, h);
    const r = W.rng(88);
    const vs = Math.round(h * 0.42);
    // veg heap behind the front rim
    const slots = [[0.3, 0.3], [0.5, 0.26], [0.7, 0.3], [0.4, 0.18], [0.6, 0.18], [0.5, 0.08], [0.22, 0.38], [0.78, 0.38]];
    const show = items.slice(-slots.length);
    show.forEach((v, i) => {
      const [x, y] = slots[i];
      c.drawImage(crop(v, vs), w * x - vs / 2, h * y - vs * HEAD * 0.5, vs, vs * (1 + HEAD));
    });
    // handle
    c.strokeStyle = '#a77a3e'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(w * 0.16, h * 0.52); c.bezierCurveTo(w * 0.18, h * -0.12, w * 0.82, h * -0.12, w * 0.84, h * 0.52); c.stroke();
    c.strokeStyle = PENCIL; c.lineWidth = 1; c.globalAlpha = 0.7; c.stroke(); c.globalAlpha = 1;
    // body
    const body = [[w * 0.1, h * 0.5], [w * 0.5, h * 0.56], [w * 0.9, h * 0.5], [w * 0.8, h * 0.95], [w * 0.5, h * 0.98], [w * 0.2, h * 0.95]];
    watercolour(c, body, '#d1a05a', w, r);
    c.save(); trace(c, body); c.clip();
    c.globalAlpha = 0.45; c.strokeStyle = '#7d5526'; c.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const x = w * (0.1 + i * 0.1); c.beginPath(); c.moveTo(x, h * 0.48); c.lineTo(x + w * 0.04, h); c.stroke(); }
    for (let j = 0; j < 4; j++) { const y = h * (0.62 + j * 0.1); c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(w * 0.5, y + h * 0.04, w, y); c.stroke(); }
    c.restore();
    pencil(c, body, w, r, { lw: 1.3 });
    shape(c, ell(r, w * 0.5, h * 0.52, w * 0.42, h * 0.07, 0.04, 12), '#b98846', w, r, { lw: 1.2 });
    if (ripe) { /* nothing extra: count lives in DOM */ }
  }

  // ---------- sound ----------
  const PENTA = [196, 220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
  function pluck(f, o = {}) {
    const vol = o.vol == null ? 0.05 : o.vol, at = o.at || 0, dur = o.dur || 0.55;
    W.tone({ f, dur, type: 'sine', vol, at, attack: 0.003 });
    W.tone({ f: f * 3.98, dur: dur * 0.16, type: 'sine', vol: vol * 0.3, at, attack: 0.002 });
    W.tone({ f: f * 2.01, dur: dur * 0.35, type: 'triangle', vol: vol * 0.18, at, attack: 0.003 });
    if (o.click !== false) W.noise({ dur: 0.014, vol: vol * 0.5, filter: 'bandpass', freq: 2600, q: 0.9, at });
  }
  function thump(vol = 0.08, at = 0) {
    W.noise({ dur: 0.11, vol, filter: 'lowpass', freq: 520, freq2: 110, q: 0.7, at });
    W.tone({ f: 120, f2: 55, dur: 0.12, type: 'sine', vol: vol * 0.9, at });
  }
  function jingle(at = 0) { pluck(659.25, { at, vol: 0.06 }); pluck(783.99, { at: at + 0.11, vol: 0.06 }); pluck(1046.5, { at: at + 0.22, vol: 0.07, dur: 0.9 }); pluck(523.25, { at: at + 0.22, vol: 0.03, dur: 0.9, click: false }); }
  function birdsong() {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const at = i * 0.16 + Math.random() * 0.05, f = 2500 + Math.random() * 900;
      W.tone({ f, f2: f * 1.35, dur: 0.06, type: 'sine', vol: 0.016, at });
      W.tone({ f: f * 1.3, f2: f * 0.92, dur: 0.08, type: 'sine', vol: 0.013, at: at + 0.075 });
    }
  }

  // ---------- Nana's lines ----------
  const LINES = {
    intro: ['Right, pet. Seeds go in, rows come out. Don\'t dig owt up before it\'s ready.'],
    early: ['Patience, pet. Pull a carrot early and you\'ve pulled a twig.', 'That were a sprout! You\'ll not get fat on sprouts.', 'Too soon, love. Give \'em a few more plantings.'],
    soil: ['Plain muck. Pays the rent, mind.', 'A row of clods. Tidy, if nowt else.'],
    ripe: ['Ooh, look at that! In the basket.', 'Now that\'s worth muddy knees.', 'Champion. Your grandad never grew one like that.'],
    carrot: ['Look at the shoulders on that carrot!'], beet: ['Beetroot! Mind your fingers, it stains.'],
    pumpkin: ['That pumpkin\'s bigger than your head, pet.'], cabbage: ['Lovely cabbage. Soup on Sunday.'],
    big: ['Fetch the camera! That\'s a show-winner.', 'All at once! I could weep, I could.'],
    rotdig: ['Smells like your grandad\'s socks. Dig sooner, love.', 'Mush pays nowt but flies.'],
    rotted: ['That one\'s gone to mush. Flies\'ll be pleased.', 'Gone over. Should\'ve dug that row.'],
    ripened: ['That one\'s ready, pet. Finish its row.', 'Ripe as you like. Don\'t leave it sitting.'],
    weeds: ['Weeds don\'t wait to be asked. Get that row up.', 'Bindweed! It\'ll have the lot if you let it.'],
    spring: ['Spring! Frost\'s gone. Get planting.'], summer: ['Hot one. Things ripen quick, and rot quicker.'],
    autumn: ['Autumn market pays double. Fill that basket.'], winter: ['Nothing grows in winter, pet. Full rows freeze till spring.'],
    freeze: ['That row\'s frozen solid. It\'ll come up in spring.', 'Ground\'s like iron. Leave it till the thaw.'],
    thaw: ['Here comes the thaw! Up they come.'],
    short: ['Rent\'s due soon and the tin\'s light. Dig something!'],
    paid: ['Rent\'s paid. Have a rummage in the shed.'],
    lose: ['Well. I lost a whole bed of leeks in \'76. Dust your knees off.'],
  };
  const pickLine = (k) => { const a = LINES[k]; return a[Math.floor(Math.random() * a.length)]; };

  function mount(sh) {
    const rng = W.rng();
    const board = new W.Board(10, 20);
    let lv = {}, coins = 0, score = 0, year = 0, si = 0, seasonPieces = 0, seasonEarned = 0, weedT = 0, over = false, last = null;
    let basket = [], basketN = 0, warned = false, birdT = 4000;
    const L = (id) => lv[id] || 0;
    const season = () => SEASONS[si];
    const rotAt = () => ROT + 4 * L('cellar');
    const stage = (b) => (b.age < 2 ? 'sprout' : b.age < RIPE ? 'growing' : b.age < rotAt() ? 'ripe' : 'rotten');
    const weedEvery = () => 4 + 3 * L('scare');
    const barnCap = () => BARN + 20 * L('silo');
    function value(b) {
      if (b.weed) return -2;
      if (!b.seed) return 1;
      const s = stage(b);
      if (s === 'sprout') return 1;
      if (s === 'growing') return 2;
      if (s === 'ripe') return 10 + 4 * L('market');
      return L('compost') ? 0 : -5;
    }
    const cropKind = (b) => {
      const s = stage(b), veg = VEG[b.veg || 0];
      if (s === 'sprout') return b.age < 1 ? 'seed' : 'sprout';
      if (s === 'growing') return 'grow-' + veg;
      if (s === 'ripe') return veg;
      return 'rotten';
    };

    // ---------- page theme ----------
    const root = document.documentElement;
    if (!grainURL) grainURL = grainTile().toDataURL();
    root.style.setProperty('--hr-paper', `url(${grainURL})`);
    function applySeason() {
      root.dataset.hrSeason = season().key;
      root.style.setProperty('--hr-wash', `url(${pageWash(si)})`);
    }
    sh.own(() => { delete root.dataset.hrSeason; root.style.removeProperty('--hr-paper'); root.style.removeProperty('--hr-wash'); });

    // ---------- board drawing ----------
    function drawBlock(ctx, b, px, py, s, x, y, o) {
      if (o.ghost) { ctx.drawImage(ghostClod(s), px, py, s, s); return; }
      const tone = b.weed ? 7 : TONE_OF[b.ptype] != null ? TONE_OF[b.ptype] : 0;
      const v = Math.floor((b.sp || 0) * 4);
      ctx.drawImage(clod(tone, v, s), px, py, s, s);
      const onBoard = board.get(x, y) === b;
      if (b.picked) { ctx.drawImage(hole(s), px, py, s, s); return; }
      if (b.weed) { ctx.drawImage(crop('weed', s), px, py - s * HEAD, s, s * (1 + HEAD)); }
      else if (b.seed) {
        const kind = cropKind(b);
        ctx.drawImage(crop(kind, s), px, py - s * HEAD, s, s * (1 + HEAD));
        const now = performance.now();
        if (kind === 'rotten' && s >= 14) {
          const a = now / 170 + (b.sp || 0) * 20;
          const fx = px + s * (0.5 + 0.3 * Math.cos(a)), fy = py + s * (0.22 + 0.12 * Math.sin(a * 1.7));
          const flap = Math.abs(Math.sin(now / 22)) * s * 0.06 + s * 0.03;
          ctx.save();
          ctx.globalAlpha = 0.7; ctx.fillStyle = '#e8eef2';
          ctx.beginPath(); ctx.ellipse(fx - s * 0.04, fy - flap * 0.6, s * 0.05, flap, -0.5, 0, 6.28); ctx.ellipse(fx + s * 0.04, fy - flap * 0.6, s * 0.05, flap, 0.5, 0, 6.28); ctx.fill(); ctx.globalAlpha = 0.6; ctx.strokeStyle = PENCIL; ctx.lineWidth = 0.6; ctx.stroke();
          ctx.globalAlpha = 1; ctx.fillStyle = '#231a12';
          ctx.beginPath(); ctx.ellipse(fx, fy, s * 0.06, s * 0.042, 0, 0, 6.28); ctx.fill();
          ctx.restore();
        }
        if (s >= 18 && kind !== 'rotten') {
          const stg = stage(b);
          const k = stg === 'ripe' ? (rotAt() - b.age) / (rotAt() - RIPE) : b.age / RIPE;
          const col = stg === 'ripe' ? (k < 0.35 ? '#b8322a' : '#c98a12') : '#4f8f3a';
          ctx.save();
          ctx.lineCap = 'round'; ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(74,54,38,0.28)';
          ctx.beginPath(); ctx.moveTo(px + 4, py + s - 4); ctx.lineTo(px + s - 4, py + s - 4); ctx.stroke();
          ctx.strokeStyle = col;
          ctx.beginPath(); ctx.moveTo(px + 4, py + s - 4); ctx.lineTo(px + 4 + (s - 8) * Math.max(0.04, Math.min(1, k)), py + s - 4); ctx.stroke();
          ctx.restore();
          if (stg === 'ripe' && onBoard) {
            const tw = 0.5 + 0.5 * Math.sin(now / 260 + (b.sp || 0) * 9);
            const cx = px + s * 0.86, cy = py + s * 0.12, rr = s * (0.08 + 0.06 * tw);
            ctx.save(); ctx.globalAlpha = 0.35 + 0.6 * tw; ctx.fillStyle = '#f2c230'; ctx.strokeStyle = PENCIL; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(cx, cy - rr); ctx.quadraticCurveTo(cx, cy, cx + rr, cy); ctx.quadraticCurveTo(cx, cy, cx, cy + rr); ctx.quadraticCurveTo(cx, cy, cx - rr, cy); ctx.quadraticCurveTo(cx, cy, cx, cy - rr);
            ctx.fill(); ctx.stroke(); ctx.restore();
          }
        }
      }
      if (onBoard && season().freeze && y > 0 && !board.get(x, y - 1)) ctx.drawImage(snowCap(s), px, py - s * 0.08, s, s * 0.5);
    }

    const bgCache = {};
    function background(ctx, Wd, H, s) {
      const key = `${si}|${Wd}|${H}|${DPR()}`;
      let bg = bgCache[key];
      if (!bg) {
        bg = sprite('well' + key, Wd, H, (c) => {
          const S = season(), r = W.rng(500 + si);
          c.fillStyle = PAPER; c.fillRect(0, 0, Wd, H);
          c.globalAlpha = 0.7; c.fillStyle = c.createPattern(grainTile(), 'repeat'); c.fillRect(0, 0, Wd, H); c.globalAlpha = 1;
          const blobs = [[0.2, 0.15, 0.55, 0.16, 0], [0.85, 0.45, 0.45, 0.2, 1], [0.3, 0.78, 0.6, 0.18, 0], [0.75, 0.95, 0.5, 0.12, 1]];
          c.filter = 'blur(2px)';
          for (const [x, y, rx, ry, k] of blobs) {
            const pts = ell(r, x * Wd, y * H, rx * Wd, ry * H, 0.14, 12);
            c.save(); c.globalAlpha = 0.26; c.fillStyle = S.wash[k]; trace(c, pts); c.fill();
            c.globalAlpha = 0.16; c.strokeStyle = W.shade(S.wash[k], -0.18); c.lineWidth = 2.5; c.stroke(); c.restore();
          }
          c.filter = 'none';
          // faint pencilled furrows to plant along
          c.strokeStyle = PENCIL; c.lineWidth = 0.8;
          for (let x = 1; x < board.w; x++) {
            c.globalAlpha = 0.09; c.beginPath();
            for (let y = 0; y <= H; y += s) c.lineTo(x * s + (r() - 0.5) * 1.2, y);
            c.stroke();
          }
          c.setLineDash([2, 5]);
          for (let y = 1; y < board.h; y++) { c.globalAlpha = 0.08; c.beginPath(); c.moveTo(0, y * s); c.lineTo(Wd, y * s + (r() - 0.5)); c.stroke(); }
          c.setLineDash([]);
          c.globalAlpha = 1;
        });
        for (const k in bgCache) delete bgCache[k];
        bgCache[key] = bg;
      }
      ctx.fillStyle = PAPER;
      ctx.fillRect(-20, -20, Wd + 40, H + 40);
      ctx.drawImage(bg, 0, 0, Wd, H);
    }

    // Seasonal weather drifting over the board. Fixed params, positions from time: no per-frame allocation.
    const FLECKS = Array.from({ length: 48 }, (_, i) => ({ x: (i * 0.618) % 1, y: (i * 0.377) % 1, sp: 0.6 + ((i * 7) % 5) / 6, r: 0.9 + (i % 3) * 0.7, ph: i * 1.31 }));
    function weather(ctx, s, t) {
      const Wd = board.w * s, H = board.h * s, S = season();
      ctx.save();
      if (S.key === 'winter') {
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(70,110,150,0.35)'; ctx.lineWidth = 0.6;
        for (const f of FLECKS) {
          const y = ((f.y + t * 0.035 * f.sp) % 1) * H, x = (((f.x + 0.025 * Math.sin(t * 0.7 + f.ph)) % 1) + 1) % 1 * Wd;
          ctx.beginPath(); ctx.arc(x, y, f.r * (s / 24) * 1.4, 0, 6.28); ctx.fill(); ctx.stroke();
        }
      } else {
        const n = S.key === 'summer' ? 8 : 11;
        for (let i = 0; i < n; i++) {
          const f = FLECKS[i * 4];
          const y = ((f.y + t * (S.key === 'summer' ? -0.008 : 0.02) * f.sp) % 1 + 1) % 1 * H;
          const x = (((f.x + 0.05 * Math.sin(t * 0.5 + f.ph)) % 1) + 1) % 1 * Wd;
          ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.8 * f.sp + f.ph);
          ctx.globalAlpha = S.key === 'summer' ? 0.5 : 0.75;
          ctx.fillStyle = S.fleck;
          ctx.beginPath();
          if (S.key === 'summer') ctx.arc(0, 0, s * 0.06, 0, 6.28);
          else ctx.ellipse(0, 0, s * (S.key === 'autumn' ? 0.16 : 0.11), s * 0.065, 0, 0, 6.28);
          ctx.fill();
          if (S.key === 'autumn') { ctx.strokeStyle = '#7a3412'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-s * 0.16, 0); ctx.lineTo(s * 0.16, 0); ctx.stroke(); }
          ctx.restore();
        }
      }
      ctx.restore();
    }

    const view = new W.BoardView(sh.canvas, board, {
      maxCell: 30,
      grid: false,
      background,
      drawBlock,
      textFont: '"Grandstander", "Nunito", sans-serif',
      textWeight: 800,
      textStroke: PAPER,
      drawParticle(ctx, f, s) {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(f.x * s, f.y * s, f.size * 0.6, f.size * 0.42, f.life * 0.01, 0, 6.28);
        ctx.fill();
      },
      clearFlash(ctx, rows, k, s, Wd) {
        const p = Math.min(1, (1 - k) * 1.25);
        for (const y of rows) {
          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = PAPER;
          ctx.beginPath();
          ctx.moveTo(0, y * s);
          ctx.lineTo(Wd * p, y * s);
          ctx.quadraticCurveTo(Wd * p + s * 0.4, y * s + s / 2, Wd * p, y * s + s);
          ctx.lineTo(0, y * s + s);
          ctx.fill();
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = PENCIL; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(4, y * s + s * 0.5); ctx.lineTo(Wd * p, y * s + s * 0.5 + Math.sin(p * 12) * 1.5); ctx.stroke();
          ctx.restore();
        }
      },
      overlay(ctx, s) {
        const t = performance.now() / 1000;
        if (season().freeze) {
          const Wd = board.w * s;
          for (const y of board.fullRows()) {
            const top = y * s;
            ctx.save();
            ctx.globalAlpha = 0.5; ctx.fillStyle = '#dcecf8';
            ctx.fillRect(0, top, Wd, s);
            // long glints across the ice
            ctx.globalAlpha = 0.85; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) { const gx = ((i * 0.29 + y * 0.13) % 1) * Wd; ctx.moveTo(gx, top + s - 3); ctx.lineTo(gx + s * 0.7, top + 3); ctx.moveTo(gx + s * 0.35, top + s - 3); ctx.lineTo(gx + s * 0.6, top + s * 0.55); }
            ctx.stroke();
            // icicles hanging off the frozen row
            ctx.globalAlpha = 0.9; ctx.fillStyle = '#f4f9fd'; ctx.strokeStyle = '#6f97b8'; ctx.lineWidth = 0.8;
            ctx.beginPath();
            for (let x = 0; x < board.w; x++) { const ix = x * s + s * (0.3 + ((x * 7 + y) % 4) * 0.12), il = s * (0.2 + ((x * 3 + y) % 3) * 0.1); ctx.moveTo(ix - s * 0.07, top + s - 1); ctx.lineTo(ix, top + s - 1 + il); ctx.lineTo(ix + s * 0.07, top + s - 1); }
            ctx.fill(); ctx.stroke();
            ctx.globalAlpha = 0.7; ctx.strokeStyle = '#5c8db5'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(1, top + 1); ctx.lineTo(Wd - 1, top + 1); ctx.stroke();
            ctx.restore();
          }
        }
        weather(ctx, s, t);
      },
    });

    // ---------- pieces ----------
    const bag = W.bag(W.TYPES, rng);
    const queue = [];
    function pickVeg() {
      const w = VEG_WEIGHTS[si], tot = w.reduce((a, b) => a + b, 0);
      let x = rng() * tot;
      for (let i = 0; i < 4; i++) { x -= w[i]; if (x < 0) return i; }
      return 0;
    }
    function makePiece() {
      const type = bag();
      const p = W.piece(type);
      p.blocks = p.blocks.map(() => ({ color: TONES[TONE_OF[type] || 0], ptype: type, sp: rng() }));
      const r = rng() - 0.12 * L('seedbag');
      const n = r < 0.28 ? 2 : r < 0.75 ? 1 : 0;
      const idx = rng.shuffle([0, 1, 2, 3]);
      for (let i = 0; i < n; i++) Object.assign(p.blocks[idx[i]], { seed: true, age: 0, veg: pickVeg() });
      const weedChance = (0.1 + 0.04 * year) * Math.pow(0.6, L('weedkill'));
      if (rng.chance(weedChance)) Object.assign(p.blocks[idx[3]], { weed: true, seed: false });
      return p;
    }

    const st = new W.Stacker(board, {
      gravity: 1000,
      clearDelay: 300,
      next() {
        while (queue.length < 4) queue.push(makePiece());
        const p = queue.shift();
        queue.push(makePiece());
        return p;
      },
      onSpawn() { paintQueue(); },
      onHold() { paintQueue(); },
      onLock(cells) {
        const fresh = new Set(cells.map((c) => c.block));
        const frozenBefore = season().freeze ? board.fullRows().length : 0;
        grow(fresh);
        weedT++;
        if (weedT >= weedEvery()) { weedT = 0; spreadWeeds(); }
        seasonPieces++;
        if (season().freeze && board.fullRows().length > frozenBefore) {
          W.noise({ dur: 0.25, vol: 0.04, filter: 'highpass', freq: 4000 });
          pluck(1318.51, { vol: 0.03, at: 0.02 }); pluck(1760, { vol: 0.02, at: 0.09 });
          say(pickLine('freeze'), 'happy', 2);
        }
        const q = quotaFor(si, year);
        if (!warned && SEASON_LEN - seasonPieces <= 3 && SEASON_LEN - seasonPieces > 0 && coins < q) { warned = true; say(pickLine('short'), 'cross', 3); }
        paint();
      },
      findClears(b) { return season().freeze ? [] : b.fullRows(); },
      onClear(rows, rowBlocks) {
        const ripe = harvest(rows, rowBlocks);
        if (ripe) st.clearing.t = st.clearing.total = 560; // hit-stop while the veg pops out
      },
      afterClear() { paint(); },
      beforeSpawn() {
        if (over) return false;
        if (seasonPieces >= SEASON_LEN) { endSeason(); return false; }
        return true;
      },
      onTopOut() { lose('The beds overflowed'); },
    });

    function grow(fresh) {
      let rate = season().growth;
      if (season().freeze && L('green')) rate = 0.5;
      rate *= 1 + 0.25 * L('fert');
      if (!rate) return;
      let ripened = 0, rotted = 0;
      board.each((b, x, y) => {
        if (!b.seed || fresh.has(b)) return;
        const before = stage(b);
        b.age += rate;
        const after = stage(b);
        if (after !== before && after === 'ripe') { view.burst(x + 0.5, y + 0.3, '#f2c230', 6, 3); ripened++; }
        if (after !== before && after === 'rotten') { view.burst(x + 0.5, y + 0.4, '#7d7062', 6, 2); rotted++; }
      });
      if (ripened) { pluck(PENTA[9 + Math.min(3, ripened)], { vol: 0.03 }); say(pickLine('ripened'), 'happy', 1); }
      if (rotted) { W.tone({ f: 180, f2: 110, dur: 0.25, type: 'sine', vol: 0.03 }); say(pickLine('rotted'), 'cross', 2); }
    }

    function spreadWeeds() {
      const weeds = [];
      board.each((b, x, y) => { if (b.weed) weeds.push([x, y]); });
      let n = 0;
      for (const [x, y] of weeds) {
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, c]) => { const b = board.get(a, c); return b && b.seed; });
        if (!nb.length) continue;
        const [a, c] = rng.pick(nb);
        Object.assign(board.get(a, c), { weed: true, seed: false });
        view.burst(a + 0.5, c + 0.5, '#4e6b2b', 8, 3);
        n++;
      }
      if (n) { sh.log(`Weeds crept onto <b>${n}</b> seed${n > 1 ? 's' : ''}`); W.sfx('hit'); say(pickLine('weeds'), 'cross', 2); }
    }

    function harvest(rows, rowBlocks) {
      const tally = { soil: 0, sprout: 0, growing: 0, ripe: 0, rotten: 0, weed: 0 };
      const picked = [];
      let plus = 0, minus = 0;
      rowBlocks.forEach((blocks, i) => blocks.forEach((b, x) => {
        if (!b) return;
        const k = b.weed ? 'weed' : b.seed ? stage(b) : 'soil';
        tally[k]++;
        const v = value(b);
        if (v > 0) plus += v; else minus += v;
        if (k === 'ripe') { picked.push({ veg: VEG[b.veg || 0], x, y: rows[i] }); b.picked = true; view.burst(x + 0.5, rows[i] + 0.6, '#6b4a2e', 6, 4); }
        if (k === 'rotten' && v < 0) view.float(`${v}p`, x + 0.5, rows[i] + 0.3, '#b03a2e', 12);
      }));
      let mult = season().pay;
      const notes = [];
      if (mult > 1) notes.push(`autumn market ×${mult}`);
      if (rows.length > 1 && L('sickle')) { const k = 1 + 0.2 * L('sickle') * (rows.length - 1); mult *= k; notes.push(`scythe ×${k.toFixed(1)}`); }
      const total = Math.round(plus * mult + minus);
      coins = Math.max(0, coins + total);
      seasonEarned += total;
      if (total > 0) score += total;
      last = { total, tally, notes };
      view.rowBurst(rows, (b) => (b && b.weed ? '#4e6b2b' : '#7a5a3c'));
      view.float(`${total >= 0 ? '+' : ''}${total}p`, board.w / 2, rows[0] - 0.4, total >= 0 ? season().ink : '#b03a2e', rows.length >= 3 || picked.length >= 3 ? 26 : 20);
      if (picked.length >= 3 || rows.length >= 3) view.shake(6);
      if (picked.length) launch(picked);
      const parts = [];
      const vegCount = {};
      picked.forEach((p) => (vegCount[p.veg] = (vegCount[p.veg] || 0) + 1));
      for (const [vg, n] of Object.entries(vegCount)) parts.push(`${n} ${VEG_NAMES[vg][n > 1 ? 1 : 0]}`);
      if (tally.soil) parts.push(`${tally.soil} clod${tally.soil > 1 ? 's' : ''}`);
      if (tally.sprout + tally.growing) parts.push(`${tally.sprout + tally.growing} unripe`);
      if (tally.rotten) parts.push(`${tally.rotten} mush`);
      if (tally.weed) parts.push(`${tally.weed} weed${tally.weed > 1 ? 's' : ''}`);
      sh.log(`<b>${total >= 0 ? '+' : ''}${total}p</b> · ${parts.join(', ')}${notes.length ? ' · ' + notes.join(', ') : ''}`);
      // Nana's verdict
      if (picked.length >= 3) say(pickLine('big'), 'proud', 4);
      else if (picked.length) say(Math.random() < 0.5 ? pickLine(picked[0].veg) : pickLine('ripe'), 'proud', 3);
      else if (tally.rotten) say(pickLine('rotdig'), 'cross', 3);
      else if (tally.sprout + tally.growing) say(pickLine('early'), 'cross', 3);
      else say(pickLine('soil'), 'happy', 1);
      return picked.length;
    }

    // ---------- the harvest: veg pops out and arcs into the basket ----------
    const fly = W.el('canvas', 'hr-fly');
    sh.root.appendChild(fly);
    const fctx = fly.getContext('2d');
    let flyers = [], flyDirty = false, batchLeft = 0, noteI = 0;
    function sizeFly() {
      const d = DPR();
      fly.width = Math.round(window.innerWidth * d);
      fly.height = Math.round(window.innerHeight * d);
    }
    sizeFly();
    window.addEventListener('resize', sizeFly);
    sh.own(() => window.removeEventListener('resize', sizeFly));
    function launch(picked) {
      const rect = sh.canvas.getBoundingClientRect();
      const cs = rect.width / board.w;
      noteI = 0;
      batchLeft += picked.length;
      picked.forEach((p, i) => {
        flyers.push({ veg: p.veg, sx: rect.left + (p.x + 0.5) * cs, sy: rect.top + (p.y + 0.5) * cs, cs, t: -i * 70, spin: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3), popped: false });
      });
    }
    function basketTarget() {
      const r = basketCv.getBoundingClientRect();
      let x = r.left + r.width / 2, y = r.top + r.height * 0.4;
      x = Math.max(20, Math.min(window.innerWidth - 20, x));
      y = Math.max(20, Math.min(window.innerHeight - 20, y));
      return [x, y];
    }
    const POP = 300, ARC = 620;
    function stepFly(dt) {
      if (!flyers.length && !flyDirty) return;
      const d = DPR();
      fctx.setTransform(d, 0, 0, d, 0, 0);
      fctx.clearRect(0, 0, fly.width, fly.height);
      flyDirty = flyers.length > 0;
      const [tx, ty] = basketTarget();
      for (const f of flyers) {
        f.t += dt;
        if (f.t < 0) continue;
        if (!f.popped) { f.popped = true; pluck(PENTA[7 + (noteI++ % 6)], { vol: 0.035, dur: 0.3 }); }
        let x, y, sc, rot;
        if (f.t < POP) {
          const k = f.t / POP, e = 1 - Math.pow(1 - k, 3);
          x = f.sx; y = f.sy - e * f.cs * 1.4 + Math.sin(k * Math.PI) * f.cs * 0.1;
          const squash = k < 0.2 ? 1 - (0.2 - k) * 1.5 : 1 + Math.sin((k - 0.2) * 9) * 0.08 * (1 - k);
          sc = (1 + 0.6 * e) * squash; rot = Math.sin(k * 9) * 0.12 * (1 - k);
        } else {
          const k = Math.min(1, (f.t - POP) / ARC), e = k * k * (3 - 2 * k);
          const x0 = f.sx, y0 = f.sy - f.cs * 1.4, cx = (x0 + tx) / 2, cy = Math.min(y0, ty) - 140;
          x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * tx;
          y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * ty;
          sc = 1.6 - 0.85 * e; rot = f.spin * e;
          if (k >= 1) { f.done = true; arrive(f); continue; }
        }
        const cs = Math.round(f.cs), spr = crop(f.veg, cs);
        fctx.save();
        fctx.translate(x, y);
        fctx.rotate(rot);
        fctx.scale(sc, sc);
        fctx.globalAlpha = 0.18; fctx.fillStyle = PENCIL;
        fctx.beginPath(); fctx.ellipse(3, cs * 0.5, cs * 0.35, cs * 0.08, 0, 0, 6.28); fctx.fill();
        fctx.globalAlpha = 1;
        fctx.drawImage(spr, -cs / 2, -cs / 2 - cs * HEAD, cs, cs * (1 + HEAD));
        fctx.restore();
      }
      flyers = flyers.filter((f) => !f.done);
    }
    function arrive(f) {
      basket.push(f.veg);
      if (basket.length > 16) basket.shift();
      basketN++;
      pluck(PENTA[9 + (basketN % 5)], { vol: 0.04, dur: 0.35 });
      paintBasket(true);
      batchLeft--;
      if (batchLeft <= 0) { batchLeft = 0; jingle(0.05); }
    }

    // ---------- Nana and the basket (host panel) ----------
    const host = W.el('div', 'panel hr-host');
    host.innerHTML = `<canvas class="hr-nana" width="72" height="72"></canvas>
      <div class="hr-bubble"><span class="hr-name">Nana Pell</span><p class="hr-say"></p></div>
      <div class="hr-basket"><canvas width="96" height="64"></canvas><div class="hr-count"><b>0</b><span>in the basket</span></div></div>`;
    const nanaCv = host.querySelector('.hr-nana');
    const sayEl = host.querySelector('.hr-say');
    const bubble = host.querySelector('.hr-bubble');
    const basketCv = host.querySelector('.hr-basket canvas');
    const basketBox = host.querySelector('.hr-basket');
    const countEl = host.querySelector('.hr-count b');
    let mood = 'happy', sayAt = 0, sayPrio = 0;
    function paintNana() {
      const S = 72, d = DPR();
      nanaCv.width = S * d; nanaCv.height = S * d;
      const c = nanaCv.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, nanaCv.width, nanaCv.height);
      c.drawImage(nana(mood, S, season().wash[0]), 0, 0, S * d, S * d);
    }
    function say(text, md = 'happy', prio = 1) {
      const now = performance.now();
      if (now - sayAt < 2600 && prio < sayPrio) return;
      sayAt = now; sayPrio = prio;
      sayEl.textContent = text;
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
      if (md !== mood) { mood = md; paintNana(); }
    }
    function paintBasket(bump) {
      const w = 96, h = 64, d = DPR();
      basketCv.width = w * d; basketCv.height = h * d;
      const c = basketCv.getContext('2d');
      c.setTransform(d, 0, 0, d, 0, 0);
      drawBasket(c, w, h, basket);
      countEl.textContent = basketN;
      if (bump) { basketBox.classList.remove('bump'); void basketBox.offsetWidth; basketBox.classList.add('bump'); }
    }
    const mq = window.matchMedia('(max-width: 760px)');
    function placeHost() {
      if (mq.matches) sh.boardCol.prepend(host);
      else sh.side.prepend(host);
    }
    placeHost();
    mq.addEventListener('change', placeHost);
    sh.own(() => mq.removeEventListener('change', placeHost));

    // ---------- seasons ----------
    function endSeason() {
      const q = quotaFor(si, year), name = season().name;
      if (coins < q) { lose(`${name} rent missed: ${coins}p of ${q}p`); return; }
      coins -= q;
      let spoiled = 0;
      if (coins > barnCap()) { spoiled = coins - barnCap(); coins = barnCap(); }
      W.sfx('win');
      sh.log(`${name} rent paid: <b>${q}p</b>${spoiled ? ` · ${spoiled}p didn't fit in the tin` : ''}`);
      say(pickLine('paid'), 'proud', 5);
      const nextSi = (si + 1) % 4, nextYear = nextSi === 0 ? year + 1 : year;
      const offers = rng.shuffle(UPGRADES.filter((u) => L(u.id) < u.max)).slice(0, 3);
      const body = W.el('div', 'modal-body');
      const N = SEASONS[nextSi];
      body.innerHTML = `<p class="hr-letter">“That's <b>${q}p</b> to the Allotment Society, pet. <b>${coins}p</b> left in the biscuit tin${spoiled ? `, and ${spoiled}p that wouldn't fit (it only holds ${barnCap()}p)` : ''}.”</p>
        <p class="hr-next">Next up: <b style="color:${N.ink}">${N.name}</b>, rent <b>${quotaFor(nextSi, nextYear)}p</b>. ${N.rule}</p>
        <h3 class="hr-shed">Pick one thing from the shed</h3>`;
      const tiles = W.el('div', 'tiles');
      let close = null;
      offers.forEach((u, i) => {
        const t = W.el('button', 'tile hr-packet', `<span class="t-name">${W.esc(u.name)}${L(u.id) ? ` ${L(u.id) + 1}` : ''}</span><span class="t-desc">${W.esc(u.desc)}</span><span class="t-quip">${W.esc(u.quip)}</span>`);
        t.type = 'button';
        t.style.setProperty('--pk', PACKET[(i + si) % PACKET.length]);
        t.addEventListener('click', () => {
          lv[u.id] = L(u.id) + 1;
          if (u.id === 'weedkill') {
            let n = 0;
            board.each((b, x, y) => { if (b.weed) { b.weed = false; n++; view.burst(x + 0.5, y + 0.5, '#7a5a3c', 4, 3); } });
            if (n) sh.log(`The hoe turned <b>${n}</b> weeds back to soil`);
          }
          W.sfx('buy');
          close();
          nextSeason(nextSi, nextYear);
        });
        tiles.appendChild(t);
      });
      body.appendChild(tiles);
      paint();
      close = sh.modal({ title: `${name}'s done!`, body, wide: true, actions: offers.length ? [] : [{ label: 'On we go', primary: true, onClick: () => nextSeason(nextSi, nextYear) }] });
    }

    function nextSeason(nsi, ny) {
      const thaw = si === 3;
      si = nsi;
      year = ny;
      seasonPieces = 0;
      seasonEarned = 0;
      warned = false;
      st.o.gravity = Math.max(400, 1000 - 70 * year);
      applySeason();
      paintNana();
      sh.toast(`${season().name}${year ? ` · year ${year + 1}` : ''}`, 'good');
      say(pickLine(season().key), 'happy', 4);
      if (season().key === 'spring') { birdsong(); birdT = 5000; }
      if (thaw && board.fullRows().length) {
        view.float('Thaw!', board.w / 2, 6, '#2c6390', 28); view.shake(8);
        say(pickLine('thaw'), 'proud', 5);
        for (let i = 0; i < 5; i++) pluck(PENTA[14 - i * 2] || 523, { at: i * 0.07, vol: 0.03, dur: 0.3 });
      }
      paint();
      // resumes play: clears any thawed rows first, then spawns the next piece
      st.checkClears();
    }

    function lose(why) {
      if (over) return;
      over = true;
      st.paused = true;
      say(pickLine('lose'), 'cross', 9);
      paint();
      sh.overlay({
        title: 'The allotment\'s gone to seed',
        body: `<p>${why}.</p><p>${season().name}, year ${year + 1}. You dug up <b>${score.toLocaleString()}p</b> all told, and <b>${basketN}</b> ripe veg went in the basket.</p><p class="hr-quote">“${LINES.lose[0]}”</p>`,
        button: 'Start a fresh plot',
      }).then(newRun);
    }

    // ---------- sound voice ----------
    W.voice = {
      move: () => { const p = st.active; pluck(PENTA[4 + ((p ? p.x : 4) + 2) % 8], { vol: 0.018, dur: 0.18, click: false }); },
      rotate: () => { const p = st.active; pluck(PENTA[8 + ((p ? p.rot : 0) % 4)], { vol: 0.022, dur: 0.2 }); },
      lock: () => thump(0.07),
      drop: () => W.noise({ dur: 0.08, vol: 0.03, filter: 'bandpass', freq: 1400, freq2: 300, q: 0.8 }),
      clear: () => { W.noise({ dur: 0.18, vol: 0.04, filter: 'bandpass', freq: 900, freq2: 2200, q: 1.2 }); pluck(261.63, { vol: 0.035, at: 0.02 }); },
      big: () => { W.noise({ dur: 0.25, vol: 0.05, filter: 'bandpass', freq: 700, freq2: 2400, q: 1 }); [261.63, 329.63, 392, 523.25].forEach((f, i) => pluck(f, { vol: 0.035, at: i * 0.06 })); },
      buy: () => { pluck(523.25, { vol: 0.05 }); pluck(783.99, { vol: 0.05, at: 0.09 }); },
      bad: () => { [440, 392, 329.63, 293.66, 261.63].forEach((f, i) => pluck(f * 0.5, { vol: 0.05, at: i * 0.14, dur: 0.6 })); },
      win: () => jingle(0),
      coin: () => pluck(1046.5, { vol: 0.04 }),
      hit: () => { W.noise({ dur: 0.22, vol: 0.035, filter: 'highpass', freq: 2600 }); W.noise({ dur: 0.12, vol: 0.025, filter: 'bandpass', freq: 1800, at: 0.08 }); },
      tick: null,
    };

    // ---------- input ----------
    sh.stackerKeys(st, {}, { downStart: () => (st.soft = true), downEnd: () => (st.soft = false) });
    sh.pad({ left: () => st.move(-1), right: () => st.move(1), down: () => st.softDrop(), rotCW: () => st.rotate(1), rotCCW: () => st.rotate(-1), drop: () => st.hardDrop(), hold: () => st.hold() });

    // ---------- panels ----------
    const seasonPanel = W.el('div', 'panel hr-almanac');
    const payPanel = W.el('div', 'panel hr-prices');
    sh.extra.append(seasonPanel, payPanel);
    const icon = (kind, tone = 0) => sprite('icon.' + kind + tone, 26, 26, (c) => {
      c.drawImage(clod(tone, 1, 20), 3, 5, 20, 20);
      if (kind !== 'soil') c.drawImage(crop(kind, 20), 3, 5 - 6, 20, 26);
    }).toDataURL();
    const ICONS = { soil: icon('soil', 1), sprout: icon('sprout', 0), growing: icon('grow-beet', 6), ripe: icon('carrot', 1), rotten: icon('rotten', 5), weed: icon('weed', 7) };
    function paintQueue() {
      sh.setQueue(queue.slice(0, 3), { drawBlock });
      sh.setHold(st.holdPiece, { drawBlock });
    }
    function paint() {
      const S = season(), q = quotaFor(si, year), left = Math.max(0, SEASON_LEN - seasonPieces);
      sh.hud([
        { label: 'Purse · rent due', html: `${coins}p <small>of ${q}p</small>`, tone: coins >= q ? 'good' : 'accent', wide: true },
        { label: 'Season', html: `<span class="hr-season-name">${S.name}</span>` },
        { label: 'Year', value: year + 1 },
        { label: 'Plantings left', value: left, tone: left <= 3 ? 'bad' : '' },
        { label: 'Dug up in all', value: `${score}p` },
      ]);
      let ripe = 0, rotting = 0, weeds = 0;
      board.each((b) => { if (b.weed) weeds++; else if (b.seed && stage(b) === 'ripe') { ripe++; if (rotAt() - b.age <= 3) rotting++; } });
      const days = Array.from({ length: SEASON_LEN }, (_, i) => `<i class="${i < seasonPieces ? 'on' : ''}"></i>`).join('');
      seasonPanel.innerHTML = `<h3>Almanac · year ${year + 1}</h3>
        <div class="hr-wheel">${SEASONS.map((x, i) => `<span class="${i === si ? 'now' : i < si ? 'past' : ''}" style="--c:${x.ink}">${x.name}</span>`).join('')}</div>
        <div class="hr-days" aria-label="${seasonPieces} of ${SEASON_LEN} plantings">${days}</div>
        <p class="hr-rule">${S.rule}</p>
        <p class="hr-small">Rent of <b>${q}p</b> is due when the season ends. The biscuit tin keeps up to ${barnCap()}p after that. Dug up this season: ${seasonEarned}p.</p>
        <div class="chips"><span class="chip accent">${ripe} ripe</span>${rotting ? `<span class="chip bad">${rotting} going over</span>` : ''}${weeds ? `<span class="chip bad">${weeds} weed${weeds > 1 ? 's' : ''}</span>` : ''}<span class="chip">weeds creep in ${weedEvery() - weedT}</span></div>`;
      const ripeV = 10 + 4 * L('market');
      const row = (k, label, v, note) => `<img src="${ICONS[k]}" alt="" width="26" height="26"><span>${label}</span><b class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${v > 0 ? '+' : ''}${v}p</b><span class="hr-note">${note}</span>`;
      payPanel.innerHTML = `<h3>Nana's price list</h3>
        <div class="hr-price-grid">
          ${row('soil', 'Clod', 1, '')}${row('sprout', 'Seedling', 1, `0–1 plantings`)}${row('growing', 'Growing', 2, `2–${RIPE - 1}`)}
          ${row('ripe', 'Ripe veg', ripeV, `${RIPE}–${rotAt() - 1}`)}${row('rotten', 'Mush', L('compost') ? 0 : -5, `${rotAt()}+`)}${row('weed', 'Weed', -2, 'creeps onto seeds')}
        </div>
        <p class="hr-small">Seeds grow a little every time you set a clod down. The line under a crop shows it growing, then how long before it goes over.</p>
        ${last ? `<div class="chips"><span class="chip ${last.total >= 0 ? 'good' : 'bad'}">last dig ${last.total >= 0 ? '+' : ''}${last.total}p</span>${last.notes.map((n) => `<span class="chip accent">${n}</span>`).join('')}</div>` : ''}
        ${Object.keys(lv).length ? `<h3>In the shed</h3><div class="chips">${UPGRADES.filter((u) => L(u.id)).map((u) => `<span class="chip accent" title="${W.esc(u.desc)}">${u.name}${L(u.id) > 1 ? ' ' + L(u.id) : ''}</span>`).join('')}</div>` : ''}`;
    }

    function newRun() {
      board.clear();
      st.reset();
      lv = {}; coins = 0; score = 0; year = 0; si = 0; seasonPieces = 0; seasonEarned = 0; weedT = 0; over = false; last = null;
      basket = []; basketN = 0; warned = false; flyers = []; batchLeft = 0;
      queue.length = 0;
      st.o.gravity = 1000;
      applySeason();
      paintNana();
      paintBasket(false);
      sh.logEl.innerHTML = '';
      say(pickLine('intro'), 'happy', 2);
      birdsong();
      st.spawn();
      paint();
    }

    sh.loop((dt) => {
      st.update(dt);
      view.update(dt);
      view.draw(st);
      stepFly(dt);
      if (season().key === 'spring' && !over && !sh.busy()) {
        birdT -= dt;
        if (birdT <= 0) { birdsong(); birdT = 7000 + Math.random() * 9000; }
      }
    });

    // Playtest hooks for tools/shot.mjs
    sh.debug = {
      board, st, view,
      state: () => ({ coins, si, year, seasonPieces, basketN, quota: quotaFor(si, year) }),
      season(i) { nextSeason(i, year); },
      // Fill the bottom rows with a planted mix and dig them up.
      harvest(nRows = 2, ripeN = 5) {
        const types = 'IOTSZJL';
        for (let y = board.h - nRows; y < board.h; y++) for (let x = 0; x < board.w; x++) board.set(x, y, { ptype: types[(x + y) % 7], sp: ((x * 7 + y * 3) % 10) / 10 });
        for (let i = 0; i < ripeN; i++) Object.assign(board.get((i * 3 + 1) % board.w, board.h - 1 - (i % nRows)), { seed: true, age: RIPE + 1, veg: i % 4 });
        st.active = null;
        st.checkClears();
      },
      plant() {
        const types = 'IOTSZJL', r = W.rng(11);
        for (let y = board.h - 7; y < board.h; y++) for (let x = 0; x < board.w; x++) {
          if (x === 9 || r() < 0.08 * (board.h - y < 4 ? 0 : 1)) continue;
          const b = { ptype: types[Math.floor((x + y * 3) / 2) % 7], sp: r() };
          const k = r();
          if (k < 0.35) Object.assign(b, { seed: true, age: Math.floor(r() * 18), veg: Math.floor(r() * 4) });
          else if (k < 0.42) b.weed = true;
          board.set(x, y, b);
        }
        paint();
      },
      coins(n) { coins = n; paint(); },
      endSeason() { seasonPieces = SEASON_LEN; st.active = null; endSeason(); },
    };

    applySeason();
    paintNana();
    paintBasket(false);
    paint();
    view.draw(st);
    sayEl.textContent = 'Come in, pet, wipe your boots.';
    sh.overlay({
      title: 'Nana Pell\'s Allotment',
      body: `<p class="hr-quote">“Come in, pet, wipe your boots. Some of these clods have seeds in, and they grow a bit every time you set one down.”</p>
        <ul><li>Seed, sprout, then <b>ripe veg</b> after ${RIPE} plantings. Leave it past ${ROT} and it's mush.</li>
        <li>Fill a row to dig it up. Clod 1p, unripe 1–2p, <b>ripe 10p</b>, mush −5p, weed −2p.</li>
        <li>Rent is due every ${SEASON_LEN} plantings. Summer grows quick, autumn pays double, winter freezes full rows till spring.</li>
        <li>Don't rush. Let a row wait until its veg is ripe.</li></ul>`,
      button: 'Get planting',
    }).then(newRun);
  }

  // ---------- hub card art ----------
  function art(ctx, w, h) {
    const r = W.rng(5);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.8; ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat'); ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
    const washes = [[60, 30, 90, 34, '#cfe6b6'], [215, 40, 80, 30, '#f5c8d6'], [140, 100, 150, 30, '#f2d98a']];
    for (const [x, y, rx, ry, c] of washes) { ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = c; trace(ctx, ell(r, x, y, rx, ry, 0.15, 12)); ctx.fill(); ctx.restore(); }
    const s = 19, x0 = 10, base = h - 5;
    const heights = [2, 3, 2, 1, 2, 3, 2, 1, 3, 2];
    const tops = ['carrot', 'beet', 'grow-carrot', 'pumpkin', 'sprout', 'cabbage', 'rotten', 'seed', 'weed', 'beet'];
    for (let x = 0; x < 10; x++) {
      for (let k = 0; k < heights[x]; k++) {
        const y = base - (k + 1) * s, top = k === heights[x] - 1, kind = top ? tops[x] : null;
        ctx.drawImage(clod(kind === 'weed' ? 7 : TONE_OF['IOTSZJL'[(x * 2 + k) % 7]], (x + k) % 4, s), x0 + x * s, y, s, s);
        if (kind) ctx.drawImage(crop(kind, s), x0 + x * s, y - s * HEAD, s, s * (1 + HEAD));
      }
    }
    // a carrot mid-flight into the basket, with a pencilled arc
    ctx.save();
    ctx.setLineDash([3, 4]); ctx.strokeStyle = PENCIL; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0 + 3.5 * s, base - s - 12); ctx.quadraticCurveTo(150, -14, 238, 56); ctx.stroke();
    ctx.restore();
    const bs = 26;
    ctx.save(); ctx.translate(196, 24); ctx.rotate(0.7); ctx.drawImage(crop('carrot', bs), -bs / 2, -bs / 2 - bs * HEAD, bs, bs * (1 + HEAD)); ctx.restore();
    ctx.save(); ctx.translate(242, 82);
    const bc = mk(96 * DPR(), 64 * DPR()), bx = bc.getContext('2d');
    bx.setTransform(DPR(), 0, 0, DPR(), 0, 0);
    drawBasket(bx, 96, 64, ['carrot', 'beet', 'cabbage', 'carrot', 'pumpkin', 'beet']);
    ctx.drawImage(bc, -36, -24, 72, 48);
    ctx.restore();
  }

  W.register({
    id: 'harvest-rows',
    num: 5,
    title: 'Harvest Rows',
    mix: 'Allotment × falling blocks',
    pitch: 'Seeds ripen as you stack. Dig a row too early and Nana tuts; leave it too long and it\'s mush and flies.',
    palette: ['#5f8f3c', '#ee7a26', '#8a5a3a', '#f2c230', '#cfe1f1'],
    shell: { logTitle: 'Nana\'s notebook', keysHint: '← → shuffle along · ↑ / Z turn · ↓ lower · Space drop it in · C keep one in your pinny' },
    art,
    mount,
  });
})();
