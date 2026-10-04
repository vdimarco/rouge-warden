// The dish: a small live Lenia dish, run by the Primordia core (vendor/lenia.js is
// public/primordia/lenia.js) with its Orbium and its colours (public/primordia/attract.js). Two Orbiums
// glide side by side, so they never meet, and leave a violet trail in the agar that grows back. Every
// so often, or when they die out, the dish seeds again with a new heading. Pure, so
// mods/qa/frames.mjs can time it; register.tsx steps it on a timer and draws it.
import { RULES, World, decodeCells } from './vendor/lenia.js'
import { ORBIUM } from './vendor/species.js'
import { pixels, rasterCells, svgOf } from './shared/cells.ts'
import type { Pixels } from './shared/cells.ts'
import { seeded } from './shared/rng.ts'
import type { Random } from './shared/rng.ts'

const ORB = decodeCells(ORBIUM) as number[][]

/** Steps before the dish seeds again with a new heading (about 90 s at 15 steps a second). */
export const RESEED_STEPS = 1350

export type Dish = { n: number; world: World; random: Random; steps: number; seeds: number }

/** Two Orbiums half a dish apart with one heading: they glide side by side. */
function seed(dish: Dish): void {
  const { n, world, random } = dish
  world.clear()
  const angle = Math.floor(random() * 4) * (Math.PI / 2)
  const x = n * (0.15 + random() * 0.2), y = n * (0.15 + random() * 0.2)
  world.stamp(world.A, ORB, x, y, angle, 1)
  world.stamp(world.A, ORB, x + n / 2, y + n / 2, angle, 1)
  dish.steps = 0
  dish.seeds++
}

/** A dish of n by n cells; n is a power of two (the core's FFT asks for one). */
export function makeDish(n = 64, seedNumber = 1): Dish {
  const dish: Dish = { n, world: new World(n, n, RULES), random: seeded(seedNumber), steps: 0, seeds: 0 }
  seed(dish)
  return dish
}

export function stepDish(dish: Dish): void {
  dish.world.step()
  dish.steps++
  if (dish.steps >= RESEED_STEPS || (dish.steps > 30 && dish.world.massA < 40)) seed(dish)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** The colour of one cell, as attract.js paints it: teal agar, violet where eaten, cyan prey. */
export function cellColor(a: number, agar: number): number {
  let r = lerp(13, 4, agar), g = lerp(5, 18, agar), b = lerp(18, 26, agar)
  const pa = smooth(0.04, 0.3, a)
  if (pa > 0) {
    const lo = smooth(0.08, 0.45, a), hi = smooth(0.55, 0.95, a)
    r = lerp(r, lerp(lerp(5, 20, lo), 191, hi), pa)
    g = lerp(g, lerp(lerp(64, 217, lo), 255, hi), pa)
    b = lerp(b, lerp(lerp(82, 217, lo), 235, hi), pa)
  }
  // a touch more light than the cabinet, which adds a glow on top
  const k = 1.35
  return (Math.min(255, Math.round(r * k)) << 16) | (Math.min(255, Math.round(g * k)) << 8) | Math.min(255, Math.round(b * k))
}

/** The dish as a canvas of `size` by `size` pixels (nearest cell). */
export function drawDish(dish: Dish, size = dish.n): Pixels {
  const p = pixels(size, size)
  const { A, N } = dish.world
  for (let y = 0; y < size; y++) {
    const cy = Math.floor((y * dish.n) / size)
    for (let x = 0; x < size; x++) {
      const i = cy * dish.n + Math.floor((x * dish.n) / size)
      p.px[y * size + x] = cellColor(A[i] ?? 0, N[i] ?? 1)
    }
  }
  return p
}

export const dishCells = (dish: Dish, size = dish.n): string => rasterCells(drawDish(dish, size))
export const dishSvg = (dish: Dish, size = 48): string => svgOf(drawDish(dish, size), 6, 3)
