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
