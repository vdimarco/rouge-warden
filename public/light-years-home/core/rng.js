// Light Years Home: seeded random numbers. The same seed always gives the same journey, so tests can replay a run.

// mulberry32: a small, fast generator with a 32-bit state. Returns a function that gives floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// hashSeed: mixes numbers and strings into one 32-bit seed (FNV-1a over the parts).
export function hashSeed(...parts) {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 0x7c;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
