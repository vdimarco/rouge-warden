// The open-sea waves at Gull Rock: a small FFT wave tile, baked once and looped, with crest foam that fades and drifts.
// Pure data (no three.js), so node can test it: node qa/fish/sea-waves.test.mjs
//
// Adapted from web-ocean by Maksymilian Dendura (MIT, https://github.com/Noniv/web-ocean, js/wgsl/sim.js): the JONSWAP
// spectrum with Donelan-Banner spreading, and foam injected where the surface folds (Jacobian), then fading and drifting
// downwind (licence: LICENSE-web-ocean.txt). web-ocean runs six 256² FFTs every frame on WebGPU; here one 64² tile is
// baked in JS and looped, after Tessendorf, "Simulating Ocean Water" (2001), section 3.4: every frequency is rounded to
// a multiple of 2π/T, so the waves repeat every T seconds and the game only blends two baked frames.
//
// bakeSeaWaves() returns { n, frames, size, period, data }: `frames` layers of n x n RGBA8, layer after layer.
//   R, G   the wave slope along x and z, sharpened at the crests: 0.5 + slope / (2 * SLOPE_RANGE)
//   B      foam, faded and drifted
//   A      fresh foam (a crest breaking now)
// loadSeaWaves() bakes it once per session in a worker (sea-waves-worker.js), or here if a worker cannot start.

export const SLOPE_RANGE = 0.6;
const G = 9.81;

const DEFAULTS = {
  n: 64,            // samples along each side of the tile
  size: 32,         // m: the tile is size x size
  frames: 64,       // baked frames in one loop
  period: 8,        // s: the loop
  wind: 7,          // m/s: with the fetch, a wave peak about 10 m long
  fetch: 10000,     // m
  gamma: 3.3,       // JONSWAP peak sharpness
  dir: [0.35, 0.94],// where the waves run to (x, z): in from the sea, toward the wall (the angler faces -z)
  damp: 0.25,       // m: waves shorter than about 1.5 m are damped (the shader's own ripples draw those)
  slope: 0.13,      // rms slope of the tile
  chop: 0.38,       // rms of the crest squeeze (how sharp the crests get)
  foamShare: 0.018, // share of the tile where a crest breaks at any one time
  foamDecay: 0.8,   // 1/s
  freshDecay: 1.6,  // 1/s
  drift: 0.45,      // m/s: the foam drifts downwind
  seed: 2026,
  debug: false,     // also return the height and the Jacobian of every frame
};

// a small seeded random (mulberry32) and a normal pair (Box-Muller)
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jonswap(w, wp, alpha, gamma) {
  const sigma = w <= wp ? 0.07 : 0.09, d = (w - wp) / (sigma * wp), q = (wp / w) ** 4;
  return alpha * G * G / w ** 5 * Math.exp(-1.25 * q) * gamma ** Math.exp(-0.5 * d * d);
}
// Donelan-Banner spreading, normalised over [-π, π]
function donelanBanner(theta, w, wp) {
  const r = w / wp;
  const beta = r < 0.95 ? 2.61 * r ** 1.3 : r < 1.6 ? 2.28 * r ** -1.3 : 10 ** (-0.4 + 0.8393 * Math.exp(-0.567 * Math.log(r * r)));
  const sh = 1 / Math.cosh(Math.max(-20, Math.min(20, beta * theta)));
  return beta / (2 * Math.tanh(beta * Math.PI)) * sh * sh;
}

// In place, unnormalised, sign +1 (an inverse DFT): re, im of length n (a power of two). Tables are made once per size.
const TABLES = new Map();
function tables(n) {
  let t = TABLES.get(n);
  if (t) return t;
  const rev = new Int32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    rev[i] = j ^= bit;
  }
  for (let k = 0; k < n / 2; k++) { cos[k] = Math.cos(2 * Math.PI * k / n); sin[k] = Math.sin(2 * Math.PI * k / n); }
  TABLES.set(n, t = { rev, cos, sin });
  return t;
}
function fft1(re, im, n) {
  const { rev, cos, sin } = tables(n);
  for (let i = 1; i < n; i++) {
    const j = rev[i];
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const h = len >> 1, stride = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < h; k++) {
        const a = i + k, b = a + h, cr = cos[k * stride], ci = sin[k * stride];
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
}
function fft2(re, im, n, rowRe, rowIm) {
  for (let y = 0; y < n; y++) {
    const o = y * n;
    for (let x = 0; x < n; x++) { rowRe[x] = re[o + x]; rowIm[x] = im[o + x]; }
    fft1(rowRe, rowIm, n);
    for (let x = 0; x < n; x++) { re[o + x] = rowRe[x]; im[o + x] = rowIm[x]; }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) { rowRe[y] = re[y * n + x]; rowIm[y] = im[y * n + x]; }
    fft1(rowRe, rowIm, n);
    for (let y = 0; y < n; y++) { re[y * n + x] = rowRe[y]; im[y * n + x] = rowIm[y]; }
  }
}

// The raw fields of every frame: slopes, crest squeeze (dDx/dx, dDz/dz, dDx/dz) and height, before scaling
function waveFields(o) {
  const { n, size, frames, period } = o, nn = n * n, rnd = rand(o.seed);
  const dl = Math.hypot(o.dir[0], o.dir[1]), wd = Math.atan2(o.dir[1] / dl, o.dir[0] / dl);
  const alpha = 0.076 * (o.wind * o.wind / (o.fetch * G)) ** 0.22;
  const wp = 22 * (G * G / (o.wind * o.fetch)) ** (1 / 3);
  const dk = 2 * Math.PI / size, w0 = 2 * Math.PI / period;
  const kx = new Float32Array(nn), kz = new Float32Array(nn), kl = new Float32Array(nn), om = new Float32Array(nn);
  const h0r = new Float32Array(nn), h0i = new Float32Array(nn);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p = j * n + i, x = (i < n / 2 ? i : i - n) * dk, z = (j < n / 2 ? j : j - n) * dk, k = Math.hypot(x, z);
    kx[p] = x; kz[p] = z; kl[p] = k;
    // Box-Muller even where the amplitude is 0, so the random stream does not depend on the spectrum
    const u1 = Math.max(rnd(), 1e-9), u2 = rnd(), r = Math.sqrt(-2 * Math.log(u1));
    if (k < 1e-6 || i === n / 2 || j === n / 2) continue;   // no mean and no Nyquist row: the fields stay real
    const w = Math.sqrt(G * k);
    // the loop: each frequency rounded to a whole number of turns per period (at least one)
    om[p] = Math.max(1, Math.round(w / w0)) * w0;
    let th = Math.atan2(z, x) - wd;
    th -= 2 * Math.PI * Math.floor((th + Math.PI) / (2 * Math.PI));
    // the 2D spectrum in k: S(w) D(theta) dw/dk / k, damped for the shortest waves
    const s = jonswap(w, wp, alpha, o.gamma) * donelanBanner(th, w, wp) * (G / (2 * w)) / k * Math.exp(-k * k * o.damp * o.damp);
    const a = Math.sqrt(Math.max(s, 0)) * dk * Math.SQRT1_2;
    h0r[p] = r * Math.cos(2 * Math.PI * u2) * a; h0i[p] = r * Math.sin(2 * Math.PI * u2) * a;
  }
  // the index of -k
  const neg = new Int32Array(nn);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) neg[j * n + i] = ((n - j) % n) * n + (n - i) % n;

  const out = { sx: [], sz: [], jxx: [], jzz: [], jxz: [], h: [] };
  const aR = new Float32Array(nn), aI = new Float32Array(nn), bR = new Float32Array(nn), bI = new Float32Array(nn);
  const cR = new Float32Array(nn), cI = new Float32Array(nn), rowR = new Float32Array(n), rowI = new Float32Array(n);
  for (let f = 0; f < frames; f++) {
    const t = f / frames * period;
    for (let p = 0; p < nn; p++) {
      // h(k, t) = h0(k) e^{iwt} + conj(h0(-k)) e^{-iwt}
      const q = neg[p], c = Math.cos(om[p] * t), s = Math.sin(om[p] * t);
      const hr = h0r[p] * c - h0i[p] * s + h0r[q] * c - h0i[q] * s;
      const hi = h0r[p] * s + h0i[p] * c - h0r[q] * s - h0i[q] * c;
      const k = kl[p] || 1, x = kx[p], z = kz[p];
      // two real fields per complex FFT: A = ik_x h + i (ik_z h), B = (k_x²/k) h + i (k_z²/k) h, C = h + i (k_x k_z / k) h
      aR[p] = -x * hi - z * hr; aI[p] = x * hr - z * hi;
      bR[p] = (x * x / k) * hr - (z * z / k) * hi; bI[p] = (x * x / k) * hi + (z * z / k) * hr;
      const m = x * z / k;
      cR[p] = hr - m * hi; cI[p] = hi + m * hr;
    }
    fft2(aR, aI, n, rowR, rowI); fft2(bR, bI, n, rowR, rowI); fft2(cR, cI, n, rowR, rowI);
    out.sx.push(Float32Array.from(aR)); out.sz.push(Float32Array.from(aI));
    out.jxx.push(Float32Array.from(bR)); out.jzz.push(Float32Array.from(bI));
    out.h.push(Float32Array.from(cR)); out.jxz.push(Float32Array.from(cI));
  }
  return out;
}

const rms = (list) => { let s = 0, c = 0; for (const a of list) for (const v of a) { s += v * v; c++; } return Math.sqrt(s / c); };

export function bakeSeaWaves(opts = {}) {
  const o = { ...DEFAULTS, ...opts }, { n, frames, period } = o, nn = n * n;
  const F = waveFields(o);
  // scale the tile to the wanted slope and crest squeeze
  const ks = o.slope / Math.max(1e-9, Math.hypot(rms(F.sx), rms(F.sz)) / Math.SQRT2);
  const kc = o.chop / Math.max(1e-9, Math.hypot(rms(F.jxx), rms(F.jzz)) / Math.SQRT2);
  // the crests squeeze (x - λD): the Jacobian of the moved surface, and the slope over the squeezed ground
  const J = [], SX = [], SZ = [];
  for (let f = 0; f < frames; f++) {
    const j = new Float32Array(nn), sx = new Float32Array(nn), sz = new Float32Array(nn);
    for (let p = 0; p < nn; p++) {
      const xx = 1 - kc * F.jxx[f][p], zz = 1 - kc * F.jzz[f][p], xz = -kc * F.jxz[f][p];
      j[p] = xx * zz - xz * xz;
      sx[p] = ks * F.sx[f][p] / Math.max(xx, 0.35);
      sz[p] = ks * F.sz[f][p] / Math.max(zz, 0.35);
    }
    J.push(j); SX.push(sx); SZ.push(sz);
  }
  // where a crest breaks: the lowest foamShare of the Jacobian over the whole loop
  // (every 5th value is plenty to find the share)
  const all = new Float32Array(Math.ceil(frames * nn / 5));
  for (let i = 0, q = 0; q < all.length; i += 5, q++) all[q] = J[(i / nn) | 0][i % nn];
  all.sort();
  const lo = all[Math.floor(o.foamShare * all.length)], hi = all[Math.floor(o.foamShare * 0.35 * all.length)];
  const inject = J.map((j) => { const a = new Float32Array(nn); for (let p = 0; p < nn; p++) a[p] = Math.min(1, Math.max(0, (lo - j[p]) / Math.max(lo - hi, 1e-6))); return a; });

  // Foam, as web-ocean's foam update: f = max(prev * exp(-dt * decay), inject), the previous frame drifted downwind by a
  // bilinear look-up. The tile wraps, and a first loop forgets the empty start (exp(-0.8 * 8): 0.2%), so the second loop
  // is seamless.
  const dt = period / frames, texel = o.size / n;
  const dl = Math.hypot(o.dir[0], o.dir[1]), fx = o.dir[0] / dl * o.drift * dt / texel, fz = o.dir[1] / dl * o.drift * dt / texel;
  const ix = Math.floor(fx), iz = Math.floor(fz), wx = fx - ix, wz = fz - iz;
  const fade = Math.exp(-o.foamDecay * dt), fadeFresh = Math.exp(-o.freshDecay * dt);
  const data = new Uint8Array(frames * nn * 4);
  let foam = new Float32Array(nn), fresh = new Float32Array(nn), nf = new Float32Array(nn), nr = new Float32Array(nn);
  const enc = (s) => Math.round(Math.min(1, Math.max(0, 0.5 + s / (2 * SLOPE_RANGE))) * 255);
  const X0 = new Int32Array(n), X1 = new Int32Array(n);
  for (let x = 0; x < n; x++) { X0[x] = (((x - ix) % n) + n) % n; X1[x] = (X0[x] - 1 + n) % n; }
  for (let step = 0; step < frames * 2; step++) {
    const f = step % frames, inj = inject[f];
    for (let y = 0; y < n; y++) {
      const y0 = (((y - iz) % n) + n) % n, y1 = (y0 - 1 + n) % n;
      for (let x = 0; x < n; x++) {
        const x0 = X0[x], x1 = X1[x];
        const a = y0 * n + x0, b = y0 * n + x1, c = y1 * n + x0, d = y1 * n + x1, p = y * n + x;
        const pf = (foam[a] * (1 - wx) + foam[b] * wx) * (1 - wz) + (foam[c] * (1 - wx) + foam[d] * wx) * wz;
        const pr = (fresh[a] * (1 - wx) + fresh[b] * wx) * (1 - wz) + (fresh[c] * (1 - wx) + fresh[d] * wx) * wz;
        nf[p] = Math.max(pf * fade, inj[p]);
        nr[p] = Math.max(pr * fadeFresh, inj[p]);
      }
    }
    [foam, nf] = [nf, foam]; [fresh, nr] = [nr, fresh];
    if (step < frames) continue;
    const o4 = f * nn * 4;
    for (let p = 0; p < nn; p++) {
      data[o4 + p * 4] = enc(SX[f][p]);
      data[o4 + p * 4 + 1] = enc(SZ[f][p]);
      data[o4 + p * 4 + 2] = Math.round(Math.min(1, foam[p]) * 255);
      data[o4 + p * 4 + 3] = Math.round(Math.min(1, fresh[p]) * 255);
    }
  }
  const out = { n, frames, size: o.size, period, data };
  // the raw height and Jacobian, for the tests
  if (o.debug) { out.height = F.h.map((h) => h.map((v) => v * ks)); out.jacobian = J; }
  return out;
}

// The baked tile, once per session. A worker keeps the bake (about 0.1 s on a desktop, more on a phone) off the frame.
let baked = null;
export function loadSeaWaves() {
  if (baked) return baked;
  const here = () => new Promise((resolve) => setTimeout(() => resolve(bakeSeaWaves()), 0));
  baked = new Promise((resolve) => {
    let w;
    try { w = new Worker(new URL("./sea-waves-worker.js", import.meta.url), { type: "module" }); } catch (e) { resolve(here()); return; }
    const fail = () => { w.terminate(); resolve(here()); };
    w.onmessage = (e) => { w.terminate(); if (e.data && e.data.data) resolve(e.data); else resolve(here()); };
    w.onerror = (e) => { if (e.preventDefault) e.preventDefault(); fail(); };
    w.onmessageerror = fail;
    w.postMessage({});
  });
  return baked;
}
