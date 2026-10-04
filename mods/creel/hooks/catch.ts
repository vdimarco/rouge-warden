// What comes up on the line: a Reel It In fish for a green run, junk for a red one, and the Golden
// Loon Bass for a merged pull request. The fish, their weights and rarity come from the game
// (vendor/species.js is public/fish/js/species.js); the reveal line follows revealText in
// public/fish/js/journey.js. Pure: register.ts keeps the creel and draws the band.
import { JUNK, SPECIES } from './vendor/species.js'
import { weighted } from './shared/rng.ts'
import type { Random } from './shared/rng.ts'
import type { CreelBook, CreelFish } from '../types'

/** One catch. `big`: in the top sixth of its kind's weight range ("It is a huge Walleye!"). */
export type Fish = CreelFish

/** A command must run this long before a fish bites. */
export const BITE_MS = 3000

type Species = { id: string; name: string; kg: number[]; rarity?: number; legend?: boolean; article?: string }
const ALL = SPECIES as Species[]
const POOL = ALL.filter(s => s.legend !== true && (s.rarity ?? 0) > 0)
const LIGHT = Math.log(Math.min(...POOL.map(s => s.kg[1] ?? 1)))
const HEAVY = Math.log(Math.max(...POOL.map(s => s.kg[1] ?? 1)))
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const round1 = (x: number) => Math.round(x * 10) / 10

/** How long a run was, as 0 (3 s) to 1 (5 min and more). */
export const lengthOf = (ms: number): number => clamp01(Math.log(Math.max(ms, BITE_MS) / BITE_MS) / Math.log(100))

function weigh(s: Species, random: Random, skew: number): { kg: number; big: boolean } {
  const [lo = 0, hi = lo] = s.kg
  const u = 1 - (1 - random()) ** (1 + 2 * skew)
  return { kg: round1(lo + (hi - lo) * u), big: u >= 0.84 }
}

/** A green run: short runs bring small fish, long runs the heavy ones. */
export function landGreen(ms: number, random: Random): Fish {
  const t = lengthOf(ms)
  const size = (s: Species) => (Math.log(s.kg[1] ?? 1) - LIGHT) / (HEAVY - LIGHT)
  const pick = weighted(POOL, s => (s.rarity ?? 0) * (0.04 + Math.exp(-((size(s) - t) ** 2) / 0.065)), random) ?? POOL[0]!
  const { kg, big } = weigh(pick, random, t)
  return { id: pick.id, name: pick.name, kg, ...(big ? { big: true as const } : {}) }
}

/** A red run: junk, most often the Old Boot. */
export function landRed(random: Random): Fish {
  const junk = JUNK as Species[]
  const pick = weighted(junk, j => (j.id === 'boot' ? 8 : 1), random) ?? junk[0]!
  return { id: pick.id, name: pick.name, kg: weigh(pick, random, 0).kg, junk: true }
}

/** A merged pull request: the legend of Loon Lake. */
export function landLegend(random: Random): Fish {
  const golden = ALL.find(s => s.id === 'golden')!
  return { id: golden.id, name: golden.name, article: golden.article, kg: weigh(golden, random, 1).kg, legend: true }
}

/** The game's reveal line, with the weight: "It is a huge Walleye! 6.1 kg". */
export function revealText(f: Fish): string {
  let line: string
  if (f.legend === true) line = `It is ${f.article ? `${f.article} ` : ''}${f.name}!`
  else if (f.big === true) line = `It is a huge ${f.name}!`
  else if (/^The /.test(f.name)) line = `It is the ${f.name.slice(4)}!`
  else if (/'s /.test(f.name)) line = `It is ${f.name}!`
  else line = `It is ${/^[aeiou]/i.test(f.name) ? 'an' : 'a'} ${f.name}!`
  return `${line} ${f.kg} kg`
}

/** One goal a day, picked by the day's number. */
export type Goal = { id: string; text: string; target: number }

export const GOALS: readonly Goal[] = [
  { id: 'five', text: 'Land 5 fish', target: 5 },
  { id: 'kinds', text: 'Land 3 kinds of fish', target: 3 },
  { id: 'heavy', text: 'Land a fish of 4 kg or more', target: 1 },
  { id: 'trout', text: 'Land a trout or a steelhead', target: 1 },
  { id: 'clean', text: 'Land 3 fish in a row with no junk', target: 3 },
  { id: 'huge', text: 'Land a huge fish', target: 1 },
]

export const goalOf = (day: number): Goal => GOALS[((day % GOALS.length) + GOALS.length) % GOALS.length]!

const TROUT = new Set(['laketrout', 'brooktrout', 'browntrout', 'steelhead'])

/** How far today's catch has come on a goal. */
export function progressOf(goal: Goal, today: readonly Fish[]): number {
  const fish = today.filter(f => f.junk !== true)
  switch (goal.id) {
    case 'five': return fish.length
    case 'kinds': return new Set(fish.map(f => f.id)).size
    case 'heavy': return fish.some(f => f.kg >= 4) ? 1 : 0
    case 'trout': return fish.some(f => TROUT.has(f.id)) ? 1 : 0
    case 'huge': return fish.some(f => f.big === true || f.legend === true) ? 1 : 0
    case 'clean': {
      let run = 0, best = 0
      for (const f of today) { run = f.junk === true ? 0 : run + 1; best = Math.max(best, run) }
      return best
    }
    default: return 0
  }
}

/** The creel kept across sessions. */
export type Creel = CreelBook

export const EMPTY_CREEL: Creel = { total: 0, junk: 0, kinds: {}, legends: [] }

export function addTo(creel: Creel, f: Fish): Creel {
  if (f.junk === true) return { ...creel, junk: creel.junk + 1 }
  const had = creel.kinds[f.id]
  const kinds = { ...creel.kinds, [f.id]: { name: f.name, count: (had?.count ?? 0) + 1, best: Math.max(had?.best ?? 0, f.kg) } }
  const legends = f.legend === true && !creel.legends.includes(f.id) ? [...creel.legends, f.id] : creel.legends
  return { ...creel, total: creel.total + 1, kinds, legends }
}
