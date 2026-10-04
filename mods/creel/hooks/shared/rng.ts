// Copied from mods/shared/rng.ts by mods/sync.mjs. Edit the source there, then run node mods/sync.mjs.
// A small seeded random generator (mulberry32), so a test or a day can replay the same picks.
// mods/sync.mjs copies it into each mod's hooks/shared/.

export type Random = () => number

export function seeded(seed: number): Random {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A whole number from a string, for seeding: the same text gives the same number. */
export function hashOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** One item, picked with each item's weight. */
export function weighted<T>(items: readonly T[], weightOf: (item: T) => number, random: Random): T | undefined {
  let total = 0
  for (const item of items) total += Math.max(0, weightOf(item))
  let left = random() * total
  for (const item of items) {
    left -= Math.max(0, weightOf(item))
    if (left < 0) return item
  }
  return items[items.length - 1]
}
