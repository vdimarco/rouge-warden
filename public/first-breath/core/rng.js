// First Breath: seeded random streams (design.md 16.2). Every stream is mulberry32 seeded with the FNV-1a hash of
// "<seed>:<name>", so each named stream is its own sequence and the same seed always gives the same run. Pure: it
// wraps the arcade's shared kit (public/lab/kit/rng.js) and never touches Math.random.
import { mulberry, fnv1a } from "../../lab/kit/rng.js";

// A stream: () => a float in [0, 1).
export function stream(seed, name) {
  return mulberry(fnv1a(String(seed) + ":" + name));
}

// A standard normal from stream r (Box–Muller, no caching, so each call takes exactly two draws).
// 1 − r() lies in (0, 1], so the log never sees 0.
export function gauss(r) {
  const u1 = 1 - r(), u2 = r();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// One item of a list (undefined for an empty list).
export function pick(r, list) {
  if (!list || !list.length) return undefined;
  return list[Math.min(list.length - 1, Math.floor(r() * list.length))];
}
