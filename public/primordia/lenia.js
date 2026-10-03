// Lenia core for Primordia. Two continuous cellular automata on one toroidal grid.
// Channel A holds prey (Orbium rule). Channel B holds predators (the "max-fleet" rule).
// Both channels share one complex FFT: pack A + iB, transform once, apply each
// channel's kernel spectrum, transform back. Rules and kernels follow Bert Chan's Lenia.

const TAU = Math.PI * 2;
const wrapI = (v, n) => ((v % n) + n) % n;

function fftPlan(n) {
  const bits = Math.log2(n);
  if (!Number.isInteger(bits)) throw new Error("FFT size must be a power of two: " + n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2), sinF = new Float64Array(n / 2), sinI = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(TAU * i / n); sinI[i] = Math.sin(TAU * i / n); sinF[i] = -sinI[i]; }
  return { n, rev, cos, sinF, sinI, re: new Float64Array(n), im: new Float64Array(n) };
}

// In-place 1D FFT on the line base, base+stride, ... of (re, im). inverse skips scaling.
function fftLine(p, re, im, base, stride, inverse) {
  const { n, rev, cos } = p;
  const sin = inverse ? p.sinI : p.sinF;
  const tr = p.re, ti = p.im;
  for (let i = 0; i < n; i++) { const k = base + rev[i] * stride; tr[i] = re[k]; ti[i] = im[k]; }
  // first stage: twiddle is 1
  for (let a = 0; a < n; a += 2) {
    const b = a + 1, xr = tr[b], xi = ti[b];
    tr[b] = tr[a] - xr; ti[b] = ti[a] - xi;
    tr[a] += xr; ti[a] += xi;
  }
  for (let size = 4; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    // twiddle in the outer loop, so each one loads once per stage
    for (let j = 0; j < half; j++) {
      const wr = cos[j * step], wi = sin[j * step];
      for (let a = j; a < n; a += size) {
        const b = a + half;
        const xr = tr[b] * wr - ti[b] * wi;
        const xi = tr[b] * wi + ti[b] * wr;
        tr[b] = tr[a] - xr; ti[b] = ti[a] - xi;
        tr[a] += xr; ti[a] += xi;
      }
    }
  }
  for (let i = 0; i < n; i++) { const k = base + i * stride; re[k] = tr[i]; im[k] = ti[i]; }
}

function fft2(planW, planH, w, h, re, im, inverse) {
  for (let y = 0; y < h; y++) fftLine(planW, re, im, y * w, 1, inverse);
  for (let x = 0; x < w; x++) fftLine(planH, re, im, x, w, inverse);
}

// Kernel shells: b lists the peak height of each concentric ring (bump4 core).
export function kernelSpectrum(w, h, R, b = [1], planW, planH) {
  const re = new Float64Array(w * h), im = new Float64Array(w * h);
  let sum = 0;
  const reach = Math.ceil(R);
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const r = Math.hypot(dx, dy) / R;
      if (r >= 1 || r === 0) continue;
      const br = b.length * r, shell = Math.min(Math.floor(br), b.length - 1), q = br - shell;
      const v = q <= 0 || q >= 1 ? 0 : b[shell] * Math.exp(4 - 1 / (q * (1 - q)));
      if (v <= 0) continue;
      re[((dy + h) % h) * w + ((dx + w) % w)] += v;
      sum += v;
    }
  }
  for (let i = 0; i < re.length; i++) re[i] /= sum;
  fft2(planW, planH, w, h, re, im, false);
  return re; // symmetric kernel: the spectrum is real
}

export const RULES = {
  // Orbium unicaudatus: R=13, bump4, gaus(0.15, 0.017), dt 0.1
  prey: { R: 13, b: [1], mu: 0.15, sigma: 0.017, dt: 0.1 },
  // max-fleet compilation: S2, PS, P4-7, H3 and C0 share this rule
  hunter: { R: 13, b: [1], mu: 0.337, sigma: 0.057, dt: 0.1 },
};

export class World {
  constructor(w, h, rules = RULES) {
    this.w = w; this.h = h; this.n = w * h;
    this.A = new Float32Array(this.n);
    this.B = new Float32Array(this.n);
    this.UA = new Float32Array(this.n);
    this.UB = new Float32Array(this.n);
    this.re = new Float64Array(this.n);
    this.im = new Float64Array(this.n);
    this.planW = fftPlan(w);
    this.planH = h === w ? this.planW : fftPlan(h);
    this.setRules(rules);
    this.steps = 0;
    // prey caught inside hunter tissue fades at this rate per step
    this.consume = 0.6;
    // Agar: growth needs nutrient, matter uses it up, and it regrows slowly.
    // A stationary bloom starves itself; a glider keeps moving onto fresh agar.
    this.N = new Float32Array(this.n).fill(1);
    // Hunters ignore the agar: they are carnivores, and the game drags them toward the player,
    // which would park them on agar they already ate. The quorum toxin limits their blooms instead.
    this.agar = { useA: 0.02, useB: 0, regrow: 0.004, starveA: 1, starveB: 0 };
    // Quorum toxin: while a channel holds more matter than its limit, a toxin builds up and every
    // cell of that channel decays a little. A bloom gets a short life; when it dies, the toxin clears.
    this.limit = { A: Infinity, B: Infinity };
    this.toxin = { A: 0, B: 0 };
    this.purge = { A: false, B: false };
    this.toxRate = 0.003;

    this.massA = 0; this.massB = 0;
  }

  setRules(rules) {
    this.rules = rules;
    const { w, h, planW, planH } = this;
    const ka = kernelSpectrum(w, h, rules.prey.R, rules.prey.b, planW, planH);
    const kb = kernelSpectrum(w, h, rules.hunter.R, rules.hunter.b, planW, planH);
    // W[k] = Z[k](Ka+Kb)/2 + conj(Z[-k])(Ka-Kb)/2 separates the packed channels
    this.kSum = new Float64Array(this.n);
    this.kDiff = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) { this.kSum[i] = (ka[i] + kb[i]) / 2; this.kDiff[i] = (ka[i] - kb[i]) / 2; }
    this.same = rules.prey.R === rules.hunter.R && rules.prey.b.join() === rules.hunter.b.join();
  }

  convolve() {
    const { w, h, n, A, B, re, im, kSum, kDiff, UA, UB } = this;
    for (let i = 0; i < n; i++) { re[i] = A[i]; im[i] = B[i]; }
    fft2(this.planW, this.planH, w, h, re, im, false);
    if (this.same) {
      for (let i = 0; i < n; i++) { re[i] *= kSum[i]; im[i] *= kSum[i]; }
    } else {
      // pair each frequency k with -k; both entries update together
      for (let y = 0; y < h; y++) {
        const ny = (h - y) % h;
        for (let x = 0; x < w; x++) {
          const i = y * w + x, j = ny * w + ((w - x) % w);
          if (j < i) continue;
          const zr = re[i], zi = im[i], mr = re[j], mi = im[j];
          const s = kSum[i], d = kDiff[i];
          re[i] = zr * s + mr * d; im[i] = zi * s - mi * d;
          if (j !== i) { re[j] = mr * s + zr * d; im[j] = mi * s - zi * d; }
        }
      }
    }
    fft2(this.planW, this.planH, w, h, re, im, true);
    const scale = 1 / n;
    for (let i = 0; i < n; i++) { UA[i] = re[i] * scale; UB[i] = im[i] * scale; }
  }

  step() {
    this.convolve();
    const { n, A, B, UA, UB } = this;
    const pa = this.rules.prey, pb = this.rules.hunter;
    const ia = 1 / (2 * pa.sigma * pa.sigma), ib = 1 / (2 * pb.sigma * pb.sigma);
    const eat = this.consume, N = this.N, { useA, useB, regrow, starveA, starveB } = this.agar;
    const tox = this.toxin, lim = this.limit, k = this.toxRate;
    // A purge starts when a channel passes its limit and runs until the bloom has collapsed to
    // under half the limit. Without that hysteresis a bloom can hover at the limit forever.
    const pg = this.purge;
    if (this.massA > lim.A) pg.A = true; else if (this.massA < lim.A * 0.45) pg.A = false;
    if (this.massB > lim.B) pg.B = true; else if (this.massB < lim.B * 0.5) pg.B = false;
    tox.A = Math.min(0.4, Math.max(0, tox.A + (pg.A ? k * Math.max(0.5, Math.min(2, this.massA / lim.A - 0.5)) : -4 * k)));
    tox.B = Math.min(0.7, Math.max(0, tox.B + (pg.B ? 2 * k * Math.max(0.5, Math.min(2, this.massB / lim.B - 0.5)) : -4 * k)));
    const overA = tox.A, overB = tox.B;
    let massA = 0, massB = 0;
    for (let i = 0; i < n; i++) {
      const da = UA[i] - pa.mu, db = UB[i] - pb.mu;
      const nu = N[i];
      // far from the growth peak the bell curve is flat at -1; skip the exp there (most of the dish)
      const ea = da * da * ia, eb = db * db * ib;
      let ga = ea > 18 ? -1 : 2 * Math.exp(-ea) - 1, gb = eb > 18 ? -1 : 2 * Math.exp(-eb) - 1;
      if (ga > 0) ga *= nu;
      if (gb > 0 && starveB) gb *= nu;
      ga -= starveA * (1 - nu) + overA;
      gb -= starveB * (1 - nu) + overB;

      let a = A[i] + pa.dt * (ga - eat * B[i]);
      let b = B[i] + pb.dt * gb;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      b = b < 0 ? 0 : b > 1 ? 1 : b;
      A[i] = a; B[i] = b;
      const m = nu + regrow - useA * a - useB * b;
      N[i] = m < 0 ? 0 : m > 1 ? 1 : m;
      massA += a; massB += b;
    }
    this.massA = massA; this.massB = massB;
    this.steps++;
  }

  // Stamp a pattern (rows of 0..1) centred at (cx, cy), rotated by angle, scaled by s.
  stamp(field, cells, cx, cy, angle = 0, s = 1, mode = "max") {
    const { w, h } = this;
    const ph = cells.length, pw = Math.max(...cells.map((r) => r.length));
    const c = Math.cos(angle), sn = Math.sin(angle);
    const half = Math.ceil(Math.hypot(pw, ph) * s / 2) + 1;
    const sample = (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const g = (yy, xx) => (yy >= 0 && yy < ph && xx >= 0 && xx < (cells[yy]?.length ?? 0) ? cells[yy][xx] : 0);
      return g(y0, x0) * (1 - fx) * (1 - fy) + g(y0, x0 + 1) * fx * (1 - fy) + g(y0 + 1, x0) * (1 - fx) * fy + g(y0 + 1, x0 + 1) * fx * fy;
    };
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        // inverse-rotate the destination offset into pattern space
        const px = (c * dx + sn * dy) / s + pw / 2 - 0.5;
        const py = (-sn * dx + c * dy) / s + ph / 2 - 0.5;
        if (px < -1 || py < -1 || px > pw || py > ph) continue;
        const v = sample(px, py);
        if (v <= 0.001) continue;
        const gx = ((Math.round(cx) + dx) % w + w) % w, gy = ((Math.round(cy) + dy) % h + h) % h;
        const i = gy * w + gx;
        field[i] = mode === "add" ? Math.min(1, field[i] + v) : Math.max(field[i], v);
      }
    }
  }

  // Slide everything inside a disc by (vx, vy) cells, with a soft rim. Lenia rules do not care
  // where a creature sits, so a whole body moved a fraction of a cell keeps living.
  advect(field, cx, cy, radius, vx, vy) {
    const { w, h } = this;
    const r = Math.ceil(radius) + 1, n = 2 * r + 1;
    if (!this.tmp || this.tmp.length < n * n) this.tmp = new Float32Array(n * n);
    const tmp = this.tmp, x0 = Math.round(cx), y0 = Math.round(cy), inner = radius - 4;
    const at = (x, y) => field[wrapI(Math.floor(y), h) * w + wrapI(Math.floor(x), w)];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx + x0 - cx, dy + y0 - cy);
        const k = d <= inner ? 1 : d >= radius ? 0 : (radius - d) / (radius - inner);
        const x = x0 + dx - vx * k, y = y0 + dy - vy * k;
        const fx = x - Math.floor(x), fy = y - Math.floor(y);
        tmp[(dy + r) * n + dx + r] = k === 0 ? at(x0 + dx, y0 + dy)
          : at(x, y) * (1 - fx) * (1 - fy) + at(x + 1, y) * fx * (1 - fy) + at(x, y + 1) * (1 - fx) * fy + at(x + 1, y + 1) * fx * fy;
      }
    }
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) field[wrapI(y0 + dy, h) * w + wrapI(x0 + dx, w)] = tmp[(dy + r) * n + dx + r];
  }

  // Remove matter inside a soft disc. Returns the mass removed.
  drain(field, cx, cy, radius, rate) {
    const { w, h } = this;
    const r = Math.ceil(radius);
    let taken = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx + (cx - Math.round(cx)) * -1, dy + (cy - Math.round(cy)) * -1) / radius;
        if (d >= 1) continue;
        const k = rate * (1 - d * d);
        const gx = ((Math.round(cx) + dx) % w + w) % w, gy = ((Math.round(cy) + dy) % h + h) % h;
        const i = gy * w + gx, v = field[i], cut = v * k;
        field[i] = v - cut;
        taken += cut;
      }
    }
    return taken;
  }

  // Sum of matter inside a disc (no change).
  probe(field, cx, cy, radius) {
    const { w, h } = this;
    const r = Math.ceil(radius);
    let sum = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const gx = ((Math.round(cx) + dx) % w + w) % w, gy = ((Math.round(cy) + dy) % h + h) % h;
        sum += field[gy * w + gx];
      }
    }
    return sum;
  }

  clear() { this.A.fill(0); this.B.fill(0); this.N.fill(1); this.toxin.A = 0; this.toxin.B = 0; this.purge.A = false; this.purge.B = false; this.massA = 0; this.massB = 0; }
}

// Connected regions above a threshold, with wrap-around. Returns blobs with mass and centroid.
export function findBlobs(field, w, h, threshold = 0.12, minMass = 4) {
  const n = w * h, label = new Int32Array(n).fill(-1), stack = new Int32Array(n);
  const blobs = [];
  for (let s = 0; s < n; s++) {
    if (label[s] !== -1 || field[s] < threshold) continue;
    const id = blobs.length;
    let top = 0, mass = 0, sx = 0, sy = 0, cnt = 0;
    // accumulate positions on a circle so centroids survive wrap-around
    let cxs = 0, cxc = 0, cys = 0, cyc = 0;
    stack[top++] = s; label[s] = id;
    while (top) {
      const i = stack[--top], x = i % w, y = (i / w) | 0, v = field[i];
      mass += v; cnt++;
      const ax = TAU * x / w, ay = TAU * y / h;
      cxs += Math.sin(ax) * v; cxc += Math.cos(ax) * v; cys += Math.sin(ay) * v; cyc += Math.cos(ay) * v;
      const nb = [y * w + (x + 1) % w, y * w + (x - 1 + w) % w, ((y + 1) % h) * w + x, ((y - 1 + h) % h) * w + x];
      for (const j of nb) if (label[j] === -1 && field[j] >= threshold) { label[j] = id; stack[top++] = j; }
    }
    sx = ((Math.atan2(cxs, cxc) / TAU) * w + w) % w;
    sy = ((Math.atan2(cys, cyc) / TAU) * h + h) % h;
    blobs.push({ id, mass, cells: cnt, x: sx, y: sy });
  }
  return { blobs: blobs.filter((b) => b.mass >= minMass), label };
}

// Lenia "(zip)" cell strings: rows split by "/", runs of empty cells as "<count>.", values in 1/100.
const ZIP_START = 192;
const fromZip = (c) => (c === "0" ? 0 : c === "1" ? 100 : c.charCodeAt(0) - (ZIP_START - 1));
const repeatCount = (st) => (st === "" ? 1 : st.charCodeAt(0) >= ZIP_START ? (st.length === 1 ? fromZip(st) : fromZip(st[0]) * 100 + fromZip(st[1])) : parseInt(st, 10));
export function decodeCells(code) {
  const body = code.replace(/^\(zip\)/, "");
  return body.split("/").map((rowSt) => {
    let row = "";
    for (const part of rowSt.trim().split("-")) {
      const bits = part.split(".");
      row += bits.length === 1 ? part : "0".repeat(repeatCount(bits[0])) + bits[1];
    }
    return [...row].map((c) => fromZip(c) / 100);
  });
}
