// Paper cut, stage 2 The Egg (egg): "Guard your shell." design.md 6.2.
// Now you are the egg: a stack of paper rings like a target (peach cell, cream shell, a paler disc and a coral
// nucleus), set in a cloud of small paper dots (the corona) on a wine board with two faint ripple rings. A cream
// arc, the highest sheet in the box, turns round the shell; mauve sperm swim in from all sides, meet the arc and
// turn away with a little cream burst; two that came earlier rest, still, in the cloud. Your own sperm comes in
// from the open side in marigold on a cream margin, circled by cut cream dashes, with a small tag: "Let it in."
//
// Palette (hex): board #5e1c34, ripples #6c2440, corona #f2a07e / #f8c3a2 / #e07f66, cell #ffc49c, shell #fbe3d0,
// inner disc #ffd8b8, nucleus #f08c6c, arc #fff4e2, rivals #e6c4d2 (back #c99fb5, resting #d1a9bb), your sperm
// #ffc53d (back #ee951c) on #fff0cf, tag #fff0dc with ink #3a1029, shadow #1c0612.
// References: Charley Harper's concentric target forms and rows of dots (the egg and its cloud), Henri Matisse's
// "The Snail" (1953) for big flat shapes with a few strong colours, Tearaway (Media Molecule) for the cut-card
// arc and the paper bursts, Gris (Nomada Studio) for the layered depth.
// <paper-kit> Paper cut helpers, shared by paper-race.js, paper-guard.js and paper-grow.js. The same block sits in
// each file so any one of them runs alone; edit art/paper/kit.src.js and run `node paper/sync.mjs`.
// Look: flat sheets of coloured paper stacked like a shadow box. Each sheet is one flat colour with a fine grain;
// the only soft tones are the shadows between sheets (light from above and a little left).
// Sources: the layered paper-cut recipe of design tools (a drop shadow per layer plus a noise grain layer:
// Abduzeedo, "Learn How to Create Paper Cut Effect with this Photoshop Tutorial"; Red Shark Digital, "How to create
// layered cut out paper in Adobe Illustrator"), and Rex Crowle's GDC 2013 talk "Building the Touchy-Feely World of
// Tearaway" (build it the way real paper is cut, not modelled). Canvas has no cheap blur here (no ctx.filter, no
// shadowBlur), so the soft shadow is our own: the offset silhouette filled once, then stroked n times with widening
// lines clipped to its outside, each pass weak enough that the stack sums to the shadow's alpha at the edge and
// fades to nothing at the blur radius. The grain is a tiling value-noise tile (mottle, gouache streaks, specks and
// fibres) filled over each sheet as a pattern that moves and turns with that sheet.
window.PaperCut = window.PaperCut || (function () {
  const TAU = Math.PI * 2;
  const PC = { TAU };
  PC.SHADOW = '#1c0612';
  PC.LX = 0.42; PC.LY = 1;          // where shadows fall, per px of height (down and a little right)

  // A small hash for stable per-index jitter.
  PC.hash = function (i, s) { let h = Math.imul((i | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul((s | 0) + 0x9e3779b9, 0x85ebca6b); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return ((h >>> 0) / 4294967296) * 2 - 1; };

  // Tiling value noise on an nx by ny lattice (smoothstep fade).
  function tileNoise(nx, ny, seed) {
    const r = FB.rng(seed), v = new Float32Array(nx * ny);
    for (let i = 0; i < v.length; i++) v[i] = r() * 2 - 1;
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      const x0 = ((xi % nx) + nx) % nx, y0 = ((yi % ny) + ny) % ny, x1 = (x0 + 1) % nx, y1 = (y0 + 1) % ny;
      const a = v[y0 * nx + x0], b = v[y0 * nx + x1], c = v[y1 * nx + x0], d = v[y1 * nx + x1];
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    };
  }

  // The grain tile: transparent, with light and dark specks of low alpha (so it works on any paper colour).
  let tile = null, pattern = null;
  function grainTile() {
    if (tile) return tile;
    const S = 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const img = g.createImageData(S, S), D = img.data;
    const m1 = tileNoise(6, 6, 11), m2 = tileNoise(14, 14, 12), st = tileNoise(3, 56, 13), st2 = tileNoise(5, 90, 15), r = FB.rng(14);
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = i / S, y = j / S;
        const mott = 0.62 * m1(x * 6, y * 6) + 0.38 * m2(x * 14, y * 14);
        const streak = 0.6 * st(x * 3, y * 56) + 0.4 * st2(x * 5, y * 90);
        let v = 0.42 * mott + 0.34 * streak + (r() - 0.5) * 0.5;
        const sp = r();
        if (sp < 0.012) v += 0.9; else if (sp < 0.02) v -= 0.9;
        const o = (j * S + i) * 4;
        if (v > 0) { D[o] = 255; D[o + 1] = 246; D[o + 2] = 232; D[o + 3] = Math.min(255, v * 0.15 * 255); }
        else { D[o] = 40; D[o + 1] = 8; D[o + 2] = 22; D[o + 3] = Math.min(255, -v * 0.17 * 255); }
      }
    }
    g.putImageData(img, 0, 0);
    // fibres: short soft curls, drawn nine times so they wrap across the tile's edges
    const fr = FB.rng(21);
    g.lineCap = 'round';
    for (let n = 0; n < 90; n++) {
      const x0 = fr() * S, y0 = fr() * S, a = fr() * TAU, len = 5 + fr() * 16, bend = (fr() - 0.5) * 1.6;
      const light = fr() < 0.7;
      g.strokeStyle = light ? 'rgba(255,246,232,' + (0.1 + fr() * 0.12).toFixed(3) + ')' : 'rgba(40,8,22,' + (0.07 + fr() * 0.08).toFixed(3) + ')';
      g.lineWidth = 0.5 + fr() * 0.6;
      for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
        g.beginPath();
        g.moveTo(x0 + ox, y0 + oy);
        g.quadraticCurveTo(x0 + ox + Math.cos(a + bend) * len * 0.5, y0 + oy + Math.sin(a + bend) * len * 0.5, x0 + ox + Math.cos(a) * len, y0 + oy + Math.sin(a) * len);
        g.stroke();
      }
    }
    tile = cv;
    return tile;
  }
  function grainPattern() {
    if (!pattern) pattern = document.createElement('canvas').getContext('2d').createPattern(grainTile(), 'repeat');
    return pattern;
  }

  // A path through a flat point array, straight segments (scissor cuts).
  PC.path = function (pts, closed, into) {
    const p = into || new Path2D();
    if (pts.length < 4) return p;
    p.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
    if (closed !== false) p.closePath();
    return p;
  };

  // Hand cut: resample a polyline every `step` px and push each point along its normal by a slow wobble (the hand
  // drifting) plus a small per-cut jitter (each snip of the scissors). Stable for a given shape and seed.
  PC.cut = function (pts, closed, o) {
    o = o || {};
    const step = o.step || 7, amp = o.amp == null ? 1.4 : o.amp, jit = o.jitter == null ? 0.45 : o.jitter;
    const lam = o.lambda || 60, seed = o.seed || 0;
    const n = pts.length >> 1;
    if (n < 2) return pts.slice();
    const segs = closed === false ? n - 1 : n;
    // arc lengths
    let total = 0;
    const lens = new Float32Array(segs);
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n;
      lens[i] = Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]);
      total += lens[i];
    }
    const out = [];
    const R = total / (TAU * lam);
    let acc = 0, k = 0;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n;
      const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
      const L = lens[i];
      if (L < 1e-6) continue;
      const tx = (bx - ax) / L, ty = (by - ay) / L, nx = -ty, ny = tx;
      const m = Math.max(1, Math.round(L / step));
      for (let q = 0; q < m; q++, k++) {
        const f = q / m, a = acc + L * f;
        let w;
        if (closed === false) w = FB.noise2(seed * 7.1 + a / lam, seed * 3.3 + 0.5);
        else { const th = (a / total) * TAU; w = FB.noise2(seed * 7.1 + Math.cos(th) * R, seed * 3.3 + Math.sin(th) * R); }
        const d = amp * w + jit * PC.hash(k, seed);
        out.push(ax + (bx - ax) * f + nx * d, ay + (by - ay) * f + ny * d);
      }
      acc += L;
    }
    if (closed === false) out.push(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1]);
    return out;
  };

  // Circle (optionally scalloped) as a point ring with a cut wobble. o: {seed, amp, jitter, step, scallops, depth, rot}
  PC.circle = function (x, y, r, o) {
    o = o || {};
    const step = o.step || 6, n = Math.max(10, Math.round((TAU * r) / step));
    const amp = o.amp == null ? Math.min(1.4, r * 0.03) : o.amp, jit = o.jitter == null ? 0.35 : o.jitter;
    const seed = o.seed || 0, sc = o.scallops || 0, dep = o.depth || 0, rot = o.rot || 0;
    const sq = o.squash || 1;
    const out = new Array(n * 2);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU;
      let rr = r + amp * FB.noise2(seed * 5.3 + Math.cos(th) * 1.3, seed * 2.9 + Math.sin(th) * 1.3) + jit * PC.hash(i, seed);
      if (sc) rr += dep * (Math.pow(Math.abs(Math.sin((th * sc) / 2)), 0.55) - 0.6);
      const a = th + rot;
      out[i * 2] = x + Math.cos(a) * rr * sq; out[i * 2 + 1] = y + Math.sin(a) * rr / sq;
    }
    return out;
  };

  // Soft shadow of a sheet `h` px above the one below it.
  PC.shadow = function (ctx, path, h, o) {
    o = o || {};
    const rule = o.rule || 'nonzero';
    const alpha = o.alpha == null ? 0.34 : o.alpha;
    const dx = (o.lx == null ? PC.LX : o.lx) * h, dy = (o.ly == null ? PC.LY : o.ly) * h;
    const blur = o.blur == null ? 0.8 + h * 0.85 : o.blur;
    const n = Math.max(1, Math.min(8, Math.round(blur / 2.2)));
    const ga = ctx.globalAlpha;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.fillStyle = ctx.strokeStyle = o.color || PC.SHADOW;
    ctx.globalAlpha = ga * alpha;
    ctx.fill(path, rule);
    if (o.fast && blur > 0.6) {
      ctx.lineJoin = 'round';
      ctx.globalAlpha = ga * alpha * 0.5;
      ctx.lineWidth = blur;
      ctx.stroke(path);
    } else if (blur > 0.6) {
      // outside only: clip to (big rectangle minus the shape)
      const clip = new Path2D();
      clip.rect(-1e4, -1e4, 3e4, 3e4);
      clip.addPath(path);
      ctx.clip(clip, 'evenodd');
      ctx.lineJoin = 'round';
      const step = 1 - Math.pow(1 - alpha, 1 / n);
      ctx.globalAlpha = ga * step;
      for (let i = 1; i <= n; i++) { ctx.lineWidth = 2 * blur * Math.pow(i / n, 1.35); ctx.stroke(path); }
    }
    ctx.restore();
  };

  // A sheet of paper: a lit cut edge toward the light, the flat colour, then the grain.
  PC.paper = function (ctx, path, color, o) {
    o = o || {};
    const rule = o.rule || 'nonzero';
    const ga = ctx.globalAlpha;
    const e = o.edge == null ? 0.9 : o.edge;
    if (e > 0) {
      ctx.save();
      ctx.translate(-PC.LX * e * 0.6, -PC.LY * e);
      ctx.fillStyle = o.edgeColor || FB.mix(color, '#fff6ea', o.edgeMix == null ? 0.32 : o.edgeMix);
      ctx.fill(path, rule);
      ctx.restore();
    }
    ctx.fillStyle = color;
    ctx.fill(path, rule);
    // the paler core of coloured card, showing along every cut edge (inside the sheet only)
    if (o.core) {
      ctx.save();
      ctx.clip(path, rule);
      ctx.strokeStyle = o.coreColor || '#fff6ea';
      ctx.globalAlpha = ga * o.core;
      ctx.lineWidth = o.coreWidth || 2;
      ctx.lineJoin = 'round';
      ctx.stroke(path);
      ctx.restore();
    }
    const gr = o.grain == null ? 1 : o.grain;
    if (gr > 0) {
      const pat = grainPattern();
      const a = o.grainAngle || 0, s = o.grainScale || 1;
      const ca = Math.cos(a) * s, sa = Math.sin(a) * s;
      if (pat.setTransform) pat.setTransform(new DOMMatrix([ca, sa, -sa, ca, o.gx || 0, o.gy || 0]));
      ctx.globalAlpha = ga * gr;
      ctx.fillStyle = pat;
      ctx.fill(path, rule);
      ctx.globalAlpha = ga;
    }
  };

  // Shadow then sheet.
  PC.sheet = function (ctx, path, color, h, o) {
    o = o || {};
    if (h > 0) PC.shadow(ctx, path, h, Object.assign({ rule: o.rule }, o.shadow));
    PC.paper(ctx, path, color, o);
  };

  // A paper backing a little larger than the shape (a sticker's margin): stroke and fill in one colour, then grain.
  PC.margin = function (ctx, path, color, m, o) {
    o = o || {};
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2 * m;
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.stroke(path); ctx.fill(path);
    if (o.grain !== 0) {
      const pat = grainPattern();
      if (pat.setTransform) pat.setTransform(new DOMMatrix([1, 0, 0, 1, 0, 0]));
      ctx.strokeStyle = ctx.fillStyle = pat;
      ctx.globalAlpha *= o.grain == null ? 0.7 : o.grain;
      ctx.stroke(path); ctx.fill(path);
    }
    ctx.restore();
  };

  // Bake still sheets once into an offscreen canvas at device resolution, with a margin for the parallax sway, and
  // blit it every frame at its sway offset (drawImage of one bitmap is far cheaper than re-cutting the sheets).
  PC.bake = function (w, h, m, dpr, draw) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((w + 2 * m) * dpr); cv.height = Math.ceil((h + 2 * m) * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, m * dpr, m * dpr);
    draw(c);
    return { cv, m, dpr };
  };
  PC.blit = function (ctx, b, ox, oy) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // whole device pixels: an aligned copy, no resampling (the sway is slow, so the steps do not show)
    ctx.drawImage(b.cv, Math.round((ox - b.m) * b.dpr), Math.round((oy - b.m) * b.dpr));
    ctx.restore();
  };

  // A rounded rectangle as points (for tags).
  PC.roundRect = function (x, y, w, h, r, step) {
    const out = [];
    r = Math.min(r, w / 2, h / 2);
    const c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
    const m = Math.max(3, Math.round((Math.PI * 0.5 * r) / (step || 3)));
    for (const [cx, cy, a0] of c) for (let i = 0; i <= m; i++) { const a = a0 + (i / m) * Math.PI * 0.5; out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    return out;
  };

  // A small rounded paper tag with plain text. o: {size, bg, color, align, h, seed}. Returns the box.
  PC.tag = function (ctx, text, x, y, o) {
    o = o || {};
    const size = o.size || 15;
    ctx.save();
    ctx.font = (o.weight || 700) + ' ' + size + 'px ' + FB.ui.font;
    const tw = ctx.measureText(text).width;
    const padX = size * 0.8, hh = size * 1.9, ww = tw + padX * 2;
    const bx = o.align === 'right' ? x - ww : o.align === 'left' ? x : x - ww / 2, by = y - hh / 2;
    const pts = PC.cut(PC.roundRect(bx, by, ww, hh, hh / 2, 3), true, { step: 4, amp: 0.5, jitter: 0.25, seed: o.seed || 3 });
    const path = PC.path(pts);
    PC.sheet(ctx, path, o.bg || '#fff0dc', o.h == null ? 4 : o.h, { grain: 0.8, edge: 0 });
    ctx.fillStyle = o.color || '#3a1029';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, bx + ww / 2, y + size * 0.04);
    ctx.restore();
    return { x: bx, y: by, w: ww, h: hh };
  };

  // Sperm cut from one strip: a teardrop head and a ribbon tail that twists to show its back. Local +x is forward,
  // (x, y) is the head's centre, L the whole length. Returns {outline, back} paths in the caller's space.
  // o: {phase, beat (tail wave phase, radians), amp, twist}
  PC.sperm = function (x, y, ang, L, o) {
    o = o || {};
    const ph = o.phase || 0, beat = o.beat || 0, amp = o.amp == null ? 0.1 : o.amp, twist = o.twist == null ? 1 : o.twist;
    const thick = o.thick || 1, hr = o.head || 1;
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const N = 16;
    const neck = -0.13 * L, tl = 0.74 * L;
    const cx = new Float32Array(N + 1), cy = new Float32Array(N + 1), hw = new Float32Array(N + 1), tz = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      cx[i] = neck - u * tl;
      cy[i] = L * amp * Math.pow(u, 1.15) * Math.sin(u * 5.2 - beat + ph);
      hw[i] = L * (0.05 * thick * Math.pow(1 - u, 1.25) + 0.007 * thick);
      tz[i] = Math.cos(u * 5.5 - beat * 0.5 + ph * 1.7);
    }
    const up = [], lo = [];
    for (let i = 0; i <= N; i++) {
      const a = Math.max(0, i - 1), b = Math.min(N, i + 1);
      let tx = cx[b] - cx[a], ty = cy[b] - cy[a];
      const tl2 = Math.hypot(tx, ty) || 1; tx /= tl2; ty /= tl2;
      const w = hw[i] * (twist ? 0.45 + 0.55 * Math.abs(tz[i]) : 1);
      up.push(cx[i] - ty * w, cy[i] + tx * w);
      lo.push(cx[i] + ty * w, cy[i] - tx * w);
    }
    // head: an arc round the front, tapering back to the neck
    const hx = 0.055 * L, rh = 0.105 * L * hr, a0 = 0.64 * Math.PI;
    const head = [];
    const M = 14;
    for (let i = 0; i <= M; i++) { const a = -a0 + (i / M) * 2 * a0; head.push(hx + Math.cos(a) * rh, Math.sin(a) * rh); }
    // outline: the -y side of the tail from tip to neck, a shoulder, the head arc round the front from -y to +y, a
    // shoulder, then the +y side of the tail from neck to tip ("up" is the -y side, "lo" the +y side).
    const pts = [];
    const T = (lx, ly) => { pts.push(x + lx * cs - ly * sn, y + lx * sn + ly * cs); };
    for (let i = N; i >= 0; i--) T(up[i * 2], up[i * 2 + 1]);
    const sx = neck * 0.4 + (hx + Math.cos(a0) * rh) * 0.6, sy = rh * 0.6 + hw[0] * 0.3;
    T(sx, -sy);
    for (let i = 0; i <= M; i++) T(head[i * 2], head[i * 2 + 1]);
    T(sx, sy);
    for (let i = 0; i <= N; i++) T(lo[i * 2], lo[i * 2 + 1]);
    const outline = PC.path(pts);
    // back of the ribbon where it has turned over
    let back = null;
    if (twist) {
      back = new Path2D();
      let i = 1;
      while (i <= N) {
        if (tz[i] >= 0) { i++; continue; }
        const s0 = i;
        while (i <= N && tz[i] < 0) i++;
        const s1 = Math.min(N, i);
        const q = [];
        const P = (lx, ly) => q.push(x + lx * cs - ly * sn, y + lx * sn + ly * cs);
        for (let k = s0 - 1; k <= s1; k++) P(up[k * 2], up[k * 2 + 1]);
        for (let k = s1; k >= s0 - 1; k--) P(lo[k * 2], lo[k * 2 + 1]);
        PC.path(q, true, back);
      }
    }
    return { outline, back };
  };

  return PC;
})();
// </paper-kit>
(function () {
  const PC = window.PaperCut;
  const TAU = Math.PI * 2;
  const sm = FB.smoothstep;
  const C = {
    board: '#5e1c34', ripple: '#6c2440', corona: ['#f2a07e', '#f8c3a2', '#e07f66'],
    cell: '#ffc49c', shell: '#fbe3d0', inner: '#ffd8b8', nucleus: '#f08c6c', arc: '#fff4e2',
    rival: '#e6c4d2', rivalBack: '#c99fb5', rest: '#d1a9bb', you: '#ffc53d', youBack: '#ee951c', margin: '#fff0cf',
    tag: '#fff0dc', ink: '#3a1029'
  };
  const T = 12, W = TAU / T;
  const R_CELL = 18, R_SHELL0 = 16.5, R_SHELL1 = 21, R_IN = 11.5, R_NUC = 4.6;  // u
  const COR0 = 22, COR1 = 35;
  const ARC0 = 25.2, ARC1 = 28.8, HALF = (35 * Math.PI) / 180;
  const RA = 31.5;                                   // where a rival meets the arc
  const V = 12;                                      // rival swim speed (u/s)
  const GOLD = (140 * Math.PI) / 180;                // your sperm's side (screen angle, y down)
  // the arc's centre angle over the loop: it sweeps the upper side and right, never the gold side
  const arcAt = (t) => -0.62 + 1.8 * Math.sin(W * t) + 0.25 * Math.sin(2 * W * t + 1.0);
  const arcVel = (t) => 1.8 * W * Math.cos(W * t) + 0.5 * W * Math.cos(2 * W * t + 1.0);
  // rivals: each meets the arc once per loop, near its centre, and is carried on the way the arc turns
  const RIVALS = [];
  (function () {
    const r = FB.rng('paper-guard-rivals');
    for (let i = 0; i < 10; i++) {
      const ti = (i + 0.35) * (T / 10) + (r() - 0.5) * 0.3;
      const dir = Math.sign(arcVel(ti)) || 1;
      RIVALS.push({ ti, off: (r() - 0.5) * 0.35, spread: dir * (0.45 + r() * 0.35), nb: 14 + (i % 5), ph: r() * TAU, v: 11 + r() * 3 });
    }
  })();
  const wrap = (x) => x - T * Math.round(x / T);

  FB.scene('paper-guard', {
    title: 'The Egg (paper cut)',
    stage: 'Stage 2 · egg',
    caption: 'Cut paper: the egg is a stack of rings; the cream arc turns the others away.',
    still: 7.2,
    init(w, h) {
      const tall = h >= w;
      const k = Math.min(w, h) / 100;
      const cx = w * 0.5, cy = tall ? h * 0.47 : h * 0.5;
      const hs = Math.sqrt(k / 3.9);
      const r = FB.rng('paper-corona');
      const dots = [];
      // dart throwing: cells larger near the shell, smaller outward, never overlapping
      for (let tries = 0; tries < 3000 && dots.length < 90; tries++) {
        const a = r() * TAU, d = COR0 + (COR1 - COR0) * Math.pow(r(), 0.9);
        const rr = (1.5 + r() * 1.7) * (1 - ((d - COR0) / (COR1 - COR0)) * 0.45);
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        let ok = true;
        for (const q of dots) { const dx = q.x - x, dy = q.y - y; if (dx * dx + dy * dy < (q.r + rr + 0.45) * (q.r + rr + 0.45)) { ok = false; break; } }
        if (!ok) continue;
        dots.push({ a, d, x, y, r: rr, c: C.corona[(r() * 3) | 0], seed: 40 + dots.length, f: r() * TAU, h: 1.4 + r() * 1.6 });
      }
      // two rivals that came earlier, resting in the cloud
      const resting = [{ a: 0.95, d: 34, ang: 0.95 + 1.7 }, { a: -2.35, d: 34.5, ang: -2.35 - 1.65 }];
      return { tall, k, cx, cy, hs, dots, resting };
    },
    draw(ctx, w, h, t, st) {
      const { k, cx, cy, hs } = st;
      const swx = (2.2 * Math.sin(W * t) + 0.9 * Math.sin(2 * W * t + 0.7)) * hs, swy = (1.6 * Math.cos(W * t + 0.3)) * hs;
      const at = (d) => ctx.setTransform(FB.dpr, 0, 0, FB.dpr, FB.dpr * swx * d, FB.dpr * swy * d);
      const P = (a, d) => [cx + Math.cos(a) * d * k, cy + Math.sin(a) * d * k];

      // 1. board and ripple rings
      at(-0.6);
      const full = new Path2D(); full.rect(-20, -20, w + 40, h + 40);
      PC.paper(ctx, full, C.board, { edge: 0, grainAngle: 0.5 });
      at(-0.4);
      for (const [r0, r1, sd] of [[50, 52.6, 1], [68, 69.8, 2]]) {
        const ring = PC.path(PC.circle(cx, cy, r1 * k, { seed: sd, step: 7, amp: 1.2 }));
        PC.path(PC.circle(cx, cy, r0 * k, { seed: sd + 10, step: 7, amp: 1.2 }), true, ring);
        PC.sheet(ctx, ring, C.ripple, 2 * hs, { rule: 'evenodd', edge: 0.8, grainAngle: sd });
      }

      // 2. the corona: small paper cells drifting a little round the egg
      at(-0.1);
      const spin = 0.04 * Math.sin(W * t);
      const cells = [];
      for (const d of st.dots) {
        const a = d.a + spin + 0.02 * Math.sin(W * 2 * t + d.f), dd = d.d + 0.5 * Math.sin(W * 3 * t + d.f);
        const [x, y] = P(a, dd);
        cells.push([PC.path(PC.circle(x, y, d.r * k, { seed: d.seed, step: 3, amp: 0.3, jitter: 0.2 })), d]);
      }
      for (const [p, d] of cells) PC.shadow(ctx, p, d.h * hs, { fast: true, alpha: 0.32 });
      for (const [p, d] of cells) PC.paper(ctx, p, d.c, { edge: 0.6, grain: 0 });
      // resting rivals, lying still in the cloud
      for (const rr of st.resting) {
        const [x, y] = P(rr.a + spin, rr.d);
        const s = PC.sperm(x, y, rr.ang, 11 * k, { beat: 0.6, phase: 1.2, amp: 0.05, twist: 0 });
        PC.shadow(ctx, s.outline, 1.6 * hs, { fast: true, alpha: 0.3 });
        PC.paper(ctx, s.outline, C.rest, { edge: 0.4, grain: 0.4 });
      }

      // 3. the egg: rings stacked like a target, each a sheet higher than the last
      at(0.2);
      const cell = PC.path(PC.circle(cx, cy, R_CELL * k, { seed: 3, step: 5, amp: 0.9 }));
      PC.sheet(ctx, cell, C.cell, 5 * hs, { edge: 1, grainAngle: 0.2, shadow: { alpha: 0.36 } });
      at(0.35);
      const inner = PC.path(PC.circle(cx - 0.6 * k, cy - 0.9 * k, R_IN * k, { seed: 5, step: 5, amp: 0.8 }));
      PC.sheet(ctx, inner, C.inner, 2 * hs, { edge: 0.8, grainAngle: 1.3 });
      const nuc = PC.path(PC.circle(cx - 3.2 * k, cy - 3.6 * k, R_NUC * k, { seed: 6, step: 3, amp: 0.4 }));
      PC.sheet(ctx, nuc, C.nucleus, 2.2 * hs, { edge: 0.7, grainAngle: 2.1 });
      at(0.5);
      const shell = PC.path(PC.circle(cx, cy, R_SHELL1 * k, { seed: 7, step: 5, amp: 0.9 }));
      PC.path(PC.circle(cx, cy, R_SHELL0 * k, { seed: 8, step: 5, amp: 0.7 }), true, shell);
      PC.sheet(ctx, shell, C.shell, 3.5 * hs, { rule: 'evenodd', edge: 1, edgeMix: 0.4, grainAngle: 0.9, shadow: { alpha: 0.34 } });

      // 4. sperm: rivals swim in, meet the arc and turn away; yours comes in from the open side
      at(0.6);
      const sp = [], pops = [];
      for (const rv of RIVALS) {
        const dt = wrap(t - rv.ti);
        const th = arcAt(rv.ti) + rv.off + rv.spread * sm(-0.2, 1.4, dt);
        const c = 0.32;
        const d = RA + rv.v * (Math.sqrt(dt * dt + c * c) - c) * (dt < 0 ? 1 : 0.85);
        // heading from the motion: radial speed and the sideways drift after the bounce
        const vr = rv.v * (dt / Math.sqrt(dt * dt + c * c)) * (dt < 0 ? 1 : 0.85);
        const vt = d * rv.spread * (dt > -0.2 && dt < 1.4 ? (6 * (dt + 0.2) * (1.4 - dt)) / Math.pow(1.6, 3) : 0);
        const ang = Math.atan2(Math.sin(th) * vr + Math.cos(th) * vt, Math.cos(th) * vr - Math.sin(th) * vt);
        const [x, y] = P(th, d);
        if (x < -60 || x > w + 60 || y < -60 || y > h + 60) continue;
        sp.push(PC.sperm(x, y, ang, 13 * k, { beat: W * rv.nb * t, phase: rv.ph, amp: 0.1 }));
        if (dt > -0.1 && dt < 0.8) pops.push([arcAt(rv.ti) + rv.off, (dt + 0.1) / 0.9]);
      }
      for (const s of sp) PC.shadow(ctx, s.outline, 4 * hs, { fast: true, alpha: 0.3 });
      for (const s of sp) { PC.paper(ctx, s.outline, C.rival, { edge: 0.6, grain: 0.5 }); ctx.fillStyle = C.rivalBack; ctx.fill(s.back); }

      // your sperm: swims in and out a little at the open side, head to the shell
      const gd = 30.5 + 3.2 * Math.cos(W * t), ga = GOLD + 0.05 * Math.sin(W * 2 * t);
      const [gx, gy] = P(ga, gd + 4.2);
      const gAng = ga + Math.PI + 0.06 * Math.sin(W * 3 * t);
      at(0.8);
      // dashed ring of cut cream marks round your sperm's head
      const ringR = 5.4 * k, nd = 12, rot = W * t;
      const hx = gx + Math.cos(gAng) * 14 * k * 0.06, hy = gy + Math.sin(gAng) * 14 * k * 0.06;
      const dash = new Path2D();
      for (let i = 0; i < nd; i++) {
        const a0 = rot + (i / nd) * TAU, a1 = a0 + (TAU / nd) * 0.5;
        const q = [];
        for (let j = 0; j <= 4; j++) { const a = a0 + (a1 - a0) * (j / 4); q.push(hx + Math.cos(a) * (ringR + 0.7 * k), hy + Math.sin(a) * (ringR + 0.7 * k)); }
        for (let j = 4; j >= 0; j--) { const a = a0 + (a1 - a0) * (j / 4); q.push(hx + Math.cos(a) * (ringR - 0.7 * k), hy + Math.sin(a) * (ringR - 0.7 * k)); }
        PC.path(q, true, dash);
      }
      PC.sheet(ctx, dash, C.margin, 3 * hs, { edge: 0.5, grain: 0.5 });
      at(1.0);
      const you = PC.sperm(gx, gy, gAng, 14.5 * k, { beat: W * 20 * t, phase: 0.4, amp: 0.1, thick: 1.35, head: 1.18 });
      const mg = 2.4 * hs;
      PC.shadow(ctx, you.outline, 6.5 * hs, { alpha: 0.4, blur: 0.8 + 6.5 * hs * 0.85 + mg });
      PC.margin(ctx, you.outline, C.margin, mg);
      PC.paper(ctx, you.outline, C.you, { edge: 0.9, edgeMix: 0.45, grain: 0.7 });
      ctx.fillStyle = C.youBack; ctx.fill(you.back);

      // 5. the arc, the highest sheet: a cream band with round ends, turning round the shell
      at(1.3);
      const A = arcAt(t);
      const arcPts = [];
      const n = 28, rm = (ARC0 + ARC1) / 2, rc = (ARC1 - ARC0) / 2;
      for (let i = 0; i <= n; i++) { const a = A - HALF + (2 * HALF * i) / n; arcPts.push(cx + Math.cos(a) * ARC1 * k, cy + Math.sin(a) * ARC1 * k); }
      for (let j = 1; j < 8; j++) { const b = A + HALF + (j / 8) * Math.PI; const ex = cx + Math.cos(A + HALF) * rm * k, ey = cy + Math.sin(A + HALF) * rm * k; arcPts.push(ex + Math.cos(b) * rc * k, ey + Math.sin(b) * rc * k); }
      for (let i = n; i >= 0; i--) { const a = A - HALF + (2 * HALF * i) / n; arcPts.push(cx + Math.cos(a) * ARC0 * k, cy + Math.sin(a) * ARC0 * k); }
      for (let j = 1; j < 8; j++) { const b = A - HALF + Math.PI + (j / 8) * Math.PI; const ex = cx + Math.cos(A - HALF) * rm * k, ey = cy + Math.sin(A - HALF) * rm * k; arcPts.push(ex + Math.cos(b) * rc * k, ey + Math.sin(b) * rc * k); }
      const arc = PC.path(PC.cut(arcPts, true, { step: 5, amp: 0.5, jitter: 0.25, seed: 77 }));
      PC.sheet(ctx, arc, C.arc, 10 * hs, { edge: 1, edgeMix: 0.5, grainAngle: 0.3, shadow: { alpha: 0.4 } });
      // where a rival met the arc: a thin cut ring that opens out and thins away (design.md 6.2 "a small soft ring")
      for (const [th, p] of pops) {
        if (p < 0 || p > 1) continue;
        const e = FB.ease.out(p), wd = (0.9 * (1 - p) + 0.12) * k;
        const bx = cx + Math.cos(th) * (ARC1 + 1.2) * k, by = cy + Math.sin(th) * (ARC1 + 1.2) * k;
        const rr = (1.4 + 3.6 * e) * k;
        const ring = PC.path(PC.circle(bx, by, rr + wd, { step: 2.5, amp: 0.2, jitter: 0.1, seed: 9 }));
        PC.path(PC.circle(bx, by, Math.max(0.5, rr - wd), { step: 2.5, amp: 0.2, jitter: 0.1, seed: 10 }), true, ring);
        PC.sheet(ctx, ring, C.arc, 3 * hs * (1 - p), { rule: 'evenodd', edge: 0, grain: 0, shadow: { fast: true, alpha: 0.3 } });
      }

      // 6. the tag, beyond your sperm's tail
      at(1.5);
      const fs = Math.round(FB.clamp(Math.min(w, h) * 0.04, 14, 17));
      const [lx, ly] = P(GOLD, 50);
      PC.tag(ctx, 'Let it in.', Math.max(16 + fs * 3, lx), ly + 2 * k, { size: fs, bg: C.tag, color: C.ink, h: 4 * hs });
      ctx.setTransform(FB.dpr, 0, 0, FB.dpr, 0, 0);
    }
  });
})();
