// The calls of Shore of the Ancients (public/tidebreak/announcer.js), with a green check run as a kill:
// first blood, the multi kills within one turn, the streaks, and the shut down when a red run ends a
// streak. Pure: register.ts keeps the tally and plays the clips.
import type { AnnouncerTally } from '../types'

export type Tally = AnnouncerTally

/** One call: the banner title, the clip in announcer/ without .mp3, and a detail line. */
export type Call = { title: string; clip: string; detail: string }

export const EMPTY: Tally = { greens: 0, reds: 0, streak: 0, turnGreens: 0 }

const MULTI = [null, null, 'Double kill', 'Triple kill', 'Mayhem', 'Rampage'] as const
const STREAK: Readonly<Record<number, string>> = {
  3: 'Killing spree', 4: 'Dominating', 5: 'Mega kill', 6: 'Ownage', 7: 'Massacre', 8: 'Carnage', 9: 'Godlike',
}

export const streakName = (n: number): string | null => (n >= 9 ? 'Godlike' : (STREAK[n] ?? null))
export const multiName = (n: number): string | null => (n >= 2 ? (MULTI[Math.min(5, n)] ?? null) : null)
export const clipFor = (title: string): string => title.toLowerCase().replace(/\s+/g, '-')

/** A green check run: first blood comes first, then a multi kill, then a streak, as in killCall. */
export function green(t: Tally, what: string): { tally: Tally; call: Call | null } {
  const tally = { ...t, greens: t.greens + 1, streak: t.streak + 1, turnGreens: t.turnGreens + 1 }
  if (tally.greens === 1) return { tally, call: { title: 'First blood', clip: 'first-blood', detail: what } }
  const multi = multiName(tally.turnGreens)
  if (multi !== null) return { tally, call: { title: multi, clip: clipFor(multi), detail: `${tally.turnGreens} green runs this turn` } }
  const streak = streakName(tally.streak)
  if (streak !== null) return { tally, call: { title: streak, clip: clipFor(streak), detail: `${tally.streak} green runs in a row` } }
  return { tally, call: null }
}

/** A red check run: it ends the streak, and a streak of 3 or more is shut down. */
export function red(t: Tally): { tally: Tally; call: Call | null } {
  const tally = { ...t, reds: t.reds + 1, streak: 0 }
  if (t.streak >= 3) return { tally, call: { title: 'Shut down', clip: 'game-over', detail: `the ${t.streak}-run streak ends` } }
  return { tally, call: null }
}

/** A new main turn: the multi-kill count starts over. */
export const newTurn = (t: Tally): Tally => ({ ...t, turnGreens: 0 })

/** A merged pull request: flawless with no red run this session. */
export const merged = (t: Tally): Call =>
  t.reds === 0
    ? { title: 'Flawless victory', clip: 'flawless-victory', detail: 'the pull request is merged' }
    : { title: 'You win', clip: 'you-win', detail: 'the pull request is merged' }

export const LOST: Call = { title: 'You lose', clip: 'you-lose', detail: 'a check failed on GitHub' }
export const GREETING: Call = { title: 'Prepare yourself', clip: 'prepare-yourself', detail: '' }

/** The toast for a call. */
export const toastOf = (call: Call): string => (call.detail ? `${call.title.toUpperCase()} · ${call.detail}` : call.title.toUpperCase())
