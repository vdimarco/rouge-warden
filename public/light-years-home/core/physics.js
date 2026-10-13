// Light Years Home: the physics. Speed as rapidity, the light-speed view (aberration, Doppler colour and brightness),
// the blackbody colour table, the two heat sources on the Lens, each zone's speed limit, and the HUD number formats.
// Pure: no DOM and no WebGL. The shader, the overlay, picking and the tests all use these same formulas.

export const C_MS = 299792458;                 // speed of light, metres per second
export const YEAR_S = 31557600;                // Julian year, seconds
export const DAYS_PER_YEAR = 365.25;
export const P_LENS = 1e12;                    // Lens rating, W/m² (the one invented number)
export const Q_GAS_K = 4.5067e4;               // n (per cm³) · c · m_p c², W/m² per unit of (γ − 1) β
export const T_CMB = 2.7255;                   // K
export const SIGMA = 5.670374419e-8;           // Stefan-Boltzmann, W/(m² K⁴)
export const UC_CMB = 4 * SIGMA * T_CMB ** 4;  // u c of the cosmic background, 1.2516e-5 W/m²
export const LNY_K = 25924;                    // hc / (k · 555 nm), K

const MINUS = '\u2212';                        // the minus sign in 'LIGHT − 2.5 ...'
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------- speed ----------

// γ = cosh η, γβ = sinh η, β = tanh η, and 1 − β in a form that keeps every digit near light speed.
export function fromRapidity(eta) {
  const e = Math.max(0, finite(eta) ? eta : 0);
  return {
    beta: Math.tanh(e),
    gamma: Math.cosh(e),
    celerity: Math.sinh(e),
    oneMinusBeta: 2 / (Math.exp(2 * e) + 1),
  };
}

// ---------- the light-speed view ----------

// Shared by aberrate and doppler: the angle θ from the direction of motion, kept as sin θ (the length of p, the part
// of n at right angles to v) and 1 + cos θ (from |n + v|² / 2, accurate even when n points almost straight back).
// Then t = tan(θ/2) = sin θ / (1 + cos θ), or w = 1/t behind.
function halfAngle(n, v) {
  const c = n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
  let px = n[0] - c * v[0], py = n[1] - c * v[1], pz = n[2] - c * v[2];
  const e = px * v[0] + py * v[1] + pz * v[2];                        // second pass: keeps p at right angles to v
  px -= e * v[0]; py -= e * v[1]; pz -= e * v[2];
  const s = Math.hypot(px, py, pz);                                   // |n × v| = sin θ
  const onePlusC = Math.hypot(n[0] + v[0], n[1] + v[1], n[2] + v[2]) ** 2 / 2;
  return { c, s, px, py, pz, onePlusC };
}

// Doppler factor from t = tan(θ/2): D = (e^φ + t² e^−φ) / (1 + t²), written with w = 1/t when behind.
function dopplerFrom(h, ep, em) {
  if (h.s < 1e-300) return h.c > 0 ? ep : em;
  if (h.c >= -0.9) {
    const t = h.s / h.onePlusC, t2 = t * t;
    return (ep + t2 * em) / (1 + t2);
  }
  const w = h.onePlusC / h.s, w2 = w * w;
  return (ep * w2 + em) / (w2 + 1);
}

// Where a source in direction n (unit, galaxy frame) is seen from a ship moving along unit v with rapidity φ, and its
// Doppler factor D (> 1 is blueshift). Stereographic form (Penrose 1959): tan(θ'/2) = e^−φ tan(θ/2).
// Stable for any φ.
export function aberrate(n, v, phi) {
  const f = Math.max(0, finite(phi) ? phi : 0);
  const ep = Math.exp(f), em = Math.exp(-f);
  const h = halfAngle(n, v);
  if (h.s < 1e-300) return { n: [n[0], n[1], n[2]], D: h.c > 0 ? ep : em };
  let cosT, sinT;
  if (h.c >= -0.9) {
    const tp = em * h.s / h.onePlusC;                                // t' = e^−φ t
    if (tp <= 1) { const q = tp * tp; cosT = (1 - q) / (1 + q); sinT = 2 * tp / (1 + q); }
    else { const wp = 1 / tp, q = wp * wp; cosT = (q - 1) / (q + 1); sinT = 2 * wp / (q + 1); }
  } else {
    const wp = ep * h.onePlusC / h.s;                                // 1/t' = e^φ w, with w = (1 + n·v)/|n × v|
    if (wp <= 1) { const q = wp * wp; cosT = (q - 1) / (q + 1); sinT = 2 * wp / (q + 1); }
    else { const tp = 1 / wp, q = tp * tp; cosT = (1 - q) / (1 + q); sinT = 2 * tp / (1 + q); }
  }
  const k = sinT / h.s;
  return {
    n: [cosT * v[0] + k * h.px, cosT * v[1] + k * h.py, cosT * v[2] + k * h.pz],
    D: dopplerFrom(h, ep, em),
  };
}

// Doppler factor alone, same maths as aberrate.
export function doppler(n, v, phi) {
  const f = Math.max(0, finite(phi) ? phi : 0);
  return dopplerFrom(halfAngle(n, v), Math.exp(f), Math.exp(-f));
}

// Reference vector form, for tests only: n' = (n + ((γ − 1)c + γβ) v) / D, D = γ(1 + βc).
export function aberrateVector(n, v, beta) {
  const g = 1 / Math.sqrt(1 - beta * beta);
  const c = n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
  const D = g * (1 + beta * c);
  const k = (g - 1) * c + g * beta;
  return { n: [(n[0] + k * v[0]) / D, (n[1] + k * v[1]) / D, (n[2] + k * v[2]) / D], D };
}

// ln of a blackbody's brightness to the eye (Planck at 555 nm), stable for any T:
// −(x + ln(1 − e^−x)), x = 25924 K / T.
export function lnY(T) {
  const x = LNY_K / T;
  return -(x + Math.log(-Math.expm1(-x)));
}

// What a blackbody at T looks like with Doppler factor D: its seen temperature, and its brightness factor as a point
// star (after aberration packs D² more stars per patch of sky) and as a diffuse glow.
export function seen(T, D) {
  const diffuse = Math.exp(lnY(D * T) - lnY(T));
  return { T: D * T, star: diffuse / (D * D), diffuse };
}

// ---------- blackbody colour ----------

// CIE 1931 colour matching functions, multi-lobe fit of Wyman, Sloan and Shirley (JCGT 2013), sampled every 5 nm.
const lobe = (l, mu, s1, s2) => { const t = (l - mu) * (l < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
const CMF = [];
for (let nm = 380; nm <= 780; nm += 5) {
  CMF.push([
    nm,
    0.362 * lobe(nm, 442.0, 0.0624, 0.0374) + 1.056 * lobe(nm, 599.8, 0.0264, 0.0323)
      - 0.065 * lobe(nm, 501.1, 0.0490, 0.0382),
    0.821 * lobe(nm, 568.8, 0.0213, 0.0247) + 0.286 * lobe(nm, 530.9, 0.0613, 0.0322),
    1.217 * lobe(nm, 437.0, 0.0845, 0.0278) + 0.681 * lobe(nm, 459.0, 0.0385, 0.0725),
  ]);
}
const C2 = 0.0143877735;                       // hc / k, m·K
const lnExpm1 = (x) => (x > 30 ? x + Math.log1p(-Math.exp(-x)) : Math.log(Math.expm1(x)));

// Linear sRGB of a blackbody at T kelvin, scaled so the brightest channel is 1. Planck's law is summed in log space,
// so it neither overflows nor underflows at any temperature.
export function blackbodyRGB(T) {
  const t = clamp(finite(T) && T > 0 ? T : 6500, 1, 1e12);
  const lp = CMF.map(([nm]) => { const l = nm * 1e-9; return -5 * Math.log(l) - lnExpm1(C2 / (l * t)); });
  const top = Math.max(...lp);
  let X = 0, Y = 0, Z = 0;
  for (let i = 0; i < CMF.length; i++) {
    const p = Math.exp(lp[i] - top);
    X += p * CMF[i][1]; Y += p * CMF[i][2]; Z += p * CMF[i][3];
  }
  const rgb = [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.2040 * Y + 1.0570 * Z,
  ].map((c) => Math.max(c, 0));
  const m = Math.max(...rgb);
  return m > 0 ? rgb.map((c) => c / m) : [1, 1, 1];
}

export const srgbEncode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

// The colour table for the shader: size × 1 RGBA bytes, sRGB-encoded, temperatures spaced evenly in log T.
export function lutData(size = 256, tMin = 500, tMax = 200000) {
  const data = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const rgb = blackbodyRGB(tMin * (tMax / tMin) ** (i / (size - 1)));
    for (let k = 0; k < 3; k++) data[i * 4 + k] = Math.round(255 * srgbEncode(rgb[k]));
    data[i * 4 + 3] = 255;
  }
  return data;
}

// Texture coordinate of temperature T in that table (texel centres), clamped to its ends.
export function lutU(T, size = 256, tMin = 500, tMax = 200000) {
  const f = clamp(Math.log(T / tMin) / Math.log(tMax / tMin), 0, 1) * (size - 1);
  return (f + 0.5) / size;
}

// ---------- heat on the Lens ----------

// Gas impacts: each proton arrives with (γ − 1) m_p c². n in atoms per cm³. W/m².
export function qGas(n, eta) {
  const e = Math.max(0, finite(eta) ? eta : 0);
  const sh = Math.sinh(e / 2);
  return Math.max(0, finite(n) ? n : 0) * Q_GAS_K * (2 * sh * sh) * Math.tanh(e);   // γ − 1 = 2 sinh²(η/2)
}

// The cosmic background on the forward face, W/m². The design's form
//   (u c)/(2 γ⁴ β²) · [1/6 + (1 − β)⁻³/3 − (1 − β)⁻²/2]
// simplifies exactly to u c (3 − β)(1 + β)² / (12 (1 − β)), which has no cancellation at any speed:
// σT⁴ at rest, (4/3) u c γ² near light speed.
export function qCmb(eta) {
  const { beta, oneMinusBeta } = fromRapidity(eta);
  return UC_CMB * (3 - beta) * (1 + beta) ** 2 / (12 * oneMinusBeta);
}

// Heat on the Lens as a share of its rating: r = (q_gas + q_cmb) / P.
export function heatRatio(n, eta) {
  return (qGas(n, eta) + qCmb(eta)) / P_LENS;
}

// The rapidity where heatRatio(n, η) = 1: the zone's speed limit (bisection; r rises with η).
export function zoneLimit(n) {
  let lo = 0, hi = 60;
  if (heatRatio(n, lo) >= 1) return 0;
  for (let i = 0; i < 200 && hi - lo > 1e-13; i++) {
    const mid = (lo + hi) / 2;
    if (heatRatio(n, mid) < 1) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Temperature of the cosmic background seen dead ahead: T e^η.
export function cmbAheadK(eta) {
  return T_CMB * Math.exp(Math.max(0, finite(eta) ? eta : 0));
}

// ---------- the view and the time-lapse ----------

// The picture's gentler speed: γ_view = 1 + 5 x^1.5 (β_view ≤ 0.986).
export function viewRapidity(x) {
  const t = clamp(finite(x) ? x : 0, 0, 1);
  return Math.acosh(1 + 5 * t ** 1.5);
}

// Distance covered inside a zone at progress p: ℓ(p) = ly (1 − e^−λp) / (1 − e^−λ). Each power of ten gets the same
// screen time. ℓ(0) = 0 and ℓ(1) = ly exactly.
export function zoneDistance(p, ly, lambda) {
  const q = clamp(finite(p) ? p : 0, 0, 1);
  if (!(lambda > 1e-9)) return ly * q;
  if (q === 1) return ly;
  return ly * (Math.expm1(-lambda * q) / Math.expm1(-lambda));
}

// λ for a zone: clamp(ln(ly / nextFeatureLy), 0, 12).
export function zoneLambda(ly, nextFeatureLy) {
  if (!(ly > 0) || !(nextFeatureLy > 0)) return 0;
  return clamp(Math.log(ly / nextFeatureLy), 0, 12);
}

// ---------- dates (shared with timeline.js) ----------

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export function daysInMonth(y, m) { return m === 2 && isLeap(y) ? 29 : MONTH_DAYS[m - 1]; }

// Calendar date as a decimal year, at midday: 13 October 2026 → 2026.782.
export function decimalYear(y, m, d) {
  let doy = d;
  for (let k = 1; k < m; k++) doy += daysInMonth(y, k);
  return y + (doy - 0.5) / (isLeap(y) ? 366 : 365);
}

export const REF_FRAC = decimalYear(2026, 10, 13);

// Decimal year from a number, a { frac } object or a { y, m, d } object. Anything else is the reference date.
export function fracOf(today) {
  if (finite(today)) return today;
  if (today && finite(today.frac)) return today.frac;
  if (today && Number.isInteger(today.y) && Number.isInteger(today.m) && Number.isInteger(today.d)
      && today.m >= 1 && today.m <= 12 && today.d >= 1 && today.d <= daysInMonth(today.y, today.m)) {
    return decimalYear(today.y, today.m, today.d);
  }
  return REF_FRAC;
}

// ---------- HUD formatters ----------

// 1234567 → '1,234,567'
export function groupDigits(n) {
  const s = String(Math.round(Math.abs(n)));
  return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Round to k significant figures.
function roundSig(v, k) {
  if (v === 0 || !finite(v)) return v;
  const p = 10 ** (Math.floor(Math.log10(Math.abs(v))) - k + 1);
  return Math.round(v / p) * p;
}

// Two significant figures, plain: 2.5, 31, 310, 300,000. Trailing '.0' dropped.
function two(v) {
  const r = roundSig(v, 2);
  if (r >= 10) return groupDigits(r);
  if (r >= 1) return r.toFixed(1).replace(/\.0$/, '');
  return String(Number(r.toPrecision(2)));
}

// Pick the largest unit where the value is at least 1, after rounding (so 999.7 nm reads 1 micrometre).
function inUnits(value, units, format) {
  let i = units.findIndex(([size]) => value / size >= 1);
  if (i < 0) i = units.length - 1;
  let text = format(value / units[i][0]);
  if (i > 0 && Number(text.replace(/,/g, '')) * units[i][0] >= units[i - 1][0]) {
    i -= 1;
    text = format(value / units[i][0]);
  }
  return { text, unit: units[i][1] };
}

const plural = (text, word) => (text === '1' ? word : word + 'S');

const LENGTHS = [[1e3, 'KILOMETRE'], [1, 'METRE'], [1e-2, 'CENTIMETRE'], [1e-3, 'MILLIMETRE'], [1e-6, 'MICROMETRE'],
  [1e-9, 'NANOMETRE']];
const TIMES = [[YEAR_S, 'YEAR'], [86400, 'DAY'], [3600, 'HOUR'], [60, 'MINUTE'], [1, 'SECOND']];

// Plain number for the time rate: one decimal under 10, whole numbers above.
function rate(v) {
  if (v < 10) return v.toFixed(1).replace(/\.0$/, '');
  return groupDigits(v);
}

// Earth-date numbers: 3 significant figures.
function sig3(v) {
  const r = roundSig(v, 3);
  return r >= 100 ? groupDigits(r) : r.toPrecision(3);
}

export const fmt = {
  // How far short of light you are: 'LIGHT − 2.5 NANOMETRES PER SECOND'.
  shortfall(eta) {
    const ms = C_MS * fromRapidity(eta).oneMinusBeta;
    const { text, unit } = inUnits(ms, LENGTHS, two);
    return `LIGHT ${MINUS} ${text} ${plural(text, unit)} PER SECOND`;
  },
  // How much faster Earth's clock runs: '1 SECOND HERE = 7.8 YEARS AT HOME'.
  timeRate(eta) {
    const s = fromRapidity(eta).gamma;
    const { text, unit } = inUnits(s, TIMES, rate);
    return `1 SECOND HERE = ${text} ${plural(text, unit)} AT HOME`;
  },
  // Count of nines in β: 17 at the open-space limit.
  nines(eta) {
    const omb = fromRapidity(eta).oneMinusBeta;
    return String(Math.max(0, Math.floor(-Math.log10(omb) + 1e-9)));
  },
  // Ship clock: '4 YR 355 D', '12 D', or '5 H 12 MIN' under a day.
  shipClock(years) {
    const y = finite(years) && years > 0 ? years : 0;
    if (y === 0) return '0 D';
    if (y * DAYS_PER_YEAR < 1) {
      const min = Math.floor(y * DAYS_PER_YEAR * 1440);
      return `${Math.floor(min / 60)} H ${min % 60} MIN`;
    }
    const whole = Math.floor(y);
    const d = Math.floor((y - whole) * DAYS_PER_YEAR);
    return whole > 0 ? `${groupDigits(whole)} YR ${d} D` : `${d} D`;
  },
  // Earth date: '1.22 BILLION YEARS AGO', '478 MILLION YEARS AGO', '67,800 YEARS AGO', then calendar years from
  // 12,000 years ago ('8019 BC', '413 AD', '1969'), and 'TODAY' at arrival. { short: true } gives '478 MYR AGO'.
  earthDate(yearsAgo, today, opts) {
    const short = Boolean(opts && opts.short);
    const ago = finite(yearsAgo) ? yearsAgo : 0;
    if (ago <= 1e-9) return 'TODAY';
    if (ago < 12000) {
      const year = Math.floor(fracOf(today) - ago);
      if (year <= 0) return `${1 - year} BC`;
      return year < 1000 ? `${year} AD` : String(year);
    }
    const r = roundSig(ago, 3);
    if (r >= 1e9) return `${sig3(ago / 1e9)} ${short ? 'GYR' : 'BILLION YEARS'} AGO`;
    if (r >= 1e6) return `${sig3(ago / 1e6)} ${short ? 'MYR' : 'MILLION YEARS'} AGO`;
    return `${groupDigits(r)} ${short ? 'YR' : 'YEARS'} AGO`;
  },
};
