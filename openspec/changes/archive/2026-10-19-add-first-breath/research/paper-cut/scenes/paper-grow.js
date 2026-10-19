// Paper cut, stage 5 First Trimester (grow): "Grow with your heart." design.md 6.5, week 12.
// A tunnel book: three frames with scalloped round windows, darker toward the viewer, open onto the sac. Inside, the
// baby is four rounded paper pieces (a big round head, a curled bean of a body, a folded leg, an arm) with a gold
// heart. The cord is a paper ribbon, twisted all along like a real cord's coil, looping from the placenta (a
// scalloped rose disc with red pools that swell with her heart) to the belly. Small gold lights ride the cord in
// and on to the heart, which swells once per beat. A cream tag reads "Week 12".
//
// Palette (hex): frames #4e1430 / #8e2c4b / #c25470 (front to back), sac #f6d6cc (pearl, the lit back of the box),
// motes #ebb5b2, placenta #d65a72 with #e9858f, pools #c2283d, cord #e98a96 (back #c9667b), body #f39477, head
// #f6a585, limbs #e57a62, heart #ffc53d on #fff0cf, lights #ffd25a, tag #fff0dc with ink #3a1029, shadow #1c0612.
// References: Henri Matisse's cut-outs, "The Snail" (1953) and the curled figures of "Blue Nude II" (1952), for a body
// told in a few cut shapes; Charley Harper's reduced, round forms; the tunnel books of paper engineering for the
// stacked windows; Tearaway (Media Molecule) for the twisted paper ribbon; Gris (Nomada Studio) for layered depth.
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
    frames: ['#c25470', '#8e2c4b', '#4e1430'], sac: '#f6d6cc', mote: '#ebb5b2',
    placenta: '#d65a72', placenta2: '#e9858f', pool: '#c2283d',
    cord: '#e98a96', cordBack: '#c9667b', body: '#f39477', head: '#f6a585', limb: '#e57a62',
    heart: '#ffc53d', margin: '#fff0cf', light: '#ffd25a', tag: '#fff0dc', ink: '#3a1029'
  };
  const T = 10, W = TAU / T;
  const BEATS = 26, HER = 12;            // your heart 156 bpm, hers 72 bpm, whole beats per loop
  const LIGHTS = 13, TRAVEL = 3.2;        // one light every two of your beats; each rides the cord for 3.2 s

  // capsule (two end circles joined by tangents) as points
  function capsule(ax, ay, bx, by, ra, rb, step) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
    const s = Math.asin(FB.clamp((ra - rb) / L, -1, 1));
    const out = [];
    const nA = Math.max(8, Math.round((Math.PI * ra) / step)), nB = Math.max(8, Math.round((Math.PI * rb) / step));
    for (let i = 0; i <= nB; i++) { const t = a - Math.PI / 2 - s + (i / nB) * (Math.PI + 2 * s); out.push(bx + Math.cos(t) * rb, by + Math.sin(t) * rb); }
    for (let i = 0; i <= nA; i++) { const t = a + Math.PI / 2 - s + (i / nA) * (Math.PI - 2 * s); out.push(ax + Math.cos(t) * ra, ay + Math.sin(t) * ra); }
    return out;
  }
  // an egg-shaped oval (one end fuller), optionally dented on one side: the pieces of the baby
  function oval(cx, cy, rx, ry, rot, o) {
    o = o || {};
    const n = 48, out = [], egg = o.egg || 0, dent = o.dent || 0, da = o.dentAt || 0;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU;
      let x = Math.cos(th) * rx * (1 + egg * Math.cos(th) * 0.5), y = Math.sin(th) * ry * (1 + egg * Math.cos(th));
      if (dent) { let d = th - da; d -= TAU * Math.round(d / TAU); const f = 1 - dent * Math.exp(-(d * d) / 0.28); x *= f; y *= f; }
      out.push(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot));
    }
    return out;
  }
  function bez(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
  }
  const rotP = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a); return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]; };

  FB.scene('paper-grow', {
    title: 'First Trimester (paper cut)',
    stage: 'Stage 5 · grow',
    caption: 'Cut paper: four round pieces make you; lights ride the twisted cord to your heart.',
    still: 3.3,
    init(w, h) {
      const tall = h >= w;
      const k = Math.min(w, h) / 100;
      const hs = Math.sqrt(k / 3.9);
      const cx = w * 0.5, cy = tall ? h * 0.53 : h * 0.535;
      const R0 = (tall ? 50 : 45) * k, R1 = R0 - 5.5 * k, R2 = R1 - 5.5 * k;
      const sq = tall ? 0.88 : 1;        // a taller window on a phone
      const r = FB.rng('paper-grow');
      const motes = [];
      for (let i = 0; i < 9; i++) motes.push({ a: r() * TAU, d: Math.sqrt(r()) * 0.85, r: 0.5 + r() * 0.9, f: r() * TAU, n: 1 + (i % 2) });
      return { tall, k, hs, cx, cy, R0, R1, R2, sq, motes };
    },
    draw(ctx, w, h, t, st) {
      const { k, hs, cx, cy, R0, R1, R2, sq } = st;
      const swx = (2.0 * Math.sin(W * t) + 0.8 * Math.sin(2 * W * t + 0.9)) * hs, swy = 1.5 * Math.cos(W * t + 0.4) * hs;
      const at = (d) => ctx.setTransform(FB.dpr, 0, 0, FB.dpr, FB.dpr * swx * d, FB.dpr * swy * d);
      const dpr = FB.dpr;
      if (!st.bk || st.bk.dpr !== dpr) {
        st.bk = {
          dpr,
          frames: PC.bake(w, h, 12 * hs, dpr, (c) => {
            const rs = [R2, R1, R0], hts = [5, 5, 5];
            for (let i = 0; i < 3; i++) {
              const p = new Path2D();
              p.rect(-60, -60, w + 120, h + 120);
              // twelve petals a layer, each layer turned half a petal: a paper rose round the window
              PC.path(PC.circle(cx, cy, rs[i], { seed: 60 + i, step: 4, amp: 1.0, scallops: 12, depth: 2.4 * k, rot: (i % 2) * (Math.PI / 12), squash: sq }), true, p);
              PC.sheet(c, p, C.frames[i], hts[i] * hs, { rule: 'evenodd', edge: 0, core: 0.22, coreWidth: 2.2 * hs, grainAngle: 0.6 + i, shadow: { alpha: 0.42, blur: 2.5 * hs } });
            }
          })
        };
      }

      // 1. the sac
      at(-0.5);
      const full = new Path2D(); full.rect(-20, -20, w + 40, h + 40);
      PC.paper(ctx, full, C.sac, { edge: 0, grainAngle: 2.0 });
      for (const m of st.motes) {
        const a = m.a + 0.15 * Math.sin(W * m.n * t + m.f), d = m.d * R2 * (1 + 0.04 * Math.sin(W * t + m.f));
        const p = PC.path(PC.circle(cx + Math.cos(a) * d * sq, cy + Math.sin(a) * d / sq, m.r * k, { step: 2, amp: 0.2, seed: 5 }));
        PC.shadow(ctx, p, 1.2 * hs, { fast: true, alpha: 0.28 });
        PC.paper(ctx, p, C.mote, { edge: 0.4, grain: 0 });
      }

      // 2. the placenta, tucked under the frames at the upper right, its pools swelling with her heart
      at(-0.3);
      const pa = -0.95, pr = 0.42 * R2, px = cx + Math.cos(pa) * R2 * 0.98 * sq, py = cy + Math.sin(pa) * R2 * 0.98 / sq;
      const plac = PC.path(PC.circle(px, py, pr, { seed: 31, scallops: 15, depth: 0.9 * k, step: 3, amp: 0.7 }));
      PC.sheet(ctx, plac, C.placenta, 3 * hs, { edge: 1, grainAngle: 0.4, shadow: { alpha: 0.36 } });
      const plac2 = PC.path(PC.circle(px + 0.06 * pr, py - 0.04 * pr, pr * 0.68, { seed: 32, scallops: 11, depth: 0.7 * k, step: 3, amp: 0.6 }));
      PC.sheet(ctx, plac2, C.placenta2, 1.8 * hs, { edge: 0.8, grainAngle: 1.4 });
      const herPh = (t * HER) / T, pulse = FB.pulse(herPh);
      const pools = [[-0.42, 0.28, 0.13], [-0.1, 0.42, 0.11], [-0.48, -0.05, 0.1], [0.2, 0.16, 0.1], [-0.18, 0.08, 0.08]];
      for (let i = 0; i < pools.length; i++) {
        const [ox, oy, rr] = pools[i];
        const pp = PC.path(PC.circle(px + ox * pr, py + oy * pr, rr * pr * (1 + 0.12 * pulse), { seed: 33 + i, scallops: 7, depth: 0.25 * k, step: 2, amp: 0.3 }));
        PC.sheet(ctx, pp, C.pool, 1.2 * hs, { edge: 0.5, grain: 0.5, shadow: { fast: true, alpha: 0.3 } });
      }

      // 3. the baby: a gentle sway and bob, the limbs moving a little
      const S = R2 * 0.74;
      const bx = cx - 0.16 * R2, by = cy + 0.12 * R2 + 0.8 * k * Math.sin(W * t);
      const rot = 0.42 + 0.05 * Math.sin(W * t + 0.4);   // the whole figure leans forward, head to chest
      const L = (x, y) => rotP(bx + x * S, by + y * S, bx, by, rot);
      const belly = L(0.3, 0.12), heart = L(0.1, -0.03);

      // 4. the cord: a twisted ribbon from the placenta to the belly, behind the baby
      at(0.0);
      const p0 = [px - 0.5 * pr, py + 0.45 * pr];
      const p3 = belly;
      const p1 = [p0[0] - 0.05 * R2, p0[1] + 0.55 * R2 + 1.5 * k * Math.sin(W * t + 1)];
      const p2 = [p3[0] + 0.62 * R2, p3[1] + 0.5 * R2 + 2 * k * Math.cos(W * t)];
      const N = 70, cw = 1.55 * k;
      const cpts = [], cl = [0];
      for (let i = 0; i <= N; i++) cpts.push(bez(p0, p1, p2, p3, i / N));
      for (let i = 1; i <= N; i++) cl.push(cl[i - 1] + Math.hypot(cpts[i][0] - cpts[i - 1][0], cpts[i][1] - cpts[i - 1][1]));
      const up = [], lo = [], tz = [];
      for (let i = 0; i <= N; i++) {
        const a = cpts[Math.max(0, i - 1)], b = cpts[Math.min(N, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const z = Math.cos((cl[i] / (5.2 * k)) * Math.PI - W * t);
        tz.push(z);
        const ww = cw * (0.4 + 0.6 * Math.abs(z));
        up.push([cpts[i][0] - ty * ww, cpts[i][1] + tx * ww]);
        lo.push([cpts[i][0] + ty * ww, cpts[i][1] - tx * ww]);
      }
      const ribbon = [];
      for (let i = 0; i <= N; i++) ribbon.push(up[i][0], up[i][1]);
      for (let i = N; i >= 0; i--) ribbon.push(lo[i][0], lo[i][1]);
      const cordP = PC.path(ribbon);
      PC.sheet(ctx, cordP, C.cord, 3 * hs, { edge: 0.6, grainAngle: 0.8, shadow: { alpha: 0.34 } });
      const back = new Path2D();
      for (let i = 1; i <= N;) {
        if (tz[i] >= 0) { i++; continue; }
        const s0 = i; while (i <= N && tz[i] < 0) i++;
        const s1 = Math.min(N, i), q = [];
        for (let j = s0 - 1; j <= s1; j++) q.push(up[j][0], up[j][1]);
        for (let j = s1; j >= s0 - 1; j--) q.push(lo[j][0], lo[j][1]);
        PC.path(q, true, back);
      }
      ctx.fillStyle = C.cordBack; ctx.fill(back);

      // 5. the baby's four pieces, each its own sheet: a bean of a body, a folded leg, then the head and an arm
      at(0.25);
      const [bcx, bcy] = L(0.0, 0.08);
      const body = PC.path(PC.cut(oval(bcx, bcy, 0.31 * S, 0.43 * S, rot - 0.3, { egg: -0.14, dent: 0.24, dentAt: 0.1 }), true, { step: 4, amp: 0.6, jitter: 0.25, seed: 71 }));
      PC.sheet(ctx, body, C.body, 4.5 * hs, { edge: 1, edgeMix: 0.4, grainAngle: 0.3, shadow: { alpha: 0.38 } });
      const legA = 0.07 * Math.sin(W * 2 * t), armA = 0.12 * Math.sin(W * 2 * t + 1.3);
      const [lx, ly] = L(0.15, 0.36);
      const leg = PC.path(PC.cut(oval(lx, ly, 0.27 * S, 0.13 * S, rot - 0.75 + legA, { egg: 0.3 }), true, { step: 4, amp: 0.4, seed: 72 }));
      PC.sheet(ctx, leg, C.limb, 2.6 * hs, { edge: 0.8, edgeMix: 0.4, grainAngle: 1.7 });
      at(0.3);
      // the heart, a gold disc on a cream margin, one swell per beat
      const beatPh = (t * BEATS) / T, hb = FB.pulse(beatPh);
      const hr = 0.075 * S * (1 + 0.16 * hb);
      const heartP = PC.path(PC.circle(heart[0], heart[1], hr, { step: 2, amp: 0.2, jitter: 0.1, seed: 76 }));
      PC.shadow(ctx, heartP, 2.2 * hs, { alpha: 0.34, blur: 2 * hs + 1.6 * hs });
      PC.margin(ctx, heartP, C.margin, 1.4 * hs);
      PC.paper(ctx, heartP, C.heart, { edge: 0.6, edgeMix: 0.45, grain: 0.5 });
      at(0.35);
      const headP = PC.path(PC.cut(PC.circle(...L(0.05, -0.55), 0.35 * S, { step: 4, amp: 0.7, jitter: 0.3, seed: 74 }), true, { step: 4, amp: 0.4, seed: 75 }));
      PC.sheet(ctx, headP, C.head, 3.4 * hs, { edge: 1, edgeMix: 0.4, grainAngle: 2.6, shadow: { alpha: 0.36 } });
      const [ax, ay] = L(0.29, -0.16);
      const arm = PC.path(PC.cut(oval(ax, ay, 0.17 * S, 0.072 * S, rot - 1.15 + armA, { egg: 0.3 }), true, { step: 4, amp: 0.3, seed: 73 }));
      PC.sheet(ctx, arm, C.limb, 2.6 * hs, { edge: 0.8, edgeMix: 0.4, grainAngle: 0.9 });

      // 6. the lights: ride the cord, then on over the belly to the heart, arriving on every other beat
      at(0.45);
      const total = cl[N], tail = Math.hypot(heart[0] - belly[0], heart[1] - belly[1]);
      for (let i = 0; i < LIGHTS; i++) {
        const arrive = ((i * 2 + 1) * T) / BEATS + 0.02;    // just after a beat starts
        let u = 1 - ((((arrive - t) % T) + T) % T) / TRAVEL;
        if (u < 0 || u > 1) continue;
        const dist = u * (total + tail);
        let x, y;
        if (dist <= total) {
          let j = 1; while (j < N && cl[j] < dist) j++;
          const f = (dist - cl[j - 1]) / Math.max(1e-6, cl[j] - cl[j - 1]);
          x = cpts[j - 1][0] + (cpts[j][0] - cpts[j - 1][0]) * f; y = cpts[j - 1][1] + (cpts[j][1] - cpts[j - 1][1]) * f;
        } else { const f = (dist - total) / tail; x = belly[0] + (heart[0] - belly[0]) * f; y = belly[1] + (heart[1] - belly[1]) * f; }
        const grow = sm(0, 0.08, u) * (1 - sm(0.9, 1, u));
        if (grow < 0.05) continue;
        const lp = PC.path(PC.circle(x, y, 0.95 * k * grow, { step: 1.5, amp: 0.1, jitter: 0.08, seed: 90 + i }));
        PC.shadow(ctx, lp, 2 * hs, { fast: true, alpha: 0.32 });
        PC.margin(ctx, lp, C.margin, 0.9 * hs * grow, { grain: 0 });
        PC.paper(ctx, lp, C.light, { edge: 0, grain: 0 });
      }

      // 7. the frames (baked) and the week tag
      PC.blit(ctx, st.bk.frames, swx * 1.4, swy * 1.4);
      at(1.8);
      const fs = Math.round(FB.clamp(Math.min(w, h) * 0.04, 14, 17));
      PC.tag(ctx, 'Week 12', w / 2, 18 + fs, { size: fs, bg: C.tag, color: C.ink, h: 4 * hs });
      ctx.setTransform(FB.dpr, 0, 0, FB.dpr, 0, 0);
    }
  });
})();
