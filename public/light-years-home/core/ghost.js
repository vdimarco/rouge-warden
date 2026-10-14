// Light Years Home v3: ghosts (races §2.5, final.md 4.3). A ghost is positions, not inputs, so tuning never breaks
// one. The core records a run at 20 Hz into a plain recorder: each sample is the move since the last one in 1/32 u
// steps (one signed byte per axis), the yaw in one byte and one byte of flags (boost, drift tier, hit): 5 bytes. A
// move bigger than one byte can hold is carried into the next samples, so the ghost catches up instead of drifting.
// Links carry the run at 10 Hz in 1/16 u steps with no yaw or flags (3 bytes a sample), in base64url.

const TAU = Math.PI * 2;
const MAGIC = 0x47;               // 'G': a recorded ghost
const LINK_MAGIC = 0x4c;          // 'L': a link
const HEAD = 20;                  // magic, version, hz, units, n (uint32), x0, y0, z0 (int32 in units)
const LINK_HEAD = 18;             // magic, version, hz, units, n (uint16), x0, y0, z0 (int32)
export const UNITS = 32;          // steps per u in a recording
export const LINK_UNITS = 16;
export const LINK_HZ = 10;
export const FLAG = Object.freeze({ boost: 1, drift1: 2, drift2: 4, drift3: 6, hit: 8, pad: 16 });

const clampByte = (x) => (x < -127 ? -127 : x > 127 ? 127 : x);
const num = (x) => (typeof x === 'number' && x === x && x !== Infinity && x !== -Infinity ? x : 0);

/**
 * createRecorder(hz = 20, seconds = 120) → a recorder (plain data, so the game state stays cloneable). It holds
 * hz × seconds samples; later samples are dropped.
 */
export function createRecorder(hz = 20, seconds = 120) {
  const cap = Math.max(2, Math.ceil(hz * seconds) + 1);
  return { hz, cap, n: 0, t0: 0, next: 0, x0: 0, y0: 0, z0: 0, qx: 0, qy: 0, qz: 0, buf: new Uint8Array(cap * 5) };
}

/** flagsOf(ship) → the flags byte for a sample: boost, drift tier, a hit in the last 0.2 s, a pad kick. */
export function flagsOf(ship, t = 0) {
  let f = 0;
  if (ship.boosting) f |= FLAG.boost;
  const tier = ship.drift?.on ? ship.drift.tier | 0 : 0;
  f |= (Math.min(3, tier) & 3) << 1;
  if (t - num(ship.lastHitT) < 0.2) f |= FLAG.hit;
  if (ship.padT > 0) f |= FLAG.pad;
  return f;
}

/**
 * record(rec, ship, flags, t): add every sample due by time t (s on any clock that starts with the run). The first
 * call sets the start. Returns the sample count.
 */
export function record(rec, ship, flags, t) {
  const p = ship.pos;
  if (rec.n === 0) {
    rec.x0 = Math.round(num(p[0]) * UNITS); rec.y0 = Math.round(num(p[1]) * UNITS); rec.z0 = Math.round(num(p[2]) * UNITS);
    rec.qx = rec.x0; rec.qy = rec.y0; rec.qz = rec.z0;
    rec.t0 = t; rec.next = t;
  }
  const dt = 1 / rec.hz;
  while (t >= rec.next - 1e-9 && rec.n < rec.cap) {
    const k = rec.n * 5;
    const dx = clampByte(Math.round(num(p[0]) * UNITS) - rec.qx);
    const dy = clampByte(Math.round(num(p[1]) * UNITS) - rec.qy);
    const dz = clampByte(Math.round(num(p[2]) * UNITS) - rec.qz);
    rec.qx += dx; rec.qy += dy; rec.qz += dz;
    rec.buf[k] = dx & 255; rec.buf[k + 1] = dy & 255; rec.buf[k + 2] = dz & 255;
    const y = num(ship.yaw) / TAU;
    rec.buf[k + 3] = Math.round((y - Math.floor(y)) * 256) & 255;
    rec.buf[k + 4] = flags & 255;
    rec.n++;
    rec.next = rec.t0 + rec.n * dt;
  }
  return rec.n;
}

const i8 = (b) => (b > 127 ? b - 256 : b);

function putI32(out, k, v) {
  out[k] = v & 255; out[k + 1] = (v >>> 8) & 255; out[k + 2] = (v >>> 16) & 255; out[k + 3] = (v >>> 24) & 255;
}
const getI32 = (b, k) => (b[k] | (b[k + 1] << 8) | (b[k + 2] << 16) | (b[k + 3] << 24));

/** encode(rec) → Uint8Array: a 20-byte header and 5 bytes a sample. */
export function encode(rec) {
  const n = rec.n;
  const out = new Uint8Array(HEAD + n * 5);
  out[0] = MAGIC; out[1] = 1; out[2] = rec.hz & 255; out[3] = UNITS;
  putI32(out, 4, n);
  putI32(out, 8, rec.x0); putI32(out, 12, rec.y0); putI32(out, 16, rec.z0);
  out.set(rec.buf.subarray(0, n * 5), HEAD);
  return out;
}

/**
 * decode(bytes) → Ghost { hz, n, duration, x, y, z, yaw, flags } (typed arrays, positions in u, yaw in radians), or
 * null for junk. Takes a recording (encode) or a link's bytes.
 */
export function decode(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < LINK_HEAD) return null;
  const link = bytes[0] === LINK_MAGIC;
  if (!link && bytes[0] !== MAGIC) return null;
  const hz = bytes[2], units = bytes[3];
  if (!(hz > 0) || !(units > 0)) return null;
  const n = link ? bytes[4] | (bytes[5] << 8) : getI32(bytes, 4);
  const at = link ? 6 : 8;
  const per = link ? 3 : 5;
  const head = link ? LINK_HEAD : HEAD;
  if (!(n > 0) || bytes.length < head + n * per) return null;
  let qx = getI32(bytes, at), qy = getI32(bytes, at + 4), qz = getI32(bytes, at + 8);
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n);
  const yaw = new Float32Array(n), flags = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const k = head + i * per;
    qx += i8(bytes[k]); qy += i8(bytes[k + 1]); qz += i8(bytes[k + 2]);
    x[i] = qx / units; y[i] = qy / units; z[i] = qz / units;
    if (!link) {
      yaw[i] = (bytes[k + 3] / 256) * TAU;
      flags[i] = bytes[k + 4];
    } else if (i > 0) {
      yaw[i] = Math.atan2(x[i] - x[i - 1], y[i] - y[i - 1]);
    }
  }
  if (link && n > 1) yaw[0] = yaw[1];
  return { hz, n, duration: (n - 1) / hz, x, y, z, yaw, flags };
}

/**
 * sampleAt(ghost, t, out) → true with out = [x, y, z] (and out[3] = yaw when out has room) at t seconds into the
 * run, or false before the start or past the end (render/ghosts.js reads it as "has a sample").
 */
export function sampleAt(ghost, t, out) {
  if (!ghost || !(ghost.n > 0) || !(t >= 0) || t > ghost.duration + 1e-9) return false;
  const f = t * ghost.hz;
  const i = Math.min(ghost.n - 1, Math.floor(f));
  const j = Math.min(ghost.n - 1, i + 1);
  const a = f - i;
  out[0] = ghost.x[i] + (ghost.x[j] - ghost.x[i]) * a;
  out[1] = ghost.y[i] + (ghost.y[j] - ghost.y[i]) * a;
  out[2] = ghost.z[i] + (ghost.z[j] - ghost.z[i]) * a;
  if (out.length > 3) {
    let d = ghost.yaw[j] - ghost.yaw[i];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    out[3] = ghost.yaw[i] + d * a;
  }
  return true;
}

/**
 * pacerAt(ghost, t, ratio, out): the pacer is the ghost with its clock stretched by ratio (gold 1.07): at time t it
 * is where the ghost was at t / ratio. Same return value as sampleAt.
 */
export function pacerAt(ghost, t, ratio, out) {
  return sampleAt(ghost, t / (ratio > 0 ? ratio : 1), out);
}

// ---------------------------------------------------------------- base64 (no browser globals in core)

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const ABC_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const REV = (() => {
  const r = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) { r[ABC.charCodeAt(i)] = i; r[ABC_URL.charCodeAt(i)] = i; }
  return r;
})();

/** toBase64(bytes, url = false) → string. url: base64url with no padding; else standard with padding (atob reads it). */
export function toBase64(bytes, url = false) {
  const abc = url ? ABC_URL : ABC;
  let s = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    s += abc[v >> 18] + abc[(v >> 12) & 63] + abc[(v >> 6) & 63] + abc[v & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const v = bytes[i] << 16;
    s += abc[v >> 18] + abc[(v >> 12) & 63] + (url ? '' : '==');
  } else if (rest === 2) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8);
    s += abc[v >> 18] + abc[(v >> 12) & 63] + abc[(v >> 6) & 63] + (url ? '' : '=');
  }
  return s;
}

/** fromBase64(text) → Uint8Array, or null for junk. Reads both alphabets, with or without padding. */
export function fromBase64(text) {
  if (typeof text !== 'string') return null;
  const s = text.replace(/=+$/, '');
  if (s.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0, acc = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const v = c < 128 ? REV[c] : -1;
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; }
  }
  return out;
}

// ---------------------------------------------------------------- links

/**
 * toLink(eventId, bytes) → string 'eventId~base64url': the run at 10 Hz, 3 bytes a sample in 1/16 u steps. About
 * 0.8 KB for a 20 s race. Junk bytes give null.
 */
export function toLink(eventId, bytes) {
  const g = decode(bytes);
  if (!g || typeof eventId !== 'string') return null;
  const step = Math.max(1, Math.round(g.hz / LINK_HZ));
  const n = Math.min(65535, Math.floor((g.n - 1) / step) + 1);
  const out = new Uint8Array(LINK_HEAD + n * 3);
  out[0] = LINK_MAGIC; out[1] = 1; out[2] = Math.max(1, Math.round(g.hz / step)); out[3] = LINK_UNITS;
  out[4] = n & 255; out[5] = (n >> 8) & 255;
  const x0 = Math.round(g.x[0] * LINK_UNITS), y0 = Math.round(g.y[0] * LINK_UNITS), z0 = Math.round(g.z[0] * LINK_UNITS);
  putI32(out, 6, x0); putI32(out, 10, y0); putI32(out, 14, z0);
  let qx = x0, qy = y0, qz = z0;
  for (let i = 0; i < n; i++) {
    const j = i * step, k = LINK_HEAD + i * 3;
    const dx = clampByte(Math.round(g.x[j] * LINK_UNITS) - qx);
    const dy = clampByte(Math.round(g.y[j] * LINK_UNITS) - qy);
    const dz = clampByte(Math.round(g.z[j] * LINK_UNITS) - qz);
    qx += dx; qy += dy; qz += dz;
    out[k] = dx & 255; out[k + 1] = dy & 255; out[k + 2] = dz & 255;
  }
  return `${eventId}~${toBase64(out, true)}`;
}

/** fromLink(text) → { id, ghost } or null. */
export function fromLink(text) {
  if (typeof text !== 'string') return null;
  const cut = text.lastIndexOf('~');
  if (cut <= 0) return null;
  const id = text.slice(0, cut);
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return null;
  const ghost = decode(fromBase64(text.slice(cut + 1)));
  return ghost ? { id, ghost } : null;
}
