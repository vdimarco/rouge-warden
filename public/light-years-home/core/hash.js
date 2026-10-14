// Light Years Home v3: a 32-bit FNV-1a hash of the whole game state, for determinism tests. Numbers are rounded to
// 1e-6 first, so two runs that differ only in the last bits of a float still match. Object keys are hashed in sorted
// order, so a structuredClone hashes the same as the original. The top-level `tune` (a shared frozen table) is skipped.

const PRIME = 0x01000193;

function mixByte(h, b) {
  return Math.imul(h ^ (b & 0xff), PRIME) >>> 0;
}

function mixInt(h, x) {
  h = mixByte(h, x);
  h = mixByte(h, x >>> 8);
  h = mixByte(h, x >>> 16);
  return mixByte(h, x >>> 24);
}

function mixText(h, s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = mixByte(h, c);
    if (c > 0xff) h = mixByte(h, c >>> 8);
  }
  return mixByte(h, 0);
}

function mixNumber(h, x) {
  if (x !== x) return mixText(h, 'NaN');
  if (x === Infinity || x === -Infinity) return mixText(h, x > 0 ? '+Inf' : '-Inf');
  const r = Math.round(x * 1e6);
  if (r === 0) return mixInt(mixByte(h, 1), 0);                 // 0 and -0 are the same
  if (Number.isSafeInteger(r)) {
    h = mixByte(h, 2);
    h = mixInt(h, r >>> 0);
    return mixInt(h, Math.floor(r / 4294967296) >>> 0);
  }
  return mixText(mixByte(h, 3), x.toPrecision(12));
}

function mix(h, v, top) {
  if (v === null || v === undefined) return mixByte(h, v === null ? 4 : 5);
  switch (typeof v) {
    case 'number': return mixNumber(h, v);
    case 'boolean': return mixByte(h, v ? 6 : 7);
    case 'string': return mixText(mixByte(h, 8), v);
    case 'function': return mixByte(h, 9);
    default: break;
  }
  if (Array.isArray(v) || ArrayBuffer.isView(v)) {
    h = mixInt(mixByte(h, 10), v.length);
    for (let i = 0; i < v.length; i++) h = mix(h, v[i], false);
    return h;
  }
  const keys = Object.keys(v).sort();
  h = mixInt(mixByte(h, 11), keys.length);
  for (const key of keys) {
    if (top && key === 'tune') continue;
    h = mixText(h, key);
    h = mix(h, v[key], false);
  }
  return h;
}

// hashState(game) → uint32. Works on any plain data, not only the game.
export function hashState(game) {
  return mix(0x811c9dc5, game, true) >>> 0;
}
