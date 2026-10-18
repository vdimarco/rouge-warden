/* First Breath art kit (window.FB).
   Shared Canvas 2D primitives for the art examples of First Breath (design.md sections 13 and 14).
   Classic script, no libraries, no images, no network, no ctx.filter (Safari lacks it), no shadowBlur.
   Every scene file uses only this kit and plain Canvas 2D.

   Units: scenes draw in CSS px. FB.run sets the device-pixel transform, so w and h are CSS px.
   Colours: any option that takes a colour takes a hex string. `pal` options take a palette object or a stage
   id ('swim' ... 'ending'); with none given, primitives use FB.pal (set it with FB.use('egg')).
   Cost note (measured in this container, tools/probe*.html): cached gradients drawn through a transform are
   2 to 10 times cheaper than bitmap sprites with drawImage in both SwiftShader and CPU raster, so the kit's
   "sprites" are cached unit-space CanvasGradients; gradients keep to 8 stops or fewer.

   API
   FB.palette[stage] {bg, tissue, body, rim, cue, cue2, light, shade (+cue3, body2, halo)}; FB.stages; FB.stageInfo
   FB.ui {text, scrim, button, buttonText, focus, ink, font}; FB.pal; FB.use(stage|palette); FB.pick(stage|palette)
   FB.rng(seed) -> () => [0,1)        FB.noise2(x, y) -> [-1,1]        FB.fbm(x, y, oct=4) -> [-1,1]
   FB.curl(x, y, out?) -> [vx, vy]    FB.ramp(r)                       FB.pulse(phase) FB.beat(t, bpm)
   FB.rgb FB.rgba FB.mix FB.lighten FB.darken FB.clamp FB.lerp FB.smoothstep FB.ease FB.resample(path, spacing)
   FB.glow(ctx, x, y, r, color, alpha=1, mode='lighter')
   FB.backdrop(ctx, w, h, t, pal, {light:{x,y,r}, light2:{x,y,r,a}|false, lightAmt, ambient, tissue, veins,
     vignette, drift, scale, seed, pulse, cells, key}) -> {x, y, r} of the main light (also FB.lastLight)
   FB.lightAngle(x, y, fallback?) -> angle from (x, y) toward the backdrop's main light
   FB.membrane(ctx, x, y, r, t, {pal, body|color, edge, rim, light, lightAngle, wobble, wobbleFreq, wobbleSpeed,
     seed, squash, rotation, pulse, alpha, glow, scatter, bleed, rimWidth, rimAlpha, nucleus, nucleusColor,
     nucleusOffset, granules, cytoplasm})
   FB.blobs(ctx, items, {pal, color|body, rim, light, edge, edgeMix, lum, lightAngle, goo, alpha, glow, seams,
     rimWidth, cell, maxCells, nucleusColor}) -> bbox; items {x,y,r} | {x,y,x2,y2,r} | {pts:[x,y,...], rs:[r,...]}
     with optional w, color, nucleus, nx, ny
   FB.sperm(ctx, x, y, angle, t, {pal, color, rim, size, phase, glow, speed, amp, waves, alpha})
   FB.particles(state, ctx, w, h, t, {pal, count, color, color2, mix, size, bigShare, speed, scale, flow:[vx,vy],
     wall(x,y)->px, wallRange, region:{x,y,w,h}, alpha, blend, seed, warmup})
   FB.cilia(ctx, path, t, {pal, spacing, length, side, amp, freq, lag, tilt, width, color, base, glow, alpha, seed})
   FB.branch(seed, {x, y, roots, region:{x,y,r,(inner,a0,a1,squash)}|{x,y,w,h}|fn(rng), count, step, influence,
     kill, maxNodes, iterations, bias:{x,y}, prune, pipe}) -> segments
   FB.drawBranch(ctx, segs, progress, {pal, color, core, glowColor, glow, alpha, tip, width, maxWidth, tips,
     bulbs, pulse, pulseSpeed, pulseColor})
   FB.figure(ctx, x, y, s, t, {pal, pose:'curl'|'stretch'|'headDown'|'turn', pose2, mix, color, rim, light, edge,
     edgeMix, lightAngle, rotation, flip, round, limbs, sway, heart, bpm, heartPhase, heartColor, cord:{x,y},
     cordColor, aura, glow, alpha, goo, rimWidth, cell, maxCells}) -> bbox; FB.poses
   FB.vignette(ctx, w, h, strength=0.5, color=FB.pal.shade)
   FB.text(ctx, str, x, y, {size, weight, align, maxWidth, lineHeight, padX, padY, radius, scrim, scrimColor,
     color}) -> box
   FB.scene(id, {title, stage, caption, still, init(w, h) -> state, draw(ctx, w, h, t, state)}); FB.scenes
   FB.run(canvas, scene, {dprCap=2, t0, timeScale, onFrame(ms, t)}) -> {stop(), state, t}
   FB.drawOnce(canvas, scene, t, {dprCap}) -> {ctx, w, h, dpr, state, ms}
*/
(function () {
  'use strict';

  const FB = {};
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------------------------------------
  // Colour script (design.md 13.2). Extra tokens: cue3 (stage 5 blood pool rim, stage 6 hand glow),
  // body2 (ending small shape), halo (ending ring halo), shade (vignette and halo colour: ink #1a0610
  // except in the ending, where it is a deeper warm peach of our choosing). Only hex strings here.
  FB.palette = {
    swim: { bg: '#1e0a1c', tissue: '#4a1f3d', body: '#c7a2b8', rim: '#f4d9e6', cue: '#ffd77a', cue2: '#ffb36b', light: '#ff9a8a', shade: '#1a0610' },
    egg: { bg: '#2a0e1a', tissue: '#6e2436', body: '#ffc9a8', rim: '#fff4ea', cue: '#ffd77a', cue2: '#ffe9a8', light: '#ffb08a', shade: '#1a0610' },
    split: { bg: '#3a0f24', tissue: '#5a1426', body: '#ff8a6b', rim: '#fff4ea', cue: '#ffd77a', cue2: '#fff4ea', light: '#ff9a7a', shade: '#1a0610' },
    root: { bg: '#4a0f1e', tissue: '#7a1e2e', body: '#ffb3a0', rim: '#fff4ea', cue: '#f3eadf', cue2: '#fff4ea', light: '#ff8a6a', shade: '#1a0610' },
    grow: { bg: '#521626', tissue: '#74223a', body: '#ffb8a8', rim: '#fff4ea', cue: '#ffd77a', cue2: '#ffe0c8', cue3: '#ffb3c0', light: '#ff8a7a', shade: '#1a0610' },
    answer: { bg: '#5e2a16', tissue: '#8a3a20', body: '#ffc0a0', rim: '#fff4ea', cue: '#ffd77a', cue2: '#fff4ea', cue3: '#ffc9a8', light: '#ffa860', shade: '#1a0610' },
    turn: { bg: '#6e3214', tissue: '#9a4a20', body: '#ffc8a0', rim: '#fff4ea', cue: '#fff4ea', cue2: '#ffe0a0', light: '#ffb36b', shade: '#1a0610' },
    birth: { bg: '#2a0818', tissue: '#4a1630', body: '#e8a0b8', rim: '#fff4ea', cue: '#fff4ea', cue2: '#ffd77a', light: '#ffffff', shade: '#1a0610' },
    ending: { bg: '#ffe8d6', tissue: '#ffd2b8', body: '#ffc9a8', body2: '#ffb38a', rim: '#fff8f0', cue: '#7a2e1e', cue2: '#4a1e10', light: '#ffffff', halo: '#fff8f0', shade: '#e8a888' }
  };
  // Stage names and what each token paints (kept apart so FB.palette holds only hex strings).
  FB.stageInfo = {
    swim: { name: 'The Journey', roles: { body: 'other sperm', cue: 'you', cue2: 'warm lane, chevrons' } },
    egg: { name: 'Ovulation', roles: { body: 'corona', cue: 'beat ring', cue2: 'gold beats, trail' } },
    split: { name: 'The Embryo', roles: { body: 'cells', cue: 'approach ring', cue2: 'hold ring' } },
    root: { name: 'The Placenta', roles: { body: 'tree', cue: 'gland pools, dotted rim', cue2: 'your heart, dashed' } },
    grow: { name: 'First Trimester', roles: { body: 'you', cue: 'cord lights', cue2: 'move glow', cue3: 'blood pool rim, wavy' } },
    answer: { name: 'Second Trimester', roles: { cue: 'voice ripples', cue2: 'answer ghosts, dashed', cue3: 'hand glow' } },
    turn: { name: 'Third Trimester', roles: { cue: 'breath ring', cue2: 'roomy glow' } },
    birth: { name: 'Birth', roles: { cue: 'wave and prompt ring', cue2: 'direction arrow' } },
    ending: { name: 'The ending', roles: { body: 'big shape', body2: 'small shape', cue: 'rings, dark on light', cue2: 'text', halo: 'ring halo' } }
  };
  FB.stages = ['swim', 'egg', 'split', 'root', 'grow', 'answer', 'turn', 'birth', 'ending'];

  // UI tokens (design.md 13.2): HUD text on a scrim, buttons, focus ring, the ink halo colour.
  FB.ui = {
    text: '#fff4ea', scrim: 'rgba(26, 6, 16, 0.72)', button: '#ffb36b', buttonText: '#2a0818', focus: '#ffd77a', ink: '#1a0610',
    font: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", "Quicksand", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  };

  // The palette primitives use when a call gives no colours. FB.use('egg') or FB.use(paletteObject).
  FB.pal = FB.palette.split;
  FB.use = function (p) { FB.pal = pal(p); return FB.pal; };
  function pal(p) { return !p ? FB.pal : (typeof p === 'string' ? (FB.palette[p] || FB.pal) : p); }
  FB.pick = pal;

  // ---------------------------------------------------------------------------------------------
  // Small maths helpers.
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  FB.clamp = clamp; FB.lerp = lerp; FB.smoothstep = smooth; FB.TAU = TAU;
  FB.ease = { inOut: (x) => x * x * (3 - 2 * x), out: (x) => 1 - (1 - x) * (1 - x), in: (x) => x * x, sine: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x) };
  // One smooth swell per beat (design.md 14.2, research A6): never two flashes per beat (WCAG 2.3.1).
  FB.pulse = (phase) => { const p = phase - Math.floor(phase); const a = (p - 0.08) / 0.06, b = (p - 1.08) / 0.06; return Math.exp(-a * a) + Math.exp(-b * b); };
  FB.beat = (t, bpm) => (t * bpm) / 60;

  // ---------------------------------------------------------------------------------------------
  // Colour helpers (hex in, numbers or CSS strings out; cached because gradients need strings).
  const rgbCache = new Map();
  function rgb(c) {
    let v = rgbCache.get(c);
    if (v) return v;
    if (Array.isArray(c)) return c;
    let s = String(c).trim();
    if (s[0] === '#') {
      s = s.slice(1);
      if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      const n = parseInt(s.slice(0, 6), 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    } else {
      const m = s.match(/[\d.]+/g) || [0, 0, 0];
      v = [+m[0], +m[1], +m[2]];
    }
    rgbCache.set(c, v);
    return v;
  }
  const hex2 = (n) => { const v = clamp(Math.round(n), 0, 255); return (v < 16 ? '0' : '') + v.toString(16); };
  function toHex(a) { return '#' + hex2(a[0]) + hex2(a[1]) + hex2(a[2]); }
  function rgba(c, a) { const v = rgb(c); return 'rgba(' + (v[0] | 0) + ',' + (v[1] | 0) + ',' + (v[2] | 0) + ',' + (+a).toFixed(3) + ')'; }
  function mixRGB(a, b, t) { a = rgb(a); b = rgb(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  FB.rgb = rgb;
  FB.rgba = rgba;
  FB.mix = (a, b, t) => toHex(mixRGB(a, b, t));
  FB.lighten = (c, t) => FB.mix(c, '#ffffff', t);
  FB.darken = (c, t) => FB.mix(c, '#000000', t);

  // A scratch context that owns every cached gradient (gradients are not tied to one canvas).
  const scratch = document.createElement('canvas').getContext('2d');

  // ---------------------------------------------------------------------------------------------
  // Seeded random. Source: Tommy Ettinger's mulberry32 (public domain); strings are hashed with FNV-1a.
  FB.rng = function (seed) {
    let a = typeof seed === 'string' ? hashStr(seed) : (seed >>> 0) || 0x9e3779b9;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------------------------------------------------------------------------------------------
  // Value noise on a seeded lattice with quintic fade, as in Quilez, "Value noise derivatives" (2008);
  // fbm rotates each octave by Quilez's m2 matrix (as in his "Warping" article) to hide the lattice.
  const PERM = new Uint8Array(512);
  const VAL = new Float32Array(256);
  (function seedNoise() {
    const r = FB.rng(0x5eedf00d);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) { p[i] = i; VAL[i] = r() * 2 - 1; }
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  })();
  function noise2(x, y) {
    let xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    xi &= 255; yi &= 255;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const p0 = PERM[xi], p1 = PERM[xi + 1];
    const a = VAL[PERM[p0 + yi]], b = VAL[PERM[p1 + yi]];
    const c = VAL[PERM[p0 + yi + 1]], d = VAL[PERM[p1 + yi + 1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct) {
    oct = oct || 4;
    let sum = 0, amp = 0.5, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * noise2(x, y); norm += amp;
      const nx = 1.6 * x + 1.2 * y, ny = -1.2 * x + 1.6 * y;
      x = nx + 17.3; y = ny + 9.1; amp *= 0.5;
    }
    return sum / norm;
  }
  FB.noise2 = noise2;
  FB.fbm = fbm;

  // Curl of a noise potential: v = (dpsi/dy, -dpsi/dx). Bridson, Hourihan and Nordenstam, "Curl-Noise for
  // Procedural Fluid Flow" (SIGGRAPH 2007). Divergence-free, so motes never clump or vanish. Noise-space units.
  FB.curl = function (x, y, out) {
    const e = 0.04;
    const dy = noise2(x, y + e) - noise2(x, y - e);
    const dx = noise2(x + e, y) - noise2(x - e, y);
    out = out || [0, 0];
    out[0] = dy / (2 * e); out[1] = -dx / (2 * e);
    return out;
  };
  // Bridson's smooth ramp for walls: multiply the potential by ramp(distance / d0) and flow slides along walls.
  FB.ramp = (r) => (r >= 1 ? 1 : r <= -1 ? -1 : 1.875 * r - 1.25 * r * r * r + 0.375 * r * r * r * r * r);

  // ---------------------------------------------------------------------------------------------
  // Transform helpers. Every primitive composes its local frame with the caller's current transform
  // (the device-pixel scale from FB.run plus anything the scene set), so it never fights the scene.
  function setLocal(ctx, m, x, y, cs, sn, s) {
    const a = m.a, b = m.b, c = m.c, d = m.d;
    ctx.setTransform((a * cs + c * sn) * s, (b * cs + d * sn) * s, (c * cs - a * sn) * s, (d * cs - b * sn) * s, a * x + c * y + m.e, b * x + d * y + m.f);
  }
  function setLocalXY(ctx, m, x, y, cs, sn, sx, sy) {
    const a = m.a, b = m.b, c = m.c, d = m.d;
    ctx.setTransform((a * cs + c * sn) * sx, (b * cs + d * sn) * sx, (c * cs - a * sn) * sy, (d * cs - b * sn) * sy, a * x + c * y + m.e, b * x + d * y + m.f);
  }

  // ---------------------------------------------------------------------------------------------
  // Glow sprite: a cached radial gradient in unit space with a long soft tail (a Gaussian core plus a
  // (1 - t)^2.5 skirt), drawn additively. The common "light sprite" of 2D games and Primordia's FlatRenderer;
  // a gradient instead of a bitmap because it rasterizes 5 to 10 times faster here (tools/probe.html).
  // 8 stops at most: Skia draws gradients with up to 8 stops analytically and moves longer ones to a
  // texture lookup, which costs about 3x more in SwiftShader and in software raster (tools/probe2.html).
  const GLOW_STOPS = [0, 0.08, 0.18, 0.3, 0.45, 0.62, 0.8, 1].map((t) => [t, t >= 1 ? 0 : 0.55 * Math.exp(-t * t * 9) + 0.45 * Math.pow(1 - t, 2.5)]);
  const glowCache = new Map();
  function glowGrad(color) {
    let g = glowCache.get(color);
    if (g) return g;
    if (glowCache.size > 400) glowCache.clear();
    g = scratch.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [t, a] of GLOW_STOPS) g.addColorStop(t, rgba(color, a));
    glowCache.set(color, g);
    return g;
  }
  // A hard-edged soft disc (for heads, nuclei, hearts): bright core, body, quick fade at the edge.
  const discCache = new Map();
  function discGrad(core, body, edge) {
    const key = core + body + edge;
    let g = discCache.get(key);
    if (g) return g;
    if (discCache.size > 400) discCache.clear();
    g = scratch.createRadialGradient(-0.25, -0.2, 0, 0, 0, 1);
    g.addColorStop(0, rgba(core, 1));
    g.addColorStop(0.45, rgba(body, 1));
    g.addColorStop(0.86, rgba(edge, 0.95));
    g.addColorStop(1, rgba(edge, 0));
    discCache.set(key, g);
    return g;
  }

  // Glow: the additive light sprite of 2D games (as in Primordia's FlatRenderer, research A1), from the cached
  // gradient above. Soft glow at (x, y) with radius r; mode 'lighter' (default) or 'screen'.
  FB.glow = function (ctx, x, y, r, color, alpha, mode) {
    if (!(r > 0) || alpha === 0) return;
    const m = ctx.getTransform();
    const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    ctx.globalCompositeOperation = mode || 'lighter';
    ctx.globalAlpha = ga * (alpha == null ? 1 : alpha);
    ctx.fillStyle = glowGrad(color);
    setLocal(ctx, m, x, y, 1, 0, r);
    ctx.fillRect(-1, -1, 2, 2);
    ctx.setTransform(m);
    ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
  };
  function glowFast(ctx, m, x, y, r, color, alpha) { // caller sets the composite mode
    ctx.globalAlpha = alpha;
    ctx.fillStyle = glowGrad(color);
    setLocal(ctx, m, x, y, 1, 0, r);
    ctx.fillRect(-1, -1, 2, 2);
  }

  // ---------------------------------------------------------------------------------------------
  // Offscreen buffers keyed per canvas, reused across frames (never reallocated while the size holds).
  const buffers = new WeakMap();
  function buffer(ctx, key, gw, gh) {
    let map = buffers.get(ctx.canvas);
    if (!map) { map = new Map(); buffers.set(ctx.canvas, map); }
    let b = map.get(key);
    if (!b || b.cw < gw || b.ch < gh) {
      const cw = Math.max(gw, b ? b.cw : 0), ch = Math.max(gh, b ? b.ch : 0);
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      // willReadFrequently keeps this small buffer in CPU memory: putImageData is a copy and the
      // upscaled drawImage uploads it once, about 2x cheaper in SwiftShader than a GPU-backed buffer.
      b = { canvas: cv, ctx: cv.getContext('2d', { willReadFrequently: true }), img: new ImageData(cw, ch), cw, ch };
      map.set(key, b);
    }
    return b;
  }

  // ---------------------------------------------------------------------------------------------
  // Backdrop: light through tissue. A low-resolution field, upscaled once (bilinear) to the canvas.
  // Layers: two slow drifting radial light spots (the "layered radial gradients"), tissue density from
  // domain-warped fbm (Quilez, "Warping", 2002), faint veins on the warp's zero lines, a colour ramp
  // bg -> tissue -> light whose upper half applies per-channel Beer-Lambert absorption so red survives
  // farthest (d'Eon and Luebke, GPU Gems 3 ch. 14; Simon Green, GPU Gems ch. 16), and a soft vignette.
  const rampCache = new Map();
  function rampLUT(p) {
    const key = p.bg + p.tissue + p.light + p.shade;
    let lut = rampCache.get(key);
    if (lut) return lut;
    lut = new Float32Array(256 * 3);
    const bg = rgb(p.bg), ti = rgb(p.tissue), li = rgb(p.light);
    const gLo = [0.9, 1.05, 1.18], gHi = [0.72, 1.3, 1.65];
    for (let i = 0; i < 256; i++) {
      const g = i / 255;
      for (let k = 0; k < 3; k++) {
        let v;
        if (g < 0.5) v = bg[k] + (ti[k] - bg[k]) * Math.pow(g / 0.5, gLo[k]);
        else v = ti[k] + (li[k] - ti[k]) * Math.pow((g - 0.5) / 0.5, gHi[k]);
        lut[i * 3 + k] = v;
      }
    }
    rampCache.set(key, lut);
    return lut;
  }
  FB.lastLight = null;
  FB.backdrop = function (ctx, w, h, t, p, opts) {
    p = pal(p); opts = opts || {};
    const drift = opts.drift == null ? 1 : opts.drift;
    const cells = opts.cells || 5600;
    const q = Math.max(4, Math.sqrt((w * h) / cells));
    const gw = Math.ceil(w / q) + 2, gh = Math.ceil(h / q) + 2;
    const buf = buffer(ctx, 'backdrop' + (opts.key || ''), gw, gh);
    const data = buf.img.data, stride = buf.cw;
    const lut = rampLUT(p);
    const sh = rgb(p.shade || FB.ui.ink);
    const m = Math.min(w, h);
    const seed = opts.seed || 0, ox = seed * 13.37 + 3.1, oy = seed * 7.77 + 1.7;
    const scale = opts.scale || 1;
    const tissueAmt = opts.tissue == null ? 0.75 : opts.tissue;
    const veins = opts.veins == null ? 0.3 : opts.veins;
    const amb = opts.ambient == null ? 0.16 : opts.ambient;
    const lightAmt = (opts.lightAmt == null ? 0.82 : opts.lightAmt) * (1 + 0.06 * (opts.pulse || 0));
    const vig = opts.vignette == null ? 0.6 : opts.vignette;
    const L = opts.light || {};
    const lx = (L.x == null ? 0.5 : L.x) * w + Math.sin(t * 0.07 * drift + 1.3) * 0.05 * m;
    const ly = (L.y == null ? 0.36 : L.y) * h + Math.cos(t * 0.05 * drift + 0.4) * 0.04 * m;
    const lr = (L.r == null ? 0.5 : L.r) * Math.max(w, h) * 0.85;
    const L2 = opts.light2 === false ? null : (opts.light2 || {});
    const l2x = L2 ? (L2.x == null ? 0.22 : L2.x) * w + Math.cos(t * 0.04 * drift) * 0.06 * m : 0;
    const l2y = L2 ? (L2.y == null ? 0.86 : L2.y) * h + Math.sin(t * 0.06 * drift + 2) * 0.05 * m : 0;
    const l2r = L2 ? (L2.r == null ? 0.42 : L2.r) * Math.max(w, h) : 1;
    const l2a = L2 ? (L2.a == null ? 0.35 : L2.a) : 0;
    FB.lastLight = { x: lx, y: ly, r: lr };
    const ta = t * 0.019 * drift, tb = t * 0.013 * drift;
    for (let j = 0; j < gh; j++) {
      const py = (j - 0.5) * q;
      const v = ((py - h * 0.5) / m) * scale;
      let o = j * stride * 4;
      for (let i = 0; i < gw; i++) {
        const px = (i - 0.5) * q;
        const u = ((px - w * 0.5) / m) * scale;
        // Domain warp: two slow noise fields bend a 3-octave density field (5 lookups per cell).
        const a = noise2(u * 1.4 + ox + ta, v * 1.4 + oy - tb) * 0.75;
        const b = noise2(u * 1.4 + ox + 5.2 - tb, v * 1.4 + oy + 1.3 + ta) * 0.75;
        const dn = fbm(u * 2.2 + 2.2 * a + 3.1, v * 2.2 + 2.2 * b + 7.7, 3);
        const dens = clamp(0.5 + dn * 1.35, 0, 1);
        const ridge = 1 - Math.abs(a) * 9;
        const vein = ridge > 0 ? ridge * ridge * veins : 0;
        // Light: the main spot and a dimmer second spot, both drifting.
        let dx = (px - lx) / lr, dy = (py - ly) / lr;
        let g = amb + lightAmt * Math.exp(-(dx * dx + dy * dy) * 2.2);
        if (l2a) { dx = (px - l2x) / l2r; dy = (py - l2y) / l2r; g += l2a * Math.exp(-(dx * dx + dy * dy) * 2.5); }
        // Tissue: thicker patches and veins let less light through.
        g *= 1 - tissueAmt * 0.5 * dens;
        g += (dens - 0.5) * 0.08 * tissueAmt;
        g -= vein * 0.14;
        g = g < 0 ? 0 : g > 1 ? 1 : g;
        const li = ((g * 255) | 0) * 3;
        let r = lut[li], gg = lut[li + 1], bb = lut[li + 2];
        // Vignette toward the shade colour.
        const ex = (px - w * 0.5) / (w * 0.5), ey = (py - h * 0.5) / (h * 0.5);
        const rr = ex * ex + ey * ey;
        if (vig > 0 && rr > 0.3) {
          let k = (rr - 0.3) / 1.4; k = k > 1 ? 1 : k; k = k * k * (3 - 2 * k) * vig;
          r += (sh[0] - r) * k; gg += (sh[1] - gg) * k; bb += (sh[2] - bb) * k;
        }
        data[o] = r; data[o + 1] = gg; data[o + 2] = bb; data[o + 3] = 255;
        o += 4;
      }
    }
    buf.ctx.putImageData(buf.img, 0, 0, 0, 0, gw, gh);
    const sm = ctx.imageSmoothingEnabled, sq = ctx.imageSmoothingQuality;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // Texel i is centred on x = (i - 0.5) q, so the image starts one texel left of the canvas.
    ctx.drawImage(buf.canvas, 0, 0, gw, gh, -1.5 * q + q * 0.5, -1.5 * q + q * 0.5, gw * q, gh * q);
    ctx.imageSmoothingEnabled = sm; ctx.imageSmoothingQuality = sq;
    ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
    return FB.lastLight;
  };

  // Angle from (x, y) toward the backdrop's main light, so rims face the light without scene code.
  FB.lightAngle = function (x, y, fallback) {
    const L = FB.lastLight;
    if (!L) return fallback == null ? -Math.PI * 0.62 : fallback;
    return Math.atan2(L.y - y, L.x - x);
  };

  // ---------------------------------------------------------------------------------------------
  // Membrane: a soft translucent cell lit from behind. Outline radius from noise sampled along a circle
  // in noise space so it closes without a seam (Shiffman, Coding Train #36 "Blobby!" and #136 "Polar
  // Noise Loops"), smoothed with midpoint quadratics; the back-light rim and the warm scatter band inside
  // the lit edge follow Barre-Brisebois and Bouchard (GDC 2011, via Zucconi) and Green (GPU Gems ch. 16).
  const memCache = new Map();
  function memStyle(body, edge, rim, light, nucleus) {
    const key = body + edge + rim + light + nucleus;
    let s = memCache.get(key);
    if (s) return s;
    if (memCache.size > 300) memCache.clear();
    const lit = toHex(mixRGB(body, rim, 0.32));
    // Local frame: the light comes from +x. Fill: bright toward the light, darker toward the edge.
    const fill = scratch.createRadialGradient(0.34, -0.06, 0.0, 0, 0, 1.03);
    fill.addColorStop(0, rgba(toHex(mixRGB(body, rim, 0.5)), 1));
    fill.addColorStop(0.3, rgba(lit, 1));
    fill.addColorStop(0.6, rgba(body, 1));
    fill.addColorStop(0.84, rgba(toHex(mixRGB(body, edge, 0.55)), 1));
    fill.addColorStop(0.95, rgba(toHex(mixRGB(body, edge, 0.8)), 1));
    fill.addColorStop(1, rgba(toHex(mixRGB(body, edge, 0.6)), 1));
    // Rim: brightest on the lit side, a faint cream line all round.
    const rimG = scratch.createLinearGradient(1, 0, -1, 0);
    rimG.addColorStop(0, rgba(rim, 1));
    rimG.addColorStop(0.3, rgba(rim, 0.75));
    rimG.addColorStop(0.62, rgba(rim, 0.22));
    rimG.addColorStop(1, rgba(rim, 0.1));
    // a wider soft band of the light tint on the lit side only (back-light bleed)
    const bleed = scratch.createLinearGradient(1, 0, -0.2, 0);
    bleed.addColorStop(0, rgba(light, 0.9));
    bleed.addColorStop(0.5, rgba(light, 0.25));
    bleed.addColorStop(1, rgba(light, 0));
    // Scatter band: warm light just inside the lit rim (red scatters farthest).
    const scat = scratch.createRadialGradient(0.62, 0, 0, 0.62, 0, 0.62);
    scat.addColorStop(0, rgba(light, 0.55));
    scat.addColorStop(0.5, rgba(light, 0.2));
    scat.addColorStop(1, rgba(light, 0));
    // nucleus: a soft deeper-rose body with a faint lit core, fading out at its edge (never a dark hole)
    const nuc = nucleus;
    const nucG = scratch.createRadialGradient(0.25, -0.22, 0, 0, 0, 1);
    nucG.addColorStop(0, rgba(toHex(mixRGB(nuc, lit, 0.55)), 0.9));
    nucG.addColorStop(0.5, rgba(nuc, 0.75));
    nucG.addColorStop(0.82, rgba(nuc, 0.5));
    nucG.addColorStop(1, rgba(nuc, 0));
    s = { fill, rimG, bleed, scat, nucG, rimHex: rim, lightHex: light };
    memCache.set(key, s);
    return s;
  }
  const memPts = new Float32Array(160);
  FB.membrane = function (ctx, x, y, r, t, opts) {
    opts = opts || {};
    if (!(r > 0.5)) return;
    const p = pal(opts.pal);
    const body = opts.body || opts.color || p.body;
    const edge = opts.edge || FB.mix(body, FB.mix(p.tissue, p.bg, 0.3), 0.72);
    const rim = opts.rim || p.rim;
    const light = opts.light || p.light;
    const nucCol = opts.nucleusColor || FB.mix(FB.mix(body, p.tissue, 0.34), '#b03a5a', 0.12);
    const st = memStyle(body, edge, rim, light, nucCol);
    const la = opts.lightAngle == null ? FB.lightAngle(x, y) : opts.lightAngle;
    const cs = Math.cos(la), sn = Math.sin(la);
    const wob = opts.wobble == null ? 0.07 : opts.wobble;
    const freq = opts.wobbleFreq || 1.25;
    const seed = opts.seed || 0;
    const sx = seed * 7.13 + 11.1, sy = seed * 3.71 + 5.3;
    const sq = opts.squash || 1;
    const rot = (opts.rotation || 0) - la; // squash axis in the light-aligned frame
    const rc = Math.cos(rot), rs = Math.sin(rot);
    const swell = 1 + (opts.pulse || 0) * 0.05;
    const n = clamp(Math.round(r * 0.55 + 10), 14, 64) | 0;
    const ts = t * (opts.wobbleSpeed == null ? 0.35 : opts.wobbleSpeed);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU;
      // theta in world terms so the wobble pattern stays put if the light moves
      const ca = Math.cos(th + la), sa = Math.sin(th + la);
      const nn = 0.72 * noise2(sx + ca * freq + ts, sy + sa * freq - ts * 0.8) + 0.28 * noise2(sx * 1.9 + ca * freq * 2.3 - ts * 1.3, sy * 1.7 + sa * freq * 2.3 + ts);
      const rr = swell * (1 + wob * nn * 1.6);
      let px = Math.cos(th) * rr, py = Math.sin(th) * rr;
      if (sq !== 1) { // squash along the rotated axis, area kept
        const a = px * rc + py * rs, b = -px * rs + py * rc;
        const a2 = a * sq, b2 = b / sq;
        px = a2 * rc - b2 * rs; py = a2 * rs + b2 * rc;
      }
      memPts[i * 2] = px; memPts[i * 2 + 1] = py;
    }
    const path = new Path2D();
    let mx = (memPts[(n - 1) * 2] + memPts[0]) * 0.5, my = (memPts[(n - 1) * 2 + 1] + memPts[1]) * 0.5;
    path.moveTo(mx, my);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = memPts[i * 2], ay = memPts[i * 2 + 1];
      path.quadraticCurveTo(ax, ay, (ax + memPts[j * 2]) * 0.5, (ay + memPts[j * 2 + 1]) * 0.5);
    }
    path.closePath();

    const m = ctx.getTransform();
    const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    const alpha = (opts.alpha == null ? 0.88 : opts.alpha) * ga;
    const glowA = opts.glow == null ? 0.28 : opts.glow;
    // 1. halo behind the cell, offset toward the light
    if (glowA > 0 && r > 5) {
      ctx.globalCompositeOperation = 'lighter';
      glowFast(ctx, m, x + cs * r * 0.16, y + sn * r * 0.16, r * 1.5 * swell, light, glowA * 1.15 * ga);
    }
    setLocal(ctx, m, x, y, cs, sn, r);
    // 2. body
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = st.fill;
    ctx.fill(path);
    // 3. cytoplasm: three slow soft blotches of light inside (breaks up the flat fill), then granules
    const gr = FB.rng(seed * 31 + 7);
    ctx.globalCompositeOperation = 'lighter';
    if (opts.cytoplasm !== false && r > 22) {
      for (let i = 0; i < (r > 60 ? 3 : 2); i++) {
        const a = gr() * TAU + t * (gr() - 0.5) * 0.3, d = 0.15 + gr() * 0.25;
        const bx = Math.cos(a) * d, by = Math.sin(a) * d;
        glowFast(ctx, m, x + (bx * cs - by * sn) * r, y + (bx * sn + by * cs) * r, r * (0.32 + gr() * 0.2), light, ga * (0.1 + gr() * 0.08));
      }
    }
    const gn = opts.granules | 0;
    if (gn > 0) {
      const gs = Math.max(1.2, r * 0.03);
      for (let i = 0; i < gn; i++) {
        const a0 = gr() * TAU, d0 = 0.12 + Math.sqrt(gr()) * 0.6, sp = (gr() - 0.5) * 0.5;
        const a = a0 + t * sp, d = d0 * (0.85 + 0.15 * Math.sin(t * 0.7 + i));
        const bx = Math.cos(a) * d, by = Math.sin(a) * d;
        glowFast(ctx, m, x + (bx * cs - by * sn) * r, y + (bx * sn + by * cs) * r, gs * (1 + gr()), rim, ga * (0.35 + 0.35 * gr()));
      }
    }
    setLocal(ctx, m, x, y, cs, sn, r);
    // 4. nucleus: darker violet-red, offset away from the light, its own small lit crescent
    if (opts.nucleus) {
      const nr = typeof opts.nucleus === 'number' ? opts.nucleus : 0.38;
      const off = opts.nucleusOffset || [-0.1, 0.06];
      const nx = off[0] + 0.04 * Math.sin(t * 0.31 + seed), ny = off[1] + 0.04 * Math.cos(t * 0.27 + seed);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = ga * 0.92;
      ctx.fillStyle = st.nucG;
      setLocal(ctx, m, x + (nx * cs - ny * sn) * r, y + (nx * sn + ny * cs) * r, cs, sn, r * nr);
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
      setLocal(ctx, m, x, y, cs, sn, r);
    }
    // 5. warm scatter band inside the lit edge
    const scatA = opts.scatter == null ? 0.6 : opts.scatter;
    if (scatA > 0 && r > 18) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = ga * scatA;
      ctx.fillStyle = st.scat;
      ctx.fill(path);
    }
    // 6. rim: a soft band of light bleeding over the lit edge, then the thin cream line
    const rimPx = opts.rimWidth || clamp(r * 0.028, 1, 3.2);
    if (r > 14 && opts.bleed !== 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = st.bleed;
      ctx.globalAlpha = ga * 0.3;
      ctx.lineWidth = (rimPx * 3.5) / r;
      ctx.stroke(path);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = st.rimG;
    ctx.globalAlpha = ga * (opts.rimAlpha == null ? 0.9 : opts.rimAlpha);
    ctx.lineWidth = rimPx / r;
    ctx.stroke(path);
    ctx.setTransform(m);
    ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
  };

  // ---------------------------------------------------------------------------------------------
  // Blobs: a gooey cluster. Splat-and-threshold metaballs: each item adds a compact (1 - d^2/R^2)^3 kernel
  // into a small CPU field (Jamie Wong, "Metaballs and Marching Squares", 2014; Lucas Bebber, "Creative
  // Gooey Effects", Codrops 2015). The summed field is the smooth union, the job Quilez's smooth minimum
  // does for distance fields (Quilez, "Smooth minimum"); per-blob colours blend by kernel weight like his
  // smin blend factor. Capsules and tapered chains use his segment distance (sdSegment, uneven capsule)
  // with an exact min inside one chain, so limbs have no bulge at the joints. Where two kernels are about
  // equal a thin lit wall is drawn (cells pressed together). One putImageData and one upscaled drawImage.
  // Items: {x, y, r} circle | {x, y, x2, y2, r} capsule | {pts: [x0, y0, x1, y1, ...], rs: [r0, r1, ...]}
  // chain; optional w (weight), color, nucleus (fraction of r), nx, ny (nucleus offset, fraction of r).
  let blobF = new Float32Array(0), blobF1 = new Float32Array(0), blobF2 = new Float32Array(0), blobN = new Float32Array(0), blobC = new Float32Array(0);
  let blobRound = 0;
  function itemBounds(b, goo, out) {
    if (b.pts) {
      const P = b.pts;
      for (let i = 0; i < P.length; i += 2) { const R = (b.rs ? b.rs[i >> 1] : b.r) * goo; out[0] = Math.min(out[0], P[i] - R); out[1] = Math.min(out[1], P[i + 1] - R); out[2] = Math.max(out[2], P[i] + R); out[3] = Math.max(out[3], P[i + 1] + R); }
      return;
    }
    const R = b.r * goo, x2 = b.x2 == null ? b.x : b.x2, y2 = b.y2 == null ? b.y : b.y2;
    out[0] = Math.min(out[0], b.x - R, x2 - R); out[1] = Math.min(out[1], b.y - R, y2 - R);
    out[2] = Math.max(out[2], b.x + R, x2 + R); out[3] = Math.max(out[3], b.y + R, y2 + R);
  }
  FB.blobs = function (ctx, list, opts) {
    opts = opts || {};
    if (!list || !list.length) return null;
    const p = pal(opts.pal);
    const body = rgb(opts.color || opts.body || p.body);
    const rimC = rgb(opts.rim || p.rim);
    const lightC = rgb(opts.light || p.light);
    const hot = mixRGB(lightC, rimC, 0.55); // transmitted light, brighter than the body
    const wallC = mixRGB(rimC, hot, 0.45);
    const edgeMix = opts.edgeMix == null ? 0.7 : opts.edgeMix;
    const glowIn = opts.lum == null ? 0.9 : opts.lum;
    const bgC = rgb(opts.edge || FB.mix(toHex(body), FB.mix(p.tissue, p.bg, 0.3), 0.72));
    const nucC = rgb(opts.nucleusColor || FB.mix(FB.mix(toHex(body), p.tissue, 0.34), '#b03a5a', 0.12));
    const goo = opts.goo || 1.9, goo2 = goo * goo;
    const iso = Math.pow(1 - 1 / goo2, 3);
    const alphaBody = opts.alpha == null ? 0.92 : opts.alpha;
    const glowA = opts.glow == null ? 0.5 : opts.glow;
    const seams = opts.seams == null ? list.length > 1 : opts.seams;
    const bb4 = [1e9, 1e9, -1e9, -1e9];
    let rSum = 0, rN = 0, anyColor = false, anyNuc = false;
    for (const b of list) {
      itemBounds(b, goo, bb4);
      if (b.pts) { for (const r of (b.rs || [b.r])) { rSum += r; rN++; } } else { rSum += b.r; rN++; }
      if (b.color) anyColor = true;
      if (b.nucleus) anyNuc = true;
    }
    const x0 = bb4[0], y0 = bb4[1], x1 = bb4[2], y1 = bb4[3];
    const rAvg = rSum / Math.max(1, rN);
    const bw = x1 - x0, bh = y1 - y0;
    const c = Math.max(opts.cell || 1.25, Math.sqrt((bw * bh) / (opts.maxCells || 22000)));
    const pad = 2;
    const gw = Math.ceil(bw / c) + pad * 2 + 1, gh = Math.ceil(bh / c) + pad * 2 + 1;
    const ox = x0 - pad * c, oy = y0 - pad * c;
    const N = gw * gh;
    if (blobF.length < N) {
      const M = (N * 1.5) | 0;
      blobF = new Float32Array(M); blobF1 = new Float32Array(M); blobF2 = new Float32Array(M); blobN = new Float32Array(M); blobC = new Float32Array(M * 3);
    }
    const F = blobF, F1 = blobF1, F2 = blobF2, NF = blobN, CF = blobC;
    F.fill(0, 0, N);
    if (seams) { F1.fill(0, 0, N); F2.fill(0, 0, N); }
    if (anyNuc) NF.fill(0, 0, N);
    if (anyColor) CF.fill(0, 0, N * 3);
    const segA = new Float32Array(64);
    // Splat every item (cost is proportional to item area, not pixels x items).
    for (const b of list) {
      const wgt = b.w == null ? 1 : b.w;
      const col = b.color ? rgb(b.color) : body;
      // segments in cell units: [ax, ay, bx, by, ra, rb] (circles are zero-length segments)
      let ns = 0;
      if (b.pts) {
        const P = b.pts;
        const np = P.length >> 1;
        if (np === 1) { segA.set([(P[0] - ox) / c, (P[1] - oy) / c, (P[0] - ox) / c, (P[1] - oy) / c, (b.rs ? b.rs[0] : b.r) / c, (b.rs ? b.rs[0] : b.r) / c], 0); ns = 1; }
        for (let i = 0; i + 1 < np && ns < 10; i++, ns++) {
          const ra = (b.rs ? b.rs[i] : b.r) / c, rb = (b.rs ? b.rs[i + 1] : b.r) / c;
          segA[ns * 6] = (P[i * 2] - ox) / c; segA[ns * 6 + 1] = (P[i * 2 + 1] - oy) / c;
          segA[ns * 6 + 2] = (P[i * 2 + 2] - ox) / c; segA[ns * 6 + 3] = (P[i * 2 + 3] - oy) / c;
          segA[ns * 6 + 4] = ra; segA[ns * 6 + 5] = rb;
        }
      } else {
        segA[0] = (b.x - ox) / c; segA[1] = (b.y - oy) / c;
        segA[2] = ((b.x2 == null ? b.x : b.x2) - ox) / c; segA[3] = ((b.y2 == null ? b.y : b.y2) - oy) / c;
        segA[4] = segA[5] = b.r / c; ns = 1;
      }
      const lb = [1e9, 1e9, -1e9, -1e9];
      itemBounds(b, goo, lb);
      const i0 = Math.max(0, Math.floor((lb[0] - ox) / c)), i1 = Math.min(gw - 1, Math.ceil((lb[2] - ox) / c));
      const j0 = Math.max(0, Math.floor((lb[1] - oy) / c)), j1 = Math.min(gh - 1, Math.ceil((lb[3] - oy) / c));
      let nr2 = 0, ncx = 0, ncy = 0;
      if (b.nucleus) {
        const rr = b.pts ? (b.rs ? b.rs[0] : b.r) : b.r;
        const nr = (rr * (typeof b.nucleus === 'number' ? b.nucleus : 0.42) * goo) / c;
        nr2 = nr * nr;
        const bx = b.pts ? b.pts[0] : b.x, by = b.pts ? b.pts[1] : b.y;
        ncx = (bx - ox) / c + ((b.nx == null ? -0.12 : b.nx) * rr) / c;
        ncy = (by - oy) / c + ((b.ny == null ? 0.08 : b.ny) * rr) / c;
      }
      for (let j = j0; j <= j1; j++) {
        let k = j * gw + i0;
        for (let i = i0; i <= i1; i++, k++) {
          // min normalized distance over the item's segments
          let dn2 = 1e9;
          for (let sI = 0; sI < ns; sI++) {
            const o6 = sI * 6;
            const ax = segA[o6], ay = segA[o6 + 1], vx = segA[o6 + 2] - ax, vy = segA[o6 + 3] - ay;
            let dx = i - ax, dy = j - ay;
            const vv = vx * vx + vy * vy;
            let h = 0;
            if (vv > 1e-9) { h = (dx * vx + dy * vy) / vv; h = h < 0 ? 0 : h > 1 ? 1 : h; dx -= vx * h; dy -= vy * h; }
            const rr = segA[o6 + 4] + (segA[o6 + 5] - segA[o6 + 4]) * h;
            const v = (dx * dx + dy * dy) / (rr * rr);
            if (v < dn2) dn2 = v;
          }
          if (dn2 >= goo2) continue;
          const q = 1 - dn2 / goo2;
          const f = q * q * q * wgt;
          F[k] += f;
          if (seams) { if (f > F1[k]) { F2[k] = F1[k]; F1[k] = f; } else if (f > F2[k]) F2[k] = f; }
          if (anyColor) { const k3 = k * 3; CF[k3] += col[0] * f; CF[k3 + 1] += col[1] * f; CF[k3 + 2] += col[2] * f; }
          if (nr2 > 0) { const ex = i - ncx, ey = j - ncy, e2 = ex * ex + ey * ey; if (e2 < nr2) { const qn = 1 - e2 / nr2; NF[k] += qn * qn * qn; } }
        }
      }
    }
    // Shade: threshold, darker edge band, warm scatter inside the lit edge, back-light rim, lit cell walls,
    // nucleus, outer halo.
    const la = opts.lightAngle == null ? FB.lightAngle((x0 + x1) / 2, (y0 + y1) / 2) : opts.lightAngle;
    const Lx = Math.cos(la), Ly = Math.sin(la);
    const rimW = (opts.rimWidth || clamp(rAvg * 0.05, 1.1, 3.5)) / c;
    const rimK = 1 / rimW;
    const wallK = 1 / Math.max(0.55, rimW * 0.8);
    const buf = buffer(ctx, 'blobs' + (blobRound++ & 7), gw + 1, gh + 1);
    const D = buf.img.data, stride = buf.cw;
    const inv = 1 / (1 - iso);
    for (let j = 0; j <= gh; j++) {
      let o = j * stride * 4;
      for (let i = 0; i <= gw; i++, o += 4) {
        if (i === 0 || j === 0 || i >= gw - 1 || j >= gh - 1) { D[o + 3] = 0; continue; }
        const k = j * gw + i;
        const f = F[k];
        if (f < 0.012) { D[o + 3] = 0; continue; }
        const gx = (F[k + 1] - F[k - 1]) * 0.5, gy = (F[k + gw] - F[k - gw]) * 0.5;
        const gl = Math.sqrt(gx * gx + gy * gy) + 1e-6;
        const nX = -gx / gl, nY = -gy / gl;
        let lit = nX * Lx + nY * Ly; lit = lit > 0 ? lit : 0;
        const sd = (f - iso) / gl; // signed distance in cells, > 0 inside
        let aa = sd + 0.5; aa = aa < 0 ? 0 : aa > 1 ? 1 : aa;
        let hq = f / iso; hq = hq > 1 ? 1 : hq;
        const ha = glowA * hq * hq * hq * (0.4 + 0.6 * lit);
        let r = lightC[0], g = lightC[1], bl = lightC[2], A = ha;
        if (aa > 0) {
          let cr = body[0], cg = body[1], cb = body[2];
          if (anyColor) { const k3 = k * 3; cr = CF[k3] / f; cg = CF[k3 + 1] / f; cb = CF[k3 + 2] / f; }
          let hh = (f - iso) * inv; hh = hh < 0 ? 0 : hh > 1 ? 1 : hh;
          // each cell its own dome when walls are on
          let dome = hh;
          let wallLine = 0, wallBand = 0;
          if (seams && F2[k] > 0.015) {
            const a1 = F1[k] - F2[k];
            const gsx = ((F1[k + 1] - F2[k + 1]) - (F1[k - 1] - F2[k - 1])) * 0.5;
            const gsy = ((F1[k + gw] - F2[k + gw]) - (F1[k - gw] - F2[k - gw])) * 0.5;
            const gsl = Math.sqrt(gsx * gsx + gsy * gsy) + 1e-6;
            const dw = a1 / gsl; // cells from the wall
            const ov = F2[k] / (F1[k] + 1e-6); // how much the two cells overlap here
            wallLine = Math.exp(-dw * wallK) * smooth(0.05, 0.35, ov);
            wallBand = Math.exp(-dw * wallK * 0.3) * smooth(0.05, 0.35, ov);
            dome = Math.min(hh, F1[k]);
          }
          const e = Math.pow(1 - dome, 1.6);
          const em = Math.min(1, e * edgeMix + wallBand * 0.18);
          cr += (bgC[0] - cr) * em; cg += (bgC[1] - cg) * em; cb += (bgC[2] - cb) * em;
          // luminous dome: light passing through the thick middle, plus warm scatter inside the lit edge
          // (green and blue weaker than red, as light through tissue)
          const sc = Math.min(1, dome * Math.sqrt(dome) * glowIn * (0.7 + 0.3 * lit) + (1 - hh) * lit * 0.45);
          cr += (hot[0] - cr) * sc; cg += (hot[1] - cg) * sc * 0.88; cb += (hot[2] - cb) * sc * 0.75;
          if (anyNuc) {
            const nv = NF[k];
            if (nv > 0.02) {
              let na = (nv - iso) * 2.6; na = na < 0 ? 0 : na > 1 ? 1 : na;
              const nm = na * 0.42;
              cr += (nucC[0] - cr) * nm; cg += (nucC[1] - cg) * nm; cb += (nucC[2] - cb) * nm;
              const core = na * na * 0.12; // a faint lit core keeps it soft, never a hole
              cr += (lightC[0] - cr) * core; cg += (lightC[1] - cg) * core; cb += (lightC[2] - cb) * core;
            }
          }
          // back-light rim at the outer surface, strongest facing the light; lit walls between cells
          const sdp = sd > 0 ? sd : 0;
          const rl = Math.exp(-sdp * rimK) * (0.22 + 0.78 * Math.pow(lit, 0.8));
          cr += (rimC[0] - cr) * rl; cg += (rimC[1] - cg) * rl; cb += (rimC[2] - cb) * rl;
          const wl = wallLine * 0.6;
          if (wl > 0.003) { cr += (wallC[0] - cr) * wl; cg += (wallC[1] - cg) * wl; cb += (wallC[2] - cb) * wl; }
          const ai = aa * Math.max(alphaBody, rl);
          const outA = ai + ha * (1 - ai);
          if (outA > 0) {
            const hw = ha * (1 - ai);
            r = (cr * ai + lightC[0] * hw) / outA; g = (cg * ai + lightC[1] * hw) / outA; bl = (cb * ai + lightC[2] * hw) / outA;
          }
          A = outA;
        }
        D[o] = r; D[o + 1] = g; D[o + 2] = bl; D[o + 3] = A * 255;
      }
    }
    buf.ctx.putImageData(buf.img, 0, 0, 0, 0, gw + 1, gh + 1);
    const sm = ctx.imageSmoothingEnabled, sq = ctx.imageSmoothingQuality;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'source-over';
    // cell centre (i, j) maps to (ox + i c, oy + j c)
    ctx.drawImage(buf.canvas, 0, 0, gw, gh, ox - c * 0.5, oy - c * 0.5, gw * c, gh * c);
    ctx.imageSmoothingEnabled = sm; ctx.imageSmoothingQuality = sq;
    ctx.globalCompositeOperation = op;
    return { x: x0, y: y0, w: bw, h: bh, cell: c };
  };

  // ---------------------------------------------------------------------------------------------
  // Sperm: glowing head and an undulating tapered tail. Tail: none fit, our own design (design.md 14.2):
  // a travelling sine whose amplitude grows toward the tip, drawn as one filled ribbon with a fading
  // gradient, plus a wider additive ribbon for glow. angle is the heading (radians, 0 = +x).
  const spCache = new Map();
  function spermStyle(color, rim, bg) {
    const key = color + rim + bg;
    let s = spCache.get(key);
    if (s) return s;
    if (spCache.size > 200) spCache.clear();
    const tail = scratch.createLinearGradient(-0.06, 0, -1, 0);
    tail.addColorStop(0, rgba(FB.mix(color, rim, 0.35), 0.95));
    tail.addColorStop(0.2, rgba(color, 0.85));
    tail.addColorStop(0.65, rgba(color, 0.4));
    tail.addColorStop(1, rgba(color, 0));
    // the glow along the tail fades fast: light gathers near the head
    const tailGlow = scratch.createLinearGradient(-0.06, 0, -0.75, 0);
    tailGlow.addColorStop(0, rgba(color, 0.7));
    tailGlow.addColorStop(0.35, rgba(color, 0.22));
    tailGlow.addColorStop(1, rgba(color, 0));
    const head = scratch.createRadialGradient(0.3, -0.25, 0, 0, 0, 1);
    head.addColorStop(0, rgba(FB.mix(rim, '#ffffff', 0.4), 1));
    head.addColorStop(0.32, rgba(FB.mix(color, rim, 0.55), 1));
    head.addColorStop(0.72, rgba(color, 1));
    head.addColorStop(0.92, rgba(FB.mix(color, bg, 0.25), 0.95));
    head.addColorStop(1, rgba(FB.mix(color, bg, 0.25), 0));
    s = { tail, tailGlow, head };
    spCache.set(key, s);
    return s;
  }
  const tailPts = new Float32Array(64);
  FB.sperm = function (ctx, x, y, angle, t, opts) {
    opts = opts || {};
    const p = pal(opts.pal);
    const color = opts.color || p.cue;
    const rim = opts.rim || p.rim;
    const size = opts.size || 48;
    const glow = opts.glow == null ? 0.6 : opts.glow;
    const st = spermStyle(color, rim, p.bg);
    const phase = opts.phase || 0;
    const hz = opts.speed == null ? 1.8 : opts.speed;
    const amp = opts.amp == null ? 0.075 : opts.amp;
    const waves = opts.waves == null ? 1.35 : opts.waves;
    const ga = ctx.globalAlpha, op = ctx.globalCompositeOperation;
    const alpha = opts.alpha == null ? 1 : opts.alpha;
    const m = ctx.getTransform();
    const w = TAU * hz * t + phase;
    // head yaw against the tail beat
    const yaw = Math.sin(w) * amp * 0.9;
    const cs = Math.cos(angle + yaw), sn = Math.sin(angle + yaw);
    const hl = 0.16, hw = 0.108;      // head length, width (fractions of size)
    const L = 1 - hl * 0.5;           // tail length
    const S = 15;
    const w0 = Math.max(0.9 / size, 0.021);
    for (let i = 0; i <= S; i++) {
      const s = i / S;
      const a = amp * (0.1 + 0.9 * Math.pow(s, 1.25));
      tailPts[i * 2] = -hl * 0.45 - s * L;
      tailPts[i * 2 + 1] = a * Math.sin(TAU * waves * s - w) - a * 0.1 * Math.sin(w);
    }
    const ribbon = (scale) => {
      const path = new Path2D();
      const capIn = scale > 1 ? 0.12 : 0; // the glow ribbon swells in behind the head instead of a square end
      const wAt = (s) => (w0 * Math.pow(1 - s, 0.8) + 0.004) * scale * (capIn ? smooth(0, capIn, s) * 0.85 + 0.15 : 1);
      for (let i = 0; i <= S; i++) {
        const s = i / S, wd = wAt(s);
        const i0 = Math.max(0, i - 1), i1 = Math.min(S, i + 1);
        let tx = tailPts[i1 * 2] - tailPts[i0 * 2], ty = tailPts[i1 * 2 + 1] - tailPts[i0 * 2 + 1];
        const tl = Math.sqrt(tx * tx + ty * ty) || 1; tx /= tl; ty /= tl;
        const X = tailPts[i * 2] - ty * wd, Y = tailPts[i * 2 + 1] + tx * wd;
        i ? path.lineTo(X, Y) : path.moveTo(X, Y);
      }
      for (let i = S; i >= 0; i--) {
        const s = i / S, wd = wAt(s);
        const i0 = Math.max(0, i - 1), i1 = Math.min(S, i + 1);
        let tx = tailPts[i1 * 2] - tailPts[i0 * 2], ty = tailPts[i1 * 2 + 1] - tailPts[i0 * 2 + 1];
        const tl = Math.sqrt(tx * tx + ty * ty) || 1; tx /= tl; ty /= tl;
        path.lineTo(tailPts[i * 2] + ty * wd, tailPts[i * 2 + 1] - tx * wd);
      }
      path.closePath();
      return path;
    };
    // glow behind the head
    if (glow > 0) {
      ctx.globalCompositeOperation = 'lighter';
      glowFast(ctx, m, x, y, size * 0.36, color, ga * alpha * glow * 0.75);
    }
    setLocal(ctx, m, x, y, cs, sn, size);
    if (glow > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = ga * alpha * glow * 0.35;
      ctx.fillStyle = st.tailGlow;
      ctx.fill(ribbon(2.6));
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ga * alpha;
    ctx.fillStyle = st.tail;
    ctx.fill(ribbon(1));
    // head: a soft oval, slightly pointed toward the front
    setLocalXY(ctx, m, x, y, cs, sn, size * hl * 0.5, size * hw * 0.5);
    ctx.fillStyle = st.head;
    // a soft teardrop: round at the front, a little narrower toward the tail
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.bezierCurveTo(1, 0.62, 0.45, 1.02, -0.2, 0.95);
    ctx.bezierCurveTo(-0.75, 0.86, -1.08, 0.42, -1.08, 0);
    ctx.bezierCurveTo(-1.08, -0.42, -0.75, -0.86, -0.2, -0.95);
    ctx.bezierCurveTo(0.45, -1.02, 1, -0.62, 1, 0);
    ctx.fill();
    ctx.setTransform(m);
    // a small bright core in the head
    if (glow > 0) {
      ctx.globalCompositeOperation = 'lighter';
      glowFast(ctx, m, x + cs * size * 0.02, y + sn * size * 0.02, size * 0.07, rim, ga * alpha * (0.35 + 0.4 * glow));
      ctx.setTransform(m);
    }
    ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
  };

  // ---------------------------------------------------------------------------------------------
  // Particles: soft motes advected by curl noise (Bridson et al. 2007) with an optional laminar current
  // (psi = U y) and Bridson's wall ramp (opts.wall(x, y) -> distance to the nearest wall in px).
  // Small motes are tiny additive squares (cheap), larger ones use the glow gradient (research A0/A4).
  const tmpV = [0, 0];
  FB.particles = function (state, ctx, w, h, t, opts) {
    opts = opts || {};
    const p = pal(opts.pal);
    const n = opts.count || 160;
    const scale = opts.scale || 170;
    const speed = opts.speed == null ? 16 : opts.speed;
    const flow = opts.flow || [0, 0];
    const wall = opts.wall || null, d0 = opts.wallRange || scale * 0.5;
    if (!state.x || state.n !== n || state.w !== w || state.h !== h || t < state.t - 1e-6 || t - state.t > 5) {
      const r = FB.rng(opts.seed == null ? 99 : opts.seed);
      state.n = n; state.w = w; state.h = h; state.rng = r;
      state.x = new Float32Array(n); state.y = new Float32Array(n);
      state.life = new Float32Array(n); state.rate = new Float32Array(n);
      state.size = new Float32Array(n); state.tone = new Uint8Array(n);
      for (let i = 0; i < n; i++) spawn(state, i, w, h, opts, true);
      // warm up so a still frame already shows the flow
      const warm = Math.min(t, opts.warmup == null ? 2.5 : opts.warmup);
      state.t = t - warm;
      while (state.t < t - 1e-6) step(state, Math.min(1 / 20, t - state.t), w, h);
    }
    step(state, Math.min(0.1, t - state.t), w, h);
    function step(S, dt, W, H) {
      const tt = S.t;
      const zx = tt * 0.045, zy = -tt * 0.03;
      const k = speed / 1.6;
      for (let i = 0; i < S.n; i++) {
        let x = S.x[i], y = S.y[i];
        const nx = x / scale + zx, ny = y / scale + zy;
        FB.curl(nx, ny, tmpV);
        let vx = tmpV[0] * k, vy = tmpV[1] * k;
        if (wall) { // Bridson ramp on the noise part: flow slides along walls
          const d = wall(x, y);
          const rr = FB.ramp(d / d0);
          const e = 2;
          const gx = (FB.ramp(wall(x + e, y) / d0) - FB.ramp(wall(x - e, y) / d0)) / (2 * e);
          const gy = (FB.ramp(wall(x, y + e) / d0) - FB.ramp(wall(x, y - e) / d0)) / (2 * e);
          const psi = noise2(nx, ny) * k * scale;
          vx = vx * rr + psi * gy; vy = vy * rr - psi * gx;
        }
        x += (vx + flow[0]) * dt; y += (vy + flow[1]) * dt;
        S.life[i] += dt * S.rate[i];
        if (S.life[i] >= 1) { spawn(S, i, W, H, opts, false); continue; }
        const mg = 24;
        if (x < -mg) x += W + mg * 2; else if (x > W + mg) x -= W + mg * 2;
        if (y < -mg) y += H + mg * 2; else if (y > H + mg) y -= H + mg * 2;
        S.x[i] = x; S.y[i] = y;
      }
      S.t = tt + dt;
    }
    // draw
    const c1 = opts.color || p.rim, c2 = opts.color2 || p.light;
    const base = opts.alpha == null ? 0.6 : opts.alpha;
    const m = ctx.getTransform();
    const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    ctx.globalCompositeOperation = opts.blend || 'lighter';
    const s1 = rgba(c1, 1), s2 = rgba(c2, 1);
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 0) ctx.fillStyle = s1;
      for (let i = 0; i < state.n; i++) {
        const sz = state.size[i];
        const big = sz >= 1.7;
        if ((pass === 0) === big) continue;
        const l = state.life[i];
        const fade = Math.sin(Math.PI * l);
        const a = ga * base * fade * fade * (0.55 + 0.45 * Math.sin(t * 1.3 + i));
        if (a < 0.01) continue;
        const col = state.tone[i] ? c2 : c1;
        if (!big) {
          if (pass === 0) {
            ctx.fillStyle = state.tone[i] ? s2 : s1;
            ctx.globalAlpha = a * 0.45;
            ctx.fillRect(state.x[i] - sz, state.y[i] - sz, sz * 2, sz * 2);
            ctx.globalAlpha = a;
            ctx.fillRect(state.x[i] - sz * 0.5, state.y[i] - sz * 0.5, sz, sz);
          }
        } else {
          glowFast(ctx, m, state.x[i], state.y[i], sz * 2.6, col, a);
        }
      }
      if (pass === 1) ctx.setTransform(m);
    }
    ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
  };
  function spawn(S, i, W, H, opts, first) {
    const r = S.rng;
    const reg = opts.region;
    if (reg) { S.x[i] = reg.x + r() * reg.w; S.y[i] = reg.y + r() * reg.h; } else { S.x[i] = r() * W; S.y[i] = r() * H; }
    S.life[i] = first ? r() : 0;
    S.rate[i] = 1 / (4 + r() * 7);
    const sz = opts.size || 1.6;
    const big = r() < (opts.bigShare == null ? 0.22 : opts.bigShare);
    S.size[i] = big ? sz * (1.3 + r() * 1.6) : sz * (0.45 + r() * 0.5);
    S.tone[i] = r() < (opts.mix == null ? 0.3 : opts.mix) ? 1 : 0;
  }

  // ---------------------------------------------------------------------------------------------
  // Cilia: a row of hair-like strokes along a path with a metachronal travelling wave: each hair bends
  // more toward its tip, angle_j = A (j/S)^2 sin(w t - k i), neighbours lag in phase (metachronal-wave
  // review, PMC11044847; research A5). All hairs go into one tapered-ribbon path: one fill, one glow stroke.
  FB.cilia = function (ctx, path, t, opts) {
    opts = opts || {};
    const p = pal(opts.pal);
    const pts = normPath(path);
    if (pts.length < 4) return;
    const len = opts.length || 22;
    const spacing = opts.spacing || Math.max(5, len * 0.26);
    const side = opts.side == null ? 1 : opts.side;
    const amp = opts.amp == null ? 0.85 : opts.amp;
    const hz = opts.freq == null ? 1 : opts.freq;
    const lag = opts.lag == null ? 0.38 : opts.lag;
    const tilt = opts.tilt == null ? 0.35 : opts.tilt;
    const wb = opts.width || Math.max(0.9, len * 0.034);
    const color = opts.color || FB.mix(p.rim, p.light, 0.35), base = opts.base || p.light;
    const samples = resample(pts, spacing);
    const S = 5;
    const hair = new Path2D(), spine = new Path2D();
    const wph = TAU * hz * t;
    const rr = FB.rng(opts.seed || 5);
    for (let i = 0; i < samples.length; i++) {
      const sm = samples[i];
      const nx = -sm.ty * side, ny = sm.tx * side;
      // asymmetric beat: a quick power stroke and a slow recovery
      const ph = wph - lag * i + (rr() - 0.5) * 0.6;
      const beat = Math.sin(ph) + 0.35 * Math.sin(2 * ph + 0.6);
      const L = len * (0.6 + 0.55 * rr());
      let ang = Math.atan2(ny, nx) + side * (tilt + (rr() - 0.5) * 0.3);
      let x = sm.x, y = sm.y;
      const lx = new Array(S + 1), ly = new Array(S + 1);
      lx[0] = x; ly[0] = y;
      for (let j = 1; j <= S; j++) {
        const f = j / S;
        const a = ang + side * amp * f * f * beat * 0.9;
        x += Math.cos(a) * (L / S); y += Math.sin(a) * (L / S);
        lx[j] = x; ly[j] = y;
      }
      spine.moveTo(lx[0], ly[0]);
      for (let j = 1; j <= S; j++) spine.lineTo(lx[j], ly[j]);
      // ribbon
      for (let j = 0; j <= S; j++) {
        const jj = Math.min(S, j + 1), j0 = Math.max(0, j - 1);
        let tx = lx[jj] - lx[j0], ty = ly[jj] - ly[j0]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const wd = wb * 0.5 * (1 - j / S * 0.85);
        j ? hair.lineTo(lx[j] - ty * wd, ly[j] + tx * wd) : hair.moveTo(lx[j] - ty * wd, ly[j] + tx * wd);
      }
      for (let j = S; j >= 0; j--) {
        const jj = Math.min(S, j + 1), j0 = Math.max(0, j - 1);
        let tx = lx[jj] - lx[j0], ty = ly[jj] - ly[j0]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const wd = wb * 0.5 * (1 - j / S * 0.85);
        hair.lineTo(lx[j] + ty * wd, ly[j] - tx * wd);
      }
      hair.closePath();
    }
    const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    const glow = opts.glow == null ? 1 : opts.glow;
    // a faint band of light along the base, soft at its edges (three widening strokes)
    const wall = new Path2D();
    wall.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) wall.lineTo(pts[i], pts[i + 1]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(base, 1);
    const bands = [[0.12, 0.07], [0.3, 0.035], [0.6, 0.02]];
    for (const [wf, a] of bands) { ctx.globalAlpha = ga * a * glow; ctx.lineWidth = len * wf; ctx.stroke(wall); }
    // hairs: a soft halo along each hair, then the translucent tapered fill
    ctx.globalAlpha = ga * 0.07 * glow;
    ctx.strokeStyle = rgba(color, 1);
    ctx.lineWidth = wb * 2.2;
    ctx.stroke(spine);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ga * (opts.alpha == null ? 0.5 : opts.alpha);
    ctx.fillStyle = rgba(color, 1);
    ctx.fill(hair);
    ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
  };
  function normPath(path) { // accepts [{x,y}], [[x,y]] or [x0,y0,x1,y1,...]
    if (!path || !path.length) return [];
    if (typeof path[0] === 'number') return path;
    const out = [];
    for (const q of path) { if (Array.isArray(q)) out.push(q[0], q[1]); else out.push(q.x, q.y); }
    return out;
  }
  function resample(pts, spacing) {
    const out = [];
    let carry = spacing * 0.5;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      const tx = dx / L, ty = dy / L;
      let d = carry;
      while (d <= L) { out.push({ x: ax + tx * d, y: ay + ty * d, tx, ty }); d += spacing; }
      carry = d - L;
    }
    return out;
  }
  FB.resample = (path, spacing) => resample(normPath(path), spacing);

  // ---------------------------------------------------------------------------------------------
  // Branch: Runions, Lane and Prusinkiewicz, "Modeling Trees with a Space Colonization Algorithm" (2007),
  // with the 2D venation setting of Runions et al. (SIGGRAPH 2005). Attraction points in a region pull the
  // nearest node within d_i; nodes step D toward the mean direction; points closer than d_k are removed.
  // Widths by the pipe model w_parent^n = sum w_child^n, computed at draw time for the visible part.
  FB.branch = function (seed, opts) {
    opts = opts || {};
    const r = FB.rng(seed == null ? 1 : seed);
    const D = opts.step || 6;
    const di = opts.influence || D * 8;
    const dk = opts.kill || D * 2;
    const maxNodes = opts.maxNodes || 260;
    const maxIter = opts.iterations || 400;
    const bias = opts.bias || null;
    const reg = opts.region || { x: opts.x || 0, y: (opts.y || 0) - 80, r: 80 };
    const pts = [];
    const count = opts.count || 300;
    for (let i = 0; i < count; i++) {
      if (typeof reg === 'function') { pts.push(reg(r)); continue; }
      if (reg.r != null) { // disc (or a ring sector with reg.inner, reg.a0, reg.a1)
        const a = reg.a0 != null ? reg.a0 + r() * (reg.a1 - reg.a0) : r() * TAU;
        const inner = reg.inner || 0;
        const d = Math.sqrt(inner * inner + r() * (reg.r * reg.r - inner * inner));
        pts.push({ x: reg.x + Math.cos(a) * d, y: reg.y + Math.sin(a) * d * (reg.squash || 1) });
      } else pts.push({ x: reg.x + r() * reg.w, y: reg.y + r() * reg.h });
    }
    const roots = opts.roots || [{ x: opts.x || 0, y: opts.y || 0 }];
    const nodes = roots.map((q) => ({ x: q.x, y: q.y, parent: -1, iter: 0, s: 0, depth: 0 }));
    const kids = nodes.map(() => 0);
    let alive = pts.map(() => true);
    let iter = 0;
    // trunk: grow from each root toward the region until a point is in range
    const target = typeof reg === 'function' ? { x: pts[0].x, y: pts[0].y } : { x: reg.x + (reg.w || 0) / 2, y: reg.y + (reg.h || 0) / 2 };
    for (let guard = 0; guard < 200; guard++) {
      let inRange = false;
      for (let i = 0; i < pts.length && !inRange; i++) for (const nd of nodes) { if (Math.hypot(pts[i].x - nd.x, pts[i].y - nd.y) < di) { inRange = true; break; } }
      if (inRange) break;
      const n0 = nodes.length;
      iter++;
      for (let k = 0; k < n0; k++) {
        const nd = nodes[k];
        if (kids[k]) continue;
        const dx = target.x - nd.x, dy = target.y - nd.y, L = Math.hypot(dx, dy) || 1;
        nodes.push({ x: nd.x + (dx / L) * D, y: nd.y + (dy / L) * D, parent: k, iter, s: nd.s + D, depth: nd.depth });
        kids[k]++; kids.push(0);
      }
    }
    while (iter < maxIter && nodes.length < maxNodes) {
      const n0 = nodes.length;
      const sumX = new Float32Array(n0), sumY = new Float32Array(n0), cnt = new Uint16Array(n0);
      let any = false;
      for (let i = 0; i < pts.length; i++) {
        if (!alive[i]) continue;
        const q = pts[i];
        let best = -1, bd = di * di;
        for (let k = 0; k < n0; k++) { const dx = q.x - nodes[k].x, dy = q.y - nodes[k].y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = k; } }
        if (best < 0) continue;
        const dl = Math.sqrt(bd) || 1;
        sumX[best] += (q.x - nodes[best].x) / dl; sumY[best] += (q.y - nodes[best].y) / dl; cnt[best]++;
        any = true;
      }
      if (!any) break;
      iter++;
      for (let k = 0; k < n0 && nodes.length < maxNodes; k++) {
        if (!cnt[k]) continue;
        let dx = sumX[k], dy = sumY[k];
        if (bias) { dx += bias.x * cnt[k]; dy += bias.y * cnt[k]; }
        let L = Math.hypot(dx, dy);
        if (L < 1e-3) { dx = r() - 0.5; dy = r() - 0.5; L = Math.hypot(dx, dy); }
        const nd = nodes[k];
        nodes.push({ x: nd.x + (dx / L) * D, y: nd.y + (dy / L) * D, parent: k, iter, s: nd.s + D, depth: nd.depth + (kids[k] ? 1 : 0) });
        kids[k]++; kids.push(0);
      }
      for (let i = 0; i < pts.length; i++) {
        if (!alive[i]) continue;
        for (let k = n0; k < nodes.length; k++) { const dx = pts[i].x - nodes[k].x, dy = pts[i].y - nodes[k].y; if (dx * dx + dy * dy < dk * dk) { alive[i] = false; break; } }
      }
    }
    // prune short spurs: leaf chains of fewer than `prune` nodes hanging off a fork read as thorns
    const prune = opts.prune == null ? 3 : opts.prune;
    const dead = new Uint8Array(nodes.length);
    if (prune > 0) {
      for (let k = nodes.length - 1; k >= 0; k--) {
        if (kids[k] !== 0 || nodes[k].parent < 0) continue;
        let len = 0, q = k;
        while (q >= 0 && nodes[q].parent >= 0 && kids[nodes[q].parent] === 1 && len < prune) { len++; q = nodes[q].parent; }
        if (len < prune && q >= 0 && nodes[q].parent >= 0 && kids[nodes[q].parent] > 1) {
          let r2 = k; for (let i = 0; i <= len; i++) { dead[r2] = 1; r2 = nodes[r2].parent; }
          kids[q === k ? nodes[k].parent : nodes[q].parent]--;
        }
      }
    }
    const segs = [];
    const segOf = new Int32Array(nodes.length).fill(-1);
    for (let k = 0; k < nodes.length; k++) {
      const nd = nodes[k];
      if (nd.parent < 0 || dead[k]) continue;
      const pa = nodes[nd.parent];
      segOf[k] = segs.length;
      segs.push({ x0: pa.x, y0: pa.y, x1: nd.x, y1: nd.y, iter: nd.iter, depth: nd.depth, s: nd.s, parent: segOf[nd.parent], t0: 0, t1: 0, w: 0 });
    }
    const total = Math.max(1, iter);
    let sMax = 0;
    for (const sg of segs) { sg.t0 = (sg.iter - 1) / total; sg.t1 = sg.iter / total; sMax = Math.max(sMax, sg.s); }
    segs.sMax = sMax; segs.iterations = total; segs.nodes = nodes.length;
    // leaves (segments nothing grows from) get a bulb when drawn: terminal villi are rounded
    const hasChild = new Uint8Array(segs.length);
    for (const sg of segs) if (sg.parent >= 0) hasChild[sg.parent] = 1;
    for (let i = 0; i < segs.length; i++) segs[i].leaf = !hasChild[i];
    segs.pipe = opts.pipe || 2.2;
    return segs;
  };

  // Draws the part of a branch tree grown by `progress` (0..1). Passes: additive halo, body, a light core
  // (vessels lit from behind), glowing growing tips, and an optional pulse that travels by arc length:
  // one swell per beat, exp(-((phase - s/c - 0.08)/0.06)^2) (design.md 14.2, our own design).
  const pipeW = new Float32Array(4096);
  FB.drawBranch = function (ctx, segs, progress, opts) {
    opts = opts || {};
    if (!segs || !segs.length) return;
    const p = pal(opts.pal);
    const color = opts.color || p.body, core = opts.core || p.rim, glowC = opts.glowColor || p.light;
    const tip = opts.tip || 1.1, maxW = opts.maxWidth || 8, wScale = opts.width || 1;
    const n = segs.length, ex = segs.pipe || 2.2;
    progress = clamp(progress == null ? 1 : progress, 0, 1);
    const W = n <= pipeW.length ? pipeW : new Float32Array(n);
    for (let i = 0; i < n; i++) W[i] = 0;
    // pipe model over the visible part, children first (they come after their parents)
    for (let i = n - 1; i >= 0; i--) {
      const sg = segs[i];
      if (sg.t0 >= progress) continue;
      if (W[i] === 0) W[i] = Math.pow(tip, ex);
      if (sg.parent >= 0) W[sg.parent] += W[i];
    }
    const buckets = 7;
    const paths = [];
    for (let b = 0; b < buckets; b++) paths.push(new Path2D());
    const bw = new Float32Array(buckets);
    const tips = [], leaves = [];
    let wmax = 0;
    for (let i = 0; i < n; i++) { if (segs[i].t0 < progress) { const wv = Math.min(maxW, Math.pow(W[i], 1 / ex) * wScale); W[i] = wv; if (wv > wmax) wmax = wv; } }
    for (let i = 0; i < n; i++) {
      const sg = segs[i];
      if (sg.t0 >= progress) continue;
      const f = sg.t1 <= progress ? 1 : (progress - sg.t0) / (sg.t1 - sg.t0);
      const x1 = sg.x0 + (sg.x1 - sg.x0) * f, y1 = sg.y0 + (sg.y1 - sg.y0) * f;
      const wv = W[i];
      const b = Math.min(buckets - 1, Math.floor((wv / (wmax + 1e-6)) * buckets));
      paths[b].moveTo(sg.x0, sg.y0); paths[b].lineTo(x1, y1);
      bw[b] = Math.max(bw[b], wv);
      if (f < 1 && tips.length < 80) tips.push(x1, y1);
      else if (f >= 1 && sg.leaf && opts.bulbs !== false && leaves.length < 240) leaves.push(x1, y1, wv);
    }
    const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // halo
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(glowC, 1);
    for (let b = 0; b < buckets; b++) { if (!bw[b]) continue; ctx.globalAlpha = ga * (opts.glow == null ? 0.16 : opts.glow); ctx.lineWidth = bw[b] * 2.8 + 3; ctx.stroke(paths[b]); }
    // body
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ga * (opts.alpha == null ? 0.95 : opts.alpha);
    ctx.strokeStyle = rgba(color, 1);
    for (let b = 0; b < buckets; b++) { if (!bw[b]) continue; ctx.lineWidth = bw[b]; ctx.stroke(paths[b]); }
    // light core in the thicker vessels
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(core, 1);
    for (let b = 0; b < buckets; b++) { if (bw[b] < 1.6) continue; ctx.globalAlpha = ga * 0.38; ctx.lineWidth = bw[b] * 0.32; ctx.stroke(paths[b]); }
    const m = ctx.getTransform();
    // bulbs on finished leaves (terminal villi), one path
    if (leaves.length) {
      const bp = new Path2D();
      for (let i = 0; i < leaves.length; i += 3) { const r = leaves[i + 2] * 1.25 + 1.6; bp.moveTo(leaves[i] + r, leaves[i + 1]); bp.arc(leaves[i], leaves[i + 1], r, 0, TAU); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = ga * (opts.alpha == null ? 0.95 : opts.alpha);
      ctx.fillStyle = rgba(color, 1);
      ctx.fill(bp);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = ga * 0.16;
      ctx.fillStyle = rgba(core, 1);
      ctx.fill(bp);
    }
    // growing tips
    if (opts.tips !== false && progress < 1) for (let i = 0; i < tips.length; i += 2) glowFast(ctx, m, tips[i], tips[i + 1], 4 + tip * 3, core, ga * 0.45);
    // travelling pulse
    if (opts.pulse != null) {
      const c = opts.pulseSpeed || 0.6; // share of sMax travelled per beat
      const ph = opts.pulse;
      for (let i = 0; i < n; i += 2) {
        const sg = segs[i];
        if (sg.t1 > progress) continue;
        let x = ph - (sg.s / segs.sMax) / c - 0.08;
        x -= Math.round(x);
        const v = Math.exp(-(x / 0.06) * (x / 0.06));
        if (v < 0.08) continue;
        glowFast(ctx, m, (sg.x0 + sg.x1) * 0.5, (sg.y0 + sg.y1) * 0.5, 4 + W[i] * 2.2, opts.pulseColor || p.cue, ga * v * 0.5);
      }
    }
    ctx.setTransform(m);
    ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
  };

  // ---------------------------------------------------------------------------------------------
  // Figure: the abstract baby. Soft blobs on a 2D skeleton (a head, a tapered spine chain, two-joint limb
  // chains), drawn through FB.blobs, after Blinn, "A Generalization of Algebraic Surface Drawing" (1982), as
  // splats (design.md 14.2 and 14.4). No face, no features: the head is one smooth blob. Units of s (about
  // crown to rump). +x is the front of the body, y is down. Joints are [x, y, radius].
  const POSES = {
    curl: {
      H: [0.19, -0.33, 0.285],
      spine: [[0.07, -0.15, 0.15], [-0.03, -0.02, 0.215], [-0.05, 0.13, 0.215], [0.0, 0.27, 0.19]],
      a: [[0.08, -0.07, 0.064], [0.14, 0.04, 0.052], [0.27, -0.09, 0.042]],
      A: [[0.05, -0.1, 0.056], [0.13, 0.0, 0.046], [0.25, -0.15, 0.038]],
      l: [[0.0, 0.25, 0.105], [0.32, 0.16, 0.078], [0.24, 0.38, 0.056]],
      L: [[-0.03, 0.22, 0.098], [0.3, 0.1, 0.072], [0.28, 0.33, 0.052]],
      rot: 0
    },
    stretch: {
      H: [0.08, -0.45, 0.275],
      spine: [[0.04, -0.23, 0.15], [0.0, -0.06, 0.205], [-0.01, 0.12, 0.205], [0.02, 0.29, 0.18]],
      a: [[0.07, -0.09, 0.064], [0.25, -0.13, 0.052], [0.4, -0.26, 0.042]],
      A: [[0.03, -0.1, 0.056], [0.13, 0.04, 0.046], [0.25, -0.05, 0.038]],
      l: [[0.04, 0.29, 0.1], [0.17, 0.52, 0.076], [0.13, 0.73, 0.056]],
      L: [[0.0, 0.27, 0.096], [0.27, 0.22, 0.072], [0.22, 0.44, 0.052]],
      rot: 0
    }
  };
  function lerpDeep(a, b, k) { return Array.isArray(a) ? a.map((v, i) => lerpDeep(v, b[i], k)) : lerp(a, b, k); }
  function mixPose(a, b, k) {
    const o = {};
    for (const key of ['H', 'spine', 'a', 'A', 'l', 'L']) o[key] = lerpDeep(a[key], b[key], k);
    o.rot = lerp(a.rot || 0, b.rot || 0, k); o.round = lerp(a.round || 1, b.round || 1, k);
    return o;
  }
  POSES.headDown = Object.assign({}, POSES.curl, { rot: Math.PI * 0.94, round: 1.07 });
  POSES.turn = Object.assign(mixPose(POSES.curl, POSES.stretch, 0.3), { rot: Math.PI * 0.52 });
  FB.poses = POSES;
  FB.figure = function (ctx, x, y, s, t, opts) {
    opts = opts || {};
    const p = pal(opts.pal);
    let pose = POSES[opts.pose || 'curl'] || POSES.curl;
    if (opts.pose2 && POSES[opts.pose2]) pose = mixPose(pose, POSES[opts.pose2], clamp(opts.mix || 0, 0, 1));
    const sway = opts.sway == null ? 1 : opts.sway;
    const rot = (pose.rot || 0) + (opts.rotation || 0) + Math.sin(t * 0.45) * 0.045 * sway;
    const flip = opts.flip ? -1 : 1;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const bob = Math.sin(t * 0.7) * 0.018 * sway;
    const round = (pose.round || 1) * (opts.round || 1);
    const g = clamp(opts.limbs == null ? 1 : opts.limbs, 0, 1);
    const P = (lx, ly) => { lx *= flip; return [x + (lx * cs - ly * sn) * s, y + (lx * sn + ly * cs + bob) * s]; };
    const chain = (joints, rScale) => {
      const pts = [], rs = [];
      for (const j of joints) { const q = P(j[0], j[1]); pts.push(q[0], q[1]); rs.push(j[2] * s * (rScale || 1)); }
      return { pts, rs };
    };
    const core = [], near = [], far = [];
    const H = P(pose.H[0], pose.H[1]);
    core.push({ x: H[0], y: H[1], r: pose.H[2] * s });
    const sp = chain(pose.spine, 1);
    for (let i = 1; i < sp.rs.length; i++) sp.rs[i] *= round;
    core.push(sp);
    // limbs grow out of buds (g = 0) into two segments (g = 1); a slow small drift keeps them alive
    const limb = (J, ph) => {
      const wig = Math.sin(t * 0.9 + ph) * 0.016 * sway;
      const root = J[0];
      const gg = Math.max(g, 0.12);
      const mid = [lerp(root[0], J[1][0], gg) + wig, lerp(root[1], J[1][1], gg), J[1][2]];
      const end = [lerp(root[0], J[2][0], gg) + wig * 1.6, lerp(root[1], J[2][1], gg) - wig, J[2][2]];
      const k = 0.72 + 0.28 * g;
      if (g < 0.25) return chain([root, mid], k * 1.1);
      // a soft bulb for the hand or foot, a little past the end of the limb
      const dx = end[0] - mid[0], dy = end[1] - mid[1], dl = Math.hypot(dx, dy) || 1;
      const tip = [end[0] + (dx / dl) * end[2] * 0.45, end[1] + (dy / dl) * end[2] * 0.45, end[2] * 1.12];
      return chain([root, mid, end, tip], k);
    };
    far.push(limb(pose.A, 1.1), limb(pose.L, 2.3));
    near.push(limb(pose.l, 0.4), limb(pose.a, 3.7));
    // umbilical cord (behind the body): a soft tube from the belly to opts.cord {x, y}
    if (opts.cord) {
      const q = P(0.12, 0.16);
      const ctl = { x: (q[0] + opts.cord.x) / 2 + Math.sin(t * 0.6) * s * 0.18, y: Math.max(q[1], opts.cord.y) + s * 0.28 };
      const ga = ctx.globalAlpha, op = ctx.globalCompositeOperation;
      const cp = new Path2D(); cp.moveTo(q[0], q[1]); cp.quadraticCurveTo(ctl.x, ctl.y, opts.cord.x, opts.cord.y);
      const cc = opts.cordColor || FB.mix(opts.color || p.body, p.tissue, 0.18);
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * 0.14;
      ctx.strokeStyle = rgba(opts.light || p.light, 1); ctx.lineWidth = s * 0.14; ctx.stroke(cp);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = ga * 0.78;
      ctx.strokeStyle = rgba(cc, 1); ctx.lineWidth = s * 0.05; ctx.stroke(cp);
      // helix: a thin highlight that winds along the cord
      const hx = new Path2D();
      const N = 40, cw = s * 0.05;
      for (let i = 0; i <= N; i++) {
        const u = i / N, iu = 1 - u;
        const px = iu * iu * q[0] + 2 * iu * u * ctl.x + u * u * opts.cord.x, py = iu * iu * q[1] + 2 * iu * u * ctl.y + u * u * opts.cord.y;
        const dx = 2 * iu * (ctl.x - q[0]) + 2 * u * (opts.cord.x - ctl.x), dy = 2 * iu * (ctl.y - q[1]) + 2 * u * (opts.cord.y - ctl.y);
        const dl = Math.hypot(dx, dy) || 1;
        const off = Math.sin(u * 26 + t * 0.8) * cw * 0.32;
        const X = px - (dy / dl) * off, Y = py + (dx / dl) * off;
        i ? hx.lineTo(X, Y) : hx.moveTo(X, Y);
      }
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * 0.28;
      ctx.strokeStyle = rgba(p.rim, 1); ctx.lineWidth = Math.max(0.8, s * 0.01); ctx.stroke(hx);
      ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
    }
    // a soft aura behind the body: the lantern glow of light coming through
    const aura = opts.aura == null ? 0.32 : opts.aura;
    if (aura > 0) { const q = P(0.06, -0.06); FB.glow(ctx, q[0], q[1], s * 0.95, opts.light || p.light, aura); }
    // three layers so the limbs read over the body: far limbs (a little darker), body, near limbs
    const color = opts.color || p.body;
    const la = opts.lightAngle == null ? FB.lightAngle(x, y) : opts.lightAngle;
    const base = {
      pal: p, rim: opts.rim, light: opts.light, edge: opts.edge, lightAngle: la, goo: opts.goo || 1.55,
      rimWidth: opts.rimWidth || Math.max(1.2, s * 0.02), cell: opts.cell, maxCells: opts.maxCells || 9000
    };
    if (far.length) FB.blobs(ctx, far, Object.assign({}, base, { color: FB.mix(color, p.tissue, 0.32), edgeMix: 0.5, glow: 0.15, alpha: 0.85, seams: true, lum: 0.35 }));
    const box = FB.blobs(ctx, core, Object.assign({}, base, { color, edgeMix: opts.edgeMix == null ? 0.5 : opts.edgeMix, glow: opts.glow == null ? 0.45 : opts.glow, alpha: opts.alpha == null ? 0.96 : opts.alpha, seams: false, lum: 0.62 }));
    if (near.length) FB.blobs(ctx, near, Object.assign({}, base, { color: FB.mix(color, p.rim, 0.06), edgeMix: 0.38, glow: 0.1, alpha: 0.97, seams: true, lum: 0.5 }));
    // heart: one smooth swell per beat, warm, inside the chest
    if (opts.heart) {
      const ph = opts.heartPhase == null ? FB.beat(t, opts.bpm || 140) : opts.heartPhase;
      const pu = FB.pulse(ph);
      const hc = P(0.07, -0.02);
      const col = opts.heartColor || p.cue2 || '#fff4ea';
      FB.glow(ctx, hc[0], hc[1], s * (0.2 + 0.05 * pu), col, 0.35 + 0.35 * pu);
      FB.glow(ctx, hc[0], hc[1], s * (0.055 + 0.012 * pu), '#fff4ea', 0.8 + 0.2 * pu);
    }
    return box;
  };

  // ---------------------------------------------------------------------------------------------
  // Vignette: the common radial falloff (design.md 14.2 says no outside source fit beyond that);
  // one cached elliptical gradient per size, toward the shade colour.
  let vigCache = { key: '', g: null };
  FB.vignette = function (ctx, w, h, strength, color) {
    strength = strength == null ? 0.5 : strength;
    if (strength <= 0) return;
    color = color || FB.pal.shade || FB.ui.ink;
    const key = color + strength;
    if (vigCache.key !== key) {
      const g = scratch.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const r of [0, 0.42, 0.55, 0.68, 0.8, 0.9, 1]) { const k = smooth(0.42, 1.0, r); g.addColorStop(r, rgba(color, k * k * strength)); }
      vigCache = { key, g };
    }
    const m = ctx.getTransform();
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = vigCache.g;
    const R = Math.SQRT2;
    setLocalXY(ctx, m, w / 2, h / 2, 1, 0, (w / 2) * R, (h / 2) * R);
    ctx.fillRect(-1 / R, -1 / R, 2 / R, 2 / R);
    ctx.setTransform(m);
    ctx.globalCompositeOperation = op;
  };

  // ---------------------------------------------------------------------------------------------
  // Text: an in-scene HUD sample in the plan's UI style, #fff4ea on the rgba(26,6,16,0.72) scrim, a rounded
  // system font and a pill-shaped box. The real game keeps HUD text in the DOM (design.md 14.1).
  FB.text = function (ctx, str, x, y, opts) {
    opts = opts || {};
    const size = opts.size || 16;
    const weight = opts.weight || 600;
    const align = opts.align || 'center';
    const lh = size * (opts.lineHeight || 1.3);
    const padX = opts.padX == null ? size * 0.85 : opts.padX, padY = opts.padY == null ? size * 0.5 : opts.padY;
    ctx.save();
    ctx.font = weight + ' ' + size + 'px ' + FB.ui.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const lines = [];
    const words = String(str).split(/\s+/);
    const maxW = opts.maxWidth || Infinity;
    let line = '';
    for (const wd of words) { const test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = wd; } else line = test; }
    if (line) lines.push(line);
    let tw = 0;
    for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width);
    const bw = tw + padX * 2, bh = lines.length * lh + padY * 2 - (lh - size);
    const bx = align === 'center' ? x - bw / 2 : align === 'right' ? x - bw : x;
    const by = y - bh / 2;
    if (opts.scrim !== false) {
      ctx.fillStyle = opts.scrimColor || FB.ui.scrim;
      const rad = Math.min(opts.radius == null ? bh / 2 : opts.radius, bh / 2);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, rad);
      else { ctx.moveTo(bx + rad, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, rad); ctx.arcTo(bx + bw, by + bh, bx, by + bh, rad); ctx.arcTo(bx, by + bh, bx, by, rad); ctx.arcTo(bx, by, bx + bw, by, rad); ctx.closePath(); }
      ctx.fill();
    }
    ctx.fillStyle = opts.color || FB.ui.text;
    for (let i = 0; i < lines.length; i++) {
      const lw = ctx.measureText(lines[i]).width;
      const lx = align === 'center' ? x - lw / 2 : align === 'right' ? bx + bw - padX - lw : bx + padX;
      ctx.fillText(lines[i], lx, by + padY + size / 2 + i * lh);
    }
    ctx.restore();
    return { x: bx, y: by, w: bw, h: bh };
  };

  // ---------------------------------------------------------------------------------------------
  // Scenes registry.
  FB.scenes = {};
  FB.sceneOrder = [];
  FB.scene = function (id, def) {
    def.id = id;
    if (!FB.scenes[id]) FB.sceneOrder.push(id);
    FB.scenes[id] = def;
    return def;
  };

  // ---------------------------------------------------------------------------------------------
  // Runner: sizes the canvas to its CSS box x devicePixelRatio (capped at 2), draws scene.draw(ctx, w, h,
  // t, state) every frame with t in seconds of visible time, pauses off screen (IntersectionObserver) and
  // when the page is hidden, and under prefers-reduced-motion draws one still frame at scene.still.
  FB.dpr = 1;
  FB.run = function (canvas, scene, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d', { alpha: false });
    const cap = opts.dprCap || 2;
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    let w = 0, h = 0, dpr = 1, state = null, raf = 0, last = 0, t = opts.t0 || 0, stopped = false, onScreen = true, errored = false;
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const nd = Math.min(cap, window.devicePixelRatio || 1);
      const nw = Math.max(1, rect.width), nh = Math.max(1, rect.height);
      if (nw === w && nh === h && nd === dpr && state) return false;
      w = nw; h = nh; dpr = nd;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      state = scene.init ? scene.init(w, h) || {} : {};
      return true;
    }
    function frame(time) {
      try {
        FB.dpr = dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        const a = performance.now();
        scene.draw(ctx, w, h, time, state);
        if (opts.onFrame) opts.onFrame(performance.now() - a, time);
      } catch (e) {
        if (!errored) { errored = true; console.error('[FB.run] ' + (scene.id || '') + ':', e); }
      }
    }
    function tick(now) {
      raf = 0;
      if (stopped || mq.matches) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      t += dt * (opts.timeScale || 1);
      frame(t);
      schedule();
    }
    function schedule() {
      if (!raf && !stopped && onScreen && !document.hidden && !mq.matches) raf = requestAnimationFrame(tick);
    }
    function still() { resize(); frame(scene.still == null ? 0 : scene.still); }
    function wake() { if (mq.matches) { still(); return; } last = 0; schedule(); }
    resize();
    if (mq.matches) still(); else schedule();
    const ro = window.ResizeObserver ? new ResizeObserver(() => { if (resize()) { if (mq.matches) still(); else frame(t); } }) : null;
    if (ro) ro.observe(canvas);
    const io = window.IntersectionObserver ? new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) wake(); }) : null;
    if (io) io.observe(canvas);
    const onVis = () => { if (!document.hidden) wake(); };
    document.addEventListener('visibilitychange', onVis);
    const onMq = () => wake();
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    return {
      stop() {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        if (mq.removeEventListener) mq.removeEventListener('change', onMq);
      },
      get state() { return state; },
      get t() { return t; }
    };
  };

  // One frame at a fixed t, for previews and screenshots. Sizes the canvas like FB.run.
  FB.drawOnce = function (canvas, scene, t, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d', { alpha: false });
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(opts.dprCap || 2, window.devicePixelRatio || 1);
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    FB.dpr = dpr;
    const state = scene.init ? scene.init(w, h) || {} : {};
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const a = performance.now();
    scene.draw(ctx, w, h, t, state);
    return { ctx, w, h, dpr, state, ms: performance.now() - a };
  };

  window.FB = FB;
})();
