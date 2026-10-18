// Paper cut, stage 1 The Race (swim): "Drag to swim." design.md 6.1.
// A shadow box of cut paper. The tube is a channel whose walls are three stacked sheets of plum paper, darker toward
// the viewer (a tunnel book, lit from behind and above), punched with rows of round cells, over a rose floor.
// Crescents of paler rose slide forward along the floor (the waves), paper dots drift back with the current. Ahead the tube forks: the egg's side
// is laid with coral paper, an amber lane and cream chevrons that creep forward; the other side is dim lilac and
// bends away. Twenty sperm are cut from single strips (teardrop head, ribbon tail that twists to show its back):
// rivals in pale mauve, you in marigold mounted on cream card, on a higher sheet with the deepest shadow. A cream tag
// at the top reads your place. Layers sway in parallax; the shadows stay put.
//
// Palette (hex): floor #86355a, floor dots #9b4a6c and #702b4c, wave bands #a3536f, walls #64224a / #4c1839 /
// #36102a (inner to outer), warm side #e8834f, lane #f6ab48, chevrons #fde7c6, cool side #4e3a5e, rivals #e6c4d2
// (back #c99fb5), you #ffc53d (back #ee951c) on cream card #fff0cf, tag #fff0dc with ink #3a1029, shadow #1c0612.
// References: Henri Matisse, "The Snail" (1953) and "Polynesia, the Sky" (1946) for flat cut shapes floating on
// fields of colour; Charley Harper's flat geometric nature prints for the reduced forms and rows of dots; Tearaway (Media Molecule)
// for paper that is cut, not modelled; Gris (Nomada Studio) for layered silhouettes that darken toward the viewer.
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
  const sm = FB.smoothstep, lerp = FB.lerp;
  const C = {
    floor: '#86355a', dotLight: '#9b4a6c', dotDark: '#702b4c', wave: '#a3536f',
    walls: ['#64224a', '#4c1839', '#36102a'],
    warm: '#e8834f', lane: '#f6ab48', chevron: '#fde7c6', cool: '#4e3a5e',
    rival: '#e6c4d2', rivalBack: '#c99fb5', you: '#ffc53d', youBack: '#ee951c', margin: '#fff0cf',
    tag: '#fff0dc', ink: '#3a1029'
  };
  const T = 12;                          // loop (s); every motion repeats a whole number of times per loop
  const W = TAU / T;
  const SF = 40, TW = 0.72, TC = 1.05, HB = 16, HBC = 13;
  const softplus = (u) => (u > 30 ? u : 6 * Math.log(1 + Math.exp(u / 6)));
  const Bw = (s) => TW * softplus(s - SF), Bc = (s) => TC * softplus(s - SF);
  function smax(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; }
  const hm = (s) => lerp(31, 23, sm(SF - 70, SF - 4, s));
  const outerL = (s) => -smax(hm(s), Bw(s) + HB, 9);
  const outerR = (s) => smax(hm(s), Bc(s) + HBC, 9);
  const septL = (s) => -(Bw(s) - HB), septR = (s) => Bc(s) - HBC;
  const mid = (s) => (septL(s) + septR(s)) / 2;
  const D = [0, 5, 10];                  // how far each wall sheet stands back from the lumen (u)
  const wob = (i, s) => 1.5 * FB.noise2(s * 0.06 + i * 13.1, 4.2 + i * 2.7);

  // The pack: two ahead of you, seventeen behind (course units: ds along, lane across, - is the warm side).
  const PACK = [{ ds: 19, lane: 11 }, { ds: 10, lane: -14 }];
  (function () {
    const lanes = [-17, 5, 19, -7, 12, -21, 0, 16, -12, 8, -23, 21, -3, 13, -16, 4, 20];
    const r = FB.rng('paper-pack');
    for (let i = 0; i < lanes.length; i++) PACK.push({ ds: -9 - i * 4.0 + (r() - 0.5) * 3, lane: lanes[i] + (r() - 0.5) * 4 });
    PACK.forEach((p, i) => { p.n1 = 1 + (i % 2); p.n2 = 1 + ((i + 1) % 3 === 0 ? 1 : 0); p.f1 = r() * TAU; p.f2 = r() * TAU; p.nb = 14 + (i % 5); p.ph = r() * TAU; p.ga = r() * TAU; });
  })();
  const ord = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

  function rivalAt(p, t, o) {
    o.ds = p.ds + 2.2 * Math.sin(W * p.n1 * t + p.f1);
    o.lane = p.lane + 2.6 * Math.sin(W * p.n2 * t + p.f2);
    o.dl = 2.6 * W * p.n2 * Math.cos(W * p.n2 * t + p.f2);
    return o;
  }

  FB.scene('paper-race', {
    title: 'The Race (paper cut)',
    stage: 'Stage 1 · swim',
    caption: 'Cut paper: you are the marigold strip; the egg\'s side is laid in coral.',
    still: 2.2,
    init(w, h) {
      const tall = h >= w;
      const k = Math.min(w, h) / 100;
      const sx = tall ? w * 0.5 : w * 0.42, sy = tall ? h * 0.56 : h * 0.5;
      const X = tall ? (s, l) => sx + l * k : (s, l) => sx + s * k;
      const Y = tall ? (s, l) => sy - s * k : (s, l) => sy + l * k;
      const sMin = tall ? -(h - sy) / k : -sx / k, sMax = tall ? sy / k : (w - sx) / k;
      const s0 = sMin - 14, s1 = sMax + 40;
      const map = (a) => { const o = new Array(a.length); for (let i = 0; i < a.length; i += 2) { o[i] = X(a[i], a[i + 1]); o[i + 1] = Y(a[i], a[i + 1]); } return o; };
      const hs = Math.sqrt(k / 3.9);     // shadow and sway scale (1 on a phone)
      const cutWall = (pts, seed) => PC.path(PC.cut(map(pts), true, { step: 7, amp: 1.7 * hs, jitter: 0.5, seed, lambda: 50 }));

      // wall sheets: left (warm side outer wall), right (cool side outer wall), septum
      const walls = D.map((d, i) => {
        const L = [], R = [];
        for (let s = s0; s <= s1; s += 1.2) { L.push(s, outerL(s) - d + wob(i, s)); R.push(s, outerR(s) + d + wob(i + 5, s)); }
        L.push(s1, -600, s0, -600); R.push(s1, 600, s0, 600);
        // septum: its tip is where the two inner edges (each pulled back by d) meet
        let a = SF, b = s1;
        const gap = (s) => (septR(s) - d) - (septL(s) + d);
        for (let n = 0; n < 40; n++) { const m = (a + b) / 2; if (gap(m) > 0) b = m; else a = m; }
        const si = (a + b) / 2, rho = 6, sa = si + rho;
        const S = [];
        for (let s = s1; s > sa; s -= 1.2) S.push(s, septL(s) + d + wob(i + 9, s));
        const le = septL(sa) + d + wob(i + 9, sa), re = septR(sa) - d + wob(i + 11, sa), cl = (le + re) / 2;
        for (let j = 0; j <= 10; j++) { const u = j / 10, v = 1 - u; S.push(v * v * sa + 2 * u * v * (si - rho * 0.45) + u * u * sa, v * v * le + 2 * u * v * cl + u * u * re); }
        for (let s = sa + 1.2; s <= s1; s += 1.2) S.push(s, septR(s) - d + wob(i + 11, s));
        S.push(s1 + 60, cl);
        const out = { L: cutWall(L, 10 + i), R: cutWall(R, 20 + i), S: cutWall(S, 30 + i), tip: si };
        if (i >= 1) {
          // punched cells, in rows that follow the sheet's edge (tissue, after Harper's rows of dots)
          const hr = FB.rng('paper-holes' + i);
          const rows = i === 2 ? 5 : 1, gapS = i === 2 ? 6.2 : 7.5;
          const punch = (s, l, rr, path) => { const x = X(s, l), y = Y(s, l); if (x < -20 || x > w + 20 || y < -20 || y > h + 20) return; PC.path(PC.circle(x, y, rr * k, { seed: (hr() * 1e4) | 0, step: 2.5, amp: 0.25, jitter: 0.15 }), true, path); };
          for (let r = 0; r < rows; r++) {
            const off = (i === 2 ? 4.2 : 2.6) + r * 5.6, stag = (r % 2) * gapS * 0.5;
            for (let s = s0 + stag; s < s1; s += gapS) {
              if (hr() < 0.3) continue;
              const rr = (1.15 + hr() * 0.8) * (1 - r * 0.08);
              punch(s, outerL(s) - d + wob(i, s) - off, rr, out.L);
              punch(s + gapS * 0.3, outerR(s + gapS * 0.3) + d + wob(i + 5, s + gapS * 0.3) + off, rr, out.R);
              const ss = s + gapS * 0.6, le2 = septL(ss) + d + off, re2 = septR(ss) - d - off;
              if (ss > si + 4 && re2 - le2 > 2.4 * rr) { punch(ss, le2 + rr, rr, out.S); if (re2 - le2 > 6 * rr) punch(ss + gapS * 0.4, re2 - rr, rr, out.S); }
            }
          }
        }
        return out;
      });

      // the warm and cool floors at the fork, each starting with a rounded cut
      const sStart = SF - 8;
      const warm = [], cool = [];
      for (let s = s1; s > sStart; s -= 1.5) warm.push(s, outerL(s) - 14);
      for (let j = 0; j <= 12; j++) { const u = j / 12; warm.push(sStart - 7 * Math.sin(Math.PI * u), lerp(outerL(sStart) - 14, mid(sStart), u)); }
      for (let s = sStart; s <= s1; s += 1.5) warm.push(s, mid(s));
      for (let s = s1; s > sStart; s -= 1.5) cool.push(s, mid(s));
      for (let j = 0; j <= 12; j++) { const u = j / 12; cool.push(sStart - 5 * Math.sin(Math.PI * u), lerp(mid(sStart), outerR(sStart) + 14, u)); }
      for (let s = sStart; s <= s1; s += 1.5) cool.push(s, outerR(s) + 14);
      const warmP = PC.path(PC.cut(map(warm), true, { step: 6, amp: 1.2, seed: 41 }));
      const coolP = PC.path(PC.cut(map(cool), true, { step: 6, amp: 1.2, seed: 42 }));
      // the amber lane along the warm branch's middle, rounded at its start
      const lane = [], l0 = sStart + 9, lw = 4.6;
      for (let s = s1; s > l0; s -= 1.5) lane.push(s, -Bw(s) - lw);
      for (let j = 0; j <= 10; j++) { const a = Math.PI / 2 + (j / 10) * Math.PI; lane.push(l0 + Math.cos(a) * lw * 1.1, -Bw(l0) - Math.sin(a) * lw); }
      for (let s = l0; s <= s1; s += 1.5) lane.push(s, -Bw(s) + lw);
      const laneP = PC.path(PC.cut(map(lane), true, { step: 6, amp: 0.8, seed: 43 }));

      // floor dots and wave bands drift on the floor; their spans wrap exactly once or twice per loop
      const r = FB.rng('paper-dots');
      const dots = [];
      for (let i = 0; i < 34; i++) dots.push({ s: r(), l: (r() - 0.5) * 70, r: 0.7 + r() * r() * 2.2, c: r() < 0.55 ? C.dotLight : C.dotDark, seed: 100 + i });
      // a scalloped band across the tube (in course space, centred on s = 0), cut once and moved
      const band = [];
      // a crescent: its middle runs ahead and is thickest
      const bow = (l) => -15 * (l / 36) * (l / 36);
      const thk = (l) => 1.2 + 4.2 * Math.max(0, 1 - (l / 40) * (l / 40));
      for (let j = 0; j <= 60; j++) { const l = -44 + (88 * j) / 60; band.push(bow(l) + thk(l), l); }
      for (let j = 60; j >= 0; j--) { const l = -44 + (88 * j) / 60; band.push(bow(l) - thk(l) * 0.35, l); }
      return { tall, k, sx, sy, X, Y, sMin, sMax, s0, s1, hs, walls, warmP, coolP, laneP, dots, band, ro: {}, ro2: {} };
    },
    draw(ctx, w, h, t, st) {
      const { tall, k, X, Y, sMin, sMax, hs } = st;
      const tau = ((t % T) + T) % T;
      const base = tall ? -Math.PI / 2 : 0;
      // parallax: one sway vector, each sheet moves by it times its depth
      const swx = (2.4 * Math.sin(W * t) + 1.0 * Math.sin(2 * W * t + 1.2)) * hs, swy = 1.7 * Math.cos(W * t + 0.5) * hs;
      const at = (d) => ctx.setTransform(FB.dpr, 0, 0, FB.dpr, FB.dpr * swx * d, FB.dpr * swy * d);
      const span = sMax - sMin + 16;

      // still sheets, baked once per size and pixel ratio
      const dpr = FB.dpr;
      if (!st.bk || st.bk.dpr !== dpr) {
        const m = 14 * hs;
        st.bk = {
          dpr,
          walls: PC.bake(w, h, m, dpr, (c) => {
            const hts = [9, 4.5, 4.5];
            for (let i = 0; i < 3; i++) {
              const wl = st.walls[i];
              for (const [p, s] of [[wl.L, 1], [wl.R, 2], [wl.S, 3]]) PC.sheet(c, p, C.walls[i], hts[i] * hs, { rule: 'evenodd', edge: 1.2, edgeMix: 0.22, grainAngle: i * 0.9 + s, shadow: { alpha: 0.38 } });
            }
          })
        };
      }

      // 1. floor
      at(-0.5);
      const full = new Path2D(); full.rect(-20, -20, w + 40, h + 40);
      PC.paper(ctx, full, C.floor, { edge: 0, grainAngle: 0.3 });

      // 2. dots drift back with the current (one span per loop)
      at(-0.35);
      for (const d of st.dots) {
        const s = sMin - 8 + ((((d.s * span - (span / T) * tau) % span) + span) % span);
        const p = PC.path(PC.circle(X(s, d.l), Y(s, d.l), d.r * k, { seed: d.seed, step: 3, amp: 0.3 }));
        PC.shadow(ctx, p, 1.2 * hs, { fast: true, alpha: 0.3 });
        PC.paper(ctx, p, d.c, { edge: 0.5, grain: 0 });
      }
      // 3. wave bands roll forward (two spacings per loop)
      const gap = 46, M = Math.ceil(span / gap) + 2;
      for (let n = 0; n < M; n++) {
        const sw = sMin - 12 + ((n * gap + (2 * gap / T) * tau) % (gap * M));
        if (sw > SF + 20 || sw < sMin - 12) continue;
        const b = st.band, q = new Array(b.length);
        for (let i = 0; i < b.length; i += 2) { q[i] = X(sw + b[i], b[i + 1]); q[i + 1] = Y(sw + b[i], b[i + 1]); }
        PC.sheet(ctx, PC.path(q), C.wave, 1.8 * hs, { edge: 1, grainAngle: 1.1 + n });
      }

      // 4. the fork's floors, the lane and its chevrons (drawn each frame: in SwiftShader three fills of these
      // shapes cost less than one large drawImage)
      at(-0.2);
      PC.sheet(ctx, st.coolP, C.cool, 2.2 * hs, { grainAngle: 2.2 });
      PC.sheet(ctx, st.warmP, C.warm, 2.2 * hs, { grainAngle: 0.7 });
      PC.sheet(ctx, st.laneP, C.lane, 1.6 * hs, { grainAngle: 1.9 });
      const cg = 11, c0 = SF + 4;
      for (let i = 0; i < 12; i++) {
        const s = c0 + ((i * cg + (2 * cg / T) * tau) % (12 * cg));
        if (s > sMax + 12) continue;
        const l = -Bw(s), dl = -(Bw(s + 0.5) - Bw(s - 0.5));
        const nrm = Math.hypot(1, dl), fs = 1 / nrm, fl = dl / nrm;
        const fade = sm(c0, c0 + 8, s);
        if (fade < 0.02) continue;
        const arm = 4.4 * fade, span2 = 3.6 * fade, th = 1.5 * fade;
        const V = [];
        const P = (a, b) => V.push(X(s + fs * a - fl * b, l + fl * a + fs * b), Y(s + fs * a - fl * b, l + fl * a + fs * b));
        P(1.6, 0); P(-arm + 1.6, span2); P(-arm + 1.6 - th, span2); P(1.6 - th, 0); P(-arm + 1.6 - th, -span2); P(-arm + 1.6, -span2);
        const p = PC.path(PC.cut(V, true, { step: 3, amp: 0.25, jitter: 0.2, seed: 300 + i }));
        PC.shadow(ctx, p, 1.3 * hs * fade, { fast: true, alpha: 0.32 });
        PC.paper(ctx, p, C.chevron, { edge: 0.4, grain: 0.7 });
      }

      // 5. the pack: every shadow first (one height), then the paper
      at(0.4);
      const L = 14 * k, LY = 18 * k;
      const shapes = [];
      let ahead = 0;
      for (let i = 0; i < PACK.length; i++) {
        const p = PACK[i], o = rivalAt(p, t, st.ro);
        if (o.ds > 0) ahead++;
        const x = X(o.ds, o.lane), y = Y(o.ds, o.lane);
        if (x < -L || x > w + L || y < -L || y > h + L) continue;
        const ang = base + Math.atan2(o.dl, 18) + 0.06 * Math.sin(W * 3 * t + p.ga);
        shapes.push(PC.sperm(x, y, ang, L * (0.95 + 0.1 * ((i * 7) % 3) / 2), { beat: W * p.nb * t, phase: p.ph, amp: 0.1 }));
      }
      for (const s of shapes) PC.shadow(ctx, s.outline, 4.2 * hs, { alpha: 0.3, fast: true });
      for (const s of shapes) { PC.paper(ctx, s.outline, C.rival, { edge: 0.6, grain: 0.5 }); ctx.fillStyle = C.rivalBack; ctx.fill(s.back); }

      // you: a marigold strip mounted on cream card, one sheet higher than the pack
      const yl = -5 + 2.6 * Math.sin(W * t + 0.6), ydl = 2.6 * W * Math.cos(W * t + 0.6);
      const yx = X(0, yl), yy = Y(0, yl);
      const yAng = base + Math.atan2(ydl, 18) + 0.04 * Math.sin(W * 2 * t);
      at(1.0);
      const you = PC.sperm(yx, yy, yAng, LY, { beat: W * 20 * t, phase: 0.4, amp: 0.11, thick: 1.35, head: 1.18 });
      const mg = 2.6 * hs;
      PC.shadow(ctx, you.outline, 7.5 * hs, { alpha: 0.4, blur: 0.8 + 7.5 * hs * 0.85 + mg });
      PC.margin(ctx, you.outline, C.margin, mg);
      PC.paper(ctx, you.outline, C.you, { edge: 0.9, edgeMix: 0.45, grain: 0.7 });
      ctx.fillStyle = C.youBack; ctx.fill(you.back);

      // 6. the wall sheets, inner to outer, each higher and darker (baked)
      PC.blit(ctx, st.bk.walls, swx * 1.4, swy * 1.4);
      // 7. the place tag
      at(2.4);
      const fs = Math.round(FB.clamp(Math.min(w, h) * 0.04, 14, 17));
      PC.tag(ctx, ord(1 + ahead) + ' of 20', w / 2, 18 + fs, { size: fs, bg: C.tag, color: C.ink, h: 4 * hs });
      ctx.setTransform(FB.dpr, 0, 0, FB.dpr, 0, 0);
    }
  });
})();
