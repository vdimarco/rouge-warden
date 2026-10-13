// Light Years Home: checks of the physics module. node qa/light-years-home/physics.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fromRapidity, aberrate, aberrateVector, doppler, lnY, seen, blackbodyRGB, lutData, lutU, srgbEncode, qGas, qCmb,
  heatRatio, zoneLimit, viewRapidity, zoneDistance, zoneLambda, cmbAheadK, fmt, SIGMA, T_CMB, UC_CMB, P_LENS,
} from '../../public/light-years-home/core/physics.js';

const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const near = (a, b, tol, msg) => assert.ok(rel(a, b) <= tol, `${msg}: ${a} vs ${b} (rel ${rel(a, b)})`);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = norm(a); return a.map((c) => c / l); };

test('rapidity: γ, β, celerity and 1 − β agree to 1e-12', () => {
  for (const eta of [0.1, 1, 5, 10, 20]) {
    const { beta, gamma, celerity, oneMinusBeta } = fromRapidity(eta);
    near(celerity, gamma * beta, 1e-12, `γβ at η ${eta}`);
    near(gamma + celerity, Math.exp(eta), 1e-12, `γ + γβ = e^η at η ${eta}`);
    near(gamma, 1 / Math.sqrt(oneMinusBeta * (2 - oneMinusBeta)), 1e-12, `γ = 1/√(1 − β²) at η ${eta}`);
    near(oneMinusBeta, 2 / (Math.exp(2 * eta) + 1), 1e-12, `1 − β at η ${eta}`);
    if (eta <= 5) near(1 - beta, oneMinusBeta, 1e-9, `1 − β against tanh at η ${eta}`);
  }
  assert.equal(fromRapidity(20).oneMinusBeta, 2 / (Math.exp(40) + 1));
  assert.ok(fromRapidity(20).oneMinusBeta > 0, 'never rounds to zero');
});

test('aberrate (stereographic) matches the vector form to 1e-12 for φ ≤ 3 and θ 0..179°', () => {
  const vs = [[0, 0, 1], unit([0.3, -0.5, 0.8]), unit([-1, 2, -0.4])];
  for (const v of vs) {
    // a unit vector perpendicular to v
    const a = Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const p = unit([a[0] - dot(a, v) * v[0], a[1] - dot(a, v) * v[1], a[2] - dot(a, v) * v[2]]);
    for (const phi of [0, 0.01, 0.5, 1, 2, 3]) {
      for (let deg = 0; deg <= 179; deg++) {
        const th = deg * Math.PI / 180;
        const n = v.map((c, i) => Math.cos(th) * c + Math.sin(th) * p[i]);
        const s = aberrate(n, v, phi), r = aberrateVector(n, v, Math.tanh(phi));
        for (let k = 0; k < 3; k++) assert.ok(Math.abs(s.n[k] - r.n[k]) <= 1e-12, `n'[${k}] at φ ${phi}, θ ${deg}°`);
        near(s.D, r.D, 1e-12, `D at φ ${phi}, θ ${deg}°`);
        near(doppler(n, v, phi), s.D, 1e-15, `doppler() at φ ${phi}, θ ${deg}°`);
      }
    }
  }
});

test('aberrate stays unit length and finite up to φ = 25, and squeezes the sky forward', () => {
  const v = unit([0.2, 0.1, -1]);
  const p = unit([1, 0, 0.2]);
  for (const phi of [5, 10, 15, 20, 25]) {
    let prev = -Infinity;
    for (let deg = 0; deg <= 180; deg += 0.5) {
      const th = deg * Math.PI / 180;
      const pp = unit(p.map((c, i) => c - dot(p, v) * v[i]));
      const n = v.map((c, i) => Math.cos(th) * c + Math.sin(th) * pp[i]);
      const { n: m, D } = aberrate(n, v, phi);
      assert.ok(m.every(Number.isFinite) && Number.isFinite(D) && D > 0, `finite at φ ${phi}, θ ${deg}°`);
      assert.ok(Math.abs(norm(m) - 1) < 1e-12, `unit length at φ ${phi}, θ ${deg}°`);
      const cr = [m[1] * v[2] - m[2] * v[1], m[2] * v[0] - m[0] * v[2], m[0] * v[1] - m[1] * v[0]];
      const seenAngle = Math.atan2(norm(cr), dot(m, v));
      assert.ok(seenAngle >= prev - 1e-12, `seen angle rises with θ at φ ${phi}, θ ${deg}°`);
      prev = seenAngle;
    }
  }
  // n exactly along v, and exactly against it
  const v0 = [0, 0, 1];
  assert.deepEqual(aberrate([0, 0, 1], v0, 3).n, [0, 0, 1]);
  assert.deepEqual(aberrate([0, 0, -1], v0, 3).n, [0, 0, -1]);
  near(aberrate([0, 0, 1], v0, 3).D, Math.exp(3), 1e-15, 'D dead ahead');
  near(aberrate([0, 0, -1], v0, 3).D, Math.exp(-3), 1e-15, 'D dead behind');
  // stereographic check: tan(θ'/2) = e^−φ tan(θ/2)
  const th = 2.5, phi = 1.7, n = [Math.sin(th), 0, Math.cos(th)];
  const m = aberrate(n, v0, phi).n;
  near(Math.tan(Math.acos(m[2]) / 2), Math.exp(-phi) * Math.tan(th / 2), 1e-12, 'tan of half angles');
});

test('Doppler ahead × Doppler behind = 1, and D for opposite directions multiplies to 1 at matching angles', () => {
  const v = unit([0.4, 0.4, 0.8]);
  for (const phi of [0.1, 1, 5, 12, 20, 25]) {
    near(aberrate(v, v, phi).D * aberrate(v.map((c) => -c), v, phi).D, 1, 1e-12, `ahead × behind at φ ${phi}`);
  }
});

test('blackbody colours: within 6/255 of Charity at 1,000 to 40,000 K, in the LUT too', () => {
  // M. Charity, "What color is a blackbody?" (vendian.org), 10° observer; 1,000 K from the 2° table.
  const charity = { 1000: '#ff3300', 3000: '#ffb46b', 5800: '#fff0e9', 6500: '#fff9fd', 10000: '#ccdbff', 40000: '#9bbcff' };
  const lut = lutData();
  assert.equal(lut.length, 256 * 4);
  for (const [T, hex] of Object.entries(charity)) {
    const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const direct = blackbodyRGB(Number(T)).map((c) => Math.round(255 * srgbEncode(c)));
    // sample the LUT the way the GPU does: linear between texel centres
    const f = lutU(Number(T)) * 256 - 0.5, i = Math.floor(f), w = f - i;
    const fromLut = [0, 1, 2].map((k) => lut[i * 4 + k] * (1 - w) + lut[(i + 1) * 4 + k] * w);
    for (let k = 0; k < 3; k++) {
      assert.ok(Math.abs(direct[k] - want[k]) <= 6, `${T} K channel ${k}: ${direct} vs ${want}`);
      assert.ok(Math.abs(fromLut[k] - want[k]) <= 6, `${T} K LUT channel ${k}: ${fromLut.map(Math.round)} vs ${want}`);
    }
  }
  for (const T of [500, 2000, 200000, 1e7, 30]) {
    const rgb = blackbodyRGB(T);
    assert.ok(rgb.every((c) => Number.isFinite(c) && c >= 0 && c <= 1) && Math.max(...rgb) === 1, `${T} K: ${rgb}`);
  }
  assert.ok(blackbodyRGB(2000)[0] > blackbodyRGB(2000)[2], 'cool is red');
  assert.ok(blackbodyRGB(30000)[2] > blackbodyRGB(30000)[0], 'hot is blue');
});

test('brightness: lnY is finite at 300 K, and seen() follows Kraus', () => {
  assert.ok(Number.isFinite(lnY(300)) && Number.isFinite(lnY(30)) && Number.isFinite(lnY(1e9)));
  near(Math.exp(lnY(5800)), 1 / Math.expm1(25924 / 5800), 1e-12, 'lnY is Planck at 555 nm');
  const s = seen(5800, 2);
  assert.equal(s.T, 11600);
  near(s.diffuse, Math.exp(lnY(11600) - lnY(5800)), 1e-15, 'diffuse');
  near(s.star, s.diffuse / 4, 1e-15, 'star = diffuse / D²');
  assert.ok(seen(3000, 0.2).diffuse < 1e-3, 'a redshifted star fades');
});

test('heat: q_cmb → σT⁴ at rest, ≈ (4/3) u c γ² fast, and matches the long form in between', () => {
  near(UC_CMB, 1.2516e-5, 1e-4, 'u c');
  near(qCmb(1e-9), SIGMA * T_CMB ** 4, 0.01, 'q_cmb at rest');
  near(qCmb(1e-9), 3.129e-6, 0.01, 'σT⁴ value');
  near(qCmb(1e-4), SIGMA * T_CMB ** 4, 0.01, 'q_cmb at β 1e-4');
  for (const g of [30, 100, 1e4, 1e6, 2.448e8, 1e12]) {
    near(qCmb(Math.acosh(g)), 1.669e-5 * g * g, 0.01, `q_cmb at γ ${g}`);
  }
  for (const eta of [0.05, 0.3, 1, 2, 4, 8]) {
    const b = Math.tanh(eta), g = Math.cosh(eta);
    const long = UC_CMB / (2 * g ** 4 * b * b) * (1 / 6 + (1 - b) ** -3 / 3 - (1 - b) ** -2 / 2);
    near(qCmb(eta), long, 1e-9, `long form at η ${eta}`);
  }
  for (const eta of [0, 1e-300, 1e-12, 30, 100]) assert.ok(Number.isFinite(qCmb(eta)), `finite at η ${eta}`);
  near(qGas(1, Math.acosh(2.2e7)), 4.5067e4 * (2.2e7 - 1) * Math.tanh(Math.acosh(2.2e7)), 1e-12, 'q_gas');
  near(qGas(1, 1e-4), 4.5067e4 * (Math.cosh(1e-4) - 1) * Math.tanh(1e-4), 1e-6, 'q_gas slow');
  near(heatRatio(1, 17), (qGas(1, 17) + qCmb(17)) / P_LENS, 1e-15, 'ratio');
});

test('zone limits: n 3e-8, 1 and 1000 give γ 2.448e8, 2.20e7 and 2.2e4', () => {
  const lim = (n) => { const eta = zoneLimit(n); return { eta, gamma: Math.cosh(eta) }; };
  const v = lim(3e-8), d = lim(1), core = lim(1000);
  near(v.gamma, 2.448e8, 0.002, 'void');
  near(v.eta, 20.01, 0.0005, 'void η');
  near(d.gamma, 2.20e7, 0.005, 'disc');
  near(d.eta, 17.60, 0.0005, 'disc η');
  near(core.gamma, 2.2e4, 0.01, 'nebula core');
  near(core.eta, 10.70, 0.001, 'core η');
  for (const n of [3e-8, 0.1, 1, 30, 1e4]) near(heatRatio(n, zoneLimit(n)), 1, 1e-9, `r = 1 at the limit for n ${n}`);
  assert.ok(zoneLimit(1) < zoneLimit(0.1) && zoneLimit(0.1) < zoneLimit(1e-3), 'denser is slower');
  // holding x = 1 in open space: ln r ≈ 1.6
  const lnr = Math.log(heatRatio(3e-8, 20.8));
  assert.ok(lnr > 1.5 && lnr < 1.7, `ln r at η 20.8 in a void: ${lnr}`);
});

test('the view: φ_view = acosh(1 + 5 x^1.5), β_view ≤ 0.986', () => {
  assert.equal(viewRapidity(0), 0);
  near(Math.cosh(viewRapidity(1)), 6, 1e-12, 'γ_view at x = 1');
  assert.ok(Math.tanh(viewRapidity(1)) <= 0.9862);
  near(Math.cosh(viewRapidity(0.5)), 1 + 5 * 0.5 ** 1.5, 1e-12, 'x = 0.5');
  assert.equal(viewRapidity(2), viewRapidity(1));
  assert.equal(viewRapidity(NaN), 0);
  // at x = 1 the forward hemisphere fits within about 9.6° of the centre
  const m = aberrate([1, 0, 0], [0, 0, 1], viewRapidity(1)).n;
  const deg = Math.acos(m[2]) * 180 / Math.PI;
  assert.ok(deg > 9.4 && deg < 9.8, `90° is seen at ${deg}°`);
  near(cmbAheadK(20.01), 1.336e9, 0.01, 'background ahead');
});

test('zoneDistance: ℓ(0) = 0, ℓ(1) = ly, rises monotonically', () => {
  for (const [ly, lambda] of [[1e8, 12], [737321302, 9.3], [1500, 0], [94, 3.2], [1, 1e-12]]) {
    assert.equal(zoneDistance(0, ly, lambda), 0);
    assert.equal(zoneDistance(1, ly, lambda), ly);
    let prev = -1;
    for (let p = 0; p <= 1.0000001; p += 0.01) {
      const l = zoneDistance(p, ly, lambda);
      assert.ok(l > prev || (p === 0 && l === 0), `monotone at p ${p}`);
      assert.ok(l >= 0 && l <= ly);
      prev = l;
    }
  }
  // each power of ten takes the same share of screen time
  const ly = 1e8, lambda = Math.log(1e4);
  const p1 = Math.log(1 / (1 - 0.1 * (1 - Math.exp(-lambda)))) / lambda;
  near(zoneDistance(p1, ly, lambda), 0.1 * ly, 1e-9, 'inverse');
  assert.equal(zoneLambda(1e9, 1e3), 12);
  near(zoneLambda(1e5, 1e3), Math.log(100), 1e-12, 'λ');
  assert.equal(zoneLambda(10, 100), 0);
});

test('formatters', () => {
  const limit = zoneLimit(3e-8);
  assert.equal(fmt.shortfall(limit), 'LIGHT − 2.5 NANOMETRES PER SECOND');
  assert.equal(fmt.timeRate(limit), '1 SECOND HERE = 7.8 YEARS AT HOME');
  assert.equal(fmt.timeRate(Math.acosh(10)), '1 SECOND HERE = 10 SECONDS AT HOME');
  assert.equal(fmt.timeRate(0), '1 SECOND HERE = 1 SECOND AT HOME');
  assert.equal(fmt.timeRate(zoneLimit(1000)), '1 SECOND HERE = 6.2 HOURS AT HOME');
  assert.equal(fmt.nines(limit), '17');
  assert.equal(fmt.nines(0), '0');
  assert.equal(fmt.shortfall(zoneLimit(1000)), 'LIGHT − 30 CENTIMETRES PER SECOND');
  assert.equal(fmt.shortfall(zoneLimit(1)), 'LIGHT − 310 NANOMETRES PER SECOND');
  assert.equal(fmt.shortfall(0), 'LIGHT − 300,000 KILOMETRES PER SECOND');
  assert.equal(fmt.shipClock(4.964 + 3.1 / 365.25), '4 YR 355 D');
  assert.equal(fmt.shipClock(3 + 12.5 / 365.25), '3 YR 12 D');
  assert.equal(fmt.shipClock(40 / 365.25), '40 D');
  assert.equal(fmt.shipClock((5 + 12 / 60) / 24 / 365.25), '5 H 12 MIN');
  assert.equal(fmt.shipClock(0), '0 D');
  const today = { frac: 2026.78 };
  assert.equal(fmt.earthDate(1215266893, today), '1.22 BILLION YEARS AGO');
  assert.equal(fmt.earthDate(478e6, today), '478 MILLION YEARS AGO');
  assert.equal(fmt.earthDate(478e6, today, { short: true }), '478 MYR AGO');
  assert.equal(fmt.earthDate(64.39e6, today), '64.4 MILLION YEARS AGO');
  assert.equal(fmt.earthDate(999.9e6, today), '1.00 BILLION YEARS AGO');
  assert.equal(fmt.earthDate(67800, today), '67,800 YEARS AGO');
  assert.equal(fmt.earthDate(10043.28, today), '8018 BC');
  assert.equal(fmt.earthDate(2026.78 - 413.5, today), '413 AD');
  assert.equal(fmt.earthDate(2026.78 - 1969.5, today), '1969');
  assert.equal(fmt.earthDate(0, today), 'TODAY');
});
